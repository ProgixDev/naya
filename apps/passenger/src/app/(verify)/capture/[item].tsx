import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react-native';
import { qk } from '@naya/api';
import type { VerificationItemKey } from '@naya/domain';
import { colors } from '@naya/tokens';
import { CaptureStep, Header, Screen, Text } from '@naya/ui';
import { useAccountId, useIdentityCase } from '@/lib/queries';
import { nextStep, PASSENGER_STEPS } from '@/features/verify/steps';

export default function Capture() {
  const { item, correction } = useLocalSearchParams<{ item: VerificationItemKey; correction?: string }>();
  const qc = useQueryClient();
  const a = useAccountId();
  const { identity } = useIdentityCase();
  const index = PASSENGER_STEPS.findIndex((s) => s.key === item);
  const step = PASSENGER_STEPS[index];
  if (!step || !identity) return <Screen><View /></Screen>;
  const existing = identity.items.find((i) => i.key === item);
  return (
    <Screen header={<Header title={step.title} subtitle={correction ? 'Correction demandée' : undefined} progress={correction ? undefined : { step: index + 2, total: 4 }} onBack={() => router.back()} />}>
      <View style={{ marginTop: 16, gap: 14 }}>
        <CaptureStep
          caseId={identity.id}
          item={step.key}
          guidance={step.guidance}
          selfie={step.selfie}
          correctionNote={existing?.status === 'needs_correction' ? existing.note : null}
          existingUploadId={existing?.status === 'provided' ? existing.uploadIds[0] : null}
          onSaved={(c) => {
            qc.setQueryData(qk.me(a), (old: unknown) => (old && typeof old === 'object' ? { ...(old as object), cases: [c] } : old));
            qc.invalidateQueries({ queryKey: qk.me(a) });
            if (correction) return router.replace('/(verify)/review');
            const next = nextStep(step.key);
            if (next) router.push({ pathname: '/(verify)/capture/[item]', params: { item: next } });
            else router.push('/(verify)/review');
          }}
        />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Lock size={13} color={colors.muted} />
          <Text variant="micro" tone="muted">Chiffré · visible uniquement par l’équipe de vérification</Text>
        </View>
      </View>
    </Screen>
  );
}
