import { casablancaLocalToUtc, toCasablancaParts } from '@naya/domain';

/** Midnight today, Africa/Casablanca, as a UTC instant. */
export function startOfTodayUtc() {
  return casablancaLocalToUtc(toCasablancaParts(new Date().toISOString()).date, '00:00');
}

export function daysAgoUtc(days: number) {
  return new Date(Date.parse(startOfTodayUtc()) - (days - 1) * 86_400_000).toISOString();
}
