import { useTheme, Icon, Button, EmptyState, ErrorState, Header, ListGroup, ListRow, Screen, SegmentedControl, SkeletonList, paymentMethodIcon } from '@naya/ui';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, formatShort } from '@naya/domain';
import { aspect, illustrations } from '@naya/assets';
import { colors } from '@naya/tokens';
import { useAccountId, useScheduled } from '@/lib/queries';

const routeOf = (stops: { label: string }[]) => `${stops[0]!.label} → ${stops[stops.length - 1]!.label}`;

/**
 * P12. Upcoming bookings and past rides as rows (P-26, P-27): one state glyph per row (C5), its
 * sentence read aloud by the row; the word shows only for a problem (an expired booking, R1).
 */
export default function Trips() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const scheduled = useScheduled();
  const history = useInfiniteQuery({
    queryKey: qk.rideHistory(a),
    queryFn: ({ pageParam }) => api.rides.history(pageParam, 15),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: tab === 'history',
  });
  const upcoming = (scheduled.data ?? []).filter((b) => b.status === 'scheduled');
  const past = (scheduled.data ?? []).filter((b) => b.status !== 'scheduled');
  const rides = history.data?.pages.flatMap((p) => p.items) ?? [];
  const openBooking = (id: string) => router.push({ pathname: '/scheduled/[id]', params: { id } });

  return (
    <Screen
      testID="trips"
      tabBar
      header={<Header title="Mes trajets" />}
      refreshControl={<RefreshControl refreshing={scheduled.isRefetching || history.isRefetching} onRefresh={() => (tab === 'upcoming' ? scheduled.refetch() : history.refetch())} tintColor={colors.accent} />}
    >
      <View style={{ gap: 16, marginTop: 4 }}>
        <SegmentedControl options={[{ value: 'upcoming', label: 'À venir' }, { value: 'history', label: 'Historique' }]} value={tab} onChange={setTab} testID="trips-tabs" />
        {tab === 'upcoming' ? (
          scheduled.isLoading ? (
            <SkeletonList rows={2} />
          ) : scheduled.isError ? (
            <ErrorState onRetry={() => scheduled.refetch()} />
          ) : upcoming.length === 0 ? (
            <EmptyState testID="trips-empty" image={illustrations.passengerPlanning} imageAspect={aspect.illustration} title="Aucun trajet planifié" message="Planifiez un départ jusqu’à 7 jours à l’avance." action={{ label: 'Planifier un trajet', onPress: () => router.push({ pathname: '/route', params: { schedule: '1' } }) }} />
          ) : (
            <ListGroup>
              {upcoming.map((b) => (
                <ListRow
                  key={b.id}
                  testID={`scheduled-${b.id}`}
                  title={formatDateTime(b.pickupAt)}
                  subtitle={routeOf(b.route.stops)}
                  value={formatMoney(b.terms.breakdown.total)}
                  numericValue
                  status={{ kind: 'scheduled', state: b.status }}
                  onPress={() => openBooking(b.id)}
                />
              ))}
            </ListGroup>
          )
        ) : null}
        {tab === 'upcoming' && past.length ? (
          <ListGroup label="Réservations passées">
            {past.map((b) => (
              <ListRow key={b.id} testID={`scheduled-${b.id}`} title={formatShort(b.pickupAt)} subtitle={routeOf(b.route.stops)} status={{ kind: 'scheduled', state: b.status }} onPress={() => openBooking(b.id)} />
            ))}
          </ListGroup>
        ) : null}
        {tab === 'history' ? (
          history.isLoading ? (
            <SkeletonList rows={4} />
          ) : history.isError ? (
            <ErrorState onRetry={() => history.refetch()} />
          ) : rides.length === 0 ? (
            <EmptyState testID="history-empty" title="Pas encore de course" message="Vos courses terminées et annulées apparaîtront ici." />
          ) : (
            <>
              <ListGroup>
                {rides.map((r) => (
                  <ListRow
                    key={r.id}
                    testID={`history-${r.id}`}
                    // The method glyph is the one cue the title lacks (P-27); the word « Annulée » stays.
                    leading={<Icon icon={paymentMethodIcon(r.paymentMethod)} size={24} color={colors.muted} />}
                    title={routeOf(r.route.stops)}
                    subtitle={`${r.id} · ${formatShort(r.completedAt ?? r.cancellation?.at ?? r.requestedAt)}`}
                    value={r.status === 'cancelled' ? 'Annulée' : formatMoney(r.terms.breakdown.total)}
                    numericValue
                    onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
                  />
                ))}
              </ListGroup>
              {history.hasNextPage ? <Button label="Voir plus" variant="secondary" full loading={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} /> : null}
            </>
          )
        ) : null}
      </View>
    </Screen>
  );
}
