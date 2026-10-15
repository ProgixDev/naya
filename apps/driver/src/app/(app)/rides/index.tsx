import { useTheme, Button, EmptyState, ErrorState, Header, Icon, ListGroup, ListRow, Screen, SkeletonList, paymentMethodIcon } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort, paymentMethodPresentation, splitFare } from '@naya/domain';
import { useAccountId } from '@/lib/queries';

/** D16 · D16-empty */
export default function RideHistory() {
  useTheme();
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
              const stops = r.route.stops;
              // A120, D-28: the payment method leads (bare glyph), the ride's state is one trailing glyph
              // (CircleSlash for a cancellation, never a red cross); the net amount sits on the right.
              return (
                <ListRow
                  key={r.id}
                  title={`${stops[0]!.label} → ${stops[stops.length - 1]!.label}`}
                  subtitle={`${formatShort(r.completedAt ?? r.cancellation?.at ?? r.requestedAt)} · ${r.id} · ${paymentMethodPresentation(r.paymentMethod).shortLabel}`}
                  leading={<Icon icon={paymentMethodIcon(r.paymentMethod)} size={24} />}
                  value={cancelled ? undefined : formatMoney(net)}
                  numericValue
                  status={{ kind: 'ride', state: r.status }}
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
