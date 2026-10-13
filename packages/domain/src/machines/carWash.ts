import type { WashOrderStatus } from '../carWash';
import { makeMachine } from './machine';

export type WashEvent = 'ASSIGN' | 'DEPART' | 'START' | 'COMPLETE' | 'CUSTOMER_CANCEL' | 'SYSTEM_CANCEL';

/**
 * Wash order lifecycle: réservé → équipe assignée → en route → lavage en cours → terminé.
 * The customer may cancel until the wash starts (the fee depends on the stage); once the
 * team is washing, the order can only complete.
 */
export const washOrderMachine = makeMachine<WashOrderStatus, WashEvent>('wash_order', {
  booked: { ASSIGN: 'washer_assigned', CUSTOMER_CANCEL: 'cancelled', SYSTEM_CANCEL: 'cancelled' },
  washer_assigned: { DEPART: 'en_route', CUSTOMER_CANCEL: 'cancelled', SYSTEM_CANCEL: 'cancelled' },
  en_route: { START: 'washing', CUSTOMER_CANCEL: 'cancelled', SYSTEM_CANCEL: 'cancelled' },
  washing: { COMPLETE: 'completed' },
  completed: {},
  cancelled: {},
});

export const OPEN_WASH_STATUSES: readonly WashOrderStatus[] = ['booked', 'washer_assigned', 'en_route', 'washing'];
export const isWashOpen = (s: WashOrderStatus) => OPEN_WASH_STATUSES.includes(s);
