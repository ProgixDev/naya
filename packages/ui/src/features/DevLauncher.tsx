import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { brandAspect } from '@naya/assets';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage, qk } from '@naya/api';
import { Screen } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { ListGroup, ListRow } from '../List';
import { ErrorState, StatusBanner } from '../Feedback';
import { toast } from '../Toast';
import { mapEngine } from '../map';
import { resolveApiBase, STANDALONE_DEMO } from '../core/apiBase';
import { useGlassKind } from '../Glass';
import { haptic } from '../haptics';

/**
 * The only in-app way into the scenario launcher: a 2 s long press on the Naya logo of the
 * welcome screen, in development builds (__DEV__) only. It draws nothing and is hidden from
 * screen readers. Pass it as WelcomeJourney's `badge`: it is laid over the lockup beside it.
 * The launcher also opens from its deep link (naya://dev, naya-chauffeuse://dev).
 */
export function DevLauncherGesture({ onOpen, logoHeight = 30 }: { onOpen: () => void; logoHeight?: number }) {
  if (!__DEV__) return null;
  return (
    <Pressable
      onLongPress={() => {
        haptic.success();
        onOpen();
      }}
      delayLongPress={2000}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, top: 0, height: logoHeight, width: logoHeight * brandAspect.lockup }}
      testID="dev-launcher-gesture"
    />
  );
}

/**
 * Development-only scenario launcher. Resets the shared demo API to a named scenario,
 * shows demo accounts and simulates external events (provider outcomes, a second driver,
 * frozen GPS). No visible control leads here: see DevLauncherGesture and the deep link.
 */
export function DevLauncher({ onBack, onSignInAs, onOpenBrand, role }: { onBack: () => void; onSignInAs: (phone: string) => void; /** The logo board (/brand), reachable only from here (R4). */ onOpenBrand?: () => void; role: 'passenger' | 'driver' }) {
  const api = useApi();
  const qc = useQueryClient();
  const glass = useGlassKind();
  const data = useQuery({ queryKey: ['naya', 'dev', 'scenarios'], queryFn: api.dev.scenarios });
  const jobs = useQuery({ queryKey: ['naya', 'dev', 'jobs'], queryFn: api.dev.providerJobs, refetchInterval: 3000 });
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: qk.root });
      toast(label);
    } catch (e) {
      Alert.alert('Action impossible', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  if (data.isError) return <Screen header={<Header title="Lanceur de scénarios" onBack={onBack} />}><ErrorState message={STANDALONE_DEMO ? 'La démonstration n’a pas pu se charger. Réessayez.' : `API injoignable : ${resolveApiBase()}. Lancez « pnpm api ».`} onRetry={() => data.refetch()} /></Screen>;
  const d = data.data;
  const accounts = role === 'passenger' ? d?.accounts.passengers : d?.accounts.drivers;
  return (
    <Screen header={<Header title="Lanceur de scénarios" subtitle="Outil de développement · non livré en production" onBack={onBack} />}>
      <View style={{ gap: 24, marginTop: 12 }}>
        <StatusBanner tone="warning" title="Environnement de démonstration" message={STANDALONE_DEMO ? `Démo autonome sur cet appareil · scénario « ${d?.current ?? '…'} ». Les deux apps utilisent chacune leurs données locales.` : `API ${resolveApiBase()} · carte ${mapEngine} · matériau ${glass} · scénario « ${d?.current ?? '…'} »`} />
        <ListGroup label="Réinitialiser les données partagées">
          {Object.entries(d?.scenarios ?? {}).map(([id, desc]) => (
            <ListRow key={id} title={id} subtitle={desc} onPress={() => run(`Scénario « ${id} » chargé`, () => api.dev.reset(id))} testID={`scenario-${id}`} />
          ))}
        </ListGroup>
        <ListGroup label={`Comptes de démonstration · code ${d?.accounts.otp ?? '123456'}`}>
          {(accounts ?? []).map((a) => (
            <ListRow key={a.phone} title={a.name} subtitle={`${a.phone} · ${a.state}`} onPress={() => onSignInAs(a.phone)} />
          ))}
        </ListGroup>
        <ListGroup label="Simuler un événement externe">
          <ListRow title="Chauffeuse simulée en ligne" subtitle="Nadia accepte et réalise les courses automatiquement (démo)" onPress={() => run('Chauffeuse simulée en ligne', () => api.dev.setBot(true))} />
          <ListRow title="Chauffeuse simulée hors ligne" onPress={() => run('Chauffeuse simulée hors ligne', () => api.dev.setBot(false))} />
          <ListRow title="Avancer l’horloge de 30 s" subtitle="Expire une proposition, fait avancer les délais" onPress={() => run('Horloge avancée de 30 s', () => api.dev.advanceClock(30))} />
          <ListRow title="Avancer l’horloge de 2 min" subtitle="Fin de recherche sans chauffeuse" onPress={() => run('Horloge avancée de 2 min', () => api.dev.advanceClock(120))} />
        </ListGroup>
        <ListGroup label="Naya Famille · trajet enfant de bout en bout">
          {role === 'passenger' ? (
            <ListRow title="Trajet avec chauffeuse simulée" subtitle="Amina part, photographie Lina, demande votre accord, roule (GPS chaque seconde) et la dépose à l’école" onPress={() => run('Trajet Famille lancé · ouvrez Naya Famille', () => api.dev.playFamily({ driver: true, parent: null }))} testID="dev-famille-play" />
          ) : (
            <>
              <ListRow title="Parent simulé · approuve" subtitle="Salma approuve à distance 5 s après « Démarrer »" onPress={() => run('Trajet Famille lancé · ouvrez Naya Famille', () => api.dev.playFamily({ driver: false, parent: 'approve' }))} testID="dev-famille-approve" />
              <ListRow title="Parent simulé · refuse" subtitle="Le départ est refusé : la chauffeuse reste avec l’enfant" onPress={() => run('Trajet Famille lancé (refus)', () => api.dev.playFamily({ driver: false, parent: 'refuse' }))} testID="dev-famille-refuse" />
              <ListRow title="Parent simulé · ne répond pas" subtitle="La demande expire après 3 min (avancez l’horloge de 2 min, deux fois)" onPress={() => run('Trajet Famille lancé (sans réponse)', () => api.dev.playFamily({ driver: false, parent: 'timeout' }))} testID="dev-famille-timeout" />
            </>
          )}
        </ListGroup>
        {onOpenBrand ? (
          <ListGroup label="Marque">
            <ListRow title="Identité · 6 pistes" subtitle="Planche des logos (session ouverte)" onPress={onOpenBrand} testID="dev-brand" />
          </ListGroup>
        ) : null}
        {(jobs.data ?? []).length ? (
          <ListGroup label="Opérations en attente chez le prestataire">
            {(jobs.data ?? []).map((j) => (
              <View key={j.id} style={{ padding: 16, gap: 8 }}>
                <Text variant="label">
                  {j.kind} · {j.ref}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button label="Confirmer" size="compact" variant="secondary" loading={busy === `c${j.id}`} onPress={() => run('Confirmation du prestataire simulée', () => api.dev.resolveProvider(j.kind as 'payment', j.ref, 'confirm'))} />
                  <Button label="Faire échouer" size="compact" variant="secondary" onPress={() => run('Échec du prestataire simulé', () => api.dev.resolveProvider(j.kind as 'payment', j.ref, 'fail'))} />
                </View>
              </View>
            ))}
          </ListGroup>
        ) : null}
      </View>
    </Screen>
  );
}
