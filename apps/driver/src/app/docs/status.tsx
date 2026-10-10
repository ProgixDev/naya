import { View } from 'react-native';
import { router } from 'expo-router';
import { Car, CheckCircle2, Clock, ShieldCheck, UserRound } from 'lucide-react-native';
import { STATUS_LABELS, type VerificationCase } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useTheme, Button, Header, Screen, StatusPill, Text } from '@naya/ui';
import { useCases } from '@/lib/queries';
import { CaseReview, statusTone } from '@/components/Dossier';

/** D05: person and vehicle reviews, independent. Both approvals are needed to receive offers. */
export default function DossierStatus() {
  useTheme();
  const { person, vehicle, data, refetch, isRefetching } = useCases();
  const recoverable = data?.recoverableRejections ?? [];
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
  const done = [person, vehicle].filter((c) => c?.status === 'approved').length;
  return (
    <Screen
      header={<Header title="Suivi du dossier" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      footer={
        both ? (
          <Button label="Aller à l’accueil" size="major" full onPress={() => router.replace('/')} testID="go-home" />
        ) : (
          <Button label="Actualiser" variant="secondary" size="major" full loading={isRefetching} onPress={() => refetch()} testID="refresh-status" />
        )
      }
      testID="dossier-status"
    >
      <View style={{ gap: 22, marginTop: 4 }}>
        {/* ── Eligibility ── */}
        <View testID={both ? 'eligible-banner' : 'blocked-banner'} style={[card(), { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: both ? colors.successSoft : colors.warningSoft }]}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            {both ? <ShieldCheck size={26} color={colors.success} strokeWidth={2} /> : <Clock size={26} color={colors.warning} strokeWidth={2} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="bold" style={{ fontSize: 17, lineHeight: 23, color: both ? colors.success : colors.warning }}>
              {both ? 'Vous pouvez recevoir des courses' : 'Réception des courses bloquée'}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 18 }}>
              {both ? 'Passez en ligne depuis l’accueil.' : 'Vous et le véhicule devez être approuvées. Délai habituel : moins de 24 h ouvrées.'}
            </Text>
          </View>
        </View>

        {/* ── Steps ── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
            <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' }}>Vérifications</Text>
            <Text weight="semibold" tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{done}/2 validées</Text>
          </View>
          <Step icon={<UserRound size={20} color={colors.accent} strokeWidth={1.9} />} title="Chauffeuse" subtitle="Identité et permis de conduire" kase={person} subject="driver_identity" recoverable={recoverable} />
          <Step icon={<Car size={20} color={colors.accent} strokeWidth={1.9} />} title="Véhicule" subtitle="Carte grise, assurance et photos" kase={vehicle} subject="vehicle" recoverable={recoverable} />
        </View>
      </View>
    </Screen>
  );
}

const card = () => ({ backgroundColor: colors.surface, borderRadius: 22, padding: 16, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;

/** One verification: a status card when approved, otherwise the actionable review (complete, correct, restart). */
function Step({ icon, title, subtitle, kase, subject, recoverable }: { icon: React.ReactNode; title: string; subtitle: string; kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle'; recoverable: string[] }) {
  useTheme();
  const approved = kase?.status === 'approved';
  return (
    <View testID={approved ? `review-${subject}` : undefined} style={[card(), { gap: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: approved ? colors.successSoft : colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>
          {approved ? <CheckCircle2 size={22} color={colors.success} strokeWidth={2} /> : icon}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text weight="semibold" style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text>
          <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{approved ? 'Vérifié par l’équipe Naya' : subtitle}</Text>
        </View>
        {kase ? <StatusPill tone={statusTone(kase.status)} label={STATUS_LABELS[kase.status]} /> : null}
      </View>
      {approved ? null : <CaseReview kase={kase} subject={subject} recoverable={recoverable} />}
    </View>
  );
}
