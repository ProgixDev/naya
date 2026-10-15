// Driver: auth, money, account, dossier states, sign-up steps.
import fs from 'node:fs';
import { chromium, DRV, OUT, PH, post, get, newPage, helpers, signIn } from './lib.mjs';
const SCHEME = process.argv[2] ?? 'light';
const A = SCHEME === 'light' ? 'driver' : 'driver-dark';
const log = [];
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
let page = await newPage(browser, SCHEME); let h = helpers(page, A, log);
const fresh = async () => { await page.context().close(); page = await newPage(browser, SCHEME); h = helpers(page, A, log); };
await h.step('welcome', async () => {
  await page.goto(DRV + '/'); await page.waitForTimeout(3000); await h.S('10a-welcome'); console.log('w', await h.ids());
  for (let i = 0; i < 3; i++) { const n = page.locator('[data-testid="onboarding-next"]:visible'); if (!(await n.count())) break; await n.last().click(); await page.waitForTimeout(900); if (page.url().includes('/phone')) break; await h.S(`10${'bcd'[i]}-onboarding-${i + 2}`); }
  await h.go(DRV, '/phone', 2500); await h.S('11a-signin-phone'); console.log('ph', await h.ids());
  await h.tid('phone-input').fill('661234567'); await h.tid('send-code').click(); await page.waitForTimeout(1800); await h.S('11b-otp');
});
await fresh();
await signIn(page, DRV, 'driver', PH.amina);
const money = [['/earnings', '30a-earnings'], ['/wallet', '31a-wallet'], ['/ledger', '32a-ledger'], ['/recharge', '33a-recharge'], ['/withdraw', '34a-withdraw'], ['/rides', '35a-rides-history'], ['/account', '40a-account'], ['/profile/vehicle', '40c-vehicle-profile'], ['/profile/preferences', '40d-preferences'], ['/family', '41a-famille'], ['/support', '42a-support-list'], ['/support/new', '42b-support-new'], ['/docs/status', '43a-dossier-status-approved'], ['/car-wash', '44a-carwash']];
for (const [path, name] of money) await h.step(name, async () => { await h.go(DRV, path, 3000); await h.S(name); console.log(name, await h.ids()); if (['/earnings', '/wallet', '/account', '/ledger', '/family', '/withdraw'].includes(path)) await h.scrollShot(name.replace('a-', 'b-') + '-scrolled'); });
await h.step('earnings periods', async () => { await h.go(DRV, '/earnings', 2500); const p = page.locator('[data-testid="earnings-period"]:visible [role="tab"]'); const n = await p.count(); console.log('periods', n); if (n > 1) { await p.nth(n - 1).click(); await page.waitForTimeout(1200); await h.S('30c-earnings-period-last'); } });
await h.step('ledger detail', async () => { await h.go(DRV, '/ledger', 2500); const row = page.locator('[data-testid^="ledger-row-"]:visible, [data-testid="ledger-screen"] [role="button"]:visible').first(); if (await row.count()) { await row.click(); await page.waitForTimeout(2000); await h.S('32c-ledger-detail'); console.log('ld', page.url()); } });
await h.step('ride detail', async () => { await h.go(DRV, '/rides', 2500); const row = page.locator('[data-testid^="ride-row-"]:visible').first(); if (await row.count()) { await row.click(); await page.waitForTimeout(2000); await h.S('35b-ride-detail'); } });
await h.step('recharge flow', async () => {
  await h.go(DRV, '/recharge', 2500);
  await h.tid('recharge-continue').click(); await page.waitForTimeout(1200); await h.S('33b-recharge-processing'); console.log('rp', page.url(), await h.ids());
  await page.waitForTimeout(6000); await h.S('33c-recharge-result'); console.log('rr', page.url(), await h.ids());
});
await h.step('withdraw flow', async () => {
  await h.go(DRV, '/withdraw', 2500); const a = page.locator('[data-testid="withdraw-amount"]:visible'); if (await a.count()) { await a.last().fill('20'); await page.waitForTimeout(500); await h.S('34c-withdraw-filled'); }
  const c = page.locator('[data-testid="withdraw-confirm"]:visible'); if (await c.count()) { await c.last().click(); await page.waitForTimeout(2500); await h.S('34d-withdraw-result'); console.log('wd', page.url(), await h.ids()); }
});
await h.step('sign out dialog', async () => { await h.go(DRV, '/account', 2500); const s = page.locator('[data-testid="sign-out"]:visible'); await s.last().scrollIntoViewIfNeeded(); await s.last().click(); await page.waitForTimeout(800); await h.S('40e-signout-dialog'); });
// Debt / blocked
await fresh();
await h.step('leila', async () => { await signIn(page, DRV, 'driver', PH.leila); await h.S('24a-home-debt-blocked'); console.log('leila', await h.ids()); await h.go(DRV, '/wallet', 3000); await h.S('31c-wallet-debt-blocked'); await h.go(DRV, '/recharge', 3000); await h.S('33d-recharge-debt'); });
await fresh();
await h.step('khadija', async () => { await signIn(page, DRV, 'driver', PH.khadija); await h.S('25a-home-vehicle-in-review'); console.log('kh', await h.ids()); await h.go(DRV, '/docs/status', 3000); await h.S('43b-dossier-status-vehicle-review'); });
await fresh();
await h.step('samira', async () => { await signIn(page, DRV, 'driver', PH.samira); await h.S('26a-home-licence-to-fix'); console.log('sa', await h.ids()); await h.go(DRV, '/docs/status', 3000); await h.S('43c-dossier-status-fix'); await h.scrollShot('43d-dossier-status-fix-scrolled'); });
await fresh();
await h.step('houda', async () => { await signIn(page, DRV, 'driver', PH.houda); await h.S('27a-home-famille-in-review'); await h.go(DRV, '/family', 3000); await h.S('41c-famille-application-review'); });
await fresh();
await h.step('yasmine', async () => { await signIn(page, DRV, 'driver', PH.yasmine); await h.S('50a-signup-resume-hub'); console.log('ya', page.url(), await h.ids()); });
await fresh();
await h.step('signup new', async () => {
  await signIn(page, DRV, 'driver', `+2126770${String(Date.now()).slice(-5)}`);
  await h.S('51a-signup-hub-new'); console.log('new', page.url(), await h.ids()); await h.scrollShot('51b-signup-hub-new-scrolled');
  await page.locator('[data-testid="resume-signup"]:visible, [data-testid="famille-start"]:visible').first().click().catch(() => {}); await page.waitForTimeout(1500);
  let i = 0;
  while (i < 14) {
    const cur = page.locator('[data-testid^="signup-step-"]:visible').last();
    const id = await cur.getAttribute('data-testid').catch(() => null);
    await h.S(`52${String.fromCharCode(97 + i)}-signup-${id ?? 'unknown'}`); console.log('step', id, page.url(), await h.ids());
    if (!id) break;
    const fill = async (t, v) => { const l = cur.getByTestId(t); if (await l.count()) await l.first().fill(v).catch(() => {}); };
    await fill('first-name', 'Sara'); await fill('last-name', 'Bennis'); await fill('birth-date', '01051995'); await fill('address', '12 rue Patrice Lumumba, Rabat');
    await fill('document-number', 'AB123456'); await fill('licence-number', '12/345678'); await fill('licence-issue', '01012018'); await fill('licence-expiry', '01012030');
    await fill('vehicle-make', 'Dacia'); await fill('vehicle-model', 'Logan'); await fill('vehicle-year', '2021'); await fill('vehicle-color', 'Blanc'); await fill('vehicle-plate', '12345-A-6'); await fill('experience', '5');
    await fill('reference1-name', 'Nadia Alaoui'); await fill('reference1-phone', '612345670'); await fill('reference2-name', 'Hind Saidi'); await fill('reference2-phone', '612345671');
    for (const pre of ['city-', 'document-type', 'category-', 'interview-day-', 'interview-', 'reason-']) { const o = cur.locator(`[data-testid^="${pre}"]`); if (await o.count()) await o.first().click().catch(() => {}); }
    const ack = cur.getByTestId('training-ack'); if (await ack.count()) await ack.click().catch(() => {});
    const cont = cur.getByTestId('step-continue');
    if (!(await cont.count())) break;
    await cont.click().catch(() => {}); await page.waitForTimeout(1300);
    const nid = await page.locator('[data-testid^="signup-step-"]:visible').last().getAttribute('data-testid').catch(() => null);
    if (nid === id) { await h.S(`52${String.fromCharCode(97 + i)}-signup-${id}-blocked`); console.log('stuck at', id, await h.ids()); break; }
    i++;
  }
});
fs.writeFileSync(`${OUT}/${A}/_log-d1.json`, JSON.stringify({ errors: page.__errors, log }, null, 1));
await browser.close();
