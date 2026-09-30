import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { formatBp, formatDistance, formatDuration, formatMultiplier, splitFare } from '@naya/domain';
import { api } from '../lib/api';
import { fmtDateTime, money, signed } from '../lib/format';
import { Card, DataTable, DefinitionList, EmptyState, ErrorState, PageHeader, Skeleton, Banner } from '../components/ui';
import { MiniMap } from '../components/MiniMap';
import { LEDGER_LABELS, METHOD_LABELS, OfferBadge, PaymentBadge, RideBadge, TicketBadge } from '../components/status';
import { AuditList } from './Audit';

/** A07 · Détail et chronologie d’une course. */
export function RidePage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['admin', 'ride', id], queryFn: () => api.admin.ride(id), refetchInterval: 5000 });
  if (q.isLoading) return <Skeleton className="mt-6 h-[480px] w-full" />;
  if (q.isError || !q.data) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const { ride, offers, payments, ledger, tickets, audit, passenger, driver } = q.data;
  const t = ride.terms;
  const split = splitFare(t.breakdown.total, t.commissionBp);
  const stops = ride.route.stops;
  return (
    <>
      <PageHeader eyebrow={<Link to="/courses" className="hover:text-accent">Courses</Link>} title={`Course ${ride.id}`} subtitle={`${stops.map((s) => s.label).join(' → ')} · ${formatDistance(ride.route.distanceMeters)} · ${formatDuration(ride.route.durationSeconds)}`} actions={<RideBadge status={ride.status} />} />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          {ride.cancellation ? (
            <Banner tone="warning" title={`Annulée par ${ride.cancellation.by === 'passenger' ? 'la passagère' : ride.cancellation.by === 'driver' ? 'la chauffeuse' : 'le système'}`}>
              {ride.cancellation.reasonText} · frais {money(ride.cancellation.fee)} · {fmtDateTime(ride.cancellation.at)}
            </Banner>
          ) : null}
          {ride.driverCancellations.length ? (
            <Banner tone="info" title="Annulation chauffeuse et nouvelle recherche">
              {ride.driverCancellations.map((d) => `${d.reasonText} (${fmtDateTime(d.at)})`).join(' · ')}
            </Banner>
          ) : null}
          <Card title="Trajet" padded>
            <MiniMap
              label={`Trajet de la course ${ride.id}`}
              center={{ lat: stops.reduce((a, s) => a + s.location.lat, 0) / stops.length, lng: stops.reduce((a, s) => a + s.location.lng, 0) / stops.length }}
              zoom={13}
              route={ride.route.polyline}
              markers={[
                ...stops.map((s, i) => ({ id: `s${i}`, at: s.location, label: s.label, kind: (i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop') as 'pickup' })),
                ...(ride.driverLocation ? [{ id: 'drv', at: ride.driverLocation.location, label: `${ride.driver?.firstName ?? ''}${ride.driverLocation.stale ? ' · position ancienne' : ''}`, kind: 'driver' as const }] : []),
              ]}
              height={260}
            />
            <ol className="mt-4 flex flex-col gap-2 text-[14px]">
              {stops.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-24 shrink-0 text-muted">{i === 0 ? 'Départ' : i === stops.length - 1 ? 'Destination' : `Arrêt ${i}`}</span>
                  <span>
                    <span className="font-medium">{s.label}</span> <span className="text-muted">· {s.address}</span>
                    {i > 0 && i < stops.length - 1 && ride.completedStops >= i ? <span className="ml-2 text-[12px] text-success">effectué</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Chronologie">
            <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
              {ride.timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden />
                  <div className="text-[14px] font-medium">{e.label}</div>
                  <div className="text-[12px] text-muted">{fmtDateTime(e.at)} · {e.actor === 'passenger' ? 'Passagère' : e.actor === 'driver' ? 'Chauffeuse' : e.actor === 'provider' ? 'Prestataire' : e.actor === 'admin' ? 'Administration' : 'Système'}</div>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Propositions aux chauffeuses" padded={false}>
            <div className="px-2 pb-2">
              <DataTable
                caption="Propositions"
                rows={offers}
                rowKey={(o) => o.id}
                empty={<EmptyState title="Aucune proposition envoyée" />}
                columns={[
                  { key: 'id', header: 'Proposition', render: (o) => o.id },
                  { key: 'd', header: 'Chauffeuse', render: (o) => o.driverName },
                  { key: 'at', header: 'Envoyée', render: (o) => fmtDateTime(o.createdAt) },
                  { key: 'exp', header: 'Expire', render: (o) => fmtDateTime(o.expiresAt) },
                  { key: 's', header: 'Issue', render: (o) => <div className="flex flex-col items-start gap-1"><OfferBadge status={o.status} />{o.declineReason ? <span className="text-[12px] text-muted">{o.declineReason}</span> : null}</div> },
                ]}
              />
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Conditions figées" subtitle={`Règles ${t.cityId} v${t.ruleVersion} · acceptées le ${fmtDateTime(t.acceptedAt)}`}>
            <DefinitionList
              items={[
                { term: 'Prise en charge', value: money(t.breakdown.baseFare) },
                { term: 'Distance', value: money(t.breakdown.distanceFare) },
                { term: 'Durée', value: money(t.breakdown.timeFare) },
                ...(t.breakdown.minimumAdjustment ? [{ term: 'Ajustement minimum', value: money(t.breakdown.minimumAdjustment) }] : []),
                ...(t.breakdown.dynamicSurcharge ? [{ term: `Dynamique ${formatMultiplier(t.breakdown.multiplierBp)}`, value: `+${money(t.breakdown.dynamicSurcharge)}` }] : []),
                { term: 'Total', value: <strong>{money(t.breakdown.total)}</strong> },
                { term: `Commission ${formatBp(t.commissionBp)}`, value: money(split.commission) },
                { term: 'Net chauffeuse', value: money(split.net) },
                { term: 'Paiement', value: `${METHOD_LABELS[ride.paymentMethod.kind]} · ${ride.paymentMethod.label}` },
              ]}
            />
          </Card>
          <Card title="Personnes">
            <DefinitionList
              items={[
                { term: 'Passagère', value: <Link className="font-semibold text-accent" to={`/personnes/${passenger.id}`}>{passenger.firstName} {passenger.lastName}</Link> },
                { term: 'Chauffeuse', value: driver ? <Link className="font-semibold text-accent" to={`/personnes/${driver.id}`}>{driver.firstName} {driver.lastName}</Link> : '—' },
                ...(ride.driver ? [{ term: 'Véhicule', value: `${ride.driver.vehicle.make} ${ride.driver.vehicle.model} · ${ride.driver.vehicle.plate}` }] : []),
                ...(ride.rating ? [{ term: 'Note', value: `${ride.rating.stars}/5${ride.rating.comment ? ` · ${ride.rating.comment}` : ''}` }] : []),
              ]}
            />
          </Card>
          <Card title="Paiements">
            {payments.length ? (
              <ul className="flex flex-col gap-2">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 text-[14px]">
                    <div>
                      <div className="font-medium">{p.purpose === 'ride' ? 'Course' : 'Frais d’annulation'} · {METHOD_LABELS[p.method]} · {p.id}</div>
                      <div className="text-[12px] text-muted">{fmtDateTime(p.updatedAt)}{p.failureReason ? ` · ${p.failureReason}` : ''}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1"><span className="tabular font-semibold">{money(p.amount)}</span><PaymentBadge status={p.status} /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">Aucun paiement (course non terminée).</p>
            )}
          </Card>
          {ledger.length ? (
            <Card title="Mouvements du portefeuille">
              <ul className="flex flex-col gap-2 text-[14px]">
                {ledger.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span>{LEDGER_LABELS[e.type]}</span>
                    <span className={`tabular font-semibold ${e.amount > 0 ? 'text-success' : ''}`}>{signed(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {tickets.length ? (
            <Card title="Demandes liées">
              <ul className="flex flex-col gap-2">
                {tickets.map((t2) => (
                  <li key={t2.id}>
                    <Link to={`/support/${t2.id}`} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 hover:bg-selected">
                      <span className="truncate text-[14px] font-medium">{t2.subject}</span>
                      <TicketBadge status={t2.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card title="Journal">{audit.length ? <AuditList events={audit} compact /> : <p className="text-[14px] text-muted">Aucun événement d’audit.</p>}</Card>
        </div>
      </div>
    </>
  );
}
