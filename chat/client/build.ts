/**
 * build.ts — Build lvthn-chat.html by bundling leviathan and inlining it.
 *
 * Usage:
 *   bun run build.ts
 *
 * This script:
 *   1. Bundles leviathan.chat-entry.ts → leviathan.bundle.js
 *   2. Inlines the bundle into lvthn-chat.template.html
 *   3. Writes the self-contained output to lvthn-chat.html
 */

import { statSync } from 'node:fs';

const entryPath    = './leviathan.chat-entry.ts';
const bundlePath   = './leviathan.bundle.js';
const templatePath = './lvthn-chat.template.html';
const outputPath   = './lvthn-chat.html';

// Step 1: bundle
process.stdout.write('Bundling leviathan...\n');
const result = await Bun.build({
	entrypoints: [entryPath],
	outdir: '.',
	naming: 'leviathan.bundle.js',
	target: 'browser',
	format: 'esm',
});
if (!result.success) {
	for (const log of result.logs) process.stderr.write(log.message + '\n');
	process.exit(1);
}

// Step 2: inline
const bundle   = await Bun.file(bundlePath).text();
const template = await Bun.file(templatePath).text();

if (!template.includes('{{LEVIATHAN_BUNDLE}}')) {
	process.stderr.write('Error: placeholder {{LEVIATHAN_BUNDLE}} not found in template\n');
	process.exit(1);
}

const html = template.replace('{{LEVIATHAN_BUNDLE}}', bundle);

// Step 3: write
await Bun.write(outputPath, html);

const size = statSync(outputPath).size;
const kb   = (size / 1024).toFixed(1);
process.stdout.write(`Built: ${outputPath}  (${kb} KB)\n`);
