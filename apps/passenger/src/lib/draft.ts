import { create } from 'zustand';
import type { Place } from '@naya/domain';

/**
 * Route draft: presentation state for the trip being composed. Not a server entity;
 * the server owns quotes and rides.
 */
interface Draft {
  pickup: Place | null;
  stops: Place[];
  destination: Place | null;
  /** Which slot the search sheet edits. */
  editing: { kind: 'pickup' | 'destination' | 'stop'; index?: number } | null;
  pickupSource: 'gps' | 'manual' | 'search' | 'default';
  setPickup: (p: Place | null, source?: Draft['pickupSource']) => void;
  setDestination: (p: Place | null) => void;
  addStop: (p: Place) => void;
  replaceStop: (i: number, p: Place) => void;
  removeStop: (i: number) => void;
  moveStop: (i: number, dir: -1 | 1) => void;
  setEditing: (e: Draft['editing']) => void;
  reset: () => void;
}

export const MAX_STOPS = 2;

export const useDraft = create<Draft>((set) => ({
  pickup: null,
  stops: [],
  destination: null,
  editing: null,
  pickupSource: 'default',
  setPickup: (pickup, pickupSource = 'search') => set({ pickup, pickupSource }),
  setDestination: (destination) => set({ destination }),
  addStop: (p) => set((s) => (s.stops.length >= MAX_STOPS ? s : { stops: [...s.stops, p] })),
  replaceStop: (i, p) => set((s) => ({ stops: s.stops.map((x, j) => (j === i ? p : x)) })),
  removeStop: (i) => set((s) => ({ stops: s.stops.filter((_, j) => j !== i) })),
  moveStop: (i, dir) =>
    set((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.stops.length) return s;
      const next = [...s.stops];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { stops: next };
    }),
  setEditing: (editing) => set({ editing }),
  reset: () => set({ pickup: null, stops: [], destination: null, editing: null, pickupSource: 'default' }),
}));

export const draftStops = (d: Pick<Draft, 'pickup' | 'stops' | 'destination'>): Place[] | null =>
  d.pickup && d.destination ? [d.pickup, ...d.stops, d.destination] : null;
