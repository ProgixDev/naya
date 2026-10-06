import { useTheme , ProfileHero, Avatar, DEMO_MODE, Header, IconDisc, ListGroup, ListRow, Screen, StatusPill, TextButton, avatarFor, haptic } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CreditCard, FlaskConical, LifeBuoy, MapPin } from 'lucide-react-native';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useDraft } from '@/lib/draft';
import { useTabBarSpace } from '@/components/TabBar';

export default function Account() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const space = useTabBarSpace();
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
    <Screen testID="account" header={<Header title="Mon compte" />} contentStyle={{ paddingBottom: space + 12 }}>
      <View style={{ gap: 14, marginTop: 4 }}>
        <ProfileHero name={u ? `${u.firstName} ${u.lastName}` : 'Votre compte'} detail={`${u?.phone ?? ''} · ${me.data?.city.name ?? ''}`} source={avatarFor(u?.firstName ?? '')} status={<StatusPill tone="success" label="Compte vérifié" />} />
        <ListGroup label="Vos essentiels">
          <ListRow title="Portefeuille Naya" subtitle="Recharges et paiements de démo" onPress={() => router.push('/wallet')} testID="account-wallet" />
          <ListRow title="Naya Famille" subtitle="Abonnements et trajets enfants" onPress={() => router.push('/family')} testID="account-family" />
          <ListRow title="Identité · 6 pistes" subtitle="Explorer les propositions de logo" onPress={() => router.push('/brand')} />
          <ListRow testID="account-payments" title="Moyens de paiement" leading={<IconDisc><CreditCard size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/payments')} />
          <ListRow testID="account-places" title="Adresses enregistrées" subtitle={saved || 'Maison, travail…'} leading={<IconDisc><MapPin size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/places')} />
          <ListRow testID="account-preferences" title="Notifications" leading={<IconDisc><Bell size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/preferences')} />
        </ListGroup>
        <ListGroup label="À vos côtés">
          <ListRow testID="account-help" title="Aide et demandes" leading={<IconDisc><LifeBuoy size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/help')} />
          {DEMO_MODE ? <ListRow testID="account-dev" title="Lanceur de scénarios" subtitle="Démonstration · réinitialiser, simuler une chauffeuse" leading={<IconDisc tone="warning"><FlaskConical size={18} color={colors.warning} /></IconDisc>} onPress={() => router.push('/dev')} /> : null}
        </ListGroup>
        <TextButton label="Se déconnecter" onPress={signOut} testID="sign-out" />
      </View>
    </Screen>
  );
}
