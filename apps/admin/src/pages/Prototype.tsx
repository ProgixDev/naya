import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FAMILY_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  formatMoney,
  formatShort,
  type PrototypeCatalog,
  type ServiceCategory,
  type FamilyPlan,
  type DisputeReason,
} from '@naya/domain';
import { errorMessage } from '@naya/api';
import { api } from '../lib/api';
import {
  PageHeader,
  Card,
  Button,
  Banner,
  ErrorState,
  EmptyState,
  Dialog,
  Field,
  Input,
  Textarea,
  toast,
} from '../components/ui';
import { DocThumb, DocViewer } from '../components/DocViewer';
import { DriverCategoryMatrix } from '../components/DriverCategoryMatrix';
import { CategoryEditor } from '../components/CategoryEditor';
import { PlanEditor, ReasonEditor } from '../components/CatalogEditors';
import { DedicatedDriverCard, FamilyCard, PassengerWalletCard, PlanCard, ReasonCard, SosAlertCard } from '../components/ServiceCards';
import { Badge } from '../components/ui';
import { Bike, Car, Gem, PauseCircle, PlayCircle, Plus, Users, XCircle } from 'lucide-react';
import { ImpactList, ReasonField } from '../components/form';
import { logoConcepts, conceptSvg } from '@naya/assets/src/concepts';

type Kind = 'categories' | 'plans' | 'reasons';
const LABELS: Record<Kind, string> = {
  categories: 'Catégories',
  plans: 'Abonnements',
  reasons: 'Motifs de litige',
};
const SECTION: Record<Kind, { title: string; hint: string; add: string }> = {
  categories: { title: 'Types de véhicules', hint: 'Proposés à la cliente au moment de la commande, chacun avec ses tarifs, sa commission et ses conditions.', add: 'Nouvelle catégorie' },
  plans: { title: 'Abonnements famille', hint: 'Plans proposés aux familles pour une chauffeuse dédiée.', add: 'Nouvel abonnement' },
  reasons: { title: 'Motifs de litige', hint: 'Motifs proposés à l’ouverture d’un litige, avec preuve obligatoire si nécessaire.', add: 'Nouveau motif' },
};
const CATEGORY_ICON = { scooter: Bike, car: Car, premium: Gem } as const;

function SectionHead({ title, count, countLabel, hint }: { title: string; count: number; countLabel?: string; hint: string }) {
  return (
    <div>
      <h2 className="text-[20px] font-semibold">
        {title} <span className="text-[15px] font-medium text-muted">· {count}{countLabel ? ` ${countLabel}` : ''}</span>
      </h2>
      <p className="mt-1 text-[14px] text-muted">{hint}</p>
    </div>
  );
}

function CategoryCard({ category: c, busy, drivers, onToggle, onEdit }: { category: ServiceCategory; busy: boolean; drivers: number; onToggle: () => void; onEdit: () => void }) {
  const Icon = CATEGORY_ICON[c.icon] ?? Car;
  const own = [c.baseFare, c.perKm, c.perMinute, c.minimumFare].some((v) => v !== null);
  const figure = (label: string, value: number | null, suffix = '') => (
    <div className="rounded-2xl bg-background px-3 py-2.5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="text-[15px] font-semibold tabular">{value === null ? <span className="font-medium text-muted">Ville</span> : `${formatMoney(value)}${suffix}`}</div>
    </div>
  );
  return (
    <article className={`flex flex-col rounded-3xl border bg-surface p-5 shadow-card transition ${c.enabled ? 'border-line' : 'border-dashed border-line opacity-75'}`} data-testid={`category-card-${c.id}`}>
      <header className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${c.enabled ? 'bg-selected text-accent' : 'bg-line text-muted'}`}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">{c.name}</h3>
            <Badge tone={c.enabled ? 'success' : 'neutral'}>{c.enabled ? 'Active' : 'Désactivée'}</Badge>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[14px] text-muted">{c.description}</p>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {figure('Prise en charge', c.baseFare)}
        {figure('Par km', c.perKm)}
        {figure('Par minute', c.perMinute)}
        {figure('Minimum', c.minimumFare)}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        <div><dt className="inline text-muted">Commission </dt><dd className="inline font-semibold">{String(c.commissionBp / 100).replace('.', ',')} %</dd></div>
        <div><dt className="inline text-muted">Arrivée </dt><dd className="inline font-semibold">{c.etaMinutes} min</dd></div>
        <div><dt className="inline text-muted">Villes </dt><dd className="inline font-semibold capitalize">{c.cityIds.length ? c.cityIds.join(', ') : 'toutes'}</dd></div>
        <div className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted" aria-hidden /><dd className="inline font-semibold">{drivers}</dd><dt className="inline text-muted"> chauffeuse(s)</dt></div>
        {!own ? <div className="text-muted">Tarifs de la ville</div> : null}
      </dl>
      {c.conditions?.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {c.conditions.map((x) => <li key={x} className="rounded-full bg-mauve-soft px-2.5 py-1 text-[12px] text-ink">{x}</li>)}
        </ul>
      ) : null}
      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 [margin-top:max(1rem,auto)]">
        <span className="font-mono text-[12px] text-muted">{c.id}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" loading={busy} onClick={onToggle} data-testid={`toggle-${c.id}`}>{c.enabled ? 'Désactiver' : 'Activer'}</Button>
          <Button size="sm" variant="secondary" onClick={onEdit} data-testid={`edit-${c.id}`}>Modifier</Button>
        </div>
      </footer>
    </article>
  );
}

export function PrototypePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'prototype'],
    queryFn: api.adminPrototype.get,
    refetchInterval: 5000,
  });
  const [tab, setTab] = useState<
    Kind | 'families' | 'drivers' | 'alerts' | 'wallets' | 'brand'
  >('categories');
  const [alertFilter, setAlertFilter] = useState<'' | 'new' | 'responding' | 'resolved'>('');
  const [subChange, setSubChange] = useState<{ id: string; status: 'active' | 'paused' | 'cancelled' } | null>(null);
  const [subReason, setSubReason] = useState('');
  const [editing, setEditing] = useState<{
    kind: Kind;
    row: Record<string, unknown>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string>();
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ['admin'] });
      toast('Démonstration mise à jour', 'success');
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const p = q.data;
  return (
    <>
      <PageHeader
        title="Services et familles"
        subtitle="Configuration et opérations du prototype · les apps lisent ces catalogues."
      />
      <Banner tone="info" title="Démonstration">
        Paiements, notifications et appels sont simulés. Les alertes, décisions
        et changements sont conservés dans le journal.
      </Banner>
      <nav aria-label="Sections" className="my-6 overflow-x-auto border-b border-line">
        <div role="tablist" className="flex min-w-max gap-1">
          {(
            [
              ...Object.keys(LABELS),
              'families',
              'drivers',
              'alerts',
              'wallets',
              'brand',
            ] as const
          ).map((t) => {
            const on = tab === t;
            const count =
              t === 'alerts' ? p?.alerts.filter((a) => a.status !== 'resolved').length : undefined;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t as typeof tab)}
                className={`relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-[15px] font-semibold transition-colors ${on ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
              >
                {LABELS[t as Kind] ??
                  (
                    {
                      families: 'Familles',
                      drivers: 'Chauffeuses dédiées',
                      alerts: 'SOS',
                      wallets: 'Portefeuilles',
                      brand: 'Pistes de logo',
                    } as Record<string, string>
                  )[t]}
                {count ? (
                  <span className="rounded-full bg-danger px-1.5 text-[11px] leading-[18px] text-white">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {p && tab in LABELS ? (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold">
                {SECTION[tab as Kind].title}{' '}
                <span className="text-[15px] font-medium text-muted">· {p.catalog[tab as Kind].length}</span>
              </h2>
              <p className="mt-1 text-[14px] text-muted">{SECTION[tab as Kind].hint}</p>
            </div>
            <Button
              icon={<Plus className="h-4 w-4" aria-hidden />}
              data-testid="catalog-add"
              onClick={() => {
                const kind = tab as Kind;
                if (kind === 'categories') {
                  // A new category starts blank: the city tariffs apply until set.
                  const blank: ServiceCategory = { id: '', name: '', description: '', icon: 'car', enabled: true, cityIds: [], etaMinutes: 5, commissionBp: 1500, baseFare: null, perKm: null, perMinute: null, minimumFare: null, conditions: [] };
                  setEditing({ kind, row: blank as unknown as Record<string, unknown> });
                  return;
                }
                if (kind === 'plans') {
                  const blank: FamilyPlan = { id: '', name: '', price: 0, durationDays: 30, includedTrips: 20, enabled: true, dedicatedDriver: true, features: ['Chauffeuse dédiée', 'Suivi et confirmations'] };
                  setEditing({ kind, row: blank as unknown as Record<string, unknown> });
                  return;
                }
                const blank: DisputeReason = { id: '', label: '', category: 'ride', evidenceRequired: false, enabled: true, roles: [] };
                setEditing({ kind, row: blank as unknown as Record<string, unknown> });
              }}
            >
              {SECTION[tab as Kind].add}
            </Button>
          </div>
          {tab === 'categories' ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {p.catalog.categories.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  busy={busy}
                  drivers={p.people.filter((u) => u.role === 'driver' && (p.driverCategories[u.id] ?? p.catalog.categories.map((x) => x.id)).includes(c.id)).length}
                  onToggle={() => run(() => api.adminPrototype.save('categories', { ...c, enabled: !c.enabled }))}
                  onEdit={() => setEditing({ kind: 'categories', row: { ...c } })}
                />
              ))}
            </div>
          ) : tab === 'plans' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {p.catalog.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  busy={busy}
                  activeCount={p.subscriptions.filter((x) => x.planId === plan.id && x.status === 'active').length}
                  onToggle={() => run(() => api.adminPrototype.save('plans', { ...plan, enabled: !plan.enabled }))}
                  onEdit={() => setEditing({ kind: 'plans', row: { ...plan } as unknown as Record<string, unknown> })}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {p.catalog.reasons.map((r) => (
                <ReasonCard
                  key={r.id}
                  reason={r}
                  busy={busy}
                  onToggle={() => run(() => api.adminPrototype.save('reasons', { ...r, enabled: !r.enabled }))}
                  onEdit={() => setEditing({ kind: 'reasons', row: { ...r } as unknown as Record<string, unknown> })}
                />
              ))}
            </div>
          )}
          {tab === 'categories' ? (
            <DriverCategoryMatrix
              drivers={p.people.filter((u) => u.role === 'driver')}
              categories={p.catalog.categories}
              allowed={p.driverCategories}
              busy={busy}
              onChange={(changes) =>
                run(async () => {
                  for (const c of changes)
                    await api.adminPrototype.categories(c.driverId, c.categoryIds);
                })
              }
            />
          ) : null}
        </>
      ) : null}
      {p && tab === 'alerts' ? (
        <div className="flex flex-col gap-4">
          <SectionHead title="Alertes SOS" count={p.alerts.length} hint="Déclenchées pendant une course ou un trajet famille. Position, personnes et actions sont conservées." />
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['', 'Toutes'],
                ['new', 'Nouvelles'],
                ['responding', 'Prises en charge'],
                ['resolved', 'Résolues'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setAlertFilter(v)} aria-pressed={alertFilter === v} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition ${alertFilter === v ? 'border-accent bg-selected text-accent' : 'border-line hover:bg-background'}`}>
                {l}
                <span className={`rounded-full px-1.5 text-[12px] tabular ${v === 'new' && p.alerts.some((a) => a.status === 'new') ? 'bg-danger text-white' : 'bg-line text-muted'}`}>{p.alerts.filter((a) => !v || a.status === v).length}</span>
              </button>
            ))}
          </div>
          {!p.alerts.filter((a) => !alertFilter || a.status === alertFilter).length ? (
            <Card><EmptyState title={p.alerts.length ? 'Aucune alerte pour ce filtre' : 'Aucune alerte SOS'} message={p.alerts.length ? undefined : 'Les alertes déclenchées depuis une course ou un trajet famille apparaîtront ici.'} /></Card>
          ) : null}
          {p.alerts
            .filter((a) => !alertFilter || a.status === alertFilter)
            .slice()
            .reverse()
            .map((a) => (
              <SosAlertCard
                key={a.id}
                a={a}
                busy={busy}
                onStatus={(status) => run(() => api.adminPrototype.alert(a.id, status, status === 'responding' ? 'Prise en charge par l’équipe sécurité' : 'Alerte résolue par l’équipe sécurité'))}
              />
            ))}
        </div>
      ) : null}
      {p && tab === 'families' ? (
        <div className="flex flex-col gap-4">
          <SectionHead title="Familles abonnées" count={p.subscriptions.length} hint="Abonnement, chauffeuse dédiée, enfants et traçabilité de chaque trajet." />
          {!p.subscriptions.length ? (
            <Card><EmptyState title="Aucune famille abonnée" message="Les abonnements souscrits depuis l’espace Naya Famille apparaîtront ici. Pour une démonstration, chargez l’exemple depuis l’application." /></Card>
          ) : null}
          {p.subscriptions.map((s) => {
            const owner = p.people.find((u) => u.id === s.passengerId);
            return (
              <FamilyCard
                key={s.id}
                sub={s}
                familyName={owner?.name ?? s.passengerId}
                children={p.children.filter((c) => c.passengerId === s.passengerId)}
                trips={p.trips.filter((t) => t.passengerId === s.passengerId)}
                drivers={p.people.filter((u) => u.role === 'driver' && u.cityId === owner?.cityId)}
                busy={busy}
                onAssign={(driverId) => run(() => api.adminPrototype.assign(s.id, driverId))}
                onStatus={(status) => (setSubChange({ id: s.id, status }), setSubReason(''))}
                onView={setView}
              />
            );
          })}
        </div>
      ) : null}
      {p && tab === 'drivers' ? (
        <div className="flex flex-col gap-4">
          <SectionHead title="Chauffeuses dédiées" count={p.dedicatedDrivers.filter((d) => d.available && d.verified).length} countLabel="disponibles" hint="Les nouveaux abonnements vont à la chauffeuse vérifiée et disponible la moins chargée de la ville." />
          <div className="grid gap-4 lg:grid-cols-2">
            {p.dedicatedDrivers
              .slice()
              .sort((a, b) => Number(b.verified) - Number(a.verified) || b.families.length - a.families.length)
              .map((d) => (
                <DedicatedDriverCard key={d.id} d={d} busy={busy} onAvailable={(v) => run(() => api.adminPrototype.familyAvailability(d.id, v))} />
              ))}
          </div>
        </div>
      ) : null}
      {subChange ? (
        (() => {
          const sub = p?.subscriptions.find((x) => x.id === subChange.id);
          const family = p?.people.find((u) => u.id === sub?.passengerId)?.name ?? 'la famille';
          const cfg = {
            active: { title: 'Réactiver l’abonnement ?', tone: 'success' as const, icon: <PlayCircle />, cta: 'Réactiver', variant: 'primary' as const, impact: [`${family} peut de nouveau planifier des trajets.`, 'Les trajets récurrents reprennent après chaque remise.'] },
            paused: { title: 'Suspendre l’abonnement ?', tone: 'warning' as const, icon: <PauseCircle />, cta: 'Suspendre', variant: 'primary' as const, impact: ['Aucun nouveau trajet ne peut être planifié.', 'Les trajets déjà planifiés sont conservés.', 'Réactivable à tout moment.'] },
            cancelled: { title: 'Résilier l’abonnement ?', tone: 'danger' as const, icon: <XCircle />, cta: 'Résilier définitivement', variant: 'danger' as const, impact: ['Résiliation définitive : l’abonnement ne pourra pas être réactivé.', 'Aucun nouveau trajet ne pourra être planifié.', 'La famille pourra souscrire un nouvel abonnement.'] },
          }[subChange.status];
          return (
            <Dialog
              open
              size="sm"
              tone={cfg.tone}
              icon={cfg.icon}
              onClose={() => setSubChange(null)}
              busy={busy}
              title={cfg.title}
              description={sub ? `${family} · ${sub.planName}` : undefined}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setSubChange(null)} disabled={busy}>Annuler</Button>
                  <Button
                    variant={cfg.variant}
                    loading={busy}
                    disabled={subReason.trim().length < 5}
                    onClick={() =>
                      run(async () => {
                        await api.adminPrototype.subscriptionStatus(subChange.id, subChange.status, subReason.trim());
                        setSubChange(null);
                      })
                    }
                  >
                    {cfg.cta}
                  </Button>
                </>
              }
            >
              <div className="flex flex-col gap-4">
                <ImpactList items={cfg.impact} tone={cfg.tone === 'danger' ? 'danger' : cfg.tone === 'warning' ? 'warning' : 'success'} />
                <ReasonField value={subReason} onChange={setSubReason} min={5} testId="sub-reason" />
              </div>
            </Dialog>
          );
        })()
      ) : null}
      {p && tab === 'wallets' ? (
        <div className="flex flex-col gap-4">
          <SectionHead title="Portefeuilles clientes" count={p.wallets.length} hint="Solde prépayé des clientes : recharges, débits des courses et montants réservés. Le détail financier complet est dans Finance." />
          {!p.wallets.length ? (
            <Card><EmptyState title="Aucun portefeuille cliente" message="Un portefeuille apparaît après la première recharge d’une cliente." /></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {p.wallets.map((w) => <PassengerWalletCard key={w.userId} w={w} name={p.people.find((u) => u.id === w.userId)?.name ?? w.userId} />)}
            </div>
          )}
        </div>
      ) : null}
      {tab === 'brand' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {logoConcepts.map((c) => (
            <Card key={c.id} title={c.name} subtitle={c.description}>
              <div className="flex flex-wrap items-center gap-5">
                <img
                  className="h-24 w-24"
                  alt={`${c.name} · symbole`}
                  src={`data:image/svg+xml,${encodeURIComponent(conceptSvg(c.id, '#6B3657'))}`}
                />
                <img
                  className="h-16 w-44"
                  alt={`${c.name} · signature`}
                  src={`data:image/svg+xml,${encodeURIComponent(conceptSvg(c.id, '#6B3657', true))}`}
                />
                <div className="rounded-2xl bg-[#231D28] p-3">
                  <img
                    className="h-14 w-14"
                    alt={`${c.name} · sombre`}
                    src={`data:image/svg+xml,${encodeURIComponent(conceptSvg(c.id, '#E5B6D4'))}`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {editing ? (
        (() => {
          const isNew = editing.row.id === '';
          const save = async (row: object, name: string) => {
            setBusy(true);
            try {
              await api.adminPrototype.save(editing.kind, row);
              await qc.invalidateQueries({ queryKey: ['admin'] });
              toast(isNew ? `${name} créé·e` : `${name} mis·e à jour`, 'success');
              setEditing(null);
            } catch (e) {
              throw new Error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          };
          const common = { isNew, busy, onClose: () => setEditing(null) };
          if (editing.kind === 'categories') return <CategoryEditor {...common} initial={editing.row as unknown as ServiceCategory} onSave={(r) => save(r, r.name)} />;
          if (editing.kind === 'plans') return <PlanEditor {...common} initial={editing.row as unknown as FamilyPlan} onSave={(r) => save(r, r.name)} />;
          return <ReasonEditor {...common} initial={editing.row as unknown as DisputeReason} onSave={(r) => save(r, r.label)} />;
        })()
      ) : null}
      <DocViewer
        uploadId={view}
        label="Photo d’arrivée"
        open={!!view}
        onClose={() => setView(undefined)}
      />
    </>
  );
}
