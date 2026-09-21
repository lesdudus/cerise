import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5213', channel: process.env.CI ? undefined : 'msedge', timezoneId: 'Europe/Paris', locale: 'fr-FR', colorScheme: 'light', reducedMotion: 'reduce', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 5213 --strictPort', url: 'http://127.0.0.1:5213', reuseExistingServer: !process.env.CI },
});