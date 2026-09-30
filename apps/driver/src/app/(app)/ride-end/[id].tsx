import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Wallet } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatBp, formatDateTime, formatMoney, splitFare } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, ErrorState, Header, IconDisc, ListGroup, ListRow, Money, Screen, SkeletonList, StatusBanner, Text, haptic, toast, useSingleFlight } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** D10 · D10-cash · D10-electronic · D10-pending · D10-failed */
export default function RideEnd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useQuery({
    queryKey: qk.ride(a, id),
    queryFn: () => api.rides.get(id),
    refetchInterval: (s) => (s.state.data?.payments.find((p) => p.id === s.state.data?.ride.paymentId)?.status === 'pending' ? 2000 : false),
  });
  const collect = useSingleFlight((amount: number) => api.driver.cashCollected(id, amount), {
    onSuccess: () => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.ride(a, id) });
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const home = () => router.dismissTo('/');
  if (q.isLoading) return <Screen header={<Header title="Fin de course" />}><SkeletonList rows={3} /></Screen>;
  if (!q.data) return <Screen header={<Header title="Fin de course" onBack={home} />}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const { ride, payments } = q.data;
  const payment = payments.find((p) => p.id === ride.paymentId) ?? null;
  const split = splitFare(ride.terms.breakdown.total, ride.terms.commissionBp);
  const cash = ride.paymentMethod.kind === 'cash';
  const confirmed = payment?.status === 'confirmed';
  return (
    <Screen
      header={<Header title="Fin de course" subtitle={`${ride.id} · ${ride.passenger.firstName} · ${ride.completedAt ? formatDateTime(ride.completedAt) : ''}`} onBack={home} />}
      footer={
        cash && !confirmed ? (
          <Button label={`J’ai encaissé ${formatMoney(split.gross)}`} size="major" full loading={collect.isPending} onPress={() => collect.run(split.gross)} testID="confirm-cash" />
        ) : (
          <Button label="Retour à l’accueil" size="major" full onPress={home} testID="ride-end-home" />
        )
      }
      testID={`ride-end-${cash ? 'cash' : 'card'}-${payment?.status ?? 'none'}`}
    >
      <View style={{ gap: 16, marginTop: 12 }}>
        <Card>
          <Text variant="caption" tone="muted">
            Tarif final
          </Text>
          <Money amount={split.gross} variant="display" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {cash ? <Banknote size={16} color={colors.muted} /> : <CreditCard size={16} color={colors.muted} />}
            <Text variant="caption" tone="muted">
              {cash ? (confirmed ? 'Espèces · encaissées' : 'Espèces · à encaisser') : `Carte · ${payment?.status === 'confirmed' ? 'paiement confirmé' : payment?.status === 'failed' ? 'paiement refusé' : 'confirmation en cours'}`}
            </Text>
          </View>
        </Card>
        <ListGroup>
          <ListRow title={`Commission · ${formatBp(ride.terms.commissionBp)}`} subtitle={cash ? 'Débitée du portefeuille' : 'Retenue sur le paiement carte'} leading={<IconDisc><Wallet size={18} color={colors.accent} /></IconDisc>} value={formatMoney(-split.commission)} numericValue />
          <ListRow title="Revenu net" subtitle={`${formatMoney(split.gross)} − ${formatMoney(split.commission)}`} leading={<IconDisc tone="success"><Banknote size={18} color={colors.success} /></IconDisc>} value={formatMoney(split.net)} numericValue />
        </ListGroup>
        {cash && !confirmed ? <StatusBanner tone="neutral" title="Confirmer l’encaissement" message="Les espèces sont remises directement par la passagère. Elles ne créditent pas votre portefeuille : seule la commission y est débitée." testID="cash-info" /> : null}
        {cash && confirmed ? <StatusBanner tone="success" title="Encaissement confirmé" message={`Vous gardez ${formatMoney(split.gross)} en espèces. Portefeuille : commission de ${formatMoney(split.commission)} débitée.`} testID="cash-confirmed" /> : null}
        {!cash && payment?.status === 'pending' ? <StatusBanner tone="info" title="Paiement carte en cours de confirmation" message="Aucun crédit n’est ajouté avant la confirmation du prestataire de paiement." testID="card-pending" /> : null}
        {!cash && payment?.status === 'confirmed' ? <StatusBanner tone="success" title={`${formatMoney(split.net, { sign: 'always' })} crédités`} message="Le revenu net est disponible dans votre portefeuille, après compensation d’une éventuelle dette." testID="card-confirmed" /> : null}
        {!cash && payment?.status === 'failed' ? <StatusBanner tone="danger" title="Paiement refusé" message="La passagère est invitée à régler avec un autre moyen. Rien n’est crédité tant que le paiement n’est pas confirmé." testID="card-failed" /> : null}
      </View>
    </Screen>
  );
}
