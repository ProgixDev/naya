import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Phone, UserCheck } from 'lucide-react';
import { FAMILY_STATUS_LABELS, SAFETY_STATUS_LABELS, type AdminSafetyAlert } from '@naya/domain';
import { errorMessage } from '@naya/api';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { useAllowed, useSosAlerts } from '../components/Layout';
import { MiniMap } from '../components/MiniMap';
import { RideBadge } from '../components/status';
import { Badge, Banner, Button, Card, DefinitionList, EmptyState, ErrorState, Field, PageHeader, Segmented, Skeleton, Textarea, toast, type Tone } from '../components/ui';

const TONE: Record<AdminSafetyAlert['status'], Tone> = { new: 'danger', responding: 'warning', resolved: 'success' };
const ROLE = { passenger: 'passagère', driver: 'chauffeuse' } as const;
const phone = (e164: string) => e164.replace(/^(\+\d{3})(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6');

/** Alertes SOS (safety.respond) · position, contexte de la course, prise en charge et résolution motivée. */
export function SosPage() {
  const q = useSosAlerts(5000);
  const cities = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const open = (q.data ?? []).filter((a) => a.status !== 'resolved').length;
  const rows = (q.data ?? []).filter((a) => filter === 'all' || a.status !== 'resolved');
  const cityName = (id: string | null) => cities.data?.find((c) => c.city.id === id)?.city.name ?? id ?? '—';
  return (
    <>
      <PageHeader
        title="Alertes SOS"
        subtitle={q.data ? `${open} alerte(s) ouverte(s) · nouvelles en premier, par ordre d’arrivée` : 'File de sécurité'}
        actions={<Segmented<'open' | 'all'> label="Alertes affichées" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Ouvertes' }, { value: 'all', label: 'Toutes' }]} />}
      />
      <Banner tone="info" title="Traitement des alertes">
        Appelez d’abord la personne. En cas de danger immédiat, contactez la police (19). Chaque prise en charge et chaque résolution sont conservées dans le journal d’audit.
      </Banner>
      <div className="mt-5 flex flex-col gap-5">
        {q.isLoading ? <Skeleton className="h-[320px] w-full" /> : null}
        {q.isError ? (
          <Card>
            <ErrorState onRetry={() => q.refetch()} />
          </Card>
        ) : null}
        {q.data && !rows.length ? (
          <Card>
            <EmptyState title={filter === 'open' ? 'Aucune alerte ouverte' : 'Aucune alerte'} message="Les alertes SOS des passagères et des chauffeuses apparaissent ici dès leur envoi." />
          </Card>
        ) : null}
        {rows.map((a) => (
          <AlertCard key={a.id} alert={a} city={cityName(a.cityId)} />
        ))}
      </div>
    </>
  );
}

function AlertCard({ alert: a, city }: { alert: AdminSafetyAlert; city: string }) {
  const qc = useQueryClient();
  const allowed = useAllowed();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Also after a refusal: a colleague may have taken or closed the alert first.
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const take = useMutation({ mutationFn: () => api.adminPrototype.alert(a.id, 'responding'), onSuccess: () => (toast('Alerte prise en charge', 'success'), refresh()), onError: (e) => (toast(errorMessage(e), 'danger'), refresh()) });
  const resolve = useMutation({ mutationFn: () => api.adminPrototype.alert(a.id, 'resolved', note.trim()), onSuccess: () => (setNote(''), toast('Alerte clôturée', 'success'), refresh()), onError: (e) => (setError(errorMessage(e)), refresh()) });
  const context = a.ride ? (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {allowed('rides.read') ? (
          <Link to={`/courses/${a.ride.id}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline" data-testid={`sos-ride-${a.id}`}>
            {a.ride.id}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <span className="font-semibold">{a.ride.id}</span>
        )}
        <RideBadge status={a.ride.status} />
      </div>
      <div className="mt-1 text-[13px] text-muted">
        {a.ride.pickup} → {a.ride.destination} · {a.ride.passengerName} avec {a.ride.driverName ?? 'aucune chauffeuse'}
      </div>
    </div>
  ) : a.trip ? (
    <div>
      <div className="font-semibold">
        {a.trip.childName} · {FAMILY_STATUS_LABELS[a.trip.status]}
      </div>
      <div className="mt-1 text-[13px] text-muted">
        {a.trip.pickup} → {a.trip.destination} · chauffeuse {a.trip.driverName} · {a.trip.id}
      </div>
    </div>
  ) : (
    (a.rideId ?? a.familyTripId ?? '—')
  );
  return (
    <div data-testid={`sos-${a.id}`}>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {a.id} · {a.userName}
            <Badge tone={TONE[a.status]}>{SAFETY_STATUS_LABELS[a.status]}</Badge>
          </span>
        }
        subtitle={`Envoyée le ${fmtDateTime(a.createdAt)} · ${ROLE[a.role]} · ${city}`}
        action={
          a.status === 'new' ? (
            <Button size="sm" icon={<UserCheck className="h-4 w-4" />} loading={take.isPending} onClick={() => take.mutate()} data-testid={`sos-take-${a.id}`}>
              Prendre en charge
            </Button>
          ) : null
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <MiniMap label={`Position de l’alerte ${a.id}`} center={a.location} zoom={15} markers={[{ id: a.id, at: a.location, label: 'Position de l’alerte', kind: 'pickup' }]} height={240} />
            <p className="mt-2 text-[12px] text-muted">Position enregistrée à l’envoi de l’alerte.</p>
          </div>
          <DefinitionList
            items={[
              { term: 'Signalée par', value: `${a.userName} · ${ROLE[a.role]}` },
              {
                term: 'Téléphone',
                value: a.reporterPhone ? (
                  <a href={`tel:${a.reporterPhone}`} className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
                    <Phone className="h-4 w-4" aria-hidden />
                    {phone(a.reporterPhone)}
                  </a>
                ) : (
                  '—'
                ),
              },
              { term: 'Contact de confiance', value: a.contactName },
              { term: a.trip ? 'Trajet familial' : 'Course', value: context },
              { term: 'Prise en charge', value: a.ownerName ?? 'Personne pour l’instant' },
            ]}
          />
        </div>
        <h3 className="mt-6 text-[14px] font-semibold">Chronologie</h3>
        <ol className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-4">
          {a.actions.map((x, i) => (
            <li key={i} className="text-[13px]">
              <span className="tabular text-muted">{fmtDateTime(x.at)}</span> · <span className="font-semibold">{x.by}</span> · {x.label}
            </li>
          ))}
        </ol>
        {a.status === 'resolved' ? (
          <div className="mt-5">
            <Banner tone="success" title={`Alerte clôturée${a.resolvedAt ? ` le ${fmtDateTime(a.resolvedAt)}` : ''}`}>
              {a.resolutionNote ?? a.actions[a.actions.length - 1]?.label}
            </Banner>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3 border-t border-line pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim().length < 3) return setError('Ajoutez une note de résolution : ce qui a été fait et avec qui.');
              setError(null);
              resolve.mutate();
            }}
          >
            <Field label="Note de résolution" error={error} hint="Obligatoire pour clôturer : ce qui a été fait, avec qui, et l’état de la personne.">
              {(id, describedBy) => <Textarea id={id} aria-describedby={describedBy} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} data-testid={`sos-note-${a.id}`} />}
            </Field>
            <div>
              <Button type="submit" variant="secondary" loading={resolve.isPending} data-testid={`sos-resolve-${a.id}`}>
                Clôturer l’alerte
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
