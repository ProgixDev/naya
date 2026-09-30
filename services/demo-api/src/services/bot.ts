import type { Ctx } from '../context';
import { acceptOffer, confirmCashCollected, driverArrive, driverComplete, driverCompleteStop, driverStart, DEMO_TIME_FACTOR } from './rides';

/**
 * Development-only simulated driver ("chauffeuse simulée"), used to exercise the passenger
 * app without a second phone. It is enabled explicitly from the scenario launcher, is
 * labelled as simulated everywhere, and never acts for the real driver app account.
 */
export function runBots(ctx: Ctx): boolean {
  const s = ctx.store.state;
  const now = ctx.clock.now();
  let acted = false;
  for (const p of s.presence.filter((x) => x.bot && x.online)) {
    const driver = s.users.find((u) => u.id === p.driverId);
    if (!driver) continue;
    const offer = s.offers.find((o) => o.driverId === driver.id && o.status === 'pending');
    try {
      if (offer && now - Date.parse(offer.createdAt) >= 3000) {
        acceptOffer(ctx, driver, offer.id);
        acted = true;
        continue;
      }
      const ride = s.rides.find((r) => r.driverId === driver.id && ['driver_assigned', 'driver_arrived', 'in_progress'].includes(r.status));
      if (!ride) {
        const unpaid = s.rides.find((r) => r.driverId === driver.id && r.status === 'completed' && r.paymentMethod.kind === 'cash' && s.payments.find((x) => x.id === r.paymentId)?.status === 'pending');
        if (unpaid) {
          confirmCashCollected(ctx, driver, unpaid.id, unpaid.terms.breakdown.total);
          acted = true;
        }
        continue;
      }
      if (ride.status === 'driver_assigned' && now - Date.parse(ride.assignedAt!) >= 15_000) driverArrive(ctx, driver, ride.id);
      else if (ride.status === 'driver_arrived' && now - Date.parse(ride.arrivedAt!) >= 8000) driverStart(ctx, driver, ride.id);
      else if (ride.status === 'in_progress') {
        const elapsed = now - Date.parse(ride.startedAt!);
        const total = (ride.route.durationSeconds * 1000) / DEMO_TIME_FACTOR;
        const intermediate = ride.route.stops.length - 2;
        if (ride.completedStops < intermediate && elapsed >= (total * (ride.completedStops + 1)) / (intermediate + 1)) driverCompleteStop(ctx, driver, ride.id);
        else if (elapsed >= total) driverComplete(ctx, driver, ride.id);
        else continue;
      } else continue;
      acted = true;
    } catch (e) {
      console.warn('[bot]', (e as Error).message);
    }
  }
  return acted;
}
