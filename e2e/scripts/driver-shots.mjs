// Usage: node scripts/driver-shots.mjs <phone> <name:path>... [--api http://localhost:4012] [--app http://localhost:8084] [--out dir] [--w 390]
// Signs a driver in through the demo API and screenshots each route headlessly.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const API = opt('--api', 'http://localhost:4010');
const APP = opt('--app', 'http://localhost:8082');
const OUT = opt('--out', '../docs/screens/driver');
const W = Number(opt('--w', '390'));
const H = Number(opt('--h', '844'));
const wait = Number(opt('--wait', '2500'));
const [phone, ...routes] = args;

let session = null;
if (phone !== 'anon') {
  await fetch(`${API}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, role: 'driver' }) });
  const r = await fetch(`${API}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, role: 'driver', code: '123456' }) });
  const b = await r.json();
  session = JSON.stringify({ token: b.token, accountId: b.user.id });
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, geolocation: { latitude: 34.0205, longitude: -6.831 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(APP);
await page.evaluate(([s]) => {
  if (s) sessionStorage.setItem('naya.driver.session', s); else sessionStorage.removeItem('naya.driver.session');
  localStorage.setItem('naya.driver.prefs', JSON.stringify({ state: { onboardingDone: !!s, demoPositionAccepted: false }, version: 1 }));
}, [session]);
for (const spec of routes) {
  const [name, path] = spec.split('=');
  await page.goto(`${APP}${path}`);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name, '→', page.url());
}
await browser.close();
