import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CreditCard, FileText, LogOut, MapPin, Menu, MessageCircle, Route, ShieldCheck, Users, Wallet, X, Lock } from 'lucide-react';
import type { AdminPermission } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/context';
import { BrandMark } from './Brand';
import { Button, cx, IconButton } from './ui';
import { CityBadge } from './status';

export const NAV: { to: string; label: string; icon: typeof BarChart3; permission?: AdminPermission; group: 'travail' | 'gestion' }[] = [
  { to: '/', label: 'Vue d’ensemble', icon: BarChart3, group: 'travail' },
  { to: '/verifications', label: 'Vérifications', icon: ShieldCheck, permission: 'people.read', group: 'travail' },
  { to: '/personnes', label: 'Personnes & véhicules', icon: Users, permission: 'people.read', group: 'travail' },
  { to: '/courses', label: 'Courses', icon: Route, permission: 'rides.read', group: 'travail' },
  { to: '/support', label: 'Support', icon: MessageCircle, permission: 'support.resolve', group: 'travail' },
  { to: '/finance', label: 'Finance', icon: Wallet, permission: 'finance.read', group: 'gestion' },
  { to: '/villes', label: 'Villes & règles', icon: MapPin, group: 'gestion' },
  { to: '/paiements', label: 'Paiements', icon: CreditCard, group: 'gestion' },
  { to: '/services', label: 'Services et familles', icon: Users, permission: 'config.edit', group: 'gestion' },
  { to: '/audit', label: 'Journal d’audit', icon: FileText, permission: 'audit.read', group: 'gestion' },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  const section = (g: 'travail' | 'gestion', label: string) => (
    <div>
      <div className="px-3 pb-2 pt-5 text-[11px] font-medium uppercase tracking-[0.09em] text-white/45">{label}</div>
      <ul className="flex flex-col gap-1">
        {NAV.filter((n) => n.group === g).map((n) => {
          const allowed = !n.permission || can(n.permission);
          return (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-2xl px-3 text-[13px] font-medium transition', isActive ? 'bg-white text-accent font-semibold shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white')}
              >
                <n.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className="flex-1 truncate">{n.label}</span>
                {!allowed ? <Lock className="h-3.5 w-3.5 text-muted" aria-label="Accès restreint" /> : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3">
      {section('travail', 'Espace de travail')}
      {section('gestion', 'Gestion')}
    </nav>
  );
}

function AdminFooter() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="m-3 flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-white">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-selected text-[14px] font-semibold text-accent" aria-hidden>
        {admin?.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{admin?.name}</div>
        <div className="truncate text-[12px] text-white/55">{admin?.title}</div>
      </div>
      <IconButton
        label="Se déconnecter"
        onClick={async () => {
          await logout();
          navigate('/connexion');
        }}
        data-testid="logout" className="text-white/70 hover:bg-white/10"
      >
        <LogOut className="h-[18px] w-[18px]" />
      </IconButton>
    </div>
  );
}

export function CitySwitcher() {
  const { cityId, setCityId } = useWorkspace();
  const cities = useQuery({ queryKey: ['admin', 'cities'], queryFn: api.admin.cities });
  const current = cities.data?.find((c) => c.city.id === cityId)?.city;
  return (
    <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-3.5 pr-2 shadow-card">
      <MapPin className="h-4 w-4 text-accent" aria-hidden />
      <span className="sr-only">Ville de travail</span>
      <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="h-9 bg-transparent pr-1 text-[14px] font-semibold text-ink focus:outline-none" data-testid="city-switcher">
        {(cities.data ?? [{ city: { id: 'rabat', name: 'Rabat' } }]).map((c) => (
          <option key={c.city.id} value={c.city.id}>
            {c.city.name}
          </option>
        ))}
      </select>
      {current ? <CityBadge status={current.status} /> : null}
    </label>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="min-h-screen lg:pl-[280px]">
      <aside className="admin-sidebar fixed inset-y-4 left-4 z-30 hidden w-[252px] flex-col rounded-[28px] bg-[#302532] shadow-float lg:flex">
        <div className="flex h-20 items-center px-6">
          <BrandMark height={24} />
          <span className="ml-3 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-white/70">Admin</span>
        </div>
        <Nav />
        <AdminFooter />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="admin-sidebar absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[#302532] shadow-float" aria-label="Menu">
            <div className="flex h-16 items-center justify-between px-5">
              <BrandMark height={24} />
              <IconButton label="Fermer le menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
            <AdminFooter />
          </aside>
        </div>
      ) : null}
      <div className="sticky top-0 z-20 flex h-20 items-center gap-3 bg-background/85 px-5 backdrop-blur-xl lg:px-10">
        <IconButton label="Ouvrir le menu" className="lg:hidden" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </IconButton>
        <div className="flex flex-1 items-center gap-3 text-[13px]"><span className="hidden text-muted sm:inline">Espace Naya</span><span className="hidden text-line sm:inline">/</span><span className="font-medium">{NAV.find((n) => n.to === location.pathname)?.label ?? 'Détail du dossier'}</span></div>
        <CitySwitcher />
      </div>
      <main key={location.pathname} className="mx-auto max-w-[1320px] px-5 pb-16 pt-6 lg:px-10">
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2 px-5 pb-8 text-[12px] text-muted lg:px-8">
        <span>Environnement de démonstration · données fictives</span>
        <span>© OpenStreetMap contributors</span>
      </footer>
    </div>
  );
}

/** A00-denied: shown in place of a page the administrator's role cannot open. */
export function RequirePermission({ permission, page, children }: { permission?: AdminPermission; page: string; children: ReactNode }) {
  const { can, admin } = useAuth();
  const navigate = useNavigate();
  if (!permission || can(permission)) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-[520px]" data-testid="access-denied">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Lock className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-semibold">Accès refusé</h1>
        <p className="mt-2 text-[14px] text-muted">
          Votre rôle ({admin?.title}) ne permet pas d’ouvrir « {page} ». Demandez l’accès à une administratrice si cette tâche vous est confiée.
        </p>
        <p className="mt-3 text-[12px] text-muted">
          Permission requise : <code className="rounded bg-background px-1.5 py-0.5">{permission}</code>
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => navigate('/')}>
          Revenir à la vue d’ensemble
        </Button>
      </div>
    </div>
  );
}
