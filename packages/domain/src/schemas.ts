import { z } from 'zod';
import { casablancaToday } from './time';

const centimes = z.number().int().safe();
const positiveCentimes = centimes.positive();
const bp = z.number().int().min(0).max(100_000);

export const latLngSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const placeSchema = z.object({
  id: z.string().nullable(),
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().max(200),
  location: latLngSchema,
});

export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Numéro invalide');

export const otpRequestSchema = z.object({ phone: phoneSchema, role: z.enum(['passenger', 'driver']) });
export const otpVerifySchema = otpRequestSchema.extend({ code: z.string().regex(/^\d{6}$/, 'Le code contient 6 chiffres') });

export const adminLoginSchema = z.object({
  email: z.email('Adresse e-mail invalide'),
  password: z.string().min(8, '8 caractères minimum'),
});

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis').max(60).optional(),
  lastName: z.string().trim().min(1, 'Nom requis').max(60).optional(),
  cityId: z.string().min(1).optional(),
  notifications: z
    .object({
      rideUpdates: z.boolean(),
      scheduledReminders: z.boolean(),
      supportReplies: z.boolean(),
      offers: z.boolean(),
      product: z.boolean(),
    })
    .partial()
    .optional(),
});

export const savedPlaceSchema = z.object({
  kind: z.enum(['home', 'work', 'other']),
  label: z.string().trim().min(1, 'Nom requis').max(40),
  place: placeSchema,
});

const isAdult = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const age = now.getUTCFullYear() - d.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) ? 1 : 0);
  return age >= 18 && age < 110;
};

export const identityDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis').max(60),
  lastName: z.string().trim().min(1, 'Nom requis').max(60),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ').refine(isAdult, 'Vous devez avoir 18 ans ou plus'),
  documentType: z.enum(['cin', 'passport', 'residence_permit']),
  documentNumber: z.string().trim().min(5, 'Numéro trop court').max(20).regex(/^[A-Za-z0-9]+$/, 'Lettres et chiffres uniquement'),
  address: z.string().trim().min(8, 'Indiquez votre adresse complète').max(200).optional(),
  city: z.string().trim().min(2, 'Indiquez votre ville').max(60).optional(),
});

/** A driver's personal details: the identity fields plus a required address and city. */
export const driverPersonalSchema = identityDetailsSchema.extend({
  address: z.string().trim().min(8, 'Indiquez votre adresse complète').max(200),
  city: z.string().trim().min(2, 'Indiquez votre ville').max(60),
});

export const vehicleDetailsSchema = z.object({
  make: z.string().trim().min(1, 'Marque requise').max(40),
  model: z.string().trim().min(1, 'Modèle requis').max(40),
  color: z.string().trim().min(1, 'Couleur requise').max(30),
  plate: z.string().trim().min(4, 'Immatriculation requise').max(15),
  year: z.number().int().min(2012, 'Véhicule de 2012 ou plus récent').max(new Date().getUTCFullYear() + 1),
});

export const verificationItemKeySchema = z.enum([
  'selfie',
  'id_front',
  'id_back',
  'driving_licence',
  'driving_licence_back',
  'vehicle_registration',
  'insurance',
  'technical_inspection',
  'vehicle_photos',
  'vehicle_photo_front',
  'vehicle_photo_back',
  'vehicle_photo_left',
  'vehicle_photo_right',
  'vehicle_photo_interior',
  'criminal_record',
]);

/* ───────── Driver sign-up (13 Oct 2026 brief, task 2) ───────── */

/** A real calendar date written YYYY-MM-DD. */
export const isCalendarDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format JJ/MM/AAAA').refine(isCalendarDate, 'Cette date n’existe pas');

/** Whole years from `from` to `to` (both YYYY-MM-DD). */
export function fullYearsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return ty - fy - (tm < fm || (tm === fm && td < fd) ? 1 : 0);
}

export const licenceNumberSchema = z
  .string()
  .trim()
  .min(5, 'Numéro trop court')
  .max(20, 'Numéro trop long')
  .regex(/^[A-Za-z0-9/-]+$/, 'Lettres, chiffres, « / » ou « - » uniquement');

export const LICENCE_CATEGORY_MESSAGE = 'Le permis B est requis pour conduire avec Naya.';
export const experienceYearsSchema = z.number({ error: 'Indiquez un nombre d’années' }).int('Nombre entier').min(0, 'Nombre positif').max(60, '60 ans maximum');

type LicenceCheck = { category?: string; issueDate?: string; expiryDate?: string; experienceYears?: number };

/**
 * Cross-field licence rules, French messages keyed by LicenceDetails field. `today` is the
 * Casablanca business date; `birthDate` (when known) checks the licence was issued at 18+.
 */
export function licenceProblems(l: LicenceCheck, ctx: { today: string; birthDate?: string | null }): Partial<Record<keyof LicenceCheck, string>> {
  const out: Partial<Record<keyof LicenceCheck, string>> = {};
  if (l.category !== undefined && l.category !== 'B') out.category = LICENCE_CATEGORY_MESSAGE;
  const issue = l.issueDate && isCalendarDate(l.issueDate) ? l.issueDate : null;
  const expiry = l.expiryDate && isCalendarDate(l.expiryDate) ? l.expiryDate : null;
  if (issue && issue > ctx.today) out.issueDate = 'La date de délivrance ne peut pas être dans le futur.';
  else if (issue && ctx.birthDate && isCalendarDate(ctx.birthDate) && fullYearsBetween(ctx.birthDate, issue) < 18) {
    out.issueDate = 'Le permis B est délivré à partir de 18 ans : vérifiez la date.';
  }
  if (expiry && expiry <= ctx.today) out.expiryDate = 'Votre permis est expiré. Renouvelez-le avant de vous inscrire.';
  else if (expiry && issue && expiry <= issue) out.expiryDate = 'La date d’expiration doit suivre la date de délivrance.';
  if (issue && !out.issueDate && l.experienceYears !== undefined && Number.isFinite(l.experienceYears)) {
    const max = Math.max(0, fullYearsBetween(issue, ctx.today));
    if (l.experienceYears > max) out.experienceYears = `Pas plus que l’ancienneté de votre permis (${max} an${max > 1 ? 's' : ''}).`;
  }
  return out;
}

const licenceDetailsShape = z.object({
  number: licenceNumberSchema,
  category: z.literal('B', { error: LICENCE_CATEGORY_MESSAGE }),
  issueDate: calendarDate,
  expiryDate: calendarDate,
  experienceYears: experienceYearsSchema,
});

/** The licence with its date rules checked against `today` (Casablanca) and, if known, the birth date. */
export const licenceDetailsSchemaFor = (today: string, birthDate?: string | null) =>
  licenceDetailsShape.superRefine((v, ctx) => {
    for (const [path, message] of Object.entries(licenceProblems(v, { today, birthDate }))) ctx.addIssue({ code: 'custom', path: [path], message });
  });

export const licenceDetailsSchema = licenceDetailsShape.superRefine((v, ctx) => {
  for (const [path, message] of Object.entries(licenceProblems(v, { today: casablancaToday() }))) ctx.addIssue({ code: 'custom', path: [path], message });
});

const personName = z.string().trim().min(2, 'Nom et prénom requis').max(80);
export const familleReferenceSchema = z.object({ name: personName, phone: phoneSchema });

/** Interview days offered to Famille applicants: the next `count` days, Sundays excluded. */
export function interviewDays(today: string, count = 6): string[] {
  const out: string[] = [];
  const d = new Date(`${today}T12:00:00Z`);
  while (out.length < count) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type FamilleCheck = { references?: { name?: string; phone?: string }[]; interview?: { day?: string } };

/** Cross-field Famille rules: two distinct references, not the driver herself; a future interview day. */
export function familleProblems(f: FamilleCheck, ctx: { today: string; ownPhone?: string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  const phones = (f.references ?? []).map((r) => r.phone).filter((p): p is string => !!p);
  phones.forEach((p, i) => {
    if (ctx.ownPhone && p === ctx.ownPhone) out[`references.${i}.phone`] = 'Indiquez une autre personne que vous-même.';
  });
  if (phones.length === 2 && phones[0] === phones[1]) out['references.1.phone'] = 'Les deux références doivent être différentes.';
  const day = f.interview?.day;
  if (day && isCalendarDate(day)) {
    if (day <= ctx.today) out['interview.day'] = 'Choisissez un jour à venir.';
    else if (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) out['interview.day'] = 'Les entretiens ont lieu du lundi au samedi.';
  }
  return out;
}

const familleApplicationShape = z.object({
  references: z.tuple([familleReferenceSchema, familleReferenceSchema]),
  childExperience: z.object({
    years: experienceYearsSchema,
    summary: z.string().trim().min(20, 'Décrivez votre expérience en quelques phrases (20 caractères minimum)').max(500, '500 caractères maximum'),
  }),
  trainingAcknowledged: z.literal(true, { error: 'Confirmez votre engagement à suivre la formation' }),
  interview: z.object({ day: calendarDate, window: z.enum(['morning', 'afternoon']) }),
});

const issuePath = (path: string) => path.split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : x));

/** The Famille application with its cross-field rules checked against `today` and the driver's own phone. */
export const familleApplicationSchemaFor = (today: string, ownPhone?: string | null) =>
  familleApplicationShape.superRefine((v, ctx) => {
    for (const [path, message] of Object.entries(familleProblems(v, { today, ownPhone }))) ctx.addIssue({ code: 'custom', path: issuePath(path), message });
  });

export const familleApplicationSchema = familleApplicationShape.superRefine((v, ctx) => {
  for (const [path, message] of Object.entries(familleProblems(v, { today: casablancaToday() }))) ctx.addIssue({ code: 'custom', path: issuePath(path), message });
});

/** A partial save of the sign-up wizard: types and lengths only; rules apply on promotion. */
export const signupDraftSchema = z
  .object({
    firstName: z.string().trim().max(60),
    lastName: z.string().trim().max(60),
    birthDate: z.string().max(10),
    documentType: z.enum(['cin', 'passport', 'residence_permit']),
    documentNumber: z.string().trim().max(20),
    address: z.string().trim().max(200),
    city: z.string().trim().max(60),
    licenceNumber: z.string().trim().max(20),
    licenceCategory: z.string().max(4),
    licenceIssueDate: z.string().max(10),
    licenceExpiryDate: z.string().max(10),
    experienceYears: z.number().int().min(0).max(99),
    make: z.string().trim().max(40),
    model: z.string().trim().max(40),
    color: z.string().trim().max(30),
    plate: z.string().trim().max(15),
    year: z.number().int().min(0).max(9999),
    reference1Name: z.string().trim().max(80),
    reference1Phone: z.string().max(16),
    reference2Name: z.string().trim().max(80),
    reference2Phone: z.string().max(16),
    childExperienceYears: z.number().int().min(0).max(99),
    childExperienceSummary: z.string().trim().max(500),
    trainingAcknowledged: z.boolean(),
    interviewDay: z.string().max(10),
    interviewWindow: z.enum(['morning', 'afternoon']),
  })
  .partial();

export const uploadSchema = z.object({
  purpose: z.union([verificationItemKeySchema, z.literal('support_attachment')]),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  dataBase64: z.string().min(16).max(14_000_000),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const quoteRequestSchema = z.object({
  categoryId: z.string().optional(),
  cityId: z.string().min(1),
  stops: z.array(placeSchema).min(2).max(4),
});

export const createRideSchema = z.object({ quoteId: z.string().min(1), paymentMethodId: z.string().min(1) });

export const scheduleRideSchema = createRideSchema.extend({ pickupAt: z.iso.datetime() });
export const modifyScheduledSchema = z.object({ pickupAt: z.iso.datetime(), paymentMethodId: z.string().min(1).optional() });

export const cancelSchema = z.object({
  reasonCode: z.string().min(1, 'Choisissez un motif'),
  reasonText: z.string().trim().max(300).optional(),
  /** The fee displayed to the user; the server refuses if it no longer matches. */
  acknowledgedFee: centimes.min(0).optional(),
});

export const ratingSchema = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().max(500).nullable() });

export const declineOfferSchema = z.object({ reasonCode: z.string().min(1) });

export const goOnlineSchema = z.object({ online: z.boolean(), location: latLngSchema.nullable().optional() });
export const locationUpdateSchema = z.object({ location: latLngSchema, heading: z.number().nullable().optional() });

export const cashCollectedSchema = z.object({ amount: positiveCentimes });

export const rechargeSchema = z.object({ amount: positiveCentimes, providerId: z.string().min(1) });
export const withdrawalSchema = z.object({ amount: positiveCentimes, payoutAccountId: z.string().min(1) });

export const tokenizedCardSchema = z.object({ providerToken: z.string().min(8), makeDefault: z.boolean().default(false) });

export const supportTicketSchema = z.object({
  reasonId: z.string().optional(),
  rideId: z.string().nullable(),
  category: z.enum(['ride', 'payment', 'safety', 'account', 'wallet', 'other']),
  subject: z.string().trim().min(3, 'Objet trop court').max(120),
  body: z.string().trim().min(10, 'Décrivez votre demande (10 caractères minimum)').max(2000),
  attachments: z.array(z.string()).max(3).default([]),
});

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message vide').max(2000),
  attachments: z.array(z.string()).max(3).default([]),
});

export const decisionSchema = z
  .object({
    outcome: z.enum(['approved', 'more_info_requested', 'rejected']),
    reasonCode: z.string().nullable(),
    message: z.string().trim().max(600),
    corrections: z.array(z.object({ key: verificationItemKeySchema, note: z.string().trim().min(3).max(300) })).default([]),
    expectedVersion: z.number().int(),
  })
  .superRefine((v, ctx) => {
    if (v.outcome !== 'approved' && v.message.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'Expliquez la décision (10 caractères minimum)' });
    }
    if (v.outcome === 'more_info_requested' && v.corrections.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['corrections'], message: 'Indiquez au moins une pièce à corriger' });
    }
  });

export const cityRulesSchema = z.object({
  baseFare: centimes.min(0),
  perKm: centimes.min(0),
  perMinute: centimes.min(0),
  minimumFare: centimes.min(0),
  commissionBp: bp.max(5000),
  debtLimit: centimes.min(0),
  cancellation: z.object({ graceSeconds: z.number().int().min(0).max(1800), feeAfterGrace: centimes.min(0), feeAfterArrival: centimes.min(0) }),
  dynamic: z.object({ enabled: z.boolean(), multiplierBp: z.number().int().min(10_000).max(30_000), reason: z.string().trim().max(160) }),
  offerTimeoutSeconds: z.number().int().min(10).max(120),
  searchTimeoutSeconds: z.number().int().min(30).max(900),
  quoteValiditySeconds: z.number().int().min(60).max(3600),
  scheduling: z.object({ minLeadMinutes: z.number().int().min(10), maxDaysAhead: z.number().int().min(1).max(60), modifyCutoffMinutes: z.number().int().min(0) }),
  minimumWithdrawal: centimes.min(0),
});

export const reasonSchema = z.string().trim().min(10, 'Motif requis (10 caractères minimum)').max(500);

export const updateRulesSchema = z.object({ rules: cityRulesSchema, reason: reasonSchema, expectedVersion: z.number().int() });

export const createCitySchema = z.object({
  id: z.string().regex(/^[a-z][a-z-]{2,30}$/, 'Identifiant en minuscules'),
  name: z.string().trim().min(2).max(60),
  status: z.enum(['test', 'inactive']),
  center: latLngSchema,
  rules: cityRulesSchema,
  reason: reasonSchema,
});

export const cityStatusSchema = z.object({ status: z.enum(['active', 'test', 'inactive']), reason: reasonSchema });

export const zoneSchema = z.object({ name: z.string().trim().min(2).max(60), polygon: z.array(latLngSchema).min(3), active: z.boolean(), reason: reasonSchema });

export const providerToggleSchema = z.object({ enabled: z.boolean(), reason: reasonSchema });

export const correctionSchema = z.object({
  driverId: z.string().min(1),
  amount: centimes.refine((v) => v !== 0, 'Montant non nul requis'),
  reason: reasonSchema,
  relatedEntityId: z.string().nullable().default(null),
});

export const resolveTicketSchema = z.object({ outcome: z.string().trim().min(3).max(80), note: reasonSchema });

export const providerCallbackSchema = z.object({
  eventId: z.string().min(1),
  kind: z.enum(['payment', 'recharge', 'withdrawal']),
  ref: z.string().min(1),
  outcome: z.enum(['confirmed', 'failed']),
  reason: z.string().nullable().default(null),
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type OtpVerify = z.infer<typeof otpVerifySchema>;
export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type SavedPlaceInput = z.infer<typeof savedPlaceSchema>;
export type IdentityDetailsInput = z.infer<typeof identityDetailsSchema>;
export type VehicleDetailsInput = z.infer<typeof vehicleDetailsSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type CreateRide = z.infer<typeof createRideSchema>;
export type ScheduleRide = z.infer<typeof scheduleRideSchema>;
export type ModifyScheduled = z.infer<typeof modifyScheduledSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type RatingInput = z.infer<typeof ratingSchema>;
export type DeclineOffer = z.infer<typeof declineOfferSchema>;
export type GoOnline = z.infer<typeof goOnlineSchema>;
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;
export type RechargeInput = z.infer<typeof rechargeSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
export type TokenizedCardInput = z.input<typeof tokenizedCardSchema>;
export type SupportTicketInput = z.input<typeof supportTicketSchema>;
export type SupportMessageInput = z.input<typeof supportMessageSchema>;
export type DecisionInput = z.input<typeof decisionSchema>;
export type UpdateRulesInput = z.infer<typeof updateRulesSchema>;
export type CreateCityInput = z.infer<typeof createCitySchema>;
export type CityStatusInput = z.infer<typeof cityStatusSchema>;
export type ZoneInput = z.infer<typeof zoneSchema>;
export type ProviderToggleInput = z.infer<typeof providerToggleSchema>;
export type CorrectionInput = z.input<typeof correctionSchema>;
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>;
export type ProviderCallback = z.input<typeof providerCallbackSchema>;
export type DriverPersonalInput = z.infer<typeof driverPersonalSchema>;
export type LicenceDetailsInput = z.infer<typeof licenceDetailsSchema>;
export type FamilleApplicationInput = z.infer<typeof familleApplicationSchema>;
export type SignupDraftInput = z.infer<typeof signupDraftSchema>;
