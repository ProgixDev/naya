import { themedStyles , colors } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, StyleSheet, View } from 'react-native';
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

/** How long a pill stays on screen. Screen readers get the text through an announcement, not the pill. */
export const TOAST_DURATION_MS = 3200;

let hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * VoiceOver ignores a view that merely appears, so iOS gets an explicit announcement, queued
 * behind whatever it is reading (usually the button that was just pressed). Android and the web
 * read the live region around the pill instead (see ToastLayer), so they are not announced twice.
 */
function announce(message: string) {
  if (Platform.OS !== 'ios') return;
  try {
    AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
  } catch {
    AccessibilityInfo.announceForAccessibility(message);
  }
}

/** Presentation state only: which confirmation pill is visible. */
export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'default',
  id: 0,
  show: (message, tone = 'default') => {
    if (hideTimer) clearTimeout(hideTimer);
    // One timer for the whole app: the pill keeps its schedule when it moves between layers.
    hideTimer = setTimeout(() => {
      hideTimer = null;
      set({ message: null });
    }, TOAST_DURATION_MS);
    set((s) => ({ message, tone, id: s.id + 1 }));
    announce(message);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ message: null });
  },
}));

export const toast = (message: string, tone?: ToastTone) => useToast.getState().show(message, tone);

/* ───────────── Layers: the pill renders in the topmost one only ───────────── */

/**
 * A native Modal (sheet, dialog) is its own window and covers anything in the root tree, so a
 * toast raised from inside it would be hidden. Every Modal mounts a ToastLayer; the most recently
 * activated layer draws the pill and the others do not (the root keeps only its empty live region),
 * so it is never shown twice.
 */
const useLayers = create<{ stack: number[] }>(() => ({ stack: [] }));
let nextLayer = 1;

function useTopLayer(active: boolean, base: boolean) {
  const [layer] = useState(() => nextLayer++);
  useEffect(() => {
    if (!active) return;
    // The root host stays at the bottom even when it mounts after a sheet that opens on first render.
    useLayers.setState((s) => {
      const rest = s.stack.filter((l) => l !== layer);
      return { stack: base ? [layer, ...rest] : [...rest, layer] };
    });
    return () => useLayers.setState((s) => ({ stack: s.stack.filter((l) => l !== layer) }));
  }, [active, base, layer]);
  return useLayers((s) => active && s.stack[s.stack.length - 1] === layer);
}

export interface ToastLayerProps {
  /** Whether the Modal around this layer is open. A closing Modal hands the pill back at once. */
  active?: boolean;
}

/** Mount as the last child of a Modal so toasts raised while it is open show above it. */
export function ToastLayer({ active = true }: ToastLayerProps) {
  return <Layer active={active} base={false} />;
}

/** Root layer, mounted once at the top of the app. Pill toasts never need dismissing. */
export function ToastHost() {
  return <Layer active base />;
}

/**
 * iOS never resizes the window for the keyboard, so a pill anchored to the bottom would sit behind
 * it, which is exactly when a sheet with a text field raises an error. Android and the web resize
 * (or inset) the window themselves.
 */
function useKeyboardHeight() {
  const [height, setHeight] = useState(() => (Platform.OS === 'ios' ? Keyboard.metrics()?.height ?? 0 : 0));
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const subs = [
      Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height)),
      Keyboard.addListener('keyboardWillHide', () => setHeight(0)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, []);
  return height;
}

function Layer({ active, base }: { active: boolean; base: boolean }) {
  useTheme();
  const isTop = useTopLayer(active, base);
  const message = useToast((s) => s.message);
  const tone = useToast((s) => s.tone);
  const id = useToast((s) => s.id);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { reduceMotion } = useA11yPrefs();
  // A Modal's layer exists only while it is on top. The root's live region never unmounts:
  // Android (and the web) announce a change inside a region, not a region that appears together
  // with its text, which is what happens when a sheet closes and a toast is raised in the same tap.
  if (!isTop && !base) return null;
  return (
    <View
      pointerEvents="none"
      aria-live="polite"
      testID="toast-layer"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, paddingBottom: keyboard > 0 ? keyboard + 16 : insets.bottom + 90 }]}
    >
      {isTop && message ? (
        <Animated.View
          key={id}
          testID="toast"
          entering={reduceMotion ? undefined : FadeInDown.duration(180)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(160)}
          style={[styles.toast, tone === 'danger' && { backgroundColor: colors.danger }, tone === 'success' && { backgroundColor: colors.success }]}
        >
          <Text variant="label" weight="semibold" tone="inverse" align="center">
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  toast: { maxWidth: 340, minHeight: 44, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.ink, justifyContent: 'center' },
}));
