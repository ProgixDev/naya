import { View } from 'react-native';
import { Banknote, CreditCard, Landmark, Smartphone, Store, Wallet } from 'lucide-react-native';
import { formatMoney, formatShort, type PaymentInstructions as Instructions, type ProviderFlow, type ProviderKind, type ProviderOption } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Text } from '../Text';
import { Card, IconDisc } from '../List';
import { StatusBanner } from '../Feedback';

const ICONS: Record<ProviderKind, typeof CreditCard> = {
  card: CreditCard,
  mobile_wallet: Wallet,
  mobile_payment: Smartphone,
  cash_network: Store,
  cash: Banknote,
  bank_transfer: Landmark,
};

export function ProviderIcon({ kind, size = 36 }: { kind: ProviderKind; size?: number }) {
  useTheme();
  const Icon = ICONS[kind] ?? CreditCard;
  return (
    <IconDisc size={size}>
      <Icon size={Math.round(size * 0.47)} color={colors.accent} />
    </IconDisc>
  );
}

const FLOW_HINT: Record<ProviderFlow, string> = {
  hosted_page: 'Page sécurisée du prestataire',
  wallet_approval: 'Validation dans votre application wallet',
  voucher: 'Espèces en agence avec un code',
  bank_transfer: 'Virement bancaire',
  cash: 'Espèces',
};

/** One line under a provider name: how it works and its limits. */
export function providerSubtitle(p: ProviderOption) {
  const hint = p.kind === 'mobile_payment' ? 'Confirmation par SMS sur votre téléphone' : FLOW_HINT[p.flow];
  const limits = [p.minAmount ? `dès ${formatMoney(p.minAmount)}` : null, p.maxAmount ? `jusqu’à ${formatMoney(p.maxAmount)}` : null].filter(Boolean).join(' · ');
  return limits ? `${hint} · ${limits}` : hint;
}

/** What the payer must do to finish a pending operation, whatever the provider. */
export function PaymentInstructionsCard({ op, testID }: { op: Instructions & { status: string }; testID?: string }) {
  useTheme();
  if (op.status !== 'pending') return null;
  if (op.flow === 'voucher' && op.voucherCode) {
    return (
      <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 18 }} testID={testID}>
        <Text variant="caption" tone="muted">Code à présenter au guichet</Text>
        <Text variant="display" numeric selectable testID="voucher-code" style={{ letterSpacing: 2 }}>
          {op.voucherCode}
        </Text>
        {op.expiresAt ? <Text variant="caption" tone="accent">Valable jusqu’au {formatShort(op.expiresAt)}</Text> : null}
        {op.instructions ? <Text variant="caption" tone="muted" align="center">{op.instructions}</Text> : null}
      </Card>
    );
  }
  return (
    <View testID={testID}>
      <StatusBanner
        compact
        tone="info"
        title={op.flow === 'wallet_approval' ? `Demande envoyée au ${op.payerPhone ?? 'numéro indiqué'}` : 'Finalisez sur la page du prestataire'}
        message={op.instructions ?? 'le solde ne change pas avant confirmation'}
      />
    </View>
  );
}

/** Label of the demo button that stands in for the provider for each flow. */
export const sandboxLabel = (flow: ProviderFlow | undefined) =>
  flow === 'voucher' ? 'Simuler le paiement en agence' : flow === 'wallet_approval' ? 'Ouvrir l’application wallet (simulation)' : 'Ouvrir la page du prestataire';
