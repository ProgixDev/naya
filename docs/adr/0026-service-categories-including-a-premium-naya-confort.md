---
id: ADR-0026
title: "Service categories, including a premium Naya Confort tier"
status: "Proposed — confirm intent"
date: 2026-10-06
deciders: Achraf (via implementation); confirmation pending
supersedes: []
related: [ADR-0005, ADR-0033, ADR-0043, P8, P17, DOM-01, DOM-18, ADM-09, PRD-16, PAX-08]
---

# ADR-0026 · Service categories, including a premium Naya Confort tier

> **Confirm intent.** The original product had one service and its car art was explicitly not a fare tier. Achraf must confirm that a premium tier is wanted before this is Accepted (audit decisions D4 and D14).

## Context

What the original said: the handoff describes one service with the original Naya Signature car; its pearl and plum variants "do not imply an additional premium fare tier" (handoff prompt:85). The rule is about the colour variants, but it shows the original product had a single fare tier. The first implementation quoted one fixed "Naya Signature" offer (`docs/MOBILE-FEEDBACK-AUDIT.md:19`).

What changed: item 1 of the client's feedback PDF asked for vehicle and service categories with per-category arrival estimates (`docs/MOBILE-FEEDBACK-AUDIT.md:19`). Commit `89aae18` added a configurable catalog with three categories.

## Decision

As implemented at `c38429d`: an admin-editable catalog of service categories, each with a name, icon, enabled flag, city list (empty = all cities), arrival estimate, commission in basis points and optional fares. The seed has Naya Scooter (own fares, 15 %), Naya Standard (no fares of its own, so it inherits the city fares; 15 %) and Naya Confort (id `premium`; higher fares, 18 %). A quote made with a category uses the category's fares where set and the city's otherwise; the booked ride freezes the selected category in its terms; dispatch and acceptance only consider drivers whose category list includes it.

## Consequences

- Passengers can choose between services, and prices differ by category.
- The category commission always replaces the city commission, so the Rules page commission no longer applies to app bookings (backlog [P8, DOM-01](../status/backlog.md)); [ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md) decides precedence.
- Every driver serves every category by default and vehicles have no type, so a car driver can receive Scooter rides (P17, DOM-18); [ADR-0043](0043-category-vehicle-eligibility-and-scooter-scope.md) decides eligibility and whether Scooter launches.
- Category prices are global, not per city, and edits skip versioning and reasons (ADM-09). The chosen category disappears after booking in several views (PRD-16), and the quote always starts on Standard (PAX-08).
- `packages/assets/src/images.ts:10` still states that colour variants do not imply a fare tier.

## Alternatives considered

One service with city fares only (the original); rejected by feedback item 1. Category fares per city, or a city × category matrix: not built; listed in audit decision D6.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `89aae18` (2026-10-06).
- `packages/domain/src/prototype.ts:4-17` (`ServiceCategory`), `:177-223` (seeded catalog; Confort at `:209-222`).
- `services/demo-api/src/services/rides.ts:79-80` (category fares fall back to the city), `:85` (selection on the quote), `:127` (category commission wins), `:262`, `:370` (driver category filter, default all).
- `services/demo-api/src/services/prototype.ts:240` (`categoryFor`); `apps/passenger/src/app/(app)/quote.tsx:55` (starts on `standard`).
- `docs/MOBILE-FEEDBACK-DEMO.md:9`.
- Enforced by: `services/demo-api/test/prototype.test.ts:6` "prices categories, freezes terms, and enforces admin category eligibility".

## Revisit when

- Achraf confirms or rejects the categories, Confort in particular (audit decision D4), or
- [ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md) or [ADR-0043](0043-category-vehicle-eligibility-and-scooter-scope.md) is decided.
