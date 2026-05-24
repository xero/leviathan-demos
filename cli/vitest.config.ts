import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			{
				// Default project (source target, used by vitest run + test:watch)
				test: {
					name: 'source',
					include: ['src/test/**/*.test.ts'],
				},
			},
			{
				// Dist project (compiled binary target, used by test:dist)
				test: {
					name: 'dist',
					include: ['src/test/**/*.test.ts'],
					env: {
						LVTHN_BIN: './dist/lvthn',
					},
				},
			},
		],
	},
});
