// Passenger: welcome, onboarding, sign-in, OTP, verification states.
import fs from 'node:fs';
import { chromium, PAX, OUT, PH, post, newPage, helpers, signIn } from './lib.mjs';
const SCHEME = process.argv[2] ?? 'light';
const A = SCHEME === 'light' ? 'passenger' : 'passenger-dark';
const log = [];
await post('/dev/reset', { scenario: 'default' });
const browser = await chromium.launch();
let page = await newPage(browser, SCHEME);
let h = helpers(page, A, log);
await h.step('welcome', async () => {
  await page.goto(PAX + '/'); await page.waitForTimeout(3000);
  await h.S('01a-welcome');
  console.log(await h.ids());
  for (let i = 0; i < 4; i++) {
    const n = page.locator('[data-testid="onboarding-next"]:visible');
    if (!(await n.count())) break;
    await n.last().click(); await page.waitForTimeout(900);
    await h.S(`01${'bcde'[i]}-onboarding-${i + 2}`);
  }
  console.log(await h.ids());
});
await h.step('phone', async () => {
  await h.go(PAX, '/phone', 2500);
  await h.S('02a-signin-phone');
  await h.tid('phone-input').fill('612345678'); await page.waitForTimeout(300);
  await h.S('02b-signin-phone-filled');
  await h.tid('send-code').click(); await page.waitForTimeout(1800);
  await h.S('03a-otp-empty');
  await h.tid('otp-input').fill('123'); await page.waitForTimeout(400);
  await h.S('03b-otp-partial');
});
// New passenger: identity capture flow.
await page.context().close();
page = await newPage(browser, SCHEME); h = helpers(page, A, log);
await h.step('identity new', async () => {
  await signIn(page, PAX, 'passenger', `+2126110${String(Date.now()).slice(-5)}`);
  await h.S('04a-verify-identity-start'); console.log('identity ids', await h.ids());
  await h.scrollShot('04b-verify-identity-scrolled');
});
for (const [who, name] of [['nour', '04c-verify-pending'], ['imane', '04d-verify-needs-more'], ['rania', '04e-verify-rejected']]) {
  await page.context().close();
  page = await newPage(browser, SCHEME); h = helpers(page, A, log);
  await h.step(who, async () => { await signIn(page, PAX, 'passenger', PH[who]); await h.S(name); console.log(who, await h.ids()); });
}
fs.writeFileSync(`${OUT}/${A}/_log-p1.json`, JSON.stringify(log, null, 1));
await browser.close();
