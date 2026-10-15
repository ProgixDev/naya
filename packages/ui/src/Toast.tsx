import { getColorScheme, colors } from '@naya/tokens';
import { useTheme } from './core/theme';
import { use, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Text } from './Text';
import { useA11yPrefs } from './a11y';
import { GLYPHS, HIDDEN_GLYPH, toneColor, useIconScale } from './Icon';
import { TONE_GLYPHS } from '@naya/domain';
import { NavigationContext } from 'expo-router/react-navigation';

/**
 * `success` for confirmations (« Carte ajoutée », « Merci pour votre note »), `danger` for failures,
 * `info` / `default` for neutral facts, `warning` when something needs a look. Each draws its tone
 * glyph (16, leading), so the tone is never carried by colour alone (audit §2.6).
 */
export type ToastTone = 'default' | 'info' | 'success' | 'warning' | 'danger';
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

/* ───────────── Anchoring (audit X-06) ───────────── */

/**
 * Where the pill sits: above the screen's pinned footer (its primary button) when one is registered,
 * otherwise just under the status bar. Never mid-screen over the entry it talks about, a total or SOS.
 * - `bottom`: distance from the window's bottom edge to the top of the pinned footer (safe area included).
 * - `top`: distance from the window's top edge below which the pill may sit (a header with a pinned
 *   safety disc, for example).
 * The most recently registered active anchor wins; Modal layers (sheets, dialogs) always use the top.
 */
export type ToastAnchorSpec = { bottom: number; top?: never } | { top: number; bottom?: never };
const useAnchors = create<{ anchors: { id: number; spec: ToastAnchorSpec }[] }>(() => ({ anchors: [] }));
let nextAnchor = 1;

/**
 * Registers an anchor while `spec` is set and `active` is true. Pass the screen's focus as `active`
 * (`useScreenFocus()`), so a screen left mounted under a pushed one does not keep its anchor.
 */
export function useToastAnchor(spec: ToastAnchorSpec | null, active = true) {
  const [id] = useState(() => nextAnchor++);
  const bottom = spec && 'bottom' in spec ? spec.bottom : undefined;
  const top = spec && 'top' in spec ? spec.top : undefined;
  useEffect(() => {
    if (!active || (bottom === undefined && top === undefined)) return;
    const next: ToastAnchorSpec = bottom !== undefined ? { bottom } : { top: top! };
    useAnchors.setState((s) => ({ anchors: [...s.anchors.filter((a) => a.id !== id), { id, spec: next }] }));
    return () => useAnchors.setState((s) => ({ anchors: s.anchors.filter((a) => a.id !== id) }));
  }, [active, bottom, top, id]);
}

const alwaysFocused = () => true;
const noSubscribe = () => () => {};

/**
 * Whether the screen around the caller is focused, without throwing outside a navigator (tests,
 * a tree with no route): there it is always true. Pass it as `active` to `useToastAnchor`.
 */
export function useScreenFocus(): boolean {
  const navigation = use(NavigationContext);
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!navigation) return () => {};
      const offFocus = navigation.addListener('focus', cb);
      const offBlur = navigation.addListener('blur', cb);
      return () => {
        offFocus();
        offBlur();
      };
    },
    [navigation],
  );
  const read = navigation ? navigation.isFocused : alwaysFocused;
  return useSyncExternalStore(navigation ? subscribe : noSubscribe, read, read);
}

/**
 * Wrap a pinned footer (a screen's primary action) in it: the pill then sits just above it.
 * It measures where the footer starts in the window, so it works under any safe area.
 */
export function ToastAnchor({ children, active = true }: { children: ReactNode; active?: boolean }) {
  const ref = useRef<View>(null);
  const { height } = useWindowDimensions();
  const [bottom, setBottom] = useState<number | null>(null);
  useToastAnchor(bottom === null ? null : { bottom }, active);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => ref.current?.measureInWindow?.((_x, y) => (Number.isFinite(y) && y > 0 ? setBottom(Math.max(0, Math.round(height - y))) : undefined))}
    >
      {children}
    </View>
  );
}

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
  const anchor = useAnchors((s) => (base ? s.anchors[s.anchors.length - 1]?.spec : undefined));
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { reduceMotion } = useA11yPrefs();
  const iconScale = useIconScale();
  // Light: a dark ink pill (inverse text). Dark: an inverted ink pill would be the brightest thing
  // on the screen, so the pill is a raised surface with a hairline edge and ink text (DM-15);
  // danger and success keep their meaning through the soft status fills.
  const dark = getColorScheme() === 'dark';
  const pill = dark
    ? { backgroundColor: tone === 'danger' ? colors.dangerSoft : tone === 'success' ? colors.successSoft : colors.elevated, borderWidth: 1, borderColor: colors.hairline }
    : { backgroundColor: tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.ink };
  const statusTone = tone === 'default' ? 'info' : tone;
  const Glyph = GLYPHS[TONE_GLYPHS[statusTone]];
  // Light: the glyph takes the text colour on the solid pill. Dark: the tone colour on the soft fill.
  const glyphColor = dark ? (tone === 'default' ? colors.muted : toneColor(statusTone)) : colors.inverse;
  // X-06: above the registered footer, else under the status bar. A bottom anchor rides above the iOS keyboard.
  const placement =
    anchor && 'bottom' in anchor && anchor.bottom !== undefined
      ? { justifyContent: 'flex-end' as const, paddingBottom: keyboard > 0 ? keyboard + 16 : anchor.bottom + 12 }
      : { justifyContent: 'flex-start' as const, paddingTop: Math.max(insets.top + 8, anchor && 'top' in anchor && anchor.top !== undefined ? anchor.top + 8 : 0) };
  // A Modal's layer exists only while it is on top. The root's live region never unmounts:
  // Android (and the web) announce a change inside a region, not a region that appears together
  // with its text, which is what happens when a sheet closes and a toast is raised in the same tap.
  if (!isTop && !base) return null;
  return (
    <View
      pointerEvents="none"
      aria-live="polite"
      testID="toast-layer"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', paddingHorizontal: 16 }, placement]}
    >
      {isTop && message ? (
        <Animated.View
          key={id}
          testID="toast"
          entering={reduceMotion ? undefined : placement.justifyContent === 'flex-end' ? FadeInDown.duration(180) : FadeInUp.duration(180)}
          exiting={reduceMotion ? undefined : placement.justifyContent === 'flex-end' ? FadeOutDown.duration(160) : FadeOutUp.duration(160)}
          style={[styles.toast, pill]}
        >
          <Glyph testID="toast-glyph" size={Math.round(16 * iconScale)} color={glyphColor} strokeWidth={2} {...HIDDEN_GLYPH} />
          <Text variant="label" weight="semibold" tone={dark ? 'ink' : 'inverse'} style={{ flexShrink: 1 }}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { maxWidth: 340, minHeight: 44, paddingLeft: 14, paddingRight: 18, paddingVertical: 11, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
