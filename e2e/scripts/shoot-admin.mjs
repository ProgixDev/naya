// Usage: node scripts/shoot-admin.mjs <outDir> <width> [routes...]
// Signs in as Meryem through the API and screenshots admin routes (headless, own browser).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [outDir, width = '1440', ...routes] = process.argv.slice(2);
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:5174';
const API = process.env.API_URL ?? 'http://localhost:4013';
const email = process.env.ADMIN_EMAIL ?? 'meryem@naya.demo';
const password = process.env.ADMIN_PASSWORD ?? 'Naya-Admin-2026';
mkdirSync(outDir, { recursive: true });
const login = await (await fetch(`${API}/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 960 }, deviceScaleFactor: 1 });
await page.goto(`${ADMIN}/connexion`);
await page.evaluate((s) => sessionStorage.setItem('naya.admin.session', JSON.stringify(s)), { token: login.token, admin: login.admin });
for (const r of routes) {
  const [path, name] = r.split('=');
  await page.goto(`${ADMIN}${path}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${name}-${width}.png`, fullPage: true });
  console.log('saved', name);
}
await browser.close();
