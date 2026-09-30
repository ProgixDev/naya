import { expect, test } from '@playwright/test';
import { byTestId, PHONES, resetScenario, signInMobile, URLS } from './helpers';

// Cold loads of a deep link must land on that screen once the account is known, and a
// protected screen must still redirect when the account is not allowed there.
test.describe('passenger deep links', () => {
  test('verified passenger: /trips opens directly', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await page.goto(`${URLS.passenger}/trips`);
    await expect(byTestId(page, 'trips')).toBeVisible();
  });

  test('unverified passenger: /trips redirects to the verification status', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.nour);
    await page.goto(`${URLS.passenger}/trips`);
    await expect(byTestId(page, 'status-pending')).toBeVisible();
    await expect(byTestId(page, 'trips')).toHaveCount(0);
  });
});
