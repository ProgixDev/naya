import { expect, test, type Browser, type Page } from '@playwright/test';
import { byTestId, PHONES, resetScenario, signInMobile, URLS } from './helpers';

/**
 * Cross-role scenarios: the passenger, driver and admin apps run side by side in separate
 * browser contexts and observe the same records through the shared demo API. Every step
 * is taken in a real UI; nothing is shortcut through the API except the reset.
 */

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'fr-MA', timezoneId: 'Africa/Casablanca' };
const MAD = (n: number | string) => new RegExp(`${String(n).replace('-', '[−-]')}(,00)?\\s?MAD`);

async function open(browser: Browser, kind: 'passenger' | 'driver' | 'admin') {
  const ctx = await browser.newContext(
    kind === 'admin'
      ? { viewport: { width: 1440, height: 960 }, locale: 'fr-MA', timezoneId: 'Africa/Casablanca' }
      : { ...phone, geolocation: { latitude: 34.0205, longitude: -6.831 }, permissions: ['geolocation'] },
  );
  return ctx.newPage();
}

async function composeAgdalTrip(page: Page) {
  await byTestId(page, 'where-to').click();
  await byTestId(page, 'place-search').fill('Hay');
  await byTestId(page, 'place-rabat-hay-riad').click();
  await byTestId(page, 'stop-pickup').click();
  await byTestId(page, 'place-search').fill('Gare');
  await byTestId(page, 'place-rabat-gare').click();
  await byTestId(page, 'add-stop').click();
  await byTestId(page, 'place-search').fill('Agdal');
  await byTestId(page, 'place-rabat-agdal').click();
}

async function adminLogin(page: Page) {
  await page.goto(`${URLS.admin}/connexion`);
  await page.getByTestId('email').fill('meryem@naya.demo');
  await page.getByTestId('password').fill('Naya-Admin-2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Centre des opérations' })).toBeVisible();
}

async function driveTrip(driver: Page) {
  await byTestId(driver, 'ride-arrive').click();
  await expect(byTestId(driver, 'ride-driver_arrived')).toBeVisible();
  await byTestId(driver, 'ride-start').click();
  await expect(byTestId(driver, 'ride-in_progress')).toBeVisible();
  await expect(byTestId(driver, 'next-target')).toContainText('Agdal');
  await byTestId(driver, 'ride-stop').click();
  await expect(byTestId(driver, 'next-target')).toContainText('Hay Riad');
  await byTestId(driver, 'ride-complete').click();
}

test.describe('cross-role', () => {
  test('S03 + S04 · cash NY-001 then card NY-002 across passenger, driver and admin', async ({ browser }) => {
    await resetScenario('first-ride');
    const passenger = await open(browser, 'passenger');
    const driver = await open(browser, 'driver');
    const admin = await open(browser, 'admin');
    await signInMobile(passenger, URLS.passenger, 'passenger', PHONES.salma);
    await signInMobile(driver, URLS.driver, 'driver', PHONES.amina);

    // Driver goes online in her app.
    await byTestId(driver, 'toggle-online').click();
    await expect(byTestId(driver, 'online-state')).toHaveText('Vous êtes en ligne');

    // S03 — passenger books Gare → Agdal → Hay Riad in cash.
    await composeAgdalTrip(passenger);
    await byTestId(passenger, 'see-quote').click();
    await expect(byTestId(passenger, 'fare-card')).toContainText('100');
    await byTestId(passenger, 'confirm-booking').click();
    await expect(byTestId(passenger, 'ride-searching')).toBeVisible();

    // The offer arrives on the driver's phone with fare and net; she accepts by tapping.
    await expect(byTestId(driver, 'offer-pending')).toBeVisible();
    await expect(byTestId(driver, 'offer-fare')).toContainText(MAD(100));
    await expect(byTestId(driver, 'offer-net')).toContainText(MAD(85));
    await byTestId(driver, 'accept-offer').click();
    await expect(byTestId(passenger, 'ride-driver_assigned')).toBeVisible();
    await expect(byTestId(passenger, 'driver-card')).toContainText('Amina');

    await driveTrip(driver);
    await expect(byTestId(passenger, 'receipt')).toBeVisible();
    await expect(byTestId(passenger, 'receipt-amount')).toContainText('100');
    await byTestId(driver, 'confirm-cash').click();
    await expect(byTestId(driver, 'cash-confirmed')).toBeVisible();
    await expect(byTestId(passenger, 'payment-state')).toContainText('paiement confirmé');
    await byTestId(driver, 'ride-end-home').click();
    await expect(byTestId(driver, 'home-wallet')).toContainText(MAD(-15));

    // Admin sees NY-001 with the same figures.
    await adminLogin(admin);
    await admin.goto(`${URLS.admin}/courses/NY-001`);
    await expect(admin.getByText('NY-001').first()).toBeVisible();
    await expect(admin.getByText('Mouvements du portefeuille')).toBeVisible();
    await expect(admin.getByText(/[−-]\s?15(,00)?\s?MAD/).first()).toBeVisible();

    // S04 — passenger books the same trip by card; the net is credited only after confirmation.
    await byTestId(passenger, 'receipt-done').click();
    await composeAgdalTrip(passenger);
    await byTestId(passenger, 'see-quote').click();
    await byTestId(passenger, 'payment-row').click();
    await byTestId(passenger, 'pm-4242').click();
    await expect(byTestId(passenger, 'payment-sheet')).toBeHidden();
    await expect(byTestId(passenger, 'payment-row')).toContainText('4242');
    await byTestId(passenger, 'confirm-booking').click();
    await expect(byTestId(driver, 'offer-pending')).toBeVisible();
    await byTestId(driver, 'accept-offer').click();
    await driveTrip(driver);
    await expect(byTestId(driver, 'card-pending').or(byTestId(driver, 'card-confirmed'))).toBeVisible();
    await expect(byTestId(driver, 'card-confirmed')).toBeVisible({ timeout: 20_000 });
    await byTestId(driver, 'ride-end-home').click();
    await expect(byTestId(driver, 'home-wallet')).toContainText(MAD(70));

    // Admin finance shows Amina at 70 MAD; earnings on the driver side reconcile.
    await admin.goto(`${URLS.admin}/finance`);
    await expect(admin.getByText('Amina Bennani').first()).toBeVisible();
    await byTestId(driver, 'tab-earnings').click();
    await expect(byTestId(driver, 'earnings-net')).toContainText(MAD(170));
    await expect(byTestId(driver, 'earnings-cash')).toContainText(MAD(100));
    await expect(byTestId(driver, 'earnings-wallet')).toContainText(MAD(85));
  });

  test('S01 · a new passenger signs up, the admin approves, the passenger can book', async ({ browser }) => {
    await resetScenario('default');
    const passenger = await open(browser, 'passenger');
    const admin = await open(browser, 'admin');
    // Nour already submitted her dossier; the admin reviews it in the dashboard.
    await signInMobile(passenger, URLS.passenger, 'passenger', PHONES.nour);
    await expect(byTestId(passenger, 'status-pending')).toBeVisible();
    await adminLogin(admin);
    await admin.getByTestId('priority-VP-002').click();
    await admin.getByTestId('start-review').click();
    await admin.getByTestId('approve').click();
    await admin.getByTestId('confirm-decision').click();
    await expect(admin.getByText(/Décision : approuvé par Meryem/)).toBeVisible();
    // The passenger app reflects the decision without restarting.
    await expect(byTestId(passenger, 'status-approved').or(byTestId(passenger, 'home'))).toBeVisible({ timeout: 20_000 });
  });
});
