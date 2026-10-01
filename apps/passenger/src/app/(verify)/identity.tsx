import { useEffect } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { identityDetailsSchema } from '@naya/domain';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { CalendarDays, Hash, UserRound } from 'lucide-react-native';
import { Button, DocumentPicker, FieldRow, FormField, Header, ID_DOCUMENTS, Screen, Text, haptic, toast } from '@naya/ui';
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

export default function IdentityDetails() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const { identity, isLoading } = useIdentityCase();
  const { control, handleSubmit, reset, setError, formState, watch } = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: '', lastName: '', birthDate: '', documentType: 'cin', documentNumber: '' },
  });
  useEffect(() => {
    if (identity?.identity) reset({ ...identity.identity, birthDate: toFr(identity.identity.birthDate) });
  }, [identity?.identity, reset]);
  const docType = watch('documentType');
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
      header={
        <Header
          title="Vos informations"
          subtitle="Comme sur votre pièce d’identité."
          progress={{ step: 1, total: 4 }}
          right={<Button label="Se déconnecter" variant="secondary" size="compact" onPress={() => useSession.getState().signOut()} />}
        />
      }
      footer={<Button label="Continuer" size="major" full loading={save.isPending} onPress={handleSubmit((f) => save.mutate(f))} testID="identity-continue" />}
    >
      <View style={{ gap: 12, marginTop: 12 }}>
        <Controller control={control} name="documentType" render={({ field }) => <DocumentPicker value={field.value} onChange={field.onChange} testID="doc-type" />} />
        <Controller
          control={control}
          name="documentNumber"
          render={({ field, fieldState }) => (
            <FormField icon={Hash} label={ID_DOCUMENTS[docType].numberLabel} placeholder={ID_DOCUMENTS[docType].example} value={field.value} onChangeText={(v) => field.onChange(v.toUpperCase())} onBlur={field.onBlur} error={fieldState.error?.message} autoCapitalize="characters" autoCorrect={false} testID="doc-number" />
          )}
        />
        <FieldRow>
          <Controller control={control} name="firstName" render={({ field, fieldState }) => <FormField icon={UserRound} label="Prénom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="given-name" textContentType="givenName" returnKeyType="next" testID="first-name" />} />
          <Controller control={control} name="lastName" render={({ field, fieldState }) => <FormField label="Nom" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="family-name" textContentType="familyName" returnKeyType="next" testID="last-name" />} />
        </FieldRow>
        <Controller control={control} name="birthDate" render={({ field, fieldState }) => <FormField icon={CalendarDays} label="Date de naissance" value={field.value} onChangeText={(v) => field.onChange(maskDate(v))} onBlur={field.onBlur} error={fieldState.error?.message} keyboardType="number-pad" placeholder="JJ/MM/AAAA" testID="birth-date" />} />
        {formState.isSubmitted && !formState.isValid ? (
          <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginLeft: 18 }}>
            Corrigez les champs signalés pour continuer.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
