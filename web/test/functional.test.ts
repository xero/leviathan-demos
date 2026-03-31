/**
 * functional.test.ts — Functional crypto tests for lvthn.html
 *
 * Covers key-based encrypt/decrypt round-trips, error paths,
 * KDF mismatch detection, file-input flows, and format verification.
 *
 * Run with: bunx playwright test
 */

import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const HTML_PATH = `file://${resolve(process.cwd(), 'dist/index.html')}`;

// 64-byte hex key (128 hex chars)
const HEX_KEY_A = 'a'.repeat(128);
// different 64-byte hex key
const HEX_KEY_B = 'b'.repeat(128);
// short key (16 bytes = 32 hex chars) — HKDF expands to 64
const HEX_KEY_SHORT = 'cc'.repeat(16);

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

		// Generate key + encrypt
		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const keyHex = await page.locator('#key-hex').inputValue();
		const armored = await encryptText(page, plaintext);

		// Switch to decrypt, paste armored, enter same key as hex
		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, keyHex);
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe(plaintext);
	});

	test('wrong hex key → authentication failure', async ({ page }) => {
		await page.goto(HTML_PATH);

		// Generate key + encrypt
		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const armored = await encryptText(page, 'secret data');

		// Decrypt with completely different key
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

		// Encrypt
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, plaintext);

		// Decrypt
		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe(plaintext);
	});

	test('short hex key works via HKDF expansion', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'short key HKDF test';

		// Encrypt with 16-byte key (HKDF expands to 64)
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_SHORT);
		const armored = await encryptText(page, plaintext);

		// Decrypt with same short key
		await page.locator('#btn-decrypt').click();
		await fillHexKey(page, HEX_KEY_SHORT);
		const decrypted = await decryptText(page, armored);
		expect(decrypted).toBe(plaintext);
	});

	test('wrong hex key → authentication failure', async ({ page }) => {
		await page.goto(HTML_PATH);

		// Encrypt with key A
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'hex key mismatch test');

		// Decrypt with key B
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
	const keyBuffer = Buffer.alloc(64, 0xab);

	test('encrypt and decrypt with same uploaded keyfile', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'keyfile upload round-trip';

		// Encrypt with uploaded keyfile
		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'test.key',
			mimeType: 'application/octet-stream',
			buffer: keyBuffer,
		});
		const armored = await encryptText(page, plaintext);

		// Decrypt with same keyfile
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
		const wrongKeyBuffer = Buffer.alloc(64, 0xcd);

		// Encrypt with key A
		await page.locator('#btn-encrypt').click();
		await page.locator('#lbl-kf').click();
		await page.locator('#kf-picker').setInputFiles({
			name: 'real.key',
			mimeType: 'application/octet-stream',
			buffer: keyBuffer,
		});
		const armored = await encryptText(page, 'wrong keyfile test');

		// Decrypt with different key
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
});

// ── KDF mismatch detection ────────────────────────────────────

test.describe('KDF mismatch detection', () => {
	test('passphrase-encrypted data requires passphrase to decrypt', async ({ page }) => {
		await page.goto(HTML_PATH);

		// Encrypt with passphrase
		await page.locator('#btn-encrypt').click();
		await page.locator('#pp-input').fill('correct horse battery staple');
		const armored = await encryptText(page, 'passphrase-only content');

		// Reload for clean state (passphrase persists across mode switch otherwise)
		await page.goto(HTML_PATH);

		// Decrypt with keyfile mode — blob says KDF_ARGON2ID but no passphrase set
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

		// Encrypt with hex key
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'keyfile-only content');

		// Reload for clean state (keyfileData persists across mode switch otherwise)
		await page.goto(HTML_PATH);

		// Decrypt with passphrase mode — blob says KDF_KEYFILE but no keyfile set
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

		// Encrypt file with passphrase
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

		// Download encrypted file
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.locator('#btn-dl-file').click(),
		]);
		const dlPath = await download.path();
		expect(dlPath).toBeTruthy();

		// Switch to decrypt, upload encrypted file
		await page.locator('#btn-decrypt').click();
		await page.locator('#tab-file').click();
		await page.locator('#file-picker').setInputFiles(dlPath!);
		await page.locator('#pp-input').fill(passphrase);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		// File decrypt shows a download button (not a textarea)
		const dlBtn = page.locator('#btn-dl-dec');
		await expect(dlBtn).toBeVisible();

		// Download decrypted and compare
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

		// Encrypt file with hex key
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

		// Download encrypted file
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.locator('#btn-dl-file').click(),
		]);
		const dlPath = await download.path();

		// Switch to decrypt, upload encrypted file, enter same key
		await page.locator('#btn-decrypt').click();
		await page.locator('#tab-file').click();
		await page.locator('#file-picker').setInputFiles(dlPath!);
		await fillHexKey(page, HEX_KEY_A);
		await page.locator('#action-btn').click();
		await waitForAction(page, 'DECRYPT');

		// Download decrypted and compare
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

// ── Format verification ───────────────────────────────────────

test.describe('Binary format verification', () => {
	test('KDF byte is 0x03 for passphrase encryption', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await page.locator('#pp-input').fill('passphrase-format-test!!');
		const armored = await encryptText(page, 'kdf byte test');

		const bytes = await decodeBlobBytes(page, armored);
		expect(bytes[5]).toBe(0x03); // KDF_ARGON2ID
	});

	test('KDF byte is 0x02 for keyfile encryption', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'kdf byte test');

		const bytes = await decodeBlobBytes(page, armored);
		expect(bytes[5]).toBe(0x02); // KDF_KEYFILE
	});

	test('magic bytes and version are correct', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'format header test');

		const bytes = await decodeBlobBytes(page, armored);
		// MAGIC: "LVWB"
		expect(bytes[0]).toBe(0x4c); // L
		expect(bytes[1]).toBe(0x56); // V
		expect(bytes[2]).toBe(0x57); // W
		expect(bytes[3]).toBe(0x42); // B
		// VERSION: 0x02
		expect(bytes[4]).toBe(0x02);
	});

	test('salt is zeroed for keyfile mode', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored = await encryptText(page, 'zero salt test');

		const bytes = await decodeBlobBytes(page, armored);
		// Bytes 6-37 (32 bytes) should be zero for keyfile mode
		const salt = bytes.slice(6, 38);
		expect(salt.every(b => b === 0)).toBe(true);
	});

	test('salt is non-zero for passphrase mode', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#btn-encrypt').click();
		await page.locator('#pp-input').fill('salt-test-passphrase!!!');
		const armored = await encryptText(page, 'non-zero salt test');

		const bytes = await decodeBlobBytes(page, armored);
		const salt = bytes.slice(6, 38);
		expect(salt.some(b => b !== 0)).toBe(true);
	});

	test('different IV each encryption with same key', async ({ page }) => {
		await page.goto(HTML_PATH);

		// First encryption
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored1 = await encryptText(page, 'iv freshness test');

		// Reset and encrypt again with same key + plaintext
		await page.locator('#btn-decrypt').click();
		await page.locator('#btn-encrypt').click();
		await fillHexKey(page, HEX_KEY_A);
		const armored2 = await encryptText(page, 'iv freshness test');

		// Armored outputs should differ (different IV)
		expect(armored1).not.toBe(armored2);
	});
});
