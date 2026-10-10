import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, Check, CheckCircle2, UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors } from '@naya/tokens';
import { useTheme, Button, Header, Screen, Text } from '@naya/ui';
import { useCases } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { CaseChecklist, caseProgress } from './Dossier';
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
          onBack={onBack}
          right={!onBack ? <Button label="Se déconnecter" variant="secondary" size="compact" onPress={() => useSession.getState().signOut()} testID="sign-out" /> : undefined}
        />
      }
      footer={onBack ? undefined : <Button label="Voir le suivi" variant="secondary" size="major" full onPress={() => router.push('/docs/status')} testID="open-status" />}
      testID="dossier-hub"
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        <Overview person={person} vehicle={vehicle} />
        <CaseChecklist kase={person} subject="driver_identity" collapsed={expanded !== 'driver_identity'} onToggle={() => toggle('driver_identity')} />
        <CaseChecklist kase={vehicle} subject="vehicle" collapsed={expanded !== 'vehicle'} onToggle={() => toggle('vehicle')} />
      </View>
    </Screen>
  );
}

/** Plum summary: overall progress ring, headline for what happens next, both dossiers at a glance. */
function Overview({ person, vehicle }: { person: VerificationCase | null; vehicle: VerificationCase | null }) {
  useTheme();
  const p = caseProgress(person, 'driver_identity');
  const v = caseProgress(vehicle, 'vehicle');
  const done = p.done + v.done;
  const total = p.total + v.total;
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
  const waiting = [person, vehicle].some((c) => c?.status === 'submitted' || c?.status === 'in_review');
  const fix = [person, vehicle].some((c) => c?.status === 'more_info_requested' || c?.status === 'rejected');
  const headline = both ? 'Dossier approuvé' : fix ? 'Une pièce est à reprendre' : waiting ? 'Examen en cours' : `${total - done} étape${total - done > 1 ? 's' : ''} restante${total - done > 1 ? 's' : ''}`;
  const sub = both ? 'Vous pouvez recevoir des courses.' : fix ? 'Ouvrez le dossier concerné pour corriger.' : waiting ? 'Délai habituel : moins de 24 h ouvrées.' : 'Deux examens séparés : vous, puis votre véhicule.';
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <View style={{ borderRadius: 26, overflow: 'hidden', padding: 20, gap: 16 }} testID="dossier-overview">
      <LinearGradient colors={['#47203A', '#7C3F5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', top: -90, right: -70 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring pct={pct} done={both} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text weight="bold" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: '#FFFFFF' }}>{headline}</Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.8)' }}>{sub}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Mini icon={<UserRound size={16} color="#FFFFFF" strokeWidth={2} />} label="Identité" value={`${p.done}/${p.total}`} ok={person?.status === 'approved'} />
        <Mini icon={<Car size={16} color="#FFFFFF" strokeWidth={2} />} label="Véhicule" value={`${v.done}/${v.total}`} ok={vehicle?.status === 'approved'} />
      </View>
    </View>
  );
}

/** Circular progress drawn with two half-discs (no SVG needed). */
function Ring({ pct, done }: { pct: number; done: boolean }) {
  const size = 64;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 5, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`Dossier complété à ${pct} %`}>
      <View style={{ position: 'absolute', top: -5, left: -5, width: size, height: size, borderRadius: size / 2, borderWidth: 5, borderColor: 'transparent', borderTopColor: '#FFFFFF', borderRightColor: pct >= 50 ? '#FFFFFF' : 'transparent', borderBottomColor: pct >= 75 ? '#FFFFFF' : 'transparent', borderLeftColor: pct >= 100 ? '#FFFFFF' : 'transparent', transform: [{ rotate: '45deg' }] }} />
      {done ? <Check size={26} color="#FFFFFF" strokeWidth={3} /> : <Text weight="bold" numeric style={{ fontSize: 15, lineHeight: 20, color: '#FFFFFF' }}>{pct}%</Text>}
    </View>
  );
}

function Mini({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok?: boolean }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 10, paddingHorizontal: 12 }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.78)' }}>{label}</Text>
        <Text weight="semibold" numeric style={{ fontSize: 15, lineHeight: 20, color: '#FFFFFF' }}>{value}</Text>
      </View>
      {ok ? <CheckCircle2 size={18} color="#9AD5B4" strokeWidth={2.2} /> : null}
    </View>
  );
}
