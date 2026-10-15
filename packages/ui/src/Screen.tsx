import { getColorScheme , themedStyles , colors, gutter } from '@naya/tokens';
import { useTheme } from './core/theme';
import { cloneElement, isValidElement, useCallback, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { SectionTitle } from './Text';
import { Header, HeaderLargeTitle, headerBarEstimate, type HeaderProps } from './Header';
import { ToastAnchor, useScreenFocus } from './Toast';

/** Height of the floating capsule tab bar in both apps (its content row). */
export const TAB_BAR_HEIGHT = 60;

/** Distance from the bottom of the screen to the top of the floating tab bar. */
export function useTabBarTop() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + TAB_BAR_HEIGHT;
}

/**
 * Bottom content inset for a tab screen: the bar's top edge plus 16 (X-04). It grows a little with
 * Dynamic Type so a large last row still clears the bar. `Screen tabBar` applies it by itself.
 */
export function useTabBarInset() {
  const top = useTabBarTop();
  const { fontScale } = useWindowDimensions();
  return top + 16 + Math.round(16 * Math.max(0, Math.min(fontScale, 1.6) - 1));
}

export interface ScreenProps {
  children: ReactNode;
  /**
   * A `<Header title … />` with a large title (the default) collapses: the large title scrolls with
   * the content and a centred 17/600 title with a backdrop takes its place once it has scrolled under
   * the bar (X-05). Any other node is rendered as is, above the content.
   */
  header?: ReactNode;
  /** Pinned bottom area for the screen's one primary action; stays above the keyboard. */
  footer?: ReactNode;
  scroll?: boolean;
  /** Forms: scroll the focused field into view above the keyboard. */
  keyboard?: boolean;
  padded?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  statusBar?: 'dark' | 'light';
  /** Tab screen: the last row scrolls above the floating tab bar (bar top + 16). Set it instead of a paddingBottom. */
  tabBar?: boolean;
  testID?: string;
}

const isCollapsibleHeader = (node: ReactNode): node is ReactElement<HeaderProps> =>
  isValidElement<HeaderProps>(node) && node.type === Header && node.props.large !== false && !!node.props.title && !node.props.overlay;

export function Screen({ children, header, footer, scroll = true, keyboard, padded = true, background = colors.background, contentStyle, refreshControl, statusBar, tabBar, testID }: ScreenProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  // X-06: toasts sit just above this screen's pinned footer while the screen is focused.
  const focused = useScreenFocus();
  const bottom = tabBar ? tabInset : footer ? 24 : insets.bottom + 24;
  const pad: ViewStyle = { paddingHorizontal: padded ? gutter : 0, paddingBottom: bottom };

  // Collapsing large title (X-05): the bar floats over the content, the large title scrolls with it.
  const collapsible = scroll && isCollapsibleHeader(header);
  const hp = collapsible ? header.props : null;
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [titleHeight, setTitleHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const spacer = barHeight ?? (hp ? headerBarEstimate(insets.top, hp) : 0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = titleHeight > 0 && e.nativeEvent.contentOffset.y >= titleHeight - 8;
      setCollapsed((c) => (c === next ? c : next));
    },
    [titleHeight],
  );
  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    // Only the expanded bar sets the spacer: the collapsed bar grows over the content and must not move it.
    if (collapsedRef.current) return;
    const h = Math.round(e.nativeEvent.layout.height);
    setBarHeight((prev) => (prev === h ? prev : h));
  }, []);

  let top: ReactNode = null;
  if (hp) {
    // The container's own paddingTop and gap still apply below the title, as they did below the header.
    const flat = StyleSheet.flatten([pad, contentStyle]) ?? {};
    const padTop = Number(flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0) || 0;
    const gapY = Number(flat.rowGap ?? flat.gap ?? 0) || 0;
    top = (
      <View style={{ marginTop: -padTop, marginBottom: padTop - gapY, marginHorizontal: padded ? 0 : gutter }}>
        <View style={{ height: spacer }} />
        <HeaderLargeTitle title={hp.title!} subtitle={hp.subtitle} hasBar={!!(hp.onBack || hp.onClose || hp.right)} onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)} />
      </View>
    );
  }
  const scrollEvents = hp ? { onScroll, scrollEventThrottle: 16 } : null;

  const body = scroll ? (
    keyboard ? (
      <KeyboardAwareScrollView testID={testID ? `${testID}-scroll` : undefined} bounces={false} overScrollMode="never" bottomOffset={footer ? 96 : 24} keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, contentStyle]} showsVerticalScrollIndicator={false} {...scrollEvents}>
        {top}
        {children}
      </KeyboardAwareScrollView>
    ) : (
      <ScrollView testID={testID ? `${testID}-scroll` : undefined} bounces={!!refreshControl} overScrollMode="never" keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, contentStyle]} showsVerticalScrollIndicator={false} refreshControl={refreshControl} {...scrollEvents}>
        {top}
        {children}
      </ScrollView>
    )
  ) : (
    <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
  );
  const headerNode = hp ? cloneElement(header as ReactElement<HeaderProps>, { titleInContent: true, collapsed, backdrop: background, onBarLayout }) : header;
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: background, paddingTop: header === undefined ? insets.top : 0 }]}>
      <StatusBar style={statusBar ?? (getColorScheme() === 'dark' ? 'light' : 'dark')} />
      {hp ? null : headerNode}
      <View style={{ flex: 1 }}>
        {body}
        {hp ? headerNode : null}
      </View>
      {footer ? (
        <KeyboardStickyView offset={{ opened: insets.bottom - 8 }}>
          <ToastAnchor active={focused}>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4, backgroundColor: background }]}>{footer}</View>
          </ToastAnchor>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

/** Content section: optional title 18/600 12 pt above its content, 24 pt between sections (§5.1). */
export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View style={[{ marginTop: 24 }, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <SectionTitle variant="heading" style={{ flex: 1 }}>
            {title}
          </SectionTitle>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1 },
  footer: { paddingHorizontal: gutter, paddingTop: 12, gap: 8 },
}));
