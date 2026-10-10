import { useTheme, Button, EmptyState, ErrorState, Header, PressableScale, Screen, SkeletonList, Text } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, XCircle } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatTime, splitFare, toCasablancaParts } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';

/** D16 · D16-empty */
export default function RideHistory() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const q = useInfiniteQuery({ queryKey: qk.rideHistory(a), queryFn: ({ pageParam }) => api.rides.history(pageParam, 20), initialPageParam: 0, getNextPageParam: (l) => l.nextCursor ?? undefined });
  const rides = q.data?.pages.flatMap((p) => p.items) ?? [];
  const finished = rides.filter((r) => r.status !== 'cancelled');
  const netOf = (r: (typeof rides)[number]) => splitFare(r.terms.breakdown.total, r.terms.commissionBp).net;
  const totalNet = finished.reduce((n, r) => n + netOf(r), 0);
  const cashCount = finished.filter((r) => r.paymentMethod.kind === 'cash').length;
  const totalKm = finished.reduce((n, r) => n + r.route.distanceMeters, 0) / 1000;
  // Newest first, grouped by day (Aujourd’hui, Hier, 10 octobre…).
  const groups: { label: string; items: typeof rides }[] = [];
  for (const r of rides) {
    const label = dayLabel(r.completedAt ?? r.cancellation?.at ?? r.requestedAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(r);
    else groups.push({ label, items: [r] });
  }
  return (
    <Screen header={<Header title="Mes courses" onBack={() => router.back()} />} testID="ride-history">
      <View style={{ gap: 12, marginTop: 4 }}>
        {q.isLoading ? <SkeletonList /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data && rides.length === 0 ? <EmptyState title="Aucune course pour le moment" message="Vos courses terminées et annulées apparaîtront ici." testID="rides-empty" /> : null}
        {rides.length ? (
          <View style={{ borderRadius: 26, overflow: 'hidden', padding: 20, gap: 14 }} testID="rides-summary">
            <LinearGradient colors={['#47203A', '#7C3F5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', top: -90, right: -70 }} />
            <Text weight="medium" style={{ fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.85)' }}>Revenu net · {finished.length} course{finished.length > 1 ? 's' : ''}</Text>
            <Text weight="bold" numeric style={{ fontSize: 36, lineHeight: 44, letterSpacing: -1, color: '#FFFFFF' }}>{formatMoney(totalNet)}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeroChip label="Espèces" value={String(cashCount)} />
              <HeroChip label="Carte" value={String(finished.length - cashCount)} />
              <HeroChip label="Distance" value={`${totalKm.toFixed(1).replace('.', ',')} km`} />
            </View>
          </View>
        ) : null}
        {groups.map((g) => (
          <View key={g.label} style={{ gap: 10, marginTop: 6 }}>
            <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{g.label}</Text>
            {g.items.map((r) => {
              const net = splitFare(r.terms.breakdown.total, r.terms.commissionBp).net;
              const cancelled = r.status === 'cancelled';
              const cash = r.paymentMethod.kind === 'cash';
              const at = r.completedAt ?? r.cancellation?.at ?? r.requestedAt;
              const stops = r.route.stops;
              return (
                <PressableScale key={r.id} testID={`ride-row-${r.id}`} onPress={() => router.push({ pathname: '/rides/[id]', params: { id: r.id } })} accessibilityRole="button" accessibilityLabel={`${short(stops[0]!.label)} vers ${short(stops[stops.length - 1]!.label)}, ${cancelled ? 'annulée' : `net ${formatMoney(net)}`}`} pressedScale={0.985} style={{ borderRadius: 22, backgroundColor: colors.surface, padding: 16, gap: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: cancelled ? colors.dangerSoft : cash ? colors.successSoft : colors.infoSoft }}>
                      {cancelled ? <XCircle size={13} color={colors.danger} strokeWidth={2.2} /> : cash ? <Banknote size={13} color={colors.success} strokeWidth={2.2} /> : <CreditCard size={13} color={colors.info} strokeWidth={2.2} />}
                      <Text weight="semibold" style={{ fontSize: 12, lineHeight: 16, color: cancelled ? colors.danger : cash ? colors.success : colors.info }}>{cancelled ? 'Annulée' : cash ? 'Espèces' : 'Carte'}</Text>
                    </View>
                    <Text tone="muted" numeric style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{formatTime(at)} · {r.id}</Text>
                    {cancelled ? null : (
                      <Text weight="bold" numeric tone="success" style={{ fontSize: 17, lineHeight: 22 }}>+{formatMoney(net)}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 2.5, borderColor: colors.accent }} />
                      <View style={{ width: 2, flex: 1, minHeight: 12, backgroundColor: colors.line, marginVertical: 3 }} />
                      <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: colors.ink }} />
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text tone="muted" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>{short(stops[0]!.label)}{stops.length > 2 ? ` · ${stops.length - 2} arrêt` : ''}</Text>
                      <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{short(stops[stops.length - 1]!.label)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                      <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{(r.route.distanceMeters / 1000).toFixed(1).replace('.', ',')} km</Text>
                      <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{Math.round(r.route.durationSeconds / 60)} min</Text>
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
        {q.hasNextPage ? <Button label="Afficher plus" variant="secondary" full loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}

const short = (label: string) => label.replace(/^[^·]+·\s*/, '');

function dayLabel(iso: string) {
  const d = toCasablancaParts(iso).date;
  const today = toCasablancaParts(new Date().toISOString()).date;
  const yesterday = toCasablancaParts(new Date(Date.now() - 86400000).toISOString()).date;
  if (d === today) return 'Aujourd’hui';
  if (d === yesterday) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Casablanca' }).format(new Date(iso));
}

function HeroChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 9, paddingHorizontal: 10 }}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.78)' }}>{label}</Text>
      <Text weight="semibold" numeric numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, color: '#FFFFFF' }}>{value}</Text>
    </View>
  );
}
