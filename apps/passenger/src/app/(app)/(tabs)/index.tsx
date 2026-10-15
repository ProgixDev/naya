import { useTheme, useA11yPrefs, FamilleHomeCard, Glass, Icon, IconButton, ListGroup, ListRow, NayaMap, PressableScale, Sheet, StatusBanner, StatusIcon, Text, haptic, toast } from '@naya/ui';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Baby, Briefcase, ChevronDown, ChevronRight, Droplets, House, LocateFixed, Plus, Search, type LucideIcon } from 'lucide-react-native';
import { isInService, isRideActive, PLACES, statusPresentation, type Place, type Ride } from '@naya/domain';
import { errorMessage, qk, type MeResponse } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow, themedStyles } from '@naya/tokens';
import { useAccountId, useActiveRide, useCities, useMe } from '@/lib/queries';
import { useDraft } from '@/lib/draft';
import { useCityId } from '@/lib/prefs';
import { useTabBarSpace } from '@/components/TabBar';
import { useForegroundLocation } from '@/features/location/useLocation';
import { LocationExplainer } from '@/features/location/LocationExplainer';

const CITY_DEFAULT_PICKUP: Record<string, Place> = { rabat: PLACES.centreVille, casablanca: PLACES.casaPort };
const shortLabel = (label: string) => label.replace(/^(Rabat|Casablanca) · /, '');

/**
 * P06 home (redesign audit P-11 to P-16, P-61, R7). One job: « Où allez-vous ? ». Maison and Travail are rows
 * with their addresses, Famille and Lavage share one services rail, and an active ride replaces the whole card.
 * The pickup is the passenger's position when she has already allowed it (PAX-17); otherwise the city's default
 * pickup, labelled as such on the map and on the quote.
 */
export default function Home() {
  useTheme();
  // At the largest text sizes the « Maintenant » chip leaves « Où allez-vous ? » no room: it moves under the pill.
  const { largeText } = useA11yPrefs();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const cities = useCities();
  const active = useActiveRide();
  // The server's user.cityId is the passenger's city (ADR-0054); the device only caches it.
  const cityId = useCityId();
  const draft = useDraft();
  const loc = useForegroundLocation();
  const [explainer, setExplainer] = useState(false);
  const [cityPicker, setCityPicker] = useState(false);
  const [whenPicker, setWhenPicker] = useState(false);
  const [cardHeight, setCardHeight] = useState(300);

  const city = cities.data?.find((c) => c.id === cityId) ?? cities.data?.[0];
  const user = me.data?.user;
  const canBookHere = city && (city.status === 'active' || user?.testerCities.includes(city.id));
  const pickup = draft.pickup ?? CITY_DEFAULT_PICKUP[city?.id ?? 'rabat'] ?? PLACES.centreVille;

  // A pickup always exists: the city's default until the passenger's position replaces it (also after a booking reset the draft).
  useEffect(() => {
    if (!draft.pickup && city) draft.setPickup(CITY_DEFAULT_PICKUP[city.id] ?? { id: null, label: city.name, address: city.name, location: city.center }, 'default');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.id, !draft.pickup]);

  /** Her position as the pickup. `auto` (permission already granted, PAX-17) stays silent and never overrides her own choice. */
  const applyMyPosition = async (auto = false) => {
    setExplainer(false);
    const p = await loc.locate();
    if (!p) return;
    if (city && !isInService(p, city.zones)) {
      if (!auto) toast('Votre position est hors de la zone desservie. Choisissez le départ sur la carte.', 'danger');
      return;
    }
    const place = await api.places.reverse(p).catch(() => ({ id: null, label: 'Ma position', address: 'Position actuelle', location: p }));
    if (auto && useDraft.getState().pickupSource !== 'default') return;
    draft.setPickup({ ...place, label: 'Ma position' }, 'gps');
    if (!auto) haptic.success();
  };

  // PAX-17: when location is already allowed, the default pickup is her position. No prompt is shown from here.
  useEffect(() => {
    if (!city || (draft.pickup && draft.pickupSource !== 'default')) return;
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((perm) => {
        if (!cancelled && perm.granted) void applyMyPosition(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.id, draft.pickupSource === 'default']);

  const changeCity = useMutation({
    mutationFn: (id: string) => api.me.update({ cityId: id }),
    onSuccess: (updated) => {
      // Show the new city at once; the refetch brings the city's rules and payment availability.
      qc.setQueryData<MeResponse>(qk.me(a), (old) => (old ? { ...old, user: updated } : old));
      draft.reset();
      qc.invalidateQueries({ queryKey: qk.me(a) });
      qc.invalidateQueries({ queryKey: qk.paymentMethods(a) });
      setCityPicker(false);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  /** A known destination goes straight to the quote; otherwise the address search, which then replaces itself with the quote (R6). */
  const goTo = (destination: Place | null, schedule = false) => {
    if (destination) {
      draft.setDestination(destination);
      router.push({ pathname: '/quote', params: { schedule: schedule ? '1' : undefined } });
      return;
    }
    router.push({ pathname: '/route', params: { slot: 'destination', schedule: schedule ? '1' : undefined } });
  };
  const pickOnMap = () => router.push({ pathname: '/route', params: { slot: 'pickup', pin: '1' } });

  const ride = active.data;
  const rideActive = !!ride && (isRideActive(ride.status) || ride.status === 'no_driver');
  const saved = user?.savedPlaces ?? [];
  const home = saved.find((s) => s.kind === 'home');
  const work = saved.find((s) => s.kind === 'work');
  // During a ride the map shows the ride's pickup, not the draft's.
  const ridePickup = rideActive ? ride.route.stops[0] : undefined;
  const mapPlace = ridePickup ?? pickup;
  const markers = useMemo(
    () => [{ id: 'pickup', kind: (!ridePickup && draft.pickupSource === 'gps' ? 'me' : 'pickup') as 'me' | 'pickup', coordinate: mapPlace.location, label: !ridePickup && draft.pickupSource === 'default' ? `${shortLabel(mapPlace.label)} · départ par défaut` : shortLabel(mapPlace.label) }],
    [mapPlace, ridePickup, draft.pickupSource],
  );
  const locationOff = loc.status === 'denied';

  const whenChip = (
    <PressableScale onPress={() => setWhenPicker(true)} accessibilityRole="button" accessibilityLabel="Départ : maintenant. Changer pour planifier un trajet" style={[styles.when, largeText ? styles.whenStacked : null]} testID="plan-trip" hitSlop={4} pressedScale={0.96}>
      <Text variant="caption" weight="semibold">Maintenant</Text>
      <ChevronDown size={14} color={colors.ink} />
    </PressableScale>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="home">
      <NayaMap center={mapPlace.location} zoom={15} markers={markers} bottomInset={cardHeight + 16} testID="home-map" />
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          {/* A47: the city reads as a picker (trailing chevron), not as a place. */}
          <PressableScale onPress={() => setCityPicker(true)} accessibilityRole="button" accessibilityLabel={`Ville : ${city?.name ?? 'Rabat'}`} accessibilityHint="Changer de ville" testID="city-pill" hitSlop={4}>
            <Glass radius={999} contentStyle={{ height: 44, paddingLeft: 16, paddingRight: 12, gap: 6 }}>
              <Text variant="label" weight="semibold" numberOfLines={1}>{city?.name ?? 'Rabat'}</Text>
              <ChevronDown size={16} color={colors.ink} />
            </Glass>
          </PressableScale>
        </View>
        {/* P-61: a Famille interruption sits at the top, never stacked on the ride or the home card. */}
        <FamilleHomeCard accountId={a} onOpenTrip={(id) => router.push({ pathname: '/family/[id]', params: { id } })} />
      </View>
      <View style={{ position: 'absolute', right: gutter, bottom: tabSpace + cardHeight + 12 }}>
        <IconButton icon={<LocateFixed size={22} color={colors.ink} />} accessibilityLabel="Utiliser ma position" onPress={() => (loc.status === 'granted' ? applyMyPosition() : setExplainer(true))} testID="locate" />
      </View>

      <View style={{ position: 'absolute', left: gutter - 4, right: gutter - 4, bottom: tabSpace }} onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}>
        {rideActive ? (
          <ActiveRideCard ride={ride} />
        ) : (
          <View style={styles.card}>
            {locationOff ? <StatusBanner kind="location" state="off" title="Localisation désactivée" message="Placez votre point de départ sur la carte." action={{ label: 'Choisir sur la carte', onPress: pickOnMap }} testID="location-off" /> : null}
            {city && !canBookHere ? <StatusBanner compact kind="city" state="test" title={`${city.name} en test`} message="réservations ouvertes aux testeuses" /> : null}
            {/* P-11: the search pill holds the one other choice, when. Two sibling buttons: no nested pressables. */}
            <View style={styles.search}>
              <PressableScale onPress={() => goTo(null)} accessibilityRole="search" accessibilityLabel="Où allez-vous ?" style={styles.searchTap} testID="where-to" pressedScale={0.98}>
                <Search size={20} color={colors.inverse} />
                <Text variant="bodyStrong" tone="inverse" numberOfLines={2} style={{ flex: 1 }}>
                  Où allez-vous ?
                </Text>
              </PressableScale>
              {largeText ? null : whenChip}
            </View>
            {largeText ? whenChip : null}
            <View>
              <SavedPlaceRow icon={House} title="Maison" address={home ? shortLabel(home.place.label) : undefined} onPress={() => (home ? goTo(home.place) : router.push('/places'))} testID="saved-home" />
              <View style={styles.separator} />
              <SavedPlaceRow icon={Briefcase} title="Travail" address={work ? shortLabel(work.place.label) : undefined} onPress={() => (work ? goTo(work.place) : router.push('/places'))} testID="saved-work" />
            </View>
            {/* R7: one services rail, below the trip choices. */}
            <View style={{ gap: 8 }}>
              <Text variant="caption" tone="muted" weight="semibold" accessibilityRole="header">Services</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ServiceTile icon={Baby} title="Naya Famille" detail="Trajets enfants" a11y="Naya Famille : trajets enfants avec une chauffeuse dédiée" onPress={() => router.push('/family')} testID="home-famille" />
                <ServiceTile icon={Droplets} title="Lavage" detail="À domicile" a11y="Lavage à domicile : votre voiture lavée là où elle est garée" onPress={() => router.push('/car-wash')} testID="car-wash-entry" />
              </View>
            </View>
          </View>
        )}
      </View>

      <LocationExplainer visible={explainer} denied={locationOff} onClose={() => setExplainer(false)} onAllow={() => applyMyPosition()} onManual={() => { setExplainer(false); pickOnMap(); }} />
      <Sheet visible={whenPicker} onClose={() => setWhenPicker(false)} title="Départ" testID="when-picker">
        <ListGroup>
          <ListRow title="Maintenant" subtitle="Recherche d’une chauffeuse dès la confirmation" selected onPress={() => setWhenPicker(false)} testID="when-now" />
          <ListRow title="Planifier" subtitle="Choisissez le jour et l’heure avec le prix" selected={false} onPress={() => { setWhenPicker(false); goTo(null, true); }} testID="when-later" />
        </ListGroup>
      </Sheet>
      <Sheet visible={cityPicker} onClose={() => setCityPicker(false)} title="Ville" subtitle="Les prix et les moyens de paiement dépendent de la ville." testID="city-picker">
        <ListGroup>
          {(cities.data ?? []).map((c) => {
            const tester = user?.testerCities.includes(c.id);
            return (
              <ListRow
                key={c.id}
                testID={`city-${c.id}`}
                title={c.name}
                // P-16: « En test » is said once, by the chip; the sub-line says what it means for her.
                subtitle={c.status === 'active' ? 'Service ouvert' : tester ? 'Accès testeuse' : 'Bientôt disponible'}
                status={c.status !== 'active' ? { kind: 'city', state: c.status, showLabel: true } : undefined}
                selected={c.id === cityId}
                onPress={() => (c.id === cityId ? setCityPicker(false) : changeCity.isPending ? undefined : changeCity.mutate(c.id))}
              />
            );
          })}
        </ListGroup>
      </Sheet>
    </View>
  );
}

/** P-61: the active ride replaces the home card: who, the plate to check, or the state's word when it is a problem. */
function ActiveRideCard({ ride }: { ride: Ride }) {
  useTheme();
  const p = statusPresentation('ride', ride.status);
  const d = ride.driver;
  const meeting = !!d && (ride.status === 'driver_assigned' || ride.status === 'driver_arrived');
  const title = meeting && d ? (ride.status === 'driver_arrived' ? `${d.firstName} est arrivée` : `${d.firstName} est en route`) : p.label;
  const route = ride.route.stops.map((s) => shortLabel(s.label)).join(' → ');
  const vehicle = meeting && d ? `${d.vehicle.model} · ${d.vehicle.color}` : null;
  return (
    <PressableScale
      onPress={() => router.push('/ride')}
      accessibilityRole="button"
      accessibilityLabel={[title, meeting && d ? `plaque ${d.vehicle.plate}` : null, vehicle, route].filter(Boolean).join(', ')}
      accessibilityHint="Ouvrir la course"
      style={[styles.card, styles.rideCard]}
      testID="resume-ride"
      pressedScale={0.985}
    >
      <StatusIcon kind="ride" state={ride.status} variant="disc" accessible={false} testID="resume-ride-status" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="heading" numberOfLines={2}>{title}</Text>
        {meeting && d ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.plate}>
              <Text variant="label" weight="bold" numeric numberOfLines={1}>{d.vehicle.plate}</Text>
            </View>
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>{vehicle}</Text>
          </View>
        ) : (
          <Text variant="caption" tone="muted" numberOfLines={1}>{route}</Text>
        )}
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </PressableScale>
  );
}

/** Maison / Travail: a 52 row with the address; a « + » badge on the glyph when the address is still to add (A51). */
function SavedPlaceRow({ icon, title, address, onPress, testID }: { icon: LucideIcon; title: string; address?: string; onPress: () => void; testID: string }) {
  useTheme();
  const missing = !address;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={missing ? `Ajouter l’adresse ${title}` : `${title} : ${address}`} style={styles.placeRow} testID={testID} pressedScale={0.985}>
      <View>
        <Icon icon={icon} size={24} />
        {missing ? (
          <View style={styles.plusBadge}>
            <Plus size={10} strokeWidth={3} color={colors.inverse} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" weight="semibold" numberOfLines={1}>{title}</Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>{address ?? 'Ajouter l’adresse'}</Text>
      </View>
    </PressableScale>
  );
}

/** One service in the rail: its glyph says which service, the words say what it is. */
function ServiceTile({ icon, title, detail, a11y, onPress, testID }: { icon: LucideIcon; title: string; detail: string; a11y: string; onPress: () => void; testID: string }) {
  useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={styles.tile} testID={testID} pressedScale={0.985}>
      <Icon icon={icon} size={20} />
      <View style={{ flex: 1, gap: 1 }}>
        {/* Two lines each: at the largest text sizes « Naya Famille » must not end in « … ». */}
        <Text variant="label" weight="semibold" numberOfLines={2}>{title}</Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>{detail}</Text>
      </View>
    </PressableScale>
  );
}

// themedStyles: read per render, so the cards follow light/dark mode.
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 20, gap: 16, borderWidth: 1, borderColor: colors.hairline, ...shadow.float },
  rideCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 16 },
  plate: { borderWidth: 1, borderColor: colors.outline, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  search: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 52, borderRadius: 26, paddingRight: 6, backgroundColor: colors.accent },
  searchTap: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 52, paddingLeft: 18 },
  when: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.surface },
  whenStacked: { alignSelf: 'flex-start' as const, minHeight: 44, borderWidth: 1, borderColor: colors.outline },
  placeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, minHeight: 52, paddingVertical: 6 },
  separator: { height: 1, backgroundColor: colors.line, marginLeft: 38 },
  plusBadge: { position: 'absolute' as const, right: -4, bottom: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1.5, borderColor: colors.surface },
  tile: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.background },
}));
