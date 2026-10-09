import { useTheme , SafetyButton } from '@naya/ui';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { ArrowLeft, CheckCircle2, Clock, MapPinned, Phone, Signal } from 'lucide-react-native';
import { formatDuration, formatMoney, haversineMeters, RIDE_STATUS_LABELS, secondsBetween, type Ride } from '@naya/domain';
import { errorMessage, newIdempotencyKey, qk, serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { Button, DemoBadge, DriverCard, ErrorState, IconButton, NayaMap, RouteStopRow, StatusBanner, Text, haptic, toast, type MapMarker } from '@naya/ui';
import { useAccountId, useActiveRide } from '@/lib/queries';
import { CancelSheet } from '@/features/ride/CancelSheet';
import { useDraft } from '@/lib/draft';
import { ContactSheet } from '@/features/ride/ContactSheet';

const LONG_WAIT_S = 45;

export default function RideScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const active = useActiveRide();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const lastId = useRef<string | null>(null);
  const lastStatus = useRef<string | null>(null);
  const [now, setNow] = useState(serverClock.now());
  useEffect(() => {
    const t = setInterval(() => setNow(serverClock.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ride = active.data;
  useEffect(() => { if (ride) lastId.current = ride.id; }, [ride]);

  // When the ride leaves the active set (completed or cancelled), open its receipt.
  useEffect(() => {
    if (active.isSuccess && !ride && lastId.current) router.replace({ pathname: '/receipt/[id]', params: { id: lastId.current } });
  }, [active.isSuccess, ride]);

  // Arrival notification when the app is in the background (see docs: needs push for a closed app).
  useEffect(() => {
    if (!ride) return;
    if (lastStatus.current && lastStatus.current !== ride.status) {
      if (ride.status === 'driver_arrived') {
        haptic.success();
        if (AppState.currentState !== 'active') {
          Notifications.scheduleNotificationAsync({ content: { title: `${ride.driver?.firstName ?? 'Votre chauffeuse'} est arrivée`, body: `Plaque ${ride.driver?.vehicle.plate ?? ''}. Vérifiez la plaque avant de monter.` }, trigger: null }).catch(() => undefined);
        }
      }
      if (ride.status === 'driver_assigned') haptic.success();
    }
    lastStatus.current = ride.status;
  }, [ride?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useMutation({
    mutationFn: () => api.rides.retrySearch(ride!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.activeRide(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const planLater = useMutation({
    mutationFn: async () => {
      const r = ride!;
      await api.rides.cancel(r.id, { reasonCode: 'wait_too_long', acknowledgedFee: 0 }, newIdempotencyKey());
      const d = useDraft.getState();
      d.reset();
      d.setPickup(r.route.stops[0]!, 'search');
      r.route.stops.slice(1, -1).forEach((s) => d.addStop(s));
      d.setDestination(r.route.stops[r.route.stops.length - 1]!);
    },
    onSuccess: () => {
      lastId.current = null;
      qc.invalidateQueries({ queryKey: qk.activeRide(a) });
      router.replace({ pathname: '/quote', params: { schedule: '1' } });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  if (active.isError && !ride) return <View style={{ flex: 1, paddingTop: insets.top + 60, backgroundColor: colors.background }}><ErrorState onRetry={() => active.refetch()} /></View>;
  if (!ride) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.accent} /></View>;

  const stops = ride.route.stops;
  const pickup = stops[0]!;
  const driverPos = ride.driverLocation?.location;
  const markers: MapMarker[] = stops.map((s, i) => ({ id: `s${i}`, kind: i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop', coordinate: s.location, label: s.label }));
  if (driverPos) markers.push({ id: 'driver', kind: 'driver', coordinate: driverPos, label: `Voiture de ${ride.driver?.firstName ?? 'la chauffeuse'}` });
  const approaching = ride.status === 'driver_assigned';
  const fit = approaching && driverPos ? [driverPos, pickup.location] : ride.status === 'in_progress' ? ride.route.polyline : stops.map((s) => s.location);
  const etaMin = approaching && driverPos ? Math.max(1, Math.round(haversineMeters(driverPos, pickup.location) / (20_000 / 60))) : null;
  const searchingFor = secondsBetween(ride.searchStartedAt, now);
  const recovered = ride.driverCancellations.length > 0 && ride.status === 'searching';
  const cancellable = ['searching', 'driver_assigned', 'driver_arrived', 'no_driver'].includes(ride.status);
  const title =
    ride.status === 'searching'
      ? recovered
        ? 'Nous cherchons une autre chauffeuse'
        : 'Nous cherchons une chauffeuse'
      : ride.status === 'no_driver'
        ? 'Aucune chauffeuse disponible'
        : ride.status === 'driver_assigned'
          ? `${ride.driver?.firstName} arrive`
          : ride.status === 'driver_arrived'
            ? `${ride.driver?.firstName} est arrivée`
            : 'Trajet en cours';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID={`ride-${ride.status}`}>
      <View style={{ flex: 1, minHeight: '38%' }}>
        <NayaMap center={pickup.location} markers={markers} route={ride.status === 'in_progress' || ride.status === 'searching' || ride.status === 'no_driver' ? ride.route.polyline : undefined} fitTo={fit} topInset={insets.top + 8} bottomInset={36} interactive />
        <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Retour à l’accueil" onPress={() => router.navigate('/')} testID="ride-back" />
          <View style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.96)', justifyContent: 'center', paddingHorizontal: 16, ...shadow.card }}>
            <Text variant="label" numberOfLines={1}>{RIDE_STATUS_LABELS[ride.status]}</Text>
          </View>
        </View>
        {ride.simulated && ride.driverLocation?.source === 'demo' ? (
          <View style={{ position: 'absolute', right: gutter, bottom: 44 }}>
            <DemoBadge label="Déplacement simulé" />
          </View>
        ) : null}
      </View>

      <View style={{ maxHeight: '62%', marginTop: -28, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + 12, ...shadow.float }}>
        <ScrollView bounces={false} overScrollMode="never" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 18, paddingBottom: 10, gap: 12 }} showsVerticalScrollIndicator>
        <View style={{ gap: 4 }}>
          <Text variant="title" style={{ fontSize: 22, lineHeight: 28 }} accessibilityRole="header" accessibilityLiveRegion="polite" testID="ride-title">
            {title}
          </Text>
          {ride.status === 'searching' ? (
            <Text variant="label" tone="muted" numeric>
              {searchingFor >= LONG_WAIT_S ? 'La recherche prend plus de temps que d’habitude. Nous continuons.' : 'Votre demande est envoyée aux chauffeuses proches.'}
            </Text>
          ) : null}
          {etaMin ? <Text variant="label" tone="accent" weight="semibold" numeric>Arrivée estimée : {etaMin} min</Text> : null}
          {ride.status === 'driver_arrived' ? <Text variant="label" tone="muted">Vérifiez la plaque avant de monter.</Text> : null}
          {ride.status === 'in_progress' ? <Text variant="label" tone="muted" numeric>{formatDuration(ride.route.durationSeconds)} de trajet · {formatMoney(ride.terms.breakdown.total)} · {ride.paymentMethod.label}</Text> : null}
        </View>

        {recovered ? <StatusBanner compact tone="warning" title="Chauffeuse désistée" message={`${ride.driverCancellations[ride.driverCancellations.length - 1]!.reasonText} · annulation sans frais`} testID="driver-cancelled" /> : null}
        {ride.driverLocation?.stale ? <StatusBanner compact tone="warning" icon={<Signal size={16} color={colors.warning} />} title="Position en attente" message={`dernier signal il y a ${secondsBetween(ride.driverLocation.at, now)} s · la course continue`} testID="stale-tracking" /> : null}

        {ride.status === 'searching' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="caption" tone="muted" numeric>Recherche depuis {Math.floor(searchingFor / 60)} min {String(searchingFor % 60).padStart(2, '0')} s</Text>
          </View>
        ) : null}

        {ride.status === 'no_driver' ? <StatusBanner compact tone="warning" icon={<Clock size={16} color={colors.warning} />} title="Toutes occupées" message="relancez ou planifiez pour plus tard" testID="no-driver" /> : null}

        {ride.driver && ['driver_assigned', 'driver_arrived', 'in_progress'].includes(ride.status) ? (
          <DriverCard driver={ride.driver} trailing={<IconButton variant="tonal" icon={<Phone size={20} color={colors.accent} />} accessibilityLabel={`Contacter ${ride.driver.firstName}`} label="Contacter" onPress={() => setContactOpen(true)} testID="contact" />} />
        ) : null}

        {ride.status === 'in_progress' ? (
          <View>
            {stops.map((s, i) => (
              <RouteStopRow compact key={i} role={i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop'} place={s} done={i > 0 && i <= ride.completedStops && i < stops.length - 1} isLast={i === stops.length - 1} />
            ))}
          </View>
        ) : ride.status === 'searching' || ride.status === 'no_driver' ? (
          <Text variant="label" numberOfLines={2}>{stops.map((s) => s.label).join(' → ')}</Text>
        ) : null}

        </ScrollView>
        <View style={{ paddingHorizontal: gutter, gap: 6, paddingTop: 2 }}>
        <SafetyButton rideId={ride.id} location={ride.driverLocation?.location ?? ride.route.stops[0]!.location} />
        {ride.status === 'no_driver' ? <Button label="Relancer la recherche" size="major" full loading={retry.isPending} onPress={() => retry.mutate()} testID="retry-search" /> : null}
        {ride.status === 'in_progress' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <CheckCircle2 size={16} color={colors.success} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>Suivi de démonstration · en cas de problème, maintenez le bouton SOS.</Text>
          </View>
        ) : null}
        {ride.status === 'no_driver' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Planifier" variant="secondary" style={{ flex: 1 }} full icon={<MapPinned size={17} color={colors.accent} />} loading={planLater.isPending} onPress={() => planLater.mutate()} testID="plan-later" />
            <Button label="Annuler" variant="secondary" style={{ flex: 1 }} full onPress={() => setCancelOpen(true)} testID="cancel-ride" />
          </View>
        ) : cancellable ? (
          <Button label={ride.status === 'searching' ? 'Annuler la demande' : 'Annuler la course'} variant="secondary" full onPress={() => setCancelOpen(true)} testID="cancel-ride" />
        ) : null}
        </View>
      </View>

      <CancelSheet ride={ride} visible={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={(r: Ride) => { setCancelOpen(false); router.replace({ pathname: '/receipt/[id]', params: { id: r.id } }); }} />
      {ride.driver ? <ContactSheet driver={ride.driver} visible={contactOpen} onClose={() => setContactOpen(false)} /> : null}
    </View>
  );
}
