// Drives the driver web app through its main states and saves 390-pt screenshots
// to docs/screens/driver. Usage: node scripts/driver-review.mjs [--api URL] [--app URL] [--w 390] [--scale 1]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const API = opt('--api', 'http://localhost:4012');
const APP = opt('--app', 'http://localhost:8084');
const OUT = opt('--out', '../docs/screens/driver');
const W = Number(opt('--w', '390'));
const H = Number(opt('--h', '844'));
const suffix = opt('--suffix', '');
const only = opt('--only', '');

const j = (r) => r.json();
const post = (path, body, token, key) => fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body ?? {}) });
const get = (path, token) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
async function token(phone, role) {
  await post('/auth/otp/request', { phone, role });
  const b = await j(await post('/auth/otp/verify', { phone, role, code: '123456' }));
  return { token: b.token, accountId: b.user.id };
}
const reset = (scenario) => post('/dev/reset', { scenario });
const STOPS = [
  { id: 'rabat-gare', label: 'Gare Rabat Ville', address: 'Avenue Mohammed V, Rabat', location: { lat: 34.0166, lng: -6.8356 } },
  { id: 'rabat-agdal', label: 'Agdal', address: 'Avenue de France, Agdal, Rabat', location: { lat: 33.9993, lng: -6.8511 } },
  { id: 'rabat-hay-riad', label: 'Hay Riad', address: 'Avenue Annakhil, Rabat', location: { lat: 33.9594, lng: -6.8747 } },
];
async function book(card) {
  const { token: t } = await token('+212612345678', 'passenger');
  const q = await j(await post('/quotes', { cityId: 'rabat', stops: STOPS }, t));
  const pms = await j(await get('/payment-methods', t));
  const pm = card ? pms.find((m) => m.last4 === card) : pms.find((m) => m.kind === 'cash');
  return j(await post('/rides', { quoteId: q.id, paymentMethodId: pm.id }, t, `rv-${Date.now()}`));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, geolocation: { latitude: 34.0205, longitude: -6.831 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const tid = (id) => page.locator(`[data-testid="${id}"]`).first();
async function signIn(phone) {
  const s = await token(phone, 'driver');
  await page.goto(APP);
  await page.evaluate((v) => {
    sessionStorage.setItem('naya.driver.session', v);
    localStorage.setItem('naya.driver.prefs', JSON.stringify({ state: { onboardingDone: true, demoPositionAccepted: false }, version: 1 }));
  }, JSON.stringify(s));
  await page.goto(APP);
  await page.waitForTimeout(2500);
  return s;
}
async function shot(name) {
  if (only && !name.startsWith(only)) return;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}${suffix}.png` });
  console.log('saved', name);
}
const TABS = { '/earnings': 'tab-earnings', '/wallet': 'tab-wallet', '/account': 'tab-account' };
async function visit(path, name) {
  await page.goto(`${APP}${path}`);
  if (TABS[path]) {
    await page.waitForTimeout(1500);
    const tab = page.locator(`[data-testid="${TABS[path]}"]`).first();
    if (await tab.isVisible()) await tab.click();
  }
  await page.waitForTimeout(2200);
  await shot(name);
}

// Signed out
await reset('default');
await page.goto(APP);
await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('naya.driver.prefs'); });
await page.goto(APP);
await page.waitForTimeout(3000);
await shot('D01-welcome');
await tid('onboarding-next').click();
await shot('D01b-wallet');
await tid('onboarding-next').click();
await tid('phone-input').fill('661234567');
await shot('D02-phone');
await tid('send-code').click();
await page.waitForTimeout(1500);
await shot('D03-otp');
await tid('send-code').isVisible().catch(() => false);

// Amina online, offer, ride
await reset('first-ride');
await signIn('+212661234567');
await shot('D06-offline');
await tid('toggle-online').click();
await page.waitForTimeout(1500);
await shot('D06-online');
const ride = await book();
await page.waitForTimeout(3500);
await shot('D07-offer');
await tid('accept-offer').click();
await page.waitForTimeout(2500);
await shot('D08-pickup');
await tid('contact-passenger').click();
await shot('D08-contact');
await page.keyboard.press('Escape');
await page.goto(`${APP}/ride`);
await page.waitForTimeout(2500);
await tid('ride-cancel').click();
await shot('D08-cancel');
await page.goto(`${APP}/ride`);
await page.waitForTimeout(2500);
await tid('ride-arrive').click();
await shot('D08-arrived');
await tid('ride-start').click();
await page.waitForTimeout(2500);
await shot('D09-trip');
await tid('ride-stop').click();
await shot('D09-stop');
await tid('ride-complete').click();
await page.waitForTimeout(2000);
await shot('D10-cash');
await tid('confirm-cash').click();
await shot('D10-cash-confirmed');
void ride;

// Card ride → pending then confirmed
await tid('ride-end-home').click();
await page.waitForTimeout(1500);
await book('4242');
await page.waitForTimeout(3500);
await tid('accept-offer').click();
await page.waitForTimeout(2000);
for (const b of ['ride-arrive', 'ride-start', 'ride-stop', 'ride-complete']) { await tid(b).waitFor({ timeout: 15000 }); await tid(b).click(); await page.waitForTimeout(2500); }
await shot('D10-pending');
await page.waitForTimeout(4500);
await shot('D10-electronic');

await visit('/earnings', 'D11-earnings');
await visit('/wallet', 'D12-wallet');
await tid('wallet-available').click();
await shot('D12-definition');
await visit('/ledger', 'D13-ledger');
await page.locator('[data-testid^="ledger-filter-"]').nth(1).click();
await shot('D13-filter');
await visit('/rides', 'D16-history');
await visit('/rides/NY-001', 'D16-detail');
await visit('/account', 'D17-account');
await visit('/profile/vehicle', 'D17-vehicle');
await visit('/profile/preferences', 'D17-settings');
await visit('/docs/status', 'D05-approved');
await visit('/support', 'D18-list');
await visit('/support/new', 'D18-form');

// Withdrawal (default scenario: 70 MAD)
await reset('default');
await signIn('+212661234567');
await visit('/withdraw', 'D15-withdraw');
await tid('withdraw-confirm').click();
await page.waitForTimeout(2000);
await shot('D15-pending');
await post('/dev/clock/advance', { seconds: 9 });
await page.waitForTimeout(3000);
await shot('D15-success');
await visit('/wallet', 'D12-after');
await visit('/withdraw', 'D15-insufficient-empty');
await page.locator('[data-testid="withdraw-amount"]').fill('500');
await shot('D15-insufficient');

// Recharge flow and debt (Leila)
await reset('default');
await signIn('+212664567890');
await shot('D06-debt');
await visit('/recharge', 'D14-debt');
await tid('provider-card').click();
await tid('recharge-continue').click();
await page.waitForTimeout(2500);
await shot('D14-provider');
await tid('sandbox-close').click();
await page.waitForTimeout(2000);
await shot('D14-pending');
await tid('open-sandbox').click();
await page.waitForTimeout(1500);
await tid('sandbox-approve').click();
await page.waitForTimeout(3000);
await shot('D14-success');
await tid('recharge-done').click();
await page.waitForTimeout(2500);
await shot('D06-restored');

// Dossier states
await signIn('+212662345678');
await shot('D06-docs');
await visit('/docs/status', 'D05-vehicle-pending');
await signIn('+212665678901');
await visit('/docs/status', 'D05-more');
await visit('/docs/start', 'D04-hub');

// New driver registration
await page.evaluate(() => sessionStorage.clear());
const fresh = await token(`+2126770${String(Date.now()).slice(-5)}`, 'driver');
await page.evaluate((v) => sessionStorage.setItem('naya.driver.session', v), JSON.stringify(fresh));
await page.goto(APP);
await page.waitForTimeout(3000);
await shot('D04-new');
await visit('/docs/identity', 'D04-identity');
await visit('/docs/vehicle', 'D04-car');
await visit('/docs/capture/driving_licence', 'D04-permit');

await browser.close();
