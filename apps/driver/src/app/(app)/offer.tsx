import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CircleSlash, Clock3, CreditCard, MapPin, XCircle } from 'lucide-react-native';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import { formatDistance, formatDuration, formatMoney, OFFER_DECLINE_REASONS, type DriverOffer } from '@naya/domain';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { Button, CountdownRing, IconDisc, Money, NayaMap, Pill, Sheet, StatusBanner, Text, TextButton, haptic, useSingleFlight } from '@naya/ui';
import { useAccountId, useDriverStatus } from '@/lib/queries';

type Phase = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'taken';

/** D07 · D07-10 · D07-timer-* · D07-declined · D07-expired · D07-withdrawn */
export default function OfferScreen() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const status = useDriverStatus();
  const [snapshot, setSnapshot] = useState<DriverOffer | null>(status.data?.offer ?? null);
  const [localPhase, setLocalPhase] = useState<Phase | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<string>('too_far');
  const warned = useRef(false);

  // Keep the offer we are showing; update it with the server's view of the same offer.
  useEffect(() => {
    const o = status.data?.offer;
    if (o && (!snapshot || o.id === snapshot.id || snapshot.status !== 'pending')) setSnapshot(o);
  }, [status.data?.offer]); // eslint-disable-line react-hooks/exhaustive-deps

  const offer = snapshot;
  const { seconds, expired } = useDeadline(offer?.status === 'pending' ? offer.expiresAt : null);
  useEffect(() => {
    if (offer?.status === 'pending' && seconds === 10 && !warned.current) {
      warned.current = true;
      haptic.warning();
    }
  }, [seconds, offer?.status]);

  const accept = useSingleFlight((id: string, key) => api.driver.acceptOffer(id, key), {
    onSuccess: () => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
      router.replace('/ride');
    },
    onError: (e) => {
      haptic.error();
      if (isApiError(e) && e.code === 'OFFER_EXPIRED') setLocalPhase('expired');
      else if (isApiError(e) && (e.code === 'RIDE_ALREADY_ASSIGNED' || e.code === 'OFFER_NOT_PENDING')) setLocalPhase('taken');
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
  });
  const decline = useMutation({
    mutationFn: () => api.driver.declineOffer(offer!.id, reason),
    onSuccess: (o) => {
      setSnapshot(o);
      setDeclineOpen(false);
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
    onError: (e) => {
      setDeclineOpen(false);
      setLocalPhase(isApiError(e) && e.code === 'OFFER_NOT_PENDING' ? 'withdrawn' : null);
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
  });

  const phase: Phase = localPhase ?? (offer?.status === 'pending' ? 'pending' : ((offer?.status as Phase) ?? 'withdrawn'));
  const back = () => (router.canGoBack() ? router.back() : router.dismissTo('/'));

  if (!offer) {
    return (
      <Terminal insetsTop={insets.top} icon={<CircleSlash size={26} color={colors.accent} />} title="Aucune proposition" message="Restez en ligne : la prochaine course s’affichera ici." onBack={back} />
    );
  }
  if (phase !== 'pending' || (phase === 'pending' && offer.status !== 'pending')) {
    const t = {
      accepted: { title: 'Course acceptée', message: 'Le guidage vers la passagère est prêt.', icon: <Clock3 size={26} color={colors.success} />, cta: { label: 'Rejoindre la passagère', onPress: () => router.replace('/ride') } },
      declined: { title: 'Proposition refusée', message: 'Vous restez en ligne. Une autre chauffeuse reçoit cette course.', icon: <XCircle size={26} color={colors.accent} /> },
      expired: { title: 'Proposition expirée', message: 'Le délai de 30 secondes est écoulé. Aucune course n’a été acceptée automatiquement.', icon: <Clock3 size={26} color={colors.warning} /> },
      withdrawn: { title: 'Proposition retirée', message: 'La passagère a annulé sa demande avant votre réponse.', icon: <CircleSlash size={26} color={colors.accent} /> },
      taken: { title: 'Course déjà attribuée', message: 'Cette course n’est plus disponible. Vous restez en ligne.', icon: <CircleSlash size={26} color={colors.accent} /> },
    }[phase === 'pending' ? 'expired' : phase];
    return <Terminal insetsTop={insets.top} testID={`offer-${phase}`} icon={t.icon} title={t.title} message={t.message} onBack={back} cta={'cta' in t ? t.cta : undefined} />;
  }

  const stops = offer.route.stops;
  const pickup = stops[0]!;
  const destination = stops[stops.length - 1]!;
  const via = stops.slice(1, -1).map((s) => s.label);
  const timeUp = expired;
  return (
    <View style={{ flex: 1, backgroundColor: colors.map }} testID="offer-pending">
      <NayaMap
        center={pickup.location}
        route={offer.route.polyline}
        fitTo={offer.route.polyline}
        markers={stops.map((s, i) => ({ id: `s${i}`, kind: i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop', coordinate: s.location, label: s.label }))}
        bottomInset={470}
        topInset={insets.top}
        interactive={false}
      />
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 20, gap: 14, ...shadow.float }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text variant="heading" accessibilityRole="header">
              Nouvelle course
            </Text>
            <Text variant="caption" tone="muted" numeric>
              Prise en charge à {formatDuration(offer.pickupEtaSeconds)} · {formatDistance(offer.pickupDistanceMeters)} de vous
            </Text>
          </View>
          <View testID="offer-countdown" style={{ flexShrink: 0 }}>
            <CountdownRing seconds={seconds} total={30} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 6 }}>
          <View testID="offer-fare">
            <Money amount={offer.fare} variant="display" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 12, minHeight: 32, paddingVertical: 4 }}>
            {offer.paymentKind === 'cash' ? <Banknote size={16} color={colors.ink} /> : <CreditCard size={16} color={colors.ink} />}
            <Text variant="caption" weight="semibold">
              {offer.paymentKind === 'cash' ? 'Espèces' : 'Carte'}
            </Text>
          </View>
        </View>
        <Text variant="caption" tone="muted" numeric style={{ marginTop: -8 }}>
          {formatDistance(offer.route.distanceMeters)} · {formatDuration(offer.route.durationSeconds)} de trajet estimé
        </Text>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: colors.accent }} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {pickup.label}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {pickup.address}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <MapPin size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {destination.label}
                {via.length ? ` · via ${via.join(', ')}` : ''}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {destination.address}
                {via.length ? ` · ${via.length} arrêt${via.length > 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.row, padding: 12 }} accessible accessibilityLabel={`Votre revenu net estimé ${formatMoney(offer.estimatedNet)}, commission ${formatMoney(offer.commission)}`}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text variant="label">Votre revenu net estimé</Text>
            <Text variant="micro" tone="muted" numeric>
              Commission Naya {formatMoney(offer.commission)}
              {offer.paymentKind === 'cash' ? ' · débitée du portefeuille' : ''}
            </Text>
          </View>
          <View testID="offer-net" style={{ flexShrink: 0 }}>
            <Money amount={offer.estimatedNet} tone="accent" />
          </View>
        </View>

        {accept.isError && !localPhase ? <StatusBanner tone="danger" title="Acceptation impossible" message={errorMessage(accept.error)} /> : null}
        <Button label={timeUp ? 'Délai écoulé' : 'Accepter la course'} size="major" full loading={accept.isPending} loadingLabel="Confirmation auprès de Naya…" disabled={timeUp} onPress={() => accept.run(offer.id)} testID="accept-offer" />
        <TextButton label="Refuser" onPress={() => setDeclineOpen(true)} testID="decline-offer" />
      </View>

      <Sheet visible={declineOpen} onClose={() => setDeclineOpen(false)} title="Refuser la course" subtitle="Votre motif aide à mieux répartir les courses." footer={<Button label="Confirmer le refus" full loading={decline.isPending} onPress={() => decline.mutate()} testID="confirm-decline" />}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OFFER_DECLINE_REASONS.map((r) => (
            <Pill key={r.code} label={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`decline-${r.code}`} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function Terminal({ icon, title, message, onBack, cta, insetsTop, testID }: { icon: React.ReactNode; title: string; message: string; onBack: () => void; cta?: { label: string; onPress: () => void }; insetsTop: number; testID?: string }) {
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insetsTop + 40, paddingHorizontal: gutter, gap: 16 }}>
      <IconDisc size={56}>{icon}</IconDisc>
      <Text variant="hero" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" tone="muted">
        {message}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ paddingBottom: 40, gap: 8 }}>
        {cta ? <Button label={cta.label} size="major" full onPress={cta.onPress} /> : null}
        <Button label="Retour à l’accueil" variant={cta ? 'ghost' : 'primary'} size="major" full onPress={onBack} testID="offer-back" />
      </View>
    </View>
  );
}
