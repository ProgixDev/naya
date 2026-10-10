import { useTheme, Header, PressableScale, Screen, Text, Toggle, haptic, toast, useA11yPrefs, useGlassKind, getThemeMode, setThemeMode, subscribeThemeMode, type ThemeMode } from '@naya/ui';
import { useSyncExternalStore, type ReactNode } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Car, Check, Globe, Layers, MessageCircle, Move, Sparkles, Type } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { NotificationPreferences } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId, useMe } from '@/lib/queries';
import { AccountGroup, AccountRow } from '@/components/AccountList';

const ROWS: { key: keyof NotificationPreferences; title: string; hint: string; Icon: typeof Car }[] = [
  { key: 'offers', title: 'Nouvelles propositions', hint: 'Même app en arrière-plan', Icon: BellRing },
  { key: 'rideUpdates', title: 'Suivi des courses', hint: 'Annulations et changements', Icon: Car },
  { key: 'supportReplies', title: 'Réponses de l’assistance', hint: 'Vos demandes en cours', Icon: MessageCircle },
  { key: 'product', title: 'Nouveautés Naya', hint: 'Au plus une fois par mois', Icon: Sparkles },
];

/** D17-settings: same layout as the passenger app; ?section=notifications or ?section=display shows one half. */
export default function Preferences() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const a11y = useA11yPrefs();
  const glass = useGlassKind();
  const { section } = useLocalSearchParams<{ section?: 'notifications' | 'display' }>();
  const update = useMutation({
    mutationFn: (n: Partial<NotificationPreferences>) => api.me.update({ notifications: n }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const n = me.data?.user.notifications;
  const showNotifications = section !== 'display';
  const showDisplay = section !== 'notifications';
  return (
    <Screen header={<Header title={section === 'notifications' ? 'Notifications' : 'Préférences'} onBack={() => router.back()} />} testID="preferences">
      <View style={{ gap: 24, marginTop: 4 }}>
        {showNotifications ? (
          <View style={{ gap: 10 }}>
            {section !== 'notifications' ? <SectionLabel>Notifications</SectionLabel> : null}
            {ROWS.map(({ key, title, hint, Icon }) => (
              <View key={key} style={cardStyle()}>
                <Tile><Icon size={20} color={colors.accent} strokeWidth={1.9} /></Tile>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text>
                  <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{hint}</Text>
                </View>
                <Toggle value={!!n?.[key]} onValueChange={(v) => update.mutate({ [key]: v })} accessibilityLabel={title} testID={`pref-${key}`} />
              </View>
            ))}
          </View>
        ) : null}
        {showDisplay ? (
          <View style={{ gap: 24 }}>
            <View style={{ gap: 10 }}>
              <SectionLabel>Apparence</SectionLabel>
              <ThemeCards />
            </View>
            <AccountGroup label="Accessibilité" footnote="Ces réglages suivent ceux de votre téléphone.">
              <AccountRow icon={<Move size={20} color={colors.accent} strokeWidth={1.9} />} title="Réduire les animations" trailing={<Value>{a11y.reduceMotion ? 'Activé' : 'Désactivé'}</Value>} />
              <AccountRow icon={<Layers size={20} color={colors.accent} strokeWidth={1.9} />} title="Réduire la transparence" trailing={<Value>{glass === 'opaque' ? 'Opaques' : 'Dépoli'}</Value>} />
              <AccountRow icon={<Type size={20} color={colors.accent} strokeWidth={1.9} />} title="Taille du texte" trailing={<Value>{`${Math.round(a11y.fontScale * 100)} %`}</Value>} />
            </AccountGroup>
            <AccountGroup label="Région">
              <AccountRow icon={<Globe size={20} color={colors.accent} strokeWidth={1.9} />} title="Langue et fuseau" subtitle="Français · heure de Casablanca" />
            </AccountGroup>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const cardStyle = () => ({ minHeight: 72, paddingVertical: 14, paddingLeft: 14, paddingRight: 16, borderRadius: 20, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;

function Tile({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

function SectionLabel({ children }: { children: string }) {
  useTheme();
  return <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{children}</Text>;
}

function Value({ children }: { children: string }) {
  useTheme();
  return <Text tone="muted" numeric style={{ fontSize: 15, lineHeight: 20 }}>{children}</Text>;
}

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
  { id: 'system', label: 'Auto' },
];

/** Three tappable cards with a miniature of each theme; the selected one gets a plum ring and check. */
function ThemeCards() {
  useTheme();
  const selected = useSyncExternalStore(subscribeThemeMode, getThemeMode, getThemeMode);
  return (
    <View style={{ flexDirection: 'row', gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Apparence">
      {THEMES.map((t) => {
        const on = selected === t.id;
        return (
          <PressableScale
            key={t.id}
            testID={`theme-${t.id}`}
            accessibilityRole="radio"
            accessibilityLabel={t.id === 'system' ? 'Automatique, comme le téléphone' : t.label}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => { haptic.select(); setThemeMode(t.id).catch(() => undefined); }}
            style={{ flex: 1, padding: 8, paddingBottom: 12, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 2, borderColor: on ? colors.accent : 'transparent', gap: 10, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}
          >
            <ThemeMiniature id={t.id} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: on ? 0 : 2, borderColor: colors.line, backgroundColor: on ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Check size={11} color={colors.inverse} strokeWidth={3} /> : null}
              </View>
              <Text weight="semibold" numberOfLines={1} tone={on ? 'accent' : 'ink'} style={{ fontSize: 14, lineHeight: 18 }}>{t.label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Fixed colours on purpose: each miniature shows its theme whatever the current one is. */
function ThemeMiniature({ id }: { id: ThemeMode }) {
  const pane = (bg: string, card: string, line: string, plum: string) => (
    <View style={{ flex: 1, backgroundColor: bg, padding: 7, gap: 5 }}>
      <View style={{ height: 6, width: '55%', borderRadius: 3, backgroundColor: line }} />
      <View style={{ flex: 1, borderRadius: 6, backgroundColor: card, padding: 5, gap: 4 }}>
        <View style={{ height: 4, width: '70%', borderRadius: 2, backgroundColor: line }} />
        <View style={{ height: 4, width: '45%', borderRadius: 2, backgroundColor: line }} />
      </View>
      <View style={{ height: 9, borderRadius: 4, backgroundColor: plum }} />
    </View>
  );
  const light = pane('#FAF6F2', '#FFFFFF', '#E7E2E8', '#6B3657');
  const dark = pane('#16121A', '#231D28', '#423648', '#E5B6D4');
  return (
    <View style={{ height: 92, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(41,35,45,0.08)' }}>
      {id === 'light' ? light : id === 'dark' ? dark : <>{light}{dark}</>}
    </View>
  );
}
