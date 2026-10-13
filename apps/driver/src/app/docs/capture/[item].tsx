import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ITEM_LABELS, sectionOfItem, sectionSteps, verificationItemKeySchema } from '@naya/domain';
import { CaptureStep, ErrorState, Header, Screen } from '@naya/ui';
import { STEP_COPY } from '@/components/signup/copy';
import { useSignup } from '@/components/signup/useSignup';

/**
 * One document on its own (from the dossier or the review: « Renvoyer »): the same guided
 * capture as the sign-up, then back to where the driver came from.
 */
export default function Capture() {
  const params = useLocalSearchParams<{ item: string }>();
  const parsed = verificationItemKeySchema.safeParse(params.item);
  const { caseOf, store } = useSignup();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/docs/start'));
  const section = parsed.success ? sectionOfItem(parsed.data) : null;
  if (!parsed.success || !section) return <Screen header={<Header onBack={back} />}><ErrorState title="Pièce inconnue" /></Screen>;
  const item = parsed.data;
  const kase = caseOf(section);
  if (!kase) return <Screen header={<Header onBack={back} />}><ErrorState title="Dossier introuvable" message={section === 'vehicle' ? 'Renseignez d’abord les informations du véhicule.' : 'Ouvrez d’abord votre candidature Naya Famille.'} /></Screen>;
  const existing = kase.items.find((i) => i.key === item);
  const steps = sectionSteps(section);
  const copy = STEP_COPY[item];
  return (
    <Screen header={<Header title={ITEM_LABELS[item]} subtitle={existing?.status === 'needs_correction' ? 'Pièce refusée · à renvoyer' : copy.help} onBack={back} progress={{ step: steps.findIndex((s) => s.id === item) + 1, total: steps.length }} />}>
      <View style={{ marginTop: 4 }}>
        <CaptureStep
          guided
          caseId={kase.id}
          item={item}
          selfie={item === 'selfie'}
          guidance={copy.help ?? ''}
          correctionNote={existing?.status === 'needs_correction' ? existing.note : null}
          existingUploadId={existing && existing.status !== 'needs_correction' ? (existing.uploadIds[0] ?? null) : null}
          onSaved={(c) => {
            store(c);
            back();
          }}
        />
      </View>
    </Screen>
  );
}
