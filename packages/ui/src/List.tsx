import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radius } from '@naya/tokens';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

/** Grouped rows in one white 12–20 pt card on the pearl ground, hairlines inset from the label. */
export function ListGroup({ children, label, style, footnote }: { children: ReactNode; label?: string; style?: StyleProp<ViewStyle>; footnote?: string }) {
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

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  testID?: string;
  numericValue?: boolean;
  accessibilityHint?: string;
}

export function ListRow({ title, subtitle, leading, trailing, value, onPress, chevron = !!onPress, destructive, testID, numericValue, accessibilityHint }: ListRowProps) {
  const body = (
    <View style={[styles.row, { minHeight: subtitle ? 60 : 52 }]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2, paddingVertical: 10 }}>
        <Text variant="label" tone={destructive ? 'danger' : 'ink'}>
          {title}
        </Text>
        {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text variant="label" tone="muted" numeric={numericValue} style={{ maxWidth: '45%' }} align="right">
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <ChevronRight size={20} color={colors.muted} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <PressableScale testID={testID} onPress={onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')} accessibilityHint={accessibilityHint}>
      {body}
    </PressableScale>
  );
}

export function IconDisc({ children, tone = 'plain', size = 40 }: { children: ReactNode; tone?: 'plain' | 'accent' | 'success' | 'warning' | 'danger'; size?: number }) {
  const bg = { plain: colors.mauveSoft, accent: colors.selected, success: colors.successSoft, warning: colors.warningSoft, danger: colors.dangerSoft }[tone];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

export function Card({ children, style, padded = true, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={[{ backgroundColor: colors.surface, borderRadius: radius.card, padding: padded ? 16 : 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, style]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }, style]} />;
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  leading: { alignItems: 'center', justifyContent: 'center' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 16 },
});
