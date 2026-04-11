# alarife-thread
Tool for the master builder's environment for the management of multiple processes.

Este codigo tiene que gestionar la creacion de sub hilos y comunicacion segura mediante mensaje
Tiene que ofrecer patrones de uso simples con clases como "Thread" y como "Message" --> Importante aqui, protocolo RCP

tambien debe ofrecer un sistema de lectura en el hijo, para ofrecer el dato deserializado y usable.

´´´
// ---------------------------------------- script common
function createDecoder(onMessage: (msg: any) => void) {
  let buffer = Buffer.alloc(0);

  return (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    let offset = 0;

    while (buffer.length - offset >= 4) {
      const length = buffer.readUInt32BE(offset);

      if (buffer.length - offset < 4 + length) break;

      const message = buffer.subarray(offset + 4, offset + 4 + length);
      const parsed = JSON.parse(message.toString());

      onMessage(parsed);

      offset += 4 + length;
    }

    buffer = buffer.subarray(offset);
  };
}

// ---------------------------------------- script PARENT
import { spawn } from 'child_process';

const sensitiveData = {
  user: 'pepe',
  password: '1234'
};

function encode(msg: any): Buffer {
  const payload = Buffer.from(JSON.stringify(msg));
  const header = Buffer.alloc(4);

  header.writeUInt32BE(payload.length);

  return Buffer.concat([header, payload]);
}

const child = spawn('node', ['script2.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const pending = new Map<string, (res: any) => void>();

const decoder_parent = createDecoder((msg) => {
  const cb = pending.get(msg.id);
  if (!cb) return;

  pending.delete(msg.id);

  if (msg.type === "result") {
    cb(msg.payload);
  } else {
    throw new Error(msg.error);
  }
});

child.stdout.on('data', decoder_parent);

function call(method: string, payload: any) {
  const id = Math.random().toString(16).slice(2);

  const promise = new Promise((resolve) => {
    pending.set(id, resolve);
  });

  child.stdin.write(
    encode({
      id,
      type: "call",
      method,
      payload
    })
  );

  return promise;
}
// ---------------------------------------- script CHILD


function handleMessage(msg: any) {
  if (msg.type !== 'call') return;

  try {
    if (msg.method === 'decrypt') {
      const result = {
        decrypted: msg.payload.data + '_decrypted'
      };

      reply(msg.id, result);
    }
  } catch (err: any) {
    process.stdout.write(
      encode({
        id: msg.id,
        type: 'error',
        error: err.message
      })
    );
  }
}

const decoder_child = createDecoder(handleMessage);

process.stdin.on('data', decoder_child);

function reply(id: string, payload: any) {
  const msg = {
    id,
    type: 'result',
    payload
  };

  process.stdout.write(encode(msg));
}
´´´

