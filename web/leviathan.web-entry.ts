// leviathan.web-entry.ts: leviathan-crypto v3 exports for the lvthn-web bundle.
// Mirrors the CLI: SealStreamPool over three cipher suites, scrypt KDF (web side).
//
// The three pool workers are pre-bundled by build.ts into src/workers/*-worker.js
// before this entry is built, then re-exported as raw IIFE source strings so
// cipher-suites.js can spawn each Worker via a Blob URL.
//
// IMPORTANT: app.js / format.js / crypto.js / cipher-suites.js are concatenated
// into the SAME `<script type="module">` as this bundle's output. They reference
// the names we export from here as module-scope identifiers, which only works
// if Bun keeps those names as top-level `var`/`const` bindings rather than
// collapsing them into `export { X as Y }` rename-only forms. Re-exporting
// through `export const` (rather than re-exporting an imported alias directly)
// is what keeps the symbol visible at module scope after bundling.

import {
	init,
	SealStreamPool,
	AuthenticationError,
	SerpentCipher,
	XChaCha20Cipher,
	AESGCMSIVCipher,
	bytesToHex,
	hexToBytes,
	utf8ToBytes,
	randomBytes,
} from 'leviathan-crypto';
import { serpentWasm  as _serpentWasm  } from 'leviathan-crypto/serpent/embedded';
import { sha2Wasm     as _sha2Wasm     } from 'leviathan-crypto/sha2/embedded';
import { chacha20Wasm as _chacha20Wasm } from 'leviathan-crypto/chacha20/embedded';
import { aesWasm      as _aesWasm      } from 'leviathan-crypto/aes/embedded';
import { scrypt as _scrypt } from '@noble/hashes/scrypt';
import { WORKER_BUNDLE as _SERPENT_WORKER_BUNDLE } from './src/workers/serpent-worker.js';
import { WORKER_BUNDLE as _CHACHA_WORKER_BUNDLE  } from './src/workers/chacha-worker.js';
import { WORKER_BUNDLE as _AES_WORKER_BUNDLE     } from './src/workers/aes-worker.js';

await init({
	serpent: _serpentWasm,
	sha2: _sha2Wasm,
	chacha20: _chacha20Wasm,
	aes: _aesWasm,
});

// `export const X = _X` forces Bun to emit a top-level `var X = _X` binding in
// the bundle. Without this layer, `import { Foo as bar }; export { bar }` is
// collapsed to `export { Foo as bar }` and the inlined module exposes only
// the upstream local name (`Foo`), not the alias.
export const serpentWasm           = _serpentWasm;
export const sha2Wasm              = _sha2Wasm;
export const chacha20Wasm          = _chacha20Wasm;
export const aesWasm               = _aesWasm;
export const scrypt                = _scrypt;
export const SERPENT_WORKER_BUNDLE = _SERPENT_WORKER_BUNDLE;
export const CHACHA_WORKER_BUNDLE  = _CHACHA_WORKER_BUNDLE;
export const AES_WORKER_BUNDLE     = _AES_WORKER_BUNDLE;

export {
	SealStreamPool,
	AuthenticationError,
	SerpentCipher,
	XChaCha20Cipher,
	AESGCMSIVCipher,
	bytesToHex,
	hexToBytes,
	utf8ToBytes,
	randomBytes,
};
