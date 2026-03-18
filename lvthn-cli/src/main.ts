/**
 * main.ts — Entry point for the lvthn CLI tool.
 *
 * Parses arguments and dispatches to the appropriate command handler.
 * All errors are caught here so the user never sees a raw stack trace.
 */

import { init } from 'leviathan-crypto';
import { parseCliArgs, printHelp, die } from './cli.ts';
import { runEncrypt } from './commands/encrypt.ts';
import { runDecrypt } from './commands/decrypt.ts';
import { runKeygen } from './commands/keygen.ts';

const args = parseCliArgs();

// --help, help command, or no command all show help
if (args.help || !args.command || args.command === 'help') {
	printHelp(); // exits 0
}

// Initialize leviathan-crypto WASM modules
await init(['serpent', 'sha2', 'sha3']);

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
	// Catch any unhandled errors so the user never sees a raw stack trace
	const msg = err instanceof Error ? err.message : String(err);
	die(`Unexpected error: ${msg}`, 2);
}

process.exit(0);
