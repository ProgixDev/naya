import type { CancellationPolicy, CityRules, FareBreakdown, Ride } from './entities';
import { applyBp, divRound, type BasisPoints, type Centimes } from './money';

export const NO_MULTIPLIER: BasisPoints = 10_000;

/**
 * Fare = max(base + perKm·km + perMinute·min, minimum) × multiplier.
 * Each component is rounded half away from zero to the centime when derived.
 */
export function computeFare(
  rules: Pick<CityRules, 'baseFare' | 'perKm' | 'perMinute' | 'minimumFare'>,
  distanceMeters: number,
  durationSeconds: number,
  multiplierBp: BasisPoints = NO_MULTIPLIER,
): FareBreakdown {
  if (!Number.isInteger(distanceMeters) || distanceMeters < 0) throw new RangeError('distanceMeters');
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0) throw new RangeError('durationSeconds');
  if (!Number.isInteger(multiplierBp) || multiplierBp < NO_MULTIPLIER) throw new RangeError('multiplierBp must be ≥ 10 000');
  const baseFare = rules.baseFare;
  const distanceFare = divRound(rules.perKm * distanceMeters, 1000);
  const timeFare = divRound(rules.perMinute * durationSeconds, 60);
  const subtotal = baseFare + distanceFare + timeFare;
  const minimumAdjustment = Math.max(0, rules.minimumFare - subtotal);
  const beforeMultiplier = subtotal + minimumAdjustment;
  const total = applyBp(beforeMultiplier, multiplierBp);
  return {
    baseFare,
    distanceFare,
    timeFare,
    subtotal,
    minimumAdjustment,
    multiplierBp,
    dynamicSurcharge: total - beforeMultiplier,
    total,
  };
}

export interface Split {
  gross: Centimes;
  commission: Centimes;
  net: Centimes;
}

export function splitFare(total: Centimes, commissionBp: BasisPoints): Split {
  const commission = applyBp(total, commissionBp);
  return { gross: total, commission, net: total - commission };
}

export type CancellationFeeReason = 'before_assignment' | 'within_grace' | 'after_grace' | 'after_arrival' | 'driver_cancelled' | 'not_cancellable';

export interface CancellationPreview {
  fee: Centimes;
  reason: CancellationFeeReason;
  /** When the free window ends (ISO), if one applies. */
  freeUntil: string | null;
  explanation: string;
}

/** Fee a passenger would pay if she cancelled now. Uses the frozen policy of the ride. */
export function passengerCancellationPreview(
  ride: Pick<Ride, 'status' | 'assignedAt'>,
  policy: CancellationPolicy,
  nowMs: number,
): CancellationPreview {
  switch (ride.status) {
    case 'searching':
    case 'no_driver':
      return { fee: 0, reason: 'before_assignment', freeUntil: null, explanation: 'Aucune chauffeuse n’est encore en route : l’annulation est gratuite.' };
    case 'driver_assigned': {
      const assigned = Date.parse(ride.assignedAt ?? new Date(nowMs).toISOString());
      const freeUntilMs = assigned + policy.graceSeconds * 1000;
      if (nowMs < freeUntilMs) {
        return {
          fee: 0,
          reason: 'within_grace',
          freeUntil: new Date(freeUntilMs).toISOString(),
          explanation: `Annulation gratuite pendant ${Math.round(policy.graceSeconds / 60)} minutes après l’attribution.`,
        };
      }
      return { fee: policy.feeAfterGrace, reason: 'after_grace', freeUntil: null, explanation: 'Votre chauffeuse est déjà en route depuis plus de 2 minutes.' };
    }
    case 'driver_arrived':
      return { fee: policy.feeAfterArrival, reason: 'after_arrival', freeUntil: null, explanation: 'Votre chauffeuse est arrivée au point de départ.' };
    default:
      return { fee: 0, reason: 'not_cancellable', freeUntil: null, explanation: 'Cette course ne peut plus être annulée.' };
  }
}
