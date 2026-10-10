import { useTheme, ConfirmDialog, DEMO_MODE, PressableScale, Screen, StatusPill, Text, TextButton, haptic } from '@naya/ui';
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Car, CircleHelp, LogOut, FileText, FlaskConical, History, SlidersHorizontal, Star, UserRound, UsersRound } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { STATUS_LABELS } from '@naya/domain';
import { colors, getColorScheme, gutter } from '@naya/tokens';
import { useCases, useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { formatPhone } from '@/lib/phone';
import { statusTone } from '@/components/Dossier';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { AccountGroup, AccountRow } from '@/components/AccountList';
import { ProfileAvatar } from '@/components/ProfileAvatar';

const onPlum = '#FFFFFF';
const onPlumSoft = 'rgba(255,255,255,0.78)';

/** D17 · D17-settings — same layout as the passenger Compte: plum header, shortcuts, grouped cards. */
export default function Account() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const insets = useSafeAreaInsets();
  const { person, vehicle } = useCases();
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isDark = getColorScheme() === 'dark';
  const u = me.data?.user;
  const v = me.data?.vehicle;
  const name = u ? `${u.firstName} ${u.lastName}` : 'Votre compte';
  // Tabs stay mounted: force light status-bar icons over the plum header while focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(getColorScheme() === 'dark' ? 'light' : 'dark');
    }, []),
  );
  const signOut = async () => {
    setLeaving(true);
    // Leave the dispatch pool first so no offer is sent to a signed-out device.
    await api.driver.setOnline(false, null).catch(() => undefined);
    await api.auth.logout().catch(() => undefined);
    qc.removeQueries({ queryKey: qk.root });
    await useSession.getState().signOut();
  };
  const icon = (I: typeof Car, tone: string = colors.accent) => <I size={20} color={tone} strokeWidth={1.9} />;

  return (
    <Screen testID="account-screen" header={null} padded={false} statusBar="light" contentStyle={{ paddingBottom: TAB_BAR_SPACE + 24 }}>
      {/* ── Plum profile header ── */}
      <View style={{ backgroundColor: isDark ? '#3A2237' : '#6B3657', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: insets.top + 12, paddingHorizontal: gutter, paddingBottom: gutter }}>
        <Text weight="bold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: onPlum }}>Mon compte</Text>
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <ProfileAvatar uploadId={u?.avatarUploadId} name={name} size={92} />
          <Text weight="bold" align="center" numberOfLines={1} style={{ marginTop: 14, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: onPlum }}>{name}</Text>
          <Text align="center" numeric style={{ marginTop: 2, fontSize: 14, lineHeight: 20, color: onPlumSoft }}>
            {[formatPhone(u?.phone), u?.ratingAverage ? `${String(u.ratingAverage).replace('.', ',')} ★` : null].filter(Boolean).join(' · ')}
          </Text>
          {person ? (
            <View style={{ marginTop: 10, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: person.status === 'approved' ? '#3F7A57' : '#8A5A12' }} />
              <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18, color: person.status === 'approved' ? '#3F7A57' : '#8A5A12' }}>{STATUS_LABELS[person.status]}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <QuickTile icon={<History size={20} color={onPlum} strokeWidth={1.9} />} label="Courses" testID="account-rides" onPress={() => router.push('/rides')} />
          <QuickTile icon={<SlidersHorizontal size={20} color={onPlum} strokeWidth={1.9} />} label="Préférences" testID="account-preferences" onPress={() => router.push({ pathname: '/profile/preferences', params: { section: 'display' } })} />
          <QuickTile icon={<Bell size={20} color={onPlum} strokeWidth={1.9} />} label="Notifications" testID="account-notifications" onPress={() => router.push({ pathname: '/profile/preferences', params: { section: 'notifications' } })} />
        </View>
      </View>

      {/* ── Lists ── */}
      <View style={{ paddingHorizontal: gutter, paddingTop: 24, gap: 24 }}>
        <AccountGroup label="Votre activité">
          <AccountRow testID="account-person" icon={icon(UserRound)} title="Chauffeuse" subtitle="Identité et permis" trailing={person ? <StatusPill tone={statusTone(person.status)} label={STATUS_LABELS[person.status]} /> : null} onPress={() => router.push('/docs/status')} />
          <AccountRow testID="account-vehicle" icon={icon(Car)} title={v ? `${v.make} ${v.model}` : 'Véhicule'} subtitle={v ? `${v.plate} · ${v.color} · ${v.year}` : 'À déclarer'} trailing={vehicle ? <StatusPill tone={statusTone(vehicle.status)} label={STATUS_LABELS[vehicle.status]} /> : null} onPress={() => router.push('/profile/vehicle')} />
          <AccountRow testID="account-documents" icon={icon(FileText)} title="Documents et dossier" subtitle="Vérifier ou corriger les pièces" onPress={() => router.push('/docs/start')} />
        </AccountGroup>
        <AccountGroup label="Vos essentiels">
          <AccountRow testID="account-family" icon={icon(UsersRound)} title="Mes familles" subtitle="Trajets enfants et remises" onPress={() => router.push('/family')} />
          <AccountRow icon={icon(Star)} title="Note moyenne" subtitle={u?.ratingAverage ? `${String(u.ratingAverage).replace('.', ',')} sur 5 · ${u.ratingCount} avis` : 'Pas encore de note'} />
        </AccountGroup>
        <AccountGroup label="À vos côtés">
          <AccountRow testID="account-support" icon={icon(CircleHelp)} title="Aide et demandes" subtitle="Courses, paiements ou documents" onPress={() => router.push('/support')} />
          {DEMO_MODE ? <AccountRow tone="warning" icon={icon(FlaskConical, colors.warning)} title="Lanceur de scénarios" subtitle="Démonstration · non livré en production" onPress={() => router.push('/dev')} /> : null}
        </AccountGroup>
        <TextButton label="Se déconnecter" tone="danger" onPress={() => setConfirm(true)} testID="sign-out" />
      </View>
      <ConfirmDialog visible={confirm} icon={<LogOut size={22} color={colors.danger} strokeWidth={2.2} />} title="Se déconnecter ?" message="Vous ne recevrez plus de propositions sur cet appareil." confirmLabel="Déconnexion" destructive loading={leaving} onConfirm={signOut} onCancel={() => setConfirm(false)} testID="sign-out-dialog" />
    </Screen>
  );
}

/** Translucent shortcut on the plum header. */
function QuickTile({ icon, label, onPress, testID }: { icon: ReactNode; label: string; onPress: () => void; testID?: string }) {
  useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={() => { haptic.select(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flex: 1, height: 66, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', gap: 6 }}
    >
      {icon}
      <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 13, lineHeight: 17, color: onPlum }}>{label}</Text>
    </PressableScale>
  );
}
