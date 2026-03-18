/**
 * encrypt.ts — Encrypt a file or stdin using SerpentStreamSealer.
 *
 * Key derivation:
 *   --passphrase: scrypt (N=32768, r=8, p=1) → 64-byte key
 *   --keyfile:    raw keyfile bytes (exactly 64 bytes)
 *
 * Output format: SRPT256S binary blob (see FORMAT.md), optionally armored.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey, seal } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
import {
	encodeBlob,
	armor,
	dearmorKey,
	KEY_BEGIN,
	KDF_SCRYPT,
	KDF_KEYFILE,
	FORMAT_VERSION,
} from '../format.ts';

export async function runEncrypt(args: ParsedArgs): Promise<void> {
	const { passphrase, keyfile, armor: useArmor, force, positionals } = args;

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

	// Read plaintext
	let plaintext: Uint8Array;
	if (!inputArg || inputArg === '-') {
		plaintext = await Bun.stdin.bytes();
	} else {
		const f = Bun.file(inputArg);
		if (!(await f.exists())) {
			die(`File not found: ${inputArg}`, 3);
		}
		plaintext = await f.bytes();
	}

	// Check output doesn't already exist
	if (outputArg) {
		const outFile = Bun.file(outputArg);
		if ((await outFile.exists()) && !force) {
			die(`Output file already exists: ${outputArg} (use --force to overwrite)`, 4);
		}
	}

	// Start animation while encrypting
	startSpinner();
	const minDisplay = waitMs(FULL_CYCLE_MS);

	// Derive or load key
	let key: Uint8Array;
	let kdf: number;
	let salt: Uint8Array;

	if (passphrase) {
		kdf = KDF_SCRYPT;
		try {
			const derived = await deriveKey(passphrase);
			key = derived.key;
			salt = derived.salt;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			die(`Key derivation failed: ${msg}`, 2);
		}
	} else {
		// keyfile
		kdf = KDF_KEYFILE;
		salt = new Uint8Array(32); // zeroed per format spec
		const rawKey = await readKeyFile(keyfile as string);
		if (rawKey.length !== 64) {
			die(
				`Invalid keyfile size: ${rawKey.length} bytes (expected 64)`,
				2,
			);
		}
		key = rawKey;
	}

	// Seal plaintext
	let streamHeader: Uint8Array;
	let ciphertext: Uint8Array;
	try {
		({ streamHeader, ciphertext } = await seal(key, plaintext));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		die(`Encryption failed: ${msg}`, 2);
	}

	// Build full blob
	const header = {
		version: FORMAT_VERSION,
		flags: 0x00,
		kdf,
		salt,
		streamHeader,
	};
	const finalBlob = encodeBlob(header, ciphertext);

	// Stop animation
	await minDisplay;
	stopSpinner();

	// Write output
	if (outputArg) {
		if (useArmor) {
			await Bun.write(outputArg, armor(finalBlob));
		} else {
			await Bun.write(outputArg, finalBlob);
		}
		info(`Encrypted: ${outputArg}`);
	} else {
		if (useArmor) {
			await Bun.stdout.write(armor(finalBlob));
		} else {
			await Bun.stdout.write(finalBlob);
		}
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
	// Check for armor: armored keyfiles start with "-----" (0x2d 0x2d 0x2d 0x2d 0x2d)
	if (
		bytes.length > KEY_BEGIN.length &&
		bytes[0] === 0x2d &&
		bytes[1] === 0x2d &&
		bytes[2] === 0x2d
	) {
		try {
			return dearmorKey(new TextDecoder().decode(bytes));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			die(`Invalid keyfile format: ${msg}`, 5);
		}
	}
	return bytes;
}
