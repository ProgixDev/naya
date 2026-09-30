import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Landmark } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { assertWithdrawable, formatMoney, parseMoneyInput } from '@naya/domain';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { Button, ErrorState, FormField, Header, IconDisc, ListGroup, ListRow, Pill, Screen, SkeletonList, StatusBanner, Text, haptic, useSingleFlight } from '@naya/ui';
import { useAccountId, useWallet } from '@/lib/queries';

/** D15 · D15-insufficient · D15-recharged */
export default function Withdraw() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useWallet();
  const [text, setText] = useState('50');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useSingleFlight((vars: { amount: number; accountId: string }, key) => api.driver.withdraw(vars.amount, vars.accountId, key), {
    onSuccess: (w) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.wallet(a) });
      router.replace({ pathname: '/withdraw/[id]', params: { id: w.id } });
    },
    onError: (e) => {
      haptic.error();
      setError(errorMessage(e));
      create.reset();
    },
  });
  if (q.isLoading) return <Screen header={<Header title="Retirer" onBack={() => router.back()} />}><SkeletonList rows={3} /></Screen>;
  if (!q.data) return <Screen header={<Header title="Retirer" onBack={() => router.back()} />}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const { wallet, payoutAccounts, pendingWithdrawals, city } = q.data;
  const amount = parseMoneyInput(text);
  const chosen = accountId ?? payoutAccounts[0]?.id ?? null;
  const pending = pendingWithdrawals.length > 0;
  let localError: string | null = null;
  if (amount !== null) {
    try {
      assertWithdrawable(amount, wallet, city.minimumWithdrawal, pending);
    } catch (e) {
      localError = (e as Error).message;
    }
  }
  const submit = () => {
    if (amount === null) return setError('Saisissez un montant valide, par exemple 50.');
    if (localError) return setError(localError);
    if (!chosen) return setError('Choisissez un compte de destination.');
    setError(null);
    create.run({ amount, accountId: chosen });
  };
  const after = amount !== null ? Math.max(0, wallet.available - amount) : wallet.available;
  return (
    <Screen keyboard header={<Header title="Retirer" subtitle="Traitement automatique, sans validation manuelle." onBack={() => router.back()} />} footer={<Button label="Confirmer le retrait" size="major" full loading={create.isPending} loadingLabel="Envoi à la banque…" disabled={pending || wallet.available <= 0} disabledReason={pending ? 'Un retrait est déjà en cours de traitement.' : wallet.available <= 0 ? 'Aucun montant disponible au retrait.' : undefined} onPress={submit} testID="withdraw-confirm" />} testID="withdraw-screen">
      <View style={{ gap: 20, marginTop: 12 }}>
        <FormField label="Montant" value={text} onChangeText={(t) => { setText(t); setError(null); }} keyboardType="decimal-pad" error={error ?? (amount !== null && localError ? localError : null)} helper={`Disponible au retrait : ${formatMoney(wallet.available)} · minimum ${formatMoney(city.minimumWithdrawal)}`} trailing={<Text variant="label" tone="muted">MAD</Text>} testID="withdraw-amount" />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pill label="Tout le disponible" selected={amount === wallet.available} onPress={() => setText(formatMoney(wallet.available, { currency: false }))} testID="withdraw-all" />
          {wallet.available >= 5000 ? <Pill label="50 MAD" selected={text === '50'} onPress={() => setText('50')} /> : null}
        </View>
        <ListGroup label="Compte de destination">
          {payoutAccounts.map((acc) => (
            <ListRow key={acc.id} title={acc.label} subtitle={`${acc.bankName} · ••${acc.last4}${acc.last4 === '0000' ? ' · compte de test (virement refusé)' : ''}`} leading={<IconDisc><Landmark size={18} color={colors.accent} /></IconDisc>} trailing={chosen === acc.id ? <Check size={20} color={colors.accent} /> : null} chevron={false} onPress={() => setAccountId(acc.id)} testID={`payout-${acc.last4}`} />
          ))}
        </ListGroup>
        {amount !== null && !localError ? (
          <StatusBanner tone="neutral" title={`${formatMoney(amount)} seront réservés`} message={`Pendant le transfert, le disponible passera de ${formatMoney(wallet.available)} à ${formatMoney(after)}. Votre solde comptable ne baisse qu’à la confirmation. Frais : 0 MAD.`} testID="withdraw-preview" />
        ) : null}
        {pending ? <StatusBanner tone="info" title="Retrait en cours" message="Attendez la fin du transfert en cours avant d’en demander un nouveau." action={{ label: 'Suivre', onPress: () => router.push({ pathname: '/withdraw/[id]', params: { id: pendingWithdrawals[0]!.id } }) }} /> : null}
      </View>
    </Screen>
  );
}
