import { env } from '../config/env';

export interface Task {
  /** The conversion id, used to report queue position to the client. */
  id: string;
  execute: () => Promise<void>;
}

/** What is on the worker right now, shown to everyone waiting. */
export interface CurrentJob {
  id: string;
  /** Human-facing name: video title or uploaded filename. */
  title: string;
  /** Coarse kind, e.g. audio | video | upload. */
  type: string;
  progress: number;
  startedAt: number;
}

/** Thrown when the backlog is full. Surfaces as a 503 with a Retry-After. */
export class QueueFullError extends Error {
  readonly status = 503;
  readonly code = 'QUEUE_FULL';
  constructor(depth: number) {
    super(
      `The server is already working through ${depth} downloads. `
      + 'Please try again in a few minutes.'
    );
    this.name = 'QueueFullError';
  }
}

/**
 * Runs conversions one at a time.
 *
 * Serial execution is not a simplification, it is the constraint. A single
 * 1080p merge holds yt-dlp and ffmpeg open together for most of a container's
 * memory budget; running two at once on a 512MB instance reliably ends in the
 * kernel killing the process group, which looks to users like the site randomly
 * dropping their download halfway through.
 *
 * The queue is bounded for the same reason. Previously it accepted work without
 * limit, so a burst of traffic produced a backlog that could not be worked
 * through before the jobs' own output files expired — every one of those users
 * waited for a file that was deleted before they could reach it. Refusing work
 * with an honest "try again shortly" is better than accepting work that cannot
 * be delivered.
 */
class TaskQueue {
  private queue: Task[] = [];
  private isProcessing = false;
  private currentTaskId: string | null = null;
  /** Metadata for the running job, published via GET /convert/queue. */
  private current: CurrentJob | null = null;

  /** @throws QueueFullError when the backlog is at capacity. */
  add(task: Task): void {
    if (this.queue.length >= env.maxQueueDepth) {
      throw new QueueFullError(this.queue.length);
    }
    this.queue.push(task);
    void this.drain();
  }

  /**
   * Whether `add` would succeed.
   *
   * The routes create a Conversion document and answer the client with its id
   * *before* enqueuing the work. So capacity has to be checked up front: a
   * rejection discovered at enqueue time would happen after the response had
   * already gone out, leaving the caller holding a job id for work that was
   * never queued, polling it until it timed out. Checking first turns that into
   * a 503 the client can act on.
   */
  hasCapacity(): boolean {
    return this.queue.length < env.maxQueueDepth;
  }

  /** 1-based position, or 0 when running or finished. */
  getQueuePosition(id: string): number {
    const index = this.queue.findIndex(t => t.id === id);
    return index === -1 ? 0 : index + 1;
  }

  isCurrentlyProcessing(id: string): boolean {
    return this.currentTaskId === id;
  }

  /**
   * Publishes what is being downloaded right now.
   *
   * Deliberately anonymous: the title, kind and progress only. No user ids,
   * no links — enough for a waiting user to see the worker is genuinely busy,
   * not enough to leak anyone's activity to the next visitor.
   */
  setCurrent(job: CurrentJob): void {
    this.current = job;
    this.currentTaskId = job.id;
  }

  /** Live progress for the published job; ignored if it is no longer current. */
  reportProgress(id: string, progress: number): void {
    if (this.current?.id === id) this.current.progress = progress;
  }

  /** Clears the published job, but only if `id` still owns the slot. */
  clearCurrent(id: string): void {
    if (this.current?.id === id) this.current = null;
  }

  /** One-shot view for the queue endpoint. */
  snapshot(): { busy: boolean; waiting: number; current: CurrentJob | null } {
    return {
      busy: this.isProcessing && this.current !== null,
      waiting: this.queue.length,
      current: this.current ? { ...this.current } : null,
    };
  }

  /** Waiting jobs, excluding the one currently running. */
  get depth(): number {
    return this.queue.length;
  }

  get busy(): boolean {
    return this.isProcessing;
  }

  /**
   * Drains the queue in a loop.
   *
   * The previous implementation called itself recursively after each task. It
   * worked, but a loop makes it obvious that nothing re-enters the critical
   * section and there is no stack to grow.
   */
  private async drain(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      let task = this.queue.shift();
      while (task) {
        this.currentTaskId = task.id;
        try {
          await task.execute();
        } catch (error) {
          // A task is responsible for recording its own failure on the
          // Conversion document. Reaching here means it threw anyway, and
          // swallowing it is deliberate: one bad job must not stop the queue.
          console.error(`[queue] task ${task.id} threw:`, error);
        }
        this.currentTaskId = null;
        this.current = null; // safety net if the task forgot to clear itself
        task = this.queue.shift();
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const conversionQueue = new TaskQueue();
