import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { illustrations } from '@naya/assets';
import { DEMO_MODE, DemoBadge, PressableScale, WelcomeJourney } from '@naya/ui';
import { usePrefs } from '@/lib/prefs';

const SLIDES = [
  { image: illustrations.driverWelcome, title: 'Conduisez entre femmes.', body: 'Des passagères vérifiées, des trajets dans Rabat, et vous choisissez quand prendre la route.', note: 'Vous choisissez vos horaires' },
  { image: illustrations.driverWallet, title: 'Des gains clairs.', body: 'Chaque course affiche votre revenu net avant d’accepter. Commissions et retraits restent lisibles.', note: 'Vos revenus, en toute clarté' },
] as const;

export default function Welcome() {
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const reviewPreview = process.env.EXPO_PUBLIC_REVIEW === '1' && preview === '1';
  const seen = usePrefs((s) => s.onboardingDone);
  const done = usePrefs((s) => s.setOnboardingDone);
  if (seen && !reviewPreview) return <Redirect href="/(auth)/phone" />;
  return <WelcomeJourney slides={SLIDES} driver onFinish={() => { done(); router.push('/(auth)/phone'); }} badge={DEMO_MODE ? <PressableScale onPress={() => router.push('/dev')} accessibilityRole="button" accessibilityLabel="Ouvrir le lanceur de scénarios de démonstration" hitSlop={12}><DemoBadge /></PressableScale> : undefined} />;
}
