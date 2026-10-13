---
id: ADR-0005
title: "Server-authoritative pricing with versioned city rules and frozen terms"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0003, ADR-0006, ADR-0026, ADR-0033, docs/FINANCE.md, DOM-01, ADM-05, ADM-09]
---

# ADR-0005 · Server-authoritative pricing with versioned city rules and frozen terms

## Context

The handoff requires quotes that carry city, currency, rule version, fare breakdown, expiry and conditions, and says accepted terms must be frozen so later admin changes never alter a booking (handoff prompt:107). The backend owns permissions, payment confirmation and wallet movements (prompt:109); the handoff does not say in so many words who computes fares. Cancellation fees must be shown before confirmation (prompt:172).

## Decision

Only the server prices a ride. A quote is created from the city's current rules, records `ruleVersion`, the breakdown, the cancellation policy and any dynamic multiplier, expires after the city's `quoteValiditySeconds`, and can be used once. Booking (immediate or scheduled) freezes the quote into `FrozenTerms`: rule version, breakdown, commission, cancellation policy and dynamic reason. Every rule change creates a new city rules version; it never re-prices an existing ride or booking. Clients display what the server returns and never compute a booking fare. To cancel, the client echoes the fee it showed (`acknowledgedFee`); the server refuses with `CONFLICT` if the fee changed.

## Consequences

- Admins can change rules at any time without touching booked rides; S06 proves it.
- A passenger never pays a fee she was not shown.
- The admin computes fares only as worked examples of city rules (the edit preview at `apps/admin/src/pages/Rules.tsx:154-155`, the city card example at `apps/admin/src/pages/Cities.tsx:47`), never for a booking.
- Since `89aae18` the frozen commission is `quote.service?.commissionBp ?? rules.commissionBp`, so a service category's commission replaces the city's for every app booking (backlog [DOM-01, ADM-05](../status/backlog.md)). This is the open question of [ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md). Category pricing changes also skip versioning and reasons (backlog ADM-09).

## Alternatives considered

Not recorded at the time. Client-side fare computation is not explicitly excluded by the handoff, but a quote that must carry its rule version and expiry and be frozen at booking (prompt:107) only works if the server issues it.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added quotes, frozen terms and `acknowledgedFee`.
- `services/demo-api/src/services/rides.ts:70-106` (quote: rule version, conditions, expiry), `:108-116` (single use, expiry check), `:118-132` (`freezeTerms`; commission at `:127`), `:464-488` (fee preview must match `acknowledgedFee`).
- `services/demo-api/src/services/cities.ts:78-105` (each rule change is a new version with a reason).
- `packages/domain/src/entities.ts:278-290` (`FrozenTerms`), `:204-211` (`CityRulesVersion`); `packages/domain/src/cities.ts:16` (`quoteValiditySeconds: 600`).
- `apps/passenger/src/features/ride/CancelSheet.tsx:10-20` (fee shown, then echoed).
- Enforced by: `services/demo-api/test/scenarios.test.ts:225` (S06, frozen at booking), `:249` (rule updates need version and reason), `:277` (S08, acknowledged fee), `:632` "cannot book two rides at once, and quotes expire"; `services/demo-api/test/prototype.test.ts:6` (category terms are frozen).

## Revisit when

- [ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md) is decided: update `freezeTerms` and this ADR's evidence, or
- surge pricing becomes automatic rather than an admin-set multiplier.
