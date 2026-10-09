import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultPrototypeCatalog,
  FAMILY_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
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
  Textarea,
  toast,
} from '../components/ui';
import { DocThumb, DocViewer } from '../components/DocViewer';
import { logoConcepts, conceptSvg } from '@naya/assets/src/concepts';

type Kind = 'categories' | 'plans' | 'reasons';
const LABELS: Record<Kind, string> = {
  categories: 'Catégories',
  plans: 'Abonnements',
  reasons: 'Motifs de litige',
};
const fields: Record<string, string> = {
  id: 'Identifiant',
  name: 'Nom',
  description: 'Description',
  label: 'Libellé',
  icon: 'Visuel',
  enabled: 'Activé',
  cityIds: 'Disponibilité par ville (aucune cochée = toutes les villes)',
  etaMinutes: 'Arrivée estimée (minutes)',
  commissionBp: 'Commission (%)',
  baseFare: 'Prise en charge (MAD)',
  perKm: 'Prix / km (MAD)',
  perMinute: 'Prix / min (MAD)',
  minimumFare: 'Tarif minimum (MAD)',
  conditions: 'Conditions spécifiques (une par ligne, affichées à la cliente)',
  price: 'Prix de l’abonnement (MAD)',
  durationDays: 'Durée (jours)',
  includedTrips: 'Trajets inclus',
  features: 'Avantages (séparés par une virgule)',
  category: 'Catégorie (ride / payment / safety / account / wallet / other)',
  evidenceRequired: 'Preuve obligatoire',
  dedicatedDriver: 'Chauffeuse dédiée (sinon pool de chauffeuses)',
  roles: 'Visible pour (passenger, driver · vide = toutes)',
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
      <nav aria-label="Services" className="my-5 flex flex-wrap gap-2">
        {(
          [
            ...Object.keys(LABELS),
            'families',
            'drivers',
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
                  drivers: 'Chauffeuses dédiées',
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy}
                      data-testid={`toggle-${row.id}`}
                      onClick={() =>
                        run(() =>
                          api.adminPrototype.save(tab as Kind, {
                            ...row,
                            enabled: !row.enabled,
                          }),
                        )
                      }
                    >
                      {row.enabled ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setEditing({ kind: tab as Kind, row: { ...row } })
                      }
                    >
                      Modifier
                    </Button>
                  </div>
                }
              >
                <p className="text-muted">
                  {row.enabled ? 'Activé' : 'Désactivé'} · {row.id}
                </p>
                {'description' in row ? (
                  <>
                    <p className="mt-2">
                      {row.description} · {row.etaMinutes} min ·{' '}
                      {row.commissionBp / 100}% de commission
                    </p>
                    <p className="mt-1 text-sm tabular">
                      {row.baseFare === null &&
                      row.perKm === null &&
                      row.perMinute === null &&
                      row.minimumFare === null
                        ? 'Tarifs de la ville'
                        : [
                            ['Prise en charge', row.baseFare],
                            ['km', row.perKm],
                            ['min', row.perMinute],
                            ['minimum', row.minimumFare],
                          ]
                            .map(
                              ([l, v]) =>
                                `${l} ${v === null ? 'ville' : formatMoney(v as number)}`,
                            )
                            .join(' · ')}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {row.cityIds.length
                        ? `Villes : ${row.cityIds.join(', ')}`
                        : 'Toutes les villes'}
                      {row.conditions?.length
                        ? ` · ${row.conditions.join(' · ')}`
                        : ''}
                    </p>
                  </>
                ) : null}
                {'price' in row ? (
                  <>
                    <p className="mt-2">
                      {formatMoney(row.price)} · {row.includedTrips} trajets /{' '}
                      {row.durationDays} jours ·{' '}
                      {row.dedicatedDriver !== false
                        ? 'chauffeuse dédiée'
                        : 'pool de chauffeuses'}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {row.features.join(' · ')} ·{' '}
                      {p.subscriptions.filter((x) => x.planId === row.id && x.status === 'active').length}{' '}
                      abonnement(s) actif(s)
                    </p>
                  </>
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
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['', 'Toutes'],
                ['new', 'Nouvelles'],
                ['responding', 'Prises en charge'],
                ['resolved', 'Résolues'],
              ] as const
            ).map(([v, l]) => (
              <Button key={v} size="sm" variant={alertFilter === v ? 'primary' : 'secondary'} onClick={() => setAlertFilter(v)}>
                {l} ({p.alerts.filter((a) => !v || a.status === v).length})
              </Button>
            ))}
          </div>
          {p.alerts
            .filter((a) => !alertFilter || a.status === alertFilter)
            .slice()
            .reverse()
            .map((a) => (
              <Card
                key={a.id}
                title={`${a.id} · ${a.userName}`}
                subtitle={`${formatShort(a.createdAt)} · ${{ new: 'Nouvelle', responding: 'Prise en charge', resolved: 'Résolue' }[a.status]}`}
              >
                <p>
                  {a.rideId ? `Course ${a.rideId}` : `Trajet famille ${a.familyTripId}`}{' '}
                  · déclenchée par {a.role === 'driver' ? 'la chauffeuse' : 'la cliente'}
                </p>
                <p className="text-sm">
                  Cliente : {a.passengerName ?? '—'} · Chauffeuse :{' '}
                  {a.driverName ?? 'non attribuée'}
                  {a.vehiclePlate ? ` · ${a.vehiclePlate}` : ''}
                </p>
                <p className="text-sm">
                  Contact de confiance : {a.contactName}
                  {a.contactPhone ? ` · ${a.contactPhone}` : ''}
                  {a.ticketId ? ` · demande support ${a.ticketId}` : ''}
                </p>
                {a.note ? <p className="mt-1 text-sm text-danger">« {a.note} »</p> : null}
                <p className="my-2 text-sm tabular">
                  Position au déclenchement : {a.location.lat.toFixed(5)},{' '}
                  {a.location.lng.toFixed(5)} ·{' '}
                  <a
                    className="font-semibold text-accent"
                    href={`https://maps.google.com/?q=${a.location.lat},${a.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir sur la carte
                  </a>
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
              subtitle={`${SUBSCRIPTION_STATUS_LABELS[s.status]} · ${formatMoney(s.price)} · ${p.trips.filter((t) => t.passengerId === s.passengerId && t.pickupAt >= s.startsAt && t.pickupAt < s.endsAt).length} / ${s.includedTrips} trajets · jusqu’au ${formatShort(s.endsAt)}`}
              action={
                s.status === 'cancelled' ? null : (
                  <div className="flex gap-2">
                    {s.status === 'active' ? (
                      <Button size="sm" variant="secondary" onClick={() => (setSubChange({ id: s.id, status: 'paused' }), setSubReason(''))}>Suspendre</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => (setSubChange({ id: s.id, status: 'active' }), setSubReason(''))}>Réactiver</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => (setSubChange({ id: s.id, status: 'cancelled' }), setSubReason(''))}>Résilier</Button>
                  </div>
                )
              }
            >
              {s.statusHistory?.length ? (
                <p className="mb-3 text-xs text-muted">
                  {s.statusHistory.map((h) => `${formatShort(h.at)} · ${SUBSCRIPTION_STATUS_LABELS[h.status]} · ${h.by} · ${h.reason}`).join(' — ')}
                </p>
              ) : null}
              <div className="mb-4 flex flex-col gap-3">
                <p className="font-semibold">Enfants et informations de sécurité</p>
                {p.children
                  .filter((c) => c.passengerId === s.passengerId)
                  .map((c) => (
                    <div key={c.id} className="flex gap-3 rounded-2xl bg-background p-3 text-sm">
                      {c.photo ? (
                        <div className="w-24 shrink-0">
                          <DocThumb uploadId={c.photo} label={`Photo de ${c.firstName}`} onOpen={() => setView(c.photo!)} />
                        </div>
                      ) : null}
                      <div>
                        <p className="font-semibold">{c.firstName} · {c.age} ans · {c.school}</p>
                        {c.notes ? <p className="text-danger">{c.notes}</p> : null}
                        <p className="text-muted">
                          Personnes autorisées :{' '}
                          {c.recipients.map((r) => `${r.name} (${r.relationship}${r.phone ? ` · ${r.phone}` : ''})`).join(', ')}
                        </p>
                        <p className="text-xs text-muted">Codes de remise masqués · vérifiés uniquement par le serveur.</p>
                      </div>
                    </div>
                  ))}
              </div>
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
                      {t.vehicle ? (
                        <p className="text-sm">
                          {t.driverName} · {t.vehicle.make} {t.vehicle.model}{' '}
                          · {t.vehicle.color} · {t.vehicle.plate}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs tabular">
                        {(
                          [
                            ['en_route', 'Départ'],
                            ['arrived', 'Arrivée au point'],
                            ['picked_up', 'Récupération'],
                            ['completed', 'Arrivée et remise'],
                          ] as const
                        )
                          .filter(([k]) => t.times?.[k])
                          .map(([k, l]) => `${l} ${formatShort(t.times![k]!)}`)
                          .join(' · ') || 'Pas encore démarré'}
                        {t.pickupVerified ? ' · enfant vérifié' : ''}
                        {t.recipientId ? ' · remise confirmée par code' : ''}
                      </p>
                      {(t.incidents ?? []).map((x, i) => (
                        <p key={i} className="mt-1 text-xs text-danger">
                          {formatShort(x.at)} ·{' '}
                          {x.source === 'auto' ? 'Alerte automatique' : x.by}{' '}
                          · {x.message}
                        </p>
                      ))}
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
                      {t.incident && !t.incidents?.length ? (
                        <p className="mt-2 text-danger">{t.incident}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {p && tab === 'drivers' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {p.dedicatedDrivers.map((d) => (
            <Card
              key={d.id}
              title={d.name}
              subtitle={`${d.cityId} · ${d.online ? 'en ligne' : 'hors ligne'} · ${d.verified ? 'dossier vérifié' : 'dossier non vérifié'}`}
              action={
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={d.available}
                    disabled={busy}
                    data-testid={`family-available-${d.id}`}
                    onChange={(e) => run(() => api.adminPrototype.familyAvailability(d.id, e.target.checked))}
                  />
                  Disponible pour de nouvelles familles
                </label>
              }
            >
              <p className="text-sm">
                {d.phone}
                {d.vehicle ? ` · ${d.vehicle}` : ''}
                {d.rating ? ` · note ${String(d.rating).replace('.', ',')}` : ''}
              </p>
              <p className="mt-2 text-sm">
                Familles :{' '}
                {d.families.length
                  ? d.families.map((f) => `${f.passengerName} (${SUBSCRIPTION_STATUS_LABELS[f.status].toLowerCase()})`).join(', ')
                  : 'aucune'}
              </p>
              <p className="mt-1 text-sm tabular">
                Trajets : {d.trips.completed} terminés · {d.trips.upcoming} à venir · {d.trips.total} au total
                {d.trips.lastAt ? ` · dernier ${formatShort(d.trips.lastAt)}` : ''}
              </p>
              <p className={`mt-1 text-sm ${d.incidents || d.sos ? 'text-danger' : 'text-muted'}`}>
                {d.incidents} incident(s) · {d.sos} alerte(s) SOS
              </p>
            </Card>
          ))}
        </div>
      ) : null}
      {subChange ? (
        <Dialog
          open
          onClose={() => setSubChange(null)}
          busy={busy}
          title={{ active: 'Réactiver l’abonnement ?', paused: 'Suspendre l’abonnement ?', cancelled: 'Résilier l’abonnement ?' }[subChange.status]}
          description={subChange.status === 'cancelled' ? 'La résiliation est définitive : aucun nouveau trajet ne pourra être planifié.' : subChange.status === 'paused' ? 'Aucun nouveau trajet ne pourra être planifié tant que l’abonnement est suspendu.' : 'La famille pourra de nouveau planifier des trajets.'}
          footer={
            <Button
              loading={busy}
              disabled={subReason.trim().length < 5}
              onClick={() =>
                run(async () => {
                  await api.adminPrototype.subscriptionStatus(subChange.id, subChange.status, subReason.trim());
                  setSubChange(null);
                })
              }
            >
              Confirmer
            </Button>
          }
        >
          <Field label="Motif (inscrit au journal)">
            {(id) => <Input id={id} value={subReason} onChange={(e) => setSubReason(e.target.value)} />}
          </Field>
        </Dialog>
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
  const isNew = initial.id === '';
  const cities = useQuery({
    queryKey: ['admin', 'cities'],
    queryFn: api.admin.cities,
    enabled: kind === 'categories',
  });
  const special = (name: string, id: string) => {
    if (kind !== 'categories') return null;
    if (name === 'id' && !isNew)
      return <Input id={id} value={String(row.id)} disabled readOnly />;
    if (name === 'icon')
      return (
        <select
          id={id}
          className="field"
          value={String(row.icon)}
          onChange={(e) => setRow({ ...row, icon: e.target.value })}
        >
          <option value="scooter">Scooter</option>
          <option value="car">Voiture</option>
          <option value="premium">Confort / Premium</option>
        </select>
      );
    if (name === 'conditions')
      return (
        <Textarea
          id={id}
          value={((row.conditions as string[]) ?? []).join('\n')}
          onChange={(e) =>
            setRow({
              ...row,
              conditions: e.target.value.split('\n').map((x) => x.trimStart()),
            })
          }
        />
      );
    if (name === 'cityIds') {
      const selected = (row.cityIds as string[]) ?? [];
      return (
        <div id={id} className="flex flex-wrap gap-3">
          {(cities.data ?? []).map(({ city }) => (
            <label key={city.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(city.id)}
                onChange={(e) =>
                  setRow({
                    ...row,
                    cityIds: e.target.checked
                      ? [...selected, city.id]
                      : selected.filter((x) => x !== city.id),
                  })
                }
              />
              {city.name}
            </label>
          ))}
        </div>
      );
    }
    return null;
  };
  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={`Configurer · ${LABELS[kind]}`}
      description="Les montants sont en MAD. Vide sur un tarif = tarif de la ville."
      footer={
        <Button
          loading={busy}
          onClick={() =>
            onSave(
              Array.isArray(row.conditions)
                ? {
                    ...row,
                    conditions: (row.conditions as string[])
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }
                : row,
            )
          }
        >
          Enregistrer
        </Button>
      }
    >
      <div className="grid gap-4">
        {Object.entries(initial).map(([name, value]) => (
          <Field key={name} label={fields[name] ?? name}>
            {(id) =>
              special(name, id) ??
              (typeof value === 'boolean' ? (
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
              ))
            }
          </Field>
        ))}
      </div>
    </Dialog>
  );
}
