import { useTheme , ErrorState, Header, IconDisc, ListGroup, ListRow, PressableScale, Screen, Skeleton, SkeletonList, StatusBanner, Text, TransactionRow } from '@naya/ui';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Clock, ListOrdered } from 'lucide-react-native';
import { formatMoney, formatShort, TRANSFER_STATUS_LABELS } from '@naya/domain';
import { colors, shadow } from '@naya/tokens';
import { useAccountId, useWallet } from '@/lib/queries';
import { WalletCard } from '@/components/WalletCard';
import { ActionNote, ActionPill } from '@/components/Kit';
import { TAB_BAR_SPACE } from '@/components/TabBar';

/** D12 · D12-negative · D12-zero · D12-near · D12-after · D12-recharged */
export default function WalletTab() {
  useTheme();
  const q = useWallet();
  const api = useApi();
  const a = useAccountId();
  // Last few confirmed movements; the full list with filters is on Mouvements.
  const recent = useQuery({ queryKey: [...qk.ledger(a, undefined), 'recent'], queryFn: () => api.driver.ledger(undefined, 0, 5) });
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

            <View style={{ gap: 10, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                <Text weight="semibold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.3 }}>Mouvements récents</Text>
                {recent.data?.items.length ? (
                  <PressableScale onPress={() => router.push('/ledger')} hitSlop={10} accessibilityRole="button" testID="wallet-see-all">
                    <Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>Voir tout</Text>
                  </PressableScale>
                ) : null}
              </View>
              {recent.isLoading ? <SkeletonList rows={3} /> : null}
              {recent.isError ? <ErrorState onRetry={() => recent.refetch()} /> : null}
              {recent.data && !recent.data.items.length ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 22, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 6, ...shadow.card }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}><ListOrdered size={24} color={colors.accent} /></View>
                  <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Aucun mouvement</Text>
                  <Text tone="muted" align="center" style={{ fontSize: 13, lineHeight: 18 }}>Vos courses, recharges et retraits confirmés apparaîtront ici.</Text>
                </View>
              ) : null}
              {recent.data?.items.length ? (
                <View style={{ gap: 10 }}>
                  {recent.data.items.map((e) => (
                    <View key={e.id} style={{ backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                      <TransactionRow entry={e} onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: e.id } })} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
