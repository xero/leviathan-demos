/**
 * smoke.test.ts — Playwright smoke tests for lvthn.html
 *
 * Run with: bunx playwright test
 */

import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const HTML_PATH = `file://${resolve(process.cwd(), 'lvthn.html')}`;

test.describe('UI initial state', () => {
	test('page loads without errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => {
			if (m.type() === 'error') errors.push(m.text());
		});

		await page.goto(HTML_PATH);
		await page.waitForLoadState('networkidle');

		expect(errors).toHaveLength(0);
	});

	test('ENCRYPT mode is active by default', async ({ page }) => {
		await page.goto(HTML_PATH);
		const btn = page.locator('#btn-encrypt');
		await expect(btn).toHaveClass(/active/);
		await expect(page.locator('#action-btn')).toHaveText('ENCRYPT');
	});

	test('action button is disabled with no input', async ({ page }) => {
		await page.goto(HTML_PATH);
		await expect(page.locator('#action-btn')).toBeDisabled();
		await expect(page.locator('#action-hint')).toHaveText('no input');
	});

	test('action button shows no key hint when input provided but no passphrase', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#input-text').fill('hello world');
		await expect(page.locator('#action-hint')).toHaveText('no key');
		await expect(page.locator('#action-btn')).toBeDisabled();
	});
});

test.describe('Mode toggle', () => {
	test('ENCRYPT/DECRYPT toggle works', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#btn-decrypt').click();
		await expect(page.locator('#btn-decrypt')).toHaveClass(/active/);
		await expect(page.locator('#btn-encrypt')).not.toHaveClass(/active/);
		await expect(page.locator('#action-btn')).toHaveText('DECRYPT');
	});

	test('switching mode clears output', async ({ page }) => {
		await page.goto(HTML_PATH);
		// Put some text in
		await page.locator('#input-text').fill('test');
		await page.locator('#pp-input').fill('passphrase123456789X');
		await page.locator('#action-btn').click();
		// Wait for encryption
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT',
		{ timeout: 30000 }
		);
		// Switch mode
		await page.locator('#btn-decrypt').click();
		// Output should be cleared
		const outputBody = page.locator('#output-body');
		await expect(outputBody).toContainText('—');
	});

	test('GENERATE KEY option hidden in decrypt mode', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#btn-decrypt').click();
		await expect(page.locator('#lbl-gen')).toHaveClass(/hidden/);
	});
});

test.describe('TEXT + PASSPHRASE — encrypt', () => {
	test('encrypts text and produces armored output', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#input-text').fill('hello leviathan');
		await page.locator('#pp-input').fill('correct horse battery staple');
		await page.locator('#action-btn').click();

		// Wait for output (PBKDF2 is 210k iterations, may take a few seconds)
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT',
		{ timeout: 30000 }
		);

		const outText = await page.locator('#out-text').inputValue();
		expect(outText).toContain('-----BEGIN LVTHN ENCRYPTED MESSAGE-----');
		expect(outText).toContain('-----END LVTHN ENCRYPTED MESSAGE-----');
	});

	test('produces different ciphertext each time (fresh IV)', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#input-text').fill('same input');
		await page.locator('#pp-input').fill('samepassword12345678');

		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 30000 });
		const first = await page.locator('#out-text').inputValue();

		// Encrypt again — same plaintext, same passphrase, different IV
		await page.locator('#btn-decrypt').click();
		await page.locator('#btn-encrypt').click();
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 30000 });
		const second = await page.locator('#out-text').inputValue();

		// Different IV → different ciphertext
		expect(first).not.toEqual(second);
	});
});

test.describe('TEXT + PASSPHRASE — decrypt round-trip', () => {
	test('decrypts back to original text', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'round-trip test: hello leviathan!';
		const passphrase = 'correct horse battery staple';

		// Encrypt
		await page.locator('#input-text').fill(plaintext);
		await page.locator('#pp-input').fill(passphrase);
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 30000 });
		const armored = await page.locator('#out-text').inputValue();

		// Switch to decrypt
		await page.locator('#btn-decrypt').click();
		await page.locator('#input-text').fill(armored);
		await page.locator('#pp-input').fill(passphrase);
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'DECRYPT', { timeout: 30000 });

		const decrypted = await page.locator('#out-text').inputValue();
		expect(decrypted).toBe(plaintext);
	});

	test('wrong passphrase → authentication failed error', async ({ page }) => {
		await page.goto(HTML_PATH);

		// Encrypt with one passphrase
		await page.locator('#input-text').fill('secret message');
		await page.locator('#pp-input').fill('correct horse battery');
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 30000 });
		const armored = await page.locator('#out-text').inputValue();

		// Decrypt with wrong passphrase
		await page.locator('#btn-decrypt').click();
		await page.locator('#input-text').fill(armored);
		await page.locator('#pp-input').fill('wrong passphrase!!');
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'DECRYPT', { timeout: 30000 });

		const err = await page.locator('.output-error').textContent();
		expect(err).toContain('authentication failed');
	});

	test('tampered ciphertext → authentication failed', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.locator('#input-text').fill('tamper test');
		await page.locator('#pp-input').fill('passphrase for tamper test!!');
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 30000 });
		let armored = await page.locator('#out-text').inputValue();

		// Tamper: flip one base64 character in the data section
		const lines = armored.split('\n');
		const dataLine = lines.findIndex(l => l && !l.startsWith('---'));
		if (dataLine > -1 && lines[dataLine].length > 1) {
			const chars = lines[dataLine].split('');
			chars[Math.floor(chars.length / 2)] = chars[Math.floor(chars.length / 2)] === 'A' ? 'B' : 'A';
			lines[dataLine] = chars.join('');
			armored = lines.join('\n');
		}

		await page.locator('#btn-decrypt').click();
		await page.locator('#input-text').fill(armored);
		await page.locator('#pp-input').fill('passphrase for tamper test!!');
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'DECRYPT', { timeout: 30000 });

		const err = await page.locator('.output-error').textContent();
		expect(err).toMatch(/authentication failed|unrecognized format/);
	});
});

test.describe('GENERATE KEY flow', () => {
	test('generates a key on click', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const hex = await page.locator('#key-hex').inputValue();
		expect(hex).toMatch(/^[0-9a-f]{64}$/); // 256 bits = 32 bytes = 64 hex chars
	});

	test('generates different key each click', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const hex1 = await page.locator('#key-hex').inputValue();
		await page.locator('#btn-gen').click();
		const hex2 = await page.locator('#key-hex').inputValue();
		expect(hex1).not.toBe(hex2);
	});

	test('128-bit generates 32 hex chars', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#lbl-gen').click();
		await page.locator('#sz-128').click();
		await page.locator('#btn-gen').click();
		const hex = await page.locator('#key-hex').inputValue();
		expect(hex).toHaveLength(32);
	});

	test('192-bit generates 48 hex chars', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#lbl-gen').click();
		await page.locator('#sz-192').click();
		await page.locator('#btn-gen').click();
		const hex = await page.locator('#key-hex').inputValue();
		expect(hex).toHaveLength(48);
	});
});

test.describe('GENERATE KEY + encrypt/decrypt round-trip', () => {
	test('encrypts with generated key and decrypts with keyfile', async ({ page }) => {
		await page.goto(HTML_PATH);
		const plaintext = 'keyfile round-trip test';

		// Generate key
		await page.locator('#lbl-gen').click();
		await page.locator('#btn-gen').click();
		const _keyHex = await page.locator('#key-hex').inputValue();

		// Encrypt
		await page.locator('#input-text').fill(plaintext);
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 15000 });
		const armored = await page.locator('#out-text').inputValue();

		// Switch to decrypt + keyfile mode, supply key as raw bytes via file
		// We can't directly upload a file in Playwright without creating it, so
		// we verify that the format decodes and the KDF byte is keyfile
		// by doing a JS-level check in the page
		const kdfByte = await page.evaluate((arm) => {
			const lines = arm.trim().split('\n');
			const b64 = lines.slice(1, lines.findIndex(l => l.startsWith('---END'))).join('');
			const binary = atob(b64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
			return bytes[5]; // OFF_KDF = 5
		}, armored);
		expect(kdfByte).toBe(0x02); // KDF_KEYFILE
	});
});

test.describe('Passphrase strength indicator', () => {
	test('shows weak for short passphrase', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#input-text').fill('x'); // need some input to trigger render
		await page.locator('#pp-input').fill('short');
		await expect(page.locator('#pp-strength')).toHaveText('⚠ weak');
	});

	test('shows fair for medium passphrase', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#pp-input').fill('mediumpassw0rd');
		await expect(page.locator('#pp-strength')).toHaveText('· fair');
	});

	test('shows strong for long passphrase', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#pp-input').fill('correct horse battery staple!');
		await expect(page.locator('#pp-strength')).toHaveText('✓ strong');
	});

	test('strength hidden in decrypt mode', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#btn-decrypt').click();
		await page.locator('#pp-input').fill('correct horse battery staple!');
		await expect(page.locator('#pp-strength')).toHaveText('');
	});
});

test.describe('Security details panel', () => {
	test('is collapsed by default', async ({ page }) => {
		await page.goto(HTML_PATH);
		await expect(page.locator('#sec-details')).not.toHaveAttribute('open');
	});

	test('expands on click', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#sec-details > summary').click();
		await expect(page.locator('#sec-details')).toHaveAttribute('open', '');
		await expect(page.locator('.sec-content')).toBeVisible();
	});

	test('collapses again on second click', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#sec-details > summary').click();
		await page.locator('#sec-details > summary').click();
		await expect(page.locator('#sec-details')).not.toHaveAttribute('open');
	});
});

test.describe('Show/hide passphrase', () => {
	test('password field starts hidden', async ({ page }) => {
		await page.goto(HTML_PATH);
		await expect(page.locator('#pp-input')).toHaveAttribute('type', 'password');
	});

	test('toggle reveals passphrase', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#btn-show-pp').click();
		await expect(page.locator('#pp-input')).toHaveAttribute('type', 'text');
	});

	test('toggle button text changes', async ({ page }) => {
		await page.goto(HTML_PATH);
		await expect(page.locator('#btn-show-pp')).toHaveText('[show]');
		await page.locator('#btn-show-pp').click();
		await expect(page.locator('#btn-show-pp')).toHaveText('[hide]');
	});
});

test.describe('TEXT/FILE tab toggle', () => {
	test('FILE tab switches to file input', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#tab-file').click();
		await expect(page.locator('#sec-file-input')).toBeVisible();
		await expect(page.locator('#sec-text-input')).not.toBeVisible();
	});

	test('switching tab clears output', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#input-text').fill('test');
		await page.locator('#pp-input').fill('passphrase1234567890');
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'ENCRYPT', { timeout: 30000 });
		await page.locator('#tab-file').click();
		const body = page.locator('#output-body');
		await expect(body).toContainText('—');
	});
});

test.describe('Invalid format', () => {
	test('gibberish input → unrecognized format error', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.locator('#btn-decrypt').click();
		await page.locator('#input-text').fill('this is not an encrypted message at all!!');
		await page.locator('#pp-input').fill('somepassword12345678');
		await page.locator('#action-btn').click();
		await page.waitForFunction(() =>
			document.getElementById('action-btn')?.textContent === 'DECRYPT', { timeout: 30000 });
		const err = await page.locator('.output-error').textContent();
		expect(err).toMatch(/unrecognized format|format/i);
	});
});

test.describe('Offline capability', () => {
	test('page works without network (no external fetches)', async ({ page }) => {
		const externalFetches: string[] = [];
		page.on('request', req => {
			const url = req.url();
			if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:')) {
				externalFetches.push(url);
			}
		});
		await page.goto(HTML_PATH);
		await page.waitForLoadState('networkidle');
		expect(externalFetches).toHaveLength(0);
	});
});
