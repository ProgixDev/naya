import { useTheme , Button, Header, ListGroup, ListRow, Screen, StatusBanner, StatusIcon, haptic, toast } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS, type VerificationItem } from '@naya/domain';
import { useAccountId, useIdentityCase } from '@/lib/queries';
import { PASSENGER_STEPS } from '@/features/verify/steps';

type ItemState = VerificationItem['status'];

/**
 * P04-review: every piece on one list, then send for manual review. One C9 glyph per row (A100): the word shows
 * only for a piece to retake (« À reprendre », with the reviewer's note); « Ajoutée » and « À ajouter » are read
 * aloud, not written. The row's testID carries the state in its accessibility label (« pièce ajoutée »).
 */
export default function Review() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const { identity } = useIdentityCase();
  const submit = useMutation({
    mutationFn: () => api.verification.submit(identity!.id),
    onSuccess: async () => {
      haptic.success();
      await qc.invalidateQueries({ queryKey: qk.me(a) });
      await qc.invalidateQueries({ queryKey: qk.verification(a) });
      router.dismissTo('/(verify)/verification-status');
    },
    onError: (e) => {
      haptic.error();
      toast(errorMessage(e), 'danger');
    },
  });
  if (!identity) return null;
  const stateOf = (key: (typeof PASSENGER_STEPS)[number]['key']): ItemState => {
    const it = identity.items.find((i) => i.key === key);
    if (it?.status === 'needs_correction') return 'needs_correction';
    return it && it.uploadIds.length > 0 && it.status !== 'missing' ? it.status : 'missing';
  };
  const ready = (s: ItemState) => s === 'provided' || s === 'accepted';
  const missing = PASSENGER_STEPS.filter((s) => !ready(stateOf(s.key)));
  const resubmission = identity.status === 'more_info_requested';
  const openStep = (key: string) => router.push({ pathname: '/(verify)/capture/[item]', params: { item: key, correction: resubmission ? '1' : undefined } });
  const done = PASSENGER_STEPS.length - missing.length + (identity.identity ? 1 : 0);
  const details: ItemState = identity.identity ? 'provided' : 'missing';
  return (
    <Screen
      header={<Header title="Votre dossier" subtitle={resubmission ? 'Reprenez la pièce signalée, puis renvoyez.' : `${done} sur 4 éléments prêts`} onBack={() => router.back()} />}
      footer={
        missing.length > 0 ? (
          <Button label={`Continuer · ${ITEM_LABELS[missing[0]!.key]}`} full onPress={() => openStep(missing[0]!.key)} testID="submit-identity" />
        ) : (
          <Button label={resubmission ? 'Envoyer le complément' : 'Envoyer mon dossier'} full loading={submit.isPending} onPress={() => submit.mutate()} testID="submit-identity" />
        )
      }
    >
      <View style={{ gap: 14, marginTop: 14 }}>
        <ListGroup>
          <ListRow
            title="Informations"
            subtitle={identity.identity ? `${identity.identity.firstName} ${identity.identity.lastName} · ${identity.identity.birthDate.split('-').reverse().join('/')}` : undefined}
            status={<StatusIcon kind="verificationItem" state={details} testID="review-details-status" />}
            onPress={identity.status === 'draft' ? () => router.push('/(verify)/identity') : undefined}
            testID="review-details"
          />
          {PASSENGER_STEPS.map((s) => {
            const st = stateOf(s.key);
            const it = identity.items.find((i) => i.key === s.key);
            return (
              <ListRow
                key={s.key}
                testID={`review-${s.key}`}
                title={ITEM_LABELS[s.key]}
                subtitle={st === 'needs_correction' ? (it?.note ?? undefined) : undefined}
                status={<StatusIcon kind="verificationItem" state={st} testID={`review-${s.key}-status`} />}
                onPress={() => openStep(s.key)}
              />
            );
          })}
        </ListGroup>
        <StatusBanner compact tone="neutral" title="L’envoi n’est pas une validation" message="une personne examine chaque dossier" />
      </View>
    </Screen>
  );
}
