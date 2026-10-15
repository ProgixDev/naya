import { useTheme, Button, EmptyState, FormField, Header, Icon, IconButton, ListGroup, ListRow, Pill, Screen, Sheet, Text, TextButton, haptic, toast } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Ellipsis, House, Star } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { Place, SavedPlace } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId, useMe } from '@/lib/queries';
import { useCityId } from '@/lib/prefs';

/** The place type is the one icon that says something (A87, A88): the same glyphs in the list and the sheet. */
const ICON = { home: House, work: Briefcase, other: Star };
const KIND_LABEL = { home: 'Maison', work: 'Travail', other: 'Autre' } as const;

/** P13-address: saved places, add by search, remove behind « ⋯ » (P-38). */
export default function Places() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const cityId = useCityId(); // the server's user.cityId (ADR-0054, PAX-05)
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<SavedPlace['kind']>('home');
  const [label, setLabel] = useState('Maison');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<SavedPlace | null>(null);
  const results = useQuery({ queryKey: qk.places(q, cityId), queryFn: () => api.places.search(q, cityId), enabled: adding });
  const add = useMutation({
    mutationFn: (place: Place) => api.me.addPlace({ kind, label: label.trim() || 'Adresse', place }),
    onSuccess: () => {
      haptic.success();
      toast('Adresse enregistrée', 'success');
      setAdding(false);
      qc.invalidateQueries({ queryKey: qk.me(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.me.removePlace(id),
    onSuccess: () => {
      setMenu(null);
      toast('Adresse supprimée', 'success');
      qc.invalidateQueries({ queryKey: qk.me(a) });
    },
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
            {saved.map((s) => (
              <ListRow
                key={s.id}
                testID={`place-${s.id}`}
                title={s.label}
                subtitle={`${s.place.label} · ${s.place.address}`}
                leading={<Icon icon={ICON[s.kind]} size={24} color={colors.ink} />}
                trailing={<IconButton variant="plain" size={44} icon={<Ellipsis size={20} color={colors.muted} />} accessibilityLabel={`Options de l’adresse ${s.label}`} onPress={() => setMenu(s)} testID={`place-${s.id}-options`} />}
              />
            ))}
          </ListGroup>
        )}
      </View>
      <Sheet visible={!!menu} onClose={() => !remove.isPending && setMenu(null)} dismissible={!remove.isPending} title={menu?.label ?? ''} subtitle={menu ? menu.place.address : undefined} testID="place-options">
        <View style={{ gap: 8 }}>
          <ListGroup>
            <ListRow title="Supprimer l’adresse" destructive chevron={false} onPress={() => menu && remove.mutate(menu.id)} testID="place-remove" />
          </ListGroup>
          <TextButton label="Annuler" tone="muted" onPress={() => setMenu(null)} />
        </View>
      </Sheet>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Nouvelle adresse">
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['home', 'work', 'other'] as const).map((k) => (
              <Pill key={k} label={KIND_LABEL[k]} icon={<Icon icon={ICON[k]} size={16} color={colors.ink} />} selected={kind === k} onPress={() => { setKind(k); setLabel(k === 'other' ? '' : KIND_LABEL[k]); }} testID={`place-kind-${k}`} />
            ))}
          </View>
          {kind === 'other' ? <FormField label="Nom" value={label} onChangeText={setLabel} example="Ex. : Salle de sport" /> : null}
          <FormField label="Adresse" value={q} onChangeText={setQ} placeholder="Rechercher un lieu" testID="place-query" />
          <ListGroup>
            {(results.data ?? []).slice(0, 5).map((p) => (
              <ListRow key={p.id ?? p.label} title={p.label} subtitle={p.address} chevron={false} onPress={() => add.mutate(p)} />
            ))}
          </ListGroup>
          {results.data?.length === 0 ? <Text variant="caption" tone="muted">Aucun lieu trouvé.</Text> : null}
        </View>
      </Sheet>
    </Screen>
  );
}
