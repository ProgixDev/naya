import { useTheme, DEMO_MODE, PressableScale, Screen, Text, TextButton, haptic } from '@naya/ui';
import { useCallback, type ReactNode } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CircleHelp, CreditCard, FlaskConical, MapPin, SlidersHorizontal, UserRoundPen, UsersRound } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, getColorScheme, gutter } from '@naya/tokens';
import { useMe, usePaymentMethods } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useDraft } from '@/lib/draft';
import { useTabBarSpace } from '@/components/TabBar';
import { AccountGroup, AccountRow } from '@/components/AccountList';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { formatPhone } from '@/lib/phone';

const onPlum = '#FFFFFF';
const onPlumSoft = 'rgba(255,255,255,0.78)';


export default function Account() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const methods = usePaymentMethods();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const isDark = getColorScheme() === 'dark';
  // Tabs stay mounted, so the last <StatusBar> rendered wins: force light icons over the plum while focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(getColorScheme() === 'dark' ? 'light' : 'dark');
    }, []),
  );
  const u = me.data?.user;
  const name = u ? `${u.firstName} ${u.lastName}` : 'Votre compte';
  const signOut = async () => {
    haptic.tap();
    await api.auth.logout().catch(() => undefined);
    qc.removeQueries({ queryKey: qk.root });
    useDraft.getState().reset();
    await useSession.getState().signOut();
  };
  const saved = u?.savedPlaces.map((p) => p.label).join(' · ');
  const shown = (methods.data ?? []).filter((m) => m.kind === 'cash' || m.kind === 'card');
  const payments = (shown.length ? shown : methods.data ?? []).map((m) => (m.kind === 'cash' ? 'Espèces' : m.kind === 'card' && m.last4 ? `Carte •••• ${m.last4}` : m.label)).join(' · ');

  return (
    <Screen testID="account" header={null} padded={false} statusBar="light" contentStyle={{ paddingBottom: space + 12 }}>
      {/* ── Plum profile header ── */}
      <View style={{ backgroundColor: isDark ? '#3A2237' : '#6B3657', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: insets.top + 12, paddingHorizontal: gutter, paddingBottom: gutter }}>
        <Text weight="bold" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: onPlum }}>
          Mon compte
        </Text>

        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <ProfileAvatar uploadId={u?.avatarUploadId} name={name} size={92} />
          <Text weight="bold" align="center" numberOfLines={1} style={{ marginTop: 14, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: onPlum }}>
            {name}
          </Text>
          <Text align="center" numeric style={{ marginTop: 2, fontSize: 14, lineHeight: 20, color: onPlumSoft }}>
            {[formatPhone(u?.phone), me.data?.city.name].filter(Boolean).join(' · ')}
          </Text>
          <View style={{ marginTop: 10, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3F7A57' }} />
            <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18, color: '#3F7A57' }}>Compte vérifié</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <QuickTile icon={<UserRoundPen size={20} color={onPlum} strokeWidth={1.9} />} label="Profil" testID="account-profile" onPress={() => router.push('/profile')} />
          <QuickTile icon={<SlidersHorizontal size={20} color={onPlum} strokeWidth={1.9} />} label="Préférences" testID="account-display" onPress={() => router.push({ pathname: '/preferences', params: { section: 'display' } })} />
          <QuickTile icon={<Bell size={20} color={onPlum} strokeWidth={1.9} />} label="Notifications" testID="account-preferences" onPress={() => router.push({ pathname: '/preferences', params: { section: 'notifications' } })} />
        </View>
      </View>

      {/* ── Lists ── */}
      <View style={{ paddingHorizontal: gutter, paddingTop: 24, gap: 24 }}>
        <AccountGroup label="Vos essentiels">
          <AccountRow testID="account-family" icon={<UsersRound size={20} color={colors.accent} strokeWidth={1.9} />} title="Naya Famille" subtitle="Abonnements et trajets enfants" onPress={() => router.push('/family')} />
          <AccountRow testID="account-payments" icon={<CreditCard size={20} color={colors.accent} strokeWidth={1.9} />} title="Moyens de paiement" subtitle={payments || 'Espèces, carte, wallet'} onPress={() => router.push('/payments')} />
          <AccountRow testID="account-places" icon={<MapPin size={20} color={colors.accent} strokeWidth={1.9} />} title="Adresses enregistrées" subtitle={saved || 'Maison, travail…'} onPress={() => router.push('/places')} />
        </AccountGroup>
        <AccountGroup label="À vos côtés">
          <AccountRow testID="account-help" icon={<CircleHelp size={20} color={colors.accent} strokeWidth={1.9} />} title="Aide et demandes" subtitle="Paiement, annulation, objet oublié" onPress={() => router.push('/help')} />
          {DEMO_MODE ? <AccountRow testID="account-dev" tone="warning" icon={<FlaskConical size={20} color={colors.warning} strokeWidth={1.9} />} title="Lanceur de scénarios" subtitle="Démonstration · réinitialiser, simuler une chauffeuse" onPress={() => router.push('/dev')} /> : null}
        </AccountGroup>
        <TextButton label="Se déconnecter" onPress={signOut} testID="sign-out" />
      </View>
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
