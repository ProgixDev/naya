import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { SupportTicket } from '@naya/domain';
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
  const [status, setStatus] = useState<'open' | 'awaiting_user' | 'resolved' | ''>('open');
  const [disputes, setDisputes] = useState(false);
  const [cursor, setCursor] = useState(0);
  const q = useQuery({ queryKey: ['admin', 'tickets', cityId, status, disputes, cursor], queryFn: () => api.admin.tickets({ status: status || undefined, cityId, disputes, cursor }), refetchInterval: 10_000 });
  return (
    <>
      <PageHeader title="Support et litiges" subtitle="Demandes des passagères et chauffeuses. Les litiges sont liés à une course." />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
          <Segmented label="Statut" value={status} onChange={(v) => (setStatus(v), setCursor(0))} options={[{ value: 'open', label: 'À traiter' }, { value: 'awaiting_user', label: 'Réponse attendue' }, { value: 'resolved', label: 'Résolues' }, { value: '', label: 'Toutes' }]} />
          <label className="inline-flex items-center gap-2 text-[14px] font-medium">
            <input type="checkbox" className="h-4 w-4 accent-[#6B3657]" checked={disputes} onChange={(e) => (setDisputes(e.target.checked), setCursor(0))} />
            Litiges uniquement
          </label>
        </div>
        <div className="mt-4">
          {q.isLoading ? <TableSkeleton cols={6} /> : null}
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
