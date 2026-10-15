// After-only fixups: Famille live trip (parent approves on site), ride with the approval banner, driver sign-up steps.
import fs from 'node:fs';
import { chromium, PAX, DRV, OUT, PH, post, get, newPage, helpers, signIn } from './lib.mjs';
const log = [];
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
const pp = await newPage(browser); const P = helpers(pp, 'passenger', log);
const dp = await newPage(browser); const D = helpers(dp, 'driver', log);
const tp = await signIn(pp, PAX, 'passenger', PH.salma);
await signIn(dp, DRV, 'driver', PH.amina);
await D.step('online', async () => { await D.tid('toggle-online').click(); await dp.waitForTimeout(1500); });
const fam = await post('/dev/family/play', { driver: true, parent: null }, tp.token);
console.log('family', fam.status, fam.body?.id, fam.body?.status);
await P.step('ride with banner', async () => {
  await P.go(PAX, '/', 3000); await P.tid('where-to').click(); await pp.waitForTimeout(800);
  await P.tid('place-search').fill('Gare'); await P.tid('place-rabat-gare').click(); await pp.waitForTimeout(3000);
  await P.tid('confirm-booking').click(); await pp.waitForTimeout(1500);
  await dp.waitForSelector('[data-testid="offer-pending"]', { timeout: 20000 }); await D.tid('accept-offer').click(); await dp.waitForTimeout(2500);
  await pp.waitForSelector('[data-testid="ride-driver_assigned"]', { timeout: 15000 }); await pp.waitForTimeout(1500);
  await P.S('16b-ride-driver-assigned'); console.log('assigned', await P.ids());
  await P.tid('sos').click({ timeout: 5000 }); await pp.waitForTimeout(1000); await P.S('16e-ride-sos-sheet'); console.log('sos', await P.ids()); await pp.keyboard.press('Escape'); await pp.waitForTimeout(700);
});
await P.step('famille live', async () => {
  await P.go(PAX, '/family', 3000); console.log('fam', await P.ids());
  const ap = pp.locator('[data-testid="famille-approve-onsite"]:visible');
  if (await ap.count()) { await P.S('12e-famille-home-approval'); await ap.last().click(); await pp.waitForTimeout(1500); }
  await P.go(PAX, `/family/${fam.body?.id ?? 'FT-002'}`, 3000);
  await P.S('18a-famille-trip-live'); console.log('famtrip', pp.url(), await P.ids());
  await P.scrollShot('18b-famille-trip-live-scrolled'); await P.scrollShot('18c-famille-trip-live-scrolled-2');
  await P.go(PAX, `/family/${fam.body?.id ?? 'FT-002'}`, 3000);
  const c = pp.locator('[data-testid="contact"]:visible'); console.log('fam contact', await c.count());
  await P.tid('sos').click({ timeout: 5000 }); await pp.waitForTimeout(1000); await P.S('18e-famille-trip-sos-sheet'); console.log('famsos', await P.ids());
});
await dp.context().close();
// Driver sign-up steps, new number.
const sp = await newPage(browser); const N = helpers(sp, 'driver', log);
await N.step('signup new', async () => {
  await signIn(sp, DRV, 'driver', `+2126770${String(Date.now()).slice(-5)}`);
  await sp.locator('[data-testid="resume-signup"]:visible').first().click().catch(() => {}); await sp.waitForTimeout(1500);
  const sel = '[data-testid^="signup-step-"]:not([data-testid$="-scroll"]):visible';
  let i = 0;
  while (i < 8) {
    const cur = sp.locator(sel).last();
    const id = await cur.getAttribute('data-testid').catch(() => null);
    await N.S(`52${String.fromCharCode(97 + i)}-signup-${id ?? 'unknown'}`); console.log('step', id, sp.url());
    if (!id) break;
    const fill = async (t, v) => { const l = cur.getByTestId(t); if (await l.count()) await l.first().fill(v).catch(() => {}); };
    await fill('first-name', 'Sara'); await fill('last-name', 'Bennis'); await fill('birth-date', '01051995'); await fill('address', '12 rue Patrice Lumumba, Rabat'); await fill('document-number', 'AB123456');
    for (const pre of ['city-', 'document-type']) { const o = cur.locator(`[data-testid^="${pre}"]`); if (await o.count()) await o.first().click().catch(() => {}); }
    const cont = cur.getByTestId('step-continue'); if (!(await cont.count())) break;
    await cont.click().catch(() => {}); await sp.waitForTimeout(1300);
    const nid = await sp.locator(sel).last().getAttribute('data-testid').catch(() => null);
    if (nid === id) { console.log('stuck at', id, await N.ids()); break; }
    i++;
  }
  await N.go(DRV, '/docs/famille', 2500); await N.S('53k-signup-famille-intro');
});
fs.writeFileSync(`${OUT}/driver/_log-fx.json`, JSON.stringify({ errors: [pp.__errors, sp.__errors], log }, null, 1));
await browser.close();
