// Passenger visual review: signs in demo accounts and captures routes at a phone width.
// Usage: node scripts/pax-shots.mjs [width=390] [only-prefix]
import { chromium } from '@playwright/test';

const WEB = process.env.PASSENGER_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4010';
const W = Number(process.argv[2] ?? 390);
const ONLY = process.argv[3];
const OUT = new URL(`../../docs/screens/passenger/${W === 390 ? '' : `${W}/`}`, import.meta.url).pathname;

async function token(phone) {
  await fetch(`${API}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, role: 'passenger' }) });
  const r = await fetch(`${API}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, role: 'passenger', code: '123456' }) });
  const b = await r.json();
  return { token: b.token, accountId: b.user.id };
}

const SHOTS = [
  { name: 'P01-onboarding', phone: null, path: '/welcome' },
  { name: 'P02-phone', phone: null, path: '/phone' },
  { name: 'P04-identity', phone: '+212677000111', path: '/identity' },
  { name: 'P05-pending', phone: '+212623456789', path: '/verification-status' },
  { name: 'P05-more', phone: '+212634567890', path: '/verification-status' },
  { name: 'P05-rejected', phone: '+212645678901', path: '/verification-status' },
  { name: 'P06-home', phone: '+212612345678', path: '/' },
  { name: 'P07-route', phone: '+212612345678', path: '/route', draft: true },
  { name: 'P08-quote', phone: '+212612345678', path: '/quote', draft: true },
  { name: 'P12-trips', phone: '+212612345678', path: '/trips' },
  { name: 'P13-account', phone: '+212612345678', path: '/account' },
  { name: 'P13-preferences', phone: '+212612345678', path: '/preferences' },
  { name: 'P13-places', phone: '+212612345678', path: '/places' },
  { name: 'P14-payments', phone: '+212612345678', path: '/payments' },
  { name: 'P14-card', phone: '+212612345678', path: '/card/new' },
  { name: 'P15-help', phone: '+212612345678', path: '/help' },
  { name: 'P11-receipt', phone: '+212612345678', path: '/receipt/NY-001' },
  { name: 'P11-receipt-card', phone: '+212612345678', path: '/receipt/NY-002' },
  { name: 'P16-support', phone: '+212612345678', path: '/support' },
  { name: 'P16-new', phone: '+212612345678', path: '/support/new?rideId=NY-001' },
];

const browser = await chromium.launch();
for (const s of SHOTS.filter((x) => !ONLY || x.name.startsWith(ONLY))) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${s.name}] pageerror`, e.message));
  await page.goto(WEB);
  await page.evaluate(() => localStorage.setItem('naya.passenger.prefs', JSON.stringify({ state: { onboardingDone: true, cityId: 'rabat' }, version: 1 })));
  if (s.name === 'P01-onboarding') await page.evaluate(() => localStorage.removeItem('naya.passenger.prefs'));
  if (s.phone) {
    const t = await token(s.phone);
    await page.evaluate((v) => sessionStorage.setItem('naya.passenger.session', v), JSON.stringify(t));
  }
  await page.goto(WEB + s.path);
  await page.waitForTimeout(2500);
  if (s.draft) {
    // Compose Gare → Agdal → Hay Riad through the UI.
    await page.goto(WEB + '/');
    await page.waitForTimeout(1500);
    await page.locator('[data-testid="where-to"]').click();
    await page.locator('[data-testid="place-search"]').fill('Hay');
    await page.locator('[data-testid="place-rabat-hay-riad"]').click();
    await page.locator('[data-testid="stop-pickup"]').click();
    await page.locator('[data-testid="place-search"]').fill('Gare');
    await page.locator('[data-testid="place-rabat-gare"]').click();
    await page.locator('[data-testid="add-stop"]').click();
    await page.locator('[data-testid="place-search"]').fill('Agdal');
    await page.locator('[data-testid="place-rabat-agdal"]').click();
    await page.waitForTimeout(600);
    if (s.path === '/quote') {
      await page.locator('[data-testid="see-quote"]').click();
      await page.waitForTimeout(2500);
    }
  }
  await page.screenshot({ path: `${OUT}${s.name}.png` });
  console.log('saved', s.name);
  await ctx.close();
}
await browser.close();
