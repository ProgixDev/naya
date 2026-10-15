---
title: "Safety and SOS"
status: Current
owner: Achraf
last_verified: 2026-10-13 @ c38429d + branch chore/docs-foundation-and-fixes
related: [ADR-0058, ADR-0009, ADR-0017, ADR-0030, ADR-0035, ADR-0037, ADR-0039, ADR-0042, ADR-0044, ADR-0045, P2, P5, P9, ADM-03, API-04, DOM-05, DOM-11, PAX-03, PAX-11, PRD-06, PRD-23, PRD-24, UI-05, UI-17, DRV-13, VIS-01, VIS-02, VIS-23, VIS-24, specs/family.md]
---

# Safety and SOS

**Status marks:** ✅ matches intent · ⚠️ known defect (backlog ID) · ❓ open (Proposed ADR). See [_template.md](_template.md).

Line numbers refer to commit `c38429d`, except where a line says **(branch)**: those refer to branch `chore/docs-foundation-and-fixes` as checked on 2026-10-13, which changed who handles alerts and how (R9–R12) and moved lines in `services/demo-api/src/services/prototype.ts`.

## Purpose

The SOS control on rides and Naya Famille trips: what it records, who sees it, and what happens next. Today it records an alert with a position, lets the reporter log simulated actions, and lets an admin take the alert in charge and close it. **Every action is simulated, in every build.** What SOS does at launch is not decided ([D2](../status/open-questions.md#d2-sos-at-launch), [ADR-0035](../adr/0035-sos-production-model.md)).

Out of scope: support tickets in the « Sécurité » category (planned `specs/support-and-disputes.md`), passenger–driver calls (planned `specs/contact-and-notifications.md`), ending a ride early ([ADR-0042](../adr/0042-ride-exception-paths.md)), the Famille trip itself ([family.md](family.md)).

## Actors

| Actor | Surface | Role in SOS |
|---|---|---|
| Passagère on a ride | passenger app, ride screen | Raises an alert, logs simulated actions. |
| Chauffeuse on a ride | driver app, ride screen | Same. |
| Parent and chauffeuse on a Famille trip | trip card in « Naya Famille » (both apps) | Same, tied to the family trip. |
| Trusted contact | free-text name in the SOS sheet | Nobody is contacted. |
| Safety desk | apps/admin, « Alertes SOS » (`/sos`) | Admins with `safety.respond` (the support agent has it), or `config.edit` for admin records stored before that permission existed. |
| Emergency services | phone numbers in copy and `tel:` links | The phone dials them; Naya does not connect the call (R12). |

## Rules

### Raising an alert

**R1 · An alert is always tied to a ride or a Naya Famille trip that the reporter takes part in.** ✅ ❓

- Enforced at: `services/demo-api/src/services/prototype.ts:800-804` (« Une course doit être associée à l’alerte. »), `:808-823` (reporter is the passenger, the driver or the parent).
- Tested by: `services/demo-api/test/prototype.test.ts:197` "records SOS simulation actions, enforces ownership and supports admin resolution" (another passenger gets 404).
- Gap: whether SOS exists outside a ride or trip is open ([ADR-0035](../adr/0035-sos-production-model.md)).

**R2 · The control « SOS · sécurité » is a neutral secondary button. It shows on the passenger ride screen in every state that screen renders, including the search for a driver; on the chauffeuse's ride screen; and on every Famille trip card that is not completed, for the parent and for the chauffeuse.** ⚠️

- Enforced at: `apps/passenger/src/app/(app)/ride.tsx:173`; `apps/driver/src/app/(app)/ride.tsx:214`; `packages/ui/src/features/prototype.tsx:749` (trip card), `:83-88` (button).
- Tested by: `e2e/tests/scenarios-feedback.spec.ts:52-54` (chauffeuse on a family trip). The test reloads the page to close the sheet (`:78-79`).
- Gap: P5, VIS-01. Audit default for D2: a danger-styled control shown from `driver_assigned` onwards, closable from the UI.

**R3 · Raising an alert is idempotent for a given Idempotency-Key, but the app sends a new key on every tap.** ⚠️

- Enforced at: `services/demo-api/src/services/prototype.ts:806` (`idempotent`, key required by default at `services/demo-api/src/app.ts:125-128`; [ADR-0009](../adr/0009-idempotency-key-is-required-on-booking-money.md)); `packages/ui/src/features/prototype.tsx:33`, `:70-73` (fresh key per call).
- Tested by: `services/demo-api/test/prototype.test.ts:212-225` (same key returns the same alert).
- Gap: a retry after a network error creates a second alert (UI-17).

**R4 · The alert stores the position the app sends. On a ride that is the driver's last known position, or else the pickup point; on a Famille trip it is the simulated trip position. The reporter's phone GPS is never read.** ⚠️

- Enforced at: `apps/passenger/src/app/(app)/ride.tsx:173` and `apps/driver/src/app/(app)/ride.tsx:214` (`ride.driverLocation?.location ?? ride.route.stops[0]!.location`); `packages/ui/src/features/prototype.tsx:749` (`t.location`), which the server moves step by step (`services/demo-api/src/services/prototype.ts:710-718`).
- Tested by: **not tested**.
- Gap: P5, PAX-03.

**R5 · The trusted contact is an optional free-text name (« Aucun proche indiqué » when left empty, since 14 Oct 2026; « Contact de confiance » before). Naya contacts nobody: the reporter can share her position herself with « Prévenir un proche » (R6).** ⚠️ ❓

- Enforced at: `packages/ui/src/features/prototype.tsx:62`, `:106-110`; `services/demo-api/src/services/prototype.ts:797`.
- Tested by: **not tested**.
- Gap: trusted contacts saved in the profile, with a phone number, are part of the live model to decide ([ADR-0035](../adr/0035-sos-production-model.md)).

**R6 · Since 14 Oct 2026 the sheet offers two real actions, each logged on the alert once done: « Appeler le 19 (police) » opens `tel:19` (« Appel au 19 lancé »), and « Prévenir un proche » opens the phone's share sheet with a map link (« Position partagée avec un proche », logged only when shared). The copy is true for the mode it runs in ([ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md)): connected builds say the alert is « Transmise à l’équipe sécurité Naya avec votre position »; standalone builds, which have no desk, say the alert and the position are recorded and never claim that a team was notified.** ✅ ⚠️

The sheet is titled « SOS · sécurité » and shows no demo wording. Before 14 Oct 2026 it was titled « SOS · démonstration », « Les appels et les envois sont simulés. », and its four actions (« Appel urgence simulé », « Position partagée (simulation) », « Contact de confiance alerté (simulation) », « Support contacté (simulation) ») called and sent nothing; the server still accepts those names from older builds and records them under the new wording (`SOS_ACTION_LABELS`).

- Enforced at: `services/demo-api/src/services/prototype.ts` (`SOS_ACTION_LABELS`, `POST /prototype/sos/:id/action`, own alert only); `packages/ui/src/features/prototype.tsx` (`SafetyButton`: `callPolice`, `sharePosition`, `desk`).
- Tested by: `services/demo-api/test/prototype.test.ts`; `e2e/tests/scenarios-feedback.spec.ts` (connected copy « équipe sécurité », `sos-call-police`; the admin sees « Alerte déclenchée · position enregistrée »).
- Gap: not gated by demo mode (P9, UI-05, DRV-13; [ADR-0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md)). The API uses the French labels as enum values ([ADR-0039](../adr/0039-future-of-the-prototype-module.md)).

**R7 · The reporter keeps sight of her alert only while the sheet's screen stays mounted. Since 14 Oct 2026, in connected mode, the open sheet polls the alert and shows the desk's status (« Prise en charge », « Résolue » with its note); standalone builds have no desk.** ⚠️

The alert lives in component state (`packages/ui/src/features/prototype.tsx:61`). `GET /prototype/sos` returns her alerts with their current status (`services/demo-api/src/services/prototype.ts:847-852`; branch `:978-983`, which also carries the owner's name, `resolvedAt` and `resolutionNote`), but no screen calls it (`api.prototype.alerts`, `packages/api/src/client.ts`).

- Tested by: **not tested** in the apps.
- Gap: P5, PRD-06, VIS-23.

**R8 · An alert has no effect on the ride or the trip.** ❓

The SOS routes never change a ride or trip status (`services/demo-api/src/services/prototype.ts:790-876`). A ride in progress can only be completed, which charges the full fare (`packages/domain/src/machines/ride.ts:23`).

- Tested by: `packages/domain/test/machines.test.ts:28-29` (cancelling an in-progress ride throws).
- Gap: DOM-05; [ADR-0042](../adr/0042-ride-exception-paths.md) and [ADR-0035](../adr/0035-sos-production-model.md).

### Handling an alert

**R9 · Admins with `safety.respond` see and handle alerts on the « Alertes SOS » page. Both seeded admins hold it, the support agent included. Admins holding `config.edit` keep access too, so admin records stored before the permission existed need no reseed.** ✅

At `c38429d` alerts lived only in the « SOS » tab of « Services et familles », behind `config.edit`, so the support agent could not see them (`services/demo-api/src/services/prototype.ts:877-878`, `:926-928`; `apps/admin/src/router.tsx:75`).

- Enforced at (branch): `safety.respond` in `AdminPermission` (`packages/domain/src/entities.ts:60`); `canRespondToSafety` (`packages/domain/src/prototype.ts:158-159`); `safetyResponder` (`services/demo-api/src/services/prototype.ts:551-557`) on `GET /admin/prototype/alerts` (`:1057-1073`) and `POST /admin/prototype/alerts/:id` (`:1074-1129`); seeded admins (`services/demo-api/src/seed.ts:300-301`); route `/sos` (`apps/admin/src/router.tsx:73`), menu entry and open-alert badge, both through `useAllowed` and `useSosAlerts` (`apps/admin/src/components/Layout.tsx`), and an Overview card (`apps/admin/src/pages/Overview.tsx`).
- The list (`adminAlert`, `services/demo-api/src/services/prototype.ts:340-388`) adds the reporter's phone, the city, and the ride or family trip concerned. Order: new alerts first, then those taken in charge, each by arrival; resolved alerts last, newest first. The `/sos` page (`apps/admin/src/pages/Sos.tsx`) shows the position on a map, a link to the ride for `rides.read` holders, the reporter with a `tel:` link, the owner and the timeline. One query feeds the page, the badge and the card: polled every 10 s, every 5 s while `/sos` is open; there is no sound.
- `GET /admin/prototype` (catalog, families, wallets) still needs `config.edit`.
- Tested by (branch): `services/demo-api/test/prototype.test.ts:337` "lets the support agent run the SOS queue with forward-only statuses" (the support agent lists, takes charge and resolves; 403 without either permission; the `config.edit` fallback). `e2e/tests/scenarios-feedback.spec.ts:61-77` still drives the old tab as the full admin (13 Oct run in the [verification log](../quality/verification-log.md)).
- Gap: the old « SOS » tab of `/services` remains, with raw coordinates (VIS-24); whether `config.edit` keeps SOS access is [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) (DOM-11). A store created before the permission keeps the support agent's old record until a demo reset.

**R10 · Statuses only move forward: `new` → `responding` or `resolved`, `responding` → `resolved`. Taking charge needs no note; closing needs a note of at least 3 characters.** ⚠️

At `c38429d` any status could follow any other, `resolved` back to `new` included, and every change took a 1–300 character note (`services/demo-api/src/services/prototype.ts:929-938`).

- Enforced at (branch): `SAFETY_TRANSITIONS` (`packages/domain/src/prototype.ts:145-152`), checked in `POST /admin/prototype/alerts/:id` (`services/demo-api/src/services/prototype.ts:1089-1096`). Any other change, the same status again included, gets 409 `INVALID_TRANSITION`; the same status reads « Cette alerte est déjà « Prise en charge » (owner). ». Closing without a note gets `REASON_REQUIRED`, « Ajoutez une note de résolution : ce qui a été fait et avec qui. » (`:1097-1102`). Taking charge records the admin as owner (`ownerId`, `ownerName`) and logs « Alerte prise en charge » when no note is sent; closing records `resolvedAt` and `resolutionNote` and logs « Alerte clôturée · » followed by the note.
- Tested by (branch): `services/demo-api/test/prototype.test.ts:337` (same test as R9).
- Gap: the old « SOS » tab in `/services` still sends fixed notes (« Prise en charge par le support de démonstration », « Alerte de démonstration résolue »; `apps/admin/src/pages/Prototype.tsx`), so a closure from there says nothing about what was done (VIS-24). The request is not idempotent: a retried « take charge » gets 409 although the first one succeeded.

**R11 · Raising an alert, each reporter action and each admin change write an audit entry.** ✅

- Enforced at (branch): `services/demo-api/src/services/prototype.ts:972` (`sos.created`), `:1003` (`sos.action`), `:1122` (`sos.taken` or `sos.resolved`; at `c38429d` a single `sos.updated`, `:944`). The admin audit page filters them under « Alertes SOS » (`apps/admin/src/pages/Audit.tsx`).
- Tested by (branch): `services/demo-api/test/prototype.test.ts:398-399` (`sos.taken`, `sos.resolved`). `sos.created` and `sos.action` are not tested.

### Emergency numbers

**R12 · The apps name the Moroccan emergency numbers correctly, and each number shown as a button dials that number.** ⚠️ ❓

Since 15 Oct 2026 (branch `feat/passenger-polish`, PAX-11, PRD-23) no screen says « SAMU ». The passenger app reads one list, `apps/passenger/src/features/help/emergency.ts`: police 19 (in cities), Protection civile 15 (fire and ambulance), Gendarmerie royale 177 (outside cities), and 112 from a mobile.

- Passenger contact sheet (`apps/passenger/src/features/ride/ContactSheet.tsx`): « Police · 19 » (`call-police`), « Protection civile · 15 » (`call-civil-protection`), « Gendarmerie royale · 177 » (`call-gendarmerie`), each a `tel:` link, and a line for 112. The sheet scrolls, so the rows stay reachable at the largest text sizes.
- Help: the « SOS et sécurité » topic names the four numbers, and its page has the same three call rows (`help-call-police`, `help-call-civil-protection`, `help-call-gendarmerie`).
- Support form, category « Sécurité » (both apps, `packages/ui/src/features/support.tsx`): a banner « En cas de danger, appelez d’abord » with the same numbers and « Une demande n’est pas un appel d’urgence. » (`support-emergency-numbers`). The old « signalements traités en priorité » promise is gone. The text is written by hand there (the UI kit cannot import the app's list).
- The SOS sheet (`packages/ui/src/features/prototype.tsx`), the chauffeuse's contact sheet (`apps/driver/src/app/(app)/ride.tsx`) and the Famille police button offer only « Appeler le 19 (police) ».
- On every sheet, a device that cannot dial shows a native alert « Appel impossible depuis cet appareil ».
- Tested by: `apps/passenger/src/features/help/__tests__/help.test.tsx` (the copy and the `tel:` links use the same numbers; no « SAMU »).
- Gap: the numbers still need confirming with local ops (D2). 141 (SAMU) is not shown.

| Number | Service, per the audit's verifiers | In the apps (15 Oct 2026) | Status |
|---|---|---|---|
| 19 | Police (in cities) | Dialled from the passenger contact sheet, the help page, the SOS sheet, the driver sheet and Famille | to confirm |
| 177 | Gendarmerie royale (outside cities) | Dialled from the passenger contact sheet and the help page; named in the support banner | to confirm |
| 15 | Protection civile (fire and ambulance), not SAMU | Labelled « Protection civile »; dialled from the passenger contact sheet and the help page | to confirm |
| 141 | SAMU (medical emergencies) | Absent | to confirm |
| 112 | Emergency number from mobile phones | Named on the contact sheet, in help and in the support banner; not a button | to confirm |

## States and transitions

Hand-coded, no `makeMachine`. States: `new` (« Nouvelle »), `responding` (« Prise en charge »), `resolved` (« Résolue ») (`packages/domain/src/prototype.ts:119`). Labels: `SAFETY_STATUS_LABELS` and allowed moves: `SAFETY_TRANSITIONS` (`packages/domain/src/prototype.ts:139-152`, branch); at `c38429d` the labels were inline in `apps/admin/src/pages/Prototype.tsx:252` and any move was allowed.

| From | Event | To | Who | Side effects |
|---|---|---|---|---|
| — | raise | `new` | reporter | First action « Alerte déclenchée · position enregistrée » (« Alerte de démonstration créée · position enregistrée » before 14 Oct 2026); audit `sos.created` (`services/demo-api/src/services/prototype.ts:824-841`; branch `:921-977`). |
| any | reporter logs an action | unchanged | reporter | Action appended; audit `sos.action`. |
| `new` | take charge | `responding` | `safety.respond`, or `config.edit` (R9) | Owner set; audit `sos.taken`. |
| `new`, `responding` | close with a note | `resolved` | `safety.respond`, or `config.edit` (R9) | `resolvedAt`, `resolutionNote`; owner set if none; audit `sos.resolved`. |
| `resolved` | — | — | — | Terminal: any further change gets 409 (R10). |

At `c38429d` an admin with `config.edit` could move an alert from any status to any other, with a note and the audit action `sos.updated`.

The ride or trip status never changes (R8).

## Demo vs live

| Aspect | Demo today | Live needs |
|---|---|---|
| Control and sheet | « SOS · sécurité » in every build, with no demo wording since 14 Oct 2026 (R2, R6). | The control and promise chosen in [ADR-0035](../adr/0035-sos-production-model.md). Audit default: one tap, danger style, a short cancel window. |
| Emergency call | A real `tel:19` call from the sheet, logged as « Appel au 19 lancé » (R6). | A real call to confirmed numbers (R12). |
| Position | Driver position, pickup point, or the simulated trip position (R4). | The reporter's device GPS. The passenger app uses foreground location only ([ADR-0030](../adr/0030-location-policy.md)). |
| Trusted contact | A name; Naya contacts nobody, the reporter shares her position herself through the share sheet (R5, R6). | Saved contacts with a phone number, and an SMS or a shared live-location link. |
| Desk | Connected builds: the admin « Alertes SOS » page, and the sheet says so. Standalone builds keep the alert on the phone and the sheet says only that it is recorded (fixed 14 Oct 2026; PRD-24). | A staffed desk with stated hours, an SLA, an escalation runbook, and a sound or push alert (audit section 8.5). |
| Feedback to the reporter | Connected builds: the desk's status while the sheet is open (R7). Nothing after it closes. | Status polled or pushed into both apps ([ADR-0045](../adr/0045-production-backend-and-live-integrations.md) for remote push). |
| Effect on the ride | None (R8). | [ADR-0042](../adr/0042-ride-exception-paths.md). |
| Retention | Alerts stay in the JSON store with no limit. | A retention rule for SOS records (planned `specs/privacy-and-data.md`). |

Integration status per capability: [status/integrations.md](../status/integrations.md).

## Open questions

- **What SOS does at launch, and who answers it** ([D2](../status/open-questions.md#d2-sos-at-launch), [ADR-0035](../adr/0035-sos-production-model.md)). Today: simulated. Options: (a) phone only, one tap calls the police and live GPS goes to a trusted contact; (b) (a) plus a Naya desk during staffed hours; (c) a 24/7 desk or a security partner. Audit default: (b), with copy that states the desk's hours; support agents answer through `safety.respond` (R9).
- **When the control shows.** Today: always on the ride screen, the search included (R2). Audit default: from `driver_assigned` onwards.
- **What the reporter and the other party see** after an alert, and how the status reaches them. Today: nothing (R7).
- **Position source and cadence.** One position at the alert, or live tracking until closed. Today: one simulated position (R4).
- **Trusted contacts.** Saved in the profile? Notified by SMS, push or a link? Today: a name (R5).
- **Effect on the ride.** Can an in-progress ride be ended after an SOS, and what is charged? Today: it can only be completed (R8). [ADR-0042](../adr/0042-ride-exception-paths.md).
- **SOS outside a ride or trip.** Today: refused (R1).
- **Emergency numbers.** Confirm the table under R12 with local operations. Audit default until then: 19 (police), 177 (Gendarmerie, outside the city), and 15 relabelled « Protection civile ».
- **Permissions.** Is `safety.respond` the right split, should `config.edit` keep SOS access once stores are reseeded, and does any admin need city scoping? [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md).
- **Demo gating.** Hide the simulated sheet outside demo builds. [ADR-0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md).

## Last verified

2026-10-15, AI session (branch `feat/passenger-polish`): R12 re-read against `emergency.ts`, `ContactSheet.tsx`, `help/[topic].tsx`, `topics.ts` and `support.tsx`. The rest of this page was not re-checked.

`2026-10-13 @ c38429d`, AI session; re-checked the same day against branch `chore/docs-foundation-and-fixes` (docs reconciliation).

- Read at `c38429d`: `packages/ui/src/features/prototype.tsx` (`SafetyButton`, trip card); `services/demo-api/src/services/prototype.ts` (SOS and admin routes); `packages/domain/src/prototype.ts`, `machines/ride.ts`; `packages/api/src/client.ts`; both ride screens; `ContactSheet.tsx`; `support.tsx`; `topics.ts`; `apps/admin/src/router.tsx` and `pages/Prototype.tsx`; `services/demo-api/src/seed.ts`; `services/demo-api/test/prototype.test.ts`; `e2e/tests/scenarios-feedback.spec.ts`.
- Read on branch `chore/docs-foundation-and-fixes` (not yet committed at the time): the diffs of `packages/domain/src/entities.ts`, `packages/domain/src/prototype.ts`, `services/demo-api/src/services/prototype.ts`, `services/demo-api/src/seed.ts`, `services/demo-api/test/prototype.test.ts`, `packages/api/src/client.ts`, `apps/admin/src/router.tsx`, `components/Layout.tsx`, `pages/Overview.tsx`, `apps/driver/src/app/(app)/ride.tsx`, and the new `apps/admin/src/pages/Sos.tsx`.
- Run on 2026-10-13 on the branch (fact-check pass): `vitest run test/prototype.test.ts` in `services/demo-api`, passing, including the branch test "lets the support agent run the SOS queue with forward-only statuses"; `vitest run test/machines.test.ts` in `packages/domain`, passing. Not run: the Playwright specs. Emergency numbers were not checked against any official Moroccan source; they come from the audit's verifiers.
