import { themedStyles, colors } from '@naya/tokens';
import { useTheme, Button, ID_DOCUMENTS, PressableScale, StatusBanner, Text, haptic, toast, type IdDocumentType } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import { documentStatus, draftView, sectionItems, sectionProgress, sectionSteps, type DocumentStatus, type SignupSection, type VerificationCase } from '@naya/domain';
import { DocumentRow } from '../Dossier';
import { INTERVIEW_WINDOWS, formatFrDate, formatShortDay } from './copy';
import { goToStep, useSignup } from './useSignup';

/** Shown for an answer not given yet, in grey (D-42). */
const TODO = 'À compléter';

/**
 * One answer. The whole row opens its question (D-42): no accent « Modifier » link on every line, so the
 * accent appears once, on the send button. A missing answer reads « À compléter » in grey.
 */
function Line({ label, value, onEdit, testID }: { label: string; value: string | null; onEdit: () => void; testID?: string }) {
  useTheme();
  return (
    <PressableScale onPress={onEdit} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`${label}, ${value ?? 'à compléter'}`} accessibilityHint="Modifier cette réponse" testID={testID}>
      <View style={styles.line}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" tone="muted">
            {label}
          </Text>
          <Text variant="label" tone={value ? 'ink' : 'muted'}>
            {value ?? TODO}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </View>
    </PressableScale>
  );
}

/** The answer, or null when any of its parts is missing. */
const all = (parts: (string | number | null | undefined)[], text: string) => (parts.every((x) => x !== undefined && x !== null && x !== '') ? text : null);
const years = (n: number) => `${n} an${n > 1 ? 's' : ''}`;

/** Answers of a section, each with a way back to its question. */
function Answers({ section, kase }: { section: SignupSection; kase: VerificationCase | null }) {
  const a = draftView(kase);
  const edit = (id: string) => () => router.push({ pathname: '/docs/step/[id]', params: { id } });
  if (section === 'person') {
    const idLabel = ID_DOCUMENTS[(a.documentType ?? 'cin') as IdDocumentType].numberLabel;
    return (
      <>
        <Line label="Nom" value={all([a.firstName, a.lastName], `${a.firstName} ${a.lastName}`)} onEdit={edit('name')} testID="review-line-name" />
        <Line label="Date de naissance" value={all([a.birthDate], formatFrDate(a.birthDate))} onEdit={edit('birth')} testID="review-line-birth" />
        <Line label="Adresse" value={all([a.address, a.city], `${a.address}, ${a.city}`)} onEdit={edit('address')} testID="review-line-address" />
        <Line label={idLabel} value={all([a.documentNumber], a.documentNumber ?? '')} onEdit={edit('id_document')} testID="review-line-id_document" />
        <Line label="Permis" value={all([a.licenceNumber, a.licenceCategory], `${a.licenceNumber} · catégorie ${a.licenceCategory}`)} onEdit={edit('licence_number')} testID="review-line-licence_number" />
        <Line label="Validité du permis" value={all([a.licenceIssueDate, a.licenceExpiryDate], `${formatFrDate(a.licenceIssueDate)} → ${formatFrDate(a.licenceExpiryDate)}`)} onEdit={edit('licence_dates')} testID="review-line-licence_dates" />
        <Line label="Expérience de conduite" value={all([a.experienceYears], years(a.experienceYears ?? 0))} onEdit={edit('experience')} testID="review-line-experience" />
      </>
    );
  }
  if (section === 'vehicle') {
    return (
      <>
        <Line label="Véhicule" value={all([a.make, a.model, a.year], `${a.make} ${a.model} · ${a.year}`)} onEdit={edit('vehicle_model')} testID="review-line-vehicle_model" />
        <Line label="Immatriculation et couleur" value={all([a.plate, a.color], `${a.plate} · ${a.color}`)} onEdit={edit('vehicle_plate')} testID="review-line-vehicle_plate" />
      </>
    );
  }
  return (
    <>
      <Line label="Références" value={all([a.reference1Name, a.reference2Name], `${a.reference1Name} · ${a.reference2Name}`)} onEdit={edit('famille_references')} testID="review-line-famille_references" />
      <Line label="Expérience avec les enfants" value={all([a.childExperienceYears], years(a.childExperienceYears ?? 0))} onEdit={edit('famille_experience')} testID="review-line-famille_experience" />
      <Line label="Formation" value={a.trainingAcknowledged ? 'Engagement confirmé' : null} onEdit={edit('famille_training')} testID="review-line-famille_training" />
      <Line label="Entretien souhaité" value={a.interviewDay && a.interviewWindow ? `${formatShortDay(a.interviewDay)} · ${INTERVIEW_WINDOWS[a.interviewWindow].label.toLowerCase()}` : null} onEdit={edit('famille_interview')} testID="review-line-famille_interview" />
    </>
  );
}

/** « 8 documents · 3 à ajouter »: the count over the document rows, which then show one glyph each. */
function sectionSummaryLine(statuses: DocumentStatus[]) {
  const missing = statuses.filter((x) => x === 'missing' || x === 'rejected').length;
  return `${statuses.length} documents${missing ? ` · ${missing} à ajouter` : ''}`;
}

/**
 * Last step of a section: every answer and document with its status, then one action to
 * send it for manual review. The decision always comes from the reviewer, never from here.
 */
export function ReviewStep({ section }: { section: SignupSection }) {
  useTheme();
  const api = useApi();
  const { caseOf, ctx, store } = useSignup();
  const kase = caseOf(section);
  const progress = sectionProgress(section, kase, ctx);
  const remaining = progress.total - progress.done;
  const resend = kase?.status === 'more_info_requested';
  const send = useMutation({
    mutationFn: () => api.verification.submit(kase!.id),
    onSuccess: (c) => {
      store(c);
      haptic.success();
      toast(section === 'famille' ? 'Candidature envoyée' : resend ? 'Complément envoyé' : 'Dossier envoyé pour examen');
      if (section === 'person') {
        const vehicleNext = sectionProgress('vehicle', caseOf('vehicle'), ctx).next;
        return vehicleNext ? goToStep(vehicleNext, 'replace') : router.replace('/docs/status');
      }
      router.replace('/docs/status');
    },
    onError: (e) => {
      haptic.error();
      toast(errorMessage(e), 'danger');
    },
  });
  const items = sectionItems(section);
  const firstOpen = sectionSteps(section).find((s) => s.kind !== 'review' && s.id === progress.next?.id);
  return (
    <View style={{ gap: 16 }} testID={`review-step-${section}`}>
      <View style={styles.card}>
        <Answers section={section} kase={kase} />
      </View>
      <View style={styles.card}>
        <Text variant="caption" weight="semibold" tone="muted" accessibilityRole="header" style={{ marginTop: 8, marginBottom: 2 }}>
          {sectionSummaryLine(items.map((k) => documentStatus(kase, k).status))}
        </Text>
        {items.map((k) => (
          <DocumentRow key={k} kase={kase} item={k} compact />
        ))}
      </View>
      {remaining > 0 ? (
        <StatusBanner compact tone="warning" title={`${remaining} étape${remaining > 1 ? 's' : ''} à compléter`} message="Complétez-les pour pouvoir envoyer." action={firstOpen ? { label: 'Compléter', onPress: () => goToStep(firstOpen) } : undefined} />
      ) : null}
      <Button
        label={resend ? 'Renvoyer le complément' : section === 'famille' ? 'Envoyer ma candidature' : 'Envoyer mon dossier'}
        size="major"
        full
        disabled={remaining > 0 || !kase}
        disabledReason={remaining > 0 ? 'Il reste des étapes à compléter.' : undefined}
        loading={send.isPending}
        loadingLabel="Envoi…"
        onPress={() => send.mutate()}
        testID={`submit-${kase?.subject ?? section}`}
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: colors.hairline },
    line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  }),
);
