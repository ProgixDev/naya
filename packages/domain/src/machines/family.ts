import type { FamilyTripStatus } from '../prototype';
import { makeMachine } from './machine';

/**
 * Naya Famille trip events. The chauffeuse plays DEPART → ARRIVE → PICKUP (photo of the
 * child) → REQUEST_START (« Démarrer »). Only the parent can APPROVE or REFUSE the start;
 * EXPIRE is the server's timeout. DROPOFF (photo on the school premises + handover code)
 * closes the trip. CANCEL is open until the child has left with the chauffeuse.
 */
export type FamilyTripEvent =
  | 'DEPART'
  | 'ARRIVE'
  | 'PICKUP'
  | 'REQUEST_START'
  | 'APPROVE'
  | 'REFUSE'
  | 'EXPIRE'
  | 'DROPOFF'
  | 'CANCEL';

/**
 * There is deliberately no `picked_up → in_progress` edge: a trip can only start through
 * `awaiting_approval` and the parent's APPROVE. A refusal or a timeout returns the trip to
 * `picked_up` (the child stays at the pick-up point with the chauffeuse, who may ask again
 * after speaking to the parent, or cancel and hand the child back).
 */
export const familyTripMachine = makeMachine<FamilyTripStatus, FamilyTripEvent>('family-trip', {
  scheduled: { DEPART: 'en_route', CANCEL: 'cancelled' },
  en_route: { ARRIVE: 'arrived', CANCEL: 'cancelled' },
  arrived: { PICKUP: 'picked_up', CANCEL: 'cancelled' },
  picked_up: { REQUEST_START: 'awaiting_approval', CANCEL: 'cancelled' },
  awaiting_approval: { APPROVE: 'in_progress', REFUSE: 'picked_up', EXPIRE: 'picked_up' },
  in_progress: { DROPOFF: 'completed' },
  completed: {},
  cancelled: {},
});

/** The chauffeuse's single forward step from each status (the « advance » button). */
export const FAMILY_DRIVER_STEP: Partial<Record<FamilyTripStatus, FamilyTripEvent>> = {
  scheduled: 'DEPART',
  en_route: 'ARRIVE',
  arrived: 'PICKUP',
  picked_up: 'REQUEST_START',
  in_progress: 'DROPOFF',
};

export const FAMILY_ACTIVE_STATUSES: readonly FamilyTripStatus[] = ['en_route', 'arrived', 'picked_up', 'awaiting_approval', 'in_progress'];
export const isFamilyTripActive = (s: FamilyTripStatus) => FAMILY_ACTIVE_STATUSES.includes(s);
export const isFamilyTripClosed = (s: FamilyTripStatus) => s === 'completed' || s === 'cancelled';
