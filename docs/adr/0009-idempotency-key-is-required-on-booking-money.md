---
id: ADR-0009
title: "Idempotency-Key is required on booking, money, SOS and family mutations"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0004, ADR-0010, ADR-0053, UI-03, UI-17, ADM-14, API-07]
---

# ADR-0009 · Idempotency-Key is required on booking, money, SOS and family mutations

## Context

The handoff requires server-side idempotency and duplicate-event handling (handoff prompt:200), and "one clear request in flight" per destructive or financial action, safe against double taps, repeated callbacks and reconnects (prompt:212). Mobile networks in a car drop requests mid-flight; a blind retry must not book twice or move money twice.

## Decision

Every mutation that books a ride, moves money, raises an SOS or creates a family subscription or trip must send an `Idempotency-Key` header. The server stores each key per subject (the calling user) with the route and a hash of the body: the same key with the same body replays the stored response; the same key with a different body or route is refused with `IDEMPOTENCY_CONFLICT`. On the client, these actions go through `useSingleFlight`, which allows one request in flight per intent (a synchronous ref, not render state) and keeps one key for the intent. React Query never retries a mutation automatically; only a new tap re-sends it.

## Consequences

- A double tap, a timeout followed by a retry, or a reconnect replays the first result instead of creating a second booking, recharge or withdrawal.
- Covered routes at `c38429d`: ride booking, ride retry-payment, scheduled booking, recharge, withdrawal (required); ride cancel and offer accept (optional key); finance corrections (own key handling); passenger wallet top-up, family subscription, family trip and SOS in the prototype module.
- `reset()` rotates the key and several screens call it on every error, so a retry after a timeout can create a duplicate (backlog [UI-03](../status/backlog.md)); prototype actions build a fresh key per call (UI-17); correction keys are global and keep the old entry when the body changes (ADM-14, API-07). [ADR-0053](0053-idempotency-key-lifecycle.md) decides the key lifecycle.
- The idempotency cache keeps the last 2 000 records with full responses (backlog API-20).

## Alternatives considered

Not recorded at the time. Natural business keys alone (ride id, recharge id) do not exist before the first request succeeds, so they cannot deduplicate the creating request.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `96af8c6` (2026-09-30) added the server check; `177cbd6` (2026-09-30) added `useSingleFlight` and the no-retry mutation default; `89aae18` (2026-10-06) applied it to wallet, family and SOS routes.
- `services/demo-api/src/app.ts:121-144` (`idempotent`), `:413`, `:457`, `:464`, `:572`, `:581` (required), `:447`, `:495` (optional), `:851-857` (corrections).
- `services/demo-api/src/services/prototype.ts:459`, `:537`, `:556`, `:806` (wallet top-up, family subscription, family trip, SOS).
- `services/demo-api/src/state.ts:60-68` (record: key, subject, route, body hash, response).
- `packages/ui/src/core/useSingleFlight.ts:5-40`; `packages/ui/src/core/query.ts:33-38` (mutations never retry).
- Enforced by: `packages/ui/src/__tests__/components.test.tsx:142` "sends one request for a double tap and keeps the same idempotency key on retry"; `services/demo-api/test/scenarios.test.ts:494` (idempotent replay of withdrawals); `services/demo-api/test/embedded.test.ts:113` (no double debit after restart).

## Revisit when

- [ADR-0053](0053-idempotency-key-lifecycle.md) is decided, or
- the store moves to a database: keep the (key, subject) uniqueness in a table with a retention period instead of a capped array.
