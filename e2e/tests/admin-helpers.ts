import { expect, type Page } from '@playwright/test';
import { adminToken, api, resetScenario, tokenFor, URLS, PHONES } from './helpers';

export { resetScenario, tokenFor, PHONES, URLS };

/** Signs into the admin through the real login form. */
export async function adminLogin(page: Page, email = 'meryem@naya.demo', password = 'Naya-Admin-2026') {
  await page.goto('/connexion');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Centre des opérations' })).toBeVisible();
}

export async function auditActions(): Promise<string[]> {
  const token = await adminToken();
  const ctx = await api();
  const r = await ctx.get('/admin/audit?limit=100', { headers: { Authorization: `Bearer ${token}` } });
  const body = await r.json();
  await ctx.dispose();
  return body.items.map((e: { action: string }) => e.action);
}
