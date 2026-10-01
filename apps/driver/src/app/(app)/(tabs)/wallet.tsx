import { View } from 'react-native';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock, ListOrdered } from 'lucide-react-native';
import { formatMoney, formatShort, TRANSFER_STATUS_LABELS } from '@naya/domain';
import { colors } from '@naya/tokens';
import { ErrorState, Header, IconDisc, ListGroup, ListRow, Screen, Skeleton, StatusBanner, Text } from '@naya/ui';
import { useWallet } from '@/lib/queries';
import { WalletCard } from '@/components/WalletCard';
import { ActionNote, ActionPill } from '@/components/Kit';
import { TAB_BAR_SPACE } from '@/components/TabBar';

/** D12 · D12-negative · D12-zero · D12-near · D12-after · D12-recharged */
export default function WalletTab() {
  const q = useWallet();
  const w = q.data?.wallet;
  const near = w && w.balance < 0 && !w.offersBlockedByDebt && -w.balance >= w.debtLimit * 0.8;
  return (
    <Screen header={<Header title="Portefeuille" />} contentStyle={{ paddingBottom: TAB_BAR_SPACE + 24 }} testID="wallet-screen">
      <View style={{ gap: 14, marginTop: 4 }}>
        {q.isLoading ? <Skeleton height={190} radius={24} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {w ? (
          <>
            <WalletCard wallet={w} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ActionPill label="Retirer" variant="primary" disabled={w.available <= 0} accessibilityHint={w.available <= 0 ? 'Aucun montant disponible au retrait pour le moment.' : undefined} icon={(c) => <ArrowUpRight size={20} color={c} />} onPress={() => router.push('/withdraw')} testID="open-withdraw" />
              <ActionPill label="Recharger" icon={(c) => <ArrowDownLeft size={20} color={c} />} onPress={() => router.push('/recharge')} testID="open-recharge" />
              <ActionPill label="Mouvements" icon={(c) => <ListOrdered size={20} color={c} />} onPress={() => router.push('/ledger')} testID="open-ledger" />
            </View>
            {w.available <= 0 && !w.offersBlockedByDebt ? <Text variant="micro" tone="muted" align="center">Aucun montant disponible au retrait pour le moment.</Text> : null}
            {w.offersBlockedByDebt ? <ActionNote tone="danger" title="Plafond de dette atteint" message={`Une recharge confirmée qui ramène le solde au-dessus de ${formatMoney(-w.debtLimit)} rétablit l’accès aux courses.`} testID="wallet-blocked" /> : null}
            {near ? <StatusBanner compact tone="warning" title="Proche du plafond" message={`au-delà de ${formatMoney(-w.debtLimit)}, les courses sont suspendues`} testID="wallet-near" /> : null}
            {w.balance === 0 && w.reserved === 0 ? <StatusBanner compact tone="neutral" title="Solde à zéro" message="les revenus carte confirmés s’ajoutent ici" testID="wallet-zero" /> : null}
            {(q.data?.pendingWithdrawals.length || q.data?.pendingRecharges.length) ? (
              <ListGroup label="En cours">
                {q.data!.pendingWithdrawals.map((x) => (
                  <ListRow key={x.id} title={`Retrait ${formatMoney(x.amount)}`} subtitle={`${TRANSFER_STATUS_LABELS[x.status]} · réservé · ${formatShort(x.createdAt)}`} leading={<IconDisc size={36}><Clock size={17} color={colors.accent} /></IconDisc>} onPress={() => router.push({ pathname: '/withdraw/[id]', params: { id: x.id } })} testID={`pending-${x.id}`} />
                ))}
                {q.data!.pendingRecharges.map((x) => (
                  <ListRow key={x.id} title={`Recharge ${formatMoney(x.amount)}`} subtitle={`En attente du prestataire · ${formatShort(x.createdAt)}`} leading={<IconDisc size={36}><Clock size={17} color={colors.accent} /></IconDisc>} onPress={() => router.push({ pathname: '/recharge/[id]', params: { id: x.id } })} testID={`pending-${x.id}`} />
                ))}
              </ListGroup>
            ) : null}
            <StatusBanner compact tone="neutral" icon={<Banknote size={14} color={colors.accent} />} title="Les espèces encaissées restent chez vous" />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
