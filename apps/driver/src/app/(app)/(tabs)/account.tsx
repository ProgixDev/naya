import { useTheme, ProfileHero, avatarFor, ConfirmDialog, Header, ListGroup, ListRow, Screen, toast } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { familleEligibilityOf } from '@naya/domain';
import { useCases, useMe } from '@/lib/queries';
import { useDriverSignOut } from '@/components/useDriverSignOut';

/**
 * D17 · D17-settings. Text rows, no icon discs (A124–A128, D-30). Each dossier row carries its state
 * once, as a trailing glyph whose word shows only for a problem (A122, A123, A125, D-29); the verified
 * seal sits beside the name (A121). The logo board (/brand) is not a customer screen (X-01, R4).
 * « Lavage à domicile » lives here, not on the dashboard, which is a work tool (R7).
 */
export default function Account() {
  useTheme();
  const me = useMe();
  const { person, vehicle } = useCases();
  const [confirm, setConfirm] = useState(false);
  const signOut = useDriverSignOut();
  const u = me.data?.user;
  const v = me.data?.vehicle;
  const leave = async () => {
    const refusal = await signOut.run();
    if (refusal) {
      // DRV-10: the server's reason (« Terminez la course en cours… », no network), never swallowed.
      setConfirm(false);
      toast(refusal, 'danger');
    }
  };
  return (
    <Screen tabBar header={<Header title="Compte" />} testID="account-screen">
      <View style={{ gap: 24, marginTop: 4 }}>
        {u ? (
          <ProfileHero
            name={`${u.firstName} ${u.lastName}`}
            detail={`${u.phone}${u.ratingAverage ? ` · ${String(u.ratingAverage).replace('.', ',')} ★` : ''}`}
            source={avatarFor(u.firstName)}
            verified={person?.status === 'approved'}
          />
        ) : null}
        <ListGroup label="Votre activité">
          <ListRow title="Chauffeuse" subtitle="Identité et permis" status={person ? { kind: 'verification', state: person.status } : undefined} onPress={() => router.push('/docs/status')} testID="account-person" />
          <ListRow
            title={v ? `${v.make} ${v.model}` : 'Véhicule'}
            subtitle={v ? `${v.plate} · ${v.color} · ${v.year}` : 'À déclarer'}
            status={vehicle ? { kind: 'verification', state: vehicle.status } : undefined}
            onPress={() => router.push('/profile/vehicle')}
            testID="account-vehicle"
          />
          <ListRow title="Documents et dossier" subtitle="Vérifier ou corriger les pièces" onPress={() => router.push('/docs/start')} testID="account-documents" />
          <ListRow title="Agrément Naya Famille" subtitle="Conduire des enfants" status={u ? { kind: 'familleEligibility', state: familleEligibilityOf(u) } : undefined} onPress={() => router.push('/docs/famille')} testID="account-famille-eligibility" />
        </ListGroup>
        <ListGroup label="Vos essentiels">
          <ListRow title="Naya Famille" subtitle="Abonnements et trajets enfants" onPress={() => router.push('/family')} testID="account-family" />
          <ListRow title="Lavage à domicile" subtitle="Votre voiture lavée sur place" onPress={() => router.push('/car-wash')} testID="account-car-wash" />
          <ListRow title="Historique des courses" onPress={() => router.push('/rides')} testID="account-rides" />
          <ListRow title="Préférences" subtitle="Notifications, apparence, suppression du compte" onPress={() => router.push('/profile/preferences')} testID="account-preferences" />
          <ListRow title="Aide et demandes" subtitle="Courses, paiements ou documents" onPress={() => router.push('/support')} testID="account-support" />
        </ListGroup>
        {/* Sign-out is the last row, in danger text, in both apps (§5.9). */}
        <ListGroup>
          <ListRow title="Se déconnecter" destructive chevron={false} onPress={() => setConfirm(true)} testID="sign-out" />
        </ListGroup>
      </View>
      <ConfirmDialog visible={confirm} title="Se déconnecter ?" message="Vous ne recevrez plus de propositions sur cet appareil." confirmLabel="Se déconnecter" destructive loading={signOut.pending} onConfirm={leave} onCancel={() => setConfirm(false)} testID="sign-out-dialog" />
    </Screen>
  );
}
