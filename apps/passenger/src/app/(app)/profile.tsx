import { useTheme, Button, FormField, Header, PressableScale, Screen, Sheet, Text, haptic, pickFile, toast, uploadFile, type Source } from '@naya/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Camera, Check, ImageIcon, MapPin, Pencil, Phone, ShieldCheck, Trash2 } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useAccountId, useCities, useMe } from '@/lib/queries';
import { formatPhone } from '@/lib/phone';
import { AccountGroup, AccountRow } from '@/components/AccountList';
import { ProfileAvatar } from '@/components/ProfileAvatar';

const memberSince = (iso?: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' }).format(new Date(iso)) : '');

/** Edit profile: photo (camera, gallery, remove), name and home city. The phone number is the login, so it is read-only here. */
export default function Profile() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const cities = useCities();
  const u = me.data?.user;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cityId, setCityId] = useState('');
  const [photoSheet, setPhotoSheet] = useState(false);
  useEffect(() => {
    if (!u) return;
    setFirstName(u.firstName);
    setLastName(u.lastName);
    setCityId(u.cityId);
  }, [u?.id]);

  const first = firstName.trim();
  const last = lastName.trim();
  const dirty = !!u && (first !== u.firstName || last !== u.lastName || cityId !== u.cityId);
  const valid = first.length > 0 && last.length > 0;
  const hasPhoto = !!u?.avatarUploadId;

  const save = useMutation({
    mutationFn: () => api.me.update({ firstName: first, lastName: last, cityId }),
    onSuccess: async () => {
      haptic.success();
      await qc.invalidateQueries({ queryKey: qk.me(a) });
      toast('Profil mis à jour', 'success');
      router.back();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  // Photo changes apply at once (no need to press Enregistrer).
  const photo = useMutation({
    mutationFn: async (source: Source | 'remove') => {
      if (source === 'remove') return api.me.update({ avatarUploadId: null }).then(() => 'removed' as const);
      const file = await pickFile(source, { selfie: true, square: true, maxEdge: 768 });
      if (file === 'denied') return 'denied' as const;
      if (!file) return null;
      const up = await uploadFile(api, file, 'avatar');
      await api.me.update({ avatarUploadId: up.id });
      return 'updated' as const;
    },
    onSuccess: async (r, source) => {
      if (r === 'denied') {
        toast(source === 'camera' ? 'Autorisez l’appareil photo dans les réglages du téléphone.' : 'Autorisez l’accès aux photos dans les réglages du téléphone.', 'danger');
        Linking.openSettings().catch(() => undefined);
        return;
      }
      if (!r) return;
      haptic.success();
      await qc.invalidateQueries({ queryKey: qk.me(a) });
      toast(r === 'removed' ? 'Photo supprimée' : 'Photo de profil mise à jour', 'success');
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const choose = (source: Source | 'remove') => {
    setPhotoSheet(false);
    // Let the sheet close before the native picker takes over the screen.
    setTimeout(() => photo.mutate(source), 250);
  };

  const active = (cities.data ?? []).filter((c) => c.status !== 'inactive');
  const displayName = `${first || u?.firstName || ''} ${last || u?.lastName || ''}`.trim() || 'Votre compte';

  return (
    <Screen
      testID="profile"
      keyboard
      header={<Header title="Modifier le profil" onBack={() => router.back()} />}
      footer={<Button label="Enregistrer" full size="major" loading={save.isPending} disabled={!dirty || !valid} disabledReason={dirty && !valid ? 'Prénom et nom requis' : undefined} onPress={() => save.mutate()} testID="profile-save" />}
    >
      <View style={{ gap: 28 }}>
        {/* ── Photo ── */}
        <View style={{ alignItems: 'center', gap: 12, marginTop: 4 }}>
          <PressableScale onPress={() => { haptic.select(); setPhotoSheet(true); }} accessibilityRole="button" accessibilityLabel={hasPhoto ? 'Modifier la photo de profil' : 'Ajouter une photo de profil'} testID="profile-photo" disabled={photo.isPending}>
            <ProfileAvatar uploadId={u?.avatarUploadId} name={displayName} size={124} busy={photo.isPending} />
            <View style={{ position: 'absolute', top: 2, right: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={16} color={colors.inverse} strokeWidth={2.2} />
            </View>
          </PressableScale>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text weight="bold" numberOfLines={1} style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}>{displayName}</Text>
            <PressableScale onPress={() => { haptic.select(); setPhotoSheet(true); }} hitSlop={10} accessibilityRole="button">
              <Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>{hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}</Text>
            </PressableScale>
          </View>
        </View>

        {/* ── Identity ── */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Informations personnelles</SectionLabel>
          <View style={{ gap: 12 }}>
            <FormField label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={60} error={firstName && !first ? 'Prénom requis' : null} testID="profile-first-name" />
            <FormField label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" maxLength={60} error={lastName && !last ? 'Nom requis' : null} testID="profile-last-name" />
          </View>
        </View>

        {/* ── City ── */}
        {active.length > 1 ? (
          <AccountGroup label="Ville" footnote="Les tarifs, catégories et moyens de paiement dépendent de votre ville.">
            {active.map((c) => (
              <AccountRow
                key={c.id}
                testID={`profile-city-${c.id}`}
                icon={<MapPin size={20} color={colors.accent} strokeWidth={1.9} />}
                title={c.name}
                subtitle={c.id === u?.cityId ? 'Ville actuelle' : undefined}
                selected={cityId === c.id}
                trailing={<Radio on={cityId === c.id} />}
                onPress={() => { haptic.select(); setCityId(c.id); }}
              />
            ))}
          </AccountGroup>
        ) : null}

        {/* ── Account ── */}
        <AccountGroup label="Compte" footnote="Votre numéro sert à vous connecter. Un code par SMS confirme tout changement.">
          <AccountRow testID="profile-phone" icon={<Phone size={20} color={colors.accent} strokeWidth={1.9} />} title="Téléphone" subtitle={formatPhone(u?.phone)} trailing={<Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>Modifier</Text>} onPress={() => router.push('/profile-phone')} />
          <AccountRow icon={<ShieldCheck size={20} color={colors.success} strokeWidth={1.9} />} tone="success" title="Identité" subtitle="Compte vérifié" />
          {u?.createdAt ? <AccountRow icon={<CalendarDays size={20} color={colors.accent} strokeWidth={1.9} />} title="Membre depuis" subtitle={memberSince(u.createdAt)} /> : null}
        </AccountGroup>
      </View>

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Photo de profil" subtitle="Prenez un selfie ou choisissez une photo, recadrée en carré." testID="profile-photo-sheet">
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <SheetOption icon={<Camera size={20} color={colors.accent} strokeWidth={1.9} />} label="Prendre une photo" testID="photo-camera" onPress={() => choose('camera')} />
          <SheetOption icon={<ImageIcon size={20} color={colors.accent} strokeWidth={1.9} />} label="Choisir dans la galerie" testID="photo-library" onPress={() => choose('library')} />
          {hasPhoto ? <SheetOption danger icon={<Trash2 size={20} color={colors.danger} strokeWidth={1.9} />} label="Supprimer la photo" testID="photo-remove" onPress={() => choose('remove')} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  useTheme();
  return <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{children}</Text>;
}

function Radio({ on }: { on: boolean }) {
  useTheme();
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 2, borderColor: colors.line, backgroundColor: on ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Check size={14} color={colors.inverse} strokeWidth={3} /> : null}
    </View>
  );
}

function SheetOption({ icon, label, onPress, danger, testID }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  useTheme();
  return (
    <PressableScale testID={testID} onPress={() => { haptic.select(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} style={{ minHeight: 64, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: danger ? colors.dangerSoft : colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text weight="semibold" tone={danger ? 'danger' : 'ink'} style={{ fontSize: 16, lineHeight: 22 }}>{label}</Text>
    </PressableScale>
  );
}
