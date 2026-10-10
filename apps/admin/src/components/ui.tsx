import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Info, Loader2, X, XCircle, Inbox } from 'lucide-react';
import { create } from './store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ───────── Buttons ───────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tonal';
export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: ReactNode;
}

/** Loading keeps the label in layout (hidden) so width never changes; disabled is neutral grey. */
export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }: BtnProps) {
  const base = 'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.985] disabled:active:scale-100 whitespace-nowrap select-none';
  const sizes = size === 'md' ? 'h-11 px-5 text-[15px]' : 'h-9 px-4 text-[14px]';
  const inactive = disabled || loading;
  const variants: Record<Variant, string> = {
    primary: 'text-white bg-gradient-to-b from-[#75415F] via-accent to-[#61304F] shadow-sm hover:brightness-[1.06]',
    secondary: 'bg-surface text-accent border border-line hover:bg-mauve-soft',
    ghost: 'text-accent hover:bg-mauve-soft',
    danger: 'bg-danger text-white hover:brightness-110',
    tonal: 'bg-mauve-soft text-accent hover:bg-selected',
  };
  return (
    <button {...rest} disabled={inactive} aria-busy={loading || undefined} className={cx(base, sizes, disabled ? 'bg-disabled-fill text-disabled-text shadow-none border-transparent bg-none' : variants[variant], className)}>
      <span className={cx('inline-flex items-center gap-2', loading && 'invisible')}>
        {icon}
        {children}
      </span>
      {loading ? <Loader2 className="absolute h-5 w-5 animate-spin" aria-hidden /> : null}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx('inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mauve-soft active:scale-[0.985] transition', className)}>
      {children}
    </button>
  );
}

/* ───────── Surfaces ───────── */

export function Card({ children, className, title, action, subtitle, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {title ? (
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[18px] font-semibold leading-6">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cx(padded && 'px-6 pb-5', padded && !title && 'pt-5')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[13px] text-muted">{eyebrow}</div> : null}
        <h1 className="text-[32px] font-semibold leading-10 tracking-[-0.9px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'warning' | 'success' }) {
  return (
    <div className="min-w-0 border-l-2 border-line pl-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cx('mt-1 text-[28px] font-semibold leading-9 tabular tracking-[-0.4px]', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning', tone === 'success' && 'text-success')}>{value}</div>
      {hint ? <div className="mt-1 text-[12px] text-muted">{hint}</div> : null}
    </div>
  );
}

/* ───────── Status ───────── */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-background text-muted border border-line',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-mauve-soft text-accent',
};
export function Badge({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold', toneClass[tone])}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Banner({ tone = 'info', title, children, action }: { tone?: Exclude<Tone, 'neutral' | 'accent'> | 'accent'; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : Info;
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-2xl p-4', toneClass[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{title}</div>
        {children ? <div className="mt-1 text-[13px] text-ink/85">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/* ───────── States ───────── */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-lg bg-selected motion-reduce:animate-none', className)} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="divide-y divide-line/70">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 px-4 py-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cx('h-4', c === 0 ? 'w-24' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-mauve-soft text-accent">
        <Inbox className="h-6 w-6" aria-hidden />
      </div>
      <div className="text-[16px] font-semibold">{title}</div>
      {message ? <p className="max-w-sm text-[14px] text-muted">{message}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <div className="text-[16px] font-semibold">Impossible de charger ces données</div>
      <p className="max-w-sm text-[14px] text-muted">{message ?? 'Vérifiez que l’API de démonstration est lancée, puis réessayez.'}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

/* ───────── Table ───────── */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  align?: 'left' | 'right';
  className?: string;
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, caption, initialSort }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode; caption: string; initialSort?: { key: string; dir: 'asc' | 'desc' } }) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const col = columns.find((c) => c.key === sort?.key);
  const sorted = col?.sort
    ? [...rows].sort((a, b) => {
        const x = col.sort!(a);
        const y = col.sort!(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr');
        return sort!.dir === 'asc' ? r : -r;
      })
    : rows;
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} scope="col" className={cx('th', c.align === 'right' && 'text-right', c.className)} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button type="button" className={cx('inline-flex items-center gap-1 hover:text-ink', c.align === 'right' && 'flex-row-reverse')} onClick={() => setSort({ key: c.key, dir: active && sort!.dir === 'desc' ? 'asc' : 'desc' })}>
                      {c.header}
                      {active ? sort!.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              className={cx(onRowClick && 'cursor-pointer hover:bg-background/80 focus-within:bg-background/80')}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(r)) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              data-testid={`row-${rowKey(r)}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={cx('td', c.align === 'right' && 'whitespace-nowrap text-right tabular', c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ cursor, total, limit, onChange }: { cursor: number; total: number; limit: number; onChange: (c: number) => void }) {
  if (total <= limit) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line/70 px-4 py-3 text-[13px] text-muted">
      <span className="tabular">
        {cursor + 1}–{Math.min(cursor + limit, total)} sur {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={cursor === 0} onClick={() => onChange(Math.max(0, cursor - limit))}>
          Précédent
        </Button>
        <Button size="sm" variant="secondary" disabled={cursor + limit >= total} onClick={() => onChange(cursor + limit)}>
          Suivant
        </Button>
      </div>
    </nav>
  );
}

/* ───────── Form fields ───────── */

export function Field({ label, error, hint, children, id }: { label: string; error?: string | null; hint?: ReactNode; children: (id: string, describedBy: string | undefined) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = error ? `${fid}-error` : hint ? `${fid}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="label">
        {label}
      </label>
      {children(fid, describedBy)}
      {error ? (
        <p id={`${fid}-error`} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('field', p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx('field pr-8', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx('field h-auto min-h-[96px] py-2.5', p.className)} />;

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-selected p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cx('h-8 rounded-full px-3.5 text-[13px] font-semibold transition', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── Overlays ───────── */

function useFocusTrap(open: boolean, onEscape: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    setTimeout(() => (focusables()[0] ?? el)?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onEscape]);
  return ref;
}

export function Dialog({ open, onClose, title, description, children, footer, busy, testId, size = 'md' }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode; busy?: boolean; testId?: string; size?: 'md' | 'lg' }) {
  const ref = useFocusTrap(open, () => !busy && onClose());
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={() => !busy && onClose()} aria-hidden />
      {/* Title and actions stay visible; only the body scrolls on long forms. */}
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabIndex={-1} data-testid={testId} className={cx('relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-3xl bg-surface shadow-float', size === 'lg' ? 'max-w-[760px]' : 'max-w-[460px]')}>
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 id="dlg-title" className="text-[19px] font-semibold leading-6">
              {title}
            </h2>
            {description ? <div className="mt-2 text-[14px] text-muted">{description}</div> : null}
          </div>
          <IconButton label="Fermer" onClick={() => !busy && onClose()} className="-mr-2 -mt-1 shrink-0">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        {children ? <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-1">{children}</div> : null}
        {footer ? <div className="mt-4 flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div> : <div className="pb-6" />}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, subtitle }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode }) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-surface shadow-float">
        <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-[18px] font-semibold">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div> : null}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ───────── Toasts ───────── */

type ToastItem = { id: number; message: string; tone: 'default' | 'success' | 'danger' };
export const useToasts = create<{ items: ToastItem[]; push: (m: string, tone?: ToastItem['tone']) => void; remove: (id: number) => void }>((set, get) => ({
  items: [],
  push: (message, tone = 'default') => {
    const id = Date.now() + Math.random();
    set({ items: [...get().items, { id, message, tone }] });
    setTimeout(() => get().remove(id), 4000);
  },
  remove: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));
export const toast = (m: string, tone?: ToastItem['tone']) => useToasts.getState().push(m, tone);

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div key={t.id} role="status" className={cx('rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-float', t.tone === 'danger' ? 'bg-danger' : t.tone === 'success' ? 'bg-success' : 'bg-ink')}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-6 gap-y-2.5 text-[14px]">
      {items.map((i) => (
        <div key={i.term} className="contents">
          <dt className="text-muted">{i.term}</dt>
          <dd className="min-w-0 break-words tabular">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
