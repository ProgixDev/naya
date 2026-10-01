import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Car, FileText, FlaskConical, History, LifeBuoy, UserRound } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { STATUS_LABELS } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Avatar, avatarFor, ConfirmDialog, DEMO_MODE, Header, IconDisc, ListGroup, ListRow, Screen, StatusPill, Text, TextButton } from '@naya/ui';
import { useCases, useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { statusTone } from '@/components/Dossier';
import { TAB_BAR_SPACE } from '@/components/TabBar';

/** D17 · D17-settings */
export default function Account() {
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const { person, vehicle } = useCases();
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const u = me.data?.user;
  const v = me.data?.vehicle;
  const signOut = async () => {
    setLeaving(true);
    // Leave the dispatch pool first so no offer is sent to a signed-out device.
    await api.driver.setOnline(false, null).catch(() => undefined);
    await api.auth.logout().catch(() => undefined);
    qc.removeQueries({ queryKey: qk.root });
    await useSession.getState().signOut();
  };
  return (
    <Screen header={<Header title="Compte" />} contentStyle={{ paddingBottom: TAB_BAR_SPACE + 24 }} testID="account-screen">
      <View style={{ gap: 14, marginTop: 4 }}>
        {u ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 24, padding: 14 }}>
            <Avatar source={avatarFor(u.firstName)} name={u.firstName} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="heading">
                {u.firstName} {u.lastName}
              </Text>
              <Text variant="caption" tone="muted" numeric>
                {u.phone}
                {u.ratingAverage ? ` · ${String(u.ratingAverage).replace('.', ',')} ★` : ''}
              </Text>
            </View>
          </View>
        ) : null}
        <ListGroup>
          <ListRow title="Chauffeuse" subtitle="Identité et permis" leading={<IconDisc size={36}><UserRound size={17} color={colors.accent} /></IconDisc>} trailing={person ? <StatusPill tone={statusTone(person.status)} label={STATUS_LABELS[person.status]} /> : null} onPress={() => router.push('/docs/status')} testID="account-person" />
          <ListRow title={v ? `${v.make} ${v.model}` : 'Véhicule'} subtitle={v ? `${v.plate} · ${v.color} · ${v.year}` : 'À déclarer'} leading={<IconDisc size={36}><Car size={17} color={colors.accent} /></IconDisc>} trailing={vehicle ? <StatusPill tone={statusTone(vehicle.status)} label={STATUS_LABELS[vehicle.status]} /> : null} onPress={() => router.push('/profile/vehicle')} testID="account-vehicle" />
          <ListRow title="Documents et dossier" subtitle="Vérifier ou corriger les pièces" leading={<IconDisc size={36}><FileText size={17} color={colors.accent} /></IconDisc>} onPress={() => router.push('/docs/start')} testID="account-documents" />
        </ListGroup>
        <ListGroup>
          <ListRow title="Historique des courses" leading={<IconDisc size={36}><History size={17} color={colors.accent} /></IconDisc>} onPress={() => router.push('/rides')} testID="account-rides" />
          <ListRow title="Préférences" subtitle="Notifications" leading={<IconDisc size={36}><Bell size={17} color={colors.accent} /></IconDisc>} onPress={() => router.push('/profile/preferences')} testID="account-preferences" />
          <ListRow title="Aide et demandes" subtitle="Courses, paiements ou documents" leading={<IconDisc size={36}><LifeBuoy size={17} color={colors.accent} /></IconDisc>} onPress={() => router.push('/support')} testID="account-support" />
          {DEMO_MODE ? <ListRow title="Lanceur de scénarios" subtitle="Démonstration · non livré en production" leading={<IconDisc size={36} tone="warning"><FlaskConical size={17} color={colors.warning} /></IconDisc>} onPress={() => router.push('/dev')} /> : null}
        </ListGroup>
        <TextButton label="Se déconnecter" tone="danger" onPress={() => setConfirm(true)} testID="sign-out" />
      </View>
      <ConfirmDialog visible={confirm} title="Se déconnecter ?" message="Vous ne recevrez plus de propositions sur cet appareil." confirmLabel="Se déconnecter" destructive loading={leaving} onConfirm={signOut} onCancel={() => setConfirm(false)} testID="sign-out-dialog" />
    </Screen>
  );
}
