---
id: ADR-0041
title: "Cash and fee settlement"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0004, ADR-0005, ADR-0006, ADR-0010, ADR-0040, ADR-0042, P11, P14, PAX-16, DOM-08, API-02, API-15, API-24, API-25, PRD-05, docs/FINANCE.md, docs/specs/payments-and-fees.md]
---

# ADR-0041 · Cash and fee settlement

## Context

Decision **D7** (cash fees) in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d7-cash-fees-and-ride-exceptions)). It unblocks P11 ([backlog](../status/backlog.md)). Ride exceptions, the other half of D7, are in [ADR-0042](0042-ride-exception-paths.md). Cash is the main payment method.

At `c38429d`:

- A cancellation fee on a cash ride creates a `pending` payment with no ledger entry. Nothing ever resolves it. The receipt says « … à régler avec votre prochaine course. » and the cancel sheet says « Les frais éventuels sont à régler avec votre prochaine course. ». Neither happens. The driver who made the trip gets nothing, and the admin's pending-payments list keeps growing.
- On a wallet ride, the same fee is confirmed at once and credits the driver at once. The rule differs by payment method.
- A failed card fee cannot be retried. The retry route looks for `ride.paymentId`, which a fee never sets.
- On a cash ride, the commission debt is posted at completion. The driver can then confirm only the full amount: there is no "not paid" or "partly paid" path.
- `createRide` checks for an active ride only. Unpaid fees and failed payments do not block a new booking.

## Decision

**Recommended, pending Achraf’s choice: D7 option (a), the fee is added to the next fare.**

1. **At cancellation.**
   - Post a passenger receivable for the fee.
   - Credit the driver her net share at once, under the ledger key `ride:<id>:cancel-fee`. She does not carry the passenger's debt; Naya does.
2. **On the next booking.**
   - Show the outstanding fee as its own line on the quote, before the passenger confirms.
   - On a cash ride, the driver collects fare plus fee, and the commission debt covers both.
   - On a card ride, charge the fee with the fare.
3. **Blocking.** One outstanding cancellation fee may be carried to the next ride. A second unpaid item, or any failed card payment, blocks new bookings until it is settled. The block shows a clear message and a pay action.
4. **Retries.** Every fee gets its own payment reference, so a failed card fee can be retried from the receipt.
5. **Cash not received or partial.**
   - The driver reports « Non payé » or the amount she received.
   - Support confirms the report.
   - Then the commission debt on the unpaid part is reversed, and the missing amount becomes a passenger receivable.
   - Nothing changes automatically on the driver's word alone.
6. **Copy.** The receipt and the cancel sheet describe exactly this.

## Consequences

- Passenger receivables need a passenger-side ledger, even with no stored-value wallet ([ADR-0040](0040-passenger-wallet-model.md)).
- Naya carries the collection risk on fees and must track unpaid rates.
- `docs/FINANCE.md` and [specs/payments-and-fees.md](../specs/payments-and-fees.md) gain these rules.
- API scenario tests must cover both sides: the passenger's next quote and the driver's ledger.
- Cash disputes need a support flow and a finance permission to confirm reversals ([ADR-0006](0006-admin-changes-are-governed.md)).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) Require an electronic payment method whenever a cancellation carries a fee | Clean collection | Shuts out cash-only passengers, who are the majority |
| (c) Waive the fee for cash | Simple | Drivers lose compensation for wasted trips, and cash users can cancel late for free |
| Keep today's behaviour | No work | A promise in the UI that is never kept; drivers unpaid; the pending list grows forever |

## Evidence

Line numbers at commit `c38429d`.

- `services/demo-api/src/services/rides.ts:439-462` (`chargeFee`: cash stays `pending`, no ledger; wallet credited at `:457-460`).
- `apps/passenger/src/app/(app)/receipt/[id].tsx:19`; `apps/passenger/src/features/ride/CancelSheet.tsx:60`.
- `services/demo-api/src/app.ts:835` (`pendingPayments` in the Finance summary).
- `services/demo-api/src/services/rides.ts:528-535` (retry needs `ride.paymentId`, `:531-532`).
- `services/demo-api/src/services/rides.ts:632-637` (cash commission posted at completion), `:640-653` (full confirmation only).
- `services/demo-api/src/services/rides.ts:190-196` (no check for unpaid items).
- Enforced by: no test covers cash fee collection or driver credit.

## Revisit when

- The unpaid-fee rate is measured after launch, or
- the PSP offers card-on-file for cash passengers, or
- a stored-value wallet is approved.
