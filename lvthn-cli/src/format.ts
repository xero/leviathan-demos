/**
 * format.ts — SRPT256S binary format read/write.
 *
 * Implements the format defined in FORMAT.md.
 *
 * Header layout (64 bytes):
 *   0-7:   magic "SRPT256S"
 *   8:     version (0x02)
 *   9:     flags   (0x00)
 *   10:    kdf     (0x01=scrypt, 0x02=keyfile)
 *   11:    reserved (0x00)
 *   12-43: salt    (32 bytes; zeroed for keyfile mode)
 *   44-63: stream_header (20 bytes: nonce 16 + chunkSize u32be 4)
 *   64+:   ciphertext
 */

export const MAGIC          = new Uint8Array([0x53, 0x52, 0x50, 0x54, 0x32, 0x35, 0x36, 0x53]); // "SRPT256S"
export const FORMAT_VERSION = 0x02;
export const HEADER_SIZE    = 64;

export const OFF_MAGIC         = 0;   // 8 bytes
export const OFF_VERSION       = 8;   // 1 byte
export const OFF_FLAGS         = 9;   // 1 byte
export const OFF_KDF           = 10;  // 1 byte
export const OFF_RESERVED      = 11;  // 1 byte
export const OFF_SALT          = 12;  // 32 bytes
export const OFF_STREAM_HEADER = 44;  // 20 bytes (nonce 16 + chunkSize u32be 4)
export const OFF_CIPHER        = 64;  // ciphertext starts here

export const KDF_SCRYPT  = 0x01;
export const KDF_KEYFILE = 0x02;

export const ARMOR_BEGIN = '-----BEGIN SRPT256S ENCRYPTED MESSAGE-----';
export const ARMOR_END   = '-----END SRPT256S ENCRYPTED MESSAGE-----';
export const KEY_BEGIN   = '-----BEGIN SRPT256S KEY-----';
export const KEY_END     = '-----END SRPT256S KEY-----';

export interface Srpt256sHeader {
	version:      number;
	flags:        number;
	kdf:          number;
	salt:         Uint8Array;  // 32 bytes
	streamHeader: Uint8Array;  // 20 bytes
}

/**
 * Encode a complete SRPT256S blob (header + ciphertext) into a Uint8Array.
 */
export function encodeBlob(
	header: Srpt256sHeader,
	ciphertext: Uint8Array,
): Uint8Array {
	const buf = new Uint8Array(HEADER_SIZE + ciphertext.length);

	buf.set(MAGIC, OFF_MAGIC);
	buf[OFF_VERSION]  = header.version;
	buf[OFF_FLAGS]    = header.flags;
	buf[OFF_KDF]      = header.kdf;
	buf[OFF_RESERVED] = 0x00;
	buf.set(header.salt, OFF_SALT);
	buf.set(header.streamHeader, OFF_STREAM_HEADER);
	buf.set(ciphertext, OFF_CIPHER);

	return buf;
}

/**
 * Parse and validate a raw binary SRPT256S blob.
 * Returns the parsed header and ciphertext, or throws a descriptive Error.
 */
export function decodeBlob(blob: Uint8Array): { header: Srpt256sHeader; ciphertext: Uint8Array } {
	if (blob.length < HEADER_SIZE) {
		throw new Error('File too short to be a valid SRPT256S file');
	}

	for (let i = 0; i < MAGIC.length; i++) {
		if (blob[OFF_MAGIC + i] !== MAGIC[i]) {
			throw new Error('Not an SRPT256S file (magic bytes mismatch)');
		}
	}

	const version = blob[OFF_VERSION];
	if (version !== FORMAT_VERSION) {
		throw new Error(`Unsupported format version: 0x${version.toString(16).padStart(2, '0')}`);
	}

	const flags = blob[OFF_FLAGS];
	if (flags !== 0x00) {
		throw new Error(`Unsupported flags: 0x${flags.toString(16).padStart(2, '0')}`);
	}

	const kdf = blob[OFF_KDF];
	if (kdf !== KDF_SCRYPT && kdf !== KDF_KEYFILE) {
		throw new Error(`Unsupported KDF: 0x${kdf.toString(16).padStart(2, '0')}`);
	}

	const salt         = blob.slice(OFF_SALT, OFF_SALT + 32);
	const streamHeader = blob.slice(OFF_STREAM_HEADER, OFF_STREAM_HEADER + 20);
	const ciphertext   = blob.slice(OFF_CIPHER);

	const header: Srpt256sHeader = { version, flags, kdf, salt, streamHeader };
	return { header, ciphertext };
}

/**
 * Detect whether input bytes represent an armored SRPT256S message.
 */
export function isArmored(data: Uint8Array): boolean {
	const prefix = new TextDecoder().decode(data.slice(0, ARMOR_BEGIN.length));
	return prefix === ARMOR_BEGIN;
}

/**
 * Base64-encode a binary blob and wrap it in SRPT256S armor headers.
 */
export function armor(data: Uint8Array): string {
	const b64 = btoa(String.fromCharCode(...data));
	const lines: string[] = [];
	for (let i = 0; i < b64.length; i += 64) {
		lines.push(b64.slice(i, i + 64));
	}
	return `${ARMOR_BEGIN}\n${lines.join('\n')}\n${ARMOR_END}\n`;
}

/**
 * Strip SRPT256S armor headers and base64-decode the content.
 */
export function dearmor(text: string): Uint8Array {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== ARMOR_BEGIN) {
		throw new Error('Missing armor header');
	}
	const endIdx = lines.findIndex(l => l.trim() === ARMOR_END);
	if (endIdx === -1) {
		throw new Error('Missing armor footer');
	}
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		result[i] = binary.charCodeAt(i);
	}
	return result;
}

/**
 * Wrap a keyfile in SRPT256S key armor.
 */
export function armorKey(data: Uint8Array): string {
	const b64 = btoa(String.fromCharCode(...data));
	return `${KEY_BEGIN}\n${b64}\n${KEY_END}\n`;
}

/**
 * Strip SRPT256S key armor and return the raw key bytes.
 */
export function dearmorKey(text: string): Uint8Array {
	const lines = text.trim().split('\n');
	if (lines[0].trim() !== KEY_BEGIN) {
		throw new Error('Missing key armor header');
	}
	const endIdx = lines.findIndex(l => l.trim() === KEY_END);
	if (endIdx === -1) {
		throw new Error('Missing key armor footer');
	}
	const b64 = lines.slice(1, endIdx).join('');
	const binary = atob(b64);
	const result = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		result[i] = binary.charCodeAt(i);
	}
	return result;
}
