import { paymentMethodPresentation, type PaymentIconName, type PaymentMethodLike, type WashPaymentKind } from '@naya/domain';
import { Banknote, CreditCard, Smartphone, Wallet, type LucideIcon } from 'lucide-react-native';

/**
 * Payment-method glyphs (audit C19). `paymentMethodPresentation` (packages/domain/src/payments.ts)
 * names the icon; this is the one place that turns the name into a component. Replaces the
 * per-screen `PAY_ICONS` maps (quote, receipt, scheduled detail, payments).
 */
export const PAYMENT_ICONS: Record<PaymentIconName, LucideIcon> = {
  banknote: Banknote,
  'credit-card': CreditCard,
  wallet: Wallet,
  smartphone: Smartphone,
};

/** The component for a presentation's icon name. */
export const paymentIcon = (name: PaymentIconName): LucideIcon => PAYMENT_ICONS[name];

/** The component for a stored method, a ride's method reference or a bare kind. */
export const paymentMethodIcon = (method: PaymentMethodLike): LucideIcon => PAYMENT_ICONS[paymentMethodPresentation(method).icon];

/** Car-wash payments: the passenger kinds, plus the chauffeuse's Naya wallet. */
export const washPaymentIcon = (kind: WashPaymentKind): LucideIcon => (kind === 'driver_wallet' ? PAYMENT_ICONS.wallet : paymentMethodIcon(kind));
