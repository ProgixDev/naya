import { DomainError, SUPPORT_STATUS_LABELS, type AdminUser, type AgentMessageInput, type ResolveTicketInput, type SupportMessageInput, type SupportTicket, type SupportTicketInput, type TicketActionInput, type TicketHistoryEntry, type TicketStatusInput, type User } from '@naya/domain';
import { agentMessageSchema, supportTicketSchema, supportMessageSchema, ticketActionSchema, ticketStatusSchema } from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import { requirePermission } from './permissions';
import { ensurePrototype } from './prototype';

const closed = (t: SupportTicket) => t.status === 'resolved' || t.status === 'rejected';

function track(t: SupportTicket, entry: TicketHistoryEntry) {
  (t.history ??= []).push(entry);
  t.updatedAt = entry.at;
}

function move(t: SupportTicket, to: SupportTicket['status'], at: string, by: string, byType: TicketHistoryEntry['byType'], note?: string) {
  if (t.status === to) return;
  track(t, { at, by, byType, kind: 'status', label: `${SUPPORT_STATUS_LABELS[t.status]} → ${SUPPORT_STATUS_LABELS[to]}`, from: t.status, to, ...(note ? { note } : {}) });
  t.status = to;
}

function audit(s: State, at: string, admin: AdminUser, t: SupportTicket, action: string, summary: string, reason?: string) {
  appendAudit(s, at, { actor: { type: 'admin', id: admin.id, name: admin.name }, action, entityType: 'support_ticket', entityId: t.id, cityId: t.cityId, ...(reason ? { reason } : {}), summary });
}

export function createTicket(ctx: Ctx, user: User, raw: SupportTicketInput) {
  const input = supportTicketSchema.parse(raw);
  return ctx.store.tx((s) => {
    const reason = input.reasonId ? mustFind(ensurePrototype(s).catalog.reasons, r => r.id === input.reasonId && r.enabled, 'motif') : null;
    if (reason && reason.category !== input.category) throw new DomainError('VALIDATION', 'Le motif ne correspond pas à la catégorie.');
    if (reason?.roles?.length && !reason.roles.includes(user.role)) throw new DomainError('VALIDATION', 'Ce motif n’est pas disponible pour votre compte.');
    if (reason?.evidenceRequired && !input.attachments.length) throw new DomainError('VALIDATION', 'Une photo ou un document est requis pour ce motif.');
    if (input.rideId) {
      const ride = mustFind(s.rides, (r) => r.id === input.rideId, 'course');
      if (ride.passengerId !== user.id && ride.driverId !== user.id) throw new DomainError('FORBIDDEN');
    }
    for (const id of input.attachments) {
      const up = mustFind(s.uploads, (u) => u.id === id, 'pièce jointe');
      if (up.ownerId !== user.id || up.purpose !== 'support_attachment') throw new DomainError('FORBIDDEN');
    }
    const now = ctx.clock.iso();
    const name = `${user.firstName} ${user.lastName}`.trim();
    const ticket: SupportTicket = {
      id: nextId(s, 'SU'),
      userId: user.id,
      userRole: user.role,
      userName: name || user.phone,
      cityId: user.cityId,
      rideId: input.rideId,
      category: input.category,
      reasonId: input.reasonId,
      subject: input.subject,
      status: 'open',
      // A reason or a linked ride makes it a dispute to arbitrate, not a general question.
      isDispute: !!reason || (!!input.rideId && (input.category === 'payment' || input.category === 'ride')),
      messages: [
        { id: nextId(s, 'MSG', 5), author: 'user', authorName: name, body: input.body, attachments: input.attachments, at: now },
        { id: nextId(s, 'MSG', 5), author: 'system', authorName: 'Naya', body: 'Demande reçue. Une personne de l’équipe vous répond en général sous 24 heures.', attachments: [], at: now },
      ],
      resolution: null,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    track(ticket, { at: now, by: name || user.phone, byType: 'user', kind: 'opened', label: `${ticket.isDispute ? 'Litige ouvert' : 'Demande ouverte'}${reason ? ` · ${reason.label}` : ''}`, note: input.attachments.length ? `${input.attachments.length} pièce(s) jointe(s)` : undefined });
    s.tickets.push(ticket);
    return ticket;
  });
}

export function userMessage(ctx: Ctx, user: User, ticketId: string, raw: SupportMessageInput) {
  const input = supportMessageSchema.parse(raw);
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId && x.userId === user.id, 'demande');
    if (closed(t)) throw new DomainError('INVALID_TRANSITION', 'Cette demande est résolue. Ouvrez une nouvelle demande si besoin.');
    const now = ctx.clock.iso();
    for (const id of input.attachments) mustFind(s.uploads, u => u.id === id && u.ownerId === user.id && u.purpose === 'support_attachment', 'pièce jointe');
    const name = `${user.firstName} ${user.lastName}`.trim();
    t.messages.push({ id: nextId(s, 'MSG', 5), author: 'user', authorName: name, body: input.body, attachments: input.attachments, at: now });
    track(t, { at: now, by: name, byType: 'user', kind: 'user_reply', label: input.attachments.length ? `Réponse avec ${input.attachments.length} pièce(s) jointe(s)` : 'Réponse de la personne' });
    // Information received: the case goes back to analysis.
    if (t.status === 'awaiting_user') move(t, 'in_progress', now, 'Naya', 'system');
    return t;
  });
}

export function agentMessage(ctx: Ctx, admin: AdminUser, ticketId: string, raw: AgentMessageInput) {
  requirePermission(admin, 'support.resolve');
  const input = agentMessageSchema.parse(raw);
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId, 'demande');
    if (closed(t)) throw new DomainError('INVALID_TRANSITION', 'Demande déjà résolue.');
    const now = ctx.clock.iso();
    t.messages.push({ id: nextId(s, 'MSG', 5), author: 'agent', authorName: `${admin.name} · Assistance Naya`, body: input.body, attachments: [], at: now });
    track(t, { at: now, by: admin.name, byType: 'admin', kind: input.requestInfo ? 'info_requested' : 'agent_reply', label: input.requestInfo ? 'Informations complémentaires demandées' : 'Réponse envoyée', note: input.body });
    move(t, input.requestInfo ? 'awaiting_user' : 'in_progress', now, admin.name, 'admin');
    audit(s, now, admin, t, input.requestInfo ? 'support.info_requested' : 'support.replied', `${input.requestInfo ? 'Informations demandées' : 'Réponse envoyée'} · ${t.id}`);
    return t;
  });
}

/** Nouveau → En cours d’analyse. */
export function setTicketStatus(ctx: Ctx, admin: AdminUser, ticketId: string, raw: TicketStatusInput) {
  requirePermission(admin, 'support.resolve');
  const input = ticketStatusSchema.parse(raw);
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId, 'demande');
    if (closed(t)) throw new DomainError('INVALID_TRANSITION', 'Demande déjà résolue.');
    const now = ctx.clock.iso();
    move(t, input.status, now, admin.name, 'admin', input.note);
    audit(s, now, admin, t, 'support.analysis_started', `Analyse commencée · ${t.id}`, input.note);
    return t;
  });
}

/** Records something the team did (refund, warning, call…) or an internal note. Never shown to the person. */
export function recordTicketAction(ctx: Ctx, admin: AdminUser, ticketId: string, raw: TicketActionInput) {
  requirePermission(admin, 'support.resolve');
  const input = ticketActionSchema.parse(raw);
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId, 'demande');
    const now = ctx.clock.iso();
    track(t, { at: now, by: admin.name, byType: 'admin', kind: input.kind, label: input.label, ...(input.note ? { note: input.note } : {}) });
    if (input.kind === 'action' && t.status === 'open') move(t, 'in_progress', now, admin.name, 'admin');
    audit(s, now, admin, t, input.kind === 'action' ? 'support.action' : 'support.internal_note', `${input.kind === 'action' ? 'Action' : 'Note interne'} · ${input.label} · ${t.id}`, input.note);
    return t;
  });
}

/** Strips internal notes before a case is shown to the person who opened it. */
export function publicTicket(t: SupportTicket): SupportTicket {
  return { ...t, history: (t.history ?? []).filter((h) => h.kind !== 'internal_note' && h.kind !== 'action') };
}

export function resolveTicket(ctx: Ctx, admin: AdminUser, ticketId: string, input: ResolveTicketInput) {
  requirePermission(admin, 'support.resolve');
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId, 'demande');
    if (closed(t)) throw new DomainError('CONFLICT', 'Demande déjà résolue.');
    const now = ctx.clock.iso();
    const decision = input.decision ?? (/^(rejected|rejetée?)$/i.test(input.outcome) ? 'rejected' : 'resolved');
    t.resolution = { outcome: input.outcome, note: input.note, by: admin.name, at: now, decision };
    t.messages.push({ id: nextId(s, 'MSG', 5), author: 'agent', authorName: `${admin.name} · Assistance Naya`, body: `Demande ${decision === 'rejected' ? 'rejetée' : 'résolue'} : ${input.outcome}. ${input.note}`, attachments: [], at: now });
    track(t, { at: now, by: admin.name, byType: 'admin', kind: 'decision', label: `Décision : ${decision === 'rejected' ? 'rejeté' : 'résolu'} · ${input.outcome}`, note: input.note });
    move(t, decision, now, admin.name, 'admin');
    appendAudit(s, now, { actor: { type: 'admin', id: admin.id, name: admin.name }, action: 'support.resolved', entityType: 'support_ticket', entityId: t.id, cityId: t.cityId, reason: input.note, summary: `Demande ${t.id} ${decision === 'rejected' ? 'rejetée' : 'résolue'} · ${input.outcome}` });
    return t;
  });
}
