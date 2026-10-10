import { useTheme, ConfirmDialog, ErrorState, Header, IconButton, PressableScale, Screen, SkeletonList, StatusBanner, Text, haptic, toast } from '@naya/ui';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Check, CreditCard, Lock, Plus, Trash2, Wallet } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, getColorScheme } from '@naya/tokens';
import { useAccountId, useMe, usePaymentMethods } from '@/lib/queries';

type Method = NonNullable<ReturnType<typeof usePaymentMethods>['data']>[number];

/** P14: methods available in the city, preferred choice (radio), card removal, add a tokenised card. */
export default function Payments() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const methods = usePaymentMethods();
  const [removing, setRemoving] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.paymentMethods(a) });
  const setDefault = useMutation({ mutationFn: (id: string) => api.paymentMethods.setDefault(id), onSuccess: () => { haptic.success(); toast('Moyen préféré mis à jour'); refresh(); }, onError: (e) => toast(errorMessage(e), 'danger') });
  const remove = useMutation({ mutationFn: (id: string) => api.paymentMethods.remove(id), onSuccess: () => { setRemoving(null); toast('Carte supprimée'); refresh(); }, onError: (e) => { setRemoving(null); toast(errorMessage(e), 'danger'); } });
  const target = methods.data?.find((m) => m.id === removing);
  const cityName = me.data?.city.name ?? 'votre ville';

  const subtitle = (m: Method) =>
    [
      m.kind === 'card' ? m.label.replace(/\s*•••• \d{4}$/, '') : null,
      !m.availableInCity ? `Indisponible à ${cityName}` : m.kind === 'card' ? `Expire ${String(m.expMonth).padStart(2, '0')}/${m.expYear}` : m.kind === 'cash' ? 'Réglé à la chauffeuse en fin de trajet' : m.kind === 'wallet' ? 'Débité de votre solde Naya' : 'Payé depuis votre wallet mobile',
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen testID="payments" header={<Header title="Moyens de paiement" onBack={() => router.back()} />}>
      <View style={{ gap: 24, marginTop: 4 }}>
        <Text tone="muted" style={{ fontSize: 15, lineHeight: 21, marginHorizontal: 4 }}>Le moyen coché est proposé par défaut. Vous pouvez le changer à chaque réservation.</Text>

        <View style={{ gap: 10 }}>
          <SectionLabel>Vos moyens</SectionLabel>
          {methods.isLoading ? <SkeletonList rows={3} /> : null}
          {methods.isError ? <ErrorState onRetry={() => methods.refetch()} /> : null}
          {(methods.data ?? []).map((m) => {
            const title = m.kind === 'card' ? `Carte •••• ${m.last4}` : m.label;
            const sub = subtitle(m);
            const selectable = !m.isDefault && m.availableInCity;
            return (
              <View key={m.id} style={[cardStyle(), { opacity: m.availableInCity ? 1 : 0.55, borderColor: m.isDefault ? colors.accent : 'transparent' }]}>
                <PressableScale
                  testID={`method-${m.last4 ?? 'cash'}`}
                  onPress={selectable ? () => { haptic.select(); setDefault.mutate(m.id); } : undefined}
                  disabled={!selectable}
                  pressedScale={0.985}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: m.isDefault, checked: m.isDefault, disabled: !m.availableInCity }}
                  accessibilityLabel={[title, sub, m.isDefault ? 'moyen préféré' : null].filter(Boolean).join(', ')}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 14 }}
                >
                  <MethodTile m={m} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight="semibold" numberOfLines={1} numeric={m.kind === 'card'} style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text>
                    <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{sub}</Text>
                  </View>
                  <Radio on={m.isDefault} />
                </PressableScale>
                {m.kind === 'card' ? (
                  <IconButton variant="plain" size={40} icon={<Trash2 size={18} color={colors.danger} />} accessibilityLabel={`Supprimer ${m.label}`} onPress={() => setRemoving(m.id)} testID={`remove-${m.last4}`} />
                ) : (
                  <View style={{ width: 8 }} />
                )}
              </View>
            );
          })}
          <PressableScale testID="add-card" onPress={() => { haptic.tap(); router.push('/card/new'); }} accessibilityRole="button" accessibilityLabel="Ajouter une carte bancaire" pressedScale={0.985} style={{ minHeight: 72, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mauve, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Tile bg={colors.mauveSoft}><Plus size={20} color={colors.accent} strokeWidth={2.2} /></Tile>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" tone="accent" style={{ fontSize: 16, lineHeight: 22 }}>Ajouter une carte</Text>
              <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>Visa, Mastercard ou carte CMI</Text>
            </View>
          </PressableScale>
        </View>

        <View style={[cardStyle(), { paddingVertical: 14, paddingHorizontal: 14, gap: 14 }]}>
          <Tile bg={colors.successSoft}><Lock size={20} color={colors.success} strokeWidth={1.9} /></Tile>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="semibold" style={{ fontSize: 16, lineHeight: 22 }}>Paiements sécurisés</Text>
            <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Naya ne conserve qu’un jeton et les 4 derniers chiffres de votre carte.</Text>
          </View>
        </View>

        <StatusBanner compact tone="warning" title="Démo" message="•••• 4242 acceptée, 0002 refusée, 3155 en attente · aucun débit réel" />
      </View>
      <ConfirmDialog visible={!!target} title="Supprimer cette carte ?" message={target?.label} confirmLabel="Supprimer la carte" destructive loading={remove.isPending} onConfirm={() => target && remove.mutate(target.id)} onCancel={() => setRemoving(null)} />
    </Screen>
  );
}

// Functions, not constants: colours follow the theme.
const cardStyle = () => ({ minHeight: 72, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;

function SectionLabel({ children }: { children: string }) {
  useTheme();
  return <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{children}</Text>;
}

function Tile({ bg, children }: { bg: string; children: ReactNode }) {
  return <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/** Same tints as the wallet screen: sage for cash, pale blue for cards, pale plum for wallets. */
function MethodTile({ m }: { m: Method }) {
  useTheme();
  const dark = getColorScheme() === 'dark';
  if (m.kind === 'cash') return <Tile bg={dark ? colors.successSoft : '#E7F0EA'}><Banknote size={22} color={dark ? colors.success : '#4F7D62'} strokeWidth={1.8} /></Tile>;
  if (m.kind === 'card') {
    const brand = /visa/i.test(m.label) ? 'VISA' : /master/i.test(m.label) ? 'MC' : null;
    return (
      <Tile bg={dark ? colors.infoSoft : '#EAF0FB'}>
        {brand ? <Text weight="bold" style={{ fontSize: brand === 'VISA' ? 14 : 15, lineHeight: 20, letterSpacing: 0.2, color: dark ? colors.info : '#1F3B7A' }}>{brand}</Text> : <CreditCard size={21} color={dark ? colors.info : '#1F3B7A'} strokeWidth={1.8} />}
      </Tile>
    );
  }
  return <Tile bg={dark ? colors.mauveSoft : '#F3E7ED'}><Wallet size={21} color={colors.accent} strokeWidth={1.8} /></Tile>;
}

function Radio({ on }: { on: boolean }) {
  useTheme();
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 2, borderColor: colors.line, backgroundColor: on ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Check size={14} color={colors.inverse} strokeWidth={3} /> : null}
    </View>
  );
}
