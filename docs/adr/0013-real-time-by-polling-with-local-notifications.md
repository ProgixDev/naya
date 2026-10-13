---
id: ADR-0013
title: "Real-time by polling, with local notifications only"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0008, ADR-0014, ADR-0045, PAX-06, DRV-07, PRD-31]
---

# ADR-0013 · Real-time by polling, with local notifications only

## Context

The handoff asks for TanStack Query integrated with connectivity and app-focus events (handoff prompt:99), notifications with real permission and lifecycle handling (prompt:178), and reconnection to the authoritative trip state after a restart (prompt:178). It does not require websockets or remote push. Remote push needs an EAS project, APNs and FCM credentials and a server sender, none of which exist (`docs/INTEGRATIONS.md:18`).

## Decision

Keep clients current by polling the REST API with TanStack Query: fast while something time-sensitive can happen, slow otherwise (passenger active ride 2 s, else 15 s; driver status 1,5 s while online or on a ride, else 5 s; driver wallet 4 s; live ride detail 2,5 s). Refetch on app focus and reconnect; pause while the app is in the background or offline. Use only local notifications scheduled by the app while it runs (new offer, driver arrived). No websockets, server-sent events or remote push.

## Consequences

- One transport and one cache model; no socket lifecycle to manage; the embedded standalone backend works unchanged.
- Latency is bounded by the poll interval, and polling costs battery and requests while screens are open.
- Nothing reaches a closed or backgrounded app: the "arrived" and "Nouvelle course" notifications cannot fire then, although preferences promise them (backlog [PAX-06, DRV-07, PRD-31](../status/backlog.md)). Family "notifications" are timeline entries refreshed by polling (`docs/MOBILE-FEEDBACK-DEMO.md:56`).
- Offers rely on the authoritative deadline ([ADR-0008](0008-offer-deadlines-are-server-authoritative.md)), so a late poll cannot extend a window.

## Alternatives considered

Not recorded at the time. `docs/INTEGRATIONS.md:19` names the live alternative: websocket or push-driven invalidation.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `177cbd6` (2026-09-30) added the query lifecycle; `f0f8d46` and `d49d127` (2026-09-30) added the app polling hooks.
- `packages/ui/src/core/query.ts:7-19` (focus and online managers; background pauses refetching), `:21-41` (defaults).
- `apps/passenger/src/lib/queries.ts:32-50` (2 s / 15 s, 2,5 s); `apps/driver/src/lib/queries.ts:27-49` (1,5 s / 5 s, wallet 4 s).
- `apps/driver/src/app/(app)/_layout.tsx:32` and `apps/passenger/src/app/(app)/ride.tsx:53` (local notifications).
- `docs/INTEGRATIONS.md:18-19` (removed after `c38429d`; its successor is [docs/status/integrations.md](../status/integrations.md)).
- Enforced by: no test asserts the intervals. The e2e suites depend on polling to see other roles' changes (`e2e/tests/scenarios-cross-role.spec.ts:54`).

## Revisit when

- Remote push is configured ([ADR-0045](0045-production-backend-and-live-integrations.md)): offers and arrival alerts must reach a closed app, or
- poll traffic becomes a measurable cost on the production backend, or
- a feature needs updates every second or faster (for example the live family GPS "every second" asked for in [docs/tasks/2026-10-13.md](../tasks/2026-10-13.md), task 4).
