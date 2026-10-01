import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { Button, Header, Screen, StatusBanner } from '@naya/ui';
import { useCases } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { CaseChecklist } from './Dossier';
import type { VerificationCase } from '@naya/domain';

type Subject = 'driver_identity' | 'vehicle';
const needsWork = (c: VerificationCase | null) => !c || c.status === 'draft' || c.status === 'more_info_requested';

/**
 * D04: the two independent dossiers (person, vehicle) as a Persona-style checklist. One card
 * is open at a time — the first that needs work — so the hub fits a single screen.
 */
export function DossierHub({ onBack }: { onBack?: () => void }) {
  const { person, vehicle } = useCases();
  const auto: Subject = needsWork(person) ? 'driver_identity' : needsWork(vehicle) ? 'vehicle' : 'driver_identity';
  const [open, setOpen] = useState<Subject | null>(null);
  const expanded = open ?? auto;
  const toggle = (s: Subject) => setOpen(expanded === s ? (s === 'vehicle' ? 'driver_identity' : 'vehicle') : s);
  return (
    <Screen
      header={
        <Header
          title="Votre dossier"
          subtitle="Deux examens séparés : vous, puis votre véhicule."
          onBack={onBack}
          right={!onBack ? <Button label="Se déconnecter" variant="secondary" size="compact" onPress={() => useSession.getState().signOut()} testID="sign-out" /> : undefined}
        />
      }
      footer={onBack ? undefined : <Button label="Voir le suivi" variant="secondary" size="major" full onPress={() => router.push('/docs/status')} testID="open-status" />}
      testID="dossier-hub"
    >
      <View style={{ gap: 12, marginTop: 4 }}>
        <StatusBanner compact tone="neutral" icon={<ShieldCheck size={15} color={colors.accent} />} title="Examen humain · documents privés" />
        <CaseChecklist kase={person} subject="driver_identity" collapsed={expanded !== 'driver_identity'} onToggle={() => toggle('driver_identity')} />
        <CaseChecklist kase={vehicle} subject="vehicle" collapsed={expanded !== 'vehicle'} onToggle={() => toggle('vehicle')} />
      </View>
    </Screen>
  );
}
