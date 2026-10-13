---
id: ADR-0010
title: "Provider outcomes are applied through one code path"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0004, ADR-0009, ADR-0040, ADR-0045, DOM-03, API-03, PRD-12]
---

# ADR-0010 · Provider outcomes are applied through one code path

## Context

The handoff asks for authenticated provider callbacks, duplicate-event handling and transactional updates, and forbids optimistic confirmation of payments or withdrawals (handoff prompt:200). The demo has no real payment or payout provider, so outcomes are simulated; the simulation must not take a shortcut that a live provider could not.

## Decision

Apply every payment, recharge and withdrawal outcome through `applyProviderEventIn`, whatever its source: a signed HTTP callback, a simulated provider job that falls due, the provider-sandbox page, or the dev scenario launcher. The HTTP callback verifies an HMAC-SHA256 signature over the raw body (`X-Naya-Signature`, constant-time comparison) before parsing it. Each event id is processed once; a repeated terminal outcome is a no-op; a contradictory one is refused (`CONFLICT` for a payment, `INVALID_TRANSITION` from the transfer machine for a recharge or withdrawal). Every ledger posting that depends on a provider outcome happens inside this function, keyed by business key ([ADR-0004](0004-driver-wallet-is-a-projection-of-an.md)). Postings that need no provider (cash-ride commission, admin corrections) stay outside it.

## Consequences

- The demo exercises the same settlement code a live provider webhook will call; swapping the simulation for a real provider changes the caller, not the accounting.
- A simulated outcome cannot settle money differently from a signed callback.
- With `NAYA_DEV=0` the API refuses to start with the default demo secret.
- Exceptions added on 6 October: wallet and mobile-wallet ride payments are confirmed at completion without any provider event, and a passenger can confirm her own wallet top-up through `/prototype/wallet/:id/resolve` (backlog [DOM-03, API-03, PRD-12](../status/backlog.md)). [ADR-0040](0040-passenger-wallet-model.md) decides whether they move onto this path.

## Alternatives considered

Not recorded at the time.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30).
- `services/demo-api/src/services/finance.ts:73-82` (HMAC sign and constant-time verify), `:88-156` (`applyProviderEvent`/`applyProviderEventIn`: dedupe, terminal outcomes, conflicts, postings), `:158-171` (due jobs use the same path), `:173-180` (sandbox and launcher use the same path).
- `services/demo-api/src/app.ts:615-620` (signed callback route), `:593-607` (sandbox route), `:916-919` (dev launcher route).
- `services/demo-api/src/main.ts:15-20` (refuses the demo secret when `NAYA_DEV=0`).
- Exceptions: `services/demo-api/src/services/rides.ts:625-631`, `:457-460`; `services/demo-api/src/services/prototype.ts:494-517`.
- `docs/FINANCE.md:55-58`; `docs/INTEGRATIONS.md:14` (removed after `c38429d`; its successor is [docs/status/integrations.md](../status/integrations.md)).
- Enforced by: `services/demo-api/test/scenarios.test.ts:183` "provider callbacks must be signed", `:157` (S04, credit only after confirmation), `:553` and `:576` (S16); `packages/domain/test/machines.test.ts:73` "duplicate confirmations are no-ops, contradictions conflict".

## Revisit when

- The first live payment or payout provider is integrated ([ADR-0045](0045-production-backend-and-live-integrations.md)): one secret per provider, and replay protection by timestamp as well as event id, or
- [ADR-0040](0040-passenger-wallet-model.md) is decided.
