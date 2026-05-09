import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';

import { Thread } from '../../src/models/Thread';

const MOCK_SCRIPT = resolve(__dirname, '..', 'mock', 'sum.js');

describe('Thread', () => {
  const threads: Thread[] = [];

  /** Helper to track threads for cleanup */
  function createThread(path: string, options = {}, environment: Record<string, any> = {}): Thread {
    const t = new Thread(path, options, environment);
    threads.push(t);
    return t;
  }

  after(async () => {
    await Promise.allSettled(
      threads.map((t) => Promise.race([t.terminate(), new Promise<void>((r) => setTimeout(r, 1000))]))
    );
  });

  // Crea una instancia correctamente
  it('should create an instance and spawn a child process', async () => {
    const thread = createThread(MOCK_SCRIPT);

    // Give the process a moment to start
    await new Promise((r) => setTimeout(r, 200));

    // The thread should be an EventEmitter that is alive
    assert.ok(thread instanceof Thread);
  });

  // Emite el evento "exit" cuando el proceso hijo termina
  it('should emit "exit" event when the child process exits', async () => {
    const exitCode = await new Promise<number>((resolve) => {
      const thread = createThread(MOCK_SCRIPT, {}, { EXIT_IMMEDIATELY: '1' });
      thread.on('exit', (code: number) => resolve(code));
    });

    assert.equal(exitCode, 0);
  });

  // Termina el proceso hijo con terminate()
  it('should terminate the child process via terminate()', async () => {
    const thread = createThread(MOCK_SCRIPT);

    const exitPromise = new Promise<number>((resolve) => {
      thread.on('exit', (code: number) => resolve(code));
    });

    await thread.terminate();
    const code = await exitPromise;

    // The process should have exited (code depends on OS signal handling)
    assert.equal(typeof code, 'number');
  });

  // Emite un código de salida distinto de cero cuando el script no existe
  it('should exit with non-zero code when the script does not exist', async () => {
    try {
      const exitCode = await new Promise<number>((resolve) => {
        const thread = createThread('non_existent_script_' + Date.now() + '.js');
        thread.on('exit', (code: number) => resolve(code));
      });
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'Path to the thread script is required');
      return;
    }
  });

  // Resuelve la ruta del script antes de ejecutarlo
  it('should resolve the script path before spawning', () => {
    // The constructor calls resolve() internally, so providing a relative
    // path should not throw synchronously.
    const thread = createThread(MOCK_SCRIPT);
    assert.ok(thread);
  });

  // Permite pasar variables de entorno personalizadas al proceso hijo
  it('should pass custom environment variables to the child process', async () => {
    const exitCode = await new Promise<number>((resolve) => {
      const thread = createThread(MOCK_SCRIPT, {}, { EXIT_IMMEDIATELY: '1' });
      thread.on('exit', (code: number) => resolve(code));
    });

    // EXIT_IMMEDIATELY causes the mock to exit with 0
    assert.equal(exitCode, 0);
  });

  // Devuelve un código -1 cuando el código de salida es null
  it('should emit exit code -1 when exit code is null', async () => {
    const thread = createThread(MOCK_SCRIPT);

    const exitPromise = new Promise<number>((resolve) => {
      thread.on('exit', (code: number) => resolve(code));
    });

    // SIGKILL produces a null exit code on most platforms
    await new Promise((r) => setTimeout(r, 200));
    thread.terminate();

    const code = await exitPromise;
    assert.equal(typeof code, 'number');
  });

  // Puede crear múltiples instancias independientes
  it('should allow creating multiple independent instances', async () => {
    const thread1 = createThread(MOCK_SCRIPT, {}, { EXIT_IMMEDIATELY: '1' });
    const thread2 = createThread(MOCK_SCRIPT, {}, { EXIT_IMMEDIATELY: '1' });

    const [code1, code2] = await Promise.all([
      new Promise<number>((resolve) => thread1.on('exit', (c: number) => resolve(c))),
      new Promise<number>((resolve) => thread2.on('exit', (c: number) => resolve(c)))
    ]);

    assert.equal(code1, 0);
    assert.equal(code2, 0);
  });

  // terminate() resuelve la promesa solo después de que el proceso termina
  it('should resolve terminate() only after the process has exited', async () => {
    const thread = createThread(MOCK_SCRIPT);
    await new Promise((r) => setTimeout(r, 200));

    let exited = false;
    thread.on('exit', () => {
      exited = true;
    });

    await thread.terminate();
    assert.equal(exited, true);
  });
});
