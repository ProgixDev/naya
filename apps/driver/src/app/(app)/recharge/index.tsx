import { useTheme, Button, EmptyState, Header, Icon, IconDisc, ListGroup, ListRow, Screen, SkeletonList, StatusBanner, haptic, paymentIcon, useSingleFlight } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { assertRechargeAmount, formatMoney, parseMoneyInput } from '@naya/domain';
import { AmountEntry, QuickPills } from '@/components/Kit';
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
  const [error, setError] = useState<string | null>(null);
  const amount = parseMoneyInput(text);
  // D-26: the agency networks are one choice. Any agency takes the reference: the generic network is sent when there is one.
  const all = providers.data ?? [];
  const isMobile = (p: (typeof all)[number]) => p.kind !== 'card' && p.id.includes('mobile');
  const agencies = all.filter((p) => p.kind !== 'card' && !isMobile(p));
  // The networks by name; the generic « Réseau d’agences » only when no network is named.
  const named = agencies.map((p) => p.name).filter((n) => !/^réseau/i.test(n));
  const networks = named.length ? named : agencies.map((p) => p.name);
  const options = [
    ...all.filter((p) => p.kind === 'card' || isMobile(p)).map((p) => ({ id: p.id, ids: [p.id], title: p.name, subtitle: 'Crédit en quelques secondes', icon: paymentIcon(p.kind === 'card' ? 'credit-card' : 'smartphone'), testID: p.kind === 'card' ? 'provider-card' : 'provider-mobile' })),
    ...(agencies.length ? [{ id: (agencies.find((p) => /^réseau/i.test(p.name)) ?? agencies[0]!).id, ids: agencies.map((p) => p.id), title: 'En agence', subtitle: `Espèces · ${networks.join(', ')}`, icon: Building2, testID: 'provider-cash_network' }] : []),
  ];
  const chosen = providerId ?? options[0]?.id ?? null;
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
    <Screen keyboard header={<Header title="Recharger" onBack={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))} />} footer={<Button label={amount ? `Continuer · ${formatMoney(amount)}` : 'Continuer'} size="major" full loading={create.isPending} disabled={!chosen} onPress={submit} testID="recharge-continue" />} testID="recharge-screen">
      <View style={{ gap: 16, marginTop: 4 }}>
        {w && w.offersBlockedByDebt ? <StatusBanner compact tone="danger" title={`Solde ${formatMoney(w.balance)} · plafond ${formatMoney(w.debtLimit)}`} message="une recharge confirmée rétablit l’accès aux courses" testID="recharge-debt" /> : null}
        <AmountEntry label="Montant à recharger" value={text} onChangeText={(t) => { setText(t); setError(null); }} error={error} helper="Le solde change seulement après confirmation du prestataire." testID="recharge-amount" />
        <QuickPills options={quick.map((v) => ({ key: v, label: `${v} MAD`, testID: `recharge-quick-${v}` }))} selected={quick.includes(text) ? text : null} onSelect={(v) => { setText(v); setError(null); }} />
        {providers.isLoading ? <SkeletonList rows={2} /> : null}
        {providers.data && providers.data.length === 0 ? <EmptyState title="Aucun moyen de recharge" message="Aucun prestataire n’est activé dans votre ville pour le moment." /> : null}
        {options.length ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Moyen de recharge">
            <ListGroup label="Moyen de recharge">
              {options.map((o) => (
                <ListRow
                  key={o.id}
                  title={o.title}
                  subtitle={o.subtitle}
                  leading={
                    <IconDisc>
                      <Icon icon={o.icon} size={20} tone="accent" scale={false} />
                    </IconDisc>
                  }
                  selected={!!chosen && o.ids.includes(chosen)}
                  onPress={() => setProviderId(o.id)}
                  testID={o.testID}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
