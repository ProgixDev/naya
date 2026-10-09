import {
  DomainError,
  formatBp,
  formatMoney,
  type AdminUser,
  type CityConfig,
  type CityRules,
  type CityStatusInput,
  type CreateCityInput,
  type PaymentProviderConfig,
  type ProviderCreateInput,
  type ProviderSettingsInput,
  type ProviderToggleInput,
  type UpdateRulesInput,
  providerCreateSchema,
  providerSettingsSchema,
  type ZoneInput,
} from '@naya/domain';
import type { Ctx } from '../context';
import { mustFind, nextId } from '../store';
import { ADAPTERS, defaultProviders } from './payments';
import type { State } from '../state';
import { appendAudit } from '../audit';
import { requirePermission } from './permissions';

const actorOf = (a: AdminUser) => ({ type: 'admin' as const, id: a.id, name: a.name });

/** Human summary of what changed between two rule sets, for the audit log. */
export function diffRules(a: CityRules, b: CityRules): string[] {
  const out: string[] = [];
  const money = (k: keyof CityRules, label: string) => {
    if (a[k] !== b[k]) out.push(`${label} ${formatMoney(a[k] as number)} → ${formatMoney(b[k] as number)}`);
  };
  money('baseFare', 'Prise en charge');
  money('perKm', 'Prix/km');
  money('perMinute', 'Prix/min');
  money('minimumFare', 'Minimum');
  money('debtLimit', 'Plafond de dette');
  money('minimumWithdrawal', 'Retrait minimum');
  if (a.commissionBp !== b.commissionBp) out.push(`Commission ${formatBp(a.commissionBp)} → ${formatBp(b.commissionBp)}`);
  if (a.dynamic.enabled !== b.dynamic.enabled || a.dynamic.multiplierBp !== b.dynamic.multiplierBp) {
    out.push(`Tarification dynamique ${a.dynamic.enabled ? 'active' : 'inactive'} → ${b.dynamic.enabled ? `active ×${(b.dynamic.multiplierBp / 10000).toString().replace('.', ',')}` : 'inactive'}`);
  }
  if (JSON.stringify(a.cancellation) !== JSON.stringify(b.cancellation)) out.push('Politique d’annulation modifiée');
  if (a.offerTimeoutSeconds !== b.offerTimeoutSeconds) out.push(`Délai d’offre ${a.offerTimeoutSeconds} s → ${b.offerTimeoutSeconds} s`);
  return out;
}

export function createCity(ctx: Ctx, admin: AdminUser, input: CreateCityInput) {
  requirePermission(admin, 'config.edit');
  return ctx.store.tx((s) => {
    if (s.cities.some((c) => c.id === input.id)) throw new DomainError('CONFLICT', 'Cette ville existe déjà.');
    const now = ctx.clock.iso();
    const city: CityConfig = {
      id: input.id,
      name: input.name,
      status: input.status,
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      center: input.center,
      rules: input.rules,
      rulesVersion: 1,
      updatedAt: now,
      updatedBy: admin.id,
    };
    s.cities.push(city);
    s.cityRuleVersions.push({ cityId: city.id, version: 1, rules: input.rules, createdAt: now, createdBy: admin.id, reason: input.reason });
    // Same provider set as other cities, all disabled until the team enables them.
    s.providers.push(...defaultProviders(city.id).map((p) => ({ ...p, enabled: false })));
    appendAudit(s, now, { actor: actorOf(admin), action: 'city.created', entityType: 'city', entityId: city.id, cityId: city.id, reason: input.reason, summary: `Ville ${city.name} ajoutée (${city.status === 'test' ? 'test' : 'inactive'}) · règles v1`, after: input.rules });
    return city;
  });
}

export function updateRules(ctx: Ctx, admin: AdminUser, cityId: string, input: UpdateRulesInput) {
  requirePermission(admin, 'config.edit');
  return ctx.store.tx((s) => {
    const city = mustFind(s.cities, (c) => c.id === cityId, 'ville');
    if (city.rulesVersion !== input.expectedVersion) {
      throw new DomainError('CONFLICT', 'Les règles ont été modifiées entre-temps. Rechargez avant d’enregistrer.');
    }
    const changes = diffRules(city.rules, input.rules);
    if (changes.length === 0) throw new DomainError('VALIDATION', 'Aucune modification à enregistrer.');
    const now = ctx.clock.iso();
    const before = city.rules;
    city.rules = input.rules;
    city.rulesVersion += 1;
    city.updatedAt = now;
    city.updatedBy = admin.id;
    s.cityRuleVersions.push({ cityId, version: city.rulesVersion, rules: input.rules, createdAt: now, createdBy: admin.id, reason: input.reason });
    appendAudit(s, now, {
      actor: actorOf(admin),
      action: 'city.rules_updated',
      entityType: 'city',
      entityId: cityId,
      cityId,
      reason: input.reason,
      summary: `Règles ${city.name} v${city.rulesVersion} · ${changes.join(' · ')}`,
      before,
      after: input.rules,
    });
    return city;
  });
}

export function setCityStatus(ctx: Ctx, admin: AdminUser, cityId: string, input: CityStatusInput) {
  requirePermission(admin, 'config.edit');
  return ctx.store.tx((s) => {
    const city = mustFind(s.cities, (c) => c.id === cityId, 'ville');
    if (city.status === input.status) return city;
    const now = ctx.clock.iso();
    const before = city.status;
    city.status = input.status;
    city.updatedAt = now;
    appendAudit(s, now, { actor: actorOf(admin), action: 'city.status_changed', entityType: 'city', entityId: cityId, cityId, reason: input.reason, summary: `${city.name} : ${before} → ${input.status}`, before: { status: before }, after: { status: input.status } });
    return city;
  });
}

export function addZone(ctx: Ctx, admin: AdminUser, cityId: string, input: ZoneInput) {
  requirePermission(admin, 'config.edit');
  return ctx.store.tx((s) => {
    mustFind(s.cities, (c) => c.id === cityId, 'ville');
    const now = ctx.clock.iso();
    const zone = { id: nextId(s, 'ZN'), cityId, name: input.name, polygon: input.polygon, active: input.active };
    s.zones.push(zone);
    appendAudit(s, now, { actor: actorOf(admin), action: 'zone.created', entityType: 'zone', entityId: zone.id, cityId, reason: input.reason, summary: `Zone « ${zone.name} » ajoutée (${input.polygon.length} sommets)` });
    return zone;
  });
}

export function setZoneActive(ctx: Ctx, admin: AdminUser, zoneId: string, active: boolean, reason: string) {
  requirePermission(admin, 'config.edit');
  return ctx.store.tx((s) => {
    const zone = mustFind(s.zones, (z) => z.id === zoneId, 'zone');
    zone.active = active;
    appendAudit(s, ctx.clock.iso(), { actor: actorOf(admin), action: active ? 'zone.activated' : 'zone.deactivated', entityType: 'zone', entityId: zoneId, cityId: zone.cityId, reason, summary: `Zone « ${zone.name} » ${active ? 'activée' : 'désactivée'}` });
    return zone;
  });
}

function checkSettings(s: State, purpose: PaymentProviderConfig['purpose'], input: ProviderSettingsInput) {
  const adapter = ADAPTERS.find((a) => a.id === input.adapter);
  if (!adapter) throw new DomainError('VALIDATION', 'Adaptateur de paiement inconnu.');
  if (!adapter.purposes.includes(purpose)) throw new DomainError('VALIDATION', `${adapter.name} ne gère pas cet usage.`);
  if (input.minAmount != null && input.maxAmount != null && input.minAmount > input.maxAmount) throw new DomainError('VALIDATION', 'Le minimum dépasse le maximum.');
  return adapter;
}

/** Adds a provider to a city, disabled until the team enables it. */
export function createProvider(ctx: Ctx, admin: AdminUser, raw: ProviderCreateInput) {
  requirePermission(admin, 'config.edit');
  const input = providerCreateSchema.parse(raw);
  return ctx.store.tx((s) => {
    mustFind(s.cities, (c) => c.id === input.cityId, 'ville');
    const adapter = checkSettings(s, input.purpose, input);
    const slug = input.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let id = `${input.cityId}-${input.purpose}-${slug}`;
    for (let i = 2; s.providers.some((p) => p.id === id); i++) id = `${input.cityId}-${input.purpose}-${slug}-${i}`;
    const p: PaymentProviderConfig = {
      id,
      cityId: input.cityId,
      purpose: input.purpose,
      kind: adapter.kinds[0]!,
      name: input.name,
      enabled: false,
      mode: adapter.mode,
      configured: adapter.configured(),
      adapter: adapter.id,
      audiences: input.audiences,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      instructions: input.instructions,
    };
    s.providers.push(p);
    appendAudit(s, ctx.clock.iso(), { actor: actorOf(admin), action: 'provider.created', entityType: 'provider', entityId: p.id, cityId: p.cityId, reason: input.reason, summary: `${p.name} ajouté (${adapter.name}) pour ${p.purpose}` });
    return p;
  });
}

/** Updates a provider. A new adapter replaces the company behind it; pending operations keep their reference. */
export function updateProvider(ctx: Ctx, admin: AdminUser, providerId: string, raw: ProviderSettingsInput) {
  requirePermission(admin, 'config.edit');
  const input = providerSettingsSchema.parse(raw);
  return ctx.store.tx((s) => {
    const p = mustFind(s.providers, (x) => x.id === providerId, 'prestataire');
    const adapter = checkSettings(s, p.purpose, input);
    const before = { name: p.name, adapter: p.adapter, audiences: p.audiences, minAmount: p.minAmount, maxAmount: p.maxAmount };
    Object.assign(p, {
      name: input.name,
      adapter: adapter.id,
      kind: adapter.kinds.includes(p.kind) ? p.kind : adapter.kinds[0]!,
      mode: adapter.mode,
      configured: adapter.configured(),
      audiences: input.audiences,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      instructions: input.instructions,
    });
    // A provider without credentials cannot stay offered.
    if (!p.configured) p.enabled = false;
    appendAudit(s, ctx.clock.iso(), { actor: actorOf(admin), action: before.adapter !== adapter.id ? 'provider.adapter_changed' : 'provider.updated', entityType: 'provider', entityId: p.id, cityId: p.cityId, reason: input.reason, summary: before.adapter !== adapter.id ? `${p.name} · prestataire remplacé par ${adapter.name}` : `${p.name} · réglages mis à jour`, before, after: { name: p.name, adapter: p.adapter, audiences: p.audiences, minAmount: p.minAmount, maxAmount: p.maxAmount } });
    return p;
  });
}

export function toggleProvider(ctx: Ctx, admin: AdminUser, providerId: string, input: ProviderToggleInput) {
  requirePermission(admin, 'config.edit');
  return ctx.store.tx((s) => {
    const p = mustFind(s.providers, (x) => x.id === providerId, 'prestataire');
    if (input.enabled && !p.configured) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE', 'Ce prestataire n’a pas d’identifiants configurés.');
    p.enabled = input.enabled;
    appendAudit(s, ctx.clock.iso(), { actor: actorOf(admin), action: input.enabled ? 'provider.enabled' : 'provider.disabled', entityType: 'provider', entityId: p.id, cityId: p.cityId, reason: input.reason, summary: `${p.name} ${input.enabled ? 'activé' : 'désactivé'} pour ${p.purpose}` });
    return p;
  });
}
