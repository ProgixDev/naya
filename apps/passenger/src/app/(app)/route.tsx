import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Home as HomeIcon, MapPin, Plus, Search, Star, X } from 'lucide-react-native';
import { isInService, type LatLng, type Place } from '@naya/domain';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { Button, Card, EmptyState, Header, IconButton, ListGroup, ListRow, NayaMap, RouteStopRow, Screen, StatusBanner, Text, haptic } from '@naya/ui';
import { MAX_STOPS, useDraft } from '@/lib/draft';
import { useCities, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';

type Slot = { kind: 'pickup' } | { kind: 'destination' } | { kind: 'stop'; index: number } | { kind: 'newStop' };

/** P07: pickup and destination search, manual pin, up to two ordered stops, zone checks. */
export default function RouteEditor() {
  const params = useLocalSearchParams<{ focus?: string; pin?: string; schedule?: string }>();
  const draft = useDraft();
  const cities = useCities();
  const cityId = usePrefs((s) => s.cityId);
  const city = cities.data?.find((c) => c.id === cityId);
  const [slot, setSlot] = useState<Slot | null>(params.pin ? null : params.focus === 'destination' || !draft.destination ? { kind: 'destination' } : null);
  const [pinFor, setPinFor] = useState<Slot | null>(params.pin ? { kind: 'pickup' } : null);

  const outOfZone = useMemo(() => {
    if (!city) return [] as string[];
    return [draft.pickup, ...draft.stops, draft.destination].filter((p): p is Place => !!p && !isInService(p.location, city.zones)).map((p) => p.label);
  }, [city, draft.pickup, draft.stops, draft.destination]);

  const assign = (s: Slot, place: Place) => {
    haptic.select();
    if (s.kind === 'pickup') draft.setPickup(place, place.id ? 'search' : 'manual');
    else if (s.kind === 'destination') draft.setDestination(place);
    else if (s.kind === 'stop') draft.replaceStop(s.index, place);
    else draft.addStop(place);
    setSlot(null);
    setPinFor(null);
  };

  if (pinFor) return <PinPicker initial={(pinFor.kind === 'pickup' ? draft.pickup : draft.destination)?.location ?? city?.center ?? { lat: 34.0189, lng: -6.8367 }} zones={city?.zones ?? []} title={pinFor.kind === 'pickup' ? 'Point de départ' : 'Point choisi'} onCancel={() => setPinFor(null)} onConfirm={(p) => assign(pinFor, p)} />;
  if (slot) return <PlaceSearch slot={slot} cityId={cityId} onCancel={() => setSlot(null)} onPick={(p) => assign(slot, p)} onPin={() => { setPinFor(slot); setSlot(null); }} />;

  const complete = !!draft.pickup && !!draft.destination;
  return (
    <Screen
      header={<Header title="Votre itinéraire" onBack={() => router.back()} />}
      footer={<Button label="Voir l’estimation" size="major" full disabled={!complete || outOfZone.length > 0} disabledReason={!complete ? 'Choisissez un départ et une destination.' : outOfZone.length ? 'Une adresse est hors zone.' : undefined} onPress={() => router.push({ pathname: '/quote', params: { schedule: params.schedule } })} testID="see-quote" />}
    >
      <View style={{ gap: 12, marginTop: 8 }}>
        <Card padded={false} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <RouteStopRow role="pickup" place={draft.pickup} placeholder="Choisir le départ" onPress={() => setSlot({ kind: 'pickup' })} testID="stop-pickup" />
          {draft.stops.map((s, i) => (
            <RouteStopRow
              key={`${s.label}-${i}`}
              role="stop"
              place={s}
              onPress={() => setSlot({ kind: 'stop', index: i })}
              onRemove={() => draft.removeStop(i)}
              onMoveUp={i > 0 ? () => draft.moveStop(i, -1) : undefined}
              onMoveDown={i < draft.stops.length - 1 ? () => draft.moveStop(i, 1) : undefined}
              testID={`stop-${i}`}
            />
          ))}
          <RouteStopRow role="destination" place={draft.destination} placeholder="Où allez-vous ?" onPress={() => setSlot({ kind: 'destination' })} isLast testID="stop-destination" />
        </Card>
        {outOfZone.length ? <StatusBanner compact tone="danger" title="Hors zone" message={`${outOfZone.join(', ')} · choisissez une adresse dans la zone ${city?.name ?? ''}`} testID="out-of-zone" /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {draft.stops.length < MAX_STOPS ? (
            <Button label="Ajouter un arrêt" variant="secondary" size="compact" style={{ flex: 1 }} full icon={<Plus size={16} color={colors.accent} />} onPress={() => setSlot({ kind: 'newStop' })} disabled={!draft.destination} testID="add-stop" />
          ) : null}
          <Button label="Départ sur la carte" variant="secondary" size="compact" style={{ flex: 1 }} full icon={<MapPin size={16} color={colors.accent} />} onPress={() => setPinFor({ kind: 'pickup' })} testID="pin-pickup" />
        </View>
        {draft.stops.length >= MAX_STOPS ? <StatusBanner compact tone="neutral" title="Deux arrêts maximum" message="retirez-en un pour en ajouter" testID="max-stops" /> : null}
        {!draft.destination ? <Text variant="caption" tone="muted">Choisissez la destination pour ajouter un arrêt.</Text> : draft.stops.length > 1 ? <Text variant="caption" tone="muted">Changez l’ordre avec les flèches ; le prix est recalculé ensuite.</Text> : null}
      </View>
    </Screen>
  );
}

function PlaceSearch({ slot, cityId, onPick, onCancel, onPin }: { slot: Slot; cityId: string; onPick: (p: Place) => void; onCancel: () => void; onPin: () => void }) {
  const api = useApi();
  const me = useMe();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const results = useQuery({ queryKey: qk.places(debounced, cityId), queryFn: () => api.places.search(debounced, cityId) });
  const saved = me.data?.user.savedPlaces ?? [];
  const title = slot.kind === 'pickup' ? 'Point de départ' : slot.kind === 'destination' ? 'Destination' : 'Arrêt';
  return (
    <Screen keyboard header={<Header title={title} onClose={onCancel} large={false} />}>
      <View style={{ gap: 12, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent }}>
          <Search size={20} color={colors.ink} />
          <TextInput ref={input} autoFocus value={q} onChangeText={setQ} placeholder="Rechercher une adresse ou un lieu" placeholderTextColor={colors.disabledText} style={[{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} accessibilityLabel={`Rechercher : ${title}`} testID="place-search" returnKeyType="search" />
          {results.isFetching ? <ActivityIndicator color={colors.accent} /> : null}
        </View>
        <Button label="Choisir sur la carte" variant="secondary" size="compact" style={{ alignSelf: 'flex-start' }} icon={<MapPin size={16} color={colors.accent} />} onPress={onPin} testID="search-pin" />
        {!debounced && saved.length ? (
          <ListGroup label="Adresses enregistrées">
            {saved.map((s) => (
              <ListRow key={s.id} title={s.label} subtitle={s.place.label} leading={s.kind === 'home' ? <HomeIcon size={20} color={colors.accent} /> : s.kind === 'work' ? <Briefcase size={20} color={colors.accent} /> : <Star size={20} color={colors.accent} />} onPress={() => onPick(s.place)} testID={`saved-${s.kind}`} />
            ))}
          </ListGroup>
        ) : null}
        {results.data && results.data.length ? (
          <ListGroup label={debounced ? 'Résultats' : 'Lieux proposés'}>
            {results.data.map((p) => (
              <ListRow key={p.id ?? p.label} title={p.label} subtitle={p.address} leading={<MapPin size={20} color={colors.muted} />} onPress={() => onPick(p)} testID={`place-${p.id}`} />
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
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
            <Text variant="caption" tone="inverse" weight="semibold">{title}</Text>
          </View>
          <MapPin size={40} color={colors.accent} fill={colors.surface} strokeWidth={2.2} />
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

