import { useTheme, Button, Header, Icon, ListGroup, ListRow, Screen, StatusIcon, Text, haptic, toast } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import { documentStatus, familleEligibilityOf, findSignupStep, isSignupStepDone, sectionProgress, type SignupStepId } from '@naya/domain';
import { goToStep, useSignup } from '@/components/signup/useSignup';

const REQUIREMENTS: { step: SignupStepId; title: string; detail: string }[] = [
  { step: 'criminal_record', title: 'Extrait de casier judiciaire', detail: 'Demandé uniquement pour Naya Famille.' },
  { step: 'famille_references', title: 'Deux références', detail: 'Des personnes que l’équipe Naya peut appeler.' },
  { step: 'famille_experience', title: 'Votre expérience avec les enfants', detail: 'Quelques phrases suffisent.' },
  { step: 'famille_training', title: 'Une formation', detail: 'Sécurité de l’enfant et remise à un adulte autorisé.' },
  { step: 'famille_interview', title: 'Un entretien', detail: 'Vous choisissez le jour et le moment.' },
];

/**
 * Opt-in to Naya Famille: what the stricter vetting asks for, then the first question.
 * Regular rides never depend on it; only agreed drivers receive Famille trips.
 * Each requirement's leading glyph is its state in the Famille dossier (A150): to do, or done
 * (a document shows its own review state, C8).
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
          <Button label="Voir le suivi" variant="secondary" full onPress={() => router.replace('/docs/status')} testID="famille-status-open" />
        ) : (
          <Button label={famille ? 'Reprendre ma candidature' : 'Je me porte candidate'} size="major" full loading={start.isPending} onPress={() => (famille ? goToStep(resume!.next) : start.mutate())} testID="famille-start" />
        )
      }
      testID="famille-intro"
    >
      <View style={{ gap: 24, marginTop: 4 }}>
        {/* First sight of the agreement's state: the glyph with its sentence (C10, R1). */}
        {famille && eligibility !== 'not_requested' ? <StatusIcon kind="familleEligibility" state={eligibility} showLabel wording="full" testID="famille-eligibility-status" /> : null}
        <Text variant="label" tone="muted">
          Les parents confient leur enfant à une chauffeuse dédiée : l’agrément, plus exigeant, est examiné à part et votre activité habituelle n’en dépend pas.
        </Text>
        <ListGroup label="Ce que l’agrément demande">
          {REQUIREMENTS.map(({ step: id, title, detail }) => {
            const step = findSignupStep(id);
            if (step?.kind === 'document') {
              return <ListRow key={id} title={title} subtitle={detail} status={{ kind: 'document', state: documentStatus(famille, step.item).status }} statusPlacement="leading" testID={`famille-req-${id}`} />;
            }
            const done = !!step && isSignupStepDone(step, famille, ctx);
            return (
              <ListRow
                key={id}
                title={title}
                subtitle={detail}
                leading={<Icon name={done ? 'circle-check' : 'circle-dashed'} size={20} tone={done ? 'success' : 'neutral'} accessibilityLabel={done ? 'Complété' : 'À compléter'} />}
                testID={`famille-req-${id}`}
              />
            );
          })}
        </ListGroup>
      </View>
    </Screen>
  );
}
