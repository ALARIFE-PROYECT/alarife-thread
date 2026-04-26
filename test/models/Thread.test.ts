
import assert from 'node:assert';
import { describe, it } from 'node:test';

import { Thread } from '../../src/models/Thread';

describe('Thread', () => {
	const mockPath = 'test/mock/sum.js';

	it('emite "exit" con código 0 cuando el proceso sale inmediatamente', (done) => {
		const t = new Thread(mockPath, {}, { ...process.env, EXIT_IMMEDIATELY: '1' });

		t.once('error', (err) => done(err));
		t.once('exit', (code) => {
			try {
				assert.strictEqual(code, 0);
				done();
			} catch (err) {
				done(err as Error);
			}
		});
	});

	it('terminate() resuelve y emite exit al matar el proceso hijo', async () => {
		const t = new Thread(mockPath, {}, { ...process.env });
		let exitCode: number | undefined;

		t.once('exit', (code) => {
			exitCode = code as number;
		});

		await t.terminate();

		assert.strictEqual(typeof exitCode, 'number');
	});
});
