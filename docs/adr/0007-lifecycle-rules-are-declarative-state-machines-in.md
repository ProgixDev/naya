---
id: ADR-0007
title: "Lifecycle rules are declarative state machines in @naya/domain"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0008, ADR-0035, ADR-0036, ADR-0039, ADR-0042, DOM-04, DOM-05, DOM-17]
---

# ADR-0007 · Lifecycle rules are declarative state machines in @naya/domain

## Context

The handoff asks for typed domain state machines or reducers with allowed transitions, guards and events for offers, rides, verification and transfers; authoritative state stays on the server and the UI derives from it, without conflicting booleans (handoff prompt:102). A driver cancellation must leave the passenger a recovery path (prompt:172).

## Decision

Describe each lifecycle as a transition table built with `makeMachine` in `packages/domain/src/machines/`: ride, offer, verification, transfer (recharge and withdrawal) and scheduled booking. Every status change on the server goes through `machine.next(state, event)`, which throws `INVALID_TRANSITION` for anything not in the table. The server is the only authority. Clients render the status the API returns and use domain helpers only to read it (`isRideActive`, deadlines); they never advance a status locally. A driver cancellation (`DRIVER_CANCEL`) returns the ride to `searching`, records the driver in `driverCancellations` and excludes her from the next dispatch.

## Consequences

- Illegal transitions fail in one place, with one error code, in every surface.
- One bypass exists at c38429d: when an offer is accepted, the other pending offers for that ride are set to `withdrawn` directly (`services/demo-api/src/services/rides.ts:378-381`). Payments and support tickets have no machine.
- Adding a state means editing a table and its tests, not scattered booleans.
- `in_progress` can only reach `completed`: there is no abort for SOS, an accident or an admin (backlog [DOM-05](../status/backlog.md)). `SYSTEM_CANCEL` is defined but nothing sends it. A passenger no-show is handled as a driver cancellation (DOM-04). [ADR-0042](0042-ride-exception-paths.md) decides these paths.
- The Oct 6 features do not follow this rule: family trips advance through a `FAMILY_NEXT` map and SOS alerts have no machine (backlog DOM-17; [ADR-0035](0035-sos-production-model.md), [ADR-0036](0036-naya-famille-operating-model.md), [ADR-0039](0039-future-of-the-prototype-module.md)).

## Alternatives considered

Not recorded at the time. The handoff asked to avoid conflicting booleans (prompt:102).

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added `packages/domain/src/machines/`.
- `packages/domain/src/machines/machine.ts:3-24` (`makeMachine`, `INVALID_TRANSITION`).
- `packages/domain/src/machines/ride.ts:15-27` (ride table; driver cancellation back to `searching`), `offer.ts:7-13`, `verification.ts:7-14`, `transfer.ts:7`, `scheduled.ts:8`.
- `services/demo-api/src/services/rides.ts:655-674` (driver cancel, re-dispatch), `:252-256` (dispatch skips drivers who cancelled).
- `packages/domain/src/prototype.ts:168-175` (`FAMILY_NEXT`, outside the machines).
- Enforced by: `packages/domain/test/machines.test.ts:17-90` (happy path, recovery, illegal transitions, offers, verification, transfers, scheduling); `services/demo-api/test/scenarios.test.ts:298` (S09); `e2e/tests/driver-flows.spec.ts:98` and `e2e/tests/passenger-flows.spec.ts:193` (S09 in the apps).

## Revisit when

- [ADR-0042](0042-ride-exception-paths.md) adds abort or no-show paths, or
- family trips or SOS alerts become first-class domain modules ([ADR-0039](0039-future-of-the-prototype-module.md)): give each a machine here.
