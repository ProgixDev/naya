import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Briefcase, CalendarClock, ChevronRight, Home as HomeIcon, LocateFixed, MapPin, Search } from 'lucide-react-native';
import { isInService, isRideActive, PLACES, RIDE_STATUS_LABELS, type Place } from '@naya/domain';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { FrostLayers, frostOutline, GlassButton, IconButton, NayaMap, PressableScale, Sheet, StatusBanner, StatusPill, Text, haptic, toast, Avatar, ListGroup, ListRow, avatarFor } from '@naya/ui';
import { useAccountId, useActiveRide, useCities, useMe } from '@/lib/queries';
import { useDraft } from '@/lib/draft';
import { usePrefs } from '@/lib/prefs';
import { useTabBarSpace } from '@/components/TabBar';
import { useForegroundLocation } from '@/features/location/useLocation';
import { LocationExplainer } from '@/features/location/LocationExplainer';

const CITY_DEFAULT_PICKUP: Record<string, Place> = { rabat: PLACES.centreVille, casablanca: PLACES.casaPort };

export default function Home() {
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
  const pickup = draft.pickup ?? CITY_DEFAULT_PICKUP[city?.id ?? 'rabat'] ?? PLACES.centreVille;

  useEffect(() => {
    if (!draft.pickup && city) draft.setPickup(CITY_DEFAULT_PICKUP[city.id] ?? { id: null, label: city.name, address: city.name, location: city.center }, 'default');
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

  const useMyPosition = async () => {
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
      <NayaMap center={pickup.location} zoom={15} markers={markers} bottomInset={240} testID="home-map" />
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <GlassButton label={`${city?.name ?? 'Rabat'} · ${draft.pickupSource === 'gps' ? 'Ma position' : pickup.label.replace(/^Rabat · /, '')}`} icon={<MapPin size={18} color={colors.ink} />} onPress={() => setCityPicker(true)} testID="city-pill" accessibilityHint="Changer de ville" />
        <View style={{ flex: 1 }} />
        <PressableScale onPress={() => router.push('/(app)/(tabs)/account')} accessibilityRole="button" accessibilityLabel="Mon compte" hitSlop={8}>
          <Avatar name={user?.firstName ?? 'N'} size={44} source={avatarFor(user?.firstName ?? '')} />
        </PressableScale>
      </View>
      <View style={{ position: 'absolute', right: gutter, bottom: tabSpace + 210 }}>
        <IconButton icon={<LocateFixed size={22} color={colors.ink} />} accessibilityLabel="Utiliser ma position" onPress={() => (loc.status === 'granted' ? useMyPosition() : setExplainer(true))} testID="locate" />
      </View>

      <View style={{ position: 'absolute', left: gutter - 4, right: gutter - 4, bottom: tabSpace }}>
        {rideActive ? (
          <PressableScale onPress={() => router.push('/ride')} accessibilityRole="button" style={[styles.activeCard]} testID="resume-ride">
            <View style={{ flex: 1, gap: 4 }}>
              <StatusPill tone={ride.status === 'no_driver' ? 'warning' : 'info'} label={RIDE_STATUS_LABELS[ride.status]} />
              <Text variant="label" numberOfLines={1}>{ride.route.stops.map((s) => s.label).join(' → ')}</Text>
            </View>
            <ChevronRight size={22} color={colors.ink} />
          </PressableScale>
        ) : null}
        <View style={styles.card}>
          <Text variant="title" style={{ fontSize: 22, lineHeight: 27 }} accessibilityRole="header">
            {user?.firstName ? `On y va, ${user.firstName} ?` : 'On y va ?'}
          </Text>
          {loc.status === 'denied' ? <StatusBanner tone="warning" title="Position non partagée" message="Placez votre point de départ sur la carte." action={{ label: 'Choisir sur la carte', onPress: () => router.push({ pathname: '/route', params: { pin: '1' } }) }} /> : null}
          {city && !canBookHere ? <StatusBanner compact tone="warning" title={`${city.name} en phase de test`} message="réservations réservées aux testeuses" /> : null}
          <PressableScale onPress={() => goTo(null)} accessibilityRole="search" accessibilityLabel="Où allez-vous ?" style={styles.search} testID="where-to" pressedScale={0.98}>
            <Search size={20} color={colors.accent} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Où allez-vous ?
            </Text>
            <View style={styles.go}>
              <ArrowRight size={18} color={colors.inverse} />
            </View>
          </PressableScale>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <QuickPill label={home ? 'Maison' : 'Maison +'} icon={<HomeIcon size={16} color={colors.accent} />} onPress={() => (home ? goTo(home.place) : router.push('/places'))} testID="saved-home" a11y={home ? `Maison : ${home.place.label}` : 'Ajouter l’adresse Maison'} />
            <QuickPill label={work ? 'Travail' : 'Travail +'} icon={<Briefcase size={16} color={colors.accent} />} onPress={() => (work ? goTo(work.place) : router.push('/places'))} testID="saved-work" a11y={work ? `Travail : ${work.place.label}` : 'Ajouter l’adresse Travail'} />
            <QuickPill label="Plus tard" icon={<CalendarClock size={16} color={colors.accent} />} onPress={() => goTo(null, true)} testID="plan-trip" a11y="Planifier un trajet" />
          </View>
        </View>
      </View>

      <LocationExplainer visible={explainer} onClose={() => setExplainer(false)} onAllow={useMyPosition} onManual={() => { setExplainer(false); router.push({ pathname: '/route', params: { pin: '1' } }); }} />
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

/** Frosted shortcut pill: one tap to a saved place or to planning. */
function QuickPill({ label, icon, onPress, testID, a11y }: { label: string; icon: React.ReactNode; onPress: () => void; testID: string; a11y: string }) {
  return (
    <PressableScale onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={a11y} style={[styles.chip, frostOutline]} pressedScale={0.96}>
      <FrostLayers radius={21} tint="mauve" />
      {/* Wrapped so the content paints above the absolutely positioned frost layers (web stacking). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = {
  card: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 16, gap: 12, ...shadow.float },
  activeCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 14, marginBottom: 8, ...shadow.card },
  search: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, height: 56, borderRadius: 28, paddingLeft: 20, paddingRight: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: 'rgba(46,32,44,0.06)' },
  go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  chip: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, height: 42, borderRadius: 21, paddingHorizontal: 10, overflow: 'hidden' as const },
};
