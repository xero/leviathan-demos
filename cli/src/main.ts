/**
 * main.ts — Entry point for the unified lvthn tool.
 * Supports Serpent-256-CTR+HMAC-SHA256 and XChaCha20-Poly1305.
 */

import { init } from 'leviathan-crypto';
import { serpentWasm  } from 'leviathan-crypto/serpent/embedded';
import { sha2Wasm     } from 'leviathan-crypto/sha2/embedded';
import { chacha20Wasm } from 'leviathan-crypto/chacha20/embedded';
import { parseCliArgs, printHelp, die } from './cli.ts';
import { runEncrypt } from './commands/encrypt.ts';
import { runDecrypt } from './commands/decrypt.ts';
import { runKeygen } from './commands/keygen.ts';
import { runComplete } from './commands/__complete.ts';
import { runCompletion } from './commands/completion.ts';
import { stopSpinner } from './spinner.ts';

process.on('exit', () => stopSpinner());

const rawCmd = Bun.argv[2];

if (rawCmd === '__complete') {
	runComplete();
	process.exit(0);
}

if (rawCmd === 'completion') {
	runCompletion();
	process.exit(0);
}

const args = parseCliArgs();

if (args.help || !args.command || args.command === 'help') {
	printHelp();
}

await init({ serpent: serpentWasm, sha2: sha2Wasm, chacha20: chacha20Wasm });

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
