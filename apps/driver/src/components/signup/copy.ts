import { ITEM_LABELS, type SignupSection, type SignupStepId } from '@naya/domain';

/** French copy of the driver sign-up: one question per screen, written as a question. */
export const SECTION_COPY: Record<SignupSection, { title: string; short: string; intro: string }> = {
  person: { title: 'Vous et votre permis', short: 'Vous', intro: 'Vos informations, votre pièce d’identité, un selfie et votre permis.' },
  vehicle: { title: 'Votre véhicule', short: 'Véhicule', intro: 'La voiture que vous utiliserez, ses documents et cinq photos.' },
  famille: { title: 'Naya Famille', short: 'Famille', intro: 'Un agrément renforcé pour conduire des enfants.' },
};

type StepCopy = { title: string; help?: string };

const DOCUMENT_COPY: Partial<Record<SignupStepId, StepCopy>> = {
  id_front: { title: 'Photographiez le recto de votre pièce', help: 'Nous vérifions qu’elle correspond aux informations saisies.' },
  id_back: { title: 'Et maintenant le verso', help: 'Retournez la pièce, même cadrage.' },
  selfie: { title: 'Un selfie pour comparer avec votre pièce', help: 'Une personne de l’équipe Naya compare les deux photos. Aucune analyse automatique du visage.' },
  driving_licence: { title: 'Photographiez le recto de votre permis' },
  driving_licence_back: { title: 'Et le verso du permis', help: 'La catégorie B et ses dates doivent être lisibles.' },
  vehicle_registration: { title: 'La carte grise du véhicule', help: 'Celle du véhicule que vous venez de déclarer.' },
  insurance: { title: 'L’attestation d’assurance', help: 'En cours de validité, au nom du véhicule.' },
  technical_inspection: { title: 'Le procès-verbal de visite technique', help: 'Le dernier contrôle, avec un résultat favorable.' },
  vehicle_photo_front: { title: 'Photographiez l’avant du véhicule', help: 'Cinq photos au total : avant, arrière, deux côtés et intérieur.' },
  vehicle_photo_back: { title: 'L’arrière du véhicule' },
  vehicle_photo_left: { title: 'Le côté gauche' },
  vehicle_photo_right: { title: 'Le côté droit' },
  vehicle_photo_interior: { title: 'L’intérieur du véhicule', help: 'Les passagères voient l’habitacle avant de monter.' },
  criminal_record: { title: 'L’extrait de casier judiciaire', help: 'Fiche anthropométrique ou bulletin n° 3, daté de moins de trois mois. Demandé uniquement pour Naya Famille.' },
};

export const STEP_COPY: Record<SignupStepId, StepCopy> = {
  name: { title: 'Comment vous appelez-vous ?', help: 'Comme sur votre pièce d’identité.' },
  birth: { title: 'Quelle est votre date de naissance ?', help: 'Vous devez avoir 18 ans ou plus pour conduire avec Naya.' },
  address: { title: 'Où habitez-vous ?', help: 'Votre adresse de résidence. Elle n’est jamais montrée aux passagères.' },
  id_document: { title: 'Quelle pièce d’identité avez-vous ?', help: 'Le numéro tel qu’il figure sur la pièce.' },
  licence_number: { title: 'Votre permis de conduire', help: 'Le numéro et la catégorie inscrits sur le permis.' },
  licence_dates: { title: 'Quelles sont les dates de votre permis ?', help: 'Le permis doit être en cours de validité.' },
  experience: { title: 'Depuis combien d’années conduisez-vous ?', help: 'Conduite régulière, en années complètes.' },
  vehicle_model: { title: 'Quelle voiture conduisez-vous ?', help: 'Comme sur la carte grise. Véhicule de 2012 ou plus récent.' },
  vehicle_plate: { title: 'Son immatriculation et sa couleur', help: 'Les passagères les voient pour reconnaître votre voiture.' },
  famille_references: { title: 'Deux personnes qui vous recommandent', help: 'L’équipe Naya peut les appeler pour parler de vous.' },
  famille_experience: { title: 'Votre expérience avec les enfants', help: 'Enfants à charge, garde, transport scolaire, animation…' },
  famille_training: { title: 'La formation Naya Famille', help: 'Une session obligatoire avant votre premier trajet avec un enfant.' },
  famille_interview: { title: 'Quand pouvons-nous vous rencontrer ?', help: 'Un entretien avec l’équipe Naya. Choisissez un jour et un moment ; nous vous confirmons le créneau.' },
  person_review: { title: 'Vérifiez avant d’envoyer', help: 'Une personne de l’équipe Naya examine votre dossier, en général en moins de 24 h ouvrées.' },
  vehicle_review: { title: 'Vérifiez le dossier véhicule', help: 'Il est examiné séparément de votre dossier personnel.' },
  famille_review: { title: 'Vérifiez votre candidature', help: 'L’agrément Naya Famille est examiné après l’entretien.' },
  ...(Object.fromEntries(Object.entries(ITEM_LABELS).map(([k, label]) => [k, DOCUMENT_COPY[k as SignupStepId] ?? { title: label }])) as Record<string, StepCopy>),
} as Record<SignupStepId, StepCopy>;

/** "mar. 14 oct." for a YYYY-MM-DD business date. */
export const formatShortDay = (iso: string) =>
  new Intl.DateTimeFormat('fr-MA', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00Z`));

/** "14/10/2026" for a YYYY-MM-DD date. */
export const formatFrDate = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '—');

export const INTERVIEW_WINDOWS = {
  morning: { label: 'Matin', detail: '9 h – 12 h' },
  afternoon: { label: 'Après-midi', detail: '14 h – 17 h' },
} as const;
