---
id: ADR-0037
title: "Admin permission model for the new features"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0006, ADR-0017, ADR-0029, ADR-0033, ADR-0035, ADR-0036, ADR-0040, ADR-0043, P2, P12, ADM-03, ADM-12, ADM-17, API-04, API-10, DOM-11, PRD-27, PRD-29, PRD-38, docs/architecture/permissions.md]
---

# ADR-0037 · Admin permission model for the new features

## Context

This ADR collects the permission parts of **D2** (who answers SOS), **D3** (who may see child data) and the "Admin data access" defaults in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#smaller-calls-with-defaults)). P2 (give support a `safety.respond` permission) needs no decision and can land before this ADR is accepted ([backlog](../status/backlog.md)).

- The admin has 8 permission strings, enforced on the server ([ADR-0017](0017-the-admin-is-a-separate-vite-spa.md)).
- Every admin action added on 6 October checks `config.edit`: the Services overview, catalog edits, SOS status changes, Famille driver assignment and driver categories. The Services page is gated the same way.
- The seeded support agent holds `support.resolve`, `rides.read` and `people.read`, so she gets 403 on SOS.
- Any admin with `config.edit` or `support.resolve` can read a child's arrival photo.
- Money leaks to roles without `finance.read`. `/admin/overview` checks only that an admin is signed in, and returns volume and commission. `/admin/people` needs only `people.read`, which support holds, and returns every driver's wallet. `/admin/cities` and `/admin/providers` check no permission.
- Passenger wallet balances (customer funds) appear only under Services, not in Finance.
- No admin is scoped to a city.

## Decision

**Recommended, pending Achraf’s choice.** Give each new area its own permission. Map every admin endpoint to exactly one permission, and test the whole matrix in CI.

| Permission | Grants | Seeded holders |
|---|---|---|
| `safety.respond` (new) | SOS queue: read, take charge, resolve with a note | support agent, administrator |
| `catalog.edit` (new) | Service categories, plans, dispute reasons, payment options and category pricing (governed as in [ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md)) | administrator |
| `family.ops` (new) | Child profiles, family trips, pickup and drop-off proofs, dedicated-driver assignment | administrator; a named family-operations agent |
| `verification.decide` (existing) | Also covers category eligibility overrides ([ADR-0043](0043-category-vehicle-eligibility-and-scooter-scope.md)) | as today |
| `finance.read` (existing) | Also covers Overview money KPIs, driver balances on People, and passenger wallet balances | as today |
| `config.edit` (existing) | Cities, rules, zones and providers only | as today |

Every read of an identity document or a child proof writes an audit entry. Do not add city scoping until a second city opens.

## Consequences

- Support can act on SOS without being able to change prices or read child data.
- Child photos reach only the parent and `family.ops` holders.
- The admin menu shows each area under its own permission. Locked items stay visible, as [ADR-0017](0017-the-admin-is-a-separate-vite-spa.md) requires.
- The seed and [architecture/permissions.md](../architecture/permissions.md) must list the matrix. A CI test fails when an endpoint has no permission check.
- Existing admin accounts need the new permissions. The demo store reseeds or migrates ([ADR-0029](0029-demo-store-is-versioned-schemaversion-1-and.md)).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Keep `config.edit` for everything | No work | Support cannot see SOS (P2); whoever edits prices can read child photos |
| Roles with per-city scopes now | Ready for many cities and teams | Premature for one city and two admin accounts |
| Named roles instead of permission strings | Easier to explain | The server already checks permission strings; roles can be presets in the seed |

## Evidence

Line numbers at commit `c38429d`.

- `packages/domain/src/entities.ts:53-61` (the 8 permissions).
- `services/demo-api/src/services/prototype.ts:877-878` (Services overview), `:890-892` (catalog), `:926-928` (SOS), `:949-951` (Famille assignment), `:999-1001` (driver categories): all `config.edit`.
- `apps/admin/src/router.tsx:75` (Services page gate); `services/demo-api/src/seed.ts:301` (support agent permissions).
- `services/demo-api/src/services/uploads.ts:60-64` (arrival photos readable with `config.edit` or `support.resolve`).
- `services/demo-api/src/app.ts:647-656` (Overview money, no permission), `:676-688` (People: `people.read`, driver wallets at `:688`), `:859-863` and `:872-876` (cities and providers, no permission), `:816-837` (Finance has no passenger wallets).
- Enforced by: no authorization-matrix test exists.

## Revisit when

- A second city opens (add city scoping), or
- the staff grows beyond the two seeded roles, or
- a security partner or contractor needs scoped access.
