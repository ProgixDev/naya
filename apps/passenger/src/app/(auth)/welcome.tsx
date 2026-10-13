import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { illustrations, photos } from '@naya/assets';
import { DEMO_MODE, DemoBadge, PressableScale, WelcomeJourney } from '@naya/ui';
import { usePrefs } from '@/lib/prefs';

const SLIDES = [
  { image: illustrations.passengerWelcome, photo: photos.passengersBetweenWomen, photoLabel: 'Une chauffeuse au volant, une passagère au téléphone sur la banquette arrière', title: 'Vos trajets, entre femmes.', body: 'Des chauffeuses vérifiées à Rabat. Vous voyez son nom, sa voiture et sa plaque avant de monter.', note: 'Chauffeuses vérifiées' },
  { image: illustrations.passengerPlanning, title: 'À votre rythme.', body: 'Réservez maintenant ou planifiez un départ. Le prix est affiché avant de confirmer.', note: 'Prix annoncé avant le départ' },
  { image: illustrations.passengerIdentity, photo: photos.familleDeparture, photoLabel: 'Une chauffeuse se retourne vers une écolière qui attache sa ceinture, sa mère à la portière', title: 'Une communauté vérifiée.', body: 'Chaque compte est examiné par une personne de l’équipe Naya avant la première course.', note: 'Un examen humain' },
] as const;

export default function Welcome() {
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const reviewPreview = process.env.EXPO_PUBLIC_REVIEW === '1' && preview === '1';
  const seen = usePrefs((s) => s.onboardingDone);
  const done = usePrefs((s) => s.setOnboardingDone);
  if (seen && !reviewPreview) return <Redirect href="/(auth)/phone" />;
  return <WelcomeJourney slides={SLIDES} onFinish={() => { done(); router.push('/(auth)/phone'); }} badge={DEMO_MODE ? <PressableScale onPress={() => router.push('/dev')} accessibilityRole="button" accessibilityLabel="Ouvrir le lanceur de scénarios de démonstration" hitSlop={12}><DemoBadge /></PressableScale> : undefined} />;
}
