import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { casablancaLocalToUtc, toCasablancaParts } from '@naya/domain';
import { Pill, Text } from '@naya/ui';

const DAY_LABELS = ['Aujourd’hui', 'Demain'];
const weekday = new Intl.DateTimeFormat('fr-MA', { weekday: 'short', day: 'numeric', timeZone: 'Africa/Casablanca' });

/** Casablanca-local days and 15-minute slots that respect the city's lead time and horizon. */
export function useScheduleOptions(minLeadMinutes = 30, maxDaysAhead = 7) {
  return useMemo(() => {
    const now = Date.now();
    const days = Array.from({ length: Math.min(maxDaysAhead, 7) }, (_, i) => {
      const iso = new Date(now + i * 86_400_000).toISOString();
      return { date: toCasablancaParts(iso).date, label: DAY_LABELS[i] ?? weekday.format(new Date(iso)) };
    });
    const slotsFor = (date: string) => {
      const out: string[] = [];
      for (let h = 5; h <= 23; h++) {
        for (const m of [0, 15, 30, 45]) {
          const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const utc = Date.parse(casablancaLocalToUtc(date, time));
          if (utc >= now + (minLeadMinutes + 2) * 60_000 && utc <= now + maxDaysAhead * 86_400_000) out.push(time);
        }
      }
      return out;
    };
    return { days, slotsFor };
  }, [minLeadMinutes, maxDaysAhead]);
}

export function SchedulePicker({ day, time, onDay, onTime, minLeadMinutes, maxDaysAhead }: { day: string; time: string | null; onDay: (d: string) => void; onTime: (t: string | null) => void; minLeadMinutes?: number; maxDaysAhead?: number }) {
  const opts = useScheduleOptions(minLeadMinutes, maxDaysAhead);
  const slots = opts.slotsFor(day);
  useEffect(() => {
    if (!time || !slots.includes(time)) onTime(slots[0] ?? null);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: 4 }} testID="schedule-picker">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Jour de départ" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {opts.days.map((d) => (
          <Pill key={d.date} label={d.label} selected={d.date === day} onPress={() => onDay(d.date)} testID={`day-${d.date}`} />
        ))}
      </ScrollView>
      {slots.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Heure de départ (heure de Rabat)" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {slots.map((t) => (
            <Pill key={t} label={t.replace(':', 'h')} selected={t === time} onPress={() => onTime(t)} testID={`time-${t}`} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="caption" tone="muted">Plus de créneau ce jour-là. Choisissez un autre jour.</Text>
      )}
    </View>
  );
}

export const firstDay = () => toCasablancaParts(new Date().toISOString()).date;
