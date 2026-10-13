import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import {
  draftView,
  findSignupStep,
  nextStepAfter,
  sectionSteps,
  validateSignupStep,
  type SignupDraft,
  type SignupStep,
} from '@naya/domain';
import { Button, CaptureStep, ErrorState, Header, Screen, StatusBanner, Text, haptic, toast, useTheme } from '@naya/ui';
import { QuestionFields } from '@/components/signup/Fields';
import { ReviewStep } from '@/components/signup/ReviewStep';
import { SECTION_COPY, STEP_COPY } from '@/components/signup/copy';
import { goToStep, useSignup } from '@/components/signup/useSignup';

/**
 * D04 · driver sign-up, one question per screen. The step comes from the URL, so every
 * screen can be resumed or deep-linked; answers are saved on the server before moving on.
 */
export default function SignupStepScreen() {
  useTheme();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const step = findSignupStep(id);
  const s = useSignup();
  if (!step) return <Screen header={<Header onBack={() => router.back()} />}><ErrorState title="Étape inconnue" /></Screen>;
  if (s.isLoading) return <Screen><View /></Screen>;
  const kase = s.caseOf(step.section);
  // Famille steps exist only after the opt-in; documents need their dossier.
  if (!kase && step.section === 'famille') return <Redirect href="/docs/famille" />;
  if (kase && kase.status !== 'draft' && kase.status !== 'more_info_requested') return <Redirect href="/docs/status" />;
  return <StepBody key={step.id} step={step} />;
}

function StepBody({ step }: { step: SignupStep }) {
  useTheme();
  const api = useApi();
  const { caseOf, ctx, store, ensureCase } = useSignup();
  const kase = caseOf(step.section);
  const steps = sectionSteps(step.section);
  const index = steps.findIndex((x) => x.id === step.id);
  const copy = STEP_COPY[step.id];
  const [answers, setAnswers] = useState<SignupDraft>(() => {
    const view = draftView(kase);
    // Sensible first answers: CIN, category B.
    if (step.id === 'id_document' && !view.documentType) view.documentType = 'cin';
    if (step.id === 'licence_number' && !view.licenceCategory) view.licenceCategory = 'B';
    return view;
  });
  const [tried, setTried] = useState(false);
  // Errors appear after the first « Continuer » and then follow every edit.
  const errors = tried && step.kind === 'question' ? validateSignupStep(step.id, answers, ctx) : {};

  const next = () => goToStep(nextStepAfter(step.id));
  const later = () => router.replace('/docs/start');

  const save = useMutation({
    mutationFn: async () => {
      if (step.kind !== 'question') return null;
      const c = await ensureCase(step.section);
      const patch = Object.fromEntries(step.fields.map((f) => [f, answers[f]]).filter(([, v]) => v !== undefined));
      return api.verification.saveDraft(c.id, patch);
    },
    onSuccess: (c) => {
      if (c) store(c);
      haptic.success();
      next();
    },
    onError: (e) => {
      haptic.error();
      toast(errorMessage(e), 'danger');
    },
  });

  const onContinue = () => {
    if (step.kind !== 'question') return;
    setTried(true);
    const errs = validateSignupStep(step.id, answers, ctx);
    if (Object.keys(errs).length) {
      haptic.warning();
      return;
    }
    save.mutate();
  };

  const header = (
    <Header
      onBack={() => (router.canGoBack() ? router.back() : later())}
      progress={{ step: index + 1, total: steps.length }}
      right={step.kind !== 'review' ? <Button label="Plus tard" variant="ghost" size="compact" onPress={later} testID="signup-later" /> : undefined}
    />
  );

  const intro = (
    <View style={{ gap: 8, marginTop: 6, marginBottom: 18 }}>
      <Text variant="micro" weight="semibold" tone="accent" testID="step-kicker">
        {SECTION_COPY[step.section].short.toUpperCase()} · ÉTAPE {index + 1} SUR {steps.length}
      </Text>
      <Text variant="screen" accessibilityRole="header">
        {copy.title}
      </Text>
      {copy.help ? (
        <Text variant="label" tone="muted">
          {copy.help}
        </Text>
      ) : null}
    </View>
  );

  if (step.kind === 'review') {
    return (
      <Screen header={header} testID={`signup-step-${step.id}`}>
        {intro}
        <ReviewStep section={step.section} />
      </Screen>
    );
  }

  if (step.kind === 'document') {
    if (!kase) {
      return (
        <Screen header={header} testID={`signup-step-${step.id}`}>
          {intro}
          <StatusBanner tone="info" title="Commencez par les informations du véhicule" action={{ label: 'Y aller', onPress: () => goToStep(steps[0]!, 'replace') }} />
        </Screen>
      );
    }
    const item = kase.items.find((i) => i.key === step.item);
    return (
      <Screen header={header} testID={`signup-step-${step.id}`}>
        {intro}
        <CaptureStep
          guided
          caseId={kase.id}
          item={step.item}
          selfie={step.item === 'selfie'}
          guidance={copy.help ?? ''}
          correctionNote={item?.status === 'needs_correction' ? item.note : null}
          existingUploadId={item && item.status !== 'needs_correction' ? (item.uploadIds[0] ?? null) : null}
          onSaved={(c) => {
            store(c);
            next();
          }}
        />
        {item && item.status !== 'needs_correction' && item.uploadIds.length ? <Button label="Garder cette pièce et continuer" variant="ghost" full onPress={next} style={{ marginTop: 6 }} testID="keep-document" /> : null}
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={header}
      footer={<Button label="Continuer" size="major" full loading={save.isPending} loadingLabel="Enregistrement…" onPress={onContinue} testID="step-continue" />}
      testID={`signup-step-${step.id}`}
    >
      {intro}
      <QuestionFields id={step.id} answers={answers} set={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))} errors={errors} ctx={ctx} />
      {tried && Object.keys(errors).length ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginTop: 12, marginLeft: 18 }}>
          Corrigez la réponse signalée pour continuer.
        </Text>
      ) : null}
    </Screen>
  );
}
