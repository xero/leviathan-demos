/**
 * interop.test.ts: Cross-tool round-trips between the web demo and the lvthn CLI.
 *
 * One direction: feed CLI-produced .lvthn fixtures into the web's decrypt path
 * and check the recovered plaintext. Fixtures under test/fixtures/ cover all
 * three ciphers × both KDF modes. They are byte-for-byte CLI output; regenerate
 * them by running:
 *
 *     cd ../cli
 *     for c in serpent chacha aes; do
 *       bun run src/main.ts encrypt -p fixture-pass --cipher $c plaintext.txt \
 *         -o ../web/test/fixtures/$c-pass.lvthn -f
 *       bun run src/main.ts encrypt -k key.bin --cipher $c plaintext.txt \
 *         -o ../web/test/fixtures/$c-key.lvthn -f
 *     done
 *
 * Other direction: encrypt in the web UI, download the binary, then shell out
 * to `bun run ../cli/src/main.ts decrypt ...` and compare the recovered plaintext.
 */

import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HTML_PATH       = `file://${resolve(process.cwd(), 'dist/index.html')}`;
const FIXTURES_DIR    = resolve(process.cwd(), 'test/fixtures');
const CLI_ENTRY       = resolve(process.cwd(), '../cli/src/main.ts');
const CLI_PLAINTEXT   = 'interop fixture plaintext: leviathan crosses tools\n';
const CLI_PASSPHRASE  = 'fixture-pass';
const CLI_KEYFILE_HEX = Buffer.from('0123456789abcdef0123456789abcdef').toString('hex');

async function waitForAction(page: Page, mode: 'ENCRYPT' | 'DECRYPT') {
	await page.waitForFunction(
		(m: string) => document.getElementById('action-btn')?.textContent === m,
		mode,
		{ timeout: 30000 },
	);
}

async function fillHexKey(page: Page, hex: string) {
	await page.locator('#lbl-kf').click();
	await page.locator('#kf-tab-hex').click();
	await page.locator('#kf-hex-input').fill(hex);
}

const CIPHERS = ['serpent', 'chacha', 'aes'] as const;

// ── CLI → web ─────────────────────────────────────────────────

test.describe('CLI → web: decrypt CLI-produced fixtures', () => {
	for (const c of CIPHERS) {
		test(`${c}: passphrase fixture decrypts in the web`, async ({ page }) => {
			await page.goto(HTML_PATH);
			const fixture = readFileSync(`${FIXTURES_DIR}/${c}-pass.lvthn`);

			await page.locator('#btn-decrypt').click();
			await page.locator('#tab-file').click();
			await page.locator('#file-picker').setInputFiles({
				name: `${c}-pass.lvthn`,
				mimeType: 'application/octet-stream',
				buffer: fixture,
			});
			await page.locator('#pp-input').fill(CLI_PASSPHRASE);
			await page.locator('#action-btn').click();
			await waitForAction(page, 'DECRYPT');

			const [download] = await Promise.all([
				page.waitForEvent('download'),
				page.locator('#btn-dl-dec').click(),
			]);
			const dlPath = await download.path();
			const decrypted = readFileSync(dlPath!);
			expect(decrypted.toString()).toBe(CLI_PLAINTEXT);
		});

		test(`${c}: keyfile fixture decrypts in the web`, async ({ page }) => {
			await page.goto(HTML_PATH);
			const fixture = readFileSync(`${FIXTURES_DIR}/${c}-key.lvthn`);

			await page.locator('#btn-decrypt').click();
			await page.locator('#tab-file').click();
			await page.locator('#file-picker').setInputFiles({
				name: `${c}-key.lvthn`,
				mimeType: 'application/octet-stream',
				buffer: fixture,
			});
			await fillHexKey(page, CLI_KEYFILE_HEX);
			await page.locator('#action-btn').click();
			await waitForAction(page, 'DECRYPT');

			const [download] = await Promise.all([
				page.waitForEvent('download'),
				page.locator('#btn-dl-dec').click(),
			]);
			const dlPath = await download.path();
			const decrypted = readFileSync(dlPath!);
			expect(decrypted.toString()).toBe(CLI_PLAINTEXT);
		});
	}
});

// ── web → CLI ─────────────────────────────────────────────────

test.describe('web → CLI: CLI decrypts web-produced files', () => {
	for (const c of CIPHERS) {
		test(`${c}: web passphrase encryption decrypts in CLI`, async ({ page }, testInfo) => {
			await page.goto(HTML_PATH);
			const plaintext = `${c} web→CLI passphrase test\n`;
			const passphrase = 'web-to-cli-pass';

			await page.locator('#btn-encrypt').click();
			await page.locator(`#lbl-cipher-${c}`).click();
			await page.locator('#tab-file').click();
			await page.locator('#file-picker').setInputFiles({
				name: 'plain.txt',
				mimeType: 'text/plain',
				buffer: Buffer.from(plaintext),
			});
			await page.locator('#pp-input').fill(passphrase);
			await page.locator('#action-btn').click();
			await waitForAction(page, 'ENCRYPT');

			const [download] = await Promise.all([
				page.waitForEvent('download'),
				page.locator('#btn-dl-file').click(),
			]);
			const encPath = await download.path();

			const recoveredPath = testInfo.outputPath(`${c}-pass-recovered.txt`);
			execFileSync('bun', [
				'run', CLI_ENTRY,
				'decrypt', '-p', passphrase, '-f',
				encPath!, '-o', recoveredPath,
			]);
			expect(readFileSync(recoveredPath, 'utf-8')).toBe(plaintext);
		});

		test(`${c}: web keyfile encryption decrypts in CLI`, async ({ page }, testInfo) => {
			await page.goto(HTML_PATH);
			const plaintext = `${c} web→CLI keyfile test\n`;
			const keyHex = 'fedcba9876543210'.repeat(4); // 32 bytes
			const keyBuf = Buffer.from(keyHex, 'hex');

			await page.locator('#btn-encrypt').click();
			await page.locator(`#lbl-cipher-${c}`).click();
			await page.locator('#tab-file').click();
			await page.locator('#file-picker').setInputFiles({
				name: 'plain.txt',
				mimeType: 'text/plain',
				buffer: Buffer.from(plaintext),
			});
			await fillHexKey(page, keyHex);
			await page.locator('#action-btn').click();
			await waitForAction(page, 'ENCRYPT');

			const [download] = await Promise.all([
				page.waitForEvent('download'),
				page.locator('#btn-dl-file').click(),
			]);
			const encPath = await download.path();

			const keyPath = testInfo.outputPath(`${c}-key.bin`);
			const { writeFileSync } = await import('node:fs');
			writeFileSync(keyPath, keyBuf);

			const recoveredPath = testInfo.outputPath(`${c}-key-recovered.txt`);
			execFileSync('bun', [
				'run', CLI_ENTRY,
				'decrypt', '-k', keyPath, '-f',
				encPath!, '-o', recoveredPath,
			]);
			expect(readFileSync(recoveredPath, 'utf-8')).toBe(plaintext);
		});
	}
});
