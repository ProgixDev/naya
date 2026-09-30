import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Hourglass, Wallet } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort } from '@naya/domain';
import { illustrations, aspect } from '@naya/assets';
import { colors } from '@naya/tokens';
import { Card, EmptyState, ErrorState, Header, IconDisc, ListGroup, ListRow, Money, Screen, SegmentedControl, SkeletonList, Text } from '@naya/ui';
import { useAccountId } from '@/lib/queries';
import { daysAgoUtc, startOfTodayUtc } from '@/lib/time';
import { TAB_BAR_SPACE } from '@/components/TabBar';

type Period = 'today' | '7d' | '30d';

/** D11 · D11-filter · D11-empty */
export default function Earnings() {
  const api = useApi();
  const a = useAccountId();
  const [period, setPeriod] = useState<Period>('today');
  const from = period === 'today' ? startOfTodayUtc() : daysAgoUtc(period === '7d' ? 7 : 30);
  const q = useQuery({ queryKey: qk.earnings(a, from, null), queryFn: () => api.driver.earnings(from, null) });
  const e = q.data;
  return (
    <Screen header={<Header title="Mes gains" />} contentStyle={{ paddingBottom: TAB_BAR_SPACE + 40 }} testID="earnings-screen">
      <View style={{ gap: 16, marginTop: 12 }}>
        <SegmentedControl<Period> value={period} onChange={setPeriod} options={[{ value: 'today', label: 'Aujourd’hui' }, { value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }]} testID="earnings-period" />
        {q.isLoading ? <SkeletonList rows={3} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {e && e.rideCount === 0 ? <EmptyState title="Aucune course sur cette période" message="Passez en ligne pour recevoir des propositions." image={illustrations.driverWallet} imageAspect={aspect.illustration} testID="earnings-empty" /> : null}
        {e && e.rideCount > 0 ? (
          <>
            <Card>
              <Text variant="label" weight="semibold">
                Revenus nets · {e.rideCount} course{e.rideCount > 1 ? 's' : ''}
              </Text>
              <View testID="earnings-net">
                <Money amount={e.net} variant="display" />
              </View>
              <Text variant="caption" tone="muted" numeric testID="earnings-breakdown">
                Brut : {formatMoney(e.gross)} · Commissions : {formatMoney(e.commission)}
              </Text>
            </Card>
            <ListGroup footnote="Revenu net = espèces encaissées + crédits portefeuille − commissions des courses en espèces.">
              <ListRow title="Espèces encaissées" subtitle="Détenues physiquement, hors portefeuille" leading={<IconDisc><Banknote size={18} color={colors.accent} /></IconDisc>} value={formatMoney(e.cashCollected)} numericValue testID="earnings-cash" />
              <ListRow title="Crédité au portefeuille" subtitle="Courses carte confirmées (net)" leading={<IconDisc><Wallet size={18} color={colors.accent} /></IconDisc>} value={formatMoney(e.walletCredited)} numericValue testID="earnings-wallet" />
              {e.pendingElectronic > 0 ? <ListRow title="Paiements carte en attente" subtitle="Crédités après confirmation" leading={<IconDisc tone="warning"><Hourglass size={18} color={colors.warning} /></IconDisc>} value={formatMoney(e.pendingElectronic)} numericValue /> : null}
            </ListGroup>
            <ListGroup label="Courses">
              {e.rides.map((r) => (
                <ListRow
                  key={r.rideId}
                  title={`${r.rideId} · ${formatMoney(r.net)} net`}
                  subtitle={`${formatShort(r.completedAt)} · ${r.method === 'cash' ? 'Espèces' : `Carte${r.paymentStatus !== 'confirmed' ? ` (${r.paymentStatus === 'failed' ? 'refusé' : 'en attente'})` : ''}`} · brut ${formatMoney(r.gross)}`}
                  leading={<IconDisc>{r.method === 'cash' ? <Banknote size={18} color={colors.accent} /> : <CreditCard size={18} color={colors.accent} />}</IconDisc>}
                  onPress={() => router.push({ pathname: '/rides/[id]', params: { id: r.rideId } })}
                />
              ))}
            </ListGroup>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
