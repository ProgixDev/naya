import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { FAMILY_LIVE_POLL_MS, formatShort, isFamilyTripActive, type FamilyFollowView } from '@naya/domain';
import { useTheme } from '../../core/theme';
import { Screen } from '../../Screen';
import { Header } from '../../Header';
import { Text } from '../../Text';
import { ErrorState, SkeletonList, StatusBanner } from '../../Feedback';
import { StatusIcon } from '../../StatusIcon';
import { BrandMark } from '../../Brand';
import { FamilleLiveMap, FamilleSection, FamilleTimeline, LiveFacts, styles } from './parts';

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
          <View key={t.id} style={styles.panel} testID={`famille-follow-trip-${t.id}`}>
            {/* First sight for the relative: the state's glyph with its word (R1), said once. The relative
                is not the one who approves, so the approval reads in the third person (« Accord du parent attendu »). */}
            <StatusIcon kind="familyTrip" state={t.status} viewer="driver" showLabel wording="full" announce testID={`famille-follow-status-${t.id}`} />
            <View style={{ gap: 4 }}>
              <Text variant="heading" numeric>
                {t.childName} · {formatShort(t.pickupAt)}
              </Text>
              <Text variant="caption" tone="muted">
                {t.pickup.label} → {t.destination.label} · avec {t.driverFirstName}
              </Text>
            </View>
            {t.live ? (
              <>
                <FamilleLiveMap trip={{ ...t, location: t.live.location }} live={t.live} height={200} />
                <LiveFacts live={t.live} />
              </>
            ) : null}
            <FamilleSection title="Étapes">
              <FamilleTimeline trip={t} />
            </FamilleSection>
          </View>
        ))}
      </View>
    </Screen>
  );
}
