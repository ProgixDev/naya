import { View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, XCircle } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort, splitFare } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, EmptyState, ErrorState, Header, IconDisc, ListGroup, ListRow, Screen, SkeletonList } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** D16 · D16-empty */
export default function RideHistory() {
  const api = useApi();
  const a = useAccountId();
  const q = useInfiniteQuery({ queryKey: qk.rideHistory(a), queryFn: ({ pageParam }) => api.rides.history(pageParam, 20), initialPageParam: 0, getNextPageParam: (l) => l.nextCursor ?? undefined });
  const rides = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen header={<Header title="Mes courses" onBack={() => router.back()} />} testID="ride-history">
      <View style={{ gap: 12, marginTop: 4 }}>
        {q.isLoading ? <SkeletonList /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data && rides.length === 0 ? <EmptyState title="Aucune course pour le moment" message="Vos courses terminées et annulées apparaîtront ici." testID="rides-empty" /> : null}
        {rides.length ? (
          <ListGroup>
            {rides.map((r) => {
              const net = splitFare(r.terms.breakdown.total, r.terms.commissionBp).net;
              const cancelled = r.status === 'cancelled';
              return (
                <ListRow
                  key={r.id}
                  title={`${r.id} · ${r.route.stops[r.route.stops.length - 1]!.label}`}
                  subtitle={`${formatShort(r.completedAt ?? r.cancellation?.at ?? r.requestedAt)} · ${cancelled ? 'Annulée' : `${r.paymentMethod.kind === 'cash' ? 'Espèces' : 'Carte'} · net ${formatMoney(net)}`}`}
                  leading={<IconDisc size={36} tone={cancelled ? 'danger' : 'plain'}>{cancelled ? <XCircle size={17} color={colors.danger} /> : r.paymentMethod.kind === 'cash' ? <Banknote size={17} color={colors.accent} /> : <CreditCard size={17} color={colors.accent} />}</IconDisc>}
                  onPress={() => router.push({ pathname: '/rides/[id]', params: { id: r.id } })}
                  testID={`ride-row-${r.id}`}
                />
              );
            })}
          </ListGroup>
        ) : null}
        {q.hasNextPage ? <Button label="Afficher plus" variant="secondary" full loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}
