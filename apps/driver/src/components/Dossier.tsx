import { themedStyles, colors, shadow } from '@naya/tokens';
import { useTheme, Button, Icon, PressableScale, StatusIcon, Text, toast } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import {
  ITEM_LABELS,
  documentStatus,
  isSignupStepDone,
  sectionItems,
  sectionProgress,
  sectionSteps,
  statusA11y,
  type DocumentStatus,
  type SignupContext,
  type SignupSection,
  type VerificationCase,
  type VerificationItemKey,
} from '@naya/domain';
import { ActionNote } from './Kit';
import { SECTION_COPY, STEP_COPY } from './signup/copy';
import { goToStep } from './signup/useSignup';
import { useAccountId } from '@/lib/queries';

const editable = (c: VerificationCase | null) => !c || c.status === 'draft' || c.status === 'more_info_requested';

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase('fr') + s.slice(1);

/** Why a section's documents cannot be added yet (D-43): they belong to a dossier that opens with its first answers. */
const LOCK_REASON: Record<SignupSection, string> = {
  person: '',
  vehicle: 'Après les informations du véhicule',
  famille: 'Après votre candidature Naya Famille',
};

/**
 * The count a section header gives (principle 7, D-34): « 8 pièces en vérification », « 1 pièce à reprendre ».
 * Rows then show their own state once, as a glyph.
 */
export function sectionSummary(section: SignupSection, kase: VerificationCase | null, ctx: SignupContext): string {
  const docs = sectionItems(section).map((k) => documentStatus(kase, k).status);
  const count = (s: DocumentStatus) => docs.filter((d) => d === s).length;
  switch (kase?.status ?? 'draft') {
    case 'approved':
      return 'Toutes les pièces sont approuvées';
    case 'rejected':
      return 'Dossier refusé';
    case 'submitted':
    case 'in_review': {
      const waiting = count('sent') + count('in_review');
      return waiting ? plural(waiting, 'pièce en vérification', 'pièces en vérification') : 'En cours d’examen';
    }
    case 'more_info_requested': {
      const redo = count('rejected');
      return redo ? plural(redo, 'pièce à reprendre', 'pièces à reprendre') : 'Un complément est demandé';
    }
    default: {
      const p = sectionProgress(section, kase, ctx);
      const left = p.total - p.done;
      return left ? plural(left, 'étape à compléter', 'étapes à compléter') : 'Prêt à envoyer';
    }
  }
}

/**
 * One document with its state as one leading glyph (C8, A138, D-34, D-35): no chip. A refusal keeps the
 * word, the reviewer's reason and « Renvoyer » (principle 3). While the dossier is editable the row opens
 * the guided capture; before its dossier exists it is locked, with the reason (D-43).
 */
export function DocumentRow({ kase, item, compact, section }: { kase: VerificationCase | null; item: VerificationItemKey; compact?: boolean; section?: SignupSection }) {
  useTheme();
  const { status, reason } = documentStatus(kase, item);
  const open = () => router.push({ pathname: '/docs/capture/[item]', params: { item } });
  const locked = !kase && !!section && section !== 'person';
  const canOpen = !!kase && editable(kase);
  const rejected = status === 'rejected';
  const label = locked
    ? `${ITEM_LABELS[item]}, verrouillé. ${LOCK_REASON[section!]}`
    : `${ITEM_LABELS[item]}, ${statusA11y('document', status)}${reason ? `. Motif : ${reason}` : ''}`;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: compact ? 44 : 52, paddingVertical: 6 }}>
      {locked ? <Icon icon={Lock} size={20} tone="neutral" testID={`doc-locked-${item}`} /> : <StatusIcon kind="document" state={status} showLabel={false} accessible={false} testID={`doc-status-${item}`} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" tone={locked ? 'muted' : 'ink'} numberOfLines={2}>
          {ITEM_LABELS[item]}
        </Text>
        {locked ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {LOCK_REASON[section!]}
          </Text>
        ) : rejected ? (
          <Text variant="caption" tone="danger" numberOfLines={4}>
            {reason ? `Pièce refusée : ${reason}` : 'Pièce refusée'}
          </Text>
        ) : null}
      </View>
      {rejected && canOpen ? <Button label="Renvoyer" variant="secondary" size="compact" onPress={open} testID={`resend-${item}`} /> : null}
      {canOpen && !rejected ? <ChevronRight size={20} color={colors.muted} /> : null}
    </View>
  );
  return canOpen && !rejected ? (
    <PressableScale onPress={open} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={label} testID={`step-${item}`}>
      {body}
    </PressableScale>
  ) : (
    <View accessible={!rejected || !canOpen} accessibilityLabel={label} testID={`step-${item}`}>
      {body}
    </View>
  );
}

/** The question groups of a section, shown as one row each in the hub. */
const GROUPS: Record<SignupSection, { title: string; steps: string[] }[]> = {
  person: [
    { title: 'Vos informations', steps: ['name', 'birth', 'address', 'id_document'] },
    { title: 'Votre permis', steps: ['licence_number', 'licence_dates', 'experience'] },
  ],
  vehicle: [{ title: 'Informations du véhicule', steps: ['vehicle_model', 'vehicle_plate'] }],
  famille: [
    { title: 'Références', steps: ['famille_references'] },
    { title: 'Expérience avec les enfants', steps: ['famille_experience'] },
    { title: 'Formation et entretien', steps: ['famille_training', 'famille_interview'] },
  ],
};

/**
 * One section of the dossier as a card (A139): the dossier's state as one glyph in a 40 disc, the title,
 * and the count as the only figure. No pill, no progress bar: the hub's hero carries the one progress
 * figure. Expanded, its question groups (a glyph each, A140) and each document with its own glyph.
 */
export function SectionCard({ section, kase, ctx, collapsed, onToggle }: { section: SignupSection; kase: VerificationCase | null; ctx: SignupContext; collapsed?: boolean; onToggle?: () => void }) {
  useTheme();
  const subject = section === 'person' ? 'driver_identity' : section === 'vehicle' ? 'vehicle' : 'driver_famille';
  const p = sectionProgress(section, kase, ctx);
  const status = kase?.status ?? 'draft';
  const steps = sectionSteps(section);
  const canEdit = editable(kase);
  const summary = sectionSummary(section, kase, ctx);
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <StatusIcon kind="verification" state={status} variant="disc" showLabel={false} accessible={!onToggle} testID={`section-status-${subject}`} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" weight="semibold" accessibilityRole="header" numberOfLines={2}>
          {SECTION_COPY[section].title}
        </Text>
        <Text variant="caption" tone="muted" numeric testID={`section-summary-${subject}`}>
          {summary}
        </Text>
      </View>
      {onToggle ? <ChevronDown size={20} color={colors.muted} style={{ transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }} /> : null}
    </View>
  );
  return (
    <View style={styles.card} testID={`checklist-${subject}`}>
      {onToggle ? (
        <PressableScale onPress={onToggle} pressedScale={0.99} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} accessibilityLabel={`${SECTION_COPY[section].title}, ${statusA11y('verification', status)}, ${summary}`} testID={`toggle-${subject}`}>
          {header}
        </PressableScale>
      ) : (
        header
      )}
      {collapsed ? null : (
        <View style={{ marginTop: 8 }}>
          {GROUPS[section].map((g) => {
            const groupSteps = steps.filter((s) => g.steps.includes(s.id));
            const done = groupSteps.every((s) => isSignupStepDone(s, kase, ctx));
            const first = groupSteps.find((s) => !isSignupStepDone(s, kase, ctx)) ?? groupSteps[0]!;
            return (
              <PressableScale key={g.title} onPress={canEdit ? () => goToStep(first) : undefined} disabled={!canEdit} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`${g.title}, ${done ? 'complété' : 'à compléter'}`} testID={`group-${first.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 }}>
                  <Icon name={done ? 'circle-check' : 'circle-dashed'} size={20} tone={done ? 'success' : 'neutral'} testID={`group-status-${first.id}`} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label" numberOfLines={1}>
                      {g.title}
                    </Text>
                    {!done && canEdit ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        Prochaine question : {STEP_COPY[first.id].title}
                      </Text>
                    ) : null}
                  </View>
                  {canEdit ? <ChevronRight size={20} color={colors.muted} /> : null}
                </View>
              </PressableScale>
            );
          })}
          <View style={styles.divider} />
          {sectionItems(section).map((k) => (
            <DocumentRow key={k} kase={kase} item={k} section={section} />
          ))}
          {canEdit && p.next ? (
            <Button
              label={p.next.kind === 'review' ? (kase?.status === 'more_info_requested' ? 'Vérifier et renvoyer' : 'Vérifier et envoyer') : kase?.status === 'more_info_requested' ? 'Corriger' : p.done ? 'Continuer' : 'Commencer'}
              variant={p.next.kind === 'review' ? 'primary' : 'secondary'}
              full
              style={{ marginTop: 12 }}
              onPress={() => goToStep(p.next)}
              testID={`continue-${subject}`}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * D05: one dossier's review state, with the next step the driver can take. The note draws the C7 glyph
 * (A141). A dossier under review lists its documents under one count (D-34); a complement request is
 * the screen's one warning, with the number of pieces to redo (D-36).
 */
export function CaseReview({ kase, subject, recoverable, ctx }: { kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle' | 'driver_famille'; recoverable: string[]; ctx: SignupContext }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const reopen = useMutation({
    mutationFn: (id: string) => api.verification.reopen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const section: SignupSection = subject === 'vehicle' ? 'vehicle' : subject === 'driver_famille' ? 'famille' : 'person';
  const label = subject === 'vehicle' ? 'Véhicule' : subject === 'driver_famille' ? 'Naya Famille' : 'Chauffeuse';
  if (!kase || kase.status === 'draft') {
    const p = sectionProgress(section, kase, ctx);
    return (
      <ActionNote
        kind="verification"
        state="draft"
        title={`${label} · dossier à compléter`}
        message={`${sectionSummary(section, kase, ctx)}. Vos réponses sont enregistrées.`}
        action={{ label: p.done ? 'Reprendre' : 'Commencer', onPress: () => goToStep(p.next) }}
        testID={`review-${subject}`}
      />
    );
  }
  switch (kase.status) {
    case 'approved':
      return (
        <ActionNote
          kind="verification"
          state="approved"
          title={subject === 'vehicle' ? 'Véhicule approuvé' : subject === 'driver_famille' ? 'Agréée Naya Famille' : 'Chauffeuse approuvée'}
          message={subject === 'vehicle' ? 'Documents vérifiés par l’équipe Naya.' : subject === 'driver_famille' ? 'Vous pouvez recevoir des trajets Naya Famille.' : 'Identité et permis vérifiés par l’équipe Naya.'}
          testID={`review-${subject}`}
        />
      );
    case 'submitted':
    case 'in_review':
      return (
        <View style={styles.card} testID={`review-${subject}`}>
          <ActionNote kind="verification" state={kase.status} title={`${label} en attente d’examen`} message={kase.status === 'in_review' ? 'Une personne de l’équipe Naya examine vos documents.' : 'Votre dossier est envoyé. Une personne de l’équipe Naya va l’examiner.'} />
          <Text variant="caption" weight="semibold" tone="muted" accessibilityRole="header" style={{ marginTop: 14, marginLeft: 4 }} testID={`review-count-${subject}`}>
            {sectionSummary(section, kase, ctx)}
          </Text>
          <View style={{ marginTop: 2 }}>
            {sectionItems(section).map((k) => (
              <DocumentRow key={k} kase={kase} item={k} compact />
            ))}
          </View>
        </View>
      );
    case 'more_info_requested':
      return (
        <View style={{ gap: 12 }} testID={`review-${subject}`}>
          <ActionNote kind="verification" state="more_info_requested" title={`${label} · ${lowerFirst(sectionSummary(section, kase, ctx))}`} message={kase.decision?.message ?? 'Une pièce doit être reprise.'} />
          <SectionCard section={section} kase={kase} ctx={ctx} />
        </View>
      );
    case 'rejected': {
      const canRestart = recoverable.includes(kase.decision?.reasonCode ?? '');
      return (
        <ActionNote
          testID={`review-${subject}`}
          kind="verification"
          state="rejected"
          title={`${label} · dossier refusé`}
          message={kase.decision?.message ?? 'Le dossier n’a pas été approuvé.'}
          action={canRestart ? { label: reopen.isPending ? 'Ouverture…' : 'Recommencer', onPress: () => reopen.mutate(kase.id) } : { label: 'Assistance', onPress: () => router.push('/support/new') }}
        />
      );
    }
    default:
      return null;
  }
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 6 },
  }),
);
