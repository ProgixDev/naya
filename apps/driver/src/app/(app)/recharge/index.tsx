import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CreditCard, Lock } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { assertRechargeAmount, formatMoney, parseMoneyInput } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, EmptyState, Header, IconDisc, Screen, SkeletonList, StatusBanner, Text, haptic, useSingleFlight } from '@naya/ui';
import { AmountEntry, ChoiceRow, QuickPills } from '@/components/Kit';
import { useAccountId, useWallet } from '@/lib/queries';

/** D14 · D14-debt · D14-provider · D14-provider-normal */
export default function Recharge() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const wallet = useWallet();
  const providers = useQuery({ queryKey: qk.providers(a, 'recharge'), queryFn: () => api.driver.providers('recharge') });
  const [text, setText] = useState('50');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amount = parseMoneyInput(text);
  const chosen = providerId ?? providers.data?.[0]?.id ?? null;
  const w = wallet.data?.wallet;
  const create = useSingleFlight((vars: { amount: number; providerId: string }, key) => api.driver.recharge(vars.amount, vars.providerId, key), {
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
    setError(null);
    create.run({ amount, providerId: chosen });
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
            {providers.data.map((p) => (
              <ChoiceRow
                key={p.id}
                title={p.name}
                subtitle={p.kind === 'card' ? 'Page sécurisée du prestataire' : 'En agence avec une référence'}
                leading={<IconDisc size={36}>{p.kind === 'card' ? <CreditCard size={17} color={colors.accent} /> : <Building2 size={17} color={colors.accent} />}</IconDisc>}
                selected={chosen === p.id}
                onPress={() => setProviderId(p.id)}
                testID={`provider-${p.kind}`}
              />
            ))}
          </View>
        ) : null}
        <StatusBanner compact tone="neutral" icon={<Lock size={14} color={colors.accent} />} title="Naya ne voit jamais vos données de carte" message="page du prestataire simulée" />
      </View>
    </Screen>
  );
}
