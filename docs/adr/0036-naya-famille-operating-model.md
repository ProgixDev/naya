---
id: ADR-0036
title: "Naya Famille operating model"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0004, ADR-0007, ADR-0013, ADR-0031, ADR-0034, ADR-0035, ADR-0037, ADR-0039, ADR-0042, ADR-0045, P1, P16, DOM-02, DOM-16, DOM-17, API-01, API-17, API-18, API-26, PRD-01, PRD-02, PRD-03, PRD-09, PRD-29, PRD-39, docs/tasks/2026-10-13.md, docs/specs/family.md]
---

# ADR-0036 · Naya Famille operating model

## Context

Decision **D3** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d3-naya-famille-at-launch)). It unblocks the second half of P1, and P16. The first half of P1 (no handover code in any driver payload) needs no decision and can land now.

Naya Famille carries unaccompanied children. At `c38429d` it is a parallel model inside the prototype module:

- Its trips are not rides. They follow a linear status map with no cancel, no-show or failed-handover state. Dispatch does not see them: a dedicated driver on a family trip can still receive regular offers.
- The dedicated driver is the first approved driver in the parent's city. Subscribing writes « paiement simulé » to the audit log and charges nothing. The driver earns nothing.
- The driver's payload contains every recipient's handover code. Codes are fixed 4-digit values per recipient, compared in plain text, with no attempt limit.
- The pickup check asks the driver to retype the child's first name, which her own screen shows.
- Arrival photos are stored as support attachments. Any admin with `support.resolve` or `config.edit` can read them.
- Trip addresses typed by the parent are replaced by fixed Hay Riad → Agdal coordinates. Recurrence uses UTC weekdays and only runs when a trip completes. Parent notifications are written but never shown.
- Children aged 1–17 of either sex are accepted. The website FAQ mentions children only as « accompagnés de leur mère ».

Founder brief 13 Oct ([task 4](../tasks/2026-10-13.md)) extends Famille rather than dropping it. It asks for an entry on the passenger home, live GPS of the driver every second, a pickup photo, parent approval before the trip starts, a drop-off photo on the school premises that closes the trip (with the handover code where one is set), in-app voice and video calls between parent and driver, and stricter driver vetting. Open questions 2 ([F2](../status/open-questions.md#f2-parent-at-pick-up): is the parent present at every pickup?) and 4 ([F4](../status/open-questions.md#f4-video-call): in-app video, or a hand-off to WhatsApp or FaceTime?) are still open.

## Decision

**Recommended, pending Achraf’s choice and counsel.** The audit's default was D3 option (a), leaving Famille out of the launch. The founder brief makes Famille a priority, so the recommendation is option (b): **build family trips as rides with a family flag**, behind a feature flag. Release them only when rules 3, 4 and 8 are built and counsel has signed off on rule 9. If they are not ready, the first public launch goes without Famille.

1. **Model.** A family trip is a `Ride` with a `family` block (child, recipients, proofs), booked from a subscription. It goes through dispatch, frozen terms, payment and the driver ledger. Only drivers with an approved Famille vetting case may receive it ([ADR-0034](0034-women-only-eligibility-and-verification-policy.md)).
2. **Dedicated driver.** Hold her out of regular offers from 30 minutes before each family pickup. If she is offline, busy or blocked, offer the trip to another Famille-approved driver. The parent must approve the substitute in the app. If nobody is available, cancel with notice and no charge.
3. **Handover code.** The server generates a one-time code per trip and shows it only to the parent and the named recipient. It is stored hashed, never sent in any driver payload, and locked after 5 failed attempts. A lock alerts the parent and the safety desk. A test asserts that no driver response contains a code.
4. **Start and end.** At pickup the driver takes a photo, then taps « Démarrer ». The trip starts only when the parent approves in the app. The child-name step is an attestation and is never labelled « vérifié ». At drop-off the driver takes a photo at the destination. The trip closes only with that photo and, when a recipient is set, a valid code.
5. **Failure paths.** Add parent cancel or skip, child no-show (fee and driver credit, as in [ADR-0042](0042-ride-exception-paths.md)) and `handover_failed`. In a failed handover, the driver stays with the child, the safety desk is alerted ([ADR-0035](0035-sos-production-model.md)), and the trip is resolved by the desk. It is never completed without a valid code.
6. **Live location and contact.** Target a driver position every second once a real-time channel exists ([ADR-0045](0045-production-backend-and-live-integrations.md)). Until then, show the age of the last position. Provide in-app voice calls through a VoIP provider first and video second. Do not hand off to WhatsApp, because that exposes personal numbers. On acceptance, this ADR supersedes [ADR-0031](0031-number-masking-is-the-only-planned-passenger.md) for Famille trips only (no in-app contact today).
7. **Money.** Charge the subscription through the payments partner. Pay the driver per trip through the ledger under the key `family:<tripId>:net` ([ADR-0004](0004-driver-wallet-is-a-projection-of-an.md)).
8. **Child data.** Collect parental consent when a child is added. Store proofs under their own purpose, readable only by the parent and a `family.ops` permission ([ADR-0037](0037-admin-permission-model-for-the-new-features.md)). Delete them after a retention period set with counsel.
9. **Minors scope.** Counsel and Achraf set the age range and whether boys are included; the schema allows 1–17 today. Adults named by the parent may be recipients, never riders. The website copy must match.

## Consequences

- This is the largest item in the audit (XL). It depends on the backend, payments, push and a real-time channel.
- It also needs a VoIP provider, safety-desk staffing and legal sign-off on minors.
- Moving trips into rides retires the parallel family model. Do it as part of [ADR-0039](0039-future-of-the-prototype-module.md), with a store migration.
- Famille SOS, tracking and receipts reuse the ride features instead of copies.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (a) Keep it as a demo behind the demo flag (audit default) | Lowest risk; no legal exposure on minors at launch | Contradicts the founder brief; the demo stays disconnected from payment and dispatch |
| (c) A separate product with its own scheduling and billing | Can evolve on its own | Duplicates dispatch, payments, SOS and tracking. The current prototype shows the cost: no payment, no dispatch, no ledger |
| Video hand-off to WhatsApp or FaceTime | No VoIP vendor | Exposes personal numbers; no record on the trip |

## Evidence

Line numbers at commit `c38429d`.

- `packages/domain/src/prototype.ts:168-175` (`FAMILY_NEXT`, linear); `services/demo-api/src/services/rides.ts:245-249` (`busyDriverIds` ignores family trips).
- `services/demo-api/src/services/prototype.ts:303-319` (first approved driver), `:343-350` (« paiement simulé »).
- `services/demo-api/src/services/prototype.ts:250-257` (whole child objects, codes included, sent to the driver), `:85-87` (one 4-digit code per recipient, set once by the parent), `:699-708` (plain comparison, no limit), `:688-698` (name retype).
- `services/demo-api/src/services/uploads.ts:60-64` (support and config admins read arrival photos); `packages/ui/src/features/prototype.tsx:683-689` (photo uploaded as `support_attachment`).
- `packages/ui/src/features/prototype.tsx:549-560` (fixed Hay Riad and Agdal coordinates); `services/demo-api/src/services/prototype.ts:726-729` (notifications never shown), `:731-760` (UTC recurrence on completion only).
- `services/demo-api/src/services/prototype.ts:76` (age 1–17), `:592-597` (« Père »); `apps/web/components/landing.tsx:40`.
- `apps/passenger/src/app/(app)/(tabs)/account.tsx:35` (entry under Compte today).
- Enforced by: no test covers family billing, dispatch conflicts or code secrecy.

## Revisit when

- Counsel's opinion on minors arrives, or
- the founder answers brief questions 2 and 4, or
- a pilot with the first families ends.
