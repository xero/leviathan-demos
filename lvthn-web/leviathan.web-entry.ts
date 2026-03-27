// leviathan.web-entry.ts — leviathan-crypto exports for lvthn-web bundle.
// Argon2id is the third-party argon2id npm package (not from leviathan-crypto).
export { init, SerpentCbc, HMAC_SHA256, constantTimeEqual, bytesToHex, hexToBytes } from 'leviathan-crypto';

// argon2id WASM must be inlined as base64 for single-file HTML.
// Bun.build loader: { '.wasm': 'base64' } converts imports to base64 strings.
// We use setupWasm directly to instantiate from the inlined bytes.
import setupWasm from 'argon2id/lib/setup.js';
// @ts-expect-error — resolved to base64 string by Bun bundler loader config
import simdB64 from 'argon2id/dist/simd.wasm';
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
		(importObject: WebAssembly.Imports) => WebAssembly.instantiate(b64ToBuffer(simdB64), importObject),
		(importObject: WebAssembly.Imports) => WebAssembly.instantiate(b64ToBuffer(noSimdB64), importObject),
	);
}
