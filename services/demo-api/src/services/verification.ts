import {
  ALLOWED_ITEMS,
  assertSubmittable,
  casablancaToday,
  DomainError,
  draftView,
  familleApplicationSchemaFor,
  familleEligibilityFor,
  ITEM_LABELS,
  licenceDetailsSchemaFor,
  promoteSignupDraft,
  verificationMachine,
  type AdminUser,
  type DecisionInput,
  type FamilleApplicationInput,
  type IdentityDetailsInput,
  type LicenceDetailsInput,
  type SignupDraftInput,
  type User,
  type VehicleDetailsInput,
  type VerificationCase,
  type VerificationItemKey,
} from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import { requirePermission } from './permissions';

/** Rejections the applicant can recover from by starting a new submission. */
export const RECOVERABLE_REJECTIONS = ['document_expired', 'document_unreadable', 'identity_mismatch'];

export const REJECTION_REASONS = [
  { code: 'document_expired', label: 'Pièce expirée' },
  { code: 'document_unreadable', label: 'Pièce illisible après plusieurs essais' },
  { code: 'identity_mismatch', label: 'Informations incohérentes' },
  { code: 'not_eligible', label: 'Conditions d’inscription non remplies' },
];

export function casesForUser(s: State, user: User): VerificationCase[] {
  return s.cases.filter((c) => c.userId === user.id).sort((a, b) => a.subject.localeCompare(b.subject));
}

function ownedCase(s: State, user: User, caseId: string) {
  const c = mustFind(s.cases, (x) => x.id === caseId, 'dossier');
  if (c.userId !== user.id) throw new DomainError('FORBIDDEN');
  return c;
}

const editable = (c: VerificationCase) => c.status === 'draft' || c.status === 'more_info_requested';
const LOCKED = 'Ce dossier est en cours d’examen et ne peut pas être modifié.';
const today = (ctx: Ctx) => casablancaToday(ctx.clock.now());

/** Keeps `User.familleEligibility` equal to the state of the driver's Famille dossier. */
function syncFamille(s: State, c: VerificationCase) {
  if (c.subject !== 'driver_famille') return;
  const u = s.users.find((x) => x.id === c.userId);
  if (u) u.familleEligibility = familleEligibilityFor(c.status);
}

function zodFields(issues: { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[i.path.map(String).join('.') || '_'] = i.message;
  return fields;
}

function newCase(ctx: Ctx, s: State, user: User, subject: 'vehicle' | 'driver_famille', vehicleId: string | null): VerificationCase {
  const now = ctx.clock.iso();
  return {
    id: nextId(s, subject === 'vehicle' ? 'VV' : 'VF'),
    subject,
    userId: user.id,
    vehicleId,
    status: 'draft',
    items: [],
    identity: null,
    vehicle: null,
    decision: null,
    history: [{ at: now, status: 'draft', by: user.id }],
    submittedAt: null,
    updatedAt: now,
    version: 1,
  };
}

/** Opt-in to Naya Famille: opens the driver's Famille dossier (idempotent). */
export function ensureFamilleCase(ctx: Ctx, user: User) {
  if (user.role !== 'driver') throw new DomainError('FORBIDDEN');
  return ctx.store.tx((s) => {
    const existing = s.cases.find((c) => c.userId === user.id && c.subject === 'driver_famille');
    if (existing) return existing;
    const c = newCase(ctx, s, user, 'driver_famille', null);
    s.cases.push(c);
    syncFamille(s, c);
    appendAudit(s, ctx.clock.iso(), {
      actor: { type: 'user', id: user.id, name: `${user.firstName} ${user.lastName}`.trim() || user.phone },
      action: 'verification.famille_opt_in',
      entityType: 'verification_case',
      entityId: c.id,
      cityId: user.cityId,
      summary: 'Candidature Naya Famille ouverte',
    });
    return c;
  });
}

/**
 * Saves sign-up answers (one wizard step at a time). Complete, valid groups are promoted into
 * the typed details reviewers read; incomplete ones stay in `draft` so the driver can resume.
 */
export function saveDraft(ctx: Ctx, user: User, caseId: string, patch: SignupDraftInput) {
  if (user.role !== 'driver') throw new DomainError('FORBIDDEN');
  return ctx.store.tx((s) => {
    const c = ownedCase(s, user, caseId);
    if (c.subject === 'passenger_identity') throw new DomainError('FORBIDDEN');
    if (!editable(c)) throw new DomainError('INVALID_TRANSITION', LOCKED);
    c.draft = { ...(c.draft ?? {}), ...patch };
    const promoted = promoteSignupDraft(c.subject, draftView(c), { today: today(ctx), ownPhone: user.phone });
    if (promoted.identity) {
      c.identity = promoted.identity;
      const u = mustFind(s.users, (x) => x.id === user.id);
      u.firstName = promoted.identity.firstName;
      u.lastName = promoted.identity.lastName;
    }
    if (promoted.licence) c.licence = promoted.licence;
    if (promoted.famille) c.famille = promoted.famille;
    if (promoted.vehicle) {
      c.vehicle = promoted.vehicle;
      const existing = s.vehicles.find((v) => v.id === c.vehicleId);
      if (existing) Object.assign(existing, promoted.vehicle);
      else s.vehicles.push({ id: c.vehicleId!, driverId: user.id, caseId: c.id, ...promoted.vehicle });
    }
    c.updatedAt = ctx.clock.iso();
    c.version += 1;
    return c;
  });
}

export function ensureVehicleCase(ctx: Ctx, user: User) {
  if (user.role !== 'driver') throw new DomainError('FORBIDDEN');
  return ctx.store.tx((s) => {
    const existing = s.cases.find((c) => c.userId === user.id && c.subject === 'vehicle');
    if (existing) return existing;
    const vehicleId = nextId(s, 'VE');
    const c = newCase(ctx, s, user, 'vehicle', vehicleId);
    s.cases.push(c);
    const u = mustFind(s.users, (x) => x.id === user.id);
    u.vehicleId = vehicleId;
    return c;
  });
}

export function saveDetails(
  ctx: Ctx,
  user: User,
  caseId: string,
  input: { identity?: IdentityDetailsInput; vehicle?: VehicleDetailsInput; licence?: LicenceDetailsInput; famille?: FamilleApplicationInput },
) {
  return ctx.store.tx((s) => {
    const c = ownedCase(s, user, caseId);
    if (!editable(c)) throw new DomainError('INVALID_TRANSITION', LOCKED);
    const now = ctx.clock.iso();
    if (input.licence) {
      if (c.subject !== 'driver_identity') throw new DomainError('VALIDATION', 'Le permis se renseigne dans le dossier chauffeuse.');
      const r = licenceDetailsSchemaFor(today(ctx), c.identity?.birthDate).safeParse(input.licence);
      if (!r.success) throw new DomainError('VALIDATION', r.error.issues[0]?.message, { fields: zodFields(r.error.issues) });
      c.licence = r.data;
      c.draft = { ...(c.draft ?? {}), licenceNumber: r.data.number, licenceCategory: r.data.category, licenceIssueDate: r.data.issueDate, licenceExpiryDate: r.data.expiryDate, experienceYears: r.data.experienceYears };
    } else if (input.famille) {
      if (c.subject !== 'driver_famille') throw new DomainError('VALIDATION', 'Ce dossier n’est pas une candidature Naya Famille.');
      const r = familleApplicationSchemaFor(today(ctx), user.phone).safeParse(input.famille);
      if (!r.success) throw new DomainError('VALIDATION', r.error.issues[0]?.message, { fields: zodFields(r.error.issues) });
      c.famille = r.data as VerificationCase['famille'];
      c.draft = null;
    } else if (c.subject === 'vehicle') {
      if (!input.vehicle) throw new DomainError('VALIDATION');
      c.vehicle = input.vehicle;
      if (c.draft) c.draft = { ...c.draft, ...input.vehicle };
      const existing = s.vehicles.find((v) => v.id === c.vehicleId);
      if (existing) Object.assign(existing, input.vehicle);
      else s.vehicles.push({ id: c.vehicleId!, driverId: user.id, caseId: c.id, ...input.vehicle });
    } else {
      if (!input.identity) throw new DomainError('VALIDATION');
      if (c.subject === 'driver_famille') throw new DomainError('VALIDATION');
      c.identity = input.identity;
      if (c.draft) c.draft = { ...c.draft, ...input.identity };
      const u = mustFind(s.users, (x) => x.id === user.id);
      u.firstName = input.identity.firstName;
      u.lastName = input.identity.lastName;
    }
    c.updatedAt = now;
    c.version += 1;
    return c;
  });
}

export function setItem(ctx: Ctx, user: User, caseId: string, key: VerificationItemKey, uploadIds: string[]) {
  return ctx.store.tx((s) => {
    const c = ownedCase(s, user, caseId);
    if (!editable(c)) throw new DomainError('INVALID_TRANSITION', LOCKED);
    if (!ALLOWED_ITEMS[c.subject].includes(key)) throw new DomainError('VALIDATION', `${ITEM_LABELS[key]} n’appartient pas à ce dossier.`);
    for (const id of uploadIds) {
      const up = mustFind(s.uploads, (u) => u.id === id, 'fichier');
      if (up.ownerId !== user.id) throw new DomainError('FORBIDDEN');
    }
    if (uploadIds.length === 0) throw new DomainError('VALIDATION', 'Ajoutez au moins un fichier.');
    const item = c.items.find((i) => i.key === key);
    if (item) {
      item.uploadIds = uploadIds;
      item.status = 'provided';
    } else {
      c.items.push({ key, uploadIds, status: 'provided', note: null });
    }
    c.updatedAt = ctx.clock.iso();
    c.version += 1;
    return c;
  });
}

export function submitCase(ctx: Ctx, user: User, caseId: string) {
  return ctx.store.tx((s) => {
    const c = ownedCase(s, user, caseId);
    const event = c.status === 'more_info_requested' ? 'RESUBMIT' : 'SUBMIT';
    const next = verificationMachine.next(c.status, event);
    assertSubmittable(c, today(ctx));
    const now = ctx.clock.iso();
    c.status = next;
    syncFamille(s, c);
    c.submittedAt = now;
    c.updatedAt = now;
    c.version += 1;
    c.history.push({ at: now, status: next, by: user.id, note: event === 'RESUBMIT' ? 'Complément envoyé' : 'Dossier envoyé' });
    appendAudit(s, now, {
      actor: { type: 'user', id: user.id, name: `${user.firstName} ${user.lastName}`.trim() || user.phone },
      action: event === 'RESUBMIT' ? 'verification.resubmitted' : 'verification.submitted',
      entityType: 'verification_case',
      entityId: c.id,
      cityId: user.cityId,
      summary: `${c.subject === 'driver_famille' ? 'Candidature Naya Famille' : 'Dossier'} ${event === 'RESUBMIT' ? 'complété et renvoyé pour examen' : 'envoyé pour examen manuel'}`,
    });
    return c;
  });
}

export function reopenCase(ctx: Ctx, user: User, caseId: string) {
  return ctx.store.tx((s) => {
    const c = ownedCase(s, user, caseId);
    if (c.status !== 'rejected' || !RECOVERABLE_REJECTIONS.includes(c.decision?.reasonCode ?? '')) {
      throw new DomainError('INVALID_TRANSITION', 'Ce dossier ne peut pas être recommencé. Contactez l’assistance.');
    }
    const now = ctx.clock.iso();
    c.status = verificationMachine.next(c.status, 'REOPEN');
    c.items = c.items.map((i) => ({ ...i, uploadIds: [], status: 'missing', note: null }));
    syncFamille(s, c);
    c.updatedAt = now;
    c.version += 1;
    c.history.push({ at: now, status: 'draft', by: user.id, note: 'Nouveau dossier après refus' });
    return c;
  });
}

export function startReview(ctx: Ctx, admin: AdminUser, caseId: string) {
  requirePermission(admin, 'verification.decide');
  return ctx.store.tx((s) => {
    const c = mustFind(s.cases, (x) => x.id === caseId, 'dossier');
    if (c.status !== 'submitted') return c;
    const now = ctx.clock.iso();
    c.status = verificationMachine.next(c.status, 'START_REVIEW');
    c.updatedAt = now;
    c.version += 1;
    c.history.push({ at: now, status: 'in_review', by: admin.id, note: `Examen pris en charge par ${admin.name}` });
    return c;
  });
}

const OUTCOME_EVENT = { approved: 'APPROVE', more_info_requested: 'REQUEST_MORE', rejected: 'REJECT' } as const;

export function decideCase(ctx: Ctx, admin: AdminUser, caseId: string, input: DecisionInput) {
  requirePermission(admin, 'verification.decide');
  return ctx.store.tx((s) => {
    const c = mustFind(s.cases, (x) => x.id === caseId, 'dossier');
    if (c.version !== input.expectedVersion) {
      throw new DomainError('CONFLICT', 'Le dossier a changé depuis son ouverture. Rechargez avant de décider.');
    }
    const before = { status: c.status };
    c.status = verificationMachine.next(c.status, OUTCOME_EVENT[input.outcome]);
    const now = ctx.clock.iso();
    const corrections = new Map((input.corrections ?? []).map((x) => [x.key, x.note]));
    c.items = c.items.map((i) => {
      if (input.outcome === 'more_info_requested' && corrections.has(i.key)) return { ...i, status: 'needs_correction', note: corrections.get(i.key)! };
      if (input.outcome === 'rejected') return i;
      return { ...i, status: 'accepted', note: null };
    });
    for (const [key, note] of corrections) {
      if (!c.items.some((i) => i.key === key)) c.items.push({ key, uploadIds: [], status: 'needs_correction', note });
    }
    const message =
      input.message ||
      (input.outcome === 'approved' ? 'Votre dossier a été validé.' : '');
    c.decision = { outcome: input.outcome, reasonCode: input.reasonCode ?? null, message, decidedBy: admin.id, decidedByName: admin.name, decidedAt: now };
    c.updatedAt = now;
    c.version += 1;
    c.history.push({ at: now, status: c.status, by: admin.id, note: message });
    syncFamille(s, c);
    const subject = mustFind(s.users, (u) => u.id === c.userId);
    const labels = [...corrections.keys()].map((k) => ITEM_LABELS[k]).join(', ');
    appendAudit(s, now, {
      actor: { type: 'admin', id: admin.id, name: admin.name },
      action: `verification.${input.outcome}`,
      entityType: 'verification_case',
      entityId: c.id,
      cityId: subject.cityId,
      reason: input.outcome === 'approved' ? (input.message || null) : message,
      summary:
        input.outcome === 'approved'
          ? `Dossier ${c.id} approuvé`
          : input.outcome === 'rejected'
            ? `Dossier ${c.id} refusé`
            : `Complément demandé sur ${c.id} : ${labels}`,
      before,
      after: { status: c.status },
    });
    return c;
  });
}

export type SimulatedOutcome = 'approved' | 'more_info_requested' | 'rejected';

/**
 * Dev mode only (POST /dev/verification/:id/simulate, used by tests): a reviewer decides the
 * caller's own submitted dossier at once, with the wording a reviewer would write, so every
 * review outcome is reachable without the admin console. The apps never call it, and it is not
 * registered when NAYA_DEV=0.
 */
export function simulateReview(ctx: Ctx, user: User, caseId: string, outcome: SimulatedOutcome, itemKey?: VerificationItemKey) {
  const kase = ctx.store.read((s) => ownedCase(s, user, caseId));
  if (kase.status !== 'submitted' && kase.status !== 'in_review') {
    throw new DomainError('INVALID_TRANSITION', 'Ce dossier n’est pas en attente d’examen. Envoyez-le d’abord.');
  }
  const reviewer = ctx.store.read((s) => s.admins.find((a) => a.permissions.includes('verification.decide')));
  if (!reviewer) throw new DomainError('NOT_FOUND');
  startReview(ctx, reviewer, caseId);
  const current = ctx.store.read((s) => mustFind(s.cases, (c) => c.id === caseId));
  const key = itemKey && current.items.some((i) => i.key === itemKey) ? itemKey : (current.items[0]?.key ?? null);
  if (outcome === 'approved') {
    return decideCase(ctx, reviewer, caseId, { outcome, reasonCode: null, message: '', corrections: [], expectedVersion: current.version });
  }
  if (outcome === 'more_info_requested') {
    if (!key) throw new DomainError('VALIDATION');
    return decideCase(ctx, reviewer, caseId, {
      outcome,
      reasonCode: 'correction',
      message: 'Une pièce doit être reprise avant la validation.',
      corrections: [{ key, note: 'Photo floue : reprenez-la à plat, en pleine lumière, sans reflet.' }],
      expectedVersion: current.version,
    });
  }
  return decideCase(ctx, reviewer, caseId, { outcome, reasonCode: 'document_expired', message: 'Pièce expirée : recommencez avec une pièce en cours de validité.', corrections: [], expectedVersion: current.version });
}
