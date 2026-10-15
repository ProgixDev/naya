// Passenger (Salma): home, search, quote, schedule, trips, account, money, Famille, help, support, car wash.
import fs from 'node:fs';
import { chromium, PAX, OUT, PH, post, get, newPage, helpers, signIn } from './lib.mjs';
const SCHEME = process.argv[2] ?? 'light';
const A = SCHEME === 'light' ? 'passenger' : 'passenger-dark';
const log = [];
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
const page = await newPage(browser, SCHEME);
const { tid, step, S, go, ids, scrollShot } = helpers(page, A, log);
const t = await signIn(page, PAX, 'passenger', PH.salma);
await step('home idle', async () => { await S('05a-home-idle'); console.log('home', await ids()); await scrollShot('05b-home-idle-scrolled'); });
await step('city sheet', async () => { await go(PAX, '/', 2500); await tid('city-pill').click(); await page.waitForTimeout(900); await S('05c-home-city-sheet'); await page.keyboard.press('Escape'); });
await step('route', async () => {
  await go(PAX, '/', 2500);
  await tid('where-to').click(); await page.waitForTimeout(1000);
  await S('06a-route-search-empty'); console.log('route', await ids());
  await tid('place-search').fill('Gare'); await page.waitForTimeout(700);
  await S('06b-route-search-results');
  await tid('place-rabat-gare').click(); await page.waitForTimeout(3000);
  await S('06c-route-filled');
  await tid('add-stop').click(); await page.waitForTimeout(700); await tid('place-search').fill('Agdal'); await tid('place-rabat-agdal').click(); await page.waitForTimeout(3000);
  await S('06d-route-with-stop');
  await S('07a-quote'); console.log('quote', await ids());
  await scrollShot('07b-quote-scrolled');
});
await step('payment sheet', async () => { await tid('payment-row').click(); await page.waitForTimeout(1000); await S('07c-quote-payment-sheet'); console.log('pay', await ids()); await page.keyboard.press('Escape'); await page.waitForTimeout(600); });
await step('fare sheet', async () => { const fb = page.locator('[data-testid="fare-card"]:visible'); if (await fb.count()) { await fb.last().click(); await page.waitForTimeout(900); await S('07d-quote-fare-sheet'); await page.keyboard.press('Escape'); await page.waitForTimeout(600); } });
await step('schedule', async () => {
  await tid('when-chip').click(); await page.waitForTimeout(900); await tid('mode-schedule').click(); await page.waitForTimeout(1000); await S('07e-quote-schedule-picker'); console.log('sched', await ids());
});
await step('trips', async () => {
  await go(PAX, '/trips', 2500); await S('08a-trips-upcoming'); console.log('trips', await ids());
  await tid('trips-tabs').getByRole('tab', { name: 'Historique' }).click(); await page.waitForTimeout(1200); await S('08b-trips-history');
});
await step('scheduled detail', async () => {
  const r = await get('/rides?scope=upcoming', t.token); const list = Array.isArray(r) ? r : r?.items ?? r?.rides ?? [];
  console.log('upcoming', JSON.stringify(list).slice(0, 300));
  await go(PAX, '/trips', 2000);
  const row = page.locator('[data-testid^="trip-"]:visible, [data-testid^="ride-row-"]:visible').first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(2000); await S('08c-scheduled-detail'); console.log('sd', page.url(), await ids()); }
});
await step('receipt', async () => { await go(PAX, '/receipt/NY-001', 3000); await S('09a-receipt-past'); console.log('rcpt', await ids()); await scrollShot('09b-receipt-past-scrolled'); });
await step('account', async () => { await go(PAX, '/account', 2500); await S('10a-account'); await scrollShot('10b-account-scrolled'); });
await step('prefs', async () => { await go(PAX, '/preferences', 2500); await S('10c-preferences'); await scrollShot('10d-preferences-scrolled'); });
await step('places', async () => { await go(PAX, '/places', 2500); await S('10e-places'); });
await step('payments', async () => { await go(PAX, '/payments', 2500); await S('11a-payments'); await go(PAX, '/card/new', 2500); await S('11b-card-new'); });
await step('wallet', async () => {
  await go(PAX, '/wallet', 3000); await S('11c-wallet'); console.log('wallet', await ids()); await scrollShot('11d-wallet-scrolled');
  await go(PAX, '/wallet', 2500); await tid('wallet-recharge').click(); await page.waitForTimeout(1000); await S('11e-wallet-topup'); console.log('topup', await ids());
});
await step('famille', async () => {
  await go(PAX, '/family', 3000); await S('12a-famille-home'); console.log('fam', await ids()); await scrollShot('12b-famille-home-scrolled');
  await go(PAX, '/family/plans', 2500); await S('12c-famille-plans');
  await go(PAX, '/family', 2500); const inv = page.locator('[data-testid="famille-invite-open"]:visible'); if (await inv.count()) { await inv.last().click(); await page.waitForTimeout(900); await S('12d-famille-invite-sheet'); }
});
await step('help', async () => {
  await go(PAX, '/help', 2500); await S('13a-help'); await scrollShot('13b-help-scrolled');
  await go(PAX, '/help/safety', 2500); await S('13c-help-topic-safety');
  await go(PAX, '/help/trip', 2500); await S('13d-help-topic-trip');
  await go(PAX, '/support', 2500); await S('13e-support-list');
  await go(PAX, '/support/new?rideId=NY-001', 2500); await S('13f-support-new');
  const r = await post('/support/tickets', { category: 'other', subject: 'Objet perdu', body: 'J’ai oublié un sac dans la voiture.', rideId: 'NY-001' }, t.token);
  await go(PAX, `/support/${r.body.id}`, 2500); await S('13g-support-thread');
});
await step('brand', async () => { await go(PAX, '/brand', 2500); await S('14a-brand-concepts'); });
await step('car wash', async () => {
  await go(PAX, '/car-wash', 2500); await S('15a-carwash-home'); console.log('cw', await ids());
  await tid('car-wash-new').click(); await page.waitForTimeout(1500); await S('15b-carwash-place'); console.log('cw place', await ids());
  await page.locator('[data-testid^="car-wash-saved-"]:visible').first().click(); await page.waitForTimeout(400); await S('15c-carwash-place-selected');
  await tid('car-wash-continue').click(); await page.waitForTimeout(700); await S('15d-carwash-vehicle');
  await tid('car-wash-make').fill('Dacia'); await tid('car-wash-model').fill('Sandero'); await tid('car-wash-color').fill('Gris'); await tid('car-wash-plate').fill('12345-a-6');
  await tid('car-wash-continue').click(); await page.waitForTimeout(700); await S('15e-carwash-packages');
  await tid('car-wash-package-exterior').click(); await page.waitForTimeout(300);
  await tid('car-wash-continue').click(); await page.waitForTimeout(700); await S('15f-carwash-when'); console.log('when', await ids());
  const closed = await page.locator('[data-testid="car-wash-now-closed"]:visible').count();
  if (closed) { await tid('car-wash-timing').getByRole('tab', { name: 'Planifier' }).click(); await page.locator('[data-testid^="car-wash-day-"]:visible').nth(1).click(); await page.locator('[data-testid^="car-wash-time-"]:visible').first().click(); await page.waitForTimeout(300); await S('15g-carwash-when-scheduled'); }
  await tid('car-wash-continue').click(); await page.waitForTimeout(700); await S('15h-carwash-payment-summary'); console.log('pay', await ids()); await scrollShot('15i-carwash-payment-scrolled');
  await tid('car-wash-pay-cash').click(); await tid('car-wash-confirm').click(); await page.waitForTimeout(2500);
  const url = page.url(); await S('15j-carwash-order-booked');
  for (const [sec, n] of [[120, '15k-carwash-order-assigned'], [600, '15l-carwash-order-enroute'], [1800, '15m-carwash-order-washing'], [3 * 86400, '15n-carwash-order-completed']]) {
    await post('/dev/clock/advance', { seconds: sec }); await page.goto(url); await page.waitForTimeout(3000); await S(n);
  }
  await scrollShot('15o-carwash-completed-photos', 600);
  await scrollShot('15p-carwash-completed-photos-2', 600);
  await page.goto(url); await page.waitForTimeout(2500);
  await tid('car-wash-rating').scrollIntoViewIfNeeded(); await tid('car-wash-star-4').click(); await page.waitForTimeout(500); await S('15q-carwash-rating');
  const rate = page.locator('[data-testid="car-wash-rate"]:visible'); if (await rate.count()) { await rate.last().click(); await page.waitForTimeout(1500); await S('15r-carwash-rated'); }
  await go(PAX, '/car-wash', 2500); await S('15s-carwash-home-with-orders');
});
fs.writeFileSync(`${OUT}/${A}/_log-p2.json`, JSON.stringify({ errors: page.__errors, log }, null, 1));
await browser.close();
