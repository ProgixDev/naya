/** Business scheduling happens in Africa/Casablanca; everything is stored as UTC ISO strings. */
export const BUSINESS_TZ = 'Africa/Casablanca';

export type IsoUtc = string;

export const nowIso = (clock: () => number = Date.now): IsoUtc => new Date(clock()).toISOString();

const dateTimeFmt = new Intl.DateTimeFormat('fr-MA', {
  timeZone: BUSINESS_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('fr-MA', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-MA', { timeZone: BUSINESS_TZ, day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('fr-MA', { timeZone: BUSINESS_TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatDateTime = (iso: IsoUtc) => cap(dateTimeFmt.format(new Date(iso)).replace(':', 'h').replace(' à ', ' · '));
export const formatTime = (iso: IsoUtc) => timeFmt.format(new Date(iso)).replace(':', 'h');
export const formatDay = (iso: IsoUtc) => dayFmt.format(new Date(iso));
export const formatShort = (iso: IsoUtc) => shortFmt.format(new Date(iso)).replace(':', 'h');

/** Offset (minutes) of Africa/Casablanca from UTC at a given instant. */
export function casablancaOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** Convert a Casablanca wall-clock date + time ("2026-10-02", "08:30") into a UTC ISO string. */
export function casablancaLocalToUtc(date: string, time: string): IsoUtc {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const offset = casablancaOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000).toISOString();
}

/** Casablanca wall-clock parts for an instant. */
export function toCasablancaParts(iso: IsoUtc): { date: string; time: string } {
  const at = new Date(iso);
  const local = new Date(at.getTime() + casablancaOffsetMinutes(at) * 60000);
  const date = local.toISOString().slice(0, 10);
  const time = local.toISOString().slice(11, 16);
  return { date, time };
}

export const secondsBetween = (fromIso: IsoUtc, toMs: number) => Math.round((toMs - Date.parse(fromIso)) / 1000);
