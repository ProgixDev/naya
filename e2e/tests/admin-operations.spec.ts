import { expect, test } from '@playwright/test';
import { adminLogin, auditActions, PHONES, resetScenario, tokenFor, URLS } from './admin-helpers';
import { adminToken, api, authed } from './helpers';

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
  await expect(page.getByText('Réponse attendue').first()).toBeVisible();
  await page.getByTestId('resolve').click();
  // No default outcome: confirming needs an explicit choice (P10).
  await expect(page.getByTestId('resolve-outcome')).toHaveValue('');
  await expect(page.getByTestId('confirm-resolve')).toBeDisabled();
  await page.getByTestId('resolve-outcome').selectOption('Tarif confirmé');
  // Typed key by key: the note is the 2nd field, after the outcome select (P3).
  await page.getByTestId('resolve-note').click();
  await page.keyboard.type('Prix conforme au devis accepté.');
  await expect(page.getByTestId('resolve-note')).toHaveValue('Prix conforme au devis accepté.');
  await expect(page.getByTestId('resolve-outcome')).toHaveValue('Tarif confirmé');
  await page.getByTestId('confirm-resolve').click();
  await expect(page.getByText(/Résolue · Tarif confirmé/)).toBeVisible();
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

test('P3 · keystrokes stay in the field being typed in, inside a multi-field dialog', async ({ page }) => {
  await resetScenario('default');
  await adminLogin(page);
  await page.goto('/finance');
  const trigger = page.getByTestId('correct-DR-001');
  await trigger.click();
  // Focus moves to the first field once, when the dialog opens.
  await expect(page.getByTestId('correction-driver')).toBeFocused();
  // keyboard.type sends one key at a time like a person; fill() sets the value in one event and hid this bug.
  await page.getByTestId('correction-amount').click();
  await page.keyboard.type('12,5');
  await page.getByTestId('correction-reason').click();
  await page.keyboard.type('Remboursement de péage justifié par ticket.');
  await expect(page.getByTestId('correction-reason')).toBeFocused();
  await expect(page.getByTestId('correction-amount')).toHaveValue('12,5');
  await expect(page.getByTestId('correction-reason')).toHaveValue('Remboursement de péage justifié par ticket.');
  await expect(page.getByTestId('correction-driver')).toHaveValue('DR-001');
  // Escape closes the dialog and gives focus back to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('correction-dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('P12 · the Services catalog editor takes decimal fares and lists, empties to the city fare, and keeps the id', async ({ page }) => {
  await resetScenario('default');
  await adminLogin(page);
  await page.goto('/services');
  await page.getByTestId('catalog-edit-scooter').click();
  const dialog = page.getByTestId('catalog-dialog');
  await expect(page.getByTestId('catalog-id')).toHaveValue('scooter');
  await expect(page.getByTestId('catalog-id')).toHaveAttribute('readonly', '');
  await page.getByTestId('catalog-perKm').selectText();
  await page.keyboard.type('2,5');
  await page.getByTestId('catalog-baseFare').selectText();
  await page.keyboard.press('Backspace');
  await page.getByTestId('catalog-cityIds').click();
  await page.keyboard.type('rabat, casablanca');
  await page.getByTestId('catalog-minimumFare').selectText();
  await page.keyboard.type('quinze');
  await page.getByTestId('catalog-save').click();
  await expect(dialog).toContainText('Montant invalide');
  await page.getByTestId('catalog-minimumFare').selectText();
  await page.keyboard.type('15.5');
  await expect(page.getByTestId('catalog-perKm')).toHaveValue('2,5');
  await expect(page.getByTestId('catalog-cityIds')).toHaveValue('rabat, casablanca');
  await page.getByTestId('catalog-save').click();
  await expect(dialog).toHaveCount(0);
  const ctx = await api();
  const proto = await (await ctx.get('/admin/prototype', { headers: { Authorization: `Bearer ${await adminToken()}` } })).json();
  await ctx.dispose();
  const scooters = proto.catalog.categories.filter((c: { id: string }) => c.id === 'scooter');
  expect(proto.catalog.categories).toHaveLength(3);
  expect(scooters).toHaveLength(1);
  expect(scooters[0]).toMatchObject({ perKm: 250, baseFare: null, minimumFare: 1550, perMinute: 100, cityIds: ['rabat', 'casablanca'] });
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
