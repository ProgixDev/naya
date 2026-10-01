import type { ClientOptions } from '@naya/api';
import type { SessionStore } from './session';
/** Web and server-connected previews keep their existing transport. */
export function localDemoOptions(_session: SessionStore): Pick<ClientOptions, 'transport' | 'uploadUrl'> { return {}; }
