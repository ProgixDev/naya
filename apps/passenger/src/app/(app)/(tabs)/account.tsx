import { useTheme, ProfileHero, Header, ListGroup, ListRow, Screen, avatarFor, haptic } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { useIdentityCase, useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useDraft } from '@/lib/draft';

/**
 * P13. Text rows, no icon discs (A81–A84); the verified seal sits beside the name (A80). The logo
 * board (/brand) is not a customer screen and has no row here (X-01, R4).
 */
export default function Account() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const { identity } = useIdentityCase();
  const u = me.data?.user;
  const signOut = async () => {
    haptic.tap();
    await api.auth.logout().catch(() => undefined);
    qc.removeQueries({ queryKey: qk.root });
    useDraft.getState().reset();
    await useSession.getState().signOut();
  };
  const saved = u?.savedPlaces.map((p) => p.label).join(' · ');
  return (
    <Screen testID="account" tabBar header={<Header title="Mon compte" />}>
      <View style={{ gap: 24, marginTop: 4 }}>
        <ProfileHero name={u ? `${u.firstName} ${u.lastName}` : 'Votre compte'} detail={`${u?.phone ?? ''} · ${me.data?.city.name ?? ''}`} source={avatarFor(u?.firstName ?? '')} verified={identity?.status === 'approved'} />
        <ListGroup label="Vos essentiels">
          <ListRow title="Portefeuille Naya" subtitle="Solde, recharges et paiements" onPress={() => router.push('/wallet')} testID="account-wallet" />
          <ListRow title="Naya Famille" subtitle="Abonnements et trajets enfants" onPress={() => router.push('/family')} testID="account-family" />
          <ListRow testID="account-payments" title="Moyens de paiement" onPress={() => router.push('/payments')} />
          <ListRow testID="account-places" title="Adresses enregistrées" subtitle={saved || 'Maison, travail…'} onPress={() => router.push('/places')} />
          <ListRow testID="account-preferences" title="Préférences" subtitle="Notifications, apparence, suppression du compte" onPress={() => router.push('/preferences')} />
        </ListGroup>
        <ListGroup label="À vos côtés">
          <ListRow testID="account-help" title="Aide et demandes" onPress={() => router.push('/help')} />
        </ListGroup>
        {/* Sign-out is the last row, in danger text, in both apps (§5.9). */}
        <ListGroup>
          <ListRow title="Se déconnecter" destructive chevron={false} onPress={signOut} testID="sign-out" />
        </ListGroup>
      </View>
    </Screen>
  );
}
