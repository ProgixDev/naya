import type { CityRules } from './entities';
import { mad } from './money';

/** Demo business rules. Configurable by administrators; not live provider pricing. */
export const RABAT_RULES: CityRules = {
  baseFare: mad(10),
  perKm: mad(4),
  perMinute: mad(2),
  minimumFare: mad(30),
  commissionBp: 1500,
  debtLimit: mad(150),
  cancellation: { graceSeconds: 120, feeAfterGrace: mad(10), feeAfterArrival: mad(15) },
  dynamic: { enabled: false, multiplierBp: 12_000, reason: 'Forte demande autour de la gare en ce moment.' },
  offerTimeoutSeconds: 30,
  searchTimeoutSeconds: 120,
  quoteValiditySeconds: 600,
  scheduling: { minLeadMinutes: 30, maxDaysAhead: 7, modifyCutoffMinutes: 60 },
  minimumWithdrawal: mad(20),
};

export const CASABLANCA_RULES: CityRules = {
  ...RABAT_RULES,
  baseFare: mad(12),
  perKm: mad(4.5),
  perMinute: mad(2),
  minimumFare: mad(35),
  commissionBp: 1800,
  debtLimit: mad(200),
  dynamic: { enabled: false, multiplierBp: 12_000, reason: 'Forte demande à Casablanca en ce moment.' },
};
