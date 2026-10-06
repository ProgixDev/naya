import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultPrototypeCatalog,
  FAMILY_STATUS_LABELS,
  formatMoney,
  formatShort,
  type PrototypeCatalog,
} from '@naya/domain';
import { errorMessage } from '@naya/api';
import { api } from '../lib/api';
import {
  PageHeader,
  Card,
  Button,
  Banner,
  ErrorState,
  Dialog,
  Field,
  Input,
  toast,
} from '../components/ui';
import { DocThumb, DocViewer } from '../components/DocViewer';
import { logoConcepts, conceptSvg } from '@naya/assets/src/concepts';

type Kind = 'categories' | 'plans' | 'reasons' | 'payments';
const LABELS: Record<Kind, string> = {
  categories: 'Catégories',
  plans: 'Abonnements',
  reasons: 'Motifs de litige',
  payments: 'Paiements démo',
};
const fields: Record<string, string> = {
  id: 'Identifiant',
  name: 'Nom',
  description: 'Description',
  label: 'Libellé',
  icon: 'Icône (car / scooter / premium)',
  enabled: 'Activé',
  cityIds: 'Villes (identifiants séparés par une virgule, vide = toutes)',
  etaMinutes: 'Arrivée estimée (minutes)',
  commissionBp: 'Commission (%)',
  baseFare: 'Prise en charge (MAD)',
  perKm: 'Prix / km (MAD)',
  perMinute: 'Prix / min (MAD)',
  minimumFare: 'Minimum (MAD)',
  price: 'Prix de l’abonnement (MAD)',
  durationDays: 'Durée (jours)',
  includedTrips: 'Trajets inclus',
  features: 'Avantages (séparés par une virgule)',
  category: 'Catégorie (ride / payment / safety / account / wallet / other)',
  evidenceRequired: 'Preuve obligatoire',
  kind: 'Canal (card / mobile / agency)',
};
const moneyFields = new Set([
  'baseFare',
  'perKm',
  'perMinute',
  'minimumFare',
  'price',
]);
export function PrototypePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'prototype'],
    queryFn: api.adminPrototype.get,
    refetchInterval: 5000,
  });
  const [tab, setTab] = useState<
    Kind | 'families' | 'alerts' | 'wallets' | 'brand'
  >('categories');
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
      <nav aria-label="Services" className="my-5 flex flex-wrap gap-2">
        {(
          [
            ...Object.keys(LABELS),
            'families',
            'alerts',
            'wallets',
            'brand',
          ] as const
        ).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'primary' : 'secondary'}
            onClick={() => setTab(t as typeof tab)}
          >
            {LABELS[t as Kind] ??
              (
                {
                  families: 'Familles',
                  alerts: 'SOS',
                  wallets: 'Portefeuilles',
                  brand: '6 pistes de logo',
                } as Record<string, string>
              )[t]}
          </Button>
        ))}
      </nav>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {p && tab in LABELS ? (
        <>
          <div className="mb-4">
            <Button
              onClick={() => {
                const kind = tab as Kind;
                const template = defaultPrototypeCatalog()[kind][0]!;
                setEditing({
                  kind,
                  row: {
                    ...template,
                    id: '',
                    ...('name' in template ? { name: '' } : {}),
                    ...('label' in template ? { label: '' } : {}),
                  },
                });
              }}
            >
              Ajouter
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {p.catalog[tab as Kind].map((row) => (
              <Card
                key={row.id}
                title={'name' in row ? row.name : row.label}
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing({ kind: tab as Kind, row: { ...row } })
                    }
                  >
                    Modifier
                  </Button>
                }
              >
                <p className="text-muted">
                  {row.enabled ? 'Activé' : 'Désactivé'} · {row.id}
                </p>
                {'description' in row ? (
                  <p className="mt-2">
                    {row.description} · {row.etaMinutes} min ·{' '}
                    {row.commissionBp / 100}% de commission
                  </p>
                ) : null}
                {'price' in row ? (
                  <p className="mt-2">
                    {formatMoney(row.price)} · {row.includedTrips} trajets /{' '}
                    {row.durationDays} jours
                  </p>
                ) : null}
                {'evidenceRequired' in row ? (
                  <p className="mt-2">
                    {row.category} ·{' '}
                    {row.evidenceRequired
                      ? 'Photo ou PDF obligatoire'
                      : 'Preuve facultative'}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
          {tab === 'categories' ? (
            <Card className="mt-5" title="Catégories autorisées par chauffeuse">
              <div className="flex flex-col gap-4">
                {p.people
                  .filter((u) => u.role === 'driver')
                  .map((u) => (
                    <div key={u.id}>
                      <p className="font-semibold">
                        {u.name} · {u.cityId}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {p.catalog.categories.map((c) => (
                          <label key={c.id} className="flex gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={(
                                p.driverCategories[u.id] ??
                                p.catalog.categories.map((x) => x.id)
                              ).includes(c.id)}
                              disabled={busy}
                              onChange={(e) => {
                                const current =
                                  p.driverCategories[u.id] ??
                                  p.catalog.categories.map((x) => x.id);
                                run(() =>
                                  api.adminPrototype.categories(
                                    u.id,
                                    e.target.checked
                                      ? [...current, c.id]
                                      : current.filter((x) => x !== c.id),
                                  ),
                                );
                              }}
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
      {p && tab === 'alerts' ? (
        <div className="flex flex-col gap-4">
          {!p.alerts.length ? (
            <Card>
              Aucune alerte. Testez SOS depuis une course ou un trajet familial.
            </Card>
          ) : null}
          {p.alerts
            .slice()
            .reverse()
            .map((a) => (
              <Card
                key={a.id}
                title={`${a.id} · ${a.userName}`}
                subtitle={`${formatShort(a.createdAt)} · ${{ new: 'Nouvelle', responding: 'Prise en charge', resolved: 'Résolue' }[a.status]}`}
              >
                <p>
                  Course {a.rideId ?? a.familyTripId} · contact :{' '}
                  {a.contactName}
                </p>
                <p className="my-2 text-sm tabular">
                  Position : {a.location.lat}, {a.location.lng}
                </p>
                <div className="my-3 flex gap-2">
                  <Button
                    loading={busy}
                    onClick={() =>
                      run(() =>
                        api.adminPrototype.alert(
                          a.id,
                          'responding',
                          'Prise en charge par le support de démonstration',
                        ),
                      )
                    }
                  >
                    Prendre en charge
                  </Button>
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() =>
                      run(() =>
                        api.adminPrototype.alert(
                          a.id,
                          'resolved',
                          'Alerte de démonstration résolue',
                        ),
                      )
                    }
                  >
                    Résoudre
                  </Button>
                </div>
                {a.actions.map((x, i) => (
                  <p key={i} className="text-sm text-muted">
                    {formatShort(x.at)} · {x.by} · {x.label}
                  </p>
                ))}
              </Card>
            ))}
        </div>
      ) : null}
      {p && tab === 'families' ? (
        <div className="flex flex-col gap-4">
          {!p.subscriptions.length ? (
            <Card>Chargez l’exemple famille depuis l’une des apps.</Card>
          ) : null}
          {p.subscriptions.map((s) => (
            <Card
              key={s.id}
              title={`${p.people.find((u) => u.id === s.passengerId)?.name} · ${s.planName}`}
              subtitle={`${s.includedTrips} trajets · ${formatShort(s.endsAt)}`}
            >
              <label className="label">
                Chauffeuse dédiée
                <select
                  className="field mt-2"
                  value={s.driverId}
                  disabled={busy}
                  onChange={(e) =>
                    run(() => api.adminPrototype.assign(s.id, e.target.value))
                  }
                >
                  {p.people
                    .filter(
                      (u) =>
                        u.role === 'driver' &&
                        u.cityId ===
                          p.people.find((x) => x.id === s.passengerId)?.cityId,
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="mt-4 flex flex-col gap-3">
                {p.trips
                  .filter((t) => t.passengerId === s.passengerId)
                  .map((t) => (
                    <div key={t.id} className="rounded-2xl bg-background p-4">
                      <p className="font-semibold">
                        {t.childName} · {FAMILY_STATUS_LABELS[t.status]}
                      </p>
                      <p className="text-sm">
                        {t.pickup.label} → {t.destination.label} ·{' '}
                        {formatShort(t.pickupAt)}
                      </p>
                      {t.timeline.map((e, i) => (
                        <p key={i} className="mt-1 text-xs text-muted">
                          {formatShort(e.at)} · {e.label} ·{' '}
                          {e.location.lat.toFixed(4)},{' '}
                          {e.location.lng.toFixed(4)}
                        </p>
                      ))}
                      {t.arrivalProof === 'demo-arrival-photo' ? (
                        <p className="mt-2 text-sm text-accent">
                          Photo d’arrivée simulée
                        </p>
                      ) : t.arrivalProof ? (
                        <div className="mt-2 max-w-xs">
                          <DocThumb
                            uploadId={t.arrivalProof}
                            label="Photo d’arrivée"
                            onOpen={() => setView(t.arrivalProof!)}
                          />
                        </div>
                      ) : null}
                      {t.incident ? (
                        <p className="mt-2 text-danger">{t.incident}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {p && tab === 'wallets' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {p.wallets.map((w) => (
            <Card
              key={w.userId}
              title={p.people.find((u) => u.id === w.userId)?.name ?? w.userId}
              subtitle={`${formatMoney(w.balance)} · ${formatMoney(w.reserved)} réservés`}
            >
              <ul>
                {w.entries
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li key={i} className="border-t border-line py-3 text-sm">
                      {e.label} · {formatMoney(e.amount)} · {{ pending: 'En attente', confirmed: 'Confirmée', failed: 'Refusée' }[e.status]}
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
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
        <CatalogEditor
          kind={editing.kind}
          initial={editing.row}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(row) =>
            run(async () => {
              await api.adminPrototype.save(editing.kind, row);
              setEditing(null);
            })
          }
        />
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
function CatalogEditor({
  kind,
  initial,
  busy,
  onSave,
  onClose,
}: {
  kind: Kind;
  initial: Record<string, unknown>;
  busy: boolean;
  onSave: (row: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [row, setRow] = useState(initial);
  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={`Configurer · ${LABELS[kind]}`}
      description="Les montants sont en MAD. Vide sur un tarif = tarif de la ville."
      footer={
        <Button loading={busy} onClick={() => onSave(row)}>
          Enregistrer
        </Button>
      }
    >
      <div className="grid gap-4">
        {Object.entries(initial).map(([name, value]) => (
          <Field key={name} label={fields[name] ?? name}>
            {(id) =>
              typeof value === 'boolean' ? (
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(row[name])}
                  onChange={(e) => setRow({ ...row, [name]: e.target.checked })}
                />
              ) : (
                <Input
                  id={id}
                  value={
                    Array.isArray(row[name])
                      ? (row[name] as string[]).join(', ')
                      : row[name] === null
                        ? ''
                        : String(
                            typeof row[name] === 'number' &&
                              (moneyFields.has(name) || name === 'commissionBp')
                              ? Number(row[name]) / 100
                              : (row[name] ?? ''),
                          )
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setRow({
                      ...row,
                      [name]: Array.isArray(value)
                        ? val
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean)
                        : typeof value === 'number' || value === null
                          ? val === '' && value === null
                            ? null
                            : moneyFields.has(name) || name === 'commissionBp'
                              ? Math.round(Number(val) * 100)
                              : Number(val)
                          : val,
                    });
                  }}
                />
              )
            }
          </Field>
        ))}
      </div>
    </Dialog>
  );
}
