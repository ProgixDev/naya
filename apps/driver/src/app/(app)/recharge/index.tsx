import { useTheme , Button, EmptyState, FormField, Header, ProviderIcon, Screen, SkeletonList, StatusBanner, Text, haptic, providerSubtitle, useSingleFlight } from '@naya/ui';
import { useState } from 'react';
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
      <View style={{ gap: 16, marginTop: 4 }}>
        {w && w.offersBlockedByDebt ? <StatusBanner compact tone="danger" title={`Solde ${formatMoney(w.balance)} · plafond ${formatMoney(w.debtLimit)}`} message="une recharge confirmée rétablit l’accès aux courses" testID="recharge-debt" /> : null}
        <AmountEntry label="Montant à recharger" value={text} onChangeText={(t) => { setText(t); setError(null); }} error={error} helper="Le solde change seulement après confirmation du prestataire." testID="recharge-amount" />
        <QuickPills options={quick.map((v) => ({ key: v, label: `${v} MAD`, testID: `recharge-quick-${v}` }))} selected={quick.includes(text) ? text : null} onSelect={(v) => { setText(v); setError(null); }} />
        {providers.isLoading ? <SkeletonList rows={2} /> : null}
        {providers.data && providers.data.length === 0 ? <EmptyState title="Aucun moyen de recharge" message="Aucun prestataire n’est activé dans votre ville pour le moment." /> : null}
        {providers.data?.length ? (
          <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Moyen de recharge">
            <Text variant="caption" weight="semibold" tone="muted" style={{ marginLeft: 4 }}>
              Moyen de recharge
            </Text>
            {providers.data.map((p, i, all) => {
              const n = all.slice(0, i).filter((x) => x.kind === p.kind).length;
              return (
                <ChoiceRow
                  key={p.id}
                  title={p.name}
                  subtitle={providerSubtitle(p)}
                  leading={<ProviderIcon kind={p.kind} />}
                  selected={chosen === p.id}
                  onPress={() => { setProviderId(p.id); setError(null); }}
                  testID={n ? `provider-${p.kind}-${n + 1}` : `provider-${p.kind}`}
                />
              );
            })}
          </View>
        ) : null}
        {option?.needsPhone ? (
          <FormField label="Numéro associé à votre wallet" value={phone} onChangeText={(t) => { setPhone(t); setError(null); }} keyboardType="phone-pad" placeholder="06 12 34 56 78" testID="recharge-phone" />
        ) : null}
      </View>
    </Screen>
  );
}
