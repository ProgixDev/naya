import { copyFileSync, mkdirSync, rmSync, join, fixturePath } from './platform';
import {
  CASABLANCA_RULES,
  CASABLANCA_ZONE,
  computeFare,
  demoRoute,
  mad,
  PLACES,
  RABAT_RULES,
  RABAT_ZONE,
  splitFare,
  type CityConfig,
  type CityRules,
  type IdentityDetails,
  type Ride,
  type User,
  type VerificationCase,
  type VerificationItem,
  type VerificationItemKey,
  type VerificationStatus,
} from '@naya/domain';
import type { State } from './state';
import { defaultProviders } from './services/payments';
import { appendAudit, SYSTEM } from './audit';
import { hashPassword } from './services/auth';
import { nextId } from './store';
import { postLedger } from './services/finance';



export const SCENARIOS = {
  default: 'Monde de démonstration complet : NY-001 (espèces) et NY-002 (carte) terminées, portefeuille d’Amina à 70 MAD, file de vérification, Leila en dette.',
  'first-ride': 'Aucune course : portefeuille d’Amina à 0 MAD. Idéal pour S03 (NY-001 en espèces → −15 MAD).',
  'after-cash': 'NY-001 terminée en espèces : portefeuille d’Amina à −15 MAD. Idéal pour S04 (carte → 70 MAD).',
  'no-casablanca': 'Casablanca n’est pas encore configurée. Idéal pour S15 (ajout d’une ville en test).',
  'dynamic-pricing': 'Tarification dynamique ×1,2 active à Rabat. Idéal pour S06.',
} as const;
export type ScenarioId = keyof typeof SCENARIOS;

export const DEMO_ACCOUNTS = {
  passengers: [
    { phone: '+212612345678', name: 'Salma El Mansouri', state: 'Identité approuvée · testeuse Casablanca' },
    { phone: '+212623456789', name: 'Nour Benali', state: 'Dossier envoyé, en attente d’examen' },
    { phone: '+212634567890', name: 'Imane Tazi', state: 'Complément demandé (verso illisible)' },
    { phone: '+212645678901', name: 'Rania Alaoui', state: 'Dossier refusé, pièce expirée (récupérable)' },
  ],
  drivers: [
    { phone: '+212661234567', name: 'Amina Bennani', state: 'Personne et véhicule approuvés' },
    { phone: '+212662345678', name: 'Khadija Idrissi', state: 'Personne approuvée · véhicule en examen' },
    { phone: '+212665678901', name: 'Samira Fassi', state: 'Véhicule approuvé · permis à corriger' },
    { phone: '+212664567890', name: 'Leila Amrani', state: 'Solde −150 MAD : offres bloquées' },
    { phone: '+212663456789', name: 'Nadia Chraibi', state: 'Chauffeuse simulée (bot de démonstration)' },
  ],
  admins: [
    { email: 'meryem@naya.demo', password: 'Naya-Admin-2026', name: 'Meryem Lahlou', role: 'Administratrice (toutes permissions)' },
    { email: 'youssra@naya.demo', password: 'Naya-Support-2026', name: 'Youssra Kettani', role: 'Agente support (sans finance ni décisions)' },
  ],
  otp: '123456',
};

const iso = (ms: number) => new Date(ms).toISOString();

function emptyState(scenario: string): State {
  return {
    schemaVersion: 1,
    scenario,
    version: 1,
    counters: {},
    users: [],
    admins: [],
    adminCredentials: [],
    sessions: [],
    otps: [],
    cases: [],
    vehicles: [],
    uploads: [],
    cities: [],
    cityRuleVersions: [],
    zones: [],
    providers: [],
    paymentMethods: [],
    payoutAccounts: [],
    quotes: [],
    rides: [],
    offers: [],
    scheduled: [],
    payments: [],
    ledger: [],
    recharges: [],
    withdrawals: [],
    tickets: [],
    audit: [],
    presence: [],
    idempotency: [],
    providerJobs: [],
    processedProviderEvents: [],
    tracking: [],
  };
}

function city(s: State, id: string, name: string, status: CityConfig['status'], center: CityConfig['center'], rules: CityRules, at: string) {
  s.cities.push({ id, name, status, timezone: 'Africa/Casablanca', currency: 'MAD', center, rules, rulesVersion: 1, updatedAt: at, updatedBy: 'system' });
  s.cityRuleVersions.push({ cityId: id, version: 1, rules, createdAt: at, createdBy: 'system', reason: 'Configuration initiale de démonstration' });
  s.providers.push(...defaultProviders(id));
  appendAudit(s, at, { actor: SYSTEM, action: 'city.created', entityType: 'city', entityId: id, cityId: id, summary: `Ville ${name} configurée (${status === 'active' ? 'active' : 'test'}) · règles v1` });
}

function upload(s: State, dataDir: string, ownerId: string, purpose: VerificationItemKey, fixture: string, at: string) {
  const id = nextId(s, 'UP', 5);
  mkdirSync(join(dataDir, 'uploads'), { recursive: true });
  copyFileSync(fixturePath(`${fixture}.jpg`), join(dataDir, 'uploads', `${id}.jpg`));
  s.uploads.push({ id, ownerId, purpose, mimeType: 'image/jpeg', width: 1000, height: 630, size: 90_000, createdAt: at });
  return id;
}

interface PersonSpec {
  role: 'passenger' | 'driver';
  first: string;
  last: string;
  phone: string;
  who: 'salma' | 'amina' | 'generic';
  status: VerificationStatus;
  birth: string;
  doc: string;
  testerCities?: string[];
  rating?: number;
  decisionReason?: string;
  corrections?: { key: VerificationItemKey; note: string }[];
}

function person(s: State, dataDir: string, spec: PersonSpec, at: string): User {
  const id = nextId(s, spec.role === 'passenger' ? 'PA' : 'DR');
  const caseId = nextId(s, spec.role === 'passenger' ? 'VP' : 'VD');
  const user: User = {
    id,
    role: spec.role,
    phone: spec.phone,
    firstName: spec.first,
    lastName: spec.last,
    cityId: 'rabat',
    status: 'active',
    testerCities: spec.testerCities ?? [],
    createdAt: at,
    savedPlaces: [],
    notifications: { rideUpdates: true, scheduledReminders: true, supportReplies: true, offers: true, product: false },
    identityCaseId: caseId,
    vehicleId: null,
    ratingAverage: spec.rating ?? null,
    ratingCount: spec.rating ? 42 : 0,
  };
  s.users.push(user);
  const identity: IdentityDetails = { firstName: spec.first, lastName: spec.last, birthDate: spec.birth, documentType: 'cin', documentNumber: spec.doc };
  const keys: VerificationItemKey[] = spec.role === 'passenger' ? ['selfie', 'id_front', 'id_back'] : ['selfie', 'id_front', 'id_back', 'driving_licence'];
  const fixtureFor = (k: VerificationItemKey) => {
    if (k === 'selfie') return spec.who === 'generic' ? 'salma-selfie' : `${spec.who}-selfie`;
    if (k === 'driving_licence') return spec.corrections?.some((c) => c.key === k) ? 'generic-licence-blurry' : 'amina-licence';
    return `${spec.who}-${k.replace('_', '-')}`;
  };
  const items: VerificationItem[] = keys.map((key) => {
    const correction = spec.corrections?.find((c) => c.key === key);
    return {
      key,
      uploadIds: spec.status === 'draft' ? [] : [upload(s, dataDir, id, key, fixtureFor(key), at)],
      status: spec.status === 'approved' ? 'accepted' : correction ? 'needs_correction' : spec.status === 'draft' ? 'missing' : 'provided',
      note: correction?.note ?? null,
    };
  });
  s.cases.push(caseFor(caseId, spec.role === 'passenger' ? 'passenger_identity' : 'driver_identity', id, null, spec.status, items, identity, null, at, spec));
  return user;
}

function caseFor(
  id: string,
  subject: VerificationCase['subject'],
  userId: string,
  vehicleId: string | null,
  status: VerificationStatus,
  items: VerificationItem[],
  identity: IdentityDetails | null,
  vehicle: VerificationCase['vehicle'],
  at: string,
  spec: { decisionReason?: string; corrections?: unknown[] },
): VerificationCase {
  const decided = status === 'approved' || status === 'rejected' || status === 'more_info_requested';
  const messages: Record<string, string> = {
    approved: 'Dossier validé après examen manuel.',
    rejected: 'La pièce d’identité fournie est expirée. Vous pouvez recommencer avec une pièce valide.',
    more_info_requested: 'Une pièce est illisible. Merci de la reprendre en pleine lumière.',
  };
  return {
    id,
    subject,
    userId,
    vehicleId,
    status,
    items,
    identity,
    vehicle,
    decision: decided
      ? { outcome: status as 'approved', reasonCode: spec.decisionReason ?? null, message: messages[status]!, decidedBy: 'AD-001', decidedByName: 'Meryem Lahlou', decidedAt: at }
      : null,
    history: [
      { at, status: 'submitted', by: userId, note: 'Dossier envoyé' },
      ...(decided ? [{ at, status, by: 'AD-001', note: messages[status]! }] : []),
    ],
    submittedAt: status === 'draft' ? null : at,
    updatedAt: at,
    version: decided ? 3 : 2,
  };
}

function vehicleFor(s: State, dataDir: string, driver: User, status: VerificationStatus, color: 'pearl' | 'plum', plate: string, at: string) {
  const vehicleId = nextId(s, 'VE');
  const caseId = nextId(s, 'VV');
  const details = { make: 'Naya', model: 'Signature', color: color === 'pearl' ? 'Perle' : 'Prune', plate, year: color === 'pearl' ? 2024 : 2023 };
  s.vehicles.push({ id: vehicleId, driverId: driver.id, caseId, ...details });
  driver.vehicleId = vehicleId;
  const items: VerificationItem[] = [
    { key: 'vehicle_registration', uploadIds: [upload(s, dataDir, driver.id, 'vehicle_registration', color === 'pearl' ? 'vehicle-registration' : 'vehicle-registration-2', at)], status: status === 'approved' ? 'accepted' : 'provided', note: null },
    { key: 'insurance', uploadIds: [upload(s, dataDir, driver.id, 'insurance', 'insurance', at)], status: status === 'approved' ? 'accepted' : 'provided', note: null },
    { key: 'vehicle_photos', uploadIds: [upload(s, dataDir, driver.id, 'vehicle_photos', `vehicle-${color}`, at)], status: status === 'approved' ? 'accepted' : 'provided', note: null },
  ];
  s.cases.push(caseFor(caseId, 'vehicle', driver.id, vehicleId, status, items, null, details, at, {}));
}

function completedRide(s: State, passenger: User, driver: User, kind: 'cash' | 'card', pmId: string, pmLabel: string, completedMs: number, route = demoRoute([PLACES.gareRabatVille, PLACES.agdal, PLACES.hayRiad]), series = 'NY'): Ride {
  const rules = s.cities.find((c) => c.id === 'rabat')!.rules;
  const breakdown = computeFare(rules, route.distanceMeters, route.durationSeconds);
  const start = completedMs - route.durationSeconds * 1000;
  const v = s.vehicles.find((x) => x.id === driver.vehicleId)!;
  const id = nextId(s, series);
  const t = (ms: number) => iso(ms);
  const ride: Ride = {
    id,
    cityId: 'rabat',
    passengerId: passenger.id,
    passenger: { id: passenger.id, firstName: passenger.firstName, ratingAverage: passenger.ratingAverage },
    driverId: driver.id,
    driver: { id: driver.id, firstName: driver.firstName, lastInitial: driver.lastName[0]!, ratingAverage: driver.ratingAverage, phoneMasked: 'Appel masqué via Naya', vehicle: { make: v.make, model: v.model, color: v.color, plate: v.plate } },
    status: 'completed',
    route,
    terms: { quoteId: `QT-SEED-${id}`, cityId: 'rabat', currency: 'MAD', ruleVersion: 1, breakdown, commissionBp: rules.commissionBp, cancellation: rules.cancellation, dynamic: null, acceptedAt: t(start - 360_000) },
    paymentMethod: { id: pmId, kind, label: pmLabel },
    paymentId: null,
    completedStops: route.stops.length - 2,
    requestedAt: t(start - 360_000),
    searchStartedAt: t(start - 360_000),
    assignedAt: t(start - 330_000),
    arrivedAt: t(start - 60_000),
    startedAt: t(start),
    completedAt: t(completedMs),
    cancellation: null,
    driverCancellations: [],
    scheduledBookingId: null,
    rating: { stars: 5, comment: null, at: t(completedMs + 60_000) },
    driverLocation: null,
    timeline: [
      { at: t(start - 360_000), type: 'requested', actor: 'passenger', label: 'Course demandée' },
      { at: t(start - 330_000), type: 'assigned', actor: 'driver', label: `${driver.firstName} a accepté la course` },
      { at: t(start - 60_000), type: 'arrived', actor: 'driver', label: `${driver.firstName} est arrivée au point de départ` },
      { at: t(start), type: 'started', actor: 'driver', label: 'Trajet commencé' },
      ...(route.stops.length > 2 ? [{ at: t(start + 480_000), type: 'stop.done', actor: 'driver' as const, label: `Arrêt effectué · ${route.stops[1]!.label}` }] : []),
      { at: t(completedMs), type: 'completed', actor: 'driver', label: 'Arrivée à destination' },
    ],
    simulated: true,
  };
  s.rides.push(ride);
  const split = splitFare(breakdown.total, rules.commissionBp);
  const paymentId = nextId(s, 'PY');
  s.payments.push({ id: paymentId, rideId: id, payerId: passenger.id, purpose: 'ride', method: kind, amount: split.gross, status: 'confirmed', provider: kind === 'card' ? 'demo-card' : 'cash', providerRef: kind === 'card' ? `demo_py_${paymentId}` : null, failureReason: null, createdAt: t(completedMs), updatedAt: t(completedMs + 3000) });
  ride.paymentId = paymentId;
  ride.timeline.push({ at: t(completedMs + 3000), type: kind === 'card' ? 'payment.confirmed' : 'cash.collected', actor: kind === 'card' ? 'provider' : 'driver', label: kind === 'card' ? `Paiement carte confirmé · 100 MAD` : 'Espèces encaissées · 100 MAD' });
  if (kind === 'cash') postLedger(s, t(completedMs), { driverId: driver.id, type: 'ride_commission', amount: -split.commission, description: `Commission course ${id} (espèces)`, rideId: id, idempotencyKey: `ride:${id}:commission` });
  else postLedger(s, t(completedMs + 3000), { driverId: driver.id, type: 'ride_net_credit', amount: split.net, description: `Revenu net course ${id} (carte)`, rideId: id, idempotencyKey: `ride:${id}:net` });
  return ride;
}

export function buildSeed(dataDir: string, scenario: ScenarioId = 'default', nowMs = Date.now()): State {
  rmSync(join(dataDir, 'uploads'), { recursive: true, force: true });
  const s = emptyState(scenario);
  const at = iso(nowMs - 3 * 86_400_000);

  const rabatRules: CityRules = scenario === 'dynamic-pricing' ? { ...RABAT_RULES, dynamic: { ...RABAT_RULES.dynamic, enabled: true } } : RABAT_RULES;
  city(s, 'rabat', 'Rabat', 'active', { lat: 34.0133, lng: -6.8326 }, rabatRules, at);
  s.zones.push({ id: nextId(s, 'ZN'), cityId: 'rabat', name: 'Rabat · zone de lancement', polygon: RABAT_ZONE, active: true });
  if (scenario !== 'no-casablanca') {
    city(s, 'casablanca', 'Casablanca', 'test', { lat: 33.5883, lng: -7.6114 }, CASABLANCA_RULES, at);
    s.zones.push({ id: nextId(s, 'ZN'), cityId: 'casablanca', name: 'Casablanca · centre (test)', polygon: CASABLANCA_ZONE, active: true });
  }

  s.admins.push(
    { id: 'AD-001', email: 'meryem@naya.demo', name: 'Meryem Lahlou', title: 'Administratrice', permissions: ['verification.decide', 'finance.read', 'finance.correct', 'config.edit', 'support.resolve', 'rides.read', 'audit.read', 'people.read'] },
    { id: 'AD-002', email: 'youssra@naya.demo', name: 'Youssra Kettani', title: 'Agente support', permissions: ['support.resolve', 'rides.read', 'people.read'] },
  );
  s.adminCredentials.push({ adminId: 'AD-001', ...hashPassword('Naya-Admin-2026') }, { adminId: 'AD-002', ...hashPassword('Naya-Support-2026') });

  // Passengers
  const salma = person(s, dataDir, { role: 'passenger', first: 'Salma', last: 'El Mansouri', phone: '+212612345678', who: 'salma', status: 'approved', birth: '1996-04-12', doc: 'AB123456', testerCities: ['casablanca'], rating: 4.9 }, at);
  person(s, dataDir, { role: 'passenger', first: 'Nour', last: 'Benali', phone: '+212623456789', who: 'generic', status: 'submitted', birth: '1999-02-20', doc: 'EF112233' }, iso(nowMs - 2 * 3_600_000));
  person(s, dataDir, { role: 'passenger', first: 'Imane', last: 'Tazi', phone: '+212634567890', who: 'generic', status: 'more_info_requested', birth: '1993-07-08', doc: 'GH445566', corrections: [{ key: 'id_back', note: 'Le verso est coupé : reprenez la photo en entier, sans reflet.' }] }, at);
  person(s, dataDir, { role: 'passenger', first: 'Rania', last: 'Alaoui', phone: '+212645678901', who: 'generic', status: 'rejected', birth: '1990-11-30', doc: 'IJ778899', decisionReason: 'document_expired' }, at);
  const hiba = person(s, dataDir, { role: 'passenger', first: 'Hiba', last: 'Ouazzani', phone: '+212656789012', who: 'generic', status: 'approved', birth: '1997-03-15', doc: 'KL990011', rating: 4.8 }, at);

  salma.savedPlaces = [
    { id: 'SP-1', kind: 'home', label: 'Maison', place: PLACES.hayRiad },
    { id: 'SP-2', kind: 'work', label: 'Travail', place: PLACES.agdal },
  ];
  const pm = (userId: string, kind: 'cash' | 'card', label: string, token: string | null, last4: string | null, isDefault: boolean) => {
    const id = nextId(s, 'PM');
    s.paymentMethods.push({ id, userId, kind, label, providerToken: token, last4, expMonth: last4 ? 12 : null, expYear: last4 ? 2029 : null, isDefault });
    return id;
  };
  const salmaCash = pm(salma.id, 'cash', 'Espèces', null, null, true);
  const salmaCard = pm(salma.id, 'card', 'Carte de démonstration •••• 4242', 'tok_demo_4242', '4242', false);
  pm(salma.id, 'card', 'Carte test refusée •••• 0002', 'tok_demo_0002', '0002', false);
  pm(salma.id, 'card', 'Carte test en attente •••• 3155', 'tok_demo_3155', '3155', false);
  const hibaCash = pm(hiba.id, 'cash', 'Espèces', null, null, true);
  for (const u of s.users.filter((x) => x.role === 'passenger' && !s.paymentMethods.some((p) => p.userId === x.id))) pm(u.id, 'cash', 'Espèces', null, null, true);

  // Drivers
  const amina = person(s, dataDir, { role: 'driver', first: 'Amina', last: 'Bennani', phone: '+212661234567', who: 'amina', status: 'approved', birth: '1988-09-03', doc: 'CD654321', rating: 4.9, testerCities: [] }, at);
  vehicleFor(s, dataDir, amina, 'approved', 'pearl', 'DÉMO-001', at);
  const khadija = person(s, dataDir, { role: 'driver', first: 'Khadija', last: 'Idrissi', phone: '+212662345678', who: 'generic', status: 'approved', birth: '1985-05-22', doc: 'MN223344', rating: 4.8 }, at);
  vehicleFor(s, dataDir, khadija, 'submitted', 'plum', 'DÉMO-002', iso(nowMs - 3_600_000));
  const nadia = person(s, dataDir, { role: 'driver', first: 'Nadia', last: 'Chraibi', phone: '+212663456789', who: 'generic', status: 'approved', birth: '1991-12-02', doc: 'OP556677', rating: 4.7 }, at);
  vehicleFor(s, dataDir, nadia, 'approved', 'plum', 'DÉMO-003', at);
  const leila = person(s, dataDir, { role: 'driver', first: 'Leila', last: 'Amrani', phone: '+212664567890', who: 'generic', status: 'approved', birth: '1987-08-19', doc: 'QR889900', rating: 4.6 }, at);
  vehicleFor(s, dataDir, leila, 'approved', 'pearl', 'DÉMO-004', at);
  const samira = person(s, dataDir, { role: 'driver', first: 'Samira', last: 'Fassi', phone: '+212665678901', who: 'generic', status: 'more_info_requested', birth: '1992-10-10', doc: 'ST001122', corrections: [{ key: 'driving_licence', note: 'Le permis est flou : photographiez-le à plat, en pleine lumière.' }] }, at);
  vehicleFor(s, dataDir, samira, 'approved', 'pearl', 'DÉMO-005', at);

  for (const d of [amina, khadija, nadia, leila, samira]) {
    s.payoutAccounts.push({ id: nextId(s, 'PO'), driverId: d.id, label: 'Compte principal', bankName: 'Banque de démonstration', last4: d === amina ? '4821' : '7310' });
  }
  s.payoutAccounts.push({ id: nextId(s, 'PO'), driverId: amina.id, label: 'Compte test (virement refusé)', bankName: 'Banque de démonstration', last4: '0000' });

  s.presence.push(
    { driverId: amina.id, online: false, location: { lat: 34.0205, lng: -6.831 }, locationAt: null, locationSource: 'demo', bot: false, updatedAt: at },
    { driverId: nadia.id, online: false, location: { lat: 34.004, lng: -6.846 }, locationAt: null, locationSource: 'demo', bot: true, updatedAt: at },
    { driverId: leila.id, online: false, location: { lat: 34.01, lng: -6.84 }, locationAt: null, locationSource: 'demo', bot: false, updatedAt: at },
  );

  // Rides and money
  const today = nowMs - 5 * 3_600_000;
  if (scenario !== 'first-ride') {
    completedRide(s, salma, amina, 'cash', salmaCash, 'Espèces', today);
    if (scenario !== 'after-cash') completedRide(s, salma, amina, 'card', salmaCard, 'Carte de démonstration •••• 4242', today + 2 * 3_600_000);
  }
  if (scenario !== 'first-ride') {
    // Independent debt scenario: ten earlier cash rides (series NY-H), 15 MAD commission each.
    for (let i = 0; i < 10; i++) {
      completedRide(s, hiba, leila, 'cash', hibaCash, 'Espèces', nowMs - (10 - i) * 86_400_000 - 12 * 3_600_000, demoRoute([PLACES.gareRabatVille, PLACES.agdal, PLACES.hayRiad]), 'NY-H');
    }
  }

  // A scheduled booking for tomorrow at 08:30 Casablanca time.
  const route = demoRoute([PLACES.hayRiad, PLACES.gareRabatVille]);
  const breakdown = computeFare(rabatRules, route.distanceMeters, route.durationSeconds);
  const tomorrow = new Date(nowMs + 86_400_000);
  const pickupAt = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 7, 30)).toISOString();
  s.scheduled.push({
    id: nextId(s, 'RP'),
    passengerId: salma.id,
    cityId: 'rabat',
    route,
    terms: { quoteId: 'QT-SEED-RP', cityId: 'rabat', currency: 'MAD', ruleVersion: 1, breakdown, commissionBp: rabatRules.commissionBp, cancellation: rabatRules.cancellation, dynamic: null, acceptedAt: at },
    paymentMethod: { id: salmaCash, kind: 'cash', label: 'Espèces' },
    pickupAt,
    status: 'scheduled',
    rideId: null,
    createdAt: at,
    updatedAt: at,
    cancellation: null,
    history: [{ at, label: 'Réservation enregistrée · aucune chauffeuse assignée pour le moment' }],
  });

  // Support
  s.tickets.push({
    id: nextId(s, 'SU'),
    userId: hiba.id,
    userRole: 'passenger',
    userName: 'Hiba Ouazzani',
    cityId: 'rabat',
    rideId: null,
    category: 'account',
    subject: 'Changer mon numéro de téléphone',
    status: 'open',
    isDispute: false,
    messages: [{ id: nextId(s, 'MSG', 5), author: 'user', authorName: 'Hiba Ouazzani', body: 'Bonjour, je change de numéro le mois prochain. Comment garder mon compte ?', attachments: [], at: iso(nowMs - 20 * 3_600_000) }],
    resolution: null,
    createdAt: iso(nowMs - 20 * 3_600_000),
    updatedAt: iso(nowMs - 20 * 3_600_000),
  });

  appendAudit(s, iso(nowMs), { actor: SYSTEM, action: 'demo.seeded', entityType: 'environment', entityId: 'demo', summary: `Données de démonstration chargées · scénario « ${scenario} »` });
  void mad;
  return s;
}
