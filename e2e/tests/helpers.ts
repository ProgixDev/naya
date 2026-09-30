import { expect, type Page, type APIRequestContext, request } from '@playwright/test';
import { URLS } from '../playwright.config';

export { URLS };

export async function api(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: URLS.api });
}

/** Resets the shared demo API to a named scenario (see /dev/scenarios). */
export async function resetScenario(scenario = 'default') {
  const ctx = await api();
  const r = await ctx.post('/dev/reset', { data: { scenario } });
  expect(r.ok()).toBeTruthy();
  await ctx.dispose();
}

export async function tokenFor(phone: string, role: 'passenger' | 'driver') {
  const ctx = await api();
  await ctx.post('/auth/otp/request', { data: { phone, role } });
  const r = await ctx.post('/auth/otp/verify', { data: { phone, role, code: '123456' } });
  const body = await r.json();
  await ctx.dispose();
  return { token: body.token as string, accountId: body.user.id as string };
}

export async function adminToken(email = 'meryem@naya.demo', password = 'Naya-Admin-2026') {
  const ctx = await api();
  const r = await ctx.post('/admin/auth/login', { data: { email, password } });
  const body = await r.json();
  await ctx.dispose();
  return body.token as string;
}

/** Signs a mobile web app in directly (session lives in sessionStorage on web). */
export async function signInMobile(page: Page, baseURL: string, role: 'passenger' | 'driver', phone: string) {
  const { token, accountId } = await tokenFor(phone, role);
  await page.goto(baseURL);
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [`naya.${role}.session`, JSON.stringify({ token, accountId })] as const);
  // Skip onboarding for the passenger app.
  await page.evaluate(() => localStorage.setItem('naya.passenger.prefs', JSON.stringify({ state: { onboardingDone: true, cityId: 'rabat' }, version: 1 })));
  await page.evaluate(() => localStorage.setItem('naya.driver.prefs', JSON.stringify({ state: { onboardingDone: true }, version: 1 })));
  await page.goto(baseURL);
}

export async function authed(token: string) {
  return request.newContext({ baseURL: URLS.api, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

export const PHONES = {
  salma: '+212612345678',
  nour: '+212623456789',
  imane: '+212634567890',
  rania: '+212645678901',
  amina: '+212661234567',
  khadija: '+212662345678',
  nadia: '+212663456789',
  leila: '+212664567890',
  samira: '+212665678901',
};

export const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
