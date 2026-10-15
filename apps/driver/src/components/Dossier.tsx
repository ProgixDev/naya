import { themedStyles, colors, shadow } from '@naya/tokens';
import { useTheme, Button, IconDisc, PressableScale, StatusPill, Text, toast, type BannerTone } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Baby, Car, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, FileText, UploadCloud, UserRound, XCircle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import {
  DOCUMENT_STATUS_LABELS,
  ITEM_LABELS,
  STATUS_LABELS,
  documentStatus,
  isSignupStepDone,
  sectionItems,
  sectionProgress,
  sectionSteps,
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

export const statusTone = (s: VerificationCase['status']): BannerTone =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'more_info_requested' ? 'warning' : s === 'draft' ? 'neutral' : 'info';

const DOC_TONE: Record<DocumentStatus, BannerTone> = { missing: 'neutral', sent: 'info', in_review: 'info', approved: 'success', rejected: 'danger' };

function DocIcon({ status }: { status: DocumentStatus }) {
  useTheme();
  switch (status) {
    case 'approved':
      return <CheckCircle2 size={18} color={colors.success} />;
    case 'sent':
      return <UploadCloud size={18} color={colors.accent} />;
    case 'in_review':
      return <Clock size={18} color={colors.info} />;
    case 'rejected':
      return <XCircle size={18} color={colors.danger} />;
    default:
      return <Circle size={18} color={colors.line} />;
  }
}

const editable = (c: VerificationCase | null) => !c || c.status === 'draft' || c.status === 'more_info_requested';

/**
 * One document with its status (manquant → envoyé → en vérification → approuvé / refusé).
 * A refusal shows the reviewer's reason and a « Renvoyer » action; while the dossier is
 * editable the row opens the guided capture.
 */
export function DocumentRow({ kase, item, compact }: { kase: VerificationCase | null; item: VerificationItemKey; compact?: boolean }) {
  useTheme();
  const { status, reason } = documentStatus(kase, item);
  const open = () => router.push({ pathname: '/docs/capture/[item]', params: { item } });
  const canOpen = !!kase && editable(kase);
  const label = `${ITEM_LABELS[item]}, ${DOCUMENT_STATUS_LABELS[status]}${reason ? `. Motif : ${reason}` : ''}`;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: compact ? 44 : 52, paddingVertical: 6 }}>
      <DocIcon status={status} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={2}>
          {ITEM_LABELS[item]}
        </Text>
        {reason ? (
          <Text variant="micro" tone="danger" numberOfLines={3}>
            {reason}
          </Text>
        ) : null}
      </View>
      {status === 'rejected' && canOpen ? (
        <Button label="Renvoyer" variant="secondary" size="compact" onPress={open} testID={`resend-${item}`} />
      ) : (
        <StatusPill tone={DOC_TONE[status]} label={DOCUMENT_STATUS_LABELS[status]} testID={`doc-status-${item}`} />
      )}
      {canOpen && status !== 'rejected' ? <ChevronRight size={16} color={colors.muted} /> : null}
    </View>
  );
  return canOpen && status !== 'rejected' ? (
    <PressableScale onPress={open} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={label} testID={`step-${item}`}>
      {body}
    </PressableScale>
  ) : (
    <View accessible={status !== 'rejected'} accessibilityLabel={label} testID={`step-${item}`}>
      {body}
    </View>
  );
}

const SECTION_ICON = { person: UserRound, vehicle: Car, famille: Baby } as const;

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
 * One section of the dossier as a card: icon, title, review status, done/total and a
 * progress bar; expanded, its question groups and each document with its own status.
 */
export function SectionCard({ section, kase, ctx, collapsed, onToggle }: { section: SignupSection; kase: VerificationCase | null; ctx: SignupContext; collapsed?: boolean; onToggle?: () => void }) {
  useTheme();
  const subject = section === 'person' ? 'driver_identity' : section === 'vehicle' ? 'vehicle' : 'driver_famille';
  const p = sectionProgress(section, kase, ctx);
  const status = kase?.status ?? 'draft';
  const Icon = SECTION_ICON[section];
  const steps = sectionSteps(section);
  const canEdit = editable(kase);
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconDisc size={40} tone={status === 'approved' ? 'success' : 'plain'}>
        <Icon size={19} color={status === 'approved' ? colors.success : colors.accent} />
      </IconDisc>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="label" weight="semibold" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {SECTION_COPY[section].title}
          </Text>
          <Text variant="micro" tone="muted" numeric>
            {p.done}/{p.total}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusPill tone={statusTone(status)} label={STATUS_LABELS[status]} />
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${p.total ? (p.done / p.total) * 100 : 0}%`, backgroundColor: status === 'approved' ? colors.success : colors.accent }]} />
          </View>
        </View>
      </View>
      {onToggle ? <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }} /> : null}
    </View>
  );
  return (
    <View style={styles.card} testID={`checklist-${subject}`}>
      {onToggle ? (
        <PressableScale onPress={onToggle} pressedScale={0.99} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} accessibilityLabel={`${SECTION_COPY[section].title}, ${STATUS_LABELS[status]}, ${p.done} sur ${p.total} étapes`} testID={`toggle-${subject}`}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6 }}>
                  {done ? <CheckCircle2 size={18} color={colors.accent} /> : <Circle size={18} color={colors.line} />}
                  <View style={{ flex: 1 }}>
                    <Text variant="label" numberOfLines={1}>
                      {g.title}
                    </Text>
                    {!done && canEdit ? (
                      <Text variant="micro" tone="muted" numberOfLines={1}>
                        Prochaine question : {STEP_COPY[first.id].title}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="micro" weight="semibold" tone={done ? 'muted' : 'accent'}>
                    {done ? 'Complété' : 'À compléter'}
                  </Text>
                  {canEdit ? <ChevronRight size={16} color={colors.muted} /> : null}
                </View>
              </PressableScale>
            );
          })}
          <View style={styles.divider} />
          {sectionItems(section).map((k) => (
            <DocumentRow key={k} kase={kase} item={k} />
          ))}
          {canEdit && p.next ? (
            <Button
              label={p.next.kind === 'review' ? (kase?.status === 'more_info_requested' ? 'Vérifier et renvoyer' : 'Vérifier et envoyer') : kase?.status === 'more_info_requested' ? 'Corriger' : p.done ? 'Continuer' : 'Commencer'}
              variant={p.next.kind === 'review' ? 'primary' : 'secondary'}
              full
              style={{ marginTop: 10 }}
              onPress={() => goToStep(p.next)}
              testID={`continue-${subject}`}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/** D05: one dossier's review state, with the next step the driver can take. */
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
        tone="neutral"
        title={`${label} · dossier à compléter`}
        message={`${p.done} étape${p.done > 1 ? 's' : ''} sur ${p.total}. Vos réponses sont enregistrées.`}
        icon={<FileText size={18} color={colors.accent} />}
        action={{ label: p.done ? 'Reprendre' : 'Commencer', onPress: () => goToStep(p.next) }}
        testID={`review-${subject}`}
      />
    );
  }
  switch (kase.status) {
    case 'approved':
      return (
        <ActionNote
          tone="success"
          title={subject === 'vehicle' ? 'Véhicule approuvé' : subject === 'driver_famille' ? 'Agréée Naya Famille' : 'Chauffeuse approuvée'}
          message={subject === 'vehicle' ? 'Documents vérifiés par l’équipe Naya.' : subject === 'driver_famille' ? 'Vous pouvez recevoir des trajets Naya Famille.' : 'Identité et permis vérifiés par l’équipe Naya.'}
          testID={`review-${subject}`}
        />
      );
    case 'submitted':
    case 'in_review':
      return (
        <View style={styles.card} testID={`review-${subject}`}>
          <ActionNote tone="info" title={`${label} en attente d’examen`} message={kase.status === 'in_review' ? 'Une personne de l’équipe Naya examine vos documents.' : 'Votre dossier est envoyé. Une personne de l’équipe Naya va l’examiner.'} icon={<Clock size={18} color={colors.info} />} />
          <View style={{ marginTop: 6 }}>
            {sectionItems(section).map((k) => (
              <DocumentRow key={k} kase={kase} item={k} compact />
            ))}
          </View>
        </View>
      );
    case 'more_info_requested':
      return (
        <View style={{ gap: 12 }} testID={`review-${subject}`}>
          <ActionNote tone="warning" title={`${label} · complément demandé`} message={kase.decision?.message ?? 'Une pièce doit être reprise.'} icon={<AlertTriangle size={18} color={colors.warning} />} />
          <SectionCard section={section} kase={kase} ctx={ctx} />
        </View>
      );
    case 'rejected': {
      const canRestart = recoverable.includes(kase.decision?.reasonCode ?? '');
      return (
        <ActionNote
          testID={`review-${subject}`}
          tone="danger"
          icon={<XCircle size={18} color={colors.danger} />}
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
    card: { backgroundColor: colors.surface, borderRadius: 24, padding: 14, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
    track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.selected, overflow: 'hidden' },
    fill: { height: 4, borderRadius: 2 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 6 },
  }),
);
