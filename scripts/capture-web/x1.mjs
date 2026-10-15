import fs from 'node:fs';
import { chromium, PAX, DRV, OUT, PH, post, get, newPage, helpers, signIn } from './lib.mjs';
const log = [];
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
// Driver sign-up steps by URL, for a new number.
const dp = await newPage(browser); const D = helpers(dp, 'driver', log);
const t = await signIn(dp, DRV, 'driver', `+2126771${String(Date.now()).slice(-5)}`);
const steps = ['id_front', 'licence_number', 'licence_dates', 'experience', 'person_review', 'vehicle_model', 'vehicle_plate', 'vehicle_registration', 'vehicle_photo_front', 'vehicle_review', 'famille_references', 'famille_experience', 'famille_training', 'famille_interview', 'famille_review'];
let i = 0;
for (const s of steps) await D.step(s, async () => { await D.go(DRV, `/docs/step/${s}`, 2200); await D.S(`53${String.fromCharCode(97 + i++)}-signup-step-${s}`); });
await D.step('capture', async () => { await D.go(DRV, '/docs/capture/id_front', 2500); await D.S('54a-signup-capture-id-front'); console.log('cap', await D.ids()); });
await D.step('docs start', async () => { await D.go(DRV, '/docs/start', 2500); await D.S('54b-docs-start'); });
// Passenger extras.
const pp = await newPage(browser); const P = helpers(pp, 'passenger', log);
await signIn(pp, PAX, 'passenger', PH.salma);
await P.step('scheduled detail', async () => { await P.go(PAX, '/trips', 2500); await P.tid('scheduled-RP-001').click(); await pp.waitForTimeout(2500); await P.S('08c-scheduled-detail'); console.log('sd', pp.url(), await P.ids()); await P.scrollShot('08d-scheduled-detail-scrolled'); });
await P.step('home plan trip', async () => { await P.go(PAX, '/', 3000); await P.tid('plan-trip').click(); await pp.waitForTimeout(1200); await P.tid('when-later').click().catch(() => {}); await pp.waitForTimeout(1200); await P.S('06e-plan-later-entry'); console.log('plan', pp.url(), await P.ids()); });
await P.step('pin picker', async () => { await P.go(PAX, '/', 3000); await P.tid('where-to').click(); await pp.waitForTimeout(900); await P.tid('search-pin').click(); await pp.waitForTimeout(1500); await P.S('06f-route-pin-picker'); console.log('pin', await P.ids()); });
await P.step('quote planifier', async () => {
  await P.go(PAX, '/', 3000); await P.tid('where-to').click(); await pp.waitForTimeout(800);
  await P.tid('place-search').fill('Gare'); await P.tid('place-rabat-gare').click(); await pp.waitForTimeout(1500);
  await pp.waitForTimeout(3000);
  await P.tid('when-chip').click(); await pp.waitForTimeout(900); await P.tid('mode-schedule').click(); await pp.waitForTimeout(1200); await P.S('07e-quote-planifier'); console.log('qp', await P.ids());
  const sp = pp.locator('[data-testid="schedule-picker"]:visible'); if (await sp.count()) { await P.S('07f-quote-schedule-picker'); }
});
await P.step('ride sos + contact', async () => {
  await P.go(PAX, '/', 3000); await P.tid('where-to').click(); await pp.waitForTimeout(800);
  await P.tid('place-search').fill('Agdal'); await P.tid('place-rabat-agdal').click(); await pp.waitForTimeout(1500);
  await pp.waitForTimeout(3000); await P.tid('confirm-booking').click(); await pp.waitForTimeout(2000);
  await P.tid('sos').click(); await pp.waitForTimeout(1000); await P.S('16o-ride-sos-sheet'); await pp.keyboard.press('Escape'); await pp.waitForTimeout(700);
  await P.tid('cancel-ride').click(); await pp.waitForTimeout(1000); await P.S('16p-ride-cancel-sheet');
});
fs.writeFileSync(`${OUT}/driver/_log-x1.json`, JSON.stringify({ errors: [dp.__errors, pp.__errors], log }, null, 1));
await browser.close();
