import { useTheme, Button, Card, ErrorState, Header, Icon, Money, Screen, SkeletonList, StatusBanner, StatusIcon, Text, haptic, paymentMethodIcon, toast, useSingleFlight } from '@naya/ui';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatBp, formatDateTime, formatMoney, paymentMethodPresentation, splitFare } from '@naya/domain';
import { FigureLine } from '@/components/Kit';
import { useAccountId } from '@/lib/queries';

/** D10 · D10-cash · D10-electronic · D10-pending · D10-failed */
export default function RideEnd() {
  useTheme();
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
  const pay = paymentMethodPresentation(ride.paymentMethod);
  const cash = pay.kind === 'cash';
  const state = payment?.status ?? 'pending';
  const confirmed = state === 'confirmed';
  const failed = !cash && state === 'failed';

  // D-17: one line under the amount says where the money is. A refused payment keeps its words in a banner.
  const line = cash
    ? confirmed
      ? { text: `Vous gardez ${formatMoney(split.gross)} en espèces · commission ${formatMoney(split.commission)} débitée du portefeuille`, testID: 'cash-confirmed' }
      : { text: `Espèces à encaisser auprès de ${ride.passenger.firstName}`, testID: 'cash-to-collect' }
    : confirmed
      ? { text: `${formatMoney(split.net, { sign: 'always' })} crédités sur votre portefeuille`, testID: 'card-confirmed' }
      : state === 'pending'
        ? { text: `${pay.label} · paiement en confirmation, aucun crédit avant confirmation`, testID: 'card-pending' }
        : null;

  return (
    <Screen
      header={<Header title="Fin de course" subtitle={`${ride.id} · ${ride.passenger.firstName} · ${ride.completedAt ? formatDateTime(ride.completedAt) : ''}`} onBack={home} />}
      footer={
        cash && !confirmed ? (
          <Button label={`J’ai encaissé ${formatMoney(split.gross)}`} size="major" full loading={collect.isPending} onPress={() => collect.run(split.gross)} testID="confirm-cash" />
        ) : (
          <Button label="Retour à l’accueil" full onPress={home} testID="ride-end-home" />
        )
      }
      testID={`ride-end-${cash ? 'cash' : 'card'}-${payment?.status ?? 'none'}`}
    >
      <View style={{ gap: 16, marginTop: 4 }}>
        {/* A136, C3: the method glyph carries the payment state as a badge. */}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <StatusIcon kind="payment" state={state} announce badgeOn={<Icon icon={paymentMethodIcon(ride.paymentMethod)} size={28} />} testID="ride-end-payment" />
          <Money amount={split.gross} variant="display" />
          {line ? (
            <Text variant="label" tone="muted" align="center" numeric accessibilityLiveRegion="polite" testID={line.testID}>
              {line.text}
            </Text>
          ) : null}
        </View>
        {failed ? <StatusBanner tone="danger" title="Paiement refusé" message="Rien n’est crédité tant que le paiement n’est pas confirmé." testID="card-failed" /> : null}
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FigureLine label={`Commission · ${formatBp(ride.terms.commissionBp)}`} sub={cash ? 'Débitée du portefeuille' : 'Retenue sur le paiement électronique'} value={formatMoney(-split.commission)} />
          <FigureLine label="Revenu net" sub={`${formatMoney(split.gross)} − ${formatMoney(split.commission)}`} value={formatMoney(split.net)} strong />
        </Card>
      </View>
    </Screen>
  );
}
