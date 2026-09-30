import type { RideStatus } from '../entities';
import { makeMachine } from './machine';

export type RideEvent =
  | 'ASSIGN'
  | 'ARRIVE'
  | 'START'
  | 'COMPLETE'
  | 'PASSENGER_CANCEL'
  | 'DRIVER_CANCEL'
  | 'SYSTEM_CANCEL'
  | 'SEARCH_TIMEOUT'
  | 'RETRY_SEARCH';

/**
 * A driver cancellation returns the ride to `searching` so the passenger is re-matched
 * (recovery path) rather than being left with a dead booking.
 */
export const rideMachine = makeMachine<RideStatus, RideEvent>('ride', {
  searching: { ASSIGN: 'driver_assigned', PASSENGER_CANCEL: 'cancelled', SEARCH_TIMEOUT: 'no_driver', SYSTEM_CANCEL: 'cancelled' },
  driver_assigned: { ARRIVE: 'driver_arrived', PASSENGER_CANCEL: 'cancelled', DRIVER_CANCEL: 'searching', SYSTEM_CANCEL: 'cancelled' },
  driver_arrived: { START: 'in_progress', PASSENGER_CANCEL: 'cancelled', DRIVER_CANCEL: 'searching', SYSTEM_CANCEL: 'cancelled' },
  in_progress: { COMPLETE: 'completed' },
  no_driver: { RETRY_SEARCH: 'searching', PASSENGER_CANCEL: 'cancelled' },
  completed: {},
  cancelled: {},
});

export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = ['searching', 'driver_assigned', 'driver_arrived', 'in_progress'];
export const isRideActive = (s: RideStatus) => ACTIVE_RIDE_STATUSES.includes(s);
export const isRideWithDriver = (s: RideStatus) => s === 'driver_assigned' || s === 'driver_arrived' || s === 'in_progress';
