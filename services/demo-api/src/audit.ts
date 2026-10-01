import { createHash } from './platform';
import type { AuditActor, AuditEvent } from '@naya/domain';
import type { State } from './state';
import { nextId } from './store';

const GENESIS = '0'.repeat(64);

function hashEvent(e: Omit<AuditEvent, 'hash'>): string {
  return createHash('sha256')
    .update(JSON.stringify([e.seq, e.at, e.actor, e.action, e.entityType, e.entityId, e.cityId, e.reason, e.summary, e.before, e.after, e.prevHash]))
    .digest('hex');
}

/** Append-only. There is intentionally no update or delete path for audit events. */
export function appendAudit(
  s: State,
  at: string,
  input: { actor: AuditActor; action: string; entityType: string; entityId: string; cityId?: string | null; reason?: string | null; summary: string; before?: unknown; after?: unknown },
): AuditEvent {
  const prev = s.audit[s.audit.length - 1];
  const base: Omit<AuditEvent, 'hash'> = {
    id: nextId(s, 'AU', 5),
    seq: (prev?.seq ?? 0) + 1,
    at,
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    cityId: input.cityId ?? null,
    reason: input.reason ?? null,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
    prevHash: prev?.hash ?? GENESIS,
  };
  const event: AuditEvent = { ...base, hash: hashEvent(base) };
  s.audit.push(event);
  return event;
}

export function verifyAuditChain(events: readonly AuditEvent[]): { valid: boolean; brokenAt: number | null } {
  let prev = GENESIS;
  for (const e of events) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || hashEvent(rest) !== hash) return { valid: false, brokenAt: e.seq };
    prev = hash;
  }
  return { valid: true, brokenAt: null };
}

export const SYSTEM: AuditActor = { type: 'system', id: 'system', name: 'Système Naya' };
