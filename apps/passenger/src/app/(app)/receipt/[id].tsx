import { useTheme } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, CreditCard, MessageCircle, Star } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney, PAYMENT_STATUS_LABELS, type Payment, type Ride } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, ErrorState, FareBreakdown, FormField, Header, ListGroup, ListRow, Money, PressableScale, Screen, Sheet, SkeletonList, StatusBanner, StatusPill, Text, haptic, toast, useSingleFlight, type BannerTone } from '@naya/ui';
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

  const stops = ride.route.stops;
  const short = (label: string) => label.replace(/^[^·]+·\s*/, '');
  const shownPayment = cancelled ? fee : main;
  const stateIcon = state.tone === 'success' ? <CheckCircle2 size={20} color={colors.success} strokeWidth={2} /> : state.tone === 'danger' ? <AlertCircle size={20} color={colors.danger} strokeWidth={2} /> : <Clock size={20} color={state.tone === 'warning' ? colors.warning : colors.accent} strokeWidth={2} />;
  const stateTile = state.tone === 'success' ? colors.successSoft : state.tone === 'danger' ? colors.dangerSoft : state.tone === 'warning' ? colors.warningSoft : colors.mauveSoft;
  const card = { backgroundColor: colors.surface, borderRadius: 22, padding: 18, gap: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 } as const;

  return (
    <Screen testID="receipt" header={<Header title="Votre reçu" onBack={back} />} footer={<Button label="Terminé" full size="major" variant={ride.rating || cancelled ? 'primary' : 'secondary'} onPress={() => router.dismissTo('/')} testID="receipt-done" />}>
      <View style={{ gap: 14, marginTop: 4 }}>
        {/* ── Amount, status and payment ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 18, flex: 1 }} numberOfLines={1}>{formatDateTime(when)}</Text>
            {shownPayment ? <StatusPill tone={state.tone} label={PAYMENT_STATUS_LABELS[shownPayment.status]} /> : null}
          </View>
          <View style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
            <Text weight="medium" tone="muted" style={{ fontSize: 14, lineHeight: 20 }}>{cancelled ? 'Course annulée' : 'Course terminée'}</Text>
            <View testID="receipt-amount"><Money amount={cancelled ? (fee?.amount ?? 0) : ride.terms.breakdown.total} variant="hero" /></View>
            {cancelled ? <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{ride.cancellation?.fee ? 'Frais d’annulation' : 'Aucun frais'}</Text> : null}
          </View>
          <View testID="payment-state" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 16, padding: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: stateTile, alignItems: 'center', justifyContent: 'center' }}>{stateIcon}</View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text weight="semibold" style={{ fontSize: 14, lineHeight: 19 }}>{state.title}</Text>
              <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{state.message}</Text>
            </View>
          </View>
          {main?.status === 'failed' && !cancelled ? <Button label="Payer avec une autre carte" full onPress={() => setPayOpen(true)} /> : null}
          {!cancelled ? (
            <>
              <PressableScale onPress={() => { haptic.select(); setDetail((d) => !d); }} accessibilityRole="button" accessibilityState={{ expanded: detail }} accessibilityLabel="Détail du prix" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }} testID="receipt-detail-toggle">
                <Text weight="semibold" style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>Détail du prix</Text>
                {detail ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
              </PressableScale>
              {detail ? <FareBreakdown fare={ride.terms.breakdown} distanceMeters={ride.route.distanceMeters} durationSeconds={ride.route.durationSeconds} dynamicReason={ride.terms.dynamic?.reason} /> : null}
            </>
          ) : null}
        </View>
        {cancelled && ride.cancellation ? <StatusBanner compact tone="neutral" title={`Annulée par ${ride.cancellation.by === 'passenger' ? 'vous' : ride.cancellation.by === 'driver' ? 'la chauffeuse' : 'Naya'}`} message={ride.cancellation.reasonText} /> : null}

        {/* ── Trip: route and driver ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} />
              <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: colors.line, marginVertical: 3 }} />
              <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: colors.ink }} />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <View>
                <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Départ</Text>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{short(stops[0]!.label)}</Text>
              </View>
              {stops.length > 2 ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{stops.length - 2} arrêt : {stops.slice(1, -1).map((x) => short(x.label)).join(', ')}</Text> : null}
              <View>
                <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Arrivée</Text>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{short(stops[stops.length - 1]!.label)}</Text>
              </View>
            </View>
            {!cancelled ? (
              <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                <Text weight="semibold" numeric style={{ fontSize: 14, lineHeight: 19 }}>{(ride.route.distanceMeters / 1000).toFixed(1).replace('.', ',')} km</Text>
                <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 18 }}>{Math.round(ride.route.durationSeconds / 60)} min</Text>
              </View>
            ) : null}
          </View>
          {ride.driver ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
                  <Text weight="bold" tone="accent" style={{ fontSize: 17, lineHeight: 22 }}>{ride.driver.firstName.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{ride.driver.firstName} {ride.driver.lastInitial}.</Text>
                  <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{ride.driver.vehicle.make} {ride.driver.vehicle.model} · {ride.driver.vehicle.plate}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* ── Rating ── */}
        {ride.status === 'completed' && ride.driver ? (
          <View style={[card, { alignItems: 'center' }]} testID="rating">
            {ride.rating ? (
              <>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={22} color={colors.accent} fill={ride.rating!.stars >= n ? colors.accent : 'transparent'} />)}
                </View>
                <Text align="center" style={{ fontSize: 15, lineHeight: 21 }}>Merci, vous avez noté {ride.driver.firstName} {ride.rating.stars}/5.</Text>
              </>
            ) : (
              <>
                <Text weight="semibold" align="center" style={{ fontSize: 16, lineHeight: 22 }}>Comment s’est passée votre course avec {ride.driver.firstName} ?</Text>
                <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="adjustable" accessibilityLabel={`Note : ${stars} sur 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <PressableScale key={n} onPress={() => { haptic.select(); setStars(n); }} accessibilityRole="button" accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} accessibilityState={{ selected: stars >= n }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }} testID={`star-${n}`}>
                      <Star size={32} color={colors.accent} fill={stars >= n ? colors.accent : 'transparent'} strokeWidth={1.8} />
                    </PressableScale>
                  ))}
                </View>
                <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{['Touchez une étoile', 'Décevante', 'Moyenne', 'Correcte', 'Très bien', 'Excellente'][stars]}</Text>
                {stars > 0 ? (
                  <View style={{ alignSelf: 'stretch', gap: 10 }}>
                    <FormField label="Un commentaire (facultatif)" value={comment} onChangeText={setComment} maxLength={500} />
                    <Button label="Envoyer ma note" full loading={rate.isPending} onPress={() => rate.mutate()} testID="send-rating" />
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {/* ── Help ── */}
        <PressableScale onPress={() => router.push({ pathname: '/support/new', params: { rideId: ride.id } })} testID="receipt-help" accessibilityRole="button" pressedScale={0.985} style={[card, { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}><MessageCircle size={20} color={colors.accent} strokeWidth={1.9} /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Aide sur cette course</Text>
            <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Prix, objet oublié, incident…</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
        </PressableScale>
        <Text tone="muted" align="center" numeric style={{ fontSize: 12, lineHeight: 16 }}>Course {ride.id}</Text>
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
