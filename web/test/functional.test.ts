/**
 * functional.test.ts: Functional crypto tests for the lvthn-web UI.
 *
 * Covers all three cipher suites (Serpent, XChaCha20, AES-GCM-SIV) across
 * both KDF modes (scrypt passphrase, raw keyfile), KDF mismatch detection,
 * file-input flows, and LVTHN v3 format header verification. Files
 * produced here are byte-compatible with the lvthn CLI.
 */

import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const HTML_PATH = `file://${resolve(process.cwd(), 'dist/index.html')}`;

// 32-byte hex keys (64 hex chars each), the CLI keyfile size.
const HEX_KEY_A = 'a'.repeat(64);
const HEX_KEY_B = 'b'.repeat(64);

async function waitForAction(page: Page, mode: 'ENCRYPT' | 'DECRYPT') {
	await page.waitForFunction(
		(m: string) => document.getElementById('action-btn')?.textContent === m,
		mode,
		{ timeout: 30000 },
	);
}

async function decodeBlobBytes(page: Page, armored: string): Promise<number[]> {
	return page.evaluate((arm: string) => {
		const lines = arm.trim().split('\n');
		const endIdx = lines.findIndex(l => l.startsWith('---END'));
		const b64 = lines.slice(1, endIdx).join('');
		const bin = atob(b64);
		return Array.from(new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i)));
	}, armored);
}

async function selectKeyfileHex(page: Page) {
	await page.locator('#lbl-kf').click();
	await page.locator('#kf-tab-hex').click();
}

async function fillHexKey(page: Page, hex: string) {
	await selectKeyfileHex(page);
	await page.locator('#kf-hex-input').fill(hex);
}

async function selectCipher(page: Page, name: 'serpent' | 'chacha' | 'aes') {
	// The radio input is visually hidden; click the wrapping label instead.
	await page.locator(`#lbl-cipher-${name}`).click();
}

async function encryptText(page: Page, plaintext: string): Promise<string> {
	await page.locator('#input-text').fill(plaintext);
	await page.locator('#action-btn').click();
	await waitForAction(page, 'ENCRYPT');
	return page.locator('#out-text').inputValue();
}

async function decryptText(page: Page, armored: string): Promise<string> {
	await page.locator('#input-text').fill(armored);
	await page.locator('#action-btn').click();
	await waitForAction(page, 'DECRYPT');
	return page.locator('#out-text').inputValue();
}

// ── Generated key round-trips ─────────────────────────────────

test.describe('Generated key → text round-trip', () => {
	test('encrypt with generated key, decrypt via hex paste', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'generated key round-trip test';

		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const keyHex = await page.locator('#key-hex').inputValue();
		const armored = await encryptText(page, plaintext);

		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, keyHex);
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe(plaintext);
	});

	test('wrong hex key → authentication failure', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const armored = await encryptText(page, 'secret data');

		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_B);
		await page.locator('#input-text').fill(armored);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('authentication failed');
	});
});

// ── Keyfile (hex paste) round-trips ───────────────────────────

test.describe('Keyfile hex round-trip', () => {
	test('encrypt and decrypt with same hex key', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'hex keyfile round-trip';

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, plaintext);

		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe(plaintext);
	});

	test('short hex key is rejected', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, 'cc'.repeat(16)); // 16 bytes; CLI requires exactly 32
		await expect(page.locator('#kf-hex-status')).toHaveText(/expected 64 hex chars/);
	});

	test('wrong hex key → authentication failure', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'hex key mismatch test');

		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_B);
		await page.locator('#input-text').fill(armored);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('authentication failed');
	});
});

// ── Keyfile (file upload) round-trips ─────────────────────────

test.describe('Keyfile file upload round-trip', () => {
	const keyBuffer = Buffer.alloc(32, 0xab); // 32 bytes, CLI keyfile size

	test('encrypt and decrypt with same uploaded keyfile', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'keyfile upload round-trip';

		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'test.key',
			mimeType: 'application/octet-stream',
			buffer: keyBuffer,
		});
		const armored = await encryptText(page, plaintext);

		await page.locator('#btn-decrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'test.key',
			mimeType: 'application/octet-stream',
			buffer: keyBuffer,
		});
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe(plaintext);
	});

	test('wrong keyfile → authentication failure', async ({ page }) => {
		await page.goto(HTML_PATH);
		const wrongKeyBuffer = Buffer.alloc(32, 0xcd);

		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'real.key',
			mimeType: 'application/octet-stream',
			buffer: keyBuffer,
		});
		const armored = await encryptText(page, 'wrong keyfile test');

		await page.locator('#btn-decrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'wrong.key',
			mimeType: 'application/octet-stream',
			buffer: wrongKeyBuffer,
		});
		await page.locator('#input-text').fill(armored);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('authentication failed');
	});

	test('keyfile of wrong size is rejected', async ({ page }) => {
		await page.goto(HTML_PATH);
		const tooSmall = Buffer.alloc(16, 0xab);

		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'small.key',
			mimeType: 'application/octet-stream',
			buffer: tooSmall,
		});
		await page.locator('#input-text').fill('size test');
		await page.locator('#action-btn').click();
		await waitForAction(page, 'ENCRYPT');

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('invalid keyfile size');
	});
});

// ── KDF mismatch detection ────────────────────────────────────

test.describe('KDF mismatch detection', () => {
	test('passphrase-encrypted data requires passphrase to decrypt', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await page.locator('#pp-input').fill('correct horse battery staple');
		const armored = await encryptText(page, 'passphrase-only content');

		await page.goto(HTML_PATH);

		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		await page.locator('#input-text').fill(armored);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('passphrase required');
	});

	test('keyfile-encrypted data requires keyfile to decrypt', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'keyfile-only content');

		await page.goto(HTML_PATH);

		await page.locator('#btn-decrypt').click();
		await page.locator('#pp-input').fill('wrong-mode-passphrase');
		await page.locator('#input-text').fill(armored);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('keyfile required');
	});
});

// ── File input round-trips ────────────────────────────────────

test.describe('File input round-trips', () => {
	test('file + passphrase encrypt/decrypt', async ({ page }) => {
		await page.goto(HTML_PATH);
		const fileContent = 'binary file content for passphrase test';
		const passphrase = 'file-passphrase-test-12345';

		await page.locator('#btn-encrypt').click();
		await page.locator('#tab-file').click();
		await page.locator('#file-picker').setInputFiles({
			name: 'test.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from(fileContent),
		});
		await page.locator('#pp-input').fill(passphrase);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'ENCRYPT');

		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.locator('#btn-dl-file').click(),
		]);
		const dlPath = await download.path();
		expect(dlPath).toBeTruthy();

		await page.locator('#btn-decrypt').click();
		await page.locator('#tab-file').click();
		await page.locator('#file-picker').setInputFiles(dlPath!);
		await page.locator('#pp-input').fill(passphrase);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const dlBtn = page.locator('#btn-dl-dec');
		await expect(dlBtn).toBeVisible();

		const [decDownload] = await Promise.all([
			page.waitForEvent('download'),
			dlBtn.click(),
		]);
		const decPath = await decDownload.path();
		const { readFileSync } = await import('node:fs');
		const decrypted = readFileSync(decPath!);
		expect(decrypted.toString()).toBe(fileContent);
	});

	test('file + hex key encrypt/decrypt', async ({ page }) => {
		await page.goto(HTML_PATH);
		const fileContent = 'binary file content for hex key test';

		await page.locator('#btn-encrypt').click();
		await page.locator('#tab-file').click();
		await page.locator('#file-picker').setInputFiles({
			name: 'data.bin',
			mimeType: 'application/octet-stream',
			buffer: Buffer.from(fileContent),
		});
		await fillHexKey(page, HEX_KEY_A);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'ENCRYPT');

		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.locator('#btn-dl-file').click(),
		]);
		const dlPath = await download.path();

		await page.locator('#btn-decrypt').click();
		await page.locator('#tab-file').click();
		await page.locator('#file-picker').setInputFiles(dlPath!);
		await fillHexKey(page, HEX_KEY_A);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		const [decDownload] = await Promise.all([
			page.waitForEvent('download'),
			page.locator('#btn-dl-dec').click(),
		]);
		const decPath = await decDownload.path();
		const { readFileSync } = await import('node:fs');
		const decrypted = readFileSync(decPath!);
		expect(decrypted.toString()).toBe(fileContent);
	});
});

// ── Cipher suite coverage ─────────────────────────────────────

const CIPHERS: { name: 'serpent' | 'chacha' | 'aes'; byte: number; label: string }[] = [
	{ name: 'serpent', byte: 0x01, label: 'Serpent-256-CBC + HMAC-SHA256' },
	{ name: 'chacha',  byte: 0x02, label: 'XChaCha20-Poly1305' },
	{ name: 'aes',     byte: 0x03, label: 'AES-256-GCM-SIV' },
];

test.describe('Cipher selector: encrypt/decrypt all three ciphers', () => {
	for (const c of CIPHERS) {
		test(`${c.label}: passphrase round-trip`, async ({ page }) => {
			await page.goto(HTML_PATH);
			const plaintext = `${c.label} passphrase round-trip`;

			await page.locator('#btn-encrypt').click();
			await selectCipher(page, c.name);
			await page.locator('#pp-input').fill('correct horse battery staple');
			const armored = await encryptText(page, plaintext);

			const bytes = await decodeBlobBytes(page, armored);
			expect(bytes[6]).toBe(c.byte);   // OFF_CIPHER = 6
			expect(bytes[7]).toBe(0x01);     // OFF_KDF = 7, KDF_SCRYPT

			await page.locator('#btn-decrypt').click();
			await page.locator('#pp-input').fill('correct horse battery staple');
			const decrypted = await decryptText(page, armored);
			expect(decrypted).toBe(plaintext);
		});

		test(`${c.label}: keyfile round-trip`, async ({ page }) => {
			await page.goto(HTML_PATH);
			const plaintext = `${c.label} keyfile round-trip`;

			await page.locator('#btn-encrypt').click();
			await selectCipher(page, c.name);
			await fillHexKey(page, HEX_KEY_A);
			const armored = await encryptText(page, plaintext);

			const bytes = await decodeBlobBytes(page, armored);
			expect(bytes[6]).toBe(c.byte);   // OFF_CIPHER = 6
			expect(bytes[7]).toBe(0x02);     // OFF_KDF = 7, KDF_KEYFILE

			await page.locator('#btn-decrypt').click();
			await fillHexKey(page, HEX_KEY_A);
			const decrypted = await decryptText(page, armored);
			expect(decrypted).toBe(plaintext);
		});
	}

	test('decrypt auto-detects cipher from header (no UI selection needed)', async ({ page }) => {
		await page.goto(HTML_PATH);

		// Encrypt with ChaCha
		await page.locator('#btn-encrypt').click();
		await selectCipher(page, 'chacha');
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'auto-detect cipher test');

		// Switch to decrypt, where the cipher selector is hidden in decrypt mode, so
		// the only signal is the cipher byte at offset 9 of the header.
		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe('auto-detect cipher test');
	});
});

// ── Format verification ───────────────────────────────────────

test.describe('LVTHN v3 binary format verification', () => {
	test('KDF byte is 0x01 (scrypt) for passphrase encryption', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await page.locator('#pp-input').fill('passphrase-format-test!!');
		const armored = await encryptText(page, 'kdf byte test');

		const bytes = await decodeBlobBytes(page, armored);
		expect(bytes[7]).toBe(0x01); // OFF_KDF = 7
	});

	test('KDF byte is 0x02 (keyfile) for keyfile encryption', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'kdf byte test');

		const bytes = await decodeBlobBytes(page, armored);
		expect(bytes[7]).toBe(0x02);
	});

	test('magic bytes "LVTHN" and version 0x03 at expected offsets', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'format header test');

		const bytes = await decodeBlobBytes(page, armored);
		// MAGIC: "LVTHN", bytes 0x4c 0x56 0x54 0x48 0x4e
		expect(bytes[0]).toBe(0x4c); // L
		expect(bytes[1]).toBe(0x56); // V
		expect(bytes[2]).toBe(0x54); // T
		expect(bytes[3]).toBe(0x48); // H
		expect(bytes[4]).toBe(0x4e); // N
		// VERSION at offset 5
		expect(bytes[5]).toBe(0x03);
		// FLAGS at offset 8, reserved, must be 0x00
		expect(bytes[8]).toBe(0x00);
	});

	test('salt at offset 9-40 is zeroed for keyfile mode', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'zero salt test');

		const bytes = await decodeBlobBytes(page, armored);
		const salt = bytes.slice(9, 41);
		expect(salt.every(b => b === 0)).toBe(true);
	});

	test('salt at offset 9-40 is non-zero for passphrase mode', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await page.locator('#pp-input').fill('salt-test-passphrase!!!');
		const armored = await encryptText(page, 'non-zero salt test');

		const bytes = await decodeBlobBytes(page, armored);
		const salt = bytes.slice(9, 41);
		expect(salt.some(b => b !== 0)).toBe(true);
	});

	test('different nonce each encryption with same key', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored1 = await encryptText(page, 'nonce freshness test');

		await page.locator('#btn-decrypt').click();
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored2 = await encryptText(page, 'nonce freshness test');

		expect(armored1).not.toBe(armored2);
	});
});
