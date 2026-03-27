/**
 * format.ts — LVTHNCLI binary format read/write.
 *
 * Outer header layout (44 bytes):
 *   0-7:   magic   "LVTHNCLI"
 *   8:     version 0x01
 *   9:     cipher  0x01=Serpent-256-CTR+HMAC-SHA256, 0x02=XChaCha20-Poly1305
 *   10:    kdf     0x01=scrypt, 0x02=keyfile
 *   11:    flags   0x00 (reserved)
 *   12-43: salt    32 bytes; zeroed for keyfile mode
 *   44+:   payload pool output
 */

export const MAGIC          = new Uint8Array([0x4c, 0x56, 0x54, 0x48, 0x4e, 0x43, 0x4c, 0x49]); // "LVTHNCLI"
export const FORMAT_VERSION = 0x01;
export const HEADER_SIZE    = 44;

export const OFF_MAGIC   = 0;   // 8 bytes
export const OFF_VERSION = 8;   // 1 byte
export const OFF_CIPHER  = 9;   // 1 byte — cipher type
export const OFF_KDF     = 10;  // 1 byte
export const OFF_FLAGS   = 11;  // 1 byte — reserved
export const OFF_SALT    = 12;  // 32 bytes
export const OFF_PAYLOAD = 44;  // pool output starts here

export const CIPHER_SERPENT = 0x01;
export const CIPHER_CHACHA  = 0x02;

export const KDF_SCRYPT  = 0x01;
export const KDF_KEYFILE = 0x02;

export const ARMOR_BEGIN = '-----BEGIN LVTHNCLI ENCRYPTED MESSAGE-----';
export const ARMOR_END   = '-----END LVTHNCLI ENCRYPTED MESSAGE-----';
export const KEY_BEGIN   = '-----BEGIN LVTHNCLI KEY-----';
export const KEY_END     = '-----END LVTHNCLI KEY-----';

export interface LvthnHeader {
	version: number;
	cipher:  number;
	kdf:     number;
	flags:   number;
	salt:    Uint8Array;  // 32 bytes
}

export function encodeBlob(header: LvthnHeader, poolOutput: Uint8Array): Uint8Array {
	const buf = new Uint8Array(HEADER_SIZE + poolOutput.length);
	buf.set(MAGIC, OFF_MAGIC);
	buf[OFF_VERSION] = header.version;
	buf[OFF_CIPHER]  = header.cipher;
	buf[OFF_KDF]     = header.kdf;
	buf[OFF_FLAGS]   = 0x00;
	buf.set(header.salt, OFF_SALT);
	buf.set(poolOutput, OFF_PAYLOAD);
	return buf;
}

export function decodeBlob(
	blob: Uint8Array,
): { header: LvthnHeader; poolOutput: Uint8Array } {
	if (blob.length < HEADER_SIZE)
		throw new Error('File too short to be a valid LVTHNCLI file');
	for (let i = 0; i < MAGIC.length; i++) {
		if (blob[OFF_MAGIC + i] !== MAGIC[i])
			throw new Error('Not an LVTHNCLI file (magic bytes mismatch)');
	}
	const version = blob[OFF_VERSION];
	if (version !== FORMAT_VERSION)
		throw new Error(`Unsupported format version: 0x${version.toString(16).padStart(2, '0')}`);
	const cipher = blob[OFF_CIPHER];
	if (cipher !== CIPHER_SERPENT && cipher !== CIPHER_CHACHA)
		throw new Error(`Unsupported cipher: 0x${cipher.toString(16).padStart(2, '0')}`);
	const kdf = blob[OFF_KDF];
	if (kdf !== KDF_SCRYPT && kdf !== KDF_KEYFILE)
		throw new Error(`Unsupported KDF: 0x${kdf.toString(16).padStart(2, '0')}`);
	return {
		header: {
			version,
			cipher,
			kdf,
			flags: blob[OFF_FLAGS],
			salt: blob.slice(OFF_SALT, OFF_SALT + 32),
		},
		poolOutput: blob.slice(OFF_PAYLOAD),
	};
}

export function isArmored(data: Uint8Array): boolean {
	const prefix = new TextDecoder().decode(data.slice(0, ARMOR_BEGIN.length));
	return prefix === ARMOR_BEGIN;
}

export function armor(data: Uint8Array): string {
	// Chunked encode — prevents call stack overflow on large files
	let binary = '';
	const chunk = 8192;
	for (let i = 0; i < data.length; i += chunk) {
		binary += String.fromCharCode(...data.subarray(i, i + chunk));
	}
	const b64 = btoa(binary);
	const lines: string[] = [];
	for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
	return `${ARMOR_BEGIN}\n${lines.join('\n')}\n${ARMOR_END}\n`;
}

export function dearmor(text: string): Uint8Array {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== ARMOR_BEGIN)
		throw new Error('Missing armor header');
	const endIdx = lines.findIndex(l => l.trim() === ARMOR_END);
	if (endIdx === -1)
		throw new Error('Missing armor footer');
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
	return result;
}

export function armorKey(data: Uint8Array): string {
	const b64 = btoa(String.fromCharCode(...data));
	return `${KEY_BEGIN}\n${b64}\n${KEY_END}\n`;
}

export function dearmorKey(text: string): Uint8Array {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== KEY_BEGIN)
		throw new Error('Missing key armor header');
	const endIdx = lines.findIndex(l => l.trim() === KEY_END);
	if (endIdx === -1)
		throw new Error('Missing key armor footer');
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
	return result;
}
