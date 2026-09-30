import {
  assertSubmittable,
  DomainError,
  ITEM_LABELS,
  verificationMachine,
  type AdminUser,
  type DecisionInput,
  type IdentityDetailsInput,
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

export function ensureVehicleCase(ctx: Ctx, user: User) {
  if (user.role !== 'driver') throw new DomainError('FORBIDDEN');
  return ctx.store.tx((s) => {
    const existing = s.cases.find((c) => c.userId === user.id && c.subject === 'vehicle');
    if (existing) return existing;
    const now = ctx.clock.iso();
    const vehicleId = nextId(s, 'VE');
    const caseId = nextId(s, 'VV');
    const c: VerificationCase = {
      id: caseId,
      subject: 'vehicle',
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
    s.cases.push(c);
    const u = mustFind(s.users, (x) => x.id === user.id);
    u.vehicleId = vehicleId;
    return c;
  });
}

export function saveDetails(ctx: Ctx, user: User, caseId: string, input: { identity?: IdentityDetailsInput; vehicle?: VehicleDetailsInput }) {
  return ctx.store.tx((s) => {
    const c = ownedCase(s, user, caseId);
    if (!editable(c)) throw new DomainError('INVALID_TRANSITION', 'Ce dossier est en cours d’examen et ne peut pas être modifié.');
    const now = ctx.clock.iso();
    if (c.subject === 'vehicle') {
      if (!input.vehicle) throw new DomainError('VALIDATION');
      c.vehicle = input.vehicle;
      const existing = s.vehicles.find((v) => v.id === c.vehicleId);
      if (existing) Object.assign(existing, input.vehicle);
      else s.vehicles.push({ id: c.vehicleId!, driverId: user.id, caseId: c.id, ...input.vehicle });
    } else {
      if (!input.identity) throw new DomainError('VALIDATION');
      c.identity = input.identity;
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
    if (!editable(c)) throw new DomainError('INVALID_TRANSITION', 'Ce dossier est en cours d’examen et ne peut pas être modifié.');
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
    assertSubmittable(c);
    const now = ctx.clock.iso();
    c.status = next;
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
      summary: event === 'RESUBMIT' ? 'Complément envoyé pour examen' : 'Dossier envoyé pour examen manuel',
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
