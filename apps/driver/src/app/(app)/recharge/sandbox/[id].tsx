import { useTheme , Button, Card, Header, IconDisc, Money, Screen, Text } from '@naya/ui';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';

/**
 * D14 · « Paiement en cours », over the recharge status while the card payment is authorised.
 * The provider answers on its own (server-side timer, services/demo-api/src/services/finance.ts):
 * this screen only waits for the outcome, then closes onto the status screen. Closing it early is
 * safe: the payment continues and the status screen follows it. (The route keeps its historical
 * name; `(app)/_layout.tsx` registers it as a modal.)
 */
export default function RechargeProcessing() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
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
      footer={<Button label="Fermer" variant="secondary" size="major" full onPress={close} testID="recharge-processing-close" />}
      testID="recharge-processing"
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <IconDisc size={52}>
            <Lock size={24} color={colors.accent} />
          </IconDisc>
          {r ? <Money amount={r.amount} variant="display" /> : null}
          <Text variant="label" align="center">
            Confirmation de votre banque…
          </Text>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Paiement en cours" />
          {r ? (
            <Text variant="caption" tone="muted" align="center" numeric>
              {r.providerName} · {r.id}
            </Text>
          ) : null}
        </Card>
        <Text variant="caption" tone="muted" align="center">
          Vous pouvez fermer cette fenêtre : le paiement continue et votre solde se met à jour dès la confirmation.
        </Text>
      </View>
    </Screen>
  );
}
