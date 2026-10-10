import type { ReactNode } from 'react';
import { AlertTriangle, CalendarHeart, Car, Check, CircleAlert, ExternalLink, MapPin, MessageSquareWarning, Phone, ShieldAlert, Star, Users, Wallet } from 'lucide-react';
import {
  FAMILY_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  formatMoney,
  formatShort,
  type DedicatedDriverSummary,
  type DisputeReason,
  type FamilyChild,
  type FamilyPlan,
  type FamilySubscription,
  type FamilyTrip,
  type PassengerWallet,
  type SafetyAlert,
} from '@naya/domain';
import { Badge, Button, Select, cx } from './ui';
import { DocThumb } from './DocViewer';
import { Switch } from './form';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

/* ───────── Shared pieces ───────── */

function Shell({ children, muted, testId }: { children: ReactNode; muted?: boolean; testId?: string }) {
  return (
    <article
      data-testid={testId}
      className={cx('flex flex-col rounded-3xl border bg-surface p-5 shadow-card', muted ? 'border-dashed border-line opacity-75' : 'border-line')}
    >
      {children}
    </article>
  );
}

function IconTile({ children, tone = 'accent' }: { children: ReactNode; tone?: Tone }) {
  const bg = { accent: 'bg-selected text-accent', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', info: 'bg-info-soft text-info', neutral: 'bg-line text-muted' }[tone];
  return <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [&>svg]:h-6 [&>svg]:w-6', bg)} aria-hidden>{children}</span>;
}

function Initials({ name }: { name: string }) {
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-white" aria-hidden>{name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>;
}

/** Small figure box: label above, value below. */
function Figure({ label, value, tone }: { label: string; value: ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div className={cx('rounded-2xl px-3 py-2.5', tone === 'danger' ? 'bg-danger-soft' : tone === 'warning' ? 'bg-warning-soft' : 'bg-background')}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={cx('text-[15px] font-semibold tabular', tone === 'danger' && 'text-danger')}>{value}</div>
    </div>
  );
}

function Callout({ tone, icon, children }: { tone: 'danger' | 'warning' | 'info'; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx('flex gap-2 rounded-2xl px-3 py-2.5 text-[14px]', tone === 'danger' ? 'bg-danger-soft text-danger' : tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info')}>
      {icon ? <span className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      <div className="min-w-0 text-ink">{children}</div>
    </div>
  );
}

const SUB_TONE: Record<FamilySubscription['status'], Tone> = { active: 'success', paused: 'warning', cancelled: 'neutral' };

/* ───────── Abonnements ───────── */

export function PlanCard({ plan, activeCount, busy, onToggle, onEdit }: { plan: FamilyPlan; activeCount: number; busy: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <Shell muted={!plan.enabled} testId={`plan-card-${plan.id}`}>
      <header className="flex items-start gap-3">
        <IconTile tone={plan.enabled ? 'accent' : 'neutral'}><CalendarHeart /></IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">{plan.name}</h3>
            <Badge tone={plan.enabled ? 'success' : 'neutral'}>{plan.enabled ? 'Proposé' : 'Désactivé'}</Badge>
          </div>
          <p className="mt-0.5 text-[14px] text-muted">{plan.dedicatedDriver !== false ? 'Chauffeuse dédiée' : 'Pool de chauffeuses'} · {activeCount} famille{activeCount > 1 ? 's' : ''} abonnée{activeCount > 1 ? 's' : ''}</p>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-semibold tabular">{formatMoney(plan.price)}</div>
          <div className="text-[12px] text-muted">pour {plan.durationDays} jours</div>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Figure label="Trajets inclus" value={plan.includedTrips} />
        <Figure label="Durée" value={`${plan.durationDays} j`} />
        <Figure label="Par trajet" value={formatMoney(Math.round(plan.price / Math.max(1, plan.includedTrips)))} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {plan.features.map((f) => (
          <li key={f} className="inline-flex items-center gap-1 rounded-full bg-mauve-soft px-2.5 py-1 text-[12px]"><Check className="h-3 w-3 text-accent" aria-hidden />{f}</li>
        ))}
      </ul>
      <CardFooter id={plan.id} enabled={plan.enabled} busy={busy} onToggle={onToggle} onEdit={onEdit} />
    </Shell>
  );
}

function CardFooter({ id, enabled, busy, onToggle, onEdit }: { id: string; enabled: boolean; busy: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <footer className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 [margin-top:max(1rem,auto)]">
      <span className="min-w-0 truncate font-mono text-[12px] text-muted" title={id}>{id}</span>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" loading={busy} onClick={onToggle} data-testid={`toggle-${id}`}>{enabled ? 'Désactiver' : 'Activer'}</Button>
        <Button size="sm" variant="secondary" onClick={onEdit} data-testid={`edit-${id}`}>Modifier</Button>
      </div>
    </footer>
  );
}

/* ───────── Motifs de litige ───────── */

const REASON_CATEGORY: Record<DisputeReason['category'], string> = { ride: 'Course', payment: 'Paiement', safety: 'Sécurité', wallet: 'Portefeuille', account: 'Compte', other: 'Autre' };

export function ReasonCard({ reason, busy, onToggle, onEdit }: { reason: DisputeReason; busy: boolean; onToggle: () => void; onEdit: () => void }) {
  const audience = !reason.roles?.length || reason.roles.length === 2 ? 'Clientes et chauffeuses' : reason.roles[0] === 'driver' ? 'Chauffeuses' : 'Clientes';
  return (
    <Shell muted={!reason.enabled} testId={`reason-card-${reason.id}`}>
      <header className="flex items-start gap-3">
        <IconTile tone={!reason.enabled ? 'neutral' : reason.category === 'safety' ? 'danger' : 'accent'}>{reason.category === 'safety' ? <ShieldAlert /> : <MessageSquareWarning />}</IconTile>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold leading-snug">{reason.label}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={reason.category === 'safety' ? 'danger' : 'info'} dot={false}>{REASON_CATEGORY[reason.category]}</Badge>
            <Badge tone="neutral" dot={false}>{audience}</Badge>
            {reason.evidenceRequired ? <Badge tone="warning" dot={false}>Photo obligatoire</Badge> : null}
            {!reason.enabled ? <Badge tone="neutral">Désactivé</Badge> : null}
          </div>
        </div>
      </header>
      <CardFooter id={reason.id} enabled={reason.enabled} busy={busy} onToggle={onToggle} onEdit={onEdit} />
    </Shell>
  );
}

/* ───────── Familles ───────── */

const STEPS: { key: keyof NonNullable<FamilyTrip['times']>; label: string }[] = [
  { key: 'en_route', label: 'Départ' },
  { key: 'arrived', label: 'Arrivée au point' },
  { key: 'picked_up', label: 'Récupération' },
  { key: 'in_progress', label: 'Trajet' },
  { key: 'completed', label: 'Remise' },
];
const TRIP_TONE: Record<FamilyTrip['status'], Tone> = { scheduled: 'neutral', en_route: 'info', arrived: 'info', picked_up: 'info', in_progress: 'warning', completed: 'success' };

function TripStepper({ trip }: { trip: FamilyTrip }) {
  return (
    <ol className="mt-3 grid grid-cols-5 gap-1" aria-label="Étapes du trajet">
      {STEPS.map((s, i) => {
        const at = trip.times?.[s.key];
        const next = !at && (i === 0 || trip.times?.[STEPS[i - 1]!.key]);
        return (
          <li key={s.key} className="flex flex-col gap-1">
            <span className={cx('h-1.5 rounded-full', at ? 'bg-accent' : next ? 'bg-accent/30' : 'bg-line')} />
            <span className={cx('text-[12px] font-semibold', at ? 'text-ink' : 'text-muted')}>{s.label}</span>
            <span className="text-[11px] tabular text-muted">{at ? formatShort(at).split(', ').pop() : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TripCard({ trip: t, onView }: { trip: FamilyTrip; onView: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{t.childName}</span>
          <Badge tone={TRIP_TONE[t.status] === 'neutral' ? 'neutral' : TRIP_TONE[t.status] as 'info'}>{FAMILY_STATUS_LABELS[t.status]}</Badge>
        </div>
        <span className="text-[13px] tabular text-muted">{formatShort(t.pickupAt)}</span>
      </div>
      <p className="mt-1 text-[14px]">{t.pickup.label} → {t.destination.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
        <Car className="h-3.5 w-3.5" aria-hidden />
        {t.driverName}{t.vehicle ? ` · ${t.vehicle.make} ${t.vehicle.model} · ${t.vehicle.color} · ${t.vehicle.plate}` : ''}
      </p>
      <TripStepper trip={t} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.pickupVerified ? <Badge tone="success" dot={false}>Enfant vérifié</Badge> : null}
        {t.recipientId ? <Badge tone="success" dot={false}>Remise confirmée par code</Badge> : null}
        {t.arrivalProof === 'demo-arrival-photo' ? <Badge tone="neutral" dot={false}>Photo d’arrivée simulée</Badge> : null}
      </div>
      {t.arrivalProof && t.arrivalProof !== 'demo-arrival-photo' ? (
        <div className="mt-3 max-w-[180px]"><DocThumb uploadId={t.arrivalProof} label="Photo d’arrivée" onOpen={() => onView(t.arrivalProof!)} /></div>
      ) : null}
      {(t.incidents ?? []).length ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {(t.incidents ?? []).map((x, i) => (
            <Callout key={i} tone="danger" icon={<AlertTriangle />}>
              <span className="font-semibold">{x.source === 'auto' ? 'Alerte automatique' : x.by}</span> · {x.message} <span className="text-muted">· {formatShort(x.at)}</span>
            </Callout>
          ))}
        </div>
      ) : t.incident ? <div className="mt-3"><Callout tone="danger" icon={<AlertTriangle />}>{t.incident}</Callout></div> : null}
      <details className="mt-3 text-[13px]">
        <summary className="cursor-pointer font-semibold text-accent">Journal GPS ({t.timeline.length})</summary>
        <ol className="mt-2 flex flex-col gap-1 border-l-2 border-line pl-3">
          {t.timeline.map((e, i) => (
            <li key={i} className="text-muted">
              <span className="tabular">{formatShort(e.at)}</span> · <span className="text-ink">{e.label}</span> · <span className="tabular">{e.location.lat.toFixed(4)}, {e.location.lng.toFixed(4)}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function FamilyCard({ sub, familyName, children, trips, drivers, busy, onAssign, onStatus, onView }: {
  sub: FamilySubscription;
  familyName: string;
  children: FamilyChild[];
  trips: FamilyTrip[];
  drivers: { id: string; name: string }[];
  busy: boolean;
  onAssign: (driverId: string) => void;
  onStatus: (status: FamilySubscription['status']) => void;
  onView: (uploadId: string) => void;
}) {
  const used = trips.filter((t) => t.pickupAt >= sub.startsAt && t.pickupAt < sub.endsAt).length;
  return (
    <Shell muted={sub.status === 'cancelled'} testId={`family-card-${sub.id}`}>
      <header className="flex flex-wrap items-start gap-3">
        <Initials name={familyName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">{familyName}</h3>
            <Badge tone={SUB_TONE[sub.status] as 'success'}>{SUBSCRIPTION_STATUS_LABELS[sub.status]}</Badge>
          </div>
          <p className="mt-0.5 text-[14px] text-muted">{sub.planName} · {formatMoney(sub.price)}</p>
        </div>
        {sub.status !== 'cancelled' ? (
          <div className="flex gap-2">
            {sub.status === 'active' ? <Button size="sm" variant="secondary" onClick={() => onStatus('paused')}>Suspendre</Button> : <Button size="sm" variant="secondary" onClick={() => onStatus('active')}>Réactiver</Button>}
            <Button size="sm" variant="ghost" className="!text-danger" onClick={() => onStatus('cancelled')}>Résilier</Button>
          </div>
        ) : null}
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-background px-3 py-2.5">
          <div className="text-[12px] text-muted">Trajets utilisés</div>
          <div className="text-[15px] font-semibold tabular">{used} / {sub.includedTrips}</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (used / Math.max(1, sub.includedTrips)) * 100)}%` }} /></div>
        </div>
        <Figure label="Début" value={formatShort(sub.startsAt).split(',')[0]} />
        <Figure label="Échéance" value={formatShort(sub.endsAt).split(',')[0]} />
        <div className="rounded-2xl bg-background px-3 py-2">
          <label className="text-[12px] text-muted" htmlFor={`driver-${sub.id}`}>Chauffeuse dédiée</label>
          <Select id={`driver-${sub.id}`} value={sub.driverId} disabled={busy || sub.status === 'cancelled'} onChange={(e) => onAssign(e.target.value)} className="!h-8 !border-0 !bg-transparent !px-0 text-[15px] font-semibold">
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      </div>

      {sub.statusHistory && sub.statusHistory.length > 1 ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer font-semibold text-accent">Historique de l’abonnement ({sub.statusHistory.length})</summary>
          <ol className="mt-2 flex flex-col gap-1 border-l-2 border-line pl-3 text-muted">
            {sub.statusHistory.map((h, i) => <li key={i}><span className="tabular">{formatShort(h.at)}</span> · <span className="font-semibold text-ink">{SUBSCRIPTION_STATUS_LABELS[h.status]}</span> · {h.by} · {h.reason}</li>)}
          </ol>
        </details>
      ) : null}

      <h4 className="mt-5 text-[14px] font-semibold">Enfants et informations de sécurité</h4>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {children.map((c) => (
          <div key={c.id} className="flex gap-3 rounded-2xl border border-line p-3">
            {c.photo ? (
              <div className="w-20 shrink-0"><DocThumb uploadId={c.photo} label={`Photo de ${c.firstName}`} onOpen={() => onView(c.photo!)} /></div>
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-background text-[22px] font-semibold text-muted" aria-hidden>{c.firstName[0]}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{c.firstName} · {c.age} ans</p>
              <p className="flex items-center gap-1 text-[13px] text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden />{c.school}</p>
              {c.notes ? <div className="mt-2"><Callout tone="warning" icon={<CircleAlert />}>{c.notes}</Callout></div> : null}
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {c.recipients.map((r) => (
                  <li key={r.id} className="inline-flex items-center gap-1 rounded-full bg-mauve-soft px-2.5 py-1 text-[12px]">
                    <Users className="h-3 w-3 text-accent" aria-hidden />{r.name} · {r.relationship}{r.phone ? <span className="text-muted"> · {r.phone}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-muted">Codes de remise masqués, vérifiés uniquement par le serveur.</p>
            </div>
          </div>
        ))}
        {!children.length ? <p className="text-[14px] text-muted">Aucun enfant enregistré.</p> : null}
      </div>

      <h4 className="mt-5 text-[14px] font-semibold">Trajets ({trips.length})</h4>
      <div className="mt-2 flex flex-col gap-3">
        {trips.map((t) => <TripCard key={t.id} trip={t} onView={onView} />)}
        {!trips.length ? <p className="text-[14px] text-muted">Aucun trajet planifié.</p> : null}
      </div>
    </Shell>
  );
}

/* ───────── Chauffeuses dédiées ───────── */

export function DedicatedDriverCard({ d, busy, onAvailable }: { d: DedicatedDriverSummary; busy: boolean; onAvailable: (v: boolean) => void }) {
  return (
    <Shell muted={!d.verified} testId={`dedicated-${d.id}`}>
      <header className="flex items-start gap-3">
        <Initials name={d.name} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold">{d.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={d.online ? 'success' : 'neutral'}>{d.online ? 'En ligne' : 'Hors ligne'}</Badge>
            <Badge tone={d.verified ? 'success' : 'warning'} dot={false}>{d.verified ? 'Dossier vérifié' : 'Dossier non vérifié'}</Badge>
            <span className="text-[13px] capitalize text-muted">{d.cityId}</span>
          </div>
        </div>
      </header>
      <label className={cx('mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3', d.available && d.verified ? 'bg-success-soft' : 'bg-background')}>
        <span>
          <span className="block text-[14px] font-semibold">Disponible pour de nouvelles familles</span>
          <span className="block text-[12px] text-muted">{!d.verified ? 'Dossier à valider avant de pouvoir accueillir une famille.' : d.available ? 'Reçoit les nouveaux abonnements de sa ville.' : 'Ne reçoit plus de nouvelles familles.'}</span>
        </span>
        <Switch checked={d.available} disabled={busy} onChange={onAvailable} label={`Disponibilité de ${d.name}`} testId={`family-available-${d.id}`} />
      </label>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" aria-hidden />{d.phone}</span>
        {d.vehicle ? <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" aria-hidden />{d.vehicle}</span> : null}
        {d.rating ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" aria-hidden />{String(d.rating).replace('.', ',')}</span> : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Figure label="Familles" value={d.families.filter((f) => f.status !== 'cancelled').length} />
        <Figure label="Terminés" value={d.trips.completed} />
        <Figure label="À venir" value={d.trips.upcoming} />
        <Figure label="Incidents" value={d.incidents} tone={d.incidents ? 'danger' : undefined} />
        <Figure label="SOS" value={d.sos} tone={d.sos ? 'danger' : undefined} />
      </div>
      {d.families.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {d.families.map((f) => (
            <li key={f.subscriptionId} className="inline-flex items-center gap-1.5 rounded-full bg-mauve-soft px-2.5 py-1 text-[12px]">
              {f.passengerName}<Badge tone={SUB_TONE[f.status] as 'success'} dot={false}>{SUBSCRIPTION_STATUS_LABELS[f.status]}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {d.trips.lastAt ? <p className="mt-3 text-[12px] text-muted">Dernier trajet terminé · {formatShort(d.trips.lastAt)}</p> : null}
    </Shell>
  );
}

/* ───────── SOS ───────── */

const SOS_TONE: Record<SafetyAlert['status'], 'danger' | 'warning' | 'success'> = { new: 'danger', responding: 'warning', resolved: 'success' };
const SOS_LABEL: Record<SafetyAlert['status'], string> = { new: 'Nouvelle', responding: 'Prise en charge', resolved: 'Résolue' };

export function SosAlertCard({ a, busy, onStatus }: { a: SafetyAlert; busy: boolean; onStatus: (s: 'responding' | 'resolved') => void }) {
  const info: [string, ReactNode][] = [
    [a.rideId ? 'Course' : 'Trajet famille', a.rideId ?? a.familyTripId ?? '—'],
    ['Déclenchée par', `${a.userName} (${a.role === 'driver' ? 'chauffeuse' : 'cliente'})`],
    ['Cliente', a.passengerName ?? '—'],
    ['Chauffeuse', a.driverName ? `${a.driverName}${a.vehiclePlate ? ` · ${a.vehiclePlate}` : ''}` : 'Non attribuée'],
    ['Contact de confiance', `${a.contactName}${a.contactPhone ? ` · ${a.contactPhone}` : ''}`],
    ['Demande support', a.ticketId ?? '—'],
  ];
  return (
    <Shell testId={`sos-card-${a.id}`}>
      <header className="flex flex-wrap items-start gap-3">
        <IconTile tone={SOS_TONE[a.status]}><ShieldAlert /></IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">{a.id}</h3>
            <Badge tone={SOS_TONE[a.status]}>{SOS_LABEL[a.status]}</Badge>
          </div>
          <p className="mt-0.5 text-[14px] text-muted tabular">Déclenchée le {formatShort(a.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {a.status === 'new' ? <Button loading={busy} onClick={() => onStatus('responding')}>Prendre en charge</Button> : null}
          {a.status !== 'resolved' ? <Button variant={a.status === 'new' ? 'secondary' : 'primary'} loading={busy} onClick={() => onStatus('resolved')}>Résoudre</Button> : null}
        </div>
      </header>
      {a.note ? <div className="mt-4"><Callout tone="danger" icon={<AlertTriangle />}>« {a.note} »</Callout></div> : null}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[14px]"><MapPin className="h-4 w-4 text-danger" aria-hidden />Position au déclenchement <span className="tabular text-muted">{a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}</span></span>
        <a className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent hover:underline" href={`https://maps.google.com/?q=${a.location.lat},${a.location.lng}`} target="_blank" rel="noreferrer">Voir sur la carte<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
      </div>
      <h4 className="mt-4 text-[13px] font-semibold text-muted">Actions prises</h4>
      <ol className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-4">
        {a.actions.map((x, i) => (
          <li key={i} className="relative text-[13px]">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="tabular text-muted">{formatShort(x.at)}</span> · <span className="font-semibold">{x.by}</span> · {x.label}
          </li>
        ))}
      </ol>
    </Shell>
  );
}

/* ───────── Portefeuilles clientes ───────── */

const ENTRY: Record<'pending' | 'confirmed' | 'failed', { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'En attente', tone: 'warning' },
  confirmed: { label: 'Confirmée', tone: 'success' },
  failed: { label: 'Échouée', tone: 'danger' },
};

export function PassengerWalletCard({ w, name }: { w: PassengerWallet; name: string }) {
  return (
    <Shell testId={`wallet-card-${w.userId}`}>
      <header className="flex items-start gap-3">
        <IconTile><Wallet /></IconTile>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold">{name}</h3>
          <p className="text-[13px] text-muted">{w.entries.length} opération{w.entries.length > 1 ? 's' : ''}</p>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-semibold tabular">{formatMoney(w.balance - w.reserved)}</div>
          <div className="text-[12px] text-muted">disponible · {formatMoney(w.reserved)} réservés</div>
        </div>
      </header>
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {w.entries.slice().reverse().slice(0, 8).map((e, i) => (
          <li key={`${e.id}-${i}`} className="flex items-center justify-between gap-3 py-2 text-[14px]">
            <div className="min-w-0">
              <div className="truncate">{e.label}</div>
              <div className="text-[12px] tabular text-muted">{formatShort(e.at)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={ENTRY[e.status].tone} dot={false}>{ENTRY[e.status].label}</Badge>
              <span className={cx('w-24 text-right font-semibold tabular', e.status === 'confirmed' && e.amount > 0 && 'text-success', e.status === 'pending' && 'text-muted', e.status === 'failed' && 'text-muted line-through')}>{e.amount > 0 ? '+' : ''}{formatMoney(e.amount)}</span>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
