import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { api, authed, PHONES, resetScenario, signInMobile, tokenFor, URLS } from './helpers';

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true };

/** Stacked screens stay mounted on the web: target the trip screen in its current status. */
const tripScreen = (page: Page, status: string) => page.getByTestId(`famille-trip-${status}`);

async function advanceClock(seconds: number) {
  const ctx = await api();
  await ctx.post('/dev/clock/advance', { data: { seconds } });
  await ctx.dispose();
}

async function twoPhones(browser: Browser) {
  const pc = await browser.newContext(phone);
  const dc = await browser.newContext(phone);
  return { pc, dc, p: await pc.newPage(), d: await dc.newPage() };
}

/** Salma's seeded family (Lina; Salma « Mère » holds code 1234), with one trip driven by Amina. */
async function exampleTrip() {
  const parent = await authed((await tokenFor(PHONES.salma, 'passenger')).token);
  const overview = await (await parent.post('/prototype/family/example')).json();
  const trip = overview.trips.find((t: { status: string }) => t.status === 'scheduled');
  expect(trip?.driverName).toContain('Amina');
  return { parent, tripId: trip.id as string };
}

test.describe('Naya Famille', () => {
  test('the start waits for the parent, the chauffeuse never receives the code, a wrong code is counted', async ({ browser }) => {
    test.setTimeout(150_000);
    await resetScenario('first-ride');
    const { pc, dc, p, d } = await twoPhones(browser);
    try {
      const { parent, tripId } = await exampleTrip();
      await signInMobile(p, URLS.passenger, 'passenger', PHONES.salma);
      await signInMobile(d, URLS.driver, 'driver', PHONES.amina);

      // P1: the chauffeuse's view of the family and of the trip carries no handover code.
      const driver = await authed((await tokenFor(PHONES.amina, 'driver')).token);
      expect(JSON.stringify(await (await driver.get('/prototype/family')).json())).not.toContain('verificationCode');
      expect(JSON.stringify(await (await driver.get(`/prototype/family/trips/${tripId}`)).json())).not.toContain('verificationCode');
      expect(JSON.stringify(await (await parent.get('/prototype/family')).json())).toContain('verificationCode');

      // Chauffeuse: depart, arrive, photograph Lina, confirm her first name, ask to start.
      await d.goto(`${URLS.driver}/family/${tripId}`);
      await tripScreen(d, 'scheduled').getByTestId('famille-depart').click();
      await tripScreen(d, 'en_route').getByTestId('famille-arrive').click();
      await tripScreen(d, 'arrived').getByTestId('famille-pickup-camera').click();
      await tripScreen(d, 'arrived').getByTestId('famille-child-name').fill('Lina');
      await tripScreen(d, 'arrived').getByTestId('famille-pickup').click();
      await tripScreen(d, 'picked_up').getByTestId('famille-request-start').click();
      await expect(tripScreen(d, 'awaiting_approval').getByTestId('famille-waiting-approval')).toBeVisible();
      // No approval yet: the trip cannot be forced forward.
      const forced = await driver.post(`/prototype/family/trips/${tripId}/advance`, { data: { expectedStatus: 'awaiting_approval' } });
      expect(forced.status()).toBeGreaterThanOrEqual(400);

      // Parent (P-62): the request is a banner pinned over whatever she is doing, never a route change. It opens
      // the pickup photo and a 3-minute countdown in a sheet; she approves remotely.
      await expect(p.getByTestId('famille-approval-banner')).toBeVisible({ timeout: 15_000 });
      await p.getByTestId('famille-approval-banner').click();
      const approval = p.getByTestId('famille-approval-sheet').getByTestId('famille-approval');
      await expect(approval).toBeVisible();
      await expect(approval).toContainText('Amina demande à démarrer');
      await expect(approval).toContainText(/Répondez dans [0-3] min/);
      await approval.getByTestId('famille-approve-remote').click();
      await expect(p.getByTestId('famille-approval-banner')).toBeHidden({ timeout: 15_000 });
      await p.goto(`${URLS.passenger}/family/${tripId}`);
      await expect(tripScreen(p, 'in_progress').getByTestId('famille-trip-title')).toContainText('Lina · Trajet en cours');
      await expect(tripScreen(p, 'in_progress').getByTestId('famille-live-map')).toBeVisible();
      await expect(tripScreen(d, 'in_progress').getByTestId('famille-driver-steps')).toBeVisible({ timeout: 15_000 });

      // At the school (the mock route): photo, authorised adult, then a wrong code is refused and counted.
      await advanceClock(60);
      await d.reload();
      const steps = tripScreen(d, 'in_progress').getByTestId('famille-driver-steps');
      await steps.getByTestId('famille-dropoff-camera').click();
      await steps.getByRole('button', { name: 'Salma · Mère', exact: true }).click();
      await steps.getByTestId('famille-code').fill('0000');
      await steps.getByTestId('famille-dropoff').click();
      await expect(steps.getByTestId('famille-code-attempts')).toContainText('4 essais restants');
      await steps.getByTestId('famille-code').fill('1234');
      await steps.getByTestId('famille-dropoff').click();

      // Both sides see the trip closed, with the approval and the handover in the timeline.
      await expect(tripScreen(p, 'completed').getByTestId('famille-trip-title')).toContainText('Déposé · photo et remise confirmées', { timeout: 15_000 });
      const timeline = tripScreen(p, 'completed').getByTestId('famille-timeline');
      await expect(timeline).toContainText('Départ approuvé à distance par Salma');
      await expect(timeline).toContainText('Remise confirmée à Salma');
      await parent.dispose();
      await driver.dispose();
    } finally {
      await pc.close();
      await dc.close();
    }
  });

  test('P1 · five wrong handover codes lock the handover on both phones', async ({ browser }) => {
    test.setTimeout(150_000);
    await resetScenario('first-ride');
    const { pc, dc, p, d } = await twoPhones(browser);
    try {
      const { parent, tripId } = await exampleTrip();
      const driver = await authed((await tokenFor(PHONES.amina, 'driver')).token);
      const step = async (ctx: APIRequestContext, data: Record<string, string>) => {
        const r = await ctx.post(`/prototype/family/trips/${tripId}/advance`, { data });
        expect(r.ok(), await r.text()).toBeTruthy();
      };
      // Up to the parent's approval through the API; the handover itself happens on screen.
      await step(driver, { expectedStatus: 'scheduled' });
      await step(driver, { expectedStatus: 'en_route' });
      await step(driver, { expectedStatus: 'arrived', proof: 'demo-pickup-photo', childName: 'Lina' });
      await step(driver, { expectedStatus: 'picked_up' });
      const waiting = await (await parent.get(`/prototype/family/trips/${tripId}`)).json();
      const approved = await parent.post(`/prototype/family/trips/${tripId}/approval`, {
        data: { decision: 'approve', mode: 'on_site', approvalId: waiting.approval.id },
        headers: { 'Idempotency-Key': `e2e-famille-${Date.now()}` },
      });
      expect(approved.ok(), await approved.text()).toBeTruthy();
      await advanceClock(60);

      await signInMobile(d, URLS.driver, 'driver', PHONES.amina);
      await d.goto(`${URLS.driver}/family/${tripId}`);
      const steps = tripScreen(d, 'in_progress').getByTestId('famille-driver-steps');
      await steps.getByTestId('famille-dropoff-camera').click();
      await steps.getByRole('button', { name: 'Salma · Mère', exact: true }).click();
      const expected = ['4 essais restants', '3 essais restants', '2 essais restants', 'dernier essai'];
      for (const left of expected) {
        await steps.getByTestId('famille-code').fill('0000');
        await steps.getByTestId('famille-dropoff').click();
        await expect(steps.getByTestId('famille-code-attempts')).toContainText(left);
      }
      await steps.getByTestId('famille-code').fill('0000');
      await steps.getByTestId('famille-dropoff').click();

      // Locked: no drop-off form any more, a banner on both phones, and the right code is refused too.
      await expect(tripScreen(d, 'in_progress').getByTestId('famille-handover-locked')).toContainText('5 codes incorrects');
      await expect(tripScreen(d, 'in_progress').getByTestId('famille-dropoff')).toHaveCount(0);
      await signInMobile(p, URLS.passenger, 'passenger', PHONES.salma);
      await p.goto(`${URLS.passenger}/family/${tripId}`);
      await expect(tripScreen(p, 'in_progress').getByTestId('famille-handover-locked')).toContainText('la chauffeuse ne confiera pas l’enfant');
      const late = await driver.post(`/prototype/family/trips/${tripId}/advance`, { data: { expectedStatus: 'in_progress', proof: 'demo-dropoff-photo', recipientId: 'mother', code: '1234' } });
      expect(late.status()).toBeGreaterThanOrEqual(400);
      expect((await (await parent.get(`/prototype/family/trips/${tripId}`)).json()).status).toBe('in_progress');
      await parent.dispose();
      await driver.dispose();
    } finally {
      await pc.close();
      await dc.close();
    }
  });
});
