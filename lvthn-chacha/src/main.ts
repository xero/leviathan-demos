/**
 * main.ts — Entry point for lvthn-chacha.
 * XChaCha20-Poly1305 only needs the chacha20 WASM module.
 */

import { init } from 'leviathan-crypto';
import { parseCliArgs, printHelp, die } from './cli.ts';
import { runEncrypt } from './commands/encrypt.ts';
import { runDecrypt } from './commands/decrypt.ts';
import { runKeygen } from './commands/keygen.ts';
import { disposeActivePool } from './pool.ts';
import { stopSpinner } from './spinner.ts';

process.on('exit', () => {
	stopSpinner();
	disposeActivePool();
});

const args = parseCliArgs();

if (args.help || !args.command || args.command === 'help') {
	printHelp();
}

await init(['chacha20']);

try {
	switch (args.command) {
	case 'encrypt':
		await runEncrypt(args);
		break;
	case 'decrypt':
		await runDecrypt(args);
		break;
	case 'keygen':
		await runKeygen(args);
		break;
	default:
		die(`Unknown command: ${args.command}`, 2);
	}
} catch (err) {
	const msg = err instanceof Error ? err.message : String(err);
	die(`Unexpected error: ${msg}`, 2);
}

process.exit(0);
