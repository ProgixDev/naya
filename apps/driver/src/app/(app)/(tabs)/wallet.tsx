import { View } from 'react-native';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Clock, ListOrdered } from 'lucide-react-native';
import { formatMoney, formatShort, TRANSFER_STATUS_LABELS } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, ErrorState, Header, IconDisc, ListGroup, ListRow, Screen, Skeleton, StatusBanner, Text } from '@naya/ui';
import { useWallet } from '@/lib/queries';
import { WalletCard } from '@/components/WalletCard';
import { TAB_BAR_SPACE } from '@/components/TabBar';

/** D12 · D12-negative · D12-zero · D12-near · D12-after · D12-recharged */
export default function WalletTab() {
  const q = useWallet();
  const w = q.data?.wallet;
  const near = w && w.balance < 0 && !w.offersBlockedByDebt && -w.balance >= w.debtLimit * 0.8;
  return (
    <Screen header={<Header title="Mon portefeuille" />} contentStyle={{ paddingBottom: TAB_BAR_SPACE + 40 }} testID="wallet-screen">
      <View style={{ gap: 16, marginTop: 12 }}>
        {q.isLoading ? <Skeleton height={200} radius={24} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {w ? (
          <>
            <WalletCard wallet={w} />
            {w.offersBlockedByDebt ? <StatusBanner tone="danger" title="Plafond de dette atteint" message={`Une recharge confirmée qui ramène votre solde au-dessus de ${formatMoney(-w.debtLimit)} rétablit l’accès aux courses.`} testID="wallet-blocked" /> : null}
            {near ? <StatusBanner tone="warning" title="Proche du plafond" message={`Au-delà de ${formatMoney(-w.debtLimit)}, les nouvelles courses seront suspendues.`} testID="wallet-near" /> : null}
            {w.balance === 0 && w.reserved === 0 ? <StatusBanner tone="neutral" title="Solde à zéro" message="Vos revenus nets de courses carte s’ajouteront ici après confirmation des paiements." testID="wallet-zero" /> : null}
            {(q.data?.pendingWithdrawals.length || q.data?.pendingRecharges.length) ? (
              <ListGroup label="Opérations en cours">
                {q.data!.pendingWithdrawals.map((x) => (
                  <ListRow key={x.id} title={`Retrait ${formatMoney(x.amount)}`} subtitle={`${TRANSFER_STATUS_LABELS[x.status]} · ${formatMoney(x.amount)} réservés · ${formatShort(x.createdAt)}`} leading={<IconDisc><Clock size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push({ pathname: '/withdraw/[id]', params: { id: x.id } })} testID={`pending-${x.id}`} />
                ))}
                {q.data!.pendingRecharges.map((x) => (
                  <ListRow key={x.id} title={`Recharge ${formatMoney(x.amount)}`} subtitle={`En attente du prestataire · ${formatShort(x.createdAt)}`} leading={<IconDisc><Clock size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push({ pathname: '/recharge/[id]', params: { id: x.id } })} testID={`pending-${x.id}`} />
                ))}
              </ListGroup>
            ) : null}
            <ListGroup>
              <ListRow title="Mouvements" subtitle="Crédits, débits et commissions" leading={<IconDisc><ListOrdered size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/ledger')} testID="open-ledger" />
              <ListRow title="Recharger" subtitle="Régler une dette de commission" leading={<IconDisc><ArrowDownLeft size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/recharge')} testID="open-recharge" />
            </ListGroup>
            <Button label="Retirer" size="major" full disabled={w.available <= 0} disabledReason={w.available <= 0 ? 'Aucun montant disponible au retrait pour le moment.' : undefined} icon={<ArrowUpRight size={18} color={w.available > 0 ? colors.inverse : colors.disabledText} />} onPress={() => router.push('/withdraw')} testID="open-withdraw" />
            <Text variant="caption" tone="muted">
              Le solde comprend les commissions et les opérations confirmées. Les espèces encaissées restent chez vous et n’y figurent pas.
            </Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
