import { useTheme , Button, Header, ListGroup, ListRow, Screen, StatusBanner, haptic, toast } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Circle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId, useIdentityCase } from '@/lib/queries';
import { PASSENGER_STEPS } from '@/features/verify/steps';

/** P04-review: Persona-style hub — every piece on one card, then send for manual review. */
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
  const stateOf = (key: (typeof PASSENGER_STEPS)[number]['key']) => {
    const it = identity.items.find((i) => i.key === key);
    if (it?.status === 'needs_correction') return 'fix' as const;
    return it && it.uploadIds.length > 0 && it.status !== 'missing' ? ('ok' as const) : ('todo' as const);
  };
  const missing = PASSENGER_STEPS.filter((s) => stateOf(s.key) !== 'ok');
  const resubmission = identity.status === 'more_info_requested';
  const icon = (s: 'ok' | 'fix' | 'todo') => (s === 'ok' ? <CheckCircle2 size={22} color={colors.success} /> : s === 'fix' ? <CircleAlert size={22} color={colors.warning} /> : <Circle size={22} color={colors.line} />);
  const openStep = (key: string) => router.push({ pathname: '/(verify)/capture/[item]', params: { item: key, correction: resubmission ? '1' : undefined } });
  const done = PASSENGER_STEPS.length - missing.length + (identity.identity ? 1 : 0);
  return (
    <Screen
      header={<Header title="Votre dossier" subtitle={resubmission ? 'Reprenez la pièce signalée, puis renvoyez.' : `${done} sur 4 éléments prêts`} onBack={() => router.back()} />}
      footer={
        missing.length > 0 ? (
          <Button label={`Continuer · ${ITEM_LABELS[missing[0]!.key]}`} size="major" full onPress={() => openStep(missing[0]!.key)} testID="submit-identity" />
        ) : (
          <Button label={resubmission ? 'Envoyer le complément' : 'Envoyer mon dossier'} size="major" full loading={submit.isPending} onPress={() => submit.mutate()} testID="submit-identity" />
        )
      }
    >
      <View style={{ gap: 14, marginTop: 14 }}>
        <ListGroup>
          <ListRow
            title="Informations"
            subtitle={identity.identity ? `${identity.identity.firstName} ${identity.identity.lastName} · ${identity.identity.birthDate.split('-').reverse().join('/')}` : 'À compléter'}
            leading={icon(identity.identity ? 'ok' : 'todo')}
            onPress={identity.status === 'draft' ? () => router.push('/(verify)/identity') : undefined}
            testID="review-details"
          />
          {PASSENGER_STEPS.map((s) => {
            const st = stateOf(s.key);
            const it = identity.items.find((i) => i.key === s.key);
            return (
              <ListRow key={s.key} testID={`review-${s.key}`} title={ITEM_LABELS[s.key]} subtitle={st === 'fix' ? (it?.note ?? 'À reprendre') : st === 'ok' ? 'Ajoutée' : 'À ajouter'} leading={icon(st)} onPress={() => openStep(s.key)} />
            );
          })}
        </ListGroup>
        <StatusBanner compact tone="neutral" title="L’envoi n’est pas une validation" message="une personne examine chaque dossier" />
      </View>
    </Screen>
  );
}
