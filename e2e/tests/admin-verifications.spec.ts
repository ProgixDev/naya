import { expect, test } from '@playwright/test';
import { adminLogin, auditActions, resetScenario } from './admin-helpers';

test.beforeEach(async () => resetScenario('default'));

test('S01 · manual approval of a submitted passenger identity', async ({ page }) => {
  await adminLogin(page);
  await page.getByTestId('priority-VP-002').click();
  await expect(page.getByRole('heading', { name: 'Examiner le dossier' })).toBeVisible();
  await page.getByTestId('start-review').click();
  await expect(page.getByText('En cours d’examen').first()).toBeVisible();
  await page.getByTestId('approve').click();
  await page.getByTestId('confirm-decision').click();
  await expect(page.getByText(/Décision : approuvé par Meryem/)).toBeVisible();
  expect(await auditActions()).toContain('verification.approved');
});

test('S02 · complement request needs pieces and a message; refusal needs a reason', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/verifications/VP-002');
  await page.getByTestId('request-more').click();
  await page.getByTestId('confirm-decision').click();
  await expect(page.getByTestId('decision-dialog').getByRole('alert')).toContainText('au moins une pièce');
  await page.getByTestId('correct-id_back').check();
  await page.getByTestId('note-id_back').fill('Le verso est flou, reprenez-le en pleine lumière.');
  await page.getByTestId('decision-message').fill('Merci de reprendre le verso de votre pièce.');
  await page.getByTestId('confirm-decision').click();
  await expect(page.getByText(/complément demandé par Meryem/)).toBeVisible();
  await expect(page.getByTestId('item-id_back')).toContainText('À corriger');

  // Resetting the demo data also revokes sessions: sign in again.
  await resetScenario('default');
  await adminLogin(page);
  await page.goto('/verifications/VP-002');
  await page.getByTestId('reject').click();
  await page.getByTestId('decision-message').fill('Pièce expirée depuis 2025.');
  await page.getByTestId('confirm-decision').click();
  await expect(page.getByTestId('decision-dialog').getByRole('alert')).toContainText('motif');
  await page.getByTestId('reason-code').selectOption('document_expired');
  await page.getByTestId('confirm-decision').click();
  await expect(page.getByText(/Décision : refusé/)).toBeVisible();
});

test('S10 · vehicle approval is independent from the person approval', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/personnes/DR-002');
  await expect(page.getByText('Ne peut pas recevoir de courses')).toBeVisible();
  await page.goto('/verifications/VV-002');
  await expect(page.getByText('Véhicule déclaré')).toBeVisible();
  await page.getByTestId('approve').click();
  await page.getByTestId('confirm-decision').click();
  await expect(page.getByText(/Décision : approuvé/)).toBeVisible();
  await page.goto('/personnes/DR-002');
  await expect(page.getByText('Peut recevoir des courses')).toBeVisible();
});
