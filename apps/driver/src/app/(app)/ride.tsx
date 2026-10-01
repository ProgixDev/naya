import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MapPin, Navigation, Phone, Route as RouteIcon, UserRound } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { DRIVER_CANCEL_REASONS, formatMoney, formatTime, type LatLng, type Ride } from '@naya/domain';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { Button, DemoBadge, Glass, IconButton, IconDisc, NayaMap, Pill, Sheet, StatusBanner, Text, TextButton, haptic, toast, useSingleFlight } from '@naya/ui';
import { useAccountId, useDriverStatus } from '@/lib/queries';
import { startRideTracking, stopRideTracking } from '@/lib/backgroundLocation';

function openNavigation(to: LatLng, label: string) {
  const q = `${to.lat},${to.lng}`;
  const url = Platform.OS === 'ios' ? `maps://?daddr=${q}&q=${encodeURIComponent(label)}` : Platform.OS === 'android' ? `google.navigation:q=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`).catch(() => toast('Aucune application de navigation disponible.', 'danger')));
}

/** D08 · D08-arrived · D08-contact · D08-cancel · D08-cancelled · D09 · D09-stop · D09-stale */
export default function RideScreen() {
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
  useEffect(() => {
    if (ride) setLastRideId(ride.id);
  }, [ride?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Retour à l’accueil (la course continue)" onPress={home} />
        <Glass radius={999} style={{ flex: 1 }} contentStyle={{ height: 44, paddingHorizontal: 16, justifyContent: 'flex-start', gap: 8 }}>
          <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          {ride.driverLocation?.source === 'demo' ? <DemoBadge label="Trajet simulé" /> : null}
        </Glass>
      </View>

      <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 16, gap: 12, ...shadow.float }}>
        {stale ? <StatusBanner compact tone="warning" title="Connexion instable" message="actions envoyées au retour du réseau" testID="stale-banner" /> : null}

        {approaching || ride.status === 'driver_arrived' ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RouteIcon size={18} color={colors.accent} />
              <Text variant="caption" tone="muted" weight="semibold">
                {approaching ? 'Prise en charge' : `Arrivée à ${ride.arrivedAt ? formatTime(ride.arrivedAt) : ''}`}
              </Text>
            </View>
            <Text variant="heading">{pickup.label}</Text>
            <Text variant="caption" tone="muted">
              {pickup.address}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 4 }}>
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
                {stops.slice(1, -1).map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {i < ride.completedStops ? <CheckCircle2 size={16} color={colors.success} /> : <View style={{ width: 12, height: 12, borderRadius: 3, borderWidth: 2, borderColor: colors.accent, marginHorizontal: 2 }} />}
                    <Text variant="caption" tone={i < ride.completedStops ? 'muted' : 'ink'}>
                      {s.label}
                      {i < ride.completedStops ? ' · effectué' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 20, paddingVertical: 10, paddingLeft: 12, paddingRight: 10 }}>
          <IconDisc size={40}>
            <UserRound size={20} color={colors.accent} />
          </IconDisc>
          <View style={{ flex: 1 }}>
            <Text variant="label">{ride.passenger.firstName}</Text>
            <Text variant="caption" tone="muted" numeric>
              {ride.passenger.ratingAverage ? `${String(ride.passenger.ratingAverage).replace('.', ',')} · ` : ''}
              {ride.paymentMethod.kind === 'cash' ? `Espèces · ${formatMoney(ride.terms.breakdown.total)}` : 'Carte · payée via Naya'}
            </Text>
          </View>
          <IconButton variant="solid" icon={<Phone size={18} color={colors.accent} />} accessibilityLabel={`Contacter ${ride.passenger.firstName}`} onPress={() => setContactOpen(true)} testID="contact-passenger" />
          <IconButton variant="solid" icon={<Navigation size={18} color={colors.accent} />} accessibilityLabel="Ouvrir la navigation" onPress={() => openNavigation(target.location, target.label)} testID="open-navigation" />
        </View>

        {ride.status === 'driver_assigned' ? <Button label="Signaler mon arrivée" size="major" full loading={step.isPending} onPress={() => step.run('arrive')} testID="ride-arrive" /> : null}
        {ride.status === 'driver_arrived' ? <Button label="Commencer la course" size="major" full loading={step.isPending} onPress={() => step.run('start')} testID="ride-start" /> : null}
        {ride.status === 'in_progress' && pendingStop ? <Button label={`Arrêt effectué · ${pendingStop.label}`} size="major" full loading={step.isPending} onPress={() => step.run('stop')} testID="ride-stop" /> : null}
        {ride.status === 'in_progress' && !pendingStop ? <Button label="Terminer la course" size="major" full loading={step.isPending} onPress={() => step.run('complete')} testID="ride-complete" /> : null}
        {ride.status !== 'in_progress' ? <TextButton label="Annuler avec un motif" onPress={() => setCancelOpen(true)} testID="ride-cancel" /> : <TextButton label="Contacter le support" onPress={() => router.push({ pathname: '/support/new', params: { rideId: ride.id } })} />}
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
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: top + 40, paddingHorizontal: gutter, gap: 16 }}>
      <IconDisc size={56}>
        <MapPin size={26} color={colors.accent} />
      </IconDisc>
      <Text variant="hero" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" tone="muted">
        {message}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ paddingBottom: 40 }}>
        <Button label={cta ?? 'Retour à l’accueil'} size="major" full onPress={onHome} testID="ride-home" />
      </View>
    </View>
  );
}
