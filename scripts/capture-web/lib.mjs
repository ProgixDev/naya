import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure } from './contrast.mjs';

// Paths and ports come from the environment (README.md). Nothing here points outside the repo.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'e2e/package.json'));
export const { chromium } = require('@playwright/test');
export const PAX = process.env.CAPTURE_PASSENGER_URL ?? 'http://localhost:8681';
export const DRV = process.env.CAPTURE_DRIVER_URL ?? 'http://localhost:8682';
export const API = process.env.CAPTURE_API_URL ?? 'http://localhost:4610';
/** Screenshots, logs and contrast JSON. Default: work/capture-web (git-ignored). Never commit the PNGs (ADR-0052). */
export const OUT = path.resolve(process.env.CAPTURE_OUT ?? path.join(ROOT, 'work/capture-web'));
// Every script starts with POST /dev/reset: refuse the default API port, which may hold someone's working data.
if (new URL(API).port === '4010' && process.env.CAPTURE_ALLOW_4010 !== '1') {
  console.error(`Refusing to reset ${API}: start a scratch demo API on another port (README.md), or set CAPTURE_ALLOW_4010=1.`);
  process.exit(1);
}
export const PH = { salma: '+212612345678', nour: '+212623456789', imane: '+212634567890', rania: '+212645678901', amina: '+212661234567', khadija: '+212662345678', nadia: '+212663456789', leila: '+212664567890', samira: '+212665678901', yasmine: '+212666789012', houda: '+212667890123' };
export async function post(path, body, token, method = 'POST') {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Idempotency-Key': Math.random().toString(36).slice(2) }, body: JSON.stringify(body ?? {}) });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
}
export async function get(path, token) {
  const r = await fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  try { return await r.json(); } catch { return null; }
}
export async function token(phone, role = 'passenger') {
  await post('/auth/otp/request', { phone, role });
  const r = await post('/auth/otp/verify', { phone, role, code: '123456' });
  return { token: r.body.token, accountId: r.body.user.id };
}
export const FONT_SCALE = Number(process.env.FONT_SCALE || 1);
// Dynamic Type emulation on web: RN web hard-codes fontScale 1 and ignores it for text. Patch Dimensions (Metro __d hook)
// so components see the scale, and multiply inline font-size / line-height (capped at Text's 1.6 multiplier).
const FS_INIT = (fs) => {
  let real;
  Object.defineProperty(window, '__d', { configurable: true, get() { return real; }, set(fn) {
    real = function (factory, id, deps, name) {
      if (typeof name === 'string' && name.endsWith('react-native-web/dist/exports/Dimensions/index.js')) {
        const f = factory;
        factory = function (...a) { const r = f.apply(this, a); const mod = a[4]; const D = mod.exports.default || mod.exports; const og = D.get.bind(D); D.get = (d) => ({ ...og(d), fontScale: fs }); window.__fsCheck = fs; return r; };
      }
      return fn.call(this, factory, id, deps, name);
    };
  } });
};
export async function scaleText(page) {
  if (FONT_SCALE === 1) return;
  await page.evaluate((fs) => {
    const done = (window.__fsRules ||= new WeakSet());
    const walk = (rules) => { for (const r of rules) { if (r.cssRules) walk(r.cssRules); if (!r.style || done.has(r)) continue; done.add(r);
      const f = r.style.fontSize; if (f && f.endsWith('px')) r.style.fontSize = `${parseFloat(f) * fs}px`;
      const l = r.style.lineHeight; if (l && l.endsWith('px')) r.style.lineHeight = `${parseFloat(l) * fs}px`; } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
    for (const el of document.querySelectorAll('[style*="font-size"]')) {
      if (!el.dataset.fs0) { el.dataset.fs0 = el.style.fontSize; el.dataset.lh0 = el.style.lineHeight || ''; }
      const f = parseFloat(el.dataset.fs0); if (!f) continue;
      const want = `${Math.round(f * fs * 10) / 10}px`; if (el.style.fontSize !== want) el.style.fontSize = want;
      const l = parseFloat(el.dataset.lh0); if (l && el.dataset.lh0.endsWith('px')) { const w2 = `${Math.round(l * fs * 10) / 10}px`; if (el.style.lineHeight !== w2) el.style.lineHeight = w2; }
    }
  }, FONT_SCALE);
}
export async function newPage(browser, scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: true, locale: 'fr-MA', timezoneId: 'Africa/Casablanca', geolocation: { latitude: 34.0205, longitude: -6.831 }, permissions: ['geolocation'] });
  if (FONT_SCALE !== 1) await ctx.addInitScript(FS_INIT, FONT_SCALE);
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  return page;
}
export function helpers(page, app, log) {
  const tid = (id) => page.locator(`[data-testid="${id}"]:visible`).last();
  const step = async (name, fn) => { try { await fn(); } catch (e) { const m = String(e.message).split('\n')[0]; console.log(`!! ${app} ${name}: ${m}`); log.push({ step: name, error: m }); } };
  const S = async (name) => { await page.waitForTimeout(500); await scaleText(page); await page.waitForTimeout(150); fs.mkdirSync(`${OUT}/${app}`, { recursive: true }); const p = `${OUT}/${app}/${name}.png`; await page.screenshot({ path: p }); log.push({ name, url: page.url() });
    if (process.env.CONTRAST) { let m = []; try { m = await measure(page); } catch (e) { m = [{ error: String(e) }]; } const bad = m.filter((x) => x.ratio && !x.image && x.ratio < (x.large ? 3 : 4.5)); fs.writeFileSync(`${OUT}/${app}/${name}.contrast.json`, JSON.stringify({ count: m.length, bad }, null, 1)); console.log(`contrast ${app}/${name}: ${m.length} texts, ${bad.length} low`, bad.slice(0, 6).map((b) => `«${b.text}» ${b.fg}/${b.bg}(${b.bgFrom}) ${b.ratio}`).join(' | ')); } console.log('shot', app, name, page.url()); return p; };
  const go = async (base, path, wait = 2500) => { await page.goto(base + path); await page.waitForTimeout(wait); };
  const ids = () => page.evaluate(() => [...document.querySelectorAll('[data-testid]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0; }).map((e) => e.getAttribute('data-testid')).join(' '));
  // Scroll the main scroll container down by dy and screenshot.
  const scrollShot = async (name, dy = 700) => { await page.evaluate((dy) => { const els = [...document.querySelectorAll('div')].filter((d) => { const s = getComputedStyle(d); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 20 && d.getBoundingClientRect().width > 300; }); const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (el) el.scrollBy(0, dy); }, dy); await page.waitForTimeout(500); return S(name); };
  return { tid, step, S, go, ids, scrollShot };
}
export async function signIn(page, base, role, phone, extraPrefs = {}) {
  const t = await token(phone, role);
  await page.goto(base + '/'); await page.waitForTimeout(1200);
  await page.evaluate(([role, v, extra]) => {
    sessionStorage.setItem(`naya.${role}.session`, v);
    if (role === 'passenger') localStorage.setItem('naya.passenger.prefs', JSON.stringify({ state: { onboardingDone: true, cityId: 'rabat', ...extra }, version: 2 }));
    else localStorage.setItem('naya.driver.prefs', JSON.stringify({ state: { onboardingDone: true, demoPositionAccepted: true, ...extra }, version: 1 }));
  }, [role, JSON.stringify(t), extraPrefs]);
  await page.goto(base + '/'); await page.waitForTimeout(3500);
  return t;
}
