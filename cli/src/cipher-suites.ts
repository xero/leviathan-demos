/**
 * cipher-suites.ts: Cipher suite wrappers with blob-URL worker spawning.
 *
 * Bun compiled binaries cannot resolve `new URL('./pool-worker.js', import.meta.url)`
 * because import.meta.url points into the virtual /$bunfs/root/ filesystem.
 * These wrappers override createPoolWorker() to use a pre-bundled Blob URL instead.
 *
 * Workers are created in classic (non-module) mode. Bun's compiled binary runtime
 * shares the JS module instance across workers that load identical blob URL content,
 * which makes module-level WASM exports and key material shared mutable state across
 * all pool workers. Classic workers always get an independent global scope, so each
 * worker owns its own WASM instances and key buffers. The worker bundles are built
 * with format: 'iife' (see build.ts) so they carry no ES module semantics.
 */

import { XChaCha20Cipher, SerpentCipher, AESGCMSIVCipher } from 'leviathan-crypto';
import type { CipherSuite } from 'leviathan-crypto';
import { WORKER_BUNDLE as CHACHA_BUNDLE } from './chacha/worker-bundle.ts';
import { WORKER_BUNDLE as SERPENT_BUNDLE } from './serpent/worker-bundle.ts';
import { WORKER_BUNDLE as AES_BUNDLE } from './aes/worker-bundle.ts';

export const XChaCha20CipherBun: CipherSuite = {
	...XChaCha20Cipher,
	createPoolWorker(): Worker {
		const blob = new Blob([CHACHA_BUNDLE], { type: 'text/javascript' });
		const url  = URL.createObjectURL(blob);
		return new Worker(url);
	},
};

export const SerpentCipherBun: CipherSuite = {
	...SerpentCipher,
	createPoolWorker(): Worker {
		const blob = new Blob([SERPENT_BUNDLE], { type: 'text/javascript' });
		const url  = URL.createObjectURL(blob);
		return new Worker(url);
	},
};

export const AESGCMSIVCipherBun: CipherSuite = {
	...AESGCMSIVCipher,
	createPoolWorker(): Worker {
		const blob = new Blob([AES_BUNDLE], { type: 'text/javascript' });
		const url  = URL.createObjectURL(blob);
		return new Worker(url);
	},
};
