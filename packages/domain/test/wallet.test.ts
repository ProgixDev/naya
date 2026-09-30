import { describe, expect, it } from 'vitest';
import { assertWithdrawable, isBlockedByDebt, mad, projectWallet, rideSettlement, splitFare, type LedgerEntry, type Recharge, type Withdrawal } from '../src';

type E = Pick<LedgerEntry, 'amount'>;
const at = '2026-10-01T08:00:00.000Z';
const wallet = (entries: E[], withdrawals: Pick<Withdrawal, 'amount' | 'status'>[] = [], recharges: Pick<Recharge, 'amount' | 'status'>[] = [], debtLimit = mad(150)) =>
  projectWallet({ driverId: 'd', cityId: 'rabat', entries, withdrawals, recharges, debtLimit, at });

describe('financial invariants', () => {
  const split = splitFare(mad(100), 1500);
  const ny001 = rideSettlement('cash', split, 'NY-001');
  const ny002 = rideSettlement('card', split, 'NY-002');

  it('NY-001 cash 100: only the 15 commission is debited → −15; net earnings 85', () => {
    expect(ny001.amount).toBe(-mad(15));
    expect(wallet([ny001]).balance).toBe(-mad(15));
    expect(split.net).toBe(mad(85));
  });

  it('NY-002 card 100: credit net 85; −15 becomes 70', () => {
    expect(ny002.amount).toBe(mad(85));
    expect(wallet([ny001, ny002]).balance).toBe(mad(70));
  });

  it('gross 200, commission 30, net 170 = cash 100 + wallet 70', () => {
    const gross = split.gross * 2;
    const commission = split.commission * 2;
    const net = split.net * 2;
    const cashCollected = mad(100);
    const walletBalance = wallet([ny001, ny002]).balance;
    expect([gross, commission, net]).toEqual([mad(200), mad(30), mad(170)]);
    expect(cashCollected + walletBalance).toBe(net);
  });

  const base: E[] = [ny001, ny002];
  it('withdrawal 50 from 70: pending 70/50/20, confirmed 20/0/20, failed 70/0/70', () => {
    const pending = wallet(base, [{ amount: mad(50), status: 'pending' }]);
    expect([pending.balance, pending.reserved, pending.available]).toEqual([mad(70), mad(50), mad(20)]);
    const confirmed = wallet([...base, { amount: -mad(50) }], [{ amount: mad(50), status: 'confirmed' }]);
    expect([confirmed.balance, confirmed.reserved, confirmed.available]).toEqual([mad(20), 0, mad(20)]);
    const failed = wallet(base, [{ amount: mad(50), status: 'failed' }]);
    expect([failed.balance, failed.reserved, failed.available]).toEqual([mad(70), 0, mad(70)]);
  });

  it('releasing a reservation never adds a credit', () => {
    const failed = wallet(base, [{ amount: mad(50), status: 'failed' }]);
    expect(failed.balance).toBe(wallet(base).balance);
  });

  it('recharge 50 from 70: only a confirmed recharge moves the balance to 120', () => {
    expect(wallet(base, [], [{ amount: mad(50), status: 'pending' }]).balance).toBe(mad(70));
    expect(wallet(base, [], [{ amount: mad(50), status: 'failed' }]).balance).toBe(mad(70));
    expect(wallet([...base, { amount: mad(50) }], [], [{ amount: mad(50), status: 'confirmed' }]).balance).toBe(mad(120));
  });

  it('withdrawal 50 after that recharge: pending 120/50/70, success 70, failure 120', () => {
    const after = [...base, { amount: mad(50) }];
    const p = wallet(after, [{ amount: mad(50), status: 'pending' }]);
    expect([p.balance, p.reserved, p.available]).toEqual([mad(120), mad(50), mad(70)]);
    expect(wallet([...after, { amount: -mad(50) }], [{ amount: mad(50), status: 'confirmed' }]).balance).toBe(mad(70));
    expect(wallet(after, [{ amount: mad(50), status: 'failed' }]).balance).toBe(mad(120));
  });

  it('debt: −150 blocks in Rabat; confirmed recharge 50 → −100 restores; pending/failed stays −150', () => {
    const debt: E[] = [{ amount: -mad(150) }];
    expect(wallet(debt).offersBlockedByDebt).toBe(true);
    expect(wallet(debt, [], [{ amount: mad(50), status: 'pending' }]).balance).toBe(-mad(150));
    expect(wallet(debt, [], [{ amount: mad(50), status: 'pending' }]).offersBlockedByDebt).toBe(true);
    expect(wallet(debt, [], [{ amount: mad(50), status: 'failed' }]).offersBlockedByDebt).toBe(true);
    const restored = wallet([...debt, { amount: mad(50) }]);
    expect(restored.balance).toBe(-mad(100));
    expect(restored.offersBlockedByDebt).toBe(false);
  });

  it('−15 does not block; the threshold is inclusive', () => {
    expect(isBlockedByDebt(-mad(15), mad(150))).toBe(false);
    expect(isBlockedByDebt(-mad(149.99), mad(150))).toBe(false);
    expect(isBlockedByDebt(-mad(150), mad(150))).toBe(true);
    expect(isBlockedByDebt(-mad(150), mad(200))).toBe(false); // Casablanca limit
  });

  it('withdrawal guards: available, minimum, single pending', () => {
    expect(() => assertWithdrawable(mad(80), { available: mad(70) }, mad(20), false)).toThrow(/solde disponible/);
    expect(() => assertWithdrawable(mad(10), { available: mad(70) }, mad(20), false)).toThrow(/minimum/);
    expect(() => assertWithdrawable(mad(50), { available: mad(70) }, mad(20), true)).toThrow(/déjà en cours/);
    expect(() => assertWithdrawable(mad(50), { available: mad(70) }, mad(20), false)).not.toThrow();
  });

  it('a negative balance has nothing available', () => {
    expect(wallet([{ amount: -mad(15) }]).available).toBe(0);
    expect(wallet([{ amount: -mad(15) }]).debt).toBe(mad(15));
  });
});
