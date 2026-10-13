import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real apps against the shared demo API:
 * - passenger and driver: Expo web builds (react-native-web) at phone size
 * - admin: Vite build in a desktop viewport
 * `pnpm e2e` starts whichever of the four servers is not already running (webServer below) and
 * reuses the ones you started yourself. Override the URLs with env vars to test elsewhere.
 */
export const URLS = {
  api: process.env.API_URL ?? 'http://localhost:4010',
  passenger: process.env.PASSENGER_URL ?? 'http://localhost:8081',
  driver: process.env.DRIVER_URL ?? 'http://localhost:8082',
  admin: process.env.ADMIN_URL ?? 'http://localhost:5173',
};

const phone = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true, defaultBrowserType: 'chromium' as const };
const port = (url: string) => { const u = new URL(url); return u.port || (u.protocol === 'https:' ? '443' : '80'); };

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one shared demo API; scenarios reset it
  retries: process.env.CI ? 1 : 0, // on CI the first passenger and driver tests also wait for a cold Expo bundle (see webServer)
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'fr-MA', timezoneId: 'Africa/Casablanca' },
  projects: [
    { name: 'passenger', testMatch: /passenger.*\.spec\.ts/, use: { ...phone, baseURL: URLS.passenger } },
    { name: 'driver', testMatch: /driver.*\.spec\.ts/, use: { ...phone, baseURL: URLS.driver } },
    { name: 'admin', testMatch: /admin.*\.spec\.ts/, use: { viewport: { width: 1440, height: 960 }, baseURL: URLS.admin } },
    { name: 'cross-role', testMatch: /scenarios.*\.spec\.ts/, use: { viewport: { width: 390, height: 844 } } },
  ],
  // Started only when nothing answers on the URL. An API started here keeps its data in .data/e2e, so the
  // resets the specs make never wipe your own demo data. The apps started here call URLS.api, so API_URL moves
  // all four together. Expo web answers at once but bundles on the first visit, inside the first test's 90 s, so
  // these timeouts only cover start-up; on CI a first test that times out on a cold bundle is retried once.
  webServer: [
    { name: 'api', command: 'pnpm --filter @naya/demo-api start', url: `${URLS.api}/health`, env: { NAYA_DEV: '1', PORT: port(URLS.api), NAYA_DATA_DIR: join(__dirname, '..', 'services', 'demo-api', '.data', 'e2e') }, reuseExistingServer: true, timeout: 120_000 },
    { name: 'passenger', command: `pnpm --filter @naya/passenger exec expo start --web --port ${port(URLS.passenger)}`, url: URLS.passenger, env: { EXPO_PUBLIC_API_URL: URLS.api }, reuseExistingServer: true, timeout: 300_000 },
    { name: 'driver', command: `pnpm --filter @naya/driver exec expo start --web --port ${port(URLS.driver)}`, url: URLS.driver, env: { EXPO_PUBLIC_API_URL: URLS.api }, reuseExistingServer: true, timeout: 300_000 },
    { name: 'admin', command: `pnpm --filter @naya/admin exec vite --port ${port(URLS.admin)} --strictPort`, url: URLS.admin, env: { VITE_API_URL: URLS.api }, reuseExistingServer: true, timeout: 120_000 },
  ],
});
