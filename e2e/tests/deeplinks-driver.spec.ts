import { expect, test } from '@playwright/test';
import { byTestId, PHONES, resetScenario, signInMobile, URLS } from './helpers';

test.describe('driver deep links', () => {
  test('/wallet opens the wallet on a cold load (repeated)', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    for (let i = 0; i < 5; i++) {
      await page.goto(`${URLS.driver}/wallet`);
      await expect(byTestId(page, 'wallet-screen')).toBeVisible();
      await expect(byTestId(page, 'wallet-balance')).toContainText(/70/);
    }
  });
});
