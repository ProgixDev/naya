import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { dossierOverview } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Header, Screen, StatusBanner, StatusIcon, Text, useTheme } from '@naya/ui';
import { CaseReview } from '@/components/Dossier';
import { useSignup } from '@/components/signup/useSignup';

/** How often the screen asks for the reviewer's decision while a dossier is being examined. */
const POLL_MS = 5000;

/**
 * D05: person, vehicle and (when requested) Naya Famille reviews, independent. Person and vehicle
 * approvals are needed to receive offers. While a dossier waits for review the screen polls, and it
 * refreshes on focus and on pull (D-38: no « Actualiser » button). One status line per screen: the
 * approved hero, or a one-line note that offers wait for both approvals; a complement request is the
 * only warning (D-36). The progress figure shows only while something is left to fill in (D-37).
 */
export default function DossierStatus() {
  useTheme();
  const { person, vehicle, famille, data, refetch, ctx } = useSignup();
  /** Only a pull shows the spinner; polling and focus refreshes stay silent. */
  const [refreshing, setRefreshing] = useState(false);
  const recoverable = data?.recoverableRejections ?? [];
  const waiting = [person, vehicle, famille].some((c) => c?.status === 'submitted' || c?.status === 'in_review');
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, refetch]);
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
  const filling = !person || !vehicle || [person, vehicle, famille].some((c) => c?.status === 'draft');
  const overview = dossierOverview({ person, vehicle, famille }, ctx);
  return (
    <Screen
      header={<Header title="Suivi du dossier" subtitle={both ? undefined : 'Délai habituel : moins de 24 h ouvrées.'} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          colors={[colors.accent]}
          onRefresh={() => {
            setRefreshing(true);
            void refetch().finally(() => setRefreshing(false));
          }}
        />
      }
      testID="dossier-status"
    >
      <View style={{ gap: 12, marginTop: 4 }}>
        {both ? (
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }} testID="eligible-banner">
            <StatusIcon kind="verification" state="approved" size="lg" variant="disc" showLabel wording="full" />
            <Text variant="caption" tone="muted" align="center">
              Vous pouvez recevoir des courses : passez en ligne depuis l’accueil.
            </Text>
          </View>
        ) : (
          <StatusBanner compact tone="neutral" title="Courses en attente des deux approbations" message="la vôtre et celle du véhicule" testID="blocked-banner" />
        )}
        {filling ? (
          <Text variant="caption" tone="muted" numeric testID="dossier-progress">
            Dossier complété à {overview.percent} %
          </Text>
        ) : null}
        <CaseReview kase={person} subject="driver_identity" recoverable={recoverable} ctx={ctx} />
        <CaseReview kase={vehicle} subject="vehicle" recoverable={recoverable} ctx={ctx} />
        {famille ? <CaseReview kase={famille} subject="driver_famille" recoverable={recoverable} ctx={ctx} /> : null}
        {!famille ? <Button label="Conduire pour Naya Famille" variant="ghost" full onPress={() => router.push('/docs/famille')} testID="status-famille" /> : null}
      </View>
    </Screen>
  );
}
