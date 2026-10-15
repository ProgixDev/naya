import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { familyNotificationCopy, haptic, toast, useFamily } from '@naya/ui';
import type { FamilyNotification, FamilyTrip } from '@naya/domain';

const CATEGORY = 'famille-start';
const native = Platform.OS !== 'web';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  // No approval from the notification itself: the parent must see the pick-up photo first, so
  // the only action opens the approval card in the app (FS-13). Registering the category again
  // replaces the earlier « Approuver le départ » action.
  Notifications.setNotificationCategoryAsync(CATEGORY, [{ identifier: 'open', buttonTitle: 'Voir la photo et répondre', options: { opensAppToForeground: true } }]).catch(() => undefined);
}

/**
 * Parent side of Naya Famille: turns new trip notifications (approval request, call request,
 * police call, arrival) into a local notification and an in-app prompt. There is no remote
 * push (ADR-0013): this runs while the app is open, polling the family overview.
 */
export function useFamilyAlerts(accountId: string, enabled: boolean) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const family = useFamily(accountId, enabled);
  const seen = useRef<Set<string> | null>(null);
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  }, [pathname]);

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
      announce(n, t);
      if (n.kind === 'approval_request') {
        haptic.warning();
        openTrip(t.id, here.current);
      }
    }
  }, [family.data]);

  useEffect(() => {
    if (!native) return;
    // Every response (the banner itself, « Voir la photo et répondre », or the « approve » action
    // of a notification shown before this version) only opens the trip: no blind approval.
    const respond = (r: Notifications.NotificationResponse) => {
      const once = `${r.notification.request.identifier}:${r.actionIdentifier}`;
      if (handled.has(once)) return;
      handled.add(once);
      const data = r.notification.request.content.data as { tripId?: string } | undefined;
      if (!data?.tripId) return;
      void qc.invalidateQueries({ queryKey: qk.family(accountId) });
      void qc.invalidateQueries({ queryKey: qk.familyTrip(accountId, data.tripId) });
      openTrip(data.tripId, here.current);
    };
    // A tap that launched the app arrived before this listener existed: handle it once, too.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      respond(launch);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(respond);
    return () => sub.remove();
  }, [qc, accountId]);
}

/** Notification responses already acted on (a launch tap can also reach the listener). */
const handled = new Set<string>();

/** Opens the trip (where the approval card sits first) unless it is already on screen. */
function openTrip(tripId: string, pathname: string) {
  // Exact segment: « /family/T1 » must not count as « /family/T10 » being on screen.
  if (pathname === `/family/${tripId}` || pathname.startsWith(`/family/${tripId}/`)) return;
  router.push({ pathname: '/family/[id]', params: { id: tripId } });
}

function announce(n: FamilyNotification, t: FamilyTrip) {
  const copy = familyNotificationCopy(n, t);
  if (AppState.currentState === 'active' && n.kind !== 'approval_request') toast(copy.title);
  if (!native) return;
  Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      data: { tripId: t.id, kind: n.kind },
      ...(n.kind === 'approval_request' ? { categoryIdentifier: CATEGORY } : {}),
    },
    trigger: null,
  }).catch(() => undefined);
}
