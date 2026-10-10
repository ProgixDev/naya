import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatBp, formatDateTime, formatMoney, formatTime, PAYMENT_STATUS_LABELS, RIDE_STATUS_LABELS, splitFare } from '@naya/domain';
import { useTheme, ErrorState, Header, PressableScale, RouteStopRow, Screen, SkeletonList, StatusBanner, StatusPill, Text } from '@naya/ui';
import { Banknote, ChevronRight, Clock, CreditCard, MessageCircle, Route as RouteIcon } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';

/** D16 detail: route, money split, payment status, timeline. */
export default function RideDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.ride(a, id), queryFn: () => api.rides.get(id) });
  const d = q.data;
  return (
    <Screen header={<Header title="Détail de la course" onBack={() => router.back()} />} testID="ride-detail">
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {d ? (() => {
        const r = d.ride;
        const split = splitFare(r.terms.breakdown.total, r.terms.commissionBp);
        const payment = d.payments.find((p) => p.id === r.paymentId);
        const mine = !!r.driver;
        const done = mine && r.status === 'completed';
        const cash = r.paymentMethod.kind === 'cash';
        return (
          <View style={{ gap: 14, marginTop: 4 }}>
            {/* ── Summary ── */}
            <View style={[card(), { gap: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text tone="muted" numeric numberOfLines={1} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{formatDateTime(r.completedAt ?? r.requestedAt)}</Text>
                <StatusPill tone={r.status === 'completed' ? 'success' : r.status === 'cancelled' ? 'danger' : 'info'} label={RIDE_STATUS_LABELS[r.status]} />
              </View>
              {done ? (
                <View style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
                  <Text weight="medium" tone="muted" style={{ fontSize: 14, lineHeight: 19 }}>Votre revenu net</Text>
                  <Text weight="bold" numeric tone="success" style={{ fontSize: 36, lineHeight: 44, letterSpacing: -1 }}>+{formatMoney(split.net)}</Text>
                  <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{cash ? 'Espèces encaissées par vous' : 'Carte via Naya'} · {payment ? PAYMENT_STATUS_LABELS[payment.status].toLowerCase() : '—'}</Text>
                </View>
              ) : null}
            </View>

            {/* ── Route ── */}
            <View style={[card(), { paddingVertical: 10 }]}>
              {r.route.stops.map((st, i) => (
                <RouteStopRow key={i} place={st} role={i === 0 ? 'pickup' : i === r.route.stops.length - 1 ? 'destination' : 'stop'} isLast={i === r.route.stops.length - 1} />
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 6 }}>
                <Chip icon={<RouteIcon size={14} color={colors.muted} />} text={`${(r.route.distanceMeters / 1000).toFixed(1).replace('.', ',')} km`} />
                <Chip icon={<Clock size={14} color={colors.muted} />} text={`${Math.round(r.route.durationSeconds / 60)} min`} />
              </View>
            </View>

            {/* ── Money ── */}
            {done ? (
              <View style={[card(), { gap: 12 }]}>
                <Line label="Tarif payé" value={formatMoney(split.gross)} />
                <Line label={`Commission Naya · ${formatBp(r.terms.commissionBp)}`} value={`−${formatMoney(split.commission)}`} />
                <View style={{ height: 1, backgroundColor: colors.line }} />
                <Line label="Votre revenu net" value={formatMoney(split.net)} strong />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 14, padding: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: cash ? colors.successSoft : colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                    {cash ? <Banknote size={17} color={colors.success} /> : <CreditCard size={17} color={colors.info} />}
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{cash ? 'Espèces encaissées par vous' : 'Carte via Naya'}</Text>
                  <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18 }}>{payment ? PAYMENT_STATUS_LABELS[payment.status] : '—'}</Text>
                </View>
              </View>
            ) : null}
            {r.cancellation ? <StatusBanner compact tone="danger" title={r.cancellation.by === 'passenger' ? 'Annulée par la passagère' : 'Annulée'} message={r.cancellation.reasonText} /> : null}
            {!mine ? <StatusBanner compact tone="neutral" title="Vous avez annulé cette course" message="elle a été réattribuée" /> : null}

            {/* ── Timeline ── */}
            {r.timeline.length ? (
              <View style={{ gap: 10, marginTop: 6 }}>
                <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>Chronologie</Text>
                <View style={[card(), { gap: 0 }]}>
                  {r.timeline.map((e, i, all) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ alignItems: 'center', width: 12 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: i === all.length - 1 ? colors.accent : colors.line }} />
                        {i < all.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 2 }} /> : null}
                      </View>
                      <View style={{ flex: 1, flexDirection: 'row', gap: 10, paddingBottom: i < all.length - 1 ? 12 : 0 }}>
                        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{e.label}</Text>
                        <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 20 }}>{formatTime(e.at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* ── Help ── */}
            <PressableScale onPress={() => router.push({ pathname: '/support/new', params: { rideId: r.id } })} testID="ride-support" accessibilityRole="button" pressedScale={0.985} style={[card(), { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }]}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}><MessageCircle size={20} color={colors.accent} strokeWidth={1.9} /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Signaler un problème</Text>
                <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Paiement, passagère, incident…</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
            </PressableScale>
            <Text tone="muted" align="center" numeric style={{ fontSize: 12, lineHeight: 16 }}>Course {r.id}</Text>
          </View>
        );
      })() : null}
    </Screen>
  );
}

const card = () => ({ backgroundColor: colors.surface, borderRadius: 22, padding: 16, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text tone={strong ? 'ink' : 'muted'} weight={strong ? 'semibold' : 'regular'} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>{label}</Text>
      <Text weight={strong ? 'bold' : 'semibold'} numeric style={{ fontSize: strong ? 16 : 14, lineHeight: 21 }}>{value}</Text>
    </View>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.background }}>
      {icon}
      <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}
