import type { LatLng } from '@naya/domain';

export const TILE = 256;

export function project(p: LatLng, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return { x: ((p.lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

export function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Largest zoom at which all points fit in the viewport (minus padding). */
export function fitZoom(points: LatLng[], width: number, height: number, pad = 48, max = 16): { center: LatLng; zoom: number } {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  for (let z = max; z >= 3; z--) {
    const a = project({ lat: Math.max(...lats), lng: Math.min(...lngs) }, z);
    const b = project({ lat: Math.min(...lats), lng: Math.max(...lngs) }, z);
    if (b.x - a.x <= width - pad * 2 && b.y - a.y <= height - pad * 2) return { center, zoom: z };
  }
  return { center, zoom: 3 };
}
