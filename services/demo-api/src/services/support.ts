import { DomainError, type AdminUser, type ResolveTicketInput, type SupportMessageInput, type SupportTicket, type SupportTicketInput, type User } from '@naya/domain';
import { supportTicketSchema, supportMessageSchema } from '@naya/domain';
import type { Ctx } from '../context';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import { requirePermission } from './permissions';
import { ensurePrototype } from './prototype';

export function createTicket(ctx: Ctx, user: User, raw: SupportTicketInput) {
  const input = supportTicketSchema.parse(raw);
  return ctx.store.tx((s) => {
    const reason = input.reasonId ? mustFind(ensurePrototype(s).catalog.reasons, r => r.id === input.reasonId && r.enabled, 'motif') : null;
    if (reason && reason.category !== input.category) throw new DomainError('VALIDATION', 'Le motif ne correspond pas à la catégorie.');
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
      isDispute: !!input.rideId && (input.category === 'payment' || input.category === 'ride'),
      messages: [
        { id: nextId(s, 'MSG', 5), author: 'user', authorName: name, body: input.body, attachments: input.attachments, at: now },
        { id: nextId(s, 'MSG', 5), author: 'system', authorName: 'Naya', body: 'Demande reçue. Une personne de l’équipe vous répond en général sous 24 heures.', attachments: [], at: now },
      ],
      resolution: null,
      createdAt: now,
      updatedAt: now,
    };
    s.tickets.push(ticket);
    return ticket;
  });
}

export function userMessage(ctx: Ctx, user: User, ticketId: string, raw: SupportMessageInput) {
  const input = supportMessageSchema.parse(raw);
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId && x.userId === user.id, 'demande');
    if ((t.status === 'resolved' || t.status === 'rejected')) throw new DomainError('INVALID_TRANSITION', 'Cette demande est résolue. Ouvrez une nouvelle demande si besoin.');
    const now = ctx.clock.iso();
    for (const id of input.attachments) mustFind(s.uploads, u => u.id === id && u.ownerId === user.id && u.purpose === 'support_attachment', 'pièce jointe');
    t.messages.push({ id: nextId(s, 'MSG', 5), author: 'user', authorName: `${user.firstName} ${user.lastName}`.trim(), body: input.body, attachments: input.attachments, at: now });
    if (t.status === 'awaiting_user') t.status = 'in_progress';
    t.updatedAt = now;
    return t;
  });
}

export function agentMessage(ctx: Ctx, admin: AdminUser, ticketId: string, raw: SupportMessageInput) {
  requirePermission(admin, 'support.resolve');
  const input = supportMessageSchema.parse(raw);
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId, 'demande');
    if ((t.status === 'resolved' || t.status === 'rejected')) throw new DomainError('INVALID_TRANSITION', 'Demande déjà résolue.');
    const now = ctx.clock.iso();
    t.messages.push({ id: nextId(s, 'MSG', 5), author: 'agent', authorName: `${admin.name} · Assistance Naya`, body: input.body, attachments: [], at: now });
    t.status = 'awaiting_user';
    appendAudit(s, now, { actor: { type: 'admin', id: admin.id, name: admin.name }, action: 'support.replied', entityType: 'support_ticket', entityId: t.id, cityId: t.cityId, summary: `Réponse et attente utilisateur · ${t.id}` });
    t.updatedAt = now;
    return t;
  });
}

export function resolveTicket(ctx: Ctx, admin: AdminUser, ticketId: string, input: ResolveTicketInput) {
  requirePermission(admin, 'support.resolve');
  return ctx.store.tx((s) => {
    const t = mustFind(s.tickets, (x) => x.id === ticketId, 'demande');
    if ((t.status === 'resolved' || t.status === 'rejected')) throw new DomainError('CONFLICT', 'Demande déjà résolue.');
    const now = ctx.clock.iso();
    t.status = /^(rejected|rejetée)$/i.test(input.outcome) ? 'rejected' : 'resolved';
    t.resolution = { outcome: input.outcome, note: input.note, by: admin.name, at: now };
    t.messages.push({ id: nextId(s, 'MSG', 5), author: 'agent', authorName: `${admin.name} · Assistance Naya`, body: `Demande ${t.status === 'rejected' ? 'rejetée' : 'résolue'} : ${input.outcome}. ${input.note}`, attachments: [], at: now });
    t.updatedAt = now;
    appendAudit(s, now, { actor: { type: 'admin', id: admin.id, name: admin.name }, action: 'support.resolved', entityType: 'support_ticket', entityId: t.id, cityId: t.cityId, reason: input.note, summary: `Demande ${t.id} résolue · ${input.outcome}` });
    return t;
  });
}
