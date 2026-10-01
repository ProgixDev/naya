/** Node adapter. Metro selects platform.native.ts for the on-device demo. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export { Buffer } from 'node:buffer';
export { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
export { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
export { dirname, join } from 'node:path';
export const fixturePath = (name: string) => join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', name);
