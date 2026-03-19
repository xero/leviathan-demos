/**
 * decrypt.ts — Decrypt a SRPT256S-format file or stdin.
 *
 * Auto-detects armored vs binary input — no --armor flag needed.
 * Per-chunk HMAC-SHA256 handles authentication — if auth fails,
 * pool.open() throws and no plaintext is produced.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
import { SealPool, registerPool, unregisterPool } from '../pool.ts';
import {
	decodeBlob,
	dearmor,
	dearmorKey,
	isArmored,
	KDF_SCRYPT,
	KDF_KEYFILE,
	Srpt256sHeader,
} from '../format.ts';

export async function runDecrypt(args: ParsedArgs): Promise<void> {
	const { passphrase, keyfile, force, positionals } = args;

	// Require exactly one key source
	if (!passphrase && !keyfile) {
		die('Specify --passphrase (-p) or --keyfile (-k)', 2);
	}
	if (passphrase && keyfile) {
		die('Cannot use both --passphrase and --keyfile', 2);
	}

	// Resolve input/output
	const inputArg = positionals[0] ?? null;
	const outputArg = args.output ?? positionals[1] ?? null;

	// Read input bytes
	let inputBytes: Uint8Array;
	if (!inputArg || inputArg === '-') {
		inputBytes = await Bun.stdin.bytes();
	} else {
		const f = Bun.file(inputArg);
		if (!(await f.exists())) {
			die(`File not found: ${inputArg}`, 3);
		}
		inputBytes = await f.bytes();
	}

	// Auto-detect armored vs binary input
	let blob: Uint8Array;
	if (isArmored(inputBytes)) {
		try {
			blob = dearmor(new TextDecoder().decode(inputBytes));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			die(`Invalid armor format: ${msg}`, 5);
		}
	} else {
		blob = inputBytes;
	}

	// Parse SRPT256S header
	let header: Srpt256sHeader;
	let poolOutput: Uint8Array;
	try {
		({ header, poolOutput } = decodeBlob(blob));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		die(msg, 5);
	}

	// Validate KDF field matches what was provided
	if (passphrase && header.kdf !== KDF_SCRYPT) {
		die(
			'File was encrypted with a keyfile but --passphrase was given',
			2,
		);
	}
	if (keyfile && header.kdf !== KDF_KEYFILE) {
		die(
			'File was encrypted with a passphrase but --keyfile was given',
			2,
		);
	}

	const pool = await SealPool.create();
	registerPool(pool);

	try {
		startSpinner();
		const minDisplay = waitMs(FULL_CYCLE_MS);

		let key: Uint8Array;
		if (passphrase) {
			const derived = await deriveKey(passphrase, header.salt);
			key = derived.key;
		} else {
			key = await readKeyFile(keyfile as string);
			if (key.length !== 32)
				die(`Invalid keyfile size: ${key.length} bytes (expected 32)`, 2);
		}

		const plaintext = await pool.open(key, poolOutput);

		await minDisplay;
		stopSpinner();

		// Write output
		if (outputArg) {
			const outFile = Bun.file(outputArg);
			if ((await outFile.exists()) && !force) {
				die(`Output file already exists: ${outputArg} (use --force to overwrite)`, 4);
			}
			await Bun.write(outputArg, plaintext);
			info(`Decrypted: ${outputArg}`);
		} else {
			await Bun.stdout.write(plaintext);
		}
	} catch (err) {
		stopSpinner();
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('authentication failed'))
			die('authentication failed — data may be corrupted or tampered', 1);
		die(`Decryption failed: ${msg}`, 2);
	} finally {
		pool.dispose();
		unregisterPool();
	}
}

/**
 * Read a keyfile — handles both raw binary and SRPT256S armored keyfiles.
 */
async function readKeyFile(path: string): Promise<Uint8Array> {
	const f = Bun.file(path);
	if (!(await f.exists())) {
		die(`Keyfile not found: ${path}`, 3);
	}
	const bytes = await f.bytes();
	// Armored keyfiles start with "-----" (0x2d bytes)
	if (bytes.length > 5 && bytes[0] === 0x2d && bytes[1] === 0x2d && bytes[2] === 0x2d) {
		try {
			return dearmorKey(new TextDecoder().decode(bytes));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			die(`Invalid keyfile format: ${msg}`, 5);
		}
	}
	return bytes;
}
