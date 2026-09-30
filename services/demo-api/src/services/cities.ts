import {
  DomainError,
  formatBp,
  formatMoney,
  type AdminUser,
  type CityConfig,
  type CityRules,
  type CityStatusInput,
  type CreateCityInput,
  type ProviderToggleInput,
  type UpdateRulesInput,
  type ZoneInput,
} from '@naya/domain';
import type { Ctx } from '../context';
import { mustFind, nextId } from '../store';
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
    for (const purpose of ['ride', 'recharge', 'withdrawal'] as const) {
      s.providers.push({
        id: `${city.id}-${purpose}-demo`,
        cityId: city.id,
        purpose,
        kind: purpose === 'withdrawal' ? 'bank_transfer' : 'card',
        name: purpose === 'withdrawal' ? 'Virement bancaire (démo)' : 'Carte bancaire (démo)',
        enabled: false,
        mode: 'demo',
        configured: true,
      });
    }
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
