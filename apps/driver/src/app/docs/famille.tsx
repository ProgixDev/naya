import { themedStyles, colors } from '@naya/tokens';
import { useTheme, Button, Header, IconDisc, Screen, StatusBanner, Text, haptic, toast } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { BookOpenCheck, CalendarCheck, FileBadge, HeartHandshake, Users } from 'lucide-react-native';
import { errorMessage } from '@naya/api';
import { FAMILLE_ELIGIBILITY_LABELS, familleEligibilityOf, sectionProgress } from '@naya/domain';
import { goToStep, useSignup } from '@/components/signup/useSignup';

const REQUIREMENTS = [
  { icon: FileBadge, title: 'Extrait de casier judiciaire', detail: 'Demandé uniquement pour Naya Famille.' },
  { icon: Users, title: 'Deux références', detail: 'Des personnes que l’équipe Naya peut appeler.' },
  { icon: HeartHandshake, title: 'Votre expérience avec les enfants', detail: 'Quelques phrases suffisent.' },
  { icon: BookOpenCheck, title: 'Une formation', detail: 'Sécurité de l’enfant et remise à un adulte autorisé.' },
  { icon: CalendarCheck, title: 'Un entretien', detail: 'Vous choisissez le jour et le moment.' },
];

/**
 * Opt-in to Naya Famille: what the stricter vetting asks for, then the first question.
 * Regular rides never depend on it; only agreed drivers receive Famille trips.
 */
export default function FamilleOptIn() {
  useTheme();
  const { famille, ensureCase, ctx, data } = useSignup();
  const eligibility = data?.user ? familleEligibilityOf(data.user) : 'not_requested';
  const start = useMutation({
    mutationFn: () => ensureCase('famille'),
    onSuccess: (c) => {
      haptic.success();
      goToStep(sectionProgress('famille', c, ctx).next, 'replace');
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const resume = famille ? sectionProgress('famille', famille, ctx) : null;
  return (
    <Screen
      header={<Header title="Conduire pour Naya Famille" subtitle="Facultatif · trajets d’enfants avec une chauffeuse dédiée." onBack={() => (router.canGoBack() ? router.back() : router.replace('/docs/start'))} />}
      footer={
        famille && !resume?.next ? (
          <Button label="Voir le suivi" variant="secondary" size="major" full onPress={() => router.replace('/docs/status')} />
        ) : (
          <Button label={famille ? 'Reprendre ma candidature' : 'Je me porte candidate'} size="major" full loading={start.isPending} onPress={() => (famille ? goToStep(resume!.next) : start.mutate())} testID="famille-start" />
        )
      }
      testID="famille-intro"
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        {famille ? <StatusBanner compact tone={eligibility === 'approved' ? 'success' : eligibility === 'rejected' ? 'danger' : 'info'} title={`Agrément : ${FAMILLE_ELIGIBILITY_LABELS[eligibility]}`} /> : null}
        <Text variant="label" tone="muted">
          Les parents confient leur enfant à une chauffeuse dédiée. L’agrément est plus exigeant que pour les courses habituelles et il est examiné à part : votre activité de chauffeuse n’en dépend pas.
        </Text>
        <View style={styles.card}>
          {REQUIREMENTS.map(({ icon: Icon, title, detail }) => (
            <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
              <IconDisc size={36}>
                <Icon size={17} color={colors.accent} />
              </IconDisc>
              <View style={{ flex: 1 }}>
                <Text variant="label" weight="semibold">
                  {title}
                </Text>
                <Text variant="micro" tone="muted">
                  {detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.hairline },
  }),
);
