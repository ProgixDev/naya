import { useEffect } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { aspect, illustrations } from '@naya/assets';
import { identityDetailsSchema } from '@naya/domain';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { Button, FormField, Header, Illustration, Pill, Screen, StatusBanner, Text, haptic, toast } from '@naya/ui';
import { useAccountId, useIdentityCase } from '@/lib/queries';
import { useSession } from '@/lib/session';

/** The form speaks French dates (JJ/MM/AAAA); the API stores ISO dates. */
const formSchema = identityDetailsSchema.extend({ birthDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format JJ/MM/AAAA') });
type Form = z.infer<typeof formSchema>;

const toIso = (fr: string) => {
  const [d, m, y] = fr.split('/');
  return `${y}-${m}-${d}`;
};
const toFr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');
const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
};

const DOCS = [
  { value: 'cin', label: 'CIN' },
  { value: 'passport', label: 'Passeport' },
  { value: 'residence_permit', label: 'Titre de séjour' },
] as const;

export default function IdentityDetails() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const { identity, isLoading } = useIdentityCase();
  const { control, handleSubmit, reset, setError, formState } = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: '', lastName: '', birthDate: '', documentType: 'cin', documentNumber: '' },
  });
  useEffect(() => {
    if (identity?.identity) reset({ ...identity.identity, birthDate: toFr(identity.identity.birthDate) });
  }, [identity?.identity, reset]);
  const save = useMutation({
    mutationFn: (f: Form) => {
      const payload = { ...f, birthDate: toIso(f.birthDate) };
      const parsed = identityDetailsSchema.safeParse(payload);
      if (!parsed.success) throw Object.assign(new Error(parsed.error.issues[0]?.message ?? 'Invalide'), { field: parsed.error.issues[0]?.path[0] });
      return api.verification.saveIdentity(identity!.id, parsed.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me(a) });
      haptic.success();
      router.push({ pathname: '/(verify)/capture/[item]', params: { item: 'selfie' } });
    },
    onError: (e: Error & { field?: string }) => {
      if (e.field) setError(e.field as keyof Form, { message: e.message });
      else toast(errorMessage(e), 'danger');
      haptic.warning();
    },
  });

  if (isLoading || !identity) return <Screen><View /></Screen>;
  if (identity.status !== 'draft') return <Redirect href="/(verify)/verification-status" />;

  return (
    <Screen
      keyboard
      header={<Header title="Votre dossier d’identité" subtitle="1 sur 4 · Informations personnelles" right={<Button label="Se déconnecter" variant="ghost" size="compact" onPress={() => useSession.getState().signOut()} />} />}
      footer={<Button label="Continuer vers le selfie" size="major" full loading={save.isPending} onPress={handleSubmit((f) => save.mutate(f))} testID="identity-continue" />}
    >
      <View style={{ gap: 18, marginTop: 8 }}>
        <Illustration source={illustrations.passengerIdentity} aspect={aspect.illustration} width="72%" />
        <StatusBanner tone="neutral" title="Un examen humain" message="Votre selfie et votre pièce sont examinés par l’équipe Naya avant l’activation du compte. Nous ne déduisons rien de votre apparence." />
        <Controller control={control} name="firstName" render={({ field, fieldState }) => <FormField label="Prénom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="given-name" textContentType="givenName" testID="first-name" helper="Tel qu’il figure sur votre pièce." />} />
        <Controller control={control} name="lastName" render={({ field, fieldState }) => <FormField label="Nom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="family-name" textContentType="familyName" testID="last-name" />} />
        <Controller control={control} name="birthDate" render={({ field, fieldState }) => <FormField label="Date de naissance" value={field.value} onChangeText={(v) => field.onChange(maskDate(v))} onBlur={field.onBlur} error={fieldState.error?.message} keyboardType="number-pad" placeholder="JJ/MM/AAAA" testID="birth-date" />} />
        <Controller
          control={control}
          name="documentType"
          render={({ field }) => (
            <View style={{ gap: 8 }}>
              <Text variant="caption" weight="semibold">
                Type de pièce
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
                {DOCS.map((d) => (
                  <Pill key={d.value} label={d.label} selected={field.value === d.value} onPress={() => field.onChange(d.value)} testID={`doc-${d.value}`} />
                ))}
              </View>
            </View>
          )}
        />
        <Controller control={control} name="documentNumber" render={({ field, fieldState }) => <FormField label="Numéro de la pièce" value={field.value} onChangeText={(v) => field.onChange(v.toUpperCase())} onBlur={field.onBlur} error={fieldState.error?.message} autoCapitalize="characters" autoCorrect={false} testID="doc-number" />} />
        {formState.isSubmitted && !formState.isValid ? (
          <Text variant="caption" tone="danger" accessibilityRole="alert">
            Corrigez les champs signalés pour continuer.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
