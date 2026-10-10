import { useMemo, useState } from 'react';
import { Bike, Car, Gem, Search } from 'lucide-react';
import type { ServiceCategory } from '@naya/domain';
import { Badge, Card, EmptyState, Input, cx } from './ui';

const ICON = { scooter: Bike, car: Car, premium: Gem } as const;

type Driver = { id: string; name: string; cityId: string };

/**
 * Which vehicle categories each driver may receive offers for. Rows are drivers, columns
 * categories; every change is saved at once. No explicit choice = every category.
 */
export function DriverCategoryMatrix({
  drivers,
  categories,
  allowed,
  busy,
  onChange,
}: {
  drivers: Driver[];
  categories: ServiceCategory[];
  /** Driver id → allowed category ids (missing = all). */
  allowed: Record<string, string[]>;
  busy: boolean;
  /** Saves the new list for each driver given. */
  onChange: (changes: { driverId: string; categoryIds: string[] }[]) => void;
}) {
  const [q, setQ] = useState('');
  const all = categories.map((c) => c.id);
  const of = (id: string) => allowed[id] ?? all;
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return drivers.filter((d) => !n || d.name.toLowerCase().includes(n) || d.cityId.includes(n));
  }, [drivers, q]);
  const toggle = (d: Driver, c: string) => {
    const cur = of(d.id);
    onChange([{ driverId: d.id, categoryIds: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] }]);
  };
  const column = (c: string, on: boolean) =>
    onChange(
      shown
        .filter((d) => of(d.id).includes(c) !== on)
        .map((d) => ({ driverId: d.id, categoryIds: on ? [...of(d.id), c] : of(d.id).filter((x) => x !== c) })),
    );

  return (
    <Card
      className="mt-5"
      title="Catégories autorisées par chauffeuse"
      subtitle="Une chauffeuse ne reçoit que les courses des catégories activées. Chaque changement est enregistré immédiatement."
      padded={false}
      action={
        <label className="relative block w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Rechercher une chauffeuse" placeholder="Rechercher une chauffeuse" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </label>
      }
    >
      {!shown.length ? (
        <EmptyState title="Aucune chauffeuse" message={q ? 'Aucun résultat pour cette recherche.' : 'Aucune chauffeuse enregistrée.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left" data-testid="driver-categories">
            <thead>
              <tr className="border-y border-line bg-background/60">
                <th scope="col" className="px-6 py-3 text-caption font-semibold text-muted">Chauffeuse</th>
                {categories.map((c) => {
                  const Icon = ICON[c.icon] ?? Car;
                  const count = shown.filter((d) => of(d.id).includes(c.id)).length;
                  return (
                    <th key={c.id} scope="col" className="px-4 py-3 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cx('flex h-9 w-9 items-center justify-center rounded-full', c.enabled ? 'bg-selected text-accent' : 'bg-line text-muted')}>
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="text-caption font-semibold text-ink">{c.name}</span>
                        <span className="text-micro tabular text-muted">{count} / {shown.length}</span>
                        {!c.enabled ? <Badge tone="neutral" dot={false}>Désactivée</Badge> : null}
                        <span className="flex gap-2 text-micro">
                          <button type="button" className="font-semibold text-accent hover:underline disabled:opacity-40" disabled={busy || count === shown.length} onClick={() => column(c.id, true)}>Tout</button>
                          <span className="text-line">|</span>
                          <button type="button" className="font-semibold text-muted hover:underline disabled:opacity-40" disabled={busy || count === 0} onClick={() => column(c.id, false)}>Aucune</button>
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th scope="col" className="px-6 py-3 text-right text-caption font-semibold text-muted">Accès</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const mine = of(d.id);
                const n = categories.filter((c) => mine.includes(c.id)).length;
                const initials = d.name.split(' ').map((x) => x[0]).slice(0, 2).join('');
                return (
                  <tr key={d.id} className="border-b border-line/70 last:border-0 hover:bg-background/50">
                    <th scope="row" className="px-6 py-3 font-normal">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-micro font-semibold text-white" aria-hidden>{initials}</span>
                        <div>
                          <div className="text-[15px] font-semibold text-ink">{d.name}</div>
                          <div className="text-micro capitalize text-muted">{d.cityId}</div>
                        </div>
                      </div>
                    </th>
                    {categories.map((c) => {
                      const on = mine.includes(c.id);
                      return (
                        <td key={c.id} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`${c.name} pour ${d.name}`}
                            disabled={busy}
                            onClick={() => toggle(d, c.id)}
                            data-testid={`dc-${d.id}-${c.id}`}
                            className={cx(
                              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60',
                              on ? 'bg-accent' : 'bg-line',
                            )}
                          >
                            <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-[2px]')} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-6 py-3 text-right">
                      {n === 0 ? (
                        <Badge tone="danger">Aucune course</Badge>
                      ) : n === categories.length ? (
                        <Badge tone="success">Toutes</Badge>
                      ) : (
                        <Badge tone="warning">{n} / {categories.length}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
