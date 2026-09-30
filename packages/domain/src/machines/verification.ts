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

export const REQUIRED_ITEMS: Record<VerificationSubject, VerificationItemKey[]> = {
  passenger_identity: ['selfie', 'id_front', 'id_back'],
  driver_identity: ['selfie', 'id_front', 'id_back', 'driving_licence'],
  vehicle: ['vehicle_registration', 'insurance', 'vehicle_photos'],
};

export const ITEM_LABELS: Record<VerificationItemKey, string> = {
  selfie: 'Selfie',
  id_front: 'Pièce d’identité · recto',
  id_back: 'Pièce d’identité · verso',
  driving_licence: 'Permis de conduire',
  vehicle_registration: 'Carte grise',
  insurance: 'Attestation d’assurance',
  vehicle_photos: 'Photos du véhicule',
};

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  draft: 'À compléter',
  submitted: 'Envoyé',
  in_review: 'En cours d’examen',
  approved: 'Approuvé',
  more_info_requested: 'Complément demandé',
  rejected: 'Refusé',
};

/** Submission requires identity/vehicle details and every required item to be present and not flagged. */
export function assertSubmittable(c: Pick<VerificationCase, 'subject' | 'items' | 'identity' | 'vehicle'>) {
  const missing = REQUIRED_ITEMS[c.subject].filter((key) => {
    const item = c.items.find((i) => i.key === key);
    return !item || item.uploadIds.length === 0 || item.status === 'needs_correction' || item.status === 'missing';
  });
  const detailsMissing = c.subject === 'vehicle' ? !c.vehicle : !c.identity;
  if (missing.length > 0 || detailsMissing) {
    throw new DomainError('VERIFICATION_INCOMPLETE', undefined, { missing, detailsMissing });
  }
}

/** Driver eligibility needs both independent approvals. Submission is never approval. */
export const isDriverVerified = (person: VerificationStatus | null, vehicle: VerificationStatus | null) =>
  person === 'approved' && vehicle === 'approved';
