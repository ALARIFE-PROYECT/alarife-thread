
// Mock child process used in tests.
// - If `process.env.EXIT_IMMEDIATELY === '1'` the process exits with code 0.
// - Listens for IPC messages: { cmd: 'sum', numbers: number[] } -> replies { cmd: 'result', result }
// - Listens for { cmd: 'exit' } to exit gracefully.

if (process.env.EXIT_IMMEDIATELY === '1') {
	process.exit(0);
}

process.on('message', (msg) => {
	if (!msg || typeof msg !== 'object') return;
	if (msg.cmd === 'sum' && Array.isArray(msg.numbers)) {
		const result = msg.numbers.reduce((s, n) => s + n, 0);
		if (typeof process.send === 'function') process.send({ cmd: 'result', result });
	} else if (msg.cmd === 'exit') {
		process.exit(0);
	}
});

process.on('SIGTERM', () => process.exit(0));

// Keep the process alive until killed or asked to exit.
setInterval(() => {}, 1000);
