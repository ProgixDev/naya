import { useTheme , AppBar, Button, Card, EmptyState, Header, IconButton, ListGroup, ListRow, NayaMap, PressableScale, RouteStopRow, Screen, StatusBanner, Text, haptic } from '@naya/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, ChevronLeft, ChevronRight, Home as HomeIcon, MapPin, Plus, Search, Star, X } from 'lucide-react-native';
import { isInService, PLACES, type LatLng, type Place } from '@naya/domain';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, getColorScheme, gutter, radius, shadow } from '@naya/tokens';
import { MAX_STOPS, useDraft } from '@/lib/draft';
import { useCities, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { PinPicker } from '@/components/PinPicker';

type Slot = { kind: 'pickup' } | { kind: 'destination' } | { kind: 'stop'; index: number } | { kind: 'newStop' };

/** P07: pickup and destination search, manual pin, up to two ordered stops, zone checks. */
export default function RouteEditor() {
  useTheme();
  const insets = useSafeAreaInsets();
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

  const editorHeader = <AppBar title={'Votre itinéraire'} onBack={() => router.back()} />;

  return (
    <Screen
      header={editorHeader}
      footer={<Button label="Voir l’estimation" size="major" full disabled={!complete || outOfZone.length > 0} disabledReason={!complete ? 'Choisissez un départ et une destination.' : outOfZone.length ? 'Une adresse est hors zone.' : undefined} onPress={() => router.push({ pathname: '/quote', params: { schedule: params.schedule } })} testID="see-quote" />}
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.line,
            paddingHorizontal: 16,
            paddingVertical: 8,
            ...shadow.card,
          }}
        >
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
        </View>

        {outOfZone.length ? (
          <StatusBanner
            compact
            tone="danger"
            title="Hors zone"
            message={`${outOfZone.join(', ')} · choisissez une adresse dans la zone ${city?.name ?? ''}`}
            style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 }}
            testID="out-of-zone"
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {draft.stops.length < MAX_STOPS ? (
            <PressableScale
              onPress={() => {
                haptic.select();
                setSlot({ kind: 'newStop' });
              }}
              disabled={!draft.destination}
              testID="add-stop"
              accessibilityRole="button"
              accessibilityLabel="Ajouter un arrêt"
              style={{
                flex: 1,
                height: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: radius.pill,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                opacity: !draft.destination ? 0.45 : 1,
                ...shadow.card,
              }}
            >
              <Plus size={18} color={colors.accent} strokeWidth={2.5} />
              <Text variant="action" weight="bold" style={{ color: colors.accent, fontSize: 14 }}>
                Ajouter un arrêt
              </Text>
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={() => {
              haptic.select();
              setPinFor({ kind: 'pickup' });
            }}
            testID="pin-pickup"
            accessibilityRole="button"
            accessibilityLabel="Départ sur la carte"
            style={{
              flex: 1,
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: radius.pill,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              ...shadow.card,
            }}
          >
            <MapPin size={18} color={colors.accent} strokeWidth={2} />
            <Text variant="action" weight="bold" style={{ color: colors.accent, fontSize: 14 }} numberOfLines={1}>
              Départ sur la carte
            </Text>
          </PressableScale>
        </View>

        {draft.stops.length >= MAX_STOPS ? (
          <StatusBanner
            compact
            tone="neutral"
            title="Deux arrêts maximum"
            message="retirez-en un pour en ajouter"
            style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 }}
            testID="max-stops"
          />
        ) : null}
        {!draft.destination ? (
          <Text variant="caption" tone="muted" style={{ paddingHorizontal: 6 }}>
            Choisissez la destination pour ajouter un arrêt.
          </Text>
        ) : draft.stops.length > 1 ? (
          <Text variant="caption" tone="muted" style={{ paddingHorizontal: 6 }}>
            Changez l’ordre avec les flèches ; le prix est recalculé ensuite.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function PlaceSearch({ slot, cityId, onPick, onCancel, onPin }: { slot: Slot; cityId: string; onPick: (p: Place) => void; onCancel: () => void; onPin: () => void }) {
  useTheme();
  const insets = useSafeAreaInsets();
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
  const rawSaved = me.data?.user.savedPlaces ?? [];
  const saved = rawSaved.length
    ? rawSaved
    : [
        { id: 'default-home', label: 'Maison', place: PLACES.hayRiad, kind: 'home' as const },
        { id: 'default-work', label: 'Travail', place: PLACES.agdal, kind: 'work' as const },
      ];
  const title = slot.kind === 'pickup' ? 'Point de départ' : slot.kind === 'destination' ? 'Destination' : 'Arrêt';
  const isDark = getColorScheme() === 'dark';

  const customHeader = <AppBar title={title} onBack={onCancel} />;

  return (
    <Screen keyboard header={customHeader}>
      <View style={{ gap: 16, marginTop: 2 }}>
        {/* Search input bar matching reference: pill shape, plum outline */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            height: 56,
            borderRadius: radius.pill,
            paddingHorizontal: 20,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.accent,
            ...shadow.card,
          }}
        >
          <Search size={20} color={colors.ink} strokeWidth={2} />
          <TextInput
            ref={input}
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher une adresse ou un lieu"
            placeholderTextColor="#8E8592"
            style={[
              { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, color: colors.ink },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
            accessibilityLabel={`Rechercher : ${title}`}
            testID="place-search"
            returnKeyType="search"
          />
          {results.isFetching ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : q.length > 0 ? (
            <Pressable
              onPress={() => {
                haptic.select();
                setQ('');
                input.current?.focus();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              style={{ padding: 4 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: isDark ? colors.selected : '#ECE6EA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={13} color={colors.ink} strokeWidth={2.5} />
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* Choisir sur la carte pill button */}
        <PressableScale
          onPress={() => {
            haptic.select();
            onPin();
          }}
          testID="search-pin"
          accessibilityRole="button"
          accessibilityLabel="Choisir sur la carte"
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            ...shadow.card,
          }}
        >
          <MapPin size={16} color={colors.accent} strokeWidth={2} />
          <Text variant="action" weight="bold" style={{ color: colors.accent, fontSize: 15 }}>
            Choisir sur la carte
          </Text>
        </PressableScale>

        {/* Section 1: ADRESSES ENREGISTRÉES */}
        {!debounced && saved.length ? (
          <View style={{ gap: 2 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.muted,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                marginBottom: 10,
                marginLeft: 6,
              }}
            >
              ADRESSES ENREGISTRÉES
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.line,
                overflow: 'hidden',
                ...shadow.card,
              }}
            >
              {saved.map((s, index) => {
                const isHome = s.kind === 'home';
                const isWork = s.kind === 'work';
                return (
                  <View key={s.id}>
                    <PressableScale
                      onPress={() => {
                        haptic.select();
                        onPick(s.place);
                      }}
                      testID={`saved-${s.kind}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.label}, ${s.place.label}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 16,
                          backgroundColor: isDark ? colors.selected : '#F9EEF4',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isHome ? (
                          <HomeIcon size={22} color={colors.accent} strokeWidth={1.8} />
                        ) : isWork ? (
                          <Briefcase size={22} color={colors.accent} strokeWidth={1.8} />
                        ) : (
                          <Star size={22} color={colors.accent} strokeWidth={1.8} />
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                          {s.label}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                          {s.place.label}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
                    </PressableScale>
                    {index < saved.length - 1 ? (
                      <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: 16 }} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Section 2: LIEUX PROPOSÉS / RÉSULTATS */}
        {results.data && results.data.length ? (
          <View style={{ gap: 2 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.muted,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                marginBottom: 10,
                marginTop: 6,
                marginLeft: 6,
              }}
            >
              {debounced ? 'RÉSULTATS' : 'LIEUX PROPOSÉS'}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.line,
                overflow: 'hidden',
                ...shadow.card,
              }}
            >
              {results.data.map((p, index) => (
                <View key={p.id ?? p.label}>
                  <PressableScale
                    onPress={() => {
                      haptic.select();
                      onPick(p);
                    }}
                    testID={`place-${p.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.label}, ${p.address}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        backgroundColor: isDark ? colors.selected : '#F5EFE8',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MapPin size={22} color={isDark ? colors.ink : '#5C5550'} strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                        {p.label}
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                        {p.address}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
                  </PressableScale>
                  {index < (results.data?.length ?? 0) - 1 ? (
                    <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: 16 }} />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {results.data && results.data.length === 0 && debounced ? (
          <EmptyState
            title="Aucun lieu trouvé"
            message="Essayez un autre nom ou placez le point sur la carte."
            action={{ label: 'Choisir sur la carte', onPress: onPin }}
          />
        ) : null}

        {results.isError ? (
          <StatusBanner
            tone="danger"
            title="Recherche indisponible"
            message="Vérifiez votre connexion ou placez le point sur la carte."
          />
        ) : null}
      </View>
    </Screen>
  );
}
