import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, dirname } from './platform';
import { DomainError } from '@naya/domain';
import type { State } from './state';

/**
 * Single-writer store. Every mutation runs inside `tx`: it works on the live state,
 * and if anything throws the previous snapshot is restored, so a request either
 * applies completely or not at all. Node runs handlers one at a time, which makes
 * each transaction atomic with respect to concurrent requests (for example two
 * drivers accepting the same ride).
 */
export class Store {
  state: State;
  private listeners = new Set<(version: number) => void>();
  constructor(
    initial: State,
    private readonly file: string | null,
  ) {
    this.state = initial;
  }

  static load(file: string, fallback: () => State): Store {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as State;
      if (parsed.schemaVersion === 1) return new Store(parsed, file);
    }
    const s = new Store(fallback(), file);
    s.persist();
    return s;
  }

  tx<T>(fn: (s: State) => T): T {
    const snapshot = JSON.parse(JSON.stringify(this.state)) as State;
    try {
      const result = fn(this.state);
      this.state.version += 1;
      this.persist();
      for (const l of this.listeners) l(this.state.version);
      return result;
    } catch (e) {
      this.state = snapshot;
      throw e;
    }
  }

  read<T>(fn: (s: State) => T): T {
    return fn(this.state);
  }

  replace(next: State) {
    this.state = next;
    this.persist();
    for (const l of this.listeners) l(this.state.version);
  }

  onChange(l: (version: number) => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  persist() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state));
    renameSync(tmp, this.file);
  }
}

export function nextId(s: State, prefix: string, width = 3): string {
  const n = (s.counters[prefix] ?? 0) + 1;
  s.counters[prefix] = n;
  return `${prefix}-${String(n).padStart(width, '0')}`;
}

export function mustFind<T>(list: T[], pred: (t: T) => boolean, what = 'élément'): T {
  const found = list.find(pred);
  if (!found) throw new DomainError('NOT_FOUND', `${what.charAt(0).toUpperCase()}${what.slice(1)} introuvable.`);
  return found;
}
