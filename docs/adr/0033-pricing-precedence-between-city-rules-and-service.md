---
id: ADR-0033
title: "Pricing precedence between city rules and service categories"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0003, ADR-0005, ADR-0006, ADR-0026, ADR-0029, ADR-0043, P8, P12, DOM-01, ADM-05, ADM-06, ADM-09, API-09, API-21, DOC-03, PRD-04, PRD-18, docs/FINANCE.md, docs/specs/pricing-cities-categories.md]
---

# ADR-0033 · Pricing precedence between city rules and service categories

## Context

Decision **D6** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d6-commission-precedence)). It unblocks P8 and settles what an empty fare field means in P12 ([backlog](../status/backlog.md)).

- City rules are versioned per city, need a reason and are audited ([ADR-0005](0005-server-authoritative-pricing-with-versioned-city-rules.md), [ADR-0006](0006-admin-changes-are-governed.md)). Rabat takes 15 % and Casablanca 18 %.
- Since `89aae18` a quote can carry a service category. Each category fare replaces the city fare when it is not null. The category commission always replaces the city commission when terms are frozen: `quote.service?.commissionBp ?? rules.commissionBp`.
- The passenger app always sends a category. It starts on `'standard'`, and Standard's commission is 1 500 bp. So a Casablanca Standard ride freezes 15 %, and commission edits on the admin Rules page change no app booking.
- Category fares are global. No category has per-city prices.
- Catalog writes need only `config.edit`. They take no reason and no expected version, and record no before/after. `catalog.version` is incremented but no ride records it.
- Only `null` inherits the city fare. The admin editor saves 0 MAD when a fare is cleared, so passengers are quoted 0 (backlog ADM-06, PRD-18).

## Decision

**Recommended, pending Achraf’s choice: D6 option (b), inherit unless overridden.** Resolve each price component in this order: per-city category override, then category default, then city rule. Make the category `commissionBp` nullable, where `null` means "use the city rate", and ship Standard with `null`. Fares follow the same rule: `null` inherits, and the admin editor saves an empty field as `null`, never 0. Store per-city category overrides inside the city rules, so they are covered by the existing versioning, reason, expected-version and audit flow. Govern category defaults the same way, and freeze the catalog version into the ride terms next to `ruleVersion`. Show the effective commission and fares on the admin Rules page and on the ride detail. Add an API test for a Casablanca Standard booking that freezes 1 800 bp.

## Consequences

- Casablanca Standard goes back to 18 %, and Rules page edits take effect again. Rides already booked keep their frozen terms (ADR-0005).
- Confort keeps its own 18 % default in every city unless a city overrides it.
- The category and city-rules shapes change. The demo store has no migrations: a `schemaVersion` bump reseeds and wipes TestFlight data, and without a bump an existing `prototype` state keeps its old catalog, because lazy defaults never reach it ([ADR-0029](0029-demo-store-is-versioned-schemaversion-1-and.md), backlog API-21). Write a migration, or announce the reset.
- Catalog edits gain reason, version and diff steps (backlog ADM-09, API-09). This also fixes the 0 MAD problem (P12).
- `docs/FINANCE.md` and [specs/pricing-cities-categories.md](../specs/pricing-cities-categories.md) must state the resolution order.
- Which categories exist is decided separately ([ADR-0026](0026-service-categories-including-a-premium-naya-confort.md), [ADR-0043](0043-category-vehicle-eligibility-and-scooter-scope.md)).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (a) Always the city rate; categories change only fares | One place for commission; simplest to explain | No different margin for Confort or Scooter |
| (c) Full city × category matrix | Every cell explicit | N × M values to maintain; each new city needs every category filled in, and an empty cell is easy to miss |
| Keep today's behaviour (category always wins) | No work | City commission edits do nothing; contradicts `docs/FINANCE.md:15-18` |

## Evidence

Line numbers at commit `c38429d`.

- `services/demo-api/src/services/rides.ts:79-80` (category fares override city fares field by field, `??`), `:85` (the category commission is copied into the quote), `:127` (the category commission wins at freeze).
- `packages/domain/src/cities.ts:10` (Rabat 1 500 bp), `:27` (Casablanca 1 800 bp); `docs/FINANCE.md:17-18`.
- `packages/domain/src/prototype.ts:177-222` (global catalog; Standard `commissionBp: 1500` at `:203`; Scooter and Confort fixed fares at `:181-194`, `:209-222`).
- `apps/passenger/src/app/(app)/quote.tsx:55` (`useState('standard')`), `:60` (category sent with every quote).
- `services/demo-api/src/services/prototype.ts:890-924` (catalog PUT: `config.edit`, no reason or version), `:912` (`catalog.version++`, never frozen into terms).
- `services/demo-api/src/services/cities.ts:78-106` (the governed `updateRules` pattern to reuse).
- Enforced by: no test covers commission precedence today.

## Revisit when

- A second city goes live with its own margins, or
- a category needs its own surge or time-of-day pricing, or
- the payments partner requires a commission per product.
