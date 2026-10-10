import { useTheme, PressableScale, Text } from '@naya/ui';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '@naya/tokens';

/** Uppercase label above one white card of rows separated by full-width hairlines (Compte, Profil). */
export function AccountGroup({ label, footnote, children }: { label: string; footnote?: string; children: ReactNode }) {
  useTheme();
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean) as ReactNode[];
  return (
    <View style={{ gap: 10 }}>
      <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{label}</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: 22, overflow: 'hidden', shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footnote ? <Text tone="muted" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4 }}>{footnote}</Text> : null}
    </View>
  );
}

/** `action` is a separate control (e.g. delete) placed beside the pressable row, never nested in it. */
export function AccountRow({ icon, title, subtitle, onPress, trailing, action, tone = 'plain', testID, selected, titleTone }: { icon: ReactNode; title: string; subtitle?: string; onPress?: () => void; trailing?: ReactNode; action?: ReactNode; tone?: 'plain' | 'warning' | 'success' | 'danger'; testID?: string; selected?: boolean; titleTone?: 'accent' }) {
  useTheme();
  const tile = { plain: colors.mauveSoft, warning: colors.warningSoft, success: colors.successSoft, danger: colors.dangerSoft }[tone];
  const body = (
    <>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" numberOfLines={1} tone={titleTone ?? (tone === 'danger' ? 'danger' : 'ink')} style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text>
        {subtitle ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{subtitle}</Text> : null}
      </View>
      {trailing !== undefined ? trailing : (onPress && !action ? <ChevronRight size={18} color={colors.muted} strokeWidth={2} /> : null)}
    </>
  );
  const style = { minHeight: 76, paddingVertical: 14, paddingLeft: 16, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 14 } as const;
  if (!onPress) {
    const still = <View testID={testID} style={action ? [style, { flex: 1, paddingRight: 8 }] : style} accessible accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}>{body}</View>;
    return action ? <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}>{still}{action}</View> : still;
  }
  const row = (
    <PressableScale testID={testID} onPress={onPress} pressedScale={0.985} accessibilityRole={selected === undefined ? 'button' : 'radio'} accessibilityState={selected === undefined ? undefined : { selected }} accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')} style={action ? [style, { flex: 1, paddingRight: 8 }] : style}>
      {body}
    </PressableScale>
  );
  if (!action) return row;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}>
      {row}
      {action}
    </View>
  );
}
