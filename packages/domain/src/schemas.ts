import { z } from 'zod';

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
  'vehicle_registration',
  'insurance',
  'vehicle_photos',
]);

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
