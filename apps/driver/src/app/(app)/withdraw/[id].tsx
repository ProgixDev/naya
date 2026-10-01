import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney } from '@naya/domain';
import { Button, Card, ErrorState, Header, Screen, SkeletonList, StatusBanner, Text, haptic } from '@naya/ui';
import { FigureLine, OperationHero } from '@/components/Kit';
import { useAccountId, useWallet } from '@/lib/queries';

/** D15-pending · D15-success · D15-failed (+ -recharged variants) */
export default function WithdrawalStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const wallet = useWallet();
  const q = useQuery({ queryKey: qk.withdrawal(a, id), queryFn: () => api.driver.getWithdrawal(id), refetchInterval: (s) => (s.state.data?.status === 'pending' ? 2000 : false) });
  const w = q.data;
  const last = useRef(w?.status);
  useEffect(() => {
    if (w && last.current === 'pending' && w.status !== 'pending') {
      if (w.status === 'confirmed') haptic.success();
      else haptic.error();
      qc.invalidateQueries({ queryKey: qk.wallet(a) });
      qc.invalidateQueries({ queryKey: ['naya', a, 'driver', 'ledger'] });
    }
    last.current = w?.status;
  }, [w?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const bal = wallet.data?.wallet;
  const title = w?.status === 'confirmed' ? 'Retrait effectué' : w?.status === 'failed' ? 'Retrait échoué' : 'Retrait en cours';
  return (
    <Screen
      header={<Header title={title} onBack={() => router.dismissTo('/wallet')} />}
      footer={w && w.status !== 'pending' ? <Button label={w.status === 'failed' ? 'Réessayer' : 'Voir les mouvements'} size="major" full onPress={() => router.replace(w.status === 'failed' ? '/withdraw' : '/ledger')} testID="withdraw-done" /> : <Button label="Retour au portefeuille" variant="secondary" size="major" full onPress={() => router.dismissTo('/wallet')} />}
      testID={`withdraw-${w?.status ?? 'loading'}`}
    >
      {q.isLoading ? <SkeletonList rows={2} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {w ? (
        <View style={{ gap: 14, marginTop: 4 }}>
          <OperationHero state={w.status === 'confirmed' ? 'confirmed' : w.status === 'failed' ? 'failed' : 'pending'} amount={-w.amount} kicker={`${w.status === 'confirmed' ? 'Retrait confirmé' : w.status === 'failed' ? 'Refusé par la banque' : 'Transfert en cours'} · ${w.id}`} caption={`${formatDateTime(w.updatedAt)} · ${w.destinationLabel}`} />
          {w.status === 'pending' ? <StatusBanner compact tone="info" title={`${formatMoney(w.amount)} réservés`} message="restent dans le solde jusqu’à confirmation" testID="withdraw-pending-banner" /> : null}
          {w.status === 'failed' ? <StatusBanner compact tone="danger" title="Réservation libérée" message={`${w.failureReason ?? 'Virement refusé.'} ${formatMoney(w.amount)} à nouveau disponibles, aucun crédit ajouté.`} testID="withdraw-failed-banner" /> : null}
          {bal ? (
            <View style={{ gap: 6 }}>
              <Text variant="caption" weight="semibold" tone="muted" style={{ marginLeft: 4 }}>
                {w.status === 'pending' ? 'Pendant le transfert' : 'Après l’opération'}
              </Text>
              <Card style={{ paddingVertical: 6, gap: 0 }}>
                <FigureLine label="Solde comptable" value={formatMoney(bal.balance)} strong testID="withdraw-balance" />
                <FigureLine label="Réservé" value={formatMoney(bal.reserved)} testID="withdraw-reserved" />
                <FigureLine label="Disponible au retrait" value={formatMoney(bal.available)} testID="withdraw-available" />
              </Card>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
