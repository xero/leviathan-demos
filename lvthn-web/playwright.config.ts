import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 60_000,
  retries: 0,
  use: {
    headless: true,
    // Disable web security for file:// URLs
    launchOptions: {
      args: ['--allow-file-access-from-files'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
