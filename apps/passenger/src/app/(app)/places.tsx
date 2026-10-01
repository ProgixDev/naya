import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Home as HomeIcon, MapPin, Star, Trash2 } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { Place, SavedPlace } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, EmptyState, FormField, Header, IconButton, ListGroup, ListRow, Pill, Screen, Sheet, Text, haptic, toast } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';

const ICON = { home: HomeIcon, work: Briefcase, other: Star };

/** P13-address: saved places, add by search, remove. */
export default function Places() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const cityId = usePrefs((s) => s.cityId);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<SavedPlace['kind']>('home');
  const [label, setLabel] = useState('Maison');
  const [q, setQ] = useState('');
  const results = useQuery({ queryKey: qk.places(q, cityId), queryFn: () => api.places.search(q, cityId), enabled: adding });
  const add = useMutation({
    mutationFn: (place: Place) => api.me.addPlace({ kind, label: label.trim() || 'Adresse', place }),
    onSuccess: () => {
      haptic.success();
      toast('Adresse enregistrée');
      setAdding(false);
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
  return (
    <Screen testID="places" header={<Header title="Adresses enregistrées" onBack={() => router.back()} />} footer={<Button label="Ajouter une adresse" full onPress={() => setAdding(true)} testID="add-place" />}>
      <View style={{ marginTop: 4 }}>
        {saved.length === 0 ? (
          <EmptyState title="Aucune adresse" message="Enregistrez Maison et Travail pour réserver en un geste." />
        ) : (
          <ListGroup>
            {saved.map((s) => {
              const Icon = ICON[s.kind];
              return <ListRow key={s.id} title={s.label} subtitle={`${s.place.label} · ${s.place.address}`} leading={<Icon size={20} color={colors.accent} />} trailing={<IconButton variant="plain" size={36} icon={<Trash2 size={18} color={colors.danger} />} accessibilityLabel={`Supprimer ${s.label}`} onPress={() => remove.mutate(s.id)} />} />;
            })}
          </ListGroup>
        )}
      </View>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Nouvelle adresse">
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['home', 'work', 'other'] as const).map((k) => (
              <Pill key={k} label={k === 'home' ? 'Maison' : k === 'work' ? 'Travail' : 'Autre'} selected={kind === k} onPress={() => { setKind(k); setLabel(k === 'home' ? 'Maison' : k === 'work' ? 'Travail' : ''); }} />
            ))}
          </View>
          {kind === 'other' ? <FormField label="Nom" value={label} onChangeText={setLabel} placeholder="Ex. : Salle de sport" /> : null}
          <FormField label="Adresse" value={q} onChangeText={setQ} placeholder="Rechercher un lieu" testID="place-query" />
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
