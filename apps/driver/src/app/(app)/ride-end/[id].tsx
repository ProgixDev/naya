import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatBp, formatDateTime, formatMoney, splitFare } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, ErrorState, Header, Money, Screen, SkeletonList, StatusBanner, Text, haptic, toast, useSingleFlight } from '@naya/ui';
import { FigureLine } from '@/components/Kit';
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
      <View style={{ gap: 14, marginTop: 4 }}>
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {cash ? <Banknote size={15} color={colors.muted} /> : <CreditCard size={15} color={colors.muted} />}
            <Text variant="caption" tone="muted">
              Tarif final · {cash ? (confirmed ? 'espèces encaissées' : 'espèces à encaisser') : `carte · ${payment?.status === 'confirmed' ? 'paiement confirmé' : payment?.status === 'failed' ? 'paiement refusé' : 'confirmation en cours'}`}
            </Text>
          </View>
          <Money amount={split.gross} variant="display" />
        </View>
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FigureLine label={`Commission · ${formatBp(ride.terms.commissionBp)}`} sub={cash ? 'Débitée du portefeuille' : 'Retenue sur le paiement carte'} value={formatMoney(-split.commission)} />
          <FigureLine label="Revenu net" sub={`${formatMoney(split.gross)} − ${formatMoney(split.commission)}`} value={formatMoney(split.net)} strong />
        </Card>
        {cash && confirmed ? <StatusBanner compact tone="success" title={`Vous gardez ${formatMoney(split.gross)} en espèces`} message={`commission ${formatMoney(split.commission)} débitée`} testID="cash-confirmed" /> : null}
        {!cash && payment?.status === 'pending' ? <StatusBanner compact tone="info" title="Paiement carte en confirmation" message="aucun crédit avant confirmation" testID="card-pending" /> : null}
        {!cash && payment?.status === 'confirmed' ? <StatusBanner compact tone="success" title={`${formatMoney(split.net, { sign: 'always' })} crédités`} message="après compensation d’une dette" testID="card-confirmed" /> : null}
        {!cash && payment?.status === 'failed' ? <StatusBanner compact tone="danger" title="Paiement refusé" message="rien n’est crédité tant que le paiement n’est pas confirmé" testID="card-failed" /> : null}
      </View>
    </Screen>
  );
}
