import {
  FAMILY_APPROVAL_TIMEOUT_SECONDS,
  FAMILY_DROPOFF_RADIUS_METERS,
  FAMILY_MAX_START_REQUESTS,
  HANDOVER_MAX_ATTEMPTS,
  type SupportTicket,
} from '@naya/domain';
import { STANDALONE_DEMO } from '@naya/ui';
import { EMERGENCY_NUMBERS, EMERGENCY_NUMBERS_TEXT } from './emergency';

export interface HelpTopic {
  id: string;
  title: string;
  subtitle: string;
  /** The support category « Créer une demande » opens with. */
  category: SupportTicket['category'];
  articles: { q: string; a: string }[];
}

const police = EMERGENCY_NUMBERS[0].number;
const approvalMinutes = Math.round(FAMILY_APPROVAL_TIMEOUT_SECONDS / 60);

/**
 * What the alert does depends on the build: connected builds reach the Naya safety desk, a
 * standalone build only records the alert on the phone (ADR-0058). The entry is the pinned
 * « Sécurité » disc, and the alert is sent by holding the red button 1.5 s (R10).
 */
const SOS_WHERE = 'Le disque rouge « Sécurité » reste visible sur l’écran de la course et sur le suivi d’un trajet Naya Famille en cours. Il ouvre la fiche Sécurité.';
/** « Prévenir un proche » appears only once the alert exists (packages/ui/src/features/prototype.tsx). */
const SOS_AFTER = `La fiche propose aussi d’appeler le ${police}. Une fois l’alerte déclenchée, « Prévenir un proche » ouvre le partage de votre téléphone pour lui envoyer votre position :`;
const SOS_HOLD = 'Maintenez le bouton rouge environ une seconde et demie';
const SOS_ANSWER = STANDALONE_DEMO
  ? `${SOS_WHERE} ${SOS_HOLD} : l’app enregistre une alerte avec la position du trajet. ${SOS_AFTER} Naya ne contacte personne à votre place.`
  : `${SOS_WHERE} ${SOS_HOLD} : l’alerte part avec la position du trajet à l’équipe sécurité Naya ; tant que la fiche est ouverte, vous voyez quand l’équipe la prend en charge. ${SOS_AFTER} Naya ne contacte pas ce proche à votre place.`;

/**
 * P15 content: native screens, no web views. Every answer describes what the app does
 * today; numbers come from the domain rules so the copy follows them.
 */
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
    id: 'wallet',
    title: 'Portefeuille Naya',
    subtitle: 'Recharge, montant réservé, solde',
    category: 'wallet',
    articles: [
      { q: 'Comment recharger mon portefeuille ?', a: 'Compte → « Portefeuille Naya » → « Recharger » : choisissez ou saisissez un montant, puis un moyen de recharge proposé dans votre ville, et confirmez. Par carte ou paiement mobile, le solde est crédité dès que le prestataire confirme, en général en quelques secondes.' },
      { q: 'Recharger en agence', a: 'Choisissez une agence de paiement : la recharge est créée avec une référence. Présentez cette référence au guichet et réglez en espèces. La recharge reste « En attente du paiement en agence » jusqu’à la confirmation de l’agence, puis le solde est crédité.' },
      { q: 'Pourquoi une partie de mon solde est « réservée » ?', a: 'Quand vous payez une course ou un lavage avec le portefeuille, le montant est réservé dès la réservation, puis débité à la fin. Si vous annulez, la réservation est libérée et seuls les frais d’annulation éventuels sont débités. Le solde disponible tient déjà compte des montants réservés.' },
      { q: 'Mon solde ne suffit pas', a: 'La réservation est refusée tant que le solde disponible ne couvre pas le prix. Rechargez votre portefeuille ou choisissez un autre moyen de paiement.' },
      { q: 'Ma recharge a été refusée', a: 'Une recharge refusée n’est pas créditée. Réessayez avec un autre moyen de recharge. Si vous avez été débitée malgré tout, créez une demande depuis cette page.' },
    ],
  },
  {
    id: 'family',
    title: 'Naya Famille',
    subtitle: 'Accord du départ, codes de remise, photos',
    category: 'other',
    articles: [
      { q: 'Comment fonctionne un trajet Naya Famille ?', a: 'Avec une formule active, ajoutez le profil de votre enfant et planifiez un trajet depuis Compte → « Naya Famille ». Une chauffeuse dédiée, approuvée pour les trajets enfants, vient le chercher. Vous suivez sa position et chaque étape en direct.' },
      { q: 'Le départ attend mon accord', a: `À la prise en charge, la chauffeuse photographie votre enfant, vérifie son prénom, puis demande à démarrer. La demande s’affiche en haut de l’écran, où que vous soyez dans l’app ; « Répondre » ouvre la photo : vous avez ${approvalMinutes} minutes pour approuver, sur place ou à distance, ou pour refuser. Sans accord, la chauffeuse ne part pas et reste avec votre enfant au point de prise en charge. Après ${FAMILY_MAX_START_REQUESTS} demandes sans accord, elle doit vous appeler ou annuler le trajet.` },
      { q: 'À quoi sert le code de remise ?', a: `En ajoutant votre enfant, vous indiquez la personne autorisée à le recevoir et un code à 4 chiffres. Communiquez ce code uniquement à cette personne : la chauffeuse ne le voit jamais. À l’arrivée, elle choisit la personne autorisée et saisit le code que celle-ci lui donne. Après ${HANDOVER_MAX_ATTEMPTS} codes incorrects, la remise est bloquée et la chauffeuse ne confie pas votre enfant.` },
      { q: 'Quelles photos sont prises ?', a: `Deux photos par trajet : votre enfant à la prise en charge, puis à l’école, prise sur place, à moins de ${FAMILY_DROPOFF_RADIUS_METERS} m. Vous les retrouvez dans le suivi du trajet et dans l’historique. Les personnes que vous invitez à suivre les trajets (« Inviter un proche à suivre ») voient la position et les étapes, mais ni les photos ni les codes.` },
      { q: 'Annuler un trajet', a: 'Tant que votre enfant n’est pas parti avec la chauffeuse, ouvrez le trajet, touchez « Annuler ce trajet » et indiquez un motif. Si une demande de départ est en attente, refusez-la d’abord.' },
    ],
  },
  {
    id: 'safety',
    title: 'SOS et sécurité',
    subtitle: 'Numéros d’urgence, alerte SOS, incident',
    category: 'safety',
    articles: [
      { q: 'En cas d’urgence', a: `Appelez directement : ${EMERGENCY_NUMBERS_TEXT}. Pendant une course, le disque « Sécurité » propose ces numéros en un geste.` },
      { q: 'L’alerte SOS (disque « Sécurité »)', a: SOS_ANSWER },
      { q: 'Signaler un incident', a: `Créez une demande « Sécurité » depuis cette page, ou « Aide sur cette course » depuis le reçu. Une demande n’est pas un appel d’urgence : en cas de danger, appelez d’abord le ${police}.` },
      { q: 'Vérifier la voiture', a: 'Avant de monter, vérifiez le prénom de la chauffeuse, le modèle et la plaque affichés dans l’app.' },
    ],
  },
  {
    id: 'car-wash',
    title: 'Lavage à domicile',
    subtitle: 'Commande, suivi, annulation',
    category: 'other',
    articles: [
      { q: 'Comment commander un lavage ?', a: 'Depuis l’accueil, touchez « Lavage à domicile ». Indiquez où est garée la voiture (adresse enregistrée, position actuelle ou repère sur la carte, dans la zone desservie), la voiture et sa plaque, la formule, puis « Maintenant » ou un créneau. Le prix affiché à la commande ne change plus ensuite.' },
      { q: 'Suivre le lavage', a: 'L’écran du lavage montre chaque étape, la position de l’équipe et son heure d’arrivée quand elle est en route, puis les photos avant et après. Une fois le lavage terminé, vous pouvez le noter.' },
      { q: 'Annuler un lavage', a: 'C’est gratuit tant qu’aucune équipe n’est assignée, puis pendant un délai indiqué dans la fiche d’annulation. Ensuite, des frais s’appliquent : ils sont toujours affichés avant de confirmer. Un lavage commencé ne peut plus être annulé.' },
      { q: 'Comment payer ?', a: 'Les moyens disponibles dans votre ville s’affichent à l’étape « Paiement ». En espèces, vous réglez l’équipe à la fin du lavage ; par carte, le débit a lieu à la fin ; avec le Portefeuille Naya, le montant est réservé à la commande et débité à la fin.' },
      { q: 'Un problème avec un lavage', a: 'Sur l’écran du lavage, touchez « Un problème ? Contacter l’assistance ». Indiquez la date et la plaque de la voiture dans votre demande.' },
    ],
  },
];
