import { useTheme } from './../core/theme';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage } from '@naya/api';
import {
  formatMoney,
  formatShort,
  parseMoneyInput,
  SAFETY_STATUS_LABELS,
  type DemoPaymentOption,
  type LatLng,
  type PassengerWalletEntry,
  type SafetyAlert,
} from '@naya/domain';
import { colors, themedStyles } from '@naya/tokens';
import { STANDALONE_DEMO } from '../core/apiBase';
import { isUncertainFailure, useSingleFlight } from '../core/useSingleFlight';
import { Screen, Section } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField, Pill } from '../Form';
import { StatusBanner, ErrorState } from '../Feedback';
import { Sheet } from '../BottomSheet';
import { toast } from '../Toast';
import { haptic } from '../haptics';

const styles = themedStyles(() =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      gap: 12,
    },
    balance: {
      backgroundColor: colors.selected,
      borderRadius: 22,
      padding: 18,
      gap: 12,
    },
  }),
);

/** SOS actions, worded as the server records them (services/demo-api/src/services/prototype.ts). */
const CALLED_POLICE = 'Appel au 19 lancé';
const SHARED_POSITION = 'Position partagée avec un proche';
/** How long a retry after an unanswered SOS resends that attempt's position (UI-17). */
const SOS_REPLAY_MS = 60_000;
type SosBody = {
  rideId: string | null;
  familyTripId: string | null;
  location: LatLng;
  contactName: string;
};
const mapsLink = (l: LatLng) =>
  `https://maps.google.com/?q=${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;

/**
 * SOS from a ride or a Naya Famille trip. The alert and the position are saved on the server.
 * Connected builds reach the admin SOS desk, and its answer shows here while the sheet is open.
 * A standalone build has no desk on the other end: the copy says the alert is recorded and
 * never claims a team was notified. The 19 is a real call; « Prévenir un proche » opens the
 * phone's share sheet. Failures use Alert.alert: toasts render behind modal sheets (UI-07).
 */
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
  const [sos, setSos] = useState<SafetyAlert | null>(null);
  const [contact, setContact] = useState('');
  const desk = !STANDALONE_DEMO;
  const live = useQuery({
    queryKey: ['naya', sos?.userId ?? '', 'sos'],
    queryFn: api.prototype.alerts,
    enabled: desk && open && !!sos,
    refetchInterval: 5000,
  });
  const fresh = live.data?.find((a) => a.id === sos?.id);
  const shown =
    fresh && sos && fresh.actions.length >= sos.actions.length ? fresh : sos;
  const raise = useSingleFlight(
    (body: SosBody, k) => api.prototype.sos(body, k),
    {
      onSuccess: (alert) => {
        haptic.success();
        setSos(alert);
      },
      // No reset here: after a network error or a timeout the retry keeps the same
      // Idempotency-Key, so an alert the server did record is not raised twice (UI-17).
      onError: (e) => {
        haptic.error();
        // Without an answer the server may still have recorded the alert: do not say it was
        // not sent. A retry replays it rather than raising a second one.
        Alert.alert(
          isUncertainFailure(e) ? 'Alerte non confirmée' : 'Alerte non envoyée',
          isUncertainFailure(e)
            ? `${errorMessage(e)} Réessayez. En cas de danger, appelez le 19.`
            : `${errorMessage(e)} En cas de danger, appelez le 19.`,
        );
      },
    },
  );
  const trigger = () => {
    const contactName = contact.trim() || 'Aucun proche indiqué';
    // The position moves during a ride. A prompt retry after an unanswered attempt resends
    // that attempt's body, so the server replays it instead of refusing a changed body. After
    // SOS_REPLAY_MS the current position matters more: a fresh body, hence a new key.
    const last = raise.variables;
    const retry =
      raise.isError &&
      isUncertainFailure(raise.error) &&
      Date.now() - raise.submittedAt < SOS_REPLAY_MS &&
      last !== undefined &&
      last.rideId === rideId &&
      last.familyTripId === familyTripId &&
      last.contactName === contactName;
    raise.run(retry ? last : { rideId, familyTripId, location, contactName });
  };
  const record = (action: string) => {
    if (!sos) return;
    api.prototype
      .safetyAction(sos.id, action)
      .then((next) => {
        setSos(next);
        if (desk) live.refetch();
      })
      .catch(() => undefined);
  };
  const callPolice = () => {
    Linking.openURL('tel:19')
      .then(() => record(CALLED_POLICE))
      .catch(() =>
        Alert.alert(
          'Appel impossible depuis cet appareil',
          'Composez le 19 depuis un téléphone.',
        ),
      );
  };
  const sharePosition = async () => {
    try {
      const r = await Share.share({
        message: `SOS Naya : j’ai besoin d’aide. Ma position : ${mapsLink(location)}`,
      });
      if (r.action === Share.sharedAction) record(SHARED_POSITION);
    } catch {
      Alert.alert(
        'Partage impossible',
        'Envoyez votre position depuis Plans ou Messages.',
      );
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
        title="SOS · sécurité"
        subtitle={
          // Before the alert exists, say what the button will do; afterwards, what was done.
          !shown
            ? desk
              ? 'Déclenchez l’alerte : elle est transmise avec votre position à l’équipe sécurité Naya.'
              : 'Déclenchez l’alerte : elle est enregistrée avec votre position sur ce trajet.'
            : desk
              ? 'Votre alerte et votre position sont transmises à l’équipe sécurité Naya.'
              : 'Votre alerte et votre position sont enregistrées sur ce trajet.'
        }
        testID="sos-sheet"
      >
        <View style={{ gap: 12 }}>
          <Text variant="caption" tone="muted" numeric>
            Votre position · {location.lat.toFixed(5)},{' '}
            {location.lng.toFixed(5)}
          </Text>
          {!shown ? (
            <>
              <FormField
                label="Proche de confiance (facultatif)"
                helper="Son nom est joint à l’alerte. Vous pourrez prévenir cette personne ensuite."
                value={contact}
                onChangeText={setContact}
                autoCapitalize="words"
                testID="sos-contact"
              />
              <Button
                label="Déclencher l’alerte"
                variant="danger"
                loading={raise.isPending}
                onPress={trigger}
                testID="confirm-sos"
              />
              <Button
                label="Appeler le 19 (police)"
                variant="secondary"
                onPress={callPolice}
                testID="sos-call-police"
              />
            </>
          ) : (
            <>
              <StatusBanner
                tone="success"
                title={`Alerte ${shown.id} enregistrée`}
                message={
                  desk
                    ? 'Transmise à l’équipe sécurité Naya avec votre position.'
                    : 'Votre position est jointe à l’alerte. En cas de danger, appelez le 19.'
                }
                testID="sos-recorded"
              />
              {desk && shown.status !== 'new' ? (
                <StatusBanner
                  tone="info"
                  title={SAFETY_STATUS_LABELS[shown.status]}
                  message={
                    shown.status === 'resolved'
                      ? shown.resolutionNote ||
                        'L’équipe sécurité a clôturé l’alerte.'
                      : `${shown.ownerName ?? 'L’équipe sécurité'} suit votre alerte.`
                  }
                  testID="sos-desk-status"
                />
              ) : null}
              <Button
                label="Appeler le 19 (police)"
                variant="danger"
                onPress={callPolice}
                testID="sos-call-police"
              />
              <Button
                label="Prévenir un proche"
                variant="secondary"
                onPress={sharePosition}
                testID="sos-share"
              />
              {shown.actions.map((a, i) => (
                <Text key={i} variant="caption" tone="muted">
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

const MIN_TOPUP = 1000;
const MAX_TOPUP = 10_000_000;

function entryStatus(
  e: PassengerWalletEntry,
  kind?: DemoPaymentOption['kind'],
) {
  if (e.amount < 0)
    return e.status === 'confirmed'
      ? 'Payé'
      : e.status === 'pending'
        ? 'Réservé pour votre course'
        : 'Libéré';
  if (e.status === 'confirmed') return 'Créditée';
  if (e.status === 'failed') return 'Refusée';
  return kind === 'agency'
    ? 'En attente du paiement en agence'
    : 'En cours de confirmation';
}

/** Passenger wallet: balance, top-ups answered by the payment provider, and history. */
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
  const wallet = useQuery({
    queryKey,
    queryFn: api.prototype.wallet,
    // A pending top-up is answered by the provider within seconds: follow it.
    refetchInterval: (q) =>
      q.state.data?.entries.some((e) => e.amount > 0 && e.status === 'pending')
        ? 2000
        : false,
  });
  const catalog = useQuery({
    queryKey: ['naya', accountId, 'catalog'],
    queryFn: api.prototype.catalog,
  });
  const options = (catalog.data?.payments ?? []).filter(
    (p) => p.enabled && (!p.cityIds.length || p.cityIds.includes(cityId)),
  );
  const kindOf = (providerId: string | null) =>
    catalog.data?.payments.find((p) => p.id === providerId)?.kind;
  const [amount, setAmount] = useState('100');
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((p) => p.id === provider) ?? options[0];
  const cents = parseMoneyInput(amount);
  const topup = useSingleFlight(
    (vars: { amount: number; providerId: string }, k) =>
      api.prototype.topup(vars.amount, vars.providerId, k),
    {
      onSuccess: (entry) => {
        haptic.success();
        toast(
          kindOf(entry.providerId) === 'agency'
            ? `Recharge créée · référence ${entry.id} à présenter au guichet`
            : 'Recharge envoyée au prestataire',
        );
        topup.reset();
        qc.invalidateQueries({ queryKey });
      },
      // No reset here: a retry of the same amount and provider after a network error or a
      // timeout keeps the same Idempotency-Key, so the wallet is never credited twice (UI-17).
      onError: (e) => {
        haptic.error();
        if (isUncertainFailure(e)) {
          // The provider may have the top-up already: show it if so, and say the same retry
          // is safe (same amount and provider, same Idempotency-Key).
          setError(
            `${errorMessage(e)} Réessayez avec le même montant et le même moyen : la recharge ne sera pas comptée deux fois.`,
          );
          qc.invalidateQueries({ queryKey });
        } else setError(errorMessage(e));
      },
    },
  );
  const submit = () => {
    if (cents === null)
      return setError('Saisissez un montant valide, par exemple 100.');
    if (cents < MIN_TOPUP)
      return setError(`Minimum ${formatMoney(MIN_TOPUP)} par recharge.`);
    if (cents > MAX_TOPUP)
      return setError(`Maximum ${formatMoney(MAX_TOPUP)} par recharge.`);
    if (!chosen) return setError('Choisissez un moyen de recharge.');
    setError(null);
    topup.run({ amount: cents, providerId: chosen.id });
  };
  // Announce the provider's answer once, when a top-up leaves « en cours ».
  const seen = useRef(new Map<string, PassengerWalletEntry['status']>());
  useEffect(() => {
    for (const e of wallet.data?.entries ?? []) {
      const before = seen.current.get(e.id);
      if (before === 'pending' && e.amount > 0 && e.status !== 'pending') {
        if (e.status === 'confirmed') {
          haptic.success();
          toast(
            `${formatMoney(e.amount)} ajoutés à votre portefeuille`,
            'success',
          );
        } else {
          haptic.error();
          toast('Recharge refusée par le prestataire', 'danger');
        }
      }
      seen.current.set(e.id, e.status);
    }
  }, [wallet.data]);
  const entries = wallet.data?.entries.slice().reverse() ?? [];
  return (
    <Screen
      keyboard
      header={<Header title="Portefeuille Naya" onBack={onBack} />}
    >
      <View style={{ gap: 16 }}>
        {wallet.isError ? (
          <ErrorState onRetry={() => wallet.refetch()} />
        ) : null}
        <View style={styles.balance} testID="wallet-balance">
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
              onChangeText={(t) => {
                setAmount(t);
                setError(null);
              }}
              keyboardType="decimal-pad"
              error={error}
              testID="wallet-amount"
            />
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
              accessibilityRole="radiogroup"
              accessibilityLabel="Moyen de recharge"
            >
              {options.map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  selected={chosen?.id === p.id}
                  onPress={() => {
                    setProvider(p.id);
                    setError(null);
                  }}
                  testID={`wallet-provider-${p.id}`}
                />
              ))}
            </View>
            {chosen ? (
              <Text variant="caption" tone="muted">
                {chosen.kind === 'agency'
                  ? `Réglez en espèces au guichet ${chosen.name} avec la référence de la recharge. Le solde est crédité dès que l’agence confirme.`
                  : 'Le solde est crédité dès la confirmation du prestataire, en quelques secondes.'}
              </Text>
            ) : null}
            <Button
              label={
                cents !== null && cents >= MIN_TOPUP
                  ? `Recharger ${formatMoney(cents)}`
                  : 'Recharger'
              }
              loading={topup.isPending}
              disabled={!chosen}
              onPress={submit}
              testID="wallet-topup"
            />
          </View>
        </Section>
        <Section title="Opérations">
          <View style={{ gap: 12 }}>
            {wallet.data && entries.length === 0 ? (
              <Text variant="caption" tone="muted">
                Aucune opération pour le moment.
              </Text>
            ) : null}
            {entries.map((e) => {
              const kind = kindOf(e.providerId);
              return (
                <View
                  key={`${e.id}-${e.status}`}
                  style={styles.panel}
                  testID={`wallet-entry-${e.id}`}
                >
                  <Text variant="label">{e.label}</Text>
                  <Text variant="caption" tone="muted">
                    {formatShort(e.at)} · {entryStatus(e, kind)}
                  </Text>
                  <Text variant="title">{formatMoney(e.amount)}</Text>
                  {e.amount > 0 && e.status === 'pending' && kind === 'agency' ? (
                    <Text variant="caption" tone="accent">
                      Référence {e.id} à présenter au guichet
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Section>
      </View>
    </Screen>
  );
}
