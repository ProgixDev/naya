import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, newIdempotencyKey, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { haptic, toast, useFamily } from '@naya/ui';
import type { FamilyNotification } from '@naya/domain';

const CATEGORY = 'famille-start';
const native = Platform.OS !== 'web';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  // Remote approval straight from the notification (« Approuver le départ »).
  Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'approve', buttonTitle: 'Approuver le départ', options: { opensAppToForeground: true } },
    { identifier: 'open', buttonTitle: 'Voir la photo', options: { opensAppToForeground: true } },
  ]).catch(() => undefined);
}

/**
 * Parent side of Naya Famille: turns new trip notifications (approval request, call request,
 * police call, arrival) into a local notification and an in-app prompt. There is no remote
 * push (ADR-0013): this runs while the app is open, polling the family overview.
 */
export function useFamilyAlerts(accountId: string, enabled: boolean) {
  const api = useApi();
  const qc = useQueryClient();
  const pathname = usePathname();
  const family = useFamily(accountId, enabled);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const trips = family.data?.trips;
    if (!trips) return;
    const all = trips.flatMap((t) => t.notifications.filter((n) => (n.audience ?? 'parent') === 'parent' && n.id).map((n) => ({ n, t })));
    if (!seen.current) {
      // First load: never replay old notifications.
      seen.current = new Set(all.map(({ n }) => n.id!));
      return;
    }
    for (const { n, t } of all) {
      if (seen.current.has(n.id!)) continue;
      seen.current.add(n.id!);
      announce(n, t.id);
      if (n.kind === 'approval_request') {
        haptic.warning();
        if (!pathname.startsWith(`/family/${t.id}`)) router.push({ pathname: '/family/[id]', params: { id: t.id } });
      }
    }
  }, [family.data, pathname]);

  useEffect(() => {
    if (!native) return;
    const sub = Notifications.addNotificationResponseReceivedListener(async (r) => {
      const data = r.notification.request.content.data as { tripId?: string; approvalId?: string; kind?: string } | undefined;
      if (!data?.tripId) return;
      if (r.actionIdentifier === 'approve' && data.approvalId) {
        try {
          await api.prototype.approveStart(data.tripId, { decision: 'approve', mode: 'remote', approvalId: data.approvalId }, newIdempotencyKey());
          toast('Départ approuvé à distance', 'success');
          await qc.invalidateQueries({ queryKey: qk.family(accountId) });
        } catch (e) {
          toast(errorMessage(e), 'danger');
        }
      }
      router.push({ pathname: '/family/[id]', params: { id: data.tripId } });
    });
    return () => sub.remove();
  }, [api, qc, accountId]);
}

function announce(n: FamilyNotification, tripId: string) {
  if (AppState.currentState === 'active' && n.kind !== 'approval_request') toast(n.title);
  if (!native) return;
  Notifications.scheduleNotificationAsync({
    content: {
      title: n.title,
      body: n.body ?? '',
      data: { tripId, approvalId: n.approvalId, kind: n.kind },
      ...(n.kind === 'approval_request' ? { categoryIdentifier: CATEGORY } : {}),
    },
    trigger: null,
  }).catch(() => undefined);
}
