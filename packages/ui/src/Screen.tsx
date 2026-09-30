import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { colors, gutter } from '@naya/tokens';
import { SectionTitle } from './Text';

export interface ScreenProps {
  children: ReactNode;
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
  testID?: string;
}

export function Screen({ children, header, footer, scroll = true, keyboard, padded = true, background = colors.background, contentStyle, refreshControl, statusBar = 'dark', testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = { paddingHorizontal: padded ? gutter : 0, paddingBottom: footer ? 24 : insets.bottom + 24 };
  const body = scroll ? (
    keyboard ? (
      <KeyboardAwareScrollView bottomOffset={footer ? 96 : 24} keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, contentStyle]} showsVerticalScrollIndicator={false}>
        {children}
      </KeyboardAwareScrollView>
    ) : (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, contentStyle]} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        {children}
      </ScrollView>
    )
  ) : (
    <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
  );
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: background, paddingTop: header === undefined ? insets.top : 0 }]}>
      <StatusBar style={statusBar} />
      {header}
      <View style={{ flex: 1 }}>{body}</View>
      {footer ? (
        <KeyboardStickyView offset={{ opened: insets.bottom - 8 }}>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4, backgroundColor: background }]}>{footer}</View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

/** Content section: optional title 20/600 12 pt above its content, 28 pt between sections. */
export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 28 }, style]}>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: { paddingHorizontal: gutter, paddingTop: 12, gap: 8 },
});
