import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests in a real browser: `npm run e2e`. They start their own dev server. Golden screenshots
 * live next to the tests (`e2e/*-snapshots`); `npm run e2e -- --update-snapshots` refreshes them after an
 * intended change.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  // One picture per screen size, whatever the machine (the tolerance below covers driver differences).
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // On CI, a report to download when something fails (CI's logs are only open to the repository's admins).
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5190',
    // A trace of a test that failed once and is run again: what the page showed, did and logged.
    trace: 'on-first-retry',
    // English, and no saved progress or language from earlier runs: each test gets a fresh browser context.
    locale: 'en-GB',
  },
  expect: {
    // Paper is drawn with WebGL, which differs a little between machines and drivers.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5190 --strictPort',
    url: 'http://localhost:5190',
    reuseExistingServer: !process.env.CI,
  },
});
