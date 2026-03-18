/**
 * smoke.test.ts — Playwright end-to-end tests for lvthn-chat
 *
 * Tests the full two-party encrypted chat flow:
 *   - Key generation and WebSocket connection
 *   - X25519 key exchange via relay server
 *   - XChaCha20-Poly1305 encrypted messaging
 *   - Crypto inspector field population
 *   - Replay attack detection
 *   - Peer disconnection handling
 *
 * Requires the relay server to be running (handled by playwright.config.ts webServer).
 *
 * Run: bunx playwright test
 * Run (headed): HEADED=1 bunx playwright test
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { resolve } from 'node:path';

const HTML_PATH = `file://${resolve(process.cwd(), 'client/lvthn-chat.html')}`;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Connect Alice or Bob: fill name, optionally fill room code, click connect. */
async function connectClient(
	page: Page,
	name: string,
	roomCode?: string,
) {
	await page.goto(HTML_PATH);
	await page.waitForLoadState('domcontentloaded');
	await page.fill('#inp-name', name);

	if (roomCode) {
		await page.click('#mode-join');
		await page.fill('#inp-code', roomCode);
	}

	await page.click('#btn-connect');
}

/** Wait until phase-chat is visible (key exchange complete). */
async function waitForChat(page: Page, timeout = 15_000) {
	await expect(page.locator('#phase-chat')).not.toHaveAttribute('hidden', { timeout });
}

/** Get room code from Alice's setup panel. */
async function getRoomCode(page: Page): Promise<string> {
	const el = page.locator('#room-code-display');
	await expect(el).not.toBeEmpty({ timeout: 5_000 });
	return (await el.textContent())!.trim();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Setup phase', () => {
	test('page loads without console errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => {
			if (m.type() === 'error') errors.push(m.text());
		});

		await page.goto(HTML_PATH);
		await page.waitForLoadState('domcontentloaded');

		expect(errors).toHaveLength(0);
	});

	test('setup phase is visible on load', async ({ page }) => {
		await page.goto(HTML_PATH);
		await expect(page.locator('#phase-setup')).not.toHaveAttribute('hidden');
		await expect(page.locator('#phase-exchange')).toHaveAttribute('hidden', '');
		await expect(page.locator('#phase-chat')).toHaveAttribute('hidden', '');
	});

	test('join code input is hidden initially, shown when join mode selected', async ({ page }) => {
		await page.goto(HTML_PATH);
		await expect(page.locator('#join-code-row')).toHaveAttribute('hidden', '');
		await page.click('#mode-join');
		await expect(page.locator('#join-code-row')).not.toHaveAttribute('hidden');
	});

	test('keypair panel shows public key and protects private key after connecting', async ({ page }) => {
		await page.goto(HTML_PATH);

		await page.fill('#inp-name', 'alice');
		await page.click('#btn-connect');
		await getRoomCode(page);  // wait for connection

		// Public key is populated as 64 hex chars
		const pubKey = await page.locator('#pub-key-display').textContent();
		expect(pubKey).toMatch(/^[0-9a-f]{64}$/);

		// Private key is never exposed — SubtleCrypto non-extractable key
		const privKeyText = await page.locator('.keypair-panel').textContent();
		expect(privKeyText).toContain('protected by SubtleCrypto');
		expect(privKeyText).not.toMatch(/^[0-9a-f]{64}$/);
	});

	test('public key is displayed after connecting', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.fill('#inp-name', 'alice');
		await page.click('#btn-connect');
		await getRoomCode(page);

		const pk = await page.locator('#pub-key-display').textContent();
		expect(pk).toMatch(/^[0-9a-f]{64}$/);
	});

	test('room code is displayed after starting a new session', async ({ page }) => {
		await page.goto(HTML_PATH);
		await page.fill('#inp-name', 'alice');
		await page.click('#btn-connect');

		const code = await getRoomCode(page);
		expect(code).toMatch(/^[A-Z2-9]{6}$/);
	});
});

test.describe('Key exchange', () => {
	test('both clients advance to Phase 3 after exchange', async ({ browser }) => {
		const aliceCtx = await browser.newContext();
		const bobCtx   = await browser.newContext();
		const alice    = await aliceCtx.newPage();
		const bob      = await bobCtx.newPage();

		try {
			await connectClient(alice, 'alice');
			const code = await getRoomCode(alice);

			await connectClient(bob, 'bob', code);

			await waitForChat(alice);
			await waitForChat(bob);

			// Both should be in the chat phase
			await expect(alice.locator('.chat-header-badge')).toContainText('E2E encrypted');
			await expect(bob.locator('.chat-header-badge')).toContainText('E2E encrypted');
		} finally {
			await aliceCtx.close();
			await bobCtx.close();
		}
	});

	test('room code shown in chat header', async ({ browser }) => {
		const aliceCtx = await browser.newContext();
		const bobCtx   = await browser.newContext();
		const alice    = await aliceCtx.newPage();
		const bob      = await bobCtx.newPage();

		try {
			await connectClient(alice, 'alice');
			const code = await getRoomCode(alice);

			await connectClient(bob, 'bob', code);
			await waitForChat(alice);
			await waitForChat(bob);

			await expect(alice.locator('#chat-room-code')).toHaveText(code);
			await expect(bob.locator('#chat-room-code')).toHaveText(code);
		} finally {
			await aliceCtx.close();
			await bobCtx.close();
		}
	});

	test('exchange checklist shows all four steps done', async ({ browser }) => {
		const aliceCtx = await browser.newContext();
		const bobCtx   = await browser.newContext();
		const alice    = await aliceCtx.newPage();
		const bob      = await bobCtx.newPage();

		try {
			await connectClient(alice, 'alice');
			const code = await getRoomCode(alice);
			await connectClient(bob, 'bob', code);

			// Wait for exchange phase to appear on alice (before she advances to chat)
			// Since exchange auto-advances after 1.5s we need to observe it briefly.
			// We'll observe the exchange phase on bob before it transitions.
			await expect(bob.locator('#phase-exchange')).not.toHaveAttribute('hidden', { timeout: 10_000 });

			// All four steps should become 'done' on Bob's exchange panel
			await expect(bob.locator('#exc-step-4')).toHaveClass(/done/, { timeout: 10_000 });
		} finally {
			await aliceCtx.close();
			await bobCtx.close();
		}
	});

	test('third client is rejected with error', async ({ browser }) => {
		const ctx1 = await browser.newContext();
		const ctx2 = await browser.newContext();
		const ctx3 = await browser.newContext();
		const p1   = await ctx1.newPage();
		const p2   = await ctx2.newPage();
		const p3   = await ctx3.newPage();

		try {
			await connectClient(p1, 'alice');
			const code = await getRoomCode(p1);
			await connectClient(p2, 'bob', code);
			await waitForChat(p1);

			// Third client tries to join
			await connectClient(p3, 'charlie', code);
			await expect(p3.locator('#setup-status')).toContainText('full', { timeout: 5_000 });
		} finally {
			await ctx1.close();
			await ctx2.close();
			await ctx3.close();
		}
	});
});

test.describe('Encrypted messaging', () => {
	// Shared fixture: alice and bob in a chat session
	let aliceCtx: Awaited<ReturnType<Browser['newContext']>>;
	let bobCtx:   Awaited<ReturnType<Browser['newContext']>>;
	let alice:    Page;
	let bob:      Page;

	test.beforeEach(async ({ browser }) => {
		aliceCtx = await browser.newContext();
		bobCtx   = await browser.newContext();
		alice    = await aliceCtx.newPage();
		bob      = await bobCtx.newPage();

		await connectClient(alice, 'alice');
		const code = await getRoomCode(alice);
		await connectClient(bob, 'bob', code);
		await waitForChat(alice);
		await waitForChat(bob);
	});

	test.afterEach(async () => {
		await aliceCtx.close();
		await bobCtx.close();
	});

	test('alice sends a message — bob receives and decrypts it', async () => {
		await alice.fill('#inp-message', 'hello bob');
		await alice.press('#inp-message', 'Enter');

		// Bob should see the message
		await expect(bob.locator('.msg:not(.msg-own) .msg-text')).toContainText('hello bob', { timeout: 5_000 });
		// Alice should see her own sent message
		await expect(alice.locator('.msg-own .msg-text')).toContainText('hello bob');
	});

	test('bob sends a message — alice receives and decrypts it', async () => {
		await bob.fill('#inp-message', 'hey alice!');
		await bob.press('#inp-message', 'Enter');

		await expect(alice.locator('.msg:not(.msg-own) .msg-text')).toContainText('hey alice!', { timeout: 5_000 });
	});

	test('sender name appears correctly in message panel', async () => {
		await alice.fill('#inp-message', 'test');
		await alice.press('#inp-message', 'Enter');

		// Bob sees sender as 'alice'
		await expect(bob.locator('.msg:not(.msg-own) .msg-sender')).toContainText('alice', { timeout: 5_000 });
	});

	test('multiple messages arrive in order', async () => {
		await alice.fill('#inp-message', 'first');
		await alice.press('#inp-message', 'Enter');
		await alice.fill('#inp-message', 'second');
		await alice.press('#inp-message', 'Enter');
		await alice.fill('#inp-message', 'third');
		await alice.press('#inp-message', 'Enter');

		await expect(bob.locator('.msg:not(.msg-own)')).toHaveCount(3, { timeout: 8_000 });
		const texts = await bob.locator('.msg:not(.msg-own) .msg-text').allTextContents();
		expect(texts).toEqual(['first', 'second', 'third']);
	});

	test('message input is disabled before key exchange (send button disabled)', async ({ browser }) => {
		// Fresh page — before connecting
		const ctx  = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto(HTML_PATH);
		await expect(page.locator('#btn-send')).toBeDisabled();
		await expect(page.locator('#inp-message')).toBeDisabled();
		await ctx.close();
	});
});

test.describe('Crypto inspector', () => {
	let aliceCtx: Awaited<ReturnType<Browser['newContext']>>;
	let bobCtx:   Awaited<ReturnType<Browser['newContext']>>;
	let alice:    Page;
	let bob:      Page;

	test.beforeEach(async ({ browser }) => {
		aliceCtx = await browser.newContext();
		bobCtx   = await browser.newContext();
		alice    = await aliceCtx.newPage();
		bob      = await bobCtx.newPage();

		await connectClient(alice, 'alice');
		const code = await getRoomCode(alice);
		await connectClient(bob, 'bob', code);
		await waitForChat(alice);
		await waitForChat(bob);

		// Alice sends one message so Bob's inspector has data
		await alice.fill('#inp-message', 'inspector test');
		await alice.press('#inp-message', 'Enter');
		// Wait for inspector to populate
		await expect(bob.locator('#insp-content')).not.toHaveAttribute('hidden', { timeout: 5_000 });
	});

	test.afterEach(async () => {
		await aliceCtx.close();
		await bobCtx.close();
	});

	test('nonce is 48 hex chars (24 bytes)', async () => {
		const nonce = await bob.locator('#insp-nonce').textContent();
		// wrapHex adds newlines every 32 chars — strip them
		expect(nonce!.replace(/\n/g, '')).toMatch(/^[0-9a-f]{48}$/);
	});

	test('tag is 32 hex chars (16 bytes)', async () => {
		const tag = await bob.locator('#insp-tag').textContent();
		expect(tag!.replace(/\n/g, '')).toMatch(/^[0-9a-f]{32}$/);
	});

	test('AAD JSON contains correct sender, sequence, roomCode fields', async () => {
		const aadText = await bob.locator('#insp-aad').textContent();
		const aad = JSON.parse(aadText!);
		expect(aad.sender).toBe('alice');
		expect(aad.sequence).toBe(1);
		expect(typeof aad.timestamp).toBe('number');
		expect(typeof aad.roomCode).toBe('string');
		expect(aad.roomCode).toMatch(/^[A-Z2-9]{6}$/);
	});

	test('sequence increments on each message', async () => {
		await alice.fill('#inp-message', 'second message');
		await alice.press('#inp-message', 'Enter');

		// Wait for second message
		await expect(bob.locator('.msg:not(.msg-own)')).toHaveCount(2, { timeout: 5_000 });

		const aadText = await bob.locator('#insp-aad').textContent();
		const aad = JSON.parse(aadText!);
		expect(aad.sequence).toBe(2);
	});

	test('status shows tag verified and decrypted', async () => {
		await expect(bob.locator('#insp-status')).toContainText('✓ tag verified');
		await expect(bob.locator('#insp-status')).toContainText('✓ decrypted');
	});

	test('server saw field shows opaque base64, not plaintext', async () => {
		const serverSaw = await bob.locator('#insp-server-saw').textContent();
		expect(serverSaw).toContain('"type":"relay"');
		// Payload is base64 — should NOT contain the plaintext
		expect(serverSaw).not.toContain('inspector test');
	});

	test('replay button is enabled after receiving a message', async () => {
		await expect(bob.locator('#btn-replay')).toBeEnabled();
	});
});

test.describe('Replay attack', () => {
	let aliceCtx: Awaited<ReturnType<Browser['newContext']>>;
	let bobCtx:   Awaited<ReturnType<Browser['newContext']>>;
	let alice:    Page;
	let bob:      Page;

	test.beforeEach(async ({ browser }) => {
		aliceCtx = await browser.newContext();
		bobCtx   = await browser.newContext();
		alice    = await aliceCtx.newPage();
		bob      = await bobCtx.newPage();

		await connectClient(alice, 'alice');
		const code = await getRoomCode(alice);
		await connectClient(bob, 'bob', code);
		await waitForChat(alice);
		await waitForChat(bob);

		// Alice sends one message — Bob's inspector captures it
		await alice.fill('#inp-message', 'capture me');
		await alice.press('#inp-message', 'Enter');
		await expect(bob.locator('#insp-content')).not.toHaveAttribute('hidden', { timeout: 5_000 });
	});

	test.afterEach(async () => {
		await aliceCtx.close();
		await bobCtx.close();
	});

	test('clicking replay sends the captured blob back', async () => {
		// Bob clicks REPLAY — sends Alice's message back to Alice
		await bob.click('#btn-replay');

		// Alice's client receives the replayed message and detects it
		await expect(alice.locator('.msg-replay')).toBeVisible({ timeout: 5_000 });
	});

	test('replay detection shows correct error message', async () => {
		await bob.click('#btn-replay');

		await expect(alice.locator('.replay-warn')).toContainText('REPLAY ATTACK DETECTED', { timeout: 5_000 });
		await expect(alice.locator('.replay-detail').first()).toContainText('sequence 1 already seen');
		await expect(alice.locator('.replay-detail').nth(1)).toContainText('tag verified');
	});

	test('replay badge appears in inspector after replay', async () => {
		// Alice sends the replay back to herself (as if Bob replayed)
		// Bob replays → Alice detects
		await bob.click('#btn-replay');

		// Alice sees replay in message panel
		await expect(alice.locator('.msg-replay')).toBeVisible({ timeout: 5_000 });

		// Now bob sends the original back (bob clicked replay) — check alice's inspector updated
		// The replay badge should appear on alice's inspector since alice received a replay
		// Note: Alice's inspector shows her LAST received message which is now the replay
		await expect(alice.locator('#insp-replay-badge')).toBeVisible({ timeout: 5_000 });
	});

	test('normal messages continue working after a replay attempt', async () => {
		await bob.click('#btn-replay');
		await expect(alice.locator('.msg-replay')).toBeVisible({ timeout: 5_000 });

		// Alice sends a new message — should work fine
		await alice.fill('#inp-message', 'still works');
		await alice.press('#inp-message', 'Enter');
		await expect(bob.locator('.msg:not(.msg-own):last-child .msg-text')).toContainText('still works', { timeout: 5_000 });
	});
});

test.describe('Disconnection', () => {
	test('closing one tab shows peer disconnected in the other', async ({ browser }) => {
		const aliceCtx = await browser.newContext();
		const bobCtx   = await browser.newContext();
		const alice    = await aliceCtx.newPage();
		const bob      = await bobCtx.newPage();

		await connectClient(alice, 'alice');
		const code = await getRoomCode(alice);
		await connectClient(bob, 'bob', code);
		await waitForChat(alice);
		await waitForChat(bob);

		// Close Bob's context (simulates tab close)
		await bobCtx.close();

		// Alice should see peer disconnected
		await expect(alice.locator('.msg-sys')).toContainText('peer disconnected', { timeout: 8_000 });
		await aliceCtx.close();
	});

	test('message input is disabled after peer disconnects', async ({ browser }) => {
		const aliceCtx = await browser.newContext();
		const bobCtx   = await browser.newContext();
		const alice    = await aliceCtx.newPage();
		const bob      = await bobCtx.newPage();

		await connectClient(alice, 'alice');
		const code = await getRoomCode(alice);
		await connectClient(bob, 'bob', code);
		await waitForChat(alice);
		await waitForChat(bob);

		await bobCtx.close();

		await expect(alice.locator('#inp-message')).toBeDisabled({ timeout: 8_000 });
		await expect(alice.locator('#btn-send')).toBeDisabled({ timeout: 8_000 });
		await aliceCtx.close();
	});

	test('start new session button appears after peer disconnects', async ({ browser }) => {
		const aliceCtx = await browser.newContext();
		const bobCtx   = await browser.newContext();
		const alice    = await aliceCtx.newPage();
		const bob      = await bobCtx.newPage();

		await connectClient(alice, 'alice');
		const code = await getRoomCode(alice);
		await connectClient(bob, 'bob', code);
		await waitForChat(alice);
		await waitForChat(bob);

		await bobCtx.close();

		await expect(alice.locator('#btn-new-session')).toBeVisible({ timeout: 8_000 });
		await aliceCtx.close();
	});
});
