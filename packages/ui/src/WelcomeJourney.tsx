import type { Spot } from '@naya/assets';
import { getColorScheme, themedStyles, colors, gutter } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ShieldCheck } from 'lucide-react-native';
import { BrandMark, Illustration } from './Brand';
import { Button } from './Button';
import { Text } from './Text';
import { useA11yPrefs } from './a11y';
import { PressableScale } from './PressableScale';

export interface WelcomeSlide { image: Spot; title: string; body: string; note: string; /** Full-bleed photo; when every slide has one, the photo layout is used. */ photo?: number }

/**
 * Onboarding: brand row with Passer, a soft mauve stage holding the illustration, a centred
 * title and text, progress dots and one full-width action ("Suivant", then "Commencer").
 */
export function WelcomeJourney(props: { slides: readonly WelcomeSlide[]; onFinish: () => void; badge?: ReactNode; driver?: boolean }) {
  if (props.slides.every((s) => s.photo)) return <PhotoJourney {...props} />;
  return <IllustratedJourney {...props} />;
}

function IllustratedJourney({ slides, onFinish, badge, driver = false }: { slides: readonly WelcomeSlide[]; onFinish: () => void; badge?: ReactNode; driver?: boolean }) {
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

/**
 * Photo onboarding: each slide is a full-bleed photo with a plum-to-ink gradient, a large
 * white title and text at the bottom, then Passer · dots · Suivant (Commencer on the last).
 */
function PhotoJourney({ slides, onFinish, badge, driver = false }: { slides: readonly WelcomeSlide[]; onFinish: () => void; badge?: ReactNode; driver?: boolean }) {
  useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const [index, setIndex] = useState(0);
  const pages = useRef<ScrollView>(null);
  const last = index === slides.length - 1;
  const go = (i: number) => {
    pages.current?.scrollTo({ x: i * width, animated: !reduceMotion });
    setIndex(i);
  };
  const next = () => (last ? onFinish() : go(index + 1));
  return (
    <View style={{ flex: 1, backgroundColor: '#1C0F18' }} testID="onboarding">
      <StatusBar style="light" />
      <ScrollView bounces={false} overScrollMode="never" ref={pages} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))} style={StyleSheet.absoluteFill}>
        {slides.map((slide, i) => (
          <View key={slide.title} style={{ width, height }} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
            <Image source={slide.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduceMotion ? 0 : 200} accessibilityIgnoresInvertColors />
            {/* Soft top shade for the status bar and logo; deep plum-to-ink gradient under the text. */}
            <LinearGradient pointerEvents="none" colors={['rgba(28,15,24,0.55)', 'rgba(28,15,24,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 120 }} />
            <LinearGradient pointerEvents="none" colors={['rgba(28,15,24,0)', 'rgba(63,27,52,0.72)', 'rgba(28,15,24,0.97)']} locations={[0, 0.42, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.62 }} />
            <View style={{ position: 'absolute', left: gutter + 4, right: gutter + 4, bottom: Math.max(insets.bottom, 16) + 92, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
                <ShieldCheck size={14} color="#FFFFFF" strokeWidth={2.2} />
                <Text weight="semibold" style={{ fontSize: 12, lineHeight: 16, color: '#FFFFFF' }}>{slide.note}</Text>
              </View>
              <Text weight="bold" accessibilityRole="header" style={{ fontSize: 34, lineHeight: 39, letterSpacing: -1, color: '#FFFFFF', maxWidth: 340 }}>{slide.title}</Text>
              <Text style={{ fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.86)', maxWidth: 340 }}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Brand row ── */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: gutter + 4, right: gutter + 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)', justifyContent: 'center' }}><BrandMark height={22} /></View>
        {badge}
      </View>

      {/* ── Bottom bar: Passer · dots · Suivant ── */}
      <View style={{ position: 'absolute', left: gutter + 4, right: gutter + 4, bottom: Math.max(insets.bottom, 16) + 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
        {!last ? (
          <PressableScale onPress={onFinish} testID="skip-onboarding" accessibilityRole="button" accessibilityLabel="Passer l’introduction" hitSlop={12} style={{ minWidth: 80, height: 44, justifyContent: 'center' }}>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,0.82)' }}>Passer</Text>
          </PressableScale>
        ) : <View style={{ minWidth: 80 }} />}
        <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`Étape ${index + 1} sur ${slides.length}`}>
          {slides.map((_, i) => (
            <PressableScale key={i} onPress={() => go(i)} hitSlop={8} accessibilityElementsHidden>
              <View style={{ height: 6, width: i === index ? 22 : 6, borderRadius: 3, backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,0.38)' }} />
            </PressableScale>
          ))}
        </View>
        <PressableScale onPress={next} testID="onboarding-next" accessibilityRole="button" accessibilityLabel={last ? 'Commencer' : 'Suivant'} accessibilityHint={last ? (driver ? 'Ouvrir la connexion chauffeuse' : 'Ouvrir la connexion') : undefined} pressedScale={0.95} style={{ minWidth: 80, height: 48, paddingHorizontal: last ? 22 : 0, borderRadius: 16, alignItems: 'flex-end', justifyContent: 'center', backgroundColor: last ? '#FFFFFF' : 'transparent' }}>
          <Text weight="bold" style={{ fontSize: 15, lineHeight: 20, color: last ? '#6B3657' : '#FFFFFF' }}>{last ? 'Commencer' : 'Suivant'}</Text>
        </PressableScale>
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
