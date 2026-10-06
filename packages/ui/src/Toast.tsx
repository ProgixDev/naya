import { themedStyles , colors } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Text } from './Text';
import { useA11yPrefs } from './a11y';

type ToastTone = 'default' | 'success' | 'danger';
interface ToastState {
  message: string | null;
  tone: ToastTone;
  id: number;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

/** Presentation state only: which confirmation pill is visible. */
export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'default',
  id: 0,
  show: (message, tone = 'default') => set((s) => ({ message, tone, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

export const toast = (message: string, tone?: ToastTone) => useToast.getState().show(message, tone);

/** Pill toasts never need dismissing; they announce themselves to screen readers. */
export function ToastHost() {
  useTheme();
  const { message, tone, id, hide } = useToast();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, [id, message, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + 90 }]}>
      <Animated.View key={id} entering={reduceMotion ? undefined : FadeInDown.duration(180)} exiting={reduceMotion ? undefined : FadeOutDown.duration(160)} accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.toast, tone === 'danger' && { backgroundColor: colors.danger }, tone === 'success' && { backgroundColor: colors.success }]}>
        <Text variant="label" weight="semibold" tone="inverse" align="center">
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  toast: { maxWidth: 340, minHeight: 44, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.ink, justifyContent: 'center' },
}));
