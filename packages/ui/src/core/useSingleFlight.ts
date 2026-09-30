import { useCallback, useRef } from 'react';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { newIdempotencyKey } from '@naya/api';

/**
 * One request in flight per destructive or financial intent. A stable idempotency key is
 * kept for the intent, so a double tap, a retry after a timeout or a reconnect replays the
 * same request server-side instead of creating a second booking, recharge or withdrawal.
 * Call `reset()` when the person starts a genuinely new intent.
 */
export function useSingleFlight<TData, TVars>(fn: (vars: TVars, key: string) => Promise<TData>, options: Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn'> = {}) {
  const key = useRef(newIdempotencyKey());
  const mutation = useMutation<TData, Error, TVars>({ ...options, mutationFn: (vars) => fn(vars, key.current) });
  const run = useCallback(
    (vars: TVars) => {
      if (mutation.isPending) return;
      mutation.mutate(vars);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.isPending, mutation.mutate],
  );
  const reset = useCallback(() => {
    key.current = newIdempotencyKey();
    mutation.reset();
  }, [mutation]);
  return { ...mutation, run, reset };
}
