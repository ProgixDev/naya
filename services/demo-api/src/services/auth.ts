import { Buffer, createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from '../platform';
import { DomainError, type AdminUser, type MobileRole, type User } from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { nextId } from '../store';
import { appendAudit } from '../audit';

const OTP_TTL_S = 300;
const OTP_RESEND_S = 30;
const OTP_MAX_ATTEMPTS = 5;
const USER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;
export const DEMO_OTP = '123456';

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
    const code = ctx.config.otpMode === 'fixed' ? DEMO_OTP : String(randomInt(0, 1_000_000)).padStart(6, '0');
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
      /** Present only in demo mode so testers can sign in without SMS delivery. */
      demoCode: ctx.config.otpMode === 'fixed' ? code : null,
      delivery: ctx.config.otpMode === 'fixed' ? ('demo' as const) : ('console' as const),
    };
  });
}

export function verifyOtp(ctx: Ctx, phone: string, role: MobileRole, code: string) {
  const now = ctx.clock.now();
  // Attempt counting must persist even when the code is wrong, so it is its own transaction.
  const verdict = ctx.store.tx((s) => {
    const ch = s.otps.find((o) => o.phone === phone && o.role === role);
    if (!ch || Date.parse(ch.expiresAt) <= now) return 'expired' as const;
    if (ch.attempts >= OTP_MAX_ATTEMPTS) return 'locked' as const;
    const a = Buffer.from(ch.codeHash);
    const b = Buffer.from(sha256(`${phone}:${code}`));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
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
