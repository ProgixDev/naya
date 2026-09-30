// Usage: node scripts/shoot.mjs <url> <out.png> [width=390] [height=844] [sessionKey sessionJson]
// Headless screenshot helper for visual review (does not use the shared MCP browser).
import { chromium } from '@playwright/test';

const [url, out, w = '390', h = '844', key, value] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2 });
if (key) {
  await page.goto(new URL(url).origin);
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [key, value]);
  await page.evaluate(() => {
    localStorage.setItem('naya.passenger.prefs', JSON.stringify({ state: { onboardingDone: true, cityId: 'rabat' }, version: 1 }));
    localStorage.setItem('naya.driver.prefs', JSON.stringify({ state: { onboardingDone: true }, version: 1 }));
  });
}
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => undefined);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
