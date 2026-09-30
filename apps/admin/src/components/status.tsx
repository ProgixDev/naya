import {
  OFFER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  RIDE_STATUS_LABELS,
  SCHEDULED_STATUS_LABELS,
  STATUS_LABELS,
  SUPPORT_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
  type CityStatus,
  type OfferStatus,
  type PaymentStatus,
  type RideStatus,
  type ScheduledStatus,
  type SupportStatus,
  type TransferStatus,
  type VerificationStatus,
} from '@naya/domain';
import { Badge, type Tone } from './ui';

const vTone: Record<VerificationStatus, Tone> = { draft: 'neutral', submitted: 'info', in_review: 'accent', approved: 'success', more_info_requested: 'warning', rejected: 'danger' };
export const VerificationBadge = ({ status }: { status: VerificationStatus | null }) => (status ? <Badge tone={vTone[status]}>{STATUS_LABELS[status]}</Badge> : <Badge>Non commencé</Badge>);

const rTone: Record<RideStatus, Tone> = { searching: 'info', driver_assigned: 'accent', driver_arrived: 'accent', in_progress: 'accent', completed: 'success', cancelled: 'neutral', no_driver: 'warning' };
export const RideBadge = ({ status }: { status: RideStatus }) => <Badge tone={rTone[status]}>{status === 'completed' ? 'Terminée' : RIDE_STATUS_LABELS[status]}</Badge>;

const pTone: Record<PaymentStatus, Tone> = { pending: 'warning', confirmed: 'success', failed: 'danger', cancelled: 'neutral' };
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => <Badge tone={pTone[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;

const tTone: Record<TransferStatus, Tone> = { pending: 'warning', confirmed: 'success', failed: 'danger' };
export const TransferBadge = ({ status }: { status: TransferStatus }) => <Badge tone={tTone[status]}>{TRANSFER_STATUS_LABELS[status]}</Badge>;

const sTone: Record<SupportStatus, Tone> = { open: 'info', in_progress: 'accent', awaiting_user: 'warning', resolved: 'success' };
export const TicketBadge = ({ status }: { status: SupportStatus }) => <Badge tone={sTone[status]}>{SUPPORT_STATUS_LABELS[status]}</Badge>;

const oTone: Record<OfferStatus, Tone> = { pending: 'info', accepted: 'success', declined: 'neutral', expired: 'warning', withdrawn: 'neutral' };
export const OfferBadge = ({ status }: { status: OfferStatus }) => <Badge tone={oTone[status]}>{OFFER_STATUS_LABELS[status]}</Badge>;

const bTone: Record<ScheduledStatus, Tone> = { scheduled: 'info', dispatched: 'success', cancelled: 'neutral', expired: 'warning' };
export const ScheduledBadge = ({ status }: { status: ScheduledStatus }) => <Badge tone={bTone[status]}>{SCHEDULED_STATUS_LABELS[status]}</Badge>;

const CITY_LABELS: Record<CityStatus, string> = { active: 'Active', test: 'En test', inactive: 'Inactive' };
const cTone: Record<CityStatus, Tone> = { active: 'success', test: 'warning', inactive: 'neutral' };
export const CityBadge = ({ status }: { status: CityStatus }) => <Badge tone={cTone[status]}>{CITY_LABELS[status]}</Badge>;
export const cityStatusLabel = (s: CityStatus) => CITY_LABELS[s];

export const SUBJECT_LABELS = { passenger_identity: 'Identité passagère', driver_identity: 'Identité chauffeuse', vehicle: 'Véhicule' } as const;
export const METHOD_LABELS = { cash: 'Espèces', card: 'Carte' } as const;
export const LEDGER_LABELS = {
  ride_commission: 'Commission (espèces)',
  ride_net_credit: 'Revenu net (carte)',
  cancellation_fee_credit: 'Frais d’annulation',
  recharge: 'Recharge',
  withdrawal: 'Retrait',
  correction: 'Correction',
} as const;
