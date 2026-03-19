// src/chacha/pool.ts — XChaCha20-Poly1305 worker pool.
//
// Compare with lvthncli-serpent/src/pool.ts:
//   - One WASM module (chacha.wasm) instead of two
//   - No HKDF — per-chunk nonce = streamNonce(16) || u64be(index)(8)
//   - Tag is 16 bytes (Poly1305) not 32 (HMAC-SHA256)
//   - Workers receive key+nonce+data directly

import chachaWasmPath from '../../node_modules/leviathan-crypto/dist/chacha.wasm';
import { WORKER_BUNDLE } from './worker-bundle.ts';

const CHUNK_SIZE = 65536;

function u32be(n: number): Uint8Array {
	return new Uint8Array([(n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff]);
}

function u64be(n: number): Uint8Array {
	const hi = Math.floor(n / 0x100000000), lo = n >>> 0;
	return new Uint8Array([
		(hi>>>24)&0xff, (hi>>>16)&0xff, (hi>>>8)&0xff, hi&0xff,
		(lo>>>24)&0xff, (lo>>>16)&0xff, (lo>>>8)&0xff, lo&0xff,
	]);
}

// Per-chunk nonce: streamNonce(16) || u64be(index)(8) = 24 bytes (XChaCha20 nonce).
// No HKDF required — nonce uniqueness is sufficient for XChaCha20-Poly1305.
function chunkNonce(streamNonce: Uint8Array, index: number): Uint8Array {
	const nonce = new Uint8Array(24);
	nonce.set(streamNonce, 0);
	nonce.set(u64be(index), 16);
	return nonce;
}

interface PendingJob {
	resolve: (data: Uint8Array) => void;
	reject:  (err: Error) => void;
}

interface QueuedJob {
	id:    number;
	op:    'encrypt' | 'decrypt';
	key:   Uint8Array;
	nonce: Uint8Array;
	data:  Uint8Array;
}

async function spawnWorker(chachaBytes: ArrayBuffer): Promise<Worker> {
	return new Promise((resolve, reject) => {
		const blob   = new Blob([WORKER_BUNDLE], { type: 'text/javascript' });
		const url    = URL.createObjectURL(blob);
		const worker = new Worker(url, { type: 'module' });
		const cleanup = () => {
			worker.removeEventListener('message', onMsg);
			worker.removeEventListener('error', onErr);
			URL.revokeObjectURL(url);
		};
		const onMsg = (e: MessageEvent) => {
			cleanup();
			if (e.data.type === 'ready') resolve(worker);
			else { worker.terminate(); reject(new Error(`worker init failed: ${e.data.message}`)); }
		};
		const onErr = (e: ErrorEvent) => {
			cleanup(); worker.terminate();
			reject(new Error(`worker init failed: ${e.message}`));
		};
		worker.addEventListener('message', onMsg);
		worker.addEventListener('error', onErr);
		worker.postMessage({ type: 'init', chachaBytes });
	});
}

export class SealPool {
	private readonly _workers: Worker[];
	private readonly _idle:    Worker[];
	private readonly _queue:   QueuedJob[];
	private readonly _pending: Map<number, PendingJob>;
	private _nextId   = 0;
	private _disposed = false;

	private constructor(workers: Worker[]) {
		this._workers = workers;
		this._idle    = [...workers];
		this._queue   = [];
		this._pending = new Map();
		for (const w of workers) w.onmessage = (e) => this._onMessage(w, e);
	}

	static async create(numWorkers?: number): Promise<SealPool> {
		const n = numWorkers
			?? (typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4);
		const chachaBytes = await Bun.file(chachaWasmPath as unknown as string).arrayBuffer();
		const workers: Worker[] = [];
		for (let i = 0; i < n; i++) workers.push(await spawnWorker(chachaBytes));
		return new SealPool(workers);
	}

	async seal(masterKey: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
		if (this._disposed) throw new Error('pool is disposed');
		if (masterKey.length !== 32) throw new RangeError(`key must be 32 bytes (got ${masterKey.length})`);

		const streamNonce = crypto.getRandomValues(new Uint8Array(16));
		const chunkCount  = plaintext.length === 0 ? 1 : Math.ceil(plaintext.length / CHUNK_SIZE);

		const jobs = Array.from({ length: chunkCount }, (_, i) => {
			const start = i * CHUNK_SIZE;
			const slice = plaintext.slice(start, Math.min(start + CHUNK_SIZE, plaintext.length));
			return this._dispatch({ op: 'encrypt', key: masterKey, nonce: chunkNonce(streamNonce, i), data: slice });
		});

		const chunks = await Promise.all(jobs);

		let total = 28;
		for (const c of chunks) total += c.length;
		const out = new Uint8Array(total);
		out.set(streamNonce, 0);
		out.set(u32be(CHUNK_SIZE), 16);
		out.set(u64be(chunkCount), 20);
		let pos = 28;
		for (const c of chunks) { out.set(c, pos); pos += c.length; }
		return out;
	}

	async open(masterKey: Uint8Array, wire: Uint8Array): Promise<Uint8Array> {
		if (this._disposed) throw new Error('pool is disposed');
		if (masterKey.length !== 32) throw new RangeError(`key must be 32 bytes (got ${masterKey.length})`);
		if (wire.length < 44) throw new RangeError('ciphertext too short');

		const streamNonce = wire.slice(0, 16);  // slice not subarray — avoids 431MB clone per postMessage
		const cs = (wire[16]<<24)|(wire[17]<<16)|(wire[18]<<8)|wire[19];
		let chunkCount = 0;
		for (let i = 0; i < 8; i++) chunkCount = chunkCount * 256 + wire[20 + i];

		const jobs: Promise<Uint8Array>[] = [];
		let pos = 28;
		for (let i = 0; i < chunkCount; i++) {
			const isLast  = i === chunkCount - 1;
			const wireLen = isLast ? wire.length - pos : cs + 16;  // Poly1305 tag = 16 bytes
			const slice   = wire.slice(pos, pos + wireLen);
			jobs.push(this._dispatch({ op: 'decrypt', key: masterKey, nonce: chunkNonce(streamNonce, i), data: slice }));
			pos += wireLen;
		}

		const results = await Promise.all(jobs);
		let totalPt = 0;
		for (const r of results) totalPt += r.length;
		const pt = new Uint8Array(totalPt);
		let ptPos = 0;
		for (const r of results) { pt.set(r, ptPos); ptPos += r.length; }
		return pt;
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		for (const w of this._workers) w.terminate();
		const err = new Error('pool disposed');
		for (const { reject } of this._pending.values()) reject(err);
		for (const job of this._queue) this._pending.get(job.id)?.reject(err);
		this._pending.clear();
		this._queue.length = 0;
	}

	private _dispatch(opts: Omit<QueuedJob, 'id'>): Promise<Uint8Array> {
		return new Promise((resolve, reject) => {
			const id  = this._nextId++;
			const job = { id, ...opts };
			this._pending.set(id, { resolve, reject });
			const worker = this._idle.pop();
			if (worker) this._send(worker, job);
			else        this._queue.push(job);
		});
	}

	private _send(worker: Worker, job: QueuedJob): void {
		worker.postMessage({ type: 'job', ...job });
	}

	private _onMessage(worker: Worker, e: MessageEvent): void {
		const msg = e.data;
		const job = this._pending.get(msg.id);
		if (!job) return;
		this._pending.delete(msg.id);
		if (msg.type === 'result') job.resolve(msg.data);
		else                       job.reject(new Error(msg.message));
		const next = this._queue.shift();
		if (next) this._send(worker, next);
		else      this._idle.push(worker);
	}
}

// ── Exit registry ─────────────────────────────────────────────────────────────

let _activePool: SealPool | null = null;

export function registerPool(pool: SealPool): void      { _activePool = pool; }
export function unregisterPool(): void                  { _activePool = null; }
export function disposeActiveChaChaPool(): void         { _activePool?.dispose(); _activePool = null; }
