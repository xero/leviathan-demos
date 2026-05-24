import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { run, randomBytes } from './helpers.ts';

// Size chosen to span more than one 64KB chunk to exercise multi-chunk paths
const PLAINTEXT_SIZE = 65537;

type Cipher  = 'serpent' | 'chacha' | 'aes';
type KeyType = 'keyfile' | 'passphrase';

const CIPHERS:   Cipher[]  = ['serpent', 'chacha', 'aes'];
const KEY_TYPES: KeyType[] = ['keyfile', 'passphrase'];

describe('encrypt / decrypt', () => {
	let tmp:       string;
	let keyfile:   string;
	let plaintext: Buffer;

	beforeEach(() => {
		tmp      = fs.mkdtempSync(path.join(os.tmpdir(), 'lvthn-cli-'));
		keyfile  = path.join(tmp, 'test.key');
		plaintext = randomBytes(PLAINTEXT_SIZE);

		// Generate a keyfile used by keyfile-based tests
		const kg = run(['keygen', '-o', keyfile]);
		if (kg.status !== 0) throw new Error(`keygen failed: ${kg.stderr}`);
	});

	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	// Key flag helpers
	function keyArgs(type: KeyType): string[] {
		return type === 'keyfile'
			? ['-k', keyfile]
			: ['-p', 'correct horse battery staple'];
	}

	// ── round-trip matrix ─────────────────────────────────────────────────────

	for (const cipher of CIPHERS) {
		for (const keyType of KEY_TYPES) {
			describe(`${cipher} + ${keyType}`, () => {

				it('file → file round-trip', () => {
					const src = path.join(tmp, 'plain.bin');
					const enc = path.join(tmp, 'plain.enc');
					const dec = path.join(tmp, 'plain.dec');
					fs.writeFileSync(src, plaintext);

					const e = run(['encrypt', ...keyArgs(keyType), '--cipher', cipher, src, '-o', enc]);
					expect(e.status).toBe(0);

					const d = run(['decrypt', ...keyArgs(keyType), enc, '-o', dec]);
					expect(d.status).toBe(0);

					expect(fs.readFileSync(dec)).toEqual(plaintext);
				});

				it('stdin → stdout round-trip', () => {
					const e = run(
						['encrypt', ...keyArgs(keyType), '--cipher', cipher],
						{ stdinData: plaintext },
					);
					expect(e.status).toBe(0);

					const d = run(
						['decrypt', ...keyArgs(keyType)],
						{ stdinData: Buffer.from(e.stdout, 'binary') },
					);
					expect(d.status).toBe(0);
					expect(Buffer.from(d.stdout, 'binary')).toEqual(plaintext);
				});

				it('armored output round-trips', () => {
					const src = path.join(tmp, 'plain.bin');
					const enc = path.join(tmp, 'plain.asc');
					const dec = path.join(tmp, 'plain.dec');
					fs.writeFileSync(src, plaintext);

					const e = run(['encrypt', ...keyArgs(keyType), '--cipher', cipher, '--armor', src, '-o', enc]);
					expect(e.status).toBe(0);

					// armored output is ASCII text
					const armored = fs.readFileSync(enc, 'utf8');
					expect(armored).toMatch(/^-----BEGIN LVTHN/);

					const d = run(['decrypt', ...keyArgs(keyType), enc, '-o', dec]);
					expect(d.status).toBe(0);
					expect(fs.readFileSync(dec)).toEqual(plaintext);
				});

			});
		}
	}

	// ── --cipher flag on decrypt is silently ignored ──────────────────────────

	it('passing --cipher to decrypt does not affect output', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		const dec = path.join(tmp, 'plain.dec');
		fs.writeFileSync(src, plaintext);

		run(['encrypt', '-k', keyfile, '--cipher', 'serpent', src, '-o', enc]);

		// pass wrong cipher flag, should still decrypt correctly
		const d = run(['decrypt', '-k', keyfile, '--cipher', 'chacha', enc, '-o', dec]);
		expect(d.status).toBe(0);
		expect(fs.readFileSync(dec)).toEqual(plaintext);
	});

	// ── output file protection ────────────────────────────────────────────────

	it('encrypt exits 4 when output exists without --force', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		fs.writeFileSync(src, plaintext);
		fs.writeFileSync(enc, 'existing');

		const r = run(['encrypt', '-k', keyfile, src, '-o', enc]);
		expect(r.status).toBe(4);
		expect(fs.readFileSync(enc, 'utf8')).toBe('existing');
	});

	it('encrypt --force overwrites existing output', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		fs.writeFileSync(src, plaintext);
		fs.writeFileSync(enc, 'existing');

		const r = run(['encrypt', '-k', keyfile, '--force', src, '-o', enc]);
		expect(r.status).toBe(0);
		expect(fs.readFileSync(enc, 'utf8')).not.toBe('existing');
	});

});

describe('error exit codes', () => {
	let tmp:     string;
	let keyfile: string;

	beforeEach(() => {
		tmp     = fs.mkdtempSync(path.join(os.tmpdir(), 'lvthn-err-'));
		keyfile = path.join(tmp, 'test.key');
		run(['keygen', '-o', keyfile]);
	});

	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	// exit 1: authentication failure

	it('exits 1 on wrong keyfile', () => {
		const src  = path.join(tmp, 'plain.bin');
		const enc  = path.join(tmp, 'plain.enc');
		const bad  = path.join(tmp, 'bad.key');
		fs.writeFileSync(src, randomBytes(256));
		run(['encrypt', '-k', keyfile, src, '-o', enc]);
		run(['keygen', '-o', bad]);                         // different key

		const r = run(['decrypt', '-k', bad, enc]);
		expect(r.status).toBe(1);
	});

	it('exits 1 on tampered ciphertext', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		fs.writeFileSync(src, randomBytes(256));
		run(['encrypt', '-k', keyfile, src, '-o', enc]);

		// flip a byte in the middle of the ciphertext
		const bytes = fs.readFileSync(enc);
		bytes[bytes.length >> 1] ^= 0xff;
		fs.writeFileSync(enc, bytes);

		const r = run(['decrypt', '-k', keyfile, enc]);
		expect(r.status).toBe(1);
	});

	it('exits 1 on wrong passphrase', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		fs.writeFileSync(src, randomBytes(256));
		run(['encrypt', '-p', 'correct-passphrase', src, '-o', enc]);

		const r = run(['decrypt', '-p', 'wrong-passphrase', enc]);
		expect(r.status).toBe(1);
	});

	// exit 2: bad arguments

	it('exits 2 when neither -p nor -k is given', () => {
		const r = run(['encrypt', 'somefile.txt']);
		expect(r.status).toBe(2);
	});

	it('exits 2 when both -p and -k are given', () => {
		const r = run(['encrypt', '-p', 'foo', '-k', keyfile, 'somefile.txt']);
		expect(r.status).toBe(2);
	});

	it('exits 2 on unknown cipher value', () => {
		const src = path.join(tmp, 'plain.bin');
		fs.writeFileSync(src, randomBytes(64));
		const r = run(['encrypt', '-k', keyfile, '--cipher', 'rot13', src]);
		expect(r.status).toBe(2);
	});

	it('exits 2 when decrypting a keyfile-encrypted file with --passphrase', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		fs.writeFileSync(src, randomBytes(64));
		run(['encrypt', '-k', keyfile, src, '-o', enc]);

		const r = run(['decrypt', '-p', 'somepassphrase', enc]);
		expect(r.status).toBe(2);
	});

	it('exits 2 when decrypting a passphrase-encrypted file with --keyfile', () => {
		const src = path.join(tmp, 'plain.bin');
		const enc = path.join(tmp, 'plain.enc');
		fs.writeFileSync(src, randomBytes(64));
		run(['encrypt', '-p', 'somepassphrase', src, '-o', enc]);

		const r = run(['decrypt', '-k', keyfile, enc]);
		expect(r.status).toBe(2);
	});

	// exit 3: file not found

	it('exits 3 when input file does not exist', () => {
		const r = run(['encrypt', '-k', keyfile, path.join(tmp, 'ghost.bin')]);
		expect(r.status).toBe(3);
	});

	it('exits 3 when keyfile does not exist', () => {
		const src = path.join(tmp, 'plain.bin');
		fs.writeFileSync(src, randomBytes(64));
		const r = run(['encrypt', '-k', path.join(tmp, 'ghost.key'), src]);
		expect(r.status).toBe(3);
	});

	// exit 5: invalid format

	it('exits 5 when decrypting a non-encrypted file', () => {
		const src = path.join(tmp, 'plain.bin');
		fs.writeFileSync(src, randomBytes(256));
		const r = run(['decrypt', '-k', keyfile, src]);
		expect(r.status).toBe(5);
	});

});
