/**
 * crypto.ts — Wrappers around leviathan-crypto SerpentStreamEncoder/Decoder + scrypt.
 *
 * Provides:
 *   - deriveKey()    — scrypt key derivation (64-byte output)
 *   - generateKey()  — Fortuna CSPRNG key generation (64 bytes)
 *   - seal()         — SerpentStreamEncoder encryption (chunked, length-prefixed frames)
 *   - open()         — SerpentStreamDecoder decryption (chunked, length-prefixed frames)
 */

import {
	SerpentStreamEncoder,
	SerpentStreamDecoder,
	Fortuna,
	randomBytes,
} from 'leviathan-crypto';
import { scrypt } from 'node:crypto';

// Chunk size for SerpentStreamEncoder — encoded in the stream header.
// To use a different chunk size, change this constant and rebuild.
export const CHUNK_SIZE = 65536;

// scrypt parameters
const SCRYPT_N      = 32768;
const SCRYPT_R      = 8;
const SCRYPT_P      = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export async function deriveKey(
	passphrase: string,
	salt?: Uint8Array,
): Promise<{ key: Uint8Array; salt: Uint8Array }> {
	const s = salt ?? randomBytes(32);
	const keyBuf = await new Promise<Buffer>((resolve, reject) => {
		scrypt(
			passphrase,
			s,
			64,
			{ N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
			(err, derived) => (err ? reject(err) : resolve(derived)),
		);
	});
	return {
		key:  new Uint8Array(keyBuf.buffer, keyBuf.byteOffset, keyBuf.byteLength),
		salt: s,
	};
}

export async function generateKey(): Promise<Uint8Array> {
	const fortuna = await Fortuna.create();
	const key = fortuna.get(64);
	fortuna.stop();
	return key;
}

export async function seal(
	key: Uint8Array,
	plaintext: Uint8Array,
): Promise<{ streamHeader: Uint8Array; ciphertext: Uint8Array }> {
	const encoder = new SerpentStreamEncoder(key, CHUNK_SIZE);
	const streamHeader = encoder.header();

	const chunks: Uint8Array[] = [];
	let offset = 0;

	while (offset + CHUNK_SIZE < plaintext.length) {
		chunks.push(encoder.encode(plaintext.subarray(offset, offset + CHUNK_SIZE)));
		offset += CHUNK_SIZE;
		await new Promise(r => setTimeout(r, 0)); // yield — let setInterval fire
	}

	chunks.push(encoder.encodeFinal(plaintext.subarray(offset)));

	let totalLen = 0;
	for (const c of chunks) totalLen += c.length;
	const ciphertext = new Uint8Array(totalLen);
	let pos = 0;
	for (const c of chunks) { ciphertext.set(c, pos); pos += c.length; }

	return { streamHeader, ciphertext };
}

export async function open(
	key: Uint8Array,
	streamHeader: Uint8Array,
	ciphertext: Uint8Array,
): Promise<Uint8Array> {
	const decoder = new SerpentStreamDecoder(key, streamHeader);

	const plainChunks: Uint8Array[] = [];
	let offset = 0;

	// Feed one encoded frame at a time. Each frame is u32be(sealedLen) || sealedBytes.
	// Read the length prefix to know exactly how many bytes to feed per call.
	while (offset < ciphertext.length) {
		if (ciphertext.length - offset < 4)
			throw new Error('SerpentStreamDecoder: truncated frame');
		const sealedLen = (
			(ciphertext[offset] << 24 | ciphertext[offset + 1] << 16 |
			 ciphertext[offset + 2] << 8  | ciphertext[offset + 3]) >>> 0
		);
		const frameLen = 4 + sealedLen;
		if (ciphertext.length - offset < frameLen)
			throw new Error('SerpentStreamDecoder: truncated frame');
		const results = decoder.feed(ciphertext.subarray(offset, offset + frameLen));
		plainChunks.push(...results);
		offset += frameLen;
		await new Promise(r => setTimeout(r, 0)); // yield — let setInterval fire
	}

	let totalLen = 0;
	for (const c of plainChunks) totalLen += c.length;
	const result = new Uint8Array(totalLen);
	let pos = 0;
	for (const c of plainChunks) { result.set(c, pos); pos += c.length; }

	return result;
}
