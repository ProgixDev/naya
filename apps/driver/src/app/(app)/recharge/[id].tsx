import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort } from '@naya/domain';
import { Button, Card, ErrorState, Header, Screen, SkeletonList, StatusBanner, haptic } from '@naya/ui';
import { FigureLine, OperationHero } from '@/components/Kit';
import { useAccountId, useWallet } from '@/lib/queries';

/** D14-pending · D14-failed · D14-success (+ -normal variants) */
export default function RechargeStatus() {
  const { id, open } = useLocalSearchParams<{ id: string; open?: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const wallet = useWallet();
  const q = useQuery({ queryKey: qk.recharge(a, id), queryFn: () => api.driver.getRecharge(id), refetchInterval: (s) => (s.state.data?.status === 'pending' ? 2000 : false) });
  const r = q.data;
  const opened = useRef(false);
  useEffect(() => {
    if (r?.status === 'pending' && open === '1' && !opened.current && r.providerId.includes('card')) {
      opened.current = true;
      router.push({ pathname: '/recharge/sandbox/[id]', params: { id } });
    }
  }, [r?.status, open, id, r?.providerId]);
  const last = useRef(r?.status);
  useEffect(() => {
    if (r && last.current === 'pending' && r.status !== 'pending') {
      if (r.status === 'confirmed') haptic.success();
      else haptic.error();
      qc.invalidateQueries({ queryKey: qk.wallet(a) });
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
      qc.invalidateQueries({ queryKey: ['naya', a, 'driver', 'ledger'] });
    }
    last.current = r?.status;
  }, [r?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const w = wallet.data?.wallet;
  const restored = r?.status === 'confirmed' && w && w.balance < 0 && !w.offersBlockedByDebt;
  return (
    <Screen
      header={<Header title={r?.status === 'confirmed' ? 'Recharge confirmée' : r?.status === 'failed' ? 'Recharge échouée' : 'Recharge en attente'} onBack={() => router.dismissTo('/wallet')} />}
      footer={
        r?.status === 'pending' && r.providerId.includes('card') ? (
          <Button label="Ouvrir la page du prestataire" size="major" full onPress={() => router.push({ pathname: '/recharge/sandbox/[id]', params: { id } })} testID="open-sandbox" />
        ) : r?.status === 'failed' ? (
          <Button label="Réessayer" size="major" full onPress={() => router.replace('/recharge')} testID="recharge-retry" />
        ) : r?.status === 'confirmed' ? (
          <Button label={restored ? 'Retour à l’accueil' : 'Voir le portefeuille'} size="major" full onPress={() => (restored ? router.dismissTo({ pathname: '/', params: { restored: '1' } }) : router.dismissTo('/wallet'))} testID="recharge-done" />
        ) : undefined
      }
      testID={`recharge-${r?.status ?? 'loading'}`}
    >
      {q.isLoading ? <SkeletonList rows={2} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {r ? (
        <View style={{ gap: 14, marginTop: 4 }}>
          <OperationHero state={r.status === 'confirmed' ? 'confirmed' : r.status === 'failed' ? 'failed' : 'pending'} amount={r.amount} kicker={r.status === 'confirmed' ? 'Recharge créditée' : r.status === 'failed' ? 'Aucun montant crédité' : 'En attente du prestataire'} caption={`${r.providerName} · ${r.id} · ${formatShort(r.createdAt)}`} />
          {r.status === 'pending' ? <StatusBanner compact tone="info" title={r.providerId.includes('card') ? 'Finalisez sur la page du prestataire' : `Référence ${r.providerRef} à présenter en agence`} message="le solde ne change pas avant confirmation" testID="recharge-pending-banner" /> : null}
          {r.status === 'failed' ? <StatusBanner compact tone="danger" title="Aucun montant n’a été crédité" message={r.failureReason ?? 'paiement refusé par le prestataire'} /> : null}
          {r.status === 'confirmed' && restored ? <StatusBanner compact tone="success" title="Accès aux courses rétabli" message="dette repassée sous le plafond" testID="recharge-restored" /> : null}
          {w ? (
            <Card style={{ paddingVertical: 6, gap: 0 }}>
              <FigureLine label="Solde comptable" value={formatMoney(w.balance)} strong testID="recharge-balance" />
              <FigureLine label="Dette de commission" sub={`Plafond ${formatMoney(w.debtLimit)}`} value={formatMoney(w.debt)} />
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
