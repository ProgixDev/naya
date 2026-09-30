import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, GripVertical, MapPin, Receipt, Star, Trash2, Wrench } from 'lucide-react-native';
import { avatars, cars, aspect } from '@naya/assets';
import { colors, radius } from '@naya/tokens';
import {
  formatDistance,
  formatDuration,
  formatMoney,
  formatMultiplier,
  formatShort,
  type Centimes,
  type DriverSummary,
  type FareBreakdown as Fare,
  type LedgerEntry,
  type Place,
  type Wallet,
} from '@naya/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { IconButton } from './Button';
import { PressableScale } from './PressableScale';
import { Avatar } from './Brand';
import { IconDisc } from './List';

/* ───────────── Money ───────────── */

export function Money({ amount, variant = 'label', tone = 'ink', sign, weight = 'semibold', style }: { amount: Centimes; variant?: 'display' | 'hero' | 'title' | 'heading' | 'label' | 'caption' | 'action' | 'body'; tone?: 'ink' | 'muted' | 'accent' | 'inverse' | 'success' | 'danger'; sign?: 'auto' | 'always'; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; style?: object }) {
  return (
    <Text variant={variant} tone={tone} weight={weight} numeric style={style} accessibilityLabel={`${formatMoney(amount, { sign }).replace('−', 'moins ')}`}>
      {formatMoney(amount, { sign })}
    </Text>
  );
}

/* ───────────── Route stops ───────────── */

export type StopRole = 'pickup' | 'stop' | 'destination';

export interface RouteStopRowProps {
  place: Place | null;
  role: StopRole;
  placeholder?: string;
  onPress?: () => void;
  onRemove?: () => void;
  /** Reorder: long-press handle, plus explicit up/down actions for accessibility. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isLast?: boolean;
  done?: boolean;
  testID?: string;
}

const roleLabel: Record<StopRole, string> = { pickup: 'Départ', stop: 'Arrêt', destination: 'Destination' };

export function RouteStopRow({ place, role, placeholder, onPress, onRemove, onMoveUp, onMoveDown, isLast, done, testID }: RouteStopRowProps) {
  const marker = role === 'pickup' ? <View style={[styles.dot, { borderColor: colors.accent }]} /> : role === 'destination' ? <MapPin size={18} color={colors.accent} fill={colors.selected} /> : <View style={[styles.square, done && { backgroundColor: colors.success, borderColor: colors.success }]} />;
  const content = (
    <View style={styles.stopRow}>
      <View style={styles.rail}>
        {marker}
        {!isLast ? <View style={styles.line} /> : null}
      </View>
      <View style={{ flex: 1, paddingVertical: 10, gap: 2 }}>
        <Text variant="micro" tone="muted" weight="semibold">
          {roleLabel[role]}
          {done ? ' · effectué' : ''}
        </Text>
        <Text variant="label" tone={place ? 'ink' : 'muted'} numberOfLines={1}>
          {place?.label ?? placeholder ?? 'Choisir une adresse'}
        </Text>
        {place?.address ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {place.address}
          </Text>
        ) : null}
      </View>
      {onMoveUp || onMoveDown ? (
        <View style={{ flexDirection: 'row' }}>
          {onMoveUp ? <IconButton variant="plain" size={36} icon={<GripVertical size={18} color={colors.muted} />} accessibilityLabel={`Monter ${place?.label ?? 'l’arrêt'}`} onPress={onMoveUp} /> : null}
          {onMoveDown ? <IconButton variant="plain" size={36} icon={<GripVertical size={18} color={colors.muted} />} accessibilityLabel={`Descendre ${place?.label ?? 'l’arrêt'}`} onPress={onMoveDown} /> : null}
        </View>
      ) : null}
      {onRemove ? <IconButton variant="plain" size={36} icon={<Trash2 size={18} color={colors.danger} />} accessibilityLabel={`Retirer ${place?.label ?? 'cet arrêt'}`} onPress={onRemove} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <PressableScale testID={testID} onPress={onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`${roleLabel[role]} : ${place?.label ?? placeholder ?? 'à choisir'}`}>
      {content}
    </PressableScale>
  );
}

/** Compact one-line summary: "Gare Rabat Ville → Agdal → Hay Riad". */
export function RouteSummary({ stops, distanceMeters, durationSeconds }: { stops: Place[]; distanceMeters?: number; durationSeconds?: number }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="label" numberOfLines={2}>
        {stops.map((s) => s.label).join(' → ')}
      </Text>
      {distanceMeters !== undefined && durationSeconds !== undefined ? (
        <Text variant="caption" tone="muted" numeric>
          {formatDistance(distanceMeters)} · {formatDuration(durationSeconds)}
        </Text>
      ) : null}
    </View>
  );
}

/* ───────────── Fare ───────────── */

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'ink' | 'muted' | 'accent' }) {
  return (
    <View style={styles.fareLine} accessible accessibilityLabel={`${label} ${value}`}>
      <Text variant={strong ? 'label' : 'caption'} tone={strong ? 'ink' : tone ?? 'muted'} weight={strong ? 'semibold' : 'medium'} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'label' : 'caption'} tone={strong ? 'ink' : tone ?? 'ink'} weight={strong ? 'semibold' : 'medium'} numeric>
        {value}
      </Text>
    </View>
  );
}

/** Transparent fare review: every component, the minimum, the dynamic multiplier and the total. */
export function FareBreakdown({ fare, distanceMeters, durationSeconds, dynamicReason }: { fare: Fare; distanceMeters: number; durationSeconds: number; dynamicReason?: string | null }) {
  return (
    <View style={{ gap: 2 }} testID="fare-breakdown">
      <Line label="Prise en charge" value={formatMoney(fare.baseFare)} />
      <Line label={`Distance · ${formatDistance(distanceMeters)}`} value={formatMoney(fare.distanceFare)} />
      <Line label={`Durée estimée · ${formatDuration(durationSeconds)}`} value={formatMoney(fare.timeFare)} />
      {fare.minimumAdjustment > 0 ? <Line label="Ajustement au tarif minimum" value={formatMoney(fare.minimumAdjustment)} /> : null}
      {fare.dynamicSurcharge > 0 ? <Line label={`Demande élevée ${formatMultiplier(fare.multiplierBp)}`} value={`+${formatMoney(fare.dynamicSurcharge)}`} tone="accent" /> : null}
      {dynamicReason && fare.dynamicSurcharge > 0 ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: 4 }}>
          {dynamicReason}
        </Text>
      ) : null}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 8 }} />
      <Line label="Total" value={formatMoney(fare.total)} strong />
    </View>
  );
}

/* ───────────── People and vehicles ───────────── */

export function VehicleImage({ color, width = 132 }: { color: string; width?: number }) {
  const plum = /prune|plum/i.test(color);
  return <Image source={plum ? cars.plumSmall : cars.pearlSmall} style={{ width, aspectRatio: aspect.carSmall }} contentFit="contain" accessibilityLabel={`Naya Signature ${color}`} />;
}

/** Portrait avatars exist only for the illustrated demo characters. */
export const avatarFor = (firstName: string) => (firstName === 'Amina' ? avatars.amina : firstName === 'Salma' ? avatars.salma : null);

export function DriverCard({ driver, trailing, eta }: { driver: DriverSummary; trailing?: ReactNode; eta?: string }) {
  return (
    <View style={styles.driver} testID="driver-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar source={avatarFor(driver.firstName)} name={driver.firstName} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">
            {driver.firstName} {driver.lastInitial}.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Star size={14} color={colors.accent} fill={colors.accent} />
            <Text variant="caption" tone="muted" numeric>
              {driver.ratingAverage?.toFixed(1).replace('.', ',') ?? 'Nouvelle'} · Chauffeuse
            </Text>
          </View>
          {eta ? (
            <Text variant="caption" tone="accent" weight="semibold">
              {eta}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
      <View style={styles.vehicleRow}>
        <VehicleImage color={driver.vehicle.color} width={96} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">
            {driver.vehicle.make} {driver.vehicle.model} · {driver.vehicle.color}
          </Text>
          <View style={styles.plate} accessibilityLabel={`Immatriculation ${driver.vehicle.plate}`}>
            <Text variant="caption" weight="bold" numeric>
              {driver.vehicle.plate}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ───────────── Wallet ───────────── */

/**
 * Accounting balance, reserved funds, withdrawable funds and commission debt are four
 * distinct figures with distinct labels. Only the balance is the hero.
 */
export function WalletSummary({ wallet, testID }: { wallet: Wallet; testID?: string }) {
  const negative = wallet.balance < 0;
  return (
    <View testID={testID ?? 'wallet-summary'} style={styles.walletCard}>
      <LinearGradient colors={['#7A3F64', colors.accent, colors.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.card + 4 }]} />
      <Text variant="caption" tone="inverse" style={{ opacity: 0.86 }}>
        Solde comptable
      </Text>
      <Money amount={wallet.balance} variant="display" tone="inverse" weight="semibold" />
      <View style={styles.walletGrid}>
        <WalletFigure label="Disponible au retrait" amount={wallet.available} />
        <WalletFigure label="Réservé (retrait en cours)" amount={wallet.reserved} />
        <WalletFigure label="Dette de commission" amount={wallet.debt} suffix={` / ${formatMoney(wallet.debtLimit)}`} />
        {wallet.pendingRecharges > 0 ? <WalletFigure label="Recharge en attente" amount={wallet.pendingRecharges} note="non disponible" /> : null}
      </View>
      {negative ? (
        <Text variant="caption" tone="inverse" style={{ opacity: 0.9, marginTop: 4 }}>
          {wallet.offersBlockedByDebt ? 'Plafond atteint : nouvelles courses suspendues jusqu’à la recharge.' : 'Commissions dues sur les courses en espèces, compensées par vos courses carte.'}
        </Text>
      ) : null}
    </View>
  );
}

function WalletFigure({ label, amount, suffix, note }: { label: string; amount: Centimes; suffix?: string; note?: string }) {
  return (
    <View style={{ width: '50%', paddingRight: 8, gap: 2, marginTop: 12 }} accessible accessibilityLabel={`${label} ${formatMoney(amount)}${suffix ?? ''}${note ? `, ${note}` : ''}`}>
      <Text variant="micro" tone="inverse" style={{ opacity: 0.8 }}>
        {label}
      </Text>
      <Text variant="label" tone="inverse" weight="semibold" numeric>
        {formatMoney(amount)}
        <Text variant="caption" tone="inverse" style={{ opacity: 0.75 }}>
          {suffix ?? ''}
        </Text>
      </Text>
    </View>
  );
}

const ledgerMeta: Record<LedgerEntry['type'], { label: string; Icon: typeof Receipt }> = {
  ride_commission: { label: 'Commission · course espèces', Icon: Banknote },
  ride_net_credit: { label: 'Revenu net · course carte', Icon: CreditCard },
  cancellation_fee_credit: { label: 'Frais d’annulation', Icon: Receipt },
  recharge: { label: 'Recharge', Icon: ArrowDownLeft },
  withdrawal: { label: 'Retrait', Icon: ArrowUpRight },
  correction: { label: 'Correction exceptionnelle', Icon: Wrench },
};

export function TransactionRow({ entry, onPress, subtitle }: { entry: Pick<LedgerEntry, 'type' | 'amount' | 'createdAt' | 'rideId' | 'id'>; onPress?: () => void; subtitle?: string }) {
  const meta = ledgerMeta[entry.type];
  const credit = entry.amount > 0;
  const body = (
    <View style={styles.txRow}>
      <IconDisc tone={credit ? 'success' : 'plain'}>
        <meta.Icon size={18} color={credit ? colors.success : colors.accent} />
      </IconDisc>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{meta.label}</Text>
        <Text variant="caption" tone="muted" numeric numberOfLines={1}>
          {subtitle ?? [entry.rideId, formatShort(entry.createdAt)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Money amount={entry.amount} sign="always" tone={credit ? 'success' : 'ink'} />
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`${meta.label}, ${formatMoney(entry.amount, { sign: 'always' })}`}>
      {body}
    </PressableScale>
  );
}

/* ───────────── Offer countdown ───────────── */

/** Ring + tabular seconds. The ring is decorative; the number carries the information. */
export function CountdownRing({ seconds, total = 30, size = 56 }: { seconds: number; total?: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const urgent = seconds <= 10;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="timer" accessibilityLabel={`${seconds} secondes restantes`} accessibilityLiveRegion={seconds % 10 === 0 || seconds <= 5 ? 'polite' : 'none'}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.selected} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={urgent ? colors.danger : colors.accent} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text variant="heading" numeric weight="semibold" tone={urgent ? 'danger' : 'ink'}>
        {seconds}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rail: { width: 20, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: colors.surface },
  square: { width: 12, height: 12, borderRadius: 3, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface },
  line: { position: 'absolute', top: '62%', bottom: '-38%', width: 2, backgroundColor: colors.line },
  fareLine: { flexDirection: 'row', alignItems: 'center', minHeight: 26, gap: 12 },
  driver: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: radius.row, padding: 10 },
  plate: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 1, marginTop: 4, backgroundColor: colors.surface },
  walletCard: { borderRadius: radius.card + 4, padding: 20, overflow: 'hidden', gap: 2 },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
});
