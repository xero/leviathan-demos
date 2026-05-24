// ── Cipher suite wrappers (mirrors cli/src/cipher-suites.ts) ──────────────
// The library default createPoolWorker() uses `new URL('./pool-worker.js',
// import.meta.url)`, which a self-contained single-file HTML cannot satisfy.
// Each wrapper overrides it to spawn a classic worker from a Blob URL whose
// source is the pre-bundled IIFE in *_WORKER_BUNDLE (built by build.ts).

function makeBlobWorker(source) {
	const blob = new Blob([source], { type: 'text/javascript' });
	const url  = URL.createObjectURL(blob);
	return new Worker(url);
}

const SerpentCipherWeb = {
	...SerpentCipher,
	createPoolWorker() { return makeBlobWorker(SERPENT_WORKER_BUNDLE); },
};

const XChaCha20CipherWeb = {
	...XChaCha20Cipher,
	createPoolWorker() { return makeBlobWorker(CHACHA_WORKER_BUNDLE); },
};

const AESGCMSIVCipherWeb = {
	...AESGCMSIVCipher,
	createPoolWorker() { return makeBlobWorker(AES_WORKER_BUNDLE); },
};

function cipherSuiteFor(name) {
	if (name === 'chacha')  return XChaCha20CipherWeb;
	if (name === 'aes')     return AESGCMSIVCipherWeb;
	return SerpentCipherWeb;
}

function cipherByteFor(name) {
	if (name === 'chacha')  return CIPHER_CHACHA;
	if (name === 'aes')     return CIPHER_AES;
	return CIPHER_SERPENT;
}

function wasmFor(name) {
	if (name === 'chacha')  return { chacha20: chacha20Wasm, sha2: sha2Wasm };
	if (name === 'aes')     return { aes:      aesWasm,      sha2: sha2Wasm };
	return                          { serpent:  serpentWasm,  sha2: sha2Wasm };
}

function cipherNameFromByte(byte) {
	if (byte === CIPHER_CHACHA)  return 'chacha';
	if (byte === CIPHER_AES)     return 'aes';
	return 'serpent';
}
