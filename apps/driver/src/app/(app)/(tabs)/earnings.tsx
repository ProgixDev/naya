import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Hourglass } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort } from '@naya/domain';
import { illustrations, aspect } from '@naya/assets';
import { colors } from '@naya/tokens';
import { ErrorState, Header, IconDisc, Illustration, ListGroup, ListRow, Money, Screen, SegmentedControl, SkeletonList, StatusBanner, Text } from '@naya/ui';
import { StatTile } from '@/components/Kit';
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
    <Screen header={<Header title="Gains" />} contentStyle={{ paddingBottom: TAB_BAR_SPACE + 24 }} testID="earnings-screen">
      <View style={{ gap: 14, marginTop: 4 }}>
        <SegmentedControl<Period> value={period} onChange={setPeriod} options={[{ value: 'today', label: 'Aujourd’hui' }, { value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }]} testID="earnings-period" />
        {q.isLoading ? <SkeletonList rows={3} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {e && e.rideCount === 0 ? (
          <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }} testID="earnings-empty">
            <Money amount={0} variant="display" />
            <Text variant="label" weight="semibold">Aucune course sur cette période</Text>
            <Text variant="caption" tone="muted" align="center">Passez en ligne pour recevoir des propositions.</Text>
            <Illustration source={illustrations.driverWallet} aspect={aspect.illustration} width="78%" maxHeight={220} />
          </View>
        ) : null}
        {e && e.rideCount > 0 ? (
          <>
            <View style={{ alignItems: 'center', gap: 2, paddingVertical: 6 }}>
              <Text variant="caption" tone="muted">
                Revenu net · {e.rideCount} course{e.rideCount > 1 ? 's' : ''}
              </Text>
              <View testID="earnings-net">
                <Money amount={e.net} variant="display" />
              </View>
              <Text variant="caption" tone="muted" numeric testID="earnings-breakdown">
                Brut {formatMoney(e.gross)} · commissions {formatMoney(e.commission)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatTile label="Espèces encaissées" foot="Gardées par vous" accessibilityLabel={`Espèces encaissées ${formatMoney(e.cashCollected)}`} style={{ backgroundColor: colors.surface }} testID="earnings-cash">
                <Text variant="heading" numeric>{formatMoney(e.cashCollected)}</Text>
              </StatTile>
              <StatTile label="Crédité au portefeuille" foot="Courses carte (net)" accessibilityLabel={`Crédité au portefeuille ${formatMoney(e.walletCredited)}`} style={{ backgroundColor: colors.surface }} testID="earnings-wallet">
                <Text variant="heading" numeric>{formatMoney(e.walletCredited)}</Text>
              </StatTile>
            </View>
            {e.pendingElectronic > 0 ? <StatusBanner compact tone="warning" icon={<Hourglass size={14} color={colors.warning} />} title={`${formatMoney(e.pendingElectronic)} carte en attente`} message="crédités après confirmation" testID="pending-electronic" /> : null}
            <ListGroup label="Courses" footnote="Net = espèces + crédits portefeuille − commissions espèces.">
              {e.rides.map((r) => (
                <ListRow
                  key={r.rideId}
                  title={`${r.rideId} · ${formatMoney(r.net)} net`}
                  subtitle={`${formatShort(r.completedAt)} · ${r.method === 'cash' ? 'Espèces' : `Carte${r.paymentStatus !== 'confirmed' ? ` (${r.paymentStatus === 'failed' ? 'refusé' : 'en attente'})` : ''}`} · brut ${formatMoney(r.gross)}`}
                  leading={<IconDisc size={36}>{r.method === 'cash' ? <Banknote size={17} color={colors.accent} /> : <CreditCard size={17} color={colors.accent} />}</IconDisc>}
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
