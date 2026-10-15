import { describe, expect, it } from 'vitest';
import { paymentMethodPresentation, paymentReceiptState, walletAvailable, walletCovers, type PaymentMethodKind } from '../src';

const KINDS: PaymentMethodKind[] = ['cash', 'card', 'wallet', 'mobile_wallet'];

describe('paymentMethodPresentation (P14)', () => {
  it('names each method as the passagère reads it', () => {
    expect(paymentMethodPresentation('cash').label).toBe('Espèces');
    expect(paymentMethodPresentation({ kind: 'card', label: 'Carte •••• 4242', last4: '4242' }).label).toBe('Carte •••• 4242');
    expect(paymentMethodPresentation('wallet').label).toBe('Portefeuille Naya');
    expect(paymentMethodPresentation({ kind: 'mobile_wallet', label: 'Wallet marocain' }).label).toBe('Paiement mobile');
  });

  it('reads card digits from a ride reference, which has a label but no last4', () => {
    expect(paymentMethodPresentation({ kind: 'card', label: 'Carte •••• 0002' }).label).toBe('Carte •••• 0002');
    expect(paymentMethodPresentation({ kind: 'card', label: 'Visa •••• 4242', last4: null }).label).toBe('Carte •••• 4242');
    expect(paymentMethodPresentation('card').label).toBe('Carte');
  });

  it('gives each kind its own icon, and never shows a wallet as cash or card', () => {
    const icons = KINDS.map((k) => paymentMethodPresentation(k).icon);
    expect(new Set(icons).size).toBe(4);
    for (const k of ['wallet', 'mobile_wallet'] as const) {
      const p = paymentMethodPresentation(k);
      expect(p.icon).not.toMatch(/banknote|credit-card/);
      expect(p.label).not.toMatch(/Carte|Espèces/);
    }
  });

  it('states timing as the server moves the money', () => {
    const wallet = paymentMethodPresentation('wallet');
    expect(wallet.heldAtBooking).toBe(true);
    expect(wallet.usesBalance).toBe(true);
    expect(wallet.timing).toMatch(/dès la réservation/);
    expect(wallet.timing).not.toMatch(/^Débitée? à l’arrivée$/);
    for (const k of ['cash', 'card', 'mobile_wallet'] as const) {
      expect(paymentMethodPresentation(k).heldAtBooking).toBe(false);
      expect(paymentMethodPresentation(k).usesBalance).toBe(false);
    }
    expect(paymentMethodPresentation('cash').timing).toMatch(/chauffeuse/);
    expect(paymentMethodPresentation('card').timing).toMatch(/carte à l’arrivée/);
    expect(paymentMethodPresentation('mobile_wallet').timing).toMatch(/paiement mobile à l’arrivée/);
  });

  it('describes the cancellation fee per method, with no « prochaine course » promise (PAX-16)', () => {
    expect(paymentMethodPresentation({ kind: 'card', label: 'Carte •••• 4242' }).cancellationFee).toContain('•••• 4242');
    expect(paymentMethodPresentation('wallet').cancellationFee).toMatch(/solde Naya/);
    expect(paymentMethodPresentation('mobile_wallet').cancellationFee).toMatch(/paiement mobile/);
    for (const k of KINDS) expect(paymentMethodPresentation(k).cancellationFee).not.toMatch(/prochaine course/);
  });

  it('uses typographic apostrophes and no demo wording', () => {
    for (const k of KINDS) {
      const text = JSON.stringify(paymentMethodPresentation(k));
      expect(text).not.toContain("'");
      expect(text).not.toMatch(/démo|demo|simul/i);
    }
  });
});

describe('wallet balance', () => {
  it('matches the server hold rule: balance minus holds must cover the amount', () => {
    expect(walletAvailable({ balance: 20000, reserved: 5000 })).toBe(15000);
    expect(walletCovers({ balance: 20000, reserved: 5000 }, 15000)).toBe(true);
    expect(walletCovers({ balance: 20000, reserved: 5000 }, 15001)).toBe(false);
    expect(walletCovers({ balance: 0, reserved: 0 }, 1)).toBe(false);
  });
});

describe('paymentReceiptState', () => {
  const ride = (status: 'pending' | 'confirmed' | 'failed' | 'cancelled', failureReason: string | null = null) => ({ purpose: 'ride' as const, status, amount: 10000, failureReason });
  const fee = (status: 'pending' | 'confirmed' | 'failed') => ({ purpose: 'cancellation_fee' as const, status, amount: 1500, failureReason: null });

  it('never calls a wallet or mobile payment « Carte »', () => {
    const w = paymentReceiptState({ kind: 'wallet', label: 'Portefeuille Naya' }, ride('confirmed'), false);
    expect(w).toMatchObject({ tone: 'success', title: 'Portefeuille Naya · paiement confirmé' });
    expect(w.message).toMatch(/solde Naya/);
    const m = paymentReceiptState({ kind: 'mobile_wallet', label: 'Wallet marocain' }, ride('confirmed'), false);
    expect(m.title).toBe('Paiement mobile confirmé');
    for (const s of [w, m]) expect(`${s.title} ${s.message}`).not.toMatch(/Carte|carte/);
  });

  it('keeps the card and cash wording the receipt has always used', () => {
    const card = paymentReceiptState({ kind: 'card', label: 'Carte •••• 4242' }, ride('confirmed'), false);
    expect(card.title).toBe('Carte · paiement confirmé');
    expect(card.message).toMatch(/100\sMAD/);
    expect(card.message).toContain('carte •••• 4242');
    expect(paymentReceiptState('cash', ride('pending'), false).title).toBe('Espèces · à remettre à la chauffeuse');
    expect(paymentReceiptState('cash', ride('confirmed'), false).title).toBe('Espèces · paiement confirmé');
    expect(paymentReceiptState('card', ride('pending'), false).tone).toBe('info');
  });

  it('offers another card only for a refused ride payment', () => {
    expect(paymentReceiptState('card', ride('failed', 'Carte refusée.'), false)).toEqual({ tone: 'danger', title: 'Paiement refusé', message: 'Carte refusée. Réglez avec une autre carte.' });
    const refusedFee = paymentReceiptState('card', fee('failed'), true);
    expect(refusedFee.title).toBe('Frais refusés');
    expect(refusedFee.message).not.toMatch(/autre carte/);
  });

  it('states fees as they are, without promising the next ride', () => {
    const cashFee = paymentReceiptState('cash', fee('pending'), true);
    expect(cashFee.title).toBe('Frais d’annulation à régler');
    expect(cashFee.message).toMatch(/15\sMAD/);
    expect(cashFee.message).not.toMatch(/prochaine course/);
    expect(paymentReceiptState('wallet', fee('confirmed'), true)).toMatchObject({ title: 'Frais d’annulation payés' });
    expect(paymentReceiptState('cash', undefined, true)).toMatchObject({ title: 'Aucun paiement' });
  });

  it('explains the wallet hold before arrival', () => {
    expect(paymentReceiptState('wallet', undefined, false).message).toMatch(/réservé sur votre solde/);
    expect(paymentReceiptState('card', undefined, false).message).toBe('Le paiement est créé à l’arrivée.');
  });
});
