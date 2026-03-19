/**
 * encrypt.ts — Encrypt a file or stdin using SealPool.
 *
 * Key derivation:
 *   --passphrase: scrypt (N=32768, r=8, p=1) → 32-byte key
 *   --keyfile:    raw keyfile bytes (exactly 32 bytes)
 *
 * Output format: SRPT256S binary blob (see FORMAT.md), optionally armored.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
import { SealPool, registerPool, unregisterPool } from '../pool.ts';
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

	const pool = await SealPool.create();
	registerPool(pool);

	try {
		startSpinner();
		const minDisplay = waitMs(FULL_CYCLE_MS);

		let key: Uint8Array;
		let kdf: number;
		let salt: Uint8Array;

		if (passphrase) {
			kdf = KDF_SCRYPT;
			const derived = await deriveKey(passphrase);
			key  = derived.key;
			salt = derived.salt;
		} else {
			kdf  = KDF_KEYFILE;
			salt = new Uint8Array(32);
			key  = await readKeyFile(keyfile as string);
			if (key.length !== 32)
				die(`Invalid keyfile size: ${key.length} bytes (expected 32)`, 2);
		}

		const poolOutput = await pool.seal(key, plaintext);
		const finalBlob  = encodeBlob({ version: FORMAT_VERSION, flags: 0x00, kdf, salt }, poolOutput);

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
	} catch (err) {
		stopSpinner();
		const msg = err instanceof Error ? err.message : String(err);
		die(`Encryption failed: ${msg}`, 2);
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
