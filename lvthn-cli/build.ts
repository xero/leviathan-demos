// Build script — produces a standalone lvthn binary using Bun's compiler.
// See: docs/bun/bundler/executables.mdx

import { statSync } from 'node:fs';

const result = await Bun.build({
	entrypoints: ['src/main.ts'],
	compile: {
		outfile: './dist/lvthn',
	},
});

if (!result.success) {
	process.stderr.write('Build failed:\n');
	for (const msg of result.logs) {
		process.stderr.write(`  ${msg.message}\n`);
	}
	process.exit(1);
}

const outfile = './dist/lvthn';
const size = statSync(outfile).size;
const kb = (size / 1024).toFixed(1);
process.stdout.write(`Built: ${outfile}  (${kb} KB)\n`);
