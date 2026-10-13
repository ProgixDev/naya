---
id: ADR-0040
title: "Passenger wallet model"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0004, ADR-0009, ADR-0010, ADR-0037, ADR-0039, ADR-0041, ADR-0044, ADR-0045, P7, P14, DOM-03, API-03, API-19, ADM-17, PRD-12, PRD-15, PRD-38, VIS-14, VIS-25, DOC-08, docs/specs/payments-and-fees.md]
---

# ADR-0040 · Passenger wallet model

## Context

Decision **D5** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d5-passenger-wallet)). It unblocks the second half of P7 and the wallet wording in P14 ([backlog](../status/backlog.md)). The client's feedback asked for passenger wallet top-ups and Moroccan mobile-wallet methods (item 8). Holding customer funds in Morocco probably requires a payment institution licensed by Bank Al-Maghrib; this needs confirming with counsel.

At `c38429d`:

- **Self-confirmed top-ups.** A passenger creates a pending top-up of up to 100,000 MAD. She then confirms it herself through `POST /prototype/wallet/:id/resolve`, which has no dev-mode check. The app shows « Simuler la confirmation » in every build.
- **Mutable entries.** Wallet entries are edited in place: a hold is turned into the settlement, and a release marks the hold failed. The balance is a stored field, recomputed on every read, including inside GET handlers.
- **Wallet rides.** Booking with the wallet places a hold. Cancelling releases it. Completion settles it and posts a withdrawable `ride_net_credit` to the driver. So self-confirmed money becomes driver money that can be withdrawn.
- **Mobile-wallet rides.** These are confirmed at completion with no provider step at all.
- **Domain rules.** The settlement rule in `@naya/domain` accepts only `cash | card`. Wallet flows bypass it, and `docs/FINANCE.md` does not describe them (backlog DOM-03, DOC-08).
- **Admin view.** Customer funds appear only under Services (`config.edit`), not in Finance.

## Decision

**Recommended, pending Achraf’s choice and counsel: D5 option (a), no stored-value passenger wallet at the first launch.**

Hide the wallet, its top-ups and the wallet payment method outside demo builds ([ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)).

Do these now, whatever the choice:

- Allow the self-resolve route only in dev mode. Send demo top-ups through the signed provider-callback path ([ADR-0010](0010-provider-outcomes-are-applied-through-one-code.md)).
- Make mobile-wallet ride payments wait for a provider event before they are confirmed and before the driver is credited.

If the wallet is brought back later (option b), it must follow this model:

- a licensed partner holds the funds;
- entries are immutable ledger postings (hold, settlement, release, refund), each a new entry with a business key, as in [ADR-0004](0004-driver-wallet-is-a-projection-of-an.md);
- the balance is a projection computed in `@naya/domain`;
- top-ups are confirmed only by a signed provider callback;
- limits are set with the partner;
- dispute refunds credit the wallet;
- customer funds and a daily reconciliation appear in admin Finance under `finance.read` ([ADR-0037](0037-admin-permission-model-for-the-new-features.md)).

## Consequences

- At launch, passengers pay cash or card. The payment wording (P14) only has two cases to get right.
- The client's wallet request is deferred, not refused. Demo builds keep showing it, labelled « Démo ».
- A mobile wallet run by an operator or PSP can still be a payment method through the PSP. It is not a Naya-held balance.
- The loophole that turns self-created money into withdrawable driver credit closes.
- The wallet code stays in demo builds, and moves into its own module if it is kept ([ADR-0039](0039-future-of-the-prototype-module.md)).
- Unpaid cancellation fees still need a passenger-side record, which [ADR-0041](0041-cash-and-fee-settlement.md) covers without a wallet.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) Launch a wallet with a licensed partner | Faster checkout; prepaid balances | XL engineering plus a contract and licensing lead time; reconciliation and support load |
| Keep the current demo wallet in production | No work | Self-confirmed money; mutable entries; not legal to operate as is |

## Evidence

Line numbers at commit `c38429d`.

- `services/demo-api/src/services/prototype.ts:26` (amounts up to 10,000,000 centimes), `:453-493` (top-up), `:494-517` (passenger resolves her own top-up; no dev-mode check).
- `services/demo-api/src/services/prototype.ts:106-118` (stored balance recomputed on read), `:147-158` (release marks the hold failed), `:159-184` (settlement rewrites the hold in place, `:174-178`).
- `services/demo-api/src/app.ts:360` (a GET handler calls `prototypeMethods`, which writes wallet state).
- `services/demo-api/src/services/rides.ts:199` (hold at booking), `:484` (release on cancel), `:625-630` (wallet and mobile wallet confirmed with no provider; driver credited at `:628`).
- `packages/domain/src/wallet.ts:56` (`rideSettlement` takes `'cash' | 'card'`).
- `packages/ui/src/features/prototype.tsx:264-276` (« Simuler la confirmation »).
- `services/demo-api/src/app.ts:816-837` (Finance summary has no passenger wallets).
- `docs/MOBILE-FEEDBACK-AUDIT.md:26` (feedback item 8: passenger wallet and Moroccan methods).
- Enforced by: `services/demo-api/test/prototype.test.ts:77` covers holds and overspending in demo mode; no test covers the dev-mode restriction.

## Revisit when

- A licensed partner offers a wallet product, or
- user research shows that cash and card are not enough.
