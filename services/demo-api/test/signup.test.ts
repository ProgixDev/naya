import { describe, expect, it } from 'vitest';
import { REQUIRED_ITEMS, type VerificationItemKey } from '@naya/domain';
import { PHONES, setup } from './harness';

type H = ReturnType<typeof setup>;

const PERSON = {
  firstName: 'Ghita',
  lastName: 'Sefrioui',
  birthDate: '1993-05-14',
  address: '21 rue Tensift, Agdal',
  city: 'Rabat',
  documentType: 'cin',
  documentNumber: 'GS123456',
  licenceNumber: '14/778899',
  licenceCategory: 'B',
  licenceIssueDate: '2014-09-01',
  licenceExpiryDate: '2034-09-01',
  experienceYears: 10,
};

const FAMILLE = {
  reference1Name: 'Khadija Alami',
  reference1Phone: '+212600000001',
  reference2Name: 'Souad Kettani',
  reference2Phone: '+212600000002',
  childExperienceYears: 6,
  childExperienceSummary: 'Mère de deux enfants, accompagnatrice scolaire depuis 2020.',
  trainingAcknowledged: true,
  interviewDay: '2026-10-03',
  interviewWindow: 'afternoon',
};

async function attach(h: H, token: string, caseId: string, keys: VerificationItemKey[]) {
  let last: any;
  for (const key of keys) {
    const up = await h.ok('POST', '/dev/sample-upload', { token, body: { purpose: key } });
    last = await h.ok('PUT', `/verification/${caseId}/items/${key}`, { token, body: { uploadIds: [up.id] } });
  }
  return last;
}

describe('Driver sign-up · one question per step, saved as a draft', () => {
  it('promotes complete answers, resumes from the draft and submits with the new documents', async () => {
    const h = setup();
    const t = await h.login('+212677000101', 'driver');
    const me = await h.ok('GET', '/me', { token: t });
    const person = me.cases.find((c: any) => c.subject === 'driver_identity');

    // Step by step: only complete groups become typed details.
    let c = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { firstName: 'Ghita', lastName: 'Sefrioui' } });
    expect(c.draft).toMatchObject({ firstName: 'Ghita' });
    expect(c.identity).toBeNull();
    c = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { birthDate: PERSON.birthDate, documentType: 'cin', documentNumber: 'GS123456' } });
    expect(c.identity).toMatchObject({ firstName: 'Ghita', documentNumber: 'GS123456' });
    expect(c.identity.address).toBeUndefined();
    c = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: PERSON });
    expect(c.identity).toMatchObject({ address: '21 rue Tensift, Agdal', city: 'Rabat' });
    expect(c.licence).toEqual({ number: '14/778899', category: 'B', issueDate: '2014-09-01', expiryDate: '2034-09-01', experienceYears: 10 });

    // Resume: the draft is on the server, so another session sees it.
    const again = (await h.ok('GET', '/me', { token: t })).cases.find((x: any) => x.id === person.id);
    expect(again.draft.licenceNumber).toBe('14/778899');

    // The licence back is now required; the criminal-record extract is not.
    await attach(h, t, person.id, REQUIRED_ITEMS.driver_identity.filter((k) => k !== 'driving_licence_back'));
    const early = await h.call('POST', `/verification/${person.id}/submit`, { token: t });
    expect(early.body.error.code).toBe('VERIFICATION_INCOMPLETE');
    expect(early.body.error.details.missing).toEqual(['driving_licence_back']);
    await attach(h, t, person.id, ['driving_licence_back']);
    expect((await h.ok('POST', `/verification/${person.id}/submit`, { token: t })).status).toBe('submitted');

    // Vehicle: technical inspection and five views.
    const vc = await h.ok('POST', '/verification/vehicle', { token: t });
    await h.ok('PUT', `/verification/${vc.id}/draft`, { token: t, body: { make: 'Dacia', model: 'Logan', year: 2021, plate: '12345-A-6', color: 'Blanc' } });
    await attach(h, t, vc.id, REQUIRED_ITEMS.vehicle);
    expect((await h.ok('POST', `/verification/${vc.id}/submit`, { token: t })).status).toBe('submitted');
    expect((await h.ok('GET', '/me', { token: t })).vehicle).toMatchObject({ make: 'Dacia', plate: '12345-A-6' });
  });

  it('refuses an expired licence, a wrong category and a document from another dossier', async () => {
    const h = setup();
    const t = await h.login('+212677000102', 'driver');
    const person = (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.subject === 'driver_identity');
    const expired = await h.call('PUT', `/verification/${person.id}/licence`, { token: t, body: { number: '14/778899', category: 'B', issueDate: '2010-01-01', expiryDate: '2026-09-30', experienceYears: 5 } });
    expect(expired.status).toBe(422);
    expect(expired.body.error.details.fields.expiryDate).toMatch(/expiré/);
    const wrong = await h.call('PUT', `/verification/${person.id}/licence`, { token: t, body: { number: '14/778899', category: 'A', issueDate: '2010-01-01', expiryDate: '2030-01-01', experienceYears: 5 } });
    expect(wrong.body.error.details.fields.category).toMatch(/permis B/);
    // A draft with an invalid licence stays a draft: nothing is promoted.
    const c = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { ...PERSON, licenceExpiryDate: '2026-01-01' } });
    expect(c.licence ?? null).toBeNull();
    const up = await h.ok('POST', '/dev/sample-upload', { token: t, body: { purpose: 'insurance' } });
    const misplaced = await h.call('PUT', `/verification/${person.id}/items/insurance`, { token: t, body: { uploadIds: [up.id] } });
    expect(misplaced.status).toBe(422);
    // Passengers cannot use the driver draft.
    const salma = await h.login(PHONES.salma, 'passenger');
    const own = (await h.ok('GET', '/me', { token: salma })).cases[0];
    expect((await h.call('PUT', `/verification/${own.id}/draft`, { token: salma, body: { firstName: 'X' } })).status).toBe(403);
  });

  it('re-checks every step at submission, so a later answer cannot contradict the details sent (DS-2)', async () => {
    const h = setup();
    const t = await h.login('+212677000105', 'driver');
    const person = (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.subject === 'driver_identity');
    const caseOf = async () => (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.id === person.id);
    await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: PERSON });
    await attach(h, t, person.id, REQUIRED_ITEMS.driver_identity);

    // Probe 1: a birth date in 2015 is kept as a draft answer while the typed details keep 1993.
    const child = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { birthDate: '2015-03-01' } });
    expect(child.identity.birthDate).toBe('1993-05-14');
    const refusedChild = await h.call('POST', `/verification/${person.id}/submit`, { token: t });
    expect(refusedChild.status).toBe(422);
    expect(refusedChild.body.error).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/^Corrigez l’étape « Date de naissance » .*18 ans/) });
    expect(refusedChild.body.error.details).toMatchObject({ step: 'birth', fields: { birthDate: expect.stringMatching(/18 ans/) } });
    expect((await caseOf()).status).toBe('draft');

    // Probe 2: a valid new birth date is promoted, but the stored licence would then be issued at 14.
    const adult = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { birthDate: '2000-01-01' } });
    expect(adult.identity.birthDate).toBe('2000-01-01');
    expect(adult.licence.issueDate).toBe('2014-09-01');
    const refusedLicence = await h.call('POST', `/verification/${person.id}/submit`, { token: t });
    expect(refusedLicence.status).toBe(422);
    expect(refusedLicence.body.error.message).toMatch(/^Corrigez l’étape « Validité du permis » avant d’envoyer votre dossier\. Le permis B est délivré à partir de 18 ans/);
    expect(refusedLicence.body.error.details).toMatchObject({ step: 'licence_dates', fields: { licenceIssueDate: expect.stringMatching(/18 ans/) } });
    const audit = h.ctx.store.state.audit.filter((e) => e.entityId === person.id && e.action === 'verification.submitted');
    expect(audit).toHaveLength(0);

    // Correcting the answer sends the dossier; the reviewer reads what the driver sees.
    await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { birthDate: PERSON.birthDate } });
    const sent = await h.ok('POST', `/verification/${person.id}/submit`, { token: t });
    expect(sent.status).toBe('submitted');
    expect(sent.identity.birthDate).toBe(PERSON.birthDate);
    expect(sent.licence.issueDate).toBe(PERSON.licenceIssueDate);
  });

  it('names the failing step, not missing pieces, once every piece is there (DS-2)', async () => {
    const h = setup();
    // An address made invalid after a complete dossier: the identity loses it, but no piece is missing.
    const t = await h.login('+212677000106', 'driver');
    const person = (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.subject === 'driver_identity');
    await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: PERSON });
    const cleared = await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: { address: 'abc' } });
    expect(cleared.identity.address).toBeUndefined();
    // Missing pieces are still reported first.
    const early = await h.call('POST', `/verification/${person.id}/submit`, { token: t });
    expect(early.body.error.code).toBe('VERIFICATION_INCOMPLETE');
    expect(early.body.error.details.missing.length).toBeGreaterThan(0);
    await attach(h, t, person.id, REQUIRED_ITEMS.driver_identity);
    const address = await h.call('POST', `/verification/${person.id}/submit`, { token: t });
    expect(address.status).toBe(422);
    expect(address.body.error).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/^Corrigez l’étape « Adresse » avant d’envoyer votre dossier\. Indiquez votre adresse complète\.$/) });
    expect(address.body.error.details).toMatchObject({ step: 'address', fields: { address: expect.any(String) } });

    // A birth date that was never valid: no identity was ever promoted.
    const t2 = await h.login('+212677000107', 'driver');
    const other = (await h.ok('GET', '/me', { token: t2 })).cases.find((c: any) => c.subject === 'driver_identity');
    await h.ok('PUT', `/verification/${other.id}/draft`, { token: t2, body: { ...PERSON, birthDate: '2015-03-01' } });
    await attach(h, t2, other.id, REQUIRED_ITEMS.driver_identity);
    const birth = await h.call('POST', `/verification/${other.id}/submit`, { token: t2 });
    expect(birth.status).toBe(422);
    expect(birth.body.error.details).toMatchObject({ step: 'birth' });
    expect(birth.body.error.message).toMatch(/^Corrigez l’étape « Date de naissance »/);
    expect((await h.ok('GET', '/me', { token: t2 })).cases.find((c: any) => c.id === other.id).status).toBe('draft');
  });
});

describe('Naya Famille vetting · opt-in, criminal-record extract, familleEligibility', () => {
  it('not_requested → pending on submission → approved by a reviewer', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    // Leila: person and vehicle approved, never applied (Nadia, the bot chauffeuse, is seeded approved).
    const t = await h.login(PHONES.leila, 'driver');
    expect((await h.ok('GET', '/me', { token: t })).user.familleEligibility ?? 'not_requested').toBe('not_requested');
    const fc = await h.ok('POST', '/verification/famille', { token: t });
    expect(fc.subject).toBe('driver_famille');
    expect((await h.ok('POST', '/verification/famille', { token: t })).id).toBe(fc.id);
    expect((await h.call('POST', `/verification/${fc.id}/submit`, { token: t })).body.error.details.missing).toEqual(['criminal_record']);

    // A reference cannot be the driver herself.
    await h.ok('PUT', `/verification/${fc.id}/draft`, { token: t, body: { ...FAMILLE, reference1Phone: PHONES.leila } });
    expect((await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.id === fc.id).famille ?? null).toBeNull();
    const filled = await h.ok('PUT', `/verification/${fc.id}/draft`, { token: t, body: FAMILLE });
    expect(filled.famille).toMatchObject({ trainingAcknowledged: true, interview: { day: '2026-10-03', window: 'afternoon' } });
    await attach(h, t, fc.id, ['criminal_record']);
    await h.ok('POST', `/verification/${fc.id}/submit`, { token: t });
    expect((await h.ok('GET', '/me', { token: t })).user.familleEligibility).toBe('pending');

    const rows = (await h.ok('GET', '/admin/people?role=driver&q=Leila', { token: admin })).items;
    expect(rows[0].familleStatus).toBe('submitted');
    const queued = (await h.ok('GET', '/admin/verifications?status=queue&subject=driver_famille', { token: admin })).items.map((r: any) => r.case.id);
    expect(queued).toContain(fc.id);
    const kase = (await h.ok('GET', `/admin/verifications/${fc.id}`, { token: admin })).case;
    await h.ok('POST', `/admin/verifications/${fc.id}/decision`, { token: admin, body: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: kase.version } });
    expect((await h.ok('GET', '/me', { token: t })).user.familleEligibility).toBe('approved');
  });

  it('a refusal sets rejected; a recoverable one can be restarted (back to not_requested)', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const houda = await h.login('+212667890123', 'driver');
    expect((await h.ok('GET', '/me', { token: houda })).user.familleEligibility).toBe('pending');
    const fc = (await h.ok('GET', '/me', { token: houda })).cases.find((c: any) => c.subject === 'driver_famille');
    await h.ok('POST', `/admin/verifications/${fc.id}/decision`, { token: admin, body: { outcome: 'rejected', reasonCode: 'document_expired', message: 'L’extrait date de plus de trois mois.', corrections: [], expectedVersion: fc.version } });
    expect((await h.ok('GET', '/me', { token: houda })).user.familleEligibility).toBe('rejected');
    await h.ok('POST', `/verification/${fc.id}/reopen`, { token: houda });
    expect((await h.ok('GET', '/me', { token: houda })).user.familleEligibility).toBe('not_requested');
  });

  it('seeds an approved Famille driver and leaves regular drivers unaffected', async () => {
    const h = setup();
    const amina = await h.login(PHONES.amina, 'driver');
    expect((await h.ok('GET', '/me', { token: amina })).user.familleEligibility).toBe('approved');
    const khadija = await h.login(PHONES.khadija, 'driver');
    expect((await h.ok('GET', '/me', { token: khadija })).user.familleEligibility ?? 'not_requested').toBe('not_requested');
    // Going online never depends on Famille.
    expect((await h.ok('POST', '/driver/online', { token: amina, body: { online: true } })).online).toBe(true);
  });
});

describe('Demo engine · simulated review outcomes and resumable seed', () => {
  it('the scenario reviewer can approve, request a correction or refuse the caller’s own dossier', async () => {
    const h = setup();
    const t = await h.login('+212677000103', 'driver');
    const person = (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.subject === 'driver_identity');
    expect((await h.call('POST', `/dev/verification/${person.id}/simulate`, { token: t, body: { outcome: 'approved' } })).status).toBe(409);
    await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: PERSON });
    await attach(h, t, person.id, REQUIRED_ITEMS.driver_identity);
    await h.ok('POST', `/verification/${person.id}/submit`, { token: t });
    const more = await h.ok('POST', `/dev/verification/${person.id}/simulate`, { token: t, body: { outcome: 'more_info_requested', itemKey: 'selfie' } });
    expect(more.status).toBe('more_info_requested');
    expect(more.items.find((i: any) => i.key === 'selfie')).toMatchObject({ status: 'needs_correction', note: expect.stringMatching(/^Photo floue/) });
    // The wording is what a reviewer would write: nothing tells the user it was simulated.
    // The reviewer's identity (decidedBy, decidedByName) is the system actor, checked below (DS-1).
    const { decidedBy: _by, decidedByName: _name, ...decision } = more.decision;
    expect(JSON.stringify([decision, more.items])).not.toMatch(/d[ée]mo|simul/i);
    await attach(h, t, person.id, ['selfie']);
    await h.ok('POST', `/verification/${person.id}/submit`, { token: t });
    const refused = await h.ok('POST', `/dev/verification/${person.id}/simulate`, { token: t, body: { outcome: 'rejected' } });
    expect(refused.decision).toMatchObject({ reasonCode: 'document_expired', message: expect.stringMatching(/^Pièce expirée/) });
    await h.ok('POST', `/verification/${person.id}/reopen`, { token: t });
    // Another user's dossier cannot be decided.
    const other = await h.login(PHONES.samira, 'driver');
    expect((await h.call('POST', `/dev/verification/${person.id}/simulate`, { token: other, body: { outcome: 'approved' } })).status).toBe(403);
  });

  it('decides as a labelled system reviewer, never in an admin’s name, and refuses passengers (DS-1)', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const admins = h.ctx.store.state.admins;
    const isAdmin = (actor: { id: string; name: string }) => admins.some((a) => a.id === actor.id || a.name === actor.name);
    const t = await h.login('+212677000104', 'driver');
    const person = (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.subject === 'driver_identity');
    await h.ok('PUT', `/verification/${person.id}/draft`, { token: t, body: PERSON });
    await attach(h, t, person.id, REQUIRED_ITEMS.driver_identity);
    await h.ok('POST', `/verification/${person.id}/submit`, { token: t });

    const approved = await h.ok('POST', `/dev/verification/${person.id}/simulate`, { token: t, body: { outcome: 'approved' } });
    expect(approved.status).toBe('approved');
    expect(approved.decision).toMatchObject({ decidedBy: 'system:demo-review', decidedByName: 'Réviseuse de démonstration', message: 'Votre dossier a été validé.' });
    expect(isAdmin({ id: approved.decision.decidedBy, name: approved.decision.decidedByName })).toBe(false);
    expect(approved.history.some((x: any) => admins.some((a) => a.id === x.by))).toBe(false);

    // The hash-chained audit entry names the system actor and an action marked as simulated.
    const simulated = await h.ok('GET', '/admin/audit?action=verification.simulated_approved', { token: admin });
    const event = simulated.items.find((e: any) => e.entityId === person.id);
    expect(event.actor).toEqual({ type: 'system', id: 'system:demo-review', name: 'Réviseuse de démonstration' });
    expect(isAdmin(event.actor)).toBe(false);
    expect(event.summary).toMatch(/^Démo · examen simulé/);
    expect(simulated.integrity.valid).toBe(true);
    const real = await h.ok('GET', '/admin/audit?action=verification.approved', { token: admin });
    expect(real.items.some((e: any) => e.entityId === person.id)).toBe(false);

    // A passenger cannot approve her own identity, even in dev mode.
    const nour = await h.login(PHONES.nour, 'passenger');
    const own = (await h.ok('GET', '/me', { token: nour })).cases[0];
    expect(own.status).toBe('submitted');
    expect((await h.call('POST', `/dev/verification/${own.id}/simulate`, { token: nour, body: { outcome: 'approved' } })).status).toBe(403);
    expect((await h.ok('GET', '/me', { token: nour })).cases[0].status).toBe('submitted');
  });

  it('Yasmine resumes after her name; the audit trail records the Famille opt-in', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const t = await h.login('+212666789012', 'driver');
    const person = (await h.ok('GET', '/me', { token: t })).cases.find((c: any) => c.subject === 'driver_identity');
    expect(person).toMatchObject({ status: 'draft', identity: null, draft: { firstName: 'Yasmine', lastName: 'Berrada' } });
    const fc = await h.ok('POST', '/verification/famille', { token: t });
    const audit = (await h.ok('GET', '/admin/audit?action=verification.famille_opt_in', { token: admin })).items;
    expect(audit.some((e: any) => e.entityId === fc.id)).toBe(true);
  });
});
