import type { Clock } from './clock';
import type { Store } from './store';

export interface ServerConfig {
  /** Enables /dev routes, fixed OTP and the scenario launcher. Never enable in production. */
  devMode: boolean;
  otpMode: 'fixed' | 'random';
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
