/**
 * leviathan.jwt-entry.ts: bundle entry for the JWT demo.
 *
 * Imports init + the sign envelope + every signature suite + the utils the
 * app needs, awaits init() for the union of WASM modules the suites require,
 * then re-exports each symbol as a top-level `const` so Bun emits a binding
 * that src/app.js can reference directly after the bundle is inlined into the
 * page (the `export const X = _X` trick). A bare `export { X }` re-export can
 * be renamed or elided by the bundler, and would not be visible to app.js.
 */

import {
	init,
	Sign as _Sign,
	Ed25519Suite          as _Ed25519Suite,
	EcdsaP256Suite        as _EcdsaP256Suite,
	MlDsa44Suite          as _MlDsa44Suite,
	MlDsa65Suite          as _MlDsa65Suite,
	MlDsa87Suite          as _MlDsa87Suite,
	SlhDsa128fSuite       as _SlhDsa128fSuite,
	SlhDsa192fSuite       as _SlhDsa192fSuite,
	SlhDsa256fSuite       as _SlhDsa256fSuite,
	MlDsa44SlhDsa128fSuite as _MlDsa44SlhDsa128fSuite,
	MlDsa65SlhDsa192fSuite as _MlDsa65SlhDsa192fSuite,
	MlDsa87SlhDsa256fSuite as _MlDsa87SlhDsa256fSuite,
	bytesToBase64 as _bytesToBase64,
	base64ToBytes as _base64ToBytes,
	utf8ToBytes   as _utf8ToBytes,
	bytesToUtf8   as _bytesToUtf8,
	bytesToHex    as _bytesToHex,
} from 'leviathan-crypto';
import { curve25519Wasm } from 'leviathan-crypto/ed25519/embedded';
import { p256Wasm }       from 'leviathan-crypto/ecdsa/embedded';
import { sha2Wasm }       from 'leviathan-crypto/sha2/embedded';
import { sha3Wasm }       from 'leviathan-crypto/sha3/embedded';
import { mldsaWasm }      from 'leviathan-crypto/mldsa/embedded';
import { slhdsaWasm }     from 'leviathan-crypto/slhdsa/embedded';

// Union of every suite's wasmModules: ed25519→curve25519, ecdsa→p256+sha2,
// ml-dsa→mldsa+sha3, slh-dsa→slhdsa+sha3, hybrids→mldsa+sha3+slhdsa.
await init({
	curve25519: curve25519Wasm,
	p256: p256Wasm,
	sha2: sha2Wasm,
	sha3: sha3Wasm,
	mldsa: mldsaWasm,
	slhdsa: slhdsaWasm,
});

export const Sign = _Sign;

export const Ed25519Suite           = _Ed25519Suite;
export const EcdsaP256Suite         = _EcdsaP256Suite;
export const MlDsa44Suite           = _MlDsa44Suite;
export const MlDsa65Suite           = _MlDsa65Suite;
export const MlDsa87Suite           = _MlDsa87Suite;
export const SlhDsa128fSuite        = _SlhDsa128fSuite;
export const SlhDsa192fSuite        = _SlhDsa192fSuite;
export const SlhDsa256fSuite        = _SlhDsa256fSuite;
export const MlDsa44SlhDsa128fSuite = _MlDsa44SlhDsa128fSuite;
export const MlDsa65SlhDsa192fSuite = _MlDsa65SlhDsa192fSuite;
export const MlDsa87SlhDsa256fSuite = _MlDsa87SlhDsa256fSuite;

export const bytesToBase64 = _bytesToBase64;
export const base64ToBytes = _base64ToBytes;
export const utf8ToBytes   = _utf8ToBytes;
export const bytesToUtf8   = _bytesToUtf8;
export const bytesToHex    = _bytesToHex;
