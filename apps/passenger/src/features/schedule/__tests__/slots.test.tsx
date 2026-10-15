import { describe, expect, it } from '@jest/globals';
import { casablancaLocalToUtc } from '@naya/domain';
import { FALLBACK_SCHEDULING, addCalendarDays, formatLeadTime, hasOpenSlot, reconcileTime, resolveScheduling, scheduleDays, slotsFor } from '../slots';

const at = (date: string, time: string) => Date.parse(casablancaLocalToUtc(date, time));

describe('resolveScheduling', () => {
  it('uses the city rules when present', () => {
    expect(resolveScheduling({ minLeadMinutes: 60, maxDaysAhead: 14, modifyCutoffMinutes: 90 })).toEqual({ minLeadMinutes: 60, maxDaysAhead: 14, modifyCutoffMinutes: 90 });
  });
  it('falls back per field when rules are missing or invalid', () => {
    expect(resolveScheduling(null)).toEqual(FALLBACK_SCHEDULING);
    expect(resolveScheduling({ minLeadMinutes: 45 })).toEqual({ ...FALLBACK_SCHEDULING, minLeadMinutes: 45 });
    expect(resolveScheduling({ maxDaysAhead: 0, modifyCutoffMinutes: -5 })).toEqual(FALLBACK_SCHEDULING);
  });
});

describe('slotsFor', () => {
  const now = at('2026-10-15', '09:00');

  it('starts after the city lead time (plus a confirmation margin)', () => {
    expect(slotsFor('2026-10-15', { ...FALLBACK_SCHEDULING, minLeadMinutes: 30 }, now)[0]).toBe('09:45');
    expect(slotsFor('2026-10-15', { ...FALLBACK_SCHEDULING, minLeadMinutes: 60 }, now)[0]).toBe('10:15');
  });

  it('keeps the night block closed (05:00 to 23:45, every 15 minutes)', () => {
    const slots = slotsFor('2026-10-16', FALLBACK_SCHEDULING, now);
    expect(slots[0]).toBe('05:00');
    expect(slots[slots.length - 1]).toBe('23:45');
    expect(slots).toHaveLength(76);
  });

  it('stops at the city booking window', () => {
    const rules = { ...FALLBACK_SCHEDULING, maxDaysAhead: 2 };
    const last = slotsFor('2026-10-17', rules, now);
    expect(last[last.length - 1]).toBe('09:00');
    expect(slotsFor('2026-10-18', rules, now)).toEqual([]);
  });
});

describe('scheduleDays', () => {
  it('lists today and every later day with an open slot, up to the window', () => {
    const days = scheduleDays({ ...FALLBACK_SCHEDULING, maxDaysAhead: 2 }, at('2026-10-15', '09:00'));
    expect(days).toEqual([
      { date: '2026-10-15', offset: 0 },
      { date: '2026-10-16', offset: 1 },
      { date: '2026-10-17', offset: 2 },
    ]);
  });

  it('keeps today listed late at night even without a slot', () => {
    const now = at('2026-10-15', '23:50');
    const days = scheduleDays(FALLBACK_SCHEDULING, now);
    expect(days[0]).toEqual({ date: '2026-10-15', offset: 0 });
    expect(slotsFor('2026-10-15', FALLBACK_SCHEDULING, now)).toEqual([]);
  });

  it('uses Casablanca business dates, not the device clock', () => {
    // 23:30 UTC on Oct 15 is already Oct 16 in Casablanca (UTC+1 outside Ramadan).
    const days = scheduleDays(FALLBACK_SCHEDULING, Date.parse('2026-10-15T23:30:00Z'));
    expect(days[0]!.date).toBe('2026-10-16');
  });
});

describe('hasOpenSlot', () => {
  it('agrees with the full slot list around the clock, for short and long lead times', () => {
    // Every half hour of a day (offset by 7 min so "now" never sits on a slot), each day of a 2-day window and the day after.
    for (const minLeadMinutes of [10, 30, 600]) {
      const rules = { ...FALLBACK_SCHEDULING, minLeadMinutes, maxDaysAhead: 2 };
      for (let m = 0; m < 24 * 60; m += 30) {
        const now = at('2026-10-15', '00:07') + m * 60_000;
        for (let d = 0; d <= 3; d++) {
          const date = addCalendarDays('2026-10-15', d);
          expect(hasOpenSlot(date, rules, now)).toBe(slotsFor(date, rules, now).length > 0);
        }
      }
    }
  });
});

describe('reconcileTime', () => {
  const slots = ['10:00', '10:15', '10:30'];

  it('keeps a time that is still open', () => {
    expect(reconcileTime({ dayChanged: false, time: '10:15', auto: undefined, slots })).toEqual({ time: '10:15', auto: undefined });
  });
  it('starts a new day on its first slot', () => {
    expect(reconcileTime({ dayChanged: true, time: null, auto: undefined, slots })).toEqual({ time: '10:00', auto: '10:00' });
  });
  it('moves a time the picker chose itself when it closes (for example once the city rules load)', () => {
    expect(reconcileTime({ dayChanged: false, time: '09:45', auto: '09:45', slots })).toEqual({ time: '10:00', auto: '10:00' });
  });
  it('clears a time the passenger chose when it closes, and never picks another one for her', () => {
    const cleared = reconcileTime({ dayChanged: false, time: '09:45', auto: undefined, slots });
    expect(cleared).toEqual({ time: null, auto: undefined });
    expect(reconcileTime({ dayChanged: false, ...cleared, slots: slots.slice(1) })).toEqual({ time: null, auto: undefined });
  });
});

describe('helpers', () => {
  it('adds calendar days across months', () => {
    expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('formats lead times in French', () => {
    expect(formatLeadTime(45)).toBe('45 min');
    expect(formatLeadTime(60)).toBe('1 h');
    expect(formatLeadTime(90)).toBe('1 h 30');
  });
});
