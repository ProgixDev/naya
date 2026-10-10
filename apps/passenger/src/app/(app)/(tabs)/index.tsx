import { useTheme, GlassButton, IconButton, NayaMap, PressableScale, Sheet, StatusBanner, StatusPill, Text, haptic, toast, ListGroup, ListRow } from '@naya/ui';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CalendarClock, ChevronRight, Home as HomeIcon, LocateFixed, MapPin, Search } from 'lucide-react-native';
import { isInService, isRideActive, PLACES, RIDE_STATUS_LABELS, type Place } from '@naya/domain';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, shadow, themedStyles } from '@naya/tokens';
import { useAccountId, useActiveRide, useCities, useMe } from '@/lib/queries';
import { useDraft } from '@/lib/draft';
import { usePrefs } from '@/lib/prefs';
import { useTabBarSpace } from '@/components/TabBar';
import { useForegroundLocation } from '@/features/location/useLocation';
import { LocationExplainer } from '@/features/location/LocationExplainer';

const CITY_DEFAULT_PICKUP: Record<string, Place> = { rabat: PLACES.centreVille, casablanca: PLACES.casaPort };
/** Known demo landmark when there is one, otherwise the configured centre of the city (any city added from the back-office). */
const defaultPickup = (city: { id: string; name: string; center: Place['location'] }): Place =>
  CITY_DEFAULT_PICKUP[city.id] ?? { id: null, label: `${city.name} · Centre-ville`, address: `Centre-ville, ${city.name}`, location: city.center };

export default function Home() {
  useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const cities = useCities();
  const active = useActiveRide();
  const cityId = usePrefs((s) => s.cityId);
  const setCity = usePrefs((s) => s.setCity);
  const draft = useDraft();
  const loc = useForegroundLocation();
  const [explainer, setExplainer] = useState(false);
  const [cityPicker, setCityPicker] = useState(false);

  const city = cities.data?.find((c) => c.id === cityId) ?? cities.data?.[0];
  const user = me.data?.user;
  const canBookHere = city && (city.status === 'active' || user?.testerCities.includes(city.id));
  const pickup = draft.pickup ?? (city ? defaultPickup(city) : PLACES.centreVille);

  useEffect(() => {
    if (!draft.pickup && city) draft.setPickup(defaultPickup(city), 'default');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.id]);

  const changeCity = useMutation({
    mutationFn: (id: string) => api.me.update({ cityId: id }),
    onSuccess: (_u, id) => {
      setCity(id);
      draft.reset();
      qc.invalidateQueries({ queryKey: qk.me(a) });
      setCityPicker(false);
    },
  });

  const applyMyPosition = async () => {
    setExplainer(false);
    const p = await loc.locate();
    if (!p) return;
    if (city && !isInService(p, city.zones)) {
      toast('Votre position est hors de la zone desservie. Choisissez le départ sur la carte.', 'danger');
      return;
    }
    const place = await api.places.reverse(p).catch(() => ({ id: null, label: 'Ma position', address: 'Position actuelle', location: p }));
    draft.setPickup({ ...place, label: 'Ma position' }, 'gps');
    haptic.success();
  };

  const goTo = (destination: Place | null, schedule = false) => {
    if (destination) draft.setDestination(destination);
    router.push({ pathname: '/route', params: { schedule: schedule ? '1' : undefined, focus: destination ? undefined : 'destination' } });
  };

  const ride = active.data;
  const rideActive = ride && (isRideActive(ride.status) || ride.status === 'no_driver');
  const saved = user?.savedPlaces ?? [];
  const home = saved.find((s) => s.kind === 'home');
  const work = saved.find((s) => s.kind === 'work');
  const markers = useMemo(() => [{ id: 'pickup', kind: (draft.pickupSource === 'gps' ? 'me' : 'pickup') as 'me' | 'pickup', coordinate: pickup.location, label: pickup.label }], [pickup, draft.pickupSource]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="home">
      <NayaMap center={pickup.location} zoom={15} markers={markers} bottomInset={300} testID="home-map" />
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <GlassButton label={city?.name ?? 'Rabat'} icon={<MapPin size={18} color={colors.ink} />} onPress={() => setCityPicker(true)} testID="city-pill" accessibilityHint="Changer de ville" />
        <View style={{ flex: 1 }} />
        <IconButton icon={<LocateFixed size={22} color={colors.ink} />} accessibilityLabel="Utiliser ma position" onPress={() => (loc.status === 'granted' ? applyMyPosition() : setExplainer(true))} testID="locate" />
      </View>

      <View style={{ position: 'absolute', left: gutter - 4, right: gutter - 4, bottom: tabSpace }}>
        {rideActive ? (
          <PressableScale onPress={() => router.push('/ride')} accessibilityRole="button" style={[styles.activeCard]} testID="resume-ride">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ride.status === 'no_driver' ? colors.warning : colors.success }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{RIDE_STATUS_LABELS[ride.status]}</Text>
              <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{ride.route.stops.map((s) => short(s.label)).join(' → ')}</Text>
            </View>
            <Text weight="semibold" tone="accent" style={{ fontSize: 14, lineHeight: 18 }}>Suivre</Text>
            <ChevronRight size={18} color={colors.accent} />
          </PressableScale>
        ) : null}
        <View style={styles.card}>
          <View style={{ gap: 2 }}>
            <Text tone="muted" style={{ fontSize: 14, lineHeight: 19 }}>{user?.firstName ? `Bonjour ${user.firstName}` : 'Bienvenue chez Naya'}</Text>
            <Text weight="bold" style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }} accessibilityRole="header">Où allons-nous ?</Text>
          </View>
          {loc.status === 'denied' ? <StatusBanner tone="warning" title="Position non partagée" message="Placez votre point de départ sur la carte." action={{ label: 'Choisir sur la carte', onPress: () => router.push({ pathname: '/route', params: { pin: '1' } }) }} /> : null}
          {city && !canBookHere ? <StatusBanner compact tone="warning" title={`${city.name} en phase de test`} message="réservations réservées aux testeuses" /> : null}

          {/* Search field + "Plus tard" */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressableScale onPress={() => goTo(null)} accessibilityRole="search" accessibilityLabel="Où allez-vous ?" style={styles.search} testID="where-to" pressedScale={0.98}>
              <Search size={20} color={colors.accent} strokeWidth={2.2} />
              <Text weight="semibold" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>Où allez-vous ?</Text>
            </PressableScale>
            <PressableScale onPress={() => goTo(null, true)} testID="plan-trip" accessibilityRole="button" accessibilityLabel="Planifier un trajet" style={styles.later} pressedScale={0.97}>
              <CalendarClock size={18} color={colors.accent} strokeWidth={2} />
              <Text weight="semibold" tone="accent" style={{ fontSize: 14, lineHeight: 18 }}>Plus tard</Text>
            </PressableScale>
          </View>

          {/* Pickup */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginTop: -4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
            <Text tone="muted" numberOfLines={1} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>Départ : <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18 }}>{short(pickup.label)}</Text></Text>
          </View>

          {/* Saved places */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
            <PlaceRow icon={<HomeIcon size={18} color={colors.accent} strokeWidth={2} />} title="Maison" subtitle={home ? short(home.place.label) : 'Ajouter l’adresse'} add={!home} onPress={() => (home ? goTo(home.place) : router.push('/places'))} testID="saved-home" a11y={home ? `Maison : ${home.place.label}` : 'Ajouter l’adresse Maison'} />
            <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 52 }} />
            <PlaceRow icon={<Briefcase size={18} color={colors.accent} strokeWidth={2} />} title="Travail" subtitle={work ? short(work.place.label) : 'Ajouter l’adresse'} add={!work} onPress={() => (work ? goTo(work.place) : router.push('/places'))} testID="saved-work" a11y={work ? `Travail : ${work.place.label}` : 'Ajouter l’adresse Travail'} />
          </View>
        </View>
      </View>

      <LocationExplainer visible={explainer} onClose={() => setExplainer(false)} onAllow={applyMyPosition} onManual={() => { setExplainer(false); router.push({ pathname: '/route', params: { pin: '1' } }); }} />
      <Sheet visible={cityPicker} onClose={() => setCityPicker(false)} title="Ville" subtitle="Les prix et les moyens de paiement dépendent de la ville." testID="city-picker">
        <ListGroup>
          {(cities.data ?? []).map((c) => {
            const tester = user?.testerCities.includes(c.id);
            return (
              <ListRow
                key={c.id}
                testID={`city-${c.id}`}
                title={c.name}
                subtitle={c.status === 'active' ? 'Service ouvert' : tester ? 'Ville en test · accès testeuse' : 'Ville en test · bientôt disponible'}
                trailing={c.id === cityId ? <StatusPill tone="success" label="Sélectionnée" /> : c.status === 'test' ? <StatusPill tone="warning" label="Test" /> : undefined}
                onPress={() => changeCity.mutate(c.id)}
              />
            );
          })}
        </ListGroup>
      </Sheet>
    </View>
  );
}

const short = (label: string) => label.replace(/^[^·]+·\s*/, '');

/** Saved place shortcut: icon tile, name, address (or "Ajouter"), chevron. */
function PlaceRow({ icon, title, subtitle, add, onPress, testID, a11y }: { icon: React.ReactNode; title: string; subtitle: string; add: boolean; onPress: () => void; testID: string; a11y: string }) {
  useTheme();
  return (
    <PressableScale onPress={() => { haptic.select(); onPress(); }} testID={testID} accessibilityRole="button" accessibilityLabel={a11y} pressedScale={0.985} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingTop: 10, paddingHorizontal: 2 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{title}</Text>
        <Text tone={add ? 'accent' : 'muted'} weight={add ? 'medium' : 'regular'} numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{add ? `+ ${subtitle}` : subtitle}</Text>
      </View>
      <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
    </PressableScale>
  );
}

// Recomputed on each read so colours follow the active theme (light / dark).
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: 28, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 12, gap: 14, ...shadow.float },
  activeCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 14, marginBottom: 8, ...shadow.card },
  search: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, height: 54, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.line },
  later: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, height: 54, borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.mauveSoft },
}));
