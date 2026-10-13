---
id: ADR-0035
title: "SOS production model"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0007, ADR-0012, ADR-0013, ADR-0036, ADR-0037, ADR-0042, ADR-0044, P5, P2, PAX-03, PAX-11, ADM-03, API-04, VIS-01, VIS-23, VIS-24, PRD-06, PRD-23, PRD-24, docs/specs/safety-sos.md]
---

# ADR-0035 · SOS production model

## Context

Decision **D2** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d2-sos-at-launch)). It unblocks P5. P2 (support cannot see alerts) needs no decision and can start now ([backlog](../status/backlog.md)).

At `c38429d`, SOS looks finished but is a simulation in every build:

- The trigger is a secondary-style pill, « SOS · sécurité ». It shows on the passenger ride screen in every ride status, including while the app is still searching.
- Its actions are past-tense labels such as « Appel urgence simulé ». The server accepts only those four labels. Nothing is dialled or sent.
- The alert lives in the component's state and is lost when the screen unmounts. `api.prototype.alerts()` exists, but nothing calls it, so the operator's response never reaches the person who raised the alert.
- The location sent is the driver's simulated position or the pickup point, not the phone's GPS.
- In the admin, the list and every status change require `config.edit`. The seeded support agent does not have it. The queue is tab 6 of the « Services et familles » page. Any status can follow any other.
- A ride in progress can only be completed, so an alert cannot end or flag the ride.
- Standalone builds tell testers the alert reaches the back-office. Standalone builds have no shared back-office ([ADR-0012](0012-native-demo-builds-run-the-demo-api.md)).
- The copy lists « 19 (police) ou le 15 (SAMU) ». Audit verifiers note that 15 is the Protection civile, SAMU is 141, the Gendarmerie is 177 and 112 works from mobiles. Confirm this locally.
- Founder brief 13 Oct ([task 4](../tasks/2026-10-13.md)) asks for live GPS every second and parent–driver calls on Famille trips. SOS must work on those trips too.

## Decision

**Recommended, pending Achraf’s choice: D2 option (b), the phone actions plus a Naya safety desk during staffed hours.**

1. Show one danger-styled SOS control from `driver_assigned` until the ride ends, and on every Famille trip. Never show it while the app is still searching.
2. One tap opens a short sheet with three actions, each with its own status:
   - « Appeler la police (19) » hands off to the phone dialer. Until local ops confirm the list, also offer 177 (Gendarmerie, outside cities) and relabel 15 as « Protection civile » instead of « SAMU », as the audit's default says.
   - Share live device GPS with a trusted contact saved in the profile, by SMS link, until the ride ends.
   - Raise an alert to the Naya safety desk. The person can cancel it within 5 seconds.
3. Staff the desk during published hours, and say so in the app. Outside those hours, the sheet says the desk is closed and offers the first two actions. Support agents answer through a `safety.respond` permission ([ADR-0037](0037-admin-permission-model-for-the-new-features.md)), from a top-level « Alertes SOS » page with an open-count badge and a sound. Set an acknowledgement target with operations: the proposal is 2 minutes during staffed hours.
4. Put the alert lifecycle in `@naya/domain` as a state machine: `new → acknowledged → resolved | false_alarm`. Only listed transitions are allowed, and each needs a note. The person sees « Alerte reçue », then « Prise en charge par … », then « Résolue ». Updates arrive by polling until push exists ([ADR-0013](0013-real-time-by-polling-with-local-notifications.md)).
5. Read the location from the device GPS while the alert is open. If there is no fix, fall back to the last ride position and label it.
6. An alert never cancels the ride by itself. The desk can end a ride in progress through the abort path in [ADR-0042](0042-ride-exception-paths.md), with no charge to the passenger by default.
7. Demo builds keep the simulation behind `DEMO_MODE`, with the « Démo » badge ([ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)). Standalone copy never mentions a back-office.

## Consequences

- Needs staff, published hours, an escalation runbook and a legal review of the safety copy.
- Trusted contacts are new personal data. Add them to the privacy inventory.
- Needs an SMS provider ([ADR-0045](0045-production-backend-and-live-integrations.md)). Remote push later replaces polling.
- Drivers get the same control, because drivers are women too.
- The e2e test must close the sheet from the UI instead of reloading the page.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (a) Phone only: police call plus GPS shared with a contact | No staffing; quickest | Naya cannot follow up, keeps no record, and cannot act on the ride |
| (c) A 24/7 desk or a security partner | Full coverage | Cost and a contract before there is any volume. The target once volume justifies it |
| The app calls the police automatically | Fastest | iOS requires the user to confirm a call; false alarms reach the police |

## Evidence

Line numbers at commit `c38429d`.

- `packages/ui/src/features/prototype.tsx:48-150` (`SafetyButton`): `:61` local state, `:83-88` secondary pill, `:99` standalone back-office claim, `:125-130` simulated actions.
- `services/demo-api/src/services/prototype.ts:790-846` (alert creation, « Alerte de démonstration créée »), `:853-876` (only the four simulated labels), `:877-878` and `:926-948` (`config.edit`; any status, `:930`).
- `packages/api/src/client.ts:459` (`alerts()`, never called).
- `apps/passenger/src/app/(app)/ride.tsx:173` (`driverLocation ?? pickup`).
- `packages/domain/src/machines/ride.ts:23` (`in_progress` can only complete).
- `services/demo-api/src/seed.ts:301` (support agent permissions); `apps/admin/src/router.tsx:75` (Services page gate); `apps/admin/src/pages/Prototype.tsx:101-109` (alerts are the sixth of eight tabs).
- `apps/passenger/src/features/help/topics.ts:48`; `packages/ui/src/features/support.tsx:149` (« 15 (SAMU) »).
- `e2e/tests/scenarios-feedback.spec.ts:78-79` (closes the sheet by reloading).
- Enforced by: no test covers the production behaviour; the demo flow is covered only by that e2e scenario.

## Revisit when

- Alert volume or ride volume justifies a 24/7 desk or a security partner, or
- remote push exists (replace polling), or
- the first real incident review is done.
