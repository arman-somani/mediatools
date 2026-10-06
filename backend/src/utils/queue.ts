import { env } from '../config/env';

export interface Task {
  /** The conversion id, used to report queue position to the client. */
  id: string;
  execute: () => Promise<void>;
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

  /** @throws QueueFullError when the backlog is at capacity. */
  add(task: Task): void {
    if (this.queue.length >= env.maxQueueDepth) {
      throw new QueueFullError(this.queue.length);
    }
    this.queue.push(task);
    void this.drain();
  }

  /** 1-based position, or 0 when running or finished. */
  getQueuePosition(id: string): number {
    const index = this.queue.findIndex(t => t.id === id);
    return index === -1 ? 0 : index + 1;
  }

  isCurrentlyProcessing(id: string): boolean {
    return this.currentTaskId === id;
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
        task = this.queue.shift();
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const conversionQueue = new TaskQueue();
