import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { AdminRideRow } from '@naya/api';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { fmtDateTime, money } from '../lib/format';
import { Card, DataTable, EmptyState, ErrorState, Input, PageHeader, Pagination, Segmented, Select, TableSkeleton } from '../components/ui';
import { METHOD_LABELS, PaymentBadge, RideBadge, ScheduledBadge } from '../components/status';

/** A06 · Courses et réservations planifiées. */
export function RidesPage() {
  const { cityId } = useWorkspace();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'rides' | 'scheduled'>('rides');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [sort, setSort] = useState('recent');
  const [cursor, setCursor] = useState(0);
  const rides = useQuery({ queryKey: ['admin', 'rides', cityId, q, status, method, sort, cursor], queryFn: () => api.admin.rides({ q: q || undefined, status: status || undefined, method: method || undefined, sort, cityId, cursor, limit: 20 }), enabled: tab === 'rides', refetchInterval: 10_000 });
  const scheduled = useQuery({ queryKey: ['admin', 'scheduled', cityId], queryFn: () => api.admin.scheduled(cityId), enabled: tab === 'scheduled' });
  return (
    <>
      <PageHeader title="Courses" subtitle="Courses immédiates et réservations. Une réservation planifiée est enregistrée : aucune chauffeuse n’est assignée avant le lancement." actions={<Segmented label="Vue" value={tab} onChange={setTab} options={[{ value: 'rides', label: 'Courses' }, { value: 'scheduled', label: 'Réservations planifiées' }]} />} />
      <Card padded={false}>
        {tab === 'rides' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input aria-label="Rechercher une course" placeholder="Référence, prénom ou lieu" className="pl-9" value={q} onChange={(e) => (setQ(e.target.value), setCursor(0))} data-testid="rides-search" />
              </div>
              <Select aria-label="Statut" value={status} onChange={(e) => (setStatus(e.target.value), setCursor(0))} className="w-48">
                <option value="">Tous les statuts</option>
                <option value="active">En cours</option>
                <option value="completed">Terminées</option>
                <option value="cancelled">Annulées</option>
                <option value="no_driver">Sans chauffeuse</option>
              </Select>
              <Select aria-label="Paiement" value={method} onChange={(e) => (setMethod(e.target.value), setCursor(0))} className="w-48">
                <option value="">Tous paiements</option>
                <option value="cash">Espèces</option>
                <option value="card">Carte</option>
              </Select>
              <Select aria-label="Tri" value={sort} onChange={(e) => setSort(e.target.value)} className="w-44">
                <option value="recent">Plus récentes</option>
                <option value="amount">Montant décroissant</option>
              </Select>
            </div>
            <div className="mt-4">
              {rides.isLoading ? <TableSkeleton cols={7} /> : null}
              {rides.isError ? <ErrorState onRetry={() => rides.refetch()} /> : null}
              {rides.data ? (
                <>
                  <DataTable<AdminRideRow>
                    caption="Courses"
                    rows={rides.data.items}
                    rowKey={(r) => r.ride.id}
                    onRowClick={(r) => navigate(`/courses/${r.ride.id}`)}
                    empty={<EmptyState title="Aucune course" message="Aucune course ne correspond à ces filtres." />}
                    columns={[
                      { key: 'id', header: 'Référence', render: (r) => <span className="font-semibold">{r.ride.id}</span> },
                      { key: 'at', header: 'Demandée', className: 'whitespace-nowrap', render: (r) => fmtDateTime(r.ride.requestedAt) },
                      { key: 'p', header: 'Passagère', render: (r) => r.passengerName },
                      { key: 'd', header: 'Chauffeuse', render: (r) => r.driverName ?? <span className="text-muted">—</span> },
                      { key: 'm', header: 'Paiement', render: (r) => <div className="flex items-center gap-2">{METHOD_LABELS[r.ride.paymentMethod.kind]}{r.payment ? <PaymentBadge status={r.payment.status} /> : null}</div> },
                      { key: 's', header: 'Statut', render: (r) => <RideBadge status={r.ride.status} /> },
                      { key: 'a', header: 'Montant', align: 'right', render: (r) => money(r.ride.terms.breakdown.total) },
                    ]}
                  />
                  <Pagination cursor={cursor} total={rides.data.total} limit={20} onChange={setCursor} />
                </>
              ) : null}
            </div>
          </>
        ) : (
          <div className="pt-3">
            {scheduled.isLoading ? <TableSkeleton cols={6} /> : null}
            {scheduled.isError ? <ErrorState onRetry={() => scheduled.refetch()} /> : null}
            {scheduled.data ? (
              <DataTable
                caption="Réservations planifiées"
                rows={scheduled.data}
                rowKey={(r) => r.booking.id}
                onRowClick={(r) => r.booking.rideId && navigate(`/courses/${r.booking.rideId}`)}
                empty={<EmptyState title="Aucune réservation" />}
                columns={[
                  { key: 'id', header: 'Réservation', render: (r) => <span className="font-semibold">{r.booking.id}</span> },
                  { key: 'at', header: 'Départ prévu', render: (r) => fmtDateTime(r.booking.pickupAt), sort: (r) => r.booking.pickupAt },
                  { key: 'p', header: 'Passagère', render: (r) => r.passengerName },
                  { key: 'r', header: 'Trajet', render: (r) => r.booking.route.stops.map((s) => s.label).join(' → ') },
                  { key: 's', header: 'Statut', render: (r) => <div className="flex flex-col items-start gap-1"><ScheduledBadge status={r.booking.status} />{r.booking.status === 'scheduled' ? <span className="text-[12px] text-muted">Non assignée</span> : r.booking.rideId ? <span className="text-[12px] text-muted">{r.booking.rideId}</span> : null}</div> },
                  { key: 'a', header: 'Prix figé', align: 'right', render: (r) => money(r.booking.terms.breakdown.total) },
                ]}
              />
            ) : null}
          </div>
        )}
      </Card>
    </>
  );
}
