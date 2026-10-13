---
id: ADR-0029
title: "Demo store is versioned (schemaVersion 1) and a mismatch reseeds from fixtures, with no migrations"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0011, ADR-0012, ADR-0039, API-21]
---

# ADR-0029 · Demo store is versioned (schemaVersion 1) and a mismatch reseeds from fixtures, with no migrations

## Context

The handoff asks for persistent, deterministic fixtures with reset and seed commands (handoff prompt:111). The demo state is one JSON document ([ADR-0011](0011-demo-backend-architecture.md)) whose shape changes as features are added. Since `74a1c14` the same store also lives on testers' phones in standalone builds ([ADR-0012](0012-native-demo-builds-run-the-demo-api.md)).

## Decision

Stamp the state with `schemaVersion: 1`. On load, if the file is missing or its `schemaVersion` is not 1, discard it and write a fresh seed from the fixtures. Write no migrations. Seed and reset are explicit commands (`pnpm demo:seed`, `pnpm demo:reset`, and `/dev/reset` from the scenario launcher). Optional sub-states added later may be created lazily on first access instead of bumping the version: the Oct 6 `prototype` state is created by `ensurePrototype` with default catalogs when absent.

## Consequences

- Changing the shape is cheap during development: bump the version and every store reseeds.
- Bumping `schemaVersion` silently wipes every tester's on-device data on the next launch: accounts created on the phone, rides, wallet balances, pending transfers. Nothing warns the tester.
- Lazy defaults only fill a missing sub-state: once `prototype` exists, later changes to the default catalog never reach it (backlog [API-21](../status/backlog.md)).
- This is acceptable only because all data is fictional demo data. It must not carry over to a store with real users.

## Alternatives considered

Not recorded at the time. Versioned migrations were the alternative; they were not needed while every store could be reseeded.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added the version check.
- `services/demo-api/src/store.ts:22-30` (`Store.load`: version 1 is kept, anything else reseeds).
- `services/demo-api/src/state.ts:88` and `services/demo-api/src/seed.ts:65` (`schemaVersion: 1`).
- `services/demo-api/src/main.ts:23` (server store `db.json`); `services/demo-api/src/embedded.ts:17` (on-device store `demo-v1.json`).
- `services/demo-api/src/cli.ts:16-18` (seed and reset); `services/demo-api/src/app.ts:897` (`/dev/reset`); `package.json:11-12`.
- `services/demo-api/src/services/prototype.ts:95-105` (`ensurePrototype` lazy default).
- Enforced by: no test covers a version mismatch.

## Revisit when

- Before any change to a persisted shape that would need a version bump while testers hold builds: either write a migration or tell testers their data will reset, or
- Naya stores real user data ([ADR-0045](0045-production-backend-and-live-integrations.md)): use real migrations, or
- the prototype module is restructured ([ADR-0039](0039-future-of-the-prototype-module.md)), which will likely change the shape.
