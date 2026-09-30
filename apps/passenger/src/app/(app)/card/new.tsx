import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, radius } from '@naya/tokens';
import { Button, DemoBadge, FormField, Header, ListRow, Screen, StatusBanner, Text, haptic, toast } from '@naya/ui';
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
      <View style={{ gap: 16, marginTop: 8 }}>
        <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Lock size={16} color={colors.success} />
            <Text variant="caption" weight="semibold" style={{ flex: 1 }}>Champs sécurisés du prestataire de paiement</Text>
            <DemoBadge label="Bac à sable" />
          </View>
          <FormField label="Numéro de carte" value={number} onChangeText={(v) => setNumber(v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '))} keyboardType="number-pad" autoComplete="cc-number" textContentType="creditCardNumber" placeholder="4242 4242 4242 4242" testID="card-number" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FormField label="Expiration" value={exp} onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 4); setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} keyboardType="number-pad" autoComplete="cc-exp" placeholder="MM/AA" testID="card-exp" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Code de sécurité" value={cvc} onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" autoComplete="cc-csc" secureTextEntry placeholder="123" testID="card-cvc" />
            </View>
          </View>
        </View>
        {error ? <StatusBanner tone="danger" title="Carte non enregistrée" message={error} /> : null}
        <ListRow title="Définir comme moyen préféré" trailing={<Switch value={makeDefault} onValueChange={setMakeDefault} trackColor={{ true: colors.accent, false: colors.line }} accessibilityLabel="Définir comme moyen préféré" />} />
        <Text variant="caption" tone="muted">Démonstration : utilisez 4242 4242 4242 4242 (acceptée), 4000 0000 0000 0002 (refusée) ou 4000 0000 0000 3155 (reste en attente). Naya ne reçoit ni le numéro complet ni le code.</Text>
      </View>
    </Screen>
  );
}
