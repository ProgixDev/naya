import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultPrototypeCatalog,
  FAMILY_STATUS_LABELS,
  formatMoney,
  formatShort,
  type PrototypeCatalog,
  FAMILLE_ELIGIBILITY_LABELS,
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
  Select,
  toast,
} from '../components/ui';
import { fromCentimes, toCentimes } from '../lib/format';
import { DocThumb, DocViewer } from '../components/DocViewer';
import { logoConcepts, conceptSvg } from '@naya/assets/src/concepts';

type Kind = 'categories' | 'plans' | 'reasons' | 'payments';
const LABELS: Record<Kind, string> = {
  categories: 'Catégories',
  plans: 'Abonnements',
  reasons: 'Motifs de litige',
  payments: 'Moyens de paiement',
};
const fields: Record<string, string> = {
  id: 'Identifiant',
  name: 'Nom',
  description: 'Description',
  label: 'Libellé',
  icon: 'Icône',
  enabled: 'Activé',
  cityIds: 'Villes (identifiants, ex. rabat, casablanca)',
  etaMinutes: 'Arrivée estimée (minutes)',
  commissionBp: 'Commission (%)',
  baseFare: 'Prise en charge (MAD)',
  perKm: 'Prix / km (MAD)',
  perMinute: 'Prix / min (MAD)',
  minimumFare: 'Minimum (MAD)',
  price: 'Prix de l’abonnement (MAD)',
  durationDays: 'Durée (jours)',
  includedTrips: 'Trajets inclus',
  features: 'Avantages',
  category: 'Catégorie',
  evidenceRequired: 'Preuve obligatoire',
  kind: 'Canal',
};
const moneyFields = new Set([
  'baseFare',
  'perKm',
  'perMinute',
  'minimumFare',
  'price',
]);
/** Category fares only: empty means the city fare applies (null on the server). */
const nullableFares = new Set(['baseFare', 'perKm', 'perMinute', 'minimumFare']);
const intRanges: Record<string, [number, number]> = {
  etaMinutes: [1, 60],
  durationDays: [1, 365],
  includedTrips: [1, 500],
};
const enums: Record<string, Record<string, string>> = {
  icon: { car: 'Voiture', scooter: 'Scooter', premium: 'Confort' },
  category: {
    ride: 'Course',
    payment: 'Paiement',
    safety: 'Sécurité',
    account: 'Compte',
    wallet: 'Portefeuille',
    other: 'Autre',
  },
  kind: { card: 'Carte', mobile: 'Paiement mobile', agency: 'Agence' },
};
const listHints: Record<string, string> = {
  cityIds: 'Séparés par une virgule. Vide = toutes les villes.',
  features: 'Séparés par une virgule.',
};
const MAX_CENTIMES = 10_000_000;
type Draft = Record<string, string | boolean>;

/** Every field is edited as text (MAD amounts, commission in %, comma-separated lists) and parsed only on save. */
const toDraft = (row: Record<string, unknown>): Draft =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === 'boolean'
        ? v
        : Array.isArray(v)
          ? v.join(', ')
          : v === null || v === undefined
            ? ''
            : typeof v === 'number' && moneyFields.has(k)
              ? fromCentimes(v)
              : typeof v === 'number' && k === 'commissionBp'
                ? String(v / 100).replace('.', ',')
                : String(v),
    ]),
  );

function fromDraft(
  kind: Kind,
  initial: Record<string, unknown>,
  draft: Draft,
  isNew: boolean,
  takenIds: string[],
): { row: Record<string, unknown> | null; errors: Record<string, string> } {
  const row: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [k, before] of Object.entries(initial)) {
    const v = draft[k];
    if (typeof v === 'boolean') {
      row[k] = v;
      continue;
    }
    const s = (v ?? '').trim();
    if (k === 'id') {
      if (!isNew) row.id = before;
      else if (!/^[a-z0-9][a-z0-9_-]*$/.test(s))
        errors.id = 'Lettres minuscules, chiffres, - ou _ (ex. naya-xl).';
      else if (takenIds.includes(s)) errors.id = 'Cet identifiant existe déjà.';
      else row.id = s;
    } else if (Array.isArray(before)) {
      const list = s.split(',').map((x) => x.trim()).filter(Boolean);
      if (k === 'features' && !list.length) errors[k] = 'Ajoutez au moins un avantage.';
      row[k] = list;
    } else if (moneyFields.has(k)) {
      const c = toCentimes(s);
      if (!s && kind === 'categories' && nullableFares.has(k)) row[k] = null;
      else if (!s) errors[k] = 'Montant requis.';
      else if (c === null || c < 0) errors[k] = 'Montant invalide, ex. 2,50 ou 2.5.';
      else if (c > MAX_CENTIMES) errors[k] = 'Montant trop élevé.';
      else if (k === 'minimumFare' && c === 0)
        errors[k] = 'Le minimum doit dépasser 0. Laissez vide pour le tarif de la ville.';
      else row[k] = c;
    } else if (k === 'commissionBp') {
      const pct = Number(s.replace(',', '.'));
      if (!/^\d+([.,]\d{1,2})?$/.test(s) || pct > 50) errors[k] = 'Entre 0 et 50 %.';
      else row[k] = Math.round(pct * 100);
    } else if (intRanges[k]) {
      const [min, max] = intRanges[k];
      const n = Number(s);
      if (!/^\d+$/.test(s) || n < min || n > max) errors[k] = `Nombre entier entre ${min} et ${max}.`;
      else row[k] = n;
    } else if (enums[k]) {
      if (!Object.hasOwn(enums[k], s)) errors[k] = 'Choisissez une valeur.';
      else row[k] = s;
    } else if (!s) errors[k] = 'Champ requis.';
    else if (s.length > 300) errors[k] = '300 caractères maximum.';
    else row[k] = s;
  }
  return { row: Object.keys(errors).length ? null : row, errors };
}
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
    isNew: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string>();
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ['admin'] });
      toast('Modifications enregistrées', 'success');
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
        subtitle="Catalogues et opérations des services · les applications lisent ces catalogues."
      />
      <Banner tone="info" title="Journal d’audit">
        Les alertes, décisions et changements de catalogue sont conservés dans
        le journal.
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
                  isNew: true,
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
                    data-testid={`catalog-edit-${row.id}`}
                    onClick={() =>
                      setEditing({
                        kind: tab as Kind,
                        row: { ...row },
                        isNew: false,
                      })
                    }
                  >
                    Modifier
                  </Button>
                }
              >
                <p className="text-muted">
                  {row.enabled ? 'Activé' : 'Désactivé'}
                  {tab === 'payments' ? null : ` · ${row.id}`}
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
              Aucune alerte. Les alertes SOS envoyées pendant une course ou un
              trajet familial apparaissent ici.
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
                {a.status !== 'resolved' ? (
                  <div className="my-3 flex gap-2">
                    {a.status === 'new' ? (
                      <Button
                        loading={busy}
                        onClick={() =>
                          run(() =>
                            api.adminPrototype.alert(
                              a.id,
                              'responding',
                              'Prise en charge par le support',
                            ),
                          )
                        }
                      >
                        Prendre en charge
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() =>
                        run(() =>
                          api.adminPrototype.alert(
                            a.id,
                            'resolved',
                            'Alerte résolue par le support',
                          ),
                        )
                      }
                    >
                      Résoudre
                    </Button>
                  </div>
                ) : null}
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
            <Card>Aucun abonnement Naya Famille pour l’instant.</Card>
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
                      <option key={u.id} value={u.id} disabled={u.familleEligibility !== 'approved'}>
                        {u.name} · Famille {FAMILLE_ELIGIBILITY_LABELS[u.familleEligibility ?? 'not_requested'].toLowerCase()}
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
                      {(t.approvals ?? []).map((a) => (
                        <p key={a.id} className="mt-1 text-xs">
                          Demande de départ {formatShort(a.requestedAt)} ·{' '}
                          {a.status === 'approved'
                            ? `approuvée ${a.mode === 'on_site' ? 'sur place' : 'à distance'}`
                            : a.status === 'refused'
                              ? `refusée${a.reason ? ` (${a.reason})` : ''}`
                              : a.status === 'expired'
                                ? 'expirée sans réponse'
                                : 'en attente'}
                        </p>
                      ))}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {([
                          ['Photo de prise en charge', t.pickupPhoto],
                          ['Photo à l’école', t.dropoffPhoto],
                        ] as const).map(([label, proof]) =>
                          proof ? (
                            proof.simulated ? (
                              <p key={label} className="text-sm text-accent">
                                {label} reçue
                              </p>
                            ) : (
                              <div key={label} className="max-w-xs">
                                <DocThumb
                                  uploadId={proof.uploadId}
                                  label={label}
                                  onOpen={() => setView(proof.uploadId)}
                                />
                              </div>
                            )
                          ) : null,
                        )}
                      </div>
                      {t.arrivalProof === 'demo-arrival-photo' ? (
                        <p className="mt-2 text-sm text-accent">
                          Photo d’arrivée reçue
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
          isNew={editing.isNew}
          takenIds={(p?.catalog[editing.kind] ?? []).map((r) => r.id)}
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
  isNew,
  takenIds,
  busy,
  onSave,
  onClose,
}: {
  kind: Kind;
  initial: Record<string, unknown>;
  isNew: boolean;
  takenIds: string[];
  busy: boolean;
  onSave: (row: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (name: string, value: string | boolean) => {
    setDraft((d) => ({ ...d, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: '' } : e));
  };
  const save = () => {
    const r = fromDraft(kind, initial, draft, isNew, takenIds);
    setErrors(r.errors);
    if (r.row) void onSave(r.row);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      testId="catalog-dialog"
      title={`${isNew ? 'Ajouter' : 'Configurer'} · ${LABELS[kind]}`}
      description={
        kind === 'categories'
          ? 'Les montants sont en MAD, ex. 2,50. Vide sur un tarif = tarif de la ville.'
          : kind === 'plans'
            ? 'Le prix est en MAD, ex. 590 ou 590,50.'
            : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button loading={busy} onClick={save} data-testid="catalog-save">
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {Object.entries(initial).map(([name, value]) => {
          const nullable = kind === 'categories' && nullableFares.has(name);
          const locked = name === 'id' && !isNew;
          const hint = locked
            ? 'L’identifiant ne peut pas être modifié.'
            : nullable
              ? 'Vide = tarif de la ville.'
              : listHints[name];
          const options = enums[name];
          return (
            <Field
              key={name}
              label={fields[name] ?? name}
              error={errors[name] || null}
              hint={hint}
            >
              {(id, describedBy) =>
                typeof value === 'boolean' ? (
                  <input
                    id={id}
                    type="checkbox"
                    checked={draft[name] === true}
                    onChange={(e) => set(name, e.target.checked)}
                    data-testid={`catalog-${name}`}
                  />
                ) : options ? (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    value={String(draft[name])}
                    onChange={(e) => set(name, e.target.value)}
                    data-testid={`catalog-${name}`}
                  >
                    {Object.entries(options).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={errors[name] ? true : undefined}
                    readOnly={locked}
                    className={locked ? 'bg-background text-muted' : undefined}
                    inputMode={
                      moneyFields.has(name) || name === 'commissionBp'
                        ? 'decimal'
                        : name in intRanges
                          ? 'numeric'
                          : undefined
                    }
                    placeholder={nullable ? 'Tarif de la ville' : undefined}
                    value={String(draft[name])}
                    onChange={(e) => set(name, e.target.value)}
                    data-testid={`catalog-${name}`}
                  />
                )
              }
            </Field>
          );
        })}
      </div>
    </Dialog>
  );
}
