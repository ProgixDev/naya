import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { authed, byTestId, PHONES, resetScenario, signInMobile, tokenFor, URLS, api } from './helpers';

const FIXTURE = join(__dirname, '../../services/demo-api/fixtures/salma-selfie.jpg');
const tid = byTestId;

async function composeAgdalTrip(page: Page) {
  await tid(page, 'where-to').click();
  await tid(page, 'place-search').fill('Hay');
  await tid(page, 'place-rabat-hay-riad').click();
  await tid(page, 'stop-pickup').click();
  await tid(page, 'place-search').fill('Gare');
  await tid(page, 'place-rabat-gare').click();
  await tid(page, 'add-stop').click();
  await tid(page, 'place-search').fill('Agdal');
  await tid(page, 'place-rabat-agdal').click();
}

async function driver(phone = PHONES.amina) {
  const { token } = await tokenFor(phone, 'driver');
  return authed(token);
}

async function uploadStep(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  // Stacked screens stay mounted on the web: target the visible step only.
  await page.locator('[data-testid="import-photo"]:visible').click();
  await (await chooser).setFiles(FIXTURE);
  await page.locator('[data-testid="use-photo"]:visible').click();
}

test.describe('passenger', () => {
  test('S01 · registration: phone, OTP, identity, selfie and documents, submission is not approval', async ({ page }) => {
    await resetScenario('default');
    await page.goto(URLS.passenger + '/phone');
    await tid(page, 'phone-input').fill('677123456');
    await tid(page, 'send-code').click();
    await expect(tid(page, 'demo-code')).toContainText('123456');
    await tid(page, 'otp-input').fill('123456');
    await tid(page, 'first-name').fill('Yasmine');
    await tid(page, 'last-name').fill('Kabbaj');
    await tid(page, 'birth-date').fill('01051998');
    await tid(page, 'doc-number').fill('aa112233');
    await tid(page, 'identity-continue').click();
    for (let i = 0; i < 3; i++) await uploadStep(page);
    await expect(tid(page, 'review-id_back')).toContainText('Ajoutée');
    await tid(page, 'submit-identity').click();
    await expect(tid(page, 'status-pending')).toBeVisible();
    await expect(page.getByText('En attente de vérification')).toBeVisible();
  });

  test('S02 · correction requested: retake the flagged piece and resubmit', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.imane);
    await expect(tid(page, 'status-more')).toBeVisible();
    await expect(page.getByText('Le verso est coupé')).toBeVisible();
    await tid(page, 'fix-case').click();
    await uploadStep(page);
    await tid(page, 'submit-identity').click();
    await expect(tid(page, 'status-pending')).toBeVisible();
  });

  test('S02 · recoverable refusal can restart the file', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.rania);
    await expect(tid(page, 'status-rejected')).toBeVisible();
    await tid(page, 'reopen-case').click();
    await expect(tid(page, 'identity-continue')).toBeVisible();
  });

  test('S03 · immediate cash ride with an Agdal stop, driver approach to receipt', async ({ page }) => {
    await resetScenario('first-ride');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await composeAgdalTrip(page);
    await tid(page, 'see-quote').click();
    await expect(tid(page, 'fare-card')).toContainText('100');
    await expect(tid(page, 'payment-row')).toContainText('Espèces');
    await tid(page, 'confirm-booking').click();
    await expect(tid(page, 'ride-searching')).toBeVisible();

    const amina = await driver();
    await amina.post('/driver/online', { data: { online: true } });
    const status = await (await amina.get('/driver/status')).json();
    const rideId = status.offer.rideId as string;
    expect(rideId).toBe('NY-001');
    await amina.post(`/driver/offers/${status.offer.id}/accept`, { headers: { 'Idempotency-Key': 'e2e-accept' } });
    await expect(tid(page, 'ride-driver_assigned')).toBeVisible();
    await expect(tid(page, 'driver-card')).toContainText('Amina');
    await expect(tid(page, 'driver-card')).toContainText('DÉMO-001');
    await amina.post(`/driver/rides/${rideId}/arrive`);
    await expect(tid(page, 'ride-title')).toContainText('est arrivée');
    await amina.post(`/driver/rides/${rideId}/start`);
    await expect(tid(page, 'ride-in_progress')).toBeVisible();
    await amina.post(`/driver/rides/${rideId}/stop-complete`);
    await amina.post(`/driver/rides/${rideId}/complete`);
    await expect(tid(page, 'receipt')).toBeVisible();
    await expect(tid(page, 'receipt-amount')).toContainText('100');
    await expect(tid(page, 'payment-state')).toContainText('à remettre');
    await amina.post(`/driver/rides/${rideId}/cash-collected`, { data: { amount: 10000 } });
    await expect(tid(page, 'payment-state')).toContainText('paiement confirmé');
    await tid(page, 'star-5').click();
    await tid(page, 'send-rating').click();
    await expect(page.getByText('Merci, vous avez noté')).toBeVisible();
  });

  test('S05 · scheduled booking is recorded, modified and cancelled', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await tid(page, 'plan-trip').click();
    await tid(page, 'place-search').fill('Agdal');
    await tid(page, 'place-rabat-agdal').click();
    await tid(page, 'see-quote').click();
    await expect(tid(page, 'schedule-picker')).toBeVisible();
    await page.locator('[data-testid^="day-"]').nth(1).click();
    await page.locator('[data-testid="time-09:00"]').click();
    await tid(page, 'confirm-booking').click();
    await expect(tid(page, 'scheduled-detail')).toBeVisible();
    await expect(page.getByText('Aucune chauffeuse n’est encore confirmée')).toBeVisible();
    await tid(page, 'modify-scheduled').click();
    await page.locator('[data-testid="time-10:30"]').click();
    await tid(page, 'save-schedule').click();
    await expect(page.getByText('10h30').first()).toBeVisible();
    await tid(page, 'cancel-scheduled').click();
    await tid(page, 'confirm-cancel-scheduled-confirm').click();
    await expect(page.getByText('Annulée').first()).toBeVisible();
  });

  test('S06 · dynamic price is disclosed before commitment', async ({ page }) => {
    await resetScenario('dynamic-pricing');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await composeAgdalTrip(page);
    await tid(page, 'see-quote').click();
    await expect(tid(page, 'dynamic-banner')).toContainText('×1,2');
    await expect(tid(page, 'fare-card')).toContainText('120');
    await tid(page, 'fare-card').click();
    await expect(tid(page, 'fare-breakdown')).toContainText('Demande élevée');
    await expect(tid(page, 'fare-breakdown')).toContainText('+20');
  });

  test('S07 · out of zone, manual pickup pin, and no available driver with retry', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await tid(page, 'where-to').click();
    await tid(page, 'place-search').fill('Salé');
    await tid(page, 'place-sale-tabriquet').click();
    await expect(tid(page, 'out-of-zone')).toBeVisible();
    await expect(tid(page, 'see-quote')).toHaveAttribute('aria-disabled', 'true');
    await tid(page, 'stop-destination').click();
    await tid(page, 'place-search').fill('Agdal');
    await tid(page, 'place-rabat-agdal').click();
    await tid(page, 'pin-pickup').click();
    await expect(tid(page, 'pin-picker')).toBeVisible();
    await expect(tid(page, 'confirm-pin')).toBeEnabled();
    await tid(page, 'confirm-pin').click();
    await expect(tid(page, 'stop-pickup')).toBeVisible();
    await tid(page, 'see-quote').click();
    await tid(page, 'confirm-booking').click();
    await expect(tid(page, 'ride-searching')).toBeVisible();
    const ctx = await api();
    await ctx.post('/dev/clock/advance', { data: { seconds: 121 } });
    await expect(tid(page, 'no-driver')).toBeVisible();
    await tid(page, 'retry-search').click();
    await expect(tid(page, 'ride-searching')).toBeVisible();
  });

  test('S08 · passenger cancellation shows the fee before confirmation', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await composeAgdalTrip(page);
    await tid(page, 'see-quote').click();
    await tid(page, 'confirm-booking').click();
    await expect(tid(page, 'ride-searching')).toBeVisible();
    const amina = await driver();
    await amina.post('/driver/online', { data: { online: true } });
    const status = await (await amina.get('/driver/status')).json();
    await amina.post(`/driver/offers/${status.offer.id}/accept`, { headers: { 'Idempotency-Key': 'e2e-s08' } });
    await amina.post(`/driver/rides/${status.offer.rideId}/arrive`);
    await expect(tid(page, 'ride-driver_arrived')).toBeVisible();
    await tid(page, 'cancel-ride').click();
    await expect(tid(page, 'cancel-fee')).toContainText('15');
    await tid(page, 'reason-changed_plans').click();
    await expect(tid(page, 'confirm-cancel')).toContainText('Annuler et payer 15');
    await tid(page, 'confirm-cancel').click();
    await expect(tid(page, 'receipt')).toBeVisible();
    await expect(page.getByText('Course annulée')).toBeVisible();
    await expect(tid(page, 'receipt-amount')).toContainText('15');
  });

  test('S09 · driver cancellation: passenger sees the reason and a new search', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await composeAgdalTrip(page);
    await tid(page, 'see-quote').click();
    await tid(page, 'confirm-booking').click();
    const amina = await driver();
    await amina.post('/driver/online', { data: { online: true } });
    const status = await (await amina.get('/driver/status')).json();
    await amina.post(`/driver/offers/${status.offer.id}/accept`, { headers: { 'Idempotency-Key': 'e2e-s09' } });
    await expect(tid(page, 'ride-driver_assigned')).toBeVisible();
    await amina.post(`/driver/rides/${status.offer.rideId}/cancel`, { data: { reasonCode: 'vehicle_issue' } });
    await expect(tid(page, 'driver-cancelled')).toContainText('Problème de véhicule');
    await expect(tid(page, 'ride-searching')).toBeVisible();
  });

  test('S14 · history, receipt, support ticket and reply', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await tid(page, 'tab-trips').click();
    await page.getByRole('tab', { name: 'Historique' }).click();
    await tid(page, 'history-NY-001').click();
    await expect(tid(page, 'receipt')).toBeVisible();
    await tid(page, 'receipt-help').click();
    await tid(page, 'category-payment').click();
    await tid(page, 'ticket-subject').fill('Montant de la course NY-001');
    await tid(page, 'ticket-body').fill('Le montant ne correspond pas à ce que j’attendais.');
    await tid(page, 'submit-ticket').click();
    await expect(page.getByText('Demande reçue')).toBeVisible();
    // An agent replies from the administration.
    const ctx = await api();
    const login = await (await ctx.post('/admin/auth/login', { data: { email: 'meryem@naya.demo', password: 'Naya-Admin-2026' } })).json();
    const admin = await authed(login.token);
    const tickets = await (await admin.get('/admin/support?status=open')).json();
    const t = tickets.items.find((x: { rideId: string }) => x.rideId === 'NY-001');
    await admin.post(`/admin/support/${t.id}/messages`, { data: { body: 'Le prix affiché était 100 MAD, arrêt Agdal inclus.', attachments: [] } });
    await expect(page.getByText('arrêt Agdal inclus')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('L’équipe attend votre réponse')).toBeVisible();
    await tid(page, 'reply-input').fill('Merci pour la vérification.');
    await tid(page, 'send-reply').click();
    await expect(page.getByText('Merci pour la vérification.')).toBeVisible();
  });

  async function bookAndDrive(page: Page, card: string) {
    await composeAgdalTrip(page);
    await tid(page, 'see-quote').click();
    await tid(page, 'payment-row').click();
    await tid(page, `pm-${card}`).click();
    await expect(tid(page, 'payment-row')).toContainText(card);
    await tid(page, 'confirm-booking').click();
    await expect(tid(page, 'ride-searching')).toBeVisible();
    const amina = await driver();
    await amina.post('/driver/online', { data: { online: true } });
    const status = await (await amina.get('/driver/status')).json();
    await amina.post(`/driver/offers/${status.offer.id}/accept`, { headers: { 'Idempotency-Key': `e2e-${card}` } });
    return { amina, rideId: status.offer.rideId as string };
  }

  test('S04 · card payment stays pending until the provider confirms', async ({ page }) => {
    await resetScenario('after-cash');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    const { amina, rideId } = await bookAndDrive(page, '4242');
    expect(rideId).toBe('NY-002');
    for (const step of ['arrive', 'start', 'stop-complete', 'complete']) await amina.post(`/driver/rides/${rideId}/${step}`);
    await expect(tid(page, 'receipt')).toBeVisible();
    await expect(tid(page, 'payment-state')).toContainText(/en attente|confirmé/);
    await expect(tid(page, 'payment-state')).toContainText('Carte · paiement confirmé', { timeout: 20_000 });
  });

  test('S16 · stale tracking is explained; a refused card is paid with another card', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    const { amina, rideId } = await bookAndDrive(page, '0002');
    await expect(tid(page, 'ride-driver_assigned')).toBeVisible();
    const ctx = await api();
    await ctx.post(`/dev/tracking/${rideId}/freeze`);
    await ctx.post('/dev/clock/advance', { data: { seconds: 25 } });
    await expect(tid(page, 'stale-tracking')).toBeVisible();
    await ctx.post(`/dev/tracking/${rideId}/resume`);
    for (const step of ['arrive', 'start', 'stop-complete', 'complete']) await amina.post(`/driver/rides/${rideId}/${step}`);
    await expect(tid(page, 'receipt')).toBeVisible();
    await expect(tid(page, 'payment-state')).toContainText('Paiement refusé', { timeout: 20_000 });
    await page.getByText('Payer avec une autre carte').click();
    await tid(page, 'retry-4242').click();
    await expect(tid(page, 'payment-state')).toContainText('Carte · paiement confirmé', { timeout: 20_000 });
  });

  test('P13/P14 · add a sandbox card and a saved address', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.passenger, 'passenger', PHONES.salma);
    await tid(page, 'tab-account').click();
    await tid(page, 'account-payments').click();
    await tid(page, 'add-card').click();
    await tid(page, 'card-number').fill('4000000000000077');
    await tid(page, 'card-exp').fill('1230');
    await tid(page, 'card-cvc').fill('123');
    await tid(page, 'save-card').click();
    await expect(page.getByText('Carte de démonstration •••• 0077')).toBeVisible();
    await page.goto(URLS.passenger + '/places');
    await tid(page, 'add-place').click();
    await page.getByText('Autre', { exact: true }).click();
    await tid(page, 'place-query').fill('Tour');
    await page.getByText('Tour Hassan').first().click();
    await expect(page.getByText('Tour Hassan · Boulevard Mohamed Lyazidi, Rabat')).toBeVisible();
  });
});
