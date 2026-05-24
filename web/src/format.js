// ── LVTHN v3 wire format (mirrors cli/src/format.ts) ────────────────────
// Outer header (41 bytes):
//   0-4:   magic   "LVTHN"
//   5:     version 0x03
//   6:     cipher  0x01=Serpent-256-CBC+HMAC-SHA256, 0x02=XChaCha20-Poly1305,
//                  0x03=AES-256-GCM-SIV
//   7:     kdf     0x01=scrypt, 0x02=keyfile
//   8:     flags   0x00 (reserved)
//   9-40:  salt    32 bytes; zeroed for keyfile mode
//   41+:   payload SealStreamPool output (20-byte preamble + chunks)

const MAGIC          = new Uint8Array([0x4c, 0x56, 0x54, 0x48, 0x4e]); // "LVTHN"
const FORMAT_VERSION = 0x03;
const LVTHN_HEADER_SIZE = 41;

const OFF_MAGIC   = 0;
const OFF_VERSION = 5;
const OFF_CIPHER  = 6;
const OFF_KDF     = 7;
const OFF_FLAGS   = 8;
const OFF_SALT    = 9;
const OFF_PAYLOAD = 41;

const CIPHER_SERPENT = 0x01;
const CIPHER_CHACHA  = 0x02;
const CIPHER_AES     = 0x03;

const KDF_SCRYPT  = 0x01;
const KDF_KEYFILE = 0x02;

const ARMOR_BEGIN = '-----BEGIN LVTHN ENCRYPTED MESSAGE-----';
const ARMOR_END   = '-----END LVTHN ENCRYPTED MESSAGE-----';
const KEY_BEGIN   = '-----BEGIN LVTHN KEY-----';
const KEY_END     = '-----END LVTHN KEY-----';

function encodeBlob(header, poolOutput) {
	const buf = new Uint8Array(LVTHN_HEADER_SIZE + poolOutput.length);
	buf.set(MAGIC, OFF_MAGIC);
	buf[OFF_VERSION] = header.version;
	buf[OFF_CIPHER]  = header.cipher;
	buf[OFF_KDF]     = header.kdf;
	buf[OFF_FLAGS]   = 0x00;
	buf.set(header.salt, OFF_SALT);
	buf.set(poolOutput, OFF_PAYLOAD);
	return buf;
}

function decodeBlob(blob) {
	if (blob.length < LVTHN_HEADER_SIZE)
		throw new Error('file too short to be a valid LVTHN file');
	for (let i = 0; i < MAGIC.length; i++) {
		if (blob[OFF_MAGIC + i] !== MAGIC[i])
			throw new Error('not an LVTHN file (magic bytes mismatch)');
	}
	const version = blob[OFF_VERSION];
	if (version !== FORMAT_VERSION)
		throw new Error(`unsupported format version 0x${version.toString(16).padStart(2, '0')}: this file was encrypted with an incompatible version of lvthn (current: 0x${FORMAT_VERSION.toString(16).padStart(2, '0')})`);
	const cipher = blob[OFF_CIPHER];
	if (cipher !== CIPHER_SERPENT && cipher !== CIPHER_CHACHA && cipher !== CIPHER_AES)
		throw new Error(`unsupported cipher: 0x${cipher.toString(16).padStart(2, '0')}`);
	const kdf = blob[OFF_KDF];
	if (kdf !== KDF_SCRYPT && kdf !== KDF_KEYFILE)
		throw new Error(`unsupported KDF: 0x${kdf.toString(16).padStart(2, '0')}`);
	return {
		header: {
			version,
			cipher,
			kdf,
			flags: blob[OFF_FLAGS],
			salt:  blob.slice(OFF_SALT, OFF_SALT + 32),
		},
		poolOutput: blob.slice(OFF_PAYLOAD),
	};
}

function isArmored(data) {
	const prefix = new TextDecoder().decode(data.slice(0, ARMOR_BEGIN.length));
	return prefix === ARMOR_BEGIN;
}

function armor(data) {
	let binary = '';
	const chunk = 8192;
	for (let i = 0; i < data.length; i += chunk) {
		binary += String.fromCharCode(...data.subarray(i, i + chunk));
	}
	const b64 = btoa(binary);
	const lines = [];
	for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
	return `${ARMOR_BEGIN}\n${lines.join('\n')}\n${ARMOR_END}\n`;
}

function dearmor(text) {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== ARMOR_BEGIN) throw new Error('missing armor header');
	const endIdx = lines.findIndex(l => l.trim() === ARMOR_END);
	if (endIdx === -1) throw new Error('missing armor footer');
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
	return result;
}

function armorKey(data) {
	const b64 = btoa(String.fromCharCode(...data));
	return `${KEY_BEGIN}\n${b64}\n${KEY_END}\n`;
}

function dearmorKey(text) {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== KEY_BEGIN) throw new Error('missing key armor header');
	const endIdx = lines.findIndex(l => l.trim() === KEY_END);
	if (endIdx === -1) throw new Error('missing key armor footer');
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
	return result;
}

function isArmoredKey(bytes) {
	return bytes.length > 5 && bytes[0] === 0x2d && bytes[1] === 0x2d && bytes[2] === 0x2d;
}
