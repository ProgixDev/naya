import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Info } from 'lucide-react-native';
import { formatMoney, type Centimes, type Wallet } from '@naya/domain';
import { colors, radius } from '@naya/tokens';
import { Divider, Money, PressableScale, Sheet, Text } from '@naya/ui';

type Figure = 'available' | 'reserved' | 'debt' | 'pending';

const DEFS: Record<Figure, { title: string; body: string }> = {
  available: { title: 'Disponible au retrait', body: 'Solde comptable moins les retraits en cours de traitement. C’est le montant que vous pouvez retirer maintenant.' },
  reserved: { title: 'Réservé', body: 'Montant bloqué par un retrait en cours. Il reste dans votre solde jusqu’à la confirmation de la banque, et redevient disponible si le virement échoue.' },
  debt: { title: 'Dette de commission', body: 'Commissions dues sur vos courses en espèces, non encore compensées par des courses carte ou une recharge. Au plafond, les nouvelles courses sont suspendues.' },
  pending: { title: 'Recharge en attente', body: 'Recharge demandée mais pas encore confirmée par le prestataire. Elle ne compte pas dans votre solde tant qu’elle n’est pas confirmée.' },
};

/**
 * D12: the accounting balance is the only hero. Each secondary figure opens a one-sentence
 * definition, so the four money concepts stay distinct without paragraphs on the card.
 */
export function WalletCard({ wallet }: { wallet: Wallet }) {
  const [open, setOpen] = useState<Figure | null>(null);
  const amountFor = (f: Figure): Centimes => (f === 'available' ? wallet.available : f === 'reserved' ? wallet.reserved : f === 'debt' ? wallet.debt : wallet.pendingRecharges);
  const figures: Figure[] = ['available', 'reserved', 'debt', ...(wallet.pendingRecharges > 0 ? (['pending'] as const) : [])];
  return (
    <View style={styles.card} testID="wallet-card">
      <LinearGradient colors={['#7A3F64', colors.accent, colors.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.card + 4 }]} />
      <Text variant="caption" tone="inverse" style={{ opacity: 0.86 }}>
        Solde comptable
      </Text>
      <View testID="wallet-balance">
        <Money amount={wallet.balance} variant="display" tone="inverse" />
      </View>
      <View style={styles.grid}>
        {figures.map((f) => (
          <PressableScale key={f} pressedScale={0.98} onPress={() => setOpen(f)} accessibilityRole="button" accessibilityLabel={`${DEFS[f].title} ${formatMoney(amountFor(f))}. Afficher la définition`} style={styles.figure} testID={`wallet-${f}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="micro" tone="inverse" style={{ opacity: 0.82 }}>
                {DEFS[f].title}
              </Text>
              <Info size={12} color={colors.inverse} style={{ opacity: 0.8 }} />
            </View>
            <Text variant="label" tone="inverse" weight="semibold" numeric>
              {formatMoney(amountFor(f))}
              {f === 'debt' ? <Text variant="caption" tone="inverse" style={{ opacity: 0.75 }}>{` / ${formatMoney(wallet.debtLimit)}`}</Text> : null}
            </Text>
          </PressableScale>
        ))}
      </View>
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? DEFS[open].title : ''}>
        {open ? (
          <View style={{ gap: 14, paddingBottom: 8 }}>
            <Text variant="label" tone="muted">
              {DEFS[open].body}
            </Text>
            <Divider />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label" weight="semibold">
                Total
              </Text>
              <Money amount={amountFor(open)} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card + 4, padding: 20, overflow: 'hidden', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  figure: { width: '50%', paddingRight: 8, paddingVertical: 8, gap: 2, minHeight: 44 },
});
