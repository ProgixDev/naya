import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@naya/domain';

/** Smoothly interpolates a moving marker between server updates (off when motion is reduced). */
export function useAnimatedCoordinate(target: LatLng | null, reduceMotion: boolean, durationMs = 900): LatLng | null {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!target) {
      setValue(null);
      return;
    }
    const start = from.current ?? target;
    if (reduceMotion || (start.lat === target.lat && start.lng === target.lng)) {
      from.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / durationMs);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const next = { lat: start.lat + (target.lat - start.lat) * e, lng: start.lng + (target.lng - start.lng) * e };
      from.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target?.lat, target?.lng, reduceMotion, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export function bearing(a: LatLng, b: LatLng) {
  const y = Math.sin(((b.lng - a.lng) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x = Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) - Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lng - a.lng) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
