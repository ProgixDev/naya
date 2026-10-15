import { Buffer, createHash, join, randomBytes, randomInt, rmSync, scryptSync, timingSafeEqual } from '../platform';
import { DomainError, formatMoney, isRideActive, scheduledMachine, type AdminUser, type FamilyTripStatus, type MobileRole, type User, type WashOrderStatus } from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { nextId } from '../store';
import { appendAudit } from '../audit';
import { applyFamilyEvent } from './famille';
import { releasePassengerWallet } from './prototype';
import { uploadDir } from './uploads';
import { walletOf } from './finance';

const OTP_TTL_S = 300;
const OTP_RESEND_S = 30;
const OTP_MAX_ATTEMPTS = 5;
const USER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;
/** A sign-in code is six digits. In mock mode any code of this shape signs in (ADR-0058). */
export const OTP_FORMAT = /^\d{6}$/;

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, passwordHash: scryptSync(password, salt, 32).toString('hex') };
}

function newSession(s: State, subjectType: 'user' | 'admin', subjectId: string, nowMs: number, ttlMs: number) {
  const token = randomBytes(32).toString('hex');
  s.sessions = s.sessions.filter((x) => Date.parse(x.expiresAt) > nowMs);
  s.sessions.push({ tokenHash: sha256(token), subjectType, subjectId, createdAt: new Date(nowMs).toISOString(), expiresAt: new Date(nowMs + ttlMs).toISOString() });
  return token;
}

export function requestOtp(ctx: Ctx, phone: string, role: MobileRole) {
  const now = ctx.clock.now();
  return ctx.store.tx((s) => {
    const existing = s.otps.find((o) => o.phone === phone && o.role === role);
    if (existing && Date.parse(existing.resendAvailableAt) > now) {
      throw new DomainError('OTP_RATE_LIMITED', undefined, { retryAfterSeconds: Math.ceil((Date.parse(existing.resendAvailableAt) - now) / 1000) });
    }
    // Every challenge stores the hash of a random code. With NAYA_DEV=0 it is printed to the server console, the
    // stand-in for an SMS provider. In mock mode nothing is sent and any 6-digit code signs in (codeMatches).
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (ctx.config.otpMode === 'random') console.info(`[otp] ${phone} (${role}) → ${code}`);
    s.otps = s.otps.filter((o) => !(o.phone === phone && o.role === role));
    const challenge = {
      phone,
      role,
      codeHash: sha256(`${phone}:${code}`),
      expiresAt: new Date(now + OTP_TTL_S * 1000).toISOString(),
      resendAvailableAt: new Date(now + OTP_RESEND_S * 1000).toISOString(),
      attempts: 0,
    };
    s.otps.push(challenge);
    return {
      expiresAt: challenge.expiresAt,
      resendAvailableAt: challenge.resendAvailableAt,
      delivery: ctx.config.otpMode === 'any' ? ('demo' as const) : ('console' as const),
    };
  });
}

/** Mock mode (dev mode, and always on the device): any 6-digit code. Otherwise only the code that was sent. */
function codeMatches(ctx: Ctx, codeHash: string, phone: string, code: string) {
  if (!OTP_FORMAT.test(code)) return false;
  if (ctx.config.otpMode === 'any') return true;
  const a = Buffer.from(codeHash);
  const b = Buffer.from(sha256(`${phone}:${code}`));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyOtp(ctx: Ctx, phone: string, role: MobileRole, code: string) {
  const now = ctx.clock.now();
  // Attempt counting must persist even when the code is wrong, so it is its own transaction.
  const verdict = ctx.store.tx((s) => {
    const ch = s.otps.find((o) => o.phone === phone && o.role === role);
    if (!ch || Date.parse(ch.expiresAt) <= now) return 'expired' as const;
    if (ch.attempts >= OTP_MAX_ATTEMPTS) return 'locked' as const;
    if (!codeMatches(ctx, ch.codeHash, phone, code)) {
      ch.attempts += 1;
      return ch.attempts >= OTP_MAX_ATTEMPTS ? ('locked' as const) : ('invalid' as const);
    }
    s.otps = s.otps.filter((o) => o !== ch);
    return 'ok' as const;
  });
  if (verdict === 'expired') throw new DomainError('OTP_EXPIRED');
  if (verdict === 'locked') throw new DomainError('OTP_RATE_LIMITED', 'Trop de tentatives. Demandez un nouveau code.');
  if (verdict === 'invalid') throw new DomainError('OTP_INVALID');

  return ctx.store.tx((s) => {
    const nowIso = new Date(now).toISOString();
    let user = s.users.find((u) => u.phone === phone && u.role === role);
    const isNew = !user;
    if (!user) {
      const id = nextId(s, role === 'passenger' ? 'PA' : 'DR');
      const caseId = nextId(s, role === 'passenger' ? 'VP' : 'VD');
      user = {
        id,
        role,
        phone,
        firstName: '',
        lastName: '',
        cityId: 'rabat',
        status: 'active',
        testerCities: [],
        createdAt: nowIso,
        savedPlaces: [],
        notifications: { rideUpdates: true, scheduledReminders: true, supportReplies: true, offers: true, product: false },
        identityCaseId: caseId,
        vehicleId: null,
        ratingAverage: null,
        ratingCount: 0,
        ...(role === 'driver' ? { familleEligibility: 'not_requested' as const } : {}),
      } satisfies User;
      s.users.push(user);
      s.cases.push({
        id: caseId,
        subject: role === 'passenger' ? 'passenger_identity' : 'driver_identity',
        userId: id,
        vehicleId: null,
        status: 'draft',
        items: [],
        identity: null,
        vehicle: null,
        decision: null,
        history: [{ at: nowIso, status: 'draft', by: id }],
        submittedAt: null,
        updatedAt: nowIso,
        version: 1,
      });
      if (role === 'passenger') {
        s.paymentMethods.push({ id: nextId(s, 'PM'), userId: id, kind: 'cash', label: 'Espèces', providerToken: null, last4: null, expMonth: null, expYear: null, isDefault: true });
      }
      appendAudit(s, nowIso, { actor: { type: 'user', id, name: phone }, action: 'account.created', entityType: 'user', entityId: id, cityId: 'rabat', summary: `Compte ${role === 'passenger' ? 'passagère' : 'chauffeuse'} créé par vérification du numéro` });
    }
    const token = newSession(s, 'user', user.id, now, USER_SESSION_DAYS * 86_400_000);
    return { token, userId: user.id, isNew };
  });
}

export function adminLogin(ctx: Ctx, email: string, password: string) {
  const now = ctx.clock.now();
  return ctx.store.tx((s) => {
    const admin = s.admins.find((a) => a.email.toLowerCase() === email.toLowerCase());
    const cred = admin && s.adminCredentials.find((c) => c.adminId === admin.id);
    const candidate = cred ? hashPassword(password, cred.salt).passwordHash : hashPassword(password).passwordHash;
    if (!admin || !cred || !timingSafeEqual(Buffer.from(candidate), Buffer.from(cred.passwordHash))) {
      throw new DomainError('UNAUTHORIZED', 'Adresse e-mail ou mot de passe incorrect.');
    }
    const token = newSession(s, 'admin', admin.id, now, ADMIN_SESSION_HOURS * 3_600_000);
    appendAudit(s, new Date(now).toISOString(), { actor: { type: 'admin', id: admin.id, name: admin.name }, action: 'admin.login', entityType: 'admin', entityId: admin.id, summary: 'Connexion à l’administration' });
    return { token, admin };
  });
}

export type Principal = { kind: 'user'; user: User } | { kind: 'admin'; admin: AdminUser };

export function authenticate(ctx: Ctx, bearer: string | undefined): Principal | null {
  if (!bearer) return null;
  const token = bearer.replace(/^Bearer\s+/i, '');
  const hash = sha256(token);
  const now = ctx.clock.now();
  const s = ctx.store.state;
  const session = s.sessions.find((x) => x.tokenHash === hash && Date.parse(x.expiresAt) > now);
  if (!session) return null;
  if (session.subjectType === 'user') {
    const user = s.users.find((u) => u.id === session.subjectId);
    return user && user.status === 'active' ? { kind: 'user', user } : null;
  }
  const admin = s.admins.find((a) => a.id === session.subjectId);
  return admin ? { kind: 'admin', admin } : null;
}

export function logout(ctx: Ctx, bearer: string | undefined) {
  if (!bearer) return;
  const hash = sha256(bearer.replace(/^Bearer\s+/i, ''));
  ctx.store.tx((s) => {
    s.sessions = s.sessions.filter((x) => x.tokenHash !== hash);
  });
}

/* ───────────── Account deletion (App Store guideline 5.1.1(v), PRD-35, PAX-12, ADR-0055) ───────────── */

/** The name every kept record shows once its account is deleted (rides, tickets, alerts, the account itself). */
export const DELETED_ACCOUNT_NAME = 'Compte supprimé';
const DELETED_CHILD_NAME = 'Enfant';

export type DeletionBlocker =
  | 'ride_active'
  | 'payment_pending'
  | 'payment_due'
  | 'wallet_balance'
  | 'family_trip_active'
  | 'safety_alert_open'
  | 'wash_order_active'
  /** Chauffeuse only. */
  | 'driver_online'
  | 'transfer_pending'
  | 'wallet_debt'
  | 'famille_assignments';

const ACTIVE_WASH: readonly WashOrderStatus[] = ['booked', 'washer_assigned', 'en_route', 'washing'];
/** A Famille trip in one of these states has a chauffeuse on the way or the child on board. */
const FAMILY_TRIP_UNDER_WAY: readonly FamilyTripStatus[] = ['en_route', 'arrived', 'picked_up', 'awaiting_approval', 'in_progress'];
/** Upload file extensions, as `uploads.ts` writes them. */
const UPLOAD_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'image/svg+xml': 'svg' };

type Blocker = { code: DeletionBlocker; message: string };

/**
 * What stops an account from being deleted right now, first reason first. Each one is something
 * she can finish or settle herself, or take to the assistance; the message says how.
 */
export function deletionBlockers(s: State, user: User, at: string): Blocker[] {
  return user.role === 'driver' ? driverDeletionBlockers(s, user, at) : passengerDeletionBlockers(s, user);
}

function passengerDeletionBlockers(s: State, user: User): Blocker[] {
  const out: Blocker[] = [];
  const rides = s.rides.filter((r) => r.passengerId === user.id);
  if (rides.some((r) => isRideActive(r.status))) {
    out.push({ code: 'ride_active', message: 'Une course est en cours. Vous pourrez supprimer votre compte une fois la course terminée ou annulée.' });
  }
  if (s.prototype?.trips.some((t) => t.passengerId === user.id && FAMILY_TRIP_UNDER_WAY.includes(t.status))) {
    out.push({ code: 'family_trip_active', message: 'Un trajet Naya Famille est en cours. Vous pourrez supprimer votre compte une fois le trajet terminé.' });
  }
  if (s.prototype?.alerts.some((a) => a.userId === user.id && a.status !== 'resolved')) {
    out.push({ code: 'safety_alert_open', message: 'Une alerte de sécurité est en cours de traitement. Vous pourrez supprimer votre compte une fois l’alerte close.' });
  }
  if (s.carWash?.orders.some((o) => o.customerId === user.id && ACTIVE_WASH.includes(o.status))) {
    out.push({ code: 'wash_order_active', message: 'Un lavage à domicile est réservé ou en cours. Annulez-le ou attendez sa fin, puis revenez ici.' });
  }
  const wallet = s.prototype?.wallets.find((w) => w.userId === user.id);
  // Wallet holds (`hold:<ride>`) belong to a ride, a booking or a wash order, each handled on its own.
  if (s.payments.some((p) => p.payerId === user.id && p.status === 'pending') || wallet?.entries.some((e) => e.status === 'pending' && !e.id.startsWith('hold:'))) {
    out.push({ code: 'payment_pending', message: 'Un paiement est en cours de confirmation. Réessayez une fois qu’il sera confirmé.' });
  }
  if (rides.some((r) => r.paymentId && s.payments.find((p) => p.id === r.paymentId)?.status === 'failed')) {
    out.push({ code: 'payment_due', message: 'Une course reste à régler. Réglez-la depuis son reçu dans Trajets, puis revenez ici.' });
  }
  if (wallet && wallet.balance > 0) {
    out.push({
      code: 'wallet_balance',
      message: `Il reste ${formatMoney(wallet.balance)} sur votre portefeuille Naya. Utilisez ce solde ou demandez son remboursement à l’assistance, puis revenez ici.`,
    });
  }
  return out;
}

/**
 * A chauffeuse: no ride or Famille trip under way, offline, no money moving, and a wallet at exactly
 * zero. A balance is hers to withdraw and a debt is owed to Naya: both are settled first, by her or
 * with the assistance, because deleting the account cannot pay either (ADR-0055 rules, driver side).
 */
function driverDeletionBlockers(s: State, user: User, at: string): Blocker[] {
  const out: Blocker[] = [];
  const driven = s.rides.filter((r) => r.driverId === user.id);
  if (driven.some((r) => isRideActive(r.status))) {
    out.push({ code: 'ride_active', message: 'Une course est en cours. Vous pourrez supprimer votre compte une fois la course terminée.' });
  }
  const p = s.prototype;
  if (p?.trips.some((t) => t.driverId === user.id && FAMILY_TRIP_UNDER_WAY.includes(t.status))) {
    out.push({ code: 'family_trip_active', message: 'Un trajet Naya Famille est en cours. Vous pourrez supprimer votre compte une fois le trajet terminé.' });
  }
  if (s.presence.some((x) => x.driverId === user.id && x.online)) {
    out.push({ code: 'driver_online', message: 'Vous êtes en ligne. Passez hors ligne depuis l’accueil, puis revenez ici.' });
  }
  if (p?.alerts.some((a) => a.userId === user.id && a.status !== 'resolved')) {
    out.push({ code: 'safety_alert_open', message: 'Une alerte de sécurité est en cours de traitement. Vous pourrez supprimer votre compte une fois l’alerte close.' });
  }
  if (s.carWash?.orders.some((o) => o.customerId === user.id && ACTIVE_WASH.includes(o.status))) {
    out.push({ code: 'wash_order_active', message: 'Un lavage à domicile est réservé ou en cours. Annulez-le ou attendez sa fin, puis revenez ici.' });
  }
  const rideIds = new Set(driven.map((r) => r.id));
  if (s.payments.some((x) => x.rideId && rideIds.has(x.rideId) && x.status === 'pending')) {
    out.push({ code: 'payment_pending', message: 'Le paiement d’une course attend sa confirmation. Réessayez une fois qu’il sera confirmé.' });
  }
  if (s.recharges.some((r) => r.driverId === user.id && r.status === 'pending') || s.withdrawals.some((w) => w.driverId === user.id && w.status === 'pending')) {
    out.push({ code: 'transfer_pending', message: 'Une recharge ou un retrait est en cours de traitement. Réessayez une fois l’opération terminée.' });
  }
  const wallet = walletOf(s, user.id, at);
  if (wallet.balance > 0) {
    out.push({
      code: 'wallet_balance',
      message: `Il reste ${formatMoney(wallet.balance)} sur votre portefeuille Naya. Retirez ce solde ou contactez l’assistance, puis revenez ici.`,
    });
  } else if (wallet.balance < 0) {
    out.push({
      code: 'wallet_debt',
      message: `Votre portefeuille Naya doit encore ${formatMoney(-wallet.balance)} de commission. Rechargez-le ou contactez l’assistance pour régler ce montant, puis revenez ici.`,
    });
  }
  if (p?.subscriptions.some((x) => x.driverId === user.id && x.status === 'active') || p?.trips.some((t) => t.driverId === user.id && t.status === 'scheduled')) {
    out.push({
      code: 'famille_assignments',
      message: 'Des familles vous ont confié des trajets Naya Famille. Contactez l’assistance pour qu’une autre chauffeuse les reprenne, puis revenez ici.',
    });
  }
  return out;
}

/**
 * Deletes a passenger's or a chauffeuse's account at her request. Refused while something is under
 * way or money is still moving (`deletionBlockers`). Otherwise, in one transaction:
 * - erased: name, phone, saved places, notification choices, tester cities, saved payment methods,
 *   identity details and identity photos, open sign-in codes, sessions, stored request replays,
 *   her Famille children's details and the relatives she invited (their follow links stop working);
 * - cancelled: her scheduled rides (free while no chauffeuse is assigned), her upcoming Famille trips
 *   (the chauffeuse is told) and her Famille subscription;
 * - kept under the pseudonym « Compte supprimé » (same account id): rides, payments, wallet entries,
 *   support tickets, SOS alerts and car-wash orders, which are financial, safety or legal records.
 * A chauffeuse also loses her payout accounts, her presence and her vehicle's plate; the rides she
 * drove, her ledger, recharges and withdrawals are kept, and those rides and Famille trips show
 * « Compte supprimé » instead of her name (the ride snapshot keeps the car, for the passenger's receipt
 * and any safety follow-up).
 * The account stays as a `suspended` row so every kept record still resolves; nobody can sign in to
 * it, and the same phone number signs up as a new account. The audit event carries no personal data.
 * Identity photo files are removed after the transaction commits.
 */
export function deleteAccount(ctx: Ctx, user: User) {
  const at = ctx.clock.iso();
  const files = ctx.store.tx((s) => {
    const u = s.users.find((x) => x.id === user.id);
    if (!u || u.status !== 'active') throw new DomainError('UNAUTHORIZED');
    const blockers = deletionBlockers(s, u, at);
    const first = blockers[0];
    if (first) {
      throw new DomainError(first.code === 'ride_active' ? 'ACTIVE_RIDE_EXISTS' : 'PENDING_OPERATION', first.message, { blockers: blockers.map((b) => b.code) });
    }
    const phone = u.phone;

    // Naya Famille: children first, so the cancellations below never write a child's name to the audit trail.
    const p = s.prototype;
    let cancelledTrips = 0;
    if (p) {
      // Names her trips' timelines and notifications were written with (« Photo de Lina… », « Remise confirmée à … »).
      const familyNames = new Map<string, string>();
      for (const child of p.children.filter((c) => c.passengerId === u.id)) {
        if (child.firstName.trim()) familyNames.set(child.firstName, DELETED_CHILD_NAME);
        for (const r of child.recipients) if (r.name.trim()) familyNames.set(r.name, 'la personne autorisée');
        Object.assign(child, { firstName: DELETED_CHILD_NAME, age: 0, school: '', notes: '', recipients: [] });
      }
      const scrub = (text: string) => [...familyNames].reduce((out, [name, generic]) => out.split(name).join(generic), text);
      for (const t of p.trips.filter((x) => x.passengerId === u.id)) {
        if (t.childName.trim()) familyNames.set(t.childName, DELETED_CHILD_NAME);
        t.childName = DELETED_CHILD_NAME;
        for (const e of t.timeline) e.label = scrub(e.label);
        for (const n of t.notifications) Object.assign(n, { title: scrub(n.title), ...(n.body === undefined ? {} : { body: scrub(n.body) }) });
        if (t.status === 'scheduled') {
          applyFamilyEvent(ctx, s, t, 'CANCEL', { kind: 'parent', user: { ...u, firstName: 'la passagère', lastName: '' } }, { reason: DELETED_ACCOUNT_NAME });
          cancelledTrips += 1;
        }
      }
      for (const sub of p.subscriptions.filter((x) => x.passengerId === u.id)) {
        sub.status = 'paused';
        if (Date.parse(sub.endsAt) > Date.parse(at)) sub.endsAt = at;
      }
      for (const g of (p.guardians ?? []).filter((x) => x.passengerId === u.id)) {
        Object.assign(g, { name: 'Proche', phone: null, status: 'revoked', tokenHash: '', revokedAt: g.revokedAt ?? at });
      }
      for (const a of p.alerts.filter((x) => x.userId === u.id)) {
        Object.assign(a, { userName: DELETED_ACCOUNT_NAME, contactName: '' });
        // Her own steps were signed with her first name; the safety team's steps keep theirs.
        for (const step of a.actions) if (step.by === u.firstName) step.by = DELETED_ACCOUNT_NAME;
      }
    }

    // Scheduled rides have no chauffeuse yet, so cancelling them is free (cancelScheduled).
    let cancelledBookings = 0;
    for (const b of s.scheduled) {
      if (b.passengerId !== u.id || b.status !== 'scheduled') continue;
      b.status = scheduledMachine.next(b.status, 'CANCEL');
      b.cancellation = { reasonCode: 'account_deleted', reasonText: DELETED_ACCOUNT_NAME, at };
      b.updatedAt = at;
      if (b.paymentMethod.kind === 'wallet') releasePassengerWallet(s, u.id, b.id);
      b.history.push({ at, label: 'Réservation annulée · sans frais · compte supprimé' });
      cancelledBookings += 1;
    }

    // Kept records, pseudonymised.
    let rides = 0;
    for (const r of s.rides) {
      if (r.passengerId !== u.id) continue;
      r.passenger.firstName = DELETED_ACCOUNT_NAME;
      rides += 1;
    }
    for (const o of s.offers) if (o.passenger.id === u.id) o.passenger.firstName = DELETED_ACCOUNT_NAME;
    let tickets = 0;
    for (const t of s.tickets) {
      if (t.userId !== u.id) continue;
      t.userName = DELETED_ACCOUNT_NAME;
      for (const m of t.messages) if (m.author === 'user') m.authorName = DELETED_ACCOUNT_NAME;
      tickets += 1;
    }
    for (const o of s.carWash?.orders ?? []) {
      if (o.customerId !== u.id) continue;
      o.customerFirstName = DELETED_ACCOUNT_NAME;
      o.parkingNotes = '';
    }

    // Identity: details and photos go; the case keeps its decision history so a past review stays traceable.
    const removed = s.uploads.filter((x) => x.ownerId === u.id && x.purpose !== 'support_attachment' && x.purpose !== 'family_proof');
    const removedIds = new Set(removed.map((x) => x.id));
    s.uploads = s.uploads.filter((x) => !removedIds.has(x.id));
    for (const c of s.cases) {
      if (c.userId !== u.id) continue;
      c.identity = null;
      c.draft = null;
      for (const item of c.items) item.uploadIds = item.uploadIds.filter((id) => !removedIds.has(id));
      c.updatedAt = at;
      c.version += 1;
    }

    // Chauffeuse: what she drove stays, without her name; how she was paid goes.
    let ridesDriven = 0;
    if (u.role === 'driver') {
      for (const r of s.rides) {
        if (r.driverId !== u.id) continue;
        ridesDriven += 1;
        if (r.driver) Object.assign(r.driver, { firstName: DELETED_ACCOUNT_NAME, lastInitial: '' });
      }
      const name = u.firstName.trim();
      const scrub = (text: string) => (name ? text.split(name).join('la chauffeuse') : text);
      for (const t of p?.trips ?? []) {
        if (t.driverId !== u.id) continue;
        t.driverName = DELETED_ACCOUNT_NAME;
        for (const e of t.timeline) e.label = scrub(e.label);
        for (const n of t.notifications) Object.assign(n, { title: scrub(n.title), ...(n.body === undefined ? {} : { body: scrub(n.body) }) });
      }
      for (const sub of p?.subscriptions ?? []) if (sub.driverId === u.id) sub.driverName = DELETED_ACCOUNT_NAME;
      for (const v of s.vehicles) if (v.driverId === u.id) v.plate = '';
      s.payoutAccounts = s.payoutAccounts.filter((x) => x.driverId !== u.id);
      s.presence = s.presence.filter((x) => x.driverId !== u.id);
    }

    // The profile itself.
    Object.assign(u, {
      firstName: 'Compte',
      lastName: 'supprimé',
      phone: '',
      status: 'suspended',
      testerCities: [],
      savedPlaces: [],
      notifications: { rideUpdates: false, scheduledReminders: false, supportReplies: false, offers: false, product: false },
    } satisfies Partial<User>);
    s.paymentMethods = s.paymentMethods.filter((m) => m.userId !== u.id);
    s.sessions = s.sessions.filter((x) => !(x.subjectType === 'user' && x.subjectId === u.id));
    s.otps = s.otps.filter((o) => !(o.phone === phone && o.role === u.role));
    s.idempotency = s.idempotency.filter((r) => r.subjectId !== u.id);

    appendAudit(s, at, {
      actor: { type: 'user', id: u.id, name: DELETED_ACCOUNT_NAME },
      action: 'account.deleted',
      entityType: 'user',
      entityId: u.id,
      cityId: u.cityId,
      summary:
        u.role === 'driver'
          ? 'Compte chauffeuse supprimé à sa demande · profil anonymisé, courses, portefeuille et opérations conservés sous pseudonyme'
          : 'Compte passagère supprimé à sa demande · profil anonymisé, courses et paiements conservés sous pseudonyme',
      before: { status: 'active' },
      after: { status: 'suspended', deleted: true, kept: { rides: rides + ridesDriven, tickets }, erased: { identityFiles: removed.length }, cancelled: { bookings: cancelledBookings, familyTrips: cancelledTrips } },
    });
    return removed;
  });
  for (const f of files) {
    try {
      rmSync(join(uploadDir(ctx), `${f.id}.${UPLOAD_EXT[f.mimeType] ?? 'jpg'}`), { force: true });
    } catch {
      // The record is gone; a file the platform cannot remove is unreadable through the API anyway.
    }
  }
  return { ok: true as const, deletedAt: at };
}
