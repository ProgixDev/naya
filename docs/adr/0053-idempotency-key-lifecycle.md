---
id: ADR-0053
title: "Idempotency-key lifecycle"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0004, ADR-0006, ADR-0009, ADR-0039, ADR-0045, UI-03, UI-17, ADM-14, API-07]
---

# ADR-0053 · Idempotency-key lifecycle

## Context

One of the "Engineering housekeeping" calls in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#smaller-calls-with-defaults)): settle `useSingleFlight` key rotation in its own PR. It closes backlog UI-03, UI-17, ADM-14 and API-07 ([backlog](../status/backlog.md)).

[ADR-0009](0009-idempotency-key-is-required-on-booking-money.md) requires an `Idempotency-Key` on booking, money, SOS and family mutations. The server scopes each key to (key, subject) and rejects a reused key with a different body. It says nothing about when a client should create a new key. At `c38429d`:

- `useSingleFlight` keeps one key per intent, and `reset()` creates a new one.
- Four money screens call `reset()` on every error:
  - driver withdrawal;
  - driver recharge;
  - passenger cancellation;
  - payment retry.

  After a timeout where the server did commit, the retry carries a new key, so a second withdrawal, recharge or retry is created.
- Booking resets only after an expired or used quote, which is correct.
- The prototype screens build a fresh key inside every call, so any retry duplicates.
- The admin finance correction keeps one key for the life of the dialog, even when the admin changes the driver or the amount. The server bypasses the shared idempotency helper. It derives the ledger key `correction:<key>` with no body hash and no admin id, so a reused key with a different body silently returns the first entry.

## Decision

**Recommended, pending Achraf’s choice.** Every keyed mutation follows one client rule:

1. Create the key when the person starts an intent, for example when she opens the sheet or form.
2. Keep the key after a network error, a timeout or a 5xx, so a retry replays the same request.
3. Create a new key after a success, after a definitive 4xx (validation, conflict, forbidden, idempotency conflict), or when the payload changes (amount, target or method).
4. Never create a key inside the call itself.

`useSingleFlight` applies rules 2 and 3 itself from the error type. Callers stop calling `reset()` in `onError`. On the server, admin corrections go through the shared idempotency helper, scoped by admin id with a body hash. The ledger key includes the admin id.

## Consequences

- A timeout followed by a retry can no longer move money twice.
- The four screens and the prototype actions change. The prototype actions move to `useSingleFlight` ([ADR-0039](0039-future-of-the-prototype-module.md)).
- Unit tests with a fake API cover: a timeout replays the same key; a 4xx or a payload change gets a new key.
- The correction endpoint changes its key format. Earlier demo entries keep theirs ([ADR-0004](0004-driver-wallet-is-a-projection-of-an.md) keeps keys unique).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Rotate on every error (today) | Simple | Duplicates money after timeouts, the exact failure the key exists to prevent |
| Never rotate within a screen | No duplicates | After a success, a second intent on the same screen replays the first response or gets an idempotency conflict |
| Derive the key from a hash of the payload | No state to keep | Two intended identical requests, such as two equal top-ups, merge into one |

## Evidence

Line numbers at commit `c38429d`.

- `services/demo-api/src/app.ts:125-144` (server scope and body-hash check).
- `packages/ui/src/core/useSingleFlight.ts:5-12` (one key per intent), `:35-38` (`reset()` rotates).
- Reset on every error: `apps/driver/src/app/(app)/withdraw/index.tsx:33`, `apps/driver/src/app/(app)/recharge/index.tsx:37`, `apps/passenger/src/features/ride/CancelSheet.tsx:28`, `apps/passenger/src/app/(app)/receipt/[id].tsx:55`.
- Correct reset: `apps/passenger/src/app/(app)/quote.tsx:110-115`.
- `packages/ui/src/features/prototype.tsx:33` (`key()` per call), used as an idempotency key at `:72`, `:181`, `:401`, `:564` (`:466` uses it as a recipient id).
- `apps/admin/src/pages/Finance.tsx:173` (one key per dialog); `services/demo-api/src/app.ts:851-857` (correction route skips `idempotent()`); `services/demo-api/src/services/finance.ts:291-298` (ledger key `correction:<key>`).
- Enforced by: no test covers retry after a timeout.

## Implementation status (15 Oct 2026)

Status stays Proposed: the choice is Achraf's. Branch `feat/passenger-polish` implements the client rule as recommended:

- `useSingleFlight` keeps the key after a network error, a timeout or a 5xx, and makes a new one after a success, a
  definitive 4xx or a payload change, so screens that still call `reset()` in `onError` keep their key across a retry.
  Tested in `packages/ui/src/__tests__/useSingleFlight.test.tsx`.
- The Oct 6 screens (`packages/ui/src/features/prototype.tsx`: SOS, wallet top-up, Famille subscribe, invite) no longer
  build a key inside the call (UI-17). A retried SOS reuses its frozen body only within 60 s.
- Car-wash booking and cancelling pass their payload to `run()` (CW-12).

Not done: the server side (admin corrections through `idempotent()`, scoped by admin id with a body hash; API-07), and
the keys the Famille cancel, call, police, incident and guardian routes still do not take. CancelSheet and the quote
read their payload from a closure, so a changed reason or method after an unanswered attempt gets a 409 once.

## Revisit when

- The production backend stores idempotency rows in Postgres ([ADR-0045](0045-production-backend-and-live-integrations.md)): set their retention, or
- a mutation needs several steps under one intent.
