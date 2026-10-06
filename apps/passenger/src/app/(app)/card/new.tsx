import { useTheme , Button, FieldRow, FormField, Header, ListGroup, ListRow, Screen, StatusBanner, Text, haptic, toast, Toggle } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

/**
 * P14-card. This form stands in for the payment provider's hosted card fields (in
 * production an SDK component renders them). The number never leaves this screen: only
 * the last four digits go to the sandbox tokeniser, and Naya stores the returned token.
 */
export default function NewCard() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = number.replace(/\D/g, '');
  const save = useMutation({
    mutationFn: async () => {
      const { providerToken } = await api.providerSandbox.tokenize(digits.slice(-4));
      return api.paymentMethods.addCard(providerToken, makeDefault);
    },
    onSuccess: () => {
      haptic.success();
      toast('Carte ajoutée');
      qc.invalidateQueries({ queryKey: qk.paymentMethods(a) });
      router.back();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = () => {
    const [mm, yy] = exp.split('/');
    if (digits.length < 13 || !luhn(digits)) return setError('Numéro de carte invalide.');
    if (!mm || !yy || Number(mm) < 1 || Number(mm) > 12) return setError('Date d’expiration invalide (MM/AA).');
    if (!/^\d{3,4}$/.test(cvc)) return setError('Code de sécurité invalide.');
    setError(null);
    save.mutate();
  };
  return (
    <Screen keyboard testID="new-card" header={<Header title="Ajouter une carte" onClose={() => router.back()} />} footer={<Button label="Enregistrer la carte" size="major" full loading={save.isPending} onPress={submit} testID="save-card" />}>
      <View style={{ gap: 12, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Lock size={14} color={colors.success} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>Champs sécurisés du prestataire · bac à sable</Text>
        </View>
        <FormField label="Numéro de carte" value={number} onChangeText={(v) => setNumber(v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '))} keyboardType="number-pad" autoComplete="cc-number" textContentType="creditCardNumber" placeholder="4242 4242 4242 4242" testID="card-number" />
        <FieldRow>
          <FormField label="Expiration" value={exp} onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 4); setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} keyboardType="number-pad" autoComplete="cc-exp" placeholder="MM/AA" testID="card-exp" />
          <FormField label="CVC" value={cvc} onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" autoComplete="cc-csc" secureTextEntry placeholder="123" testID="card-cvc" />
        </FieldRow>
        {error ? <StatusBanner compact tone="danger" title="Carte non enregistrée" message={error} /> : null}
        <ListGroup>
          <ListRow title="Moyen préféré" trailing={<Toggle value={makeDefault} onValueChange={setMakeDefault} accessibilityLabel="Définir comme moyen préféré" />} />
        </ListGroup>
        <StatusBanner compact tone="warning" title="Démo" message="4242… acceptée · 0002 refusée · 3155 en attente" />
      </View>
    </Screen>
  );
}
