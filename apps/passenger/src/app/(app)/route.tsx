import { useTheme, Button, EmptyState, Header, Icon, IconButton, ListGroup, ListRow, NayaMap, Screen, StatusBanner, Text, haptic, toast } from '@naya/ui';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, House, LocateFixed, MapPin, Search, Star, X } from 'lucide-react-native';
import { isInService, type LatLng, type Place } from '@naya/domain';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { useDraft } from '@/lib/draft';
import { useCities, useMe } from '@/lib/queries';
import { useCityId } from '@/lib/prefs';
import { useForegroundLocation } from '@/features/location/useLocation';

type Slot = { kind: 'pickup' } | { kind: 'destination' } | { kind: 'stop'; index: number } | { kind: 'newStop' };

function slotFrom(p: { slot?: string; index?: string; pin?: string }): Slot {
  if (p.slot === 'pickup' || (p.pin === '1' && !p.slot)) return { kind: 'pickup' };
  if (p.slot === 'stop') return { kind: 'stop', index: Number(p.index ?? 0) || 0 };
  if (p.slot === 'newStop') return { kind: 'newStop' };
  return { kind: 'destination' };
}

/**
 * P07: one address at a time, by search or on the map (R6, owner decision of 15 Oct 2026: no itinerary step).
 * From home, choosing the destination goes straight to the quote, which replaces this screen so that back
 * after booking never lands here (PAX-15). From the quote (`from=quote`), choosing returns to it: the route is
 * edited on the quote (stops, order, pickup on the map).
 *
 * Params: `slot` pickup | destination | stop | newStop (+ `index` for a stop), `pin=1` opens the map pin
 * directly, `schedule=1` carries « Planifier » to the quote, `from=quote`. The old `focus=destination` still works.
 */
export default function RouteEditor() {
  useTheme();
  const params = useLocalSearchParams<{ slot?: string; index?: string; pin?: string; schedule?: string; from?: string; focus?: string }>();
  const draft = useDraft();
  const cities = useCities();
  const cityId = useCityId();
  const city = cities.data?.find((c) => c.id === cityId);
  const slot = slotFrom(params);
  const pinFirst = params.pin === '1';
  const [pin, setPin] = useState(pinFirst);
  const fromQuote = params.from === 'quote';

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const finish = () => {
    if (fromQuote) return close();
    const d = useDraft.getState();
    // Replace, not push: the stack becomes [home, quote], and booking then replaces the quote with the ride.
    if (d.pickup && d.destination) router.replace({ pathname: '/quote', params: { schedule: params.schedule } });
    else close();
  };

  const assign = (place: Place, source?: 'gps') => {
    haptic.select();
    if (slot.kind === 'pickup') draft.setPickup(place, source ?? (place.id ? 'search' : 'manual'));
    else if (slot.kind === 'destination') draft.setDestination(place);
    else if (slot.kind === 'stop') draft.replaceStop(slot.index, place);
    else draft.addStop(place);
    finish();
  };

  const current = slot.kind === 'pickup' ? draft.pickup : slot.kind === 'stop' ? draft.stops[slot.index] : draft.destination;
  if (pin) {
    return (
      <PinPicker
        initial={(current ?? draft.pickup)?.location ?? city?.center ?? { lat: 34.0189, lng: -6.8367 }}
        zones={city?.zones ?? []}
        title={slot.kind === 'pickup' ? 'Point de départ' : 'Point choisi'}
        onCancel={() => (pinFirst ? close() : setPin(false))}
        onConfirm={(p) => assign(p)}
      />
    );
  }
  return <PlaceSearch slot={slot} cityId={cityId} zones={city?.zones ?? []} onCancel={close} onPick={assign} onPin={() => setPin(true)} />;
}

function PlaceSearch({ slot, cityId, zones, onPick, onCancel, onPin }: { slot: Slot; cityId: string; zones: { polygon: LatLng[]; active: boolean; id: string; cityId: string; name: string }[]; onPick: (p: Place, source?: 'gps') => void; onCancel: () => void; onPin: () => void }) {
  useTheme();
  const api = useApi();
  const me = useMe();
  const loc = useForegroundLocation();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const results = useQuery({ queryKey: qk.places(debounced, cityId), queryFn: () => api.places.search(debounced, cityId) });
  const saved = me.data?.user.savedPlaces ?? [];
  const title = slot.kind === 'pickup' ? 'Point de départ' : slot.kind === 'destination' ? 'Où allez-vous ?' : 'Arrêt';

  // Pickup only: start from where she stands (PAX-17). The system prompt follows this tap only.
  const pickMyPosition = async () => {
    const p = await loc.locate();
    if (!p) {
      toast('Localisation désactivée. Choisissez le départ sur la carte ou dans la liste.', 'warning');
      return;
    }
    if (zones.length && !isInService(p, zones)) {
      toast('Votre position est hors de la zone desservie. Choisissez le départ sur la carte.', 'danger');
      return;
    }
    const place = await api.places.reverse(p).catch(() => ({ id: null, label: 'Ma position', address: 'Position actuelle', location: p }));
    onPick({ ...place, label: 'Ma position' }, 'gps');
  };

  return (
    <Screen keyboard header={<Header title={title} onClose={onCancel} large={false} />}>
      <View style={{ gap: 16, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent }}>
          <Search size={20} color={colors.ink} />
          <TextInput ref={input} autoFocus value={q} onChangeText={setQ} placeholder="Rechercher une adresse ou un lieu" placeholderTextColor={colors.muted} style={[{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} accessibilityLabel={`Rechercher : ${title}`} testID="place-search" returnKeyType="search" />
          {results.isFetching ? <ActivityIndicator color={colors.accent} /> : null}
          {q ? <IconButton variant="plain" size={36} icon={<X size={18} color={colors.muted} />} accessibilityLabel="Effacer la recherche" onPress={() => setQ('')} /> : null}
        </View>
        {!debounced ? (
          <ListGroup>
            {slot.kind === 'pickup' ? <ListRow title="Ma position" leading={<Icon icon={LocateFixed} size={24} />} onPress={pickMyPosition} chevron={false} testID="search-my-position" /> : null}
            <ListRow title="Choisir sur la carte" leading={<Icon icon={MapPin} size={24} />} onPress={onPin} testID="search-pin" />
          </ListGroup>
        ) : null}
        {!debounced && saved.length ? (
          <ListGroup label="Adresses enregistrées">
            {saved.map((s) => (
              <ListRow key={s.id} title={s.label} subtitle={s.place.label} leading={<Icon icon={s.kind === 'home' ? House : s.kind === 'work' ? Briefcase : Star} size={24} />} onPress={() => onPick(s.place)} chevron={false} testID={`saved-${s.kind}`} />
            ))}
          </ListGroup>
        ) : null}
        {results.data && results.data.length ? (
          // P-17: a tap selects, so no chevrons; suggestions and results carry no glyph (only saved places have a type).
          <ListGroup label={debounced ? 'Résultats' : 'Lieux proposés'}>
            {results.data.map((p) => (
              <ListRow key={p.id ?? p.label} title={p.label} subtitle={p.address} onPress={() => onPick(p)} chevron={false} testID={`place-${p.id}`} />
            ))}
          </ListGroup>
        ) : null}
        {results.data && results.data.length === 0 && debounced ? <EmptyState title="Aucun lieu trouvé" message="Essayez un autre nom ou placez le point sur la carte." action={{ label: 'Choisir sur la carte', onPress: onPin }} /> : null}
        {results.isError ? <StatusBanner tone="danger" title="Recherche indisponible" message="Vérifiez votre connexion ou placez le point sur la carte." /> : null}
      </View>
    </Screen>
  );
}

/** Manual pin: the map moves under a fixed centre pin; the address resolves when it stops. */
function PinPicker({ initial, zones, title, onConfirm, onCancel }: { initial: LatLng; zones: { polygon: LatLng[]; active: boolean; id: string; cityId: string; name: string }[]; title: string; onConfirm: (p: Place) => void; onCancel: () => void }) {
  useTheme();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState(initial);
  const place = useQuery({ queryKey: ['naya', 'public', 'reverse', center.lat.toFixed(5), center.lng.toFixed(5)], queryFn: () => api.places.reverse(center) });
  const inZone = isInService(center, zones);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="pin-picker">
      <NayaMap center={initial} zoom={16} onCenterChange={setCenter} bottomInset={240} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 240, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
            <Text variant="caption" tone="inverse" weight="semibold">{title}</Text>
          </View>
          <MapPin size={40} color={colors.accent} fill={colors.surface} strokeWidth={2} />
        </View>
      </View>
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
        <IconButton icon={<X size={22} color={colors.ink} />} accessibilityLabel="Annuler" onPress={onCancel} testID="pin-cancel" />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: gutter, paddingBottom: insets.bottom + 16, gap: 12, ...shadow.float }}>
        <Text variant="heading">{title}</Text>
        <Text variant="label" tone="muted" numberOfLines={2}>{place.data?.address ?? 'Déplacez la carte pour placer le repère…'}</Text>
        {!inZone ? <StatusBanner compact tone="danger" title="Hors zone" message="déplacez le repère dans la zone de service" testID="pin-out-of-zone" /> : null}
        <Button label="Confirmer ce point" size="major" full disabled={!place.data || !inZone} onPress={() => place.data && onConfirm(place.data)} testID="confirm-pin" />
      </View>
    </View>
  );
}
