import { useCallback, useRef } from 'react';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { newIdempotencyKey } from '@naya/api';

/**
 * True when a failed request may still have been applied by the server: no answer (network
 * error, timeout, abort, in-process transport failure), 408, 429 or a 5xx. A retry of the
 * same intent must then replay the same Idempotency-Key. Any other 4xx is a definitive answer
 * (validation, conflict, forbidden, idempotency conflict): nothing was applied.
 */
export function isUncertainFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== 'number' || status === 0) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/** Order-independent fingerprint of the variables, used to notice a changed payload. */
function payloadSignature(vars: unknown): string {
  try {
    return (
      JSON.stringify(vars, (_k, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
          : v,
      ) ?? 'undefined'
    );
  } catch {
    // Unserialisable: treat as unchanged. A different body under the same key is refused by
    // the server (IDEMPOTENCY_CONFLICT, a definitive 4xx), which then rotates the key.
    return 'unserialisable';
  }
}

/**
 * One request in flight per destructive or financial intent, with one Idempotency-Key per
 * intent (ADR-0053, UI-17):
 *
 * - the key is kept after a network error, a timeout or a 5xx, so a retry of the same intent
 *   replays the same request server-side instead of creating a second booking, top-up or
 *   withdrawal;
 * - a new key is made after a success, after a definitive 4xx, or when the variables passed to
 *   `run()` differ from the ones the key was last sent with.
 *
 * The hook only sees the payload through `run(vars)`: pass amounts, targets and methods as
 * variables rather than reading them from a closure. `reset()` clears the mutation state and
 * makes a new key, except while the last attempt ended in an uncertain failure, so a caller
 * that resets on error still retries with the same key.
 */
export function useSingleFlight<TData, TVars>(fn: (vars: TVars, key: string) => Promise<TData>, options: Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn'> = {}) {
  const key = useRef<string | null>(null);
  if (key.current === null) key.current = newIdempotencyKey();
  // Signature of the payload the current key was last sent with; null while the key is unused.
  const sentWith = useRef<string | null>(null);
  const rotate = () => {
    key.current = newIdempotencyKey();
    sentWith.current = null;
  };
  // A ref, not `mutation.isPending`: two taps in the same frame both see the render-time
  // `isPending === false`, so only a synchronous flag guarantees a single request.
  const inFlight = useRef(false);
  const mutation = useMutation<TData, Error, TVars>({
    ...options,
    mutationFn: async (vars) => {
      try {
        const signature = payloadSignature(vars);
        if (sentWith.current !== null && sentWith.current !== signature) rotate();
        sentWith.current = signature;
        const k = key.current!;
        try {
          const result = await fn(vars, k);
          if (key.current === k) rotate();
          return result;
        } catch (error) {
          if (key.current === k && !isUncertainFailure(error)) rotate();
          throw error;
        }
      } finally {
        inFlight.current = false;
      }
    },
  });
  const run = useCallback(
    (vars: TVars) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate(vars);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutate],
  );
  const reset = useCallback(() => {
    // sentWith is only set between an uncertain failure and the next attempt (success and
    // definitive errors rotate): keep that key so the retry replays it.
    if (sentWith.current === null) rotate();
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.reset]);
  return { ...mutation, run, reset };
}
