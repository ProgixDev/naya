import { themedStyles, colors, radius, type TypeToken } from '@naya/tokens';
import { useTheme } from './core/theme';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Car, CircleCheck, Droplets, GripVertical, Landmark, MapPin, Percent, Plus, ReceiptText, Star, Trash2, Undo2, Wrench, type LucideIcon } from 'lucide-react-native';
import { cars, aspect } from '@naya/assets';
import { Illustration , Avatar } from './Brand';
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
import { IconDisc } from './List';
import { Icon } from './Icon';

/* ───────────── Money ───────────── */

export function Money({ amount, variant = 'label', tone = 'ink', sign, weight = 'semibold', style }: { amount: Centimes; variant?: TypeToken; tone?: 'ink' | 'muted' | 'accent' | 'inverse' | 'success' | 'danger'; sign?: 'auto' | 'always'; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; style?: object }) {
  useTheme();
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
  /** Compact live-trip timeline: keep place names; full street addresses remain in the route editor. */
  compact?: boolean;
  done?: boolean;
  testID?: string;
}

const roleLabel: Record<StopRole, string> = { pickup: 'Départ', stop: 'Arrêt', destination: 'Destination' };

export function RouteStopRow({ place, role, placeholder, onPress, onRemove, onMoveUp, onMoveDown, isLast, done, compact = false, testID }: RouteStopRowProps) {
  useTheme();
  // A done stop is a check (audit A4): the glyph says it, so the row no longer adds « · effectué ».
  const marker =
    role === 'pickup' ? (
      <View style={[styles.dot, { borderColor: colors.accent }]} />
    ) : role === 'destination' ? (
      <MapPin size={18} color={colors.accent} fill={colors.selected} />
    ) : done ? (
      <View style={styles.doneMarker} testID={testID ? `${testID}-done` : undefined}>
        <CircleCheck size={16} color={colors.success} strokeWidth={2} />
      </View>
    ) : (
      <View style={styles.square} />
    );
  const spoken = `${roleLabel[role]}${done ? ', effectué' : ''} : ${place?.label ?? placeholder ?? 'à choisir'}`;
  const rail = (
    <View style={styles.rail}>
      {marker}
      {!isLast ? <View style={styles.line} /> : null}
    </View>
  );
  const body = (
      <View style={{ flex: 1, paddingVertical: compact ? 6 : 10, gap: 2 }}>
        <Text variant="micro" tone="muted" weight="semibold">
          {roleLabel[role]}
        </Text>
        <Text variant="label" tone={place ? 'ink' : 'muted'} numberOfLines={1}>
          {place?.label ?? placeholder ?? 'Choisir une adresse'}
        </Text>
        {place?.address && !compact ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {place.address}
          </Text>
        ) : null}
      </View>
  );
  const actions = (
    <>
      {onMoveUp || onMoveDown ? (
        <View style={{ flexDirection: 'row' }}>
          {onMoveUp ? <IconButton variant="plain" size={36} icon={<GripVertical size={18} color={colors.muted} />} accessibilityLabel={`Monter ${place?.label ?? 'l’arrêt'}`} onPress={onMoveUp} /> : null}
          {onMoveDown ? <IconButton variant="plain" size={36} icon={<GripVertical size={18} color={colors.muted} />} accessibilityLabel={`Descendre ${place?.label ?? 'l’arrêt'}`} onPress={onMoveDown} /> : null}
        </View>
      ) : null}
      {onRemove ? <IconButton variant="plain" size={36} icon={<Trash2 size={18} color={colors.danger} />} accessibilityLabel={`Retirer ${place?.label ?? 'cet arrêt'}`} onPress={onRemove} /> : null}
    </>
  );
  const content = (
    <View style={styles.stopRow}>
      {rail}
      {body}
      {actions}
    </View>
  );
  const hasActions = !!(onMoveUp || onMoveDown || onRemove);
  if (!onPress) {
    // Read as one line (« Arrêt, effectué : Agdal ») unless it holds its own controls.
    return hasActions ? <View testID={testID}>{content}</View> : <View testID={testID} accessible accessibilityLabel={spoken}>{content}</View>;
  }
  // The row body is the pressable; reorder/remove controls stay siblings (no nested buttons).
  return (
    <View style={styles.stopRow}>
      <PressableScale testID={testID} onPress={onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={spoken} style={[styles.stopRow, { flex: 1 }]}>
        {rail}
        {body}
      </PressableScale>
      {actions}
    </View>
  );
}

/** Compact one-line summary: "Gare Rabat Ville → Agdal → Hay Riad". */
export function RouteSummary({ stops, distanceMeters, durationSeconds }: { stops: Place[]; distanceMeters?: number; durationSeconds?: number }) {
  useTheme();
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
  useTheme();
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
  useTheme();
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
  useTheme();
  return <Illustration source={cars.pearlSmall} width={width} aspect={aspect.carSmall} label={`Véhicule ${color}`} />;
}

/** Portrait avatars exist only for the illustrated demo characters. */
export const avatarFor = (_firstName: string): null => null;

/**
 * The plate as the passenger checks it against the car (audit P-56): 20/700 tabular figures in a
 * 36-tall plate chip, 28/700 once the chauffeuse has arrived and the check happens.
 */
export function PlateChip({ plate, large = false, testID }: { plate: string; large?: boolean; testID?: string }) {
  useTheme();
  return (
    <View style={[styles.plate, large ? styles.plateLarge : null]} accessible accessibilityRole="text" accessibilityLabel={`Immatriculation ${plate}`} testID={testID}>
      <Text variant="title" weight="bold" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.4} style={large ? styles.plateTextLarge : styles.plateText}>
        {plate}
      </Text>
    </View>
  );
}

/**
 * The chauffeuse on a live ride. Recognising the car is the safety check, so the plate leads, then
 * the car model and colour (15), then who drives it: photo 48 (an initial until photos exist), name
 * and rating. `arrived` enlarges the plate. `trailing` is an action beside the name (a call, once live).
 */
export function DriverCard({ driver, trailing, eta, arrived = false }: { driver: DriverSummary; trailing?: ReactNode; eta?: string; arrived?: boolean }) {
  useTheme();
  const rating = driver.ratingAverage?.toFixed(1).replace('.', ',') ?? null;
  return (
    <View style={styles.driver} testID="driver-card">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <PlateChip plate={driver.vehicle.plate} large={arrived} testID="driver-plate" />
          <Text variant="label" numberOfLines={2}>
            {driver.vehicle.make} {driver.vehicle.model} · {driver.vehicle.color}
          </Text>
          {eta ? (
            <Text variant="caption" tone="accent" weight="semibold" numeric>
              {eta}
            </Text>
          ) : null}
        </View>
        <Avatar source={avatarFor(driver.firstName)} name={driver.firstName} size={48} />
      </View>
      <View style={styles.driverLine}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} accessible accessibilityLabel={`${driver.firstName} ${driver.lastInitial}.${rating ? `, note ${rating} sur 5` : ', nouvelle chauffeuse'}`}>
          <Text variant="label" weight="semibold" numberOfLines={1}>
            {driver.firstName} {driver.lastInitial}.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Star size={14} color={colors.accent} fill={colors.accent} />
            <Text variant="caption" tone="muted" numeric>
              {rating ?? 'Nouvelle'}
            </Text>
          </View>
        </View>
        {trailing}
      </View>
    </View>
  );
}

/* ───────────── Wallet ───────────── */

/**
 * Accounting balance, reserved funds, withdrawable funds and commission debt are four
 * distinct figures with distinct labels. Only the balance is the hero.
 */
/**
 * The wallet card is fixed plum in both schemes (DM-17): the theme accent turns pale pink in dark,
 * and `inverse` turns near-black, so neither may be used here. Text on it is fixed white.
 */
const WALLET_PLUM = ['#7A3F64', '#6B3657', '#4E2541'] as const;
const ON_PLUM = '#FFFFFF';
const ON_PLUM_MUTED = 'rgba(255,255,255,0.82)';

export function WalletSummary({ wallet, testID }: { wallet: Wallet; testID?: string }) {
  useTheme();
  const negative = wallet.balance < 0;
  return (
    <View testID={testID ?? 'wallet-summary'} style={styles.walletCard}>
      <LinearGradient colors={WALLET_PLUM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.card + 4 }]} />
      <Text variant="caption" style={{ color: ON_PLUM_MUTED }}>
        Solde comptable
      </Text>
      <Money amount={wallet.balance} variant="display" weight="semibold" style={{ color: ON_PLUM }} />
      <View style={styles.walletGrid}>
        <WalletFigure label="Disponible au retrait" amount={wallet.available} />
        <WalletFigure label="Réservé (retrait en cours)" amount={wallet.reserved} />
        <WalletFigure label="Dette de commission" amount={wallet.debt} suffix={` / ${formatMoney(wallet.debtLimit)}`} />
        {wallet.pendingRecharges > 0 ? <WalletFigure label="Recharge en attente" amount={wallet.pendingRecharges} note="non disponible" /> : null}
      </View>
      {negative ? (
        <Text variant="caption" style={{ color: ON_PLUM, marginTop: 4 }}>
          {wallet.offersBlockedByDebt ? 'Plafond atteint : nouvelles courses suspendues jusqu’à la recharge.' : 'Commissions dues sur les courses en espèces, compensées par vos courses carte.'}
        </Text>
      ) : null}
    </View>
  );
}

function WalletFigure({ label, amount, suffix, note }: { label: string; amount: Centimes; suffix?: string; note?: string }) {
  useTheme();
  return (
    <View style={{ width: '50%', paddingRight: 8, gap: 2, marginTop: 12 }} accessible accessibilityLabel={`${label} ${formatMoney(amount)}${suffix ?? ''}${note ? `, ${note}` : ''}`}>
      <Text variant="micro" style={{ color: ON_PLUM_MUTED }}>
        {label}
      </Text>
      <Text variant="label" weight="semibold" numeric style={{ color: ON_PLUM }}>
        {formatMoney(amount)}
        <Text variant="caption" style={{ color: ON_PLUM_MUTED }}>
          {suffix ?? ''}
        </Text>
      </Text>
    </View>
  );
}

/** Ledger types, not states (audit C18): a 40 disc whose glyph names the movement. */
const ledgerMeta: Record<LedgerEntry['type'], { label: string; Icon: LucideIcon }> = {
  ride_commission: { label: 'Commission · course espèces', Icon: Percent },
  ride_net_credit: { label: 'Revenu net · course carte', Icon: Car },
  cancellation_fee_credit: { label: 'Frais d’annulation', Icon: ReceiptText },
  recharge: { label: 'Recharge', Icon: Plus },
  withdrawal: { label: 'Retrait', Icon: Landmark },
  correction: { label: 'Correction exceptionnelle', Icon: Wrench },
  car_wash: { label: 'Lavage à domicile', Icon: Droplets },
  car_wash_refund: { label: 'Remboursement · lavage annulé', Icon: Undo2 },
};

export function TransactionRow({ entry, onPress, subtitle }: { entry: Pick<LedgerEntry, 'type' | 'amount' | 'createdAt' | 'rideId' | 'id'>; onPress?: () => void; subtitle?: string }) {
  useTheme();
  const meta = ledgerMeta[entry.type];
  const credit = entry.amount > 0;
  const body = (
    <View style={styles.txRow}>
      {/* The sign and the tint say the direction; the tint is never alone (success only on incoming money). */}
      <IconDisc tone={credit ? 'success' : 'plain'}>
        <Icon icon={meta.Icon} size={20} scale={false} color={credit ? colors.success : colors.accent} />
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
  useTheme();
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

const styles = themedStyles(() => StyleSheet.create({
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rail: { width: 20, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: colors.surface },
  square: { width: 12, height: 12, borderRadius: 3, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface },
  line: { position: 'absolute', top: '62%', bottom: '-38%', width: 2, backgroundColor: colors.line },
  fareLine: { flexDirection: 'row', alignItems: 'center', minHeight: 26, gap: 12 },
  driver: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  doneMarker: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 10 },
  driverLine: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10 },
  // A number plate: ink edge on the surface in both schemes, like the real plate it stands for.
  plate: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.surface, maxWidth: '100%' },
  plateLarge: { minHeight: 48, paddingHorizontal: 14, borderRadius: 10 },
  plateText: { fontSize: 20, lineHeight: 26, letterSpacing: 0.5 },
  plateTextLarge: { fontSize: 28, lineHeight: 34, letterSpacing: 0.8 },
  walletCard: { borderRadius: radius.card + 4, padding: 20, overflow: 'hidden', gap: 2 },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
}));
