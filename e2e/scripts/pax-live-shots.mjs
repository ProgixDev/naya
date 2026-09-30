// Captures the passenger live-ride states against the demo API (driver actions via API).
import { chromium } from '@playwright/test';

const WEB = process.env.PASSENGER_URL ?? 'http://localhost:8083';
const API = process.env.API_URL ?? 'http://localhost:4011';
const W = Number(process.argv[2] ?? 390);
const OUT = new URL(`../../docs/screens/passenger/${W === 390 ? '' : `${W}/`}`, import.meta.url).pathname;
const j = (r) => r.json();
const post = (path, body, token, key) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body ?? {}) });
const get = (path, token) => fetch(API + path, { headers: { Authorization: `Bearer ${token}` } }).then(j);
async function login(phone, role) {
  await post('/auth/otp/request', { phone, role });
  const b = await post('/auth/otp/verify', { phone, role, code: '123456' }).then(j);
  return { token: b.token, accountId: b.user.id };
}
const browser = await chromium.launch();
async function page(scenario, phone = '+212612345678') {
  await post('/dev/reset', { scenario });
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(WEB);
  const t = await login(phone, 'passenger');
  await p.evaluate(([s]) => { sessionStorage.setItem('naya.passenger.session', s); localStorage.setItem('naya.passenger.prefs', JSON.stringify({ state: { onboardingDone: true, cityId: 'rabat' }, version: 1 })); }, [JSON.stringify(t)]);
  await p.goto(WEB + '/');
  await p.waitForTimeout(1800);
  return p;
}
const shot = async (p, name, wait = 1800) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${OUT}${name}.png` }); console.log('saved', name); };
const tid = (p, id) => p.locator(`[data-testid="${id}"]:visible`);
async function compose(p) {
  await tid(p, 'where-to').click();
  await tid(p, 'place-search').fill('Hay'); await tid(p, 'place-rabat-hay-riad').click();
  await tid(p, 'stop-pickup').click(); await tid(p, 'place-search').fill('Gare'); await tid(p, 'place-rabat-gare').click();
  await tid(p, 'add-stop').click(); await tid(p, 'place-search').fill('Agdal'); await tid(p, 'place-rabat-agdal').click();
  await tid(p, 'see-quote').click();
}

// Home extras
let p = await page('default');
await tid(p, 'city-pill').click(); await shot(p, 'P06-city');
await p.keyboard.press('Escape');
await p.goto(WEB + '/'); await p.waitForTimeout(1500);
await tid(p, 'locate').click(); await shot(p, 'P06-permission');
await p.goto(WEB + '/route?pin=1'); await shot(p, 'P07-map', 2500);
await p.goto(WEB + '/'); await p.waitForTimeout(1500);
await tid(p, 'where-to').click(); await tid(p, 'place-search').fill('Salé'); await tid(p, 'place-sale-tabriquet').click(); await shot(p, 'P07-out-of-zone');
await p.context().close();

// Dynamic quote
p = await page('dynamic-pricing'); await compose(p); await shot(p, 'P08-dynamic', 2500);
await tid(p, 'fare-card').click(); await shot(p, 'P08-price');
await p.context().close();

// Schedule mode
p = await page('default'); await compose(p); await tid(p, 'mode').getByText('Planifier').click(); await shot(p, 'P08-schedule');
await p.context().close();

// Live ride
p = await page('default'); await compose(p); await p.waitForTimeout(1200);
await tid(p, 'confirm-booking').click(); await shot(p, 'P09-searching', 2500);
await post('/dev/clock/advance', { seconds: 50 }); await shot(p, 'P09-long', 2800);
const amina = await login('+212661234567', 'driver');
await post('/driver/online', { online: true }, amina.token);
const st = await get('/driver/status', amina.token);
const rideId = st.offer.rideId;
await post(`/driver/offers/${st.offer.id}/accept`, {}, amina.token, 'shot-accept');
await shot(p, 'P10-approaching', 3500);
await tid(p, 'contact').click(); await shot(p, 'P10-contact'); await p.keyboard.press('Escape'); await p.reload(); await p.waitForTimeout(2000);
await post(`/driver/rides/${rideId}/arrive`, {}, amina.token);
await shot(p, 'P10-arrived', 3000);
await tid(p, 'cancel-ride').click(); await tid(p, 'reason-changed_plans').click(); await shot(p, 'P10-cancel', 2500);
await p.reload(); await p.waitForTimeout(2000);
await post(`/driver/rides/${rideId}/start`, {}, amina.token);
await shot(p, 'P10-trip', 4000);
await post(`/dev/tracking/${rideId}/freeze`); await post('/dev/clock/advance', { seconds: 25 });
await shot(p, 'P10-stale', 3000);
await post(`/dev/tracking/${rideId}/resume`);
await post(`/driver/rides/${rideId}/stop-complete`, {}, amina.token);
await post(`/driver/rides/${rideId}/complete`, {}, amina.token);
await shot(p, 'P11-cash-pending', 4000);
await p.context().close();

// No driver + driver cancelled + card failure
p = await page('default'); await compose(p); await p.waitForTimeout(1200); await tid(p, 'confirm-booking').click(); await p.waitForTimeout(1500);
await post('/dev/clock/advance', { seconds: 125 }); await shot(p, 'P09-none', 3000);
await p.context().close();
p = await page('default'); await compose(p); await p.waitForTimeout(1200); await tid(p, 'confirm-booking').click(); await p.waitForTimeout(1500);
const amina2 = await login('+212661234567', 'driver');
Object.assign(amina, amina2);
await post('/driver/online', { online: true }, amina.token);
const st2 = await get('/driver/status', amina.token);
await post(`/driver/offers/${st2.offer.id}/accept`, {}, amina.token, 'shot-accept-2');
await p.waitForTimeout(2500);
await post(`/driver/rides/${st2.offer.rideId}/cancel`, { reasonCode: 'vehicle_issue' }, amina.token);
await shot(p, 'P10-driver-cancel', 3000);
await p.context().close();
p = await page('default'); await compose(p); await tid(p, 'payment-row').click(); await tid(p, 'pm-0002').click(); await p.waitForTimeout(600);
await tid(p, 'confirm-booking').click(); await p.waitForTimeout(1500);
Object.assign(amina, await login('+212661234567', 'driver'));
await post('/driver/online', { online: true }, amina.token);
const st3 = await get('/driver/status', amina.token);
await post(`/driver/offers/${st3.offer.id}/accept`, {}, amina.token, 'shot-accept-3');
for (const s of ['arrive', 'start', 'stop-complete', 'complete']) await post(`/driver/rides/${st3.offer.rideId}/${s}`, {}, amina.token);
await shot(p, 'P11-pending', 2500);
await shot(p, 'P11-failed', 5000);
await p.context().close();
await browser.close();
