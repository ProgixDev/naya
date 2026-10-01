/** Native adapters: all demo files stay in the app sandbox; no server or socket. */
import { File, Directory, Paths } from 'expo-file-system';
import { getRandomBytes } from 'expo-crypto';
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { scrypt } from '@noble/hashes/scrypt.js';
export { Buffer };
export { fixturePath } from './fixtures.native';

export const join = (...parts: string[]) => parts.map((p, i) => i ? p.replace(/^\/+|\/+$/g, '') : p.replace(/\/+$/, '')).join('/');
export const dirname = (path: string) => path.slice(0, path.lastIndexOf('/'));
export const existsSync = (path: string) => Paths.info(path).exists;
export function mkdirSync(path: string, _options?: unknown) { new Directory(path).create({ intermediates: true, idempotent: true }); }
export function readFileSync(path: string): Buffer;
export function readFileSync(path: string, encoding: 'utf8'): string;
export function readFileSync(path: string, encoding?: 'utf8'): string | Buffer {
  const file = new File(path);
  return encoding ? file.textSync() : Buffer.from(file.bytesSync());
}
export function writeFileSync(path: string, content: string | Uint8Array) {
  // Expo's native typed-array bridge expects a real Uint8Array, not Buffer's subclass.
  new File(path).write(typeof content === 'string' ? content : new Uint8Array(content));
}
export function renameSync(from: string, to: string) { new File(from).moveSync(new File(to), { overwrite: true }); }
export function copyFileSync(from: string, to: string) { new File(from).copySync(new File(to), { overwrite: true }); }
export function rmSync(path: string, _options?: unknown) {
  const info = Paths.info(path);
  if (info.exists) (info.isDirectory ? new Directory(path) : new File(path)).delete();
}

export const randomBytes = (length: number) => Buffer.from(getRandomBytes(length));
export function randomInt(min: number, max: number) {
  const range = max - min;
  const limit = Math.floor(0x100000000 / range) * range;
  let n: number;
  do { n = randomBytes(4).readUInt32BE(0); } while (n >= limit);
  return min + n % range;
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}
export function createHash(_algorithm: 'sha256') {
  const hash = sha256.create();
  const api = {
    update(value: string) { hash.update(Buffer.from(value)); return api; },
    digest(_encoding: 'hex') { return Buffer.from(hash.digest()).toString('hex'); },
  };
  return api;
}
export function createHmac(_algorithm: 'sha256', secret: string) {
  const hash = hmac.create(sha256, Buffer.from(secret));
  const api = {
    update(value: string) { hash.update(Buffer.from(value)); return api; },
    digest(_encoding: 'hex') { return Buffer.from(hash.digest()).toString('hex'); },
  };
  return api;
}
export const scryptSync = (password: string, salt: string, length: number) => Buffer.from(scrypt(password, salt, { N: 16384, r: 8, p: 1, dkLen: length }));
