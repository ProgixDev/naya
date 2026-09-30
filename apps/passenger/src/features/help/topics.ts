export interface HelpTopic {
  id: string;
  title: string;
  subtitle: string;
  category: 'ride' | 'payment' | 'safety' | 'account' | 'other';
  articles: { q: string; a: string }[];
}

/** P15 content: native screens, no web views. */
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'trip',
    title: 'Une question sur un trajet',
    subtitle: 'Paiement, annulation ou objet oublié',
    category: 'ride',
    articles: [
      { q: 'Le prix peut-il changer après confirmation ?', a: 'Non. Le prix affiché au moment de confirmer est gelé pour votre course, même si les tarifs de la ville changent ensuite.' },
      { q: 'Quand l’annulation est-elle payante ?', a: 'L’annulation est gratuite pendant la recherche et 2 minutes après l’attribution. Ensuite, des frais s’appliquent et sont toujours affichés avant de confirmer.' },
      { q: 'J’ai oublié un objet', a: 'Ouvrez une demande depuis le reçu de la course : l’équipe contacte la chauffeuse pour vous.' },
    ],
  },
  {
    id: 'payment',
    title: 'Paiement',
    subtitle: 'Espèces, carte, paiement refusé',
    category: 'payment',
    articles: [
      { q: 'Mon paiement carte est « en attente »', a: 'Le prestataire n’a pas encore confirmé. Aucun double débit n’est possible : la page se met à jour dès la confirmation.' },
      { q: 'Mon paiement a été refusé', a: 'Depuis le reçu, choisissez « Payer avec une autre carte ». La course reste liée au prix accepté.' },
    ],
  },
  {
    id: 'account',
    title: 'Compte et vérification',
    subtitle: 'Dossier et documents',
    category: 'account',
    articles: [
      { q: 'Pourquoi vérifier mon identité ?', a: 'Naya est réservé aux femmes. Chaque dossier est examiné par une personne de l’équipe, sans décision automatique fondée sur l’apparence.' },
      { q: 'Qui voit mes documents ?', a: 'Uniquement l’équipe de vérification. Les fichiers sont privés et ne sont jamais partagés avec les chauffeuses.' },
    ],
  },
  {
    id: 'safety',
    title: 'Sécurité',
    subtitle: 'Signaler un incident',
    category: 'safety',
    articles: [
      { q: 'En cas d’urgence', a: 'Appelez le 19 (police) ou le 15 (SAMU). Ensuite, ouvrez une demande « Sécurité » : elle est traitée en priorité.' },
      { q: 'Vérifier la voiture', a: 'Avant de monter, vérifiez le prénom de la chauffeuse, le modèle et la plaque affichés dans l’app.' },
    ],
  },
];
