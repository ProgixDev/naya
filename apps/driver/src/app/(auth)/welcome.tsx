import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { illustrations, photos } from '@naya/assets';
import { DevLauncherGesture, WelcomeJourney } from '@naya/ui';
import { usePrefs } from '@/lib/prefs';

/** Slide 2 shows its illustration until a photo is added here as `photo` (with a `photoLabel`). */
const SLIDES = [
  { image: illustrations.driverWelcome, photo: photos.driverOnRoad, photoLabel: 'Une chauffeuse souriante au volant, une passagère à l’arrière', title: 'Conduisez entre femmes.', body: 'Des passagères vérifiées, des trajets dans Rabat, et vous choisissez quand prendre la route.' },
  { image: illustrations.driverWallet, title: 'Des gains clairs.', body: 'Chaque course affiche votre revenu net avant d’accepter. Commissions et retraits restent lisibles.' },
] as const;

export default function Welcome() {
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const reviewPreview = process.env.EXPO_PUBLIC_REVIEW === '1' && preview === '1';
  const seen = usePrefs((s) => s.onboardingDone);
  const done = usePrefs((s) => s.setOnboardingDone);
  if (seen && !reviewPreview) return <Redirect href="/(auth)/phone" />;
  return <WelcomeJourney slides={SLIDES} driver onFinish={() => { done(); router.push('/(auth)/phone'); }} badge={<DevLauncherGesture onOpen={() => router.push('/dev')} />} />;
}
