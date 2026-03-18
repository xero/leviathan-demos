import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './test',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',

  use: {
    // Run tests headless by default; set HEADED=1 to watch
    headless: process.env.HEADED !== '1',
  },

  // Start the relay server before tests run
  webServer: {
    command: 'bun run server.ts',
    cwd:     resolve(__dirname, 'server'),
    url:     'http://localhost:3000',
    reuseExistingServer: process.env.CI !== 'true',
    timeout: 5_000,
    stdout:  'ignore',
    stderr:  'pipe',
  },
});
