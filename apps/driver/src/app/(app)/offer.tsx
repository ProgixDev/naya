import { useTheme, Button, CountdownRing, Icon, ListGroup, ListRow, NayaMap, Sheet, StatusBanner, StatusIcon, Text, TextButton, haptic, paymentMethodIcon, useSingleFlight } from '@naya/ui';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react-native';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import { formatDistance, formatDuration, formatMoney, paymentMethodPresentation, OFFER_DECLINE_REASONS, type Centimes, type DriverOffer } from '@naya/domain';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { useAccountId, useDriverStatus } from '@/lib/queries';

type Phase = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'taken';

/** Haptic ticks while the offer runs out (D-10): the ring also turns red from 10 s. */
const TICKS = [10, 5];

/** The response window of this offer, from the server's own deadline (DRV-05, DRV-12); the city's setting otherwise. */
function windowSeconds(offer: DriverOffer | null, citySeconds: number | undefined): number {
  const fromOffer = offer ? Math.round((Date.parse(offer.expiresAt) - Date.parse(offer.createdAt)) / 1000) : NaN;
  if (Number.isFinite(fromOffer) && fromOffer > 0) return fromOffer;
  return citySeconds ?? 30;
}

/** D07 · D07-10 · D07-timer-* · D07-declined · D07-expired · D07-withdrawn */
export default function OfferScreen() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const status = useDriverStatus();
  const [snapshot, setSnapshot] = useState<DriverOffer | null>(status.data?.offer ?? null);
  const [localPhase, setLocalPhase] = useState<Phase | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  // D-16: no reason is chosen for her.
  const [reason, setReason] = useState<string | null>(null);
  const [cardHeight, setCardHeight] = useState(470);
  const ticked = useRef(new Set<number>());

  // Keep the offer we are showing; update it with the server's view of the same offer.
  const currentOffer = status.data?.offer;
  if (currentOffer && currentOffer !== snapshot && (!snapshot || currentOffer.id === snapshot.id || snapshot.status !== 'pending')) setSnapshot(currentOffer);

  const offer = snapshot;
  const total = windowSeconds(offer, status.data?.city.offerTimeoutSeconds);
  const { seconds, expired } = useDeadline(offer?.status === 'pending' ? offer.expiresAt : null);
  useEffect(() => {
    if (offer?.status !== 'pending') return;
    for (const t of TICKS) {
      if (seconds === t && t < total && !ticked.current.has(t)) {
        ticked.current.add(t);
        haptic.warning();
      }
    }
  }, [seconds, offer?.status, total]);

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
    mutationFn: (code: string) => api.driver.declineOffer(offer!.id, code),
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
  const showingOffer = !!offer && phase === 'pending' && offer.status === 'pending';
  const back = () => (router.canGoBack() ? router.back() : router.dismissTo('/'));

  // DRV-19: a pending offer is answered with « Accepter » or « Refuser », never dismissed by the Android back button.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showingOffer) {
        if (!declineOpen) setDeclineOpen(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showingOffer, declineOpen]);

  if (!offer) {
    return (
      <Terminal
        insetsTop={insets.top}
        glyph={<StatusIcon kind="driverAvailability" state={status.data?.online ? 'online' : 'offline'} size="lg" variant="disc" showLabel={false} accessible={false} />}
        title="Aucune proposition"
        message="Restez en ligne : la prochaine course s’affichera ici."
        onBack={back}
      />
    );
  }
  if (!showingOffer) {
    const end: Exclude<Phase, 'pending'> = phase === 'pending' ? 'expired' : phase;
    const t = {
      accepted: { title: 'Course acceptée', message: 'Le guidage vers la passagère est prêt.', cta: { label: 'Rejoindre la passagère', onPress: () => router.replace('/ride') } },
      declined: { title: 'Proposition refusée', message: 'Vous restez en ligne. Une autre chauffeuse reçoit cette course.' },
      expired: { title: 'Proposition expirée', message: `Le délai de ${total} secondes est écoulé. Aucune course n’a été acceptée automatiquement.` },
      withdrawn: { title: 'Proposition retirée', message: 'La passagère a annulé sa demande avant votre réponse.' },
      taken: { title: 'Course déjà attribuée', message: 'Cette course n’est plus disponible. Vous restez en ligne.' },
    }[end];
    // A134, C2: each end has its own glyph; the title carries the word, so the glyph stays silent.
    return (
      <Terminal
        insetsTop={insets.top}
        testID={`offer-${phase}`}
        glyph={<StatusIcon kind="offer" state={end} size="lg" variant="disc" showLabel={false} accessible={false} testID="offer-end-status" />}
        title={t.title}
        message={t.message}
        onBack={back}
        cta={'cta' in t ? t.cta : undefined}
      />
    );
  }

  const stops = offer.route.stops;
  const pickup = stops[0]!;
  const destination = stops[stops.length - 1]!;
  const via = stops.slice(1, -1).map((s) => s.label);
  const timeUp = expired;
  const pay = paymentMethodPresentation(offer.paymentKind);
  const cash = offer.paymentKind === 'cash';
  // DRV-14: the card stays under the status bar; with the largest text its details scroll and the answer stays pinned.
  const cardMax = windowHeight - insets.top - 24 - Math.max(insets.bottom, 12);
  return (
    <View style={{ flex: 1, backgroundColor: colors.map }} testID="offer-pending">
      <NayaMap
        center={pickup.location}
        route={offer.route.polyline}
        fitTo={offer.route.polyline}
        markers={stops.map((s, i) => ({ id: `s${i}`, kind: i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop', coordinate: s.location, label: s.label }))}
        bottomInset={Math.min(cardHeight, cardMax) + 12}
        topInset={insets.top}
        interactive={false}
      />
      <View
        onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}
        style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12), maxHeight: cardMax, backgroundColor: colors.surface, borderRadius: radius.sheet, ...shadow.float, overflow: 'hidden' }}
      >
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 14 }} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text variant="heading" accessibilityRole="header">
                Nouvelle course
              </Text>
              <Text variant="caption" tone="muted" numeric>
                {offer.service?.name ? `${offer.service.name} · ` : ''}
                Prise en charge à {formatDuration(offer.pickupEtaSeconds)} · {formatDistance(offer.pickupDistanceMeters)} de vous
              </Text>
            </View>
            <View testID="offer-countdown" style={{ flexShrink: 0 }}>
              <CountdownRing seconds={seconds} total={total} />
            </View>
          </View>

          {/* D-09: what she decides on, the net, sits beside the fare at the same size. */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Figure label="Prix de la course" amount={offer.fare} testID="offer-fare" />
            <Figure label="Net pour vous" amount={offer.estimatedNet} accent testID="offer-net" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6, marginTop: -4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 12, minHeight: 32, paddingVertical: 4 }} testID="offer-payment">
              <Icon icon={paymentMethodIcon(offer.paymentKind)} size={16} color={colors.ink} />
              <Text variant="caption" weight="semibold">
                {pay.shortLabel}
              </Text>
            </View>
            <Text variant="caption" tone="muted" numeric style={{ flexShrink: 1 }}>
              Commission Naya {formatMoney(offer.commission)}
              {cash ? ' · débitée du portefeuille' : ''}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ position: 'absolute', left: 8, top: 22, bottom: 22, width: 2, borderRadius: 1, backgroundColor: colors.selected }} />
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: colors.accent, backgroundColor: colors.surface }} />
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
              <MapPin size={18} color={colors.accent} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {destination.label}
                  {via.length ? ` · via ${via.join(', ')}` : ''}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1} numeric>
                  {formatDistance(offer.route.distanceMeters)} · {formatDuration(offer.route.durationSeconds)} de trajet
                  {via.length ? ` · ${via.length} arrêt${via.length > 1 ? 's' : ''}` : ''}
                </Text>
              </View>
            </View>
          </View>

          {accept.isError && !localPhase ? <StatusBanner tone="danger" title="Acceptation impossible" message={errorMessage(accept.error)} /> : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
          <Button label={timeUp ? 'Délai écoulé' : 'Accepter la course'} size="major" full loading={accept.isPending} loadingLabel="Confirmation auprès de Naya…" disabled={timeUp} onPress={() => accept.run(offer.id)} testID="accept-offer" />
          <TextButton label="Refuser" onPress={() => setDeclineOpen(true)} testID="decline-offer" />
        </View>
      </View>

      <Sheet
        visible={declineOpen}
        onClose={() => !decline.isPending && setDeclineOpen(false)}
        dismissible={!decline.isPending}
        title="Refuser la course"
        subtitle="Votre motif aide à mieux répartir les courses."
        testID="decline-sheet"
        footer={<Button label="Confirmer le refus" full disabled={!reason} disabledReason={reason ? undefined : 'Choisissez un motif.'} loading={decline.isPending} onPress={() => reason && decline.mutate(reason)} testID="confirm-decline" />}
      >
        <ListGroup>
          {OFFER_DECLINE_REASONS.map((r) => (
            <ListRow key={r.code} title={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`decline-${r.code}`} />
          ))}
        </ListGroup>
      </Sheet>
    </View>
  );
}

/** One of the two co-hero amounts: tabular, one line, shrinking rather than wrapping. */
function Figure({ label, amount, accent, testID }: { label: string; amount: Centimes; accent?: boolean; testID: string }) {
  useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${label} ${formatMoney(amount)}`} testID={testID}>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="screen" weight="bold" tone={accent ? 'accent' : 'ink'} numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>
        {formatMoney(amount)}
      </Text>
    </View>
  );
}

function Terminal({ glyph, title, message, onBack, cta, insetsTop, testID }: { glyph: React.ReactNode; title: string; message: string; onBack: () => void; cta?: { label: string; onPress: () => void }; insetsTop: number; testID?: string }) {
  useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insetsTop + 40, paddingHorizontal: gutter, gap: 16 }}>
      <View style={{ alignItems: 'flex-start' }}>{glyph}</View>
      <Text variant="screen" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" tone="muted">
        {message}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ paddingBottom: 40, gap: 8 }}>
        {cta ? <Button label={cta.label} size="major" full onPress={cta.onPress} testID="offer-join" /> : null}
        <Button label="Retour à l’accueil" variant={cta ? 'ghost' : 'primary'} full onPress={onBack} testID="offer-back" />
      </View>
    </View>
  );
}
