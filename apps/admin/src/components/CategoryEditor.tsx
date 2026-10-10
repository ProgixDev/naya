import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bike, Car, Gem, Tags } from 'lucide-react';
import { computeFare, formatMoney, type ServiceCategory } from '@naya/domain';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { toCentimes } from '../lib/format';
import { Banner, Button, Dialog, Field, Input, cx } from './ui';
import { FormSection, SwitchRow, TagInput, UnitInput, slugify } from './form';

const VISUALS: { value: ServiceCategory['icon']; label: string; hint: string; Icon: typeof Car }[] = [
  { value: 'scooter', label: 'Scooter', hint: 'Deux-roues', Icon: Bike },
  { value: 'car', label: 'Voiture', hint: 'Berline standard', Icon: Car },
  { value: 'premium', label: 'Confort', hint: 'Premium', Icon: Gem },
];
const TARIFFS = [
  ['baseFare', 'Prise en charge'],
  ['perKm', 'Prix par km'],
  ['perMinute', 'Prix par minute'],
  ['minimumFare', 'Tarif minimum'],
] as const;
type TariffKey = (typeof TARIFFS)[number][0];

const mad = (c: number | null) => (c === null ? '' : String(c / 100).replace('.', ','));
const toId = (s: string) => slugify(s.replace(/^naya\s+/i, ''));

/** Create or edit a vehicle category: identity, pricing with a live example, availability, conditions. */
export function CategoryEditor({ initial, isNew, busy, onSave, onClose }: { initial: ServiceCategory; isNew: boolean; busy: boolean; onSave: (c: ServiceCategory) => Promise<void>; onClose: () => void }) {
  const { cityId } = useWorkspace();
  const cities = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const [name, setName] = useState(initial.name);
  const [id, setId] = useState(initial.id);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [description, setDescription] = useState(initial.description);
  const [icon, setIcon] = useState(initial.icon);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [cityIds, setCityIds] = useState(initial.cityIds);
  const [eta, setEta] = useState(String(initial.etaMinutes));
  const [commission, setCommission] = useState(String(initial.commissionBp / 100).replace('.', ','));
  const ownTariff = TARIFFS.some(([k]) => initial[k] !== null);
  const [custom, setCustom] = useState(isNew ? true : ownTariff);
  const [tariff, setTariff] = useState<Record<TariffKey, string>>(() => Object.fromEntries(TARIFFS.map(([k]) => [k, mad(initial[k])])) as Record<TariffKey, string>);
  const [conditions, setConditions] = useState(initial.conditions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [server, setServer] = useState<string | null>(null);

  const city = cities.data?.find((c) => c.city.id === cityId)?.city ?? cities.data?.[0]?.city;
  const cents = (k: TariffKey) => (custom && tariff[k].trim() ? toCentimes(tariff[k]) : null);
  const example = city
    ? computeFare(
        {
          baseFare: cents('baseFare') ?? city.rules.baseFare,
          perKm: cents('perKm') ?? city.rules.perKm,
          perMinute: cents('perMinute') ?? city.rules.perMinute,
          minimumFare: cents('minimumFare') ?? city.rules.minimumFare,
        },
        10_000,
        25 * 60,
      ).total
    : null;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Nom requis.';
    if (!/^[a-z0-9-]{2,40}$/.test(id)) e.id = 'Minuscules, chiffres et tirets (2 à 40 caractères).';
    if (!description.trim()) e.description = 'Une courte description aide la cliente à choisir.';
    const etaN = Number(eta);
    if (!Number.isInteger(etaN) || etaN < 1 || etaN > 60) e.eta = 'Entre 1 et 60 minutes.';
    const com = toCentimes(commission);
    if (com === null || com < 0 || com > 5000) e.commission = 'Entre 0 et 50 %.';
    if (custom) for (const [k, l] of TARIFFS) if (tariff[k].trim() && toCentimes(tariff[k]) === null) e[k] = `${l} : montant invalide.`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setServer(null);
    try {
      await onSave({
        ...initial,
        id,
        name: name.trim(),
        description: description.trim(),
        icon,
        enabled,
        cityIds,
        etaMinutes: etaN,
        commissionBp: com!,
        baseFare: cents('baseFare'),
        perKm: cents('perKm'),
        perMinute: cents('perMinute'),
        minimumFare: cents('minimumFare'),
        conditions,
      });
    } catch (err) {
      setServer((err as Error).message);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      icon={<Tags />}
      onClose={onClose}
      busy={busy}
      testId="category-editor"
      title={isNew ? 'Nouvelle catégorie de véhicule' : `Modifier · ${initial.name}`}
      description="Proposée aux clientes lors de la commande, avec son prix estimé et son temps d’arrivée."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button loading={busy} onClick={submit} data-testid="category-save">{isNew ? 'Créer la catégorie' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        {server ? <Banner tone="danger" title={server} /> : null}
        <FormSection title="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom affiché" error={errors.name}>
              {(f, d) => (
                <Input
                  id={f}
                  aria-describedby={d}
                  value={name}
                  placeholder="Ex. : Naya Van"
                  data-testid="category-name"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!idTouched) setId(toId(e.target.value));
                  }}
                />
              )}
            </Field>
            <Field label="Identifiant" error={errors.id} hint={isNew ? 'Généré à partir du nom. Ne pourra plus changer.' : 'Ne peut plus être modifié.'}>
              {(f, d) => <Input id={f} aria-describedby={d} value={id} disabled={!isNew} className="font-mono text-[14px]" onChange={(e) => { setIdTouched(true); setId(e.target.value.toLowerCase()); }} data-testid="category-id" />}
            </Field>
          </div>
          <Field label="Description" error={errors.description}>
            {(f, d) => <Input id={f} aria-describedby={d} value={description} placeholder="Ex. : Pour les groupes et les bagages" onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <div>
            <p className="label mb-2">Visuel</p>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Visuel">
              {VISUALS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={icon === v.value}
                  onClick={() => setIcon(v.value)}
                  className={cx('flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 transition', icon === v.value ? 'border-accent bg-selected text-accent ring-1 ring-accent' : 'border-line text-ink hover:border-accent/40 hover:bg-background')}
                >
                  <v.Icon className="h-6 w-6" aria-hidden />
                  <span className="text-[14px] font-semibold">{v.label}</span>
                  <span className="text-[12px] text-muted">{v.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </FormSection>

        <FormSection title="Tarification" hint="Montants en MAD, figés à la confirmation de chaque course.">
          <div className="flex gap-2" role="radiogroup" aria-label="Tarifs">
            {([['custom', true, 'Tarifs propres à la catégorie'], ['city', false, 'Tarifs de la ville']] as const).map(([k, v, l]) => (
              <button key={k} type="button" role="radio" aria-checked={custom === v} onClick={() => setCustom(v)} className={cx('rounded-full border px-4 py-2 text-[14px] font-semibold transition', custom === v ? 'border-accent bg-accent text-white' : 'border-line text-ink hover:bg-background')}>
                {l}
              </button>
            ))}
          </div>
          {custom ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {TARIFFS.map(([k, l]) => (
                <Field key={k} label={l} error={errors[k]} hint={city ? `Vide = tarif de la ville (${formatMoney(city.rules[k])})` : undefined}>
                  {(f, d) => <UnitInput id={f} aria-describedby={d} unit="MAD" value={tariff[k]} placeholder={city ? mad(city.rules[k]) : ''} onChange={(e) => setTariff({ ...tariff, [k]: e.target.value })} data-testid={`category-${k}`} />}
                </Field>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-background px-4 py-3 text-[14px] text-muted">
              {city ? `Prise en charge ${formatMoney(city.rules.baseFare)} · ${formatMoney(city.rules.perKm)}/km · ${formatMoney(city.rules.perMinute)}/min · minimum ${formatMoney(city.rules.minimumFare)} (${city.name}).` : 'Tarifs de chaque ville.'}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Commission Naya" error={errors.commission}>
              {(f, d) => <UnitInput id={f} aria-describedby={d} unit="%" value={commission} onChange={(e) => setCommission(e.target.value)} data-testid="category-commission" />}
            </Field>
            {example !== null ? (
              <div className="flex flex-col justify-end">
                <div className="rounded-2xl border border-accent/20 bg-selected/60 px-4 py-3" data-testid="category-example">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-accent">Exemple · 10 km, 25 min</div>
                  <div className="mt-0.5 text-[22px] font-semibold tabular">{formatMoney(example)}</div>
                  <div className="text-[12px] text-muted">hors tarification dynamique · {city?.name}</div>
                </div>
              </div>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Disponibilité">
          <SwitchRow title="Catégorie active" hint="Désactivée, elle disparaît des nouvelles commandes." checked={enabled} onChange={setEnabled} testId="category-enabled" />
          <div>
            <p className="label mb-2">Villes</p>
            <div className="flex flex-wrap gap-2">
              <Chip on={!cityIds.length} onClick={() => setCityIds([])}>Toutes les villes</Chip>
              {(cities.data ?? []).map(({ city: c }) => (
                <Chip key={c.id} on={cityIds.includes(c.id)} onClick={() => setCityIds(cityIds.includes(c.id) ? cityIds.filter((x) => x !== c.id) : [...cityIds, c.id])}>
                  {c.name}
                </Chip>
              ))}
            </div>
          </div>
          <div className="sm:max-w-[50%]">
            <Field label="Temps d’arrivée estimé" error={errors.eta} hint="Affiché à la cliente avant confirmation.">
              {(f, d) => <UnitInput id={f} aria-describedby={d} unit="min" value={eta} onChange={(e) => setEta(e.target.value)} data-testid="category-eta" />}
            </Field>
          </div>
        </FormSection>

        <FormSection title="Conditions spécifiques" hint="Affichées à la cliente avec la catégorie, par exemple le nombre de passagères ou les bagages.">
          <TagInput values={conditions} onChange={setConditions} placeholder="Ex. : Jusqu’à 7 passagères" testId="category-condition" />
        </FormSection>
      </div>
    </Dialog>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cx('rounded-full border px-4 py-2 text-[14px] font-semibold transition', on ? 'border-accent bg-selected text-accent' : 'border-line text-ink hover:bg-background')}>
      {children}
    </button>
  );
}
