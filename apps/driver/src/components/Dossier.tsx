import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Circle, Clock, FileText, XCircle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS, REQUIRED_ITEMS, STATUS_LABELS, type VerificationCase, type VerificationItemKey } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, ListGroup, ListRow, StatusBanner, StatusPill, Text, toast, haptic, type BannerTone } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export const statusTone = (s: VerificationCase['status']): BannerTone =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'more_info_requested' ? 'warning' : s === 'draft' ? 'neutral' : 'info';

const itemIcon = (status: string) =>
  status === 'accepted' ? <CheckCircle2 size={20} color={colors.success} /> : status === 'provided' ? <CheckCircle2 size={20} color={colors.accent} /> : status === 'needs_correction' ? <AlertTriangle size={20} color={colors.warning} /> : <Circle size={20} color={colors.line} />;

const itemStatusLabel = (status: string) => (status === 'accepted' ? 'Validée' : status === 'provided' ? 'Ajoutée' : status === 'needs_correction' ? 'À reprendre' : 'À ajouter');

export function isComplete(c: VerificationCase) {
  const detailsOk = c.subject === 'vehicle' ? !!c.vehicle : !!c.identity;
  return detailsOk && REQUIRED_ITEMS[c.subject].every((k) => {
    const i = c.items.find((x) => x.key === k);
    return i && i.uploadIds.length > 0 && (i.status === 'provided' || i.status === 'accepted');
  });
}

const editable = (c: VerificationCase) => c.status === 'draft' || c.status === 'more_info_requested';

/** Steps of one dossier with their state; each row opens the step when it can be edited. */
export function CaseChecklist({ kase, subject }: { kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle' }) {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const submit = useMutation({
    mutationFn: (id: string) => api.verification.submit(id),
    onSuccess: () => {
      haptic.success();
      toast('Dossier envoyé pour examen');
      qc.invalidateQueries({ queryKey: qk.me(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const isVehicle = subject === 'vehicle';
  const canEdit = !kase || editable(kase);
  const details = isVehicle ? kase?.vehicle : kase?.identity;
  const items: VerificationItemKey[] = REQUIRED_ITEMS[subject];
  const title = isVehicle ? 'Véhicule' : 'Identité et permis';
  return (
    <View style={{ gap: 12 }} testID={`checklist-${subject}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        <StatusPill tone={statusTone(kase?.status ?? 'draft')} label={STATUS_LABELS[kase?.status ?? 'draft']} />
      </View>
      <ListGroup>
        <ListRow
          title={isVehicle ? 'Informations du véhicule' : 'Informations personnelles'}
          subtitle={details ? (isVehicle ? `${kase!.vehicle!.make} ${kase!.vehicle!.model} · ${kase!.vehicle!.plate}` : `${kase!.identity!.firstName} ${kase!.identity!.lastName}`) : 'À compléter'}
          leading={details ? <CheckCircle2 size={20} color={colors.accent} /> : <Circle size={20} color={colors.line} />}
          onPress={canEdit ? () => router.push(isVehicle ? '/docs/vehicle' : '/docs/identity') : undefined}
          testID={`step-${subject}-details`}
        />
        {items.map((key) => {
          const item = kase?.items.find((i) => i.key === key);
          const status = item?.status ?? 'missing';
          return (
            <ListRow
              key={key}
              title={ITEM_LABELS[key]}
              subtitle={item?.note ?? itemStatusLabel(status)}
              leading={itemIcon(status)}
              onPress={canEdit && (isVehicle ? !!kase : true) ? () => router.push({ pathname: '/docs/capture/[item]', params: { item: key } }) : undefined}
              testID={`step-${key}`}
            />
          );
        })}
      </ListGroup>
      {isVehicle && !kase ? <Text variant="caption" tone="muted">Commencez par les informations du véhicule pour ajouter ses documents.</Text> : null}
      {kase && canEdit ? (
        <Button
          label={kase.status === 'more_info_requested' ? 'Renvoyer le complément' : `Envoyer le dossier ${isVehicle ? 'véhicule' : 'identité'}`}
          full
          disabled={!isComplete(kase)}
          disabledReason={!isComplete(kase) ? 'Ajoutez toutes les pièces pour envoyer.' : undefined}
          loading={submit.isPending}
          onPress={() => submit.mutate(kase.id)}
          testID={`submit-${subject}`}
        />
      ) : null}
    </View>
  );
}

/** D05: one dossier's review state, with the next step the driver can take. */
export function CaseReview({ kase, subject, recoverable }: { kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle'; recoverable: string[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const reopen = useMutation({
    mutationFn: (id: string) => api.verification.reopen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const label = subject === 'vehicle' ? 'Véhicule' : 'Chauffeuse';
  if (!kase || kase.status === 'draft') {
    return <StatusBanner tone="neutral" title={`${label} · dossier à compléter`} message="Ajoutez les pièces demandées puis envoyez le dossier." icon={<FileText size={20} color={colors.accent} />} action={{ label: 'Compléter', onPress: () => router.push("/docs/start") }} testID={`review-${subject}`} />;
  }
  switch (kase.status) {
    case 'approved':
      return <StatusBanner tone="success" title={subject === 'vehicle' ? 'Véhicule approuvé' : 'Chauffeuse approuvée'} message={subject === 'vehicle' ? 'Documents du véhicule vérifiés manuellement.' : 'Identité et permis examinés manuellement.'} testID={`review-${subject}`} />;
    case 'submitted':
    case 'in_review':
      return <StatusBanner tone="info" title={`${label} en attente d’examen`} message="Une personne de l’équipe Naya examine vos documents. L’envoi n’est pas une validation." icon={<Clock size={20} color={colors.info} />} testID={`review-${subject}`} />;
    case 'more_info_requested':
      return (
        <View style={{ gap: 12 }} testID={`review-${subject}`}>
          <StatusBanner tone="warning" title={`${label} · complément demandé`} message={kase.decision?.message ?? 'Une pièce doit être reprise.'} />
          <CaseChecklist kase={kase} subject={subject} />
        </View>
      );
    case 'rejected': {
      const canRestart = recoverable.includes(kase.decision?.reasonCode ?? '');
      return (
        <StatusBanner
          testID={`review-${subject}`}
          tone="danger"
          icon={<XCircle size={20} color={colors.danger} />}
          title={`${label} · dossier refusé`}
          message={kase.decision?.message ?? 'Le dossier n’a pas été approuvé.'}
          action={canRestart ? { label: reopen.isPending ? 'Ouverture…' : 'Recommencer le dossier', onPress: () => reopen.mutate(kase.id) } : { label: 'Contacter l’assistance', onPress: () => router.push('/support/new') }}
        />
      );
    }
    default:
      return null;
  }
}
