import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError } from '@naya/api';
import { computeFare, formatBp, formatMultiplier, type CityRules } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDateTime, fromCentimes, money, toCentimes } from '../lib/format';
import { Banner, Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Textarea, toast, cx } from '../components/ui';
import { CityBadge } from '../components/status';
import { ImpactList, ReasonField } from '../components/form';
import { SlidersHorizontal } from 'lucide-react';

type Form = Record<'baseFare' | 'perKm' | 'perMinute' | 'minimumFare' | 'debtLimit' | 'feeAfterGrace' | 'feeAfterArrival' | 'minimumWithdrawal', string> & {
  commission: string;
  graceMinutes: string;
  dynamicEnabled: boolean;
  multiplier: string;
  dynamicReason: string;
  offerTimeout: string;
  searchTimeout: string;
  minLead: string;
  cutoff: string;
};

const toForm = (r: CityRules): Form => ({
  baseFare: fromCentimes(r.baseFare),
  perKm: fromCentimes(r.perKm),
  perMinute: fromCentimes(r.perMinute),
  minimumFare: fromCentimes(r.minimumFare),
  debtLimit: fromCentimes(r.debtLimit),
  feeAfterGrace: fromCentimes(r.cancellation.feeAfterGrace),
  feeAfterArrival: fromCentimes(r.cancellation.feeAfterArrival),
  minimumWithdrawal: fromCentimes(r.minimumWithdrawal),
  commission: String(r.commissionBp / 100).replace('.', ','),
  graceMinutes: String(r.cancellation.graceSeconds / 60),
  dynamicEnabled: r.dynamic.enabled,
  multiplier: String(r.dynamic.multiplierBp / 10000).replace('.', ','),
  dynamicReason: r.dynamic.reason,
  offerTimeout: String(r.offerTimeoutSeconds),
  searchTimeout: String(r.searchTimeoutSeconds),
  minLead: String(r.scheduling.minLeadMinutes),
  cutoff: String(r.scheduling.modifyCutoffMinutes),
});

const num = (s: string) => Number(s.replace(',', '.'));

function fromForm(f: Form, base: CityRules): { rules: CityRules | null; errors: Partial<Record<keyof Form, string>> } {
  const errors: Partial<Record<keyof Form, string>> = {};
  const money = (k: keyof Form) => {
    const v = toCentimes(String(f[k]));
    if (v === null || v < 0) errors[k] = 'Montant invalide';
    return v ?? 0;
  };
  const vals = { baseFare: money('baseFare'), perKm: money('perKm'), perMinute: money('perMinute'), minimumFare: money('minimumFare'), debtLimit: money('debtLimit'), feeAfterGrace: money('feeAfterGrace'), feeAfterArrival: money('feeAfterArrival'), minimumWithdrawal: money('minimumWithdrawal') };
  const pct = num(f.commission);
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) errors.commission = 'Entre 0 et 50 %';
  const mult = num(f.multiplier);
  if (!Number.isFinite(mult) || mult < 1 || mult > 3) errors.multiplier = 'Entre 1 et 3';
  const ints: [keyof Form, number, number][] = [['graceMinutes', 0, 30], ['offerTimeout', 10, 120], ['searchTimeout', 30, 900], ['minLead', 10, 1440], ['cutoff', 0, 1440]];
  for (const [k, min, max] of ints) {
    const v = num(String(f[k]));
    if (!Number.isInteger(v) || v < min || v > max) errors[k] = `Entier entre ${min} et ${max}`;
  }
  if (f.dynamicEnabled && f.dynamicReason.trim().length < 5) errors.dynamicReason = 'Expliquez la hausse aux passagères.';
  if (Object.keys(errors).length) return { rules: null, errors };
  return {
    errors,
    rules: {
      ...base,
      baseFare: vals.baseFare,
      perKm: vals.perKm,
      perMinute: vals.perMinute,
      minimumFare: vals.minimumFare,
      commissionBp: Math.round(pct * 100),
      debtLimit: vals.debtLimit,
      cancellation: { graceSeconds: num(f.graceMinutes) * 60, feeAfterGrace: vals.feeAfterGrace, feeAfterArrival: vals.feeAfterArrival },
      dynamic: { enabled: f.dynamicEnabled, multiplierBp: Math.round(mult * 10000), reason: f.dynamicReason.trim() },
      offerTimeoutSeconds: num(f.offerTimeout),
      searchTimeoutSeconds: num(f.searchTimeout),
      scheduling: { ...base.scheduling, minLeadMinutes: num(f.minLead), modifyCutoffMinutes: num(f.cutoff) },
      minimumWithdrawal: vals.minimumWithdrawal,
    },
  };
}

function changes(a: CityRules, b: CityRules): string[] {
  const out: string[] = [];
  const m = (label: string, x: number, y: number) => x !== y && out.push(`${label} : ${money(x)} → ${money(y)}`);
  m('Prise en charge', a.baseFare, b.baseFare);
  m('Prix par km', a.perKm, b.perKm);
  m('Prix par minute', a.perMinute, b.perMinute);
  m('Tarif minimum', a.minimumFare, b.minimumFare);
  m('Plafond de dette', a.debtLimit, b.debtLimit);
  m('Frais après délai', a.cancellation.feeAfterGrace, b.cancellation.feeAfterGrace);
  m('Frais après arrivée', a.cancellation.feeAfterArrival, b.cancellation.feeAfterArrival);
  m('Retrait minimum', a.minimumWithdrawal, b.minimumWithdrawal);
  if (a.commissionBp !== b.commissionBp) out.push(`Commission : ${formatBp(a.commissionBp)} → ${formatBp(b.commissionBp)}`);
  if (a.cancellation.graceSeconds !== b.cancellation.graceSeconds) out.push(`Annulation gratuite : ${a.cancellation.graceSeconds / 60} → ${b.cancellation.graceSeconds / 60} min`);
  if (a.dynamic.enabled !== b.dynamic.enabled || a.dynamic.multiplierBp !== b.dynamic.multiplierBp) out.push(`Dynamique : ${a.dynamic.enabled ? formatMultiplier(a.dynamic.multiplierBp) : 'inactive'} → ${b.dynamic.enabled ? formatMultiplier(b.dynamic.multiplierBp) : 'inactive'}`);
  if (a.dynamic.reason !== b.dynamic.reason && b.dynamic.enabled) out.push('Explication dynamique modifiée');
  if (a.offerTimeoutSeconds !== b.offerTimeoutSeconds) out.push(`Délai d’offre : ${a.offerTimeoutSeconds} → ${b.offerTimeoutSeconds} s`);
  if (a.searchTimeoutSeconds !== b.searchTimeoutSeconds) out.push(`Recherche : ${a.searchTimeoutSeconds} → ${b.searchTimeoutSeconds} s`);
  if (a.scheduling.minLeadMinutes !== b.scheduling.minLeadMinutes || a.scheduling.modifyCutoffMinutes !== b.scheduling.modifyCutoffMinutes) out.push('Règles de planification modifiées');
  return out;
}

/** A11 · Tarification, commission, dette, annulation et tarification dynamique par ville. */
export function RulesPage() {
  const { id = 'rabat' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const row = q.data?.find((c) => c.city.id === id);
  const [form, setForm] = useState<Form | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const editable = can('config.edit');

  useEffect(() => {
    if (row && (loadedVersion === null || form === null)) {
      setForm(toForm(row.city.rules));
      setLoadedVersion(row.city.rulesVersion);
    }
  }, [row, loadedVersion, form]);

  const parsed = useMemo(() => (form && row ? fromForm(form, row.city.rules) : null), [form, row]);
  const diff = parsed?.rules && row ? changes(row.city.rules, parsed.rules) : [];
  const save = useMutation({
    mutationFn: () => api.admin.updateRules(id, { rules: parsed!.rules!, reason: reason.trim(), expectedVersion: loadedVersion! }),
    onSuccess: (c) => {
      setConfirm(false);
      setReason('');
      setSaved(c.rulesVersion);
      setLoadedVersion(c.rulesVersion);
      setForm(toForm(c.rules));
      toast(`Règles ${c.name} v${c.rulesVersion} enregistrées`, 'success');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'CONFLICT') {
        setConfirm(false);
        setConflict(true);
      } else toast(errorMessage(e), 'danger');
    },
  });

  if (q.isLoading || (row && !form)) return <Skeleton className="mt-6 h-[520px] w-full" />;
  if (q.isError) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  if (!row || !form) return <Card><ErrorState message="Ville introuvable." /></Card>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => (setForm({ ...form, [k]: v }), setSaved(null));
  const err = parsed?.errors ?? {};
  const example = parsed?.rules ? computeFare(parsed.rules, 10_000, 1500) : null;
  const exampleDyn = parsed?.rules ? computeFare(parsed.rules, 10_000, 1500, parsed.rules.dynamic.multiplierBp) : null;
  const num = (k: keyof Form, label: string, suffix: string, hint?: string) => (
    <Field label={`${label} (${suffix})`} error={err[k]} hint={hint}>
      {(f, d) => <Input id={f} aria-describedby={d} inputMode="decimal" value={String(form[k])} onChange={(e) => set(k, e.target.value as never)} disabled={!editable} data-testid={`rule-${k}`} />}
    </Field>
  );
  return (
    <>
      <PageHeader eyebrow={<Link to="/villes" className="hover:text-accent">Villes et zones</Link>} title={`Règles · ${row.city.name}`} subtitle={`Version ${row.city.rulesVersion} · les courses et réservations déjà acceptées gardent leurs conditions figées.`} actions={<CityBadge status={row.city.status} />} />
      <div className="flex flex-col gap-5">
        {conflict ? <Banner tone="warning" title="Les règles ont changé pendant votre modification" action={<Button size="sm" variant="secondary" onClick={() => (setConflict(false), setForm(null), setLoadedVersion(null), q.refetch())}>Recharger</Button>}>Une autre administratrice a enregistré une version plus récente.</Banner> : null}
        {saved ? <Banner tone="success" title={`Version ${saved} enregistrée`} action={<Link className="text-[13px] font-semibold text-accent" to="/audit">Voir le journal</Link>}>La modification et son motif sont inscrits au journal d’audit.</Banner> : null}
        {!editable ? <Banner tone="info" title="Lecture seule">Votre rôle ne permet pas de modifier les règles.</Banner> : null}
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-5">
            <Card title="Tarif" subtitle="Tarif = max(prise en charge + km + minutes, minimum) × coefficient. Arrondi au centime.">
              <div className="grid gap-4 md:grid-cols-2">
                {num('baseFare', 'Prise en charge', 'MAD')}
                {num('perKm', 'Prix par km', 'MAD')}
                {num('perMinute', 'Prix par minute', 'MAD')}
                {num('minimumFare', 'Tarif minimum', 'MAD')}
              </div>
            </Card>
            <Card title="Commission et dette" subtitle="La commission des courses en espèces est débitée du portefeuille ; les courses carte créditent le net.">
              <div className="grid gap-4 md:grid-cols-3">
                {num('commission', 'Commission', '%')}
                {num('debtLimit', 'Plafond de dette', 'MAD', 'Atteint : nouvelles offres bloquées')}
                {num('minimumWithdrawal', 'Retrait minimum', 'MAD')}
              </div>
            </Card>
            <Card title="Annulation" subtitle="Les frais sont affichés avant confirmation. Annulation gratuite avant attribution.">
              <div className="grid gap-4 md:grid-cols-3">
                {num('graceMinutes', 'Délai gratuit', 'min')}
                {num('feeAfterGrace', 'Frais après le délai', 'MAD')}
                {num('feeAfterArrival', 'Frais après arrivée', 'MAD')}
              </div>
            </Card>
            <Card title="Tarification dynamique" subtitle="Le coefficient et son explication sont affichés à la passagère avant qu’elle ne s’engage.">
              <label className="mb-4 inline-flex items-center gap-3 text-[14px] font-semibold">
                <input type="checkbox" role="switch" aria-checked={form.dynamicEnabled} className="h-5 w-5 accent-[#6B3657]" checked={form.dynamicEnabled} onChange={(e) => set('dynamicEnabled', e.target.checked)} disabled={!editable} data-testid="rule-dynamic" />
                {form.dynamicEnabled ? 'Active' : 'Inactive'}
              </label>
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                {num('multiplier', 'Coefficient', '×')}
                <Field label="Explication affichée" error={err.dynamicReason}>
                  {(f, d) => <Input id={f} aria-describedby={d} value={form.dynamicReason} onChange={(e) => set('dynamicReason', e.target.value)} disabled={!editable} />}
                </Field>
              </div>
            </Card>
            <Card title="Délais">
              <div className="grid gap-4 md:grid-cols-2">
                {num('offerTimeout', 'Durée d’une proposition', 's')}
                {num('searchTimeout', 'Recherche avant « aucune chauffeuse »', 's')}
                {num('minLead', 'Réservation planifiée : délai minimum', 'min')}
                {num('cutoff', 'Modification possible jusqu’à', 'min avant')}
              </div>
            </Card>
          </div>
          <div className="flex flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
            <Card title="Exemple · 10 km, 25 min" subtitle="Calculé avec le moteur de tarification réel.">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[13px] text-muted">Sans coefficient</div>
                  <div className="text-[34px] font-semibold tabular leading-10 tracking-[-0.5px]" data-testid="example-fare">{example ? money(example.total) : '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] text-muted">Avec {parsed?.rules ? formatMultiplier(parsed.rules.dynamic.multiplierBp) : '×'}</div>
                  <div className="text-[22px] font-semibold tabular" data-testid="example-fare-dynamic">{exampleDyn ? money(exampleDyn.total) : '—'}</div>
                </div>
              </div>
              {example && parsed?.rules ? (
                <div className="mt-3 text-[13px] text-muted">
                  Commission {formatBp(parsed.rules.commissionBp)} : {money(Math.round((example.total * parsed.rules.commissionBp) / 10000))} · net chauffeuse {money(example.total - Math.round((example.total * parsed.rules.commissionBp) / 10000))}
                </div>
              ) : null}
            </Card>
            <Card title="Modifications en attente">
              {diff.length ? (
                <ul className="flex flex-col gap-1.5 text-[14px]" data-testid="rule-diff">
                  {diff.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              ) : (
                <p className="text-[14px] text-muted">Aucune modification.</p>
              )}
              {editable ? (
                <div className="mt-4 flex gap-2">
                  <Button disabled={!diff.length || !parsed?.rules} onClick={() => setConfirm(true)} data-testid="save-rules">Enregistrer</Button>
                  <Button variant="ghost" disabled={!diff.length} onClick={() => setForm(toForm(row.city.rules))}>Annuler les modifications</Button>
                </div>
              ) : null}
            </Card>
            <Card title="Historique des versions">
              <ol className="flex flex-col gap-3">
                {row.versions.map((v) => (
                  <li key={v.version} className={cx('rounded-2xl px-4 py-3 text-[13px]', v.version === row.city.rulesVersion ? 'bg-selected' : 'bg-background')}>
                    <div className="flex justify-between font-semibold"><span>Version {v.version}</span><span className="tabular text-muted">{fmtDateTime(v.createdAt)}</span></div>
                    <div className="mt-1 text-muted">{v.reason}</div>
                    <div className="mt-1 tabular">{money(computeFare(v.rules, 10_000, 1500).total)} · commission {formatBp(v.rules.commissionBp)} · plafond {money(v.rules.debtLimit)}{v.rules.dynamic.enabled ? ` · dynamique ${formatMultiplier(v.rules.dynamic.multiplierBp)}` : ''}</div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={save.isPending}
        testId="rules-confirm"
        tone="warning"
        icon={<SlidersHorizontal />}
        title={`Enregistrer la version ${row.city.rulesVersion + 1} ?`}
        description={`${row.city.name} · ${diff.length} changement${diff.length > 1 ? 's' : ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button>
            <Button disabled={reason.trim().length < 10} loading={save.isPending} onClick={() => save.mutate()} data-testid="confirm-rules">Enregistrer la version {row.city.rulesVersion + 1}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="label mb-2">Changements</p>
            <ImpactList items={diff} />
          </div>
          <p className="text-[13px] text-muted">Les nouveaux devis utiliseront ces règles. Les courses et réservations déjà acceptées gardent leurs conditions.</p>
          <ReasonField value={reason} onChange={setReason} testId="rules-reason" />
        </div>
      </Dialog>
    </>
  );
}
