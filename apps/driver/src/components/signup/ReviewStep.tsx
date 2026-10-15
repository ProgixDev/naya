import { themedStyles, colors } from '@naya/tokens';
import { useTheme, Button, ID_DOCUMENTS, StatusBanner, Text, TextButton, haptic, toast, type IdDocumentType } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import { draftView, sectionItems, sectionProgress, sectionSteps, type SignupSection, type VerificationCase } from '@naya/domain';
import { DocumentRow } from '../Dossier';
import { INTERVIEW_WINDOWS, formatFrDate, formatShortDay } from './copy';
import { goToStep, useSignup } from './useSignup';

function Line({ label, value, onEdit, testID }: { label: string; value: string; onEdit?: () => void; testID?: string }) {
  useTheme();
  return (
    <View style={styles.line} testID={testID}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="micro" tone="muted">
          {label}
        </Text>
        <Text variant="label">{value}</Text>
      </View>
      {onEdit ? <TextButton label="Modifier" onPress={onEdit} /> : null}
    </View>
  );
}

/** Answers of a section, each with a way back to its question. */
function Answers({ section, kase }: { section: SignupSection; kase: VerificationCase | null }) {
  const a = draftView(kase);
  const edit = (id: string) => () => router.push({ pathname: '/docs/step/[id]', params: { id } });
  if (section === 'person') {
    return (
      <>
        <Line label="Nom" value={`${a.firstName ?? '—'} ${a.lastName ?? ''}`} onEdit={edit('name')} />
        <Line label="Date de naissance" value={formatFrDate(a.birthDate)} onEdit={edit('birth')} />
        <Line label="Adresse" value={[a.address, a.city].filter(Boolean).join(', ') || '—'} onEdit={edit('address')} />
        <Line label={ID_DOCUMENTS[(a.documentType ?? 'cin') as IdDocumentType].numberLabel} value={a.documentNumber ?? '—'} onEdit={edit('id_document')} />
        <Line label="Permis" value={`${a.licenceNumber ?? '—'} · catégorie ${a.licenceCategory ?? '—'}`} onEdit={edit('licence_number')} />
        <Line label="Validité du permis" value={`${formatFrDate(a.licenceIssueDate)} → ${formatFrDate(a.licenceExpiryDate)}`} onEdit={edit('licence_dates')} />
        <Line label="Expérience de conduite" value={`${a.experienceYears ?? 0} an${(a.experienceYears ?? 0) > 1 ? 's' : ''}`} onEdit={edit('experience')} />
      </>
    );
  }
  if (section === 'vehicle') {
    return (
      <>
        <Line label="Véhicule" value={`${a.make ?? '—'} ${a.model ?? ''} · ${a.year ?? '—'}`} onEdit={edit('vehicle_model')} />
        <Line label="Immatriculation et couleur" value={`${a.plate ?? '—'} · ${a.color ?? '—'}`} onEdit={edit('vehicle_plate')} />
      </>
    );
  }
  return (
    <>
      <Line label="Références" value={`${a.reference1Name ?? '—'} · ${a.reference2Name ?? '—'}`} onEdit={edit('famille_references')} />
      <Line label="Expérience avec les enfants" value={`${a.childExperienceYears ?? 0} an${(a.childExperienceYears ?? 0) > 1 ? 's' : ''}`} onEdit={edit('famille_experience')} />
      <Line label="Formation" value={a.trainingAcknowledged ? 'Engagement confirmé' : 'À confirmer'} onEdit={edit('famille_training')} />
      <Line label="Entretien souhaité" value={a.interviewDay && a.interviewWindow ? `${formatShortDay(a.interviewDay)} · ${INTERVIEW_WINDOWS[a.interviewWindow].label.toLowerCase()}` : '—'} onEdit={edit('famille_interview')} />
    </>
  );
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
        <Text variant="caption" weight="semibold" tone="muted" style={{ marginBottom: 4 }}>
          Documents · {items.length}
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
    line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  }),
);
