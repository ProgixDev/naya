---
id: ADR-0039
title: "Future of the \"prototype\" module"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0006, ADR-0007, ADR-0011, ADR-0029, ADR-0033, ADR-0035, ADR-0036, ADR-0040, ADR-0043, ADR-0044, ADR-0045, P18, PRD-36, DOC-16, UI-18, ADM-11, API-09, API-21, DOC-08]
---

# ADR-0039 · Future of the "prototype" module

## Context

A sub-question of **D10** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d10-production-path)): should the prototype layer become proper domain modules before the backend port? It supports P18 ([backlog](../status/backlog.md)). It is also the structural cause behind P1, P7, P8 and P16.

Commit `89aae18` (6 October) added service categories, the passenger wallet, Naya Famille, SOS, dispute reasons and per-driver categories as one side module named "prototype":

- One optional `prototype` object in the store, created on first use.
- One server file of 1,027 lines, one shared UI file of 800 lines and one admin page of 529 lines (line counts at `c38429d`).
- Routes under `/prototype` and `/admin/prototype`, and client calls under `api.prototype` and `api.adminPrototype`.
- Inline zod schemas in the server file instead of shared schemas in `@naya/domain`. No state machine except a linear status map for Famille.
- Admin writes skip the reason, version check and before/after record that city rules use.
- `docs/FINANCE.md` covers none of these money flows (backlog DOC-08).

These features are no longer prototypes: they appear in every build, and the founder brief of 13 Oct ([tasks 4 and 5](../tasks/2026-10-13.md)) extends Famille and proposes a car wash service.

## Decision

**Recommended, pending Achraf’s choice: promote the module before the backend port.**

1. Split it into domain modules:
   - `catalog`: categories and plans;
   - `passenger-wallet`, if it survives [ADR-0040](0040-passenger-wallet-model.md);
   - `family`;
   - `safety`: SOS;
   - `disputes`.
2. Each module gets shared schemas and a state machine in `packages/domain` ([ADR-0007](0007-lifecycle-rules-are-declarative-state-machines-in.md)), a service file in `services/demo-api/src/services/`, typed client calls, and routes without "prototype" (`/catalog`, `/family`, `/safety`, `/admin/...`).
3. Admin configuration writes follow the governed pattern of [ADR-0006](0006-admin-changes-are-governed.md).
4. Bump the store to `schemaVersion: 2` with a migration from version 1, so TestFlight data survives. On acceptance, this ADR supersedes the no-migration rule of [ADR-0029](0029-demo-store-is-versioned-schemaversion-1-and.md).
5. Move one module at a time, in the order its decision lands: safety ([ADR-0035](0035-sos-production-model.md)), catalog ([ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md), [ADR-0043](0043-category-vehicle-eligibility-and-scooter-scope.md)), family ([ADR-0036](0036-naya-famille-operating-model.md)), then wallet.
6. Any new service, such as a car wash if it is confirmed, starts as its own domain module and never inside a catch-all module.

## Consequences

- The backend port ([ADR-0045](0045-production-backend-and-live-integrations.md)) carries one model, not a core plus a side layer.
- The first migration replaces the reseed-on-mismatch rule for this change. The ADR-0029 revisit trigger fires.
- Route renames break no shipped build: standalone builds embed their own server, and connected clients ship from the same commit as the API. Old routes need aliases only if a shared demo API is hosted by then ([ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)).
- The work is large. Each module moves behind its own tests: API scenarios and an e2e spec per module (backlog QA-05).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Keep the module and port it as is | No refactor now | The production backend inherits two models and the skipped conventions |
| Rename routes only | Cheap; removes the misleading name | Nothing structural changes |
| Restructure during the backend port | One big change | Mixes two risky changes; harder to review and test |

## Evidence

Line numbers at commit `c38429d`.

- Commit `89aae18` (2026-10-06) "Implement mobile feedback demo across passenger, driver and admin".
- `services/demo-api/src/state.ts:87` (optional `prototype` state); `services/demo-api/src/services/prototype.ts:95-105` (`ensurePrototype` creates it on first use), `:25-92` (inline schemas).
- `packages/api/src/client.ts:446-467` (`prototype` and `adminPrototype` namespaces).
- `packages/domain/src/prototype.ts:168-175` (`FAMILY_NEXT`, the only lifecycle rule).
- `services/demo-api/src/services/prototype.ts:890-924` vs `services/demo-api/src/services/cities.ts:78-106` (ungoverned vs governed configuration writes).
- `services/demo-api/src/store.ts:22-29` (mismatch reseeds; `schemaVersion === 1` only).
- Enforced by: `services/demo-api/test/prototype.test.ts` covers part of the module; several routes have no test (audit section 7.1).

## Revisit when

- The backend port is scheduled (this must be done first), or
- a new service is confirmed (it starts as its own module).
