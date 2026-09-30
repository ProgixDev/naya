import { useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aspect, illustrations } from '@naya/assets';
import { colors, gutter } from '@naya/tokens';
import { BrandMark, Button, DEMO_MODE, DemoBadge, Illustration, PressableScale, Text } from '@naya/ui';
import { usePrefs } from '@/lib/prefs';

const SLIDES = [
  { image: illustrations.passengerWelcome, title: 'Vos trajets, entre femmes.', body: 'Des chauffeuses vérifiées à Rabat. Vous voyez son nom, sa voiture et sa plaque avant de monter.' },
  { image: illustrations.passengerPlanning, title: 'À votre rythme.', body: 'Réservez maintenant ou planifiez un départ. Le prix est affiché avant de confirmer.' },
  { image: illustrations.passengerIdentity, title: 'Une communauté vérifiée.', body: 'Chaque compte est examiné par une personne de l’équipe Naya avant la première course.' },
] as const;

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const done = usePrefs((s) => s.setOnboardingDone);
  const seen = usePrefs((s) => s.onboardingDone);
  const finish = () => {
    done();
    router.push('/(auth)/phone');
  };
  const next = () => {
    if (index === SLIDES.length - 1) return finish();
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };
  if (seen) return <Redirect href="/(auth)/phone" />;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }} testID="onboarding">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter, height: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark mark="lockup" height={26} />
          {DEMO_MODE ? (
            <PressableScale onPress={() => router.push('/dev')} accessibilityRole="button" accessibilityLabel="Ouvrir le lanceur de scénarios de démonstration" hitSlop={12}>
              <DemoBadge />
            </PressableScale>
          ) : null}
        </View>
        {index < SLIDES.length - 1 ? <Button label="Passer" variant="ghost" size="compact" onPress={finish} testID="skip-onboarding" /> : <View />}
      </View>
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, paddingHorizontal: gutter, justifyContent: 'center' }} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
            <Illustration source={s.image} aspect={aspect.illustration} width="100%" maxHeight={330} />
            <View style={{ gap: 10, marginTop: 20 }}>
              <Text variant="hero" accessibilityRole="header">
                {s.title}
              </Text>
              <Text variant="body" tone="muted">
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 12, gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={`Étape ${index + 1} sur ${SLIDES.length}`} accessible>
          {SLIDES.map((_, i) => (
            <View key={i} style={{ height: 8, width: i === index ? 24 : 8, borderRadius: 4, backgroundColor: i === index ? colors.accent : colors.line }} />
          ))}
        </View>
        <Button label={index === SLIDES.length - 1 ? 'Commencer' : 'Continuer'} size="major" full onPress={next} testID="onboarding-next" />
      </View>
    </View>
  );
}
