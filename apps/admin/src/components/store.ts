import { useSyncExternalStore } from 'react';

/** Minimal store for presentation state (toasts). Server data always lives in TanStack Query. */
export function create<S>(init: (set: (p: Partial<S>) => void, get: () => S) => S) {
  let state: S;
  const listeners = new Set<() => void>();
  const set = (p: Partial<S>) => {
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  };
  const get = () => state;
  state = init(set, get);
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  function useStore<T>(selector: (s: S) => T): T {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
  }
  return Object.assign(useStore, { getState: get });
}
