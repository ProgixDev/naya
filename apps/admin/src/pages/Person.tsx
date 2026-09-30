import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { EligibilityReason } from '@naya/api';
import { STATUS_LABELS } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDateTime, money, signed } from '../lib/format';
import { Badge, Banner, Card, DataTable, DefinitionList, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import { LEDGER_LABELS, METHOD_LABELS, RideBadge, SUBJECT_LABELS, TicketBadge, VerificationBadge } from '../components/status';
import { AuditList } from './Audit';

const reasonText = (r: EligibilityReason) =>
  r.code === 'identity_not_approved' ? `Identité : ${STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status}` : r.code === 'vehicle_not_approved' ? `Véhicule : ${STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status}` : r.code === 'debt_limit' ? `Plafond de dette atteint (${money(r.balance)} / −${money(r.limit)})` : r.code === 'city_unavailable' ? 'Ville indisponible' : 'Compte suspendu';

/** A03 · Profil détaillé. */
export function PersonPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['admin', 'person', id], queryFn: () => api.admin.person(id) });
  const cities = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const cityName = (cid: string) => cities.data?.find((c) => c.city.id === cid)?.city.name ?? cid;
  if (q.isLoading) return <Skeleton className="mt-6 h-[420px] w-full" />;
  if (q.isError || !q.data) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const d = q.data;
  const u = d.user;
  const name = `${u.firstName} ${u.lastName}`.trim() || u.phone;
  return (
    <>
      <PageHeader eyebrow={<Link to="/personnes" className="hover:text-accent">Personnes & véhicules</Link>} title={name} subtitle={`${u.id} · ${u.role === 'driver' ? 'Chauffeuse' : 'Passagère'} · ${u.phone} · inscrite le ${fmtDateTime(u.createdAt)}`} actions={<Badge tone={u.status === 'active' ? 'success' : 'danger'}>{u.status === 'active' ? 'Compte actif' : 'Compte suspendu'}</Badge>} />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          {d.eligibility ? (
            d.eligibility.eligible ? (
              <Banner tone="success" title="Peut recevoir des courses">Identité et véhicule approuvés, solde sous le plafond.</Banner>
            ) : (
              <Banner tone="warning" title="Ne peut pas recevoir de courses">{d.eligibility.reasons.map(reasonText).join(' · ')}</Banner>
            )
          ) : null}
          <Card title="Dossiers de vérification" subtitle={u.role === 'driver' ? 'Personne et véhicule sont approuvés séparément.' : undefined}>
            <ul className="flex flex-col gap-2">
              {d.cases.map((c) => (
                <li key={c.id}>
                  <Link to={`/verifications/${c.id}`} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 hover:bg-selected">
                    <span className="text-[14px] font-semibold">{SUBJECT_LABELS[c.subject]} · {c.id}</span>
                    <VerificationBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Courses récentes" padded={false}>
            <div className="px-2 pb-2">
              <DataTable
                caption="Courses"
                rows={d.rides}
                rowKey={(r) => r.id}
                onRowClick={(r) => navigate(`/courses/${r.id}`)}
                empty={<EmptyState title="Aucune course" />}
                columns={[
                  { key: 'id', header: 'Réf.', render: (r) => <span className="font-semibold">{r.id}</span> },
                  { key: 'at', header: 'Date', render: (r) => fmtDateTime(r.completedAt ?? r.requestedAt) },
                  { key: 'm', header: 'Paiement', render: (r) => METHOD_LABELS[r.paymentMethod.kind] },
                  { key: 's', header: 'Statut', render: (r) => <RideBadge status={r.status} /> },
                  { key: 'a', header: 'Montant', align: 'right', render: (r) => money(r.terms.breakdown.total) },
                ]}
              />
            </div>
          </Card>
          {u.role === 'driver' ? (
            <Card title="Portefeuille" subtitle={can('finance.read') ? undefined : 'Réservé aux rôles finance'}>
              {d.wallet ? (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div><div className="text-[12px] text-muted">Solde comptable</div><div className={`text-[20px] font-semibold tabular ${d.wallet.balance < 0 ? 'text-danger' : ''}`}>{money(d.wallet.balance)}</div></div>
                    <div><div className="text-[12px] text-muted">Réservé</div><div className="text-[20px] font-semibold tabular">{money(d.wallet.reserved)}</div></div>
                    <div><div className="text-[12px] text-muted">Disponible au retrait</div><div className="text-[20px] font-semibold tabular">{money(d.wallet.available)}</div></div>
                    <div><div className="text-[12px] text-muted">Dette / plafond</div><div className="text-[20px] font-semibold tabular">{money(d.wallet.debt)} <span className="text-[13px] text-muted">/ {money(d.wallet.debtLimit)}</span></div></div>
                  </div>
                  <div className="mt-5">
                    <DataTable
                      caption="Derniers mouvements"
                      rows={d.ledger}
                      rowKey={(e) => e.id}
                      empty={<EmptyState title="Aucun mouvement" />}
                      columns={[
                        { key: 'at', header: 'Date', className: 'whitespace-nowrap', render: (e) => fmtDateTime(e.createdAt) },
                        { key: 't', header: 'Type', render: (e) => LEDGER_LABELS[e.type] },
                        { key: 'r', header: 'Réf.', render: (e) => e.rideId ?? e.rechargeId ?? e.withdrawalId ?? e.correctionId ?? '—' },
                        { key: 'a', header: 'Montant', align: 'right', render: (e) => <span className={e.amount > 0 ? 'text-success' : ''}>{signed(e.amount)}</span> },
                        { key: 'b', header: 'Solde après', align: 'right', render: (e) => money(e.balanceAfter) },
                      ]}
                    />
                  </div>
                </>
              ) : (
                <p className="text-[14px] text-muted">Les montants sont masqués pour votre rôle.</p>
              )}
            </Card>
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Informations">
            <DefinitionList
              items={[
                { term: 'Ville', value: cityName(u.cityId) },
                { term: 'Villes de test', value: u.testerCities.length ? u.testerCities.map(cityName).join(', ') : '—' },
                { term: 'Note moyenne', value: u.ratingAverage ? `${u.ratingAverage.toString().replace('.', ',')} (${u.ratingCount})` : '—' },
                ...(d.vehicle ? [{ term: 'Véhicule', value: `${d.vehicle.make} ${d.vehicle.model} · ${d.vehicle.color} · ${d.vehicle.plate}` }] : []),
                ...(d.presence ? [{ term: 'Présence', value: d.presence.online ? `En ligne${d.presence.bot ? ' (simulée)' : ''}` : 'Hors ligne' }] : []),
              ]}
            />
          </Card>
          <Card title="Demandes au support">
            {d.tickets.length ? (
              <ul className="flex flex-col gap-2">
                {d.tickets.map((t) => (
                  <li key={t.id}>
                    <Link to={`/support/${t.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 hover:bg-selected">
                      <span className="truncate text-[14px] font-medium">{t.subject}</span>
                      <TicketBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">Aucune demande.</p>
            )}
          </Card>
          <Card title="Journal">{d.audit.length ? <AuditList events={d.audit} compact /> : <p className="text-[14px] text-muted">Aucun événement.</p>}</Card>
        </div>
      </div>
    </>
  );
}
