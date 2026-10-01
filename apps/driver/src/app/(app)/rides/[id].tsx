import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatBp, formatDateTime, formatMoney, formatTime, PAYMENT_STATUS_LABELS, RIDE_STATUS_LABELS, splitFare } from '@naya/domain';
import { Card, ErrorState, Header, RouteStopRow, Screen, SkeletonList, StatusBanner, StatusPill, Text, TextButton } from '@naya/ui';
import { FigureLine } from '@/components/Kit';
import { useAccountId } from '@/lib/queries';

/** D16 detail: route, money split, payment status, timeline. */
export default function RideDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.ride(a, id), queryFn: () => api.rides.get(id) });
  const d = q.data;
  return (
    <Screen header={<Header title={`Course ${id}`} subtitle={d ? formatDateTime(d.ride.completedAt ?? d.ride.requestedAt) : undefined} onBack={() => router.back()} />} testID="ride-detail">
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {d ? (() => {
        const r = d.ride;
        const split = splitFare(r.terms.breakdown.total, r.terms.commissionBp);
        const payment = d.payments.find((p) => p.id === r.paymentId);
        const mine = !!r.driver;
        return (
          <View style={{ gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              <StatusPill tone={r.status === 'completed' ? 'success' : r.status === 'cancelled' ? 'danger' : 'info'} label={RIDE_STATUS_LABELS[r.status]} />
            </View>
            <Card style={{ paddingVertical: 10 }}>
              {r.route.stops.map((s, i) => (
                <RouteStopRow key={i} place={s} role={i === 0 ? 'pickup' : i === r.route.stops.length - 1 ? 'destination' : 'stop'} isLast={i === r.route.stops.length - 1} />
              ))}
            </Card>
            {mine && r.status === 'completed' ? (
              <Card style={{ paddingVertical: 6, gap: 0 }}>
                <FigureLine label="Tarif payé" value={formatMoney(split.gross)} />
                <FigureLine label={`Commission Naya · ${formatBp(r.terms.commissionBp)}`} value={formatMoney(-split.commission)} />
                <FigureLine label="Votre revenu net" value={formatMoney(split.net)} strong />
                <FigureLine label="Paiement" sub={r.paymentMethod.kind === 'cash' ? 'Espèces encaissées par vous' : 'Carte via Naya'} value={payment ? PAYMENT_STATUS_LABELS[payment.status] : '—'} />
              </Card>
            ) : null}
            {r.cancellation ? <StatusBanner compact tone="danger" title={r.cancellation.by === 'passenger' ? 'Annulée par la passagère' : 'Annulée'} message={r.cancellation.reasonText} /> : null}
            {!mine ? <StatusBanner compact tone="neutral" title="Vous avez annulé cette course" message="elle a été réattribuée" /> : null}
            {r.timeline.length ? (
              <View style={{ gap: 6, paddingHorizontal: 4 }}>
                <Text variant="caption" weight="semibold" tone="muted">
                  Chronologie
                </Text>
                {r.timeline.map((e, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                    <Text variant="caption" tone="muted" numeric style={{ width: 44 }}>
                      {formatTime(e.at)}
                    </Text>
                    <Text variant="caption" style={{ flex: 1 }}>
                      {e.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <TextButton label="Signaler un problème sur cette course" onPress={() => router.push({ pathname: '/support/new', params: { rideId: r.id } })} testID="ride-support" />
          </View>
        );
      })() : null}
    </Screen>
  );
}
