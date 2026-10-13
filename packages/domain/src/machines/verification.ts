import type { VerificationCase, VerificationItemKey, VerificationStatus, VerificationSubject } from '../entities';
import { DomainError } from '../errors';
import { makeMachine } from './machine';

export type VerificationEvent = 'SUBMIT' | 'START_REVIEW' | 'APPROVE' | 'REQUEST_MORE' | 'REJECT' | 'RESUBMIT' | 'REOPEN';

export const verificationMachine = makeMachine<VerificationStatus, VerificationEvent>('verification', {
  draft: { SUBMIT: 'submitted' },
  submitted: { START_REVIEW: 'in_review', APPROVE: 'approved', REQUEST_MORE: 'more_info_requested', REJECT: 'rejected' },
  in_review: { APPROVE: 'approved', REQUEST_MORE: 'more_info_requested', REJECT: 'rejected' },
  more_info_requested: { RESUBMIT: 'submitted' },
  rejected: { REOPEN: 'draft' },
  approved: {},
});

/** Required pieces per dossier, in the order the driver sign-up asks for them. */
export const REQUIRED_ITEMS: Record<VerificationSubject, VerificationItemKey[]> = {
  passenger_identity: ['selfie', 'id_front', 'id_back'],
  driver_identity: ['id_front', 'id_back', 'selfie', 'driving_licence', 'driving_licence_back'],
  vehicle: [
    'vehicle_registration',
    'insurance',
    'technical_inspection',
    'vehicle_photo_front',
    'vehicle_photo_back',
    'vehicle_photo_left',
    'vehicle_photo_right',
    'vehicle_photo_interior',
  ],
  driver_famille: ['criminal_record'],
};

/** Pieces a dossier may hold: the required ones plus legacy keys kept by older cases. */
export const ALLOWED_ITEMS: Record<VerificationSubject, VerificationItemKey[]> = {
  passenger_identity: REQUIRED_ITEMS.passenger_identity,
  driver_identity: REQUIRED_ITEMS.driver_identity,
  vehicle: [...REQUIRED_ITEMS.vehicle, 'vehicle_photos'],
  driver_famille: REQUIRED_ITEMS.driver_famille,
};

export const ITEM_LABELS: Record<VerificationItemKey, string> = {
  selfie: 'Selfie',
  id_front: 'Pièce d’identité · recto',
  id_back: 'Pièce d’identité · verso',
  driving_licence: 'Permis de conduire · recto',
  driving_licence_back: 'Permis de conduire · verso',
  vehicle_registration: 'Carte grise',
  insurance: 'Attestation d’assurance',
  technical_inspection: 'Visite technique',
  vehicle_photos: 'Photos du véhicule',
  vehicle_photo_front: 'Véhicule · avant',
  vehicle_photo_back: 'Véhicule · arrière',
  vehicle_photo_left: 'Véhicule · côté gauche',
  vehicle_photo_right: 'Véhicule · côté droit',
  vehicle_photo_interior: 'Véhicule · intérieur',
  criminal_record: 'Extrait de casier judiciaire',
};

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  draft: 'À compléter',
  submitted: 'Envoyé',
  in_review: 'En cours d’examen',
  approved: 'Approuvé',
  more_info_requested: 'Complément demandé',
  rejected: 'Refusé',
};

/** True when the typed details a dossier needs are present (items are checked separately). */
export function detailsComplete(c: Pick<VerificationCase, 'subject' | 'identity' | 'vehicle' | 'licence' | 'famille'>): boolean {
  switch (c.subject) {
    case 'vehicle':
      return !!c.vehicle;
    case 'passenger_identity':
      return !!c.identity;
    case 'driver_identity':
      return !!c.identity && !!c.identity.address && !!c.identity.city && !!c.licence;
    case 'driver_famille':
      return !!c.famille;
  }
}

/**
 * Submission requires the dossier's details and every required item to be present and not
 * flagged. A driver's licence must still be valid on the day she submits (`today`, Casablanca).
 */
export function assertSubmittable(c: Pick<VerificationCase, 'subject' | 'items' | 'identity' | 'vehicle' | 'licence' | 'famille'>, today?: string) {
  const missing = REQUIRED_ITEMS[c.subject].filter((key) => {
    const item = c.items.find((i) => i.key === key);
    return !item || item.uploadIds.length === 0 || item.status === 'needs_correction' || item.status === 'missing';
  });
  const detailsMissing = !detailsComplete(c);
  if (missing.length > 0 || detailsMissing) {
    throw new DomainError('VERIFICATION_INCOMPLETE', undefined, { missing, detailsMissing });
  }
  if (today && c.subject === 'driver_identity' && c.licence && c.licence.expiryDate <= today) {
    throw new DomainError('VALIDATION', 'Votre permis est expiré. Renouvelez-le avant d’envoyer le dossier.', { fields: { licenceExpiryDate: 'Permis expiré' } });
  }
}

/** Driver eligibility needs both independent approvals. Submission is never approval. */
export const isDriverVerified = (person: VerificationStatus | null, vehicle: VerificationStatus | null) =>
  person === 'approved' && vehicle === 'approved';
