'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { X, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useNaya } from '@/lib/store';

export function useDisclosureFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  trap = false,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const items = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((e) => e.getClientRects().length && !e.closest('[hidden],[inert]'));
    if (trap) document.body.style.overflow = 'hidden';
    (items()[0] ?? ref.current)?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key === 'Tab' && trap) {
        const list = items();
        const first = list[0],
          last = list.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      if (trap) document.body.style.overflow = overflow;
      if (previous?.isConnected && !previous.closest('[hidden],[inert]')) previous.focus();
    };
  }, [open, ref, trap]);
}

export function Hydrate() {
  useEffect(() => {
    useNaya.persist.rehydrate();
  }, []);
  return null;
}
export function Toast() {
  const toast = useNaya((s) => s.toast),
    notify = useNaya((s) => s.notify);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => notify(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, notify]);
  return toast ? (
    <div className="toast" role="status">
      <CheckCircle2 size={19} />
      <span>{toast}</span>
      <button onClick={() => notify(null)} aria-label="Fermer la notification">
        <X size={17} />
      </button>
    </div>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement | null = ref.current?.parentElement ?? null;
    while (branch && branch !== document.body) {
      for (const sibling of Array.from(branch.parentElement?.children ?? [])) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((item) => item.getClientRects().length && !item.closest('[hidden],[inert]'));
        if (items.length) {
          const first = items[0],
            last = items[items.length - 1];
          if (!ref.current?.contains(document.activeElement)) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
          } else if (
            e.shiftKey &&
            (document.activeElement === first || document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      for (const { element, inert } of background) element.inert = inert;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className={`modal-overlay ${drawer ? 'detail-overlay' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''} ${drawer ? 'detail-drawer' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const status = String(children);
  const tone = ['Terminée', 'En ligne', 'Validé', 'Résolu', 'Accepté'].includes(status)
    ? 'green'
    : ['En cours', 'Planifiée'].includes(status)
      ? 'plum'
      : ['À vérifier', 'Ouvert', 'Haute', 'À examiner', 'À compléter'].includes(status)
        ? 'amber'
        : ['Annulée', 'Refusée'].includes(status)
          ? 'red'
          : 'gray';
  return (
    <span className={`badge badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      {name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0])
        .join('')}
    </span>
  );
}
export function Empty({
  title = 'Aucun résultat',
  description = 'Essayez de modifier vos filtres.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <span>↗</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Arrow() {
  return <ArrowUpRight size={18} />;
}
export function exportCsv(name: string, rows: Record<string, string | number>[]) {
  if (!rows.length) {
    useNaya.getState().notify('Aucune donnée à exporter');
    return;
  }
  const keys = Object.keys(rows[0]);
  const encode = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv =
    '\uFEFF' +
    [
      keys.map(encode).join(';'),
      ...rows.map((row) => keys.map((k) => encode(row[k])).join(';')),
    ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  useNaya.getState().notify('Export téléchargé');
}
