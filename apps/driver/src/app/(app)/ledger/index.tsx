import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, gutter, shadow } from '@naya/tokens';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { Button, EmptyState, ErrorState, Header, Pill, Screen, SkeletonList } from '@naya/ui';
import { TransactionRow } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

const FILTERS = [
  { value: undefined, label: 'Tout' },
  { value: 'rides', label: 'Courses' },
  { value: 'recharge', label: 'Recharges' },
  { value: 'withdrawal', label: 'Retraits' },
  { value: 'correction', label: 'Corrections' },
] as const;

/** D13 · D13-filter · D13-cash · D13-withdrawal */
export default function Ledger() {
  const api = useApi();
  const a = useAccountId();
  const [type, setType] = useState<string | undefined>(undefined);
  const q = useInfiniteQuery({
    queryKey: qk.ledger(a, type),
    queryFn: ({ pageParam }) => api.driver.ledger(type, pageParam, 20),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const entries = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen header={<Header title="Mouvements" subtitle="Opérations confirmées uniquement." onBack={() => router.back()} />} testID="ledger-screen">
      <View style={{ gap: 12, marginTop: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, paddingVertical: 4 }} accessibilityRole="radiogroup">
          {FILTERS.map((f) => (
            <Pill key={f.label} label={f.label} selected={type === f.value} onPress={() => setType(f.value)} testID={`ledger-filter-${f.value ?? 'all'}`} />
          ))}
        </ScrollView>
        {q.isLoading ? <SkeletonList /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data && entries.length === 0 ? <EmptyState title="Aucun mouvement" message="Les commissions, crédits, recharges et retraits confirmés apparaîtront ici." /> : null}
        {entries.length ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 14, ...shadow.card }}>
            {entries.map((e) => (
              <TransactionRow key={e.id} entry={e} onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: e.id } })} />
            ))}
          </View>
        ) : null}
        {q.hasNextPage ? <Button label="Afficher plus" variant="secondary" full loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
