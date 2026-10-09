import { expect, test } from '@playwright/test';
import { adminLogin, auditActions, PHONES, resetScenario, tokenFor, URLS } from './admin-helpers';
import { authed } from './helpers';

test('S14 · reply to and resolve a dispute opened by a passenger', async ({ page }) => {
  await resetScenario('default');
  const { token } = await tokenFor(PHONES.salma, 'passenger');
  const salma = await authed(token);
  const t = await (await salma.post('/support/tickets', { data: { rideId: 'NY-001', category: 'payment', subject: 'Montant de la course NY-001', body: 'Le montant ne correspond pas à ce que j’attendais.', attachments: [] } })).json();
  await adminLogin(page);
  await page.goto('/support');
  await page.getByTestId(`row-${t.id}`).click();
  await page.getByTestId('agent-reply').fill('Le prix accepté était 100 MAD, arrêt Agdal inclus.');
  await page.getByTestId('send-agent-reply').click();
  await expect(page.getByText('Informations demandées').first()).toBeVisible();
  await page.getByTestId('resolve').click();
  await page.getByTestId('resolve-outcome').fill('Tarif confirmé');
  await page.getByTestId('resolve-note').fill('Prix conforme au devis accepté.');
  await page.getByTestId('confirm-resolve').click();
  await expect(page.getByText(/Décision : résolu · Tarif confirmé/).first()).toBeVisible();
  const passengerView = await (await salma.get(`/support/tickets/${t.id}`)).json();
  expect(passengerView.status).toBe('resolved');
  expect(await auditActions()).toContain('support.resolved');
  await salma.dispose();
});

test('S15 · add Casablanca as a test city with distinct rules, then enable dynamic pricing', async ({ page }) => {
  await resetScenario('no-casablanca');
  await adminLogin(page);
  await page.goto('/villes');
  await expect(page.getByTestId('city-card-casablanca')).toHaveCount(0);
  await page.getByTestId('add-city').click();
  await page.getByTestId('city-reason').fill('Préparation du lancement pilote à Casablanca.');
  await page.getByTestId('confirm-add-city').click();
  await expect(page.getByRole('heading', { name: 'Règles · Casablanca' })).toBeVisible();
  await expect(page.getByTestId('example-fare')).toHaveText('107 MAD');
  await expect(page.getByTestId('example-fare-dynamic')).toHaveText('128,40 MAD');
  await expect(page.getByTestId('rule-commission')).toHaveValue('18');
  await expect(page.getByTestId('rule-debtLimit')).toHaveValue('200');
  await page.getByTestId('rule-dynamic').check();
  await page.getByTestId('save-rules').click();
  await page.getByTestId('rules-reason').fill('Test de la majoration dynamique pilote.');
  await page.getByTestId('confirm-rules').click();
  await expect(page.getByText('Version 2 enregistrée')).toBeVisible();
  // Rabat is unaffected.
  await page.goto('/villes/rabat/regles');
  await expect(page.getByTestId('example-fare')).toHaveText('100 MAD');
  const actions = await auditActions();
  expect(actions).toEqual(expect.arrayContaining(['city.created', 'zone.created', 'city.rules_updated']));
  // A tester passenger now gets the Casablanca price.
  const { token } = await tokenFor(PHONES.salma, 'passenger');
  const salma = await authed(token);
  const q = await (await salma.post('/quotes', { data: { cityId: 'casablanca', stops: [{ id: 'casa-port', label: 'Gare Casa-Port', address: 'Casablanca', location: { lat: 33.6005, lng: -7.6132 } }, { id: 'casa-anfa', label: 'Anfa', address: 'Casablanca', location: { lat: 33.5883, lng: -7.6478 } }] } })).json();
  expect(q.breakdown.total).toBe(12840);
  await salma.dispose();
  await page.goto('/audit');
  await expect(page.getByTestId('audit-integrity')).toContainText('Chaîne intègre');
});

test('S06 · enabling dynamic pricing in Rabat discloses ×1,2 in new quotes', async ({ page }) => {
  await resetScenario('default');
  await adminLogin(page);
  await page.goto('/villes/rabat/regles');
  await page.getByTestId('rule-dynamic').check();
  await expect(page.getByTestId('example-fare-dynamic')).toHaveText('120 MAD');
  await expect(page.getByTestId('rule-diff')).toContainText('Dynamique : inactive → ×1,2');
  await page.getByTestId('save-rules').click();
  await expect(page.getByTestId('confirm-rules')).toBeDisabled();
  await page.getByTestId('rules-reason').fill('Forte demande autour de la gare ce soir.');
  await page.getByTestId('confirm-rules').click();
  await expect(page.getByText('Version 2 enregistrée')).toBeVisible();
  const { token } = await tokenFor(PHONES.salma, 'passenger');
  const salma = await authed(token);
  const q = await (await salma.post('/quotes', { data: { cityId: 'rabat', stops: [{ id: 'rabat-gare', label: 'Gare Rabat Ville', address: 'Rabat', location: { lat: 34.0166, lng: -6.8356 } }, { id: 'rabat-agdal', label: 'Agdal', address: 'Rabat', location: { lat: 33.9993, lng: -6.8511 } }, { id: 'rabat-hay-riad', label: 'Hay Riad', address: 'Rabat', location: { lat: 33.9594, lng: -6.8747 } }] } })).json();
  expect(q.breakdown.total).toBe(12000);
  expect(q.conditions.dynamic.multiplierBp).toBe(12000);
  await salma.dispose();
});

test('A09 · exceptional correction requires a reason and confirmation, and is audited', async ({ page }) => {
  await resetScenario('default');
  await adminLogin(page);
  await page.goto('/finance');
  await page.getByTestId('correct-DR-001').click();
  await page.getByTestId('correction-amount').fill('5');
  await page.getByTestId('correction-reason').fill('court');
  await page.getByTestId('correction-next').click();
  await expect(page.getByTestId('correction-dialog')).toContainText('10 caractères');
  await page.getByTestId('correction-reason').fill('Remboursement d’un péage justifié par ticket.');
  await page.getByTestId('correction-next').click();
  await expect(page.getByTestId('correction-dialog')).toContainText('75');
  await page.getByTestId('correction-confirm').click();
  await expect(page.getByText(/Correction enregistrée · nouveau solde 75/)).toBeVisible();
  await expect(page.getByTestId('row-DR-001')).toContainText('75');
  expect(await auditActions()).toContain('finance.correction');
});

test('A12 · a provider cannot be toggled without a reason; live providers stay unconfigured', async ({ page }) => {
  await resetScenario('default');
  await adminLogin(page);
  await page.goto('/paiements');
  await expect(page.getByTestId('provider-rabat-ride-card-live')).toContainText('Identifiants manquants');
  await expect(page.getByTestId('toggle-rabat-ride-card-live')).toBeDisabled();
  await page.getByTestId('toggle-rabat-recharge-agency').click();
  await expect(page.getByTestId('confirm-provider')).toBeDisabled();
  await page.getByTestId('provider-reason').fill('Maintenance du réseau d’agences partenaire.');
  await page.getByTestId('confirm-provider').click();
  await expect(page.getByTestId('provider-rabat-recharge-agency')).toContainText('Désactivé');
  void URLS;
});
