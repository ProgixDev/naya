---
id: ADR-0015
title: "Route-group gating with Expo Router Stack.Protected and a loading cover"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0014, ADR-0017, ADR-0019, ADR-0055]
---

# ADR-0015 · Route-group gating with Expo Router Stack.Protected and a loading cover

## Context

The handoff asks for Expo Router with typed routes and protected route groups (handoff prompt:37), client route guards on top of server authorisation (prompt:109), and session restoration (prompt:176). Passenger identity review is a prerequisite to booking; driver identity and vehicle approvals are prerequisites to receiving offers, and submission is not approval (prompt:164). Deep links such as `/trips` or `/wallet` must still land on their screen after a cold start.

## Decision

Gate each app at its root layout with `Stack.Protected` route groups:

- Passenger: `(auth)` when signed out; `(verify)` when signed in and the identity case is not approved; `(app)` when approved.
- Driver: `(auth)` when signed out; `(onboard)` until both the person and the vehicle dossiers are submitted; `(app)` once both are submitted; `docs` for any signed-in driver. Approval does not gate the app: it gates going online and receiving offers, which the server enforces.

While the signed-in account is loading, keep the navigator mounted and show an opaque cover with a spinner (or an error with retry), so a deep link is not lost to a premature redirect. These guards are cosmetic: every server operation is authorised on its own.

## Consequences

- A cold deep link opens the right screen once the account is known; an unverified passenger is sent to her verification status.
- A driver whose dossier is under review can use the app, see her documents and status, but cannot go online (`NOT_ELIGIBLE`).
- Guard logic lives in two root layouts; a new gate (for example account suspension) must be added to both and to the server.

## Alternatives considered

Not recorded at the time. The first version (`177cbd6`) unmounted the navigator and showed a blank view while the account loaded, which lost cold deep links. `5e907b4` (2026-10-01) kept the navigator mounted behind a cover; its commit message records the reason.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `177cbd6` (2026-09-30) passenger `Stack.Protected` groups; `d49d127` (2026-09-30) driver groups; `5e907b4` (2026-10-01) loading cover; `0e0b066` (2026-10-01) added the spinner to it.
- `apps/passenger/src/app/_layout.tsx:11-43` (guards at `:25-33`, cover at `:18-21` and `:36-40`).
- `apps/driver/src/app/_layout.tsx:12-47` (submission gate at `:21-22`, guards at `:26-37`, cover at `:40-44`).
- `services/demo-api/src/services/rides.ts:215-231` and `:299-305` (server refuses going online without both approvals).
- Enforced by: `e2e/tests/deeplinks-passenger.spec.ts:7` "verified passenger: /trips opens directly", `:14` "unverified passenger: /trips redirects to the verification status"; `e2e/tests/deeplinks-driver.spec.ts:5` "/wallet opens the wallet on a cold load (repeated)"; `services/demo-api/test/scenarios.test.ts:322` (S10, cannot go online until the vehicle is approved).

## Revisit when

- Account suspension or deletion is added ([ADR-0055](0055-account-lifecycle.md)): it needs its own gate, or
- Expo Router changes the `Stack.Protected` API in an SDK upgrade.
