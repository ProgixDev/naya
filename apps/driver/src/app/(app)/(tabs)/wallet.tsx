import { useTheme, ErrorState, Header, Icon, ListGroup, ListRow, Screen, Section, Skeleton, StatusBanner, Text, TextButton, TransactionRow } from '@naya/ui';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Landmark, Plus } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort } from '@naya/domain';
import { colors, shadow } from '@naya/tokens';
import { useAccountId, useWallet } from '@/lib/queries';
import { WalletCard } from '@/components/WalletCard';
import { ActionNote, ActionPill } from '@/components/Kit';

/** D12 · D12-negative · D12-zero · D12-near · D12-after · D12-recharged */
export default function WalletTab() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const q = useWallet();
  const w = q.data?.wallet;
  // D-20: the last three movements. Same query (key, page size) as the Mouvements screen, so the two share one cache.
  const recent = useInfiniteQuery({
    queryKey: qk.ledger(a, undefined),
    queryFn: ({ pageParam }) => api.driver.ledger(undefined, pageParam, 20),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  // The wallet polls; a new confirmed movement changes it, so the recent list follows.
  const updatedAt = w?.updatedAt;
  const refetchRecent = recent.refetch;
  const seen = useRef(updatedAt);
  useEffect(() => {
    if (updatedAt && seen.current && updatedAt !== seen.current) refetchRecent();
    seen.current = updatedAt;
  }, [updatedAt, refetchRecent]);
  const latest = recent.data?.pages[0]?.items.slice(0, 3) ?? [];
  const near = w && w.balance < 0 && !w.offersBlockedByDebt && -w.balance >= w.debtLimit * 0.8;
  // Colour lives in the number (principle 11): the filled action is the one that helps now.
  const rechargeFirst = !!w && (w.balance < 0 || w.available <= 0);
  const pending = q.data ? q.data.pendingWithdrawals.length + q.data.pendingRecharges.length : 0;
  return (
    <Screen tabBar header={<Header title="Portefeuille" />} testID="wallet-screen">
      <View style={{ gap: 14, marginTop: 4 }}>
        {q.isLoading ? <Skeleton height={190} radius={24} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {w ? (
          <>
            <WalletCard wallet={w} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ActionPill label="Retirer" variant={rechargeFirst ? 'secondary' : 'primary'} disabled={w.available <= 0} accessibilityHint={w.available <= 0 ? 'Aucun montant disponible au retrait pour le moment.' : undefined} icon={(c) => <Icon icon={Landmark} size={20} color={c} />} onPress={() => router.push('/withdraw')} testID="open-withdraw" />
              <ActionPill label="Recharger" variant={rechargeFirst ? 'primary' : 'secondary'} icon={(c) => <Icon icon={Plus} size={20} color={c} />} onPress={() => router.push('/recharge')} testID="open-recharge" />
            </View>
            {w.available <= 0 && !w.offersBlockedByDebt ? <Text variant="caption" tone="muted" align="center">Aucun montant disponible au retrait pour le moment.</Text> : null}
            {w.offersBlockedByDebt ? <ActionNote tone="danger" title="Plafond de dette atteint" message={`Une recharge confirmée qui ramène le solde au-dessus de ${formatMoney(-w.debtLimit)} rétablit l’accès aux courses.`} testID="wallet-blocked" /> : null}
            {near ? <StatusBanner compact tone="warning" title="Proche du plafond" message={`au-delà de ${formatMoney(-w.debtLimit)}, les courses sont suspendues`} testID="wallet-near" /> : null}
            {pending ? (
              <ListGroup label={pending > 1 ? `${pending} opérations en cours` : '1 opération en cours'}>
                {q.data!.pendingWithdrawals.map((x) => (
                  <ListRow
                    key={x.id}
                    title={`Retrait ${formatMoney(x.amount)}`}
                    subtitle={`Montant réservé · ${formatShort(x.createdAt)}`}
                    leading={<Icon icon={Landmark} size={24} tone="accent" />}
                    status={{ kind: 'transfer', state: x.status }}
                    onPress={() => router.push({ pathname: '/withdraw/[id]', params: { id: x.id } })}
                    testID={`pending-${x.id}`}
                  />
                ))}
                {q.data!.pendingRecharges.map((x) => (
                  <ListRow
                    key={x.id}
                    title={`Recharge ${formatMoney(x.amount)}`}
                    subtitle={`${x.providerName} · ${formatShort(x.createdAt)}`}
                    leading={<Icon icon={Plus} size={24} tone="accent" />}
                    status={{ kind: 'transfer', state: x.status }}
                    onPress={() => router.push({ pathname: '/recharge/[id]', params: { id: x.id } })}
                    testID={`pending-${x.id}`}
                  />
                ))}
              </ListGroup>
            ) : null}
            {latest.length ? (
              <Section title="Derniers mouvements" action={<TextButton label="Tout voir" onPress={() => router.push('/ledger')} testID="open-ledger" />} style={{ marginTop: 10 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.hairline, ...shadow.card }} testID="wallet-recent">
                  {latest.map((e) => (
                    <TransactionRow key={e.id} entry={e} onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: e.id } })} />
                  ))}
                </View>
              </Section>
            ) : recent.data ? (
              <TextButton label="Voir les mouvements" onPress={() => router.push('/ledger')} testID="open-ledger" />
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
