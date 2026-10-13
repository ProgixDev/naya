import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// Isolated storage: these tests never read or change the browser's prototype data.
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage };
const { useNaya, documentLabels, rabatToday } = await import('../lib/store.ts');
const initial = useNaya.getState();
beforeEach(() => {
  storage.clear();
  useNaya.setState({
    rides: structuredClone(initial.rides),
    drivers: structuredClone(initial.drivers),
    tickets: structuredClone(initial.tickets),
    audit: [],
    notificationsRead: initial.notificationsRead,
    commission: initial.commission,
    city: initial.city,
    serviceOpen: initial.serviceOpen,
    toast: null,
  });
});
const key = 'naya-web-prototype-v1';
const shiftDay = (day, days) =>
  new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10);

test('approval requires every document to be accepted; completion requests do not qualify', () => {
  const state = useNaya.getState();
  const driver = state.drivers.find((d) => d.status === 'À vérifier');
  state.verifyDriver(driver.id, true);
  assert.equal(useNaya.getState().drivers.find((d) => d.id === driver.id).status, 'À vérifier');
  state.reviewDocument(driver.id, 'identity', 'Accepté');
  state.reviewDocument(driver.id, 'license', 'À compléter');
  state.reviewDocument(driver.id, 'vehicle', 'Accepté');
  state.verifyDriver(driver.id, true);
  assert.equal(useNaya.getState().drivers.find((d) => d.id === driver.id).status, 'À vérifier');
  state.reviewDocument(driver.id, 'license', 'Accepté');
  state.verifyDriver(driver.id, true);
  assert.equal(useNaya.getState().drivers.find((d) => d.id === driver.id).status, 'Hors ligne');
  assert.equal(Object.keys(documentLabels).length, 3);
});

test('cancellation and rejection preserve their reasons in the record and activity history', () => {
  const state = useNaya.getState();
  state.updateRide('NY-1048', 'Annulée', 'Demande de la passagère');
  const driver = state.drivers.find((d) => d.status === 'À vérifier');
  state.verifyDriver(driver.id, false, 'Document du véhicule incomplet');
  assert.equal(
    useNaya.getState().rides.find((r) => r.id === 'NY-1048').cancellationReason,
    'Demande de la passagère',
  );
  assert.equal(
    useNaya.getState().drivers.find((d) => d.id === driver.id).rejectionReason,
    'Document du véhicule incomplet',
  );
  assert.ok(useNaya.getState().audit.some((a) => a.action.includes('Demande de la passagère')));
  assert.ok(
    useNaya.getState().audit.some((a) => a.action.includes('Document du véhicule incomplet')),
  );
});

test('saving responses retains the conversation until a separate resolution action', () => {
  const state = useNaya.getState();
  state.updateTicket('SUP-023', { assignee: 'Meryem Bennis', priority: 'Haute' });
  state.replyTicket('SUP-023', 'Nous examinons votre paiement.');
  state.replyTicket('SUP-023', 'Votre paiement a été vérifié.');
  const pending = useNaya.getState().tickets.find((t) => t.id === 'SUP-023');
  assert.equal(pending.status, 'En cours');
  assert.equal(pending.assignee, 'Meryem Bennis');
  assert.equal(pending.responses.length, 2);
  state.resolveTicket('SUP-023');
  const resolved = useNaya.getState().tickets.find((t) => t.id === 'SUP-023');
  assert.equal(resolved.status, 'Résolu');
  assert.equal(resolved.responses.length, 2);
});

test('a scheduled ride preserves date, time and quoted amount through persistence', () => {
  const state = useNaya.getState();
  const id = state.addRide({
    passenger: 'Test Naya',
    driver: 'Amina Bennani',
    from: 'Agdal',
    to: 'Hassan',
    amount: 62,
    status: 'Planifiée',
    time: '09:30',
    date: '2026-10-08',
    method: 'Carte',
    city: 'Rabat',
  });
  const saved = JSON.parse(storage.get(key)).state.rides.find((r) => r.id === id);
  assert.equal(saved.date, '2026-10-08');
  assert.equal(saved.time, '09:30');
  assert.equal(saved.amount, 62);
});

test('seed records follow the current Rabat day on a first visit', async () => {
  storage.clear();
  await useNaya.persist.rehydrate();
  const today = rabatToday(),
    { rides, drivers, tickets } = useNaya.getState();
  assert.equal(rides.find((r) => r.id === 'NY-1048').date, today);
  assert.equal(rides.find((r) => r.id === 'NY-1040').date, shiftDay(today, -1));
  // “Aujourd’hui” KPIs, chart and Finance read completed rides dated today.
  assert.equal(rides.filter((r) => r.date === today && r.status === 'Terminée').length, 4);
  assert.ok(tickets.every((t) => t.createdAt.startsWith(`${today}T`)));
  assert.ok(
    drivers
      .filter((d) => d.status === 'À vérifier')
      .every((d) => d.createdAt.startsWith(`${today}T`)),
  );
});

test('a store saved on an earlier day re-dates untouched seeds and keeps changed ones', async () => {
  const earlier = shiftDay(rabatToday(), -3),
    rides = initial.rides.map((r) => ({ ...r, date: earlier })),
    tickets = initial.tickets.map((t) => ({ ...t, createdAt: `${earlier}T10:25:00+01:00` }));
  rides[0] = { ...rides[0], status: 'Terminée' };
  storage.set(
    key,
    JSON.stringify({
      state: { ...JSON.parse(storage.get(key)).state, rides, tickets },
      version: 1,
    }),
  );
  await useNaya.persist.rehydrate();
  const today = rabatToday(),
    state = useNaya.getState();
  assert.deepEqual(state.rides[0], rides[0]);
  assert.equal(state.rides.find((r) => r.id === 'NY-1047').date, today);
  assert.equal(state.rides.find((r) => r.id === 'NY-1040').date, shiftDay(today, -1));
  assert.equal(state.tickets.find((t) => t.id === 'SUP-023').createdAt, `${today}T09:15:00+01:00`);
});

test('an unversioned 5 Oct store keeps every change and re-dates only untouched seed records', async () => {
  const rides = structuredClone(initial.rides).map((r) =>
    r.id === 'NY-1048'
      ? { ...r, status: 'Annulée', cancellationReason: 'Demande de la passagère' }
      : r,
  );
  const tickets = initial.tickets.map(({ createdAt, ...t }) =>
    t.id === 'SUP-023' ? { ...t, status: 'Résolu' } : t,
  );
  const drivers = initial.drivers.map(({ createdAt, ...d }) => d);
  const userRide = { ...rides[0], id: 'NY-1049', status: 'Planifiée', date: '2026-10-08' };
  const audit = [{ id: 'a1', action: 'Course NY-1049 créée', date: '2026-10-05T09:00:00.000Z' }];
  storage.set(
    key,
    JSON.stringify({
      state: {
        rides: [userRide, ...rides],
        drivers,
        tickets,
        audit,
        notificationsRead: true,
        commission: 12,
        city: 'Rabat',
        serviceOpen: true,
      },
      version: 0,
    }),
  );
  await useNaya.persist.rehydrate();
  const today = rabatToday(),
    state = useNaya.getState(),
    ride = (id) => state.rides.find((r) => r.id === id);
  assert.equal(ride('NY-1047').date, today);
  assert.equal(ride('NY-1039').date, shiftDay(today, -1));
  assert.equal(ride('NY-1048').date, '2026-10-05');
  assert.equal(ride('NY-1048').cancellationReason, 'Demande de la passagère');
  assert.equal(ride('NY-1049').date, '2026-10-08');
  assert.ok(state.tickets.find((t) => t.id === 'SUP-024').createdAt.startsWith(`${today}T`));
  assert.deepEqual(
    state.tickets.find((t) => t.id === 'SUP-023'),
    tickets.find((t) => t.id === 'SUP-023'),
  );
  assert.ok(state.drivers.find((d) => d.id === 'CH-005').createdAt.startsWith(`${today}T`));
  assert.equal(state.commission, 12);
  assert.deepEqual(state.audit, audit);
  assert.equal(JSON.parse(storage.get(key)).version, 1);
});

test('activity entries get ids without crypto.randomUUID, as on a plain-http LAN address', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  try {
    const state = useNaya.getState();
    state.updateRide('NY-1047', 'Terminée');
    state.resolveTicket('SUP-024');
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
  const ids = useNaya.getState().audit.map((a) => a.id);
  assert.equal(ids.length, 2);
  assert.ok(ids.every((id) => typeof id === 'string' && id.length > 8));
  assert.notEqual(ids[0], ids[1]);
});
