import { describe, it, expect, beforeAll } from 'bun:test';
import {
	init,
	MlKem512, MlKem768, MlKem1024,
	HKDF_SHA256,
	XChaCha20Poly1305,
	randomBytes,
	bytesToHex,
} from 'leviathan-crypto';
import { kyberWasm }    from 'leviathan-crypto/kyber/embedded';
import { sha3Wasm }     from 'leviathan-crypto/sha3/embedded';
import { chacha20Wasm } from 'leviathan-crypto/chacha20/embedded';
import { sha2Wasm }     from 'leviathan-crypto/sha2/embedded';

beforeAll(async () => {
	await init({ kyber: kyberWasm, sha3: sha3Wasm, chacha20: chacha20Wasm, sha2: sha2Wasm });
});

// ---------------------------------------------------------------------------
// randomBytes
// ---------------------------------------------------------------------------

describe('randomBytes', () => {
	it('returns a Uint8Array of the requested length', () => {
		for (const n of [0, 1, 16, 32, 64, 256]) {
			const result = randomBytes(n);
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBe(n);
		}
	});

	it('produces different values on successive calls', () => {
		const a = randomBytes(32);
		const b = randomBytes(32);
		expect(bytesToHex(a)).not.toBe(bytesToHex(b));
	});
});

// ---------------------------------------------------------------------------
// bytesToHex
// ---------------------------------------------------------------------------

describe('bytesToHex', () => {
	it('converts a known byte sequence to the correct hex string', () => {
		expect(bytesToHex(new Uint8Array([0x00, 0xff, 0xab, 0x12]))).toBe('00ffab12');
	});

	it('returns an empty string for an empty array', () => {
		expect(bytesToHex(new Uint8Array(0))).toBe('');
	});

	it('output length is twice the input byte length', () => {
		const bytes = randomBytes(32);
		expect(bytesToHex(bytes).length).toBe(64);
	});

	it('output contains only lowercase hex characters', () => {
		const bytes = randomBytes(16);
		expect(/^[0-9a-f]+$/.test(bytesToHex(bytes))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// ML-KEM-512
// ---------------------------------------------------------------------------

describe('ML-KEM-512', () => {
	it('keygen produces encapsulationKey and decapsulationKey of correct sizes', () => {
		const kem = new MlKem512();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			expect(encapsulationKey).toBeInstanceOf(Uint8Array);
			expect(encapsulationKey.length).toBe(800);
			expect(decapsulationKey).toBeInstanceOf(Uint8Array);
			expect(decapsulationKey.length).toBe(1632);
		} finally {
			kem.dispose();
		}
	});

	it('encapsulate produces ciphertext and sharedSecret of correct sizes', () => {
		const kem = new MlKem512();
		try {
			const { encapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret } = kem.encapsulate(encapsulationKey);
			expect(ciphertext.length).toBe(768);
			expect(sharedSecret.length).toBe(32);
		} finally {
			kem.dispose();
		}
	});

	it('decapsulate returns a 32-byte shared secret', () => {
		const kem = new MlKem512();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext } = kem.encapsulate(encapsulationKey);
			const ss = kem.decapsulate(decapsulationKey, ciphertext);
			expect(ss.length).toBe(32);
		} finally {
			kem.dispose();
		}
	});

	it('round-trip: encapsulate and decapsulate produce identical shared secrets', () => {
		const kem = new MlKem512();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret: senderSS } = kem.encapsulate(encapsulationKey);
			const recipientSS = kem.decapsulate(decapsulationKey, ciphertext);
			expect(bytesToHex(senderSS)).toBe(bytesToHex(recipientSS));
		} finally {
			kem.dispose();
		}
	});

	it('dispose() can be called without error', () => {
		const kem = new MlKem512();
		expect(() => kem.dispose()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// ML-KEM-768
// ---------------------------------------------------------------------------

describe('ML-KEM-768', () => {
	it('keygen produces encapsulationKey and decapsulationKey of correct sizes', () => {
		const kem = new MlKem768();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			expect(encapsulationKey.length).toBe(1184);
			expect(decapsulationKey.length).toBe(2400);
		} finally {
			kem.dispose();
		}
	});

	it('encapsulate produces ciphertext and sharedSecret of correct sizes', () => {
		const kem = new MlKem768();
		try {
			const { encapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret } = kem.encapsulate(encapsulationKey);
			expect(ciphertext.length).toBe(1088);
			expect(sharedSecret.length).toBe(32);
		} finally {
			kem.dispose();
		}
	});

	it('decapsulate returns a 32-byte shared secret', () => {
		const kem = new MlKem768();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext } = kem.encapsulate(encapsulationKey);
			const ss = kem.decapsulate(decapsulationKey, ciphertext);
			expect(ss.length).toBe(32);
		} finally {
			kem.dispose();
		}
	});

	it('round-trip: encapsulate and decapsulate produce identical shared secrets', () => {
		const kem = new MlKem768();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret: senderSS } = kem.encapsulate(encapsulationKey);
			const recipientSS = kem.decapsulate(decapsulationKey, ciphertext);
			expect(bytesToHex(senderSS)).toBe(bytesToHex(recipientSS));
		} finally {
			kem.dispose();
		}
	});

	it('dispose() can be called without error', () => {
		const kem = new MlKem768();
		expect(() => kem.dispose()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// ML-KEM-1024
// ---------------------------------------------------------------------------

describe('ML-KEM-1024', () => {
	it('keygen produces encapsulationKey and decapsulationKey of correct sizes', () => {
		const kem = new MlKem1024();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			expect(encapsulationKey.length).toBe(1568);
			expect(decapsulationKey.length).toBe(3168);
		} finally {
			kem.dispose();
		}
	});

	it('encapsulate produces ciphertext and sharedSecret of correct sizes', () => {
		const kem = new MlKem1024();
		try {
			const { encapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret } = kem.encapsulate(encapsulationKey);
			expect(ciphertext.length).toBe(1568);
			expect(sharedSecret.length).toBe(32);
		} finally {
			kem.dispose();
		}
	});

	it('decapsulate returns a 32-byte shared secret', () => {
		const kem = new MlKem1024();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext } = kem.encapsulate(encapsulationKey);
			const ss = kem.decapsulate(decapsulationKey, ciphertext);
			expect(ss.length).toBe(32);
		} finally {
			kem.dispose();
		}
	});

	it('round-trip: encapsulate and decapsulate produce identical shared secrets', () => {
		const kem = new MlKem1024();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret: senderSS } = kem.encapsulate(encapsulationKey);
			const recipientSS = kem.decapsulate(decapsulationKey, ciphertext);
			expect(bytesToHex(senderSS)).toBe(bytesToHex(recipientSS));
		} finally {
			kem.dispose();
		}
	});

	it('dispose() can be called without error', () => {
		const kem = new MlKem1024();
		expect(() => kem.dispose()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// ML-KEM ceremony — Alice and Bob
// ---------------------------------------------------------------------------

describe('ML-KEM ceremony — Alice and Bob', () => {
	it('MlKem512: Alice and Bob derive the same 32-byte shared secret', () => {
		const kem = new MlKem512();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret: bobSS } = kem.encapsulate(encapsulationKey);
			const aliceSS = kem.decapsulate(decapsulationKey, ciphertext);
			expect(aliceSS.length).toBe(32);
			expect(bobSS.length).toBe(32);
			expect(bytesToHex(aliceSS)).toBe(bytesToHex(bobSS));
		} finally {
			kem.dispose();
		}
	});

	it('MlKem768: Alice and Bob derive the same 32-byte shared secret', () => {
		const kem = new MlKem768();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret: bobSS } = kem.encapsulate(encapsulationKey);
			const aliceSS = kem.decapsulate(decapsulationKey, ciphertext);
			expect(aliceSS.length).toBe(32);
			expect(bobSS.length).toBe(32);
			expect(bytesToHex(aliceSS)).toBe(bytesToHex(bobSS));
		} finally {
			kem.dispose();
		}
	});

	it('MlKem1024: Alice and Bob derive the same 32-byte shared secret', () => {
		const kem = new MlKem1024();
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext, sharedSecret: bobSS } = kem.encapsulate(encapsulationKey);
			const aliceSS = kem.decapsulate(decapsulationKey, ciphertext);
			expect(aliceSS.length).toBe(32);
			expect(bobSS.length).toBe(32);
			expect(bytesToHex(aliceSS)).toBe(bytesToHex(bobSS));
		} finally {
			kem.dispose();
		}
	});
});

// ---------------------------------------------------------------------------
// HKDF_SHA256
// ---------------------------------------------------------------------------

describe('HKDF_SHA256', () => {
	it('derive returns a Uint8Array of the requested length', () => {
		const ikm  = randomBytes(32);
		const salt = randomBytes(32);
		const info = new TextEncoder().encode('test');
		for (const len of [16, 32, 64]) {
			const hkdf = new HKDF_SHA256();
			try {
				const out = hkdf.derive(ikm, salt, info, len);
				expect(out).toBeInstanceOf(Uint8Array);
				expect(out.length).toBe(len);
			} finally {
				hkdf.dispose();
			}
		}
	});

	it('derive is deterministic — same inputs produce the same output', () => {
		const ikm  = new Uint8Array(32).fill(1);
		const salt = new Uint8Array(32).fill(2);
		const info = new TextEncoder().encode('determinism-test');

		const hkdf1 = new HKDF_SHA256();
		let out1: Uint8Array;
		try {
			out1 = hkdf1.derive(ikm, salt, info, 32);
		} finally {
			hkdf1.dispose();
		}

		const hkdf2 = new HKDF_SHA256();
		let out2: Uint8Array;
		try {
			out2 = hkdf2.derive(ikm, salt, info, 32);
		} finally {
			hkdf2.dispose();
		}

		expect(bytesToHex(out1!)).toBe(bytesToHex(out2!));
	});

	it('derive is sensitive to changes in ikm', () => {
		const salt = new Uint8Array(32);
		const info = new TextEncoder().encode('sensitivity');

		const hkdf1 = new HKDF_SHA256();
		let out1: Uint8Array;
		try { out1 = hkdf1.derive(randomBytes(32), salt, info, 32); }
		finally { hkdf1.dispose(); }

		const hkdf2 = new HKDF_SHA256();
		let out2: Uint8Array;
		try { out2 = hkdf2.derive(randomBytes(32), salt, info, 32); }
		finally { hkdf2.dispose(); }

		expect(bytesToHex(out1!)).not.toBe(bytesToHex(out2!));
	});

	it('derive is sensitive to changes in salt', () => {
		const ikm  = randomBytes(32);
		const info = new TextEncoder().encode('sensitivity');

		const hkdf1 = new HKDF_SHA256();
		let out1: Uint8Array;
		try { out1 = hkdf1.derive(ikm, randomBytes(32), info, 32); }
		finally { hkdf1.dispose(); }

		const hkdf2 = new HKDF_SHA256();
		let out2: Uint8Array;
		try { out2 = hkdf2.derive(ikm, randomBytes(32), info, 32); }
		finally { hkdf2.dispose(); }

		expect(bytesToHex(out1!)).not.toBe(bytesToHex(out2!));
	});

	it('derive is sensitive to changes in info', () => {
		const ikm  = randomBytes(32);
		const salt = new Uint8Array(32);

		const hkdf1 = new HKDF_SHA256();
		let out1: Uint8Array;
		try { out1 = hkdf1.derive(ikm, salt, new TextEncoder().encode('context-a'), 32); }
		finally { hkdf1.dispose(); }

		const hkdf2 = new HKDF_SHA256();
		let out2: Uint8Array;
		try { out2 = hkdf2.derive(ikm, salt, new TextEncoder().encode('context-b'), 32); }
		finally { hkdf2.dispose(); }

		expect(bytesToHex(out1!)).not.toBe(bytesToHex(out2!));
	});

	it('dispose() can be called without error', () => {
		const hkdf = new HKDF_SHA256();
		expect(() => hkdf.dispose()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// HKDF_SHA256 ceremony — deriving a session key from a shared secret
// ---------------------------------------------------------------------------

describe('HKDF_SHA256 ceremony — deriving a session key', () => {
	const info = new TextEncoder().encode('leviathan-kyber-demo');

	it('derives a 32-byte session key from the KEM shared secret', () => {
		const kem = new MlKem768();
		let sharedSecret: Uint8Array;
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext } = kem.encapsulate(encapsulationKey);
			sharedSecret = kem.decapsulate(decapsulationKey, ciphertext);
		} finally {
			kem.dispose();
		}

		const salt = randomBytes(32);
		const hkdf = new HKDF_SHA256();
		let derivedKey: Uint8Array;
		try {
			derivedKey = hkdf.derive(sharedSecret, salt, info, 32);
		} finally {
			hkdf.dispose();
		}

		expect(derivedKey!).toBeInstanceOf(Uint8Array);
		expect(derivedKey!.length).toBe(32);
	});

	it('same shared secret + salt/info always yields the same derived key', () => {
		const kem = new MlKem768();
		let sharedSecret: Uint8Array;
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const { ciphertext } = kem.encapsulate(encapsulationKey);
			sharedSecret = kem.decapsulate(decapsulationKey, ciphertext);
		} finally {
			kem.dispose();
		}

		const salt = new Uint8Array(32);

		const hkdf1 = new HKDF_SHA256();
		let key1: Uint8Array;
		try { key1 = hkdf1.derive(sharedSecret, salt, info, 32); }
		finally { hkdf1.dispose(); }

		const hkdf2 = new HKDF_SHA256();
		let key2: Uint8Array;
		try { key2 = hkdf2.derive(sharedSecret, salt, info, 32); }
		finally { hkdf2.dispose(); }

		expect(bytesToHex(key1!)).toBe(bytesToHex(key2!));
	});

	it('different shared secrets yield different derived keys', () => {
		const salt = new Uint8Array(32);

		const kem1 = new MlKem768();
		let ss1: Uint8Array;
		try {
			const { encapsulationKey, decapsulationKey } = kem1.keygen();
			const { ciphertext } = kem1.encapsulate(encapsulationKey);
			ss1 = kem1.decapsulate(decapsulationKey, ciphertext);
		} finally {
			kem1.dispose();
		}

		const kem2 = new MlKem768();
		let ss2: Uint8Array;
		try {
			const { encapsulationKey, decapsulationKey } = kem2.keygen();
			const { ciphertext } = kem2.encapsulate(encapsulationKey);
			ss2 = kem2.decapsulate(decapsulationKey, ciphertext);
		} finally {
			kem2.dispose();
		}

		const hkdf1 = new HKDF_SHA256();
		let key1: Uint8Array;
		try { key1 = hkdf1.derive(ss1, salt, info, 32); }
		finally { hkdf1.dispose(); }

		const hkdf2 = new HKDF_SHA256();
		let key2: Uint8Array;
		try { key2 = hkdf2.derive(ss2, salt, info, 32); }
		finally { hkdf2.dispose(); }

		expect(bytesToHex(key1!)).not.toBe(bytesToHex(key2!));
	});
});

// ---------------------------------------------------------------------------
// XChaCha20Poly1305
// ---------------------------------------------------------------------------

describe('XChaCha20Poly1305', () => {
	it('encrypt returns plaintext.length + 16 bytes (ciphertext || tag)', () => {
		const pt    = randomBytes(64);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);
		const aead  = new XChaCha20Poly1305();
		try {
			const ct = aead.encrypt(key, nonce, pt);
			expect(ct.length).toBe(pt.length + 16);
		} finally {
			aead.dispose();
		}
	});

	it('encrypt/decrypt round-trip recovers the original plaintext', () => {
		const pt    = randomBytes(64);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);

		const enc = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = enc.encrypt(key, nonce, pt); }
		finally { enc.dispose(); }

		const dec = new XChaCha20Poly1305();
		let recovered: Uint8Array;
		try { recovered = dec.decrypt(key, nonce, ct); }
		finally { dec.dispose(); }

		expect(bytesToHex(recovered!)).toBe(bytesToHex(pt));
	});

	it('round-trip works with additional authenticated data (AAD)', () => {
		const pt    = randomBytes(32);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);
		const aad   = new TextEncoder().encode('alice');

		const enc = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = enc.encrypt(key, nonce, pt, aad); }
		finally { enc.dispose(); }

		const dec = new XChaCha20Poly1305();
		let recovered: Uint8Array;
		try { recovered = dec.decrypt(key, nonce, ct, aad); }
		finally { dec.dispose(); }

		expect(bytesToHex(recovered!)).toBe(bytesToHex(pt));
	});

	it('decrypt with wrong key throws', () => {
		const pt    = randomBytes(32);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);

		const enc = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = enc.encrypt(key, nonce, pt); }
		finally { enc.dispose(); }

		const dec = new XChaCha20Poly1305();
		try {
			expect(() => dec.decrypt(randomBytes(32), nonce, ct)).toThrow();
		} finally {
			dec.dispose();
		}
	});

	it('decrypt with wrong nonce throws', () => {
		const pt    = randomBytes(32);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);

		const enc = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = enc.encrypt(key, nonce, pt); }
		finally { enc.dispose(); }

		const dec = new XChaCha20Poly1305();
		try {
			expect(() => dec.decrypt(key, randomBytes(24), ct)).toThrow();
		} finally {
			dec.dispose();
		}
	});

	it('decrypt with tampered ciphertext throws', () => {
		const pt    = randomBytes(32);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);

		const enc = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = enc.encrypt(key, nonce, pt); }
		finally { enc.dispose(); }

		const tampered = new Uint8Array(ct);
		tampered[0] ^= 0xff;

		const dec = new XChaCha20Poly1305();
		try {
			expect(() => dec.decrypt(key, nonce, tampered)).toThrow();
		} finally {
			dec.dispose();
		}
	});

	it('decrypt with wrong AAD throws', () => {
		const pt    = randomBytes(32);
		const key   = randomBytes(32);
		const nonce = randomBytes(24);
		const aad   = new TextEncoder().encode('alice');

		const enc = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = enc.encrypt(key, nonce, pt, aad); }
		finally { enc.dispose(); }

		const dec = new XChaCha20Poly1305();
		try {
			expect(() => dec.decrypt(key, nonce, ct, new TextEncoder().encode('mallory'))).toThrow();
		} finally {
			dec.dispose();
		}
	});

	it('dispose() can be called without error', () => {
		const aead = new XChaCha20Poly1305();
		expect(() => aead.dispose()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Full end-to-end ceremony — KEM → HKDF → AEAD
// ---------------------------------------------------------------------------

describe('Full end-to-end ceremony — KEM → HKDF → AEAD', () => {
	const enc  = new TextEncoder();
	const info = enc.encode('leviathan-kyber-demo');
	const aad  = enc.encode('kyber-demo');

	it('Alice encrypts a message; Bob decrypts it using a PQ-derived key', () => {
		// 1. Key establishment
		const kem = new MlKem768();
		let aliceSS: Uint8Array, bobSS: Uint8Array, kemCt: Uint8Array;
		try {
			const { encapsulationKey, decapsulationKey } = kem.keygen();
			const encap = kem.encapsulate(encapsulationKey);
			kemCt = encap.ciphertext;
			bobSS = encap.sharedSecret;
			aliceSS = kem.decapsulate(decapsulationKey, kemCt);
		} finally {
			kem.dispose();
		}
		expect(bytesToHex(aliceSS)).toBe(bytesToHex(bobSS));

		// 2. Both sides derive symmetric key via HKDF
		const salt = randomBytes(32);

		const aliceHkdf = new HKDF_SHA256();
		let aliceKey: Uint8Array;
		try { aliceKey = aliceHkdf.derive(aliceSS, salt, info, 32); }
		finally { aliceHkdf.dispose(); }

		const bobHkdf = new HKDF_SHA256();
		let bobKey: Uint8Array;
		try { bobKey = bobHkdf.derive(bobSS, salt, info, 32); }
		finally { bobHkdf.dispose(); }

		expect(bytesToHex(aliceKey!)).toBe(bytesToHex(bobKey!));

		// 3. Alice encrypts a message
		const plaintext = enc.encode('hello from alice');
		const nonce     = randomBytes(24);

		const aliceAead = new XChaCha20Poly1305();
		let ciphertext: Uint8Array;
		try { ciphertext = aliceAead.encrypt(aliceKey, nonce, plaintext, aad); }
		finally { aliceAead.dispose(); }

		// 4. Bob decrypts
		const bobAead = new XChaCha20Poly1305();
		let recovered: Uint8Array;
		try { recovered = bobAead.decrypt(bobKey, nonce, ciphertext, aad); }
		finally { bobAead.dispose(); }

		expect(bytesToHex(recovered!)).toBe(bytesToHex(plaintext));
	});

	it('tampered KEM ciphertext causes implicit-rejection → AEAD authentication failure', () => {
		// 1. Key establishment
		const kem = new MlKem768();
		let bobSS: Uint8Array, badSS: Uint8Array, kemCt: Uint8Array;
		let decapsulationKey: Uint8Array;
		try {
			const keypair = kem.keygen();
			decapsulationKey = keypair.decapsulationKey;
			const encap = kem.encapsulate(keypair.encapsulationKey);
			kemCt = encap.ciphertext;
			bobSS = encap.sharedSecret;

			// Tamper the KEM ciphertext — FO transform returns pseudorandom SS, no throw
			const tampered = new Uint8Array(kemCt);
			tampered[0] ^= 0xff;
			badSS = kem.decapsulate(decapsulationKey, tampered);
		} finally {
			kem.dispose();
		}

		// badSS is a pseudorandom implicit-rejection value — not the correct SS
		expect(bytesToHex(badSS)).not.toBe(bytesToHex(bobSS));

		// 2. Derive keys from both SS values
		const salt = new Uint8Array(32);

		const goodHkdf = new HKDF_SHA256();
		let goodKey: Uint8Array;
		try { goodKey = goodHkdf.derive(bobSS, salt, info, 32); }
		finally { goodHkdf.dispose(); }

		const badHkdf = new HKDF_SHA256();
		let badKey: Uint8Array;
		try { badKey = badHkdf.derive(badSS, salt, info, 32); }
		finally { badHkdf.dispose(); }

		// 3. Sender encrypts with the good key; attacker tries to decrypt with bad key
		const plaintext = enc.encode('secret message');
		const nonce     = randomBytes(24);

		const senderAead = new XChaCha20Poly1305();
		let ct: Uint8Array;
		try { ct = senderAead.encrypt(goodKey, nonce, plaintext, aad); }
		finally { senderAead.dispose(); }

		const attackerAead = new XChaCha20Poly1305();
		try {
			expect(() => attackerAead.decrypt(badKey, nonce, ct, aad)).toThrow();
		} finally {
			attackerAead.dispose();
		}
	});
});
