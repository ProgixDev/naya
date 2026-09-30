import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  assertRechargeAmount,
  assertWithdrawable,
  DomainError,
  formatMoney,
  projectWallet,
  resolveTransferEvent,
  splitFare,
  type AdminUser,
  type Centimes,
  type CorrectionInput,
  type EarningsSummary,
  type LedgerEntry,
  type ProviderCallback,
  type RechargeInput,
  type User,
  type Wallet,
  type WithdrawalInput,
} from '@naya/domain';
import type { Ctx } from '../context';
import type { ProviderJob, State } from '../state';
import { mustFind, nextId } from '../store';
import { appendAudit, SYSTEM } from '../audit';
import { requirePermission } from './permissions';

/* ───────────── Wallet projection ───────────── */

export function walletOf(s: State, driverId: string, at: string): Wallet {
  const driver = mustFind(s.users, (u) => u.id === driverId, 'chauffeuse');
  const city = mustFind(s.cities, (c) => c.id === driver.cityId, 'ville');
  return projectWallet({
    driverId,
    cityId: city.id,
    entries: s.ledger.filter((e) => e.driverId === driverId),
    withdrawals: s.withdrawals.filter((w) => w.driverId === driverId),
    recharges: s.recharges.filter((r) => r.driverId === driverId),
    debtLimit: city.rules.debtLimit,
    at,
  });
}

/**
 * Posts one ledger entry at most once per idempotency key. A replayed business event
 * (duplicate callback, retried request) returns the existing entry and changes nothing.
 */
export function postLedger(
  s: State,
  at: string,
  input: Omit<LedgerEntry, 'id' | 'balanceAfter' | 'createdAt' | 'rideId' | 'rechargeId' | 'withdrawalId' | 'correctionId'> &
    Partial<Pick<LedgerEntry, 'rideId' | 'rechargeId' | 'withdrawalId' | 'correctionId'>>,
): { entry: LedgerEntry; duplicate: boolean } {
  const existing = s.ledger.find((e) => e.idempotencyKey === input.idempotencyKey);
  if (existing) return { entry: existing, duplicate: true };
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) throw new RangeError('ledger amount must be a non-zero integer');
  const balance = s.ledger.filter((e) => e.driverId === input.driverId).reduce((a, e) => a + e.amount, 0);
  const entry: LedgerEntry = {
    id: nextId(s, 'LE', 5),
    rideId: null,
    rechargeId: null,
    withdrawalId: null,
    correctionId: null,
    ...input,
    balanceAfter: balance + input.amount,
    createdAt: at,
  };
  s.ledger.push(entry);
  return { entry, duplicate: false };
}

/* ───────────── Provider simulation and signed callbacks ───────────── */

export function signPayload(secret: string, body: string) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifySignature(secret: string, body: string, signature: string | undefined) {
  if (!signature) return false;
  const expected = Buffer.from(signPayload(secret, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function queueProviderJob(s: State, job: Omit<ProviderJob, 'id' | 'delivered'>) {
  s.providerJobs.push({ ...job, id: nextId(s, 'PJ', 5), delivered: false });
}

/**
 * Applies an authenticated provider event. Idempotent: an event id is processed once,
 * and a repeated terminal outcome for the same object is a no-op.
 */
export function applyProviderEvent(ctx: Ctx, event: ProviderCallback) {
  return ctx.store.tx((s) => applyProviderEventIn(s, ctx.clock.iso(), event));
}

export function applyProviderEventIn(s: State, now: string, event: ProviderCallback): { outcome: 'applied' | 'duplicate' } {
  if (s.processedProviderEvents.includes(event.eventId)) return { outcome: 'duplicate' };
  s.processedProviderEvents.push(event.eventId);
  const reason = event.reason ?? null;
  const actor = { type: 'provider' as const, id: 'demo-provider', name: 'Prestataire de démonstration' };

  if (event.kind === 'recharge') {
    const r = mustFind(s.recharges, (x) => x.providerRef === event.ref, 'recharge');
    const { next, outcome } = resolveTransferEvent(r.status, event.outcome === 'confirmed' ? 'CONFIRM' : 'FAIL');
    if (outcome === 'duplicate') return { outcome };
    r.status = next;
    r.updatedAt = now;
    if (next === 'confirmed') {
      postLedger(s, now, { driverId: r.driverId, type: 'recharge', amount: r.amount, description: `Recharge ${r.id} · ${r.providerName}`, rechargeId: r.id, idempotencyKey: `recharge:${r.id}` });
    } else {
      r.failureReason = reason ?? 'Paiement refusé par le prestataire.';
    }
    appendAudit(s, now, { actor, action: `recharge.${next}`, entityType: 'recharge', entityId: r.id, cityId: r.cityId, summary: `Recharge ${formatMoney(r.amount)} ${next === 'confirmed' ? 'confirmée' : 'échouée'}` });
    return { outcome };
  }

  if (event.kind === 'withdrawal') {
    const w = mustFind(s.withdrawals, (x) => x.providerRef === event.ref, 'retrait');
    const { next, outcome } = resolveTransferEvent(w.status, event.outcome === 'confirmed' ? 'CONFIRM' : 'FAIL');
    if (outcome === 'duplicate') return { outcome };
    w.status = next;
    w.updatedAt = now;
    if (next === 'confirmed') {
      postLedger(s, now, { driverId: w.driverId, type: 'withdrawal', amount: -w.amount, description: `Retrait ${w.id} vers ${w.destinationLabel}`, withdrawalId: w.id, idempotencyKey: `withdrawal:${w.id}` });
    } else {
      // The reservation disappears with the pending status. No compensating credit is posted.
      w.failureReason = reason ?? 'Virement refusé par la banque.';
    }
    appendAudit(s, now, { actor, action: `withdrawal.${next}`, entityType: 'withdrawal', entityId: w.id, cityId: w.cityId, summary: `Retrait ${formatMoney(w.amount)} ${next === 'confirmed' ? 'confirmé' : 'échoué, réservation libérée'}` });
    return { outcome };
  }

  const p = mustFind(s.payments, (x) => x.providerRef === event.ref, 'paiement');
  if (p.status === 'confirmed' && event.outcome === 'confirmed') return { outcome: 'duplicate' };
  if (p.status === 'failed' && event.outcome === 'failed') return { outcome: 'duplicate' };
  if (p.status !== 'pending') throw new DomainError('CONFLICT', 'Paiement déjà finalisé.');
  p.status = event.outcome === 'confirmed' ? 'confirmed' : 'failed';
  p.updatedAt = now;
  const ride = p.rideId ? s.rides.find((r) => r.id === p.rideId) : undefined;
  if (p.status === 'failed') p.failureReason = reason ?? 'Carte refusée.';
  if (ride) {
    ride.timeline.push({ at: now, type: `payment.${p.status}`, actor: 'provider', label: p.status === 'confirmed' ? `Paiement carte confirmé · ${formatMoney(p.amount)}` : 'Paiement carte refusé' });
  }
  if (p.status === 'confirmed' && ride?.driverId) {
    if (p.purpose === 'ride') {
      const split = splitFare(p.amount, ride.terms.commissionBp);
      postLedger(s, now, { driverId: ride.driverId, type: 'ride_net_credit', amount: split.net, description: `Revenu net course ${ride.id} (carte)`, rideId: ride.id, idempotencyKey: `ride:${ride.id}:net` });
    } else {
      // The driver who travelled to the pickup receives the fee, net of commission.
      const split = splitFare(p.amount, ride.terms.commissionBp);
      postLedger(s, now, { driverId: ride.driverId, type: 'cancellation_fee_credit', amount: split.net, description: `Frais d’annulation ${ride.id} (net)`, rideId: ride.id, idempotencyKey: `ride:${ride.id}:cancel-fee` });
    }
  }
  appendAudit(s, now, { actor, action: `payment.${p.status}`, entityType: 'payment', entityId: p.id, cityId: ride?.cityId ?? null, summary: `Paiement ${p.id} ${p.status === 'confirmed' ? 'confirmé' : 'refusé'} · ${formatMoney(p.amount)}` });
  return { outcome: 'applied' };
}

/** Delivers due simulated provider outcomes through the same code path as signed callbacks. */
export function deliverDueProviderJobs(ctx: Ctx) {
  const now = ctx.clock.now();
  const due = ctx.store.state.providerJobs.filter((j) => !j.delivered && j.outcome !== 'manual' && j.dueAt && Date.parse(j.dueAt) <= now);
  if (due.length === 0) return 0;
  ctx.store.tx((s) => {
    for (const j of s.providerJobs) {
      if (j.delivered || j.outcome === 'manual' || !j.dueAt || Date.parse(j.dueAt) > now) continue;
      j.delivered = true;
      applyProviderEventIn(s, new Date(now).toISOString(), { eventId: `evt_${j.id}`, kind: j.kind, ref: j.ref, outcome: j.outcome, reason: j.reason });
    }
  });
  return due.length;
}

/** Sandbox action standing in for the provider's hosted page (3-D Secure, agency counter…). */
export function resolveManually(ctx: Ctx, kind: ProviderJob['kind'], ref: string, outcome: 'confirmed' | 'failed', reason: string | null) {
  return ctx.store.tx((s) => {
    const job = s.providerJobs.find((j) => j.kind === kind && j.ref === ref && !j.delivered);
    if (job) job.delivered = true;
    return applyProviderEventIn(s, ctx.clock.iso(), { eventId: `evt_manual_${kind}_${ref}_${outcome}`, kind, ref, outcome, reason });
  });
}

/* ───────────── Recharges and withdrawals ───────────── */

export function createRecharge(ctx: Ctx, driver: User, input: RechargeInput) {
  assertRechargeAmount(input.amount);
  return ctx.store.tx((s) => {
    const provider = mustFind(s.providers, (p) => p.id === input.providerId, 'prestataire');
    if (provider.cityId !== driver.cityId || provider.purpose !== 'recharge' || !provider.enabled || !provider.configured) {
      throw new DomainError('PAYMENT_METHOD_UNAVAILABLE');
    }
    if (s.recharges.some((r) => r.driverId === driver.id && r.status === 'pending')) {
      throw new DomainError('PENDING_OPERATION', 'Une recharge est déjà en attente de confirmation.');
    }
    const now = ctx.clock.iso();
    const id = nextId(s, 'RC');
    const recharge = {
      id,
      driverId: driver.id,
      cityId: driver.cityId,
      amount: input.amount,
      providerId: provider.id,
      providerName: provider.name,
      status: 'pending' as const,
      providerRef: `demo_rc_${id}`,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    s.recharges.push(recharge);
    queueProviderJob(s, { kind: 'recharge', ref: recharge.providerRef, outcome: 'manual', reason: null, dueAt: null });
    appendAudit(s, now, { actor: { type: 'user', id: driver.id, name: `${driver.firstName} ${driver.lastName}` }, action: 'recharge.requested', entityType: 'recharge', entityId: id, cityId: driver.cityId, summary: `Recharge ${formatMoney(input.amount)} demandée via ${provider.name}` });
    return recharge;
  });
}

export function createWithdrawal(ctx: Ctx, driver: User, input: WithdrawalInput) {
  return ctx.store.tx((s) => {
    const account = mustFind(s.payoutAccounts, (a) => a.id === input.payoutAccountId && a.driverId === driver.id, 'compte');
    const provider = s.providers.find((p) => p.cityId === driver.cityId && p.purpose === 'withdrawal' && p.enabled && p.configured);
    if (!provider) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE', 'Aucun prestataire de virement n’est disponible.');
    const city = mustFind(s.cities, (c) => c.id === driver.cityId, 'ville');
    const now = ctx.clock.iso();
    const wallet = walletOf(s, driver.id, now);
    const hasPending = s.withdrawals.some((w) => w.driverId === driver.id && w.status === 'pending');
    assertWithdrawable(input.amount, wallet, city.rules.minimumWithdrawal, hasPending);
    const id = nextId(s, 'WD');
    const w = {
      id,
      driverId: driver.id,
      cityId: driver.cityId,
      amount: input.amount,
      providerId: provider.id,
      destinationLabel: `${account.bankName} ••${account.last4}`,
      status: 'pending' as const,
      providerRef: `demo_wd_${id}`,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    s.withdrawals.push(w);
    const fails = account.last4 === '0000';
    const delay = fails ? ctx.config.providerDelaySeconds.withdrawalFail : ctx.config.providerDelaySeconds.withdrawalConfirm;
    queueProviderJob(s, {
      kind: 'withdrawal',
      ref: w.providerRef,
      outcome: fails ? 'failed' : 'confirmed',
      reason: fails ? 'Compte bénéficiaire refusé par la banque (compte de test).' : null,
      dueAt: new Date(ctx.clock.now() + delay * 1000).toISOString(),
    });
    appendAudit(s, now, { actor: { type: 'user', id: driver.id, name: `${driver.firstName} ${driver.lastName}` }, action: 'withdrawal.requested', entityType: 'withdrawal', entityId: id, cityId: driver.cityId, summary: `Retrait ${formatMoney(input.amount)} demandé · ${formatMoney(input.amount)} réservés` });
    return w;
  });
}

/* ───────────── Earnings ───────────── */

export function earningsOf(s: State, driverId: string, from: string | null, to: string | null): EarningsSummary {
  const rides = s.rides
    .filter((r) => r.driverId === driverId && r.status === 'completed' && r.completedAt)
    .filter((r) => (!from || r.completedAt! >= from) && (!to || r.completedAt! < to))
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const rows = rides.map((r) => {
    const split = splitFare(r.terms.breakdown.total, r.terms.commissionBp);
    const payment = s.payments.find((p) => p.id === r.paymentId);
    return { rideId: r.id, completedAt: r.completedAt!, method: r.paymentMethod.kind, gross: split.gross, commission: split.commission, net: split.net, paymentStatus: payment?.status ?? 'pending' };
  });
  const total = (f: (x: (typeof rows)[number]) => Centimes) => rows.reduce((a, x) => a + f(x), 0);
  return {
    from,
    to,
    rideCount: rows.length,
    gross: total((x) => x.gross),
    commission: total((x) => x.commission),
    net: total((x) => x.net),
    cashCollected: total((x) => (x.method === 'cash' ? x.gross : 0)),
    walletCredited: total((x) => (x.method === 'card' && x.paymentStatus === 'confirmed' ? x.net : 0)),
    pendingElectronic: total((x) => (x.method === 'card' && x.paymentStatus === 'pending' ? x.net : 0)),
    rides: rows,
  };
}

/* ───────────── Exceptional corrections ───────────── */

export function createCorrection(ctx: Ctx, admin: AdminUser, input: CorrectionInput, idempotencyKey: string) {
  requirePermission(admin, 'finance.correct');
  return ctx.store.tx((s) => {
    const driver = mustFind(s.users, (u) => u.id === input.driverId && u.role === 'driver', 'chauffeuse');
    const now = ctx.clock.iso();
    const before = walletOf(s, driver.id, now).balance;
    const correctionId = nextId(s, 'CO');
    const { entry, duplicate } = postLedger(s, now, {
      driverId: driver.id,
      type: 'correction',
      amount: input.amount,
      description: `Correction exceptionnelle · ${input.reason}`,
      correctionId,
      idempotencyKey: `correction:${idempotencyKey}`,
    });
    if (duplicate) return entry;
    appendAudit(s, now, {
      actor: { type: 'admin', id: admin.id, name: admin.name },
      action: 'finance.correction',
      entityType: 'ledger_entry',
      entityId: entry.id,
      cityId: driver.cityId,
      reason: input.reason,
      summary: `Correction ${formatMoney(input.amount, { sign: 'always' })} sur le portefeuille de ${driver.firstName} ${driver.lastName}`,
      before: { balance: before },
      after: { balance: entry.balanceAfter },
    });
    return entry;
  });
}

export { SYSTEM };
