import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { useTheme } from './core/theme';
import { Sheet } from './BottomSheet';
import { Text } from './Text';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { haptic } from './haptics';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

export interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** ISO date (AAAA-MM-JJ) or null. */
  value: string | null;
  onConfirm: (iso: string) => void;
  title?: string;
  /** Latest selectable date (ISO). */
  max?: string;
  /** Earliest selectable year. */
  minYear?: number;
  /** Year shown first when there is no value. */
  defaultYear?: number;
}

/**
 * Month calendar with a year strip: tap the year, move by month, pick the day.
 * Pure JS (no native module), so it works in every build.
 */
export function DatePickerSheet({ visible, onClose, value, onConfirm, title = 'Choisir une date', max, minYear = 1920, defaultYear }: DatePickerSheetProps) {
  useTheme();
  const maxDate = max ? new Date(`${max}T00:00:00Z`) : null;
  const maxYear = maxDate ? maxDate.getUTCFullYear() : new Date().getFullYear() + 5;
  const init = () => {
    const v = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').map(Number) : null;
    return v ? { y: v[0]!, m: v[1]! - 1, d: v[2]! } : { y: defaultYear ?? Math.min(maxYear, 1995), m: 0, d: 0 };
  };
  const [sel, setSel] = useState(init);
  const [view, setView] = useState({ y: sel.y, m: sel.m });
  const [years, setYears] = useState(false);
  const yearList = useRef<ScrollView>(null);
  useEffect(() => {
    if (!visible) return;
    const i = init();
    setSel(i);
    setView({ y: i.y, m: i.m });
    setYears(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const after = (y: number, m: number, d: number) => !!maxDate && Date.UTC(y, m, d) > maxDate.getTime();
  const cells = useMemo(() => {
    const first = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // Monday first
    return [...Array(first).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  }, [view]);
  const shift = (delta: number) => {
    haptic.select();
    const m = view.m + delta;
    const y = view.y + Math.floor(m / 12);
    setView({ y, m: ((m % 12) + 12) % 12 });
  };
  const canNext = !(maxDate && (view.y > maxYear || (view.y === maxYear && view.m >= maxDate.getUTCMonth())));
  const allYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const chosen = sel.d > 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      testID="date-picker"
      footer={<Button label={chosen ? `Valider · ${sel.d} ${MONTHS[sel.m]!.toLowerCase()} ${sel.y}` : 'Choisissez un jour'} full size="major" disabled={!chosen} onPress={() => { onConfirm(`${sel.y}-${pad(sel.m + 1)}-${pad(sel.d)}`); onClose(); }} testID="date-picker-confirm" />}
    >
      <View style={{ gap: 14, paddingBottom: 4 }}>
        {/* Month / year bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PressableScale onPress={() => setYears(!years)} accessibilityRole="button" accessibilityLabel={`${MONTHS[view.m]} ${view.y}. Choisir l’année`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 44 }}>
            <Text weight="bold" style={{ fontSize: 18, lineHeight: 24 }}>{MONTHS[view.m]} {view.y}</Text>
            <View style={{ transform: [{ rotate: years ? '-90deg' : '90deg' }] }}><ChevronRight size={18} color={colors.accent} strokeWidth={2.4} /></View>
          </PressableScale>
          {!years ? (
            <>
              <PressableScale onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Mois précédent" style={navBtn()}><ChevronLeft size={20} color={colors.accent} strokeWidth={2.4} /></PressableScale>
              <PressableScale onPress={() => canNext && shift(1)} disabled={!canNext} accessibilityRole="button" accessibilityLabel="Mois suivant" style={[navBtn(), { opacity: canNext ? 1 : 0.35 }]}><ChevronRight size={20} color={colors.accent} strokeWidth={2.4} /></PressableScale>
            </>
          ) : null}
        </View>

        {years ? (
          <ScrollView ref={yearList} style={{ maxHeight: 300 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} onLayout={() => { const i = allYears.indexOf(view.y); yearList.current?.scrollTo({ y: Math.max(0, Math.floor(i / 4) * 52 - 104), animated: false }); }} showsVerticalScrollIndicator={false}>
            {allYears.map((y) => {
              const on = y === view.y;
              return (
                <PressableScale key={y} onPress={() => { haptic.select(); setView({ y, m: maxDate && y === maxYear ? Math.min(view.m, maxDate.getUTCMonth()) : view.m }); setYears(false); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ width: '23%', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : colors.background }}>
                  <Text weight={on ? 'bold' : 'medium'} numeric tone={on ? 'inverse' : 'ink'} style={{ fontSize: 15, lineHeight: 20 }}>{y}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        ) : (
          <View>
            <View style={{ flexDirection: 'row' }}>
              {WEEK.map((w, i) => <Text key={i} tone="muted" weight="semibold" align="center" style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>{w}</Text>)}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {cells.map((d, i) => {
                if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
                const on = chosen && sel.y === view.y && sel.m === view.m && sel.d === d;
                const disabled = after(view.y, view.m, d);
                return (
                  <View key={d} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <PressableScale onPress={() => { haptic.select(); setSel({ y: view.y, m: view.m, d }); }} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${d} ${MONTHS[view.m]} ${view.y}`} accessibilityState={{ selected: on, disabled }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent' }}>
                      <Text weight={on ? 'bold' : 'medium'} numeric tone={on ? 'inverse' : disabled ? 'disabled' : 'ink'} style={{ fontSize: 15, lineHeight: 20 }}>{d}</Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </Sheet>
  );
}

const navBtn = () => ({ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mauveSoft, alignItems: 'center' as const, justifyContent: 'center' as const });
