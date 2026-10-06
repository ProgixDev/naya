import { useTheme , PressableScale, Illustration, Text, Button, EmptyState, ErrorState, Header, IconDisc, ListGroup, ListRow, Screen, SegmentedControl, SkeletonList, StatusPill } from '@naya/ui';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarClock, ArrowUpRight } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, formatShort, SCHEDULED_STATUS_LABELS } from '@naya/domain';
import { aspect, cars, illustrations } from '@naya/assets';
import { colors } from '@naya/tokens';
import { useAccountId, useScheduled } from '@/lib/queries';
import { useTabBarSpace } from '@/components/TabBar';

export default function Trips() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const space = useTabBarSpace();
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

  return (
    <Screen
      testID="trips"
      header={<Header title="Mes trajets" />}
      contentStyle={{ paddingBottom: space + 12 }}
      refreshControl={<RefreshControl refreshing={scheduled.isRefetching || history.isRefetching} onRefresh={() => (tab === 'upcoming' ? scheduled.refetch() : history.refetch())} tintColor={colors.accent} />}
    >
      <View style={{ gap: 12, marginTop: 4 }}>
        <SegmentedControl options={[{ value: 'upcoming', label: 'À venir' }, { value: 'history', label: 'Historique' }]} value={tab} onChange={setTab} testID="trips-tabs" />
        {tab === 'upcoming' ? (
          scheduled.isLoading ? (
            <SkeletonList rows={2} />
          ) : scheduled.isError ? (
            <ErrorState onRetry={() => scheduled.refetch()} />
          ) : upcoming.length === 0 ? (
            <EmptyState testID="trips-empty" image={illustrations.passengerPlanning} imageAspect={aspect.illustration} title="Aucun trajet planifié" message="Planifiez un départ jusqu’à 7 jours à l’avance." action={{ label: 'Planifier un trajet', onPress: () => router.push({ pathname: '/route', params: { schedule: '1' } }) }} />
          ) : (
            <>
              <View style={{ gap: 14 }}>
                {upcoming.map((b) => (
                  <PressableScale key={b.id} testID={`scheduled-${b.id}`} accessibilityRole="button" accessibilityLabel={`${formatDateTime(b.pickupAt)}, ${b.route.stops[0]!.label}, ${b.route.stops[b.route.stops.length - 1]!.label}, ${formatMoney(b.terms.breakdown.total)}`} onPress={() => router.push({ pathname: '/scheduled/[id]', params: { id: b.id } })} style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <CalendarClock size={18} color={colors.accent} />
                      <Text variant="caption" weight="semibold" style={{ flex: 1 }}>{formatDateTime(b.pickupAt)}</Text>
                      <ArrowUpRight size={18} color={colors.muted} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1, gap: 8 }}>
                        <Text variant="heading">{b.route.stops[b.route.stops.length - 1]!.label}</Text>
                        <Text variant="caption" tone="muted">Depuis {b.route.stops[0]!.label}</Text>
                        <Text variant="label" numeric weight="semibold">{formatMoney(b.terms.breakdown.total)}</Text>
                      </View>
                      <Illustration source={cars.pearlSmall} aspect={aspect.carSmall} width={108} />
                    </View>
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}><Text variant="micro" tone="muted">Réservation enregistrée · chauffeuse à confirmer</Text></View>
                  </PressableScale>
                ))}
              </View>
            </>
          )
        ) : null}
        {tab === 'upcoming' && past.length ? (
          <ListGroup label="Réservations passées">
            {past.map((b) => (
              <ListRow key={b.id} title={formatShort(b.pickupAt)} subtitle={`${b.route.stops[0]!.label} → ${b.route.stops[b.route.stops.length - 1]!.label}`} trailing={<StatusPill tone={b.status === 'cancelled' ? 'danger' : 'neutral'} label={SCHEDULED_STATUS_LABELS[b.status]} />} onPress={() => router.push({ pathname: '/scheduled/[id]', params: { id: b.id } })} />
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
                    title={`${r.route.stops[0]!.label} → ${r.route.stops[r.route.stops.length - 1]!.label}`}
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
