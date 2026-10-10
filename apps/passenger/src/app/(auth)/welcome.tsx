import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { illustrations } from '@naya/assets';
import { DEMO_MODE, DemoBadge, PressableScale, WelcomeJourney } from '@naya/ui';
import { usePrefs } from '@/lib/prefs';

const SLIDES = [
  { image: illustrations.passengerWelcome, title: 'Bienvenue chez Naya', body: 'Réservez une course en quelques secondes, simplement, à votre rythme. Le prix est affiché avant de confirmer.', note: 'Prix annoncé avant le départ' },
  { image: illustrations.passengerIdentity, title: 'Entre femmes, en confiance', body: 'Des chauffeuses vérifiées. Vous voyez son nom, sa voiture et sa plaque avant de monter, et vous suivez le trajet en direct.', note: 'Chauffeuses vérifiées' },
  { image: illustrations.passengerPlanning, title: 'Vos enfants, accompagnés', body: 'Avec Naya Famille, une chauffeuse dédiée dépose et récupère vos enfants, avec un code de remise sécurisé et un suivi en direct.', note: 'Remise par code à 4 chiffres' },
] as const;

export default function Welcome() {
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const reviewPreview = process.env.EXPO_PUBLIC_REVIEW === '1' && preview === '1';
  const seen = usePrefs((s) => s.onboardingDone);
  const done = usePrefs((s) => s.setOnboardingDone);
  if (seen && !reviewPreview) return <Redirect href="/(auth)/phone" />;
  return <WelcomeJourney slides={SLIDES} onFinish={() => { done(); router.push('/(auth)/phone'); }} badge={DEMO_MODE ? <PressableScale onPress={() => router.push('/dev')} accessibilityRole="button" accessibilityLabel="Ouvrir le lanceur de scénarios de démonstration" hitSlop={12}><DemoBadge /></PressableScale> : undefined} />;
}
