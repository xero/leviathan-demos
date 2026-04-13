/**
 * build.ts — Bundle leviathan-crypto and assemble dist/index.html.
 *
 * Usage: bun run build.ts
 *
 * 1. Bundles leviathan.kyber-entry.ts → leviathan.bundle.js
 * 2. Reads src/template.html, src/style.css, src/app.js
 * 3. Replaces placeholders and writes dist/index.html
 */

import { mkdirSync, statSync } from 'node:fs';

const entryPath    = './leviathan.kyber-entry.ts';
const bundlePath   = './leviathan.bundle.js';
const templatePath = './src/template.html';
const stylePath    = './src/style.css';
const scriptPath   = './src/app.js';
const outputDir    = './dist';
const outputPath   = './dist/index.html';

process.stdout.write('Bundling leviathan-crypto (kyber)...\n');
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

const bundle   = await Bun.file(bundlePath).text();
const template = await Bun.file(templatePath).text();
const style    = await Bun.file(stylePath).text();
const script   = await Bun.file(scriptPath).text();

for (const placeholder of ['{{APP_STYLE}}', '{{LEVIATHAN_BUNDLE}}', '{{APP_SCRIPT}}']) {
	if (!template.includes(placeholder)) {
		process.stderr.write(`Error: placeholder ${placeholder} not found in template\n`);
		process.exit(1);
	}
}

mkdirSync(outputDir, { recursive: true });

const html = template
	.replace('{{APP_STYLE}}', style)
	.replace('{{LEVIATHAN_BUNDLE}}', bundle)
	.replace('{{APP_SCRIPT}}', script);

await Bun.write(outputPath, html);

const size = statSync(outputPath).size;
const kb = (size / 1024).toFixed(1);
process.stdout.write(`Built: ${outputPath}  (${kb} KB)\n`);
