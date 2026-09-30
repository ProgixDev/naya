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
    <Screen header={<Header title="Prestataire de paiement" subtitle="Environnement de test du prestataire" onClose={() => router.back()} />} testID="provider-sandbox">
      <View style={{ gap: 16, marginTop: 12 }}>
        <StatusBanner tone="warning" icon={<FlaskConical size={20} color={colors.warning} />} title="Simulation du prestataire" message="Aucun paiement réel. Cet écran remplace la page sécurisée du prestataire pour tester la confirmation et le refus." />
        {r.data ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconDisc>
                <Text variant="caption" weight="bold" tone="accent">
                  PSP
                </Text>
              </IconDisc>
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="muted">
                  Bénéficiaire : Naya · réf. {r.data.providerRef}
                </Text>
                <Money amount={r.data.amount} variant="title" />
              </View>
            </View>
          </Card>
        ) : null}
        <Button label={r.data ? `Autoriser ${formatMoney(r.data.amount)}` : 'Autoriser'} size="major" full loading={busy === 'approve'} disabled={!r.data || r.data.status !== 'pending' || !!busy} onPress={() => resolve('approve')} testID="sandbox-approve" />
        <Button label="Refuser le paiement" variant="secondary" full loading={busy === 'decline'} disabled={!r.data || r.data.status !== 'pending' || !!busy} onPress={() => resolve('decline')} testID="sandbox-decline" />
        <Button label="Fermer sans payer" variant="ghost" full onPress={() => router.back()} testID="sandbox-close" />
      </View>
    </Screen>
  );
}
