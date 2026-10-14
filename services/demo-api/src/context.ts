import type { Clock } from './clock';
import type { Store } from './store';

export interface ServerConfig {
  /** Enables /dev routes, mock sign-in codes and the scenario launcher. Never enable in production. */
  devMode: boolean;
  /**
   * 'any': mock mode (dev mode, and always on the device). No SMS is sent and any 6-digit code signs in (ADR-0058).
   * 'random': a random code per request, printed to the server console in place of an SMS (NAYA_DEV=0).
   */
  otpMode: 'any' | 'random';
  providerSecret: string;
  dataDir: string;
  /** Demo provider delays, shortened in tests. */
  providerDelaySeconds: { payment: number; withdrawalConfirm: number; withdrawalFail: number };
}

export interface Ctx {
  store: Store;
  clock: Clock;
  config: ServerConfig;
}
