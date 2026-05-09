import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'events';

import { threadContext } from '../../src/models/ThreadContext';
import { EventMessage } from '../../src/models/ThreadMessage';

describe('ThreadContext', () => {
  let originalSend: typeof process.send;

  beforeEach(() => {
    originalSend = process.send!;
    process.send = mock.fn() as unknown as typeof process.send;
  });

  afterEach(() => {
    process.send = originalSend;
  });

  // Es una instancia de EventEmitter
  it('should be an instance of EventEmitter', () => {
    assert.ok(threadContext instanceof EventEmitter);
  });

  // Es un singleton exportado
  it('should be a singleton export', async () => {
    const { threadContext: same } = await import('../../src/models/ThreadContext');
    assert.strictEqual(same, threadContext);
  });

  // Llama a process.send al invocar send()
  it('should call process.send when send() is invoked', () => {
    threadContext.send('test-event', { value: 1 });

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    assert.equal(sendMock.mock.callCount(), 1);
  });

  // Envía un mensaje con kind "event"
  it('should send a message with kind "event"', () => {
    threadContext.send('my-event');

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    const msg: EventMessage | unknown = sendMock.mock.calls[0].arguments[0];
    assert.equal((msg as EventMessage).kind, 'event');
  });

  // Incluye el nombre del evento en el mensaje
  it('should include the event name in the message', () => {
    threadContext.send('custom-event');

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    const msg: EventMessage | unknown = sendMock.mock.calls[0].arguments[0];
    assert.equal((msg as EventMessage).event, 'custom-event');
  });

  // Incluye el payload en el mensaje
  it('should include the payload in the message', () => {
    const payload = { key: 'value', num: 42 };
    threadContext.send('data-event', payload);

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    const msg: EventMessage = sendMock.mock.calls[0].arguments[0] as EventMessage;
    assert.deepEqual(msg.payload, payload);
  });

  // Envía undefined como payload cuando no se proporciona
  it('should send undefined as payload when none is provided', () => {
    threadContext.send('no-payload');

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    const msg: EventMessage = sendMock.mock.calls[0].arguments[0] as EventMessage;
    assert.equal(msg.payload, undefined);
  });

  // Genera un id único (UUID) en cada mensaje
  it('should generate a unique id for each message', () => {
    threadContext.send('event-1');
    threadContext.send('event-2');

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    const msg1: EventMessage = sendMock.mock.calls[0].arguments[0] as EventMessage;
    const msg2: EventMessage = sendMock.mock.calls[1].arguments[0] as EventMessage;

    assert.ok(typeof msg1.id === 'string');
    assert.ok(msg1.id.length > 0);
    assert.notEqual(msg1.id, msg2.id);
  });

  // El id tiene formato UUID válido
  it('should generate a valid UUID format for the id', () => {
    threadContext.send('uuid-check');

    const sendMock = process.send as unknown as ReturnType<typeof mock.fn>;
    const msg: EventMessage = sendMock.mock.calls[0].arguments[0] as EventMessage;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert.match(msg.id, uuidRegex);
  });
});
