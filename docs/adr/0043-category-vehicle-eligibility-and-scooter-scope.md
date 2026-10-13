---
id: ADR-0043
title: "Category–vehicle eligibility and Scooter scope"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0019, ADR-0026, ADR-0033, ADR-0034, ADR-0037, ADR-0039, ADR-0048, P17, DOM-18, DRV-12, API-16, PRD-07, PRD-17, UI-11, docs/tasks/2026-10-13.md]
---

# ADR-0043 · Category–vehicle eligibility and Scooter scope

## Context

Decision **D4** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d4-service-categories-and-who-drives-them)). It unblocks P17 ([backlog](../status/backlog.md)) and settles the scope part of [ADR-0026](0026-service-categories-including-a-premium-naya-confort.md) (confirm intent).

- **Vehicle record.** A vehicle records make, model, colour, plate and year: no type, seats or comfort class.
- **Who serves what.** Category eligibility is a per-driver list of admin checkboxes, and it defaults to every category. Dispatch and offer acceptance both apply that default, so car drivers receive Naya Scooter requests at Scooter prices.
- **What drivers see.** Drivers cannot see which categories they serve. The status endpoint reports "eligible" while a category restriction silently stops offers (backlog API-16).
- **Scooter.** The client's feedback asked for scooter, standard and premium choices (item 1). Naya Scooter has its own prices, but nothing models a two-wheeler licence, insurance, helmet or passenger safety.
- **Confort.** Naya Confort reverses the handoff rule that car colour variants "do not imply an additional premium fare tier" (handoff prompt:85).
- **Founder brief 13 Oct.**
  - [Task 2](../tasks/2026-10-13.md) adds licence category and dates, carte grise, insurance, visite technique and vehicle photos to driver sign-up.
  - Task 6 redraws the app's cars as unbranded cars common in Morocco.
  - Task 5 proposes a mobile car wash as a new service, with its scope still open ([F1](../status/open-questions.md#f1-car-wash-audience)).

## Decision

**Recommended, pending Achraf’s choice: D4 option (a).** Launch with Naya Standard and Naya Confort. Disable Scooter in the catalog and keep its code.

1. **Vehicle data.** Add `type` (`car` | `two_wheeler`), `seats` and `class` (`standard` | `confort`) to the vehicle case. The reviewer sets the class at vehicle approval, using written criteria in the spec (for example model year, size and comfort).
2. **Eligibility from the approved vehicle.**
   - Any approved car serves Standard.
   - A car approved as `confort` also serves Confort.
   - Before approval, a driver serves no category: the default is empty, not "all".
   - An admin may override with a reason and an audit entry ([ADR-0037](0037-admin-permission-model-for-the-new-features.md)).
3. **Show it to the driver.** Her categories appear on her dashboard and in her dossier. The status endpoint reports category reasons.
4. **Car wash.** It is not a ride category. If it is confirmed, it gets its own ADR and its own domain module ([ADR-0039](0039-future-of-the-prototype-module.md)).

## Consequences

- The vehicle form and review gain fields that the founder brief already asks for.
- Seeds, dispatch, offer acceptance and the driver status change together. Existing demo drivers need a vehicle class (store migration or reseed).
- `VehicleImage` can draw the right type in the real colour (backlog UI-11). The art follows [ADR-0048](0048-cross-surface-media-and-brand.md).
- Category prices and commission follow [ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md).
- Confirming Confort here also confirms ADR-0026's reversal of handoff prompt:85.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) All three, with a two-wheeler type and its own verification | Matches the client's request and the full catalog | Licence, insurance, helmet and safety rules for passengers on scooters; more scope before launch |
| (c) Standard only | Simplest launch | Drops Confort and Scooter, both in the client's request |
| Keep admin checkboxes defaulting to all | No work | Car drivers keep receiving Scooter rides; drivers cannot see their categories |

## Evidence

Line numbers at commit `c38429d`.

- `packages/domain/src/entities.ts:108-114` (`VehicleDetails`).
- `services/demo-api/src/services/rides.ts:262` (dispatch defaults to every category), `:370` (acceptance, same default).
- `apps/admin/src/pages/Prototype.tsx:194-234` (per-driver checkboxes default to all).
- `apps/driver/src/app/(app)/offer.tsx:112` (the only place the driver sees a category name).
- `packages/domain/src/prototype.ts:181-194` (Scooter prices), `:209-222` (Confort).
- Handoff prompt:85; `packages/assets/src/images.ts:10` ("Colour variants do not imply a fare tier").
- `packages/domain/src/machines/verification.ts:19` (vehicle items: registration, insurance, photos).
- `docs/MOBILE-FEEDBACK-AUDIT.md:19` (feedback item 1: scooter, standard and premium).
- Enforced by: `services/demo-api/test/prototype.test.ts:6` covers admin category restrictions; nothing ties eligibility to the vehicle.

## Revisit when

- Demand data or the client asks for Scooter, or
- disputes arise over Confort classification, or
- the car wash scope is confirmed.
