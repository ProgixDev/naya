import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { ITEM_LABELS, REQUIRED_ITEMS, verificationItemKeySchema, type VerificationItemKey } from '@naya/domain';
import { CaptureStep, ErrorState, Header, Screen } from '@naya/ui';
import { useAccountId, useCases } from '@/lib/queries';

const GUIDANCE: Record<VerificationItemKey, string> = {
  selfie: 'Visage bien éclairé, sans lunettes de soleil. Le selfie sert uniquement à comparer avec votre pièce.',
  id_front: 'Posez la pièce à plat, en entier, sans reflet.',
  id_back: 'Retournez la pièce et photographiez le verso en entier.',
  driving_licence: 'Le permis en entier, lisible, à plat et en pleine lumière.',
  vehicle_registration: 'La carte grise du véhicule déclaré, en entier.',
  insurance: 'L’attestation d’assurance en cours de validité.',
  vehicle_photos: 'Le véhicule de trois quarts avant, plaque visible.',
};

/** D04-capture / D04-camera / D04-permit / D04-insurance / D04-photos. */
export default function Capture() {
  const params = useLocalSearchParams<{ item: string }>();
  const parsed = verificationItemKeySchema.safeParse(params.item);
  const qc = useQueryClient();
  const a = useAccountId();
  const { person, vehicle } = useCases();
  if (!parsed.success) return <Screen header={<Header onBack={() => router.back()} />}><ErrorState title="Pièce inconnue" /></Screen>;
  const item = parsed.data;
  const kase = ['vehicle_registration', 'insurance', 'vehicle_photos'].includes(item) ? vehicle : person;
  if (!kase) return <Screen header={<Header onBack={() => router.back()} />}><ErrorState title="Dossier introuvable" message="Renseignez d’abord les informations du véhicule." /></Screen>;
  const existing = kase.items.find((i) => i.key === item);
  // Step position inside the dossier: details first, then each required item.
  const steps = REQUIRED_ITEMS[kase.subject];
  return (
    <Screen header={<Header title={ITEM_LABELS[item]} onBack={() => router.back()} progress={{ step: steps.indexOf(item) + 2, total: steps.length + 1 }} />}>
      <View style={{ marginTop: 4 }}>
        <CaptureStep
          caseId={kase.id}
          item={item}
          selfie={item === 'selfie'}
          guidance={GUIDANCE[item]}
          correctionNote={existing?.status === 'needs_correction' ? existing.note : null}
          existingUploadId={existing?.uploadIds[0] ?? null}
          onSaved={(c) => {
            qc.setQueryData(qk.me(a), (old: { cases: typeof c[] } | undefined) => (old ? { ...old, cases: old.cases.map((x) => (x.id === c.id ? c : x)) } : old));
            qc.invalidateQueries({ queryKey: qk.me(a) });
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
