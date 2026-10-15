// Ride flow across passenger (Salma) and driver (Amina), plus Famille live trip and home with an active ride.
import fs from 'node:fs';
import { chromium, PAX, DRV, OUT, PH, post, get, newPage, helpers, signIn } from './lib.mjs';
const SCHEME = process.argv[2] ?? 'light';
const PA = SCHEME === 'light' ? 'passenger' : 'passenger-dark';
const DA = SCHEME === 'light' ? 'driver' : 'driver-dark';
const log = [];
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
const pp = await newPage(browser, SCHEME); const P = helpers(pp, PA, log);
const dp = await newPage(browser, SCHEME); const D = helpers(dp, DA, log);
const tp = await signIn(pp, PAX, 'passenger', PH.salma);
await signIn(dp, DRV, 'driver', PH.amina);
await D.step('driver home offline', async () => { await D.S('20a-home-offline'); console.log('drv home', await D.ids()); await D.scrollShot('20b-home-offline-scrolled'); });
await D.step('online', async () => { await D.tid('toggle-online').click(); await dp.waitForTimeout(1500); await D.S('20c-home-online'); });
const fam = await post('/dev/family/play', { driver: true, parent: null }, tp.token);
console.log('family', fam.status, fam.body?.id, fam.body?.status);
await P.step('book', async () => {
  await P.go(PAX, '/', 3000);
  await P.tid('where-to').click(); await pp.waitForTimeout(800);
  await P.tid('place-search').fill('Gare'); await P.tid('place-rabat-gare').click(); await pp.waitForTimeout(1500);
  await P.tid('add-stop').click(); await pp.waitForTimeout(600); await P.tid('place-search').fill('Agdal'); await P.tid('place-rabat-agdal').click(); await pp.waitForTimeout(1500);
  await pp.waitForTimeout(3000);
  await P.tid('confirm-booking').click(); await pp.waitForTimeout(1500);
  await P.S('16a-ride-searching'); console.log('searching', await P.ids());
});
await D.step('offer', async () => {
  await dp.waitForSelector('[data-testid="offer-pending"]', { timeout: 20000 }); await dp.waitForTimeout(800);
  await D.S('21a-offer'); console.log('offer', await D.ids());
  const dec = dp.locator('[data-testid="decline-offer"]:visible');
  if (await dec.count()) { await dec.last().click(); await dp.waitForTimeout(900); await D.S('21b-offer-decline-sheet'); console.log('decline', await D.ids()); await dp.keyboard.press('Escape'); await dp.waitForTimeout(700); }
  await D.tid('accept-offer').click(); await dp.waitForTimeout(2500);
  await D.S('22a-ride-assigned'); console.log('ride', await D.ids());
});
await P.step('assigned', async () => {
  await pp.waitForSelector('[data-testid="ride-driver_assigned"]', { timeout: 15000 }).catch(() => {}); await pp.waitForTimeout(1500);
  await P.S('16b-ride-driver-assigned'); console.log('assigned', await P.ids());
  await P.scrollShot('16c-ride-driver-assigned-scrolled', 500);
});
await P.step('contact sheet', async () => { const c = pp.locator('[data-testid="contact"]:visible'); console.log('contact count', await c.count()); if (await c.count()) { await c.last().click(); await pp.waitForTimeout(900); await P.S('16d-ride-contact-sheet'); await pp.keyboard.press('Escape'); await pp.waitForTimeout(600); } });
await P.step('sos sheet', async () => { await P.tid('sos').click({ timeout: 8000 }); await pp.waitForTimeout(1000); await P.S('16e-ride-sos-sheet-banner'); console.log('sos', await P.ids()); await pp.keyboard.press('Escape'); await pp.waitForTimeout(700); });
await P.step('cancel sheet', async () => { const c = pp.locator('[data-testid="cancel-ride"]:visible'); if (await c.count()) { await c.last().click(); await pp.waitForTimeout(900); await P.S('16f-ride-cancel-sheet'); await pp.keyboard.press('Escape'); await pp.waitForTimeout(700); } });
await P.step('home active ride + famille', async () => {
  await P.go(PAX, '/', 3500); await P.S('17a-home-active-ride-famille'); console.log('home active', await P.ids());
  const fl = pp.locator('[data-testid="home-famille-live"]:visible');
  if (await fl.count()) { await fl.last().click(); await pp.waitForTimeout(2500); await P.S('18a-famille-trip-live'); console.log('famtrip', pp.url(), await P.ids()); await P.scrollShot('18b-famille-trip-live-scrolled'); await P.scrollShot('18c-famille-trip-live-scrolled-2'); }
});
await D.step('driver home during ride', async () => { await D.go(DRV, '/', 3000); await D.S('20d-home-with-active-ride'); await D.tid('resume-ride').click(); await dp.waitForTimeout(2000); });
await D.step('driver contact', async () => { const c = dp.locator('[data-testid="sos"]:visible'); if (await c.count()) { await c.last().click(); await dp.waitForTimeout(900); await D.S('22b-ride-contact-sheet'); await dp.keyboard.press('Escape'); await dp.waitForTimeout(600); } });
await D.step('driver cancel', async () => { const c = dp.locator('[data-testid="ride-cancel"]:visible'); if (await c.count()) { await c.last().click(); await dp.waitForTimeout(900); await D.S('22c-ride-cancel-sheet'); await dp.keyboard.press('Escape'); await dp.waitForTimeout(600); } });
await D.step('arrive', async () => { await D.tid('ride-arrive').click(); await dp.waitForTimeout(2000); await D.S('22d-ride-arrived'); });
await P.step('p arrived', async () => { await P.go(PAX, '/ride', 3000); await P.S('16g-ride-driver-arrived'); });
await D.step('start', async () => { await D.tid('ride-start').click(); await dp.waitForTimeout(2000); await D.S('22e-ride-in-progress-stop1'); });
await P.step('p progress', async () => { await pp.waitForTimeout(1500); await P.S('16h-ride-in-progress'); await P.scrollShot('16i-ride-in-progress-scrolled', 500); });
await D.step('stop', async () => { await D.tid('ride-stop').click(); await dp.waitForTimeout(2000); await D.S('22f-ride-in-progress-final'); });
await D.step('complete', async () => { await D.tid('ride-complete').click(); await dp.waitForTimeout(2500); await D.S('23a-ride-end-cash-pending'); console.log('end', await D.ids()); });
await P.step('p receipt', async () => { await pp.waitForTimeout(2500); await P.S('16j-ride-completed-receipt'); console.log('rcpt', await P.ids()); await P.scrollShot('16k-ride-completed-receipt-scrolled', 500); });
await D.step('confirm cash', async () => { await D.tid('confirm-cash').click(); await dp.waitForTimeout(2000); await D.S('23b-ride-end-cash-confirmed'); });
await P.step('p receipt confirmed', async () => { await pp.waitForTimeout(2500); await P.S('16l-receipt-payment-confirmed'); const tg = pp.locator('[data-testid="receipt-detail-toggle"]:visible'); if (await tg.count()) { await tg.last().click(); await pp.waitForTimeout(600); await P.S('16m-receipt-fare-detail'); } });
await D.step('driver home after', async () => { await D.tid('ride-end-home').click(); await dp.waitForTimeout(2000); await D.S('20e-home-after-ride'); });
// No driver found: driver goes offline, passenger books, clock runs past the search window.
await D.step('offline', async () => { await D.tid('toggle-online').click(); await dp.waitForTimeout(1200); });
await P.step('no driver', async () => {
  await P.go(PAX, '/', 3000);
  await P.tid('where-to').click(); await pp.waitForTimeout(800);
  await P.tid('place-search').fill('Agdal'); await P.tid('place-rabat-agdal').click(); await pp.waitForTimeout(1500);
  await pp.waitForTimeout(3000);
  await P.tid('confirm-booking').click(); await pp.waitForTimeout(2000);
  await post('/dev/clock/advance', { seconds: 600 }); await pp.waitForTimeout(4000);
  await P.S('16n-ride-no-driver'); console.log('nodriver', await P.ids());
});
fs.writeFileSync(`${OUT}/${PA}/_log-p3.json`, JSON.stringify({ errors: [pp.__errors, dp.__errors], log }, null, 1));
await browser.close();
