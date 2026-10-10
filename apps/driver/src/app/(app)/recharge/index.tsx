import { useTheme , Button, EmptyState, FormField, Header, ProviderIcon, Screen, SkeletonList, StatusBanner, Text, haptic, providerSubtitle, useSingleFlight } from '@naya/ui';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { assertRechargeAmount, formatMoney, parseMoneyInput } from '@naya/domain';
import { AmountEntry, ChoiceRow, QuickPills } from '@/components/Kit';
import { useAccountId, useWallet } from '@/lib/queries';

/** D14 · D14-debt · D14-provider · D14-provider-normal */
export default function Recharge() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const wallet = useWallet();
  const providers = useQuery({ queryKey: qk.providers(a, 'recharge'), queryFn: () => api.driver.providers('recharge') });
  const [text, setText] = useState('50');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const amount = parseMoneyInput(text);
  const chosen = providerId ?? providers.data?.[0]?.id ?? null;
  const option = providers.data?.find((p) => p.id === chosen);
  const w = wallet.data?.wallet;
  const create = useSingleFlight((vars: { amount: number; providerId: string; phone?: string }, key) => api.driver.recharge(vars.amount, vars.providerId, key, vars.phone), {
    onSuccess: (r) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.wallet(a) });
      router.replace({ pathname: '/recharge/[id]', params: { id: r.id, open: '1' } });
    },
    onError: (e) => {
      haptic.error();
      setError(errorMessage(e));
      create.reset();
    },
  });
  const submit = () => {
    if (amount === null) return setError('Saisissez un montant valide, par exemple 50.');
    try {
      assertRechargeAmount(amount);
    } catch (e) {
      return setError((e as Error).message);
    }
    if (!chosen) return setError('Choisissez un moyen de recharge.');
    if (option?.minAmount && amount < option.minAmount) return setError(`Minimum ${formatMoney(option.minAmount)} avec ${option.name}.`);
    if (option?.maxAmount && amount > option.maxAmount) return setError(`Maximum ${formatMoney(option.maxAmount)} avec ${option.name}.`);
    if (option?.needsPhone && !phone.trim()) return setError('Indiquez le numéro associé à votre wallet.');
    setError(null);
    create.run({ amount, providerId: chosen, phone: option?.needsPhone ? phone.trim() : undefined });
  };
  const quick = ['50', '100', '200'];
  return (
    <Screen keyboard header={<Header title="Recharger" onBack={() => router.back()} />} footer={<Button label={amount ? `Continuer · ${formatMoney(amount)}` : 'Continuer'} size="major" full loading={create.isPending} disabled={!chosen} onPress={submit} testID="recharge-continue" />} testID="recharge-screen">
      <View style={{ gap: 22, marginTop: 4 }}>
        {w && w.offersBlockedByDebt ? <StatusBanner compact tone="danger" title={`Solde ${formatMoney(w.balance)} · plafond ${formatMoney(w.debtLimit)}`} message="une recharge confirmée rétablit l’accès aux courses" testID="recharge-debt" /> : null}

        {/* ── Amount ── */}
        <View style={[card(), { paddingVertical: 20, gap: 14 }]}>
          <AmountEntry label="Montant à recharger" value={text} onChangeText={(t) => { setText(t); setError(null); }} error={error} testID="recharge-amount" />
          <QuickPills options={quick.map((v) => ({ key: v, label: `${v} MAD`, testID: `recharge-quick-${v}` }))} selected={quick.includes(text) ? text : null} onSelect={(v) => { setText(v); setError(null); }} />
          {w ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat label="Solde actuel" value={formatMoney(w.balance)} />
              <Stat label="Après recharge" value={amount ? formatMoney(w.balance + amount) : '—'} accent />
            </View>
          ) : null}
        </View>

        {/* ── Providers, grouped ── */}
        {providers.isLoading ? <SkeletonList rows={2} /> : null}
        {providers.data && providers.data.length === 0 ? <EmptyState title="Aucun moyen de recharge" message="Aucun prestataire n’est activé dans votre ville pour le moment." /> : null}
        {providers.data?.length ? (
          <View style={{ gap: 18 }} accessibilityRole="radiogroup" accessibilityLabel="Moyen de recharge">
            {GROUPS.map((g) => {
              const items = providers.data!.filter((p) => g.kinds.includes(p.kind));
              if (!items.length) return null;
              return (
                <View key={g.label} style={{ gap: 10 }}>
                  <Text weight="semibold" tone="muted" style={label12}>{g.label}</Text>
                  {items.map((p) => {
                    const all = providers.data!;
                    const i = all.indexOf(p);
                    const n = all.slice(0, i).filter((x) => x.kind === p.kind).length;
                    const on = chosen === p.id;
                    return (
                      <View key={p.id} style={{ gap: 10 }}>
                        <ChoiceRow
                          title={p.name.replace(/\s*\(démo\)$/i, '')}
                          subtitle={providerSubtitle(p)}
                          leading={<ProviderIcon kind={p.kind} />}
                          selected={on}
                          onPress={() => { setProviderId(p.id); setError(null); }}
                          testID={n ? `provider-${p.kind}-${n + 1}` : `provider-${p.kind}`}
                        />
                        {on && option?.needsPhone ? (
                          <FormField label="Numéro associé à votre wallet" value={phone} onChangeText={(t) => { setPhone(t); setError(null); }} keyboardType="phone-pad" placeholder="06 12 34 56 78" testID="recharge-phone" />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── Reassurance ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line }}>
          <ShieldCheck size={18} color={colors.success} strokeWidth={2} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="semibold" style={{ fontSize: 14, lineHeight: 19 }}>Crédité après confirmation</Text>
            <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Votre solde change seulement quand le prestataire confirme le paiement. Rien n’est débité deux fois.</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

/** Recharge methods, in the order a driver thinks about them. */
const GROUPS: { label: string; kinds: string[] }[] = [
  { label: 'Carte', kinds: ['card'] },
  { label: 'Wallet et paiement mobile', kinds: ['mobile_wallet', 'mobile_payment'] },
  { label: 'Espèces en agence', kinds: ['cash_network'] },
  { label: 'Virement', kinds: ['bank_transfer'] },
];
const card = () => ({ backgroundColor: colors.surface, borderRadius: 22, padding: 16, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;
const label12 = { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const, marginLeft: 4 };

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: accent ? colors.selected : colors.background, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text tone={accent ? 'accent' : 'muted'} style={{ fontSize: 12, lineHeight: 16 }}>{label}</Text>
      <Text weight="semibold" numeric tone={accent ? 'accent' : 'ink'} style={{ fontSize: 15, lineHeight: 20 }}>{value}</Text>
    </View>
  );
}
