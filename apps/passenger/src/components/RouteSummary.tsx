import { useTheme, Text } from '@naya/ui';
import { View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors } from '@naya/tokens';

type Stop = { label: string; address?: string | null };

/** "Rabat · Centre-ville" → "Centre-ville": the city is implied. */
const short = (label: string) => label.replace(/^[^·]+·\s*/, '');

/**
 * Pickup → drop-off with ring and pin markers on a dotted line, a small label above each
 * place, the address under it and an optional time on the right.
 */
export function RouteSummary({ stops, times, right }: { stops: Stop[]; times?: (string | null | undefined)[]; right?: React.ReactNode }) {
  useTheme();
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  const middle = stops.length - 2;
  const rows: { kind: 'pickup' | 'dropoff'; label: string; stop: Stop; time?: string | null }[] = [
    { kind: 'pickup', label: 'Point de départ', stop: first, time: times?.[0] },
    { kind: 'dropoff', label: middle > 0 ? `Arrivée · après ${middle} arrêt${middle > 1 ? 's' : ''}` : 'Point d’arrivée', stop: last, time: times?.[1] },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        {rows.map((r, i) => (
          <View key={r.kind} style={{ flexDirection: 'row', gap: 14 }}>
            {/* Marker column: ring for pickup, pin for drop-off, dotted connector between them. */}
            <View style={{ width: 22, alignItems: 'center' }}>
              <View style={{ height: 6 }} />
              {r.kind === 'pickup' ? (
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 5, borderColor: colors.accent, backgroundColor: colors.surface }} />
              ) : (
                <MapPin size={20} color={colors.surface} fill={colors.ink} strokeWidth={2.2} />
              )}
              {i === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 5 }}>
                  {[0, 1, 2, 3].map((d) => <View key={d} style={{ width: 2, height: 3, borderRadius: 1, backgroundColor: colors.line }} />)}
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: i === 0 ? 14 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text tone="muted" numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>{r.label}</Text>
                {r.time ? <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{r.time}</Text> : null}
              </View>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21, marginTop: 2 }}>{short(r.stop.label)}</Text>
              {r.stop.address ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{r.stop.address}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      {right}
    </View>
  );
}
