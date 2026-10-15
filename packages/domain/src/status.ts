import type {
  CityStatus,
  FamilleEligibility,
  OfferStatus,
  PaymentStatus,
  RideStatus,
  ScheduledStatus,
  SupportStatus,
  TransferStatus,
  VerificationItem,
  VerificationStatus,
} from './entities';
import type { WashOrderStatus } from './carWash';
import type { DocumentStatus } from './signup';
import type { FamilyGuardian, FamilyStartApproval, FamilySubscription, FamilyTripStatus, PassengerWalletEntry, SafetyAlert } from './prototype';
import {
  OFFER_STATUS_SHORT_LABELS,
  PAYMENT_STATUS_SHORT_LABELS,
  RIDE_STATUS_SHORT_LABELS,
  SCHEDULED_STATUS_SHORT_LABELS,
  SUPPORT_STATUS_SHORT_LABELS,
  TRANSFER_STATUS_SHORT_LABELS,
} from './labels';
import { FAMILY_APPROVAL_SHORT_LABELS, FAMILY_STATUS_SHORT_LABELS, FAMILY_SUBSCRIPTION_SHORT_LABELS, GUARDIAN_STATUS_SHORT_LABELS } from './prototype';

/**
 * Status presentation: one glyph, one tone and one short word per state, for both apps (and later
 * the admin). Redesign audit 2026-10-15 §2, owner decisions R1, R3, R5 and R11 (15 Oct 2026).
 *
 * - A state is a glyph. Its word always reaches the screen reader (`label`); on screen it shows only
 *   on detail heroes, at first sight and for problems (`problem: true`).
 * - Each state of one kind has its own glyph, so colour never carries the meaning alone (WCAG 1.4.1).
 * - Each glyph keeps one meaning across both apps (audit §2.2). `Clock` is a duration, never a state.
 * - Tones (§2.3): cancelled and declined are neutral, waiting on someone else is info, live is accent,
 *   the viewer must act is warning, failed or refused is danger.
 *
 * No UI imports here: glyphs are kebab-case lucide names, mapped to components in packages/ui.
 */

export type StatusTone = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/** Kebab-case lucide names (lucide-react-native 1.48.0, canonical names only). */
export type StatusGlyph =
  | 'badge-check'
  | 'ban'
  | 'calendar-check'
  | 'calendar-clock'
  | 'calendar-x'
  | 'car-front'
  | 'check'
  | 'circle-alert'
  | 'circle-check'
  | 'circle-dashed'
  | 'circle-off'
  | 'circle-pause'
  | 'circle-slash'
  | 'circle-x'
  | 'droplets'
  | 'file-exclamation-point'
  | 'flask-conical'
  | 'hourglass'
  | 'inbox'
  | 'info'
  | 'loader-circle'
  | 'lock'
  | 'lock-open'
  | 'map-pin-check'
  | 'map-pin-off'
  | 'message-circle-question-mark'
  | 'navigation'
  | 'power-off'
  | 'radar'
  | 'scan-search'
  | 'send'
  | 'shield-check'
  | 'shield-question-mark'
  | 'shield-x'
  | 'siren'
  | 'store'
  | 'timer-off'
  | 'triangle-alert'
  | 'undo-2'
  | 'user-check'
  | 'van'
  | 'wifi-off';

/** Every glyph name, for the UI map's completeness test. */
export const STATUS_GLYPHS = [
  'badge-check', 'ban', 'calendar-check', 'calendar-clock', 'calendar-x', 'car-front', 'check', 'circle-alert', 'circle-check',
  'circle-dashed', 'circle-off', 'circle-pause', 'circle-slash', 'circle-x', 'droplets', 'file-exclamation-point', 'flask-conical',
  'hourglass', 'inbox', 'info', 'loader-circle', 'lock', 'lock-open', 'map-pin-check', 'map-pin-off', 'message-circle-question-mark',
  'navigation', 'power-off', 'radar', 'scan-search', 'send', 'shield-check', 'shield-question-mark', 'shield-x', 'siren', 'store',
  'timer-off', 'triangle-alert', 'undo-2', 'user-check', 'van', 'wifi-off',
] as const satisfies readonly StatusGlyph[];

/**
 * Cheap native-driver motions (§2.5), stopped under Reduce Motion:
 * `pulse` ring 1 → 1.25 and 0.5 → 0 over 1.6 s; `pulse-slow` the same over 2.4 s;
 * `breathe` opacity 1 → 0.6 over 1.2 s; `spin` 360° per 0.9 s.
 */
export type StatusMotion = 'pulse' | 'pulse-slow' | 'breathe' | 'spin';

export interface StatusPresentation {
  /** Full French sentence: the accessibilityLabel, and the hero line where a screen wants it. */
  label: string;
  /** Chip word, ≤ 18 characters. */
  shortLabel: string;
  tone: StatusTone;
  glyph: StatusGlyph;
  /** True for problems (★ in the audit): the word is always visible next to the glyph. */
  problem: boolean;
  motion?: StatusMotion;
}

/** Passenger wallet entries split by direction, because a debit and a credit share « confirmed ». */
export type WalletDebitState = 'pending' | 'confirmed' | 'failed';
export type WalletCreditState = 'pending' | 'pending_agency' | 'confirmed' | 'failed';

/** The states of each kind. Kinds that are not a stored enum are spelled out here. */
export interface StatusStates {
  ride: RideStatus;
  /** `taken` is UI only: the course went to another chauffeuse. */
  offer: OfferStatus | 'taken';
  payment: PaymentStatus;
  transfer: TransferStatus;
  scheduled: ScheduledStatus;
  support: SupportStatus;
  verification: VerificationStatus;
  document: DocumentStatus;
  verificationItem: VerificationItem['status'];
  familleEligibility: FamilleEligibility;
  familyTrip: FamilyTripStatus;
  familyApproval: FamilyStartApproval['status'];
  guardian: FamilyGuardian['status'];
  familleSubscription: FamilySubscription['status'];
  wash: WashOrderStatus;
  safetyAlert: SafetyAlert['status'];
  walletDebit: WalletDebitState;
  walletCredit: WalletCreditState;
  driverAvailability: 'online' | 'offline' | 'blocked';
  account: 'verified' | 'suspended';
  city: CityStatus;
  location: 'off' | 'stale';
  selection: 'selected';
  preference: 'preferred';
  progress: 'loading';
}
export type StatusKind = keyof StatusStates;
export type StateOf<K extends StatusKind> = StatusStates[K];

/** Who reads the state. Only a few sentences change with the viewer (the Famille approval). */
export type StatusViewer = 'passenger' | 'driver';

type Entry = Omit<StatusPresentation, 'problem'> & { problem?: boolean };
type Table = { [K in StatusKind]: Record<StatusStates[K], Entry> };

const e = (glyph: StatusGlyph, tone: StatusTone, shortLabel: string, label: string, extra?: { problem?: boolean; motion?: StatusMotion }): Entry => ({ glyph, tone, shortLabel, label, ...extra });
const P = { problem: true } as const;

const TABLE: Table = {
  // C1
  ride: {
    searching: e('radar', 'info', RIDE_STATUS_SHORT_LABELS.searching, 'Recherche d’une chauffeuse', { motion: 'pulse' }),
    driver_assigned: e('car-front', 'accent', RIDE_STATUS_SHORT_LABELS.driver_assigned, 'Chauffeuse en route'),
    driver_arrived: e('map-pin-check', 'accent', RIDE_STATUS_SHORT_LABELS.driver_arrived, 'Chauffeuse arrivée'),
    in_progress: e('navigation', 'accent', RIDE_STATUS_SHORT_LABELS.in_progress, 'Trajet en cours'),
    completed: e('circle-check', 'success', RIDE_STATUS_SHORT_LABELS.completed, 'Course terminée'),
    cancelled: e('circle-slash', 'neutral', RIDE_STATUS_SHORT_LABELS.cancelled, 'Course annulée'),
    no_driver: e('circle-off', 'warning', RIDE_STATUS_SHORT_LABELS.no_driver, 'Aucune chauffeuse disponible', P),
  },
  // C2
  offer: {
    pending: e('hourglass', 'info', OFFER_STATUS_SHORT_LABELS.pending, 'Offre en attente de réponse'),
    accepted: e('circle-check', 'success', OFFER_STATUS_SHORT_LABELS.accepted, 'Offre acceptée'),
    declined: e('circle-x', 'neutral', OFFER_STATUS_SHORT_LABELS.declined, 'Vous avez refusé l’offre'),
    expired: e('timer-off', 'neutral', OFFER_STATUS_SHORT_LABELS.expired, 'Le délai de réponse est écoulé'),
    withdrawn: e('undo-2', 'neutral', OFFER_STATUS_SHORT_LABELS.withdrawn, 'La passagère a annulé sa demande'),
    taken: e('circle-slash', 'neutral', 'Déjà attribuée', 'Course déjà attribuée'),
  },
  // C3
  payment: {
    pending: e('hourglass', 'info', PAYMENT_STATUS_SHORT_LABELS.pending, 'Paiement en attente'),
    confirmed: e('circle-check', 'success', PAYMENT_STATUS_SHORT_LABELS.confirmed, 'Paiement confirmé'),
    failed: e('circle-x', 'danger', PAYMENT_STATUS_SHORT_LABELS.failed, 'Paiement échoué', P),
    cancelled: e('circle-slash', 'neutral', PAYMENT_STATUS_SHORT_LABELS.cancelled, 'Paiement annulé'),
  },
  // C4
  transfer: {
    pending: e('hourglass', 'info', TRANSFER_STATUS_SHORT_LABELS.pending, 'Opération en cours'),
    confirmed: e('circle-check', 'success', TRANSFER_STATUS_SHORT_LABELS.confirmed, 'Opération confirmée'),
    failed: e('circle-x', 'danger', TRANSFER_STATUS_SHORT_LABELS.failed, 'Opération échouée', P),
  },
  // C5
  scheduled: {
    scheduled: e('calendar-clock', 'info', SCHEDULED_STATUS_SHORT_LABELS.scheduled, 'Réservation enregistrée, chauffeuse à confirmer'),
    dispatched: e('calendar-check', 'accent', SCHEDULED_STATUS_SHORT_LABELS.dispatched, 'Course lancée'),
    cancelled: e('calendar-x', 'neutral', SCHEDULED_STATUS_SHORT_LABELS.cancelled, 'Réservation annulée'),
    expired: e('timer-off', 'warning', SCHEDULED_STATUS_SHORT_LABELS.expired, 'Réservation expirée, aucune chauffeuse', P),
  },
  // C6
  support: {
    open: e('inbox', 'info', SUPPORT_STATUS_SHORT_LABELS.open, 'Demande ouverte'),
    in_progress: e('hourglass', 'info', SUPPORT_STATUS_SHORT_LABELS.in_progress, 'En cours de traitement'),
    awaiting_user: e('message-circle-question-mark', 'warning', SUPPORT_STATUS_SHORT_LABELS.awaiting_user, 'Nous attendons votre réponse', P),
    resolved: e('circle-check', 'success', SUPPORT_STATUS_SHORT_LABELS.resolved, 'Demande résolue'),
    rejected: e('circle-x', 'danger', SUPPORT_STATUS_SHORT_LABELS.rejected, 'Demande rejetée', P),
  },
  // C7
  verification: {
    draft: e('circle-dashed', 'neutral', 'À compléter', 'Dossier à compléter'),
    submitted: e('send', 'info', 'Envoyé', 'Dossier envoyé'),
    in_review: e('scan-search', 'info', 'En examen', 'Dossier en cours d’examen'),
    approved: e('badge-check', 'success', 'Approuvé', 'Dossier approuvé'),
    more_info_requested: e('file-exclamation-point', 'warning', 'Complément demandé', 'Un complément est demandé', P),
    rejected: e('circle-x', 'danger', 'Refusé', 'Dossier refusé', P),
  },
  // C8
  document: {
    missing: e('circle-dashed', 'neutral', 'Manquant', 'Pièce manquante'),
    sent: e('send', 'info', 'Envoyé', 'Pièce envoyée'),
    in_review: e('scan-search', 'info', 'En vérification', 'Pièce en vérification'),
    approved: e('circle-check', 'success', 'Approuvé', 'Pièce approuvée'),
    rejected: e('circle-x', 'danger', 'Refusé', 'Pièce refusée, à renvoyer', P),
  },
  // C9
  verificationItem: {
    missing: e('circle-dashed', 'neutral', 'À ajouter', 'Pièce à ajouter'),
    provided: e('circle-check', 'success', 'Ajoutée', 'Pièce ajoutée'),
    accepted: e('badge-check', 'success', 'Validée', 'Pièce validée'),
    needs_correction: e('circle-alert', 'warning', 'À reprendre', 'Pièce à reprendre', P),
  },
  // C10
  familleEligibility: {
    not_requested: e('circle-dashed', 'neutral', 'Non demandée', 'Agrément Famille non demandé'),
    pending: e('scan-search', 'info', 'En examen', 'Agrément Famille en cours d’examen'),
    approved: e('badge-check', 'success', 'Approuvée', 'Agrément Famille approuvé'),
    rejected: e('circle-x', 'danger', 'Refusée', 'Agrément Famille refusé', P),
  },
  // C11 (R5)
  familyTrip: {
    scheduled: e('calendar-clock', 'info', FAMILY_STATUS_SHORT_LABELS.scheduled, 'Trajet planifié'),
    en_route: e('car-front', 'accent', FAMILY_STATUS_SHORT_LABELS.en_route, 'Chauffeuse en route'),
    arrived: e('map-pin-check', 'accent', FAMILY_STATUS_SHORT_LABELS.arrived, 'Chauffeuse arrivée'),
    picked_up: e('user-check', 'accent', FAMILY_STATUS_SHORT_LABELS.picked_up, 'Enfant récupéré'),
    awaiting_approval: e('shield-question-mark', 'warning', FAMILY_STATUS_SHORT_LABELS.awaiting_approval, 'Départ en attente de votre accord', P),
    in_progress: e('navigation', 'accent', FAMILY_STATUS_SHORT_LABELS.in_progress, 'Trajet en cours'),
    completed: e('circle-check', 'success', FAMILY_STATUS_SHORT_LABELS.completed, 'Déposé, photo et remise confirmées'),
    cancelled: e('circle-slash', 'neutral', FAMILY_STATUS_SHORT_LABELS.cancelled, 'Trajet annulé'),
  },
  // C12
  familyApproval: {
    pending: e('shield-question-mark', 'warning', FAMILY_APPROVAL_SHORT_LABELS.pending, 'Accord attendu', P),
    approved: e('shield-check', 'success', FAMILY_APPROVAL_SHORT_LABELS.approved, 'Départ autorisé'),
    refused: e('shield-x', 'danger', FAMILY_APPROVAL_SHORT_LABELS.refused, 'Départ refusé', P),
    expired: e('timer-off', 'warning', FAMILY_APPROVAL_SHORT_LABELS.expired, 'Délai de réponse dépassé', P),
  },
  // C13
  guardian: {
    invited: e('send', 'info', GUARDIAN_STATUS_SHORT_LABELS.invited, 'Invitation envoyée'),
    active: e('user-check', 'success', GUARDIAN_STATUS_SHORT_LABELS.active, 'Suivi ouvert'),
    revoked: e('circle-slash', 'neutral', GUARDIAN_STATUS_SHORT_LABELS.revoked, 'Accès retiré'),
  },
  // C14
  familleSubscription: {
    active: e('circle-check', 'success', FAMILY_SUBSCRIPTION_SHORT_LABELS.active, 'Formule active'),
    paused: e('circle-pause', 'neutral', FAMILY_SUBSCRIPTION_SHORT_LABELS.paused, 'Formule en pause'),
  },
  // C15 (R3: washing is accent, nothing is wrong)
  wash: {
    booked: e('calendar-clock', 'info', 'Réservé', 'Lavage réservé'),
    washer_assigned: e('user-check', 'accent', 'Équipe assignée', 'Équipe de lavage assignée'),
    en_route: e('van', 'accent', 'En route', 'Équipe en route'),
    washing: e('droplets', 'accent', 'En cours', 'Lavage en cours', { motion: 'breathe' }),
    completed: e('circle-check', 'success', 'Terminé', 'Lavage terminé'),
    cancelled: e('circle-slash', 'neutral', 'Annulé', 'Lavage annulé'),
  },
  // C16. The glyph follows the server state, never a timer: a standalone build reaches no desk (ADR-0058).
  safetyAlert: {
    new: e('siren', 'danger', 'Envoyée', 'Alerte envoyée'),
    responding: e('shield-check', 'accent', 'Prise en charge', 'Alerte prise en charge'),
    resolved: e('circle-check', 'success', 'Résolue', 'Alerte résolue'),
  },
  // C17 (R11 for the released debit)
  walletDebit: {
    pending: e('lock', 'info', 'Réservé', 'Montant réservé pour votre course'),
    confirmed: e('circle-check', 'success', 'Payé', 'Payé'),
    failed: e('lock-open', 'neutral', 'Libéré', 'Montant libéré · rien n’a été débité'),
  },
  walletCredit: {
    pending: e('hourglass', 'info', 'En cours', 'Recharge en cours de confirmation'),
    pending_agency: e('store', 'info', 'À payer en agence', 'En attente du paiement en agence'),
    confirmed: e('circle-check', 'success', 'Créditée', 'Recharge créditée'),
    failed: e('circle-x', 'danger', 'Refusée', 'Recharge refusée', P),
  },
  // C20
  driverAvailability: {
    online: e('radar', 'success', 'En ligne', 'Vous êtes en ligne', { motion: 'pulse-slow' }),
    offline: e('power-off', 'neutral', 'Hors ligne', 'Vous êtes hors ligne'),
    blocked: e('lock', 'danger', 'Bloquée', 'Accès aux courses bloqué', P),
  },
  account: {
    verified: e('badge-check', 'success', 'Compte vérifié', 'Compte vérifié'),
    suspended: e('ban', 'danger', 'Compte suspendu', 'Compte suspendu', P),
  },
  city: {
    active: e('circle-check', 'success', 'Disponible', 'Service disponible'),
    test: e('flask-conical', 'info', 'En test', 'Ville en test'),
    inactive: e('circle-off', 'neutral', 'Indisponible', 'Service indisponible dans cette ville'),
  },
  location: {
    off: e('map-pin-off', 'warning', 'GPS désactivé', 'Localisation désactivée', P),
    stale: e('wifi-off', 'warning', 'Signal perdu', 'Position en attente', P),
  },
  selection: {
    selected: e('check', 'accent', 'Sélectionnée', 'Sélectionnée'),
  },
  preference: {
    preferred: e('check', 'accent', 'Préféré', 'Moyen de paiement préféré'),
  },
  progress: {
    loading: e('loader-circle', 'info', 'Chargement', 'Chargement en cours', { motion: 'spin' }),
  },
};

/** Sentences that change with the viewer. The driver waits on the parent, the parent is asked. */
const DRIVER_OVERRIDES: { [K in StatusKind]?: Partial<Record<StatusStates[K], Partial<Entry>>> } = {
  familyTrip: { awaiting_approval: { shortLabel: 'Accord du parent', label: 'Accord du parent attendu' } },
  familyApproval: { pending: { label: 'Accord du parent attendu' } },
};

/** Every state of every kind, in table order (tests, pickers, the admin later). */
export const STATUS_STATES = Object.fromEntries(Object.entries(TABLE).map(([k, v]) => [k, Object.keys(v)])) as { [K in StatusKind]: StatusStates[K][] };
export const STATUS_KINDS = Object.keys(TABLE) as StatusKind[];

/**
 * The presentation of one state. An unknown state (an older store, a newer server) falls back to
 * a neutral glyph with the raw value as its word, so a screen never crashes on it.
 */
export function statusPresentation<K extends StatusKind>(kind: K, state: StatusStates[K], opts?: { viewer?: StatusViewer }): StatusPresentation {
  const row = (TABLE[kind] as Record<string, Entry | undefined>)[state as string];
  if (!row) return { glyph: 'circle-dashed', tone: 'neutral', shortLabel: String(state), label: String(state), problem: false };
  const override = opts?.viewer === 'driver' ? (DRIVER_OVERRIDES[kind] as Record<string, Partial<Entry>> | undefined)?.[state as string] : undefined;
  const merged = override ? { ...row, ...override } : row;
  return { ...merged, problem: merged.problem ?? false };
}

/**
 * The state as a clause for a composed accessibilityLabel, first letter lowered:
 * `${title}, ${statusA11y('document', s)}` → « Permis de conduire, pièce en vérification ».
 */
export function statusA11y<K extends StatusKind>(kind: K, state: StatusStates[K], opts?: { viewer?: StatusViewer }): string {
  const { label } = statusPresentation(kind, state, opts);
  return label.charAt(0).toLocaleLowerCase('fr') + label.slice(1);
}

/** The glyph a banner, toast or tone-only pill draws for its tone (§2.6 migration). */
export const TONE_GLYPHS: Record<StatusTone, StatusGlyph> = {
  accent: 'info',
  info: 'info',
  success: 'circle-check',
  warning: 'triangle-alert',
  danger: 'circle-x',
  neutral: 'info',
};

/**
 * The kind and state of a passenger wallet entry: a negative amount is a debit (a ride or a wash),
 * a positive one a top-up. `agency` is true when the top-up waits for a payment at an agency.
 * Spread it into the UI: `<StatusIcon {...walletEntryStatus(e, agency)} />`.
 */
export function walletEntryStatus(entry: Pick<PassengerWalletEntry, 'amount' | 'status'>, agency = false): { kind: 'walletDebit'; state: WalletDebitState } | { kind: 'walletCredit'; state: WalletCreditState } {
  if (entry.amount < 0) return { kind: 'walletDebit', state: entry.status };
  return { kind: 'walletCredit', state: entry.status === 'pending' && agency ? 'pending_agency' : entry.status };
}
