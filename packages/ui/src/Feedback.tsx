import { useEffect, useRef, type ReactNode } from 'react';
import { Animated as RNAnimated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, WifiOff, XCircle } from 'lucide-react-native';
import { Image } from 'expo-image';
import { colors, radius } from '@naya/tokens';
import { Text } from './Text';
import { Button } from './Button';
import { useA11yPrefs } from './a11y';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const toneStyle: Record<BannerTone, { bg: string; fg: string; Icon: typeof Info }> = {
  info: { bg: colors.infoSoft, fg: colors.info, Icon: Info },
  success: { bg: colors.successSoft, fg: colors.success, Icon: CheckCircle2 },
  warning: { bg: colors.warningSoft, fg: colors.warning, Icon: AlertTriangle },
  danger: { bg: colors.dangerSoft, fg: colors.danger, Icon: XCircle },
  neutral: { bg: colors.mauveSoft, fg: colors.accent, Icon: Info },
};

export interface StatusBannerProps {
  tone?: BannerTone;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** States are icons plus words; problems always keep a sentence explaining the cause. */
export function StatusBanner({ tone = 'info', title, message, action, icon, style, testID }: StatusBannerProps) {
  const t = toneStyle[tone];
  return (
    // One accessibility element so it is announced as a single alert — unless it holds an
    // action, which must stay separately reachable.
    <View testID={testID} accessible={!action} accessibilityRole="alert" accessibilityLabel={action ? undefined : [title, message].filter(Boolean).join('. ')} style={[styles.banner, { backgroundColor: t.bg }, style]}>
      <View style={{ paddingTop: 1 }}>{icon ?? <t.Icon size={20} color={t.fg} />}</View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label" weight="semibold" style={{ color: tone === 'neutral' ? colors.ink : t.fg }}>
          {title}
        </Text>
        {message ? <Text variant="caption" tone="ink">{message}</Text> : null}
        {action ? <Button label={action.label} onPress={action.onPress} size="compact" variant="secondary" style={{ marginTop: 6 }} /> : null}
      </View>
    </View>
  );
}

export function StatusPill({ tone = 'neutral', label, testID }: { tone?: BannerTone; label: string; testID?: string }) {
  const t = toneStyle[tone];
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: t.bg }]}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text variant="micro" weight="semibold" style={{ color: tone === 'neutral' ? colors.accent : t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
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
  return (
    <View testID={testID} style={styles.empty}>
      {image ? <Image source={image} style={{ width: 220, aspectRatio: imageAspect }} contentFit="contain" accessibilityIgnoresInvertColors /> : null}
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
  return (
    <View testID={testID} style={styles.empty} accessibilityRole="alert">
      <View style={styles.errorDisc}>{offline ? <WifiOff size={26} color={colors.danger} /> : <AlertTriangle size={26} color={colors.danger} />}</View>
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

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.row + 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 16 },
  errorDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
