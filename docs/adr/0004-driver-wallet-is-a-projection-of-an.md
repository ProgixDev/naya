---
id: ADR-0004
title: "Driver wallet is a projection of an append-only ledger"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0003, ADR-0009, ADR-0010, ADR-0040, ADR-0041, docs/FINANCE.md, DOM-03, API-19]
---

# ADR-0004 · Driver wallet is a projection of an append-only ledger

## Context

The handoff fixes the driver-wallet behaviour with numbers: a cash ride debits only the commission, a confirmed card ride credits the net, a pending withdrawal reserves funds without moving the balance, a failed one must not add a compensating credit, and −150 MAD blocks offers in Rabat (handoff prompt:191-198). It adds that pending payments do not create spendable funds (prompt:200) and that balance, reserved, withdrawable, earnings and physical cash stay distinct (prompt:202).

## Decision

Never store a wallet balance. Compute the driver wallet from the ledger: balance = sum of posted entries; reserved = sum of pending withdrawals; available = max(0, balance − reserved); debt = max(0, −balance). Post an entry only for a confirmed event, at most once per business key (`ride:<id>:net`, `ride:<id>:commission`, `ride:<id>:cancel-fee`, `recharge:<id>`, `withdrawal:<id>`, `correction:<key>`). A withdrawal is a hold until the provider confirms it; a failed withdrawal posts nothing. A completed cash ride posts the commission as a debit, which can make the balance negative (debt). Block new offers when balance ≤ −debtLimit of the driver's city; never stop a ride already under way.

## Consequences

- Replays and duplicate callbacks cannot double-post: the business key is the idempotency key of the ledger.
- History is auditable: every balance is explained by entries, and `balanceAfter` is informational only.
- Earnings and physical cash are reported apart from the balance.
- The rule covers the driver wallet only. The Oct 6 passenger wallet edits entries in place and keeps a stored balance (backlog [DOM-03, API-19](../status/backlog.md)); [ADR-0040](0040-passenger-wallet-model.md) decides whether it adopts this model. Cash cancellation fees are never posted ([ADR-0041](0041-cash-and-fee-settlement.md)).

## Alternatives considered

Not recorded at the time. The handoff's withdrawal-release rule (prompt:194) excludes a mutable balance with compensating credits.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30).
- `packages/domain/src/wallet.ts:16-40` (projection), `:42-43` (inclusive debt threshold), `:51-61` (cash vs card settlement), `:63-68` (withdrawal guards).
- `services/demo-api/src/services/finance.ts:29-41` (`walletOf`), `:43-69` (`postLedger`, one entry per key), `:117-131` (withdrawal confirmed posts, failed posts nothing), `:216-253` (withdrawal request is a hold).
- `services/demo-api/src/services/rides.ts:215-231` (offer eligibility includes debt), `:601-638` (settlement at completion; cash commission at `:634-636`).
- `docs/FINANCE.md:22-51`.
- Enforced by: `packages/domain/test/wallet.test.ts:14-89` (every handoff fixture); `services/demo-api/test/scenarios.test.ts:119` (S03), `:157` (S04), `:406` and `:428` (S12), `:447`, `:463`, `:475`, `:494` (S13).

## Revisit when

- Naya moves to a real database: keep the ledger append-only and the business keys unique there too, or
- a payout or payments partner introduces partial confirmations or reversals the current entry types cannot express.
