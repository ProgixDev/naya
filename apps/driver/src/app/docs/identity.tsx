import { View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { identityDetailsSchema, type IdentityDetailsInput } from '@naya/domain';
import { Button, FormField, Header, Pill, Screen, StatusBanner, Text, toast } from '@naya/ui';
import { useAccountId, useCases } from '@/lib/queries';

const DOCS = [
  { value: 'cin', label: 'CIN' },
  { value: 'passport', label: 'Passeport' },
  { value: 'residence_permit', label: 'Titre de séjour' },
] as const;

/** D04 · step 1: identity as written on the document. */
export default function IdentityDetails() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const { person } = useCases();
  const { control, handleSubmit, setError, formState } = useForm<IdentityDetailsInput>({
    resolver: zodResolver(identityDetailsSchema),
    defaultValues: person?.identity ?? { firstName: '', lastName: '', birthDate: '', documentType: 'cin', documentNumber: '' },
  });
  const save = useMutation({
    mutationFn: (v: IdentityDetailsInput) => api.verification.saveIdentity(person!.id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me(a) });
      router.back();
    },
    onError: (e) => {
      if (isApiError(e)) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof IdentityDetailsInput, { message: m });
      toast(errorMessage(e), 'danger');
    },
  });
  if (!person) return null;
  return (
    <Screen keyboard header={<Header title="Vos informations" subtitle="Comme sur votre pièce d’identité." onBack={() => router.back()} />} footer={<Button label="Enregistrer" size="major" full loading={save.isPending} onPress={handleSubmit((v) => save.mutate(v))} testID="save-identity" />}>
      <View style={{ gap: 18, marginTop: 12 }}>
        <Controller control={control} name="firstName" render={({ field, fieldState }) => <FormField label="Prénom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="given-name" textContentType="givenName" testID="first-name" />} />
        <Controller control={control} name="lastName" render={({ field, fieldState }) => <FormField label="Nom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="family-name" textContentType="familyName" testID="last-name" />} />
        <Controller control={control} name="birthDate" render={({ field, fieldState }) => <FormField label="Date de naissance" value={field.value} onChangeText={(t) => field.onChange(formatDate(t))} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="AAAA-MM-JJ" keyboardType="number-pad" maxLength={10} helper="Vous devez avoir 18 ans ou plus." testID="birth-date" />} />
        <Controller
          control={control}
          name="documentType"
          render={({ field }) => (
            <View style={{ gap: 8 }}>
              <Text variant="caption" weight="semibold">
                Type de pièce
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {DOCS.map((d) => (
                  <Pill key={d.value} label={d.label} selected={field.value === d.value} onPress={() => field.onChange(d.value)} />
                ))}
              </View>
            </View>
          )}
        />
        <Controller control={control} name="documentNumber" render={({ field, fieldState }) => <FormField label="Numéro de la pièce" value={field.value} onChangeText={(t) => field.onChange(t.toUpperCase())} onBlur={field.onBlur} error={fieldState.error?.message} autoCapitalize="characters" testID="document-number" />} />
        {Object.keys(formState.errors).length ? <StatusBanner tone="danger" title="Vérifiez les champs signalés" /> : null}
      </View>
    </Screen>
  );
}

function formatDate(t: string) {
  const d = t.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}
