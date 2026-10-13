import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WASH_PAYMENT_LABELS, type WashOrderStatus } from '@naya/domain';
import type { AdminWashOrderRow } from '@naya/api';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { fmtDateTime, money } from '../lib/format';
import { Badge, Banner, Card, DataTable, EmptyState, ErrorState, PageHeader, Select, TableSkeleton } from '../components/ui';
import { PaymentBadge } from '../components/status';

const TONE: Record<WashOrderStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  booked: 'neutral',
  washer_assigned: 'info',
  en_route: 'info',
  washing: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

/** « Lavage à domicile » · read-only list of wash orders (server gate: rides.read). */
export function CarWashPage() {
  const { cityId } = useWorkspace();
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: ['admin', 'car-wash', cityId], queryFn: () => api.admin.carWashOrders(cityId), refetchInterval: 10_000 });
  const rows = (q.data ?? []).filter((r) => !status || (status === 'open' ? !['completed', 'cancelled'].includes(r.order.status) : r.order.status === status));
  return (
    <>
      <PageHeader title="Lavages à domicile" subtitle="Commandes des passagères et des chauffeuses. Lecture seule : les équipes de lavage, leurs trajets et leurs photos sont simulés." />
      <Banner tone="info" title="Service en démonstration">Prix, durées et règles d’annulation sont provisoires (configuration de démo, à fixer par le client).</Banner>
      <Card padded={false} className="mt-4">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
          <Select aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value)} className="w-56" data-testid="car-wash-status">
            <option value="">Tous les statuts</option>
            <option value="open">En cours et planifiés</option>
            <option value="completed">Terminés</option>
            <option value="cancelled">Annulés</option>
          </Select>
        </div>
        <div className="mt-4">
          {q.isLoading ? <TableSkeleton cols={8} /> : null}
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
          {q.data ? (
            <DataTable<AdminWashOrderRow>
              caption="Lavages à domicile"
              rows={rows}
              rowKey={(r) => r.order.id}
              empty={<EmptyState title="Aucun lavage" message="Aucune commande de lavage ne correspond à ces filtres." />}
              columns={[
                { key: 'id', header: 'Référence', render: (r) => <span className="font-semibold">{r.order.id}</span> },
                { key: 'at', header: 'Créneau', className: 'whitespace-nowrap', render: (r) => (r.order.timing === 'now' ? `Maintenant · ${fmtDateTime(r.order.createdAt)}` : fmtDateTime(r.order.startAt)) },
                { key: 'c', header: 'Cliente', render: (r) => <div><div>{r.customerName}</div><div className="text-[12px] text-muted">{r.order.customerRole === 'driver' ? 'Chauffeuse' : 'Passagère'}</div></div> },
                { key: 'car', header: 'Voiture', render: (r) => <div><div>{`${r.order.car.make} ${r.order.car.model}`}</div><div className="text-[12px] text-muted">{r.order.car.plate}</div></div> },
                { key: 'w', header: 'Lieu', render: (r) => <div><div>{r.order.location.label}</div><div className="line-clamp-1 text-[12px] text-muted">{r.order.parkingNotes || r.order.location.address}</div></div> },
                { key: 'team', header: 'Équipe', render: (r) => r.order.team?.name ?? <span className="text-muted">—</span> },
                { key: 'p', header: 'Paiement', render: (r) => <div className="flex items-center gap-2">{WASH_PAYMENT_LABELS[r.order.paymentMethod.kind]}{r.payment ? <PaymentBadge status={r.payment.status} /> : null}</div> },
                { key: 's', header: 'Statut', render: (r) => <Badge tone={TONE[r.order.status]}>{r.statusLabel}</Badge> },
                { key: 'a', header: 'Montant', align: 'right', render: (r) => <div><div>{money(r.order.terms.price)}</div><div className="text-[12px] text-muted">{r.order.terms.packageName}</div></div> },
              ]}
            />
          ) : null}
        </div>
      </Card>
    </>
  );
}
