import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { run } from './helpers.ts';

describe('keygen', () => {
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lvthn-keygen-'));
	});

	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it('creates a 64-byte binary keyfile at the default path', () => {
		const r = run(['keygen', '-o', path.join(tmp, 'out.key')]);
		expect(r.status).toBe(0);
		const bytes = fs.readFileSync(path.join(tmp, 'out.key'));
		expect(bytes.length).toBe(32);
	});

	it('creates an armored keyfile with --armor', () => {
		const out = path.join(tmp, 'out.key');
		const r = run(['keygen', '--armor', '-o', out]);
		expect(r.status).toBe(0);
		const content = fs.readFileSync(out, 'utf8');
		expect(content).toMatch(/^-----BEGIN LVTHN KEY-----/);
		expect(content).toMatch(/-----END LVTHN KEY-----/);
	});

	it('exits 4 when output file already exists without --force', () => {
		const out = path.join(tmp, 'out.key');
		fs.writeFileSync(out, 'existing');
		const r = run(['keygen', '-o', out]);
		expect(r.status).toBe(4);
		// file must be unchanged
		expect(fs.readFileSync(out, 'utf8')).toBe('existing');
	});

	it('overwrites with --force', () => {
		const out = path.join(tmp, 'out.key');
		fs.writeFileSync(out, 'existing');
		const r = run(['keygen', '--force', '-o', out]);
		expect(r.status).toBe(0);
		expect(fs.readFileSync(out).length).toBe(32);
	});

	it('respects -o for output path', () => {
		const out = path.join(tmp, 'custom.key');
		const r = run(['keygen', '-o', out]);
		expect(r.status).toBe(0);
		expect(fs.existsSync(out)).toBe(true);
	});

	it('prints the output path to stderr', () => {
		const out = path.join(tmp, 'out.key');
		const r = run(['keygen', '-o', out]);
		expect(r.stderr).toContain(out);
	});
});
