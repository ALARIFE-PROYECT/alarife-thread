import { ChildProcess, spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { resolve } from 'path';
import EventEmitter from 'events';
import { existsSync } from 'fs';

import { EXECUTABLE } from '../constants';
import { ThreadMessage } from './ThreadMessage';


export interface ThreadOptions extends SpawnOptionsWithoutStdio {
}

/**
 * * Thread
 * TODO: se debe implementar un protocolo RPC para envio de mensajes.
 */
export class Thread extends EventEmitter {
  private childProcess!: ChildProcess;

  private options: ThreadOptions;

  constructor(path: string, options: ThreadOptions = {}, environment: Record<string, any> = {}) {
    super();

    if (!path || !existsSync(path)) {
      throw new Error('Path to the thread script is required');
    }

    this.options = options;
    this.run(path, options, environment);
  }

  run(path: string, options: ThreadOptions, environment: Record<string, any>) {
    const resolved = resolve(path);

    this.childProcess = spawn(EXECUTABLE, [resolved], {
      // 'ipc' habilita child.send() / process.on('message') en ambos lados
      // inherit para que stdout/stderr del hijo se vean en la terminal
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: {
        ...environment
      }
    });

    this.childProcess.on('message', (msg: ThreadMessage) => this.handleMessage(msg));
    this.childProcess.on('error', (err) => this.emit('error', err));
    this.childProcess.on('exit', (code) => this.emit('exit', code ?? -1));
  }

  /** Termina el proceso hijo */
  terminate(): Promise<void> {
    return new Promise((resolve) => {
      this.childProcess.once('exit', () => resolve());
      this.childProcess.kill('SIGTERM');
    });
  }

  private handleMessage(msg: ThreadMessage) {

  }
}
