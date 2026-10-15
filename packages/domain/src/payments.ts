import type { Payment, PaymentMethodKind } from './entities';
import { formatMoney, type Centimes } from './money';

/**
 * How a payment method is shown to the passagère: one source for the quote, the payment sheet,
 * the payments screen, the cancel sheet and the receipt (P14, spec payments-and-fees R12).
 *
 * The timing copy follows the server rules (services/demo-api/src/services/rides.ts, prototype.ts):
 * - cash: the payment is created at arrival and handed to the chauffeuse (`settleRide`);
 * - card: the payment is created at arrival and confirmed by the provider (`queueCardOutcome`);
 * - wallet: the frozen total is held on the balance at booking or scheduling (`reservePassengerWallet`)
 *   and debited at arrival (`settlePassengerWallet`); a cancellation releases the hold and debits the fee;
 * - mobile_wallet: nothing is held; the payment is created and confirmed at arrival, and a fee is
 *   confirmed at once (`chargeFee`).
 */

/** Icon names follow lucide (`banknote` → Banknote …); each app maps them to its icon set. */
export type PaymentIconName = 'banknote' | 'credit-card' | 'wallet' | 'smartphone';

/** The tones the UI banners understand. */
export type PaymentTone = 'info' | 'success' | 'warning' | 'danger';

/** A stored method, a ride's method reference, or just a kind. */
export type PaymentMethodLike = PaymentMethodKind | { kind: PaymentMethodKind; label?: string | null; last4?: string | null };

export interface PaymentMethodPresentation {
  kind: PaymentMethodKind;
  icon: PaymentIconName;
  /** « Espèces », « Carte •••• 4242 », « Portefeuille Naya », « Paiement mobile ». */
  label: string;
  /** The label without card digits: « Carte » for a card. */
  shortLabel: string;
  /** When the money moves, one short line: « Débité sur votre carte à l’arrivée ». */
  timing: string;
  /** True when booking holds the fare on the passenger wallet (the wallet only). */
  heldAtBooking: boolean;
  /** True when the fare is paid from the Naya balance, so the balance must cover it. */
  usesBalance: boolean;
  /** Where a cancellation fee goes, one sentence for the cancel sheet. */
  cancellationFee: string;
}

const LAST4 = /(\d{4})\s*$/;

function cardDigits(m: Exclude<PaymentMethodLike, PaymentMethodKind>): string | null {
  if (m.last4) return m.last4;
  return m.label?.match(LAST4)?.[1] ?? null;
}

export function paymentMethodPresentation(method: PaymentMethodLike): PaymentMethodPresentation {
  const m = typeof method === 'string' ? { kind: method } : method;
  switch (m.kind) {
    case 'card': {
      const last4 = cardDigits(m);
      const label = last4 ? `Carte •••• ${last4}` : 'Carte';
      return {
        kind: 'card',
        icon: 'credit-card',
        label,
        shortLabel: 'Carte',
        timing: 'Débité sur votre carte à l’arrivée',
        heldAtBooking: false,
        usesBalance: false,
        cancellationFee: last4 ? `Les frais éventuels sont débités sur votre carte •••• ${last4}.` : 'Les frais éventuels sont débités sur votre carte.',
      };
    }
    case 'wallet':
      return {
        kind: 'wallet',
        icon: 'wallet',
        label: 'Portefeuille Naya',
        shortLabel: 'Portefeuille Naya',
        timing: 'Réservé sur votre solde dès la réservation, débité à l’arrivée',
        heldAtBooking: true,
        usesBalance: true,
        cancellationFee: 'Le montant réservé est libéré ; les frais éventuels sont débités de votre solde Naya.',
      };
    case 'mobile_wallet':
      return {
        kind: 'mobile_wallet',
        icon: 'smartphone',
        label: 'Paiement mobile',
        shortLabel: 'Paiement mobile',
        timing: 'Réglé par paiement mobile à l’arrivée',
        heldAtBooking: false,
        usesBalance: false,
        cancellationFee: 'Les frais éventuels sont réglés aussitôt par paiement mobile.',
      };
    case 'cash':
    default:
      return {
        kind: 'cash',
        icon: 'banknote',
        label: 'Espèces',
        shortLabel: 'Espèces',
        timing: 'À régler à la chauffeuse en fin de trajet',
        heldAtBooking: false,
        usesBalance: false,
        // ADR-0041 (D7) is open: nothing collects a cash fee yet, so no promise about when.
        cancellationFee: 'Les frais éventuels restent dus et figurent sur votre reçu.',
      };
  }
}

/** What the passenger wallet can still pay: confirmed balance minus the holds of other bookings. */
export const walletAvailable = (w: { balance: Centimes; reserved: Centimes }): Centimes => w.balance - w.reserved;

/** Same test as the server's `reservePassengerWallet`: the hold is refused when this is false. */
export const walletCovers = (w: { balance: Centimes; reserved: Centimes }, amount: Centimes): boolean => walletAvailable(w) >= amount;

export interface PaymentReceiptState {
  tone: PaymentTone;
  title: string;
  message: string;
}

/** What was debited, in one clause, for a confirmed payment. */
function settledText(p: PaymentMethodPresentation, amount: string) {
  switch (p.kind) {
    case 'cash':
      return `${amount} remis à la chauffeuse.`;
    case 'card':
      return p.label === 'Carte' ? `${amount} débités sur votre carte.` : `${amount} débités sur la ${p.label.replace(/^Carte/, 'carte')}.`;
    case 'wallet':
      return `${amount} débités de votre solde Naya.`;
    case 'mobile_wallet':
      return `${amount} réglés par paiement mobile.`;
  }
}

/**
 * The receipt's payment banner. `payment` is the ride payment, or the cancellation fee on a
 * cancelled ride; `undefined` when none exists yet (or none was due).
 */
export function paymentReceiptState(
  method: PaymentMethodLike,
  payment: Pick<Payment, 'purpose' | 'status' | 'amount' | 'failureReason'> | undefined,
  rideCancelled: boolean,
): PaymentReceiptState {
  const p = paymentMethodPresentation(method);
  if (!payment) {
    if (rideCancelled) return { tone: 'success', title: 'Aucun paiement', message: 'Course annulée sans frais.' };
    return {
      tone: 'info',
      title: 'Paiement en préparation',
      message: p.heldAtBooking ? 'Le montant reste réservé sur votre solde jusqu’à l’arrivée.' : 'Le paiement est créé à l’arrivée.',
    };
  }
  const fee = payment.purpose === 'cancellation_fee';
  const amount = formatMoney(payment.amount);
  switch (payment.status) {
    case 'confirmed':
      return {
        tone: 'success',
        title: fee ? 'Frais d’annulation payés' : p.kind === 'mobile_wallet' ? 'Paiement mobile confirmé' : `${p.shortLabel} · paiement confirmé`,
        message: settledText(p, amount),
      };
    case 'pending':
      if (p.kind === 'cash') {
        return fee
          ? { tone: 'info', title: 'Frais d’annulation à régler', message: `${amount} restent dus pour cette annulation.` }
          : { tone: 'info', title: 'Espèces · à remettre à la chauffeuse', message: `${amount} à régler en fin de trajet.` };
      }
      return {
        tone: 'warning',
        title: fee ? 'Frais en attente de confirmation' : 'Paiement en attente de confirmation',
        message: `${p.kind === 'card' ? 'Votre banque' : 'Le prestataire'} n’a pas encore confirmé le débit. Rien n’est débité deux fois ; cette page se met à jour.`,
      };
    case 'failed': {
      const reason = payment.failureReason ?? (p.kind === 'card' ? 'La banque a refusé le paiement.' : 'Le paiement n’a pas abouti.');
      // Only a refused ride payment can be paid again, and only by card (rides.ts retryPayment, API-24).
      const next = !fee ? ' Réglez avec une autre carte.' : ' Contactez-nous depuis « Aide sur cette course ».';
      return { tone: 'danger', title: fee ? 'Frais refusés' : 'Paiement refusé', message: `${reason}${next}` };
    }
    case 'cancelled':
    default:
      return { tone: 'info', title: 'Paiement annulé', message: 'Aucun montant n’a été débité.' };
  }
}
