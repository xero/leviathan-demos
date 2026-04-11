import { describe, it, expect } from 'vitest';
import { getCompletions } from '../completions.ts';

describe('getCompletions', () => {

	describe('top-level', () => {
		it('returns all commands with no input', () => {
			expect(getCompletions(['lvthn'])).toEqual(['encrypt', 'decrypt', 'keygen', 'help']);
		});
		it('returns all commands when cur is empty', () => {
			const r = getCompletions(['lvthn', '']);
			expect(r).toContain('encrypt');
		});
		it('returns nothing for unknown command', () => {
			expect(getCompletions(['lvthn', 'bogus', ''])).toEqual([]);
		});
	});

	describe('value-consuming flags', () => {
		it('prev=-c offers cipher values', () => {
			expect(getCompletions(['lvthn', 'encrypt', '-c', ''])).toEqual(['serpent', 'chacha']);
		});
		it('prev=--cipher offers cipher values', () => {
			expect(getCompletions(['lvthn', 'encrypt', '--cipher', ''])).toEqual(['serpent', 'chacha']);
		});
		it('prev=-k requests files', () => {
			expect(getCompletions(['lvthn', 'encrypt', '-k', ''])).toEqual(['__files__']);
		});
		it('prev=--keyfile requests files', () => {
			expect(getCompletions(['lvthn', 'encrypt', '--keyfile', ''])).toEqual(['__files__']);
		});
		it('prev=-o requests files', () => {
			expect(getCompletions(['lvthn', 'encrypt', '-o', ''])).toEqual(['__files__']);
		});
		it('prev=--output requests files', () => {
			expect(getCompletions(['lvthn', 'decrypt', '--output', ''])).toEqual(['__files__']);
		});
		it('prev=-p offers nothing', () => {
			expect(getCompletions(['lvthn', 'encrypt', '-p', ''])).toEqual([]);
		});
		it('prev=--passphrase offers nothing', () => {
			expect(getCompletions(['lvthn', 'decrypt', '--passphrase', ''])).toEqual([]);
		});
	});

	describe('mutex: passphrase/keyfile', () => {
		it('-p seen suppresses -p, --passphrase, -k, --keyfile', () => {
			const r = getCompletions(['lvthn', 'encrypt', '-p', 'secret', '']);
			expect(r).not.toContain('-p');
			expect(r).not.toContain('--passphrase');
			expect(r).not.toContain('-k');
			expect(r).not.toContain('--keyfile');
		});
		it('-k seen suppresses -p, --passphrase, -k, --keyfile', () => {
			const r = getCompletions(['lvthn', 'encrypt', '-k', 'my.key', '']);
			expect(r).not.toContain('-p');
			expect(r).not.toContain('--passphrase');
			expect(r).not.toContain('-k');
			expect(r).not.toContain('--keyfile');
		});
		it('--passphrase seen suppresses keyfile flags', () => {
			const r = getCompletions(['lvthn', 'decrypt', '--passphrase', 'secret', '']);
			expect(r).not.toContain('-k');
			expect(r).not.toContain('--keyfile');
		});
		it('keygen has no mutex group', () => {
			// keygen has no auth flags at all; verify it doesn't throw
			const r = getCompletions(['lvthn', 'keygen', '']);
			expect(r).toContain('--armor');
		});
	});

	describe('seen-flag deduplication', () => {
		it('--armor already seen is suppressed', () => {
			const r = getCompletions(['lvthn', 'encrypt', '--armor', '']);
			expect(r).not.toContain('--armor');
		});
		it('--force already seen is suppressed', () => {
			const r = getCompletions(['lvthn', 'encrypt', '--force', '']);
			expect(r).not.toContain('--force');
		});
		it('-c seen suppresses -c and --cipher', () => {
			const r = getCompletions(['lvthn', 'encrypt', '-c', 'serpent', '']);
			expect(r).not.toContain('-c');
			expect(r).not.toContain('--cipher');
		});
	});

	describe('file positionals', () => {
		it('encrypt always includes __files__ in remaining', () => {
			expect(getCompletions(['lvthn', 'encrypt', ''])).toContain('__files__');
		});
		it('decrypt always includes __files__ in remaining', () => {
			expect(getCompletions(['lvthn', 'decrypt', ''])).toContain('__files__');
		});
		it('keygen does not include __files__', () => {
			expect(getCompletions(['lvthn', 'keygen', ''])).not.toContain('__files__');
		});
	});

	describe('combined scenarios', () => {
		it('after -p "foo": offers cipher, armor, output, force + files', () => {
			const r = getCompletions(['lvthn', 'encrypt', '-p', 'foo', '']);
			expect(r).toContain('--cipher');
			expect(r).toContain('--armor');
			expect(r).toContain('--output');
			expect(r).toContain('--force');
			expect(r).toContain('__files__');
			expect(r).not.toContain('-k');
			expect(r).not.toContain('--keyfile');
			expect(r).not.toContain('-p');
			expect(r).not.toContain('--passphrase');
		});
		it('after -k "my.key": offers output, force + files; no auth flags', () => {
			const r = getCompletions(['lvthn', 'encrypt', '-k', 'my.key', '']);
			expect(r).toContain('--output');
			expect(r).toContain('--force');
			expect(r).toContain('__files__');
			expect(r).not.toContain('-p');
			expect(r).not.toContain('-k');
		});
		it('after --cipher chacha: cipher flags suppressed, rest available', () => {
			const r = getCompletions(['lvthn', 'encrypt', '--cipher', 'chacha', '']);
			expect(r).not.toContain('-c');
			expect(r).not.toContain('--cipher');
			expect(r).toContain('--armor');
		});
		it('decrypt: same mutex behavior as encrypt', () => {
			const r = getCompletions(['lvthn', 'decrypt', '-k', 'my.key', '']);
			expect(r).not.toContain('-p');
			expect(r).not.toContain('--passphrase');
			expect(r).toContain('--output');
			expect(r).toContain('__files__');
		});
		it('decrypt: -p passphrase cipher flag not present (decrypt has no -c)', () => {
			const r = getCompletions(['lvthn', 'decrypt', '-p', 'foo', '']);
			expect(r).not.toContain('-c');
			expect(r).not.toContain('--cipher');
		});
	});

});
