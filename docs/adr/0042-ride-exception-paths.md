---
id: ADR-0042
title: "Ride exception paths"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0005, ADR-0006, ADR-0007, ADR-0029, ADR-0030, ADR-0035, ADR-0036, ADR-0041, P11, P5, DOM-04, DOM-05, DOM-15, ADM-18, API-14]
---

# ADR-0042 · Ride exception paths

## Context

The "settle in the same ADR" part of **D7** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d7-cash-fees-and-ride-exceptions)). It completes P11 and gives SOS (P5) a way to end a ride ([backlog](../status/backlog.md)).

The ride state machine ([ADR-0007](0007-lifecycle-rules-are-declarative-state-machines-in.md)) at `c38429d`:

- **No-show.** The driver's only option is to cancel with « Passagère injoignable ». That sends the ride back to `searching` and re-dispatches it. The passenger pays nothing and the driver earns nothing.
- **Arrival.** « Signaler mon arrivée » needs no proximity: a driver can mark herself arrived from anywhere. The arrival fee then applies at once, even inside the free window. Help promises that cancelling is free « pendant la recherche et 2 minutes après l’attribution ». The grace period is 120 s.
- **Ride in progress.** It can only be completed. SOS, an accident or an admin cannot end it.
- **Admin cancel.** `SYSTEM_CANCEL` is defined for the earlier states, but nothing triggers it. The admin cannot cancel or end a live ride.

## Decision

**Recommended, pending Achraf’s choice.** New thresholds are city rules, so they are versioned and audited.

1. **Arrival needs proximity.** « Signaler mon arrivée » is enabled only when the driver's GPS is within a city-set radius of the pickup. The proposed default is 150 m.
2. **Free window first.** The cancellation is free during `graceSeconds` after assignment, even if the driver has already arrived. The arrival fee applies only after both the window and the arrival. The copy states this rule exactly.
3. **No-show.** After arrival plus a city-set waiting time (proposed: 5 minutes), the driver may end the ride as `no_show`.
   - Add a `NO_SHOW` event from `driver_arrived` to `cancelled`, with `by: 'driver'` and reason `no_show`.
   - The passenger is charged the arrival fee, settled under [ADR-0041](0041-cash-and-fee-settlement.md).
   - The driver is credited.
   - The ride is not re-dispatched.
   - « Passagère injoignable » before arrival keeps today's re-dispatch.
4. **Ending a ride in progress.** Add `ABORT` from `in_progress` to a terminal `ended_early` state.
   - Only an admin or the safety desk may trigger it, with a reason and an audit entry ([ADR-0035](0035-sos-production-model.md)).
   - The passenger pays nothing by default.
   - Support settles the driver's side by hand with an audited correction ([ADR-0006](0006-admin-changes-are-governed.md)) until a rule exists.
5. **Admin system cancel.** Wire `SYSTEM_CANCEL` to an admin action for `searching`, `driver_assigned` and `driver_arrived`. It needs a reason, writes an audit entry and charges no fee.

## Consequences

- The domain machine, the server, both apps and the admin change together. New states need machine tests and API scenarios.
- City rules gain a radius and a waiting time. The store shape changes ([ADR-0029](0029-demo-store-is-versioned-schemaversion-1-and.md)).
- The driver app needs GPS at arrival, which ties into the location policy ([ADR-0030](0030-location-policy.md)).
- The planned `specs/rides.md` records these rules. Famille trips reuse them ([ADR-0036](0036-naya-famille-operating-model.md)).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Keep re-dispatch on no-show | Kind to a late passenger | The driver loses the trip and earns nothing; the passenger pays nothing |
| Charge the arrival fee as soon as the driver arrives (today) | Simple | Contradicts the free 2 minutes promised in help |
| Let the driver end a ride in progress herself | Fast in an emergency | Open to abuse; the safety desk should decide |

## Evidence

Line numbers at commit `c38429d`.

- `packages/domain/src/machines/ride.ts:11` (`SYSTEM_CANCEL`), `:21-22` (driver cancel returns to `searching`), `:23` (`in_progress` completes only).
- `packages/domain/src/labels.ts:58` (« Passagère injoignable »); `services/demo-api/src/services/rides.ts:655-674` (driver cancel re-dispatches).
- `apps/driver/src/app/(app)/ride.tsx:215` (« Signaler mon arrivée »); `services/demo-api/src/services/rides.ts:550-558` (`driverArrive`, no proximity check).
- `packages/domain/src/pricing.ts:69-83` (grace window applies only in `driver_assigned`; arrival fee at `:82-83`); `packages/domain/src/cities.ts:12` (`graceSeconds: 120`).
- `apps/passenger/src/features/help/topics.ts:18` (the free-window promise).
- Enforced by: no test covers no-show, abort or admin cancel; nothing outside the machine references `SYSTEM_CANCEL` (`git grep SYSTEM_CANCEL`).

## Revisit when

- A month of no-show and cancellation data exists, or
- the routing provider gives reliable pickup geofences, or
- a real incident requires ending a ride in progress.
