import { themedStyles , colors, radius } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated as RNAnimated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TriangleAlert, WifiOff } from 'lucide-react-native';
import { TONE_GLYPHS, statusPresentation, type StateOf, type StatusGlyph, type StatusKind, type StatusTone, type StatusViewer } from '@naya/domain';
import { Illustration } from './Brand';
import { Text } from './Text';
import { Button } from './Button';
import { useA11yPrefs } from './a11y';
import { GLYPHS, toneColor, toneFill } from './Icon';
import { StatusChip, StatusIcon } from './StatusIcon';

/** The status tones (audit §2.3). `accent` = live, `info` = waiting on someone else, `neutral` = ended with no fault. */
export type BannerTone = StatusTone;

/** Problems keep a title plus a sentence; every other banner is one line with a glyph (audit A1). */
const isProblem = (tone: BannerTone) => tone === 'warning' || tone === 'danger';

export interface StatusBannerProps<K extends StatusKind = StatusKind> {
  tone?: BannerTone;
  /** Compact one-line pill for reassurance notes ("Examen humain · données chiffrées"). */
  compact?: boolean;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  /** A custom leading icon. Without it the glyph comes from `kind`/`state`, else from the tone. */
  icon?: ReactNode;
  /** Draw the state's own glyph (and take its tone unless `tone` is set). */
  kind?: K;
  state?: StateOf<K>;
  viewer?: StatusViewer;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function bannerGlyph<K extends StatusKind>(tone: BannerTone | undefined, kind: K | undefined, state: StateOf<K> | undefined, viewer?: StatusViewer): { tone: BannerTone; glyph: StatusGlyph } {
  if (kind && state !== undefined) {
    const p = statusPresentation(kind, state, { viewer });
    return { tone: tone ?? p.tone, glyph: p.glyph };
  }
  const t = tone ?? 'info';
  return { tone: t, glyph: TONE_GLYPHS[t] };
}

/**
 * States are glyphs; problems always keep their words and a sentence explaining the cause.
 * Success and info banners are one line (glyph, title, message); warning and danger keep a title
 * over the sentence. Banners are for problems, and for facts the screen shows nowhere else.
 */
export function StatusBanner<K extends StatusKind>({ tone: toneProp, title, message, action, icon, kind, state, viewer, style, testID, compact }: StatusBannerProps<K>) {
  useTheme();
  const { tone, glyph } = bannerGlyph(toneProp, kind, state, viewer);
  const fg = toneColor(tone);
  const Glyph = GLYPHS[glyph];
  const titleColor = tone === 'neutral' || tone === 'accent' ? colors.ink : fg;
  if (compact) {
    return (
      <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={[title, message].filter(Boolean).join('. ')} style={[styles.note, { backgroundColor: toneFill(tone) }, style]}>
        {icon ?? <Glyph size={16} color={fg} strokeWidth={2} />}
        <Text variant="caption" weight="medium" style={{ flex: 1, color: titleColor }} numberOfLines={2}>
          {title}
          {message ? <Text variant="caption" tone="muted">{` · ${message}`}</Text> : null}
        </Text>
      </View>
    );
  }
  if (!isProblem(tone)) {
    return (
      <View testID={testID} accessible={!action} accessibilityRole="alert" accessibilityLabel={action ? undefined : [title, message].filter(Boolean).join('. ')} style={[styles.line, { backgroundColor: toneFill(tone) }, style]}>
        <View style={{ paddingTop: 1 }}>{icon ?? <Glyph size={20} color={fg} strokeWidth={2} />}</View>
        <View style={{ flex: 1, gap: action ? 8 : 0 }}>
          <Text variant="caption" style={{ color: colors.ink }}>
            <Text variant="caption" weight="semibold" style={{ color: titleColor }}>
              {title}
            </Text>
            {message ? <Text variant="caption" tone="muted">{' · '}</Text> : null}
            {message ? <Text variant="caption" tone="ink">{message}</Text> : null}
          </Text>
          {action ? <Button label={action.label} onPress={action.onPress} size="compact" variant="secondary" style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      </View>
    );
  }
  return (
    // One accessibility element so it is announced as a single alert — unless it holds an
    // action, which must stay separately reachable.
    <View testID={testID} accessible={!action} accessibilityRole="alert" accessibilityLabel={action ? undefined : [title, message].filter(Boolean).join('. ')} style={[styles.banner, { backgroundColor: toneFill(tone) }, style]}>
      <View style={{ paddingTop: 1 }}>{icon ?? <Glyph size={20} color={fg} strokeWidth={2} />}</View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" weight="semibold" style={{ color: titleColor }}>
          {title}
        </Text>
        {message ? <Text variant="caption" tone="ink">{message}</Text> : null}
        {action ? <Button label={action.label} onPress={action.onPress} size="compact" variant="secondary" style={{ marginTop: 6 }} /> : null}
      </View>
    </View>
  );
}

/** Tone-only pill (the original API): the tone's glyph replaces the dot. */
export interface ToneStatusPillProps {
  tone?: BannerTone;
  label: string;
  /** A glyph for this word when the tone's default would be ambiguous. */
  glyph?: StatusGlyph;
  testID?: string;
}
/** A state's own pill: its glyph, tone and short word from statusPresentation. */
export interface KindStatusPillProps<K extends StatusKind> {
  kind: K;
  state: StateOf<K>;
  /** Overrides the short word; the full sentence stays the accessibilityLabel. */
  label?: string;
  viewer?: StatusViewer;
  testID?: string;
}

/**
 * Glyph + word chip, 28 tall. Prefer `<StatusIcon kind state />`: in rows and lists a state is its
 * glyph alone (R1); the visible word is for heroes, first sight and problems.
 * @deprecated Wrapper kept so screens compile until they migrate to StatusIcon (audit §2.6).
 */
export function StatusPill<K extends StatusKind>(props: ToneStatusPillProps | KindStatusPillProps<K>) {
  useTheme();
  if ('kind' in props) {
    const { kind, state, label, viewer, testID } = props;
    if (label === undefined) return <StatusIcon kind={kind} state={state} viewer={viewer} showLabel testID={testID} />;
    const p = statusPresentation(kind, state, { viewer });
    return <StatusChip glyph={p.glyph} tone={p.tone} text={label} a11y={{ accessible: true, accessibilityRole: 'text', accessibilityLabel: p.label }} testID={testID} />;
  }
  const { tone = 'neutral', label, glyph, testID } = props;
  return <StatusChip glyph={glyph ?? TONE_GLYPHS[tone]} tone={tone} text={label} testID={testID} />;
}

export interface EmptyStateProps {
  title: string;
  message?: string;
  image?: number;
  imageAspect?: number;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

/** One sentence and one move. */
export function EmptyState({ title, message, image, imageAspect = 4 / 3, action, testID }: EmptyStateProps) {
  useTheme();
  return (
    <View testID={testID} style={styles.empty}>
      {image ? <Illustration source={image} width={220} aspect={imageAspect} /> : null}
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="label" tone="muted" align="center" style={{ maxWidth: 300 }}>
          {message}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" style={{ marginTop: 8, alignItems: 'center', alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Impossible de charger', message, onRetry, offline, testID }: { title?: string; message?: string; onRetry?: () => void; offline?: boolean; testID?: string }) {
  useTheme();
  return (
    <View testID={testID} style={styles.empty} accessibilityRole="alert">
      <View style={styles.errorDisc}>{offline ? <WifiOff size={26} color={colors.danger} strokeWidth={2} /> : <TriangleAlert size={26} color={colors.danger} strokeWidth={2} />}</View>
      <Text variant="heading" align="center">
        {offline ? 'Vous êtes hors ligne' : title}
      </Text>
      <Text variant="label" tone="muted" align="center" style={{ maxWidth: 300 }}>
        {offline ? 'Les informations se mettront à jour dès le retour du réseau.' : (message ?? 'Vérifiez votre connexion puis réessayez.')}
      </Text>
      {onRetry ? <Button label="Réessayer" onPress={onRetry} variant="secondary" style={{ marginTop: 8, alignItems: 'center', alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

/** Grey blocks shaped like the final layout. Pulses gently unless Reduce Motion is on. */
export function Skeleton({ width = '100%', height = 16, radius: r = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  const opacity = useRef(new RNAnimated.Value(0.55)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return <RNAnimated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: r, backgroundColor: colors.selected, opacity }, style]} />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  useTheme();
  return (
    <View accessibilityLabel="Chargement" accessibilityRole="progressbar" style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.row, padding: 14 }}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={56} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.row },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.row },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, alignSelf: 'stretch' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 16 },
  errorDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
}));
