import type { CityRules, ScheduledBooking, ScheduledStatus } from '../entities';
import { DomainError } from '../errors';
import { makeMachine } from './machine';

export type ScheduledEvent = 'MODIFY' | 'CANCEL' | 'DISPATCH' | 'EXPIRE';

/** "Scheduled" means recorded. No driver has accepted until dispatch creates a ride. */
export const scheduledMachine = makeMachine<ScheduledStatus, ScheduledEvent>('scheduled', {
  scheduled: { MODIFY: 'scheduled', CANCEL: 'cancelled', DISPATCH: 'dispatched', EXPIRE: 'expired' },
  dispatched: {},
  cancelled: {},
  expired: {},
});

export function assertPickupTimeAllowed(pickupAtIso: string, rules: CityRules['scheduling'], nowMs: number) {
  const t = Date.parse(pickupAtIso);
  if (Number.isNaN(t)) throw new DomainError('VALIDATION', 'Horaire invalide.');
  if (t < nowMs + rules.minLeadMinutes * 60_000) {
    throw new DomainError('SCHEDULE_TOO_SOON', `Réservez au moins ${rules.minLeadMinutes} minutes à l’avance.`);
  }
  if (t > nowMs + rules.maxDaysAhead * 86_400_000) {
    throw new DomainError('SCHEDULE_TOO_FAR', `Réservez au plus ${rules.maxDaysAhead} jours à l’avance.`);
  }
}

export function assertModifiable(b: Pick<ScheduledBooking, 'status' | 'pickupAt'>, rules: CityRules['scheduling'], nowMs: number) {
  if (b.status !== 'scheduled') throw new DomainError('INVALID_TRANSITION');
  if (Date.parse(b.pickupAt) - nowMs < rules.modifyCutoffMinutes * 60_000) {
    throw new DomainError('SCHEDULE_CUTOFF', `Modification possible jusqu’à ${rules.modifyCutoffMinutes} minutes avant le départ.`);
  }
}
