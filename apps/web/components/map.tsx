'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Navigation, MapPin } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import type { Driver } from '@/lib/store';

type Point = [number, number];
const rabat: Point = [34.01, -6.839];
// Approximate public neighborhood positions for the prototype, never device locations.
const neighborhoods: Record<string, Point> = {
  Agdal: [33.998, -6.849],
  Hassan: [34.015, -6.833],
  'Hay Riad': [33.958, -6.869],
  Souissi: [33.98, -6.832],
  Médina: [34.023, -6.84],
  Océan: [34.024, -6.853],
};
const driverPositions: Point[] = [
  neighborhoods.Agdal,
  neighborhoods.Hassan,
  neighborhoods.Souissi,
  neighborhoods.Océan,
  neighborhoods['Hay Riad'],
  neighborhoods.Médina,
];
const tileUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const carIcon =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 10 2-5h10l2 5M4 10h16v8H4zM7 18v2m10-2v2M7 13h1m8 0h1"/></svg>';

function RealMap({ drivers, from, to }: { drivers?: Driver[]; from?: string; to?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [zoom, setZoom] = useState(12);
  const journey = from !== undefined;
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || !host.current || map.current) return;
        observer.disconnect();
        try {
          const L = await import('leaflet');
          if (disposed || !host.current) return;
          library.current = L;
          const instance = L.map(host.current, {
            zoomControl: false,
            scrollWheelZoom: false,
            minZoom: 10,
            maxZoom: 18,
          }).setView(rabat, 12);
          map.current = instance;
          L.tileLayer(tileUrl, { attribution, maxZoom: 19 })
            .on('tileerror', () => setFailed(true))
            .on('tileload', () => setFailed(false))
            .addTo(instance);
          instance.attributionControl.setPrefix(false);
          layer.current = L.layerGroup().addTo(instance);
          instance.on('zoomend', () => setZoom(instance.getZoom()));
          resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
          resize.observe(host.current);
          setReady(true);
        } catch {
          if (!disposed) setFailed(true);
        }
      },
      { threshold: 0.05 },
    );
    if (host.current) observer.observe(host.current);
    return () => {
      disposed = true;
      observer.disconnect();
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const L = library.current,
      instance = map.current,
      group = layer.current;
    if (!ready || !L || !instance || !group) return;
    group.clearLayers();
    if (journey) {
      const start = neighborhoods[from?.split(',')[0] ?? ''] ?? rabat;
      const end = neighborhoods[to?.split(',')[0] ?? ''] ?? rabat;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      L.polyline([start, end], { color: '#743e60', weight: 3, dashArray: '7 8' }).addTo(group);
      for (const [index, point] of [start, end].entries()) {
        const label = index === 0 ? `Départ : ${from}` : `Arrivée : ${to}`;
        const marker = L.marker(point, {
          title: label,
          alt: label,
          icon: L.divIcon({
            className: 'naya-route-pin',
            html: `<span>${index === 0 ? 'A' : 'B'}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        })
          .bindTooltip(label)
          .addTo(group);
        marker.getElement()?.setAttribute('aria-label', label);
      }
      instance.fitBounds(L.latLngBounds([start, end]), {
        padding: [52, 52],
        maxZoom: 14,
        animate: !reduced,
      });
    } else {
      for (const driver of drivers ?? []) {
        const slot =
          (Number(driver.id.replace(/\D/g, '')) ||
            Array.from(driver.id).reduce((sum, c) => sum + c.charCodeAt(0), 0)) - 1;
        const point = driverPositions[Math.abs(slot) % driverPositions.length];
        const popup = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = driver.name;
        const note = document.createElement('p');
        note.textContent = 'En ligne · Position de démonstration';
        popup.append(name, note);
        const marker = L.marker(point, {
          title: `Localiser ${driver.name}`,
          alt: driver.name,
          icon: L.divIcon({
            className: 'naya-driver-pin',
            html: carIcon,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
        })
          .bindPopup(popup)
          .addTo(group);
        marker.getElement()?.setAttribute('aria-label', `Localiser ${driver.name}`);
        marker.on('popupopen', () => {
          marker
            .getPopup()
            ?.getElement()
            ?.querySelector('.leaflet-popup-close-button')
            ?.setAttribute('aria-label', 'Fermer la position');
        });
      }
    }
  }, [ready, drivers, from, to, journey]);
  const recenter = () => {
    const instance = map.current,
      group = layer.current,
      L = library.current;
    if (!instance || !L || !group) return;
    const points = group
      .getLayers()
      .filter((item): item is Leaflet.Marker => item instanceof L.Marker)
      .map((item) => item.getLatLng());
    if (points.length)
      instance.fitBounds(L.latLngBounds(points), {
        padding: [55, 55],
        maxZoom: journey ? 14 : 12,
        animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    else instance.setView(rabat, 12);
  };
  return (
    <div className={`real-map ${journey ? 'journey-map' : 'operations-map'}`}>
      <div
        ref={host}
        className="map-canvas"
        role="region"
        aria-label={
          journey
            ? 'Carte de Rabat, départ et arrivée du trajet de démonstration'
            : 'Carte de Rabat, positions de démonstration des chauffeuses en ligne'
        }
      />
      {!ready && !failed && (
        <span className="map-loading" role="status">
          <MapPin size={20} /> Chargement de la carte…
        </span>
      )}
      {failed && (
        <span className="map-error" role="status">
          Fond de carte indisponible. Vérifiez votre connexion.
        </span>
      )}
      <div className="map-label">
        <span className="small-dot green-dot" />
        {journey ? 'Rabat · Votre trajet' : `${drivers?.length ?? 0} chauffeuses en ligne`}
      </div>
      <div className="map-controls">
        <button
          aria-label="Zoom avant"
          disabled={!ready || zoom >= 18}
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom arrière"
          disabled={!ready || zoom <= 10}
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={18} />
        </button>
        <button aria-label="Recentrer la carte" disabled={!ready} onClick={recenter}>
          <Navigation size={17} />
        </button>
      </div>
      <span className="map-disclaimer">
        {journey
          ? 'Quartiers approximatifs · liaison indicative'
          : 'Positions simulées · aucune géolocalisation réelle'}
      </span>
    </div>
  );
}

export function OperationsMap({ drivers }: { drivers: Driver[] }) {
  return <RealMap drivers={drivers} />;
}
export function JourneyMap({ from, to }: { from: string; to: string }) {
  return <RealMap from={from} to={to} />;
}
