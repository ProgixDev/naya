import { useState } from 'react';
import { CalendarHeart, MessageSquareWarning } from 'lucide-react';
import { formatMoney, type DisputeReason, type FamilyPlan } from '@naya/domain';
import { toCentimes } from '../lib/format';
import { Banner, Button, Dialog, Field, Input } from './ui';
import { ChoiceChips, FormSection, SwitchRow, TagInput, UnitInput, slugify } from './form';

const mad = (c: number) => String(c / 100).replace('.', ',');

function useSave<T>(onSave: (v: T) => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const save = async (v: T) => {
    setError(null);
    try {
      await onSave(v);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return { error, save };
}

/** Family subscription plan: price, duration, included trips, dedicated driver, features. */
export function PlanEditor({ initial, isNew, busy, onSave, onClose }: { initial: FamilyPlan; isNew: boolean; busy: boolean; onSave: (p: FamilyPlan) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [id, setId] = useState(initial.id);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [price, setPrice] = useState(isNew ? '' : mad(initial.price));
  const [days, setDays] = useState(String(initial.durationDays));
  const [trips, setTrips] = useState(String(initial.includedTrips));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [dedicated, setDedicated] = useState(initial.dedicatedDriver !== false);
  const [features, setFeatures] = useState(initial.features);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { error, save } = useSave(onSave);
  const priceC = toCentimes(price);
  const daysN = Number(days);
  const tripsN = Number(trips);
  const perTrip = priceC && tripsN > 0 ? Math.round(priceC / tripsN) : null;
  const submit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Nom requis.';
    if (!/^[a-z0-9-]{2,40}$/.test(id)) e.id = 'Minuscules, chiffres et tirets.';
    if (priceC === null || priceC <= 0) e.price = 'Prix en MAD, ex. 590.';
    if (!Number.isInteger(daysN) || daysN < 1 || daysN > 365) e.days = 'Entre 1 et 365 jours.';
    if (!Number.isInteger(tripsN) || tripsN < 1 || tripsN > 500) e.trips = 'Entre 1 et 500 trajets.';
    if (!features.length) e.features = 'Ajoutez au moins une fonctionnalité incluse.';
    setErrors(e);
    if (Object.keys(e).length) return;
    void save({ ...initial, id, name: name.trim(), price: priceC!, durationDays: daysN, includedTrips: tripsN, enabled, dedicatedDriver: dedicated, features });
  };
  return (
    <Dialog
      open
      size="lg"
      icon={<CalendarHeart />}
      onClose={onClose}
      busy={busy}
      testId="plan-editor"
      title={isNew ? 'Nouvel abonnement famille' : `Modifier · ${initial.name}`}
      description="Proposé aux familles dans l’espace Naya Famille. Les abonnements en cours gardent leurs conditions."
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button><Button loading={busy} onClick={submit} data-testid="plan-save">{isNew ? 'Créer l’abonnement' : 'Enregistrer'}</Button></>}
    >
      <div className="flex flex-col gap-6 pb-2">
        {error ? <Banner tone="danger" title={error} /> : null}
        <FormSection title="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom affiché" error={errors.name}>{(f, d) => <Input id={f} aria-describedby={d} value={name} placeholder="Ex. : Famille Sérénité" onChange={(e) => { setName(e.target.value); if (!idTouched) setId(slugify(`famille-${e.target.value.replace(/^famille\s*/i, '')}`)); }} data-testid="plan-name" />}</Field>
            <Field label="Identifiant" error={errors.id} hint={isNew ? 'Généré à partir du nom. Ne pourra plus changer.' : 'Ne peut plus être modifié.'}>{(f, d) => <Input id={f} aria-describedby={d} value={id} disabled={!isNew} className="font-mono text-[14px]" onChange={(e) => { setIdTouched(true); setId(e.target.value.toLowerCase()); }} />}</Field>
          </div>
        </FormSection>
        <FormSection title="Prix et durée">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prix" error={errors.price}>{(f, d) => <UnitInput id={f} aria-describedby={d} unit="MAD" value={price} placeholder="590" onChange={(e) => setPrice(e.target.value)} data-testid="plan-price" />}</Field>
            <Field label="Durée" error={errors.days}>{(f, d) => <UnitInput id={f} aria-describedby={d} unit="jours" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />}</Field>
            <Field label="Trajets inclus" error={errors.trips}>{(f, d) => <UnitInput id={f} aria-describedby={d} unit="trajets" inputMode="numeric" value={trips} onChange={(e) => setTrips(e.target.value)} />}</Field>
          </div>
          {perTrip ? (
            <p className="rounded-2xl bg-background px-4 py-3 text-[14px]">
              Soit <strong className="tabular">{formatMoney(perTrip)}</strong> par trajet inclus{daysN > 0 ? <> · <strong className="tabular">{formatMoney(Math.round((priceC! * 30) / daysN))}</strong> par mois</> : null}.
            </p>
          ) : null}
        </FormSection>
        <FormSection title="Options">
          <SwitchRow title="Chauffeuse dédiée" hint="Une chauffeuse attitrée par famille. Désactivé : trajets assurés par le pool de chauffeuses famille." checked={dedicated} onChange={setDedicated} testId="plan-dedicated" />
          <SwitchRow title="Abonnement proposé" hint="Désactivé, il n’est plus proposé aux nouvelles familles." checked={enabled} onChange={setEnabled} testId="plan-enabled" />
        </FormSection>
        <FormSection title="Fonctionnalités incluses" hint="Affichées aux familles avant la souscription.">
          <TagInput values={features} onChange={setFeatures} placeholder="Ex. : Suivi en direct" testId="plan-feature" />
          {errors.features ? <p className="text-[13px] font-medium text-danger">{errors.features}</p> : null}
        </FormSection>
      </div>
    </Dialog>
  );
}

const CATEGORY_OPTIONS: { value: DisputeReason['category']; label: string }[] = [
  { value: 'ride', label: 'Course' },
  { value: 'payment', label: 'Paiement' },
  { value: 'safety', label: 'Sécurité' },
  { value: 'wallet', label: 'Portefeuille' },
  { value: 'account', label: 'Compte' },
  { value: 'other', label: 'Autre' },
];
type Audience = 'all' | 'passenger' | 'driver';

/** Dispute reason: label, category, who can choose it, required evidence. */
export function ReasonEditor({ initial, isNew, busy, onSave, onClose }: { initial: DisputeReason; isNew: boolean; busy: boolean; onSave: (r: DisputeReason) => Promise<void>; onClose: () => void }) {
  const [label, setLabel] = useState(initial.label);
  const [id, setId] = useState(initial.id);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [category, setCategory] = useState(initial.category);
  const [audience, setAudience] = useState<Audience>(!initial.roles?.length || initial.roles.length === 2 ? 'all' : initial.roles[0]!);
  const [evidence, setEvidence] = useState(initial.evidenceRequired);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { error, save } = useSave(onSave);
  const submit = () => {
    const e: Record<string, string> = {};
    if (label.trim().length < 3) e.label = 'Libellé requis.';
    if (!/^[a-z0-9_-]{2,40}$/.test(id)) e.id = 'Minuscules, chiffres, tirets.';
    setErrors(e);
    if (Object.keys(e).length) return;
    void save({ ...initial, id, label: label.trim(), category, roles: audience === 'all' ? [] : [audience], evidenceRequired: evidence, enabled });
  };
  return (
    <Dialog
      open
      icon={<MessageSquareWarning />}
      onClose={onClose}
      busy={busy}
      testId="reason-editor"
      title={isNew ? 'Nouveau motif de litige' : `Modifier · ${initial.label}`}
      description="Proposé à l’ouverture d’un litige, dans l’application de la personne concernée."
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button><Button loading={busy} onClick={submit} data-testid="reason-save">{isNew ? 'Créer le motif' : 'Enregistrer'}</Button></>}
    >
      <div className="flex flex-col gap-6 pb-2">
        {error ? <Banner tone="danger" title={error} /> : null}
        <FormSection title="Motif">
          <Field label="Libellé affiché" error={errors.label}>{(f, d) => <Input id={f} aria-describedby={d} value={label} placeholder="Ex. : Retard important" onChange={(e) => { setLabel(e.target.value); if (!idTouched) setId(slugify(e.target.value).replace(/-/g, '_')); }} data-testid="reason-label" />}</Field>
          <Field label="Identifiant" error={errors.id} hint={isNew ? 'Généré à partir du libellé.' : 'Ne peut plus être modifié.'}>{(f, d) => <Input id={f} aria-describedby={d} value={id} disabled={!isNew} className="font-mono text-[14px]" onChange={(e) => { setIdTouched(true); setId(e.target.value.toLowerCase()); }} />}</Field>
          <div>
            <p className="label mb-2">Catégorie</p>
            <ChoiceChips label="Catégorie" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} testIdPrefix="reason-category" />
          </div>
          <div>
            <p className="label mb-2">Proposé à</p>
            <ChoiceChips<Audience> label="Proposé à" value={audience} options={[{ value: 'all', label: 'Clientes et chauffeuses' }, { value: 'passenger', label: 'Clientes uniquement' }, { value: 'driver', label: 'Chauffeuses uniquement' }]} onChange={setAudience} />
          </div>
        </FormSection>
        <FormSection title="Règles">
          <SwitchRow title="Photo ou document obligatoire" hint="Le litige ne peut pas être envoyé sans pièce jointe (accident, véhicule…)." checked={evidence} onChange={setEvidence} testId="reason-evidence" />
          <SwitchRow title="Motif proposé" hint="Désactivé, il disparaît des nouveaux litiges ; les litiges existants le gardent." checked={enabled} onChange={setEnabled} testId="reason-enabled" />
        </FormSection>
      </div>
    </Dialog>
  );
}
