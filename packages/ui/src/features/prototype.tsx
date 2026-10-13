import { useTheme } from './../core/theme';
import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage } from '@naya/api';
import {
  formatMoney,
  formatShort,
  type LatLng,
  type SafetyAlert,
} from '@naya/domain';
import { colors } from '@naya/tokens';
import { Screen, Section } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField, Pill } from '../Form';
import { StatusBanner, ErrorState } from '../Feedback';
import { Sheet } from '../BottomSheet';
import { toast } from '../Toast';

const key = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const panel = new Proxy(
  { backgroundColor: colors.surface, borderRadius: 22, padding: 18, gap: 12 },
  {
    get: (_, key) =>
      (
        ({
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 18,
          gap: 12,
        }) as Record<string, unknown>
      )[String(key)],
  },
);
/** All emergency actions are simulated and remain inside the demo. */
export function SafetyButton({
  rideId = null,
  familyTripId = null,
  location,
}: {
  rideId?: string | null;
  familyTripId?: string | null;
  location: LatLng;
}) {
  useTheme();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<SafetyAlert | null>(null);
  const [contact, setContact] = useState('Contact de confiance');
  const [busy, setBusy] = useState(false);
  const run = async (action?: string) => {
    setBusy(true);
    try {
      setAlert(
        action && alert
          ? await api.prototype.safetyAction(alert.id, action)
          : await api.prototype.sos(
              { rideId, familyTripId, location, contactName: contact },
              key(),
            ),
      );
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        label="SOS · sécurité"
        variant="secondary"
        onPress={() => setOpen(true)}
        testID="sos"
      />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="SOS · démonstration"
        subtitle="Les appels et les envois sont simulés."
      >
        <View style={{ gap: 12 }}>
          <StatusBanner
            tone="warning"
            title="Tester une alerte"
            message="La position et les actions apparaîtront dans le back-office de démonstration."
          />
          <Text variant="caption" numeric>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Text>
          {!alert ? (
            <>
              <FormField
                label="Contact de confiance"
                value={contact}
                onChangeText={setContact}
              />
              <Button
                label="Confirmer l’alerte de démo"
                loading={busy}
                onPress={() => run()}
                testID="confirm-sos"
              />
            </>
          ) : (
            <>
              <StatusBanner
                tone="success"
                title={`Alerte ${alert.id} enregistrée`}
                message="Position jointe · disponible dans le back-office."
              />
              {[
                'Appel urgence simulé',
                'Position partagée (simulation)',
                'Contact de confiance alerté (simulation)',
                'Support contacté (simulation)',
              ].map((action) => (
                <Button
                  key={action}
                  label={action}
                  variant="secondary"
                  loading={busy}
                  onPress={() => run(action)}
                />
              ))}
              {alert.actions.map((a, i) => (
                <Text key={i} variant="caption">
                  {formatShort(a.at)} · {a.label}
                </Text>
              ))}
            </>
          )}
        </View>
      </Sheet>
    </>
  );
}

export function PassengerWalletScreen({
  accountId,
  cityId,
  onBack,
}: {
  accountId: string;
  cityId: string;
  onBack: () => void;
}) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ['naya', accountId, 'passenger-wallet'];
  const wallet = useQuery({ queryKey, queryFn: api.prototype.wallet });
  const catalog = useQuery({
    queryKey: ['naya', accountId, 'catalog'],
    queryFn: api.prototype.catalog,
  });
  const [amount, setAmount] = useState('100');
  const [provider, setProvider] = useState('demo-mobile');
  const [busy, setBusy] = useState(false);
  const run = async (id?: string, outcome?: 'confirmed' | 'failed') => {
    setBusy(true);
    try {
      if (id && outcome) await api.prototype.resolveTopup(id, outcome);
      else
        await api.prototype.topup(
          Math.round(Number(amount.replace(',', '.')) * 100),
          provider,
          key(),
        );
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      keyboard
      header={<Header title="Portefeuille Naya" onBack={onBack} />}
    >
      <View style={{ gap: 16 }}>
        <StatusBanner
          tone="info"
          title="Paiements de démonstration"
          message="Aucun argent réel n’est débité. Confirmez ou refusez une recharge pour tester son résultat."
        />
        {wallet.isError ? (
          <ErrorState onRetry={() => wallet.refetch()} />
        ) : null}
        <View style={{ ...panel, backgroundColor: colors.selected }}>
          <Text variant="caption" tone="accent">
            Solde disponible
          </Text>
          <Text variant="display">
            {formatMoney(
              (wallet.data?.balance ?? 0) - (wallet.data?.reserved ?? 0),
            )}
          </Text>
          <Text variant="caption" tone="muted">
            {formatMoney(wallet.data?.reserved ?? 0)} réservés pour vos courses
          </Text>
        </View>
        <Section title="Recharger">
          <View style={{ gap: 12 }}>
            <FormField
              label="Montant (MAD)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            {(catalog.data?.payments ?? [])
              .filter(
                (p) =>
                  p.enabled &&
                  (!p.cityIds.length || p.cityIds.includes(cityId)),
              )
              .map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  selected={provider === p.id}
                  onPress={() => setProvider(p.id)}
                />
              ))}
            <Button
              label="Créer la recharge de démo"
              loading={busy}
              onPress={() => run()}
              testID="wallet-topup"
            />
          </View>
        </Section>
        <Section title="Opérations">
          <View style={{ gap: 12 }}>
            {wallet.data?.entries
              .slice()
              .reverse()
              .map((e) => (
                <View key={`${e.id}-${e.status}`} style={panel}>
                  <Text variant="label">{e.label}</Text>
                  <Text variant="caption" tone="muted">
                    {formatShort(e.at)} ·{' '}
                    {e.status === 'confirmed'
                      ? 'Confirmée'
                      : e.status === 'pending'
                        ? 'En attente'
                        : 'Refusée / libérée'}
                  </Text>
                  <Text variant="title">{formatMoney(e.amount)}</Text>
                  {e.amount > 0 && e.status === 'pending' ? (
                    <View style={{ gap: 8 }}>
                      <Button
                        label="Simuler la confirmation"
                        loading={busy}
                        onPress={() => run(e.id, 'confirmed')}
                      />
                      <Button
                        label="Simuler le refus"
                        variant="secondary"
                        loading={busy}
                        onPress={() => run(e.id, 'failed')}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
          </View>
        </Section>
      </View>
    </Screen>
  );
}
