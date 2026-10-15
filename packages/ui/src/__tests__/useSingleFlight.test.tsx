import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '@naya/api';
import { isUncertainFailure, useSingleFlight } from '../core/useSingleFlight';

/**
 * Idempotency-key lifecycle (ADR-0053, UI-17): the same key while the person retries the same
 * intent after an unanswered attempt; a new key after a success, a definitive 4xx or a change
 * of payload.
 */

type TopUp = { amount: number; providerId: string };
type Outcome = 'ok' | 'network' | 'timeout' | 'server' | 'conflict';

const fail = (o: Outcome): Error => {
  if (o === 'network') return new ApiError('NETWORK', 'Connexion indisponible.', 0);
  if (o === 'timeout') return Object.assign(new Error('Aborted'), { name: 'AbortError' });
  if (o === 'server') return new ApiError('UNKNOWN', 'Erreur serveur.', 503);
  return new ApiError('VALIDATION', 'Montant invalide.', 422);
};

function setup(opts: { resetOnError?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } } });
  const calls: { vars: TopUp; key: string }[] = [];
  const outcomes: Outcome[] = [];
  const fn = jest.fn(async (vars: TopUp, key: string) => {
    calls.push({ vars, key });
    const o = outcomes.shift() ?? 'ok';
    if (o !== 'ok') throw fail(o);
    return 'entry';
  });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, calls, outcomes, fn, wrapper, opts };
}

async function mount(s: ReturnType<typeof setup>) {
  const hook = await renderHook(
    () => {
      const flight = useSingleFlight(s.fn, {
        onError: () => {
          if (s.opts.resetOnError) flight.reset();
        },
      });
      return flight;
    },
    { wrapper: s.wrapper },
  );
  const run = async (vars: TopUp) => {
    await act(async () => {
      hook.result.current.run(vars);
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  return { ...hook, run };
}

const keyAt = (s: ReturnType<typeof setup>, i: number) => {
  const call = s.calls[i];
  if (!call) throw new Error(`no call #${i}`);
  return call.key;
};

const TOPUP: TopUp = { amount: 10_000, providerId: 'cmi' };

describe('useSingleFlight idempotency-key lifecycle', () => {
  it.each(['network', 'timeout', 'server'] as const)('keeps the same key on a retry after a %s failure', async (o) => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push(o);
    await h.run(TOPUP);
    await h.run({ ...TOPUP });
    expect(s.fn).toHaveBeenCalledTimes(2);
    expect(keyAt(s, 1)).toBe(keyAt(s, 0));
    s.qc.clear();
  });

  it('keeps the same key when the screen still calls reset() on error', async () => {
    const s = setup({ resetOnError: true });
    const h = await mount(s);
    s.outcomes.push('network', 'network');
    await h.run(TOPUP);
    await h.run(TOPUP);
    await h.run(TOPUP);
    expect(s.calls).toHaveLength(3);
    expect(new Set(s.calls.map((c) => c.key)).size).toBe(1);
    s.qc.clear();
  });

  it('treats key order as the same payload', async () => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push('network');
    await h.run({ amount: 10_000, providerId: 'cmi' });
    await h.run({ providerId: 'cmi', amount: 10_000 });
    expect(keyAt(s, 1)).toBe(keyAt(s, 0));
    s.qc.clear();
  });

  it('makes a new key after a success', async () => {
    const s = setup();
    const h = await mount(s);
    await h.run(TOPUP);
    await h.run(TOPUP);
    expect(s.fn).toHaveBeenCalledTimes(2);
    expect(keyAt(s, 1)).not.toBe(keyAt(s, 0));
    s.qc.clear();
  });

  it('makes a new key after a success that followed a retried failure', async () => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push('network');
    await h.run(TOPUP);
    await h.run(TOPUP);
    await h.run(TOPUP);
    expect(keyAt(s, 1)).toBe(keyAt(s, 0));
    expect(keyAt(s, 2)).not.toBe(keyAt(s, 1));
    s.qc.clear();
  });

  it('makes a new key when the payload changes', async () => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push('network', 'network');
    await h.run(TOPUP);
    await h.run({ ...TOPUP, amount: 20_000 });
    await h.run({ amount: 20_000, providerId: 'agence' });
    expect(s.calls).toHaveLength(3);
    expect(new Set(s.calls.map((c) => c.key)).size).toBe(3);
    s.qc.clear();
  });

  it('makes a new key after a definitive 4xx', async () => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push('conflict');
    await h.run(TOPUP);
    await h.run(TOPUP);
    expect(keyAt(s, 1)).not.toBe(keyAt(s, 0));
    s.qc.clear();
  });

  it('reset() starts a new intent once the last attempt was answered', async () => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push('conflict');
    await h.run(TOPUP);
    const afterConflict = keyAt(s, 0);
    await act(async () => h.result.current.reset());
    await h.run(TOPUP);
    expect(keyAt(s, 1)).not.toBe(afterConflict);
    s.qc.clear();
  });

  it('makes a new key when the payload changes after a retry, even back to the first payload', async () => {
    const s = setup();
    const h = await mount(s);
    s.outcomes.push('network', 'network');
    await h.run(TOPUP);
    await h.run({ ...TOPUP, amount: 20_000 });
    await h.run(TOPUP);
    expect(s.calls).toHaveLength(3);
    expect(new Set(s.calls.map((c) => c.key)).size).toBe(3);
    s.qc.clear();
  });

  it('sends one request for two taps in the same frame', async () => {
    const s = setup();
    const h = await mount(s);
    await act(async () => {
      h.result.current.run(TOPUP);
      h.result.current.run(TOPUP);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(s.fn).toHaveBeenCalledTimes(1);
    s.qc.clear();
  });
});

describe('isUncertainFailure', () => {
  it('separates unanswered attempts from definitive refusals', () => {
    expect(isUncertainFailure(new ApiError('NETWORK', 'x', 0))).toBe(true);
    expect(isUncertainFailure(new Error('Aborted'))).toBe(true);
    expect(isUncertainFailure(new ApiError('UNKNOWN', 'x', 500))).toBe(true);
    expect(isUncertainFailure(new ApiError('UNKNOWN', 'x', 408))).toBe(true);
    expect(isUncertainFailure(new ApiError('UNKNOWN', 'x', 429))).toBe(true);
    expect(isUncertainFailure(new ApiError('VALIDATION', 'x', 422))).toBe(false);
    expect(isUncertainFailure(new ApiError('IDEMPOTENCY_CONFLICT', 'x', 409))).toBe(false);
    expect(isUncertainFailure(new ApiError('FORBIDDEN', 'x', 403))).toBe(false);
  });
});
