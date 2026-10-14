import { expect, test, type Page } from '@playwright/test';
import { adminToken, authed, byTestId, resetScenario, signInMobile, URLS } from './helpers';

const NEW_DRIVER = '+212677001122';

/** Stacked screens stay mounted on the web: act inside the current step only. */
const step = (page: Page, id: string) => page.locator(`[data-testid="signup-step-${id}"]`).last();

async function answer(page: Page, id: string, fill: (s: ReturnType<typeof step>) => Promise<void>) {
  const s = step(page, id);
  await expect(s).toBeVisible();
  await fill(s);
  await s.getByTestId('step-continue').click();
}

/** Documents: the demo sample (« Passer · exemple de démonstration »), saved on the server, then the next step. */
async function sampleDocument(page: Page, id: string) {
  const s = step(page, id);
  await expect(s).toBeVisible();
  await s.getByTestId('skip-capture').click();
}

test.describe('driver sign-up (D04)', () => {
  test('one question per screen, save and resume, documents, both dossiers sent: submission is not approval', async ({ page }) => {
    await resetScenario('default');
    await signInMobile(page, URLS.driver, 'driver', NEW_DRIVER);

    // A new driver lands on her dossier: nothing done yet.
    await expect(byTestId(page, 'dossier-hub')).toBeVisible();
    await expect(byTestId(page, 'dossier-overview')).toContainText('0 %');
    await byTestId(page, 'resume-signup').click();

    // Vous · questions. Errors only after the first « Continuer ».
    const name = step(page, 'name');
    await expect(name).toBeVisible();
    await expect(name.getByTestId('step-kicker')).toContainText('ÉTAPE 1 SUR');
    await name.getByTestId('step-continue').click();
    await expect(name.getByText('Prénom requis')).toBeVisible();
    await name.getByTestId('first-name').fill('Sara');
    await name.getByTestId('last-name').fill('Bennis');
    await name.getByTestId('step-continue').click();
    await answer(page, 'birth', (s) => s.getByTestId('birth-date').fill('01051995'));
    await answer(page, 'address', async (s) => {
      await s.getByTestId('address').fill('12 rue Oued Ziz, Agdal');
      await s.getByTestId('city-Rabat').click();
    });

    // Save and resume: « Plus tard » goes back to the dossier, « Reprendre » opens the next question.
    await expect(step(page, 'id_document')).toBeVisible();
    await step(page, 'id_document').getByTestId('signup-later').click();
    await expect(byTestId(page, 'dossier-hub').last()).toBeVisible();
    await page.reload();
    await expect(byTestId(page, 'resume-signup')).toContainText('Reprendre');
    await byTestId(page, 'resume-signup').click();

    await answer(page, 'id_document', (s) => s.getByTestId('document-number').fill('ab123456'));
    for (const id of ['id_front', 'id_back', 'selfie']) await sampleDocument(page, id);
    await answer(page, 'licence_number', (s) => s.getByTestId('licence-number').fill('12/345678'));
    await answer(page, 'licence_dates', async (s) => {
      await s.getByTestId('licence-issue').fill('01062015');
      await s.getByTestId('licence-expiry').fill('01062030');
    });
    await answer(page, 'experience', (s) => s.getByTestId('experience-5').click());
    for (const id of ['driving_licence', 'driving_licence_back']) await sampleDocument(page, id);

    // Vous · review and send: the vehicle questions follow.
    const personReview = step(page, 'person_review');
    await expect(personReview.getByTestId('review-step-person')).toBeVisible();
    await expect(personReview).toContainText('Sara');
    await personReview.getByTestId('submit-driver_identity').click();

    // Véhicule.
    await answer(page, 'vehicle_model', async (s) => {
      await s.getByTestId('vehicle-make').fill('Dacia');
      await s.getByTestId('vehicle-model').fill('Logan');
      await s.getByTestId('vehicle-year').fill('2020');
    });
    await answer(page, 'vehicle_plate', async (s) => {
      await s.getByTestId('vehicle-plate').fill('12345-a-6');
      await s.getByTestId('vehicle-color').fill('Blanc');
    });
    for (const id of [
      'vehicle_registration',
      'insurance',
      'technical_inspection',
      'vehicle_photo_front',
      'vehicle_photo_back',
      'vehicle_photo_left',
      'vehicle_photo_right',
      'vehicle_photo_interior',
    ])
      await sampleDocument(page, id);
    const vehicleReview = step(page, 'vehicle_review');
    await expect(vehicleReview.getByTestId('review-step-vehicle')).toContainText('12345-A-6');
    await vehicleReview.getByTestId('submit-vehicle').click();

    // Both dossiers wait for a person at Naya; offers stay blocked.
    await expect(byTestId(page, 'dossier-status').last()).toBeVisible();
    await expect(byTestId(page, 'review-driver_identity').last()).toContainText('Chauffeuse en attente d’examen');
    await expect(byTestId(page, 'review-vehicle').last()).toContainText('Véhicule en attente d’examen');
    await expect(byTestId(page, 'blocked-banner').last()).toBeVisible();

    // The administration sees both in its queue, as submitted.
    const admin = await authed(await adminToken());
    const queue = (await (await admin.get('/admin/verifications?status=queue')).json()) as { items: { user: { phone: string }; case: { subject: string; status: string } }[] };
    const mine = queue.items.filter((r) => r.user.phone === NEW_DRIVER).map((r) => `${r.case.subject}:${r.case.status}`).sort();
    expect(mine).toEqual(['driver_identity:submitted', 'vehicle:submitted']);
    await admin.dispose();
  });
});
