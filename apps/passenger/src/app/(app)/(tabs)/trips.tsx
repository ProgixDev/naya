import { useTheme, PressableScale, Text, Button, EmptyState, ErrorState, Header, Screen, SegmentedControl, SkeletonList } from '@naya/ui';
import { useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarClock, Car, ChevronRight, Plus, XCircle } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, formatTime, SCHEDULED_STATUS_LABELS, toCasablancaParts } from '@naya/domain';
import { aspect, illustrations } from '@naya/assets';
import { colors } from '@naya/tokens';
import { useAccountId, useScheduled } from '@/lib/queries';
import { useTabBarSpace } from '@/components/TabBar';

type Booking = NonNullable<ReturnType<typeof useScheduled>['data']>[number];

const card = () => ({ backgroundColor: colors.surface, borderRadius: 20, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;
const first = (b: { route: { stops: { label: string }[] } }) => b.route.stops[0]!.label;
const last = (b: { route: { stops: { label: string }[] } }) => b.route.stops[b.route.stops.length - 1]!.label;
/** "Rabat · Centre-ville" → "Centre-ville": the city is implied, keep the place. */
const short = (label: string) => label.replace(/^[^·]+·\s*/, '');
const routeTitle = (b: { route: { stops: { label: string }[] } }) => `${short(first(b))} → ${short(last(b))}`;

/** "Aujourd’hui", "Hier", or "10 oct." for older days (Casablanca time). */
function dayLabel(iso: string) {
  const d = toCasablancaParts(iso).date;
  const today = toCasablancaParts(new Date().toISOString()).date;
  const yesterday = toCasablancaParts(new Date(Date.now() - 86400000).toISOString()).date;
  if (d === today) return 'Aujourd’hui';
  if (d === yesterday) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Casablanca' }).format(new Date(iso));
}

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
  const upcoming = (scheduled.data ?? []).filter((b) => b.status === 'scheduled').sort((x, y) => x.pickupAt.localeCompare(y.pickupAt));
  const past = (scheduled.data ?? []).filter((b) => b.status !== 'scheduled');
  const rides = history.data?.pages.flatMap((p) => p.items) ?? [];

  // One timeline for finished rides and past bookings, newest first, grouped by day.
  const items = [
    ...rides.map((r) => ({ key: `r-${r.id}`, at: r.completedAt ?? r.cancellation?.at ?? r.requestedAt, node: <RideItem key={r.id} ride={r} /> })),
    ...past.map((b) => ({ key: `b-${b.id}`, at: b.pickupAt, node: <BookingItem key={b.id} booking={b} /> })),
  ].sort((x, y) => y.at.localeCompare(x.at));
  const groups: { label: string; items: typeof items }[] = [];
  for (const it of items) {
    const label = dayLabel(it.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(it);
    else groups.push({ label, items: [it] });
  }
  const planTrip = () => router.push({ pathname: '/route', params: { schedule: '1' } });

  return (
    <Screen
      testID="trips"
      header={<Header title="Mes trajets" />}
      contentStyle={{ paddingBottom: space + 12 }}
      refreshControl={<RefreshControl refreshing={scheduled.isRefetching || history.isRefetching} onRefresh={() => (tab === 'upcoming' ? scheduled.refetch() : Promise.all([scheduled.refetch(), history.refetch()]))} tintColor={colors.accent} />}
    >
      <View style={{ gap: 16, marginTop: 4 }}>
        <SegmentedControl options={[{ value: 'upcoming', label: upcoming.length ? `À venir · ${upcoming.length}` : 'À venir' }, { value: 'history', label: 'Historique' }]} value={tab} onChange={setTab} testID="trips-tabs" />

        {tab === 'upcoming' ? (
          scheduled.isLoading ? (
            <SkeletonList rows={2} />
          ) : scheduled.isError ? (
            <ErrorState onRetry={() => scheduled.refetch()} />
          ) : upcoming.length === 0 ? (
            <EmptyState testID="trips-empty" image={illustrations.passengerPlanning} imageAspect={aspect.illustration} title="Aucun trajet planifié" message="Planifiez un départ jusqu’à 7 jours à l’avance." action={{ label: 'Planifier un trajet', onPress: planTrip }} />
          ) : (
            <View style={{ gap: 12 }}>
              {upcoming.map((b) => <UpcomingCard key={b.id} booking={b} />)}
              <PressableScale onPress={planTrip} accessibilityRole="button" accessibilityLabel="Planifier un autre trajet" pressedScale={0.985} style={{ minHeight: 64, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mauve, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Tile bg={colors.mauveSoft}><Plus size={20} color={colors.accent} strokeWidth={2.2} /></Tile>
                <Text weight="semibold" tone="accent" style={{ fontSize: 16, lineHeight: 22 }}>Planifier un autre trajet</Text>
              </PressableScale>
            </View>
          )
        ) : null}

        {tab === 'history' ? (
          history.isLoading ? (
            <SkeletonList rows={4} />
          ) : history.isError ? (
            <ErrorState onRetry={() => history.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState testID="history-empty" title="Pas encore de course" message="Vos courses terminées et annulées apparaîtront ici." />
          ) : (
            <View style={{ gap: 20 }}>
              {groups.map((g) => (
                <View key={g.label} style={{ gap: 10 }}>
                  <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{g.label}</Text>
                  {g.items.map((it) => it.node)}
                </View>
              ))}
              {history.hasNextPage ? <Button label="Voir plus" variant="secondary" full loading={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} /> : null}
            </View>
          )
        ) : null}
      </View>
    </Screen>
  );
}

function Tile({ bg, children }: { bg: string; children: ReactNode }) {
  return <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/** Departure → arrival with the two route dots. */
function RouteLines({ from, to }: { from: string; to: string }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} />
        <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: colors.line, marginVertical: 3 }} />
        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: colors.ink }} />
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        <Text tone="muted" numberOfLines={1} style={{ fontSize: 14, lineHeight: 20 }}>{from}</Text>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 22 }}>{to}</Text>
      </View>
    </View>
  );
}

function UpcomingCard({ booking: b }: { booking: Booking }) {
  useTheme();
  const when = new Date(b.pickupAt);
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'Africa/Casablanca' }).format(when);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'Africa/Casablanca' }).format(when).replace('.', '');
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'Africa/Casablanca' }).format(when);
  return (
    <PressableScale
      testID={`scheduled-${b.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${formatDateTime(b.pickupAt)}, ${first(b)}, ${last(b)}, ${formatMoney(b.terms.breakdown.total)}`}
      onPress={() => router.push({ pathname: '/scheduled/[id]', params: { id: b.id } })}
      pressedScale={0.985}
      style={[card(), { padding: 16, gap: 14 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, height: 56, borderRadius: 14, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
          <Text weight="bold" numeric tone="accent" style={{ fontSize: 20, lineHeight: 24 }}>{day}</Text>
          <Text weight="semibold" tone="accent" style={{ fontSize: 11, lineHeight: 14, textTransform: 'uppercase' }}>{month}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold" style={{ fontSize: 16, lineHeight: 22, textTransform: 'capitalize' }}>{weekday}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CalendarClock size={14} color={colors.muted} strokeWidth={2} />
            <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 18 }}>Départ à {formatTime(b.pickupAt)}</Text>
          </View>
        </View>
        <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
      </View>
      <RouteLines from={first(b)} to={last(b)} />
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.warningSoft }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning }} />
          <Text weight="semibold" tone="warning" style={{ fontSize: 12, lineHeight: 16 }}>Chauffeuse à confirmer</Text>
        </View>
        <Text weight="bold" numeric style={{ fontSize: 17, lineHeight: 22 }}>{formatMoney(b.terms.breakdown.total)}</Text>
      </View>
    </PressableScale>
  );
}

type Ride = { id: string; status: string; route: { stops: { label: string }[] }; terms: { breakdown: { total: number } }; completedAt?: string | null; requestedAt: string; cancellation?: { at: string } | null };

function HistoryRow({ testID, icon, tile, title, subtitle, value, valueMuted, onPress }: { testID: string; icon: ReactNode; tile: string; title: string; subtitle: string; value: string; valueMuted?: boolean; onPress: () => void }) {
  useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}, ${value}`} pressedScale={0.985} style={[card(), { minHeight: 72, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
      <Tile bg={tile}>{icon}</Tile>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>{title}</Text>
        <Text tone="muted" numberOfLines={1} numeric style={{ fontSize: 13, lineHeight: 18 }}>{subtitle}</Text>
      </View>
      <Text weight={valueMuted ? 'medium' : 'semibold'} tone={valueMuted ? 'muted' : 'ink'} numeric style={{ fontSize: 15, lineHeight: 20 }}>{value}</Text>
    </PressableScale>
  );
}

function RideItem({ ride: r }: { ride: Ride }) {
  useTheme();
  const cancelled = r.status === 'cancelled';
  const at = r.completedAt ?? r.cancellation?.at ?? r.requestedAt;
  return (
    <HistoryRow
      testID={`history-${r.id}`}
      icon={cancelled ? <XCircle size={20} color={colors.danger} strokeWidth={1.9} /> : <Car size={20} color={colors.success} strokeWidth={1.9} />}
      tile={cancelled ? colors.dangerSoft : colors.successSoft}
      title={routeTitle(r)}
      subtitle={`${formatTime(at)} · ${cancelled ? 'Course annulée' : 'Course terminée'}`}
      value={cancelled ? 'Annulée' : formatMoney(r.terms.breakdown.total)}
      valueMuted={cancelled}
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
    />
  );
}

function BookingItem({ booking: b }: { booking: Booking }) {
  useTheme();
  const cancelled = b.status === 'cancelled' || b.status === 'expired';
  return (
    <HistoryRow
      testID={`past-scheduled-${b.id}`}
      icon={cancelled ? <XCircle size={20} color={colors.danger} strokeWidth={1.9} /> : <CalendarClock size={20} color={colors.accent} strokeWidth={1.9} />}
      tile={cancelled ? colors.dangerSoft : colors.mauveSoft}
      title={routeTitle(b)}
      subtitle={`${formatTime(b.pickupAt)} · Réservation ${SCHEDULED_STATUS_LABELS[b.status].toLowerCase()}`}
      value={cancelled ? SCHEDULED_STATUS_LABELS[b.status] : formatMoney(b.terms.breakdown.total)}
      valueMuted={cancelled}
      onPress={() => router.push({ pathname: '/scheduled/[id]', params: { id: b.id } })}
    />
  );
}
