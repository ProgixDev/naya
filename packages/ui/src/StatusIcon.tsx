import { colors } from '@naya/tokens';
import { statusPresentation, type StateOf, type StatusGlyph, type StatusKind, type StatusMotion, type StatusTone, type StatusViewer } from '@naya/domain';
import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './core/theme';
import { useA11yPrefs } from './a11y';
import { GLYPHS, HIDDEN_GLYPH, toneColor, toneFill, useIconScale } from './Icon';
import { Text } from './Text';

/**
 * A state drawn as its glyph (redesign audit 2026-10-15 §2.6, owner decision R1):
 *
 *   <StatusIcon kind="ride" state={ride.status} size="sm" />                // 16 glyph, inline in text
 *   <StatusIcon kind="document" state={doc.status} />                       // 20 glyph, row trailing or leading
 *   <StatusIcon kind="verification" state={s} size="lg" variant="disc" />   // 56 disc with a 28 glyph, screen hero
 *   <StatusIcon kind="payment" state={p.status} badgeOn={<Icon icon={paymentMethodIcon(m)} />} />
 *   <StatusIcon kind="support" state={t.status} showLabel />                // glyph + word chip, 28 tall
 *
 * - `showLabel` 'auto' (default): the word shows for problem states only; true forces it (heroes,
 *   first sight); false forces the glyph alone.
 * - The full sentence is always the accessibilityLabel. With a visible word the glyph is hidden,
 *   so the state is never read twice. Inside a pressable row pass `accessible={false}` and compose
 *   the row's label with `statusA11y(kind, state)`.
 * - Motion (searching, online, washing, loading) runs on the native driver and stops under Reduce Motion.
 */
export type StatusIconSize = 'sm' | 'md' | 'lg';

export interface StatusIconProps<K extends StatusKind> {
  kind: K;
  state: StateOf<K>;
  size?: StatusIconSize;
  variant?: 'bare' | 'disc';
  showLabel?: 'auto' | boolean;
  /** The visible word: the chip word (default) or the full sentence (a hero line). */
  wording?: 'short' | 'full';
  /** Only the Famille approval reads differently for the chauffeuse. */
  viewer?: StatusViewer;
  /** A method glyph (payment) that carries the state as a 12-pt badge at its bottom-right. */
  badgeOn?: ReactNode;
  /** False inside a row that is itself the accessible element. */
  accessible?: boolean;
  /** Announce a change of state to screen readers (ride status, approval, payment). */
  announce?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const GLYPH_PX: Record<StatusIconSize, number> = { sm: 16, md: 20, lg: 28 };

export function StatusIcon<K extends StatusKind>({
  kind,
  state,
  size = 'md',
  variant = 'bare',
  showLabel = 'auto',
  wording = 'short',
  viewer,
  badgeOn,
  accessible = true,
  announce = false,
  testID,
  style,
}: StatusIconProps<K>) {
  useTheme();
  const p = statusPresentation(kind, state, { viewer });
  const visible = showLabel === true || (showLabel === 'auto' && p.problem);
  const word = wording === 'full' ? p.label : p.shortLabel;
  useAnnounce(announce, p.label, `${kind}:${String(state)}`);

  const a11y = accessible
    ? { accessible: true, accessibilityRole: visible ? ('text' as const) : ('image' as const), accessibilityLabel: p.label, accessibilityLiveRegion: announce ? ('polite' as const) : undefined }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  if (badgeOn) {
    return (
      <View testID={testID} {...a11y} style={[styles.row, style]}>
        <View>
          {badgeOn}
          <View style={[styles.badge, { backgroundColor: colors.surface }]} testID={testID ? `${testID}-badge` : undefined}>
            <StatusGlyphView glyph={p.glyph} tone={p.tone} px={12} motion={undefined} />
          </View>
        </View>
        {visible ? <Word tone={p.tone} text={word} /> : null}
      </View>
    );
  }

  if (variant === 'disc') {
    const disc = size === 'lg' ? 56 : 40;
    const px = size === 'lg' ? 28 : 20;
    return (
      <View testID={testID} {...a11y} style={[styles.hero, style]}>
        <View style={{ width: disc, height: disc, borderRadius: disc / 2, backgroundColor: toneFill(p.tone), alignItems: 'center', justifyContent: 'center' }}>
          <StatusGlyphView glyph={p.glyph} tone={p.tone} px={px} motion={p.motion} ring={disc} testID={testID ? `${testID}-glyph` : undefined} />
        </View>
        {visible ? <Word tone={p.tone} text={word} variant={size === 'lg' ? 'label' : 'caption'} /> : null}
      </View>
    );
  }

  if (visible) {
    return <StatusChip glyph={p.glyph} tone={p.tone} text={word} motion={p.motion} a11y={a11y} testID={testID} style={style} />;
  }
  return (
    <View testID={testID} {...a11y} style={style}>
      <ScaledGlyph glyph={p.glyph} tone={p.tone} px={GLYPH_PX[size]} motion={p.motion} testID={testID ? `${testID}-glyph` : undefined} />
    </View>
  );
}

type A11yProps = Record<string, unknown>;

/** Glyph + word on the tone's soft fill, 28 tall, caption type (the word carries meaning: never micro). */
export function StatusChip({ glyph, tone, text, motion, a11y, testID, style }: { glyph: StatusGlyph; tone: StatusTone; text: string; motion?: StatusMotion; a11y?: A11yProps; testID?: string; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View testID={testID} {...(a11y ?? {})} style={[styles.chip, { backgroundColor: toneFill(tone) }, style]}>
      <ScaledGlyph glyph={glyph} tone={tone} px={16} motion={motion} testID={testID ? `${testID}-glyph` : undefined} />
      <Word tone={tone} text={text} />
    </View>
  );
}

function Word({ tone, text, variant = 'caption' }: { tone: StatusTone; text: string; variant?: 'caption' | 'label' }) {
  useTheme();
  // Neutral words are ink: muted text on the mauve fill would fall under 4.5:1.
  return (
    <Text variant={variant} weight="semibold" numberOfLines={1} style={{ color: tone === 'neutral' ? colors.ink : toneColor(tone), flexShrink: 1 }}>
      {text}
    </Text>
  );
}

function ScaledGlyph(props: { glyph: StatusGlyph; tone: StatusTone; px: number; motion?: StatusMotion; testID?: string }) {
  const factor = useIconScale();
  return <StatusGlyphView {...props} px={Math.round(props.px * factor)} />;
}

const PERIOD: Record<StatusMotion, number> = { pulse: 1600, 'pulse-slow': 2400, breathe: 1200, spin: 900 };

/** The glyph and its motion. Every animation uses the native driver and stops under Reduce Motion. */
function StatusGlyphView({ glyph, tone, px, motion, ring, testID }: { glyph: StatusGlyph; tone: StatusTone; px: number; motion?: StatusMotion; ring?: number; testID?: string }) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  const t = useRef(new Animated.Value(0)).current;
  const moving = !!motion && !reduceMotion;
  useEffect(() => {
    t.setValue(0);
    if (!motion || reduceMotion) return;
    const period = PERIOD[motion];
    const anim =
      motion === 'breathe'
        ? Animated.loop(
            Animated.sequence([
              Animated.timing(t, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              Animated.timing(t, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
          )
        : Animated.loop(Animated.timing(t, { toValue: 1, duration: period, easing: motion === 'spin' ? Easing.linear : Easing.out(Easing.quad), useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [motion, reduceMotion, t]);

  const Glyph = GLYPHS[glyph];
  const fg = toneColor(tone);
  const drawn = <Glyph size={px} color={fg} strokeWidth={2} {...HIDDEN_GLYPH} />;
  if (!moving) return <View testID={testID}>{drawn}</View>;
  if (motion === 'spin') {
    const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
      <Animated.View testID={testID} style={{ transform: [{ rotate }] }}>
        {drawn}
      </Animated.View>
    );
  }
  if (motion === 'breathe') {
    const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });
    return (
      <Animated.View testID={testID} style={{ opacity }}>
        {drawn}
      </Animated.View>
    );
  }
  // pulse / pulse-slow: a ring around the glyph grows and fades.
  const box = ring ?? px + 8;
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View testID={testID} style={{ width: px, height: px, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', width: box, height: box, borderRadius: box / 2, borderWidth: 2, borderColor: fg, opacity, transform: [{ scale }] }}
      />
      {drawn}
    </View>
  );
}

/** Announces a new state once it changes (not on mount). iOS reads it; Android uses the live region. */
function useAnnounce(enabled: boolean, label: string, key: string) {
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (enabled && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(label);
  }, [enabled, key, label]);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { alignItems: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, minHeight: 28, paddingVertical: 4, borderRadius: 999, maxWidth: '100%' },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
