import { expect, test } from '@playwright/test';
import { api, byTestId, PHONES, resetScenario, signInMobile, URLS } from './helpers';

const tid = byTestId;

async function advance(seconds: number) {
  const ctx = await api();
  await ctx.post('/dev/clock/advance', { data: { seconds } });
  await ctx.dispose();
}

test.describe('passenger · Lavage à domicile', () => {
  test('booking in five steps, simulated team to completion, before/after photos and rating', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await tid(page, 'car-wash-entry').click();
    await expect(tid(page, 'car-wash-orders')).toBeVisible();
    await tid(page, 'car-wash-new').click();

    // 1 · where: a saved address (Maison, Hay Riad).
    await expect(tid(page, 'car-wash-booking')).toBeVisible();
    await expect(tid(page, 'car-wash-continue')).toHaveAttribute('aria-disabled', 'true');
    await tid(page, 'car-wash-saved-home').click();
    await expect(tid(page, 'car-wash-place')).toContainText('Maison');
    await tid(page, 'car-wash-notes').fill('Sous-sol −1, place 42');
    await tid(page, 'car-wash-continue').click();

    // 2 · the car.
    await tid(page, 'car-wash-make').fill('Dacia');
    await tid(page, 'car-wash-model').fill('Sandero');
    await tid(page, 'car-wash-color').fill('Gris');
    await tid(page, 'car-wash-plate').fill('12345-a-6');
    await tid(page, 'car-wash-continue').click();

    // 3 · package (placeholder price, Rabat): Extérieur 60 MAD.
    await tid(page, 'car-wash-package-exterior').click();
    await tid(page, 'car-wash-continue').click();

    // 4 · when: a slot tomorrow (teams work 08h–20h, so « Maintenant » depends on the time the suite runs).
    await tid(page, 'car-wash-timing').getByRole('tab', { name: 'Planifier' }).click();
    await expect(tid(page, 'car-wash-slots')).toBeVisible();
    await page.locator('[data-testid^="car-wash-day-"]').nth(1).click();
    await page.locator('[data-testid^="car-wash-time-"]').first().click();
    await tid(page, 'car-wash-continue').click();

    // 5 · payment and summary, then confirm.
    await tid(page, 'car-wash-pay-cash').click();
    await expect(tid(page, 'car-wash-summary')).toContainText('Maison');
    await expect(tid(page, 'car-wash-summary')).toContainText('Dacia Sandero · Gris');
    await expect(tid(page, 'car-wash-summary')).toContainText('12345-A-6');
    await expect(tid(page, 'car-wash-summary')).toContainText('Extérieur · 45 min');
    await expect(tid(page, 'car-wash-confirm')).toContainText(/60(,00)?\s?MAD/);
    await tid(page, 'car-wash-confirm').click();

    // Tracking: booked, then the demo engine plays the team (assigned → en route → washing → completed).
    await expect(tid(page, 'car-wash-order')).toBeVisible();
    await expect(tid(page, 'car-wash-timeline')).toBeVisible();
    await expect(tid(page, 'car-wash-cancel')).toBeVisible();
    await advance(20);
    await expect(tid(page, 'car-wash-team')).toBeVisible();
    await advance(3 * 86_400);
    await expect(tid(page, 'car-wash-rating')).toBeVisible({ timeout: 20_000 });
    await expect(tid(page, 'car-wash-cancel')).toHaveCount(0);
    await expect(tid(page, 'car-wash-photos')).toContainText('Avant');
    await expect(tid(page, 'car-wash-photos')).toContainText('Après');
    await expect(tid(page, 'car-wash-receipt')).toContainText('Sous-sol −1, place 42');

    await tid(page, 'car-wash-star-5').click();
    await tid(page, 'car-wash-rate').click();
    await expect(tid(page, 'car-wash-rated')).toContainText('Merci pour votre note');
  });
});
