import { themedStyles, colors, shadow } from '@naya/tokens';
import { useTheme, Button, Header, IconDisc, PressableScale, Screen, Text } from '@naya/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Baby, ChevronRight } from 'lucide-react-native';
import { dossierOverview, familleEligibilityOf, FAMILLE_ELIGIBILITY_LABELS, type SignupSection } from '@naya/domain';
import { useSession } from '@/lib/session';
import { SectionCard } from './Dossier';
import { SECTION_COPY, STEP_COPY } from './signup/copy';
import { goToStep, useSignup } from './signup/useSignup';

const needsWork = (s: string | undefined) => !s || s === 'draft' || s === 'more_info_requested';

/**
 * D04: the whole dossier in one view. One progress figure and a « Reprendre » action that
 * opens the next unanswered question (answers are saved on the server, so the driver can
 * stop at any step). Below, the sections — you, the vehicle, and Naya Famille once she opts
 * in — each with their documents and per-document status.
 */
export function DossierHub({ onBack }: { onBack?: () => void }) {
  useTheme();
  const { person, vehicle, famille, ctx, data } = useSignup();
  const overview = dossierOverview({ person, vehicle, famille }, ctx);
  const auto: SignupSection = needsWork(person?.status) ? 'person' : needsWork(vehicle?.status) ? 'vehicle' : famille && needsWork(famille.status) ? 'famille' : 'person';
  const [open, setOpen] = useState<SignupSection | null>(null);
  const expanded = open ?? auto;
  const toggle = (s: SignupSection) => setOpen(expanded === s ? null : s);
  const started = overview.done > 0;
  const eligibility = data?.user ? familleEligibilityOf(data.user) : 'not_requested';
  const next = overview.next;
  return (
    <Screen
      header={
        <Header
          title="Votre dossier"
          subtitle="Vos réponses sont enregistrées à chaque étape."
          onBack={onBack}
          right={!onBack ? <Button label="Se déconnecter" variant="secondary" size="compact" onPress={() => useSession.getState().signOut()} testID="sign-out" /> : undefined}
        />
      }
      footer={<Button label="Voir le suivi" variant="secondary" size="major" full onPress={() => router.push('/docs/status')} testID="open-status" />}
      testID="dossier-hub"
    >
      <View style={{ gap: 12, marginTop: 4 }}>
        <View style={styles.hero} testID="dossier-overview">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Text variant="display" tone="inverse" numeric accessibilityLabel={`Dossier complété à ${overview.percent} pour cent`}>
              {overview.percent} %
            </Text>
            <Text variant="caption" tone="inverse" style={{ opacity: 0.85, marginBottom: 10 }} numeric>
              {overview.done} étapes sur {overview.total}
            </Text>
          </View>
          <View style={styles.heroTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: overview.total, now: overview.done }}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.inverse, opacity: 0.25 }]} />
            <View style={[styles.heroFill, { width: `${overview.percent}%`, backgroundColor: colors.inverse }]} />
          </View>
          <Text variant="caption" tone="inverse" style={{ opacity: 0.9 }}>
            {next ? `${SECTION_COPY[next.section].short} · ${next.step.kind === 'review' ? 'prêt à envoyer' : `prochaine étape : ${STEP_COPY[next.step.id].title}`}` : 'Toutes les étapes sont faites. Suivez l’examen dans « Voir le suivi ».'}
          </Text>
          {next ? <Button label={next.step.kind === 'review' ? 'Vérifier et envoyer' : started ? 'Reprendre' : 'Commencer'} variant="secondary" full onPress={() => goToStep(next.step)} testID="resume-signup" /> : null}
        </View>

        <SectionCard section="person" kase={person} ctx={ctx} collapsed={expanded !== 'person'} onToggle={() => toggle('person')} />
        <SectionCard section="vehicle" kase={vehicle} ctx={ctx} collapsed={expanded !== 'vehicle'} onToggle={() => toggle('vehicle')} />
        {famille ? (
          <SectionCard section="famille" kase={famille} ctx={ctx} collapsed={expanded !== 'famille'} onToggle={() => toggle('famille')} />
        ) : (
          <PressableScale onPress={() => router.push('/docs/famille')} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`Conduire pour Naya Famille, facultatif, ${FAMILLE_ELIGIBILITY_LABELS[eligibility]}`} style={styles.promo} testID="famille-opt-in">
            <IconDisc size={40}>
              <Baby size={19} color={colors.accent} />
            </IconDisc>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" weight="semibold">
                Conduire pour Naya Famille
              </Text>
              <Text variant="micro" tone="muted">
                Facultatif · agrément renforcé pour conduire des enfants
              </Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </PressableScale>
        )}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    hero: { backgroundColor: colors.accent, borderRadius: 26, padding: 18, gap: 12, ...shadow.card },
    heroTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    heroFill: { height: 6, borderRadius: 3 },
    promo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, padding: 14, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  }),
);
