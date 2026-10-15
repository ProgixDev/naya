import { useTheme, Button, ErrorState, Header, Icon, IconButton, ListGroup, ListRow, Screen, Sheet, SkeletonList, TextButton, paymentIcon, toast } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ellipsis } from 'lucide-react-native';
import { paymentMethodPresentation } from '@naya/domain';
import { errorMessage, qk, type ClientPaymentMethod } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useAccountId, useMe, usePaymentMethods } from '@/lib/queries';

/** The card's brand from its label (« Visa •••• 4242 » → « Visa »). A generic « Carte … » label adds nothing to the title. */
const cardBrand = (label: string) => {
  const brand = label.replace(/\s*•••• \d{4}$/, '').trim();
  return brand && !/^carte\b/i.test(brand) ? brand : null;
};

/**
 * P14: methods available in the city, the preferred one, removal, add a tokenised card.
 * The list is a choice (P-38, A86): the preferred method carries the check and a tap sets it. Removal
 * sits behind one « ⋯ » per card instead of a red trash on every row.
 */
export default function Payments() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const methods = usePaymentMethods();
  const [menu, setMenu] = useState<ClientPaymentMethod | null>(null);
  const [confirming, setConfirming] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.paymentMethods(a) });
  const setDefault = useMutation({ mutationFn: (id: string) => api.paymentMethods.setDefault(id), onSuccess: () => { toast('Moyen préféré mis à jour', 'success'); refresh(); }, onError: (e) => toast(errorMessage(e), 'danger') });
  const closeMenu = () => {
    if (remove.isPending) return;
    setMenu(null);
    setConfirming(false);
  };
  const remove = useMutation({
    mutationFn: (id: string) => api.paymentMethods.remove(id),
    onSuccess: () => { setMenu(null); setConfirming(false); toast('Carte supprimée', 'success'); refresh(); },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  return (
    <Screen testID="payments" header={<Header title="Moyens de paiement" onBack={() => router.back()} />} footer={<Button label="Ajouter une carte" full onPress={() => router.push('/card/new')} testID="add-card" />}>
      <View style={{ gap: 12, marginTop: 4 }}>
        {methods.isLoading ? <SkeletonList rows={3} /> : null}
        {methods.isError ? <ErrorState onRetry={() => methods.refetch()} /> : null}
        {methods.data ? (
          <ListGroup label="Moyen préféré" footnote="Naya ne conserve qu’un jeton et les 4 derniers chiffres de vos cartes.">
            {methods.data.map((m) => {
              // P14: same name, icon and timing as the quote and the receipt.
              const p = paymentMethodPresentation(m);
              const available = m.availableInCity;
              const card = m.kind === 'card';
              return (
                <ListRow
                  key={m.id}
                  testID={`method-${m.last4 ?? m.kind}`}
                  title={p.label}
                  subtitle={[card ? cardBrand(m.label) : null, !available ? `Indisponible à ${me.data?.city.name ?? 'votre ville'}` : card ? `Expire ${String(m.expMonth).padStart(2, '0')}/${m.expYear}` : p.timing].filter(Boolean).join(' · ')}
                  leading={<Icon icon={paymentIcon(p.icon)} size={24} color={available ? colors.ink : colors.disabledText} />}
                  selected={m.isDefault}
                  onPress={available ? () => { if (!m.isDefault) setDefault.mutate(m.id); } : undefined}
                  trailing={card ? <IconButton variant="plain" size={44} icon={<Ellipsis size={20} color={colors.muted} />} accessibilityLabel={`Options de la carte •••• ${m.last4}`} onPress={() => setMenu(m)} testID={`method-${m.last4}-options`} /> : undefined}
                />
              );
            })}
          </ListGroup>
        ) : null}
      </View>
      {/* One modal for both steps: a second modal opened while the sheet closes is dropped on iOS. */}
      <Sheet
        visible={!!menu}
        onClose={closeMenu}
        dismissible={!remove.isPending}
        title={menu ? paymentMethodPresentation(menu).label : ''}
        subtitle={confirming ? 'Elle ne pourra plus servir à payer vos courses.' : undefined}
        testID="method-options"
        footer={
          confirming ? (
            <>
              <Button label="Supprimer la carte" variant="danger" full loading={remove.isPending} onPress={() => menu && remove.mutate(menu.id)} testID="method-remove-confirm" />
              <TextButton label="Garder la carte" tone="muted" onPress={closeMenu} testID="method-remove-keep" />
            </>
          ) : undefined
        }
      >
        {confirming ? null : (
          <ListGroup>
            <ListRow title="Supprimer la carte" destructive chevron={false} onPress={() => setConfirming(true)} testID="method-remove" />
          </ListGroup>
        )}
      </Sheet>
    </Screen>
  );
}
