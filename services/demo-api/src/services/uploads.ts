import { Buffer, mkdirSync, readFileSync, writeFileSync, existsSync, join } from '../platform';
import { DomainError, type Upload, type UploadInput } from '@naya/domain';
import type { Ctx } from '../context';
import type { Principal } from './auth';
import { nextId } from '../store';

const MAX_BYTES = 10 * 1024 * 1024;

/** Content is checked by magic bytes, not by the declared type. */
function sniff(buf: Buffer): Upload['mimeType'] | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return 'image/png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf.subarray(0, 5).toString() === '<?xml' || buf.subarray(0, 4).toString() === '<svg') return 'image/svg+xml';
  return null;
}

const ext: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'image/svg+xml': 'svg' };

export const uploadDir = (ctx: Ctx) => join(ctx.config.dataDir, 'uploads');

export function writeUploadFile(ctx: Ctx, id: string, mime: string, data: Buffer) {
  const dir = uploadDir(ctx);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.${ext[mime]}`), data);
}

export function createUpload(ctx: Ctx, ownerId: string, input: UploadInput): Upload {
  const data = Buffer.from(input.dataBase64, 'base64');
  if (data.length > MAX_BYTES) throw new DomainError('VALIDATION', 'Fichier trop volumineux (10 Mo maximum).');
  const sniffed = sniff(data);
  if (!sniffed || sniffed === 'image/svg+xml' || sniffed !== input.mimeType) {
    throw new DomainError('VALIDATION', 'Format de fichier non pris en charge. Utilisez une photo JPEG, PNG ou un PDF.');
  }
  return ctx.store.tx((s) => {
    const upload: Upload = {
      id: nextId(s, 'UP', 5),
      ownerId,
      purpose: input.purpose,
      mimeType: sniffed,
      width: input.width,
      height: input.height,
      size: data.length,
      createdAt: ctx.clock.iso(),
    };
    writeUploadFile(ctx, upload.id, sniffed, data);
    s.uploads.push(upload);
    return upload;
  });
}

/** The dedicated driver sees the photo of a child she drives, to check identity at pickup. */
function childPhotoForDriver(ctx: Ctx, driverId: string, uploadId: string) {
  const p = ctx.store.state.prototype;
  const child = p?.children.find((c) => c.photo === uploadId);
  return !!child && !!p?.trips.some((t) => t.childId === child.id && t.driverId === driverId);
}

/**
 * Identity documents are private: only their owner and administrators allowed to
 * review people may read them. Support agents see support attachments only.
 */
export function readUpload(ctx: Ctx, principal: Principal, id: string): { upload: Upload; data: Buffer } {
  const upload = ctx.store.state.uploads.find((u) => u.id === id);
  if (!upload) throw new DomainError('NOT_FOUND');
  const allowed =
    (principal.kind === 'user' && (principal.user.id === upload.ownerId || ctx.store.state.prototype?.trips.some(t => t.arrivalProof === id && t.passengerId === principal.user.id) || childPhotoForDriver(ctx, principal.user.id, id))) ||
    (principal.kind === 'admin' &&
      (principal.admin.permissions.includes('verification.decide') || (upload.purpose === 'support_attachment' && principal.admin.permissions.includes('config.edit')) ||
        (upload.purpose === 'support_attachment' && principal.admin.permissions.includes('support.resolve'))));
  if (!allowed) throw new DomainError('FORBIDDEN');
  const file = join(uploadDir(ctx), `${id}.${ext[upload.mimeType]}`);
  if (!existsSync(file)) throw new DomainError('NOT_FOUND', 'Fichier indisponible.');
  return { upload, data: readFileSync(file) };
}
