import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Bot, Building2, FileCheck2, KeyRound, Search, ShieldAlert, ShieldCheck, UserRound, Wallet, Wrench } from 'lucide-react';
import type { AuditEvent } from '@naya/domain';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { fmtDateTime } from '../lib/format';
import { Badge, Card, DataTable, DefinitionList, Drawer, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, TableSkeleton } from '../components/ui';

const iconFor = (action: string) => {
  if (action.startsWith('verification')) return FileCheck2;
  if (action.startsWith('city') || action.startsWith('zone')) return Building2;
  if (action.startsWith('finance')) return Wrench;
  if (action.startsWith('withdrawal') || action.startsWith('recharge')) return Wallet;
  if (action.startsWith('payment')) return Banknote;
  if (action.startsWith('admin')) return KeyRound;
  if (action.startsWith('dev') || action.startsWith('demo')) return Bot;
  return UserRound;
};

const ACTOR_LABELS: Record<AuditEvent['actor']['type'], string> = { admin: 'Administration', user: 'Utilisatrice', system: 'Système', provider: 'Prestataire' };

export function AuditList({ events, compact }: { events: AuditEvent[]; compact?: boolean }) {
  return (
    <ol className="flex flex-col gap-3">
      {events.slice(0, compact ? 8 : undefined).map((e) => {
        const Icon = iconFor(e.action);
        return (
          <li key={e.id} className="flex gap-3 text-[13px]">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0">
              <div className="font-medium text-ink">{e.summary}</div>
              <div className="text-muted">
                {e.actor.name} · {fmtDateTime(e.at)}
                {e.reason ? ` · Motif : ${e.reason}` : ''}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const Json = ({ value }: { value: unknown }) => <pre className="max-h-56 overflow-auto rounded-xl bg-background p-3 text-[12px] leading-5 text-ink">{JSON.stringify(value, null, 2)}</pre>;

/** A13 · Journal d’audit immuable (chaîne de hachage vérifiée à chaque lecture). */
export function AuditPage() {
  const { cityId } = useWorkspace();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [actorType, setActorType] = useState('');
  const [scope, setScope] = useState<'city' | 'all'>('city');
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const query = useQuery({ queryKey: ['admin', 'audit', q, action, actorType, scope, cityId, cursor], queryFn: () => api.admin.audit({ q: q || undefined, action: action || undefined, actorType: actorType || undefined, cityId: scope === 'city' ? cityId : undefined, cursor, limit: 25 }) });
  const integrity = query.data?.integrity;
  return (
    <>
      <PageHeader
        title="Journal d’audit"
        subtitle="Chaque décision, règle, correction et opération financière. Les événements ne peuvent être ni modifiés ni supprimés."
        actions={
          integrity ? (
            integrity.valid ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-[13px] font-semibold text-success" data-testid="audit-integrity">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Chaîne intègre
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3 py-1.5 text-[13px] font-semibold text-danger" data-testid="audit-integrity">
                <ShieldAlert className="h-4 w-4" aria-hidden /> Rupture détectée à l’événement {integrity.brokenAt}
              </span>
            )
          ) : null
        }
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Rechercher dans le journal" placeholder="Rechercher : dossier, course, personne, motif" className="pl-9" value={q} onChange={(e) => (setQ(e.target.value), setCursor(0))} data-testid="audit-search" />
          </div>
          <Select aria-label="Type d’action" value={action} onChange={(e) => (setAction(e.target.value), setCursor(0))} className="w-56" data-testid="audit-action">
            <option value="">Toutes les actions</option>
            <option value="verification">Vérifications</option>
            <option value="city">Villes et règles</option>
            <option value="zone">Zones</option>
            <option value="provider">Prestataires</option>
            <option value="finance">Corrections</option>
            <option value="withdrawal">Retraits</option>
            <option value="recharge">Recharges</option>
            <option value="payment">Paiements</option>
            <option value="support">Support</option>
            <option value="ride">Courses</option>
            <option value="admin">Connexions</option>
          </Select>
          <Select aria-label="Acteur" value={actorType} onChange={(e) => (setActorType(e.target.value), setCursor(0))} className="w-48">
            <option value="">Tous les acteurs</option>
            {Object.entries(ACTOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select aria-label="Portée" value={scope} onChange={(e) => (setScope(e.target.value as 'city' | 'all'), setCursor(0))} className="w-52">
            <option value="city">Ville sélectionnée</option>
            <option value="all">Toutes les villes</option>
          </Select>
        </div>
        <div className="mt-4">
          {query.isLoading ? <TableSkeleton cols={5} rows={8} /> : null}
          {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : null}
          {query.data ? (
            <>
              <DataTable<AuditEvent>
                caption="Événements d’audit"
                rows={query.data.items}
                rowKey={(e) => e.id}
                onRowClick={setOpen}
                empty={<EmptyState title="Aucun événement" message="Modifiez les filtres pour élargir la recherche." />}
                columns={[
                  { key: 'at', header: 'Date', className: 'whitespace-nowrap text-muted', render: (e) => fmtDateTime(e.at) },
                  {
                    key: 'ev',
                    header: 'Événement',
                    render: (e) => {
                      const Icon = iconFor(e.action);
                      return (
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                          <span className="line-clamp-1">{e.summary}</span>
                        </span>
                      );
                    },
                  },
                  { key: 'actor', header: 'Acteur', render: (e) => <span className="whitespace-nowrap">{e.actor.name}</span> },
                  { key: 'ent', header: 'Élément', render: (e) => <span className="font-medium tabular">{e.entityId}</span> },
                  { key: 'seq', header: 'N°', align: 'right', render: (e) => <span className="text-muted">{e.seq}</span> },
                ]}
              />
              <Pagination cursor={cursor} total={query.data.total} limit={25} onChange={setCursor} />
            </>
          ) : null}
        </div>
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.summary ?? ''} subtitle={open ? `${open.id} · n° ${open.seq}` : undefined}>
        {open ? (
          <div className="flex flex-col gap-5">
            <DefinitionList
              items={[
                { term: 'Date', value: fmtDateTime(open.at) },
                { term: 'Action', value: <code className="text-[13px]">{open.action}</code> },
                { term: 'Acteur', value: `${open.actor.name} (${ACTOR_LABELS[open.actor.type]})` },
                { term: 'Élément', value: `${open.entityType} · ${open.entityId}` },
                { term: 'Ville', value: open.cityId ?? 'Toutes' },
                { term: 'Motif', value: open.reason ?? '—' },
              ]}
            />
            {open.before !== null ? (
              <div>
                <div className="label mb-2">Avant</div>
                <Json value={open.before} />
              </div>
            ) : null}
            {open.after !== null ? (
              <div>
                <div className="label mb-2">Après</div>
                <Json value={open.after} />
              </div>
            ) : null}
            <div className="rounded-2xl border border-line p-4 text-[12px]">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone="success">Scellé</Badge>
                <span className="text-muted">Empreinte SHA-256 chaînée au précédent événement</span>
              </div>
              <div className="break-all font-mono text-muted">Empreinte : {open.hash}</div>
              <div className="mt-1 break-all font-mono text-muted">Précédente : {open.prevHash}</div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
