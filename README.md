# alarife-thread - Tool for the master builder's environment for the management of multiple processes.

<div align="center">

[![NPM Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://www.npmjs.com/package/alarife-thread)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

**Tool for managing processes, subprocesses and communications between them in the Alarife framework.**

</div>

## 📋 Table of Contents

- [Installation](#-installation)
- [Basic Usage](#-basic-usage)
- [Detailed API](#-detailed-api)
- [License](#-license)

## 🚀 Installation

```bash
npm install @alarife/thread --save-dev
```

## 📦 Basic Usage

### Creating a thread (parent process)

```typescript
import { Thread } from 'alarife-thread';

// Spawn a child process running a Node.js script
const thread = new Thread('./workers/my-task.js');

// Listen for events
thread.on('exit', (code: number) => {
  console.log(`Thread exited with code ${code}`);
});

thread.on('error', (err: Error) => {
  console.error('Thread error:', err);
});

// Terminate the thread when done
await thread.terminate();
```

### Sending messages from a child process

```typescript
import { threadContext } from 'alarife-thread';

// Send an event to the parent process
threadContext.send('task-completed', { result: 42 });

// Send an event without payload
threadContext.send('heartbeat');
```

### Passing environment variables

```typescript
import { Thread } from 'alarife-thread';

const thread = new Thread('./workers/my-task.js', {}, {
  API_URL: 'https://example.com',
  MAX_RETRIES: '3',
});
```

## 📖 Detailed API

### `Thread`

Class that spawns and manages a child Node.js process. Extends `EventEmitter`.

#### Constructor

```typescript
new Thread(path: string, options?: ThreadOptions, environment?: Record<string, any>)
```

| Parameter     | Type                     | Description                                                        |
|---------------|--------------------------|--------------------------------------------------------------------|
| `path`        | `string`                 | Absolute or relative path to the Node.js script to execute.        |
| `options`     | `ThreadOptions`          | Optional spawn options (extends `SpawnOptionsWithoutStdio`).       |
| `environment` | `Record<string, any>`    | Optional environment variables passed to the child process.        |

> Throws `Error` if the path is empty or does not exist.

#### Methods

| Method        | Returns          | Description                                                             |
|---------------|------------------|-------------------------------------------------------------------------|
| `terminate()` | `Promise<void>`  | Sends `SIGTERM` to the child process and resolves when it exits.        |

#### Events

| Event   | Callback signature       | Description                                                            |
|---------|--------------------------|------------------------------------------------------------------------|
| `exit`  | `(code: number) => void` | Emitted when the child process exits. Returns `-1` if code is `null`.  |
| `error` | `(err: Error) => void`   | Emitted when the child process encounters an error.                    |

---

### `threadContext`

Singleton instance used **inside a child process** to communicate with the parent. Extends `EventEmitter`.

#### Methods

| Method                                       | Returns | Description                                                      |
|----------------------------------------------|---------|------------------------------------------------------------------|
| `send(event: string, payload?: unknown)`     | `void`  | Sends an `EventMessage` to the parent process via IPC.           |

Each call to `send()` generates a message with the following structure:

```typescript
{
  kind: 'event',
  id: string,      // auto-generated UUID v4
  event: string,   // the event name
  payload: unknown // optional data
}
```

---

### Message Types

```typescript
type MessageKind = 'event' | 'rpc:request' | 'rpc:response';
```

| Interface      | `kind`           | Fields                                      |
|----------------|------------------|---------------------------------------------|
| `EventMessage` | `"event"`        | `id`, `event`, `payload`                    |
| `RpcRequest`   | `"rpc:request"`  | `id`, `method`, `args`                      |
| `RpcResponse`  | `"rpc:response"` | `id`, `result?`, `error?`                   |

All messages conform to the union type `ThreadMessage`.

## 📄 License

This project is licensed under Apache-2.0. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Soria Garcia, Jose Eduardo](mailto:alarifeproyect@gmail.com)**

<sub>🌍 Product developed in Andalucia, España 🇪🇸</sub>

*Part of the Alarife ecosystem*

</div>

