import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, Header, IconDisc, Money, Screen, StatusBanner, Text, toast } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/**
 * Stands in for the payment provider's hosted page (card authentication). In production
 * this is the provider's own screen; Naya receives only the signed result.
 */
export default function ProviderSandbox() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const r = useQuery({ queryKey: qk.recharge(a, id), queryFn: () => api.driver.getRecharge(id) });
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const resolve = async (outcome: 'approve' | 'decline') => {
    if (!r.data) return;
    setBusy(outcome);
    try {
      await api.providerSandbox.resolve('recharge', r.data.providerRef, outcome);
      await qc.invalidateQueries({ queryKey: qk.recharge(a, id) });
      router.back();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen
      header={<Header title="Prestataire de paiement" subtitle="Environnement de test" onClose={() => router.back()} />}
      footer={
        <View style={{ gap: 8 }}>
          <Button label={r.data ? `Autoriser ${formatMoney(r.data.amount)}` : 'Autoriser'} size="major" full loading={busy === 'approve'} disabled={!r.data || r.data.status !== 'pending' || !!busy} onPress={() => resolve('approve')} testID="sandbox-approve" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Refuser" variant="secondary" full style={{ flex: 1 }} loading={busy === 'decline'} disabled={!r.data || r.data.status !== 'pending' || !!busy} onPress={() => resolve('decline')} testID="sandbox-decline" />
            <Button label="Fermer sans payer" variant="ghost" full style={{ flex: 1 }} onPress={() => router.back()} testID="sandbox-close" />
          </View>
        </View>
      }
      testID="provider-sandbox"
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        <StatusBanner compact tone="warning" icon={<FlaskConical size={14} color={colors.warning} />} title="Simulation : aucun paiement réel" message="remplace la page sécurisée du prestataire" />
        {r.data ? (
          <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 20 }}>
            <IconDisc size={44}>
              <Text variant="caption" weight="bold" tone="accent">
                PSP
              </Text>
            </IconDisc>
            <Text variant="caption" tone="muted" align="center">
              Bénéficiaire : Naya · réf. {r.data.providerRef}
            </Text>
            <Money amount={r.data.amount} variant="display" />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
