---
id: ADR-0031
title: "Number masking is the only planned passenger–driver contact channel; no in-app chat"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0035, ADR-0045, PRD-10, DRV-04, DOC-07, PRD-23]
---

# ADR-0031 · Number masking is the only planned passenger–driver contact channel; no in-app chat

## Context

The handoff lists contact as part of the approach and trip screens for both apps (handoff prompt:129, :145) without saying how. It asks that every control either works or explains the missing dependency, with no fake interactions (prompt:240). Passengers and drivers should not see each other's real phone numbers. No telephony provider is configured (`docs/INTEGRATIONS.md:20`).

## Decision

Passenger and driver reach each other only by a call or SMS relayed through a number-masking telephony provider, so neither sees the other's number. Do not build an in-app chat. Until a provider exists, the passenger's contact sheet shows "Appeler via Naya" and "Envoyer un message" as unavailable with the reason and offers a direct emergency call (`tel:19`, police); the driver's sheet names the police number. The driver summary sent to passengers carries no phone number.

## Consequences

- No messaging backend, moderation or message retention to build for the demo.
- Passenger and driver cannot contact each other at all today, for example when the pickup point is unclear.
- At `c38429d` the copy already promises masking that does not exist: "Vos numéros restent masqués." on the passenger sheet, "Votre numéro reste masqué des deux côtés." on the driver sheet, and similar lines on both sign-in screens (backlog [PRD-10, DRV-04, DOC-07](../status/backlog.md)). This is the open finding 3 of `docs/MOBILE-FEEDBACK-AUDIT.md:43`. Branch `chore/docs-foundation-and-fixes` removes the promise from both contact sheets and both sign-in screens and adds a tap-to-call 19 on the driver sheet; only the undisplayed `phoneMasked` string remains in the demo API. Remove the promise until masking exists.

## Alternatives considered

In-app chat: not chosen; it needs a real-time channel ([ADR-0013](0013-real-time-by-polling-with-local-notifications.md)), moderation and storage of conversations. Showing real numbers: excluded for privacy. Neither was recorded at the time.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `96af8c6` (2026-09-30) `phoneMasked` placeholder in the driver summary; `f0f8d46` (2026-09-30) passenger contact sheet; `d49d127` (2026-09-30) driver contact sheet.
- `apps/passenger/src/features/ride/ContactSheet.tsx:7-10` (reason), `:14` (masking promise), `:16-20` (unavailable options, `tel:19`).
- `apps/driver/src/app/(app)/ride.tsx:222-228` (driver sheet: promise and police number only).
- `services/demo-api/src/services/rides.ts:233-243` (driver summary: `phoneMasked: 'Appel masqué via Naya'`, no number); `packages/domain/src/entities.ts:344`.
- `apps/passenger/src/app/(auth)/phone.tsx:44` and `apps/driver/src/app/(auth)/phone.tsx:11` (sign-in copy mentions masked contact).
- `docs/INTEGRATIONS.md:20` (removed after `c38429d`; its successor is [docs/status/integrations.md](../status/integrations.md)).
- Enforced by: no test.

## Revisit when

- A telephony provider is chosen ([ADR-0045](0045-production-backend-and-live-integrations.md)), or
- Naya Famille needs parent–driver voice or video calls during a trip ([docs/tasks/2026-10-13.md](../tasks/2026-10-13.md), task 4 and open question 4): that is a new channel and needs its own ADR, or
- support data shows riders failing to meet drivers at pickup.
