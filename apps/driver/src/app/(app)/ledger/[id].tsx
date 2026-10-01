import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, TRANSFER_STATUS_LABELS } from '@naya/domain';
import { Card, ErrorState, Header, ListGroup, ListRow, Money, Screen, SkeletonList, StatusBanner, Text, TextButton } from '@naya/ui';
import { FigureLine } from '@/components/Kit';
import { useAccountId } from '@/lib/queries';

const TYPE: Record<string, string> = {
  ride_commission: 'Commission · course espèces',
  ride_net_credit: 'Revenu net · course carte',
  cancellation_fee_credit: 'Frais d’annulation (net)',
  recharge: 'Recharge confirmée',
  withdrawal: 'Retrait confirmé',
  correction: 'Correction exceptionnelle',
};

/** D13-detail */
export default function LedgerEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.ledgerEntry(a, id), queryFn: () => api.driver.ledgerEntry(id) });
  const d = q.data;
  return (
    <Screen header={<Header title="Mouvement" onBack={() => router.back()} />} testID="ledger-detail">
      {q.isLoading ? <SkeletonList rows={2} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {d ? (
        <View style={{ gap: 14, marginTop: 4 }}>
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
            <Text variant="caption" tone="muted" align="center">
              {TYPE[d.entry.type]}
            </Text>
            <Money amount={d.entry.amount} sign="always" variant="display" tone={d.entry.amount > 0 ? 'success' : 'ink'} />
            <Text variant="caption" tone="muted" numeric align="center">
              {formatDateTime(d.entry.createdAt)} · {d.entry.id}
            </Text>
          </View>
          <Card style={{ gap: 2, paddingVertical: 8 }}>
            <FigureLine label="Solde après opération" value={formatMoney(d.entry.balanceAfter)} strong />
            <FigureLine label="Libellé" value="" sub={d.entry.description} />
          </Card>
          {d.ride || d.recharge || d.withdrawal ? (
            <ListGroup>
              {d.ride ? <ListRow title={`Course ${d.ride.id}`} subtitle={`${d.ride.route.stops.map((s) => s.label).join(' → ')} · ${d.ride.paymentMethod.kind === 'cash' ? 'Espèces' : 'Carte'} · ${formatMoney(d.ride.terms.breakdown.total)}`} onPress={() => router.push({ pathname: '/rides/[id]', params: { id: d.ride!.id } })} /> : null}
              {d.recharge ? <ListRow title={`Recharge ${d.recharge.id}`} subtitle={`${d.recharge.providerName} · ${TRANSFER_STATUS_LABELS[d.recharge.status]}`} /> : null}
              {d.withdrawal ? <ListRow title={`Retrait ${d.withdrawal.id}`} subtitle={`${d.withdrawal.destinationLabel} · ${TRANSFER_STATUS_LABELS[d.withdrawal.status]}`} /> : null}
            </ListGroup>
          ) : null}
          {d.entry.type === 'ride_commission' ? <StatusBanner compact tone="neutral" title="Course en espèces : vous avez gardé le total" message="seule la commission est débitée ici" /> : null}
          <TextButton label="Signaler un problème" onPress={() => router.push({ pathname: '/support/new', params: { rideId: d.entry.rideId ?? '', category: 'wallet' } })} />
        </View>
      ) : null}
    </Screen>
  );
}
