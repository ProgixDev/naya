import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { Clock } from './clock';
import type { Ctx } from './context';
import { buildSeed } from './seed';
import { Store } from './store';
import { tick } from './services/timers';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.NAYA_DATA_DIR ?? join(here, '..', '.data');
const devMode = process.env.NAYA_DEV !== '0';
const port = Number(process.env.PORT ?? 4010);
const providerSecret = process.env.NAYA_PROVIDER_SECRET ?? 'demo-provider-secret-change-me';

if (!devMode && providerSecret.startsWith('demo-')) {
  console.error('NAYA_PROVIDER_SECRET must be set when NAYA_DEV=0.');
  process.exit(1);
}

const clock = new Clock();
const store = Store.load(join(dataDir, 'db.json'), () => buildSeed(dataDir, 'default', clock.now()));
const ctx: Ctx = {
  store,
  clock,
  config: {
    devMode,
    otpMode: devMode ? 'fixed' : 'random',
    providerSecret,
    dataDir,
    providerDelaySeconds: { payment: 3, withdrawalConfirm: 8, withdrawalFail: 5 },
  },
};

const app = createApp(ctx);
setInterval(() => {
  try {
    tick(ctx);
  } catch (e) {
    console.error('[tick]', e);
  }
}, 500);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.info(`Naya demo API · http://localhost:${info.port} · scénario « ${store.state.scenario} » · dev ${devMode ? 'activé' : 'désactivé'}`);
});
