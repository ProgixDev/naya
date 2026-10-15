import { themedStyles , colors, radius } from '@naya/tokens';
import { useTheme } from './core/theme';
import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { statusA11y } from '@naya/domain';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { StatusIcon } from './StatusIcon';
import { haptic } from './haptics';

type StatusIconProps = ComponentProps<typeof StatusIcon>;

/** Grouped rows in one white 12–20 pt card on the pearl ground, hairlines inset from the label. */
export function ListGroup({ children, label, style, footnote }: { children: ReactNode; label?: string; style?: StyleProp<ViewStyle>; footnote?: string }) {
  useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={style}>
      {label ? (
        <Text variant="caption" tone="muted" weight="semibold" style={{ marginBottom: 8, marginLeft: 4 }}>
          {label}
        </Text>
      ) : null}
      <View style={styles.group}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.hairline} /> : null}
          </View>
        ))}
      </View>
      {footnote ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

/** A state shown on a row: one glyph, its word only for problems (R1), its label always read aloud. */
export type ListRowStatus = Pick<StatusIconProps, 'kind' | 'state' | 'showLabel' | 'viewer' | 'variant'>;

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /**
   * Leading slot. A list uses one style only (§3.1): bare 24-pt glyphs, or 40-pt discs (`IconDisc`).
   * Settings, help and account rows have no leading icon at all.
   */
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: string;
  onPress?: () => void;
  /** Defaults to true for a pressable row that is not a choice. A chevron means « opens another screen ». */
  chevron?: boolean;
  destructive?: boolean;
  testID?: string;
  numericValue?: boolean;
  accessibilityHint?: string;
  /**
   * The row's one state (principle 7): `{ kind, state }` for a `StatusIcon`, or a ready `<StatusIcon … />`.
   * The state's label is appended to the row's accessibilityLabel.
   */
  status?: ListRowStatus | ReactElement;
  /** Where the state glyph sits: trailing (default) or as the leading glyph, replacing `leading`. */
  statusPlacement?: 'leading' | 'trailing';
  /**
   * Makes the row a choice (X-08): a trailing check when selected, no chevron, radio semantics. Pass
   * `false` for the unselected rows of the same list.
   */
  selected?: boolean;
}

function isStatusElement(s: ListRowProps['status']): s is ReactElement {
  return isValidElement(s);
}

/** The screen-reader label of a row's state, from the shared status map. */
function statusLabel(status: ListRowProps['status']): string | undefined {
  if (!status) return undefined;
  const p = (isStatusElement(status) ? status.props : status) as Partial<ListRowStatus>;
  if (!p || !p.kind || p.state == null) return undefined;
  return statusA11y(p.kind, p.state as never, { viewer: p.viewer });
}

export function ListRow({ title, subtitle, leading, trailing, value, onPress, chevron, destructive, testID, numericValue, accessibilityHint, status, statusPlacement = 'trailing', selected }: ListRowProps) {
  useTheme();
  const choice = selected !== undefined;
  const showChevron = chevron ?? (!!onPress && !choice);
  const stateLabel = statusLabel(status);
  const stateNode = status ? (isStatusElement(status) ? status : <StatusIcon {...(status as ListRowStatus)} size="md" />) : null;
  const lead = status && statusPlacement === 'leading' ? stateNode : leading;
  const stateTrailing = status && statusPlacement === 'trailing' ? stateNode : null;
  const check = choice ? (
    <View style={styles.check} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {selected ? <Check size={20} strokeWidth={2.4} color={colors.accent} /> : null}
    </View>
  ) : null;
  const minHeight = subtitle ? 60 : 52;
  const main = (
    <>
      {lead ? <View style={styles.leading}>{lead}</View> : null}
      <View style={{ flex: 1, gap: 2, paddingVertical: 10 }}>
        <Text variant="label" tone={destructive ? 'danger' : 'ink'} weight={selected ? 'semibold' : undefined}>
          {title}
        </Text>
        {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text variant="label" tone="muted" numeric={numericValue} style={{ maxWidth: '45%' }} align="right">
          {value}
        </Text>
      ) : null}
      {/* Inside the pressable area the row is the accessible element, so the glyph is not read twice. */}
      {stateTrailing ? <View importantForAccessibility={onPress ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={!!onPress}>{stateTrailing}</View> : null}
    </>
  );
  const chev = showChevron ? <ChevronRight size={20} color={colors.muted} /> : null;
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, { minHeight }]}>
        {main}
        {trailing}
        {check}
        {chev}
      </View>
    );
  }
  // Trailing controls are siblings of the pressable area, never nested inside it
  // (nested buttons are invalid on the web and confuse screen readers).
  const label = [title, subtitle, value, stateLabel].filter(Boolean).join(', ');
  return (
    <View style={[styles.row, { minHeight, paddingRight: trailing ? 16 : 0 }]}>
      <PressableScale
        testID={testID}
        onPress={() => {
          if (choice) haptic.select();
          onPress();
        }}
        pressedScale={0.985}
        accessibilityRole={choice ? 'radio' : 'button'}
        accessibilityState={choice ? { selected: !!selected, checked: !!selected } : undefined}
        aria-selected={choice ? !!selected : undefined}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={[styles.rowPress, { minHeight, paddingRight: trailing ? 0 : 16 }]}
      >
        {main}
        {/* The check stays with the choice it marks, before any trailing control (« ⋯ »). */}
        {check}
        {trailing ? null : chev}
      </PressableScale>
      {trailing}
      {trailing ? chev : null}
    </View>
  );
}

export type IconDiscTone = 'plain' | 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';
/** Disc sizes (§5.4): 40 row leading, 44 map and media actions, 56 hero status. */
export type IconDiscSize = 40 | 44 | 56;
const snapDisc = (n: number): IconDiscSize => (n <= 42 ? 40 : n <= 50 ? 44 : 56);

/**
 * Tinted disc behind a glyph. Fills follow the status tones (§2.3). Only three sizes exist; any other
 * number (36, 48, 52 from older screens) snaps to the nearest one.
 */
export function IconDisc({ children, tone = 'plain', size = 40, testID }: { children: ReactNode; tone?: IconDiscTone; size?: IconDiscSize | number; testID?: string }) {
  useTheme();
  const bg = { plain: colors.mauveSoft, neutral: colors.mauveSoft, accent: colors.selected, info: colors.infoSoft, success: colors.successSoft, warning: colors.warningSoft, danger: colors.dangerSoft }[tone];
  const d = snapDisc(size);
  return <View testID={testID} style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

export function Card({ children, style, padded = true, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; testID?: string }) {
  useTheme();
  return (
    <View testID={testID} style={[{ backgroundColor: colors.surface, borderRadius: radius.card, padding: padded ? 20 : 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, style]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }, style]} />;
}

const styles = themedStyles(() => StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: -16, paddingLeft: 16 },
  // Bare glyphs are 24 and discs 40: the slot keeps titles aligned down a list of either style.
  leading: { alignItems: 'center', justifyContent: 'center', minWidth: 24 },
  check: { width: 20, alignItems: 'center', justifyContent: 'center' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: 16 },
}));
