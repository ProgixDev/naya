import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, SlidersHorizontal } from 'lucide-react';
import { errorMessage, type AdminCityRow } from '@naya/api';
import { CASABLANCA_RULES, computeFare, formatBp, RABAT_RULES, type CityRules, type CityStatus, type LatLng } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/context';
import { fmtDateTime, money, toCentimes, fromCentimes } from '../lib/format';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea, toast } from '../components/ui';
import { CityBadge, cityStatusLabel } from '../components/status';
import { MiniMap } from '../components/MiniMap';

/** Rectangle around a centre, half-size in km, as a simple zone editor. */
export function rectangle(center: LatLng, halfKm: number): LatLng[] {
  const dLat = halfKm / 111.32;
  const dLng = halfKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return [
    { lat: center.lat + dLat, lng: center.lng - dLng },
    { lat: center.lat + dLat, lng: center.lng + dLng },
    { lat: center.lat - dLat, lng: center.lng + dLng },
    { lat: center.lat - dLat, lng: center.lng - dLng },
  ];
}

/** A10 · Villes et zones desservies. */
export function CitiesPage() {
  const { can } = useAuth();
  const { setCityId } = useWorkspace();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const [adding, setAdding] = useState(false);
  const [zoneFor, setZoneFor] = useState<AdminCityRow | null>(null);
  const [statusFor, setStatusFor] = useState<AdminCityRow | null>(null);
  const [zoneToggle, setZoneToggle] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const editable = can('config.edit');
  return (
    <>
      <PageHeader title="Villes et zones" subtitle="Une ville en test n’accepte que les comptes testeurs. Chaque modification exige un motif et crée un événement d’audit." actions={editable ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)} data-testid="add-city">Ajouter une ville</Button> : null} />
      {!editable ? <div className="mb-5"><Banner tone="info" title="Lecture seule">Votre rôle permet de consulter la configuration, pas de la modifier.</Banner></div> : null}
      {q.isLoading ? <Skeleton className="h-[360px] w-full" /> : null}
      {q.isError ? <Card><ErrorState onRetry={() => q.refetch()} /></Card> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {(q.data ?? []).map((row) => {
          const c = row.city;
          const example = computeFare(c.rules, 10_000, 1500);
          return (
            <Card key={c.id} title={<span className="flex items-center gap-2">{c.name} <CityBadge status={c.status} /></span>} subtitle={`Règles v${c.rulesVersion} · mises à jour le ${fmtDateTime(c.updatedAt)}`} action={<span data-testid={`city-card-${c.id}`} />}>
              <MiniMap label={`Zones de ${c.name}`} center={c.center} zoom={11} polygons={row.zones.filter((z) => z.active).map((z) => z.polygon)} height={200} />
              <div className="mt-4 grid grid-cols-2 gap-3 text-[14px] md:grid-cols-4">
                <div><div className="text-[12px] text-muted">10 km · 25 min</div><div className="font-semibold tabular">{money(example.total)}</div></div>
                <div><div className="text-[12px] text-muted">Commission</div><div className="font-semibold tabular">{formatBp(c.rules.commissionBp)}</div></div>
                <div><div className="text-[12px] text-muted">Plafond de dette</div><div className="font-semibold tabular">{money(c.rules.debtLimit)}</div></div>
                <div><div className="text-[12px] text-muted">Dynamique</div><div className="font-semibold">{c.rules.dynamic.enabled ? `×${(c.rules.dynamic.multiplierBp / 10000).toString().replace('.', ',')}` : 'Inactive'}</div></div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="label">Zones desservies</span>
                  {editable ? <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setZoneFor(row)} data-testid={`add-zone-${c.id}`}>Ajouter une zone</Button> : null}
                </div>
                {row.zones.length === 0 ? <p className="text-[13px] text-warning">Aucune zone : les devis seront refusés.</p> : null}
                <ul className="flex flex-col gap-1.5">
                  {row.zones.map((z) => (
                    <li key={z.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2 text-[14px]">
                      <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" aria-hidden />{z.name}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={z.active ? 'success' : 'neutral'}>{z.active ? 'Active' : 'Inactive'}</Badge>
                        {editable ? <Button size="sm" variant="ghost" onClick={() => setZoneToggle({ id: z.id, name: z.name, active: !z.active })}>{z.active ? 'Désactiver' : 'Activer'}</Button> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => (setCityId(c.id), navigate(`/villes/${c.id}/regles`))} data-testid={`rules-${c.id}`}>Règles et tarifs</Button>
                {editable ? <Button variant="ghost" size="sm" onClick={() => setStatusFor(row)} data-testid={`status-${c.id}`}>Changer le statut</Button> : null}
              </div>
            </Card>
          );
        })}
      </div>
      {q.data && q.data.length === 0 ? <Card><EmptyState title="Aucune ville" /></Card> : null}
      {adding ? <AddCityDialog onClose={() => setAdding(false)} onCreated={(id) => (setCityId(id), navigate(`/villes/${id}/regles`))} /> : null}
      {zoneFor ? <ZoneDialog row={zoneFor} onClose={() => setZoneFor(null)} /> : null}
      {statusFor ? <StatusDialog row={statusFor} onClose={() => setStatusFor(null)} /> : null}
      {zoneToggle ? <ZoneToggleDialog zone={zoneToggle} onClose={() => setZoneToggle(null)} /> : null}
    </>
  );
}

function useReason() {
  const [reason, setReason] = useState('');
  const error = reason.trim().length > 0 && reason.trim().length < 10 ? '10 caractères minimum.' : null;
  return { reason, setReason, error, valid: reason.trim().length >= 10 };
}

function AddCityDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [id, setId] = useState('casablanca');
  const [name, setName] = useState('Casablanca');
  const [status, setStatus] = useState<'test' | 'inactive'>('test');
  const [lat, setLat] = useState('33.5883');
  const [lng, setLng] = useState('-7.6114');
  const [template, setTemplate] = useState<'casablanca' | 'rabat'>('casablanca');
  const [base, setBase] = useState(fromCentimes(CASABLANCA_RULES.baseFare));
  const [perKm, setPerKm] = useState(fromCentimes(CASABLANCA_RULES.perKm));
  const [perMin, setPerMin] = useState(fromCentimes(CASABLANCA_RULES.perMinute));
  const [minimum, setMinimum] = useState(fromCentimes(CASABLANCA_RULES.minimumFare));
  const [commission, setCommission] = useState(String(CASABLANCA_RULES.commissionBp / 100));
  const [debt, setDebt] = useState(fromCentimes(CASABLANCA_RULES.debtLimit));
  const r = useReason();
  const [error, setError] = useState<string | null>(null);
  const applyTemplate = (t: 'casablanca' | 'rabat') => {
    setTemplate(t);
    const src = t === 'rabat' ? RABAT_RULES : CASABLANCA_RULES;
    setBase(fromCentimes(src.baseFare));
    setPerKm(fromCentimes(src.perKm));
    setPerMin(fromCentimes(src.perMinute));
    setMinimum(fromCentimes(src.minimumFare));
    setCommission(String(src.commissionBp / 100));
    setDebt(fromCentimes(src.debtLimit));
  };
  const rules = (): CityRules | null => {
    const vals = [base, perKm, perMin, minimum, debt].map(toCentimes);
    const pct = Number(commission.replace(',', '.'));
    if (vals.some((v) => v === null || v < 0) || !Number.isFinite(pct) || pct < 0 || pct > 50) return null;
    const [b, k, m, mi, d] = vals as number[];
    const src = template === 'rabat' ? RABAT_RULES : CASABLANCA_RULES;
    return { ...src, baseFare: b!, perKm: k!, perMinute: m!, minimumFare: mi!, commissionBp: Math.round(pct * 100), debtLimit: d!, dynamic: { ...src.dynamic, enabled: false, reason: `Forte demande à ${name} en ce moment.` } };
  };
  const preview = rules();
  const m = useMutation({
    mutationFn: () => api.admin.createCity({ id, name, status, center: { lat: Number(lat), lng: Number(lng) }, rules: preview!, reason: r.reason.trim() }),
    onSuccess: async (c) => {
      // A service zone is needed before quotes are possible; start with a 7 km square the admin can refine.
      await api.admin.addZone(c.id, { name: `${c.name} · zone pilote`, polygon: rectangle(c.center, 7), active: true, reason: `Zone pilote initiale de ${c.name}.` });
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast(`${c.name} ajoutée en ${cityStatusLabel(c.status).toLowerCase()}`, 'success');
      onCreated(c.id);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = () => {
    if (!/^[a-z][a-z-]{2,30}$/.test(id)) return setError('Identifiant en minuscules, sans espace (ex. casablanca).');
    if (!preview) return setError('Vérifiez les montants et la commission.');
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return setError('Coordonnées du centre invalides.');
    if (!r.valid) return setError('Indiquez un motif (10 caractères minimum).');
    setError(null);
    m.mutate();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      busy={m.isPending}
      testId="add-city-dialog"
      title="Ajouter une ville"
      description="Une nouvelle ville commence en test ou inactive. Elle ne devient active qu’après une décision explicite."
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button loading={m.isPending} onClick={submit} data-testid="confirm-add-city">Ajouter la ville</Button></>}
    >
      <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
        <Field label="Identifiant">{(f) => <Input id={f} value={id} onChange={(e) => setId(e.target.value)} data-testid="city-id" />}</Field>
        <Field label="Nom">{(f) => <Input id={f} value={name} onChange={(e) => setName(e.target.value)} data-testid="city-name" />}</Field>
        <Field label="Statut initial">{(f) => <Select id={f} value={status} onChange={(e) => setStatus(e.target.value as 'test')}><option value="test">En test (comptes testeurs)</option><option value="inactive">Inactive</option></Select>}</Field>
        <Field label="Modèle de règles">{(f) => <Select id={f} value={template} onChange={(e) => applyTemplate(e.target.value as 'rabat')}><option value="casablanca">Casablanca (démo)</option><option value="rabat">Copier Rabat</option></Select>}</Field>
        <Field label="Latitude du centre">{(f) => <Input id={f} value={lat} onChange={(e) => setLat(e.target.value)} />}</Field>
        <Field label="Longitude du centre">{(f) => <Input id={f} value={lng} onChange={(e) => setLng(e.target.value)} />}</Field>
        <Field label="Prise en charge (MAD)">{(f) => <Input id={f} value={base} onChange={(e) => setBase(e.target.value)} data-testid="city-base" />}</Field>
        <Field label="Prix par km (MAD)">{(f) => <Input id={f} value={perKm} onChange={(e) => setPerKm(e.target.value)} data-testid="city-perkm" />}</Field>
        <Field label="Prix par minute (MAD)">{(f) => <Input id={f} value={perMin} onChange={(e) => setPerMin(e.target.value)} />}</Field>
        <Field label="Tarif minimum (MAD)">{(f) => <Input id={f} value={minimum} onChange={(e) => setMinimum(e.target.value)} />}</Field>
        <Field label="Commission (%)">{(f) => <Input id={f} value={commission} onChange={(e) => setCommission(e.target.value)} data-testid="city-commission" />}</Field>
        <Field label="Plafond de dette (MAD)">{(f) => <Input id={f} value={debt} onChange={(e) => setDebt(e.target.value)} data-testid="city-debt" />}</Field>
        <div className="col-span-2 rounded-2xl bg-background p-3 text-[13px]">
          Exemple 10 km · 25 min : <strong className="tabular">{preview ? money(computeFare(preview, 10_000, 1500).total) : '—'}</strong> · avec ×1,2 : <strong className="tabular">{preview ? money(computeFare(preview, 10_000, 1500, 12_000).total) : '—'}</strong>
        </div>
        <div className="col-span-2">
          <Field label="Motif" error={r.error}>{(f) => <Textarea id={f} value={r.reason} onChange={(e) => r.setReason(e.target.value)} placeholder="Ex. : préparation du pilote à Casablanca" data-testid="city-reason" />}</Field>
        </div>
        {error ? <div className="col-span-2"><Banner tone="danger" title={error} /></div> : null}
      </div>
    </Dialog>
  );
}

function ZoneDialog({ row, onClose }: { row: AdminCityRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(`${row.city.name} · extension`);
  const [half, setHalf] = useState('4');
  const r = useReason();
  const [error, setError] = useState<string | null>(null);
  const polygon = rectangle(row.city.center, Number(half.replace(',', '.')) || 1);
  const m = useMutation({
    mutationFn: () => api.admin.addZone(row.city.id, { name, polygon, active: true, reason: r.reason.trim() }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin'] }), toast('Zone ajoutée', 'success'), onClose()),
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Dialog open onClose={onClose} busy={m.isPending} title={`Nouvelle zone · ${row.city.name}`} description="Zone rectangulaire autour du centre-ville. Les adresses hors de toutes les zones actives sont refusées." footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button loading={m.isPending} onClick={() => (r.valid ? m.mutate() : setError('Indiquez un motif (10 caractères minimum).'))}>Ajouter la zone</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Nom de la zone">{(f) => <Input id={f} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Demi-côté (km)">{(f) => <Input id={f} value={half} onChange={(e) => setHalf(e.target.value)} inputMode="decimal" />}</Field>
        <MiniMap label="Aperçu de la zone" center={row.city.center} zoom={11} polygons={[polygon]} height={180} />
        <Field label="Motif" error={r.error}>{(f) => <Textarea id={f} value={r.reason} onChange={(e) => r.setReason(e.target.value)} />}</Field>
        {error ? <Banner tone="danger" title={error} /> : null}
      </div>
    </Dialog>
  );
}

function ZoneToggleDialog({ zone, onClose }: { zone: { id: string; name: string; active: boolean }; onClose: () => void }) {
  const qc = useQueryClient();
  const r = useReason();
  const m = useMutation({
    mutationFn: () => api.admin.setZoneActive(zone.id, zone.active, r.reason.trim()),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin'] }), toast(zone.active ? 'Zone activée' : 'Zone désactivée', 'success'), onClose()),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  return (
    <Dialog open onClose={onClose} busy={m.isPending} title={`${zone.active ? 'Activer' : 'Désactiver'} « ${zone.name} » ?`} description={zone.active ? 'Les adresses de cette zone pourront être desservies.' : 'Les nouveaux devis dans cette zone seront refusés. Les courses déjà acceptées ne sont pas modifiées.'} footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant={zone.active ? 'primary' : 'danger'} disabled={!r.valid} loading={m.isPending} onClick={() => m.mutate()}>Confirmer</Button></>}>
      <Field label="Motif" error={r.error}>{(f) => <Textarea id={f} value={r.reason} onChange={(e) => r.setReason(e.target.value)} />}</Field>
    </Dialog>
  );
}

function StatusDialog({ row, onClose }: { row: AdminCityRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CityStatus>(row.city.status);
  const r = useReason();
  const m = useMutation({
    mutationFn: () => api.admin.setCityStatus(row.city.id, { status, reason: r.reason.trim() }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin'] }), toast('Statut mis à jour', 'success'), onClose()),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  return (
    <Dialog open onClose={onClose} busy={m.isPending} title={`Statut de ${row.city.name}`} description="Active : ouverte à toutes. En test : comptes testeurs uniquement. Inactive : aucune réservation." footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!r.valid || status === row.city.status} loading={m.isPending} onClick={() => m.mutate()}>Enregistrer</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Nouveau statut">{(f) => <Select id={f} value={status} onChange={(e) => setStatus(e.target.value as CityStatus)}><option value="active">Active</option><option value="test">En test</option><option value="inactive">Inactive</option></Select>}</Field>
        {status === 'active' && row.city.status !== 'active' ? <Banner tone="warning" title="Ouverture au public">Toutes les passagères et chauffeuses vérifiées de la ville pourront utiliser Naya.</Banner> : null}
        <Field label="Motif" error={r.error}>{(f) => <Textarea id={f} value={r.reason} onChange={(e) => r.setReason(e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}
