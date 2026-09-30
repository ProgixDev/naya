import { Link } from 'react-router';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="card mt-10">
      <EmptyState title="Page introuvable" message="Ce lien ne correspond à aucune page de l’administration." action={<Link to="/" className="mt-2 text-[14px] font-semibold text-accent">Revenir à la vue d’ensemble</Link>} />
    </div>
  );
}
