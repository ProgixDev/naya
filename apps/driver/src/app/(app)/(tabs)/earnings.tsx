import { useTheme, ErrorState, Header, Icon, Illustration, ListGroup, ListRow, Money, Screen, SegmentedControl, SkeletonList, StatusBanner, StatusIcon, Text, paymentMethodIcon } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, formatShort, paymentMethodPresentation, statusPresentation, toCasablancaParts, type Centimes, type EarningsSummary } from '@naya/domain';
import { illustrations, aspect } from '@naya/assets';
import { colors } from '@naya/tokens';
import { StatTile } from '@/components/Kit';
import { FitMoney } from '@/components/WalletCard';
import { useAccountId } from '@/lib/queries';
import { daysAgoUtc, startOfTodayUtc } from '@/lib/time';

type Period = 'today' | '7d' | '30d';
type Ride = EarningsSummary['rides'][number];

/**
 * Rides paid outside cash (card, Naya wallet, mobile payment) are credited net to the wallet once
 * their payment is confirmed (rides.ts settle, finance.ts card outcome). Summed from the server's
 * rows: the summary's own walletCredited / pendingElectronic count card rides only (DRV-08).
 */
const electronic = (rides: Ride[], status: Ride['paymentStatus']) => rides.reduce<Centimes>((s, r) => (r.method !== 'cash' && r.paymentStatus === status ? s + r.net : s), 0);

/** D11 · D11-filter · D11-empty */
export default function Earnings() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const [period, setPeriod] = useState<Period>('today');
  const from = period === 'today' ? startOfTodayUtc() : daysAgoUtc(period === '7d' ? 7 : 30);
  const q = useQuery({ queryKey: qk.earnings(a, from, null), queryFn: () => api.driver.earnings(from, null) });
  const e = q.data;
  const credited = e ? electronic(e.rides, 'confirmed') : 0;
  const pending = e ? electronic(e.rides, 'pending') : 0;
  return (
    <Screen tabBar header={<Header title="Gains" />} testID="earnings-screen">
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
              <View testID="earnings-net" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
                <FitMoney amount={e.net} unitVariant="heading" />
              </View>
              <Text variant="caption" tone="muted" numeric align="center" testID="earnings-breakdown">
                Brut {formatMoney(e.gross)} · commissions {formatMoney(e.commission)}
              </Text>
            </View>
            {period !== 'today' && e.from ? <EarningsChart rides={e.rides} from={e.from} days={period === '7d' ? 7 : 30} /> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatTile label="Espèces encaissées" foot="Gardées par vous" accessibilityLabel={`Espèces encaissées ${formatMoney(e.cashCollected)}`} style={{ backgroundColor: colors.surface }} testID="earnings-cash">
                <FitMoney amount={e.cashCollected} variant="heading" unitVariant="caption" />
              </StatTile>
              <StatTile label="Crédité au portefeuille" foot="Hors espèces (net)" accessibilityLabel={`Crédité au portefeuille ${formatMoney(credited)}, courses payées hors espèces`} style={{ backgroundColor: colors.surface }} testID="earnings-wallet">
                <FitMoney amount={credited} variant="heading" unitVariant="caption" />
              </StatTile>
            </View>
            {pending > 0 ? <StatusBanner compact kind="payment" state="pending" title={`${formatMoney(pending)} en attente de paiement`} message="crédités après confirmation" testID="pending-electronic" /> : null}
            <ListGroup label="Courses" footnote="Net = espèces + crédits portefeuille − commissions espèces.">
              {e.rides.map((r) => (
                <EarningsRow key={r.rideId} ride={r} />
              ))}
            </ListGroup>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * D-19, A115, DRV-08: the time is the title, the net amount sits on the right in tabular figures,
 * and the leading glyph is the payment method with its state as a badge (C3, C19). A failed payment
 * keeps its word (principle 3).
 */
function EarningsRow({ ride: r }: { ride: Ride }) {
  useTheme();
  const method = paymentMethodPresentation(r.method);
  const state = statusPresentation('payment', r.paymentStatus);
  const sub = [method.shortLabel, state.problem ? state.shortLabel : null, `brut ${formatMoney(r.gross)}`].filter(Boolean).join(' · ');
  return (
    <ListRow
      title={formatShort(r.completedAt)}
      subtitle={sub}
      value={formatMoney(r.net)}
      numericValue
      status={<StatusIcon kind="payment" state={r.paymentStatus} showLabel={false} accessible={false} badgeOn={<Icon icon={paymentMethodIcon(r.method)} size={24} tone="accent" />} />}
      statusPlacement="leading"
      onPress={() => router.push({ pathname: '/rides/[id]', params: { id: r.rideId } })}
      testID={`earnings-ride-${r.rideId}`}
    />
  );
}

/* ───────────── R18: 7 / 30-day bar chart ───────────── */

const DAY_MS = 86_400_000;
const shiftDate = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const narrowDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow', timeZone: 'UTC' });
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const at = (date: string) => new Date(`${date}T12:00:00Z`);

/**
 * Net per business day (Africa/Casablanca), one bar each, full width, no gridlines. Plain Views, no
 * chart library. Screen readers get one summary sentence instead of 7 or 30 bars.
 */
function EarningsChart({ rides, from, days }: { rides: Ride[]; from: string; days: 7 | 30 }) {
  useTheme();
  const first = toCasablancaParts(from).date;
  const dates = Array.from({ length: days }, (_, i) => shiftDate(first, i));
  const byDay = new Map<string, Centimes>();
  for (const r of rides) {
    const d = toCasablancaParts(r.completedAt).date;
    byDay.set(d, (byDay.get(d) ?? 0) + r.net);
  }
  const values = dates.map((d) => Math.max(0, byDay.get(d) ?? 0));
  const max = Math.max(...values, 0);
  const best = values.indexOf(max);
  const active = values.filter((v) => v > 0).length;
  const summary = max > 0 ? `Revenu net par jour sur ${days} jours. ${active} jour${active > 1 ? 's' : ''} avec des courses. Meilleur jour : ${longDay.format(at(dates[best]!))}, ${formatMoney(max)}.` : `Aucun revenu sur ${days} jours.`;
  const HEIGHT = 96;
  const gap = days === 7 ? 8 : 3;
  return (
    <View style={{ gap: 6 }} testID="earnings-chart">
      <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT, gap }} testID="earnings-chart-bars">
        {values.map((v, i) => (
          <View key={dates[i]} style={{ flex: 1, height: v > 0 ? Math.max(4, Math.round((v / max) * HEIGHT)) : 2, borderRadius: days === 7 ? 6 : 2, backgroundColor: v > 0 ? colors.accent : colors.line }} />
        ))}
      </View>
      {days === 7 ? (
        <View style={{ flexDirection: 'row', gap }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {dates.map((d) => (
            <Text key={d} variant="micro" tone="muted" align="center" numberOfLines={1} style={{ flex: 1 }}>
              {narrowDay.format(at(d)).toUpperCase()}
            </Text>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text variant="micro" tone="muted">{shortDay.format(at(dates[0]!))}</Text>
          <Text variant="micro" tone="muted">Aujourd’hui</Text>
        </View>
      )}
      {max > 0 ? (
        <Text variant="caption" tone="muted" numeric importantForAccessibility="no" accessibilityElementsHidden>
          Meilleur jour · {shortDay.format(at(dates[best]!))} · {formatMoney(max)}
        </Text>
      ) : null}
    </View>
  );
}
