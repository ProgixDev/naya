import { useTheme , Button, ErrorState, Header, IconDisc, Screen, SkeletonList, StatusBanner, Text, haptic, useSingleFlight } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Landmark } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { assertWithdrawable, formatMoney, parseMoneyInput } from '@naya/domain';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { ActionNote, AmountEntry, ChoiceRow, QuickPills } from '@/components/Kit';
import { useAccountId, useWallet } from '@/lib/queries';

/** D15 · D15-insufficient · D15-recharged */
export default function Withdraw() {
  useTheme();
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
  const allText = formatMoney(wallet.available, { currency: false });
  const quick = [
    { key: 'all', label: 'Tout', testID: 'withdraw-all' },
    ...(wallet.available >= 5000 ? [{ key: '50', label: '50 MAD', testID: 'withdraw-50' }] : []),
    ...(wallet.available >= 10000 ? [{ key: '100', label: '100 MAD', testID: 'withdraw-100' }] : []),
  ];
  const quickSelected = amount !== null && amount === wallet.available ? 'all' : quick.find((x) => x.key === text)?.key ?? null;
  const shownError = error ?? (amount !== null && localError ? localError : null);
  return (
    <Screen keyboard header={<Header title="Retirer" onBack={() => router.back()} />} footer={<Button label={amount !== null && !localError ? `Retirer ${formatMoney(amount)}` : 'Confirmer le retrait'} size="major" full loading={create.isPending} loadingLabel="Envoi à la banque…" disabled={pending || wallet.available <= 0 || !!localError} disabledReason={pending ? 'Un retrait est déjà en cours de traitement.' : wallet.available <= 0 ? 'Aucun montant disponible au retrait.' : undefined} onPress={submit} testID="withdraw-confirm" />} testID="withdraw-screen">
      <View style={{ gap: 16, marginTop: 4 }}>
        <AmountEntry label="Montant à retirer" value={text} onChangeText={(t) => { setText(t); setError(null); }} error={shownError} helper={`Disponible ${formatMoney(wallet.available)} · minimum ${formatMoney(city.minimumWithdrawal)}`} testID="withdraw-amount" />
        <QuickPills options={quick} selected={quickSelected} onSelect={(k) => { setText(k === 'all' ? allText : k); setError(null); }} />
        <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Compte de destination">
          <Text variant="caption" weight="semibold" tone="muted" style={{ marginLeft: 4 }}>
            Vers le compte
          </Text>
          {payoutAccounts.map((acc) => (
            <ChoiceRow key={acc.id} title={acc.label} subtitle={`${acc.bankName} · ••${acc.last4}`} leading={<IconDisc size={36}><Landmark size={17} color={colors.accent} /></IconDisc>} selected={chosen === acc.id} onPress={() => setAccountId(acc.id)} testID={`payout-${acc.last4}`} />
          ))}
        </View>
        {amount !== null && !localError ? (
          <StatusBanner compact tone="neutral" title={`${formatMoney(amount)} réservés pendant le transfert`} message={`disponible ${formatMoney(wallet.available)} → ${formatMoney(after)}, sans frais`} testID="withdraw-preview" />
        ) : null}
        {pending ? <ActionNote tone="info" title="Retrait en cours" message="Attendez la fin du transfert avant d’en demander un nouveau." action={{ label: 'Suivre', onPress: () => router.push({ pathname: '/withdraw/[id]', params: { id: pendingWithdrawals[0]!.id } }) }} /> : null}
      </View>
    </Screen>
  );
}
