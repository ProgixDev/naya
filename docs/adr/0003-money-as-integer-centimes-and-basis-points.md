---
id: ADR-0003
title: "Money as integer centimes and basis points, rounded half away from zero once where derived"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0004, ADR-0005, docs/FINANCE.md, WEB-06, ADM-04]
---

# ADR-0003 · Money as integer centimes and basis points, rounded half away from zero once where derived

## Context

The handoff requires integer centimes for money and basis points for percentages, and asks to "define rounding explicitly" (handoff prompt:188). Its fixtures need exact results such as 128,40 MAD for a Casablanca ride with a ×1,2 multiplier (prompt:186) and a 15 MAD commission on 100 MAD (prompt:191).

## Decision

Represent every amount as a safe integer number of centimes (`Centimes`) and every rate or multiplier as integer basis points (`BasisPoints`; 15 % = 1 500 bp, ×1,2 = 12 000 bp). Derive amounts only with `divRound` and `applyBp` from `@naya/domain`: integer division rounded half away from zero, once, at the point where the amount is derived. Never store or post a floating-point amount. Format for people only with `formatMoney`, `formatBp` and `formatMultiplier`; parse typed amounts only with `parseMoneyInput`.

## Consequences

- Fares, commissions and ledger balances are exact and reproducible; the handoff fixtures hold to the centime.
- `assertCentimes` throws on any non-integer, and `postLedger` refuses non-integer or zero amounts, so a float fails loudly.
- Every surface that shows or edits money must convert at its edge. Known violations: `apps/web` stores whole-MAD floats (`apps/web/lib/store.ts:13,62`; backlog [WEB-06](../status/backlog.md)), and the admin Services editor cannot take decimal amounts (backlog ADM-04).

## Alternatives considered

Not recorded at the time. The handoff excluded binary floating point (prompt:188), which rules out float amounts rounded only for display.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added `packages/domain/src/money.ts` and the tests.
- `packages/domain/src/money.ts:1-8` (policy), `:15-17` (`assertCentimes`), `:25-37` (`divRound`), `:39-44` (`applyBp`), `:62-72` (`formatMoney`), `:87-92` (`parseMoneyInput`).
- `packages/domain/src/pricing.ts:20-25` (fare uses `divRound` and `applyBp`), `:44-45` (commission uses `applyBp`).
- `services/demo-api/src/services/finance.ts:55` (ledger refuses non-integer amounts).
- `docs/FINANCE.md:5-9` (representation and rounding).
- Enforced by: `packages/domain/test/money.test.ts:5` "rounds half away from zero, exactly", `:12` "never accepts non-integer amounts"; `packages/domain/test/pricing.test.ts:5-28` (Rabat 100 MAD, ×1,2 = 120 MAD, Casablanca 107 MAD and 128,40 MAD, commission 15 of 100).

## Revisit when

- Naya handles a second currency, or
- a payments partner reports amounts in a unit other than centimes, or
- a rate needs finer precision than one basis point.
