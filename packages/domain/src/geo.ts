import type { LatLng, Place, Route, ServiceZone } from './entities';

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ray casting; polygon vertices in order, not closed. */
export function pointInPolygon(p: LatLng, polygon: readonly LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects = a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

export const isInService = (p: LatLng, zones: readonly ServiceZone[]) => zones.some((z) => z.active && pointInPolygon(p, z.polygon));

/* ───────────── Demo places (fictional labels on real public landmarks) ───────────── */

export const PLACES = {
  gareRabatVille: { id: 'rabat-gare', label: 'Gare Rabat Ville', address: 'Avenue Mohammed V, Rabat', location: { lat: 34.0166, lng: -6.8356 } },
  agdal: { id: 'rabat-agdal', label: 'Agdal', address: 'Avenue de France, Agdal, Rabat', location: { lat: 33.9993, lng: -6.8511 } },
  hayRiad: { id: 'rabat-hay-riad', label: 'Hay Riad', address: 'Avenue Annakhil, Rabat', location: { lat: 33.9594, lng: -6.8747 } },
  tourHassan: { id: 'rabat-tour-hassan', label: 'Tour Hassan', address: 'Boulevard Mohamed Lyazidi, Rabat', location: { lat: 34.024, lng: -6.8227 } },
  medina: { id: 'rabat-medina', label: 'Médina de Rabat', address: 'Rue Souika, Rabat', location: { lat: 34.0253, lng: -6.8361 } },
  souissi: { id: 'rabat-souissi', label: 'Souissi', address: 'Avenue Mohammed VI, Souissi, Rabat', location: { lat: 33.9747, lng: -6.8322 } },
  ocean: { id: 'rabat-ocean', label: 'L’Océan', address: 'Boulevard Al Amir Moulay Abdellah, Rabat', location: { lat: 34.0262, lng: -6.848 } },
  centreVille: { id: 'rabat-centre', label: 'Rabat · Centre-ville', address: 'Place Pietri, Rabat', location: { lat: 34.0189, lng: -6.8367 } },
  sale: { id: 'sale-tabriquet', label: 'Salé · Tabriquet', address: 'Tabriquet, Salé', location: { lat: 34.0531, lng: -6.7902 } },
  casaPort: { id: 'casa-port', label: 'Gare Casa-Port', address: 'Boulevard des Almohades, Casablanca', location: { lat: 33.6005, lng: -7.6132 } },
  maarif: { id: 'casa-maarif', label: 'Maârif', address: 'Boulevard Zerktouni, Casablanca', location: { lat: 33.5831, lng: -7.6326 } },
  anfa: { id: 'casa-anfa', label: 'Anfa', address: 'Boulevard d’Anfa, Casablanca', location: { lat: 33.5883, lng: -7.6478 } },
} satisfies Record<string, Place>;

export const RABAT_ZONE: LatLng[] = [
  { lat: 34.042, lng: -6.872 },
  { lat: 34.036, lng: -6.818 },
  { lat: 34.012, lng: -6.806 },
  { lat: 33.95, lng: -6.815 },
  { lat: 33.94, lng: -6.9 },
  { lat: 34.012, lng: -6.9 },
];

export const CASABLANCA_ZONE: LatLng[] = [
  { lat: 33.62, lng: -7.68 },
  { lat: 33.615, lng: -7.58 },
  { lat: 33.55, lng: -7.57 },
  { lat: 33.54, lng: -7.69 },
];

/**
 * Deterministic demo routing (no routing provider configured). Known legs use
 * fixed values so fixtures are reproducible: Gare Rabat Ville → Agdal → Hay Riad
 * is exactly 10 km / 25 min. Unknown legs use 1,35 × great-circle distance at 24 km/h.
 */
const KNOWN_LEGS: Record<string, { m: number; s: number }> = {
  'rabat-gare>rabat-agdal': { m: 3200, s: 480 },
  'rabat-agdal>rabat-hay-riad': { m: 6800, s: 1020 },
  'rabat-gare>rabat-hay-riad': { m: 9100, s: 1320 },
  'casa-port>casa-maarif': { m: 3900, s: 660 },
  'casa-maarif>casa-anfa': { m: 6100, s: 840 },
  'casa-port>casa-anfa': { m: 10000, s: 1500 },
};

function leg(a: Place, b: Place): { m: number; s: number } {
  const known = a.id && b.id ? (KNOWN_LEGS[`${a.id}>${b.id}`] ?? KNOWN_LEGS[`${b.id}>${a.id}`]) : undefined;
  if (known) return known;
  const m = Math.max(300, Math.round((haversineMeters(a.location, b.location) * 1.35) / 100) * 100);
  const s = Math.max(120, Math.round((m / (24_000 / 3600)) / 60) * 60);
  return { m, s };
}

/** A gently bent path between two points so demo routes do not look like ruler lines. */
function bend(a: LatLng, b: LatLng, steps = 6): LatLng[] {
  const pts: LatLng[] = [];
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = Math.sin(t * Math.PI) * 0.12;
    pts.push({ lat: a.lat + dy * t + dx * k * 0.35, lng: a.lng + dx * t - dy * k * 0.35 });
  }
  return pts;
}

export function demoRoute(stops: Place[]): Route {
  if (stops.length < 2) throw new RangeError('A route needs a pickup and a destination');
  let m = 0;
  let s = 0;
  const polyline: LatLng[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    const l = leg(a, b);
    m += l.m;
    s += l.s;
    const seg = bend(a.location, b.location);
    polyline.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return { stops, distanceMeters: m, durationSeconds: s, polyline, source: 'demo' };
}

/** Position at fraction t (0…1) along a polyline, for deterministic demo movement. */
export function pointAlong(polyline: readonly LatLng[], t: number): LatLng {
  if (polyline.length === 0) throw new RangeError('empty polyline');
  if (polyline.length === 1 || t <= 0) return polyline[0]!;
  if (t >= 1) return polyline[polyline.length - 1]!;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = haversineMeters(polyline[i]!, polyline[i + 1]!);
    lengths.push(d);
    total += d;
  }
  let target = total * t;
  for (let i = 0; i < lengths.length; i++) {
    const d = lengths[i]!;
    if (target <= d) {
      const f = d === 0 ? 0 : target / d;
      const a = polyline[i]!;
      const b = polyline[i + 1]!;
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    target -= d;
  }
  return polyline[polyline.length - 1]!;
}

export const formatDistance = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.0', '').replace('.', ',')} km`);
export const formatDuration = (s: number) => {
  const min = Math.max(1, Math.round(s / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
};
