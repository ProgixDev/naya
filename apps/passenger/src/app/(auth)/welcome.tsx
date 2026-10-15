import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { illustrations, photos } from '@naya/assets';
import { DevLauncherGesture, WelcomeJourney } from '@naya/ui';
import { usePrefs } from '@/lib/prefs';

/** Every slide shows a photo (`photo`, described in French by `photoLabel`); `image` is drawn only on a slide without one. */
const SLIDES = [
  { image: illustrations.passengerWelcome, photo: photos.passengersBetweenWomen, photoLabel: 'Une chauffeuse au volant, une passagère au téléphone sur la banquette arrière', title: 'Vos trajets, entre femmes.', body: 'Des chauffeuses vérifiées à Rabat. Vous voyez son nom, sa voiture et sa plaque avant de monter.' },
  { image: illustrations.passengerPlanning, photo: photos.passengerRhythm, photoLabel: 'Une passagère assise à une terrasse de café sourit en regardant son téléphone', title: 'À votre rythme.', body: 'Réservez maintenant ou planifiez un départ. Le prix est affiché avant de confirmer.' },
  { image: illustrations.passengerIdentity, photo: photos.schoolGate, photoLabel: 'Devant le portail vert d’une école, une chauffeuse à la portière de sa voiture salue une mère et sa fille, la main sur le cœur', title: 'Une communauté vérifiée.', body: 'Chaque compte est examiné par une personne de l’équipe Naya avant la première course.' },
] as const;

export default function Welcome() {
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const reviewPreview = process.env.EXPO_PUBLIC_REVIEW === '1' && preview === '1';
  const seen = usePrefs((s) => s.onboardingDone);
  const done = usePrefs((s) => s.setOnboardingDone);
  if (seen && !reviewPreview) return <Redirect href="/(auth)/phone" />;
  return <WelcomeJourney slides={SLIDES} onFinish={() => { done(); router.push('/(auth)/phone'); }} badge={<DevLauncherGesture onOpen={() => router.push('/dev')} />} />;
}
