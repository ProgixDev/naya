import { useTheme, Button, DEMO_MODE, Header, Money, Screen, StatusIcon, Text } from '@naya/ui';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { formatMoney } from '@naya/domain';
import { useAccountId } from '@/lib/queries';

/**
 * D14 · « Paiement en cours », over the recharge status while the card payment is authorised.
 * The provider answers on its own (server-side timer, services/demo-api/src/services/finance.ts):
 * this screen only waits for the outcome, then closes onto the status screen. Closing it early is
 * safe: the payment continues and the status screen follows it. (The route keeps its historical
 * name; `(app)/_layout.tsx` registers it as a modal.) It exists only with the mock provider
 * (DEMO_MODE, DRV-13): any other build lands on the recharge status instead.
 */
export default function RechargeProcessingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!DEMO_MODE) return <Redirect href={{ pathname: '/recharge/[id]', params: { id } }} />;
  return <RechargeProcessing id={id} />;
}

function RechargeProcessing({ id }: { id: string }) {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.recharge(a, id), queryFn: () => api.driver.getRecharge(id), refetchInterval: (s) => (s.state.data && s.state.data.status !== 'pending' ? false : 1000) });
  const r = q.data;
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/recharge/[id]', params: { id } });
  };
  useEffect(() => {
    if (r && r.status !== 'pending') close();
  }, [r?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen
      header={<Header title="Paiement en cours" onClose={close} />}
      footer={<Button label="Fermer" variant="secondary" size="standard" full onPress={close} testID="recharge-processing-close" />}
      testID="recharge-processing"
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }} accessible accessibilityRole="progressbar" accessibilityLabel={`Paiement en cours${r ? ` de ${formatMoney(r.amount).replace('−', 'moins ')}` : ''}, confirmation de votre banque`} testID="recharge-processing-hero">
          <StatusIcon kind="transfer" state="pending" size="lg" variant="disc" accessible={false} testID="recharge-processing-status" />
          {r ? <Money amount={r.amount} variant="display" /> : null}
          <Text variant="label" align="center">
            Confirmation de votre banque…
          </Text>
          <ActivityIndicator color={colors.accent} />
          {r ? (
            <Text variant="caption" tone="muted" align="center" numeric>
              {r.providerName} · {r.id}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="muted" align="center">
          Vous pouvez fermer cette fenêtre : le paiement continue et votre solde se met à jour dès la confirmation.
        </Text>
      </View>
    </Screen>
  );
}
