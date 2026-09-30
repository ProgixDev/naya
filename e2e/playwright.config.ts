import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real apps against the shared demo API:
 * - passenger and driver: Expo web builds (react-native-web) at phone size
 * - admin: Vite build in a desktop viewport
 * Start the servers first (see README "Tests"), or override the URLs with env vars.
 */
export const URLS = {
  api: process.env.API_URL ?? 'http://localhost:4010',
  passenger: process.env.PASSENGER_URL ?? 'http://localhost:8081',
  driver: process.env.DRIVER_URL ?? 'http://localhost:8082',
  admin: process.env.ADMIN_URL ?? 'http://localhost:5173',
};

const phone = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true, defaultBrowserType: 'chromium' as const };

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one shared demo API; scenarios reset it
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'fr-MA', timezoneId: 'Africa/Casablanca' },
  projects: [
    { name: 'passenger', testMatch: /passenger.*\.spec\.ts/, use: { ...phone, baseURL: URLS.passenger } },
    { name: 'driver', testMatch: /driver.*\.spec\.ts/, use: { ...phone, baseURL: URLS.driver } },
    { name: 'admin', testMatch: /admin.*\.spec\.ts/, use: { viewport: { width: 1440, height: 960 }, baseURL: URLS.admin } },
    { name: 'cross-role', testMatch: /scenarios.*\.spec\.ts/, use: { viewport: { width: 390, height: 844 } } },
  ],
});
