import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@naya/domain';
import carTop from '@naya/assets/cars/naya-signature-top.png';

const TILE = 256;
const project = (p: LatLng, z: number) => {
  const s = TILE * 2 ** z;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return { x: ((p.lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
};

export interface MiniMapMarker {
  id: string;
  at: LatLng;
  label: string;
  kind: 'driver' | 'pickup' | 'destination' | 'stop';
}

/**
 * Static OpenStreetMap tile view (no key) for context: service zone, routes and online
 * drivers. Attribution is always visible. Positions in the demo are simulated.
 */
/** Largest zoom (≤ max) at which the points fit, and their centre. */
function fit(points: LatLng[], w: number, h: number, pad: number, max: number) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  for (let z = max; z >= 3; z--) {
    const a = project({ lat: Math.max(...lats), lng: Math.min(...lngs) }, z);
    const b = project({ lat: Math.min(...lats), lng: Math.max(...lngs) }, z);
    if (b.x - a.x <= w - pad * 2 && b.y - a.y <= h - pad * 2) return { center, zoom: z };
  }
  return { center, zoom: 3 };
}

export function MiniMap({ center: initialCenter, zoom: initialZoom = 13, polygons = [], route, markers = [], height = 260, label, fitContent = true }: { center: LatLng; zoom?: number; polygons?: LatLng[][]; route?: LatLng[]; markers?: MiniMapMarker[]; height?: number; label: string; fitContent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pts = [...polygons.flat(), ...(route ?? []), ...markers.map((m) => m.at)];
  const fitted = fitContent && pts.length > 1 ? fit(pts, w, height, 36, 15) : null;
  const center = fitted?.center ?? initialCenter;
  const zoom = fitted?.zoom ?? initialZoom;
  const c = project(center, zoom);
  const ox = c.x - w / 2;
  const oy = c.y - height / 2;
  const tiles: { k: string; x: number; y: number; l: number; t: number }[] = [];
  for (let x = Math.floor(ox / TILE); x <= Math.floor((ox + w) / TILE); x++)
    for (let y = Math.floor(oy / TILE); y <= Math.floor((oy + height) / TILE); y++) tiles.push({ k: `${x}/${y}`, x, y, l: x * TILE - ox, t: y * TILE - oy });
  const pt = (p: LatLng) => {
    const q = project(p, zoom);
    return { x: q.x - ox, y: q.y - oy };
  };
  return (
    <div ref={ref} role="img" aria-label={label} className="relative overflow-hidden rounded-[18px] bg-[#EFE9EC]" style={{ height }}>
      {tiles.map((t) => (
        <img key={t.k} alt="" src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`} className="absolute select-none" style={{ left: t.l, top: t.t, width: TILE, height: TILE, filter: 'grayscale(0.92) sepia(0.12) hue-rotate(250deg) brightness(1.06) contrast(0.92)' }} draggable={false} />
      ))}
      <svg className="absolute inset-0" width={w} height={height} aria-hidden>
        {polygons.map((poly, i) => (
          <polygon key={i} points={poly.map((p) => `${pt(p).x},${pt(p).y}`).join(' ')} fill="rgba(107,54,87,0.07)" stroke="#6B3657" strokeWidth={1.5} strokeDasharray="6 5" />
        ))}
        {route && route.length > 1 ? (
          <>
            <polyline points={route.map((p) => `${pt(p).x},${pt(p).y}`).join(' ')} fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={route.map((p) => `${pt(p).x},${pt(p).y}`).join(' ')} fill="none" stroke="#6B3657" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
      </svg>
      {markers.map((m) => {
        const p = pt(m.at);
        return m.kind === 'driver' ? (
          <div key={m.id} className="absolute flex flex-col items-center" style={{ left: p.x - 40, top: p.y - 22, width: 80 }}>
            <img src={carTop} alt="" className="h-9 w-auto drop-shadow" />
            <span className="mt-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold shadow-card">{m.label}</span>
          </div>
        ) : (
          <div key={m.id} className="absolute" style={{ left: p.x - 8, top: p.y - 8 }} title={m.label}>
            <div className={m.kind === 'destination' ? 'h-4 w-4 rounded-sm border-[3px] border-accent bg-accent' : 'h-4 w-4 rounded-full border-[4px] border-accent bg-surface'} />
          </div>
        );
      })}
      <div className="absolute bottom-1.5 left-2 rounded bg-white/75 px-1 text-[10px] text-muted">© OpenStreetMap contributors</div>
    </div>
  );
}
