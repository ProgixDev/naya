import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { SupportTicket } from '@naya/domain';
import { Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { fmtDateTime } from '../lib/format';
import { Badge, Card, DataTable, EmptyState, ErrorState, PageHeader, Pagination, Segmented, TableSkeleton } from '../components/ui';
import { TicketBadge } from '../components/status';

const CATEGORY = { ride: 'Course', payment: 'Paiement', safety: 'Sécurité', account: 'Compte', wallet: 'Portefeuille', other: 'Autre' } as const;

/** A08 · Support et litiges. */
export function SupportPage() {
  const { cityId } = useWorkspace();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'open' | 'new' | 'in_progress' | 'awaiting_user' | 'resolved' | 'rejected' | ''>('open');
  const [disputes, setDisputes] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [reasonId, setReasonId] = useState('');
  const [category, setCategory] = useState<SupportTicket['category'] | ''>('');
  const [role, setRole] = useState<'' | 'passenger' | 'driver'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const filters = { status: status || undefined, cityId, disputes, reasonId: reasonId || undefined, category: category || undefined, role: role || undefined, from: from || undefined, to: to || undefined, q: debounced || undefined };
  const q = useQuery({ queryKey: ['admin', 'tickets', filters, cursor], queryFn: () => api.admin.tickets({ ...filters, cursor }), refetchInterval: 10_000 });
  const catalog = useQuery({ queryKey: ['prototype', 'catalog'], queryFn: api.prototype.catalog, staleTime: 60_000 });
  const reasonLabel = (id?: string) => (id ? catalog.data?.reasons.find((r) => r.id === id)?.label ?? id : null);
  const anyFilter = !!(reasonId || category || role || from || to || search);
  const reset = (fn: () => void) => { fn(); setCursor(0); };
  return (
    <>
      <PageHeader title="Support et litiges" subtitle="Demandes des passagères et chauffeuses. Les litiges sont liés à une course." />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
          <Segmented label="Statut" value={status} onChange={(v) => (setStatus(v), setCursor(0))} options={[{ value: 'open', label: 'À traiter' }, { value: 'new', label: 'Nouveaux' }, { value: 'in_progress', label: 'En analyse' }, { value: 'awaiting_user', label: 'Infos demandées' }, { value: 'resolved', label: 'Résolus' }, { value: 'rejected', label: 'Rejetés' }, { value: '', label: 'Tous' }]} />
          <label className="inline-flex items-center gap-2 text-[14px] font-medium">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={disputes} onChange={(e) => (setDisputes(e.target.checked), setCursor(0))} />
            Litiges uniquement
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-5 pt-4" data-testid="ticket-filters">
          <label className="relative w-full">
            <span className="sr-only">Rechercher</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input className="field pl-9" placeholder="N° de demande, objet, personne, course…" value={search} onChange={(e) => reset(() => setSearch(e.target.value))} data-testid="ticket-search" />
          </label>
          <label className="w-[210px]">
            <span className="label">Motif</span>
            <select className="field mt-1" value={reasonId} onChange={(e) => reset(() => setReasonId(e.target.value))} data-testid="ticket-reason">
              <option value="">Tous les motifs</option>
              {(catalog.data?.reasons ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="w-[160px]">
            <span className="label">Catégorie</span>
            <select className="field mt-1" value={category} onChange={(e) => reset(() => setCategory(e.target.value as typeof category))} data-testid="ticket-category">
              <option value="">Toutes</option>
              {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="w-[150px]">
            <span className="label">Ouverte par</span>
            <select className="field mt-1" value={role} onChange={(e) => reset(() => setRole(e.target.value as typeof role))} data-testid="ticket-role">
              <option value="">Toutes</option>
              <option value="passenger">Passagère</option>
              <option value="driver">Chauffeuse</option>
            </select>
          </label>
          <label className="w-[150px]">
            <span className="label">Du</span>
            <input type="date" className="field mt-1" value={from} max={to || undefined} onChange={(e) => reset(() => setFrom(e.target.value))} data-testid="ticket-from" />
          </label>
          <label className="w-[150px]">
            <span className="label">Au</span>
            <input type="date" className="field mt-1" value={to} min={from || undefined} onChange={(e) => reset(() => setTo(e.target.value))} data-testid="ticket-to" />
          </label>
          {anyFilter ? (
            <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-accent hover:bg-mauve-soft" onClick={() => reset(() => { setReasonId(''); setCategory(''); setRole(''); setFrom(''); setTo(''); setSearch(''); })} data-testid="ticket-filters-reset">
              <X className="h-4 w-4" /> Effacer
            </button>
          ) : null}
        </div>
        <div className="mt-4">
          {q.isLoading ? <TableSkeleton cols={7} /> : null}
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
          {q.data ? (
            <>
              <DataTable<SupportTicket>
                caption="Demandes"
                rows={q.data.items}
                rowKey={(t) => t.id}
                onRowClick={(t) => navigate(`/support/${t.id}`)}
                empty={<EmptyState title="Aucune demande" message="La file de support est vide pour ces filtres." />}
                columns={[
                  { key: 'id', header: 'Demande', render: (t) => <span className="font-semibold">{t.id}</span> },
                  { key: 'reason', header: 'Motif', render: (t) => reasonLabel(t.reasonId) ?? <span className="text-muted">—</span>, sort: (t) => reasonLabel(t.reasonId) ?? '' },
                  { key: 'sub', header: 'Objet', render: (t) => <div><div className="line-clamp-1">{t.subject}</div><div className="text-[12px] text-muted">{t.userName} · {t.userRole === 'driver' ? 'chauffeuse' : 'passagère'}</div></div> },
                  { key: 'cat', header: 'Catégorie', render: (t) => <div className="flex items-center gap-2">{CATEGORY[t.category]}{t.isDispute ? <Badge tone="warning" dot={false}>Litige</Badge> : null}</div> },
                  { key: 'ride', header: 'Course', render: (t) => t.rideId ?? <span className="text-muted">—</span> },
                  { key: 'upd', header: 'Mise à jour', render: (t) => fmtDateTime(t.updatedAt), sort: (t) => t.updatedAt },
                  { key: 'st', header: 'Statut', render: (t) => <TicketBadge status={t.status} /> },
                ]}
              />
              <Pagination cursor={cursor} total={q.data.total} limit={20} onChange={setCursor} />
            </>
          ) : null}
        </div>
      </Card>
    </>
  );
}
