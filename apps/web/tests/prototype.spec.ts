import { test, expect } from '@playwright/test';

test('a booking appears in the backoffice, survives reload, and can be completed', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trouver mon trajet' }).click();
  await page.getByRole('button', { name: 'Estimer mon trajet' }).click();
  await page.getByLabel('Votre prénom et nom').fill('Test Passagère');
  await page.getByRole('button', { name: /Confirmer ·/ }).click();
  await expect(page.getByText('Bon voyage, Test.')).toBeVisible();
  await page.getByRole('link', { name: 'Voir dans le backoffice' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Test Passagère' })).toBeVisible();
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: 'Test Passagère' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Détails de/ }).click();
  await page.getByRole('button', { name: 'Terminer', exact: true }).click();
  await expect(row.getByText('Terminée', { exact: true })).toBeVisible();
  await page.goto('/backoffice/finance');
  await expect(page.getByRole('button', { name: 'NY-1049', exact: true })).toBeVisible();
});

test('scheduled reservation keeps its selected date', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trouver mon trajet' }).click();
  await page.getByRole('button', { name: 'Estimer mon trajet' }).click();
  await page.getByLabel('Votre prénom et nom').fill('Planification Test');
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Moment du départ' })
    .selectOption('later');
  const tomorrow = new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Africa/Casablanca',
  });
  await page.getByLabel('Date et heure').fill(tomorrow + 'T16:30');
  await page.getByRole('button', { name: /Confirmer ·/ }).click();
  await page.getByRole('link', { name: 'Voir dans le backoffice' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Planification Test' });
  await expect(row.getByText('Planifiée', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: /Détails de/ }).click();
  await expect(page.getByRole('dialog').getByText(tomorrow + ' · 16:30')).toBeVisible();
});

test('driver application can be reviewed and activated', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Devenir chauffeuse Naya' }).click();
  await page.getByLabel('Prénom et nom', { exact: true }).fill('Chauffeuse Test');
  await page.getByLabel('Téléphone', { exact: true }).fill('+212 6 12 34 56 78');
  await page.getByLabel('Votre véhicule').fill('Toyota Yaris');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();
  await page.getByRole('link', { name: 'Voir mon dossier de démonstration' }).click();
  const card = page.locator('.verification-card').filter({ hasText: 'Chauffeuse Test' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Examiner le dossier' }).click();
  await page.getByRole('button', { name: 'Valider le dossier' }).click();
  await expect(card).toHaveCount(0);
  await page.goto('/backoffice/chauffeuses');
  const row = page.getByRole('row').filter({ hasText: 'Chauffeuse Test' });
  await expect(row.getByText('Hors ligne', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Ouvrir Chauffeuse Test' }).click();
  await page.getByRole('button', { name: 'Passer en ligne', exact: true }).click();
  await expect(row.getByText('En ligne', { exact: true })).toBeVisible();
});

test('support reply resolves a ticket and settings suspend bookings', async ({ page }) => {
  await page.goto('/backoffice/support');
  await page.getByRole('button', { name: /Objet oublié dans le véhicule/ }).click();
  await page.getByLabel('Votre réponse').fill('Bonjour, nous avons enregistré votre demande.');
  await page.getByRole('button', { name: 'Enregistrer et résoudre' }).click();
  await expect(
    page.getByRole('button', { name: /Objet oublié dans le véhicule/ }).getByText('Résolu'),
  ).toBeVisible();
  await page.goto('/backoffice/parametres');
  await page.getByRole('switch', { name: 'Activer les réservations' }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Service temporairement suspendu' }),
  ).toBeDisabled();
  await page.goto('/backoffice/journal');
  await expect(page.getByText('Demande SUP-024 résolue')).toBeVisible();
  await expect(page.getByText('Paramètres de service mis à jour')).toBeVisible();
});

test('filtering, export and mobile navigation work without overflow or runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/backoffice/courses');
  await page.getByRole('textbox', { name: 'Rechercher une course…' }).fill('NY-1046');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter les courses filtrées' }).click();
  await expect((await download).suggestedFilename()).toBe('naya-courses.csv');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();
  await page.getByRole('link', { name: 'Vue d’ensemble' }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  for (const route of [
    '/',
    '/backoffice',
    '/backoffice/chauffeuses',
    '/backoffice/passageres',
    '/backoffice/verifications',
    '/backoffice/finance',
    '/backoffice/support',
    '/backoffice/parametres',
    '/backoffice/journal',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      route,
    ).toBe(true);
    const broken = await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .filter(
            (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0,
          )
          .map((i) => i.getAttribute('src')),
      );
    expect(broken, route).toEqual([]);
  }
  expect(errors).toEqual([]);
});
