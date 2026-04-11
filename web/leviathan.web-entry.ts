// leviathan.web-entry.ts — leviathan-crypto exports for lvthn-web bundle.
// Argon2id is the third-party argon2id npm package (not from leviathan-crypto).

import { init, Seal, SerpentCipher, HKDF_SHA256, AuthenticationError,
	bytesToHex, hexToBytes, utf8ToBytes, randomBytes } from 'leviathan-crypto';
import { serpentWasm } from 'leviathan-crypto/serpent/embedded';
import { sha2Wasm }    from 'leviathan-crypto/sha2/embedded';

await init({ serpent: serpentWasm, sha2: sha2Wasm });

export { Seal, SerpentCipher, HKDF_SHA256, AuthenticationError,
	bytesToHex, hexToBytes, utf8ToBytes, randomBytes };

import setupWasm from 'argon2id/lib/setup.js';
// @ts-expect-error — resolved to base64 string by Bun bundler loader config
import simdB64   from 'argon2id/dist/simd.wasm';
// @ts-expect-error — resolved to base64 string by Bun bundler loader config
import noSimdB64 from 'argon2id/dist/no-simd.wasm';

function b64ToBuffer(b64: string): ArrayBuffer {
	const bin = atob(b64);
	const buf = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
	return buf.buffer;
}

export async function loadArgon2id() {
	return setupWasm(
		(imp: WebAssembly.Imports) => WebAssembly.instantiate(b64ToBuffer(simdB64),   imp),
		(imp: WebAssembly.Imports) => WebAssembly.instantiate(b64ToBuffer(noSimdB64), imp),
	);
}
