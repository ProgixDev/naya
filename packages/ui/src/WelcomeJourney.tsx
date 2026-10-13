import { getColorScheme , themedStyles , colors, gutter } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ArrowUpRight, ShieldCheck } from 'lucide-react-native';
import { BrandMark, Illustration } from './Brand';
import { Button } from './Button';
import { Text } from './Text';
import { useA11yPrefs } from './a11y';

/** `photo` replaces the drawn artwork: it fills the stage, cropped from the top so faces stay in frame. */
export interface WelcomeSlide { image: number; photo?: number; photoLabel?: string; title: string; body: string; note: string }

/** Shared editorial opening: artwork has its own stage; content remains scrollable at large text sizes. */
export function WelcomeJourney({ slides, onFinish, badge, driver = false }: { slides: readonly WelcomeSlide[]; onFinish: () => void; badge?: ReactNode; driver?: boolean }) {
  useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const [index, setIndex] = useState(0);
  const pages = useRef<ScrollView>(null);
  const artHeight = Math.min(350, Math.max(180, height * (fontScale > 1.2 ? 0.29 : 0.38)));
  const next = () => {
    if (index === slides.length - 1) return onFinish();
    pages.current?.scrollTo({ x: (index + 1) * width, animated: !reduceMotion });
    setIndex(index + 1);
  };
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="onboarding">
      <StatusBar style={getColorScheme() === 'dark' ? 'light' : 'dark'} />
      <LinearGradient pointerEvents="none" colors={[colors.mauveSoft, colors.background, colors.background]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark height={30} />
          {badge}
        </View>
        <Button label="Passer" size="compact" variant="ghost" onPress={onFinish} testID="skip-onboarding" />
      </View>
      <ScrollView bounces={false} overScrollMode="never" ref={pages} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))} style={{ flex: 1 }}>
        {slides.map((slide, i) => (
          <ScrollView bounces={false} overScrollMode="never" key={slide.title} style={{ width }} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 16, flexGrow: 1 }} showsVerticalScrollIndicator={false} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
            <View style={[styles.stage, { height: artHeight }]}>
              {slide.photo ? (
                <Image source={slide.photo} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessible={!!slide.photoLabel} accessibilityRole="image" accessibilityLabel={slide.photoLabel} />
              ) : (
                <>
                  <LinearGradient colors={driver ? [colors.selected, colors.mauveSoft] : [colors.selected, colors.surface]} style={StyleSheet.absoluteFill} />
                  <View pointerEvents="none" style={styles.orbit} />
                  <View pointerEvents="none" style={[styles.orbit, { width: 190, height: 190, top: 26, right: -52 }]} />
                </>
              )}
              <View style={[styles.stageLabel, slide.photo ? styles.stageLabelOnPhoto : null]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                <Text variant="micro" tone="accent">{driver ? 'L’espace chauffeuse' : 'La ville, à votre rythme'}</Text>
              </View>
              {slide.photo ? null : <Illustration source={slide.image} aspect={4 / 3} width="100%" maxHeight={artHeight - 28} style={{ marginTop: 24 }} />}
            </View>
            <View style={{ paddingHorizontal: 4, paddingTop: 24, gap: 12 }}>
              <Text variant="hero" accessibilityRole="header" style={{ maxWidth: 345 }}>{slide.title}</Text>
              <Text variant="body" tone="muted" style={{ lineHeight: 24 }}>{slide.body}</Text>
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter + 4, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingTop: 12, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 5 }} accessible accessibilityLabel={`Étape ${index + 1} sur ${slides.length}`}>
            {slides.map((_, i) => <View key={i} style={{ height: 4, width: i === index ? 28 : 12, borderRadius: 2, backgroundColor: i === index ? colors.accent : colors.line }} />)}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <ShieldCheck size={14} color={colors.accent} />
            <Text variant="micro" tone="muted" style={{ flexShrink: 1 }}>{slides[index]!.note}</Text>
          </View>
        </View>
        <Button label={index === slides.length - 1 ? 'Commencer' : 'Continuer'} size="major" full onPress={next} icon={<ArrowUpRight size={19} color={colors.inverse} />} testID="onboarding-next" />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter + 4, height: 58 },
  stage: { borderRadius: 34, overflow: 'hidden', justifyContent: 'center', borderWidth: 1, borderColor: colors.glassBorder },
  stageLabel: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', gap: 7 },
  stageLabelOnPhoto: { top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface },
  orbit: { position: 'absolute', width: 310, height: 310, borderRadius: 180, borderWidth: 1, borderColor: colors.glassBorder, top: 32, right: -42 },
}));
