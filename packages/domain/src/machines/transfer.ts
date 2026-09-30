import type { TransferStatus } from '../entities';
import { makeMachine } from './machine';

export type TransferEvent = 'CONFIRM' | 'FAIL';

/** Recharges and withdrawals: only a confirmed provider event moves money. */
export const transferMachine = makeMachine<TransferStatus, TransferEvent>('transfer', {
  pending: { CONFIRM: 'confirmed', FAIL: 'failed' },
  confirmed: {},
  failed: {},
});

export type TransferOutcome = 'applied' | 'duplicate';

/**
 * Provider callbacks can arrive more than once. Repeating the event that produced the
 * current terminal state is a harmless duplicate; a contradictory event is a conflict.
 */
export function resolveTransferEvent(current: TransferStatus, event: TransferEvent): { next: TransferStatus; outcome: TransferOutcome } {
  if ((current === 'confirmed' && event === 'CONFIRM') || (current === 'failed' && event === 'FAIL')) {
    return { next: current, outcome: 'duplicate' };
  }
  return { next: transferMachine.next(current, event), outcome: 'applied' };
}
