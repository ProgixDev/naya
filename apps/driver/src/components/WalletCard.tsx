import { themedStyles, radius } from '@naya/tokens';
import { useTheme, Divider, Money, PressableScale, Sheet, Text, type NayaTextProps } from '@naya/ui';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatMoney, type Centimes, type Wallet } from '@naya/domain';

type Figure = 'available' | 'reserved' | 'debt' | 'pending';

const DEFS: Record<Figure, { title: string; short: string; body: string }> = {
  available: { title: 'Disponible au retrait', short: 'Disponible', body: 'Solde comptable moins les retraits en cours de traitement. C’est le montant que vous pouvez retirer maintenant.' },
  reserved: { title: 'Réservé', short: 'Réservé', body: 'Montant bloqué par un retrait en cours. Il reste dans votre solde jusqu’à la confirmation de la banque, et redevient disponible si le virement échoue.' },
  debt: { title: 'Dette de commission', short: 'Dette', body: 'Commissions dues sur vos courses en espèces, non encore compensées par des courses payées hors espèces ou une recharge. Au plafond, les nouvelles courses sont suspendues.' },
  pending: { title: 'Recharge en attente', short: 'En attente', body: 'Recharge demandée mais pas encore confirmée par le prestataire. Elle ne compte pas dans votre solde tant qu’elle n’est pas confirmée.' },
};

/**
 * Fixed brand stops, the same plum in light and dark (like the passenger WalletSummary, DM-17): the
 * card is artwork, so its text is fixed white rather than the scheme's `inverse` (DOM-12).
 */
const WALLET_PLUM = ['#7A3F64', '#6B3657', '#4E2541'] as const;
const ON_PLUM = '#FFFFFF';
const ON_PLUM_MUTED = 'rgba(255,255,255,0.82)';
const PLUM_RING = 'rgba(255,255,255,0.10)';
const PLUM_RULE = 'rgba(255,255,255,0.24)';

/**
 * A money figure that never wraps « MAD » onto its own line (D-02, principle 11): tabular figures,
 * one line, shrinking to 80 % before it would break. « MAD » is a smaller suffix joined by a
 * no-break space.
 */
export function FitMoney({ amount, variant = 'display', unitVariant = 'caption', sign, color, tone, testID }: { amount: Centimes; variant?: NayaTextProps['variant']; unitVariant?: NayaTextProps['variant']; sign?: 'auto' | 'always'; color?: string; tone?: NayaTextProps['tone']; testID?: string }) {
  useTheme();
  return (
    <Text
      variant={variant}
      tone={tone}
      weight="semibold"
      numeric
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={color ? { color } : undefined}
      accessibilityLabel={formatMoney(amount, { sign }).replace('−', 'moins ')}
      testID={testID}
    >
      {formatMoney(amount, { sign, currency: false })}
      <Text variant={unitVariant} tone={tone} weight="semibold" style={color ? { color } : undefined}>
        {' MAD'}
      </Text>
    </Text>
  );
}

/**
 * D12: the accounting balance is the only hero. The secondary figures sit under it; one « Comment
 * c'est calculé ? » link explains all four (D-21, A113) instead of an ⓘ beside each label.
 */
export function WalletCard({ wallet }: { wallet: Wallet }) {
  useTheme();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const amountFor = (f: Figure): Centimes => (f === 'available' ? wallet.available : f === 'reserved' ? wallet.reserved : f === 'debt' ? wallet.debt : wallet.pendingRecharges);
  const figures: Figure[] = ['available', 'reserved', 'debt', ...(wallet.pendingRecharges > 0 ? (['pending'] as const) : [])];
  return (
    <View style={styles.card} testID="wallet-card">
      <LinearGradient colors={WALLET_PLUM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.card + 4 }]} />
      <View pointerEvents="none" style={[styles.ring, { width: 220, height: 220, borderRadius: 110, right: -90, top: -75 }]} />
      <View pointerEvents="none" style={[styles.ring, { width: 160, height: 160, borderRadius: 80, right: -60, top: -45 }]} />
      <Text variant="caption" style={{ color: ON_PLUM_MUTED }}>
        Solde comptable
      </Text>
      <View testID="wallet-balance" style={{ marginTop: 10, marginBottom: 14 }}>
        <FitMoney amount={wallet.balance} color={ON_PLUM} unitVariant="heading" />
      </View>
      <View style={styles.grid}>
        {figures.map((f) => (
          <View
            key={f}
            accessible
            accessibilityLabel={`${DEFS[f].title} ${formatMoney(amountFor(f))}${f === 'debt' ? `, plafond ${formatMoney(wallet.debtLimit)}` : ''}`}
            style={[styles.figure, fontScale > 1.2 ? { flexBasis: '45%' } : null]}
            testID={`wallet-${f}`}
          >
            <Text variant="caption" style={{ color: ON_PLUM_MUTED }} numberOfLines={1}>
              {DEFS[f].short}
            </Text>
            <Text variant="label" weight="semibold" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: ON_PLUM }}>
              {formatMoney(amountFor(f))}
              {f === 'debt' ? <Text variant="caption" style={{ color: ON_PLUM_MUTED }}>{` / ${formatMoney(wallet.debtLimit, { currency: false })}`}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
      <PressableScale onPress={() => setOpen(true)} pressedScale={0.98} accessibilityRole="button" accessibilityLabel="Comment c’est calculé ?" style={styles.explain} testID="wallet-explain">
        <Text variant="caption" weight="semibold" style={{ color: ON_PLUM, textDecorationLine: 'underline' }}>
          Comment c’est calculé ?
        </Text>
      </PressableScale>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Comment c’est calculé ?" testID="wallet-explain-sheet">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Text variant="label" tone="muted">
            Le solde comptable est la somme de vos mouvements confirmés. Les autres montants en découlent.
          </Text>
          {figures.map((f, i) => (
            <View key={f} style={{ gap: 6 }}>
              {i > 0 ? <Divider style={{ marginBottom: 8 }} /> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text variant="label" weight="semibold" style={{ flex: 1 }}>
                  {DEFS[f].title}
                </Text>
                <Money amount={amountFor(f)} />
              </View>
              <Text variant="caption" tone="muted">
                {DEFS[f].body}
              </Text>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { borderRadius: radius.card + 4, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, overflow: 'hidden', gap: 2 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: PLUM_RING },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PLUM_RULE, paddingTop: 6 },
  figure: { flexGrow: 1, flexBasis: '30%', paddingHorizontal: 6, paddingVertical: 6, gap: 2, minHeight: 44 },
  explain: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 2 },
}));
