import { useTheme , Button, ConfirmDialog, ErrorState, Header, IconButton, ListGroup, ListRow, Screen, SkeletonList, StatusPill, toast } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Trash2 } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useAccountId, useMe, usePaymentMethods } from '@/lib/queries';

/** The card's brand from its label (« Visa •••• 4242 » → « Visa »). A generic « Carte … » label adds nothing to the title. */
const cardBrand = (label: string) => {
  const brand = label.replace(/\s*•••• \d{4}$/, '').trim();
  return brand && !/^carte\b/i.test(brand) ? brand : null;
};

/** P14: methods available in the city, default choice, removal, add a tokenised card. */
export default function Payments() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const methods = usePaymentMethods();
  const [removing, setRemoving] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.paymentMethods(a) });
  const setDefault = useMutation({ mutationFn: (id: string) => api.paymentMethods.setDefault(id), onSuccess: () => { toast('Moyen préféré mis à jour'); refresh(); }, onError: (e) => toast(errorMessage(e), 'danger') });
  const remove = useMutation({ mutationFn: (id: string) => api.paymentMethods.remove(id), onSuccess: () => { setRemoving(null); toast('Carte supprimée'); refresh(); }, onError: (e) => { setRemoving(null); toast(errorMessage(e), 'danger'); } });
  const target = methods.data?.find((m) => m.id === removing);
  return (
    <Screen testID="payments" header={<Header title="Moyens de paiement" onBack={() => router.back()} />} footer={<Button label="Ajouter une carte" full size="major" onPress={() => router.push('/card/new')} testID="add-card" />}>
      <View style={{ gap: 12, marginTop: 4 }}>
        {methods.isLoading ? <SkeletonList rows={3} /> : null}
        {methods.isError ? <ErrorState onRetry={() => methods.refetch()} /> : null}
        {methods.data ? (
          <ListGroup footnote="Touchez un moyen pour le définir comme préféré. Naya ne conserve qu’un jeton et les 4 derniers chiffres.">
            {methods.data.map((m) => (
              <ListRow
                key={m.id}
                testID={`method-${m.last4 ?? 'cash'}`}
                title={m.kind === 'card' ? `Carte •••• ${m.last4}` : m.label}
                subtitle={[m.kind === 'card' ? cardBrand(m.label) : null, m.isDefault ? 'Moyen préféré' : !m.availableInCity ? `Indisponible à ${me.data?.city.name ?? 'votre ville'}` : m.kind === 'card' ? `Expire ${String(m.expMonth).padStart(2, '0')}/${m.expYear}` : m.kind === 'cash' ? 'Réglé à la chauffeuse en fin de trajet' : m.kind === 'wallet' ? 'Payé avec votre solde Naya' : 'Paiement mobile, débité à l’arrivée'].filter(Boolean).join(' · ')}
                leading={m.kind === 'card' ? <CreditCard size={20} color={colors.ink} /> : <Banknote size={20} color={colors.ink} />}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {m.isDefault ? <StatusPill tone="success" label="Préféré" /> : null}
                    {m.kind === 'card' ? <IconButton variant="plain" size={36} icon={<Trash2 size={18} color={colors.danger} />} accessibilityLabel={`Supprimer la carte •••• ${m.last4}`} onPress={() => setRemoving(m.id)} /> : null}
                  </View>
                }
                onPress={m.isDefault || !m.availableInCity ? undefined : () => setDefault.mutate(m.id)}
                chevron={false}
              />
            ))}
          </ListGroup>
        ) : null}
      </View>
      <ConfirmDialog visible={!!target} title="Supprimer cette carte ?" message={target ? `Carte •••• ${target.last4}` : undefined} confirmLabel="Supprimer la carte" destructive loading={remove.isPending} onConfirm={() => target && remove.mutate(target.id)} onCancel={() => setRemoving(null)} />
    </Screen>
  );
}
