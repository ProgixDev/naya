import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Period = 'today' | '7d' | '30d' | 'all';
export const PERIOD_LABELS: Record<Period, string> = { today: 'Aujourd’hui', '7d': '7 derniers jours', '30d': '30 derniers jours', all: 'Depuis le lancement' };

interface Workspace {
  cityId: string;
  setCityId: (id: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
}

const Ctx = createContext<Workspace | null>(null);

/** City context is kept across pages and reloads so an administrator never edits the wrong city unknowingly. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [cityId, setCityId] = useState(() => localStorage.getItem('naya.admin.city') ?? 'rabat');
  const [period, setPeriod] = useState<Period>(() => (localStorage.getItem('naya.admin.period') as Period) ?? '7d');
  useEffect(() => localStorage.setItem('naya.admin.city', cityId), [cityId]);
  useEffect(() => localStorage.setItem('naya.admin.period', period), [period]);
  const v = useMemo(() => ({ cityId, setCityId, period, setPeriod }), [cityId, period]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace outside provider');
  return v;
}
