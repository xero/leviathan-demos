/**
 * decrypt.ts — Decrypt a SRPT256S-format file or stdin.
 *
 * Auto-detects armored vs binary input — no --armor flag needed.
 * SerpentStreamOpener handles authentication internally — if auth fails,
 * open() throws and no plaintext is produced.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey, open } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
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
	let ciphertext: Uint8Array;
	try {
		({ header, ciphertext } = decodeBlob(blob));
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

	// Start animation while decrypting
	startSpinner();
	const minDisplay = waitMs(FULL_CYCLE_MS);

	// Derive or load key (always 64 bytes)
	let key: Uint8Array;
	if (passphrase) {
		try {
			const derived = await deriveKey(passphrase, header.salt);
			key = derived.key;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			die(`Key derivation failed: ${msg}`, 2);
		}
	} else {
		const rawKey = await readKeyFile(keyfile as string);
		if (rawKey.length !== 64) {
			die(
				`Invalid keyfile size: ${rawKey.length} bytes (expected 64)`,
				2,
			);
		}
		key = rawKey;
	}

	// Open (authenticate + decrypt) via SerpentStreamOpener
	let plaintext: Uint8Array;
	try {
		plaintext = await open(key, header.streamHeader, ciphertext);
	} catch {
		die('authentication failed — data may be corrupted or tampered', 1);
	}

	// Stop animation
	await minDisplay;
	stopSpinner();

	// Check output doesn't already exist
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
