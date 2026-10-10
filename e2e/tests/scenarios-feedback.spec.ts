import { expect, test } from '@playwright/test';
import { PHONES, resetScenario, signInMobile, URLS } from './helpers';

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true };
test('feedback demo: shared family journey, SOS, wallet, themes and logo gallery', async ({
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
    await p.goto(URLS.passenger + '/family');
    await p.getByTestId('family-example').click();
    await expect(
      p.getByText('Famille Essentiel', { exact: true }),
    ).toBeVisible();
    await signInMobile(d, URLS.driver, 'driver', PHONES.amina);
    await d.goto(URLS.driver + '/family');
    await expect(
      d.getByRole('button', { name: 'Je pars chercher l’enfant', exact: true }),
    ).toBeVisible();
    await d
      .getByRole('button', { name: 'Je pars chercher l’enfant', exact: true })
      .click();
    await d
      .getByRole('button', {
        name: 'Photo d’arrivée (simulation)',
        exact: true,
      })
      .click();
    await d
      .getByLabel('Prénom de l’enfant vérifié', { exact: true })
      .fill('Lina');
    await d
      .getByRole('button', {
        name: 'Enfant récupéré',
        exact: true,
      })
      .click();
    await d
      .getByRole('button', { name: 'Démarrer le trajet', exact: true })
      .click();
    await expect(
      p.getByText('Lina · Trajet en cours', { exact: true }),
    ).toBeVisible();
    // Hold for 1 s: a simple tap only explains how to trigger the alert.
    await d.getByTestId('sos').click({ delay: 1200 });
    await d.getByTestId('confirm-sos').click();
    await expect(d.getByText(/Alerte SOS-.* enregistrée/)).toBeVisible();
    await d
      .getByTestId('sos-support')
      .click();
    await a.goto(URLS.admin + '/connexion');
    await a.getByTestId('email').fill('meryem@naya.demo');
    await a.getByTestId('password').fill('Naya-Admin-2026');
    await a.getByTestId('login-submit').click();
    await expect(
      a.getByRole('heading', { name: 'Centre des opérations' }),
    ).toBeVisible();
    await a.goto(URLS.admin + '/services');
    await a.getByRole('tab', { name: 'SOS' }).click();
    await expect(
      a.getByText('Support Naya contacté', { exact: false }),
    ).toBeVisible();
    await a
      .getByRole('button', { name: 'Prendre en charge', exact: true })
      .click();
    await a.getByRole('button', { name: 'Résoudre', exact: true }).click();
    await expect(a.getByText('Résolue', { exact: true }).first()).toBeVisible();
    // Reload closes the focused safety sheet while retaining the trip.
    await d.reload();
    await d.getByLabel('Code donné par la personne', { exact: true }).fill('1234');
    await d
      .getByRole('button', {
        name: 'Confirmer l’arrivée et la remise',
        exact: true,
      })
      .click();
    await expect(p.getByText(/Remis·e à .* \(Mère\)/)).toBeVisible();
    await expect(
      d.getByRole('button', { name: 'Je pars chercher l’enfant', exact: true }),
    ).toBeVisible();
    await p.goto(URLS.passenger + '/wallet');
    await p.getByTestId('wallet-topup').click();
    await p
      .getByRole('button', { name: 'Simuler la confirmation', exact: true })
      .click();
    await expect(p.getByText(/^100(?:,00)?\sMAD$/).first()).toBeVisible();
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
      .getByRole('tab', { name: 'Pistes de logo' })
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
