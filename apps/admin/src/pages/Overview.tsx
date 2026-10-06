import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Car, ChevronRight, ShieldCheck, User } from 'lucide-react';
import type { Ride } from '@naya/domain';
import { api } from '../lib/api';
import { PERIOD_LABELS, useWorkspace, type Period } from '../lib/context';
import { fmtDateTime, fmtToday, money } from '../lib/format';
import { Button, Card, DataTable, EmptyState, ErrorState, Kpi, PageHeader, Segmented, Skeleton } from '../components/ui';
import { MiniMap } from '../components/MiniMap';
import { METHOD_LABELS, RideBadge, SUBJECT_LABELS } from '../components/status';

/** A01 · Centre des opérations. */
export function OverviewPage() {
  const { cityId, period, setPeriod } = useWorkspace();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'overview', cityId, period], queryFn: () => api.admin.overview(cityId, period), refetchInterval: 10_000 });
  const cities = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const cityRow = cities.data?.find((c) => c.city.id === cityId);
  const d = q.data;
  return (
    <>
      <PageHeader
        title="Centre des opérations"
        subtitle={`${cityRow?.city.name ?? cityId} · ${fmtToday()}`}
        actions={<Segmented<Period> label="Période" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))} />}
      />
      {q.isError ? (
        <Card>
          <ErrorState onRetry={() => q.refetch()} />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
              {d ? (
                <>
                  <Kpi label="Courses terminées" value={d.completedRides} hint={PERIOD_LABELS[period]} />
                  <Kpi label="Volume des courses" value={money(d.volume)} hint={`${money(d.byMethod.cash)} espèces · ${money(d.byMethod.card)} carte · ${money(d.byMethod.wallet + d.byMethod.mobile_wallet)} wallets`} />
                  <Kpi label="Commissions" value={money(d.commission)} hint="Sur les courses terminées" />
                  <Kpi label="À examiner" value={d.reviewQueue.length} hint={`${d.openTickets} demande(s) support · ${d.pendingTransfers} opération(s) en attente`} tone={d.reviewQueue.length ? 'warning' : undefined} />
                </>
              ) : (
                Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))
              )}
            </div>
          </Card>
          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <Card title="Zone et chauffeuses en ligne" subtitle={d ? `${d.onlineDrivers.length} en ligne · ${d.activeRides} course(s) active(s)` : undefined} padded>
              {cityRow ? (
                <MiniMap
                  label={`Carte de ${cityRow.city.name}`}
                  center={cityRow.city.center}
                  zoom={12}
                  polygons={cityRow.zones.filter((z) => z.active).map((z) => z.polygon)}
                  markers={(d?.onlineDrivers ?? []).filter((o) => o.location).map((o) => ({ id: o.driverId, at: o.location!, label: `${o.name}${o.bot ? ' (simulée)' : ''}`, kind: 'driver' as const }))}
                  height={280}
                />
              ) : (
                <Skeleton className="h-[280px] w-full" />
              )}
            </Card>
            <Card title="Priorités" subtitle="Dossiers en attente d’un examen humain" action={d?.reviewQueue.length ? <span className="rounded-full bg-mauve-soft px-2.5 py-1 text-[12px] font-semibold text-accent">{d.reviewQueue.length} dossier(s)</span> : null}>
              {d && d.reviewQueue.length === 0 ? <EmptyState title="Aucun dossier en attente" message="Les nouvelles demandes apparaîtront ici." /> : null}
              <ul className="flex flex-col gap-2">
                {(d?.reviewQueue ?? []).slice(0, 4).map((r) => (
                  <li key={r.caseId}>
                    <Link to={`/verifications/${r.caseId}`} className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3 hover:bg-selected" data-testid={`priority-${r.caseId}`}>
                      {r.subject === 'vehicle' ? <Car className="h-5 w-5 text-accent" aria-hidden /> : <User className="h-5 w-5 text-accent" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold">
                          {r.subject === 'vehicle' ? 'Examiner le véhicule' : 'Vérifier'} · {r.userName}
                        </div>
                        <div className="text-[12px] text-muted">
                          {SUBJECT_LABELS[r.subject]} · {r.caseId} · {fmtDateTime(r.submittedAt)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <Button className="mt-4 w-full" onClick={() => navigate('/verifications')} icon={<ShieldCheck className="h-4 w-4" />}>
                Ouvrir les vérifications
              </Button>
            </Card>
          </div>
          <Card title="Dernières courses" action={<Button variant="ghost" size="sm" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/courses')}>Toutes les courses</Button>} padded={false}>
            <div className="px-2 pb-2">
              {!d ? (
                <div className="p-4"><Skeleton className="h-24 w-full" /></div>
              ) : (
                <DataTable<Ride>
                  caption="Dernières courses"
                  rows={d.recentRides}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate(`/courses/${r.id}`)}
                  empty={<EmptyState title="Aucune course dans cette ville" />}
                  columns={[
                    { key: 'id', header: 'Référence', render: (r) => <span className="font-semibold">{r.id}</span> },
                    { key: 'p', header: 'Passagère', render: (r) => r.passenger.firstName },
                    { key: 'd', header: 'Chauffeuse', render: (r) => r.driver?.firstName ?? '—' },
                    { key: 'm', header: 'Paiement', render: (r) => METHOD_LABELS[r.paymentMethod.kind] },
                    { key: 's', header: 'Statut', render: (r) => <RideBadge status={r.status} /> },
                    { key: 'a', header: 'Montant', align: 'right', render: (r) => money(r.terms.breakdown.total) },
                  ]}
                />
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
