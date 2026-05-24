// ── Key derivation (mirrors cli/src/crypto.ts) ────────────────────────────
// scrypt(N=32768, r=8, p=1, dkLen=32) for passphrase mode.
// Raw 32-byte keys for keyfile mode.

const SCRYPT_N    = 32768;
const SCRYPT_R    = 8;
const SCRYPT_P    = 1;
const KEY_BYTES   = 32;

function deriveKey(passphrase, salt) {
	const s = salt ?? crypto.getRandomValues(new Uint8Array(32));
	const key = scrypt(utf8ToBytes(passphrase), s, {
		N:     SCRYPT_N,
		r:     SCRYPT_R,
		p:     SCRYPT_P,
		dkLen: KEY_BYTES,
	});
	return { key, salt: s };
}

function generateKey() {
	return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}
