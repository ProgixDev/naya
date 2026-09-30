import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDateTime, formatMoney } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, ErrorState, Header, IconDisc, ListGroup, ListRow, Money, Screen, SkeletonList, StatusBanner, Text, haptic } from '@naya/ui';
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
      footer={w && w.status !== 'pending' ? <Button label={w.status === 'failed' ? 'Réessayer' : 'Voir les mouvements'} size="major" full onPress={() => router.replace(w.status === 'failed' ? '/withdraw' : '/ledger')} testID="withdraw-done" /> : <Button label="Retour au portefeuille" variant="secondary" full onPress={() => router.dismissTo('/wallet')} />}
      testID={`withdraw-${w?.status ?? 'loading'}`}
    >
      {q.isLoading ? <SkeletonList rows={2} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {w ? (
        <View style={{ gap: 16, marginTop: 12 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconDisc size={48} tone={w.status === 'confirmed' ? 'success' : w.status === 'failed' ? 'danger' : 'plain'}>
                {w.status === 'confirmed' ? <CheckCircle2 size={24} color={colors.success} /> : w.status === 'failed' ? <XCircle size={24} color={colors.danger} /> : <Clock size={24} color={colors.accent} />}
              </IconDisc>
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="muted">
                  {w.status === 'confirmed' ? 'Retrait confirmé' : w.status === 'failed' ? 'Retrait refusé par la banque' : 'Transfert en cours'} · {w.id}
                </Text>
                <Money amount={-w.amount} variant="hero" />
                <Text variant="caption" tone="muted">
                  {formatDateTime(w.updatedAt)} · {w.destinationLabel}
                </Text>
              </View>
            </View>
          </Card>
          {w.status === 'pending' ? <StatusBanner tone="info" title={`${formatMoney(w.amount)} réservés`} message="Le montant reste dans votre solde comptable jusqu’à la confirmation de la banque." testID="withdraw-pending-banner" /> : null}
          {w.status === 'failed' ? <StatusBanner tone="danger" title="Réservation libérée" message={`${w.failureReason ?? 'Virement refusé.'} Les ${formatMoney(w.amount)} redeviennent disponibles ; aucun crédit supplémentaire n’est ajouté.`} testID="withdraw-failed-banner" /> : null}
          {bal ? (
            <ListGroup label={w.status === 'pending' ? 'Pendant le transfert' : 'Après l’opération'}>
              <ListRow title="Solde comptable" value={formatMoney(bal.balance)} numericValue testID="withdraw-balance" />
              <ListRow title="Réservé" value={formatMoney(bal.reserved)} numericValue testID="withdraw-reserved" />
              <ListRow title="Disponible au retrait" value={formatMoney(bal.available)} numericValue testID="withdraw-available" />
            </ListGroup>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
