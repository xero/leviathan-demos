/**
 * encrypt.ts — Encrypt using either Serpent or ChaCha pool.
 *
 * --cipher serpent  → SerpentPool  (default)
 * --cipher chacha   → ChaChaPool
 *
 * The cipher byte written into the header tells decrypt which pool to use —
 * no flag needed on the decrypt side.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
import { SealPool as SerpentPool, registerPool as regSerpent, unregisterPool as unregSerpent } from '../serpent/pool.ts';
import { SealPool as ChaChaPool,  registerPool as regChacha,  unregisterPool as unregChacha  } from '../chacha/pool.ts';
import {
	encodeBlob, armor, dearmorKey,
	KEY_BEGIN, KDF_SCRYPT, KDF_KEYFILE, FORMAT_VERSION,
	CIPHER_SERPENT, CIPHER_CHACHA,
} from '../format.ts';

export async function runEncrypt(args: ParsedArgs): Promise<void> {
	const { passphrase, keyfile, armor: useArmor, force, positionals, cipher } = args;

	if (!passphrase && !keyfile) die('Specify --passphrase (-p) or --keyfile (-k)', 2);
	if (passphrase && keyfile)   die('Cannot use both --passphrase and --keyfile', 2);
	if (cipher !== 'serpent' && cipher !== 'chacha')
		die(`Unknown cipher: ${cipher} (valid: serpent, chacha)`, 2);

	const inputArg  = positionals[0] ?? null;
	const outputArg = args.output ?? positionals[1] ?? null;

	let plaintext: Uint8Array;
	if (!inputArg || inputArg === '-') {
		plaintext = await Bun.stdin.bytes();
	} else {
		const f = Bun.file(inputArg);
		if (!(await f.exists())) die(`File not found: ${inputArg}`, 3);
		plaintext = await f.bytes();
	}

	if (outputArg) {
		const outFile = Bun.file(outputArg);
		if ((await outFile.exists()) && !force)
			die(`Output file already exists: ${outputArg} (use --force to overwrite)`, 4);
	}

	const useChacha = cipher === 'chacha';
	const pool = useChacha ? await ChaChaPool.create() : await SerpentPool.create();
	if (useChacha) regChacha(pool as InstanceType<typeof ChaChaPool>);
	else           regSerpent(pool as InstanceType<typeof SerpentPool>);

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
			if (key.length !== 32) die(`Invalid keyfile size: ${key.length} bytes (expected 32)`, 2);
		}

		const poolOutput = await pool.seal(key, plaintext);
		const finalBlob  = encodeBlob(
			{ version: FORMAT_VERSION, cipher: useChacha ? CIPHER_CHACHA : CIPHER_SERPENT, kdf, flags: 0x00, salt },
			poolOutput,
		);

		await minDisplay;
		stopSpinner();

		if (outputArg) {
			await Bun.write(outputArg, useArmor ? armor(finalBlob) : finalBlob);
			info(`Encrypted: ${outputArg}`);
		} else {
			await Bun.stdout.write(useArmor ? armor(finalBlob) : finalBlob);
		}
	} catch (err) {
		stopSpinner();
		die(`Encryption failed: ${(err as Error).message}`, 2);
	} finally {
		pool.dispose();
		if (useChacha) unregChacha(); else unregSerpent();
	}
}

async function readKeyFile(path: string): Promise<Uint8Array> {
	const f = Bun.file(path);
	if (!(await f.exists())) die(`Keyfile not found: ${path}`, 3);
	const bytes = await f.bytes();
	if (bytes.length > KEY_BEGIN.length && bytes[0] === 0x2d && bytes[1] === 0x2d && bytes[2] === 0x2d) {
		try { return dearmorKey(new TextDecoder().decode(bytes)); }
		catch (err) { die(`Invalid keyfile format: ${(err as Error).message}`, 5); }
	}
	return bytes;
}
