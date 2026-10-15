import { themedStyles, colors, shadow } from '@naya/tokens';
import { useTheme, Button, Header, IconDisc, PressableScale, Screen, Text, TextButton, toast } from '@naya/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Baby, ChevronRight } from 'lucide-react-native';
import { dossierOverview, familleEligibilityOf, FAMILLE_ELIGIBILITY_LABELS, type SignupSection } from '@naya/domain';
import { SectionCard } from './Dossier';
import { SECTION_COPY, STEP_COPY } from './signup/copy';
import { goToStep, useSignup } from './signup/useSignup';
import { useDriverSignOut } from './useDriverSignOut';

const needsWork = (s: string | undefined) => !s || s === 'draft' || s === 'more_info_requested';

/**
 * D04: the whole dossier in one view (D-39). The hero holds the one progress figure and the screen's one
 * filled action, which opens the next unanswered question (answers are saved on the server, so the
 * driver can stop at any step). Below, the sections — you, the vehicle, and Naya Famille once she opts
 * in — each with its count and one glyph per row. « Voir le suivi » is a text link at the end, not a
 * second pinned button.
 */
export function DossierHub({ onBack }: { onBack?: () => void }) {
  useTheme();
  const { person, vehicle, famille, ctx, data } = useSignup();
  const signOut = useDriverSignOut();
  const overview = dossierOverview({ person, vehicle, famille }, ctx);
  const auto: SignupSection = needsWork(person?.status) ? 'person' : needsWork(vehicle?.status) ? 'vehicle' : famille && needsWork(famille.status) ? 'famille' : 'person';
  const [open, setOpen] = useState<SignupSection | null>(null);
  const expanded = open ?? auto;
  const toggle = (s: SignupSection) => setOpen(expanded === s ? null : s);
  const started = overview.done > 0;
  const eligibility = data?.user ? familleEligibilityOf(data.user) : 'not_requested';
  const next = overview.next;
  const leave = async () => {
    const refusal = await signOut.run();
    if (refusal) toast(refusal, 'danger');
  };
  return (
    <Screen
      header={
        <Header
          title="Votre dossier"
          subtitle="Vos réponses sont enregistrées à chaque étape."
          onBack={onBack}
          right={!onBack ? <Button label="Se déconnecter" variant="ghost" size="compact" loading={signOut.pending} onPress={leave} testID="sign-out" /> : undefined}
        />
      }
      testID="dossier-hub"
    >
      <View style={{ gap: 12, marginTop: 4 }}>
        <View style={styles.hero} testID="dossier-overview">
          <Text variant="display" numeric accessibilityLabel={`Dossier complété à ${overview.percent} pour cent, ${overview.done} étapes sur ${overview.total}`}>
            {overview.percent} %
          </Text>
          <View style={styles.heroTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: overview.total, now: overview.done }}>
            <View style={[styles.heroFill, { width: `${overview.percent}%` }]} />
          </View>
          <Text variant="caption" tone="muted">
            {next ? `${SECTION_COPY[next.section].short} · ${next.step.kind === 'review' ? 'prêt à envoyer' : `prochaine étape : ${STEP_COPY[next.step.id].title}`}` : 'Toutes les étapes sont faites. L’équipe Naya examine votre dossier.'}
          </Text>
          {next ? <Button label={next.step.kind === 'review' ? 'Vérifier et envoyer' : started ? 'Reprendre' : 'Commencer'} full onPress={() => goToStep(next.step)} testID="resume-signup" /> : null}
        </View>

        <SectionCard section="person" kase={person} ctx={ctx} collapsed={expanded !== 'person'} onToggle={() => toggle('person')} />
        <SectionCard section="vehicle" kase={vehicle} ctx={ctx} collapsed={expanded !== 'vehicle'} onToggle={() => toggle('vehicle')} />
        {famille ? (
          <SectionCard section="famille" kase={famille} ctx={ctx} collapsed={expanded !== 'famille'} onToggle={() => toggle('famille')} />
        ) : (
          <PressableScale onPress={() => router.push('/docs/famille')} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`Conduire pour Naya Famille, facultatif, ${FAMILLE_ELIGIBILITY_LABELS[eligibility]}`} style={styles.promo} testID="famille-opt-in">
            {/* A137: the Famille glyph says which service this is, so it keeps its disc. */}
            <IconDisc size={40}>
              <Baby size={20} color={colors.accent} />
            </IconDisc>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" weight="semibold">
                Conduire pour Naya Famille
              </Text>
              <Text variant="caption" tone="muted">
                Facultatif · agrément renforcé pour conduire des enfants
              </Text>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </PressableScale>
        )}
        <TextButton label="Voir le suivi du dossier" onPress={() => router.push('/docs/status')} testID="open-status" />
      </View>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    hero: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
    heroTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.selected },
    heroFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
    promo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.outline, borderStyle: 'dashed' },
  }),
);
