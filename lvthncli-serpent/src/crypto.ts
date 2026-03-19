/**
 * crypto.ts — Key derivation and key generation for the lvthn CLI.
 *
 * Provides:
 *   - deriveKey()   — scrypt key derivation (32-byte output)
 *   - generateKey() — Fortuna CSPRNG key generation (32 bytes)
 *
 * Seal/open are handled by SealPool in pool.ts.
 */

import { Fortuna, randomBytes } from 'leviathan-crypto';
import { scrypt } from 'node:crypto';

const SCRYPT_N      = 32768;
const SCRYPT_R      = 8;
const SCRYPT_P      = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const KEY_BYTES     = 32;  // SerpentStream requires 32-byte keys

export async function deriveKey(
	passphrase: string,
	salt?: Uint8Array,
): Promise<{ key: Uint8Array; salt: Uint8Array }> {
	const s = salt ?? randomBytes(32);
	const buf = await new Promise<Buffer>((resolve, reject) => {
		scrypt(passphrase, s, KEY_BYTES,
			{ N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
			(err, derived) => (err ? reject(err) : resolve(derived)),
		);
	});
	return {
		key:  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
		salt: s,
	};
}

export async function generateKey(): Promise<Uint8Array> {
	const fortuna = await Fortuna.create();
	const key = fortuna.get(KEY_BYTES);
	fortuna.stop();
	return key;
}
