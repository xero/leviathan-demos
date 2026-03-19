// src/worker.ts — XChaCha20-Poly1305 chunk worker.
//
// Compare with lvthncli-serpent/src/worker.ts:
//   - One WASM module (chacha) instead of two (serpent + sha2)
//   - No HKDF — nonce is passed in directly from the main thread
//   - xcEncrypt/xcDecrypt handle both encryption and authentication (AEAD)

interface ChaChaExports {
	memory:                WebAssembly.Memory;
	getKeyOffset:          () => number;
	getChachaNonceOffset:  () => number;
	getChunkPtOffset:      () => number;
	getChunkCtOffset:      () => number;
	getPolyMsgOffset:      () => number;
	getPolyTagOffset:      () => number;
	getXChaChaNonceOffset: () => number;
	getXChaChaSubkeyOffset:() => number;
	chachaLoadKey:         () => void;
	chachaSetCounter:      (n: number) => void;
	chachaEncryptChunk:    (n: number) => number;
	chachaGenPolyKey:      () => void;
	hchacha20:             () => void;
	polyInit:              () => void;
	polyUpdate:            (n: number) => void;
	polyFinal:             () => void;
}

let x: ChaChaExports | undefined;

// ── Inlined ops ───────────────────────────────────────────────────────────────

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

function polyFeed(cx: ChaChaExports, data: Uint8Array): void {
	if (data.length === 0) return;
	const msgOff = cx.getPolyMsgOffset();
	let pos = 0;
	while (pos < data.length) {
		const n = Math.min(64, data.length - pos);
		new Uint8Array(cx.memory.buffer).set(data.subarray(pos, pos + n), msgOff);
		cx.polyUpdate(n);
		pos += n;
	}
}

function lenBlock(aadLen: number, ctLen: number): Uint8Array {
	const b = new Uint8Array(16);
	let n = aadLen;
	for (let i = 0; i < 4; i++) { b[i] = n & 0xff; n >>>= 8; }
	n = ctLen;
	for (let i = 0; i < 4; i++) { b[8 + i] = n & 0xff; n >>>= 8; }
	return b;
}

function deriveSubkey(cx: ChaChaExports, key: Uint8Array, nonce: Uint8Array): Uint8Array {
	new Uint8Array(cx.memory.buffer).set(key, cx.getKeyOffset());
	new Uint8Array(cx.memory.buffer).set(nonce.subarray(0, 16), cx.getXChaChaNonceOffset());
	cx.hchacha20();
	const off = cx.getXChaChaSubkeyOffset();
	return new Uint8Array(cx.memory.buffer).slice(off, off + 32);
}

function innerNonce(nonce: Uint8Array): Uint8Array {
	const n = new Uint8Array(12);
	n.set(nonce.subarray(16, 24), 4);
	return n;
}

function xcEncrypt(cx: ChaChaExports, key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array {
	const subkey = deriveSubkey(cx, key, nonce);
	const inner  = innerNonce(nonce);
	const mem    = new Uint8Array(cx.memory.buffer);
	mem.set(subkey, cx.getKeyOffset());
	mem.set(inner, cx.getChachaNonceOffset());
	cx.chachaSetCounter(1);
	cx.chachaLoadKey();
	cx.chachaGenPolyKey();
	cx.polyInit();
	polyFeed(cx, new Uint8Array((16 - 0) % 16)); // empty AAD pad (no-op for 0-length)
	cx.chachaSetCounter(1);
	cx.chachaLoadKey();
	mem.set(plaintext, cx.getChunkPtOffset());
	cx.chachaEncryptChunk(plaintext.length);
	const ctOff = cx.getChunkCtOffset();
	const ct = new Uint8Array(cx.memory.buffer).slice(ctOff, ctOff + plaintext.length);
	polyFeed(cx, ct);
	const ctPad = (16 - plaintext.length % 16) % 16;
	if (ctPad > 0) polyFeed(cx, new Uint8Array(ctPad));
	polyFeed(cx, lenBlock(0, plaintext.length));
	cx.polyFinal();
	const tagOff = cx.getPolyTagOffset();
	const tag = new Uint8Array(cx.memory.buffer).slice(tagOff, tagOff + 16);
	const result = new Uint8Array(ct.length + 16);
	result.set(ct);
	result.set(tag, ct.length);
	return result;
}

function xcDecrypt(cx: ChaChaExports, key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
	const ct      = ciphertext.subarray(0, ciphertext.length - 16);
	const tag     = ciphertext.subarray(ciphertext.length - 16);
	const subkey  = deriveSubkey(cx, key, nonce);
	const inner   = innerNonce(nonce);
	const mem     = new Uint8Array(cx.memory.buffer);
	mem.set(subkey, cx.getKeyOffset());
	mem.set(inner, cx.getChachaNonceOffset());
	cx.chachaSetCounter(1);
	cx.chachaLoadKey();
	cx.chachaGenPolyKey();
	cx.polyInit();
	polyFeed(cx, ct);
	const ctPad = (16 - ct.length % 16) % 16;
	if (ctPad > 0) polyFeed(cx, new Uint8Array(ctPad));
	polyFeed(cx, lenBlock(0, ct.length));
	cx.polyFinal();
	const tagOff  = cx.getPolyTagOffset();
	const expected = new Uint8Array(cx.memory.buffer).slice(tagOff, tagOff + 16);
	if (!constantTimeEqual(expected, tag))
		throw new Error('authentication failed');
	cx.chachaSetCounter(1);
	cx.chachaLoadKey();
	new Uint8Array(cx.memory.buffer).set(ct, cx.getChunkPtOffset());
	cx.chachaEncryptChunk(ct.length);
	const ptOff = cx.getChunkCtOffset();
	return new Uint8Array(cx.memory.buffer).slice(ptOff, ptOff + ct.length);
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
	const msg = e.data;

	if (msg.type === 'init') {
		try {
			const mem  = new WebAssembly.Memory({ initial: 3, maximum: 3 });
			const inst = await WebAssembly.instantiate(
				msg.chachaBytes as ArrayBuffer, { env: { memory: mem } },
			);
			x = inst.instance.exports as unknown as ChaChaExports;
			self.postMessage({ type: 'ready' });
		} catch (err) {
			self.postMessage({ type: 'error', id: -1, message: (err as Error).message });
		}
		return;
	}

	if (!x) {
		self.postMessage({ type: 'error', id: msg.id, message: 'worker not initialized' });
		return;
	}

	try {
		const { id, op, key, nonce, data } = msg;
		const result = op === 'encrypt'
			? xcEncrypt(x, key, nonce, data)
			: xcDecrypt(x, key, nonce, data);
		self.postMessage({ type: 'result', id, data: result }, [result.buffer] as never);
	} catch (err) {
		self.postMessage({ type: 'error', id: msg.id, message: (err as Error).message });
	}
};
