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
const { useNaya, documentLabels } = await import('../lib/store.ts');
const initial = useNaya.getState();
beforeEach(() => {
  storage.clear();
  useNaya.setState({
    rides: structuredClone(initial.rides),
    drivers: structuredClone(initial.drivers),
    tickets: structuredClone(initial.tickets),
    audit: [],
    toast: null,
  });
});

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
  const saved = JSON.parse(storage.get('naya-web-prototype-v1')).state.rides.find(
    (r) => r.id === id,
  );
  assert.equal(saved.date, '2026-10-08');
  assert.equal(saved.time, '09:30');
  assert.equal(saved.amount, 62);
});
