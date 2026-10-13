---
id: ADR-0030
title: "Location policy"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0013, ADR-0022, P4, DRV-01, DRV-02, DRV-03, DRV-16, PAX-03]
---

# ADR-0030 · Location policy

## Context

The handoff asks to request permissions in context, support a manual pickup when GPS is denied (handoff prompt:174), and implement driver tracking "only for justified operational states" with real permission and lifecycle handling (prompt:178). Passenger location is sensitive in a women-only safety product; app stores also review background location requests closely.

## Decision

- **Passenger:** foreground location only. Ask only after she taps to use her position and has seen an explainer sheet; a refusal is a normal path where she places the pickup on the map. The app never requests background location, and its permission text says so.
- **Driver:** foreground location when going online. Background location only while a ride is accepted (approach and trip), through one `TaskManager` task that posts positions to the API, shows the system indicator and the Android foreground-service notification, and is stopped when the ride ends. If "Always" is refused, positions are shared only while the app is open, and the driver is told so. Standalone demo builds never start background tracking.

## Consequences

- No location is collected from passengers in the background, and none from drivers outside an accepted ride.
- At `c38429d` the driver's background task is started and stopped by the ride screen, not by the ride's server state, so tracking can stop when the driver leaves that screen, or keep running after the ride ends while the app is killed or backgrounded (backlog [P4, DRV-01, DRV-02, DRV-03](../status/backlog.md)). "Always" is requested at ride start with no prominent disclosure first (DRV-16).
- The passenger SOS sends the driver's or pickup position rather than her own (PAX-03).

## Alternatives considered

Not recorded at the time. Continuous background tracking for online drivers was excluded by the handoff's "justified operational states" rule (prompt:178).

## Evidence

Line numbers at commit `c38429d`.

- Commits: `f0f8d46` (2026-09-30) passenger location; `d49d127` (2026-09-30) driver background task; `74a1c14` (2026-10-01) disabled it in standalone builds.
- `apps/passenger/src/features/location/useLocation.ts:7-31` (foreground only, denial is normal); `apps/passenger/src/features/location/LocationExplainer.tsx:6-25` (explainer and manual choice); `apps/passenger/app.config.ts:44` (permission strings, no background use).
- `apps/driver/src/lib/location.ts:8-30` (foreground, asked when going online); `apps/driver/src/lib/backgroundLocation.ts:7-32` (task), `:36-57` (start, foreground-only fallback, indicator and notification), `:59-66` (stop); `apps/driver/src/app/(app)/ride.tsx:43-56` (started and stopped by the ride screen); `apps/driver/app.config.ts:45-50`.
- Enforced by: `services/demo-api/test/scenarios.test.ts:259` (S07, manual pin inside the zone); `e2e/tests/passenger-flows.spec.ts:144` (S07 in the app). No automated test covers background tracking.

## Revisit when

- The fix for P4 lands: tie the task to the server's active ride and update the evidence here. Branch
  `chore/docs-foundation-and-fixes` does this (`useRideTracking` in `apps/driver/src/app/(app)/_layout.tsx`, a stop at
  sign-out in `apps/driver/src/lib/session.ts`, a self-stop in the task, and a server refusal for offline drivers with no
  ride); the decision is unchanged. Update the evidence once it is merged, or
- Naya Famille needs live per-second driver GPS for parents ([docs/tasks/2026-10-13.md](../tasks/2026-10-13.md), task 4), or
- an SOS must share the passenger's own live position ([ADR-0035](0035-sos-production-model.md)).
