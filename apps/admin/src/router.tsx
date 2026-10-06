import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { useAuth } from './lib/auth';
import { Layout, RequirePermission } from './components/Layout';
import { LoginPage } from './pages/Login';


/** Pages load on demand: the sign-in screen stays in the initial bundle, everything else is split per route. */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const OverviewPage = page(() => import('./pages/Overview'), 'OverviewPage');
const VerificationsPage = page(() => import('./pages/Verifications'), 'VerificationsPage');
const CaseReviewPage = page(() => import('./pages/CaseReview'), 'CaseReviewPage');
const PeoplePage = page(() => import('./pages/People'), 'PeoplePage');
const PersonPage = page(() => import('./pages/Person'), 'PersonPage');
const RidesPage = page(() => import('./pages/Rides'), 'RidesPage');
const RidePage = page(() => import('./pages/Ride'), 'RidePage');
const SupportPage = page(() => import('./pages/Support'), 'SupportPage');
const TicketPage = page(() => import('./pages/Ticket'), 'TicketPage');
const FinancePage = page(() => import('./pages/Finance'), 'FinancePage');
const CitiesPage = page(() => import('./pages/Cities'), 'CitiesPage');
const RulesPage = page(() => import('./pages/Rules'), 'RulesPage');
const ProvidersPage = page(() => import('./pages/Providers'), 'ProvidersPage');
const AuditPage = page(() => import('./pages/Audit'), 'AuditPage');
const PrototypePage = page(() => import('./pages/Prototype'), 'PrototypePage');
const NotFoundPage = page(() => import('./pages/NotFound'), 'NotFoundPage');

function PageFallback() {
  return (
    <div className="flex flex-col gap-4 p-2" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-selected motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-card bg-selected/70 motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-card bg-selected/50 motion-reduce:animate-none" />
    </div>
  );
}

const S = (el: ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

function RequireAuth({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  const location = useLocation();
  if (!admin) return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  return admin ? <Navigate to="/" replace /> : <>{children}</>;
}

const gate = (permission: Parameters<typeof RequirePermission>[0]['permission'], page: string, el: ReactNode) => (
  <RequirePermission permission={permission} page={page}>
    {el}
  </RequirePermission>
);

export const router = createBrowserRouter([
  { path: '/connexion', element: <GuestOnly><LoginPage /></GuestOnly> },
  {
    path: '/',
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: S(<OverviewPage />) },
      { path: 'verifications', element: gate('people.read', 'Vérifications', S(<VerificationsPage />)) },
      { path: 'verifications/:id', element: gate('people.read', 'Examen du dossier', S(<CaseReviewPage />)) },
      { path: 'personnes', element: gate('people.read', 'Personnes & véhicules', S(<PeoplePage />)) },
      { path: 'personnes/:id', element: gate('people.read', 'Profil', S(<PersonPage />)) },
      { path: 'courses', element: gate('rides.read', 'Courses', S(<RidesPage />)) },
      { path: 'courses/:id', element: gate('rides.read', 'Détail de course', S(<RidePage />)) },
      { path: 'support', element: gate('support.resolve', 'Support', S(<SupportPage />)) },
      { path: 'support/:id', element: gate('support.resolve', 'Demande', S(<TicketPage />)) },
      { path: 'finance', element: gate('finance.read', 'Finance', S(<FinancePage />)) },
      { path: 'villes', element: S(<CitiesPage />) },
      { path: 'villes/:id/regles', element: S(<RulesPage />) },
      { path: 'services', element: gate('config.edit', 'Services et familles', S(<PrototypePage />)) },
      { path: 'paiements', element: S(<ProvidersPage />) },
      { path: 'audit', element: gate('audit.read', 'Journal d’audit', S(<AuditPage />)) },
      { path: '*', element: S(<NotFoundPage />) },
    ],
  },
]);
