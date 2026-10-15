import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { FAMILY_LIVE_POLL_MS, FAMILY_STATUS_LABELS, formatShort, formatTime, isFamilyTripActive, type FamilyFollowView } from '@naya/domain';
import { useTheme } from '../../core/theme';
import { Screen } from '../../Screen';
import { Header } from '../../Header';
import { Text } from '../../Text';
import { ErrorState, SkeletonList, StatusBanner, StatusPill } from '../../Feedback';
import { BrandMark } from '../../Brand';
import { FamilleLiveMap, FamilleSection, familyLabel, LiveFacts, styles } from './parts';

/**
 * What an invited co-parent sees from the private link: status, live map, timeline.
 * No photos, no handover codes, no phone numbers. Read-only, no account required.
 */
export function FamilleFollowScreen({ token, onClose }: { token: string; onClose?: () => void }) {
  useTheme();
  const api = useApi();
  const q = useQuery({
    queryKey: qk.familyFollow(token),
    queryFn: () => api.prototype.follow(token),
    refetchInterval: (query) => ((query.state.data as FamilyFollowView | undefined)?.trips.some((t) => isFamilyTripActive(t.status)) ? FAMILY_LIVE_POLL_MS : 15_000),
    retry: false,
  });
  const data = q.data;
  return (
    <Screen header={<Header title="Suivi Naya Famille" subtitle={data ? `Partagé par ${data.parentFirstName}` : undefined} onClose={onClose} />} testID="famille-follow">
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark height={24} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            Suivi en lecture seule. Le lien peut être retiré à tout moment par le parent.
          </Text>
        </View>
        {q.isError ? <ErrorState title="Lien indisponible" message="Ce lien de suivi n’est plus valide. Demandez un nouveau lien au parent." onRetry={() => q.refetch()} /> : null}
        {q.isLoading ? <SkeletonList rows={3} /> : null}
        {data && !data.trips.length ? <StatusBanner tone="info" title="Aucun trajet aujourd’hui" message="Les trajets apparaîtront ici dès qu’ils seront planifiés." /> : null}
        {data?.trips.map((t) => (
          <View key={t.id} style={styles.panel}>
            <StatusPill tone={t.status === 'completed' ? 'success' : t.status === 'cancelled' ? 'danger' : t.status === 'awaiting_approval' ? 'warning' : 'info'} label={FAMILY_STATUS_LABELS[t.status]} />
            <Text variant="heading">
              {t.childName} · {formatShort(t.pickupAt)}
            </Text>
            <Text variant="caption" tone="muted">
              {t.pickup.label} → {t.destination.label} · avec {t.driverFirstName}
            </Text>
            {t.live ? (
              <>
                <FamilleLiveMap trip={{ ...t, location: t.live.location }} live={t.live} height={200} />
                <LiveFacts live={t.live} />
              </>
            ) : null}
            <FamilleSection title="Étapes">
              <View style={{ gap: 6 }}>
                {t.timeline.map((e, i) => (
                  <Text key={i} variant="caption" numeric>
                    {formatTime(e.at)} · {familyLabel(e.label)}
                  </Text>
                ))}
              </View>
            </FamilleSection>
          </View>
        ))}
      </View>
    </Screen>
  );
}
