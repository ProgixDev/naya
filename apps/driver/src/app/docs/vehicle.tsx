import { View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { vehicleDetailsSchema, type VehicleDetailsInput } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, FieldRow, FormField, Header, Screen, Text, toast } from '@naya/ui';
import { useAccountId, useCases } from '@/lib/queries';

/** D04-car: vehicle identity. Creates the vehicle dossier (reviewed separately from the driver). */
export default function VehicleDetails() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const { vehicle } = useCases();
  const { control, handleSubmit, setError } = useForm<VehicleDetailsInput>({
    resolver: zodResolver(vehicleDetailsSchema),
    defaultValues: vehicle?.vehicle ?? { make: '', model: '', color: '', plate: '', year: new Date().getFullYear() },
  });
  const save = useMutation({
    mutationFn: async (v: VehicleDetailsInput) => {
      const kase = vehicle ?? (await api.verification.ensureVehicleCase());
      return api.verification.saveVehicle(kase.id, v);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me(a) });
      router.back();
    },
    onError: (e) => {
      if (isApiError(e)) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof VehicleDetailsInput, { message: m });
      toast(errorMessage(e), 'danger');
    },
  });
  return (
    <Screen keyboard header={<Header title="Votre véhicule" subtitle="Comme sur la carte grise." onBack={() => router.back()} />} footer={<Button label="Enregistrer" size="major" full loading={save.isPending} onPress={handleSubmit((v) => save.mutate(v))} testID="save-vehicle" />}>
      <View style={{ gap: 12, marginTop: 4 }}>
        <FieldRow>
          <Controller control={control} name="make" render={({ field, fieldState }) => <FormField label="Marque" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} testID="vehicle-make" />} />
          <Controller control={control} name="model" render={({ field, fieldState }) => <FormField label="Modèle" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} testID="vehicle-model" />} />
        </FieldRow>
        <FieldRow>
          <Controller control={control} name="color" render={({ field, fieldState }) => <FormField label="Couleur" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} testID="vehicle-color" />} />
          <Controller control={control} name="year" render={({ field, fieldState }) => <FormField label="Année" value={field.value ? String(field.value) : ''} onChangeText={(t) => field.onChange(Number(t.replace(/\D/g, '').slice(0, 4)) || 0)} error={fieldState.error?.message} keyboardType="number-pad" maxLength={4} accessibilityHint="Année de mise en circulation" testID="vehicle-year" />} />
        </FieldRow>
        <Controller control={control} name="plate" render={({ field, fieldState }) => <FormField label="Immatriculation" value={field.value} onChangeText={(t) => field.onChange(t.toUpperCase())} error={fieldState.error?.message} autoCapitalize="characters" leading={<View style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginLeft: -6 }}><Text variant="micro" weight="bold" tone="inverse">MA</Text></View>} inputStyle={{ letterSpacing: 1.5, fontFamily: 'Inter_600SemiBold' }} testID="vehicle-plate" />} />
      </View>
    </Screen>
  );
}
