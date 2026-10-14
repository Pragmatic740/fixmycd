import { defineConfig, devices } from '@playwright/test';
import { urlForDatabase } from './tests/helpers/pg';
import { E2E_DB } from './tests/e2e/fixtures';

const PORT = Number(process.env.E2E_PORT || 3100);

/**
 * End-to-end tests against a production build (`npm run build` first).
 * `npm run test:e2e` prepares a fresh database, then Playwright starts the app.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    // Use the preinstalled Chromium in CI containers when provided.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: urlForDatabase(E2E_DB),
      NODE_ENV: 'production',
      RESEND_API_KEY: '',
    },
  },
});
