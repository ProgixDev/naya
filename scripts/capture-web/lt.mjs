// Largest text size (FONT_SCALE env, Text caps at 1.6): passenger home, quote, live ride; driver home, offer.
import { chromium, PAX, DRV, PH, post, newPage, helpers, signIn, FONT_SCALE } from './lib.mjs';
const log = []; const A = FONT_SCALE === 1 ? 'textscale-1' : 'largetext';
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
const pp = await newPage(browser); const P = helpers(pp, `${A}`, log);
const dp = await newPage(browser); const D = helpers(dp, `${A}`, log);
await signIn(pp, PAX, 'passenger', PH.salma);
await signIn(dp, DRV, 'driver', PH.amina);
console.log('fontScale seen', await pp.evaluate(() => window.__fsCheck ?? 'n/a'), FONT_SCALE);
await P.step('home', async () => { await P.S('P1-home-idle'); await P.scrollShot('P1b-home-idle-scrolled'); });
await D.step('driver home', async () => { await D.S('D1-home-offline'); await D.tid('toggle-online').click(); await dp.waitForTimeout(1500); await D.S('D1b-home-online'); });
await P.step('quote', async () => {
  await P.go(PAX, '/', 3000); await P.tid('where-to').click(); await pp.waitForTimeout(800);
  await P.tid('place-search').fill('Gare'); await P.tid('place-rabat-gare').click(); await pp.waitForTimeout(3000);
  await P.S('P2-quote'); await P.scrollShot('P2b-quote-scrolled', 500);
  await P.tid('confirm-booking').click(); await pp.waitForTimeout(1500); await P.S('P3a-ride-searching');
});
await D.step('offer', async () => { await dp.waitForSelector('[data-testid="offer-pending"]', { timeout: 20000 }); await dp.waitForTimeout(800); await D.S('D2-offer'); await D.tid('accept-offer').click(); await dp.waitForTimeout(2500); await D.S('D3-ride-assigned'); });
await P.step('ride', async () => { await pp.waitForTimeout(2500); await P.S('P3-ride-driver-assigned'); await P.tid('sos').click(); await pp.waitForTimeout(1000); await P.S('P4-ride-sos-sheet'); await pp.keyboard.press('Escape'); await P.go(PAX, '/', 4000); await P.S('P5-home-active-ride'); });
console.log(JSON.stringify(log.filter((l) => l.error)), pp.__errors.slice(0, 3), dp.__errors.slice(0, 3));
await browser.close();
