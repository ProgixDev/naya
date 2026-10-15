import { useTheme, Button, Icon, IconButton, ListGroup, ListRow, NayaMap, OtherEmergencyNumbers, SafetyDisc, Sheet, StatusBanner, StatusIcon, Text, TextButton, haptic, paymentMethodIcon, toast, useSingleFlight } from '@naya/ui';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Navigation, Star } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { DRIVER_CANCEL_REASONS, formatMoney, formatTime, haversineMeters, paymentMethodPresentation, type LatLng, type Ride } from '@naya/domain';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { useAccountId, useDriverStatus } from '@/lib/queries';
import { BackgroundLocationExplainer } from '@/components/BackgroundLocationExplainer';

function openNavigation(to: LatLng, label: string) {
  const q = `${to.lat},${to.lng}`;
  const url = Platform.OS === 'ios' ? `maps://?daddr=${q}&q=${encodeURIComponent(label)}` : Platform.OS === 'android' ? `google.navigation:q=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`).catch(() => toast('Aucune application de navigation disponible.', 'danger')));
}

/** A stop closer than this names the place in the safety sheet (« près de Gare Rabat Ville »). */
const NEAR_M = 800;

/**
 * The phone's own position for an SOS, read only when location access was already granted:
 * an alert never waits on a permission prompt. Null when unknown.
 */
function usePhonePosition(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const p = (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (alive && p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      } catch {
        // No position: the last known one of the car, or the pickup, is sent, and the sheet says which.
      }
    };
    read();
    const t = setInterval(read, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return pos;
}

/**
 * The position sent with an SOS and where it is, in words (never raw coordinates). The chauffeuse is
 * in her car: its fresh signal is her position, then the phone's own fix, then the last signal of the
 * car, and only then the pickup, named as the pickup.
 */
function sosPosition(ride: Ride, phone: LatLng | null): { location: LatLng; label: string } {
  const stops = ride.route.stops;
  const near = (p: LatLng) => {
    const closest = stops.map((s) => ({ s, d: haversineMeters(p, s.location) })).sort((x, y) => x.d - y.d)[0];
    return closest && closest.d <= NEAR_M ? `près de ${closest.s.label}` : null;
  };
  const car = ride.driverLocation;
  if (car && !car.stale) {
    const n = near(car.location);
    return { location: car.location, label: n ? `Votre position, ${n}` : 'Votre position actuelle' };
  }
  if (phone) {
    const n = near(phone);
    return { location: phone, label: n ? `Votre position, ${n}` : 'Votre position actuelle' };
  }
  if (car) return { location: car.location, label: 'Dernière position connue de votre voiture' };
  return { location: stops[0]!.location, label: `Point de prise en charge : ${stops[0]!.label} (votre position n’est pas disponible)` };
}

/** D08 · D08-arrived · D08-cancel · D08-cancelled · D09 · D09-stop · D09-stale */
export default function RideScreen() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const status = useDriverStatus();
  const phone = usePhonePosition();
  const [lastRideId, setLastRideId] = useState<string | null>(status.data?.activeRide?.id ?? null);
  const [cancelOpen, setCancelOpen] = useState(false);
  // D-16: no reason is chosen for her.
  const [reason, setReason] = useState<string | null>(null);
  const [cancelledByMe, setCancelledByMe] = useState<Ride | null>(null);
  const [offline, setOffline] = useState(false);
  const [cardHeight, setCardHeight] = useState(400);

  const ride = status.data?.activeRide ?? null;
  if (ride && ride.id !== lastRideId) setLastRideId(ride.id);

  useEffect(() => NetInfo.addEventListener((s) => setOffline(!s.isConnected || s.isInternetReachable === false)), []);

  // The ride disappeared from the active state: find out why (passenger cancellation, completion).
  const ended = useQuery({
    queryKey: qk.ride(a, lastRideId ?? 'none'),
    queryFn: () => api.rides.get(lastRideId!),
    enabled: !ride && !!lastRideId && !cancelledByMe && !status.isLoading,
  });

  const refresh = (r: Ride) => {
    qc.setQueryData(qk.driverStatus(a), (old: typeof status.data) => (old ? { ...old, activeRide: r.status === 'completed' ? null : r } : old));
    qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
  };
  const step = useSingleFlight(async (action: 'arrive' | 'start' | 'stop' | 'complete') => {
    const id = ride!.id;
    if (action === 'arrive') return api.driver.arrive(id);
    if (action === 'start') return api.driver.start(id);
    if (action === 'stop') return api.driver.completeStop(id);
    return api.driver.complete(id);
  }, {
    onSuccess: (r) => {
      haptic.success();
      step.reset();
      refresh(r);
      if (r.status === 'completed') {
        qc.invalidateQueries({ queryKey: qk.wallet(a) });
        router.replace({ pathname: '/ride-end/[id]', params: { id: r.id } });
      }
    },
    onError: (e) => {
      haptic.error();
      step.reset();
      toast(errorMessage(e), 'danger');
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
  });
  const cancel = useMutation({
    mutationFn: (code: string) => api.driver.cancelRide(ride!.id, code),
    onSuccess: (r) => {
      haptic.warning();
      setCancelOpen(false);
      setCancelledByMe(r);
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  // Background location follows the server's active ride ((app)/_layout), not this screen:
  // going home mid-ride (« la course continue ») keeps the position shared with the passenger.
  const home = () => router.dismissTo('/');

  if (cancelledByMe) {
    return (
      <Ended testID="ride-cancelled-by-driver" top={insets.top} state="cancelled" title="Course annulée" message={`Motif enregistré : ${cancelledByMe.driverCancellations.at(-1)?.reasonText ?? ''}. La passagère est reprise en charge par une autre chauffeuse.`} onHome={home} />
    );
  }
  if (!ride) {
    const r = ended.data?.ride;
    if (r?.status === 'cancelled') return <Ended testID="ride-cancelled-by-passenger" top={insets.top} state="cancelled" title="Course annulée par la passagère" message={r.cancellation?.fee ? `Des frais d’annulation de ${formatMoney(r.cancellation.fee)} s’appliquent ; votre part nette est créditée après paiement.` : 'Aucun frais ne s’applique. Vous restez en ligne.'} onHome={home} />;
    if (r?.status === 'completed') return <Ended top={insets.top} state="completed" title="Course terminée" message="Retrouvez le détail dans votre historique." onHome={() => router.replace({ pathname: '/ride-end/[id]', params: { id: r.id } })} cta="Voir le récapitulatif" />;
    return <Ended top={insets.top} title="Aucune course en cours" message="Les courses acceptées apparaissent ici." onHome={home} />;
  }

  const stops = ride.route.stops;
  const pickup = stops[0]!;
  const intermediate = stops.length - 2;
  const nextStopIndex = ride.completedStops + 1;
  const pendingStop = ride.status === 'in_progress' && ride.completedStops < intermediate ? stops[nextStopIndex]! : null;
  const destination = stops[stops.length - 1]!;
  const car = ride.driverLocation?.location ?? null;
  const approaching = ride.status === 'driver_assigned';
  const atPickup = approaching || ride.status === 'driver_arrived';
  const target = atPickup ? pickup : (pendingStop ?? destination);
  const stale = offline || !!ride.driverLocation?.stale;
  const name = ride.passenger.firstName;
  // D-13: the state's word is the card title; the header shows its glyph only.
  const title = approaching ? `Rejoindre ${name}` : ride.status === 'driver_arrived' ? `${name} est prévenue` : 'Trajet en cours';
  const pay = paymentMethodPresentation(ride.paymentMethod);
  const sos = sosPosition(ride, phone);
  const topBar = insets.top + 8 + 64;
  const cardBottom = Math.max(insets.bottom, 12);
  // DRV-14: with the largest text the card scrolls under its title, never over the header; the step stays pinned.
  const cardMax = windowHeight - topBar - 8 - cardBottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.map }} testID={`ride-${ride.status}`}>
      <NayaMap
        center={target.location}
        route={ride.status === 'in_progress' ? ride.route.polyline : car ? [car, pickup.location] : undefined}
        fitTo={ride.status === 'in_progress' ? ride.route.polyline : car ? [car, pickup.location] : [pickup.location]}
        markers={[
          ...stops.map((s, i) => ({ id: `s${i}`, kind: (i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop') as 'pickup', coordinate: s.location, label: s.label })),
          ...(car ? [{ id: 'car', kind: 'driver' as const, coordinate: car, label: 'Votre voiture' }] : []),
        ]}
        bottomInset={Math.min(cardHeight, cardMax) + 12}
        topInset={topBar}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton icon={<ArrowLeft size={22} color={colors.ink} strokeWidth={2} />} accessibilityLabel="Retour à l’accueil (la course continue)" onPress={home} testID="ride-back" />
          {/* D-13, C1: the ride's glyph, announced when it changes. */}
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <StatusIcon kind="ride" state={ride.status} showLabel={false} announce testID="ride-status" />
          </View>
        </View>
        {/* X-02, D-14: pinned on the map's right edge, outside the card's scroll, never covered. */}
        <SafetyDisc rideId={ride.id} location={sos.location} locationLabel={sos.label} extra={<OtherEmergencyNumbers />} />
      </View>

      <View
        onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}
        style={{ position: 'absolute', left: 12, right: 12, bottom: cardBottom, maxHeight: cardMax, backgroundColor: colors.surface, borderRadius: radius.sheet, ...shadow.float, overflow: 'hidden' }}
      >
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 14 }} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" testID="ride-title">
            {title}
          </Text>
          {stale ? <StatusBanner compact tone="warning" title="Connexion instable" message="actions envoyées au retour du réseau" testID="stale-banner" /> : null}

          {atPickup ? (
            <View style={{ gap: 2 }}>
              <Text variant="caption" tone="muted" weight="semibold" numeric>
                {approaching ? 'Prise en charge' : `Arrivée à ${ride.arrivedAt ? formatTime(ride.arrivedAt) : ''}`}
              </Text>
              <Text variant="heading">{pickup.label}</Text>
              <Text variant="caption" tone="muted">
                {pickup.address}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ gap: 2 }}>
                <Text variant="caption" tone="muted" weight="semibold">
                  {pendingStop ? 'Prochain arrêt' : 'Destination'}
                </Text>
                <Text variant="heading" testID="next-target">
                  {pendingStop ? `Arrêt : ${pendingStop.label}` : destination.label}
                </Text>
                <Text variant="caption" tone="muted">
                  {pendingStop ? `Puis ${destination.label} · ${destination.address}` : destination.address}
                </Text>
              </View>
              {intermediate > 0 ? (
                <View style={{ gap: 6 }}>
                  {stops.slice(1, -1).map((s, i) => {
                    const done = i < ride.completedStops;
                    // A130: a done stop is a check; « effectué » is read, not written.
                    return (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={done ? `${s.label}, effectué` : s.label} testID={`ride-via-${i + 1}${done ? '-done' : ''}`}>
                        {done ? <Icon name="circle-check" tone="success" size={16} /> : <View style={{ width: 12, height: 12, borderRadius: 3, borderWidth: 2, borderColor: colors.accent, marginHorizontal: 2 }} />}
                        <Text variant="caption" tone={done ? 'muted' : 'ink'}>
                          {s.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )}

          {/* A131: no avatar disc. R8: no call or message while they are not live; the 19 is in the safety sheet. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
            <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${name}${ride.passenger.ratingAverage ? `, note ${String(ride.passenger.ratingAverage).replace('.', ',')}` : ''}, ${pay.label}${pay.kind === 'cash' ? `, ${formatMoney(ride.terms.breakdown.total)} à encaisser` : ', payé via Naya'}`} testID="ride-passenger">
              <Text variant="label" weight="semibold">
                {name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {ride.passenger.ratingAverage ? (
                  <>
                    <Icon icon={Star} size={16} color={colors.muted} />
                    <Text variant="caption" tone="muted" numeric style={{ flexShrink: 0 }}>
                      {String(ride.passenger.ratingAverage).replace('.', ',')} ·
                    </Text>
                  </>
                ) : null}
                <Icon icon={paymentMethodIcon(ride.paymentMethod)} size={16} color={colors.muted} />
                <Text variant="caption" tone="muted" numeric numberOfLines={2} style={{ flexShrink: 1 }}>
                  {pay.kind === 'cash' ? `Espèces · ${formatMoney(ride.terms.breakdown.total)}` : `${pay.shortLabel} · via Naya`}
                </Text>
              </View>
            </View>
            {/* D-12: navigation is a labelled 36 pill, not an ambiguous icon-only arrow. */}
            <Button label="Naviguer" variant="secondary" size="compact" icon={<Navigation size={16} color={colors.accent} strokeWidth={2} />} accessibilityHint={`Ouvre l’itinéraire vers ${target.label}`} onPress={() => openNavigation(target.location, target.label)} testID="open-navigation" />
          </View>
        </ScrollView>

        {/* R17: single taps, no slide-to-confirm. */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
          {ride.status === 'driver_assigned' ? <Button label="Signaler mon arrivée" size="major" full loading={step.isPending} onPress={() => step.run('arrive')} testID="ride-arrive" /> : null}
          {ride.status === 'driver_arrived' ? <Button label="Commencer la course" size="major" full loading={step.isPending} onPress={() => step.run('start')} testID="ride-start" /> : null}
          {ride.status === 'in_progress' && pendingStop ? <Button label={`Arrêt effectué · ${pendingStop.label}`} size="major" full loading={step.isPending} onPress={() => step.run('stop')} testID="ride-stop" /> : null}
          {ride.status === 'in_progress' && !pendingStop ? <Button label="Terminer la course" size="major" full loading={step.isPending} onPress={() => step.run('complete')} testID="ride-complete" /> : null}
          {ride.status !== 'in_progress' ? (
            <TextButton
              label="Annuler avec un motif"
              onPress={() => {
                setReason(null);
                setCancelOpen(true);
              }}
              testID="ride-cancel"
            />
          ) : (
            <TextButton label="Contacter le support" onPress={() => router.push({ pathname: '/support/new', params: { rideId: ride.id } })} testID="ride-contact-support" />
          )}
        </View>
      </View>

      <Sheet
        visible={cancelOpen}
        onClose={() => !cancel.isPending && setCancelOpen(false)}
        dismissible={!cancel.isPending}
        title="Annuler la course"
        subtitle="La passagère sera reprise en charge par une autre chauffeuse."
        testID="cancel-sheet"
        footer={<Button label="Annuler la course" variant="danger" full disabled={!reason} disabledReason={reason ? undefined : 'Choisissez un motif.'} loading={cancel.isPending} onPress={() => reason && cancel.mutate(reason)} testID="confirm-driver-cancel" />}
      >
        <View style={{ gap: 12 }}>
          <ListGroup>
            {DRIVER_CANCEL_REASONS.map((r) => (
              <ListRow key={r.code} title={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`cancel-reason-${r.code}`} />
            ))}
          </ListGroup>
          <Text variant="caption" tone="muted">
            Le motif est enregistré et visible par l’équipe Naya. Les annulations répétées sont suivies.
          </Text>
        </View>
      </Sheet>

      {/* DRV-16: the prominent disclosure before the « Toujours » location prompt, once per ride. */}
      <BackgroundLocationExplainer rideId={ride.id} />
    </View>
  );
}

function Ended({ title, message, onHome, top, testID, cta, state }: { title: string; message: string; onHome: () => void; top: number; testID?: string; cta?: string; state?: 'completed' | 'cancelled' }) {
  useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: top + 40, paddingHorizontal: gutter, gap: 16 }}>
      {/* A133: the ride's own end glyph (C1); the title carries the word. */}
      {state ? (
        <View style={{ alignItems: 'flex-start' }}>
          <StatusIcon kind="ride" state={state} size="lg" variant="disc" showLabel={false} accessible={false} testID="ride-end-status" />
        </View>
      ) : null}
      <Text variant="screen" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" tone="muted">
        {message}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ paddingBottom: 40 }}>
        <Button label={cta ?? 'Retour à l’accueil'} full onPress={onHome} testID="ride-home" />
      </View>
    </View>
  );
}
