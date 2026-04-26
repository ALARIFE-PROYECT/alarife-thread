import EventEmitter from 'events';
import { EventMessage } from './ThreadMessage';
import { randomUUID } from 'crypto';

class ThreadContext extends EventEmitter {
  constructor() {
    super();
  }

  send(event: string, payload?: unknown): void {
    const msg: EventMessage = { kind: 'event', id: randomUUID(), event, payload };
    process.send!(msg);
  }
}

export const threadContext = new ThreadContext();
