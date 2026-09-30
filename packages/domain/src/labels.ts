import type { OfferStatus, PaymentStatus, RideStatus, ScheduledStatus, SupportStatus, TransferStatus } from './entities';

export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  searching: 'Recherche d’une chauffeuse',
  driver_assigned: 'Chauffeuse en route',
  driver_arrived: 'Chauffeuse arrivée',
  in_progress: 'Trajet en cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  no_driver: 'Aucune chauffeuse disponible',
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  expired: 'Expirée',
  withdrawn: 'Retirée',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  failed: 'Échoué',
  cancelled: 'Annulé',
};

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'En cours',
  confirmed: 'Confirmé',
  failed: 'Échoué',
};

export const SCHEDULED_STATUS_LABELS: Record<ScheduledStatus, string> = {
  scheduled: 'Enregistrée',
  dispatched: 'Course lancée',
  cancelled: 'Annulée',
  expired: 'Expirée',
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Ouverte',
  in_progress: 'En cours de traitement',
  awaiting_user: 'Réponse attendue',
  resolved: 'Résolue',
};

export const PASSENGER_CANCEL_REASONS = [
  { code: 'changed_plans', label: 'Mes plans ont changé' },
  { code: 'wait_too_long', label: 'L’attente est trop longue' },
  { code: 'wrong_address', label: 'Adresse de départ incorrecte' },
  { code: 'other_transport', label: 'J’ai trouvé un autre moyen' },
  { code: 'other', label: 'Autre raison' },
] as const;

export const DRIVER_CANCEL_REASONS = [
  { code: 'passenger_unreachable', label: 'Passagère injoignable' },
  { code: 'unsafe_pickup', label: 'Point de départ dangereux' },
  { code: 'vehicle_issue', label: 'Problème de véhicule' },
  { code: 'traffic', label: 'Circulation bloquée' },
  { code: 'other', label: 'Autre raison' },
] as const;

export const OFFER_DECLINE_REASONS = [
  { code: 'too_far', label: 'Départ trop éloigné' },
  { code: 'destination', label: 'Destination inadaptée' },
  { code: 'break', label: 'Je fais une pause' },
  { code: 'other', label: 'Autre raison' },
] as const;
