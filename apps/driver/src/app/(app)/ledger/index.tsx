import { useTheme , Button, EmptyState, ErrorState, Header, Pill, Screen, SkeletonList, Text, TransactionRow } from '@naya/ui';
import { ShieldCheck } from 'lucide-react-native';
import { formatMoney, toCasablancaParts } from '@naya/domain';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, gutter } from '@naya/tokens';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { useAccountId } from '@/lib/queries';

const FILTERS = [
  { value: undefined, label: 'Tout' },
  { value: 'rides', label: 'Courses' },
  { value: 'recharge', label: 'Recharges' },
  { value: 'withdrawal', label: 'Retraits' },
  { value: 'correction', label: 'Corrections' },
] as const;

/** D13 · D13-filter · D13-cash · D13-withdrawal */
export default function Ledger() {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  const [type, setType] = useState<string | undefined>(undefined);
  const q = useInfiniteQuery({
    queryKey: qk.ledger(a, type),
    queryFn: ({ pageParam }) => api.driver.ledger(type, pageParam, 20),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const entries = q.data?.pages.flatMap((p) => p.items) ?? [];
  const credits = entries.filter((e) => e.amount > 0).reduce((n, e) => n + e.amount, 0);
  const debits = entries.filter((e) => e.amount < 0).reduce((n, e) => n - e.amount, 0);
  // Newest first, grouped by day (Aujourd’hui, Hier, 10 octobre…).
  const groups: { label: string; items: typeof entries }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return (
    <Screen header={<Header title="Mouvements" onBack={() => router.back()} />} testID="ledger-screen">
      <View style={{ gap: 12, marginTop: 4 }}>
        <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, paddingVertical: 4 }} accessibilityRole="radiogroup">
          {FILTERS.map((f) => (
            <Pill key={f.label} label={f.label} selected={type === f.value} onPress={() => setType(f.value)} testID={`ledger-filter-${f.value ?? 'all'}`} />
          ))}
        </ScrollView>
        {q.isLoading ? <SkeletonList /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data && entries.length === 0 ? <EmptyState title="Aucun mouvement" message="Les commissions, crédits, recharges et retraits confirmés apparaîtront ici." /> : null}
        {entries.length ? (
          <View style={{ gap: 18 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Total label="Entrées" value={`+${formatMoney(credits)}`} tone="success" />
              <Total label="Sorties" value={`−${formatMoney(debits)}`} />
            </View>
            {groups.map((g) => (
              <View key={g.label} style={{ gap: 10 }}>
                <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', marginLeft: 4 }}>{g.label}</Text>
                {g.items.map((e) => (
                  <View key={e.id} style={{ backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                    <TransactionRow entry={e} onPress={() => router.push({ pathname: '/ledger/[id]', params: { id: e.id } })} />
                  </View>
                ))}
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={colors.muted} strokeWidth={2} />
              <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Opérations confirmées uniquement</Text>
            </View>
          </View>
        ) : null}
        {q.hasNextPage ? <Button label="Afficher plus" variant="secondary" full loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
      </View>
    </Screen>
  );
}

function dayLabel(iso: string) {
  const d = toCasablancaParts(iso).date;
  const today = toCasablancaParts(new Date().toISOString()).date;
  const yesterday = toCasablancaParts(new Date(Date.now() - 86400000).toISOString()).date;
  if (d === today) return 'Aujourd’hui';
  if (d === yesterday) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Casablanca' }).format(new Date(iso));
}

function Total({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
      <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>{label}</Text>
      <Text weight="bold" numeric tone={tone ?? 'ink'} style={{ fontSize: 18, lineHeight: 24 }}>{value}</Text>
    </View>
  );
}
