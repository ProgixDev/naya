import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { casablancaLocalToUtc, casablancaToday } from '@naya/domain';
import { PressableScale, Text, haptic, useTheme } from '@naya/ui';
import { colors, radius, themedStyles } from '@naya/tokens';
import { useCities, useMe } from '@/lib/queries';
import { useCityId } from '@/lib/prefs';
import { reconcileTime, resolveScheduling, scheduleDays, slotsFor, type Scheduling } from './slots';

const DAY_LABELS = ['Aujourd’hui', 'Demain'];
const weekday = new Intl.DateTimeFormat('fr-MA', { weekday: 'short', day: 'numeric', timeZone: 'Africa/Casablanca' });

/** Height of one choice row plus the gap under it: the columns scroll to the chosen row with it. */
const ROW = 48;
/** Visible height of a column: four and a half rows, so the cut row says « there is more ». */
const COLUMN_HEIGHT = ROW * 4.5;

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

/** « Aujourd’hui · 18h15 », the one line that stands for the chosen slot (P-25). Null until a time is chosen. */
export function useScheduleLabel(day: string, time: string | null, cityId?: string): string | null {
  const opts = useScheduleOptions(useCityScheduling(cityId));
  if (!time) return null;
  const d = opts.days.find((x) => x.date === day)?.label ?? weekday.format(new Date(casablancaLocalToUtc(day, '12:00')));
  return `${d} · ${time.replace(':', 'h')}`;
}

/**
 * Day and time as two side-by-side scrolling columns, the body of a sheet (P-25): every slot is reachable
 * by a vertical scroll, the chosen one is outlined and checked, and the cut last row shows that a column scrolls.
 * `onChosen` fires only when the passenger picks a time herself (not when the picker moves to the first open slot).
 */
export function SchedulePicker({ day, time, onDay, onTime, onChosen, cityId }: { day: string; time: string | null; onDay: (d: string) => void; onTime: (t: string | null) => void; onChosen?: (t: string) => void; cityId?: string }) {
  useTheme();
  const rules = useCityScheduling(cityId);
  const opts = useScheduleOptions(rules);
  const slots = useMemo(() => opts.slotsFor(day), [opts, day]);
  const slotsKey = slots.join(',');
  const lastDay = useRef<string | null>(null);
  // Time the picker chose itself; undefined once the passenger has chosen one.
  const auto = useRef<string | null | undefined>(undefined);
  // The passenger's slot that closed while the picker was open, so she sees why nothing is selected.
  const [closed, setClosed] = useState<string | null>(null);
  const dayList = useRef<ScrollView>(null);
  const timeList = useRef<ScrollView>(null);
  useEffect(() => {
    const dayChanged = lastDay.current !== day;
    lastDay.current = day;
    const next = reconcileTime({ dayChanged, time, auto: auto.current, slots });
    auto.current = next.auto;
    if (dayChanged) setClosed(null);
    else if (time && !next.time) setClosed(time);
    if (next.time !== time) onTime(next.time);
  }, [day, slotsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the chosen day and time into view (on open, and when the day changes the time column).
  useEffect(() => {
    const i = opts.days.findIndex((d) => d.date === day);
    if (i > 0) dayList.current?.scrollTo({ y: Math.max(0, (i - 1) * ROW), animated: false });
  }, [day, opts.days]);
  useEffect(() => {
    const i = time ? slots.indexOf(time) : -1;
    timeList.current?.scrollTo({ y: Math.max(0, (i - 1) * ROW), animated: false });
  }, [day, slotsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (t: string) => {
    auto.current = undefined;
    setClosed(null);
    onTime(t);
    onChosen?.(t);
  };
  return (
    <View style={{ gap: 8 }} testID="schedule-picker">
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Text variant="caption" tone="muted" weight="semibold" style={{ flex: 1 }}>Jour</Text>
        <Text variant="caption" tone="muted" weight="semibold" style={{ flex: 1 }}>Heure du Maroc</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScrollView ref={dayList} nestedScrollEnabled bounces={false} overScrollMode="never" style={styles.column} contentContainerStyle={styles.columnContent} accessibilityRole="radiogroup" accessibilityLabel="Jour de départ">
          {opts.days.map((d) => (
            <Choice key={d.date} label={d.label} selected={d.date === day} onPress={() => onDay(d.date)} testID={`day-${d.date}`} />
          ))}
        </ScrollView>
        <View style={styles.column}>
          {slots.length ? (
            <ScrollView ref={timeList} nestedScrollEnabled bounces={false} overScrollMode="never" contentContainerStyle={styles.columnContent} accessibilityRole="radiogroup" accessibilityLabel="Heure de départ (heure du Maroc)">
              {slots.map((t) => (
                <Choice key={t} label={t.replace(':', 'h')} a11y={t.replace(':', ' heures ')} numeric selected={t === time} onPress={() => choose(t)} testID={`time-${t}`} />
              ))}
            </ScrollView>
          ) : (
            <Text variant="caption" tone="muted" style={{ padding: 12 }}>Plus de créneau ce jour-là. Choisissez un autre jour.</Text>
          )}
        </View>
      </View>
      {closed && !time && slots.length ? (
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          Le créneau de {closed.replace(':', 'h')} n’est plus disponible. Choisissez un autre horaire.
        </Text>
      ) : null}
    </View>
  );
}

/** One row of a column: a choice, so a check (and a 2-pt outline) when selected, never a tint alone. */
function Choice({ label, a11y, selected, onPress, numeric, testID }: { label: string; a11y?: string; selected: boolean; onPress: () => void; numeric?: boolean; testID: string }) {
  useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      aria-selected={selected}
      accessibilityLabel={a11y ?? label}
      pressedScale={0.98}
      style={[styles.choice, selected ? styles.choiceSelected : null]}
    >
      <Text variant="label" weight={selected ? 'semibold' : 'medium'} numeric={numeric} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {selected ? <Check size={18} strokeWidth={2.4} color={colors.accent} /> : null}
    </PressableScale>
  );
}

const styles = themedStyles(() => ({
  column: { flex: 1, height: COLUMN_HEIGHT, borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.background, overflow: 'hidden' as const },
  columnContent: { padding: 4, gap: 4 },
  choice: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: ROW - 4, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
}));

/** Today's Casablanca business date, the picker's first day. */
export const firstDay = () => casablancaToday();
