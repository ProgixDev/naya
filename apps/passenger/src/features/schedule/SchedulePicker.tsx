import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { casablancaLocalToUtc, casablancaToday } from '@naya/domain';
import { Pill, Text } from '@naya/ui';
import { useCities, useMe } from '@/lib/queries';
import { useCityId } from '@/lib/prefs';
import { reconcileTime, resolveScheduling, scheduleDays, slotsFor, type Scheduling } from './slots';

const DAY_LABELS = ['Aujourd’hui', 'Demain'];
const weekday = new Intl.DateTimeFormat('fr-MA', { weekday: 'short', day: 'numeric', timeZone: 'Africa/Casablanca' });

/**
 * Scheduling rules of a city (the passenger's city from the server when `cityId` is omitted), read from the API.
 * Falls back per field to the seeded values while the rules load or when a field is missing.
 */
export function useCityScheduling(cityId?: string): Scheduling {
  const myCity = useCityId();
  const id = cityId ?? myCity;
  const cities = useCities();
  const me = useMe();
  const rules = cities.data?.find((c) => c.id === id)?.scheduling ?? (me.data?.city.id === id ? me.data.city.scheduling : undefined);
  return useMemo(() => resolveScheduling(rules), [rules]);
}

/** Casablanca-local days and 15-minute slots that respect the city's lead time and booking window. */
export function useScheduleOptions(rules: Scheduling) {
  // Re-evaluated every minute, so a slot that falls inside the lead time disappears while the picker is open.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => {
    const days = scheduleDays(rules, now).map(({ date, offset }) => ({
      date,
      label: DAY_LABELS[offset] ?? weekday.format(new Date(casablancaLocalToUtc(date, '12:00'))),
    }));
    return { days, slotsFor: (date: string) => slotsFor(date, rules, now) };
  }, [rules, now]);
}

export function SchedulePicker({ day, time, onDay, onTime, cityId }: { day: string; time: string | null; onDay: (d: string) => void; onTime: (t: string | null) => void; cityId?: string }) {
  const rules = useCityScheduling(cityId);
  const opts = useScheduleOptions(rules);
  const slots = useMemo(() => opts.slotsFor(day), [opts, day]);
  const slotsKey = slots.join(',');
  const lastDay = useRef<string | null>(null);
  // Time the picker chose itself; undefined once the passenger has chosen one.
  const auto = useRef<string | null | undefined>(undefined);
  // The passenger's slot that closed while the picker was open, so she sees why nothing is selected.
  const [closed, setClosed] = useState<string | null>(null);
  useEffect(() => {
    const dayChanged = lastDay.current !== day;
    lastDay.current = day;
    const next = reconcileTime({ dayChanged, time, auto: auto.current, slots });
    auto.current = next.auto;
    if (dayChanged) setClosed(null);
    else if (time && !next.time) setClosed(time);
    if (next.time !== time) onTime(next.time);
  }, [day, slotsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (t: string) => {
    auto.current = undefined;
    setClosed(null);
    onTime(t);
  };
  return (
    <View style={{ gap: 4 }} testID="schedule-picker">
      <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Jour de départ" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {opts.days.map((d) => (
          <Pill key={d.date} label={d.label} selected={d.date === day} onPress={() => onDay(d.date)} testID={`day-${d.date}`} />
        ))}
      </ScrollView>
      {slots.length ? (
        <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Heure de départ (heure du Maroc)" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {slots.map((t) => (
            <Pill key={t} label={t.replace(':', 'h')} selected={t === time} onPress={() => choose(t)} testID={`time-${t}`} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="caption" tone="muted">Plus de créneau ce jour-là. Choisissez un autre jour.</Text>
      )}
      {closed && !time && slots.length ? (
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          Le créneau de {closed.replace(':', 'h')} n’est plus disponible. Choisissez un autre horaire.
        </Text>
      ) : null}
    </View>
  );
}

/** Today's Casablanca business date, the picker's first day. */
export const firstDay = () => casablancaToday();
