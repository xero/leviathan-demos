/**
 * main.ts — Entry point for the unified lvthn tool.
 * Supports Serpent-256-CTR+HMAC-SHA256 and XChaCha20-Poly1305.
 */

import { init } from 'leviathan-crypto';
import { parseCliArgs, printHelp, die } from './cli.ts';
import { runEncrypt } from './commands/encrypt.ts';
import { runDecrypt } from './commands/decrypt.ts';
import { runKeygen } from './commands/keygen.ts';
import { disposeActiveSerpentPool } from './serpent/pool.ts';
import { disposeActiveChaChaPool }  from './chacha/pool.ts';
import { stopSpinner } from './spinner.ts';

process.on('exit', () => {
	stopSpinner();
	disposeActiveSerpentPool();
	disposeActiveChaChaPool();
});

const args = parseCliArgs();

if (args.help || !args.command || args.command === 'help') {
	printHelp();
}

await init(['serpent', 'sha2', 'chacha20']);

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
