import { z } from 'zod';
import type { Context, Hono } from 'hono';
import { createHash, randomBytes } from '../platform';
import {
  assertFamilleEligible,
  assertFamilyStep,
  canReceiveFamilleTrips,
  DomainError,
  familleEligibilityOf,
  familyAdvanceSchema,
  familyApprovalSchema,
  familyCallSchema,
  familyCancelSchema,
  familyDemoSchema,
  familyGuardianSchema,
  familyLive,
  familyPositionSchema,
  familyTripMachine,
  FAMILY_DEMO_PROOFS,
  FAMILY_DRIVER_STEP,
  HANDOVER_LOCKED_MESSAGE,
  FAMILY_STATUS_LABELS,
  HANDOVER_MAX_ATTEMPTS,
  isDomainError,
  isFamilyTripActive,
  isFamilyTripClosed,
  MOROCCO_POLICE_NUMBER,
  newStartApproval,
  PLACES,
  whatsappLink,
  type FamilyCallResult,
  type FamilyChild,
  type FamilyChildView,
  type FamilyFollowView,
  type FamilyGuardian,
  type FamilyGuardianView,
  type FamilyNotification,
  type FamilyOverview,
  type FamilyProof,
  type FamilyStepInput,
  type FamilySubscription,
  type FamilyTimelineEntry,
  type FamilyTrip,
  type FamilyTripEvent,
  type Place,
  type User,
} from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import type { Principal } from './auth';
import { ensurePrototype } from './prototype';

/**
 * Naya Famille: dedicated chauffeuses for children. Every status change goes through
 * `familyTripMachine` + `assertFamilyStep` (packages/domain). The trip cannot start until the
 * parent approves (on site or remotely), and cannot close without the drop-off photo and,
 * when the child has recipients, a valid handover code. Calls are hand-offs (WhatsApp, 19)
 * recorded on the trip; positions are simulated by the demo engine unless the chauffeuse's
 * phone streams a fix.
 */

type Env = { Variables: { principal: Principal | null } };
type Actor = { kind: 'driver' | 'parent'; user: User } | { kind: 'system' };

const text = z.string().trim().min(1).max(300);
const location = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const place = z.object({ id: z.string().nullable(), label: text, address: text, location });
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const iso = (ms: number) => new Date(ms).toISOString();

/* ───────────── State helpers ───────────── */

/** Stores written before 13 Oct: add the guardian list and backfill the eligibility flag. */
export function ensureFamille(s: State) {
  const p = ensurePrototype(s);
  p.guardians ??= [];
  for (const u of s.users) {
    if (u.role === 'driver' && u.familleEligibility === undefined) {
      // Seeded demo chauffeuses keep their fixture value; anyone else has not applied.
      u.familleEligibility = u.phone === '+212661234567' || u.phone === '+212663456789' ? 'approved' : 'not_requested';
    }
  }
  return p;
}

const childOf = (s: State, t: FamilyTrip) => mustFind(ensurePrototype(s).children, (x) => x.id === t.childId, 'enfant');
const userById = (s: State, id: string) => mustFind(s.users, (u) => u.id === id, 'compte');

function audit(s: State, at: string, actor: Actor, action: string, entityId: string, summary: string) {
  appendAudit(s, at, {
    actor: actor.kind === 'system' ? { type: 'system', id: 'famille', name: 'Moteur de démonstration Famille' } : { type: 'user', id: actor.user.id, name: actor.user.firstName },
    action,
    entityType: 'family',
    entityId,
    cityId: actor.kind === 'system' ? null : actor.user.cityId,
    summary,
  });
}

function timeline(t: FamilyTrip, at: string, kind: FamilyTimelineEntry['kind'], label: string, actor: FamilyTimelineEntry['actor'], extra: Partial<FamilyTimelineEntry> = {}) {
  t.timeline.push({ at, label, location: t.location, kind, actor, ...extra });
}

function notify(s: State, t: FamilyTrip, at: string, n: Omit<FamilyNotification, 'id' | 'at'>) {
  t.notifications.push({ id: nextId(s, 'FN', 4), at, ...n });
}

/**
 * Chauffeuse view of a child: never the handover codes (spec R7, P1). Recipients carry names and
 * relationships only; the server alone checks the code.
 */
function childForDriver(c: FamilyChild): FamilyChildView {
  return { ...c, recipients: c.recipients.map(({ id, name, relationship }) => ({ id, name, relationship })) };
}

function guardianView(g: FamilyGuardian): FamilyGuardianView {
  const { tokenHash: _hidden, ...view } = g;
  return view;
}

export function familyOverview(s: State, user: User): FamilyOverview {
  const p = ensureFamille(s);
  const trips = p.trips
    .filter((x) => (user.role === 'driver' ? x.driverId === user.id : x.passengerId === user.id))
    .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  if (user.role === 'driver') {
    return {
      children: p.children.filter((c) => trips.some((t) => t.childId === c.id)).map(childForDriver),
      subscription: null,
      trips,
      eligibility: familleEligibilityOf(user),
    };
  }
  return {
    children: p.children.filter((x) => x.passengerId === user.id),
    subscription: p.subscriptions.find((x) => x.passengerId === user.id) ?? null,
    trips,
    guardians: (p.guardians ?? []).filter((g) => g.passengerId === user.id).map(guardianView),
  };
}

/** The dedicated chauffeuse: an active Rabat chauffeuse with approved identity, vehicle and Famille vetting. */
function famillePool(s: State, cityId: string) {
  return s.users.filter(
    (x) =>
      x.role === 'driver' &&
      x.cityId === cityId &&
      canReceiveFamilleTrips(x) &&
      s.cases.some((c) => c.id === x.identityCaseId && c.status === 'approved') &&
      s.cases.some((c) => c.userId === x.id && c.subject === 'vehicle' && c.status === 'approved'),
  );
}

export function addSubscription(s: State, nowMs: number, user: User, planId: string): FamilySubscription {
  const p = ensureFamille(s);
  if (!s.cases.some((c) => c.id === user.identityCaseId && c.status === 'approved')) throw new DomainError('VERIFICATION_REQUIRED');
  const plan = mustFind(p.catalog.plans, (x) => x.id === planId && x.enabled, 'abonnement');
  const driver = famillePool(s, user.cityId)[0];
  if (!driver) throw new DomainError('NOT_FOUND', 'Aucune chauffeuse approuvée pour Naya Famille n’est disponible dans votre ville.');
  const current = p.subscriptions.find((x) => x.passengerId === user.id);
  if (current?.status === 'active' && Date.parse(current.endsAt) > nowMs) throw new DomainError('CONFLICT', 'Vous avez déjà un abonnement actif.');
  const subscription: FamilySubscription = {
    id: nextId(s, 'SUB'),
    passengerId: user.id,
    planId,
    planName: plan.name,
    price: plan.price,
    includedTrips: plan.includedTrips,
    driverId: driver.id,
    driverName: `${driver.firstName} ${driver.lastName}`,
    status: 'active',
    startsAt: iso(nowMs),
    endsAt: iso(nowMs + plan.durationDays * 86_400_000),
  };
  if (current) Object.assign(current, subscription);
  else p.subscriptions.push(subscription);
  audit(s, iso(nowMs), { kind: 'parent', user }, 'family.subscribed', subscription.id, 'Abonnement famille activé · paiement simulé');
  return subscription;
}

export function addTrip(
  s: State,
  nowMs: number,
  user: User,
  input: { childId: string; pickup: Place; destination: Place; pickupAt: string; weekdays: number[] },
  options: { ignoreQuota?: boolean } = {},
): FamilyTrip {
  const p = ensureFamille(s);
  const sub = mustFind(p.subscriptions, (x) => x.passengerId === user.id && x.status === 'active' && Date.parse(x.endsAt) > nowMs, 'abonnement actif');
  if (input.pickupAt >= sub.endsAt || input.pickupAt < sub.startsAt) throw new DomainError('VALIDATION', 'Le trajet doit être compris dans la période de l’abonnement.');
  const child = mustFind(p.children, (x) => x.id === input.childId && x.passengerId === user.id, 'enfant');
  const used = p.trips.filter((t) => t.passengerId === user.id && t.status !== 'cancelled' && t.pickupAt >= sub.startsAt && t.pickupAt < sub.endsAt).length;
  if (!options.ignoreQuota && used >= sub.includedTrips) throw new DomainError('VALIDATION', 'Le nombre de trajets inclus est atteint.');
  const driver = userById(s, sub.driverId);
  assertFamilleEligible(driver);
  const at = iso(nowMs);
  const trip: FamilyTrip = {
    ...input,
    id: nextId(s, 'FT'),
    passengerId: user.id,
    childName: child.firstName,
    driverId: sub.driverId,
    driverName: sub.driverName,
    status: 'scheduled',
    location: input.pickup.location,
    recipientId: null,
    arrivalProof: null,
    pickupVerified: false,
    timeline: [],
    notifications: [],
    incident: null,
    pickupPhoto: null,
    dropoffPhoto: null,
    approval: null,
    approvals: [],
    departedAt: null,
    arrivedAt: null,
    pickedUpAt: null,
    startedAt: null,
    completedAt: null,
    cancellation: null,
    lastFix: null,
  };
  timeline(trip, at, 'planned', 'Trajet familial planifié', 'parent');
  p.trips.push(trip);
  audit(s, at, { kind: 'parent', user }, 'family.trip_created', trip.id, `Trajet de ${child.firstName} planifié`);
  return trip;
}

/** Next weekly occurrence, created when a trip closes (spec R10: weekdays are still UTC). */
function scheduleNext(s: State, nowMs: number, t: FamilyTrip) {
  if (!t.weekdays.length) return;
  const p = ensureFamille(s);
  const date = new Date(t.pickupAt);
  do date.setUTCDate(date.getUTCDate() + 1);
  while (!t.weekdays.includes(date.getUTCDay()) || date.getTime() <= nowMs);
  const owner = userById(s, t.passengerId);
  const sub = p.subscriptions.find((x) => x.passengerId === owner.id && x.status === 'active');
  if (!sub || date.toISOString() >= sub.endsAt) return;
  if (p.trips.filter((x) => x.passengerId === owner.id && x.status !== 'cancelled' && x.pickupAt >= sub.startsAt && x.pickupAt < sub.endsAt).length >= sub.includedTrips) return;
  try {
    addTrip(s, nowMs, owner, { childId: t.childId, pickup: t.pickup, destination: t.destination, pickupAt: date.toISOString(), weekdays: t.weekdays });
  } catch {
    // The chauffeuse may have lost her Famille approval: the parent plans the next trip again.
  }
}

/* ───────────── Transitions ───────────── */

function proofFrom(s: State, devMode: boolean, nowMs: number, t: FamilyTrip, driverId: string, proof: string | null | undefined, kind: 'pickup' | 'dropoff'): FamilyProof | null {
  if (!proof) return null;
  const at = iso(nowMs);
  const where = kind === 'pickup' ? t.pickup.location : familyLive(t, nowMs).location;
  if (proof === FAMILY_DEMO_PROOFS[kind] || proof === 'demo-arrival-photo') {
    if (!devMode) throw new DomainError('FORBIDDEN', 'Les photos simulées sont réservées à la démonstration.');
    return { uploadId: FAMILY_DEMO_PROOFS[kind], at, location: where, simulated: true };
  }
  const photo = mustFind(s.uploads, (x) => x.id === proof && x.ownerId === driverId, 'photo');
  if (!['family_proof', 'support_attachment'].includes(photo.purpose) || !photo.mimeType.startsWith('image/')) throw new DomainError('VALIDATION', 'Ajoutez une photo de l’enfant.');
  return { uploadId: photo.id, at, location: where, simulated: false };
}

/**
 * Applies one event to a trip inside the caller's transaction. Guards come from the domain;
 * side effects (timestamps, proofs, approvals, timeline, notifications, audit) live here.
 */
export function applyFamilyEvent(ctx: Ctx, s: State, t: FamilyTrip, event: FamilyTripEvent, actor: Actor, input: FamilyStepInput = {}): FamilyTrip {
  const nowMs = ctx.clock.now();
  const at = iso(nowMs);
  const child = childOf(s, t);
  const driver = userById(s, t.driverId);
  // Eligibility gate: a chauffeuse who is not (or no longer) approved cannot take a child.
  // Once the child is on board, the drop-off and cancellation stay possible.
  if (event === 'DEPART' || event === 'ARRIVE' || event === 'PICKUP' || event === 'REQUEST_START') assertFamilleEligible(driver);
  const proofKind = event === 'PICKUP' ? 'pickup' : event === 'DROPOFF' ? 'dropoff' : null;
  const proof = proofKind ? proofFrom(s, ctx.config.devMode, nowMs, t, driver.id, input.proof, proofKind) : null;
  const live = familyLive(t, nowMs);
  const next = assertFamilyStep(t, event, {
    nowMs,
    actor: actor.kind,
    child,
    position: event === 'DROPOFF' ? live.location : null,
    input: { ...input, proof: proof?.uploadId ?? null },
  });
  const who = actor.kind === 'system' ? 'Naya' : actor.user.firstName;
  const by = actor.kind === 'system' ? 'system' : actor.kind;
  t.status = next;
  switch (event) {
    case 'DEPART':
      t.departedAt = at;
      t.location = familyLive(t, nowMs).location;
      timeline(t, at, 'departed', `${driver.firstName} part chercher ${child.firstName}`, by);
      notify(s, t, at, { kind: 'status', audience: 'parent', title: `${driver.firstName} est en route`, body: `Suivez sa position en direct jusqu’à ${child.firstName}.` });
      break;
    case 'ARRIVE':
      t.arrivedAt = at;
      t.location = t.pickup.location;
      timeline(t, at, 'arrived', `${driver.firstName} est arrivée au point de prise en charge`, by);
      notify(s, t, at, { kind: 'status', audience: 'parent', title: `${driver.firstName} est arrivée`, body: t.pickup.label });
      break;
    case 'PICKUP':
      t.pickupPhoto = proof;
      t.pickupVerified = true;
      t.pickedUpAt = at;
      timeline(t, at, 'pickup_photo', `Photo de ${child.firstName} prise à la prise en charge${proof?.simulated ? ' (simulée)' : ''}`, by, { proof: proof!.uploadId });
      notify(s, t, at, { kind: 'status', audience: 'parent', title: `${child.firstName} est avec ${driver.firstName}`, body: 'Photo de prise en charge disponible dans le suivi.' });
      break;
    case 'REQUEST_START': {
      const approval = newStartApproval(nextId(s, 'FA'), nowMs);
      t.approval = approval;
      t.approvals = [...(t.approvals ?? []), approval];
      timeline(t, at, 'start_requested', `${driver.firstName} demande l’accord pour démarrer`, by);
      notify(s, t, at, {
        kind: 'approval_request',
        audience: 'parent',
        approvalId: approval.id,
        title: `${child.firstName} est prête à partir`,
        body: `${driver.firstName} attend votre accord pour démarrer. Sans réponse en 3 min, le départ reste bloqué.`,
      });
      break;
    }
    case 'APPROVE': {
      const a = t.approval!;
      const mode = input.mode ?? 'remote';
      Object.assign(a, { status: 'approved', mode, decidedAt: at, decidedBy: who });
      t.approvals = (t.approvals ?? []).map((x) => (x.id === a.id ? { ...a } : x));
      t.startedAt = at;
      timeline(t, at, 'start_approved', `Départ approuvé ${mode === 'on_site' ? 'sur place' : 'à distance'} par ${who}`, by);
      timeline(t, at, 'live_started', 'Trajet démarré · position en direct chaque seconde', 'system');
      notify(s, t, at, { kind: 'approval_result', audience: 'driver', title: 'Départ approuvé', body: `${who} a approuvé ${mode === 'on_site' ? 'sur place' : 'à distance'}. Vous pouvez partir.` });
      break;
    }
    case 'REFUSE': {
      const a = t.approval!;
      Object.assign(a, { status: 'refused', decidedAt: at, decidedBy: who, reason: input.reason?.trim() || null });
      t.approvals = (t.approvals ?? []).map((x) => (x.id === a.id ? { ...a } : x));
      timeline(t, at, 'start_refused', `Départ refusé par ${who}${a.reason ? ` · ${a.reason}` : ''}`, by);
      notify(s, t, at, { kind: 'approval_result', audience: 'driver', title: 'Départ refusé · ne partez pas', body: a.reason ? `Motif : ${a.reason}. Restez avec l’enfant et appelez le parent.` : 'Restez avec l’enfant et appelez le parent.' });
      break;
    }
    case 'EXPIRE': {
      const a = t.approval!;
      Object.assign(a, { status: 'expired', decidedAt: at });
      t.approvals = (t.approvals ?? []).map((x) => (x.id === a.id ? { ...a } : x));
      timeline(t, at, 'start_expired', 'Aucune réponse du parent en 3 min · départ bloqué', 'system');
      notify(s, t, at, { kind: 'approval_result', audience: 'driver', title: 'Pas de réponse du parent', body: 'Ne partez pas. Appelez le parent ou envoyez une nouvelle demande.' });
      notify(s, t, at, { kind: 'status', audience: 'parent', title: 'Demande de départ expirée', body: `${driver.firstName} attend avec ${child.firstName} au point de prise en charge.` });
      break;
    }
    case 'DROPOFF':
      t.dropoffPhoto = proof;
      t.recipientId = input.recipientId ?? null;
      t.completedAt = at;
      t.location = t.destination.location;
      t.lastFix = null;
      timeline(t, at, 'dropoff_photo', `Photo de ${child.firstName} dans l’enceinte de l’école${proof?.simulated ? ' (simulée)' : ''}`, by, { proof: proof!.uploadId });
      timeline(t, at, 'completed', t.recipientId ? `Remise confirmée à ${child.recipients.find((r) => r.id === t.recipientId)?.name ?? 'la personne autorisée'}` : 'Trajet clôturé', by);
      notify(s, t, at, { kind: 'status', audience: 'parent', title: `${child.firstName} est arrivée`, body: `Déposée à ${t.destination.label} · photo jointe.` });
      scheduleNext(s, nowMs, t);
      break;
    case 'CANCEL':
      t.cancellation = { at, by: actor.kind === 'driver' ? 'driver' : 'parent', reason: input.reason!.trim() };
      if (t.approval?.status === 'pending') Object.assign(t.approval, { status: 'expired', decidedAt: at });
      timeline(t, at, 'cancelled', `Trajet annulé par ${who} · ${t.cancellation.reason}`, by);
      notify(s, t, at, { kind: 'status', audience: actor.kind === 'driver' ? 'parent' : 'driver', title: 'Trajet annulé', body: t.cancellation.reason });
      break;
  }
  audit(s, at, actor, `family.${event.toLowerCase()}`, t.id, `${child.firstName} · ${FAMILY_STATUS_LABELS[next]}`);
  return t;
}

/**
 * Counts a wrong handover code (P1). Below HANDOVER_MAX_ATTEMPTS the driver is told how many tries
 * are left; at the limit the handover is locked on the trip, the parent is told and the trip cannot
 * close through the app any more. Returns the error for the caller to throw outside the transaction.
 */
function refuseHandover(s: State, nowMs: number, t: FamilyTrip, user: User): DomainError {
  const at = iso(nowMs);
  t.handoverAttempts = (t.handoverAttempts ?? 0) + 1;
  const left = HANDOVER_MAX_ATTEMPTS - t.handoverAttempts;
  audit(s, at, { kind: 'driver', user }, 'family.handover_refused', t.id, `Code de remise incorrect (${t.handoverAttempts}/${HANDOVER_MAX_ATTEMPTS})`);
  if (left > 0)
    return new DomainError('VALIDATION', `Code de remise incorrect. ${left > 1 ? `${left} essais restants` : 'Dernier essai'} avant le blocage de la remise.`, { attemptsLeft: left });
  const label = `Remise bloquée · ${HANDOVER_MAX_ATTEMPTS} codes incorrects`;
  t.handoverLocked = true;
  t.incident = label;
  timeline(t, at, 'incident', label, 'system');
  notify(s, t, at, { kind: 'incident', audience: 'parent', title: `${t.childName} · ${label}`, body: 'La chauffeuse ne confiera pas l’enfant. Appelez-la ou contactez le support Naya.' });
  audit(s, at, { kind: 'driver', user }, 'family.handover_locked', t.id, label);
  return new DomainError('INVALID_TRANSITION', HANDOVER_LOCKED_MESSAGE, { locked: true });
}

function tripFor(s: State, id: string, user: User) {
  return mustFind(
    ensureFamille(s).trips,
    (x) => x.id === id && (user.role === 'driver' ? x.driverId === user.id : x.passengerId === user.id),
    'trajet',
  );
}

/* ───────────── Timers and the demo engine ───────────── */

/** Expires unanswered start requests against their server deadline. */
export function runFamilyTimers(ctx: Ctx) {
  const nowMs = ctx.clock.now();
  const due = (ctx.store.state.prototype?.trips ?? []).filter((t) => t.status === 'awaiting_approval' && t.approval?.status === 'pending' && nowMs >= Date.parse(t.approval.expiresAt));
  if (!due.length) return false;
  ctx.store.tx((s) => {
    for (const d of due) {
      const t = s.prototype!.trips.find((x) => x.id === d.id)!;
      applyFamilyEvent(ctx, s, t, 'EXPIRE', { kind: 'system' });
    }
  });
  return true;
}

/**
 * Simulated counterpart for Famille trips (`trip.demo`): a chauffeuse who departs, arrives,
 * photographs the child, asks to start and drops her at school; and/or a parent who approves,
 * refuses or ignores the start request. Every step is labelled « simulée » on the trip.
 */
export function runFamilyBots(ctx: Ctx) {
  const nowMs = ctx.clock.now();
  const since = (v: string | null | undefined) => (v ? nowMs - Date.parse(v) : -Infinity);
  let acted = false;
  for (const snapshot of ctx.store.state.prototype?.trips ?? []) {
    const demo = snapshot.demo;
    if (!demo || isFamilyTripClosed(snapshot.status)) continue;
    let step: { event: FamilyTripEvent; actor: 'driver' | 'parent'; input?: FamilyStepInput } | null = null;
    if (demo.driver) {
      const live = familyLive(snapshot, nowMs);
      if (snapshot.status === 'scheduled' && nowMs >= Date.parse(snapshot.pickupAt) - 15 * 60_000) step = { event: 'DEPART', actor: 'driver' };
      else if (snapshot.status === 'en_route' && live.progress >= 1) step = { event: 'ARRIVE', actor: 'driver' };
      else if (snapshot.status === 'arrived' && since(snapshot.arrivedAt) >= 4000) step = { event: 'PICKUP', actor: 'driver', input: { proof: FAMILY_DEMO_PROOFS.pickup, childName: snapshot.childName } };
      else if (snapshot.status === 'picked_up' && !(snapshot.approvals ?? []).length && since(snapshot.pickedUpAt) >= 3000) step = { event: 'REQUEST_START', actor: 'driver' };
      else if (snapshot.status === 'in_progress' && live.progress >= 1) {
        const child = ctx.store.state.prototype!.children.find((c) => c.id === snapshot.childId);
        const r = child?.recipients[0];
        step = { event: 'DROPOFF', actor: 'driver', input: { proof: FAMILY_DEMO_PROOFS.dropoff, recipientId: r?.id, code: r?.verificationCode } };
      }
    }
    if (!step && demo.parent && demo.parent !== 'timeout' && snapshot.status === 'awaiting_approval' && snapshot.approval?.status === 'pending' && since(snapshot.approval.requestedAt) >= 5000) {
      step =
        demo.parent === 'approve'
          ? { event: 'APPROVE', actor: 'parent', input: { approvalId: snapshot.approval.id, mode: 'remote' } }
          : { event: 'REFUSE', actor: 'parent', input: { approvalId: snapshot.approval.id, reason: 'Je viens chercher l’enfant moi-même (démo)' } };
    }
    if (!step) continue;
    const chosen = step;
    try {
      ctx.store.tx((s) => {
        const t = s.prototype!.trips.find((x) => x.id === snapshot.id)!;
        const user = userById(s, chosen.actor === 'driver' ? t.driverId : t.passengerId);
        applyFamilyEvent(ctx, s, t, chosen.event, { kind: chosen.actor, user }, chosen.input);
        t.timeline[t.timeline.length - 1]!.label += ' · simulation';
      });
      acted = true;
    } catch (e) {
      console.warn('[famille-bot]', (e as Error).message);
    }
  }
  return acted;
}

/** Demo creation shared by « Charger l’exemple », the scenario launcher and the `famille` seed. */
export function ensureExampleFamily(s: State, nowMs: number, parent: User, driver?: User) {
  const p = ensureFamille(s);
  let child = p.children.find((x) => x.passengerId === parent.id);
  if (!child) {
    child = {
      id: nextId(s, 'CH'),
      passengerId: parent.id,
      firstName: 'Lina',
      age: 8,
      school: 'École Agdal',
      notes: 'Attendre à l’entrée principale.',
      recipients: [
        { id: 'mother', name: parent.firstName, relationship: 'Mère', verificationCode: '1234' },
        { id: 'father', name: 'Youssef', relationship: 'Père', verificationCode: '5678' },
      ],
    };
    p.children.push(child);
  }
  let sub = p.subscriptions.find((x) => x.passengerId === parent.id && x.status === 'active' && Date.parse(x.endsAt) > nowMs);
  if (!sub) sub = addSubscription(s, nowMs, parent, p.catalog.plans.find((x) => x.enabled)!.id);
  if (driver) {
    assertFamilleEligible(driver);
    sub.driverId = driver.id;
    sub.driverName = `${driver.firstName} ${driver.lastName}`;
  }
  return { child, sub };
}

export function startDemoTrip(s: State, nowMs: number, parent: User, driver: User | undefined, demo: FamilyTrip['demo'], leadSeconds = 60) {
  const p = ensureFamille(s);
  const { child } = ensureExampleFamily(s, nowMs, parent, driver);
  const at = iso(nowMs);
  for (const t of p.trips.filter((x) => x.passengerId === parent.id && !isFamilyTripClosed(x.status))) {
    t.status = 'cancelled';
    t.cancellation = { at, by: 'parent', reason: 'Remplacé par un trajet de démonstration' };
    timeline(t, at, 'cancelled', 'Remplacé par un trajet de démonstration', 'system');
  }
  const trip = addTrip(s, nowMs, parent, { childId: child.id, pickup: PLACES.hayRiad, destination: { ...PLACES.agdal, label: 'École Agdal' }, pickupAt: iso(nowMs + leadSeconds * 1000), weekdays: [] }, { ignoreQuota: true });
  trip.demo = demo;
  return trip;
}

/* ───────────── Follow links (co-parent invite) ───────────── */

function followView(s: State, nowMs: number, g: FamilyGuardian): FamilyFollowView {
  const p = ensureFamille(s);
  const parent = userById(s, g.passengerId);
  const recent = p.trips
    .filter((t) => t.passengerId === g.passengerId && (!isFamilyTripClosed(t.status) || nowMs - Date.parse(t.completedAt ?? t.cancellation?.at ?? t.pickupAt) < 12 * 3_600_000))
    .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt))
    .slice(0, 5);
  return {
    guardianName: g.name,
    parentFirstName: parent.firstName,
    trips: recent.map((t) => ({
      id: t.id,
      childName: t.childName,
      driverFirstName: t.driverName.split(' ')[0] ?? t.driverName,
      status: t.status,
      pickup: t.pickup,
      destination: t.destination,
      pickupAt: t.pickupAt,
      timeline: t.timeline.filter((e) => e.kind !== 'call' && e.kind !== 'invite').map((e) => ({ at: e.at, label: e.label, kind: e.kind })),
      live: isFamilyTripActive(t.status) ? familyLive(t, nowMs) : null,
    })),
  };
}

const newToken = () => randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* ───────────── Routes ───────────── */

export function mountFamilleRoutes(
  app: Hono<Env>,
  ctx: Ctx,
  auth: {
    userOf: (c: Context<Env>, role?: 'passenger' | 'driver') => User;
    idempotent: <T>(ctx: Ctx, c: Context<Env>, id: string, raw: unknown, run: () => T, required?: boolean) => Promise<T>;
  },
) {
  const { userOf, idempotent } = auth;
  const now = () => ctx.clock.now();

  app.get('/prototype/family', (c) => {
    const u = userOf(c);
    return c.json(ctx.store.read((s) => familyOverview(s, u)));
  });
  app.post('/prototype/family/children', async (c) => {
    const u = userOf(c, 'passenger');
    const input = z
      .object({
        firstName: text,
        age: z.number().int().min(1).max(17),
        school: text,
        notes: z.string().trim().max(300),
        recipients: z.array(z.object({ id: text, name: text, relationship: text, verificationCode: z.string().regex(/^\d{4}$/, 'Code à 4 chiffres requis') })).min(1).max(8),
      })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const child = { ...input, id: nextId(s, 'CH'), passengerId: u.id };
        ensureFamille(s).children.push(child);
        audit(s, ctx.clock.iso(), { kind: 'parent', user: u }, 'family.child_added', child.id, 'Profil enfant ajouté');
        return child;
      }),
    );
  });
  app.post('/prototype/family/subscribe', async (c) => {
    const u = userOf(c, 'passenger');
    const input = z.object({ planId: text }).parse(await c.req.json());
    return c.json(await idempotent(ctx, c, u.id, input, () => ctx.store.tx((s) => addSubscription(s, now(), u, input.planId))));
  });
  app.post('/prototype/family/trips', async (c) => {
    const u = userOf(c, 'passenger');
    const input = z.object({ childId: text, pickup: place, destination: place, pickupAt: z.iso.datetime(), weekdays: z.array(z.number().int().min(0).max(6)).max(7) }).parse(await c.req.json());
    if (Date.parse(input.pickupAt) < now()) throw new DomainError('VALIDATION', 'Choisissez un horaire futur.');
    return c.json(await idempotent(ctx, c, u.id, input, () => ctx.store.tx((s) => addTrip(s, now(), u, input))));
  });
  app.post('/prototype/family/example', (c) => {
    if (!ctx.config.devMode) throw new DomainError('FORBIDDEN');
    const actor = userOf(c);
    return c.json(
      ctx.store.tx((s) => {
        const parent = actor.role === 'passenger' ? actor : mustFind(s.users, (x) => x.role === 'passenger' && x.cityId === actor.cityId && s.cases.some((v) => v.id === x.identityCaseId && v.status === 'approved'), 'cliente de démonstration');
        const { child } = ensureExampleFamily(s, now(), parent, actor.role === 'driver' ? actor : undefined);
        if (!ensureFamille(s).trips.some((x) => x.passengerId === parent.id && !isFamilyTripClosed(x.status)))
          addTrip(s, now(), parent, { childId: child.id, pickup: PLACES.hayRiad, destination: { ...PLACES.agdal, label: 'École Agdal' }, pickupAt: iso(now() + 3_600_000), weekdays: [1, 2, 3, 4, 5] });
        return familyOverview(s, actor);
      }),
    );
  });

  app.get('/prototype/family/trips/:id', (c) => {
    const u = userOf(c);
    return c.json(ctx.store.read((s) => tripFor(s, c.req.param('id'), u)));
  });
  /** Polled every second while the trip is active (ADR-0013 revisit: still polling, no socket). */
  app.get('/prototype/family/trips/:id/live', (c) => {
    const u = userOf(c);
    return c.json(ctx.store.read((s) => familyLive(tripFor(s, c.req.param('id'), u), now())));
  });
  app.post('/prototype/family/trips/:id/position', async (c) => {
    const u = userOf(c, 'driver');
    const { location: fix } = familyPositionSchema.parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const t = tripFor(s, c.req.param('id'), u);
        if (!isFamilyTripActive(t.status)) throw new DomainError('INVALID_TRANSITION', 'Le trajet n’est pas en cours.');
        t.lastFix = { location: fix, at: ctx.clock.iso() };
        return familyLive(t, now());
      }),
    );
  });

  /** The chauffeuse's one forward step (« Partir », « Je suis arrivée », photo, « Démarrer », drop-off). */
  app.post('/prototype/family/trips/:id/advance', async (c) => {
    const u = userOf(c);
    const input = familyAdvanceSchema.parse(await c.req.json());
    // A wrong handover code must be counted even though the request fails: the transaction
    // returns the refusal (a throw would roll the count back). The guard throws before any change.
    const result = ctx.store.tx((s): { trip: FamilyTrip } | { refused: DomainError } => {
      const t = tripFor(s, c.req.param('id'), u);
      if (u.role === 'passenger' && !ctx.config.devMode) throw new DomainError('FORBIDDEN');
      if (t.status !== input.expectedStatus) throw new DomainError('CONFLICT', 'Le trajet a changé. Rechargez avant de continuer.');
      const event = FAMILY_DRIVER_STEP[t.status];
      if (!event) throw new DomainError('FAMILY_APPROVAL_REQUIRED');
      // Dev mode: the parent may play the chauffeuse's steps (labelled as such), never her own approval.
      const driver = userById(s, t.driverId);
      const actor = u.role === 'driver' ? u : driver;
      try {
        applyFamilyEvent(ctx, s, t, event, { kind: 'driver', user: actor }, input);
      } catch (e) {
        if (event === 'DROPOFF' && isDomainError(e) && e.details?.wrongHandoverCode) return { refused: refuseHandover(s, ctx.clock.now(), t, actor) };
        throw e;
      }
      if (u.role === 'passenger') t.timeline[t.timeline.length - 1]!.label += ' · joué par le parent (démo)';
      return { trip: t };
    });
    if ('refused' in result) throw result.refused;
    return c.json(result.trip);
  });
  app.post('/prototype/family/trips/:id/approval', async (c) => {
    const u = userOf(c, 'passenger');
    const input = familyApprovalSchema.parse(await c.req.json());
    return c.json(
      await idempotent(ctx, c, u.id, input, () =>
        ctx.store.tx((s) => {
          const t = tripFor(s, c.req.param('id'), u);
          if (!familyTripMachine.can(t.status, input.decision === 'approve' ? 'APPROVE' : 'REFUSE'))
            throw new DomainError('INVALID_TRANSITION', 'Aucune demande de départ en attente.');
          return applyFamilyEvent(ctx, s, t, input.decision === 'approve' ? 'APPROVE' : 'REFUSE', { kind: 'parent', user: u }, { approvalId: input.approvalId, reason: input.reason, mode: input.mode });
        }),
      ),
    );
  });
  app.post('/prototype/family/trips/:id/cancel', async (c) => {
    const u = userOf(c);
    const { reason } = familyCancelSchema.parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const t = tripFor(s, c.req.param('id'), u);
        return applyFamilyEvent(ctx, s, t, 'CANCEL', { kind: u.role === 'driver' ? 'driver' : 'parent', user: u }, { reason });
      }),
    );
  });
  /** Hand-off to WhatsApp (parent → chauffeuse) or 19, after the caller's confirmation sheet. */
  app.post('/prototype/family/trips/:id/calls', async (c) => {
    const u = userOf(c);
    const input = familyCallSchema.parse(await c.req.json());
    return c.json(
      ctx.store.tx((s): FamilyCallResult => {
        const t = tripFor(s, c.req.param('id'), u);
        const at = ctx.clock.iso();
        const role = u.role === 'driver' ? 'driver' : 'parent';
        if (input.channel === 'police') {
          timeline(t, at, 'police', `${u.firstName} a appelé la police (${MOROCCO_POLICE_NUMBER})`, role);
          notify(s, t, at, { kind: 'police', audience: role === 'driver' ? 'parent' : 'driver', title: `${u.firstName} a appelé la police (${MOROCCO_POLICE_NUMBER})`, body: 'Restez joignable. Le support Naya est informé.' });
          t.incident = `Appel police (${MOROCCO_POLICE_NUMBER}) par ${u.firstName}`;
          audit(s, at, { kind: role, user: u }, 'family.police_call', t.id, t.incident);
          return { channel: 'police', url: `tel:${MOROCCO_POLICE_NUMBER}`, appUrl: null, simulated: false, counterpartName: 'Police' };
        }
        if (role === 'driver') throw new DomainError('FORBIDDEN', 'Demandez un appel : le parent confirme, puis vous appelle sur WhatsApp.');
        const driver = userById(s, t.driverId);
        timeline(t, at, 'call', `Appel WhatsApp vers ${driver.firstName} lancé par ${u.firstName}${ctx.config.devMode ? ' (démo)' : ''}`, 'parent');
        audit(s, at, { kind: 'parent', user: u }, 'family.whatsapp_call', t.id, 'Appel WhatsApp parent → chauffeuse');
        return { channel: 'whatsapp', url: whatsappLink(driver.phone), appUrl: whatsappLink(driver.phone, 'app'), simulated: ctx.config.devMode, counterpartName: driver.firstName };
      }),
    );
  });
  /** The chauffeuse asks the parent to call her; she never receives the parent's number. */
  app.post('/prototype/family/trips/:id/call-request', (c) => {
    const u = userOf(c, 'driver');
    return c.json(
      ctx.store.tx((s) => {
        const t = tripFor(s, c.req.param('id'), u);
        const at = ctx.clock.iso();
        timeline(t, at, 'call_request', `${u.firstName} demande un appel WhatsApp`, 'driver');
        notify(s, t, at, { kind: 'call_request', audience: 'parent', title: `${u.firstName} souhaite vous parler`, body: 'Confirmez pour l’appeler sur WhatsApp.' });
        return t;
      }),
    );
  });
  app.post('/prototype/family/trips/:id/incident', async (c) => {
    const u = userOf(c);
    const { message } = z.object({ message: text }).parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const t = tripFor(s, c.req.param('id'), u);
        const at = ctx.clock.iso();
        t.incident = message;
        timeline(t, at, 'incident', message, u.role === 'driver' ? 'driver' : 'parent');
        notify(s, t, at, { kind: 'incident', audience: u.role === 'driver' ? 'parent' : 'driver', title: message });
        audit(s, at, { kind: u.role === 'driver' ? 'driver' : 'parent', user: u }, 'family.incident', t.id, message);
        return t;
      }),
    );
  });

  /* Co-parent invites: a private follow link (read-only: status, live map, timeline). */
  app.post('/prototype/family/guardians', async (c) => {
    const u = userOf(c, 'passenger');
    const input = familyGuardianSchema.parse(await c.req.json());
    return c.json(
      await idempotent(ctx, c, u.id, input, () =>
        ctx.store.tx((s) => {
          const p = ensureFamille(s);
          if (!p.subscriptions.some((x) => x.passengerId === u.id && x.status === 'active')) throw new DomainError('VALIDATION', 'Activez Naya Famille avant d’inviter un proche.');
          if (p.guardians!.filter((g) => g.passengerId === u.id && g.status !== 'revoked').length >= 4) throw new DomainError('VALIDATION', 'Quatre proches au maximum peuvent suivre les trajets.');
          const token = newToken();
          const guardian: FamilyGuardian = { id: nextId(s, 'FG'), passengerId: u.id, ...input, status: 'invited', tokenHash: sha(token), createdAt: ctx.clock.iso(), lastViewedAt: null, revokedAt: null };
          p.guardians!.push(guardian);
          for (const t of p.trips.filter((x) => x.passengerId === u.id && !isFamilyTripClosed(x.status))) timeline(t, ctx.clock.iso(), 'invite', `${input.name} (${input.relationship}) invité·e à suivre les trajets`, 'parent');
          audit(s, ctx.clock.iso(), { kind: 'parent', user: u }, 'family.guardian_invited', guardian.id, `${input.relationship} invité·e à suivre les trajets`);
          return { guardian: guardianView(guardian), token };
        }),
      ),
    );
  });
  app.post('/prototype/family/guardians/:id/:action', (c) => {
    const u = userOf(c, 'passenger');
    const action = c.req.param('action');
    if (action !== 'revoke' && action !== 'renew') throw new DomainError('NOT_FOUND');
    return c.json(
      ctx.store.tx((s) => {
        const g = mustFind(ensureFamille(s).guardians!, (x) => x.id === c.req.param('id') && x.passengerId === u.id, 'proche');
        if (action === 'revoke') {
          g.status = 'revoked';
          g.revokedAt = ctx.clock.iso();
          audit(s, ctx.clock.iso(), { kind: 'parent', user: u }, 'family.guardian_revoked', g.id, 'Accès au suivi retiré');
          return { guardian: guardianView(g), token: null };
        }
        if (g.status === 'revoked') throw new DomainError('INVALID_TRANSITION', 'Cet accès a été retiré. Invitez à nouveau ce proche.');
        const token = newToken();
        g.tokenHash = sha(token);
        g.status = 'invited';
        audit(s, ctx.clock.iso(), { kind: 'parent', user: u }, 'family.guardian_renewed', g.id, 'Nouveau lien de suivi');
        return { guardian: guardianView(g), token };
      }),
    );
  });
  /** Public, no session: the token is the capability. Revoked links answer 404. */
  app.get('/prototype/family/follow/:token', (c) => {
    const hash = sha(c.req.param('token'));
    const g = (ctx.store.state.prototype?.guardians ?? []).find((x) => x.tokenHash === hash && x.status !== 'revoked');
    if (!g) throw new DomainError('NOT_FOUND', 'Ce lien de suivi n’est plus valide.');
    if (!g.lastViewedAt || now() - Date.parse(g.lastViewedAt) > 60_000) {
      ctx.store.tx((s) => {
        const live = s.prototype!.guardians!.find((x) => x.id === g.id)!;
        live.lastViewedAt = ctx.clock.iso();
        live.status = 'active';
      });
    }
    return c.json(ctx.store.read((s) => followView(s, now(), g)));
  });

  /* Scenario launcher: play a full Famille trip with a simulated counterpart. */
  if (ctx.config.devMode) {
    app.post('/dev/family/play', async (c) => {
      const actor = userOf(c);
      const demo = familyDemoSchema.parse(await c.req.json());
      return c.json(
        ctx.store.tx((s) => {
          const parent = actor.role === 'passenger' ? actor : mustFind(s.users, (x) => x.phone === '+212612345678' && x.role === 'passenger', 'cliente de démonstration');
          const trip = startDemoTrip(s, now(), parent, actor.role === 'driver' ? actor : undefined, demo, 20);
          audit(s, ctx.clock.iso(), { kind: 'system' }, 'dev.family_play', trip.id, `Trajet Famille de démonstration · chauffeuse ${demo.driver ? 'simulée' : 'réelle'} · parent ${demo.parent ?? 'réel'}`);
          return trip;
        }),
      );
    });
    app.post('/dev/family/trips/:id/demo', async (c) => {
      const u = userOf(c);
      const demo = familyDemoSchema.parse(await c.req.json());
      return c.json(
        ctx.store.tx((s) => {
          const t = tripFor(s, c.req.param('id'), u);
          t.demo = demo;
          return t;
        }),
      );
    });
  }
}
