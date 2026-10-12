import { useState } from 'react';
import { Plus } from './icons';
import type { CancelReason } from '@naya/domain';
import { Button, Card } from './ui';
import { Switch, slugify } from './form';

const ROLES: { role: CancelReason['role']; title: string; hint: string }[] = [
  { role: 'passenger', title: 'Passagères', hint: 'Proposés quand une passagère annule une course ou une réservation.' },
  { role: 'driver', title: 'Chauffeuses', hint: 'Proposés quand une chauffeuse annule une course acceptée.' },
];

/** Cancellation reasons per role: rename, enable or disable, add. Apps read them at runtime. */
export function CancelReasonsPanel({ reasons, busy, onSave }: { reasons: CancelReason[]; busy: boolean; onSave: (r: CancelReason) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ROLES.map(({ role, title, hint }) => {
        const list = reasons.filter((r) => r.role === role);
        const label = adding[role] ?? '';
        return (
          <Card key={role} title={title} subtitle={hint}>
            <ul className="flex flex-col gap-2" data-testid={`cancel-reasons-${role}`}>
              {list.map((r) => {
                const key = `${r.role}:${r.id}`;
                const draft = drafts[key] ?? r.label;
                return (
                  <li key={key} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${r.enabled ? 'border-line' : 'border-dashed border-line opacity-70'}`}>
                    <input className="field h-10 flex-1" value={draft} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} aria-label={`Libellé du motif ${r.id}`} maxLength={80} />
                    {draft.trim() && draft !== r.label ? <Button size="sm" variant="secondary" loading={busy} onClick={() => onSave({ ...r, label: draft.trim() })}>Enregistrer</Button> : null}
                    <Switch checked={r.enabled} disabled={busy || (r.id === 'other' && r.enabled)} onChange={(v) => onSave({ ...r, enabled: v })} label={`${r.enabled ? 'Désactiver' : 'Activer'} ${r.label}`} testId={`cancel-reason-toggle-${role}-${r.id}`} />
                  </li>
                );
              })}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const id = slugify(label);
                if (!label.trim() || !id || list.some((r) => r.id === id)) return;
                onSave({ id, label: label.trim(), role, enabled: true });
                setAdding((a) => ({ ...a, [role]: '' }));
              }}
            >
              <input className="field h-11 flex-1" placeholder="Nouveau motif…" value={label} onChange={(e) => setAdding((a) => ({ ...a, [role]: e.target.value }))} maxLength={80} data-testid={`cancel-reason-new-${role}`} />
              <Button type="submit" variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={!label.trim()} loading={busy}>Ajouter</Button>
            </form>
            <p className="mt-2 text-[12px] text-muted">« Autre raison » reste toujours proposée en dernier, avec un champ libre.</p>
          </Card>
        );
      })}
    </div>
  );
}
