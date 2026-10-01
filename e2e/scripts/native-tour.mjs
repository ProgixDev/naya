// Native review captures on the iOS Simulator (review build with EXPO_PUBLIC_REVIEW=1).
// Stages server state through the demo API, asks the app to navigate via /dev/navigate,
// then takes a simulator screenshot. Usage: node native-tour.mjs passenger <outDir> [udid]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const [app = 'passenger', out = 'docs/screens/native', udid = 'booted'] = process.argv.slice(2);
const API = process.env.API_URL ?? 'http://localhost:4010';
mkdirSync(out, { recursive: true });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
let key = 0;
async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method === 'POST') headers['Idempotency-Key'] = `tour-${Date.now()}-${++key}`;
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function token(phone, role) {
  await call('POST', '/auth/otp/request', { phone, role });
  return (await call('POST', '/auth/otp/verify', { phone, role, code: '123456' })).token;
}
async function nav(route, phone = null, wait = 4) {
  await call('POST', '/dev/navigate', { app, route, phone });
  await sleep(wait);
}
function shot(name) {
  execFileSync('xcrun', ['simctl', 'io', udid, 'screenshot', `${out}/${app}-${name}.png`], { stdio: 'ignore' });
  console.log('captured', name);
}
const reset = (scenario) => call('POST', '/dev/reset', { scenario });
const P = { salma: '+212612345678', nour: '+212623456789', imane: '+212634567890', rania: '+212645678901', amina: '+212661234567', khadija: '+212662345678', leila: '+212664567890' };
const TRIP = [
  { id: 'rabat-gare', label: 'Gare Rabat Ville', address: 'Avenue Mohammed V, Rabat', location: { lat: 34.0166, lng: -6.8356 } },
  { id: 'rabat-agdal', label: 'Agdal', address: 'Avenue de France, Agdal, Rabat', location: { lat: 33.9993, lng: -6.8511 } },
  { id: 'rabat-hay-riad', label: 'Hay Riad', address: 'Avenue Annakhil, Rabat', location: { lat: 33.9594, lng: -6.8747 } },
];

async function book(card) {
  const t = await token(P.salma, 'passenger');
  const q = await call('POST', '/quotes', { cityId: 'rabat', stops: TRIP }, t);
  const pms = await call('GET', '/payment-methods', null, t);
  const pm = card ? pms.find((m) => m.last4 === card) : pms.find((m) => m.kind === 'cash');
  return call('POST', '/rides', { quoteId: q.id, paymentMethodId: pm.id }, t);
}

if (app === 'passenger') {
  await reset('first-ride');
  await nav('__signout', null, 3);
  shot('01-welcome');
  await nav('/', P.salma, 6);
  shot('06-home');
  await nav('/trips');
  shot('12-trips');
  await nav('/account');
  shot('13-account');
  await nav('/payments');
  shot('14-payments');
  await nav('/help');
  shot('15-help');
  const ride = await book();
  await nav('/ride', null, 5);
  shot('09-searching');
  const d = await token(P.amina, 'driver');
  await call('POST', '/driver/online', { online: true }, d);
  const st = await call('GET', '/driver/status', null, d);
  await call('POST', `/driver/offers/${st.offer.id}/accept`, {}, d);
  await sleep(6);
  shot('10-approaching');
  await call('POST', `/driver/rides/${ride.id}/arrive`, {}, d);
  await sleep(4);
  shot('10-arrived');
  await call('POST', `/driver/rides/${ride.id}/start`, {}, d);
  await sleep(6);
  shot('10-trip');
  await call('POST', `/driver/rides/${ride.id}/stop-complete`, {}, d);
  await call('POST', `/driver/rides/${ride.id}/complete`, {}, d);
  await nav(`/receipt/${ride.id}`, null, 5);
  shot('11-receipt');
  await reset('default');
  await nav('/', P.nour, 7);
  shot('05-pending');
  await nav('/', P.imane, 7);
  shot('05-more');
  await nav('/identity', '+212677001122', 7);
  shot('03-identity');
}

if (app === 'driver') {
  await reset('first-ride');
  await nav('__signout', null, 3);
  shot('01-welcome');
  await nav('/', P.amina, 7);
  shot('06-offline');
  const d = await token(P.amina, 'driver');
  await call('POST', '/driver/online', { online: true }, d);
  await sleep(4);
  shot('06-online');
  const ride = await book();
  await sleep(5);
  shot('07-offer');
  const st = await call('GET', '/driver/status', null, d);
  await call('POST', `/driver/offers/${st.offer.id}/accept`, {}, d);
  await nav('/ride', null, 5);
  shot('08-pickup');
  await call('POST', `/driver/rides/${ride.id}/arrive`, {}, d);
  await call('POST', `/driver/rides/${ride.id}/start`, {}, d);
  await sleep(5);
  shot('09-trip');
  await call('POST', `/driver/rides/${ride.id}/stop-complete`, {}, d);
  await call('POST', `/driver/rides/${ride.id}/complete`, {}, d);
  await nav(`/ride-end/${ride.id}`, null, 5);
  shot('10-cash');
  await reset('default');
  await nav('/wallet', P.amina, 7);
  shot('12-wallet');
  await nav('/earnings', null, 5);
  shot('11-earnings');
  await nav('/ledger', null, 5);
  shot('13-ledger');
  await nav('/', P.leila, 7);
  shot('06-debt');
  await nav('/', P.khadija, 7);
  shot('05-vehicle-pending');
}
