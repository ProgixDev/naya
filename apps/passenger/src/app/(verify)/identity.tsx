import { useEffect } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { identityDetailsSchema, type IdentityDetailsInput } from '@naya/domain';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { Button, DateField, DocumentPicker, FieldRow, FormField, Header, ID_DOCUMENTS, Screen, Text, haptic, toast } from '@naya/ui';
import { useAccountId, useIdentityCase } from '@/lib/queries';
import { useSession } from '@/lib/session';

/** DateField speaks French dates (JJ / MM / AAAA) and hands the form an ISO date, as the API stores it. */
type Form = IdentityDetailsInput;
const FIELDS = ['firstName', 'lastName', 'birthDate', 'documentType', 'documentNumber'] as const;

/**
 * P04: the identity details. No icons in the fields (P-09, A97–A99); the date is a masked DateField;
 * the document number shows its example under the field. « Plus tard » is quiet text (P-08): it signs out,
 * and the dossier waits on the server for the next sign-in.
 */
export default function IdentityDetails() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const { identity, isLoading } = useIdentityCase();
  const { control, handleSubmit, reset, setError, formState, watch } = useForm<Form>({
    resolver: zodResolver(identityDetailsSchema),
    defaultValues: { firstName: '', lastName: '', birthDate: '', documentType: 'cin', documentNumber: '' },
  });
  useEffect(() => {
    if (identity?.identity) reset({ ...identity.identity });
  }, [identity?.identity, reset]);
  const docType = watch('documentType');
  const save = useMutation({
    mutationFn: (f: Form) => api.verification.saveIdentity(identity!.id, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me(a) });
      haptic.success();
      router.push({ pathname: '/(verify)/capture/[item]', params: { item: 'selfie' } });
    },
    onError: (e) => {
      const fields = isApiError(e) ? Object.entries(e.fields).filter(([k]) => (FIELDS as readonly string[]).includes(k)) : [];
      if (fields.length) for (const [k, message] of fields) setError(k as keyof Form, { message });
      else toast(errorMessage(e), 'danger');
      haptic.warning();
    },
  });

  if (isLoading || !identity) return <Screen><View /></Screen>;
  if (identity.status !== 'draft') return <Redirect href="/(verify)/verification-status" />;

  return (
    <Screen
      keyboard
      header={
        <Header
          title="Vos informations"
          subtitle="Comme sur votre pièce d’identité."
          progress={{ step: 1, total: 4 }}
          right={
            <Button
              label="Plus tard"
              variant="ghost"
              size="compact"
              accessibilityHint="Vous déconnecte. Votre dossier vous attend à la prochaine connexion."
              onPress={() => useSession.getState().signOut()}
              testID="identity-later"
            />
          }
        />
      }
      footer={<Button label="Continuer" full loading={save.isPending} onPress={handleSubmit((f) => save.mutate(f))} testID="identity-continue" />}
    >
      <View style={{ gap: 12, marginTop: 12 }}>
        <Controller control={control} name="documentType" render={({ field }) => <DocumentPicker value={field.value} onChange={field.onChange} testID="doc-type" />} />
        <Controller
          control={control}
          name="documentNumber"
          render={({ field, fieldState }) => (
            <FormField label={ID_DOCUMENTS[docType].numberLabel} example={ID_DOCUMENTS[docType].example} value={field.value} onChangeText={(v) => field.onChange(v.toUpperCase())} onBlur={field.onBlur} error={fieldState.error?.message} autoCapitalize="characters" autoCorrect={false} testID="doc-number" />
          )}
        />
        <FieldRow>
          <Controller control={control} name="firstName" render={({ field, fieldState }) => <FormField label="Prénom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="given-name" textContentType="givenName" returnKeyType="next" testID="first-name" />} />
          <Controller control={control} name="lastName" render={({ field, fieldState }) => <FormField label="Nom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="family-name" textContentType="familyName" returnKeyType="next" testID="last-name" />} />
        </FieldRow>
        <Controller control={control} name="birthDate" render={({ field, fieldState }) => <DateField label="Date de naissance" value={field.value} onChange={field.onChange} error={fieldState.error?.message} testID="birth-date" />} />
        {formState.isSubmitted && !formState.isValid ? (
          <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginLeft: 18 }}>
            Corrigez les champs signalés pour continuer.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
