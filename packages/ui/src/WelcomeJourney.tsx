import { getColorScheme, themedStyles, colors, gutter } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, ShieldCheck } from 'lucide-react-native';
import { BrandMark, Illustration } from './Brand';
import { Button } from './Button';
import { Text } from './Text';
import { useA11yPrefs } from './a11y';
import { PressableScale } from './PressableScale';

export interface WelcomeSlide { image: number; title: string; body: string; note: string }

/**
 * Onboarding: brand row with Passer, a soft mauve stage holding the illustration, a centred
 * title and text, progress dots and one full-width action ("Suivant", then "Commencer").
 */
export function WelcomeJourney({ slides, onFinish, badge, driver = false }: { slides: readonly WelcomeSlide[]; onFinish: () => void; badge?: ReactNode; driver?: boolean }) {
  useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const [index, setIndex] = useState(0);
  const pages = useRef<ScrollView>(null);
  const stageHeight = Math.min(400, Math.max(220, height * (fontScale > 1.2 ? 0.34 : 0.44)));
  const last = index === slides.length - 1;
  const go = (i: number) => {
    pages.current?.scrollTo({ x: i * width, animated: !reduceMotion });
    setIndex(i);
  };
  const next = () => (last ? onFinish() : go(index + 1));
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="onboarding">
      <StatusBar style={getColorScheme() === 'dark' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark height={26} />
          {badge}
        </View>
        {!last ? (
          <PressableScale onPress={onFinish} testID="skip-onboarding" accessibilityRole="button" accessibilityLabel="Passer l’introduction" hitSlop={12}>
            <Text weight="medium" tone="muted" style={{ fontSize: 14, lineHeight: 18 }}>Passer</Text>
          </PressableScale>
        ) : null}
      </View>
      <ScrollView bounces={false} overScrollMode="never" ref={pages} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))} style={{ flex: 1 }}>
        {slides.map((slide, i) => (
          <ScrollView bounces={false} overScrollMode="never" key={slide.title} style={{ width }} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 16, flexGrow: 1 }} showsVerticalScrollIndicator={false} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
            <View style={[styles.stage, { height: stageHeight }]}>
              <View pointerEvents="none" style={[styles.blob, { width: 170, height: 170, borderRadius: 85, top: -50, right: -40 }]} />
              <View pointerEvents="none" style={[styles.blob, { width: 130, height: 130, borderRadius: 65, bottom: -40, left: -30 }]} />
              <View pointerEvents="none" style={[styles.spark, { top: 26, right: 30 }]} />
              <View pointerEvents="none" style={[styles.spark, { bottom: 34, left: 34, width: 10, height: 10 }]} />
              <Illustration source={slide.image} aspect={4 / 3} width="88%" maxHeight={stageHeight - 40} />
            </View>
            <View style={{ alignItems: 'center', paddingHorizontal: 8, paddingTop: 30, gap: 12 }}>
              <Text weight="bold" align="center" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.8, maxWidth: 330 }}>{slide.title}</Text>
              <Text tone="muted" align="center" style={{ fontSize: 15, lineHeight: 23, maxWidth: 330 }}>{slide.body}</Text>
              <View style={styles.chip}>
                <ShieldCheck size={14} color={colors.accent} strokeWidth={2.2} />
                <Text weight="semibold" tone="accent" style={{ fontSize: 12, lineHeight: 16 }}>{slide.note}</Text>
              </View>
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter + 4, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingTop: 8, gap: 18, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`Étape ${index + 1} sur ${slides.length}`}>
          {slides.map((_, i) => (
            <PressableScale key={i} onPress={() => go(i)} hitSlop={8} accessibilityElementsHidden>
              <View style={{ height: 6, width: i === index ? 26 : 6, borderRadius: 3, backgroundColor: i === index ? colors.accent : colors.line }} />
            </PressableScale>
          ))}
        </View>
        <Button label={last ? 'Commencer' : 'Suivant'} size="major" full onPress={next} icon={<ArrowRight size={18} color={colors.inverse} strokeWidth={2.4} />} testID="onboarding-next" accessibilityHint={last ? (driver ? 'Ouvrir la connexion chauffeuse' : 'Ouvrir la connexion') : undefined} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter + 4, height: 56 },
  stage: { borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selected },
  blob: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  spark: { position: 'absolute', width: 14, height: 14, borderRadius: 3, backgroundColor: '#D9A33F', transform: [{ rotate: '45deg' }] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.mauveSoft, marginTop: 4 },
}));
