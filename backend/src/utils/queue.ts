type Task = {
  id: string; // The conversion or job ID
  execute: () => Promise<void>;
};

class TaskQueue {
  private queue: Task[] = [];
  private isProcessing = false;
  private currentTaskId: string | null = null;

  add(task: Task) {
    this.queue.push(task);
    this.process();
  }

  getQueuePosition(id: string): number {
    const index = this.queue.findIndex(t => t.id === id);
    if (index !== -1) {
      return index + 1; // 1-based position in the queue
    }
    return 0; // Not in queue (either currently processing or finished)
  }

  isCurrentlyProcessing(id: string): boolean {
    return this.currentTaskId === id;
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    const task = this.queue.shift();
    if (task) {
      this.currentTaskId = task.id;
      try {
        await task.execute();
      } catch (err) {
        console.error('Queue execution error:', err);
      }
      this.currentTaskId = null;
    }
    
    this.isProcessing = false;
    this.process();
  }
}

export const conversionQueue = new TaskQueue();
