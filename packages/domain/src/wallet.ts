import type { LedgerEntry, Recharge, Wallet, Withdrawal } from './entities';
import { DomainError } from './errors';
import { sum, type Centimes } from './money';
import type { Split } from './pricing';

export interface WalletInputs {
  driverId: string;
  cityId: string;
  entries: readonly Pick<LedgerEntry, 'amount'>[];
  withdrawals: readonly Pick<Withdrawal, 'amount' | 'status'>[];
  recharges: readonly Pick<Recharge, 'amount' | 'status'>[];
  debtLimit: Centimes;
  at: string;
}

/**
 * The wallet is a pure projection:
 * - balance: sum of posted ledger entries (only confirmed events post)
 * - reserved: sum of pending withdrawals (a hold, not a movement)
 * - available: what can be withdrawn now
 * Releasing a reservation therefore never needs a compensating credit.
 */
export function projectWallet(input: WalletInputs): Wallet {
  const balance = sum(input.entries.map((e) => e.amount));
  const reserved = sum(input.withdrawals.filter((w) => w.status === 'pending').map((w) => w.amount));
  const pendingRecharges = sum(input.recharges.filter((r) => r.status === 'pending').map((r) => r.amount));
  return {
    driverId: input.driverId,
    cityId: input.cityId,
    currency: 'MAD',
    balance,
    reserved,
    available: Math.max(0, balance - reserved),
    debt: Math.max(0, -balance),
    debtLimit: input.debtLimit,
    offersBlockedByDebt: isBlockedByDebt(balance, input.debtLimit),
    pendingRecharges,
    updatedAt: input.at,
  };
}

/** Reaching the threshold blocks new offers: −150 with a 150 limit blocks, −149,99 does not. */
export const isBlockedByDebt = (balance: Centimes, debtLimit: Centimes) => balance <= -debtLimit;

export interface LedgerDraft {
  type: LedgerEntry['type'];
  amount: Centimes;
  description: string;
}

/**
 * Ledger effect of a completed ride once its payment is settled.
 * Cash: the driver keeps the fare physically; only the commission is debited.
 * Electronic: the platform received the fare; the driver is credited the net.
 */
export function rideSettlement(method: 'cash' | 'card', split: Split, rideId: string): LedgerDraft {
  if (method === 'cash') {
    return { type: 'ride_commission', amount: -split.commission, description: `Commission course ${rideId} (espèces)` };
  }
  return { type: 'ride_net_credit', amount: split.net, description: `Revenu net course ${rideId} (carte)` };
}

export function assertWithdrawable(amount: Centimes, wallet: Pick<Wallet, 'available'>, minimum: Centimes, hasPending: boolean) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new DomainError('VALIDATION', 'Montant invalide.');
  if (hasPending) throw new DomainError('PENDING_OPERATION', 'Un retrait est déjà en cours de traitement.');
  if (amount < minimum) throw new DomainError('AMOUNT_TOO_SMALL');
  if (amount > wallet.available) throw new DomainError('INSUFFICIENT_AVAILABLE');
}

export function assertRechargeAmount(amount: Centimes) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new DomainError('VALIDATION', 'Montant invalide.');
  if (amount < 1000) throw new DomainError('AMOUNT_TOO_SMALL', 'La recharge minimale est de 10 MAD.');
  if (amount > 500_000) throw new DomainError('VALIDATION', 'La recharge maximale est de 5 000 MAD.');
}
