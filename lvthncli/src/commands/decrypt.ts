/**
 * decrypt.ts — Decrypt an LVTHNCLI file, auto-detecting the cipher.
 *
 * Cipher byte at offset 9 of the header selects the pool:
 *   0x01 (CIPHER_SERPENT) → SerpentPool
 *   0x02 (CIPHER_CHACHA)  → ChaChaPool
 *
 * The --cipher flag is not read here — the file is authoritative.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
import { SealPool as SerpentPool, registerPool as regSerpent, unregisterPool as unregSerpent } from '../serpent/pool.ts';
import { SealPool as ChaChaPool,  registerPool as regChacha,  unregisterPool as unregChacha  } from '../chacha/pool.ts';
import {
	decodeBlob, dearmor, dearmorKey, isArmored,
	KDF_SCRYPT, KDF_KEYFILE, CIPHER_CHACHA, LvthnHeader,
} from '../format.ts';

export async function runDecrypt(args: ParsedArgs): Promise<void> {
	const { passphrase, keyfile, force, positionals } = args;

	if (!passphrase && !keyfile) die('Specify --passphrase (-p) or --keyfile (-k)', 2);
	if (passphrase && keyfile)   die('Cannot use both --passphrase and --keyfile', 2);

	const inputArg  = positionals[0] ?? null;
	const outputArg = args.output ?? positionals[1] ?? null;

	let inputBytes: Uint8Array;
	if (!inputArg || inputArg === '-') {
		inputBytes = await Bun.stdin.bytes();
	} else {
		const f = Bun.file(inputArg);
		if (!(await f.exists())) die(`File not found: ${inputArg}`, 3);
		inputBytes = await f.bytes();
	}

	let blob: Uint8Array;
	if (isArmored(inputBytes)) {
		try { blob = dearmor(new TextDecoder().decode(inputBytes)); }
		catch (err) { die(`Invalid armor format: ${(err as Error).message}`, 5); }
	} else {
		blob = inputBytes;
	}

	let header: LvthnHeader;
	let poolOutput: Uint8Array;
	try {
		({ header, poolOutput } = decodeBlob(blob!));
	} catch (err) {
		die((err as Error).message, 5);
	}

	if (passphrase && header!.kdf !== KDF_SCRYPT)
		die('File was encrypted with a keyfile but --passphrase was given', 2);
	if (keyfile && header!.kdf !== KDF_KEYFILE)
		die('File was encrypted with a passphrase but --keyfile was given', 2);

	// Cipher is from the file header — not the --cipher flag
	const useChacha = header!.cipher === CIPHER_CHACHA;
	const pool = useChacha ? await ChaChaPool.create() : await SerpentPool.create();
	if (useChacha) regChacha(pool as InstanceType<typeof ChaChaPool>);
	else           regSerpent(pool as InstanceType<typeof SerpentPool>);

	try {
		startSpinner();
		const minDisplay = waitMs(FULL_CYCLE_MS);

		let key: Uint8Array;
		if (passphrase) {
			const derived = await deriveKey(passphrase, header!.salt);
			key = derived.key;
		} else {
			key = await readKeyFile(keyfile as string);
			if (key.length !== 32) die(`Invalid keyfile size: ${key.length} bytes (expected 32)`, 2);
		}

		const plaintext = await pool.open(key, poolOutput!);

		await minDisplay;
		stopSpinner();

		if (outputArg) {
			const outFile = Bun.file(outputArg);
			if ((await outFile.exists()) && !force)
				die(`Output file already exists: ${outputArg} (use --force to overwrite)`, 4);
			await Bun.write(outputArg, plaintext);
			info(`Decrypted: ${outputArg}`);
		} else {
			await Bun.stdout.write(plaintext);
		}
	} catch (err) {
		stopSpinner();
		const msg = (err as Error).message;
		if (msg.includes('authentication failed'))
			die('authentication failed — data may be corrupted or tampered', 1);
		die(`Decryption failed: ${msg}`, 2);
	} finally {
		pool.dispose();
		if (useChacha) unregChacha(); else unregSerpent();
	}
}

async function readKeyFile(path: string): Promise<Uint8Array> {
	const f = Bun.file(path);
	if (!(await f.exists())) die(`Keyfile not found: ${path}`, 3);
	const bytes = await f.bytes();
	if (bytes.length > 5 && bytes[0] === 0x2d && bytes[1] === 0x2d && bytes[2] === 0x2d) {
		try { return dearmorKey(new TextDecoder().decode(bytes)); }
		catch (err) { die(`Invalid keyfile format: ${(err as Error).message}`, 5); }
	}
	return bytes;
}
