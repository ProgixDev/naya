import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Textarea, cx } from './ui';

/** Building blocks shared by every back-office form and modal, so they look and behave the same. */

export const slugify = (s: string, max = 40) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max);

/** A titled group of fields, separated from the previous group by a rule. */
export function FormSection({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-0 first:pt-0">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {hint ? <p className="mt-0.5 text-[13px] text-muted">{hint}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Input with its unit inside the field (MAD, %, min, km, jours…). */
export function UnitInput({ unit, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className="relative">
      <Input inputMode="decimal" {...p} className={cx('pr-16 tabular', className)} />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-muted">{unit}</span>
    </div>
  );
}

export function Switch({ checked, onChange, label, testId, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50', checked ? 'bg-accent' : 'bg-line')}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-[2px]')} />
    </button>
  );
}

/** A setting with a title, an explanation and a switch, in a bordered row. */
export function SwitchRow({ title, hint, checked, onChange, testId }: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
      <div>
        <div className="text-[14px] font-semibold">{title}</div>
        {hint ? <div className="text-[13px] text-muted">{hint}</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} testId={testId} />
    </div>
  );
}

/** Pill choices. Single choice by default; `multiple` toggles values in a list. */
export function ChoiceChips<T extends string>(p: { label?: string; options: { value: T; label: string }[]; testIdPrefix?: string } & ({ multiple?: false; value: T; onChange: (v: T) => void } | { multiple: true; value: T[]; onChange: (v: T[]) => void })) {
  const on = (v: T) => (p.multiple ? p.value.includes(v) : p.value === v);
  return (
    <div className="flex flex-wrap gap-2" role={p.multiple ? 'group' : 'radiogroup'} aria-label={p.label}>
      {p.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role={p.multiple ? undefined : 'radio'}
          aria-checked={p.multiple ? undefined : on(o.value)}
          aria-pressed={p.multiple ? on(o.value) : undefined}
          data-testid={p.testIdPrefix ? `${p.testIdPrefix}-${o.value}` : undefined}
          onClick={() => (p.multiple ? p.onChange(on(o.value) ? p.value.filter((x) => x !== o.value) : [...p.value, o.value]) : p.onChange(o.value))}
          className={cx('rounded-full border px-4 py-2 text-[14px] font-semibold transition', on(o.value) ? 'border-accent bg-selected text-accent' : 'border-line text-ink hover:bg-background')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Radio cards with a title and an explanation, for choices whose consequences differ. */
export function ChoiceCards<T extends string>({ label, value, options, onChange, columns = 1, testIdPrefix }: { label?: string; value: T; options: { value: T; label: string; hint?: string; icon?: ReactNode; tone?: 'danger' | 'warning' | 'success' }[]; onChange: (v: T) => void; columns?: 1 | 2 | 3; testIdPrefix?: string }) {
  return (
    <div className={cx('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={testIdPrefix ? `${testIdPrefix}-${o.value}` : undefined}
            onClick={() => onChange(o.value)}
            className={cx('flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition', on ? 'border-accent bg-selected ring-1 ring-accent' : 'border-line hover:border-accent/40 hover:bg-background')}
          >
            <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-accent' : 'border-line')}>{on ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}</span>
            {o.icon ? <span className={cx('mt-0.5 shrink-0', o.tone === 'danger' ? 'text-danger' : o.tone === 'warning' ? 'text-warning' : o.tone === 'success' ? 'text-success' : 'text-accent')}>{o.icon}</span> : null}
            <span>
              <span className={cx('block text-[14px] font-semibold', on && 'text-accent')}>{o.label}</span>
              {o.hint ? <span className="mt-0.5 block text-[13px] text-muted">{o.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Editable list of short texts shown as removable chips; Enter adds the draft. */
export function TagInput({ values, onChange, placeholder, max = 8, testId }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; testId?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v) || values.length >= max) return;
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-3">
      {values.length ? (
        <ul className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-background py-1.5 pl-3 pr-1.5 text-[14px]">
              {v}
              <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {values.length < max ? (
        <div className="flex gap-2">
          <Input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} onBlur={add} data-testid={testId} />
          <Button type="button" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={add} disabled={!draft.trim()}>Ajouter</Button>
        </div>
      ) : null}
    </div>
  );
}

/** Audit reason, shared by every sensitive action: live counter against the minimum length. */
export function ReasonField({ value, onChange, label = 'Motif', min = 10, placeholder, testId, error, hint = 'Inscrit au journal d’audit avec votre nom.' }: { value: string; onChange: (v: string) => void; label?: string; min?: number; placeholder?: string; testId?: string; error?: string | null; hint?: string }) {
  const n = value.trim().length;
  const ok = n >= min;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={testId ?? 'reason-field'}>{label}</label>
      <Textarea id={testId ?? 'reason-field'} value={value} placeholder={placeholder ?? 'Pourquoi cette action ? Visible dans le journal d’audit.'} onChange={(e) => onChange(e.target.value)} data-testid={testId} className="min-h-[84px]" />
      <div className="flex justify-between text-[12px]">
        <span className={error ? 'font-medium text-danger' : 'text-muted'}>{error ?? hint}</span>
        <span className={cx('tabular', ok ? 'text-success' : 'text-muted')}>{ok ? '✓' : `${n} / ${min} caractères`}</span>
      </div>
    </div>
  );
}

/** What will happen when the action is confirmed. */
export function ImpactList({ items, tone = 'neutral' }: { items: ReactNode[]; tone?: 'neutral' | 'warning' | 'danger' | 'success' }) {
  return (
    <ul className={cx('flex flex-col gap-1.5 rounded-2xl px-4 py-3 text-[14px]', tone === 'danger' ? 'bg-danger-soft' : tone === 'warning' ? 'bg-warning-soft' : tone === 'success' ? 'bg-success-soft' : 'bg-background')}>
      {items.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-muted">•</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}
