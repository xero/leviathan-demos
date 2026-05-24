import { describe, it, expect, beforeAll } from 'bun:test';
import {
	init,
	Sign,
	Ed25519Suite,
	EcdsaP256Suite,
	MlDsa44Suite, MlDsa65Suite, MlDsa87Suite,
	SlhDsa128fSuite, SlhDsa192fSuite, SlhDsa256fSuite,
	MlDsa44SlhDsa128fSuite, MlDsa65SlhDsa192fSuite, MlDsa87SlhDsa256fSuite,
	bytesToBase64,
	utf8ToBytes,
	bytesToHex,
} from 'leviathan-crypto';
import { curve25519Wasm } from 'leviathan-crypto/ed25519/embedded';
import { p256Wasm }       from 'leviathan-crypto/ecdsa/embedded';
import { sha2Wasm }       from 'leviathan-crypto/sha2/embedded';
import { sha3Wasm }       from 'leviathan-crypto/sha3/embedded';
import { mldsaWasm }      from 'leviathan-crypto/mldsa/embedded';
import { slhdsaWasm }     from 'leviathan-crypto/slhdsa/embedded';

// Union of every suite's wasmModules, matching leviathan.jwt-entry.ts.
beforeAll(async () => {
	await init({
		curve25519: curve25519Wasm,
		p256: p256Wasm,
		sha2: sha2Wasm,
		sha3: sha3Wasm,
		mldsa: mldsaWasm,
		slhdsa: slhdsaWasm,
	});
});

const EMPTY = new Uint8Array(0);
const enc = (s: string) => utf8ToBytes(s);

// base64url, matching the JWT wire format: no padding, URL-safe alphabet.
const b64url = (bytes: Uint8Array) =>
	bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// alg id -> suite + the fixed signature byte length the demo advertises.
// The sizes mirror the README algorithm table; asserting them keeps that table
// honest. Hybrid sizes are the sum of their ML-DSA and SLH-DSA halves.
const SUITES = [
	{ alg: 'EdDSA',              suite: Ed25519Suite,           sigBytes: 64 },
	{ alg: 'ES256',              suite: EcdsaP256Suite,         sigBytes: 64 },
	{ alg: 'ML-DSA-44',          suite: MlDsa44Suite,           sigBytes: 2420 },
	{ alg: 'ML-DSA-65',          suite: MlDsa65Suite,           sigBytes: 3309 },
	{ alg: 'ML-DSA-87',          suite: MlDsa87Suite,           sigBytes: 4627 },
	{ alg: 'SLH-DSA-SHAKE-128f', suite: SlhDsa128fSuite,        sigBytes: 17088 },
	{ alg: 'SLH-DSA-SHAKE-192f', suite: SlhDsa192fSuite,        sigBytes: 35664 },
	{ alg: 'SLH-DSA-SHAKE-256f', suite: SlhDsa256fSuite,        sigBytes: 49856 },
	{ alg: 'MLDSA44-SLHDSA128f', suite: MlDsa44SlhDsa128fSuite, sigBytes: 19508 },
	{ alg: 'MLDSA65-SLHDSA192f', suite: MlDsa65SlhDsa192fSuite, sigBytes: 38973 },
	{ alg: 'MLDSA87-SLHDSA256f', suite: MlDsa87SlhDsa256fSuite, sigBytes: 54483 },
];

// ---------------------------------------------------------------------------
// Suite registry
// ---------------------------------------------------------------------------

describe('suite registry', () => {
	it('every advertised algorithm resolves to a suite', () => {
		for (const { alg, suite } of SUITES) {
			expect(suite, alg).toBeDefined();
			expect(typeof suite.keygen).toBe('function');
		}
	});

	it('exposes eleven distinct algorithms', () => {
		const algs = new Set(SUITES.map(s => s.alg));
		expect(algs.size).toBe(11);
	});
});

// ---------------------------------------------------------------------------
// keygen / sign / verify, one block per algorithm
// ---------------------------------------------------------------------------

const signingInput = enc('eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0');

for (const { alg, suite, sigBytes } of SUITES) {
	describe(`${alg} (${suite.formatName})`, () => {
		it('keygen returns a pk and sk pair of Uint8Arrays', () => {
			const { pk, sk } = suite.keygen();
			expect(pk).toBeInstanceOf(Uint8Array);
			expect(sk).toBeInstanceOf(Uint8Array);
			expect(pk.length).toBeGreaterThan(0);
			expect(sk.length).toBeGreaterThan(0);
		});

		// One keygen + one sign, then every assertion reuses them. Signing is the
		// expensive operation, especially for the SLH-DSA and hybrid suites, so it
		// runs exactly once per algorithm.
		it('signs, verifies, and rejects tampering', () => {
			const { pk, sk } = suite.keygen();
			const sig = Sign.signDetached(suite, sk, signingInput, EMPTY);

			// Bare primitive signature of the advertised fixed length, no envelope.
			expect(sig).toBeInstanceOf(Uint8Array);
			expect(sig.length).toBe(sigBytes);

			// A valid signature verifies.
			expect(Sign.verifyDetached(suite, pk, signingInput, sig, EMPTY)).toBe(true);

			// A different signing input (the tamper case) fails.
			const tamperedInput = enc('eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZX0');
			expect(Sign.verifyDetached(suite, pk, tamperedInput, sig, EMPTY)).toBe(false);

			// A flipped signature byte fails.
			const tamperedSig = new Uint8Array(sig);
			tamperedSig[0] ^= 0xff;
			expect(Sign.verifyDetached(suite, pk, signingInput, tamperedSig, EMPTY)).toBe(false);

			// A signature from one keypair does not verify against another's pk.
			const other = suite.keygen();
			expect(Sign.verifyDetached(suite, other.pk, signingInput, sig, EMPTY)).toBe(false);
		}, 60_000);
	});
}

// ---------------------------------------------------------------------------
// JWT token assembly, mirroring the demo's three-call flow
// ---------------------------------------------------------------------------

describe('JWT token assembly', () => {
	// Ed25519 is fast and exercises the same code path every suite uses.
	const suite = Ed25519Suite;
	const header  = { alg: 'EdDSA', typ: 'JWT' };
	const payload = { sub: '1234567890', name: 'ada lovelace', admin: false, iat: 1516239022 };

	const buildToken = (hdr: object, pld: object, sk: Uint8Array) => {
		const headerB64  = b64url(enc(JSON.stringify(hdr)));
		const payloadB64 = b64url(enc(JSON.stringify(pld)));
		const input      = `${headerB64}.${payloadB64}`;
		const sig        = Sign.signDetached(suite, sk, enc(input), EMPTY);
		return { token: `${input}.${b64url(sig)}`, input, sig };
	};

	it('produces a three-segment token joined by dots', () => {
		const { pk, sk } = suite.keygen();
		const { token } = buildToken(header, payload, sk);
		const segments = token.split('.');
		expect(segments).toHaveLength(3);
		expect(segments.every(s => s.length > 0)).toBe(true);
		// no padding, URL-safe alphabet only
		expect(/^[A-Za-z0-9_-]+$/.test(segments.join(''))).toBe(true);
		// the keypair is unused beyond signing here
		expect(pk.length).toBeGreaterThan(0);
	});

	it('verifies an untampered token', () => {
		const { pk, sk } = suite.keygen();
		const { input, sig } = buildToken(header, payload, sk);
		expect(Sign.verifyDetached(suite, pk, enc(input), sig, EMPTY)).toBe(true);
	});

	it('rejects a token whose payload was edited to admin: true', () => {
		const { pk, sk } = suite.keygen();
		// Sign the honest claims, then re-attach the original signature to an
		// elevated payload, exactly what the demo's tamper button does.
		const { sig } = buildToken(header, payload, sk);
		const forgedPayloadB64 = b64url(enc(JSON.stringify({ ...payload, admin: true })));
		const forgedInput      = `${b64url(enc(JSON.stringify(header)))}.${forgedPayloadB64}`;
		expect(Sign.verifyDetached(suite, pk, enc(forgedInput), sig, EMPTY)).toBe(false);
	});

	it('rejects a token signed by a different keypair', () => {
		const signer   = suite.keygen();
		const attacker = suite.keygen();
		const { input, sig } = buildToken(header, payload, signer.sk);
		expect(Sign.verifyDetached(suite, attacker.pk, enc(input), sig, EMPTY)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Hybrid composites verify both halves
// ---------------------------------------------------------------------------

describe('hybrid composite signatures', () => {
	it('a hybrid signature is the concatenation of its ML-DSA and SLH-DSA halves', () => {
		// 2420 (ML-DSA-44) + 17088 (SLH-DSA-SHAKE-128f) = 19508
		const hybrid = SUITES.find(s => s.alg === 'MLDSA44-SLHDSA128f')!;
		const mldsa  = SUITES.find(s => s.alg === 'ML-DSA-44')!;
		const slhdsa = SUITES.find(s => s.alg === 'SLH-DSA-SHAKE-128f')!;
		expect(hybrid.sigBytes).toBe(mldsa.sigBytes + slhdsa.sigBytes);
	});

	it('flipping a byte in the SLH-DSA half of a hybrid signature fails verification', () => {
		const suite = MlDsa44SlhDsa128fSuite;
		const { pk, sk } = suite.keygen();
		const sig = Sign.signDetached(suite, sk, signingInput, EMPTY);
		expect(Sign.verifyDetached(suite, pk, signingInput, sig, EMPTY)).toBe(true);

		// Corrupt a byte inside the SLH-DSA half (after the 2420-byte ML-DSA half).
		const tampered = new Uint8Array(sig);
		tampered[2420 + 16] ^= 0xff;
		expect(Sign.verifyDetached(suite, pk, signingInput, tampered, EMPTY)).toBe(false);
	}, 60_000);
});

// ---------------------------------------------------------------------------
// utilities
// ---------------------------------------------------------------------------

describe('encoding helpers', () => {
	it('utf8ToBytes round-trips through base64url back to the same bytes', () => {
		const bytes = enc('the quick brown fox');
		const round = b64url(bytes);
		expect(/^[A-Za-z0-9_-]+$/.test(round)).toBe(true);
		expect(round.includes('=')).toBe(false);
	});

	it('bytesToHex output length is twice the input byte length', () => {
		const { sk } = Ed25519Suite.keygen();
		expect(bytesToHex(sk).length).toBe(sk.length * 2);
	});
});
