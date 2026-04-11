import assert from 'assert';
import { test } from 'node:test';

import { sum } from '../src/index';

test('sum of two positive numbers', () => {
	assert.strictEqual(sum(2, 3), 5);
});
