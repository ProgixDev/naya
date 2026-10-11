import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import type { SafetyAlert } from '@naya/domain';
import { api } from '../lib/api';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, toast } from '../components/ui';
import { SosAlertCard } from '../components/ServiceCards';

type Filter = '' | SafetyAlert['status'];
const FILTERS: [Filter, string][] = [
  ['new', 'Nouvelles'],
  ['responding', 'Prises en charge'],
  ['resolved', 'Résolues'],
  ['', 'Toutes'],
];
const AUTO_NOTE = { responding: 'Prise en charge par l’équipe sécurité', resolved: 'Alerte résolue par l’équipe sécurité' } as const;

/** Sécurité · alertes SOS déclenchées pendant une course ou un trajet famille. */
export function SafetyPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'safety'], queryFn: api.adminPrototype.alerts, refetchInterval: 5000 });
  const [filter, setFilter] = useState<Filter>('');
  const [busy, setBusy] = useState<string | null>(null);
  const alerts = q.data ?? [];
  const shown = alerts.filter((a) => !filter || a.status === filter).slice().reverse();
  const update = async (a: SafetyAlert, status: SafetyAlert['status'], note: string) => {
    setBusy(a.id);
    try {
      await api.adminPrototype.alert(a.id, status, note);
      await qc.invalidateQueries({ queryKey: ['admin'] });
      toast(note === AUTO_NOTE.resolved ? 'Alerte résolue' : status === a.status ? 'Note ajoutée' : 'Alerte prise en charge', 'success');
      return true;
    } catch (e) {
      toast(errorMessage(e), 'danger');
      return false;
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <PageHeader title="Sécurité · SOS" subtitle="Alertes déclenchées pendant une course ou un trajet famille. Position, personnes et actions sont conservées et journalisées." />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrer les alertes">
        {FILTERS.map(([v, l]) => (
          <button key={v || 'all'} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition ${filter === v ? 'border-accent bg-selected text-accent' : 'border-line hover:bg-surface'}`}>
            {l}
            <span className={`rounded-full px-1.5 text-[12px] tabular ${v === 'new' && alerts.some((a) => a.status === 'new') ? 'bg-danger text-inverse' : 'bg-line text-muted'}`}>{alerts.filter((a) => !v || a.status === v).length}</span>
          </button>
        ))}
      </div>
      {q.isLoading ? <Skeleton className="h-64" /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {q.data && !shown.length ? (
        <Card><EmptyState title={alerts.length ? 'Aucune alerte pour ce filtre' : 'Aucune alerte SOS'} message={alerts.length ? undefined : 'Les alertes déclenchées depuis une course ou un trajet famille apparaîtront ici.'} /></Card>
      ) : null}
      <div className="flex flex-col gap-4">
        {shown.map((a) => (
          <SosAlertCard key={a.id} a={a} busy={busy === a.id} onStatus={(status) => void update(a, status, AUTO_NOTE[status])} onNote={(note) => update(a, a.status, note)} />
        ))}
      </div>
    </>
  );
}
