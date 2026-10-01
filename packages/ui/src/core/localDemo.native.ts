import { Directory, Paths } from 'expo-file-system';
import { createEmbeddedDemo } from '@naya/demo-api/embedded';
import { prepareFixtures } from '../../../../services/demo-api/src/fixtures.native';
import type { ClientOptions } from '@naya/api';
import type { SessionStore } from './session';

export function localDemoOptions(session: SessionStore): Pick<ClientOptions, 'transport' | 'uploadUrl'> {
  let runtime: ReturnType<typeof createEmbeddedDemo> | undefined;
  let ready: Promise<ReturnType<typeof createEmbeddedDemo>> | undefined;
  const load = () => ready ??= prepareFixtures().then(() => {
    const directory = new Directory(Paths.document, 'naya-standalone-demo');
    directory.create({ intermediates: true, idempotent: true });
    return runtime = createEmbeddedDemo({ dataDir: directory.uri, role: session.getState().role });
  }).catch((error) => { ready = undefined; throw error; });
  return {
    transport: async (url, init) => (await load()).fetch(url, init),
    uploadUrl: (id) => runtime?.uploadUrl(id, session.getState().token) ?? '',
  };
}
