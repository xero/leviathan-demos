/**
 * crypto.ts — Key derivation and key generation for lvthn-chacha.
 *
 * Provides:
 *   - deriveKey()   — scrypt key derivation (32-byte output)
 *   - generateKey() — CSPRNG key generation (32 bytes)
 *
 * Uses crypto.getRandomValues instead of Fortuna so that only the
 * chacha20 WASM module needs to be initialized (no serpent/sha2 dependency).
 *
 * Seal/open are handled by SealPool in pool.ts.
 */

import { scrypt } from 'node:crypto';

const SCRYPT_N      = 32768;
const SCRYPT_R      = 8;
const SCRYPT_P      = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const KEY_BYTES     = 32;

export async function deriveKey(
	passphrase: string,
	salt?: Uint8Array,
): Promise<{ key: Uint8Array; salt: Uint8Array }> {
	const s = salt ?? crypto.getRandomValues(new Uint8Array(32));
	const buf = await new Promise<Buffer>((resolve, reject) => {
		scrypt(passphrase, s, KEY_BYTES,
			{ N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
			(err, derived) => (err ? reject(err) : resolve(derived)),
		);
	});
	return {
		key: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
		salt: s,
	};
}

export async function generateKey(): Promise<Uint8Array> {
	return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}
