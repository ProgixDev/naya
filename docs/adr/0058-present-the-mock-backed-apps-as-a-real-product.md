---
id: ADR-0058
title: "Present the mock-backed apps as a real product"
status: Accepted
date: 2026-10-14
deciders: Achraf
supersedes: []
related: [ADR-0011, ADR-0012, ADR-0019, ADR-0021, ADR-0035, ADR-0036, ADR-0040, ADR-0044, ADR-0045, PAX-04, ADM-15, specs/eligibility-and-verification.md, specs/payments-and-fees.md, specs/family.md, specs/safety-sos.md, specs/car-wash.md, runbooks/demo-data.md, status/integrations.md]
---

# ADR-0058 · Present the mock-backed apps as a real product

## Context

Until 14 Oct 2026 the root AGENTS.md carried the invariant « Label every simulation ("Démo"); never present one as
live ». The apps and the admin therefore showed « Démo » badges, « Utiliser un compte démo », a prefilled
« Code de démonstration », « Simuler la confirmation / le refus » buttons, a provider sandbox page with test-card
hints, « Charger l’exemple de démo » in Naya Famille, « Photos simulées », « Déplacement simulé ×20 », an SOS sheet
titled « SOS · démonstration », and a demo-credentials panel on the admin login.

On 14 Oct 2026 Achraf decided: « remove anything about the demo and let people use any phone number and all. Make it
as a real app but with mock data we can add. » The backend stays a mock: the demo API with seeded mock data,
simulated providers and bots (ADR-0011, ADR-0012). Only what people see changes.

This replaces the labelling invariant for the UI. It also replaces the « shown with a "Démo" label » clause of
ADR-0021 (the rest of ADR-0021 stands: phone + OTP, fixed code in dev mode, hashed codes, expiry, lockout) and the
label clauses of the Proposed ADR-0035 (item 7), ADR-0040 and ADR-0044 (item 5).

## Decision

Present the passenger app, the driver app and the admin as a real product running on mock data:

1. **No demo wording in the UI.** No « Démo », « démo », « démonstration », « simulé(e) », « Simuler », « exemple de
   démo », « compte démo », test-card hints or scenario-launcher entry anywhere a user or an operator looks. Internal
   identifiers stay (`DEMO_MODE`, `NAYA_DEV`, `demo-api`, `/dev` routes, provider ids `demo-*`, `tok_demo_*`).
2. **Mock outcomes happen on their own.** Sign-in codes arrive like an SMS (a local notification « Naya », or an
   in-app message card when notifications are off and on the web). Payments, recharges, top-ups and withdrawals are
   answered by the mock provider after a short, realistic delay. In standalone builds the on-device reviewer takes a
   new dossier up and approves it 20–40 s after submission. Bots act behind the scenes and their timeline lines read
   like real events.
3. **Copy stays true for the mode it runs in.** Never claim what did not happen. In connected mode an SOS reaches the
   admin SOS desk and the sheet says so; in standalone builds there is no desk, so the sheet says « Alerte
   enregistrée » and offers the 19 call, without claiming that a team was notified. « Appeler le 19 (police) » is
   always a real call.
4. **Mock outcomes exist only in mock builds**, that is builds that talk to the demo API (embedded on the phone or
   `pnpm api`): the timed provider answers, the on-device reviewer and the bots come from it. The fixed code and its
   delivery on the device, the stand-in proof photos and `/dev` also need dev mode (`NAYA_DEV` unset or `1`, always
   on in the embedded API). A production build talks to a production backend with real providers (ADR-0045) and must
   not ship the demo API (P9, UI-04).
5. **Mock data is data.** Mock records live in `services/demo-api/src/seed.ts` (`MOCK_FAMILIES`, accounts, cards,
   payout accounts, vehicles), in `services/demo-api/fixtures/` and in `packages/assets/mock/` (photos), never inside
   screens.
6. **Developer tools are hidden.** The scenario launcher has no visible entry point: a 2 s long press on the welcome
   logo, or the deep link (naya://dev, naya-chauffeuse://dev), in development builds (`__DEV__`) only.

## Consequences

- Testers can no longer tell a mock outcome from a live one by looking at the screen. Whoever hands out a build must
  say that it runs on mock data, and no build may be offered to the public as a live service while ADR-0045 is open.
- The admin login shows no credentials; the seeded admin accounts stay valid (runbooks/demo-data.md lists them).
- Release builds (TestFlight) have no scenario launcher any more: a tester starts over by reinstalling the app.
- New accounts go through the real document flow. In standalone builds every dossier submitted on the phone is
  approved; corrections and refusals come only from a person in the admin (connected mode).
- Some deterministic test hooks stay but are never mentioned in the UI: the card tokens ending 0002 (declined) and
  3155 (left pending), the payout account ending 0000 (refused), `/dev/providers/...` to force an outcome.
- The e2e suite drives the new flows: the code arrives in the `sms-code` card, documents are imported through
  `import-photo`, recharges show `recharge-processing` until the timed answer, a refusal is forced through the dev
  API, Salma's family is seeded. Runbooks e2e.md and demo-data.md describe them.
- Stores seeded before this change keep their old labels until a reset (plates « DÉMO-00x », « Carte de
  démonstration », « (démo) » provider names in past records). The server cleans card and provider labels on read;
  `POST /dev/reset` or `pnpm demo:reset` reseeds. A schemaVersion bump is not used (it would wipe testers' data).
- apps/web (marketing site and its disconnected `/backoffice` prototype) is out of scope: its demo booking is not
  backed by any API, so its « démonstration » wording stays true.

## Alternatives considered

- **Keep the « Démo » labels (the previous invariant).** Honest to testers, but the owner wants the apps judged as a
  product, and the labels were spread through every screen.
- **Gate the labels behind a flag** (ADR-0044 item 5). Keeps two UIs to maintain and test; rejected by the owner's
  decision.
- **Build real providers now.** Out of reach for this stage; ADR-0045 stays open.

## Evidence

Changes on branch `integration/trial-2026-10-14` after `7393e27`.

- Sign-in code delivery: `packages/ui/src/features/auth.tsx` (`deliverSignInCode`, `sms-code`); tested by
  `packages/ui/src/__tests__/auth.test.tsx` and `e2e/tests/passenger-flows.spec.ts` (S01).
- On-device reviewer: `services/demo-api/src/embedded.ts` (`REVIEW_PICKUP_MS`, `reviewDelayMs`); tested by
  `services/demo-api/test/embedded.test.ts`.
- Timed provider answers: `services/demo-api/src/services/finance.ts` (`createRecharge`, `deliverDueProviderJobs`),
  `services/demo-api/src/services/prototype.ts` (`settleDueWalletTopups`); tested by
  `services/demo-api/test/scenarios.test.ts`, `prototype.test.ts`, `e2e/tests/driver-flows.spec.ts` (S12, S16).
- SOS copy per mode: `packages/ui/src/features/prototype.tsx` (`sos-recorded`); tested by
  `e2e/tests/scenarios-feedback.spec.ts` (connected mode).
- Seeded family and mock photos: `services/demo-api/src/seed.ts` (`MOCK_FAMILIES`), `packages/assets/src/mock.ts`.
- Hidden launcher: `packages/ui/src/features/DevLauncher.tsx` (`DevLauncherGesture`), `apps/*/src/app/dev.tsx`.

## Revisit when

A build is offered to people outside the team, or the first live provider (SMS, payments or identity review) is
connected: then decide how a mixed mock/live build tells the two apart (ADR-0045).
