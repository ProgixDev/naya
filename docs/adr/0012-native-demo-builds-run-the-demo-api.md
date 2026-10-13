---
id: ADR-0012
title: "Native demo builds run the demo API in-process (standalone)"
status: Accepted
date: 2026-10-01
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0011, ADR-0021, ADR-0044, docs/STANDALONE-DEMO.md, UI-04, UI-10, QA-12, PRD-24]
---

# ADR-0012 · Native demo builds run the demo API in-process (standalone)

## Context

The first TestFlight build called a demo API hosted on a Mac (`docs/STANDALONE-DEMO.md:3`); a tester's phone could use it only while that Mac was running and reachable. The handoff wanted one shared demo API so passenger, driver and admin observe the same records (handoff prompt:111). A tester with one phone needs the whole flow to work without a server.

## Decision

Native demo builds (`EXPO_PUBLIC_DEMO` and `EXPO_PUBLIC_STANDALONE` not `'0'`, platform not web) run the same Hono app in-process instead of over HTTP. Each app keeps its own store in its sandbox, ships fictional fixture documents, and simulates the other party: a bot driver serves passenger trips, the driver app receives generated offers, and a newly submitted dossier gets a simulated approval. Requests are serialised through one queue so transactions and idempotency behave as on the server. Platform differences (file system, crypto, fixtures) are handled by Metro `.native.ts` adapters. Web builds always use the shared HTTP API. Setting `EXPO_PUBLIC_STANDALONE=0` returns a native build to connected mode.

## Consequences

- A TestFlight tester can sign in and complete rides, payments and wallet flows on one phone with no network service.
- The two phones and the admin do not share state in standalone mode, so cross-role loops (SOS reaching the admin, family trip progress) cannot be shown there (backlog [PRD-24](../status/backlog.md)); use connected mode for those demos.
- The simulated approval in standalone mode is a demo shortcut, labelled as such, not a review ([ADR-0019](0019-verification-is-a-manual-human-review-with.md)).
- The embedded backend, its fixtures and seed credentials are bundled into every native build, production included, and the demo flags default to on when unset (backlog UI-04, UI-10, QA-12). [ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md) decides the gating.

## Alternatives considered

A hosted shared demo API, as in the first TestFlight build (`docs/STANDALONE-DEMO.md:3`): it depends on a server being up and reachable. Connected mode remains available for development and cross-role demos (`README.md:83`).

## Evidence

Line numbers at commit `c38429d`.

- Commit: `74a1c14` (2026-10-01) "Make mobile demo builds run entirely on device".
- `packages/ui/src/core/apiBase.ts:4-5` (flags, web excluded), `:13-21` (in-process base URL); `packages/ui/src/core/localDemo.native.ts:7-19` and `packages/ui/src/core/localDemo.ts:3-4` (native transport vs web).
- `services/demo-api/src/embedded.ts:14-23` (same app, embedded config), `:27-62` (bot driver, simulated review, generated offers), `:64-74` (serialised queue).
- `services/demo-api/src/platform.native.ts`, `services/demo-api/src/fixtures.native.ts` (Metro adapters).
- `apps/passenger/eas.json:28-29` and `:44-45` (standalone profiles), `:37` (production sets `EXPO_PUBLIC_DEMO=0`).
- `docs/STANDALONE-DEMO.md`; `README.md:81-83`, `:116-120`.
- Enforced by: `services/demo-api/test/embedded.test.ts:31` "standalone demo with all network calls blocked" (sign-in and restart, local trip with a simulated driver, generated offer, pending withdrawal across restart, scheduled booking).

## Revisit when

- A shared hosted demo API exists for cross-role demos (audit decision D9), or
- [ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md) separates demo and production bundles, or
- the persisted state shape changes ([ADR-0029](0029-demo-store-is-versioned-schemaversion-1-and.md)): testers' on-device data would be reset.
