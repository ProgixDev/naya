import { useTheme , Button, ErrorState, Header, IconDisc, Screen, SkeletonList, StatusBanner, Text, haptic, useSingleFlight } from '@naya/ui';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Landmark } from 'lucide-react-native';
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
  const [text, setText] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Start on what can actually be withdrawn: 50 MAD, or the whole available balance when it is lower.
  const prefilled = useRef(false);
  const available = q.data?.wallet.available;
  useEffect(() => {
    if (prefilled.current || available === undefined) return;
    prefilled.current = true;
    if (available > 0) setText(formatMoney(Math.min(available, 5000), { currency: false }));
  }, [available]);
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
      <View style={{ gap: 22, marginTop: 4 }}>
        {/* ── Amount ── */}
        <View style={[card(), { paddingVertical: 20, gap: 14 }]}>
          <AmountEntry label="Montant à retirer" value={text} onChangeText={(t) => { setText(t); setError(null); }} error={shownError} testID="withdraw-amount" />
          <QuickPills options={quick} selected={quickSelected} onSelect={(k) => { setText(k === 'all' ? allText : k); setError(null); }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Disponible" value={formatMoney(wallet.available)} />
            <Stat label="Minimum" value={formatMoney(city.minimumWithdrawal)} />
          </View>
        </View>

        {/* ── Destination ── */}
        <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Compte de destination">
          <Text weight="semibold" tone="muted" style={label12}>Vers le compte</Text>
          {payoutAccounts.map((acc) => (
            <ChoiceRow key={acc.id} title={acc.label} subtitle={`${acc.bankName} · ••${acc.last4}`} leading={<View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}><Landmark size={20} color={colors.accent} strokeWidth={1.9} /></View>} selected={chosen === acc.id} onPress={() => setAccountId(acc.id)} testID={`payout-${acc.last4}`} />
          ))}
        </View>

        {/* ── Summary ── */}
        {amount !== null && !localError ? (
          <View style={{ gap: 10 }} testID="withdraw-preview">
            <Text weight="semibold" tone="muted" style={label12}>Récapitulatif</Text>
            <View style={[card(), { gap: 12 }]}>
              <SummaryRow label="Disponible aujourd’hui" value={formatMoney(wallet.available)} />
              <SummaryRow label="Retrait" value={`− ${formatMoney(amount)}`} />
              <SummaryRow label="Frais" value="Gratuit" tone="success" />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <SummaryRow label="Disponible après" value={formatMoney(after)} strong />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderRadius: 12, padding: 10 }}>
                <Clock size={15} color={colors.muted} strokeWidth={2} />
                <Text tone="muted" style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{formatMoney(amount)} réservés pendant le transfert vers votre banque.</Text>
              </View>
            </View>
          </View>
        ) : null}
        {pending ? <ActionNote tone="info" title="Retrait en cours" message="Attendez la fin du transfert avant d’en demander un nouveau." action={{ label: 'Suivre', onPress: () => router.push({ pathname: '/withdraw/[id]', params: { id: pendingWithdrawals[0]!.id } }) }} /> : null}
      </View>
    </Screen>
  );
}

const card = () => ({ backgroundColor: colors.surface, borderRadius: 22, padding: 16, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;
const label12 = { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const, marginLeft: 4 };

function Stat({ label, value }: { label: string; value: string }) {
  useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>{label}</Text>
      <Text weight="semibold" numeric style={{ fontSize: 15, lineHeight: 20 }}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'success' }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text tone={strong ? 'ink' : 'muted'} weight={strong ? 'semibold' : 'regular'} style={{ fontSize: 14, lineHeight: 19 }}>{label}</Text>
      <Text tone={tone ?? 'ink'} weight={strong ? 'bold' : 'semibold'} numeric style={{ fontSize: strong ? 16 : 14, lineHeight: 21 }}>{value}</Text>
    </View>
  );
}
