/**
 * build.ts — Bundle leviathan-crypto and inline into lvthn.html.
 *
 * Usage: bun run build.ts
 *
 * 1. Bundles leviathan.web-entry.ts → leviathan.bundle.js
 * 2. Inlines bundle into index.template.html → lvthn.html
 */

import { statSync } from 'node:fs';
import type { BunPlugin } from 'bun';

const entryPath = './leviathan.web-entry.ts';
const bundlePath = './leviathan.bundle.js';
const templatePath = './index.template.html';
const outputPath = './lvthn.html';

// Plugin to inline .wasm files as base64 strings (required for single-file HTML)
const wasmBase64Plugin: BunPlugin = {
	name: 'wasm-base64',
	setup(build) {
		build.onLoad({ filter: /argon2id.*\.wasm$/ }, async (args) => {
			const bytes = await Bun.file(args.path).arrayBuffer();
			const b64 = Buffer.from(bytes).toString('base64');
			return { contents: `export default ${JSON.stringify(b64)};`, loader: 'js' };
		});
	},
};

process.stdout.write('Bundling leviathan-crypto...\n');
const result = await Bun.build({
	entrypoints: [entryPath],
	outdir: '.',
	naming: 'leviathan.bundle.js',
	target: 'browser',
	format: 'esm',
	plugins: [wasmBase64Plugin],
});
if (!result.success) {
	for (const log of result.logs) process.stderr.write(log.message + '\n');
	process.exit(1);
}

const bundle = await Bun.file(bundlePath).text();
const template = await Bun.file(templatePath).text();

if (!template.includes('{{LEVIATHAN_BUNDLE}}')) {
	process.stderr.write('Error: placeholder {{LEVIATHAN_BUNDLE}} not found in template\n');
	process.exit(1);
}

const html = template.replace('{{LEVIATHAN_BUNDLE}}', bundle);
await Bun.write(outputPath, html);

const size = statSync(outputPath).size;
const kb = (size / 1024).toFixed(1);
process.stdout.write(`Built: ${outputPath}  (${kb} KB)\n`);
