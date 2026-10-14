import { z } from 'zod';
import type {
  FamilleApplication,
  FamilleEligibility,
  IdentityDetails,
  LicenceDetails,
  SignupDraft,
  VehicleDetails,
  VerificationCase,
  VerificationItemKey,
  VerificationStatus,
  VerificationSubject,
} from './entities';
import { REQUIRED_ITEMS } from './machines/verification';
import {
  experienceYearsSchema,
  familleApplicationSchemaFor,
  familleProblems,
  identityDetailsSchema,
  isCalendarDate,
  licenceDetailsSchemaFor,
  licenceNumberSchema,
  licenceProblems,
  phoneSchema,
  vehicleDetailsSchema,
} from './schemas';

/*
 * Driver sign-up (founder brief 13 Oct 2026, task 2): one question per screen, saved on the
 * server as a draft so the driver can stop and resume. This module owns the step order, the
 * per-step rules, how a draft becomes the typed details reviewers read, the per-document
 * status shown to the driver, and the Naya Famille eligibility flag.
 */

/* ───────── Per-document status ───────── */

/** What the driver sees per document: manquant → envoyé → en vérification → approuvé / refusé. */
export type DocumentStatus = 'missing' | 'sent' | 'in_review' | 'approved' | 'rejected';

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  missing: 'Manquant',
  sent: 'Envoyé',
  in_review: 'En vérification',
  approved: 'Approuvé',
  rejected: 'Refusé',
};

/**
 * Derives a document's status from its item and its dossier. `sent` means the file is stored
 * with Naya but the dossier has not been sent for review yet; a refusal carries the reviewer's
 * reason (the item note, or the dossier decision when the whole dossier was refused).
 */
export function documentStatus(
  kase: Pick<VerificationCase, 'status' | 'items' | 'decision'> | null | undefined,
  key: VerificationItemKey,
): { status: DocumentStatus; reason: string | null } {
  const item = kase?.items.find((i) => i.key === key);
  if (!kase || !item || item.status === 'missing' || item.uploadIds.length === 0) {
    return item?.status === 'needs_correction' ? { status: 'rejected', reason: item.note } : { status: 'missing', reason: null };
  }
  if (item.status === 'needs_correction') return { status: 'rejected', reason: item.note };
  if (item.status === 'accepted') return { status: 'approved', reason: null };
  switch (kase.status) {
    case 'submitted':
    case 'in_review':
      return { status: 'in_review', reason: null };
    case 'rejected':
      return { status: 'rejected', reason: kase.decision?.message ?? null };
    case 'approved':
      return { status: 'approved', reason: null };
    default:
      return { status: 'sent', reason: null };
  }
}

/* ───────── Naya Famille eligibility ───────── */

// FAMILLE_ELIGIBILITY_LABELS and familleEligibilityOf live in famille.ts (one definition).

/** Maps the `driver_famille` case status to the flag stored on the driver (`User.familleEligibility`). */
export function familleEligibilityFor(status: VerificationStatus | null | undefined): FamilleEligibility {
  switch (status) {
    case 'submitted':
    case 'in_review':
    case 'more_info_requested':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      return 'not_requested';
  }
}

/* ───────── Steps ───────── */

export type SignupSection = 'person' | 'vehicle' | 'famille';

export const SECTION_SUBJECT: Record<SignupSection, Exclude<VerificationSubject, 'passenger_identity'>> = {
  person: 'driver_identity',
  vehicle: 'vehicle',
  famille: 'driver_famille',
};

export type QuestionStepId =
  | 'name'
  | 'birth'
  | 'address'
  | 'id_document'
  | 'licence_number'
  | 'licence_dates'
  | 'experience'
  | 'vehicle_model'
  | 'vehicle_plate'
  | 'famille_references'
  | 'famille_experience'
  | 'famille_training'
  | 'famille_interview';

export type ReviewStepId = 'person_review' | 'vehicle_review' | 'famille_review';
export type SignupStepId = QuestionStepId | VerificationItemKey | ReviewStepId;

export type SignupStep =
  | { id: QuestionStepId; section: SignupSection; kind: 'question'; fields: (keyof SignupDraft)[] }
  | { id: VerificationItemKey; section: SignupSection; kind: 'document'; item: VerificationItemKey }
  | { id: ReviewStepId; section: SignupSection; kind: 'review' };

const q = (id: QuestionStepId, section: SignupSection, fields: (keyof SignupDraft)[]): SignupStep => ({ id, section, kind: 'question', fields });
const doc = (item: VerificationItemKey, section: SignupSection): SignupStep => ({ id: item, section, kind: 'document', item });

/** The whole sign-up in order. Documents follow the questions they belong to. */
export const SIGNUP_STEPS: SignupStep[] = [
  q('name', 'person', ['firstName', 'lastName']),
  q('birth', 'person', ['birthDate']),
  q('address', 'person', ['address', 'city']),
  q('id_document', 'person', ['documentType', 'documentNumber']),
  doc('id_front', 'person'),
  doc('id_back', 'person'),
  doc('selfie', 'person'),
  q('licence_number', 'person', ['licenceNumber', 'licenceCategory']),
  q('licence_dates', 'person', ['licenceIssueDate', 'licenceExpiryDate']),
  q('experience', 'person', ['experienceYears']),
  doc('driving_licence', 'person'),
  doc('driving_licence_back', 'person'),
  { id: 'person_review', section: 'person', kind: 'review' },
  q('vehicle_model', 'vehicle', ['make', 'model', 'year']),
  q('vehicle_plate', 'vehicle', ['plate', 'color']),
  doc('vehicle_registration', 'vehicle'),
  doc('insurance', 'vehicle'),
  doc('technical_inspection', 'vehicle'),
  doc('vehicle_photo_front', 'vehicle'),
  doc('vehicle_photo_back', 'vehicle'),
  doc('vehicle_photo_left', 'vehicle'),
  doc('vehicle_photo_right', 'vehicle'),
  doc('vehicle_photo_interior', 'vehicle'),
  { id: 'vehicle_review', section: 'vehicle', kind: 'review' },
  q('famille_references', 'famille', ['reference1Name', 'reference1Phone', 'reference2Name', 'reference2Phone']),
  q('famille_experience', 'famille', ['childExperienceYears', 'childExperienceSummary']),
  doc('criminal_record', 'famille'),
  q('famille_training', 'famille', ['trainingAcknowledged']),
  q('famille_interview', 'famille', ['interviewDay', 'interviewWindow']),
  { id: 'famille_review', section: 'famille', kind: 'review' },
];

export const sectionSteps = (section: SignupSection) => SIGNUP_STEPS.filter((s) => s.section === section);
export const findSignupStep = (id: string): SignupStep | undefined => SIGNUP_STEPS.find((s) => s.id === id);
export const sectionOfItem = (key: VerificationItemKey): SignupSection | null => SIGNUP_STEPS.find((s) => s.kind === 'document' && s.item === key)?.section ?? null;

/* ───────── Draft view, step rules and promotion ───────── */

/** The answers the wizard shows: promoted details first, then the newer draft answers. */
export function draftView(kase: Pick<VerificationCase, 'identity' | 'licence' | 'vehicle' | 'famille' | 'draft'> | null | undefined): SignupDraft {
  if (!kase) return {};
  const out: SignupDraft = {};
  const id = kase.identity;
  if (id) Object.assign(out, { firstName: id.firstName, lastName: id.lastName, birthDate: id.birthDate, documentType: id.documentType, documentNumber: id.documentNumber, address: id.address, city: id.city });
  const l = kase.licence;
  if (l) Object.assign(out, { licenceNumber: l.number, licenceCategory: l.category, licenceIssueDate: l.issueDate, licenceExpiryDate: l.expiryDate, experienceYears: l.experienceYears });
  const v = kase.vehicle;
  if (v) Object.assign(out, { make: v.make, model: v.model, color: v.color, plate: v.plate, year: v.year });
  const f = kase.famille;
  if (f) {
    Object.assign(out, {
      reference1Name: f.references[0].name,
      reference1Phone: f.references[0].phone,
      reference2Name: f.references[1].name,
      reference2Phone: f.references[1].phone,
      childExperienceYears: f.childExperience.years,
      childExperienceSummary: f.childExperience.summary,
      trainingAcknowledged: f.trainingAcknowledged,
      interviewDay: f.interview.day,
      interviewWindow: f.interview.window,
    });
  }
  for (const [k, value] of Object.entries(kase.draft ?? {})) if (value !== undefined) (out as Record<string, unknown>)[k] = value;
  for (const k of Object.keys(out) as (keyof SignupDraft)[]) if (out[k] === undefined) delete out[k];
  return out;
}

const required = 'Réponse requise';
/**
 * Per-field rules. They are at least as strict as the schemas `promoteSignupDraft` applies, so a
 * draft whose steps all pass always promotes in full (submission relies on it).
 */
const FIELD_RULES: { [K in keyof SignupDraft]-?: z.ZodType } = {
  firstName: identityDetailsSchema.shape.firstName,
  lastName: identityDetailsSchema.shape.lastName,
  birthDate: identityDetailsSchema.shape.birthDate,
  documentType: identityDetailsSchema.shape.documentType,
  documentNumber: identityDetailsSchema.shape.documentNumber,
  address: z.string({ error: required }).trim().min(8, 'Indiquez votre adresse complète').max(200),
  city: z.string({ error: required }).trim().min(2, 'Indiquez votre ville').max(60),
  licenceNumber: licenceNumberSchema,
  licenceCategory: z.string({ error: 'Choisissez la catégorie de votre permis' }),
  licenceIssueDate: z.string({ error: required }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format JJ/MM/AAAA').refine(isCalendarDate, 'Cette date n’existe pas'),
  licenceExpiryDate: z.string({ error: required }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format JJ/MM/AAAA').refine(isCalendarDate, 'Cette date n’existe pas'),
  experienceYears: experienceYearsSchema,
  make: vehicleDetailsSchema.shape.make,
  model: vehicleDetailsSchema.shape.model,
  color: vehicleDetailsSchema.shape.color,
  plate: vehicleDetailsSchema.shape.plate,
  year: vehicleDetailsSchema.shape.year,
  reference1Name: z.string({ error: required }).trim().min(2, 'Nom et prénom requis').max(80),
  reference1Phone: phoneSchema,
  reference2Name: z.string({ error: required }).trim().min(2, 'Nom et prénom requis').max(80),
  reference2Phone: phoneSchema,
  childExperienceYears: experienceYearsSchema,
  childExperienceSummary: z.string({ error: required }).trim().min(20, 'Décrivez votre expérience en quelques phrases (20 caractères minimum)').max(500, '500 caractères maximum'),
  trainingAcknowledged: z.literal(true, { error: 'Confirmez votre engagement à suivre la formation' }),
  interviewDay: z.string({ error: 'Choisissez un jour' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Choisissez un jour').refine(isCalendarDate, 'Choisissez un jour'),
  interviewWindow: z.enum(['morning', 'afternoon'], { error: 'Choisissez un créneau' }),
};

/** What a missing answer says, per field (zod's own message is technical English). */
const MISSING: { [K in keyof SignupDraft]-?: string } = {
  firstName: 'Prénom requis',
  lastName: 'Nom requis',
  birthDate: 'Date de naissance requise',
  documentType: 'Choisissez votre pièce',
  documentNumber: 'Numéro de la pièce requis',
  address: 'Adresse requise',
  city: 'Ville requise',
  licenceNumber: 'Numéro du permis requis',
  licenceCategory: 'Choisissez la catégorie de votre permis',
  licenceIssueDate: 'Date de délivrance requise',
  licenceExpiryDate: 'Date d’expiration requise',
  experienceYears: 'Indiquez un nombre d’années',
  make: 'Marque requise',
  model: 'Modèle requis',
  color: 'Couleur requise',
  plate: 'Immatriculation requise',
  year: 'Année requise',
  reference1Name: 'Nom et prénom requis',
  reference1Phone: 'Numéro requis',
  reference2Name: 'Nom et prénom requis',
  reference2Phone: 'Numéro requis',
  childExperienceYears: 'Indiquez un nombre d’années',
  childExperienceSummary: 'Décrivez votre expérience en quelques phrases',
  trainingAcknowledged: 'Confirmez votre engagement à suivre la formation',
  interviewDay: 'Choisissez un jour',
  interviewWindow: 'Choisissez un moment',
};

export interface SignupContext {
  /** Casablanca business date, YYYY-MM-DD. */
  today: string;
  /** The driver's own phone (a reference cannot be herself). */
  ownPhone?: string | null;
}

export type StepErrors = Partial<Record<keyof SignupDraft, string>>;

/**
 * Validates the answers of one question step against the whole draft (cross-field rules see
 * the other answers: the licence is checked against the birth date, the experience against
 * the licence's age). Returns the French message per field; empty when the step is valid.
 */
export function validateSignupStep(stepId: QuestionStepId, answers: SignupDraft, ctx: SignupContext): StepErrors {
  const step = findSignupStep(stepId);
  if (!step || step.kind !== 'question') return {};
  const errors: StepErrors = {};
  for (const field of step.fields) {
    const value = answers[field];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      errors[field] = MISSING[field];
      continue;
    }
    const r = FIELD_RULES[field].safeParse(value);
    if (!r.success) errors[field] = r.error.issues[0]?.message ?? required;
  }
  if (stepId === 'licence_number' || stepId === 'licence_dates' || stepId === 'experience') {
    const p = licenceProblems(
      { category: answers.licenceCategory, issueDate: answers.licenceIssueDate, expiryDate: answers.licenceExpiryDate, experienceYears: answers.experienceYears },
      { today: ctx.today, birthDate: answers.birthDate },
    );
    const map = { category: 'licenceCategory', issueDate: 'licenceIssueDate', expiryDate: 'licenceExpiryDate', experienceYears: 'experienceYears' } as const;
    for (const [k, message] of Object.entries(p)) {
      const field = map[k as keyof typeof map];
      if ((step.fields as string[]).includes(field) && !errors[field]) errors[field] = message;
    }
  }
  if (stepId === 'famille_references' || stepId === 'famille_interview') {
    const p = familleProblems(
      { references: [{ phone: answers.reference1Phone }, { phone: answers.reference2Phone }], interview: { day: answers.interviewDay } },
      ctx,
    );
    const map: Record<string, keyof SignupDraft> = { 'references.0.phone': 'reference1Phone', 'references.1.phone': 'reference2Phone', 'interview.day': 'interviewDay' };
    for (const [k, message] of Object.entries(p)) {
      const field = map[k];
      if (field && (step.fields as string[]).includes(field) && !errors[field]) errors[field] = message;
    }
  }
  return errors;
}

const questionsOf = (section: SignupSection) => sectionSteps(section).filter((s): s is Extract<SignupStep, { kind: 'question' }> => s.kind === 'question');

/** Short names of the question steps, as the review screen labels them. */
export const QUESTION_STEP_LABELS: Record<QuestionStepId, string> = {
  name: 'Nom',
  birth: 'Date de naissance',
  address: 'Adresse',
  id_document: 'Pièce d’identité',
  licence_number: 'Permis',
  licence_dates: 'Validité du permis',
  experience: 'Expérience de conduite',
  vehicle_model: 'Véhicule',
  vehicle_plate: 'Immatriculation et couleur',
  famille_references: 'Références',
  famille_experience: 'Expérience avec les enfants',
  famille_training: 'Formation',
  famille_interview: 'Entretien souhaité',
};

const SUBJECT_SECTION = Object.fromEntries(Object.entries(SECTION_SUBJECT).map(([section, subject]) => [subject, section])) as Partial<Record<VerificationSubject, SignupSection>>;

/**
 * The first question step of a driver dossier whose answers fail their rules today, read from
 * the answers the driver sees (`draftView`). Null when every step passes, and for passenger
 * cases (no sign-up steps). Submission re-runs this so a later edit, a stale client or a
 * direct API call cannot send details the wizard would refuse.
 */
export function firstInvalidSignupStep(
  kase: Pick<VerificationCase, 'subject' | 'identity' | 'licence' | 'vehicle' | 'famille' | 'draft'>,
  ctx: SignupContext,
): { step: QuestionStepId; errors: StepErrors } | null {
  const section = SUBJECT_SECTION[kase.subject];
  if (!section) return null;
  const answers = draftView(kase);
  for (const step of questionsOf(section)) {
    const errors = validateSignupStep(step.id, answers, ctx);
    if (Object.keys(errors).length > 0) return { step: step.id, errors };
  }
  return null;
}

export interface PromotedDetails {
  identity?: IdentityDetails;
  licence?: LicenceDetails;
  vehicle?: VehicleDetails;
  famille?: FamilleApplication;
}

const groupValid = (ids: QuestionStepId[], answers: SignupDraft, ctx: SignupContext) => ids.every((id) => Object.keys(validateSignupStep(id, answers, ctx)).length === 0);

/**
 * Turns complete, valid groups of answers into the typed details stored on the dossier.
 * Incomplete groups are left out (the previous value, if any, is kept by the caller).
 */
export function promoteSignupDraft(subject: VerificationSubject, answers: SignupDraft, ctx: SignupContext): PromotedDetails {
  const out: PromotedDetails = {};
  if (subject === 'driver_identity' || subject === 'passenger_identity') {
    const base = identityDetailsSchema.safeParse({
      firstName: answers.firstName,
      lastName: answers.lastName,
      birthDate: answers.birthDate,
      documentType: answers.documentType,
      documentNumber: answers.documentNumber,
      ...(groupValid(['address'], answers, ctx) ? { address: answers.address, city: answers.city } : {}),
    });
    if (base.success) out.identity = base.data;
    if (subject === 'driver_identity' && groupValid(['licence_number', 'licence_dates', 'experience'], answers, ctx)) {
      const l = licenceDetailsSchemaFor(ctx.today, answers.birthDate).safeParse({
        number: answers.licenceNumber,
        category: answers.licenceCategory,
        issueDate: answers.licenceIssueDate,
        expiryDate: answers.licenceExpiryDate,
        experienceYears: answers.experienceYears,
      });
      if (l.success) out.licence = l.data as LicenceDetails;
    }
  }
  if (subject === 'vehicle') {
    const v = vehicleDetailsSchema.safeParse({ make: answers.make, model: answers.model, color: answers.color, plate: answers.plate, year: answers.year });
    if (v.success) out.vehicle = v.data;
  }
  if (subject === 'driver_famille' && groupValid(questionsOf('famille').map((s) => s.id), answers, ctx)) {
    const f = familleApplicationSchemaFor(ctx.today, ctx.ownPhone).safeParse({
      references: [
        { name: answers.reference1Name, phone: answers.reference1Phone },
        { name: answers.reference2Name, phone: answers.reference2Phone },
      ],
      childExperience: { years: answers.childExperienceYears, summary: answers.childExperienceSummary },
      trainingAcknowledged: answers.trainingAcknowledged,
      interview: { day: answers.interviewDay, window: answers.interviewWindow },
    });
    if (f.success) out.famille = f.data as FamilleApplication;
  }
  return out;
}

/* ───────── Progress ───────── */

type ProgressCase = Pick<VerificationCase, 'status' | 'items' | 'identity' | 'licence' | 'vehicle' | 'famille' | 'draft' | 'decision'>;

/** A question step is done when its answers pass its rules; a document step when a file is with Naya and not refused. */
export function isSignupStepDone(step: SignupStep, kase: ProgressCase | null | undefined, ctx: SignupContext): boolean {
  if (!kase) return false;
  if (step.kind === 'question') return Object.keys(validateSignupStep(step.id, draftView(kase), ctx)).length === 0;
  if (step.kind === 'document') {
    const s = documentStatus(kase, step.item).status;
    return s === 'sent' || s === 'in_review' || s === 'approved';
  }
  return kase.status !== 'draft' && kase.status !== 'more_info_requested';
}

export interface SectionProgress {
  done: number;
  total: number;
  /** The first step to do, or the review step when everything is answered; null once sent. */
  next: SignupStep | null;
}

/** Progress of one section, counting questions and documents (the review step is the action). */
export function sectionProgress(section: SignupSection, kase: ProgressCase | null | undefined, ctx: SignupContext): SectionProgress {
  const steps = sectionSteps(section);
  const work = steps.filter((s) => s.kind !== 'review');
  const done = work.filter((s) => isSignupStepDone(s, kase, ctx)).length;
  const editable = !kase || kase.status === 'draft' || kase.status === 'more_info_requested';
  const next = !editable ? null : (work.find((s) => !isSignupStepDone(s, kase, ctx)) ?? steps.find((s) => s.kind === 'review') ?? null);
  return { done, total: work.length, next };
}

/** The step after `id` inside its section (questions and documents, then the review). */
export function nextStepAfter(id: SignupStepId): SignupStep | null {
  const step = findSignupStep(id);
  if (!step) return null;
  const steps = sectionSteps(step.section);
  return steps[steps.indexOf(step) + 1] ?? null;
}

export interface DossierOverview {
  done: number;
  total: number;
  /** 0–100, rounded down so 100 only shows when everything is done. */
  percent: number;
  next: { section: SignupSection; step: SignupStep } | null;
}

/**
 * One progress figure for the whole dossier: person and vehicle always, Famille only when the
 * driver opted in (a `driver_famille` case exists).
 */
export function dossierOverview(
  cases: { person: ProgressCase | null | undefined; vehicle: ProgressCase | null | undefined; famille?: ProgressCase | null },
  ctx: SignupContext,
): DossierOverview {
  const sections: [SignupSection, ProgressCase | null | undefined][] = [
    ['person', cases.person],
    ['vehicle', cases.vehicle],
    ...(cases.famille ? ([['famille', cases.famille]] as [SignupSection, ProgressCase][]) : []),
  ];
  let done = 0;
  let total = 0;
  let next: DossierOverview['next'] = null;
  for (const [section, kase] of sections) {
    const p = sectionProgress(section, kase, ctx);
    done += p.done;
    total += p.total;
    if (!next && p.next) next = { section, step: p.next };
  }
  return { done, total, percent: total ? Math.floor((done / total) * 100) : 0, next };
}

/** Required items of a section, for checklists. */
export const sectionItems = (section: SignupSection) => REQUIRED_ITEMS[SECTION_SUBJECT[section]];
