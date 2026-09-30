import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, MessageCircle, Route as RouteIcon, Star } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, PAYMENT_STATUS_LABELS, type Payment, type Ride } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, ErrorState, FareBreakdown, FormField, Header, IconDisc, ListGroup, ListRow, Money, PressableScale, Screen, Sheet, SkeletonList, StatusBanner, StatusPill, Text, haptic, toast, useSingleFlight, type BannerTone } from '@naya/ui';
import { useAccountId, usePaymentMethods, useRide } from '@/lib/queries';

function paymentState(ride: Ride, p: Payment | undefined): { tone: BannerTone; title: string; message: string } {
  if (!p) return ride.status === 'cancelled' ? { tone: 'success', title: 'Aucun paiement', message: 'Course annulée sans frais.' } : { tone: 'info', title: 'Paiement en préparation', message: 'Le paiement est créé à l’arrivée.' };
  if (p.method === 'cash') {
    return p.status === 'confirmed'
      ? { tone: 'success', title: 'Espèces · paiement confirmé', message: `${formatMoney(p.amount)} remis à la chauffeuse.` }
      : { tone: 'info', title: p.purpose === 'cancellation_fee' ? 'Frais à régler' : 'Espèces · à remettre à la chauffeuse', message: p.purpose === 'cancellation_fee' ? `${formatMoney(p.amount)} à régler avec votre prochaine course.` : `${formatMoney(p.amount)} à régler en fin de trajet.` };
  }
  if (p.status === 'confirmed') return { tone: 'success', title: 'Carte · paiement confirmé', message: `${formatMoney(p.amount)} débités sur ${ride.paymentMethod.label}.` };
  if (p.status === 'failed') return { tone: 'danger', title: 'Paiement refusé', message: `${p.failureReason ?? 'La banque a refusé le paiement.'} Réglez avec une autre carte.` };
  return { tone: 'warning', title: 'Paiement en attente de confirmation', message: 'Le prestataire n’a pas encore confirmé le débit. Rien n’est débité deux fois ; cette page se met à jour.' };
}

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useRide(id, true);
  const methods = usePaymentMethods();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const rate = useMutation({
    mutationFn: () => api.rides.rate(id, stars, comment.trim() || null),
    onSuccess: () => {
      haptic.success();
      toast('Merci pour votre note');
      qc.invalidateQueries({ queryKey: qk.ride(a, id) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const retry = useSingleFlight((pmId: string, key: string) => api.rides.retryPayment(id, pmId, key), {
    onSuccess: () => {
      setPayOpen(false);
      retry.reset();
      toast('Nouveau paiement envoyé');
      qc.invalidateQueries({ queryKey: qk.ride(a, id) });
    },
    onError: (e) => {
      retry.reset();
      toast(errorMessage(e), 'danger');
    },
  });

  if (q.isLoading) return <Screen header={<Header title="Votre reçu" onBack={() => router.back()} />}><SkeletonList rows={3} /></Screen>;
  if (q.isError || !q.data) return <Screen header={<Header title="Votre reçu" onBack={() => router.back()} />}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const { ride, payments } = q.data;
  const main = payments.filter((p) => p.purpose === 'ride').sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
  const fee = payments.find((p) => p.purpose === 'cancellation_fee');
  const cancelled = ride.status === 'cancelled';
  const state = paymentState(ride, cancelled ? fee : main);
  const when = ride.completedAt ?? ride.cancellation?.at ?? ride.requestedAt;
  const back = () => (router.canGoBack() ? router.back() : router.dismissTo('/'));

  return (
    <Screen testID="receipt" header={<Header title="Votre reçu" subtitle={`${ride.id} · ${formatDateTime(when)}`} onBack={back} />} footer={<Button label="Terminé" full size="major" variant={ride.rating || cancelled ? 'primary' : 'secondary'} onPress={() => router.dismissTo('/')} testID="receipt-done" />}>
      <View style={{ gap: 16, marginTop: 12 }}>
        <Card>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="heading">{cancelled ? 'Course annulée' : 'Course terminée'}</Text>
              {(cancelled ? fee : main) ? <StatusPill tone={state.tone} label={PAYMENT_STATUS_LABELS[(cancelled ? fee : main)!.status]} /> : null}
            </View>
            <View testID="receipt-amount"><Money amount={cancelled ? (fee?.amount ?? 0) : ride.terms.breakdown.total} variant="hero" /></View>
            <Text variant="caption" tone="muted">{cancelled ? (ride.cancellation?.fee ? 'Frais d’annulation' : 'Aucun frais') : ride.paymentMethod.label}</Text>
          </View>
        </Card>
        <StatusBanner tone={state.tone} title={state.title} message={state.message} action={main?.status === 'failed' && !cancelled ? { label: 'Payer avec une autre carte', onPress: () => setPayOpen(true) } : undefined} testID="payment-state" />
        {cancelled && ride.cancellation ? <StatusBanner tone="neutral" title={`Annulée par ${ride.cancellation.by === 'passenger' ? 'vous' : ride.cancellation.by === 'driver' ? 'la chauffeuse' : 'Naya'}`} message={`Motif : ${ride.cancellation.reasonText}`} /> : null}

        <ListGroup>
          <ListRow title={ride.route.stops.map((s) => s.label).join(' → ')} subtitle={[ride.route.stops.length > 2 ? `${ride.route.stops.length - 2} arrêt : ${ride.route.stops.slice(1, -1).map((s) => s.label).join(', ')}` : null, ride.driver ? `${ride.driver.firstName} ${ride.driver.lastInitial}. · ${ride.driver.vehicle.plate}` : null].filter(Boolean).join(' · ')} leading={<IconDisc><RouteIcon size={18} color={colors.accent} /></IconDisc>} />
          <ListRow title="Aide sur cette course" subtitle="Ouvrir une demande liée à la course" leading={<IconDisc><MessageCircle size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push({ pathname: '/support/new', params: { rideId: ride.id } })} testID="receipt-help" />
        </ListGroup>

        {!cancelled ? (
          <View style={{ gap: 8 }}>
            <Text variant="heading">Détail du prix</Text>
            <Card>
              <FareBreakdown fare={ride.terms.breakdown} distanceMeters={ride.route.distanceMeters} durationSeconds={ride.route.durationSeconds} dynamicReason={ride.terms.dynamic?.reason} />
            </Card>
            <Text variant="caption" tone="muted">Prix fixé à la confirmation (règles v{ride.terms.ruleVersion}).</Text>
          </View>
        ) : null}

        {ride.status === 'completed' && ride.driver ? (
          <Card testID="rating">
            {ride.rating ? (
              <Text variant="label">Merci, vous avez noté {ride.driver.firstName} {ride.rating.stars}/5.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                <Text variant="heading">Comment s’est passé votre trajet ?</Text>
                <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="adjustable" accessibilityLabel={`Note : ${stars} sur 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <PressableScale key={n} onPress={() => { haptic.select(); setStars(n); }} accessibilityRole="button" accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} accessibilityState={{ selected: stars >= n }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }} testID={`star-${n}`}>
                      <Star size={32} color={colors.accent} fill={stars >= n ? colors.accent : 'transparent'} />
                    </PressableScale>
                  ))}
                </View>
                {stars > 0 ? <FormField label="Un commentaire (facultatif)" value={comment} onChangeText={setComment} multiline maxLength={500} /> : null}
                <Button label="Envoyer ma note" variant="secondary" disabled={stars === 0} loading={rate.isPending} onPress={() => rate.mutate()} testID="send-rating" />
              </View>
            )}
          </Card>
        ) : null}
      </View>

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title="Payer avec une autre carte" subtitle={`${formatMoney(ride.terms.breakdown.total)} · ${ride.id}`}>
        <View style={{ gap: 12 }}>
          <ListGroup>
            {(methods.data ?? []).filter((m) => m.kind === 'card').map((m) => (
              <ListRow key={m.id} title={m.label} leading={<CreditCard size={20} color={colors.ink} />} onPress={() => retry.run(m.id)} testID={`retry-${m.last4}`} />
            ))}
          </ListGroup>
          {retry.isPending ? <Text variant="caption" tone="muted">Envoi au prestataire…</Text> : null}
          <Button label="Ajouter une carte" variant="ghost" full onPress={() => { setPayOpen(false); router.push('/card/new'); }} />
        </View>
      </Sheet>
    </Screen>
  );
}
