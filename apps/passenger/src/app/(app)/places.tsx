import { useTheme, FormField, Header, IconButton, ListGroup, ListRow, Pill, Screen, Sheet, Text, haptic, toast } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Home as HomeIcon, Map as MapIcon, MapPin, Plus, Star, Trash2 } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { Place, SavedPlace } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId, useCities, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { AccountGroup, AccountRow } from '@/components/AccountList';
import { PinPicker } from '@/components/PinPicker';

const ICON = { home: HomeIcon, work: Briefcase, other: Star };

/** P13-address: Maison and Travail slots always visible with an add action, then other places; add by search, remove. */
export default function Places() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const cityId = usePrefs((s) => s.cityId);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<SavedPlace['kind']>('home');
  const [label, setLabel] = useState('Maison');
  const [q, setQ] = useState('');
  const [pinning, setPinning] = useState(false);
  const cities = useCities();
  const city = cities.data?.find((c) => c.id === cityId);
  const results = useQuery({ queryKey: qk.places(q, cityId), queryFn: () => api.places.search(q, cityId), enabled: adding });
  const add = useMutation({
    mutationFn: (place: Place) => api.me.addPlace({ kind, label: label.trim() || 'Adresse', place }),
    onSuccess: () => {
      haptic.success();
      toast('Adresse enregistrée');
      setAdding(false);
      setPinning(false);
      qc.invalidateQueries({ queryKey: qk.me(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.me.removePlace(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const saved = me.data?.user.savedPlaces ?? [];
  const open = (k: SavedPlace['kind']) => {
    haptic.select();
    setKind(k);
    setLabel(k === 'home' ? 'Maison' : k === 'work' ? 'Travail' : '');
    setQ('');
    setAdding(true);
  };
  const del = (s: SavedPlace) => (
    <IconButton variant="plain" size={40} icon={<Trash2 size={18} color={colors.danger} />} accessibilityLabel={`Supprimer ${s.label}`} onPress={() => remove.mutate(s.id)} testID={`remove-place-${s.id}`} />
  );
  const addCta = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Plus size={16} color={colors.accent} strokeWidth={2.4} /><Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>Ajouter</Text></View>;
  const slot = (k: 'home' | 'work') => {
    const s = saved.find((x) => x.kind === k);
    const Icon = ICON[k];
    const name = k === 'home' ? 'Maison' : 'Travail';
    return s ? (
      <AccountRow key={k} testID={`place-${k}`} icon={<Icon size={20} color={colors.accent} strokeWidth={1.9} />} title={name} subtitle={`${s.place.label} · ${s.place.address}`} onPress={() => open(k)} action={del(s)} />
    ) : (
      <AccountRow key={k} testID={`place-${k}`} icon={<Icon size={20} color={colors.accent} strokeWidth={1.9} />} title={name} subtitle="Pas encore enregistrée" trailing={addCta} onPress={() => open(k)} />
    );
  };
  const others = saved.filter((x) => x.kind === 'other');
  const kindName = kind === 'home' ? 'Maison' : kind === 'work' ? 'Travail' : label.trim() || 'Adresse';
  if (pinning) {
    const current = saved.find((x) => x.kind === kind && kind !== 'other');
    return (
      <PinPicker
        initial={current?.place.location ?? city?.center ?? { lat: 34.0189, lng: -6.8367 }}
        zones={city?.zones ?? []}
        title={kindName}
        confirmLabel={`Enregistrer · ${kindName}`}
        onCancel={() => { setPinning(false); setAdding(true); }}
        onConfirm={(p) => add.mutate(p)}
      />
    );
  }
  return (
    <Screen testID="places" header={<Header title="Adresses enregistrées" onBack={() => router.back()} />}>
      <View style={{ gap: 24, marginTop: 4 }}>
        <Text tone="muted" style={{ fontSize: 15, lineHeight: 21, marginHorizontal: 4 }}>Réservez en un geste depuis l’accueil avec vos adresses favorites.</Text>
        <AccountGroup label="Raccourcis">
          {slot('home')}
          {slot('work')}
        </AccountGroup>
        <AccountGroup label="Autres adresses">
          {others.map((s) => (
            <AccountRow key={s.id} icon={<Star size={20} color={colors.accent} strokeWidth={1.9} />} title={s.label} subtitle={`${s.place.label} · ${s.place.address}`} action={del(s)} />
          ))}
          <AccountRow testID="add-place" icon={<Plus size={20} color={colors.accent} strokeWidth={2.2} />} title="Ajouter une adresse" titleTone="accent" subtitle="Sport, école, famille…" trailing={null} onPress={() => open('other')} />
        </AccountGroup>
      </View>
      <Sheet visible={adding} onClose={() => setAdding(false)} title={kind === 'home' ? 'Adresse de la maison' : kind === 'work' ? 'Adresse du travail' : 'Nouvelle adresse'}>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['home', 'work', 'other'] as const).map((k) => (
              <Pill key={k} label={k === 'home' ? 'Maison' : k === 'work' ? 'Travail' : 'Autre'} selected={kind === k} onPress={() => { setKind(k); setLabel(k === 'home' ? 'Maison' : k === 'work' ? 'Travail' : ''); }} />
            ))}
          </View>
          {kind === 'other' ? <FormField label="Nom" value={label} onChangeText={setLabel} placeholder="Ex. : Salle de sport" /> : null}
          <FormField label="Adresse" value={q} onChangeText={setQ} placeholder="Rechercher un lieu" testID="place-query" />
          <ListGroup>
            <ListRow testID="place-pick-map" title="Choisir sur la carte" subtitle="Placez le repère à l’endroit exact" leading={<MapIcon size={18} color={colors.accent} />} onPress={() => { haptic.select(); setAdding(false); setTimeout(() => setPinning(true), 200); }} />
          </ListGroup>
          <ListGroup>
            {(results.data ?? []).slice(0, 5).map((p) => (
              <ListRow key={p.id ?? p.label} title={p.label} subtitle={p.address} leading={<MapPin size={18} color={colors.muted} />} onPress={() => add.mutate(p)} />
            ))}
          </ListGroup>
          {results.data?.length === 0 ? <Text variant="caption" tone="muted">Aucun lieu trouvé.</Text> : null}
        </View>
      </Sheet>
    </Screen>
  );
}
