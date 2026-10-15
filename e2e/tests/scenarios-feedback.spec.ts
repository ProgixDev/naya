import { expect, test } from '@playwright/test';
import { api, PHONES, resetScenario, signInMobile, URLS } from './helpers';

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true };
test('feedback features: shared family journey, SOS, wallet, themes and logo gallery', async ({
  browser,
}) => {
  test.setTimeout(240000);
  await resetScenario('first-ride');
  const pc = await browser.newContext(phone),
    dc = await browser.newContext(phone),
    ac = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const p = await pc.newPage(),
    d = await dc.newPage(),
    a = await ac.newPage();
  try {
    await signInMobile(p, URLS.passenger, 'passenger', PHONES.salma);
    // Salma's family is seeded in every scenario: no example to load.
    await p.goto(URLS.passenger + '/family');
    await expect(
      p.getByText('Famille Essentiel', { exact: true }),
    ).toBeVisible();
    await signInMobile(d, URLS.driver, 'driver', PHONES.amina);
    await d.goto(URLS.driver + '/family');
    await expect(d.getByTestId('famille-eligibility')).toContainText('approuvée');
    await d.getByTestId(/^famille-trip-card-/).first().click();
    // Chauffeuse: depart, arrive, photograph the child, confirm, then « Démarrer ».
    await d.getByTestId('famille-depart').click();
    await d.getByTestId('famille-arrive').click();
    await d.getByTestId('famille-pickup-camera').click();
    await d.getByLabel('Prénom confirmé par la chauffeuse', { exact: true }).fill('Lina');
    await d.getByTestId('famille-pickup').click();
    await d.getByTestId('famille-request-start').click();
    await expect(d.getByTestId('famille-waiting-approval')).toBeVisible();
    // Parent (P-62): on Naya Famille the approval card sits above the live trip (the pinned banner hides there);
    // she approves on site, then opens the trip.
    const approval = p.getByTestId('famille-home').getByTestId('famille-approval');
    await expect(approval).toBeVisible({ timeout: 15000 });
    await approval.getByTestId('famille-approve-onsite').click();
    await p.getByTestId(/^famille-trip-card-/).first().click();
    await expect(p.getByText('Lina · Trajet en cours', { exact: true }).first()).toBeVisible();
    await expect(p.getByTestId('famille-live-map')).toBeVisible();
    await d.getByTestId('sos').click();
    // R10: the alert is sent by holding the red button 1.5 s.
    await d.getByTestId('confirm-sos').click({ delay: 1700 });
    await expect(d.getByText(/Alerte SOS-.* enregistrée/)).toBeVisible();
    // Connected mode: the sheet says the alert reached the SOS desk, and offers the real 19 call.
    await expect(d.getByTestId('sos-recorded')).toContainText('équipe sécurité');
    await expect(d.getByTestId('sos-call-police')).toBeVisible();
    await a.goto(URLS.admin + '/connexion');
    await a.getByTestId('email').fill('meryem@naya.demo');
    await a.getByTestId('password').fill('Naya-Admin-2026');
    await a.getByTestId('login-submit').click();
    await expect(
      a.getByRole('heading', { name: 'Centre des opérations' }),
    ).toBeVisible();
    await a.goto(URLS.admin + '/services');
    await a.getByRole('button', { name: 'SOS', exact: true }).click();
    await expect(
      a.getByText('Alerte déclenchée · position enregistrée', { exact: false }).first(),
    ).toBeVisible();
    await a
      .getByRole('button', { name: 'Prendre en charge', exact: true })
      .click();
    await a.getByRole('button', { name: 'Résoudre', exact: true }).click();
    await expect(a.getByText(/Résolue/)).toBeVisible();
    // Reach the school (the mock route moves on with the clock), then the drop-off photo and code close the trip.
    await (await api()).post('/dev/clock/advance', { data: { seconds: 60 } });
    await d.reload();
    await d.getByTestId('famille-dropoff-camera').click();
    // The chauffeuse names the authorised adult (the first one is preselected only when the family loaded before the trip).
    await d.getByRole('button', { name: 'Salma · Mère', exact: true }).click();
    await d.getByLabel('Code de remise', { exact: true }).fill('1234');
    await d.getByTestId('famille-dropoff').click();
    await expect(p.getByTestId('famille-trip-completed').getByTestId('famille-trip-title')).toContainText('Déposé · photo et remise confirmées', { timeout: 15000 });
    await p.goto(URLS.passenger + '/wallet');
    // P-40: one « Recharger » button opens the top-up sheet.
    await p.getByTestId('wallet-recharge').click();
    await p.getByTestId('wallet-topup').click();
    // The top-up waits for the provider, which confirms it on its own a few seconds later.
    await expect(p.getByText(/^Recharge · /).first()).toBeVisible();
    await (await api()).post('/dev/clock/advance', { data: { seconds: 3 } });
    await expect(p.getByTestId('wallet-balance')).toContainText(/100(?:,00)?\sMAD/);
    await p.goto(URLS.passenger + '/preferences');
    await p.getByTestId('theme-dark').click();
    await expect(p.getByTestId('preferences')).toHaveCSS(
      'background-color',
      'rgb(22, 18, 26)',
    );
    await expect(p.getByTestId('theme-dark')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await p.reload();
    await expect(p.getByTestId('theme-dark')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await p.goto(URLS.passenger + '/family');
    await p.screenshot({ path: '/tmp/naya-family-dark.png', fullPage: true });
    await d.goto(URLS.driver + '/profile/preferences');
    await d.getByTestId('theme-dark').click();
    await expect(d.getByTestId('preferences')).toHaveCSS('background-color', 'rgb(22, 18, 26)');
    await d.reload();
    await expect(d.getByTestId('theme-dark')).toHaveAttribute('aria-selected', 'true');
    await d.goto(URLS.driver + '/family');
    await d.screenshot({ path: '/tmp/naya-driver-family.png', fullPage: true });
    await p.goto(URLS.passenger + '/brand');
    await expect(p.getByText('06 · La porte', { exact: true })).toBeVisible();
    await a
      .getByRole('button', { name: '6 pistes de logo', exact: true })
      .click();
    await expect(
      a.getByRole('heading', { name: '06 · La porte', exact: true }),
    ).toBeVisible();
    await a.screenshot({
      path: '/tmp/naya-admin-prototype.png',
      fullPage: true,
    });
  } finally {
    await pc.close();
    await dc.close();
    await ac.close();
  }
});
