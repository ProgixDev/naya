---
id: ADR-0011
title: "Demo backend architecture"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0008, ADR-0012, ADR-0029, ADR-0045, API-20, DOM-10]
---

# ADR-0011 · Demo backend architecture

## Context

The handoff asks for a shared local demo API with persistent, deterministic fixtures, so passenger, driver and admin observe the same records across sessions, with seed and reset commands (handoff prompt:111). Demo and production adapters must use the same typed contracts (prompt:113). The backend owns permissions, assignment, payment confirmation, wallet movements and identity decisions (prompt:109).

## Decision

Run the whole backend as one Hono app (`services/demo-api`), backed by one JSON state file with a single writer. Every mutation runs in `store.tx`: it snapshots the state, applies the change, persists atomically (temp file and rename), and restores the snapshot if anything throws. Node handles requests one at a time, so each transaction is atomic against concurrent requests. Time-based rules (offer expiry, search timeout, scheduled dispatch, simulated provider outcomes, bot drivers) run in a `tick` every 500 ms against an injectable `Clock`, so tests and the dev launcher can move time. The contract is the shared Zod schemas in `@naya/domain` (core routes parse request bodies with them through `body()`; the Oct 6 prototype routes declare inline Zod schemas instead) plus the typed client in `@naya/api`; there is no OpenAPI file and no URL versioning.

## Consequences

- Behaviour is deterministic and testable with a manual clock; timers survive restarts because they are evaluated against stored deadlines.
- Races such as two drivers accepting one ride are safe only because of the single writer; this does not carry over to a multi-process server.
- Every transaction deep-clones and rewrites the whole state (backlog [API-20](../status/backlog.md)); fine for a demo, not for production volume.
- Response types live only in the client and are never checked against the server (backlog DOM-10).
- The same app also runs embedded in the native apps ([ADR-0012](0012-native-demo-builds-run-the-demo-api.md)).

## Alternatives considered

Not recorded at the time. `docs/INTEGRATIONS.md:21` (at `c38429d`; now [docs/status/integrations.md](../status/integrations.md)) names the intended production replacement: managed Postgres behind the same `packages/api` contracts.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30).
- `services/demo-api/src/store.ts:5-44` (single writer, snapshot and rollback), `:61-67` (atomic write).
- `services/demo-api/src/services/timers.ts:6-12` (`tick`); `services/demo-api/src/main.ts:37-43` (500 ms interval); `services/demo-api/src/clock.ts:1-32` (offset and manual clocks).
- `services/demo-api/src/app.ts:97-105` (`body()` parses with a Zod schema); `services/demo-api/src/services/prototype.ts:496-498` (an inline schema); `packages/domain/src/schemas.ts`; `packages/api/src/client.ts:56` onwards (response contracts and typed methods).
- `services/demo-api/package.json:6-13` (dev, seed, reset, test scripts).
- Enforced by: `services/demo-api/test/scenarios.test.ts:390` "assignment race: a second acceptance of the same ride is refused", and every S01–S16 scenario, which runs the real app with a `ManualClock` (`services/demo-api/test/harness.ts`).

## Revisit when

- Before any production traffic ([ADR-0045](0045-production-backend-and-live-integrations.md)): replace the JSON store with a database, use row locks or conditional updates for offer acceptance, and keep the Hono routes and `packages/api` contract if possible, or
- a second client outside this monorepo needs the API: publish a versioned contract (OpenAPI or similar).
