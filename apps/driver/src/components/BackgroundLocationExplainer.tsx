import { useTheme, Button, IconDisc, Sheet, Text, TextButton, toast } from '@naya/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Flag, LocateFixed } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { needsBackgroundConsent, requestRideBackgroundLocation } from '@/lib/backgroundLocation';

/** Rides on which the driver already answered: the explainer is offered at most once per ride, even if the ride screen remounts. */
const answered = new Set<string>();

const FOREGROUND_ONLY = 'Position partagée seulement quand l’application est ouverte.';

/**
 * Prominent disclosure before the « Always » location prompt (DRV-16). Offered on an accepted ride
 * while the permission can still be asked; the system prompt only follows « Autoriser ».
 * « Plus tard » or a refusal keeps foreground sharing (lib/location). Renders nothing in standalone
 * builds and on the web (no background task there).
 */
export function useBackgroundLocationConsent(rideId: string | null | undefined) {
  // The ride the explainer is offered for; it hides by itself when the ride ends or changes.
  const [askFor, setAskFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!rideId || answered.has(rideId)) return;
    let live = true;
    needsBackgroundConsent().then((needed) => {
      if (live && needed) setAskFor(rideId);
    });
    return () => {
      live = false;
    };
  }, [rideId]);
  const visible = !!rideId && askFor === rideId;
  const close = () => {
    if (rideId) answered.add(rideId);
    setAskFor(null);
  };
  const allow = async () => {
    setBusy(true);
    const r = await requestRideBackgroundLocation();
    setBusy(false);
    close();
    if (r === 'foreground-only') toast(FOREGROUND_ONLY);
  };
  const later = () => close();
  return { visible, busy, allow, later };
}

/** Mount once on the ride screen: `<BackgroundLocationExplainer rideId={ride?.id} />`. */
export function BackgroundLocationExplainer({ rideId }: { rideId: string | null | undefined }) {
  useTheme();
  const { visible, busy, allow, later } = useBackgroundLocationConsent(rideId);
  return (
    <Sheet visible={visible} onClose={later} dismissible={!busy} title="Partager votre position pendant la course ?" testID="background-location-explainer">
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconDisc><LocateFixed size={20} color={colors.accent} /></IconDisc>
          <Text variant="label" style={{ flex: 1 }}>Pendant une course acceptée, la passagère voit votre position, même écran verrouillé ou application en arrière-plan.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconDisc><Flag size={20} color={colors.accent} /></IconDisc>
          <Text variant="label" style={{ flex: 1 }}>Le partage s’arrête à la fin de la course. Hors course, votre position n’est jamais suivie en arrière-plan.</Text>
        </View>
        <Text variant="caption" tone="muted">À l’étape suivante, choisissez « Toujours ». Sans cette autorisation, votre position n’est partagée que lorsque l’application est ouverte.</Text>
        <Button label="Autoriser" size="major" full loading={busy} onPress={allow} testID="allow-background-location" />
        <TextButton label="Plus tard" onPress={later} testID="background-location-later" />
      </View>
    </Sheet>
  );
}
