import { spawn, ChildProcess } from 'child_process';
// import { EventEmitter } from 'events';
// import { randomUUID } from 'crypto';
import * as path from 'path';

// ─── Protocol Types ────────────────────────────────────────────────────────────

export type MessageKind = 'event' | 'rpc:request' | 'rpc:response';

export interface BaseMessage {
  kind: MessageKind;
}

export interface EventMessage extends BaseMessage {
  kind: 'event';
  event: string;
  payload: unknown;
}

export interface RpcRequest extends BaseMessage {
  kind: 'rpc:request';
  id: string;
  method: string;
  args: unknown[];
}

export interface RpcResponse extends BaseMessage {
  kind: 'rpc:response';
  id: string;
  result?: unknown;
  error?: string;
}

export type ThreadMessage = EventMessage | RpcRequest | RpcResponse;

// ─── Pending RPC call ──────────────────────────────────────────────────────────

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

// ─── Thread Options ────────────────────────────────────────────────────────────

export interface ThreadOptions {
  /** Initial data passed to the worker via workerData */
  workerData?: Record<string, unknown>;
  /** RPC call timeout in ms (default: 10_000) */
  rpcTimeout?: number;
  /** Whether the worker file is already compiled JS (default: auto-detect by extension) */
  isJS?: boolean;
}

// ─── Thread ───────────────────────────────────────────────────────────────────

/**
 * Wraps a child process (via spawn) and exposes:
 *  - `send(event, payload)`  — fire-and-forget event al proceso hijo
 *  - `on(event, handler)`    — escucha eventos del proceso hijo
 *  - `call(method, ...args)` — RPC: llamada awaitable al proceso hijo
 *  - `expose(method, fn)`    — registra un método que el hijo puede llamar
 *
 * Comunicación: canal IPC nativo de Node.js (stdio: 'ipc').
 * Los datos iniciales se pasan como variable de entorno THREAD_DATA (JSON).
 */
export class Thread extends EventEmitter {
  private child: ChildProcess;
  private pending = new Map<string, PendingCall>();
  private handlers = new Map<string, (...args: unknown[]) => unknown>();
  private rpcTimeout: number;

  constructor(filePath: string, options: ThreadOptions = {}) {
    super();

    const { workerData = {}, rpcTimeout = 10_000, isJS } = options;

    const resolved = path.resolve(filePath);
    const isTypeScript = !(isJS ?? resolved.endsWith('.js'));

    this.rpcTimeout = rpcTimeout;

    // Elegir el ejecutable: tsx para .ts, node para .js
    const executable = isTypeScript ? 'tsx' : 'node';

    this.child = spawn(executable, [resolved], {
      // 'ipc' habilita child.send() / process.on('message') en ambos lados
      // inherit para que stdout/stderr del hijo se vean en la terminal
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: {
        ...process.env,
        // Serializar workerData como JSON para que el hijo lo lea
        THREAD_DATA: JSON.stringify(workerData)
      }
    });

    this.child.on('message', (msg: ThreadMessage) => this._handleMessage(msg));
    this.child.on('error', (err) => this.emit('error', err));
    this.child.on('exit', (code) => this.emit('exit', code ?? -1));
  }

  // ── Outbound: Main → Hijo ────────────────────────────────────────────────────

  /** Envía un evento fire-and-forget al proceso hijo */
  send(event: string, payload?: unknown): void {
    const msg: EventMessage = { kind: 'event', event, payload };
    this.child.send(msg);
  }

  /** Llama a un método RPC expuesto en el proceso hijo. Devuelve una Promise. */
  call<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = randomUUID();

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: "${method}" no respondió en ${this.rpcTimeout}ms`));
      }, this.rpcTimeout);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeout
      });

      const msg: RpcRequest = { kind: 'rpc:request', id, method, args };
      this.child.send(msg);
    });
  }

  // ── Inbound: Hijo → Main ─────────────────────────────────────────────────────

  /** Registra un método RPC que el proceso hijo puede invocar con ctx.call() */
  expose(method: string, fn: (...args: unknown[]) => unknown): void {
    this.handlers.set(method, fn);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /** Termina el proceso hijo */
  terminate(): Promise<void> {
    return new Promise((resolve) => {
      this.child.once('exit', () => resolve());
      this.child.kill('SIGTERM');
    });
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private async _handleMessage(msg: ThreadMessage) {
    switch (msg.kind) {
      case 'event': {
        this.emit(msg.event, msg.payload);
        break;
      }

      case 'rpc:request': {
        const handler = this.handlers.get(msg.method);
        let response: RpcResponse;

        if (!handler) {
          response = {
            kind: 'rpc:response',
            id: msg.id,
            error: `No hay handler registrado para el método "${msg.method}"`
          };
        } else {
          try {
            const result = await handler(...msg.args);
            response = { kind: 'rpc:response', id: msg.id, result };
          } catch (err: unknown) {
            response = {
              kind: 'rpc:response',
              id: msg.id,
              error: err instanceof Error ? err.message : String(err)
            };
          }
        }

        this.child.send(response);
        break;
      }

      case 'rpc:response': {
        const pending = this.pending.get(msg.id);
        if (!pending) return;

        clearTimeout(pending.timeout);
        this.pending.delete(msg.id);

        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
        break;
      }
    }
  }
}

// ------------------------------------------------------------------------------------------

import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type {
  ThreadMessage,
  EventMessage,
  RpcRequest,
  RpcResponse,
} from "./Thread";

// ─── Pending RPC calls initiated from the worker side ─────────────────────────

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

// ─── WorkerContext ─────────────────────────────────────────────────────────────

/**
 * API available inside a worker file.
 *
 * Usage at the top of your worker:
 *
 *   import { ctx } from "../src/WorkerContext";
 *
 *   // Listen to events sent from the main thread
 *   ctx.on("greet", (name) => console.log("Hello,", name));
 *
 *   // Register RPC methods callable from the main thread
 *   ctx.expose("add", (a, b) => (a as number) + (b as number));
 *
 *   // Call an RPC method on the main thread
 *   const result = await ctx.call("dbQuery", "SELECT 1");
 *
 *   // Send an event to the main thread
 *   ctx.send("progress", { pct: 42 });
 */
class WorkerContext extends EventEmitter {
  /** Data passed when the Thread was constructed */
  readonly data: Record<string, unknown>;

  private handlers = new Map<string, (...args: unknown[]) => unknown>();
  private pending = new Map<string, PendingCall>();
  private rpcTimeout = 10_000;

  constructor() {
    super();

    if (!process.send) {
      throw new Error(
        "WorkerContext debe usarse dentro de un proceso hijo lanzado con el canal IPC (stdio: 'ipc')."
      );
    }

    // workerData llega serializado como JSON en la variable de entorno THREAD_DATA
    this.data = process.env.THREAD_DATA
      ? (JSON.parse(process.env.THREAD_DATA) as Record<string, unknown>)
      : {};

    process.on("message", (msg: ThreadMessage) => this._handleMessage(msg));
  }

  // ── Outbound: Hijo → Main ────────────────────────────────────────────────────

  /** Envía un evento fire-and-forget al proceso principal */
  send(event: string, payload?: unknown): void {
    const msg: EventMessage = { kind: "event", event, payload };
    process.send!(msg);
  }

  /** Llama a un método RPC expuesto en el proceso principal. Devuelve una Promise. */
  call<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = randomUUID();

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: "${method}" no respondió en ${this.rpcTimeout}ms`));
      }, this.rpcTimeout);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeout,
      });

      const msg: RpcRequest = { kind: "rpc:request", id, method, args };
      process.send!(msg);
    });
  }

  // ── Inbound: Main → Hijo ─────────────────────────────────────────────────────

  /** Registra un método RPC que el proceso principal puede invocar con thread.call() */
  expose(method: string, fn: (...args: unknown[]) => unknown): void {
    this.handlers.set(method, fn);
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private async _handleMessage(msg: ThreadMessage) {
    switch (msg.kind) {
      case "event": {
        this.emit(msg.event, msg.payload);
        break;
      }

      case "rpc:request": {
        const handler = this.handlers.get(msg.method);
        let response: RpcResponse;

        if (!handler) {
          response = {
            kind: "rpc:response",
            id: msg.id,
            error: `El proceso hijo no tiene handler para el método "${msg.method}"`,
          };
        } else {
          try {
            const result = await handler(...msg.args);
            response = { kind: "rpc:response", id: msg.id, result };
          } catch (err: unknown) {
            response = {
              kind: "rpc:response",
              id: msg.id,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }

        process.send!(response);
        break;
      }

      case "rpc:response": {
        const pending = this.pending.get(msg.id);
        if (!pending) return;

        clearTimeout(pending.timeout);
        this.pending.delete(msg.id);

        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
        break;
      }
    }
  }
}

// Singleton — import { ctx } in every worker file
export const ctx = new WorkerContext();
