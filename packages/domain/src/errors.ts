/** Stable error codes shared by the server and every client, with French user copy. */
export const ERROR_MESSAGES = {
  VALIDATION: 'Certaines informations sont invalides.',
  UNAUTHORIZED: 'Votre session a expiré. Reconnectez-vous.',
  FORBIDDEN: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
  NOT_FOUND: 'Élément introuvable.',
  CONFLICT: 'Cette action a déjà été traitée.',
  INVALID_TRANSITION: 'Cette action n’est plus possible dans l’état actuel.',
  OTP_INVALID: 'Code incorrect. Vérifiez le SMS et réessayez.',
  OTP_EXPIRED: 'Ce code a expiré. Demandez-en un nouveau.',
  OTP_RATE_LIMITED: 'Patientez avant de demander un nouveau code.',
  OFFER_EXPIRED: 'Cette proposition a expiré.',
  OFFER_NOT_PENDING: 'Cette proposition n’est plus disponible.',
  RIDE_ALREADY_ASSIGNED: 'Cette course a déjà été attribuée à une autre chauffeuse.',
  OUT_OF_ZONE: 'Cette adresse est en dehors de la zone desservie.',
  CITY_INACTIVE: 'Naya n’est pas encore ouvert dans cette ville.',
  QUOTE_EXPIRED: 'Ce prix a expiré. Un nouveau prix a été calculé.',
  PAYMENT_METHOD_UNAVAILABLE: 'Ce moyen de paiement n’est pas disponible.',
  VERIFICATION_REQUIRED: 'Votre identité doit être validée avant de réserver.',
  VERIFICATION_INCOMPLETE: 'Ajoutez toutes les pièces demandées avant l’envoi.',
  NOT_ELIGIBLE: 'Vous ne pouvez pas recevoir de courses pour le moment.',
  DEBT_LIMIT_REACHED: 'Le plafond de commission est atteint. Rechargez votre portefeuille.',
  INSUFFICIENT_AVAILABLE: 'Montant supérieur au solde disponible au retrait.',
  AMOUNT_TOO_SMALL: 'Montant inférieur au minimum autorisé.',
  ACTIVE_RIDE_EXISTS: 'Une course est déjà en cours.',
  SCHEDULE_TOO_SOON: 'Choisissez un horaire plus éloigné.',
  SCHEDULE_TOO_FAR: 'Cet horaire est trop éloigné.',
  SCHEDULE_CUTOFF: 'Cette réservation ne peut plus être modifiée.',
  REASON_REQUIRED: 'Indiquez un motif.',
  IDEMPOTENCY_CONFLICT: 'Cette demande a déjà été envoyée avec d’autres informations.',
  PROVIDER_SIGNATURE_INVALID: 'Signature du prestataire invalide.',
  PENDING_OPERATION: 'Une opération est déjà en cours.',
  NETWORK: 'Connexion indisponible. Vérifiez votre réseau.',
  UNKNOWN: 'Une erreur inattendue est survenue.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;
  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;

export function httpStatusFor(code: ErrorCode): number {
  switch (code) {
    case 'VALIDATION':
    case 'REASON_REQUIRED':
    case 'AMOUNT_TOO_SMALL':
    case 'VERIFICATION_INCOMPLETE':
    case 'SCHEDULE_TOO_SOON':
    case 'SCHEDULE_TOO_FAR':
    case 'OUT_OF_ZONE':
    case 'OTP_INVALID':
      return 422;
    case 'UNAUTHORIZED':
    case 'PROVIDER_SIGNATURE_INVALID':
      return 401;
    case 'FORBIDDEN':
    case 'NOT_ELIGIBLE':
    case 'DEBT_LIMIT_REACHED':
    case 'VERIFICATION_REQUIRED':
    case 'CITY_INACTIVE':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'OTP_RATE_LIMITED':
      return 429;
    case 'OFFER_EXPIRED':
    case 'QUOTE_EXPIRED':
    case 'OTP_EXPIRED':
      return 410;
    default:
      return 409;
  }
}
