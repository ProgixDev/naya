import { casablancaLocalToUtc, casablancaToday, type CityRules } from '@naya/domain';

export type Scheduling = CityRules['scheduling'];

/** Used only when the city's rules are not loaded or a field is missing (same values as the seeded rules). */
export const FALLBACK_SCHEDULING: Scheduling = { minLeadMinutes: 30, maxDaysAhead: 7, modifyCutoffMinutes: 60 };

/**
 * Hours the picker offers, Casablanca wall clock, every SLOT_STEP_MINUTES. No city rule carries service hours yet,
 * so the night block (00:00–04:59) stays a client default; the server does not enforce it.
 */
export const SERVICE_HOURS = { first: '05:00', last: '23:45' } as const;
export const SLOT_STEP_MINUTES = 15;

/** Margin on top of the lead time, so a slot is still valid when the passenger confirms a minute later. */
const CONFIRM_MARGIN_MINUTES = 2;

const atLeast = (v: unknown, min: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min ? Math.floor(v) : fallback;

/** City rules with a per-field fallback. */
export function resolveScheduling(rules: Partial<Scheduling> | null | undefined): Scheduling {
  return {
    minLeadMinutes: atLeast(rules?.minLeadMinutes, 0, FALLBACK_SCHEDULING.minLeadMinutes),
    maxDaysAhead: atLeast(rules?.maxDaysAhead, 1, FALLBACK_SCHEDULING.maxDaysAhead),
    modifyCutoffMinutes: atLeast(rules?.modifyCutoffMinutes, 0, FALLBACK_SCHEDULING.modifyCutoffMinutes),
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Calendar date `days` after a "YYYY-MM-DD" date (pure calendar arithmetic, no time zone involved). */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

const at = (date: string, time: string) => Date.parse(casablancaLocalToUtc(date, time));

/** Earliest and latest bookable instants for `nowMs`. */
function bounds(rules: Scheduling, nowMs: number) {
  return { earliest: nowMs + (rules.minLeadMinutes + CONFIRM_MARGIN_MINUTES) * 60_000, latest: nowMs + rules.maxDaysAhead * 86_400_000 };
}

/** Casablanca-local slots ("HH:MM") of one day that respect the city's lead time and booking window. */
export function slotsFor(date: string, rules: Scheduling, nowMs: number): string[] {
  const { earliest, latest } = bounds(rules, nowMs);
  const out: string[] = [];
  for (let m = toMinutes(SERVICE_HOURS.first); m <= toMinutes(SERVICE_HOURS.last); m += SLOT_STEP_MINUTES) {
    const time = toHhmm(m);
    const t = at(date, time);
    if (t >= earliest && t <= latest) out.push(time);
  }
  return out;
}

/**
 * Whether a day has at least one open slot, from its first and last slot only (two time-zone conversions instead
 * of 76, so listing a long booking window stays cheap). Slots are evenly spaced within service hours, so when the
 * bookable range is at least one step wide, the day has a slot exactly when its slot range overlaps that range.
 */
export function hasOpenSlot(date: string, rules: Scheduling, nowMs: number): boolean {
  const { earliest, latest } = bounds(rules, nowMs);
  if (latest - earliest < SLOT_STEP_MINUTES * 60_000) return slotsFor(date, rules, nowMs).length > 0;
  return at(date, SERVICE_HOURS.last) >= earliest && at(date, SERVICE_HOURS.first) <= latest;
}

/**
 * Casablanca business days the picker lists, with their offset from today. Today is always listed (the picker
 * explains when it has no slot left); later days only when at least one slot is open.
 */
export function scheduleDays(rules: Scheduling, nowMs: number): { date: string; offset: number }[] {
  const today = casablancaToday(nowMs);
  const out: { date: string; offset: number }[] = [];
  for (let i = 0; i <= rules.maxDaysAhead; i++) {
    const date = addCalendarDays(today, i);
    if (i === 0 || hasOpenSlot(date, rules, nowMs)) out.push({ date, offset: i });
  }
  return out;
}

/**
 * Which time the picker should hold after the day or the open slots change. `auto` is the time the picker chose
 * itself (undefined once the passenger has chosen, or after her choice was cleared).
 * - a time that is still open is kept;
 * - a new day, or a time the picker chose itself, moves to the first open slot;
 * - a time the passenger chose that has closed is cleared, and stays cleared until she picks again or changes day.
 */
export function reconcileTime(input: { dayChanged: boolean; time: string | null; auto: string | null | undefined; slots: string[] }): { time: string | null; auto: string | null | undefined } {
  const { dayChanged, time, auto, slots } = input;
  if (time && slots.includes(time)) return { time, auto };
  if (dayChanged || time === auto) {
    const first = slots[0] ?? null;
    return { time: first, auto: first };
  }
  return { time: null, auto: undefined };
}

/** "45 min", "1 h", "1 h 30" for a duration in minutes. */
export function formatLeadTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
