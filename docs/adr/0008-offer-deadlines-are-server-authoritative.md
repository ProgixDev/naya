---
id: ADR-0008
title: "Offer deadlines are server-authoritative"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0007, ADR-0009, ADR-0011, DRV-05, DRV-06, DRV-20]
---

# ADR-0008 · Offer deadlines are server-authoritative

## Context

The handoff says an offer expires after 30 seconds, with an authoritative `expiresAt`; remaining time is computed against that deadline and resynchronised on foreground; the server rejects late acceptance; accept, refuse, expiry, withdrawal and assignment races are handled atomically; nothing ever auto-accepts; and the countdown must not reset on navigation or backgrounding (handoff prompt:168). The Figma file drew the countdown frame by frame, and the handoff asks for a real timer instead of duplicate routes (prompt:23).

## Decision

The server stamps each offer with `expiresAt = now + city.rules.offerTimeoutSeconds` (10–120 s, default 30). Clients compute the remaining time from `expiresAt` and a server clock corrected from the `X-Server-Time` header on every response; the countdown is derived on each render, so it cannot reset. Acceptance is decided on the server: an expired offer is first committed as expired (and the ride re-dispatched), then the accept is refused with `OFFER_EXPIRED`. A second acceptance is refused with a 409: `OFFER_NOT_PENDING` when the same offer was already answered, `RIDE_ALREADY_ASSIGNED` when the ride is no longer searching. Pending offers expire on the timer tick even if no client asks. The apps never accept on the driver's behalf.

## Consequences

- A wrong phone clock or a backgrounded app cannot extend or shorten the offer window.
- Racing accept requests are serialised by the single-writer store ([ADR-0011](0011-demo-backend-architecture.md)); a production database needs row locks to keep this.
- The timeout is per city, but the driver app still hard-codes "30 secondes" in its copy (backlog [DRV-05](../status/backlog.md)). Offer-screen edge cases remain (DRV-06, DRV-20).

## Alternatives considered

Not recorded at the time. The handoff excluded a client-side timer reset and auto-accept (prompt:168). A fixed 30 s versus a per-city value is listed as a small open call in the audit (section 9, "Offer timeout").

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30).
- `services/demo-api/src/services/rides.ts:276` (`expiresAt`), `:349-384` (`acceptOffer`: commit expiry first, then refuse; assignment race), `:404-413` (`expireOffer` re-dispatches), `:810-815` (timer expiry).
- `packages/domain/src/machines/offer.ts:15-27` (remaining time, `assertOfferAcceptable`); `packages/domain/src/cities.ts:14` (30 s default); `packages/domain/src/schemas.ts:162` (10–120 s).
- `services/demo-api/src/app.ts:205` (`X-Server-Time` on every response); `packages/api/src/client.ts:275-291` (`serverClock`), `:316` (skew observed); `packages/api/src/react.ts:16-31` (`useDeadline`).
- Enforced by: `services/demo-api/test/scenarios.test.ts:350` (S11, 30 s deadline, late acceptance refused, no auto-accept), `:378` (withdrawn), `:390` (assignment race); `packages/domain/test/machines.test.ts:38-48`; `packages/ui/src/__tests__/components.test.tsx:122` and `:134` (deadline never resets; server clock used); `e2e/tests/driver-flows.spec.ts:76` (expiry after 30 s is never auto-accepted).

## Revisit when

- The demo store is replaced by a database ([ADR-0045](0045-production-backend-and-live-integrations.md)): acceptance needs a row lock or a conditional update, or
- remote push delivers offers to a closed app: the push must carry `expiresAt`, never a duration.
