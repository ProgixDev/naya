import { DomainError } from '../errors';

/** A transition table: for each state, the events it accepts and the state they lead to. */
export type TransitionTable<S extends string, E extends string> = { readonly [K in S]: Partial<Record<E, S>> };

export function makeMachine<S extends string, E extends string>(name: string, table: TransitionTable<S, E>) {
  return {
    name,
    table,
    can(state: S, event: E): boolean {
      return table[state]?.[event] !== undefined;
    },
    next(state: S, event: E): S {
      const to = table[state]?.[event];
      if (to === undefined) {
        throw new DomainError('INVALID_TRANSITION', undefined, { machine: name, state, event });
      }
      return to;
    },
    events(state: S): E[] {
      return Object.keys(table[state] ?? {}) as E[];
    },
  };
}
