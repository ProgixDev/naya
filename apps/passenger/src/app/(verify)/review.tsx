import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Circle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Header, ListGroup, ListRow, Screen, StatusBanner, haptic, toast } from '@naya/ui';
import { useAccountId, useIdentityCase } from '@/lib/queries';
import { PASSENGER_STEPS } from '@/features/verify/steps';

/** P04-review: check every piece, then send for manual review. */
export default function Review() {
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
  const missing = PASSENGER_STEPS.filter((s) => {
    const it = identity.items.find((i) => i.key === s.key);
    return !it || it.uploadIds.length === 0 || it.status === 'needs_correction' || it.status === 'missing';
  });
  const resubmission = identity.status === 'more_info_requested';
  return (
    <Screen
      header={<Header title="Vérifier et envoyer" subtitle={resubmission ? 'Complément à envoyer' : '4 sur 4 · Dernière étape'} onBack={() => router.back()} />}
      footer={<Button label={resubmission ? 'Envoyer le complément' : 'Envoyer mon dossier'} size="major" full disabled={missing.length > 0} disabledReason={missing.length ? 'Ajoutez les pièces manquantes.' : undefined} loading={submit.isPending} onPress={() => submit.mutate()} testID="submit-identity" />}
    >
      <View style={{ gap: 20, marginTop: 12 }}>
        <ListGroup label="Informations">
          <ListRow title={`${identity.identity?.firstName ?? ''} ${identity.identity?.lastName ?? ''}`.trim() || 'À compléter'} subtitle={identity.identity ? `Née le ${identity.identity.birthDate.split('-').reverse().join('/')} · ${identity.identity.documentNumber}` : undefined} onPress={identity.status === 'draft' ? () => router.push('/(verify)/identity') : undefined} />
        </ListGroup>
        <ListGroup label="Pièces">
          {PASSENGER_STEPS.map((s) => {
            const it = identity.items.find((i) => i.key === s.key);
            const ok = it && it.uploadIds.length > 0 && it.status !== 'needs_correction' && it.status !== 'missing';
            const fix = it?.status === 'needs_correction';
            return (
              <ListRow
                key={s.key}
                testID={`review-${s.key}`}
                title={ITEM_LABELS[s.key]}
                subtitle={fix ? it?.note ?? 'À reprendre' : ok ? 'Ajoutée' : 'Manquante'}
                leading={ok ? <CheckCircle2 size={22} color={colors.success} /> : fix ? <CircleAlert size={22} color={colors.warning} /> : <Circle size={22} color={colors.muted} />}
                onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: s.key, correction: identity.status === 'more_info_requested' ? '1' : undefined } })}
              />
            );
          })}
        </ListGroup>
        <StatusBanner tone="info" title="Envoyer n’est pas encore une validation" message="Une personne de l’équipe Naya examine chaque dossier. Vous recevrez la décision dans l’application." />
      </View>
    </Screen>
  );
}
