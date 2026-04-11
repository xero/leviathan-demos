/**
 * decrypt.ts — Decrypt an LVTHNCLI file, auto-detecting the cipher.
 *
 * Cipher byte at offset 9 of the header selects the pool:
 *   0x01 (CIPHER_SERPENT) → SerpentCipher
 *   0x02 (CIPHER_CHACHA)  → XChaCha20Cipher
 *
 * The --cipher flag is not read here — the file is authoritative.
 */

import { ParsedArgs, die, info } from '../cli.ts';
import { deriveKey } from '../crypto.ts';
import { startSpinner, stopSpinner, waitMs, FULL_CYCLE_MS } from '../spinner.ts';
import { SealStreamPool, AuthenticationError } from 'leviathan-crypto';
import { serpentWasm  } from 'leviathan-crypto/serpent/embedded';
import { sha2Wasm     } from 'leviathan-crypto/sha2/embedded';
import { chacha20Wasm } from 'leviathan-crypto/chacha20/embedded';
import { XChaCha20CipherBun as XChaCha20Cipher, SerpentCipherBun as SerpentCipher } from '../cipher-suites.ts';
import {
	decodeBlob, dearmor, dearmorKey, isArmored,
	KDF_SCRYPT, KDF_KEYFILE, CIPHER_CHACHA, LvthnHeader,
} from '../format.ts';

function decodeOrDie(b: Uint8Array): { header: LvthnHeader; poolOutput: Uint8Array } {
	try {
		return decodeBlob(b);
	} catch (err) {
		die((err as Error).message, 5);
	}
}

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

	let blob: Uint8Array = inputBytes;
	if (isArmored(inputBytes)) {
		try {
			blob = dearmor(new TextDecoder().decode(inputBytes));
		} catch (err) {
			die(`Invalid armor format: ${(err as Error).message}`, 5);
		}
	}

	const { header, poolOutput } = decodeOrDie(blob);

	if (passphrase && header.kdf !== KDF_SCRYPT)
		die('File was encrypted with a keyfile but --passphrase was given', 2);
	if (keyfile && header.kdf !== KDF_KEYFILE)
		die('File was encrypted with a passphrase but --keyfile was given', 2);

	const useChacha = header.cipher === CIPHER_CHACHA;
	const cipherSuite = useChacha ? XChaCha20Cipher : SerpentCipher;
	const wasmSrc = useChacha
		? { chacha20: chacha20Wasm, sha2: sha2Wasm }
		: { serpent: serpentWasm,   sha2: sha2Wasm };

	try {
		startSpinner();
		const minDisplay = waitMs(FULL_CYCLE_MS);

		let key: Uint8Array;
		if (passphrase) {
			const derived = await deriveKey(passphrase, header.salt);
			key = derived.key;
		} else {
			key = await readKeyFile(keyfile as string);
			if (key.length !== 32) die(`Invalid keyfile size: ${key.length} bytes (expected 32)`, 2);
		}

		// const pool = await SealStreamPool.create(cipherSuite, key, { wasm: wasmSrc, chunkSize: 65536 });
		const pool = await SealStreamPool.create(cipherSuite, key, { wasm: wasmSrc, chunkSize: 65536, workers: 1 });
		let plaintext: Uint8Array;
		try {
			plaintext = await pool.open(poolOutput);
		} finally {
			pool.destroy();
		}

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
		if (err instanceof AuthenticationError)
			die('authentication failed — data may be corrupted or tampered', 1);
		die(`Decryption failed: ${(err as Error).message}`, 2);
	}
}

async function readKeyFile(path: string): Promise<Uint8Array> {
	const f = Bun.file(path);
	if (!(await f.exists())) die(`Keyfile not found: ${path}`, 3);
	const bytes = await f.bytes();
	if (bytes.length > 5 && bytes[0] === 0x2d && bytes[1] === 0x2d && bytes[2] === 0x2d) {
		try {
			return dearmorKey(new TextDecoder().decode(bytes));
		} catch (err) {
			die(`Invalid keyfile format: ${(err as Error).message}`, 5);
		}
	}
	return bytes;
}
