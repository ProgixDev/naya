import { describe, expect, it } from 'vitest';
import {
  assertSubmittable,
  documentStatus,
  dossierOverview,
  draftView,
  familleApplicationSchema,
  familleEligibilityFor,
  familleEligibilityOf,
  familleProblems,
  fullYearsBetween,
  interviewDays,
  isCalendarDate,
  licenceProblems,
  nextStepAfter,
  promoteSignupDraft,
  REQUIRED_ITEMS,
  sectionProgress,
  validateSignupStep,
  type SignupDraft,
  type VerificationCase,
  type VerificationItem,
} from '../src';

const ctx = { today: '2026-10-13', ownPhone: '+212661234567' };

const person: SignupDraft = {
  firstName: 'Yasmine',
  lastName: 'Berrada',
  birthDate: '1994-03-02',
  address: '12 rue Oued Ziz, Agdal',
  city: 'Rabat',
  documentType: 'cin',
  documentNumber: 'AB123456',
  licenceNumber: '12/345678',
  licenceCategory: 'B',
  licenceIssueDate: '2015-06-01',
  licenceExpiryDate: '2030-06-01',
  experienceYears: 9,
};

const famille: SignupDraft = {
  reference1Name: 'Khadija Alami',
  reference1Phone: '+212600000001',
  reference2Name: 'Souad Kettani',
  reference2Phone: '+212600000002',
  childExperienceYears: 6,
  childExperienceSummary: 'Mère de deux enfants, accompagnatrice scolaire depuis 2020.',
  trainingAcknowledged: true,
  interviewDay: '2026-10-15',
  interviewWindow: 'morning',
};

const item = (key: VerificationItem['key'], status: VerificationItem['status'] = 'provided', note: string | null = null): VerificationItem => ({ key, uploadIds: status === 'missing' ? [] : ['UP-1'], status, note });

function kase(partial: Partial<VerificationCase>): VerificationCase {
  return {
    id: 'VD-1',
    subject: 'driver_identity',
    userId: 'DR-1',
    vehicleId: null,
    status: 'draft',
    items: [],
    identity: null,
    vehicle: null,
    decision: null,
    history: [],
    submittedAt: null,
    updatedAt: '2026-10-13T08:00:00.000Z',
    version: 1,
    ...partial,
  };
}

describe('dates', () => {
  it('rejects impossible calendar dates', () => {
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('13/10/2026')).toBe(false);
  });
  it('counts whole years', () => {
    expect(fullYearsBetween('2015-06-01', '2026-05-31')).toBe(10);
    expect(fullYearsBetween('2015-06-01', '2026-06-01')).toBe(11);
  });
});

describe('licence rules', () => {
  it('requires category B, a past issue date and a valid licence', () => {
    expect(licenceProblems({ category: 'A' }, ctx).category).toMatch(/permis B/);
    expect(licenceProblems({ issueDate: '2027-01-01' }, ctx).issueDate).toMatch(/futur/);
    expect(licenceProblems({ expiryDate: '2026-10-13' }, ctx).expiryDate).toMatch(/expiré/);
    expect(licenceProblems({ issueDate: '2020-01-01', expiryDate: '2019-01-01' }, { today: '2018-01-01' }).expiryDate).toBeDefined();
  });
  it('checks the licence was issued at 18 or older', () => {
    expect(licenceProblems({ issueDate: '2010-01-01' }, { ...ctx, birthDate: '1994-03-02' }).issueDate).toMatch(/18 ans/);
    expect(licenceProblems({ issueDate: '2012-03-02' }, { ...ctx, birthDate: '1994-03-02' }).issueDate).toBeUndefined();
  });
  it('caps declared experience at the licence’s age', () => {
    expect(licenceProblems({ issueDate: '2020-11-01', experienceYears: 6 }, ctx).experienceYears).toMatch(/5 ans/);
    expect(licenceProblems({ issueDate: '2020-11-01', experienceYears: 5 }, ctx).experienceYears).toBeUndefined();
  });
});

describe('sign-up steps', () => {
  it('validates one question with French messages', () => {
    expect(validateSignupStep('name', {}, ctx)).toEqual({ firstName: expect.any(String), lastName: expect.any(String) });
    expect(validateSignupStep('birth', { birthDate: '2015-01-01' }, ctx).birthDate).toMatch(/18 ans/);
    expect(validateSignupStep('address', { address: 'Agdal', city: 'Rabat' }, ctx).address).toMatch(/adresse complète/);
    expect(validateSignupStep('name', person, ctx)).toEqual({});
  });
  it('applies cross-field licence rules against the rest of the draft', () => {
    expect(validateSignupStep('licence_number', { ...person, licenceCategory: 'C' }, ctx).licenceCategory).toMatch(/permis B/);
    expect(validateSignupStep('licence_dates', { ...person, licenceExpiryDate: '2025-01-01' }, ctx).licenceExpiryDate).toMatch(/expiré/);
    expect(validateSignupStep('experience', { ...person, experienceYears: 30 }, ctx).experienceYears).toMatch(/ancienneté/);
    expect(validateSignupStep('licence_dates', person, ctx)).toEqual({});
  });
  it('requires two distinct references who are not the driver, and a future interview day', () => {
    expect(validateSignupStep('famille_references', { ...famille, reference2Phone: famille.reference1Phone }, ctx).reference2Phone).toMatch(/différentes/);
    expect(validateSignupStep('famille_references', { ...famille, reference1Phone: ctx.ownPhone }, ctx).reference1Phone).toMatch(/vous-même/);
    expect(validateSignupStep('famille_interview', { ...famille, interviewDay: '2026-10-13' }, ctx).interviewDay).toMatch(/à venir/);
    expect(validateSignupStep('famille_interview', { ...famille, interviewDay: '2026-10-18' }, ctx).interviewDay).toMatch(/lundi au samedi/);
    expect(validateSignupStep('famille_training', { trainingAcknowledged: false }, ctx).trainingAcknowledged).toBeDefined();
  });
  it('offers interview days without Sundays', () => {
    const days = interviewDays('2026-10-16', 3);
    expect(days).toEqual(['2026-10-17', '2026-10-19', '2026-10-20']);
  });
  it('walks the person section in order and ends on the review', () => {
    expect(nextStepAfter('name')?.id).toBe('birth');
    expect(nextStepAfter('driving_licence_back')?.id).toBe('person_review');
    expect(nextStepAfter('person_review')).toBeNull();
  });
});

describe('draft promotion', () => {
  it('promotes complete groups only', () => {
    const partial = promoteSignupDraft('driver_identity', { firstName: 'Yasmine', lastName: 'Berrada' }, ctx);
    expect(partial).toEqual({});
    const full = promoteSignupDraft('driver_identity', person, ctx);
    expect(full.identity).toMatchObject({ firstName: 'Yasmine', address: '12 rue Oued Ziz, Agdal', city: 'Rabat' });
    expect(full.licence).toEqual({ number: '12/345678', category: 'B', issueDate: '2015-06-01', expiryDate: '2030-06-01', experienceYears: 9 });
  });
  it('keeps the licence out while one rule fails', () => {
    expect(promoteSignupDraft('driver_identity', { ...person, licenceCategory: 'A' }, ctx).licence).toBeUndefined();
  });
  it('promotes the Famille application', () => {
    const out = promoteSignupDraft('driver_famille', famille, ctx);
    expect(out.famille?.references[1]).toEqual({ name: 'Souad Kettani', phone: '+212600000002' });
    expect(out.famille?.interview).toEqual({ day: '2026-10-15', window: 'morning' });
    expect(familleApplicationSchema.safeParse({ ...out.famille, trainingAcknowledged: false }).success).toBe(false);
  });
  it('reads back promoted details and newer draft answers', () => {
    const c = kase({ identity: { firstName: 'A', lastName: 'B', birthDate: '1990-01-01', documentType: 'cin', documentNumber: 'XY12345' }, draft: { firstName: 'Amina' } });
    expect(draftView(c)).toMatchObject({ firstName: 'Amina', lastName: 'B', documentNumber: 'XY12345' });
  });
});

describe('document status', () => {
  it('follows manquant → envoyé → en vérification → approuvé / refusé', () => {
    expect(documentStatus(null, 'selfie').status).toBe('missing');
    expect(documentStatus(kase({ items: [item('selfie')] }), 'selfie').status).toBe('sent');
    expect(documentStatus(kase({ status: 'submitted', items: [item('selfie')] }), 'selfie').status).toBe('in_review');
    expect(documentStatus(kase({ status: 'in_review', items: [item('selfie')] }), 'selfie').status).toBe('in_review');
    expect(documentStatus(kase({ status: 'approved', items: [item('selfie', 'accepted')] }), 'selfie').status).toBe('approved');
    const flagged = documentStatus(kase({ status: 'more_info_requested', items: [item('selfie', 'needs_correction', 'Photo floue, reprenez-la.')] }), 'selfie');
    expect(flagged).toEqual({ status: 'rejected', reason: 'Photo floue, reprenez-la.' });
  });
  it('carries the dossier decision when the whole dossier was refused', () => {
    const c = kase({ status: 'rejected', items: [item('selfie')], decision: { outcome: 'rejected', reasonCode: 'document_expired', message: 'Pièce expirée.', decidedBy: 'AD-1', decidedByName: 'X', decidedAt: '' } });
    expect(documentStatus(c, 'selfie')).toEqual({ status: 'rejected', reason: 'Pièce expirée.' });
  });
});

describe('progress and submission', () => {
  it('counts questions and documents and points to the next step', () => {
    expect(sectionProgress('person', null, ctx)).toMatchObject({ done: 0, total: 12, next: { id: 'name' } });
    const c = kase({ draft: { firstName: 'Yasmine', lastName: 'Berrada' } });
    expect(sectionProgress('person', c, ctx)).toMatchObject({ done: 1, next: { id: 'birth' } });
    const ready = kase({ draft: person, items: REQUIRED_ITEMS.driver_identity.map((k) => item(k)) });
    expect(sectionProgress('person', ready, ctx)).toMatchObject({ done: 12, next: { id: 'person_review' } });
    expect(sectionProgress('person', { ...ready, status: 'submitted' }, ctx).next).toBeNull();
  });
  it('gives one dossier figure; Famille counts only once the driver opted in', () => {
    const o = dossierOverview({ person: null, vehicle: null }, ctx);
    expect(o).toMatchObject({ done: 0, total: 22, percent: 0, next: { section: 'person' } });
    const withFamille = dossierOverview({ person: null, vehicle: null, famille: kase({ subject: 'driver_famille' }) }, ctx);
    expect(withFamille.total).toBe(27);
  });
  it('requires address, city and licence before a driver can submit, and a valid licence', () => {
    const items = REQUIRED_ITEMS.driver_identity.map((k) => item(k));
    const identity = { firstName: 'Y', lastName: 'B', birthDate: '1994-03-02', documentType: 'cin' as const, documentNumber: 'AB12345' };
    expect(() => assertSubmittable(kase({ items, identity }))).toThrow(/pièces/);
    const licence = { number: '12345', category: 'B' as const, issueDate: '2015-01-01', expiryDate: '2026-10-01', experienceYears: 5 };
    const complete = kase({ items, identity: { ...identity, address: '12 rue Oued Ziz', city: 'Rabat' }, licence });
    expect(() => assertSubmittable(complete)).not.toThrow();
    expect(() => assertSubmittable(complete, '2026-10-13')).toThrow(/expiré/);
  });
  it('requires the criminal-record extract for the Famille dossier only', () => {
    expect(REQUIRED_ITEMS.driver_famille).toEqual(['criminal_record']);
    expect(REQUIRED_ITEMS.driver_identity).not.toContain('criminal_record');
    expect(REQUIRED_ITEMS.vehicle).not.toContain('criminal_record');
  });
});

describe('Famille eligibility', () => {
  it('maps the Famille dossier to a simple flag', () => {
    expect(familleEligibilityFor(null)).toBe('not_requested');
    expect(familleEligibilityFor('draft')).toBe('not_requested');
    expect(familleEligibilityFor('submitted')).toBe('pending');
    expect(familleEligibilityFor('more_info_requested')).toBe('pending');
    expect(familleEligibilityFor('approved')).toBe('approved');
    expect(familleEligibilityFor('rejected')).toBe('rejected');
  });
  it('defaults to not_requested for older driver records and for passengers', () => {
    expect(familleEligibilityOf({ role: 'driver' })).toBe('not_requested');
    expect(familleEligibilityOf({ role: 'driver', familleEligibility: 'approved' })).toBe('approved');
    expect(familleEligibilityOf({ role: 'passenger', familleEligibility: 'approved' })).toBe('not_requested');
  });
  it('flags references that repeat or name the driver herself', () => {
    expect(familleProblems({ references: [{ phone: '+212600000001' }, { phone: '+212600000001' }] }, ctx)).toHaveProperty(['references.1.phone']);
  });
});
