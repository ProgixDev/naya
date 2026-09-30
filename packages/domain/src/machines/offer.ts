import type { DriverOffer, OfferStatus } from '../entities';
import { DomainError } from '../errors';
import { makeMachine } from './machine';

export type OfferEvent = 'ACCEPT' | 'DECLINE' | 'EXPIRE' | 'WITHDRAW';

export const offerMachine = makeMachine<OfferStatus, OfferEvent>('offer', {
  pending: { ACCEPT: 'accepted', DECLINE: 'declined', EXPIRE: 'expired', WITHDRAW: 'withdrawn' },
  accepted: {},
  declined: {},
  expired: {},
  withdrawn: {},
});

/** Milliseconds left against the authoritative deadline, never negative. */
export const offerRemainingMs = (offer: Pick<DriverOffer, 'expiresAt'>, nowMs: number) =>
  Math.max(0, Date.parse(offer.expiresAt) - nowMs);

/** Whole seconds shown to the driver (ceil so "1 s" is shown until the very end). */
export const offerRemainingSeconds = (offer: Pick<DriverOffer, 'expiresAt'>, nowMs: number) =>
  Math.ceil(offerRemainingMs(offer, nowMs) / 1000);

/** Server-side guard for acceptance: late acceptance is rejected, never silently honoured. */
export function assertOfferAcceptable(offer: Pick<DriverOffer, 'status' | 'expiresAt'>, nowMs: number) {
  if (offer.status !== 'pending') throw new DomainError('OFFER_NOT_PENDING', undefined, { status: offer.status });
  if (nowMs >= Date.parse(offer.expiresAt)) throw new DomainError('OFFER_EXPIRED');
}
