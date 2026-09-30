import { expect, test, type Page } from '@playwright/test';
import { adminToken, api, authed, byTestId, PHONES, resetScenario, signInMobile, tokenFor, URLS } from './helpers';

test.use({ geolocation: { latitude: 34.0205, longitude: -6.831 }, permissions: ['geolocation'] });

const MAD = (n: number | string) => new RegExp(`${String(n).replace('-', '[−-]')}(,00)?\\s?MAD`);

async function passengerBooks(opts: { card?: string } = {}) {
  const { token } = await tokenFor(PHONES.salma, 'passenger');
  const ctx = await authed(token);
  const stops = [
    { id: 'rabat-gare', label: 'Gare Rabat Ville', address: 'Avenue Mohammed V, Rabat', location: { lat: 34.0166, lng: -6.8356 } },
    { id: 'rabat-agdal', label: 'Agdal', address: 'Avenue de France, Agdal, Rabat', location: { lat: 33.9993, lng: -6.8511 } },
    { id: 'rabat-hay-riad', label: 'Hay Riad', address: 'Avenue Annakhil, Rabat', location: { lat: 33.9594, lng: -6.8747 } },
  ];
  const quote = await (await ctx.post('/quotes', { data: { cityId: 'rabat', stops } })).json();
  const methods = await (await ctx.get('/payment-methods')).json();
  const pm = opts.card ? methods.find((m: { last4: string }) => m.last4 === opts.card) : methods.find((m: { kind: string }) => m.kind === 'cash');
  const ride = await (await ctx.post('/rides', { data: { quoteId: quote.id, paymentMethodId: pm.id }, headers: { 'Idempotency-Key': `e2e-${Date.now()}-${Math.random()}` } })).json();
  return { ride, ctx };
}

async function advance(seconds: number) {
  const ctx = await api();
  await ctx.post('/dev/clock/advance', { data: { seconds } });
  await ctx.dispose();
}

async function goOnline(page: Page) {
  await expect(byTestId(page, 'toggle-online')).toBeVisible();
  await byTestId(page, 'toggle-online').click();
  await expect(byTestId(page, 'online-state')).toHaveText('Vous êtes en ligne');
}

test.describe('driver app', () => {
  test('S11 · offer accepted, full trip with the Agdal stop, cash confirmed', async ({ page }) => {
    await resetScenario('first-ride');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await goOnline(page);
    await passengerBooks();
    await expect(byTestId(page, 'offer-pending')).toBeVisible();
    await expect(byTestId(page, 'offer-fare')).toContainText(MAD(100));
    await expect(byTestId(page, 'offer-net')).toContainText(MAD(85));
    await expect(byTestId(page, 'offer-countdown')).toContainText(/\d+/);
    await byTestId(page, 'accept-offer').click();
    await expect(byTestId(page, 'ride-driver_assigned')).toBeVisible();
    await byTestId(page, 'ride-arrive').click();
    await expect(byTestId(page, 'ride-driver_arrived')).toBeVisible();
    await byTestId(page, 'ride-start').click();
    await expect(byTestId(page, 'ride-in_progress')).toBeVisible();
    await expect(byTestId(page, 'next-target')).toContainText('Agdal');
    await byTestId(page, 'ride-stop').click();
    await expect(byTestId(page, 'next-target')).toContainText('Hay Riad');
    await byTestId(page, 'ride-complete').click();
    await expect(byTestId(page, 'ride-end-cash-pending')).toBeVisible();
    await byTestId(page, 'confirm-cash').click();
    await expect(byTestId(page, 'cash-confirmed')).toBeVisible();
    await byTestId(page, 'ride-end-home').click();
    await expect(byTestId(page, 'home-wallet')).toContainText(MAD(-15));
  });

  test('S11 · refusal with a reason keeps the driver online', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await goOnline(page);
    await passengerBooks();
    await expect(byTestId(page, 'offer-pending')).toBeVisible();
    await byTestId(page, 'decline-offer').click();
    await byTestId(page, 'decline-destination').click();
    await byTestId(page, 'confirm-decline').click();
    await expect(byTestId(page, 'offer-declined')).toBeVisible();
    await byTestId(page, 'offer-back').click();
    await expect(byTestId(page, 'online-state')).toHaveText('Vous êtes en ligne');
  });

  test('S11 · expiry after 30 s is never auto-accepted', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await goOnline(page);
    await passengerBooks();
    await expect(byTestId(page, 'offer-pending')).toBeVisible();
    await advance(31);
    await expect(byTestId(page, 'offer-expired')).toBeVisible();
    const status = await (await authed((await tokenFor(PHONES.amina, 'driver')).token)).get('/driver/status');
    expect((await status.json()).activeRide).toBeNull();
  });

  test('S11 · offer withdrawn when the passenger cancels', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await goOnline(page);
    const { ride, ctx } = await passengerBooks();
    await expect(byTestId(page, 'offer-pending')).toBeVisible();
    await ctx.post(`/rides/${ride.id}/cancel`, { data: { reasonCode: 'changed_plans' } });
    await expect(byTestId(page, 'offer-withdrawn')).toBeVisible();
  });

  test('S09 · driver cancels with a reason; the passenger is searched again', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await goOnline(page);
    const { ctx } = await passengerBooks();
    await byTestId(page, 'accept-offer').click();
    await expect(byTestId(page, 'ride-driver_assigned')).toBeVisible();
    await byTestId(page, 'ride-cancel').click();
    await byTestId(page, 'cancel-reason-vehicle_issue').click();
    await byTestId(page, 'confirm-driver-cancel').click();
    await expect(byTestId(page, 'ride-cancelled-by-driver')).toContainText('Problème de véhicule');
    const active = await (await ctx.get('/rides/active')).json();
    expect(active.status).toBe('searching');
    expect(active.driverCancellations[0].reasonText).toBe('Problème de véhicule');
  });

  test('S10 · person and vehicle approvals are independent', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.khadija);
    await expect(byTestId(page, 'reason-vehicle_not_approved')).toBeVisible();
    await expect(byTestId(page, 'toggle-online')).toHaveAttribute('aria-disabled', 'true');
    await page.goto(`${URLS.driver}/docs/status`);
    await expect(byTestId(page, 'review-driver_identity')).toContainText('Chauffeuse approuvée');
    await expect(byTestId(page, 'review-vehicle')).toContainText('en attente');
    await expect(byTestId(page, 'blocked-banner')).toBeVisible();

    // An administrator approves the vehicle: the driver can now go online.
    const admin = await authed(await adminToken());
    const queue = await (await admin.get('/admin/verifications?status=queue&subject=vehicle')).json();
    const kase = queue.items.find((r: { user: { firstName: string } }) => r.user.firstName === 'Khadija').case;
    await admin.post(`/admin/verifications/${kase.id}/decision`, { data: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: kase.version } });
    await page.reload();
    await expect(byTestId(page, 'eligible-banner')).toBeVisible();
    await page.goto(URLS.driver);
    await goOnline(page);

    // Samira: vehicle approved, licence to correct.
    await signInMobile(page, URLS.driver, 'driver', PHONES.samira);
    await expect(byTestId(page, 'reason-identity_not_approved')).toBeVisible();
    await page.goto(`${URLS.driver}/docs/status`);
    await expect(byTestId(page, 'review-vehicle')).toContainText('Véhicule approuvé');
    await expect(byTestId(page, 'review-driver_identity')).toContainText('flou');
  });

  test('S12 · debt blocks; a confirmed recharge of 50 restores access at −100', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.leila);
    await expect(byTestId(page, 'reason-debt_limit')).toBeVisible();
    await expect(byTestId(page, 'home-wallet')).toContainText(MAD(-150));
    await byTestId(page, 'reason-debt_limit').getByText('Recharger').click();
    await expect(byTestId(page, 'recharge-debt')).toBeVisible();
    await byTestId(page, 'provider-card').click();
    await byTestId(page, 'recharge-continue').click();
    await expect(byTestId(page, 'provider-sandbox')).toBeVisible();
    await byTestId(page, 'sandbox-approve').click();
    await expect(byTestId(page, 'recharge-confirmed')).toBeVisible();
    await expect(byTestId(page, 'recharge-restored')).toBeVisible();
    await expect(byTestId(page, 'recharge-balance')).toContainText(MAD(-100));
    await byTestId(page, 'recharge-done').click();
    await expect(byTestId(page, 'restored-banner')).toBeVisible();
    await goOnline(page);
  });

  test('S13 · withdrawal 50 from 70: reserved then confirmed (20/0/20)', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await page.goto(`${URLS.driver}/withdraw`);
    await byTestId(page, 'withdraw-amount').fill('50');
    await byTestId(page, 'payout-4821').click();
    await expect(byTestId(page, 'withdraw-preview')).toContainText(MAD(20));
    await byTestId(page, 'withdraw-confirm').click();
    await expect(byTestId(page, 'withdraw-pending')).toBeVisible();
    await expect(byTestId(page, 'withdraw-balance')).toContainText(MAD(70));
    await expect(byTestId(page, 'withdraw-reserved')).toContainText(MAD(50));
    await expect(byTestId(page, 'withdraw-available')).toContainText(MAD(20));
    await advance(8);
    await expect(byTestId(page, 'withdraw-confirmed')).toBeVisible();
    await expect(byTestId(page, 'withdraw-balance')).toContainText(MAD(20));
    await expect(byTestId(page, 'withdraw-reserved')).toContainText(/^.*0\sMAD/);
    await expect(byTestId(page, 'withdraw-available')).toContainText(MAD(20));
  });

  test('S13/S16 · failed withdrawal releases the reservation without a credit (70/0/70)', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await page.goto(`${URLS.driver}/withdraw`);
    await byTestId(page, 'withdraw-amount').fill('50');
    await byTestId(page, 'payout-0000').click();
    await byTestId(page, 'withdraw-confirm').click();
    await expect(byTestId(page, 'withdraw-pending')).toBeVisible();
    await advance(5);
    await expect(byTestId(page, 'withdraw-failed')).toBeVisible();
    await expect(byTestId(page, 'withdraw-failed-banner')).toContainText('aucun crédit');
    await expect(byTestId(page, 'withdraw-balance')).toContainText(MAD(70));
    await expect(byTestId(page, 'withdraw-available')).toContainText(MAD(70));
  });

  test('S16 · pending then refused recharge leaves the balance unchanged', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', PHONES.amina);
    await page.goto(`${URLS.driver}/recharge`);
    await byTestId(page, 'provider-card').click();
    await byTestId(page, 'recharge-continue').click();
    await expect(byTestId(page, 'provider-sandbox')).toBeVisible();
    await byTestId(page, 'sandbox-close').click();
    await expect(byTestId(page, 'recharge-pending')).toBeVisible();
    await expect(byTestId(page, 'recharge-balance')).toContainText(MAD(70));
    await byTestId(page, 'open-sandbox').click();
    await byTestId(page, 'sandbox-decline').click();
    await expect(byTestId(page, 'recharge-failed')).toBeVisible();
    await expect(byTestId(page, 'recharge-balance')).toContainText(MAD(70));
  });
});
