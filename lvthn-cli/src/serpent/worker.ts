interface SerpentExports {
	memory:           WebAssembly.Memory;
	getKeyOffset:     () => number;
	getNonceOffset:   () => number;
	getChunkPtOffset: () => number;
	getChunkCtOffset: () => number;
	loadKey:          (n: number) => number;
	resetCounter:     () => void;
	encryptChunk:     (n: number) => number;
	wipeBuffers:      () => void;
}

interface Sha2Exports {
	memory:               WebAssembly.Memory;
	getSha256InputOffset: () => number;
	getSha256OutOffset:   () => number;
	hmac256Init:          (keyLen: number) => void;
	hmac256Update:        (len: number) => void;
	hmac256Final:         () => void;
	wipeBuffers:          () => void;
}

let sx: SerpentExports | undefined;
let hx: Sha2Exports | undefined;

const ZERO_NONCE = new Uint8Array(16);

function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
	const h = hx!;
	const inputOff = h.getSha256InputOffset();
	new Uint8Array(h.memory.buffer).set(key, inputOff);
	h.hmac256Init(key.length);
	let pos = 0;
	while (pos < msg.length) {
		const n = Math.min(msg.length - pos, 64);
		new Uint8Array(h.memory.buffer).set(msg.subarray(pos, pos + n), inputOff);
		h.hmac256Update(n);
		pos += n;
	}
	h.hmac256Final();
	const out = new Uint8Array(h.memory.buffer);
	return out.slice(h.getSha256OutOffset(), h.getSha256OutOffset() + 32);
}

function ctrEncrypt(key: Uint8Array, chunk: Uint8Array): Uint8Array {
	const s = sx!;
	const mem = new Uint8Array(s.memory.buffer);
	mem.set(key, s.getKeyOffset());
	mem.set(ZERO_NONCE, s.getNonceOffset());
	s.loadKey(key.length);
	s.resetCounter();
	new Uint8Array(s.memory.buffer).set(chunk, s.getChunkPtOffset());
	s.encryptChunk(chunk.length);
	const out = new Uint8Array(s.memory.buffer);
	return out.slice(s.getChunkCtOffset(), s.getChunkCtOffset() + chunk.length);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

const CHUNK_SIZE   = 65536;
const DOMAIN_BYTES = new TextEncoder().encode('SerpentStream-v1'); // 16 bytes

function u32be(n: number): Uint8Array {
	return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function u64be(n: number): Uint8Array {
	const hi = Math.floor(n / 0x100000000), lo = n >>> 0;
	return new Uint8Array([
		(hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
		(lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
	]);
}

// HKDF-SHA256 (RFC 5869) — implemented using hmacSha256() above.
// Returns encKey (32 bytes) and macKey (32 bytes) for one chunk.
function hkdfSha256(
	masterKey:   Uint8Array,
	streamNonce: Uint8Array,
	info:        Uint8Array,
): { encKey: Uint8Array; macKey: Uint8Array } {
	// Extract
	const prk = hmacSha256(streamNonce, masterKey);
	// Expand T(1) — encKey
	const t1In = new Uint8Array(info.length + 1);
	t1In.set(info, 0); t1In[info.length] = 0x01;
	const t1 = hmacSha256(prk, t1In);
	// Expand T(2) — macKey
	const t2In = new Uint8Array(32 + info.length + 1);
	t2In.set(t1, 0); t2In.set(info, 32); t2In[32 + info.length] = 0x02;
	const t2 = hmacSha256(prk, t2In);
	return { encKey: t1, macKey: t2 };
}
// Build the 54-byte HKDF info buffer.
//
// CRITICAL: DOMAIN_BYTES is 16 bytes but offset advances by 17,
// leaving a zero-byte gap at position 16. This matches pool.ts exactly.
// Any deviation produces different keys and every decrypt will fail.
//
// Layout:
//   [0..15]  'SerpentStream-v1' (16 bytes)
//   [16]     0x00 (gap)
//   [17..32] streamNonce (16 bytes)
//   [33..36] CHUNK_SIZE as u32be
//   [37..44] chunkCount as u64be
//   [45..52] index as u64be
//   [53]     0x01 if isLast, else 0x00
function buildInfo(
	streamNonce: Uint8Array,
	chunkCount:  number,
	index:       number,
	isLast:      boolean,
): Uint8Array {
	const info = new Uint8Array(54);
	let off = 0;
	info.set(DOMAIN_BYTES, off); off += 17;  // 16 written, 1 zero gap
	info.set(streamNonce, off);  off += 16;
	info.set(u32be(CHUNK_SIZE), off); off += 4;
	info.set(u64be(chunkCount), off); off += 8;
	info.set(u64be(index), off);      off += 8;
	info[off] = isLast ? 0x01 : 0x00;
	return info;
}

function sealChunk(encKey: Uint8Array, macKey: Uint8Array, chunk: Uint8Array): Uint8Array {
	const ct = ctrEncrypt(encKey, chunk);
	const tag = hmacSha256(macKey, ct);
	const out = new Uint8Array(ct.length + 32);
	out.set(ct, 0);
	out.set(tag, ct.length);
	return out;
}

function openChunk(encKey: Uint8Array, macKey: Uint8Array, wire: Uint8Array): Uint8Array {
	if (wire.length < 32) throw new RangeError('chunk too short');
	const ct  = wire.subarray(0, wire.length - 32);
	const tag = wire.subarray(wire.length - 32);
	if (!constantTimeEqual(tag, hmacSha256(macKey, ct)))
		throw new Error('authentication failed');
	return ctrEncrypt(encKey, ct);
}

self.onmessage = async (e: MessageEvent) => {
	const msg = e.data;

	if (msg.type === 'init') {
		try {
			const serpentMem = new WebAssembly.Memory({ initial: 3, maximum: 3 });
			const sha2Mem    = new WebAssembly.Memory({ initial: 3, maximum: 3 });
			// Receive raw bytes (ArrayBuffer) — compile + instantiate each worker's
			// own WASM instances so each gets independent linear memory.
			const serpentInst = await WebAssembly.instantiate(
				msg.serpentBytes as ArrayBuffer, { env: { memory: serpentMem } },
			);
			const sha2Inst = await WebAssembly.instantiate(
				msg.sha2Bytes as ArrayBuffer, { env: { memory: sha2Mem } },
			);
			sx = serpentInst.instance.exports as unknown as SerpentExports;
			hx = sha2Inst.instance.exports as unknown as Sha2Exports;
			self.postMessage({ type: 'ready' });
		} catch (err) {
			self.postMessage({ type: 'error', id: -1, message: (err as Error).message });
		}
		return;
	}

	if (!sx || !hx) {
		self.postMessage({ type: 'error', id: msg.id, message: 'worker not initialized' });
		return;
	}

	try {
		const { id, op, masterKey, streamNonce, chunkCount, index, isLast, data } = msg;
		const info = buildInfo(streamNonce, chunkCount, index, isLast);
		const { encKey, macKey } = hkdfSha256(masterKey, streamNonce, info);
		const result = op === 'seal'
			? sealChunk(encKey, macKey, data)
			: openChunk(encKey, macKey, data);
		self.postMessage({ type: 'result', id, data: result }, [result.buffer] as never);
	} catch (err) {
		self.postMessage({ type: 'error', id: msg.id, message: (err as Error).message });
	}
};
