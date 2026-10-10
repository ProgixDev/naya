import { useTheme , SafetyButton , Button, DemoBadge, Glass, IconButton, NayaMap, PressableScale, Pill, Sheet, StatusBanner, Text, TextButton, haptic, toast, useSingleFlight } from '@naya/ui';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, Flag, MapPin, Navigation, Phone } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { DRIVER_CANCEL_REASONS, formatMoney, formatTime, type LatLng, type Ride } from '@naya/domain';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { useAccountId, useDriverStatus } from '@/lib/queries';
import { startRideTracking, stopRideTracking } from '@/lib/backgroundLocation';

function openNavigation(to: LatLng, label: string) {
  const q = `${to.lat},${to.lng}`;
  const url = Platform.OS === 'ios' ? `maps://?daddr=${q}&q=${encodeURIComponent(label)}` : Platform.OS === 'android' ? `google.navigation:q=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`).catch(() => toast('Aucune application de navigation disponible.', 'danger')));
}

/** D08 · D08-arrived · D08-contact · D08-cancel · D08-cancelled · D09 · D09-stop · D09-stale */
export default function RideScreen() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const status = useDriverStatus();
  const [lastRideId, setLastRideId] = useState<string | null>(status.data?.activeRide?.id ?? null);
  const [contactOpen, setContactOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<string>('passenger_unreachable');
  const [cancelledByMe, setCancelledByMe] = useState<Ride | null>(null);
  const [offline, setOffline] = useState(false);
  const tracking = useRef(false);

  const ride = status.data?.activeRide ?? null;
  if (ride && ride.id !== lastRideId) setLastRideId(ride.id);

  useEffect(() => NetInfo.addEventListener((s) => setOffline(!s.isConnected || s.isInternetReachable === false)), []);

  // Background location only while a ride is accepted.
  useEffect(() => {
    if (ride && !tracking.current) {
      tracking.current = true;
      startRideTracking().then((r) => {
        if (r === 'foreground-only') toast('Position partagée seulement quand l’application est ouverte.');
      });
    }
    if (!ride && tracking.current) {
      tracking.current = false;
      stopRideTracking();
    }
  }, [ride]);
  useEffect(() => () => void stopRideTracking(), []);

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
        stopRideTracking();
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
    mutationFn: () => api.driver.cancelRide(ride!.id, reason),
    onSuccess: (r) => {
      haptic.warning();
      setCancelOpen(false);
      setCancelledByMe(r);
      stopRideTracking();
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const home = () => router.dismissTo('/');

  if (cancelledByMe) {
    return (
      <Ended testID="ride-cancelled-by-driver" top={insets.top} title="Course annulée" message={`Motif enregistré : ${cancelledByMe.driverCancellations.at(-1)?.reasonText ?? ''}. La passagère est reprise en charge par une autre chauffeuse.`} onHome={home} />
    );
  }
  if (!ride) {
    const r = ended.data?.ride;
    if (r?.status === 'cancelled') return <Ended testID="ride-cancelled-by-passenger" top={insets.top} title="Course annulée par la passagère" message={r.cancellation?.fee ? `Des frais d’annulation de ${formatMoney(r.cancellation.fee)} s’appliquent ; votre part nette est créditée après paiement.` : 'Aucun frais ne s’applique. Vous restez en ligne.'} onHome={home} />;
    if (r?.status === 'completed') return <Ended top={insets.top} title="Course terminée" message="Retrouvez le détail dans votre historique." onHome={() => router.replace({ pathname: '/ride-end/[id]', params: { id: r.id } })} cta="Voir le récapitulatif" />;
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
  const target = approaching || ride.status === 'driver_arrived' ? pickup : (pendingStop ?? destination);
  const stale = offline || !!ride.driverLocation?.stale;
  const title = approaching ? `Rejoindre ${ride.passenger.firstName}` : ride.status === 'driver_arrived' ? `${ride.passenger.firstName} est prévenue` : 'Trajet en cours';

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
        bottomInset={440}
        topInset={insets.top + 56}
      />
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton icon={<ChevronLeft size={28} color={colors.accent} strokeWidth={2.4} />} accessibilityLabel="Retour à l’accueil (la course continue)" onPress={home} />
        <Glass radius={999} style={{ flex: 1 }} contentStyle={{ height: 44, paddingHorizontal: 16, justifyContent: 'flex-start', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ride.status === 'in_progress' ? colors.success : colors.accent }} />
          <Text weight="semibold" numberOfLines={1} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
            {title}
          </Text>
          {ride.driverLocation?.source === 'demo' ? <DemoBadge label="Trajet simulé" /> : null}
        </Glass>
      </View>

      <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderRadius: 30, padding: 18, gap: 14, ...shadow.float }}>
        {stale ? <StatusBanner compact tone="warning" title="Connexion instable" message="actions envoyées au retour du réseau" testID="stale-banner" /> : null}

        {/* ── Progress ── */}
        <RideSteps step={approaching ? 0 : ride.status === 'driver_arrived' ? 1 : 2} />

        {/* ── Target ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: ride.status === 'in_progress' ? colors.successSoft : colors.selected, alignItems: 'center', justifyContent: 'center' }}>
            {ride.status === 'in_progress' ? <Flag size={21} color={colors.success} strokeWidth={2} /> : <MapPin size={21} color={colors.accent} strokeWidth={2} />}
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text tone="muted" weight="medium" style={{ fontSize: 12, lineHeight: 16 }}>
              {approaching ? 'Prise en charge' : ride.status === 'driver_arrived' ? `Arrivée à ${ride.arrivedAt ? formatTime(ride.arrivedAt) : ''} · elle arrive` : pendingStop ? 'Prochain arrêt' : 'Destination'}
            </Text>
            <Text weight="bold" numberOfLines={1} style={{ fontSize: 19, lineHeight: 25, letterSpacing: -0.3 }} testID={ride.status === 'in_progress' ? 'next-target' : undefined}>
              {ride.status === 'in_progress' ? (pendingStop ? `Arrêt : ${pendingStop.label}` : destination.label) : pickup.label}
            </Text>
            <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
              {ride.status === 'in_progress' ? (pendingStop ? `Puis ${destination.label}` : destination.address) : pickup.address}
            </Text>
          </View>
          <PressableScale onPress={() => openNavigation(target.location, target.label)} accessibilityRole="button" accessibilityLabel="Ouvrir la navigation" testID="open-navigation" pressedScale={0.94} style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={22} color={colors.inverse} strokeWidth={2.2} />
          </PressableScale>
        </View>
        {ride.status === 'in_progress' && intermediate > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stops.slice(1, -1).map((st, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: i < ride.completedStops ? colors.successSoft : colors.background }}>
                {i < ride.completedStops ? <CheckCircle2 size={14} color={colors.success} /> : <View style={{ width: 10, height: 10, borderRadius: 3, borderWidth: 2, borderColor: colors.accent }} />}
                <Text weight="medium" tone={i < ride.completedStops ? 'success' : 'ink'} style={{ fontSize: 12, lineHeight: 16 }}>{st.label}{i < ride.completedStops ? ' · effectué' : ''}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Passenger ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 20, padding: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="bold" tone="accent" style={{ fontSize: 17, lineHeight: 22 }}>{ride.passenger.firstName.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{ride.passenger.firstName}{ride.passenger.ratingAverage ? `  ★ ${String(ride.passenger.ratingAverage).replace('.', ',')}` : ''}</Text>
            <Text tone="muted" numeric numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
              {ride.paymentMethod.kind === 'cash' ? `Espèces à encaisser · ${formatMoney(ride.terms.breakdown.total)}` : `${ride.paymentMethod.label} · via Naya`}
            </Text>
          </View>
          <PressableScale onPress={() => setContactOpen(true)} accessibilityRole="button" accessibilityLabel={`Contacter ${ride.passenger.firstName}`} testID="contact-passenger" pressedScale={0.94} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={19} color={colors.accent} strokeWidth={2} />
          </PressableScale>
        </View>

        <SafetyButton rideId={ride.id} location={ride.driverLocation?.location ?? ride.route.stops[0]!.location} />
        {ride.status === 'driver_assigned' ? <Button label="Signaler mon arrivée" size="major" full loading={step.isPending} onPress={() => step.run('arrive')} testID="ride-arrive" /> : null}
        {ride.status === 'driver_arrived' ? <Button label="Commencer la course" size="major" full loading={step.isPending} onPress={() => step.run('start')} testID="ride-start" /> : null}
        {ride.status === 'in_progress' && pendingStop ? <Button label={`Arrêt effectué · ${pendingStop.label}`} size="major" full loading={step.isPending} onPress={() => step.run('stop')} testID="ride-stop" /> : null}
        {ride.status === 'in_progress' && !pendingStop ? <Button label="Terminer la course" size="major" full loading={step.isPending} onPress={() => step.run('complete')} testID="ride-complete" /> : null}
        {ride.status !== 'in_progress' ? <TextButton label="Annuler avec un motif" tone="muted" onPress={() => setCancelOpen(true)} testID="ride-cancel" /> : <TextButton label="Contacter le support" tone="muted" onPress={() => router.push({ pathname: '/support/new', params: { rideId: ride.id } })} />}
      </View>

      <Sheet visible={contactOpen} onClose={() => setContactOpen(false)} title={`Contacter ${ride.passenger.firstName}`} subtitle="Votre numéro reste masqué des deux côtés.">
        <View style={{ gap: 12 }}>
          <Text variant="caption" tone="muted">
            En cas de problème de sécurité, appelez le 19 (police).
          </Text>
          <Button label="Compris" variant="secondary" full onPress={() => setContactOpen(false)} />
        </View>
      </Sheet>

      <Sheet visible={cancelOpen} onClose={() => !cancel.isPending && setCancelOpen(false)} dismissible={!cancel.isPending} title="Annuler la course" subtitle="La passagère sera reprise en charge par une autre chauffeuse." footer={<Button label="Annuler la course" variant="danger" full loading={cancel.isPending} onPress={() => cancel.mutate()} testID="confirm-driver-cancel" />}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DRIVER_CANCEL_REASONS.map((r) => (
              <Pill key={r.code} label={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`cancel-reason-${r.code}`} />
            ))}
          </View>
          <Text variant="caption" tone="muted">
            Le motif est enregistré et visible par l’équipe Naya. Les annulations répétées sont suivies.
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

function Ended({ title, message, onHome, top, testID, cta }: { title: string; message: string; onHome: () => void; top: number; testID?: string; cta?: string }) {
  useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: top, paddingHorizontal: gutter }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <MapPin size={36} color={colors.accent} strokeWidth={1.9} />
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
          <Text weight="bold" align="center" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.8 }}>{title}</Text>
          <Text tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22, maxWidth: 320 }}>{message}</Text>
        </View>
      </View>
      <View style={{ paddingBottom: 32 }}>
        <Button label={cta ?? 'Retour à l’accueil'} size="major" full onPress={onHome} testID="ride-home" />
      </View>
    </View>
  );
}

const STEPS = ['Rejoindre', 'Prise en charge', 'Destination'];
function RideSteps({ step }: { step: number }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`Étape ${step + 1} sur 3 : ${STEPS[step]}`}>
      {STEPS.map((l, i) => (
        <View key={l} style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.accent : colors.line }} />
          <Text weight={i === step ? 'semibold' : 'regular'} tone={i === step ? 'accent' : 'muted'} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}
