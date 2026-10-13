---
id: ADR-0054
title: "Source of truth for the passenger's city"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0014, ADR-0006, ADR-0040, ADR-0036, PAX-05, API-12]
---

# ADR-0054 · Source of truth for the passenger's city

## Context

One of the "Smaller calls that can wait" in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#smaller-calls-with-defaults)). The audit's default is the server's `user.cityId`. It closes backlog PAX-05 ([backlog](../status/backlog.md)).

At `c38429d` the passenger's city lives in two places:

- **On the device.** A Zustand store persisted in AsyncStorage holds `cityId`, with `'rabat'` as the default. Sign-out does not clear it, so the next account on the same phone inherits it. Home, the route editor, saved places and the quote all read this value, and the quote sends it to the server.
- **On the server.** `user.cityId` drives the payment methods offered, the passenger wallet screen and the choice of a Famille driver.
- **How they drift.** The city picker updates both together. Any other path updates only one: a new account on a used phone, a change made from another device, or a reinstall. `createQuote` takes whatever city the client sends.
- **No audit.** `PATCH /me` lets a verified user change city with no audit entry (backlog API-12).

[ADR-0014](0014-client-state-ownership.md) gives server resources to TanStack Query and device preferences to Zustand. A city that changes prices, payment methods and providers is a server resource.

## Decision

**Recommended, pending Achraf’s choice: the server's `user.cityId` is the source of truth.**

1. The app reads the city from `/me` and stores no city on the device. Drop `cityId` from the persisted preferences, with a store version bump that removes it.
2. The city picker calls `PATCH /me`, then refetches `/me`.
3. Quotes are created for `user.cityId`. The server refuses a quote for another city with a clear error, instead of trusting the client.
4. Each city change writes an audit entry with before and after ([ADR-0006](0006-admin-changes-are-governed.md)).

## Consequences

- Prices, payment methods, wallet and Famille all use the same city.
- A new account on a used phone starts from its own city.
- The first screen after launch waits for `/me`, which TanStack Query already caches.
- A passenger who travels to another city must change city before booking. Revisit this when a second city opens.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| The device preference is the truth | Works before `/me` loads | Server features use a different city; inherited across accounts |
| Derive the ride's city from the pickup location | Right for travellers; no picker needed | Needs a zone lookup per quote and a rule for the home city; premature with one live city |

## Evidence

Line numbers at commit `c38429d`.

- `apps/passenger/src/lib/prefs.ts:8`, `:17` (default `'rabat'`), `:21` (persisted in AsyncStorage).
- `apps/passenger/src/app/(app)/(tabs)/account.tsx:21-27` (sign-out does not clear the preferences).
- Device city read at `apps/passenger/src/app/(app)/(tabs)/index.tsx:32`, `apps/passenger/src/app/(app)/route.tsx:24`, `apps/passenger/src/app/(app)/places.tsx:23`, `apps/passenger/src/app/(app)/quote.tsx:52`, `:60`.
- `apps/passenger/src/app/(app)/(tabs)/index.tsx:49-53` (picker updates server and device).
- Server city used at `services/demo-api/src/app.ts:362` (payment providers), `apps/passenger/src/app/(app)/wallet.tsx:4`, `services/demo-api/src/services/prototype.ts:307` (Famille driver).
- `services/demo-api/src/services/rides.ts:70-72` (`createQuote` uses the city it is given); `services/demo-api/src/app.ts:257-271` (`PATCH /me`, no audit).
- Enforced by: nothing.

## Revisit when

- A second city goes live, or
- passengers start booking outside their home city.
