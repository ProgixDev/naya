import { type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { useAuth } from './lib/auth';
import { Layout, RequirePermission } from './components/Layout';
import { LoginPage } from './pages/Login';
import { OverviewPage } from './pages/Overview';
import { VerificationsPage } from './pages/Verifications';
import { CaseReviewPage } from './pages/CaseReview';
import { PeoplePage } from './pages/People';
import { PersonPage } from './pages/Person';
import { RidesPage } from './pages/Rides';
import { RidePage } from './pages/Ride';
import { SupportPage } from './pages/Support';
import { TicketPage } from './pages/Ticket';
import { FinancePage } from './pages/Finance';
import { CitiesPage } from './pages/Cities';
import { RulesPage } from './pages/Rules';
import { ProvidersPage } from './pages/Providers';
import { AuditPage } from './pages/Audit';
import { NotFoundPage } from './pages/NotFound';

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
      { index: true, element: <OverviewPage /> },
      { path: 'verifications', element: gate('people.read', 'Vérifications', <VerificationsPage />) },
      { path: 'verifications/:id', element: gate('people.read', 'Examen du dossier', <CaseReviewPage />) },
      { path: 'personnes', element: gate('people.read', 'Personnes & véhicules', <PeoplePage />) },
      { path: 'personnes/:id', element: gate('people.read', 'Profil', <PersonPage />) },
      { path: 'courses', element: gate('rides.read', 'Courses', <RidesPage />) },
      { path: 'courses/:id', element: gate('rides.read', 'Détail de course', <RidePage />) },
      { path: 'support', element: gate('support.resolve', 'Support', <SupportPage />) },
      { path: 'support/:id', element: gate('support.resolve', 'Demande', <TicketPage />) },
      { path: 'finance', element: gate('finance.read', 'Finance', <FinancePage />) },
      { path: 'villes', element: <CitiesPage /> },
      { path: 'villes/:id/regles', element: <RulesPage /> },
      { path: 'paiements', element: <ProvidersPage /> },
      { path: 'audit', element: gate('audit.read', 'Journal d’audit', <AuditPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
