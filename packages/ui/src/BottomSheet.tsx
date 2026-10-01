import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { X } from 'lucide-react-native';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { motionTiming } from './motion';
import { Text } from './Text';
import { Button, IconButton, TextButton } from './Button';
import { useA11yPrefs } from './a11y';

/* ───────────── Modal sheet for focused tasks (rises from the bottom, swipe down to close) ───────────── */

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Prevent closing by swipe or scrim while a request is in flight. */
  dismissible?: boolean;
  testID?: string;
}

export function Sheet({ visible, onClose, title, subtitle, children, footer, dismissible = true, testID }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { reduceMotion } = useA11yPrefs();
  const y = useSharedValue(height);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = height;
      y.value = reduceMotion ? 0 : withTiming(0, motionTiming.sheetOpen);
    } else if (mounted) {
      y.value = reduceMotion ? height : withTiming(height, motionTiming.sheetClose, (done) => done && runOnJS(setMounted)(false));
      if (reduceMotion) setMounted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion]);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY(8)
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(onClose)();
      else y.value = reduceMotion ? 0 : withTiming(0, motionTiming.sheetSettle);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, height], [1, 0], Extrapolation.CLAMP) }));

  if (!mounted) return null;
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => dismissible && onClose()}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissible && onClose()} accessibilityRole="button" accessibilityLabel="Fermer" />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View testID={testID} accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 4, maxHeight: height - insets.top - 24 }, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={{ paddingTop: 8, paddingBottom: 4 }}>
              <View style={styles.grabber} />
              {title ? (
                <View style={styles.titleRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="heading" accessibilityRole="header">
                      {title}
                    </Text>
                    {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
                  </View>
                  {dismissible ? <IconButton icon={<X size={20} color={colors.ink} />} accessibilityLabel="Fermer" variant="tonal" size={36} onPress={onClose} /> : null}
                </View>
              ) : null}
            </View>
          </GestureDetector>
          <View style={{ paddingHorizontal: gutter, flexShrink: 1 }}>{children}</View>
          {footer ? <View style={{ paddingHorizontal: gutter, paddingTop: 16, gap: 8 }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ───────────── Persistent sheet over the map with snap points ───────────── */

export interface MapSheetProps {
  children: ReactNode;
  /** Visible heights in points, smallest first (peek, half, full). */
  snaps?: number[];
  initial?: number;
  onSnap?: (index: number) => void;
  testID?: string;
}

export function MapSheet({ children, snaps, initial = 0, onSnap, testID }: MapSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const [contentHeight, setContentHeight] = useState(0);
  const points = useMemo(() => {
    const max = height - insets.top - 72;
    const base = snaps ?? [Math.min(contentHeight || 360, max)];
    return base.map((p) => Math.min(p, max));
  }, [snaps, contentHeight, height, insets.top]);
  const maxH = points[points.length - 1]!;
  const offset = useSharedValue(maxH - points[Math.min(initial, points.length - 1)]!);
  const start = useSharedValue(0);

  useEffect(() => {
    const target = maxH - points[Math.min(initial, points.length - 1)]!;
    offset.value = reduceMotion ? target : withTiming(target, motionTiming.sheetSettle);
  }, [maxH, points, initial, offset, reduceMotion]);

  const snapTo = (i: number) => onSnap?.(i);
  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onBegin(() => {
      start.value = offset.value;
    })
    .onUpdate((e) => {
      offset.value = Math.min(maxH - points[0]!, Math.max(0, start.value + e.translationY));
    })
    .onEnd((e) => {
      const projected = offset.value + e.velocityY * 0.12;
      let best = 0;
      let dist = Number.MAX_VALUE;
      points.forEach((p, i) => {
        const d = Math.abs(maxH - p - projected);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      offset.value = reduceMotion ? maxH - points[best]! : withTiming(maxH - points[best]!, motionTiming.sheetSettle);
      runOnJS(snapTo)(best);
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return (
    <Animated.View testID={testID} style={[styles.mapSheet, { height: maxH + insets.bottom, paddingBottom: insets.bottom }, style]}>
      <GestureDetector gesture={pan}>
        <View accessibilityRole="adjustable" accessibilityLabel="Panneau du trajet" accessibilityHint="Faites glisser pour agrandir ou réduire" style={{ paddingTop: 10, paddingBottom: 6 }}>
          <View style={styles.grabber} />
        </View>
      </GestureDetector>
      <View onLayout={(e: LayoutChangeEvent) => !snaps && setContentHeight(e.nativeEvent.layout.height + 28)} style={{ paddingHorizontal: gutter }}>
        {children}
      </View>
    </Animated.View>
  );
}

/* ───────────── Centred confirmation dialog ───────────── */

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function ConfirmDialog({ visible, title, message, children, confirmLabel, cancelLabel = 'Annuler', destructive, loading, onConfirm, onCancel, testID }: ConfirmDialogProps) {
  const { reduceMotion } = useA11yPrefs();
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'fade'} statusBarTranslucent onRequestClose={() => !loading && onCancel()}>
      <View style={styles.center}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={() => !loading && onCancel()} accessibilityLabel={cancelLabel} />
        <View testID={testID} accessibilityViewIsModal style={styles.dialog}>
          <Text variant="heading" align="center" accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <Text variant="label" tone="muted" align="center" style={{ marginTop: 8 }}>
              {message}
            </Text>
          ) : null}
          {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}
          <View style={{ marginTop: 20, gap: 4 }}>
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} full loading={loading} onPress={onConfirm} testID={testID ? `${testID}-confirm` : undefined} />
            <TextButton label={cancelLabel} onPress={() => !loading && onCancel()} tone="muted" testID={testID ? `${testID}-cancel` : undefined} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, ...shadow.float },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 12, gap: 12 },
  mapSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, ...shadow.float },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: 24, padding: 22 },
});
