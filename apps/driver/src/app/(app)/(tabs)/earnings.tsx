import { useTheme, ErrorState, Header, Illustration, Money, PressableScale, Screen, SegmentedControl, SkeletonList, StatusBanner, Text } from '@naya/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Hourglass, Wallet } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort } from '@naya/domain';
import { illustrations, aspect } from '@naya/assets';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';
import { daysAgoUtc, startOfTodayUtc } from '@/lib/time';
import { TAB_BAR_SPACE } from '@/components/TabBar';

type Period = 'today' | '7d' | '30d';

/** D11 · D11-filter · D11-empty */
export default function Earnings() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const [period, setPeriod] = useState<Period>('today');
  const from = period === 'today' ? startOfTodayUtc() : daysAgoUtc(period === '7d' ? 7 : 30);
  const q = useQuery({ queryKey: qk.earnings(a, from, null), queryFn: () => api.driver.earnings(from, null) });
  const e = q.data;
  return (
    <Screen header={<Header title="Gains" />} contentStyle={{ paddingBottom: TAB_BAR_SPACE + 24 }} testID="earnings-screen">
      <View style={{ gap: 16, marginTop: 4 }}>
        <SegmentedControl<Period> variant="underline" value={period} onChange={setPeriod} options={[{ value: 'today', label: 'Aujourd’hui' }, { value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }]} testID="earnings-period" />
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
            {/* ── Net hero ── */}
            <View style={{ borderRadius: 26, overflow: 'hidden', padding: 20, gap: 14 }}>
              <LinearGradient colors={['#47203A', '#7C3F5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text weight="medium" style={{ fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.85)' }}>
                Revenu net · {e.rideCount} course{e.rideCount > 1 ? 's' : ''}
              </Text>
              <View testID="earnings-net">
                <Text weight="bold" numeric style={{ fontSize: 40, lineHeight: 48, letterSpacing: -1.2, color: '#FFFFFF' }}>{formatMoney(e.net)}</Text>
              </View>
              <View testID="earnings-breakdown" style={{ flexDirection: 'row', gap: 10 }}>
                <HeroChip label="Brut" value={formatMoney(e.gross)} />
                <HeroChip label="Commissions" value={`− ${formatMoney(e.commission)}`} />
              </View>
            </View>

            {/* ── Where the money is ── */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SplitTile testID="earnings-cash" icon={<Banknote size={20} color={colors.success} strokeWidth={1.9} />} tile={colors.successSoft} label="Espèces encaissées" value={formatMoney(e.cashCollected)} foot="Gardées par vous" />
              <SplitTile testID="earnings-wallet" icon={<Wallet size={20} color={colors.accent} strokeWidth={1.9} />} tile={colors.mauveSoft} label="Crédité au portefeuille" value={formatMoney(e.walletCredited)} foot="Courses carte (net)" />
            </View>
            {e.pendingElectronic > 0 ? <StatusBanner compact tone="warning" icon={<Hourglass size={14} color={colors.warning} />} title={`${formatMoney(e.pendingElectronic)} carte en attente`} message="crédités après confirmation" testID="pending-electronic" /> : null}

            {/* ── Rides ── */}
            <View style={{ gap: 10, marginTop: 6 }}>
              <Text weight="semibold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.3, marginLeft: 2 }}>Courses</Text>
              {e.rides.map((r) => {
                const cash = r.method === 'cash';
                const status = cash ? 'Espèces' : `Carte${r.paymentStatus !== 'confirmed' ? ` · ${r.paymentStatus === 'failed' ? 'refusé' : 'en attente'}` : ''}`;
                return (
                  <PressableScale key={r.rideId} onPress={() => router.push({ pathname: '/rides/[id]', params: { id: r.rideId } })} accessibilityRole="button" accessibilityLabel={`${r.rideId}, ${formatMoney(r.net)} net, ${status}`} pressedScale={0.985} style={card()}>
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: cash ? colors.successSoft : colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                      {cash ? <Banknote size={20} color={colors.success} strokeWidth={1.9} /> : <CreditCard size={20} color={colors.info} strokeWidth={1.9} />}
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{status} · brut {formatMoney(r.gross)}</Text>
                      <Text tone="muted" numeric numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{r.rideId} · {formatShort(r.completedAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text weight="bold" numeric tone="success" style={{ fontSize: 16, lineHeight: 21 }}>+{formatMoney(r.net)}</Text>
                      <Text tone="muted" style={{ fontSize: 11, lineHeight: 14 }}>net</Text>
                    </View>
                  </PressableScale>
                );
              })}
              <Text tone="muted" style={{ fontSize: 12, lineHeight: 17, marginHorizontal: 4 }}>Net = espèces + crédits portefeuille − commissions espèces.</Text>
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const card = () => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, borderRadius: 20, backgroundColor: colors.surface, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;

function HeroChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 9, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.78)' }}>{label}</Text>
      <Text weight="semibold" numeric style={{ fontSize: 15, lineHeight: 20, color: '#FFFFFF' }}>{value}</Text>
    </View>
  );
}

function SplitTile({ icon, tile, label, value, foot, testID }: { icon: React.ReactNode; tile: string; label: string; value: string; foot: string; testID?: string }) {
  useTheme();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label} ${value}`} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 20, padding: 14, gap: 10, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ gap: 1 }}>
        <Text tone="muted" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{label}</Text>
        <Text weight="bold" numeric style={{ fontSize: 18, lineHeight: 24 }}>{value}</Text>
        <Text tone="muted" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{foot}</Text>
      </View>
    </View>
  );
}
