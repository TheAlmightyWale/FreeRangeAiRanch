import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export const TaskStatus = Object.freeze({
  QUEUED:   'queued',
  RUNNING:  'running',
  COMPLETE: 'complete',
  FAILED:   'failed',
});

export class TaskQueue extends EventEmitter {
  #queue = [];
  #current = null;

  enqueue({ description, threadId, channelId, submittedBy }) {
    const task = {
      id: randomUUID(),
      description,
      threadId,
      channelId,
      submittedBy,
      submittedAt: new Date(),
      startedAt: null,
      status: TaskStatus.QUEUED,
    };
    this.#queue.push(task);
    this.#advance();
    return task;
  }

  complete(status) {
    if (!this.#current) return;
    this.#current.status = status;
    this.#current = null;
    this.#advance();
  }

  getStatus() {
    return {
      current: this.#current,
      pending: [...this.#queue],
      size: this.#queue.length,
    };
  }

  #advance() {
    if (this.#current !== null || this.#queue.length === 0) return;
    const task = this.#queue.shift();
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    this.#current = task;
    this.emit('task:start', task);
  }
}
