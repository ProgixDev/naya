import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, CreditCard, LifeBuoy, Star } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, isRideActive, paymentMethodPresentation, paymentReceiptState } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, ErrorState, FareBreakdown, FormField, Header, Icon, ListGroup, ListRow, Money, PressableScale, Screen, Sheet, SkeletonList, StatusBanner, StatusIcon, Text, haptic, paymentIcon, toast, useSingleFlight, useTheme } from '@naya/ui';
import { useAccountId, usePaymentMethods, useRide } from '@/lib/queries';

const BY = { passenger: 'vous', driver: 'la chauffeuse' } as const;

export default function Receipt() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useRide(id, true);
  const methods = usePaymentMethods();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const rate = useMutation({
    mutationFn: () => api.rides.rate(id, stars, comment.trim() || null),
    onSuccess: () => {
      haptic.success();
      toast('Merci pour votre note', 'success');
      qc.invalidateQueries({ queryKey: qk.ride(a, id) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const retry = useSingleFlight((pmId: string, key: string) => api.rides.retryPayment(id, pmId, key), {
    onSuccess: () => {
      setPayOpen(false);
      retry.reset();
      toast('Nouveau paiement envoyé', 'success');
      qc.invalidateQueries({ queryKey: qk.ride(a, id) });
    },
    onError: (e) => {
      retry.reset();
      toast(errorMessage(e), 'danger');
    },
  });

  const back = () => (router.canGoBack() ? router.back() : router.dismissTo('/'));
  if (q.isLoading) return <Screen header={<Header title="Votre reçu" onBack={back} />}><SkeletonList rows={3} /></Screen>;
  if (q.isError || !q.data) return <Screen header={<Header title="Votre reçu" onBack={back} />}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const { ride, payments } = q.data;

  // PAX-10: a ride that is still under way (a dispatched booking, a search with no chauffeuse yet) has no
  // receipt. Say what is happening and send her to the live ride; this query polls, so the receipt appears
  // here by itself once the ride ends.
  if (isRideActive(ride.status) || ride.status === 'no_driver') {
    return (
      <Screen
        testID="receipt-live"
        header={<Header title="Votre course" subtitle={ride.id} onBack={back} />}
        footer={<Button label="Suivre la course" full size="major" onPress={() => router.replace('/ride')} testID="receipt-open-ride" />}
      >
        <View style={{ alignItems: 'center', gap: 12, marginTop: 24 }}>
          <StatusIcon kind="ride" state={ride.status} size="lg" variant="disc" showLabel wording="full" testID="receipt-ride-status" />
          <Text variant="label" tone="muted" align="center">Le reçu sera disponible à la fin de la course.</Text>
        </View>
      </Screen>
    );
  }

  const main = payments.filter((p) => p.purpose === 'ride').sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
  const fee = payments.find((p) => p.purpose === 'cancellation_fee');
  const cancelled = ride.status === 'cancelled';
  const shown = cancelled ? fee : main;
  // P14: one presentation per method, so wallet and mobile payments never read « Carte ».
  const method = paymentMethodPresentation(ride.paymentMethod);
  const state = paymentReceiptState(ride.paymentMethod, shown, cancelled);
  const failed = main?.status === 'failed' && !cancelled;
  const when = ride.completedAt ?? ride.cancellation?.at ?? ride.requestedAt;
  const noFee = cancelled && !ride.cancellation?.fee;
  const methodGlyph = <Icon icon={paymentIcon(method.icon)} size={24} color={colors.ink} />;

  return (
    <Screen testID="receipt" header={<Header title="Votre reçu" subtitle={`${ride.id} · ${formatDateTime(when)}`} onBack={back} />} footer={<Button label="Terminé" full size="major" variant={ride.rating || cancelled ? 'primary' : 'secondary'} onPress={() => router.dismissTo('/')} testID="receipt-done" />}>
      <View style={{ gap: 16, marginTop: 8 }}>
        <Card>
          <View style={{ gap: 4 }}>
            {/* What happened to the ride, once; the payment state is the line under the amount (P-30). */}
            <Text variant="caption" tone="muted" weight="semibold" testID="receipt-outcome">
              {cancelled ? (ride.cancellation ? `Course annulée par ${BY[ride.cancellation.by as keyof typeof BY] ?? 'Naya'}` : 'Course annulée') : 'Course terminée'}
            </Text>
            <View testID="receipt-amount"><Money amount={cancelled ? (fee?.amount ?? 0) : ride.terms.breakdown.total} variant="hero" /></View>
            {cancelled && ride.cancellation?.reasonText ? <Text variant="caption" tone="muted">{ride.cancellation.reasonText}</Text> : null}
          </View>
          {noFee ? (
            <Text variant="label" tone="muted" style={{ marginTop: 12 }} testID="payment-state">Aucun frais · rien n’a été débité</Text>
          ) : failed ? null : (
            // Method glyph with the payment state as its badge, then one sentence (A64, A65, P-30).
            <View accessible accessibilityLabel={[state.title, state.message].filter(Boolean).join('. ')} testID="payment-state" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
              {shown ? <StatusIcon kind="payment" state={shown.status} badgeOn={methodGlyph} accessible={false} showLabel={false} testID="receipt-method" /> : <View testID="receipt-method">{methodGlyph}</View>}
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" weight="semibold">{state.title}</Text>
                {state.message ? <Text variant="caption" tone="muted">{state.message}</Text> : null}
              </View>
            </View>
          )}
          {!cancelled ? (
            <>
              <PressableScale onPress={() => setDetail((d) => !d)} accessibilityRole="button" accessibilityState={{ expanded: detail }} aria-expanded={detail} accessibilityLabel="Détail du prix" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.line }} testID="receipt-detail-toggle">
                <Text variant="label" weight="semibold" style={{ flex: 1 }}>Détail du prix</Text>
                {detail ? <ChevronUp size={20} color={colors.muted} /> : <ChevronDown size={20} color={colors.muted} />}
              </PressableScale>
              {detail ? (
                <View style={{ marginTop: 4 }}>
                  <FareBreakdown fare={ride.terms.breakdown} distanceMeters={ride.route.distanceMeters} durationSeconds={ride.route.durationSeconds} dynamicReason={ride.terms.dynamic?.reason} />
                </View>
              ) : null}
            </>
          ) : null}
        </Card>

        {/* A refused payment is a problem: glyph, word, reason and one move (principle 3). */}
        {failed ? <StatusBanner kind="payment" state="failed" title={state.title} message={state.message} action={{ label: 'Payer avec une autre carte', onPress: () => setPayOpen(true) }} testID="payment-state" /> : null}

        {ride.status === 'completed' && ride.driver ? (
          ride.rating ? (
            <Text variant="label" tone="muted" align="center" testID="rating">Merci, vous avez noté {ride.driver.firstName} {ride.rating.stars}/5.</Text>
          ) : (
            <Card testID="rating">
              <View style={{ gap: 12, alignItems: 'center' }}>
                <Text variant="heading" weight="semibold" align="center">Notez {ride.driver.firstName}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="adjustable" accessibilityLabel={`Note : ${stars} sur 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <PressableScale key={n} onPress={() => { haptic.select(); setStars(n); }} accessibilityRole="button" accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} accessibilityState={{ selected: stars >= n }} aria-selected={stars >= n} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }} testID={`star-${n}`}>
                      <Star size={38} strokeWidth={2} color={colors.accent} fill={stars >= n ? colors.accent : 'transparent'} />
                    </PressableScale>
                  ))}
                </View>
                {stars > 0 ? (
                  <View style={{ gap: 12, alignSelf: 'stretch' }}>
                    <FormField label="Un commentaire (facultatif)" value={comment} onChangeText={setComment} maxLength={500} />
                    <Button label="Envoyer ma note" variant="secondary" full loading={rate.isPending} onPress={() => rate.mutate()} testID="send-rating" />
                  </View>
                ) : null}
              </View>
            </Card>
          )
        ) : null}

        <ListGroup>
          <ListRow title={ride.route.stops.map((s) => s.label).join(' → ')} subtitle={[ride.route.stops.length > 2 ? `${ride.route.stops.length - 2} arrêt : ${ride.route.stops.slice(1, -1).map((s) => s.label).join(', ')}` : null, ride.driver ? `${ride.driver.firstName} ${ride.driver.lastInitial}. · ${ride.driver.vehicle.plate}` : null].filter(Boolean).join(' · ')} testID="receipt-route" />
          <ListRow title="Aide sur cette course" leading={<Icon icon={LifeBuoy} size={24} color={colors.ink} />} onPress={() => router.push({ pathname: '/support/new', params: { rideId: ride.id } })} testID="receipt-help" />
        </ListGroup>
      </View>

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title="Payer avec une autre carte" subtitle={`${formatMoney(ride.terms.breakdown.total)} · ${ride.id}`}>
        <View style={{ gap: 12 }}>
          <ListGroup>
            {(methods.data ?? []).filter((m) => m.kind === 'card').map((m) => (
              <ListRow key={m.id} title={paymentMethodPresentation(m).label} leading={<Icon icon={CreditCard} size={24} color={colors.ink} />} onPress={() => retry.run(m.id)} chevron={false} testID={`retry-${m.last4}`} />
            ))}
          </ListGroup>
          {retry.isPending ? <Text variant="caption" tone="muted">Envoi au prestataire…</Text> : null}
          <Button label="Ajouter une carte" variant="ghost" full onPress={() => { setPayOpen(false); router.push('/card/new'); }} />
        </View>
      </Sheet>
    </Screen>
  );
}
