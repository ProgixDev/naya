import { themedStyles , colors, fonts } from '@naya/tokens';
import { useTheme , Button, FrostLayers, GLYPHS, GlossLayers, Money, PressableScale, StatusIcon, Text, frostOutline, frostShadow, glossShadow, haptic, toneColor, toneFill, type BannerTone } from '@naya/ui';
import { forwardRef, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { TONE_GLYPHS, statusPresentation, type Centimes, type StateOf, type StatusKind, type StatusViewer } from '@naya/domain';

/**
 * Driver-side compositions of design system v2 (Copilot-style tactile pills, Dimension
 * frosted rows, Coinbase amount entry). They only combine shared primitives.
 */

/** Big centred tabular amount (Coinbase / Copilot amount entry). The MAD unit sits beside the figure. */
export const AmountEntry = forwardRef<TextInput, { label: string; value: string; onChangeText: (v: string) => void; error?: string | null; helper?: ReactNode; testID?: string; autoFocus?: boolean }>(function AmountEntry({ label, value, onChangeText, error, helper, testID, autoFocus }, ref) {
  useTheme();
  const size = value.length > 6 ? 40 : 52;
  return (
    <View style={{ alignItems: 'center', gap: 4, paddingVertical: 4 }}>
      <Text variant="caption" tone="muted" nativeID={`${testID}-label`}>
        {label}
      </Text>
      <PressableScale accessible={false} pressedScale={1} onPress={() => (ref && typeof ref === 'object' ? ref.current?.focus() : undefined)} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, minHeight: 68 }}>
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          accessibilityLabel={`${label}, en MAD`}
          accessibilityHint={error ?? undefined}
          placeholder="0"
          placeholderTextColor={colors.muted}
          maxLength={9}
          selectionColor={colors.accent}
          maxFontSizeMultiplier={1.2}
          style={[styles.amount, { fontSize: size, lineHeight: size + 8, color: error ? colors.danger : colors.ink, width: Math.max(1, value.length || 1) * size * 0.62 + 8 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
        <Text variant="title" tone="muted" maxFontSizeMultiplier={1.2}>
          MAD
        </Text>
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="danger" align="center" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="muted" align="center" numeric>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

/** Centred row of frosted quick-amount pills; the selected one turns ink with a check. */
export function QuickPills({ options, selected, onSelect }: { options: { key: string; label: string; testID?: string }[]; selected?: string | null; onSelect: (key: string) => void }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.key === selected;
        return (
          <PressableScale
            key={o.key}
            testID={o.testID}
            onPress={() => {
              haptic.select();
              onSelect(o.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            hitSlop={6}
            style={[styles.quick, on ? { backgroundColor: colors.ink } : [frostShadow, { ...frostOutline }]]}
          >
            {on ? null : <FrostLayers radius={19} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {on ? <Check size={14} color={colors.inverse} /> : null}
              <Text variant="label" weight="semibold" tone={on ? 'inverse' : 'ink'} numeric numberOfLines={1}>
                {o.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Selectable frosted row (provider, payout account). Radio semantics; selection = accent ring + check. */
export function ChoiceRow({ title, subtitle, leading, selected, onPress, testID, trailing }: { title: string; subtitle?: string; leading?: ReactNode; selected?: boolean; onPress: () => void; testID?: string; trailing?: ReactNode }) {
  useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      pressedScale={0.985}
      accessibilityRole="radio"
      accessibilityState={{ checked: !!selected, selected: !!selected }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      style={[styles.choice, frostShadow, selected ? styles.choiceOn : { ...frostOutline }]}
    >
      <FrostLayers radius={22} />
      <View style={styles.choiceRow}>
        {leading}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="label" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="micro" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
        <View style={[styles.radio, selected ? { borderColor: colors.accent, backgroundColor: colors.accent } : null]}>{selected ? <Check size={13} color={colors.inverse} strokeWidth={3} /> : null}</View>
      </View>
    </PressableScale>
  );
}

/**
 * One-line note with an inline frosted action (blocking reasons, resume ride, cash to confirm).
 * Its glyph is the banner's (audit §2.6, A106): info Info, success CircleCheck, warning TriangleAlert,
 * danger CircleX. Never a clock. Pass `kind` and `state` to draw that state's own glyph and tone.
 */
export function ActionNote<K extends StatusKind>({ tone: toneProp, title, message, action, icon, kind, state, viewer, testID }: { tone?: BannerTone; title: string; message?: string; action?: { label: string; onPress: () => void }; icon?: ReactNode; kind?: K; state?: StateOf<K>; viewer?: StatusViewer; testID?: string }) {
  useTheme();
  const p = kind && state !== undefined ? statusPresentation(kind, state, { viewer }) : null;
  const tone = toneProp ?? p?.tone ?? 'info';
  const Glyph = GLYPHS[p?.glyph ?? TONE_GLYPHS[tone]];
  const fg = toneColor(tone);
  return (
    <View testID={testID} accessible={!action} accessibilityRole="alert" accessibilityLabel={action ? undefined : [title, message].filter(Boolean).join('. ')} style={[styles.note, { backgroundColor: toneFill(tone) }]}>
      {icon ?? <Glyph size={20} color={fg} strokeWidth={2} />}
      <View style={{ flex: 1, gap: 1 }} accessible={!!action} accessibilityRole="text" accessibilityLabel={action ? [title, message].filter(Boolean).join('. ') : undefined}>
        <Text variant="caption" weight="semibold" style={{ color: tone === 'neutral' || tone === 'accent' ? colors.ink : fg }} numberOfLines={2}>
          {title}
        </Text>
        {message ? (
          <Text variant="caption" tone="ink" numberOfLines={3}>
            {message}
          </Text>
        ) : null}
      </View>
      {action ? <Button label={action.label} variant="secondary" size="compact" onPress={action.onPress} /> : null}
    </View>
  );
}

/**
 * Centred status hero for operation receipts (recharge, withdrawal, ride end). The state is the
 * transfer glyph in a 56 disc (audit C4, A119): Hourglass pending, CircleCheck confirmed, CircleX
 * failed. The kicker carries the words, so the glyph stays silent for screen readers.
 */
export function OperationHero({ state, amount, kicker, caption, sign, testID }: { state: 'pending' | 'confirmed' | 'failed' | 'neutral'; amount: Centimes; kicker: string; caption?: string; sign?: 'auto' | 'always'; testID?: string }) {
  useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }} testID={testID}>
      {state === 'neutral' ? null : <StatusIcon kind="transfer" state={state} size="lg" variant="disc" showLabel={false} accessible={false} testID={testID ? `${testID}-status` : undefined} />}
      <Text variant="caption" tone="muted" align="center">
        {kicker}
      </Text>
      <Money amount={amount} variant="display" sign={sign} />
      {caption ? (
        <Text variant="caption" tone="muted" align="center" numeric>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Compact figure tile used in two-up rows (earnings, dashboard). */
export function StatTile({ label, children, foot, onPress, testID, accessibilityLabel, style }: { label: string; children: ReactNode; foot?: string; onPress?: () => void; testID?: string; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  useTheme();
  const body = (
    <>
      <Text variant="micro" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      {children}
      {foot ? (
        <Text variant="micro" tone="muted" numberOfLines={1}>
          {foot}
        </Text>
      ) : null}
    </>
  );
  return onPress ? (
    <PressableScale onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.tile, style]} testID={testID}>
      {body}
    </PressableScale>
  ) : (
    <View style={[styles.tile, style]} testID={testID} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
      {body}
    </View>
  );
}

/** Label + value line for compact summaries inside a card. */
export function FigureLine({ label, value, sub, testID, strong }: { label: string; value: string; sub?: string; testID?: string; strong?: boolean }) {
  useTheme();
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label} ${value}`} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text variant="label" weight={strong ? 'semibold' : 'medium'}>
          {label}
        </Text>
        {sub ? (
          <Text variant="micro" tone="muted">
            {sub}
          </Text>
        ) : null}
      </View>
      <Text variant="label" weight="semibold" numeric>
        {value}
      </Text>
    </View>
  );
}

/**
 * Wallet action pill: icon over label, 64 pt. 'primary' = the screen's single glossy action;
 * 'secondary' = frosted. Disabled turns neutral grey.
 */
export function ActionPill({ label, icon, variant = 'secondary', onPress, disabled, accessibilityHint, testID }: { label: string; icon: (color: string) => ReactNode; variant?: 'primary' | 'secondary'; onPress: () => void; disabled?: boolean; accessibilityHint?: string; testID?: string }) {
  useTheme();
  const gloss = variant === 'primary' && !disabled;
  const color = disabled ? colors.disabledText : gloss ? colors.inverse : colors.accent;
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        if (disabled) return;
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.action, disabled ? { backgroundColor: colors.disabledFill } : gloss ? glossShadow('accent') : [frostShadow, { ...frostOutline }]]}
    >
      {disabled ? null : gloss ? <GlossLayers tone="accent" radius={22} /> : <FrostLayers radius={22} />}
      <View style={{ alignItems: 'center', gap: 4 }}>
        {icon(color)}
        <Text variant="caption" weight="semibold" style={{ color }} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  action: { flex: 1, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: fonts.semibold, letterSpacing: -1.2, textAlign: 'right', padding: 0, minWidth: 36, fontVariant: ['tabular-nums'] },
  quick: { height: 38, minWidth: 72, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  choice: { borderRadius: 22, minHeight: 60 },
  choiceOn: { borderWidth: 1.5, borderColor: colors.accent },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, minHeight: 48 },
  tile: { flex: 1, backgroundColor: colors.background, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 4 },
}));
