import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CreditCard } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { assertRechargeAmount, formatMoney, parseMoneyInput } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, EmptyState, FormField, Header, IconDisc, ListGroup, ListRow, Pill, Screen, SkeletonList, StatusBanner, Text, haptic, useSingleFlight } from '@naya/ui';
import { Check } from 'lucide-react-native';
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
  return (
    <Screen keyboard header={<Header title="Recharger" onBack={() => router.back()} />} footer={<Button label={amount ? `Continuer · ${formatMoney(amount)}` : 'Continuer'} size="major" full loading={create.isPending} disabled={!chosen} onPress={submit} testID="recharge-continue" />} testID="recharge-screen">
      <View style={{ gap: 20, marginTop: 12 }}>
        {w && w.offersBlockedByDebt ? <StatusBanner tone="danger" title={`Solde : ${formatMoney(w.balance)}`} message={`Plafond de dette : ${formatMoney(w.debtLimit)}. Une recharge confirmée compense la dette et rétablit l’accès aux courses.`} testID="recharge-debt" /> : null}
        <FormField label="Montant à recharger" value={text} onChangeText={(t) => { setText(t); setError(null); }} keyboardType="decimal-pad" error={error} helper="Le solde change uniquement après confirmation du prestataire." trailing={<Text variant="label" tone="muted">MAD</Text>} testID="recharge-amount" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['50', '100', '200'].map((v) => (
            <Pill key={v} label={`${v} MAD`} selected={text === v} onPress={() => setText(v)} />
          ))}
        </View>
        {providers.isLoading ? <SkeletonList rows={2} /> : null}
        {providers.data && providers.data.length === 0 ? <EmptyState title="Aucun moyen de recharge" message="Aucun prestataire n’est activé dans votre ville pour le moment." /> : null}
        {providers.data?.length ? (
          <ListGroup label="Moyen de recharge">
            {providers.data.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                subtitle={p.kind === 'card' ? 'Page de paiement sécurisée du prestataire' : 'Paiement en agence avec une référence'}
                leading={<IconDisc>{p.kind === 'card' ? <CreditCard size={18} color={colors.accent} /> : <Building2 size={18} color={colors.accent} />}</IconDisc>}
                trailing={chosen === p.id ? <Check size={20} color={colors.accent} /> : null}
                chevron={false}
                onPress={() => setProviderId(p.id)}
                testID={`provider-${p.kind}`}
              />
            ))}
          </ListGroup>
        ) : null}
        <Text variant="caption" tone="muted">
          L’écran suivant simule la page du prestataire de paiement. Naya ne voit jamais vos données de carte.
        </Text>
      </View>
    </Screen>
  );
}
