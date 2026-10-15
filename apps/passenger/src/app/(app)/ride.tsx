import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ArrowLeft, CalendarClock } from 'lucide-react-native';
import { formatDuration, formatMoney, haversineMeters, paymentMethodPresentation, secondsBetween, type LatLng, type Ride } from '@naya/domain';
import { errorMessage, newIdempotencyKey, qk, serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { Button, DriverCard, EmptyState, ErrorState, IconButton, NayaMap, RouteStopRow, SafetyDisc, StatusBanner, StatusIcon, Text, TextButton, haptic, toast, useTheme, type MapMarker } from '@naya/ui';
import { useAccountId, useActiveRide } from '@/lib/queries';
import { CancelSheet } from '@/features/ride/CancelSheet';
import { useDraft } from '@/lib/draft';
import { OtherEmergencyNumbers } from '@/features/ride/ContactSheet';

const LONG_WAIT_S = 45;
/** A stop closer than this names the place in the safety sheet (« près de Gare Rabat Ville »). */
const NEAR_M = 800;

/**
 * The phone's own position for SOS (PAX-03), read only when location access was already granted:
 * an alert never waits on a permission prompt. Null when unknown; the caller then says which
 * position is sent instead of passing the pickup off as the passenger's position.
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
        // No position: the pickup is sent, and the sheet says so.
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

/** The position sent with an SOS and where it is, in words (never raw coordinates, P-57). */
function sosPosition(ride: Ride, phone: LatLng | null): { location: LatLng; label: string } {
  const stops = ride.route.stops;
  const near = (p: LatLng) => {
    const closest = stops.map((s) => ({ s, d: haversineMeters(p, s.location) })).sort((x, y) => x.d - y.d)[0];
    return closest && closest.d <= NEAR_M ? `près de ${closest.s.label}` : null;
  };
  const car = ride.driverLocation;
  // On board, the car is where the passenger is.
  if (ride.status === 'in_progress' && car && !car.stale) {
    const n = near(car.location);
    return { location: car.location, label: n ? `Position de la voiture, ${n}` : 'Position de la voiture' };
  }
  if (phone) {
    const n = near(phone);
    return { location: phone, label: n ? `Votre position, ${n}` : 'Votre position actuelle' };
  }
  if (ride.status === 'in_progress' && car) return { location: car.location, label: 'Dernière position connue de la voiture' };
  return { location: stops[0]!.location, label: `Point de prise en charge : ${stops[0]!.label} (votre position n’est pas disponible)` };
}

export default function RideScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const active = useActiveRide();
  const phone = usePhonePosition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const lastId = useRef<string | null>(null);
  const lastStatus = useRef<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(serverClock.now());
  useEffect(() => {
    const t = setInterval(() => setNow(serverClock.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ride = active.data;
  useEffect(() => { if (ride) lastId.current = ride.id; }, [ride]);

  // When the ride leaves the active set (completed or cancelled), open its receipt. With no ride
  // seen on this mount there is nothing to follow: say so instead of spinning (PAX-09).
  useEffect(() => {
    if (!active.isSuccess || ride) return;
    if (lastId.current) router.replace({ pathname: '/receipt/[id]', params: { id: lastId.current } });
    else setEnded(true);
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

  const home = () => router.dismissTo('/');

  // PAX-09: every way out of the spinner names the cause and offers one move.
  if (!ride) {
    if (active.isError) {
      return (
        <View style={{ flex: 1, paddingTop: insets.top + 60, paddingHorizontal: gutter, backgroundColor: colors.background, gap: 8 }} testID="ride-error">
          <ErrorState onRetry={() => active.refetch()} />
          <TextButton label="Retour à l’accueil" onPress={home} testID="ride-home" />
        </View>
      );
    }
    if (ended) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: gutter, backgroundColor: colors.background }} testID="ride-none">
          <EmptyState title="Aucune course en cours" message="Votre course est terminée ou a été annulée. Retrouvez-la dans Trajets." action={{ label: 'Retour à l’accueil', onPress: home }} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }} testID="ride-loading">
        <ActivityIndicator color={colors.accent} accessibilityLabel="Chargement de la course" />
      </View>
    );
  }

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
  const cancellable = ['searching', 'driver_assigned', 'driver_arrived'].includes(ride.status);
  const name = ride.driver?.firstName ?? 'Votre chauffeuse';
  // The sheet title carries the state's word (A56); the header shows its glyph only.
  const title =
    ride.status === 'searching'
      ? recovered
        ? 'Nous cherchons une autre chauffeuse'
        : 'Nous cherchons une chauffeuse'
      : ride.status === 'no_driver'
        ? 'Aucune chauffeuse disponible'
        : ride.status === 'driver_assigned'
          ? etaMin
            ? `${name} arrive dans ${etaMin} min`
            : `${name} arrive`
          : ride.status === 'driver_arrived'
            ? `${name} est arrivée`
            : 'Trajet en cours';
  const sos = sosPosition(ride, phone);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID={`ride-${ride.status}`}>
      <View style={{ flex: 1, minHeight: '38%' }}>
        <NayaMap center={pickup.location} markers={markers} route={ride.status === 'in_progress' || ride.status === 'searching' || ride.status === 'no_driver' ? ride.route.polyline : undefined} fitTo={fit} topInset={insets.top + 8} bottomInset={36} interactive />
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Retour à l’accueil" onPress={home} testID="ride-back" />
            {/* A56: the ride's glyph, announced when it changes; the word is the sheet title. */}
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
              <StatusIcon kind="ride" state={ride.status} showLabel={false} announce testID="ride-status" />
            </View>
          </View>
          {/* X-02: pinned on the map's right edge, outside the sheet's scroll, never covered. */}
          <SafetyDisc rideId={ride.id} location={sos.location} locationLabel={sos.label} extra={<OtherEmergencyNumbers />} />
        </View>
      </View>

      <View style={{ maxHeight: '62%', marginTop: -28, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + 12, ...shadow.float }}>
        <ScrollView bounces={false} overScrollMode="never" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 10, gap: 12 }} showsVerticalScrollIndicator>
          <View style={{ gap: 4 }}>
            <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" numeric testID="ride-title">
              {title}
            </Text>
            {ride.status === 'searching' ? (
              <Text variant="label" tone="muted" numeric>
                {searchingFor >= LONG_WAIT_S ? 'La recherche prend plus de temps que d’habitude. Nous continuons.' : 'Votre demande est envoyée aux chauffeuses proches.'}
              </Text>
            ) : null}
            {ride.status === 'searching' ? (
              <Text variant="caption" tone="muted" numeric testID="ride-searching-for">
                Recherche depuis {Math.floor(searchingFor / 60)} min {String(searchingFor % 60).padStart(2, '0')} s
              </Text>
            ) : null}
            {/* A58: the title already says « aucune chauffeuse »; this line gives the two ways forward. */}
            {ride.status === 'no_driver' ? (
              <Text variant="label" tone="muted" testID="no-driver">
                Toutes les chauffeuses proches sont occupées. Relancez la recherche ou planifiez la course.
              </Text>
            ) : null}
            {ride.status === 'driver_arrived' ? <Text variant="label" tone="muted">Vérifiez la plaque avant de monter.</Text> : null}
            {ride.status === 'in_progress' ? <Text variant="label" tone="muted" numeric>{formatDuration(ride.route.durationSeconds)} de trajet · {formatMoney(ride.terms.breakdown.total)} · {paymentMethodPresentation(ride.paymentMethod).label}</Text> : null}
          </View>

          {recovered ? <StatusBanner compact tone="warning" title="Chauffeuse désistée" message={`${ride.driverCancellations[ride.driverCancellations.length - 1]!.reasonText} · annulation sans frais`} testID="driver-cancelled" /> : null}
          {ride.driverLocation?.stale ? <StatusBanner compact kind="location" state="stale" title="Position en attente" message={`dernier signal il y a ${secondsBetween(ride.driverLocation.at, now)} s · la course continue`} testID="stale-tracking" /> : null}

          {/* R8: no call or message action while Naya has no telephony; the 19 is in the safety sheet. */}
          {ride.driver && ['driver_assigned', 'driver_arrived', 'in_progress'].includes(ride.status) ? <DriverCard driver={ride.driver} arrived={ride.status === 'driver_arrived'} /> : null}

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
        {ride.status === 'no_driver' || cancellable ? (
          <View style={{ paddingHorizontal: gutter, gap: 4, paddingTop: 4 }}>
            {ride.status === 'no_driver' ? (
              <>
                <Button label="Relancer la recherche" size="major" full loading={retry.isPending} onPress={() => retry.mutate()} testID="retry-search" />
                {/* P-60: the two other ways out are text, not equal outlines. */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Button label="Planifier" variant="ghost" icon={<CalendarClock size={18} color={colors.accent} strokeWidth={2} />} loading={planLater.isPending} onPress={() => planLater.mutate()} testID="plan-later" />
                  <TextButton label="Annuler" tone="danger" onPress={() => setCancelOpen(true)} testID="cancel-ride" />
                </View>
              </>
            ) : (
              // P-58: cancelling is text, never a full-width button beside the ride.
              <TextButton label={ride.status === 'searching' ? 'Annuler la demande' : 'Annuler la course'} tone="danger" onPress={() => setCancelOpen(true)} testID="cancel-ride" />
            )}
          </View>
        ) : null}
      </View>

      <CancelSheet ride={ride} visible={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={(r: Ride) => { setCancelOpen(false); router.replace({ pathname: '/receipt/[id]', params: { id: r.id } }); }} />
    </View>
  );
}
