import { expect, test } from '@playwright/test';
import { adminLogin, resetScenario } from './admin-helpers';

test.beforeEach(async () => resetScenario('default'));

test('A00 · wrong password is refused, login and logout work', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/connexion/);
  await page.getByTestId('email').fill('meryem@naya.demo');
  await page.getByTestId('password').fill('mauvais-mot-de-passe');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert').filter({ hasText: 'incorrect' })).toBeVisible();
  await adminLogin(page);
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto('/finance');
  await expect(page).toHaveURL(/\/connexion/);
});

test('A00-denied · support agent cannot open finance or audit and cannot decide cases', async ({ page }) => {
  await adminLogin(page, 'youssra@naya.demo', 'Naya-Support-2026');
  await page.goto('/finance');
  await expect(page.getByTestId('access-denied')).toBeVisible();
  await expect(page.getByTestId('access-denied')).toContainText('finance.read');
  await page.goto('/audit');
  await expect(page.getByTestId('access-denied')).toBeVisible();
  await page.goto('/verifications/VP-002');
  await expect(page.getByText('Lecture seule')).toBeVisible();
  await expect(page.getByTestId('approve')).toHaveCount(0);
});

test('A00 · an expired session returns to the login form', async ({ page }) => {
  await adminLogin(page);
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('naya.admin.session')!);
    s.token = 'revoked';
    sessionStorage.setItem('naya.admin.session', JSON.stringify(s));
  });
  await page.goto('/verifications');
  await expect(page.getByText('Session expirée')).toBeVisible();
});
