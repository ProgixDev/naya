import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatBp, formatDateTime, formatMoney, formatTime, PAYMENT_STATUS_LABELS, RIDE_STATUS_LABELS, splitFare } from '@naya/domain';
import { Button, Card, ErrorState, Header, ListGroup, ListRow, RouteStopRow, Screen, Section, SkeletonList, StatusPill, Text } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** D16 detail: route, money split, payment status, timeline. */
export default function RideDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.ride(a, id), queryFn: () => api.rides.get(id) });
  const d = q.data;
  return (
    <Screen header={<Header title={`Course ${id}`} onBack={() => router.back()} />} testID="ride-detail">
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {d ? (() => {
        const r = d.ride;
        const split = splitFare(r.terms.breakdown.total, r.terms.commissionBp);
        const payment = d.payments.find((p) => p.id === r.paymentId);
        const mine = !!r.driver;
        return (
          <View style={{ gap: 8, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <StatusPill tone={r.status === 'completed' ? 'success' : r.status === 'cancelled' ? 'danger' : 'info'} label={RIDE_STATUS_LABELS[r.status]} />
              <Text variant="caption" tone="muted">
                {formatDateTime(r.completedAt ?? r.requestedAt)}
              </Text>
            </View>
            <Card style={{ marginTop: 8 }}>
              {r.route.stops.map((s, i) => (
                <RouteStopRow key={i} place={s} role={i === 0 ? 'pickup' : i === r.route.stops.length - 1 ? 'destination' : 'stop'} isLast={i === r.route.stops.length - 1} />
              ))}
            </Card>
            {mine && r.status === 'completed' ? (
              <Section title="Montants">
                <ListGroup>
                  <ListRow title="Tarif payé par la passagère" value={formatMoney(split.gross)} numericValue />
                  <ListRow title={`Commission Naya · ${formatBp(r.terms.commissionBp)}`} value={formatMoney(-split.commission)} numericValue />
                  <ListRow title="Votre revenu net" value={formatMoney(split.net)} numericValue />
                  <ListRow title="Paiement" subtitle={r.paymentMethod.kind === 'cash' ? 'Espèces encaissées par vous' : 'Carte via Naya'} value={payment ? PAYMENT_STATUS_LABELS[payment.status] : '—'} />
                </ListGroup>
              </Section>
            ) : null}
            {r.cancellation ? (
              <Section title="Annulation">
                <Text variant="label">{r.cancellation.by === 'passenger' ? 'Annulée par la passagère' : 'Annulée'} · {r.cancellation.reasonText}</Text>
              </Section>
            ) : null}
            {!mine ? <Text variant="caption" tone="muted" style={{ marginTop: 12 }}>Vous avez annulé cette course ; elle a été réattribuée.</Text> : null}
            {r.timeline.length ? (
              <Section title="Chronologie">
                <View style={{ gap: 8 }}>
                  {r.timeline.map((e, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                      <Text variant="caption" tone="muted" numeric style={{ width: 48 }}>
                        {formatTime(e.at)}
                      </Text>
                      <Text variant="caption" style={{ flex: 1 }}>
                        {e.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}
            <Button label="Signaler un problème sur cette course" variant="secondary" full style={{ marginTop: 20 }} onPress={() => router.push({ pathname: '/support/new', params: { rideId: r.id } })} testID="ride-support" />
          </View>
        );
      })() : null}
    </Screen>
  );
}
