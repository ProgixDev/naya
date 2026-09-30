import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { AdminPersonRow } from '@naya/api';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { money } from '../lib/format';
import { Badge, Card, DataTable, EmptyState, ErrorState, Input, PageHeader, Pagination, Segmented, Select, TableSkeleton } from '../components/ui';
import { VerificationBadge } from '../components/status';

/** A02 · Personnes et véhicules. */
export function PeoplePage() {
  const { cityId } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const role = (params.get('role') ?? '') as '' | 'passenger' | 'driver';
  const verification = params.get('statut') ?? '';
  const cursor = Number(params.get('page') ?? 0);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => set('q', text.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const q = useQuery({ queryKey: ['admin', 'people', cityId, params.toString()], queryFn: () => api.admin.people({ q: params.get('q') ?? undefined, role: role || undefined, verification: verification || undefined, cityId, cursor, limit: 20 }) });
  return (
    <>
      <PageHeader title="Personnes & véhicules" subtitle="Passagères, chauffeuses et véhicules de la ville sélectionnée." />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
          <Segmented<'' | 'passenger' | 'driver'> label="Rôle" value={role} onChange={(v) => set('role', v)} options={[{ value: '', label: 'Toutes' }, { value: 'passenger', label: 'Passagères' }, { value: 'driver', label: 'Chauffeuses' }]} />
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Rechercher une personne" placeholder="Nom, téléphone, identifiant ou plaque" className="pl-9" value={text} onChange={(e) => setText(e.target.value)} data-testid="people-search" />
          </div>
          <Select aria-label="Statut de vérification" value={verification} onChange={(e) => set('statut', e.target.value)} className="w-56">
            <option value="">Tous les statuts</option>
            <option value="submitted">Envoyé</option>
            <option value="in_review">En cours d’examen</option>
            <option value="more_info_requested">Complément demandé</option>
            <option value="approved">Approuvé</option>
            <option value="rejected">Refusé</option>
            <option value="draft">À compléter</option>
          </Select>
        </div>
        <div className="mt-4">
          {q.isLoading ? <TableSkeleton cols={6} /> : null}
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
          {q.data ? (
            <>
              <DataTable<AdminPersonRow>
                caption="Personnes"
                rows={q.data.items}
                rowKey={(r) => r.user.id}
                onRowClick={(r) => navigate(`/personnes/${r.user.id}`)}
                empty={<EmptyState title="Aucun résultat" message="Aucune personne ne correspond à cette recherche." />}
                columns={[
                  { key: 'id', header: 'Identifiant', render: (r) => <span className="font-semibold">{r.user.id}</span>, sort: (r) => r.user.id },
                  { key: 'name', header: 'Nom', render: (r) => <div><div>{`${r.user.firstName} ${r.user.lastName}`.trim() || '—'}</div><div className="text-[12px] text-muted tabular">{r.user.phone}</div></div>, sort: (r) => r.user.lastName },
                  { key: 'role', header: 'Rôle', render: (r) => <Badge tone={r.user.role === 'driver' ? 'accent' : 'neutral'} dot={false}>{r.user.role === 'driver' ? 'Chauffeuse' : 'Passagère'}</Badge> },
                  { key: 'id-st', header: 'Identité', render: (r) => <VerificationBadge status={r.identityStatus} /> },
                  { key: 'veh', header: 'Véhicule', render: (r) => (r.user.role === 'driver' ? <div className="flex flex-col items-start gap-1"><span className="text-[13px] tabular">{r.vehicle?.plate ?? '—'}</span><VerificationBadge status={r.vehicleStatus} /></div> : <span className="text-muted">—</span>) },
                  { key: 'bal', header: 'Solde', align: 'right', render: (r) => (r.wallet ? <span className={r.wallet.balance < 0 ? 'text-danger' : ''}>{money(r.wallet.balance)}</span> : <span className="text-muted">—</span>), sort: (r) => r.wallet?.balance ?? 0 },
                ]}
              />
              <Pagination cursor={cursor} total={q.data.total} limit={20} onChange={(c) => set('page', String(c))} />
            </>
          ) : null}
        </div>
      </Card>
    </>
  );
}
