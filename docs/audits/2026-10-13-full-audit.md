# Naya — Full project audit

| | |
|---|---|
| Date | 13 October 2026 |
| Commit | `89aae18` on `master` plus uncommitted changes (`apps/passenger/app.config.ts`, `pnpm-lock.yaml`, `plugins/with-ios-build-paths.js`). `origin/master` is one commit ahead (`02ff3d3`). |
| Scope | Passenger app, driver app, admin (Vite), website + backoffice (Next.js), shared packages (ui, domain, api, tokens, assets), demo API, quality gates and tooling, captured screens, docs, cross-surface product coherence |
| Method | 11 area auditors working in parallel. Each finding was then re-checked by an independent verifier who tried to refute it. 3 findings were refuted and removed, and verifiers added findings the auditors missed. 462 findings remain: **1 critical, 37 high, 209 medium, 215 low**. Quality gates were run read-only. Nothing in the repo was changed. |
| Status | Immutable snapshot. Track follow-up in a backlog, not by editing this file. |

## Contents

1. Executive summary
2. Scorecard
3. Top priorities (P1–P20)
4. Feature matrix
5. Area-by-area findings (companion file)
6. Docs, specs and ADRs — the knowledge base
7. Repo hygiene, tooling and quality gates
8. Production-readiness gap
9. Decisions needed from Achraf (D1–D15)
10. Suggested next steps

---

## 1. Executive summary

- **Where it stands.** Naya is a well-built demo. It is not yet a product you can launch. The core ride loop runs end to end across the passenger, driver and admin apps: quote with frozen terms, dispatch, timed offer, ride, settlement into the driver ledger, and the admin view of the ride. All three run on one Hono demo API, which also runs on the device for the standalone TestFlight builds. Area health scores range from 4/10 (docs) to 6.5/10 (driver, demo-api).
- **The "two layers" framing holds.** The v1 core is careful and consistent. The Oct 6 feedback work (commit 89aae18) added categories, Naya Famille, the passenger wallet, SOS, disputes, dark mode, logos and the admin Services page. It was added as a loosely typed "prototype" side module: services/demo-api/src/services/prototype.ts, packages/ui/src/features/prototype.tsx and apps/admin/src/pages/Prototype.tsx. Every auditor found this layer rougher than the core. Several of its loops never close. It skips the reason, version and audit conventions. It is not limited to demo builds.
- **Biggest win: the money model.** The domain uses integer centimes and basis points with a single rounding rule, and terms are frozen at booking. The driver wallet is computed from an append-only ledger with idempotent business keys. Booking and money POSTs require an Idempotency-Key, provider callbacks are HMAC-signed, and the audit log is hash-chained. Tests assert the FINANCE.md fixtures.
- **Biggest win: core UX and design system.** On the main flows, the pearl and plum tokens, one decision button per state, labelled money figures and honest "Démo" badges read as one product. The driver wallet, withdrawal and debt screens are the strongest work in the repo. Accessibility is built into the primitives: icon buttons require a label, Reduce Motion is respected, and touch targets are 44/48 pt. The weak spots are dark mode on a few key screens, and the fact that the four surfaces only loosely share one brand.
- **Biggest win: the local quality checks pass.** All 10 packages typecheck in strict mode. 106 unit and integration tests pass in under 20 s (domain 36, demo-api 51, UI 15, web 4). The demo-api scenario tests are deterministic and cover races, permissions and standalone mode.
- **Biggest risk: safety features that look finished but are not.** The driver's app receives the Naya Famille handover codes. The pickup check only asks the driver to retype a name she can already see. The support role cannot see SOS alerts. SOS is simulated in every build and never reports back to the person who raised it. The driver's lock-screen location sharing stops when she taps "home (la course continue)". These are P1, P2, P4 and P5.
- **Biggest risk: the women-only rule is not written down.** No code, admin checklist or committed doc says how a user is shown to be eligible. "Do not infer gender" appears only in the git-ignored handoff. The Famille seed adds an adult male handover recipient, and no policy says whether that is allowed.
- **Money rules drifted in the new layer.** The category commission overrides the city commission. Casablanca's 18% becomes 15%, and commission edits in the admin have no effect. A passenger can confirm her own wallet top-up, even with NAYA_DEV=0, and that money becomes driver credit she can withdraw. Cash cancellation fees are promised "with your next ride" but never collected. Wallet payments are labelled as card or cash.
- **Operator tooling has regressed.** The admin core is well built: permissions are checked on the server, version conflicts are detected and every change requires an audited reason. But a critical focus-trap bug sends typed text to the first field of every dialog that has more than one field. "Résoudre" now rejects tickets by default. There are also two backoffices, and nobody has decided which one is the real one.
- **Demo features ship in production builds, and there is no CI.** DEMO_MODE and NAYA_DEV are on by default. No flag hides the simulated screens. Every native build bundles the embedded backend, the seed credentials and the fixture ID photos. The production profile points at https://api.naya.example. There is no CI, and the full e2e suite has not run since Oct 6.
- **Knowledge base.** There is no root CLAUDE.md or AGENTS.md. AGENTS.expo.md is a generic template that no tool loads. There are no ADRs, no PRD and no feature specs. README.md:7 calls the _handoff/ package the source of truth, but it is git-ignored (.gitignore:13). The feedback PDF is not in the repo. The docs are dated snapshots from before Oct 6. Several original constraints were reversed with no record: dark mode, vector art instead of generated images, and the Confort tier. Every new AI chat has to rediscover the project from scratch.
- **Suggested order.** 9 of the top 20 need no decision, and most are small fixes: P2–P4, P9, P10 and P12–P15. Removing the codes from the driver's data (the first half of P1) also needs no decision. Do these first. The other 11 need a decision from you. P6 (the women-only rule), P5 (what SOS does) and P7/P8 (wallet scope and commission precedence) unblock the most work. Record each decision as an ADR so the next chat inherits it.

---

## 2. Scorecard

Health is each area auditor's 1–10 rating. Counts are findings that **survived adversarial verification** (refuted findings were removed; verifier-found additions are included).

| Area | Health | Verdict | Crit | High | Med | Low |
|---|---:|---|---:|---:|---:|---:|
| Passenger app (apps/passenger) | **6**/10 | Core ride flows solid and e2e-covered; Oct 6 features half-wired (dark mode breaks home, wallet payments shown as card/cash, demo affordances ungated). | 0 | 2 | 16 | 28 |
| Driver app (apps/driver) | **6.5**/10 | D01–D18 sound with server-authoritative guards and skew-corrected offer timer; background location and offer alerts unreliable, wallet kinds mislabelled. | 0 | 2 | 18 | 24 |
| Admin dashboard (apps/admin) | **6**/10 | A00–A13 well built (RBAC, version checks, audit chain); one critical dialog-typing bug, ticket resolution now rejects by default, Services page fragile. | 1 | 5 | 17 | 18 |
| Website + backoffice prototype (apps/web) | **5**/10 | Attractive landing, but the /backoffice is a second, unauthenticated console that re-implements domain rules incorrectly; seed data now empty. | 0 | 2 | 14 | 15 |
| Shared mobile UI kit (packages/ui) | **6**/10 | Carefully built primitives with real a11y/motion care; DateField bug, idempotency-key reset on retry, dark onboarding, demo backend bundled in prod. | 0 | 2 | 20 | 22 |
| Domain, API client, tokens, assets (packages/domain, api, tokens, assets) | **6**/10 | Money, pricing, wallet projection and state machines correct and tested; the Oct 6 prototype layer bypasses them (commission override, wallet credits). | 0 | 3 | 15 | 28 |
| Demo backend (services/demo-api) | **6.5**/10 | v1 core well designed (idempotency, frozen terms, signed callbacks, audit chain, 51 tests); prototype module leaks handover codes, dev routes fail open. | 0 | 2 | 24 | 21 |
| Quality gates, tests, tooling and repo health | **5**/10 | Every local gate is green, but there is no CI, the lockfile at HEAD is stale, e2e not re-run since Oct 6, and 95% of git history is images. | 0 | 1 | 14 | 18 |
| Visual UI/UX review from captured screens | **6**/10 | Core ride/money screens look like one considered product; Oct 6 screens are a rougher layer, four surfaces only loosely share a brand, captures stale. | 0 | 4 | 23 | 23 |
| Documentation & knowledge base audit | **4**/10 | ~1,400 lines of honest prose, but no agent entry point, no ADRs/specs, git-ignored source of truth, and docs that contradict the Oct 6 code. | 0 | 6 | 16 | 11 |
| Cross-surface product coherence & feature completeness | **5**/10 | Core ride loop closes end to end in connected mode; several Oct 6 loops do not (SOS, Famille payment/dispatch, cash fees), two disconnected backoffices. | 0 | 8 | 32 | 7 |
| **Total** | | | **1** | **37** | **209** | **215** |

Full per-area detail, every finding with evidence and recommendation: [findings-by-area.md](2026-10-13-full-audit-findings.md).

---

## 3. Top priorities

The list is ranked by real impact for a women's and children's safety product heading to launch. When several areas reported the same issue, it appears once and lists every area that raised it. Severity is the highest any area gave. 9 entries need no decision. 11 need one from you.

**P1. A driver can bypass both Naya Famille child-safety checks** — high · domain, demo-api, visual, product · [needs decision]
- Why: The handover code is the only proof that a child was handed to an authorised adult, and the driver's app already receives every code. The pickup "verification" only asks her to retype the name shown on the same card.
- Evidence: services/demo-api/src/services/prototype.ts:250-257 (family() sends whole child objects, codes included, to the driver). prototype.ts:699-707 (plain-text comparison with no attempt limit). prototype.ts:688-695 (the pickup check compares the retyped first name).
- Fix: Now, with no decision needed: send drivers a payload without verificationCode, store codes hashed, limit attempts, and add a test that no driver payload contains a code. Then choose a real pickup proof (a parent-approved photo, a one-time code per trip, parent confirmation). Until then, stop calling the pickup check "vérifié".

**P2. The support team cannot see SOS alerts** — high · admin, visual, product, demo-api, domain · [no decision needed]
- Why: The only SOS queue is tab 6 of 8 under "Services et familles", which requires config.edit. The seeded support agent does not have that permission, and nothing in the menu or the Overview shows that an alert is open.
- Evidence: apps/admin/src/router.tsx:75. services/demo-api/src/services/prototype.ts:878 and :928 (GET and POST both require config.edit). services/demo-api/src/seed.ts:301 (support agent permissions).
- Fix: Add a safety.respond permission and give it to support. Add a top-level "Alertes SOS" page with an open-count badge and an Overview card. Allow only valid status changes, require a note, and show a map instead of raw lat/lng.

**P3. Admin dialogs send typed text to the wrong field** — critical · admin · [no decision needed]
- Why: Rejecting a verification, resolving a ticket, posting a finance correction and adding a city all scramble what the admin types. Typing can also silently change a select or tick a checkbox, which alters the rejection reason, the driver or the city status. The auditor and the verifier both reproduced it in headless Chromium.
- Evidence: apps/admin/src/components/ui.tsx:305-331 (useFocusTrap depends on [open, onEscape]). ui.tsx:334 (a new onEscape arrow on every render). apps/admin/src/pages/Ticket.tsx:18 (polling every 8 s re-runs the trap even when the admin is not typing).
- Fix: Keep onEscape in a ref and make the effect depend only on [open]. Focus the first field on open and restore focus on close. Add one e2e test that types with keyboard.type into a multi-field dialog, because fill() hides the bug.

**P4. Driver location tracking is tied to the ride screen, not the ride** — high · driver · [no decision needed]
- Why: Tapping "Retour à l'accueil (la course continue)" stops lock-screen sharing in the middle of a ride. If the app is killed during a ride, "Always" tracking may never stop, even after sign-out. That breaks the promise in the permission text and the Play background-location policy.
- Evidence: apps/driver/src/app/(app)/ride.tsx:56 (unmount cleanup stops tracking). ride.tsx:105 (home calls dismissTo('/')). apps/driver/src/lib/backgroundLocation.ts:16-27 (the task posts with no ride or online check).
- Fix: Start and stop tracking from (app)/_layout based on status.activeRide, including at app start and at sign-out. Pass killServiceOnDestroy:true. Have the server refuse locations from offline drivers with no active ride.

**P5. SOS on the phone is a simulation that never reports back** — high · visual, product, passenger, ui-kit · [needs decision]
- Why: SOS is a neutral secondary pill shown in every build, even while the app is still searching for a driver. Its actions are simulated. The alert lives in local state and is lost on navigation. The operator's response never comes back to the user. The recorded position is the driver's or the pickup point, not the phone's GPS.
- Evidence: packages/ui/src/features/prototype.tsx:61 (local state), :83-88 (secondary style), :125-138 (simulated actions labelled in the past tense). apps/passenger/src/app/(app)/ride.tsx:173 (location = driverLocation ?? pickup). packages/api/src/client.ts:459 (nothing calls alerts()).
- Fix: Decide what SOS does at launch (call 19/177, share live GPS with a trusted contact, alert a staffed desk) and who answers it. Then build a danger-styled one-tap control shown from driver_assigned onwards. It should use the device GPS, list actions as verbs with their own status each, and poll the alert status back into both apps.

**P6. The women-only rule is not defined or enforced anywhere** — high · docs, product · [needs decision]
- Why: This rule defines the brand and is legally sensitive. Yet nothing says how eligibility is established or what a reviewer checks. The rule against inferring gender sits only in the git-ignored handoff. Famille seeds an adult male recipient, and no policy covers it.
- Evidence: README.md:3 ("Women-only mobility service"). apps/admin/src/pages/CaseReview.tsx:153 (the review checklist has no eligibility item). services/demo-api/src/services/prototype.ts:592-597 (seeded "Père" recipient).
- Fix: Write an eligibility spec and an ADR covering the evidence required, the reviewer check, the appeal path and how Famille applies to children and recipients. Then add the check to CaseReview and add an API test.

**P7. Passengers can create wallet money that becomes withdrawable driver credit** — high · domain, demo-api, product · [needs decision]
- Why: A passenger confirms her own top-up, up to 100,000 MAD, with no provider and no dev-mode check. She pays a ride with it, and the driver receives a withdrawable ride_net_credit. Mobile-wallet rides are confirmed with no provider step at all. FINANCE.md describes none of this.
- Evidence: services/demo-api/src/services/prototype.ts:494-516 (the passenger resolves her own top-up). services/demo-api/src/services/rides.ts:625-631 (wallet and mobile_wallet are marked confirmed and the net is credited). packages/domain/src/wallet.ts:56 (rideSettlement only accepts cash | card).
- Fix: Now: only allow the resolve route in dev mode, and send top-ups through the signed provider-callback path. Then decide whether a stored-value passenger wallet is in launch scope (it needs a licensed partner), and add its rules to the domain and to FINANCE.md.

**P8. The category commission silently overrides the city commission** — high · admin, domain, docs, product · [needs decision]
- Why: The app always sends a category, and Standard's fixed 15% replaces the city rule. Casablanca rides take 15% instead of the documented 18%. Commission edits on the admin Rules page are versioned and audited, but they affect no ride booked in the app.
- Evidence: services/demo-api/src/services/rides.ts:127. packages/domain/src/prototype.ts:203 (Standard is 1500 bp). apps/passenger/src/app/(app)/quote.tsx:55,60 (the app always sends 'standard').
- Fix: Decide which commission takes precedence and record it in an ADR. For example, a category inherits the city rate unless a per-city override is set. Make the category commissionBp nullable, show the effective commission on the Rules page and the ride detail, and add an API test for a Casablanca booking with a category.

**P9. Demo features ship in production builds** — medium (raised by 7 areas) · passenger, driver, ui-kit, demo-api, admin, quality, product · [no decision needed]
- Why: DEMO_MODE and NAYA_DEV are on when their environment variables are missing. Simulated SOS, "Simuler la confirmation", the PSP sandbox, the logo gallery and the demo examples are not hidden behind any flag. Every native build bundles the embedded demo backend, the seed credentials and the fixture ID photos. The admin login page lists the demo passwords.
- Evidence: packages/ui/src/core/apiBase.ts:4-5 (flags are on by default). packages/ui/src/core/Providers.tsx:18 (static import of the embedded demo). services/demo-api/src/main.ts:13,45 (dev mode on by default, server binds 0.0.0.0).
- Fix: Turn the flags off by default. Hide every simulated screen and route unless DEMO_MODE or devMode is on. Load the embedded backend only in demo builds. Hide the demo credentials outside demo builds.

**P10. "Résoudre" now rejects support tickets by default** — high · admin, product · [no decision needed]
- Why: Commit 89aae18 put "Rejetée" first in the outcome list. An agent who writes a note and confirms therefore rejects the passenger's ticket. The status is guessed from free text. e2e test S14 should now fail, but the admin suite has not been re-run since.
- Evidence: apps/admin/src/pages/Ticket.tsx:12 and :22. services/demo-api/src/services/support.ts:85 (a regex on the outcome text).
- Fix: Split Résoudre and Rejeter into two explicit actions, or use a required select with no default. Send a status code instead of matching text. Re-run the full admin e2e suite.

**P11. Cash cancellation fees are never collected, and the driver is never paid** — high · demo-api, product, passenger · [needs decision]
- Why: Cash is the main payment method. The receipt promises the fee will be charged "avec votre prochaine course", but the payment stays pending forever. The driver who made the trip gets nothing, and the admin's pending-payments list keeps growing.
- Evidence: services/demo-api/src/services/rides.ts:439-462 (the cash fee stays pending, with no ledger entry and nothing that resolves it). apps/passenger/src/app/(app)/receipt/[id].tsx:19 (the promise).
- Fix: Choose a policy: add the fee to the next fare, require an electronic payment method when a cancellation carries a fee, or waive the fee for cash. Implement it as a ledger posting keyed ride:<id>:cancel-fee. Fix the copy and test both the passenger and the driver side.

**P12. The Services catalog editor corrupts live fares** — high · admin, product · [no decision needed]
- Why: Typing "2.5" saves 25 MAD, ten times too much. "2,5" becomes NaN. Clearing a fare "to use the city fare" saves 0 MAD, so passengers are quoted 0. A list field cannot take a second item. Editing an id duplicates the row. None of these edits asks for a reason, a confirmation or a version check.
- Evidence: apps/admin/src/pages/Prototype.tsx:491-501 (the display and parse steps lose the decimal). Prototype.tsx:512-517 (an emptied field saves 0 when it had a value before). services/demo-api/src/services/rides.ts:79 (0 does not fall back to the city fare).
- Fix: Use a typed form for each item kind: string state with toCentimes, empty meaning null for nullable fares, selects for enums and city ids, a read-only id, and zod validation. Add the same reason, diff and confirm steps as the city Rules page.

**P13. Drivers cannot type their birth date on a real device** — high · ui-kit · [no decision needed]
- Why: DateField clears itself on every keystroke, which blocks the identity step of driver onboarding. Only pasting all 8 digits at once works, which is why the web e2e tests do not catch it.
- Evidence: packages/ui/src/Form.tsx:131-135 (the effect that resets the field from props). Form.tsx:144-148 (sends partial digits to the parent). apps/driver/src/app/docs/identity.tsx:45 (the only screen that uses it).
- Fix: Reset from props only when the value is a complete ISO date that differs from the field. Send '' until the date is complete. Add RNTL tests for typing one character at a time and for backspace.

**P14. At payment time, the method is hidden or described wrongly** — high · passenger, visual, driver, product · [no decision needed]
- Why: Since categories were added, the payment row and Maintenant/Planifier are hidden below the fold of the quote sheet. When the wallet does show, it has a banknote icon and "Débitée à l'arrivée", although the money is held at booking. Receipts say "Carte · paiement confirmé". The cancel sheet promises a later fee that was already debited. Driver earnings label wallet rides "Carte" and leave them out of "Crédité au portefeuille".
- Evidence: apps/passenger/src/app/(app)/quote.tsx:189-199 (the payment row scrolls with the content and only Confirm is pinned; "Débitée à l'arrivée" is at :193). apps/passenger/src/app/(app)/receipt/[id].tsx:16-23. apps/driver/src/app/(app)/(tabs)/earnings.tsx:59,69.
- Fix: Write one paymentMethodPresentation(kind) helper (icon, timing, receipt text, fee text) and use it on the quote, cancel sheet, receipt, payments and driver earnings screens. Pin the payment row next to Confirm, and show the wallet balance with a warning when funds are short.

**P15. Dark mode makes the first screens unreadable** — high · ui-kit, passenger, visual · [no decision needed]
- Why: Both apps follow the system theme. On a phone in dark mode, the onboarding title is near-white on near-white (about 1.05:1 contrast), and the Home card is white with near-white text. The cause is colours that are hard-coded or read once when the module loads.
- Evidence: packages/ui/src/WelcomeJourney.tsx:33 (hard-coded light gradient). apps/passenger/src/app/(app)/(tabs)/index.tsx:174-178 (styles built when the module loads). apps/passenger/app.config.ts:12 (userInterfaceStyle 'automatic').
- Fix: Use themedStyles, or build styles after useTheme(). Derive the gradients from tokens. Add dark-mode screenshots of Welcome, Home, Quote and Ride to the review set. As a stopgap, force the light theme until this is fixed.

**P16. Naya Famille trips sit outside payment and dispatch** — high · product, domain, demo-api · [needs decision]
- Why: The subscription is never charged and the dedicated driver earns nothing. Dispatch ignores family trips, and each city has one auto-assigned driver, so she can be on another ride, offline or blocked for debt while a child is waiting. Family trips appear in no trip history and no admin view.
- Evidence: services/demo-api/src/services/prototype.ts:290-352 (addSubscription picks the first verified driver and logs "paiement simulé"). services/demo-api/src/services/rides.ts:245-249 (busyDriverIds ignores family trips).
- Fix: Decide the Famille model: rides with a family flag, or a separate product. Then bill through the payment layer, pay drivers through the ledger, block conflicting dispatch, and show family trips on the driver's home screen and in the admin.

**P17. Every driver can receive every category, including Scooter** — high · product, driver, domain · [needs decision]
- Why: Eligibility is a per-driver list of admin checkboxes that defaults to all categories. Vehicles have no type, so car drivers receive Scooter requests at Scooter prices, and drivers cannot see which categories they serve. Scooter's licence, insurance and helmet checks are not modelled.
- Evidence: services/demo-api/src/services/rides.ts:262 and :370 (defaults to every category). packages/domain/src/entities.ts:108-114 (VehicleDetails has no type).
- Fix: Decide whether Scooter is in scope for launch. Add a vehicle type and class to the vehicle record, and derive eligibility from the approved vehicle, with no categories by default and an admin override.

**P18. There is no path to production yet, and no CI protects the demo** — high · product, quality · [needs decision]
- Why: The production EAS profile points at a placeholder API, and all data lives in one JSON file. There is no push, no number masking, no payment provider, no KYC storage and no account deletion. There is also no CI, and the full 40-test e2e suite has not run since Oct 6: the last report contains one test.
- Evidence: apps/passenger/eas.json:36 and apps/driver/eas.json:36 (https://api.naya.example). services/demo-api/src/store.ts (single-writer JSON store). The repo root has no .github directory.
- Fix: Add CI now (typecheck, unit tests, lint, e2e) and commit the pending lockfile fix. Write a launch-readiness spec, with ADRs for the backend platform, the payments partner and KYC storage. Treat the backend, payments, KYC (CNDP, law 09-08) and remote push as launch blockers.

**P19. Knowledge base: a new AI chat starts with no Naya context** — high · quality, docs · [needs decision]
- Why: There is no root CLAUDE.md or AGENTS.md. The only agent file, AGENTS.expo.md, is a generic template that nothing loads, and it recommends npx and EAS cloud builds, which this repo does not use. There are no ADRs or specs. The "source of truth" handoff is git-ignored, and the feedback PDF is not in the repo. Original constraints were reversed with no record, so an agent cannot tell an intentional change from a bug.
- Evidence: .gitignore:13 (_handoff/). README.md:7 (names the handoff as the source of truth). AGENTS.expo.md:1-41 (a generic template).
- Fix: Write a root AGENTS.md under 150 lines and a CLAUDE.md that imports it. Commit the text parts of _handoff with a source-of-truth order. Backfill the ADRs. The AGENTS.md part needs no decision. The ADRs need you to confirm which reversals were intended: dark mode, vector art, the Confort tier, the commission precedence and the second backoffice.

**P20. There are two backoffices, and the public one is unprotected and now looks empty** — high · web, admin, visual, product, docs · [needs decision]
- Why: The public landing page links to the apps/web /backoffice. That console has no login, stores data in localStorage, uses different pricing and verification models, and has none of the Oct 6 features. The real console is apps/admin. The web seed data is pinned to 2026-10-05, so the default "Aujourd'hui" KPIs, the chart and Finance are empty today.
- Evidence: apps/web/components/landing.tsx:197-204 and :573-575 (public links). apps/web/lib/store.ts:67-171 (fixed seed dates). apps/web/components/backoffice.tsx:80 (the period defaults to today).
- Fix: Decide in an ADR between two options: apps/web becomes marketing-only and the demo links to apps/admin, or /backoffice is rebuilt on @naya/api. Until then, remove the link from the public header and make the seed dates relative to today.

---

## 4. Feature matrix

This matrix merges the feature inventories from all 11 area auditors with the verified product findings. Where two auditors disagreed, I checked the code. The main corrections are listed after the table.

**Legend.** ✅ complete · 🟡 partial, or works with a real bug · 🧪 simulated (demo stand-in for a real service) · ❌ missing · — not applicable.
**Modes.** "Connected" means the apps talk to the shared demo API on port 4010. "Standalone" is the TestFlight default: each app runs its own embedded copy of the demo API, and the other party is simulated.
**Marketing site rows.** The landing page's own status is at the start of the Notes. The Web backoffice column shows what the backoffice receives.

| Capability | Passenger | Driver | Admin (Vite) | Web backoffice | Demo API | Closes end-to-end? | Notes |
|---|---|---|---|---|---|---|---|
| **Accounts & verification** | | | | | | | |
| Phone + OTP sign-in | ✅ | ✅ | — | — | 🧪 | 🧪 demo only | No SMS provider. Fixed code 123456 in dev mode. Otherwise the random code is printed to the server console. |
| Apple / Google sign-in | 🟡 | ❌ | — | — | ❌ | ❌ | The Apple button sits behind an env flag and its result is discarded (apps/passenger/src/app/(auth)/phone.tsx:11-35). No server routes. |
| Passenger identity check (ID + selfie → human review) | ✅ | — | 🟡 | — | ✅ | ✅ connected | Admin review dialog has a focus bug, and the approval "internal note" is shown to the passenger. Standalone builds auto-approve after 3 s (services/demo-api/src/embedded.ts:41-48). |
| Driver identity + vehicle dossier | — | ✅ | 🟡 | 🧪 | ✅ | ✅ connected | Vehicles have no type or category. The web backoffice reviews 3 fictional documents stored in localStorage. |
| Women-only eligibility rule | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Not recorded in identity data or reviewer reasons. Today it exists only in the reviewer's head. |
| Account suspension / reactivation | — | — | ❌ | ❌ | ❌ | ❌ | User status is checked (services/demo-api/src/services/rides.ts:219), but nothing can set it. |
| Account deletion | 🟡 | ❌ | ❌ | — | ❌ | ❌ | Passengers can only open a generic support ticket. There is no DELETE /me. |
| **Rides** | | | | | | | |
| Immediate ride, up to 2 stops (quote → book → dispatch → offer → trip → completion) | ✅ | 🟡 | ✅ | 🧪 | ✅ | ✅ connected | Admin is read-only. The driver offer timer is hard-coded to 30 s, and a stale local phase can hide a later offer (apps/driver/src/app/(app)/offer.tsx). In standalone builds a bot plays the other party. |
| Scheduled ride | 🟡 | 🟡 | ✅ | — | ✅ | ✅ connected | Dispatch starts 15 min before pickup. Drivers never see upcoming bookings. The passenger time picker ignores the city's scheduling rules. |
| Live tracking | ✅ | 🟡 | 🧪 | 🧪 | 🧪 | 🧪 | Polling plus interpolated demo movement. Driver background location stops when the ride screen unmounts and is off in standalone builds. The real GPS path has not been tested on a device. |
| Passenger cancellation with fee | 🟡 | ✅ | — | 🧪 | 🟡 | 🟡 | Card and wallet fees settle. Cash fees stay "pending" forever and the driver is never paid (services/demo-api/src/services/rides.ts:439-488). The fee copy is wrong for wallet payments. |
| Admin action on a live ride (cancel, reassign, contact) | — | — | ❌ | 🧪 | ❌ | ❌ | SYSTEM_CANCEL exists in the ride state machine but nothing uses it. The web backoffice cancels only in localStorage. |
| Ratings | ✅ | ❌ | — | — | 🟡 | 🟡 | Passengers rate drivers, but not the other way round. The passenger rating drivers see is static seed data. |
| Receipts | 🟡 | ✅ | ✅ | — | ✅ | 🟡 | Wallet and mobile-wallet rides show "Carte · paiement confirmé" (apps/passenger/src/app/(app)/receipt/[id].tsx:21). No category. No fiscal invoice. |
| Trip history | ✅ | ✅ | 🟡 | 🧪 | ✅ | ✅ | Family trips are missing from both apps. The admin payment filter has no wallet or mobile-wallet option. |
| Push notifications (ride status, offers, support replies) | ❌ | ❌ | — | — | ❌ | ❌ | Local notifications only, and polling stops in the background. Notification toggles are saved but nothing reads them. |
| **Pricing & categories** | | | | | | | |
| Quote, fare breakdown, surge disclosure, frozen terms | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | The admin Rules page has a live fare preview. The web backoffice uses a free-typed amount. |
| Category choice at booking (Scooter / Standard / Confort) | 🟡 | 🟡 | 🟡 | ❌ | ✅ | 🟡 | Chips show no price, the ETA is a fixed number, and Scooter shows a car. The quote always starts on "standard" (apps/passenger/src/app/(app)/quote.tsx:55), so disabling Standard breaks booking. Drivers see the category on the offer only. |
| Category visible after booking | ❌ | 🟡 | ❌ | — | ✅ | ❌ | Saved in FrozenTerms.service, but not shown on the receipt, in either history or on the admin ride page. |
| Commission: city vs category | — | — | 🟡 | 🟡 | 🟡 | ❌ wrong rate | The category rate always wins (services/demo-api/src/services/rides.ts:127). Every category has a rate, so the Rules-page commission never applies (Casablanca 18% becomes 15%). The web backoffice uses one global % and applies it retroactively. |
| Driver category eligibility | — | ❌ | ✅ | — | 🟡 | 🟡 | Every driver is eligible for every category by default. Vehicles have no type, so car drivers get Scooter rides. Drivers cannot see their own categories. |
| **Payments & wallets** | | | | | | | |
| Cash | ✅ | ✅ | ✅ | 🧪 | ✅ | ✅ connected | Commission is taken from the driver wallet at completion. The driver confirms the amount collected. |
| Card | 🧪 | ✅ | ✅ | 🧪 | 🧪 | 🧪 | Demo tokens (4242 / 0002 / 3155). No payment provider. The add-card screen stands in for hosted card fields. |
| Moroccan mobile wallet (ride payment) | 🧪 | 🟡 | 🟡 | ❌ | 🧪 | 🧪 | Added automatically to every passenger. Confirms instantly with no provider step. Shown as "Carte" in driver earnings, and missing from the admin payment filter. |
| Passenger Naya wallet (top-up, holds, settlement, ledger) | 🧪 | — | 🟡 | ❌ | 🧪 | 🧪 | Passengers confirm their own top-ups, with no dev-mode check (services/demo-api/src/services/prototype.ts:494-512). Admin can only read it, under Services (config.edit), not in Finance. |
| Driver wallet, ledger, commission debt, debt-limit blocking | — | ✅ | ✅ | — | ✅ | ✅ connected | Strongest part of the codebase. Rules are tested and documented in docs/FINANCE.md. |
| Driver recharge | — | 🧪 | ✅ | — | 🧪 | 🧪 | The simulated payment page is not gated by DEMO_MODE. The provider list shows "Carte bancaire (démo)" twice and calls the mobile wallet an agency. HMAC-signed callback handling exists. |
| Driver withdrawal + payout accounts | — | 🟡 | ✅ | — | 🟡 | 🟡 | Payout accounts exist only in seed data (services/demo-api/src/seed.ts:340-343), so a newly registered driver cannot withdraw. |
| Driver earnings | — | 🟡 | — | — | 🟡 | 🟡 | Wallet and mobile-wallet rides show as "Carte" and are left out of "Crédité au portefeuille". Net includes failed or pending card rides. |
| Finance dashboard, reconciliation, corrections | — | — | 🟡 | 🟡 | ✅ | 🟡 | Admin ignores the passenger-wallet liability. A correction reuses its Idempotency-Key after the payload is edited. Web backoffice Finance is silently filtered to "today" and uses float money. |
| Refunds | — | — | ❌ | ❌ | ❌ | ❌ | The "Remboursement accordé" outcome only posts a message. No money moves. |
| **Support & safety** | | | | | | | |
| Support tickets and disputes with evidence | 🟡 | 🟡 | 🟡 | 🧪 | ✅ | 🟡 | Evidence is enforced and visible in admin. Replies cannot carry attachments, and the native apps cannot open PDFs. Resolution defaults to "Rejetée" (apps/admin/src/pages/Ticket.tsx:12,22), and rejected tickets stay in "À traiter". |
| Help centre | 🟡 | ❌ | — | — | — | 🟡 | Static FAQ. No wallet, family or SOS topics. Calls 15 "SAMU". The driver app has support tickets only. |
| SOS alert | 🧪 | 🧪 | 🟡 | ❌ | 🧪 | ❌ | The user never sees the operator's response. The stored position is the simulated driver position, not the phone's GPS. The admin queue needs config.edit. In standalone builds the copy says the alert reaches the back-office (packages/ui/src/features/prototype.tsx:99,123), but it never leaves the phone. |
| Emergency call (police 19) | ✅ | 🟡 | — | — | — | ✅ passenger | The passenger app really dials tel:19 (apps/passenger/src/features/ride/ContactSheet.tsx:20). The driver sheet shows the number as text only. |
| Masked call / message, passenger ↔ driver | ❌ | ❌ | — | — | ❌ | ❌ | Both contact sheets say numbers stay masked, but neither offers a call or message action. |
| Verified driver photo before boarding | ❌ | — | — | — | ❌ | ❌ | The driver card shows initials only. For a women-only service, this is a key safety aid. |
| **Naya Famille** | | | | | | | |
| Plans and subscription | 🧪 | — | 🟡 | ❌ | 🧪 | ❌ | No payment is ever taken. Plans are edited in the broken catalog editor. |
| Children and authorised recipients | 🟡 | 🟡 | 🟡 | ❌ | 🟡 | 🟡 | One recipient per child, with the relationship hard-coded. No edit or delete. Every recipient's handover code is sent to the driver's API (services/demo-api/src/services/prototype.ts:250-256). |
| Dedicated driver assignment | 🧪 | 🧪 | 🟡 | ❌ | 🟡 | 🟡 | Automatically picks the first verified driver in the city, without asking her. Admin reassignment fires as soon as the select changes, and the list includes ineligible drivers. |
| Recurring family trips (run, positions, timeline) | 🧪 | 🧪 | 🟡 | ❌ | 🧪 | 🧪 connected | Coordinates are always Hay Riad → Agdal, whatever address is typed (packages/ui/src/features/prototype.tsx:552-557). No dispatch, eligibility, payout or ledger. Drivers reach it only from Account. |
| Pickup and handover checks (arrival photo, child name, handover code) | — | 🧪 | 🟡 | ❌ | 🧪 | ❌ not a real control | The child-name check shows the name before the driver types it. The handover codes reach the driver's device (see the row above). |
| Parent cancels or changes a trip, ends the subscription | ❌ | — | ❌ | ❌ | ❌ | ❌ | The recurrence keeps generating trips. |
| Parent alerts (pickup, handover) | ❌ | — | — | — | ❌ | ❌ | Family notifications are stored but never displayed. Parents see progress only on the open timeline. |
| **Experience** | | | | | | | |
| Dark mode | 🟡 | 🟡 | ❌ | ❌ | — | — mobile only | The passenger home sheet's styles are fixed at light values when the module loads (apps/passenger/src/app/(app)/(tabs)/index.tsx:174-180). The ride status pill is hard-coded white (apps/passenger/src/app/(app)/ride.tsx:118). The welcome carousel uses light gradients in both apps (packages/ui/src/WelcomeJourney.tsx:33,45). The marketing site has no dark mode. |
| Logo concepts (6 directions) | ✅ | ✅ | ✅ | ❌ | — | 🟡 | No way to pick a concept or capture feedback. App icons are unchanged, and the web uses yet another symbol. The dark preview tile disappears in dark mode. |
| Original media (no generated people) | ✅ | ✅ | ✅ | — | — | 🟡 | Mobile uses vector art and initials (welcome slides 1 and 2 are identical). The landing page still shows AI-generated people. |
| Accessibility | 🟡 | 🟡 | 🟡 | ✅ | — | — | Strong UI kit (Dynamic Type, Reduce Motion, Reduce Transparency). VoiceOver does not announce toasts. At large text sizes the driver home card overlaps the status bar. Admin dialogs have a focus bug, and the admin mobile menu has no focus trap. |
| **Operations** | | | | | | | |
| Admin sign-in, roles, permissions | — | — | 🟡 | ❌ | 🟡 | 🟡 | 8 permissions and 2 seeded admins. No user management, no MFA. The login page always shows demo credentials. No permission gate on /, /villes, /villes/:id/regles or /paiements, and the Overview shows financial numbers to every role. The web backoffice has no login at all. |
| People directory and profiles | — | — | 🟡 | 🧪 | ✅ | 🟡 | Admin is read-only, and shows balances without finance.read. The web backoffice builds its passenger list from names typed into rides. |
| Cities and zones | 🟡 | — | 🟡 | 🟡 | 🟡 | 🟡 | Admin adds a 7 km square "pilot zone" in a second, separate call (apps/admin/src/pages/Cities.tsx:136-137). New cities get only disabled card providers, no cash (services/demo-api/src/services/cities.ts:61-71). Reverse geocoding always snaps to Rabat or Casablanca (services/demo-api/src/app.ts:342-348). The web backoffice's Casablanca view is always empty. |
| Versioned city rules | — | — | ✅ | 🟡 | ✅ | 🟡 | Diff, reason, version history and conflict handling all work. The commission field is overridden by categories (see above). Help copy hard-codes "2 minutes". |
| Payment providers per city | — | — | 🟡 | ❌ | 🧪 | 🧪 | Enable or disable only. Saving any row in the Services catalog re-enables recharge providers that were disabled on this page. |
| Services catalog editor (categories, plans, reasons, payment options) | — | — | 🟡 | ❌ | 🟡 | 🟡 | Broken inputs: decimals and commas cannot be typed, clearing a fare saves 0 MAD, and ids are editable (apps/admin/src/pages/Prototype.tsx:127-192,450-529). No reason, diff or version check. |
| Audit log | — | — | 🟡 | 🟡 | ✅ | ✅ | Hash-chained, with an integrity check. Admin filters miss SOS, family and catalog actions, with no export or date range. The web backoffice keeps its own local log, attributed to one hard-coded admin. |
| Service kill-switch (stop bookings) | — | — | ❌ | 🧪 | ❌ | ❌ | Works only between the landing page and /backoffice in the same browser. |
| CSV export | — | — | ❌ | ✅ | — | — | |
| Demo tooling (scenario launcher, embedded backend) | ✅ | ✅ | — | 🟡 | ✅ | — | The launcher can be opened by deep link in any build. Standalone apps never share state. The web backoffice resets only by clearing site data. |
| **Marketing site** | | | | | | | |
| Fare estimate and booking | — | — | ❌ | 🧪 | ❌ | ❌ | Landing 🧪: price = 38 + 12 × the gap between neighbourhood indexes (apps/web/components/landing.tsx:89), not the real fare formula. Always assigns Amina Bennani. The booking appears only in /backoffice in the same browser. |
| Driver application form | — | ❌ | ❌ | 🧪 | ❌ | ❌ | Landing 🧪: creates an "À vérifier" applicant in localStorage. No link to the driver app or a real dossier. |
| Content, FAQ, photography | — | — | — | — | — | — | Landing 🟡: the FAQ contradicts Naya Famille and the wallet, it still says "Naya Signature", and the photos are AI-generated people. |
| Legal: terms (CGU), privacy policy, consent links | 🟡 | 🟡 | — | — | — | ❌ | Landing ❌: only a prototype/legal modal. Both apps name the terms and privacy policy without linking to them. |
| SEO and metadata | — | — | — | — | — | — | Landing 🟡: title, description and favicon only. No OG tags, robots.txt or sitemap, and /backoffice is not marked noindex. |

**How conflicting statuses were resolved**
- **Driver dark mode:** downgraded from ✅ to 🟡. The driver screens are themed, but the shared welcome carousel and document picker use light-only colours.
- **Passenger and driver support:** downgraded to 🟡. Replies cannot carry attachments, and the native apps cannot open PDFs.
- **New cities, "no zones" vs "pilot zone":** both are partly true. The API creates a city with no zones. The admin UI then adds a 7 km square in a second call, and that call is not atomic.
- **Payment providers and audit log in admin:** marked 🟡. The API side works. The admin UI has the cross-page overwrite and filter gaps described in the table.

### What closes end-to-end and what does not

- **Closes in connected mode only.** These core loops run passenger app → demo API → driver app → admin: phone sign-in, identity and dossier review, immediate rides with stops, scheduled dispatch, cash settlement with commission debit, the driver wallet with debt blocking, and support tickets with evidence. This is real working logic on top of simulated services (fixed OTP, demo maps, interpolated movement).
- **Standalone TestFlight builds close nothing across devices.** Each app has its own embedded backend. Verification auto-approves after 3 s, and a bot plays the other party. Nothing reaches admin. The SOS copy still claims the alert reaches the back-office.
- **Closes, but with the wrong money.** The category commission always replaces the city commission (services/demo-api/src/services/rides.ts:127). Cash cancellation fees are never collected or paid to the driver. Wallet and mobile-wallet rides are labelled "Carte" on receipts and in driver earnings.
- **Every external dependency is simulated.** SMS OTP, card payments, mobile wallets, Cash Plus and Wafacash, driver recharges, passenger top-ups (which the passenger confirms herself), place search and geocoding, and GPS movement. The production EAS profile points at a placeholder, https://api.naya.example (apps/passenger/eas.json:36).
- **The 6 October features close only as a walkthrough.** Family, SOS and the passenger wallet run across passenger, driver and admin in connected mode. Each one lacks what would make it real: payment and payout for Family, a reply to the person in danger for SOS, and a licensed partner and reconciliation for the wallet.
- **Missing everywhere.** Push notifications, masked calls and messages, refunds, account suspension, account deletion, admin action on a live ride, payout account creation, driver-to-passenger ratings, parent cancellation of family trips, and the women-only eligibility rule.
- **Two backoffices that never meet.** The Vite admin uses the demo API. The Next.js /backoffice and the landing page share only one browser's localStorage. They have different data, people and pricing, plus features the other lacks: the kill-switch, CSV export and ticket priority exist only in /backoffice. The web app has no @naya/* dependency.
- **Safety controls exist as UI but do not protect.** The child-name check shows the answer first. Handover codes are sent to the driver's device. SOS cannot be seen by the support role (config.edit only).

### Status of the 10 client feedback items

The claims come from docs/MOBILE-FEEDBACK-DEMO.md ("What changed" table). Item numbers follow the client PDF, as listed in docs/MOBILE-FEEDBACK-AUDIT.md.

| # | Item | Claimed (MOBILE-FEEDBACK-DEMO.md) | Verified reality | Gap to a real product |
|---|---|---|---|---|
| 1 | Service categories | Scooter, Standard and Confort, each with an arrival estimate, configurable fares and commission, city availability and driver eligibility. Booking terms keep the category. | **Partly true.** The three categories quote and book, and FrozenTerms keeps the category. But the ETA is a fixed number per category (packages/domain/src/prototype.ts). Chips show no price, and Scooter shows a car. The quote always starts on "standard" (apps/passenger/src/app/(app)/quote.tsx:55). The category commission silently overrides the city rate (services/demo-api/src/services/rides.ts:127). The category disappears after booking. Every driver is eligible for every category by default. | A vehicle type in the dossier, with eligibility derived from it. Scooter-specific licence, insurance and helmet checks. A price on each chip. ETA based on available drivers. A decision on whether the city or the category sets commission. The category shown on the receipt, in history and in admin. |
| 2 | Family subscription with a dedicated driver | Configurable plans, child profiles and authorised recipients, a dedicated verified driver, recurring trips, arrival proof, child-name check, handover code, incidents, journey positions, and a timeline shared by both apps. | **True as a connected-mode walkthrough only.** No payment for the plan. No driver payout. Not linked to dispatch, so the driver can be offline, busy or debt-blocked. The driver is picked automatically without consent. Coordinates are always Hay Riad → Agdal. The name check reveals the name first. Handover codes go to the driver's API (services/demo-api/src/services/prototype.ts:250-256). One recipient per child. Parents cannot cancel, edit or delete anything, and get no alerts. | Subscription billing. Real addresses with zone checks and pricing. Integration with dispatch and availability. Driver acceptance and payout. Codes checked only on the server. A parent-side check or child photo. Cancel and modify. Push alerts to parents. Consent and retention rules for children's data under CNDP. |
| 3 | 5–6 logo concepts | Six original vector directions with symbols, horizontal signatures and dark previews, in both apps and admin. The app icon waits for a choice. | **True.** The gallery is in passenger, driver and admin. The dark preview tile disappears in dark mode. No way to pick a concept or record feedback. The web uses a different symbol. | Pick a direction, then update the app icons, the web and packages/assets. Remove the gallery from the customer and driver apps, since it is stakeholder material. |
| 4 | Authentic media | Illustration and vehicle components use original vector art. Avatars use initials. Generated portraits are no longer displayed. | **True on mobile, false on the web.** Welcome slides 1 and 2 show identical art. Raster images are still bundled but never shown. The landing page still shows AI-generated "passagère" and "chauffeuse" photos. packages/assets/README.md still describes the old art. | Real photography with model releases, for the web and the app stores. Remove unused raster bundles. Update asset provenance. Retake the stale screenshots. |
| 5 | SOS during rides | A confirmation screen records the journey, a fictional contact and the position. Four simulated actions appear in the timeline. Admin can take ownership and resolve. | **True as a demo, misleading in standalone builds.** The stored position is the simulated driver position. The user never sees the operator's response, because nothing calls GET /prototype/sos. Only config.edit admins can act, so the support role cannot. No Overview badge, no sound, no map, just raw lat/lng. In TestFlight builds the copy says the alert reaches the back-office (packages/ui/src/features/prototype.tsx:99,123), but it never leaves the phone. Not gated by DEMO_MODE. | Real GPS. An operator alerting chain with 24/7 staffing and an SLA. The status sent back to the user. Real trusted-contact SMS. A dedicated SOS queue and permission. Emergency numbers checked locally (15 is labelled SAMU, which is usually 141). |
| 6 | Detailed disputes | Configurable reasons, descriptions, optional or required evidence, images and PDFs, private evidence review, replies, explicit rejection, audit events. | **Mostly true.** Evidence is enforced and viewable in admin. But the resolution outcome defaults to "Rejetée" (apps/admin/src/pages/Ticket.tsx:12,22). Rejected tickets stay in "À traiter". Outcomes move no money. Replies cannot attach evidence. Reasons are not filtered by role ("cliente" wording), and agents do not see which reason was chosen. Native apps cannot open PDFs. | A neutral default outcome. Fix the open-queue filter. Connect outcomes to refunds, wallet credits and ledger adjustments. Attachments in replies. Reasons filtered by role. |
| 7 | Dark mode | Light, dark and system modes in both apps, saved between launches. Shared surfaces, text, maps and status bars follow the selected mode. | **Partly true.** The driver screens are themed. The passenger home sheet's styles are fixed at light values (apps/passenger/src/app/(app)/(tabs)/index.tsx:174-180). The ride status pill is white (apps/passenger/src/app/(app)/ride.tsx:118). The welcome carousel (both apps) and the ID document picker are light-only. The screen flashes light on cold start. Admin and web have no dark mode. | Theme the remaining passenger and shared components. Add a lint rule against literal colours. Decide whether admin and web need dark mode. |
| 8 | Moroccan wallets and payments | A passenger wallet with pending, confirmed and refused top-ups, holds, settlement and a ledger. Card, mobile-wallet, Cash Plus and Wafacash options remain demo providers. Electronic rides credit the driver once. | **True as a simulation, with real defects.** Passengers confirm their own top-ups, and the endpoint has no dev-mode check (services/demo-api/src/services/prototype.ts:494-512), so balance can be minted and then credited to drivers. Wallet and mobile-wallet rides show as "Carte". The passenger wallet is missing from admin Finance. The driver recharge list duplicates the card option. Cash cancellation fees are never collected. There are no refunds. | A licensed partner for stored value. A real card payment provider. Connectors for Cash Plus, Wafacash and mobile wallets. Refunds. Daily reconciliation. The wallet liability shown in Finance. |
| 9 | Back-office coverage | A Services page manages categories, plans, dispute reasons, payment options, driver category eligibility, family assignments, SOS, passenger wallet history and logo previews. | **The page exists, but the editor is broken.** Decimals and commas cannot be typed, enum values are free text, and ids are editable (apps/admin/src/pages/Prototype.tsx:127-192,450-529). Clearing a fare saves 0 MAD. Saving any row re-enables recharge providers disabled on Paiements. The whole page needs config.edit. Changes carry no reason, diff or version. The Next.js /backoffice has none of these features. | Typed, validated forms. Reason plus audit with before and after values. Separate permissions (for example SOS handling and family management). One backoffice instead of two. |
| 10 | Configurable architecture | Catalogs come from the API. City and rules admin is kept. New cities get clearly labelled demo places instead of Rabat results. | **Partly true.** The catalogs do come from the API. Place search returns "(démo)" places for new cities (services/demo-api/src/app.ts:333-341). But reverse geocoding still snaps to Rabat or Casablanca (app.ts:342-348). Adding a city and its zone is not atomic. New cities get only disabled card providers, so cash cannot be offered (services/demo-api/src/services/cities.ts:61-71). City commission is ignored for every app booking. Help copy hard-codes rule values. | A real places and geocoding provider. A polygon zone editor. Atomic city setup with a launch checklist (zones, providers including cash, rules). A clear rule for commission precedence. Copy generated from the rules. |

---

## 5. Area-by-area findings

Every verified finding, with evidence, detail and fix, is in the companion file [2026-10-13-full-audit-findings.md](2026-10-13-full-audit-findings.md), together with each area's strengths, full feature inventory and open questions.

| Area | Findings | Jump to |
|---|---:|---|
| Passenger app (apps/passenger) | 46 | [passenger](2026-10-13-full-audit-findings.md#passenger) |
| Driver app (apps/driver) | 44 | [driver](2026-10-13-full-audit-findings.md#driver) |
| Admin dashboard (apps/admin) | 41 | [admin](2026-10-13-full-audit-findings.md#admin) |
| Website + backoffice prototype (apps/web) | 31 | [web](2026-10-13-full-audit-findings.md#web) |
| Shared mobile UI kit (packages/ui) | 44 | [ui-kit](2026-10-13-full-audit-findings.md#ui-kit) |
| Domain, API client, tokens, assets (packages/domain, api, tokens, assets) | 46 | [domain](2026-10-13-full-audit-findings.md#domain) |
| Demo backend (services/demo-api) | 47 | [demo-api](2026-10-13-full-audit-findings.md#demo-api) |
| Quality gates, tests, tooling and repo health | 33 | [quality](2026-10-13-full-audit-findings.md#quality) |
| Visual UI/UX review from captured screens | 50 | [visual](2026-10-13-full-audit-findings.md#visual) |
| Documentation & knowledge base audit | 33 | [docs](2026-10-13-full-audit-findings.md#docs) |
| Cross-surface product coherence & feature completeness | 47 | [product](2026-10-13-full-audit-findings.md#product) |

---

## 6. Docs, specs and ADRs — the knowledge base

### 6.1 Direct answer — does Naya have specs? ADRs? an agent entry point?

**Specs: no.** No PRD and no feature spec is committed.

- The closest thing is the original implementation prompt, _handoff/Naya-Expo-React-Native-Implementation-Prompt.md (240 lines). It is git-ignored (.gitignore:13), so it exists only on this Mac. README.md:7 still calls the handoff package the source of truth.
- The 10-page feedback PDF behind the Oct 6 work is not in the repo (no *.pdf outside node_modules and work/).
- Rules for Naya Famille, SOS, the passenger wallet, service categories, disputes and cities exist only in code. Examples: FAMILY_NEXT at packages/domain/src/prototype.ts:168-175, the SOS routes at services/demo-api/src/services/prototype.ts:790-876, the 11 dispute reasons at packages/domain/src/prototype.ts:253-271.
- One partial exception: docs/FINANCE.md is a real, testable spec for the driver wallet. It matches packages/domain/src/money.ts:6,25,40 and names the tests that enforce it.

**ADRs: no.** There is no adr/ or decisions/ folder. Decisions live in commit messages (96af8c6, 74a1c14, 0e0b066, afac0b1, 89aae18) and in prose. At least five original constraints were reversed with no record:

- dark mode: userInterfaceStyle 'light' → 'automatic' in 89aae18;
- vector art replaced the generated PNG characters (packages/ui/src/Brand.tsx:21-28, against handoff prompt:85);
- a premium "Naya Confort" tier (packages/domain/src/prototype.ts:209-222, against prompt:85 "car colour variants never imply a premium fare tier");
- a second backoffice in apps/web (afac0b1);
- category commission now overrides city commission (services/demo-api/src/services/rides.ts:127).

An agent that reads the handoff today gets explicit instructions to undo current behaviour.

**Agent entry point: no.** There is no root AGENTS.md or CLAUDE.md. A Claude Code or Codex session opened at the repo root loads nothing about Naya. What exists:

- AGENTS.expo.md (41 lines). A generic Expo template. Because of its non-standard name, no tool auto-loads it and nothing references it. Parts are wrong for this repo: bun (:13), `npx expo install` instead of pnpm (:16), EAS cloud builds instead of local Xcode archives (:34), app.json instead of app.config.ts (:39).
- apps/web/AGENTS.md and apps/web/CLAUDE.md. The Next.js block that `next dev` writes. Useful, but only inside apps/web, and it says nothing about Naya.
- apps/passenger/.claude/settings.json and apps/driver/.claude/settings.json. They only enable the Expo plugin.

**What is good.** About 1,400 lines of honest prose: precise money invariants, a clear real-vs-simulated table, a Figma-ID-to-route map, hard-won native build notes (README.md:109-114), demo accounts that match services/demo-api/src/seed.ts exactly, and a feedback audit with a file:line evidence index. The problem is upkeep, not quality. The docs are dated snapshots that were added to, never updated. Commit 89aae18 (Oct 6) touched 130 files. It added 4 README lines and two new docs, and left FINANCE, INTEGRATIONS, SCREENS and DESIGN untouched. A second contributor (Arselene, commit 02ff3d3 on origin/master) now works from a clone that cannot see the original spec at all.

Docs area score: 4/10.

### 6.2 Inventory of existing docs

"Last meaningful update" is the last commit that touched the file (git log), with a note where the content is older.

| File | Purpose | Last meaningful update | Verdict | Key problems |
|---|---|---|---|---|
| README.md (190 lines) | Setup, run, native builds, demo accounts, scenarios, verification | Body Sep 30; 89aae18 (Oct 6) added 4 lines | Partly wrong | Layout (:9-27) omits apps/web, plugins/, scripts/. Doc index (:26, :181-186) lists 4 of 7 docs. `cp .env.example .env` (:62) has no effect. `pnpm test` (:153) is described as unit tests but also runs Playwright. The verification table is from Sep 30 (:162-179). :7 points to a git-ignored source of truth. :20 presents NativeWind as the mobile styling system. :190 tells you to use npm for apps/web. |
| AGENTS.expo.md (41) | Generic Expo agent rules | 96af8c6, Sep 30 | Wrong for this repo, and not loaded | Non-standard name, nothing references it. bun, npx, EAS-cloud and app.json guidance conflicts with the pnpm workspace, local archives and app.config.ts. |
| docs/FINANCE.md (58) | Money model: centimes, fare formula, driver wallet, idempotency | f0f8d46, Sep 30 | Partly wrong | Accurate for the driver wallet. Nothing on the passenger wallet, categories, or wallet/mobile_wallet settlement. :18 says Casablanca commission is 18 %, but app bookings get 15 %. :24, :57 and :58 state general guarantees that the passenger wallet breaks. |
| docs/INTEGRATIONS.md (21) | What is real and what is simulated | f0f8d46, Sep 30 | Stale | No rows for SOS, wallet top-up providers (Wallet marocain, Cash Plus, Wafacash), family proofs or on-device persistence. :20 says "nothing is dialled", but ContactSheet.tsx:20 dials tel:19. |
| docs/DESIGN.md (65) | Design direction, principles, a11y, motion | 0e0b066, Oct 1 | Partly wrong | Undated log with sections appended at :47, :58, :61. :5 and :53 say the generated art is kept, which is no longer true. No dark mode section, no logo concepts. |
| docs/SCREENS.md (91) | Figma ID ↔ route ↔ evidence; S01–S16 scenario index | 0fa0487, Sep 30 | Stale | Missing routes: passenger wallet, family, brand, dev; driver family, brand, dev; admin /services. The 402/ and feedback/ capture folders are not described. Admin captures predate two admin redesigns. |
| docs/screens/passenger/README.md (28) | Capture index | f0f8d46, Sep 30 | Stale | No Oct 1 or Oct 6 captures listed. |
| docs/STANDALONE-DEMO.md (28) | On-device demo and TestFlight notes | d6a21d0, Oct 1 | Historical | No inbound link. Build numbers 2/3 at :3, :13 (now 3/4 locally and 4/5 on origin). Says 43 tests (now 51). |
| docs/MOBILE-FEEDBACK-AUDIT.md (94) | Before-state gap audit of the feedback PDF | 89aae18, Oct 6 | Historical | Good evidence index, but its line numbers match afac0b1 and no commit is named (:62). Its 7 findings have no status; finding 3 (masked-number copy) is still open. :83-93 says typecheck and lint could not run, which is superseded. |
| docs/MOBILE-FEEDBACK-DEMO.md (56) | Walkthrough and verification of the Oct 6 features | 89aae18, Oct 6 | Current | The best description of the Oct 6 features. Not a spec. Does not close the audit's findings. |
| apps/web/README.md (32) | Website and backoffice prototype | afac0b1, Oct 5 | Partly wrong | npm vs pnpm ambiguity (:7 vs :11-13). :13 says "no browser automation", but tests/prototype.spec.ts has 5 Playwright tests (not wired to any script). |
| apps/web/DESIGN.md (61) | Web design reference lock | afac0b1, Oct 5 | Current (web only) | Its photoreal generated-people policy conflicts with the mobile vector policy. |
| apps/web/UI-UX-AUDIT.md (164) | Web UI/UX audit and follow-up | afac0b1, Oct 5 | Historical | 12 absolute /Volumes/... links (:21-26, :146-150, :164) that break in any other clone. No resolution status. |
| apps/web/PHOTO-PROMPTS.md, PHOTO-REFERENCE-PROMPTS.md, PHOTO-MOROCCAN-PROMPTS.md (23/32/25) | Image prompts | afac0b1, Oct 5 | Historical; only the Moroccan set is in use | Two of the three sets produced images that are no longer referenced (about 13 MB in apps/web/public/images). |
| apps/web/AGENTS.md (9) and CLAUDE.md (1) | Next.js agent rules | afac0b1, Oct 5 | Current | Auto-generated by `next dev`. Next-only, no Naya context. Keep it. |
| packages/assets/README.md (9) | Asset provenance | 177cbd6, Sep 30 | Partly wrong | Says the PNG characters are the displayed art. Since 89aae18, Brand.tsx renders SVG. |
| _handoff/README.md (79), QA.md (44), Naya-Expo-React-Native-Implementation-Prompt.md (240), project-manifest.json (263 frames, 16 scenarioPaths) | Original Figma deliverable, QA checklist, implementation spec, frame manifest | Sep 30 | Historical and partly superseded; git-ignored | The only PRD-like document. Invisible to clones and to the second contributor. Holds rules found nowhere else: state ownership (prompt:98-103), manual review with no gender inference, 30 s offers that never auto-accept, scheduled ≠ assigned (prompt:164-178), licence notes (README:76). Also holds rules the code has since reversed (prompt:85). |
| Feedback PDF (10 pages) | Source of the Oct 6 work | — | Missing | Not in the repo. Only paraphrased in MOBILE-FEEDBACK-AUDIT.md. |

Also at the root: achref-dev-skill-debt/ and achref-dev-skill-debt-images.zip (13 MB) are untracked files from an unrelated project. An agent that globs *.md will read them.

### 6.3 Contradictions and stale claims found

**Money**

- **Casablanca commission.** docs/FINANCE.md:18 (and handoff prompt:186) say 18 %. App bookings get 15 %. The passenger app always sends a category (apps/passenger/src/app/(app)/quote.tsx:55 defaults to 'standard'), and rides.ts:127 freezes `quote.service?.commissionBp ?? rules.commissionBp`. Standard is 1500 bp in every city (packages/domain/src/prototype.ts:189,203). So the commission an admin sets on the Rules page (A11) never applies to app bookings. Tests miss this because they create quotes without a categoryId (services/demo-api/test/prototype.test.ts:9,50,194).
- **"The wallet is a projection, never a mutable number"** (FINANCE.md:24). True for the driver wallet. The passenger wallet edits hold entries in place (services/demo-api/src/services/prototype.ts:171-175) and marks released holds 'failed' (:150-157). GET /prototype/wallet writes state outside a transaction (:450-452), against FINANCE.md:57.
- **"No optimistic confirmation"** (FINANCE.md:58). wallet and mobile_wallet payments are confirmed at ride completion with no provider step (rides.ts:625-629).
- **Cash cancellation fees.** The receipt says the fee is "à régler avec votre prochaine course" (apps/passenger/src/app/(app)/receipt/[id].tsx:19). Nothing collects it: the payment stays pending forever and the driver is never credited (rides.ts:439-462).

**Product and safety rules**

- **Source of truth.** README.md:7 names Figma plus the handoff package. The handoff is git-ignored (.gitignore:13), and the Oct 6 features have no Figma frames.
- **Reversed handoff rules with no record.** Premium tier forbidden (prompt:85) vs Naya Confort (packages/domain/src/prototype.ts:209-222; packages/assets/src/images.ts:10 still says variants are not a tier). Generated PNG art required (prompt:74-87) vs SVG (Brand.tsx:21-28). Light appearance vs 'automatic' (89aae18).
- **Women-only.** README.md:3 states it. No document or code defines eligibility. The "do not infer gender" rule exists only in the git-ignored prompt:166. IdentityDetails has no field for it (packages/domain/src/entities.ts:100-106). The reviewer checklist has no item for it (apps/admin/src/pages/CaseReview.tsx:153). The Famille seed adds an adult male hand-over recipient (services/demo-api/src/services/prototype.ts:592-597).
- **Masked calls.** The copy promises masked numbers (ContactSheet.tsx:14, apps/driver/src/app/(app)/ride.tsx:222, both (auth)/phone.tsx screens). No telephony exists, and INTEGRATIONS.md:20 says so. This is MOBILE-FEEDBACK-AUDIT finding 3, still open.
- **SOS in standalone builds.** SafetyButton says alerts appear in the back-office (packages/ui/src/features/prototype.tsx:99). In the default TestFlight build, each app has its own embedded store, which MOBILE-FEEDBACK-DEMO.md:31 itself acknowledges.
- **Emergency numbers.** Help and support copy say "15 (SAMU)" (apps/passenger/src/features/help/topics.ts:48, packages/ui/src/features/support.tsx:149). 15 is SAMU in France. Verifiers note that in Morocco 15 is Protection civile, SAMU is generally 141 and the Gendarmerie is 177. This needs local confirmation.
- **Business timezone.** README.md:5 and packages/domain/src/time.ts:1-2 say Africa/Casablanca. Family recurrence picks the next weekday in UTC (services/demo-api/src/services/prototype.ts:731-737).
- **Audit claims.** The admin says document access is logged (apps/admin/src/components/DocViewer.tsx:44) and every action is audited (Login.tsx:41). Document reads and failed logins write no audit entry (services/demo-api/src/services/uploads.ts:56-70; auth.ts:133-135).

**Architecture and conventions**

- **NativeWind.** README.md:20 and :38, and prompt:38, present NativeWind as the mobile styling system. `git grep className=` finds zero matches in apps/passenger/src, apps/driver/src and packages/ui/src at every commit. Mobile styling actually uses tokens plus useTheme() (packages/tokens/src/index.ts:40-48; 77 files call useTheme()).
- **"Prototype" naming.** Production-facing features live in modules called prototype (packages/domain/src/prototype.ts, 304 lines; services/demo-api/src/services/prototype.ts, 1,027 lines; packages/ui/src/features/prototype.tsx, 800 lines; apps/admin/src/pages/Prototype.tsx, 529 lines, at /services). Nothing maps features to files.
- **Two admin surfaces.** apps/admin (connected, permissioned) and apps/web /backoffice (open, localStorage, not connected; apps/web/README.md:18-20). No document says which is canonical. The web uses whole-MAD floats (apps/web/lib/store.ts:13,62) and its own fare formula (apps/web/components/landing.tsx:89), outside the FINANCE invariants.
- **Store reseed.** Not documented anywhere. A schemaVersion mismatch silently reseeds the store (services/demo-api/src/store.ts:22-29), which would wipe TestFlight testers' data.

**Setup and verification**

- **Root .env.** README.md:62 says `cp .env.example .env`. No process reads it: the demo API has no dotenv or --env-file, Vite reads apps/admin/.env, and Expo reads apps/<app>/.env. Following .env.example's "Set 0 in production" in the root .env leaves dev mode on (services/demo-api/src/main.ts:13), so the fixed OTP 123456 and the /dev routes stay enabled. .env.example also omits EXPO_PUBLIC_REVIEW and NEXT_PUBLIC_MAP_TILE_URL/ATTRIBUTION.
- **`pnpm test`.** README.md:153 says it runs unit, API and component tests. package.json:17 runs `pnpm -r --if-present test`, which includes Playwright and needs four running servers.
- **E2E setup is circular.** e2e/playwright.config.ts:6-7 says "see README Tests", and README.md:150-156 says "see playwright.config". Driver web on port 8082 is documented nowhere, and both Expo apps default to 8081.
- **Test counts.** README.md:162-170 (Sep 30): API 36, components 14, E2E 39, no peer issues. STANDALONE-DEMO.md:20: 43. MOBILE-FEEDBACK-DEMO.md:40-41: 51 and 15. Current (Oct 13): domain 36, API 51, components 15, E2E 40 tests in 9 specs, web 4 node:test plus 5 orphaned Playwright tests. `pnpm peers check` reports an unmet react-reconciler peer. The README table is explicitly dated, so this is stale rather than false, but four places carry counts.
- **Build numbers.** Three different values in three places: STANDALONE-DEMO.md:13 says 2/3, local app.config.ts says 3/4, origin/master 02ff3d3 says 4/5. eas.json also sets appVersionSource 'remote', which ignores the config value.
- **apps/web package manager.** README.md:190 and apps/web/README.md:11-13 say npm. apps/web/README.md:7 says `pnpm web`. Both lockfiles are tracked and they disagree (lucide-react 1.52.0 under npm vs 1.49.0 under pnpm).

**Design and media**

- **Illustrations.** DESIGN.md:5 and :53 say the generated art is kept. MOBILE-FEEDBACK-DEMO.md:12 says it was replaced by vector art. The Brand.tsx doc comment still says "Transparent raster art". packages/assets/README.md:6 and images.ts:1 describe PNGs that are bundled (about 6.8 MB) but never shown.
- **Token comment.** packages/tokens/src/index.ts:82 says major controls are 54; the value at :83 and DESIGN.md:19 say 50.
- **Media policy.** Mobile uses vector art and initials (MOBILE-FEEDBACK-DEMO.md:12). The website uses generated photoreal women (apps/web/DESIGN.md:23-27). Admin fixtures use generated portraits as selfies (services/demo-api/src/seed.ts:163).
- **Silent ignore rule.** .gitignore:5 `ios/` also matches docs/screens/ios, so those captures are never committed and nobody is warned.

**Public website**

- **Children.** The FAQ says children are welcome when accompanied by their mother (apps/web/components/landing.tsx:40). The apps sell unaccompanied child trips through Naya Famille.
- **Payments and naming.** The landing page lists card and cash only (:56); the apps also offer the wallet, mobile wallet, Cash Plus and Wafacash. It still sells "Naya Signature" (:702), which the categories replaced.
- **Prices.** "À partir de 38 MAD" (:368) cannot be reached, because the form blocks from === to; the real minimum shown is 50 MAD. The domain minimum fare is 30 MAD (packages/domain/src/cities.ts:9).

### 6.4 Proposed docs/ structure

This refines the docs auditor's proposed tree. Folder names are plain words, not numbers. Every file has one reader and one job. Do not create a file until you have content for it.

```text
AGENTS.md                         canonical entry point for every agent and new human (≤150 lines; draft in 6.5)
CLAUDE.md                         one line: @AGENTS.md
apps/passenger/AGENTS.md          passenger routes ↔ Figma P-IDs, Expo rules (absorbs AGENTS.expo.md)
apps/driver/AGENTS.md             driver routes ↔ D-IDs, location and background-task rules
apps/admin/AGENTS.md              admin routes, permission gates, Tailwind usage
apps/web/AGENTS.md                keep the Next.js block; append a short Naya section (disconnected prototype, pnpm, localStorage key)
services/demo-api/AGENTS.md       how to add an endpoint; transaction, idempotency and audit rules

docs/
  README.md                       index, reading order for a new chat, "last verified" date per doc

  product/
    vision.md                     PRD: problem, Rabat launch scope, non-goals, demo vs live
    personas.md                   passagère, chauffeuse, parent (Famille), support agent, admin
    glossary.md                   FR ↔ EN ↔ code ids (seed from packages/domain/src/labels.ts and FINANCE.md:26-30)
    source-of-truth.md            precedence: ADRs > specs > handoff/Figma > feedback PDF; where originals live

  specs/
    _template.md                  spec template (see 6.7)
    <one file per feature area>   17 specs listed in 6.7

  architecture/
    overview.md                   apps, packages, demo API, dependency rules, one system diagram
    runtime-modes.md              standalone / connected / web / review / production; env var matrix per process
    data-model.md                 entities.ts + PrototypeState, ID prefixes, schemaVersion and reseed rules
    api-reference.md              generated from Hono route registrations (~126 routes): auth, idempotency, permission
    permissions.md                admin permission matrix (route + endpoint) and mobile route guards
    state-and-styling.md          query keys and polling, SecureStore/AsyncStorage keys, tokens + useTheme, no className
    diagrams/                     Mermaid sources: runtime modes, ride machine, family trip, money flows

  adr/
    README.md                     index with status (Proposed / Accepted / Superseded)
    0000-template.md              ADR template (see 6.6)
    0001-pnpm-hoisted.md …        numbered ADRs from the backlog in 6.6

  design/
    design-system.md              current tokens, components, motion, dark mode (current state only, no history)
    copy-guidelines.md            French, "vous", passagère/chauffeuse, demo labelling, money and date formats, emergency numbers
    accessibility.md              touch targets, Dynamic Type caps, Reduce Motion/Transparency rules
    screens.md                    generated route ↔ Figma map (replaces SCREENS.md)
    history.md                    the old DESIGN.md log, frozen
    media-prompts/                moved apps/web/PHOTO-*.md

  runbooks/
    local-dev.md                  install, ports, env files per process, demo reset
    demo-data.md                  accounts, scenarios, OTP, test card tokens (4242 / 0002 / 3155)
    ios-simulator.md              signed review build, prebuild + pod install, .env.production.local, native-tour
    testflight-eas.md             EAS profiles, build-number policy, build log table (date, app, build, commit, uploaded)
    e2e.md                        start the four servers, ports, why runs are serial
    troubleshooting.md            known failures and fixes

  quality/
    testing-strategy.md           what each layer covers: vitest, jest-expo, Playwright on Expo web, manual native
    verification-log.md           dated runs (date, commit, command, result); the only place test counts live

  status/
    integrations.md               per capability: real / simulated / missing, live requirement (replaces INTEGRATIONS.md)
    backlog.md                    audit findings and feature gaps, with status, owner and PR
    roadmap.md                    milestones and launch blockers
    open-questions.md             decisions waiting on you, each linked to a Proposed ADR

  audits/                         immutable, dated snapshots; findings go to status/backlog.md
    2026-10-01-standalone-demo.md
    2026-10-05-web-ui-ux-audit.md
    2026-10-06-mobile-feedback-audit.md
    2026-10-06-mobile-feedback-demo.md
    2026-10-13-full-audit.md      this report

  handoff/                        committed text of _handoff, with a "partly superseded, see ADRs" banner
    README.md, QA.md, implementation-prompt.md, project-manifest.json
    feedback-pdf-summary.md       faithful text summary of the 10-page feedback PDF

  screens/                        captures (move to Git LFS; keep contact sheets only in plain git)
```

Where today's files go:

| Today | Goes to |
|---|---|
| README.md | Shrink to: what Naya is, quick start, links into docs/. History moves to audits/; counts move to quality/verification-log.md. |
| AGENTS.expo.md | Fold the useful parts into apps/passenger/AGENTS.md and apps/driver/AGENTS.md, then delete. |
| docs/FINANCE.md | specs/driver-wallet.md and specs/pricing-cities-categories.md. Keep the invariants list in AGENTS.md. |
| docs/INTEGRATIONS.md | status/integrations.md, with rows added for SOS, wallet providers, family proofs, persistence, tel:19. |
| docs/DESIGN.md | design/design-system.md (current state) + design/history.md (the log). |
| docs/SCREENS.md, docs/screens/*/README.md | design/screens.md, generated by a script. |
| docs/STANDALONE-DEMO.md, MOBILE-FEEDBACK-*.md, apps/web/UI-UX-AUDIT.md | audits/ with dates. Pin each to a commit. |
| apps/web/PHOTO-*.md | design/media-prompts/. |
| packages/assets/README.md | Fix in place (SVG is the displayed art; PNGs are legacy). |
| _handoff/ text files | handoff/, after you confirm there is no licence or confidentiality limit. Large PNGs stay out of git. |

First pass (about one day of work, no product decisions needed): AGENTS.md, CLAUDE.md, docs/README.md, adr/0000-template.md plus the "Record" ADRs, status/integrations.md, quality/verification-log.md, runbooks/local-dev.md and runbooks/e2e.md. Everything else can follow as each feature is touched.

### 6.5 What the root AGENTS.md should contain

Draft below. Every line is based on a fact verified in this audit. Lines marked "today" describe a known defect and should change when it is fixed.

```markdown
# Naya — agent guide (read this first)

Naya is a women-only ride-hailing (VTC) service launching in Rabat, Morocco. This repo is a
demo-grade product: passenger app, driver app, operations admin, marketing website and a demo
API. Every external service (SMS, payments, identity review, telephony, push) is simulated.
There is no production backend.

## Repo map
- apps/passenger, apps/driver   Expo SDK 57 apps (ma.naya.passagere, ma.naya.chauffeuse).
- apps/admin         Vite + React Router 7 operations console on :5173.
- apps/web           Next.js 16 landing + /backoffice PROTOTYPE (:3000). Not the real admin: no API,
                     no @naya/* imports, localStorage 'naya-web-prototype-v1'. Own AGENTS.md.
- packages/domain    Money, pricing, state machines, entities, zod schemas, French labels.
- packages/api       Typed API client (client.ts) and query keys (keys.ts).
- packages/ui        Shared RN primitives and feature screens, consumed as TS source.
- packages/tokens    Colours (light/dark), spacing, motion. Tailwind preset: admin only.
- packages/assets    Brand SVGs, 6 logo concepts, legacy PNGs (bundled, not displayed).
- services/demo-api  Hono API on :4010 with a JSON store. Also runs in-process in native demo builds.
- e2e/               Playwright against Expo web and admin.
- plugins/           Expo config plugins (iOS 27 UIScene; repo path with spaces).

"prototype" in code means the Oct 6 feedback features (service categories, Naya Famille,
passenger wallet, SOS, dispute reasons, demo payment options). They live in
packages/domain/src/prototype.ts, services/demo-api/src/services/prototype.ts,
packages/ui/src/features/prototype.tsx and apps/admin/src/pages/Prototype.tsx (/services).
Rides: services/demo-api/src/services/rides.ts + packages/domain/src/machines/.
Driver money: services/demo-api/src/services/finance.ts + packages/domain/src/wallet.ts.

## Commands (pnpm 12 only; never npm, yarn or bun, including in apps/web)
- pnpm install; then pnpm api | passenger | driver | admin | web
- pnpm demo:reset                          reseed demo data
- pnpm typecheck                           all packages
- pnpm --filter @naya/domain test; pnpm --filter @naya/demo-api test   vitest (API: S01–S16)
- CI=1 pnpm --filter @naya/passenger test  jest-expo; also runs packages/ui tests
- pnpm --filter @naya/passenger lint, pnpm --filter @naya/driver lint
- pnpm e2e    needs API :4010, passenger web :8081, driver web :8082, admin :5173; serial
- Root `pnpm test` also runs Playwright: do not use it as the unit-test command.
- Do not put `--` before flags: pnpm 12 forwards it to the tool literally.
- Native deps: pnpm --filter @naya/<app> exec expo install <pkg>

## Runtime modes
- Standalone (native default): EXPO_PUBLIC_DEMO != '0' and EXPO_PUBLIC_STANDALONE != '0'.
  The demo API runs in-process; data in Documents/naya-standalone-demo/demo-v1.json;
  a bot plays the other side; apps never sync with each other or the admin.
- Connected: EXPO_PUBLIC_STANDALONE=0 and pnpm api. URL = EXPO_PUBLIC_API_URL, else Metro host:4010.
- Web (Expo web, admin): always connected to :4010.
- Review capture: EXPO_PUBLIC_REVIEW=1 (connected only) lets /dev/navigate drive the app.
- Production: EXPO_PUBLIC_DEMO=0 points at a placeholder (https://api.naya.example).
- Flags are opt-out: a missing variable means demo + standalone. API dev mode
  (OTP 123456, /dev routes) is on unless NAYA_DEV=0.
- Env files are per process: apps/<app>/.env*; release bundles read
  apps/<app>/.env.production.local; admin reads apps/admin/.env. The root .env is read by nothing.

## Invariants (change only with an ADR)
- Money: integer centimes, rates in basis points, round half away from zero once
  where derived (packages/domain/src/money.ts). Never floats.
- Driver wallet = projection of an append-only ledger. Each posting has a unique
  business key (ride:<id>:net, ride:<id>:commission ...). Only confirmed events credit.
- Booking and money mutations send an Idempotency-Key (useSingleFlight). Mutations never auto-retry.
- Accepting a quote freezes its terms (FrozenTerms). Rule changes never re-price a booked ride.
- Offers expire on the server (city offerTimeoutSeconds, default 30 s) and never auto-accept.
- Women-only service. Identity review is manual, with no face or gender inference.
  Eligibility rule: docs/specs/eligibility-and-verification.md.
- Customer copy in French, "vous", "passagère" / "chauffeuse". Currency MAD.
- Business dates via packages/domain/src/time.ts (Africa/Casablanca); store UTC ISO.
  Morocco is on UTC+0 during Ramadan: never hard-code +1.
- Label every simulation ("Démo"); never present one as live.
- Session tokens only in SecureStore. Query keys only via qk: ['naya', accountId, ...].
- Admin permissions are enforced on the server; client route gates are cosmetic.

## Conventions
- Mobile styling: @naya/tokens + useTheme() + themedStyles(). No className
  (NativeWind is wired but unused). Never read colors.* at module scope.
- Shared screens live in packages/ui; app route files are thin wrappers.
- New endpoint: route in services/demo-api/src/app.ts (or services/*.ts), method in
  packages/api/src/client.ts, key in keys.ts, and a vitest.
- Never hand-edit apps/*/ios or android; use app.config.ts and plugins/.
- Commit pnpm-lock.yaml together with any package.json change.

## Gotchas
- Expo SDK 57, React Native 0.86, React 19.2, React Router 7 and Next.js 16 are newer than
  your training data. Read the versioned docs first: https://docs.expo.dev/versions/v57.0.0/
  and node_modules/next/dist/docs/.
- The repo path contains spaces. iOS builds need plugins/with-ios-build-paths.js
  (today: passenger only, uncommitted).
- Simulator builds must be signed (CODE_SIGN_IDENTITY=-) or SecureStore fails and sign-in breaks.
- Run pod install again after expo prebuild.
- Today the category commission overrides the city commission (rides.ts:127). See ADR-0033.
- A schemaVersion change reseeds the store and wipes testers' on-device data.
- .gitignore "ios/" ignores every folder named ios, including docs/screens/ios.
- _handoff/ (original spec) and work/ (Xcode caches, archives) are local-only and git-ignored.

## Where to look
docs/README.md is the index: product/glossary, specs/, adr/, architecture/, runbooks/, status/.

## Definition of done
1. pnpm typecheck passes; tests pass for every package you touched; lint shows 0 errors
   in the Expo apps you touched.
2. Behaviour changed: update the spec. Invariant changed or decision reversed: write an ADR.
   New route: docs/design/screens.md. New simulation: docs/status/integrations.md.
3. Test results go only in docs/quality/verification-log.md (date, commit, command, result).
4. Learned a new gotcha: add one line to this file.
5. Do not commit or push unless asked.
```

Root CLAUDE.md, the whole file:

```text
@AGENTS.md
```

Notes:

- apps/web keeps its own AGENTS.md and CLAUDE.md. `next dev` rewrites the Next.js block, so leave the block alone and append a short Naya section below it: disconnected prototype, pnpm only, localStorage key, not the operational admin.
- Add per-folder AGENTS.md files under apps/passenger, apps/driver, apps/admin and services/demo-api only when there is folder-specific content (see 6.4). Codex reads nested AGENTS.md files directly. Claude Code reads nested CLAUDE.md files, so give each one a sibling CLAUDE.md containing `@AGENTS.md`, as apps/web already does.
- Keep the root file under 150 lines. Anything longer belongs in docs/ with a link.

### 6.6 ADR backlog

Template (docs/adr/0000-template.md). Front-matter: id, title, status (Proposed / Accepted / Superseded by NNNN), date, deciders, supersedes, related specs. Sections: Context (with links to the original requirement, e.g. a handoff line or a feedback item), Decision (one imperative paragraph), Consequences, Alternatives considered, Evidence (commits, file:line, the tests that enforce it), Revisit when (a concrete trigger).

The list below merges all 155 candidates from the 11 areas into 57. Numbers are fresh; they do not match the numbers inside the area reports.

**Record (already decided: backfill as Accepted)**

Items marked "confirm intent" reverse an original handoff rule. Confirm they were intended before you mark them Accepted.

1. **ADR-0001 pnpm 12 workspace with hoisted node_modules.** Metro, CocoaPods and Gradle autolinking need a flat tree (pnpm-workspace.yaml:7-8), plus the @react-native/metro-config 0.86.3 override (:17-18). Commit 96af8c6.
2. **ADR-0002 Track the stable Expo SDK 57 line.** RN 0.86.3 and React 19.2.3 pinned, so React Router stays on 7 (v8 needs React ≥ 19.2.7). NativeWind 4 with Tailwind 3, Reanimated 4.5, and NativeWind's Babel preset dropped to avoid a duplicate Worklets plugin. README.md:29-53.
3. **ADR-0003 Money as integer centimes and basis points, rounded half away from zero once where derived.** packages/domain/src/money.ts:26-44; FINANCE.md:7-9; 96af8c6.
4. **ADR-0004 Driver wallet is a projection of an append-only ledger.** Unique business keys per posting. Withdrawals are holds, not postings, and a failed one posts nothing. Cash-ride commission becomes debt, and offers are blocked at the city debt limit. packages/domain/src/wallet.ts:23-74; services/demo-api/src/services/finance.ts:29-131; FINANCE.md:22-55.
5. **ADR-0005 Server-authoritative pricing with versioned city rules and frozen terms.** Quotes are single-use and expire after quoteValiditySeconds. Booking freezes rule version, breakdown, commission and cancellation policy. Clients never compute fares and echo acknowledgedFee on cancel. rides.ts:99-132; entities.ts:278-290; CancelSheet.tsx; test S06.
6. **ADR-0006 Admin changes are governed.** Reason of at least 10 characters, optimistic concurrency (expectedVersion, 409 plus a reload banner), and an append-only SHA-256 hash-chained audit log checked on read. apps/admin/src/pages/Rules.tsx:131,141-145; Cities.tsx:92-96; CaseReview.tsx:43-55; services/demo-api/src/audit.ts.
7. **ADR-0007 Lifecycle rules are declarative state machines in @naya/domain.** The server is the authority and clients mirror it. A driver cancellation sends the ride back to searching and excludes that driver. packages/domain/src/machines/*; machines/ride.ts:15-27; rides.ts:655-674.
8. **ADR-0008 Offer deadlines are server-authoritative.** Per-city offerTimeoutSeconds (10–120 s, default 30). Clients correct clock skew from X-Server-Time. No auto-accept. Late or racing accepts are rejected atomically. rides.ts:276,349-361,812; packages/api/src/client.ts:279-292; test S11.
9. **ADR-0009 Idempotency-Key is required on booking, money, SOS and family mutations.** Scoped by (key, subject) with body-hash conflict detection. The client uses useSingleFlight, and mutations never auto-retry. services/demo-api/src/app.ts:125-144; packages/ui/src/core/useSingleFlight.ts; packages/ui/src/core/query.ts:33-38.
10. **ADR-0010 Provider outcomes are applied through one code path.** applyProviderEventIn, HMAC-SHA256 over the raw body, event-id dedupe. app.ts:615-620; finance.ts:92-156; FINANCE.md:56.
11. **ADR-0011 Demo backend architecture.** One Hono app with a single-writer JSON store and snapshot/rollback transactions. Time rules run in a 500 ms tick against an injectable clock. Shared zod schemas plus the typed client are the contract, with no OpenAPI and no URL versioning. services/demo-api/src/store.ts:12-67; timers.ts; clock.ts; packages/api/src/client.ts. Revisit before production: Postgres with row locks for offer acceptance.
12. **ADR-0012 Native demo builds run the demo API in-process (standalone).** Per-app store on the device, a simulated counterpart (bot driver, generated offers, auto-review), Metro platform adapters. Web is always connected. Commit 74a1c14; packages/ui/src/core/apiBase.ts:4-20; services/demo-api/src/embedded.ts:14-62; docs/STANDALONE-DEMO.md.
13. **ADR-0013 Real-time by polling, with local notifications only.** No websockets, no remote push. Polling pauses in the background. apps/*/src/lib/queries.ts; packages/ui/src/core/query.ts:15-17; INTEGRATIONS.md:18-19.
14. **ADR-0014 Client state ownership.** TanStack Query for server state with account-scoped keys and an AccountBoundary. Zustand for ephemeral state. RHF + Zod for forms. SecureStore (this device only) for sessions, AsyncStorage for preferences, the route draft in memory. Handoff prompt:98-103; packages/api/src/keys.ts; packages/ui/src/core/session.ts.
15. **ADR-0015 Route-group gating with Expo Router Stack.Protected and a loading cover**, so deep links survive account loading. Drivers are gated on dossier submission; approval only gates going online. apps/passenger/src/app/_layout.tsx:18-40; apps/driver/src/app/_layout.tsx:17-44.
16. **ADR-0016 Shared UI kit consumed as TypeScript source.** One barrel, role-parametrised feature screens, thin route wrappers in each app. packages/ui/package.json; apps/*/src/app/(app)/*.tsx. Revisit: subpath exports and declared peer dependencies.
17. **ADR-0017 The admin is a separate Vite SPA.** Its own email/password auth, a per-tab sessionStorage token, 8 permission strings enforced on the server, locked items shown rather than hidden, and no role switch in the mobile apps. Commit f0f8d46; apps/admin/src/lib/api.ts:13-29; packages/domain/src/entities.ts:53-61; handoff prompt:46.
18. **ADR-0018 Sensitive-data minimisation.** Identity documents only through authenticated endpoints and blob URLs. Magic-byte sniffing, SVG refused. Images resized to at most 1600 px with EXIF stripped. Cards stored as last 4 digits plus a provider token. services/demo-api/src/services/uploads.ts; packages/ui/src/features/uploads.ts; apps/passenger/src/app/(app)/card/new.tsx:25-44.
19. **ADR-0019 Verification is a manual human review with no face or gender inference.** Driver identity and vehicle are separate cases, and both must be approved before offers. INTEGRATIONS.md:10; handoff prompt:164-166; packages/domain/src/machines/verification.ts:54-55.
20. **ADR-0020 French-only product, MAD, Africa/Casablanca business time, UTC ISO storage.** Copy is centralised in packages/domain (labels.ts, errors.ts). No i18n, no RTL. README.md:5; packages/domain/src/time.ts:1-4; e2e locale fr-MA.
21. **ADR-0021 Demo authentication.** Fixed OTP 123456 while NAYA_DEV != '0'. Apple and Google sign-in stay hidden until server verification is configured. services/demo-api/src/main.ts:13,29; INTEGRATIONS.md:7-9.
22. **ADR-0022 Map adapter per platform.** Apple Maps on iOS, Google Maps on Android only with a build-time key, OSM raster fallback elsewhere, attribution always shown. The admin uses a custom MiniMap; apps/web uses Leaflet. packages/ui/src/map/NayaMap.tsx:13-16; apps/admin/src/components/MiniMap.tsx; apps/web/components/map.tsx.
23. **ADR-0023 Mobile styling and runtime dark mode (confirm intent).** Inline styles from tokens, a mutable `colors` Proxy, useTheme() and themedStyles(), no className. The user picks light, dark or system (AsyncStorage 'naya.theme'), and userInterfaceStyle is 'automatic'. This supersedes the original forced light appearance. 89aae18; packages/tokens/src/index.ts:40-50; packages/ui/src/core/theme.tsx.
24. **ADR-0024 Motion, material and text-scaling policy.** No springs (monotonic eased timing from tokens.motion; Reduce Motion honoured). Glass only on floating controls, opaque on Android and under Reduce Transparency, money never on glass. Dynamic Type capped at 1.6× (buttons 1.4×), columns at fontScale ≥ 1.3. 0e0b066; packages/ui/src/motion.ts; Glass.tsx:21-43; Text.tsx:24; a11y.ts:22.
25. **ADR-0025 Mobile illustrations are vector SVG and avatars are initials (confirm intent).** This replaces the generated PNG characters the handoff required (prompt:74-87). 89aae18; Brand.tsx:21-28; MOBILE-FEEDBACK-DEMO.md:12.
26. **ADR-0026 Service categories, including a premium Naya Confort tier (confirm intent).** This reverses "colour variants never imply a premium tier" (prompt:85; images.ts:10). packages/domain/src/prototype.ts:177-222; feedback item 1 (MOBILE-FEEDBACK-AUDIT.md:19).
27. **ADR-0027 Native platform constraints are handled by config plugins, never by editing ios/.** UIScene for iOS 27 (plugins/with-scene-lifecycle.js, 0fa0487) and path quoting for paths with spaces (plugins/with-ios-build-paths.js, uncommitted).
28. **ADR-0028 Test strategy.** vitest for domain invariants and API scenarios S01–S16. jest-expo for shared components (run through the passenger app). Playwright against Expo web and Vite rather than Detox or Maestro. Native checked by hand on the iOS Simulator. Android unverified. e2e/playwright.config.ts:3-31; README.md:175.
29. **ADR-0029 Demo store is versioned (schemaVersion 1) and a mismatch reseeds from fixtures, with no migrations.** services/demo-api/src/store.ts:22-29. Revisit before any change to a persisted shape, because it wipes TestFlight data.
30. **ADR-0030 Location policy.** Passenger: foreground only, with an explainer and a manual-pin fallback. Driver: background location only during an accepted ride, through a TaskManager task. apps/passenger/src/features/location/*; apps/driver/src/lib/backgroundLocation.ts.
31. **ADR-0031 Number masking is the only planned passenger–driver contact channel; no in-app chat.** Deferred until a telephony provider exists. ContactSheet.tsx:7-10. Revisit: the copy already promises masking (see 6.3).
32. **ADR-0032 apps/web stack.** Next.js 16 on webpack with a separate dev distDir (reason undocumented). Hand-written CSS instead of the token preset. GSAP gated by prefers-reduced-motion. Newsreader for marketing display and Inter for product UI. Zustand persist with skipHydration and a manual rehydrate. apps/web/package.json:6-7; next.config.ts:4; landing.tsx:90-126; lib/store.ts:467-471.

**Decide (open: write as Proposed, then choose)**

The first four affect money, the law or physical safety. Decide them first.

33. **ADR-0033 Pricing precedence between city rules and service categories.** Does the category or the city commission apply, or a per-city category override? Do category fares vary by city? How is category pricing versioned and audited? rides.ts:79-80,127; FINANCE.md:18; services/demo-api/src/services/prototype.ts:890-924.
34. **ADR-0034 Women-only eligibility and verification policy.** Evidence, reviewer checklist item, appeal path, how Naya Famille applies to children and to adult recipients, and no appearance-based inference. Needs legal review. README.md:3; handoff prompt:166; CaseReview.tsx:153; services/demo-api/src/services/prototype.ts:592-597.
35. **ADR-0035 SOS production model.** Who responds and under what SLA, a real call and which numbers, the device GPS source, the alert state machine, how status returns to the user, and the effect on the ride. packages/ui/src/features/prototype.tsx:49-150; services/demo-api/src/services/prototype.ts:790-948; machines/ride.ts:23.
36. **ADR-0036 Naya Famille operating model.** Billing and driver pay, dedicated-driver capacity and conflicts with regular dispatch, cancel, no-show and failed-handover paths, and handover-code security (never sent to the driver, hashed, attempt limit). services/demo-api/src/services/prototype.ts:250-257,290-352,630-764; rides.ts:245-249.
37. **ADR-0037 Admin permission model for the new features.** Dedicated permissions (for example safety.respond, catalog/pricing, family ops) instead of config.edit for everything. Does any admin need city scoping? packages/domain/src/entities.ts:53-61; services/demo-api/src/services/prototype.ts:878-1001; seed.ts:301.
38. **ADR-0038 Canonical backoffice.** apps/admin vs apps/web /backoffice: marketing prototype only, rebuilt on @naya/api, or merged. Conditions before any public deployment (auth, noindex, no public link). afac0b1; apps/web/README.md:18-20; landing.tsx:197-204.
39. **ADR-0039 Future of the "prototype" module.** Split into domain modules (family, safety, passenger wallet, categories), rename the /prototype API namespace, bring the features into FINANCE and the state machines, and bump the schema. 89aae18; services/demo-api/src/services/prototype.ts:95-105; packages/api/src/client.ts:446-467.
40. **ADR-0040 Passenger wallet model.** Move to immutable ledger postings (holds and settlements as entries) and a domain-level projection? Should mobile_wallet confirm without a provider event? Where do customer funds show in Finance? services/demo-api/src/services/prototype.ts:106-182; rides.ts:199,484,625-629; app.ts:816-837.
41. **ADR-0041 Cash and fee settlement.** How cash cancellation fees are collected and credited, retrying failed card fees, cash not received or partial, and whether unpaid balances block new bookings. rides.ts:190-196,439-462,531-532,640-653.
42. **ADR-0042 Ride exception paths.** Passenger no-show (fee plus driver credit) instead of re-dispatch. Aborting an in-progress ride (SOS, accident, admin) with fare rules. Admin system-cancel (SYSTEM_CANCEL is defined but unused). The arrival fee vs the free cancellation window. machines/ride.ts:20-23; pricing.ts:82-83; rides.ts:550-558,655-675.
43. **ADR-0043 Category–vehicle eligibility and Scooter scope.** Add a vehicle type to the vehicle case, derive category eligibility from it, and default to no category until approval. Is Naya Scooter in launch scope? rides.ts:262,370; packages/domain/src/entities.ts:108-114.
44. **ADR-0044 Demo gating, flag defaults and the production bundle.** Gate simulations, the logo gallery, /dev routes and admin demo credentials. Make the demo flags opt-in ('1') or fail the build when they are missing. Make API dev mode opt-in. Exclude the embedded backend and its fixtures from production bundles. Set one "Démo" labelling rule. packages/ui/src/core/apiBase.ts:4-5; services/demo-api/src/main.ts:13; packages/ui/src/features/prototype.tsx:89-138,264-276.
45. **ADR-0045 Production backend and live integrations.** Database, payments partner, KYC storage, telephony masking and remote push. The production EAS profile points at https://api.naya.example (apps/*/eas.json:36). These are launch blockers.
46. **ADR-0046 Production map tile provider.** The public OSM tile servers are not meant for production traffic; the website also needs a privacy mention. packages/ui/src/map/TileMap.tsx:19-24; MiniMap.tsx:64; apps/web/components/map.tsx.
47. **ADR-0047 NativeWind: remove it, or adopt it for new mobile code.** Adopting it would need a dark-mode Tailwind preset; the current preset is light-only. apps/*/babel.config.js; metro.config.js; packages/tokens/tailwind-preset.js.
48. **ADR-0048 Cross-surface media and brand.** One policy for vector art, generated photography (web hero, admin selfies) and real photos. Which logo: Rencontre or one of the 6 concepts? When does the logo gallery leave the customer apps? Remove the unused PNGs? packages/assets/src/concepts.ts; apps/web/DESIGN.md:23-27; seed.ts:163.
49. **ADR-0049 Build-number source of truth.** EAS remote versioning or app.config.ts buildNumber, not both. Today the docs say 2/3, local config 3/4 and origin 4/5. apps/*/eas.json:4; app.config.ts:17-18.
50. **ADR-0050 Repo path with spaces.** Commit plugins/with-ios-build-paths.js for both apps, or move the repo to a path without spaces. The plugin rewrites Xcode phases by regex (:38-49), which is fragile across SDK upgrades.
51. **ADR-0051 apps/web package manager.** pnpm only: delete apps/web/package-lock.json and the npm root scripts (package.json:22-23).
52. **ADR-0052 Screenshot storage.** 170 MB tracked in docs/screens (about 216 MB in history; images are about 95 % of all blob weight). Move to Git LFS or external storage.
53. **ADR-0053 Idempotency-key lifecycle.** Rotate on success or a definitive 4xx; keep the key after network or 5xx errors; rotate when the payload changes. Scope admin correction keys. packages/ui/src/core/useSingleFlight.ts:35-38 (reset rotates the key, and 4 callers reset on error); app.ts:851-857; finance.ts:291-298.
54. **ADR-0054 Source of truth for the passenger's city.** Server user.cityId or device prefs.cityId; today both exist and can diverge. apps/passenger/src/lib/prefs.ts:17; services/demo-api/src/app.ts:360.
55. **ADR-0055 Account lifecycle.** In-app deletion for both apps (App Store guideline 5.1.1(v)), suspension (status 'suspended' exists but nothing sets it), and revocation or expiry of approved documents. apps/passenger/src/app/(app)/preferences.tsx:60; entities.ts:39; machines/verification.ts:13.
56. **ADR-0056 Source-of-truth order, committing the handoff, and docs language.** May the _handoff text and the feedback summary be committed (licence or confidentiality limits)? Precedence order. English or French for project docs. .gitignore:13; README.md:7.
57. **ADR-0057 Branch, review and CI policy.** Two people push straight to master (02ff3d3), and there is no CI. Choose a PR workflow, branch protection and a minimum CI gate (frozen install, typecheck, unit tests, lint).

### 6.7 Spec backlog

Spec template (docs/specs/_template.md): Purpose · Actors · Rules (numbered, testable, each with "enforced at file:line" and "tested by") · States and transitions · Demo vs live · Open questions (link to the Proposed ADR) · Last verified (date and commit).

Each entry lists the rules the code does not state today. Write the first five before more feature work; they cover money, safety and the core promise.

1. **specs/pricing-cities-categories.md**
   - Which commission applies: city, category, or a per-city category override. Today the category always wins (rides.ts:127), so Casablanca Standard freezes 15 % against the documented 18 %.
   - Whether category fares vary by city. Scooter and Confort prices are global today (packages/domain/src/prototype.ts:184-222).
   - An empty category fare means "inherit the city fare", never 0. The admin editor saves 0 MAD today.
   - Category pricing is versioned, needs a reason and is frozen into terms. Today catalog.version is incremented but never recorded (services/demo-api/src/services/prototype.ts:912), and catalog writes take no reason or expectedVersion (:890-924).
   - The default category when Standard is disabled or not offered in the city (quote.tsx:55 hard-codes 'standard').
   - The minimum setup before a new city can take bookings: zones and a cash provider. createCity creates neither (services/demo-api/src/services/cities.ts:58-69).
2. **specs/eligibility-and-verification.md**
   - What evidence proves eligibility for a women-only service, and where the reviewer records it. IdentityDetails has no field (entities.ts:100-106) and the checklist has no item (CaseReview.tsx:153).
   - No appearance-based inference. The appeal path after a 'not_eligible' rejection (services/demo-api/src/services/verification.ts:27).
   - Required items depend on the document type: a passport needs no back side (machines/verification.ts:17 always requires id_back).
   - Approval can be revoked or can expire, for example a licence or insurance (approved is terminal at machines/verification.ts:13; no expiry fields).
   - What the user sees from the reviewer. The approval field labelled "Note interne" is shown to the passenger (CaseReview.tsx:256 → verification-status.tsx:49).
   - Which profile fields lock after approval. PATCH /me lets verified users rename themselves and change city, with no audit (app.ts:257-271).
3. **specs/safety-sos.md**
   - Who receives alerts and with which permission. Today only config.edit; the support role gets 403 (prototype.ts:878,928; seed.ts:301).
   - Alert states and allowed transitions, with a mandatory note. The server accepts any transition today.
   - What the person in danger sees after triggering. api.prototype.alerts() has no consumer (client.ts:459), and the alert is lost when the screen unmounts (prototype.tsx:61).
   - The location source is the device GPS, not `driverLocation ?? pickup` (apps/passenger/src/app/(app)/ride.tsx:173).
   - Emergency numbers confirmed locally: the copy says "15 (SAMU)" (topics.ts:48); verifiers flag 141 and 177.
   - The effect on the ride (an in-progress ride cannot be aborted, machines/ride.ts:23) and what standalone builds may promise (prototype.tsx:99).
4. **specs/family.md (Naya Famille)**
   - Who may be an authorised recipient, and how that fits the women-only rule (the seed adds an adult male, prototype.ts:592-597).
   - The handover code is never sent to the driver, is stored hashed, and is locked after N failed attempts with an alert to the parent and support. Today the driver's payload contains it (prototype.ts:250-257, 699-707).
   - The child-name step is an attestation, not a verification; the driver already sees the name (prototype.ts:688-697).
   - Failure paths: parent cancel or skip, no-show, failed handover, admin resolve. None exists; FAMILY_NEXT is linear.
   - Recurrence uses Casablanca weekdays and does not depend on the previous trip completing (prototype.ts:731-760 uses UTC and only runs on completion).
   - Billing, driver pay and dispatch conflicts (no charge, no ledger entry; busyDriverIds ignores family trips, rides.ts:245-249). Child-data consent, access and retention: arrival photos are readable by any support.resolve admin (uploads.ts:60-64).
5. **specs/payments-and-fees.md**
   - How a cash cancellation fee is collected and when the driver is credited. Today it stays pending forever (rides.ts:439-462) while the receipt promises collection with the next ride.
   - A failed card fee can be retried. Today retry needs ride.paymentId, which a fee never sets (rides.ts:531-532).
   - Cash not received, or partial payment. Only a full confirmation exists (rides.ts:640-653).
   - Whether outstanding payments block new bookings. createRide does not check (rides.ts:190-196).
   - mobile_wallet needs a provider event to confirm (instant today, rides.ts:625-629). Self-confirm routes only in dev mode (prototype.ts:494-517; app.ts:593-607).
   - Correct method labels on quote, receipt and earnings. Wallet payments show as "Carte" today.
6. **specs/rides.md** (immediate rides, cancellation, no-show, rating)
   - The free cancellation window vs the arrival fee. pricing.ts:82-83 charges the arrival fee as soon as the driver is marked arrived; help promises 2 free minutes after assignment (topics.ts:18).
   - "Arrived" requires being near the pickup. No geofence today (rides.ts:550-558).
   - A passenger no-show ends the ride with a fee and a driver credit, instead of re-dispatching (machines/ride.ts:21-22).
   - How an in-progress ride is aborted (SOS, accident, admin) and what is charged.
   - What a driver may see about a ride she was only offered (today: the other driver, her plate and the passenger's rating comment).
   - The offer timeout is per city (10–120 s), so client copy must not hard-code 30 s. Whether ratings go both ways.
7. **specs/passenger-wallet.md**
   - Entries are immutable; holds, settlements and releases are new entries (in-place edits today, prototype.ts:150-157,171-175).
   - Lifecycle: hold at booking, release on cancel or no driver, settle at completion; fees are debited immediately.
   - Top-up limits. Top-ups are confirmed only by a signed provider callback.
   - Dispute refunds credit the wallet. No refund path exists today.
   - Customer funds appear in admin Finance under finance.read. Today they are visible only under Services with config.edit (app.ts:816-837).
8. **specs/driver-wallet.md** (port of FINANCE.md, plus gaps)
   - Wallet and mobile_wallet credits count in "Crédité au portefeuille" (today card only).
   - "Revenus nets" counts confirmed money only, or says otherwise. Today it includes failed and pending card rides.
   - Commission debits cannot consume funds reserved by a pending withdrawal.
   - What a debt limit of 0 means (today it blocks every new driver).
   - How a driver adds a payout account. No endpoint exists.
9. **specs/support-and-disputes.md**
   - The outcome is an explicit enum with no default. Today the default is "Rejetée" (apps/admin/src/pages/Ticket.tsx:12,22), a regression from 89aae18.
   - Status comes from that enum, not from a regex on free text (services/demo-api/src/services/support.ts:85).
   - "Remboursement accordé" moves money, or is not offered.
   - Safety tickets get priority and an SLA. SupportTicket has no priority field (entities.ts:562-578), yet the copy promises priority.
   - Reasons are filtered by role, evidence-required reasons are enforced, and replies can carry attachments. "À traiter" excludes rejected and awaiting-user tickets.
10. **specs/scheduled-rides.md**
    - The client reads city.scheduling instead of hard-coded values (SchedulePicker.tsx).
    - Allowed booking hours (the client blocks 00:00–04:59; the server does not).
    - Dispatch 15 minutes before pickup re-checks the passenger, the city and the payment method.
    - "Enregistrée" is not "assigned". What the passenger sees after dispatch (today "Voir la course" opens a receipt that says "Course terminée").
11. **specs/accounts-and-auth.md**
    - In-app account deletion in both apps. The passenger can only open a support ticket; the driver has nothing.
    - Suspension: who, why, effect and audit. The status exists but nothing sets it (entities.ts:39).
    - Whether a driver may sign out during an active ride (she can today).
    - OTP rate limits and delivery when NAYA_DEV=0 (today codes go to stdout).
12. **specs/contact-and-notifications.md**
    - No masked-call promise until a telephony provider exists.
    - Notification preferences are honoured. Nothing reads them today.
    - Family timeline notifications are shown to the parent (written, never rendered, prototype.ts:726-729).
    - Background offer alerts need remote push: decide, then fix the copy.
13. **specs/admin-backoffice.md** (with architecture/permissions.md)
    - The permission matrix per route and per endpoint, including finance data. Overview and People show balances and commission without finance.read.
    - Every configuration change has a reason, expectedVersion and before/after in the audit. Catalog writes skip all three today.
    - Which reads are audited. The UI claims document views are logged (DocViewer.tsx:44); they are not.
    - Admin interventions: suspend an account, cancel or end a ride, refund.
14. **specs/privacy-and-data.md**
    - Data inventory: identity documents, selfies, child profiles, arrival photos, location timelines, SOS records.
    - Retention per category, and deletion when an account is closed.
    - Access roles per category (today support can read child arrival photos).
    - CNDP (law 09-08) declaration and DPIA status. The only mention today is INTEGRATIONS.md:10.
    - Standalone demo data (selfies, ID photos) sits in the backed-up Documents folder and is never cleared.
15. **specs/demo-mode.md**
    - The list of demo-only surfaces to gate: simulation buttons, logo gallery, /dev, scenario launcher, admin demo credentials.
    - Flag defaults: opt-in demo, or the build fails when a flag is missing.
    - The embedded backend and fixtures are excluded from production bundles.
    - One labelling rule: a "Démo" badge, not "démo" wording inside CTAs and data.
16. **specs/brand-and-media.md**
    - One illustration and photography policy for the apps, admin fixtures and website.
    - The logo choice, and when the 6-concept gallery leaves the customer and driver apps.
    - The vehicle image shows the real colour or a neutral one (today VehicleImage always draws plum).
    - Whether the passenger sees a driver photo before boarding.
17. **specs/web-landing.md**
    - Public copy matches the product: child policy (landing.tsx:40), payment methods (:56), category names (:702), minimum fare (:368 vs 30 MAD in cities.ts:9).
    - The estimate uses domain rules or is clearly labelled indicative (formula at landing.tsx:89).
    - /backoffice is not linked publicly, is noindex, and needs auth before any public deployment.

### 6.8 Keeping docs fresh

The current docs went stale because each feature pass added a new snapshot doc instead of updating the canonical one. The fix is a small set of habits, not more documents.

**One home per fact.** Test counts live only in quality/verification-log.md. Build numbers live only in the build log in runbooks/testflight-eas.md. The route list and the API list are generated. Everything else links to those homes and never copies numbers.

**Verification log instead of dated tables.** Append one row per run. README never states counts.

| Date | Commit | Command | Result | By |
|---|---|---|---|---|
| 2026-10-13 | 89aae18 + local changes | pnpm --filter @naya/demo-api test | 51 passed | audit |

**PR checklist** (.github/pull_request_template.md):

- [ ] Added or changed a route → design/screens.md (regenerate)
- [ ] Added an endpoint → api-reference.md (regenerate)
- [ ] Changed a money, state or eligibility rule → spec updated + test added
- [ ] Added or changed a simulation → status/integrations.md
- [ ] Changed an invariant or reversed a decision → ADR
- [ ] Uploaded a build → build log
- [ ] Ran tests worth citing → verification-log.md
- [ ] Learned a gotcha → one line in AGENTS.md

**When to write an ADR.** Write one when any of these is true:

- the change touches an invariant listed in AGENTS.md;
- it reverses something in the handoff, a spec or an earlier ADR;
- it picks a vendor, platform or library that is hard to swap;
- it changes who can see or do something (permissions, privacy);
- two reasonable people could disagree and someone will ask "why?" in six months.

Keep an ADR to one page. Never edit an Accepted ADR's decision; supersede it with a new one.

**Owners.** Give every docs folder one owner, named in docs/README.md. A suggestion for two people: Achraf owns product/, specs/, adr/ and status/; whoever cuts builds owns runbooks/ and the build log. The owner reviews any PR that touches their folder.

**Automation (once CI exists, ADR-0057).**

- Scripts generate design/screens.md from apps/*/src/app and apps/admin/src/router.tsx, and architecture/api-reference.md from the Hono route registrations. CI fails if the committed files drift.
- A link checker fails on absolute /Volumes/... paths.
- Each doc carries front-matter `last_verified: YYYY-MM-DD @ <commit>`. docs/README.md lists anything older than 60 days.

**Audits are immutable.** Each audit goes into docs/audits/ with a date and a pinned commit. Its findings are copied into status/backlog.md with an id, a status and a PR link. Close findings there, not in the audit.

**How AI sessions use and update the docs.**

1. Start: read AGENTS.md (auto-loaded), docs/README.md, and the spec and ADRs for the area you are touching.
2. If code contradicts a spec or ADR, do not "fix" it back. Check the ADR index, then ask.
3. Before finishing: update the spec, status/integrations.md or screens.md if behaviour changed. Write a Proposed ADR if a decision was made or reversed. Append test results to verification-log.md.
4. Add one line to AGENTS.md Gotchas for anything that cost more than ten minutes to discover.
5. Never write counts, build numbers or dated "verification" tables into README or specs. Never edit files in docs/audits/.

**Milestone review.** At each milestone (TestFlight upload, feature pass), spend 30 minutes: walk the docs/README.md "last verified" list, close or re-date stale docs, and move resolved backlog items to done.

---

## 7. Repo hygiene, tooling and quality gates

Every gate that runs locally is green. What surrounds the gates is weak. Nothing runs them automatically. Lint skips the shared code. The full e2e suite has not run since 30 September. Your local checkout is one teammate commit behind, and your uncommitted edits overlap that commit. The repo is also heavy: about 95% of git history is screenshots.

### 7.1 Gate results

These were run on 13 October 2026 against the working tree: HEAD 89aae18 plus the uncommitted lockfile and passenger config.

| Gate | Command | Result | Notes |
|---|---|---|---|
| Typecheck | `pnpm typecheck` (`pnpm -r --parallel typecheck`) | **Pass**: 10/10 packages, exit 0, 11.5 s | Strict mode with `noUncheckedIndexedAccess` (tsconfig.base.json:7). `e2e/` has no tsconfig, so nothing typechecks it. |
| Domain unit tests | `pnpm --filter @naya/domain test` | **Pass**: 36/36 tests in 4 files, 0.7 s | Covers machines, money, pricing and wallet. packages/domain/src/prototype.ts (the Oct 6 catalog and `FAMILY_NEXT`) has no tests. |
| Demo API tests | `pnpm --filter @naya/demo-api test` | **Pass**: 51/51 tests in 3 files, 3.4 s | Deterministic harness (ManualClock, fixed OTP). Includes 6 Oct 6 prototype scenarios. No test covers POST /prototype/family/children, /family/subscribe, /family/trips, /family/trips/:id/incident or /admin/prototype/assignment/:id. Each run leaves about 116 MB of temp dirs (test/harness.ts:16 has no cleanup). |
| Mobile component tests | `CI=1 pnpm --filter @naya/passenger test` | **Pass**: 15/15 tests, 1 suite, 11.6 s | The only suite is packages/ui/src/__tests__/components.test.tsx, which tests the shared UI kit. There are no passenger or driver screen tests. Driver and admin have no test runner. `... test -- --ci` runs zero tests and exits 1, because pnpm 12 passes the literal `--` to jest. |
| Web store test | `node --test tests/store.test.mjs` in apps/web | **Pass**: 4/4 | Prints a MODULE_TYPELESS_PACKAGE_JSON warning. It relies on Node's native TS stripping (Node 22.18 or later). |
| Expo lint, passenger | `npx expo lint` in apps/passenger | **Pass**: 0 errors, 5 warnings | 4 unused imports (`(tabs)/account.tsx:1`, `(tabs)/trips.tsx:1`, `preferences.tsx:10`, `quote.tsx:21`) and a React Compiler skip on `watch()` at `(verify)/identity.tsx:42`. |
| Expo lint, driver | `npx expo lint` in apps/driver | **Pass**: 0 errors, 5 warnings | 4 unused imports (`(tabs)/account.tsx:1` twice, `(tabs)/index.tsx:1`, components/DossierHub.tsx:4) and the same `watch()` skip at docs/identity.tsx:23. |
| Lint over shared code (not a gate today) | `eslint -c apps/passenger/eslint.config.js packages/ui/src services/demo-api/src packages/domain/src packages/api/src apps/admin/src` | **Fail**: 22 errors, 10 warnings | Hooks and compiler rules, e.g. packages/ui/src/map/TileMap.tsx:104-106, packages/ui/src/map/useAnimatedCoordinate.ts:10, packages/ui/src/BottomSheet.tsx:53. Some are Reanimated false positives. None have been triaged. |
| Root test | `pnpm test` | **Fails** unless 4 servers are running | It also runs @naya/e2e (package.json:17), which README.md:153 does not say. |
| Playwright e2e | `pnpm e2e` | **Not run** in this audit | See below. |
| Website Playwright | apps/web/tests/prototype.spec.ts | **Never run** | 5 tests. No script runs them. The config needs system Chrome and `npm run dev` (apps/web/playwright.config.ts:10-18). |
| Peer dependencies | `pnpm peers check --lockfile-only` | **1 issue** | react-reconciler@0.34.0 wants react ^19.3.0 (installed: 19.2.3). |

**Why e2e was not run.** The suite needs four servers that you start by hand: API on 4010, passenger web on 8081, driver web on 8082 and admin on 5173 (e2e/playwright.config.ts:10-13). The config has no `webServer` block. Port 8082 appears in no doc, and the root `passenger` and `driver` scripts both start on 8081 (package.json:13-14). Every spec also wipes the shared API through POST /dev/reset. This audit was read-only, so it started no servers.

**What e2e coverage exists.** There are 40 tests in 9 specs: passenger-flows 13, driver-flows 10, admin-operations 5, admin-auth 3, admin-verifications 3, deeplinks-passenger 2, scenarios-cross-role 2, deeplinks-driver 1 and scenarios-feedback 1. The last full run was around 30 September (README.md:170, 39/39). The Oct 6 report in e2e/playwright-report holds one test. At most 6 of the 40 have run since commit 89aae18, which rewrote the booking, support and ride flows.

**Expected failure.** driver-flows.spec.ts:149 and :199 click `provider-card`. Since Oct 6, the driver recharge list shows two providers with that testID. services/demo-api/src/services/prototype.ts:216-232 adds a second 'Carte bancaire (démo)' next to the one seeded at seed.ts:106. Playwright's strict mode rejects a locator that matches twice, so expect at least these two tests to fail.

**What the Oct 6 features lack.** No UI-level test covers these: category selection and price comparison, dispute evidence upload (there is no `setInputFiles` call anywhere), edits in the admin Services catalog, wallet-paid ride hold and settlement, refused top-ups, passenger-side SOS, and the family error paths (wrong child name, wrong handover code). scenarios-feedback.spec.ts is a single 240 s test, so one failure hides every later check. It also writes screenshots to hard-coded /tmp paths (:110, :117, :126-128).

Fixes:
1. Run the full `pnpm e2e` on fresh servers now. Fix what fails before starting new feature work. (S)
2. Add `webServer` entries for the four servers to e2e/playwright.config.ts. (S)
3. Split the feedback spec into focused specs (categories, wallet, family happy path, family errors, SOS, dispute evidence, admin Services). Add API tests for the five untested routes. (M)
4. Clean up temp dirs in test/harness.ts. Add e2e/tsconfig.json and a `typecheck` script. (S)

### 7.2 Git state and uncommitted work

I checked all of this with `git status`, `git log`, `git show --stat` and `git diff`.

- **Local master is 1 commit behind origin/master.** The missing commit is 02ff3d3 by Arselene (6 Oct, 11:51), titled "chore: enable unrs-resolver build in pnpm workspace configuration". It changes 4 files: pnpm-lock.yaml (+2,244 lines), pnpm-workspace.yaml (adds `unrs-resolver: true` under `allowBuilds`), apps/passenger/app.config.ts (buildNumber '3' to '4') and apps/driver/app.config.ts ('4' to '5'). The message describes only one of the three changes.
- **The lockfile was broken on master.** Your commit 89aae18 (6 Oct, 06:17) added eslint to apps/passenger without updating pnpm-lock.yaml. `pnpm install --frozen-lockfile` failed on origin for about 5.5 hours, until 02ff3d3 fixed it by hand.
- **Uncommitted pnpm-lock.yaml** (+2,244 lines). This is the same fix, made separately. It is not identical to origin: the two versions differ by 316 diff lines, for example @napi-rs/wasm-runtime 1.2.4 vs 1.2.5 and @typescript-eslint/* 8.71.0 vs 8.71.1. Your local pnpm-workspace.yaml also lacks the `unrs-resolver` entry.
- **Uncommitted apps/passenger/app.config.ts.** It adds `appleTeamId: '89884BGNZR'` and the `../../plugins/with-ios-build-paths` plugin. The appleTeamId line sits next to the buildNumber line that origin changed, so `git pull` will conflict.
- **Untracked plugins/with-ios-build-paths.js.** The config edit needs this file. Committing the config without it breaks prebuild for everyone else. The driver config does not use the plugin, so the driver build will hit the same EXConstants and bundle-script failure on a path with spaces. The plugin rewrites Xcode shell phases with a regex (plugins/with-ios-build-paths.js:38-49), which can break on Expo SDK upgrades.
- **Untracked achref-dev-skill-debt/ and achref-dev-skill-debt-images.zip** (13 MB and 13,444,431 bytes). They hold 12 PNGs, a manifest and image-prompts.md for an unrelated "Skill Debt" project (Apollo DSKY and moon art). Neither is git-ignored, so `git add -A` would commit 26 MB of another project.
- **Build numbers disagree in three places.** docs/STANDALONE-DEMO.md:13 says 2/3, your local configs say 3/4 and origin says 4/5. eas.json also uses `appVersionSource: remote` with autoIncrement. This makes a duplicate TestFlight upload easy.
- **Two people push straight to master.** There is no PR, review or branch protection.

What to do, in order:
1. Move `achref-dev-skill-debt/` and its zip out of the repo, into their own project folder.
2. Discard the local pnpm-lock.yaml change (`git restore pnpm-lock.yaml`). Origin already has an equivalent fix, and a lockfile can always be regenerated. Stash only apps/passenger/app.config.ts.
3. Run `git pull --ff-only`.
4. Re-apply appleTeamId and the plugin on top of buildNumber '4'. Add both to apps/driver/app.config.ts as well.
5. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, the unit tests and `expo lint`. Then commit plugins/with-ios-build-paths.js and both configs in one commit.
6. Agree with Arselene on branches and pull requests. Protect master once CI exists (7.4).
7. Pick one source for build numbers (EAS remote or app.config.ts) and write the current TestFlight numbers in the docs.

Alternative: move the repo to a path without spaces. Then the plugin is not needed at all.

### 7.3 Repo size and stray files

| Item | Size | In git? | Action |
|---|---|---|---|
| .git pack | 222.6 MiB (`git count-objects -vH`) | n/a | Only a history rewrite shrinks it. |
| All tracked files | 205 MB (205,312 KB) | Yes | See the rows below. |
| docs/screens | 170 MB in 421 files (native 92 MB, driver 35 MB, passenger 32 MB, admin 9 MB, feedback 2.7 MB). 216.5 MB across history (591 blobs). Touched by 9 of 20 commits. | Yes | Move to Git LFS or external storage, and keep a small curated set in docs. |
| Images, all paths | 256.8 MB of the 271.1 MB of history blobs (about 95%) | Yes | Same as above. |
| apps/web/public + apps/web/review | 23.9 MB | Yes | 10 of the 14 public files are never referenced (about 13 MB: hero*.png, driver*.png, car.png, amina.jpg, salma.jpg, logo-white.svg). review/ holds 25 screenshots (6.7 MB). Delete them or move them out. |
| achref-dev-skill-debt/ + zip | 13 MB + 13 MB | Untracked, not ignored | Move out of the repo. Add `*.zip` to .gitignore. |
| work/ | 7.4 GB (DerivedData 3.6 GB, xcode-shared-cache 2.1 GB, xcode-cache 1.2 GB, the 1.0.0-3 xcarchive) | Ignored | Move it outside the repo and point Xcode DerivedData elsewhere. |
| apps/driver/ios, apps/passenger/ios | 1.2 GB, 663 MB | Ignored (generated by prebuild) | Fine as is. |
| apps/web/node_modules/.ignored | 458 MB | Ignored | Left over from an npm install. Delete it. |
| .playwright-mcp/ | 14 MB | Ignored | Delete it. |
| OS temp from API tests | About 116 MB per run (45 dirs) | n/a | Fix the harness cleanup (7.1). |

Why this matters: clones are slow. Agents and search tools index gigabytes of images and caches. Every screenshot refresh adds tens of MB to history for good. Rewriting history with `git filter-repo` means force-pushing to ProgixDev/naya, so agree on it with Arselene first. Turning on LFS for new captures is the low-risk first step.

### 7.4 Tooling gaps

1. **No CI.** There is no .github, .gitlab-ci.yml, .circleci or git hook tooling. The remote is github.com/ProgixDev/naya. The cost has already shown up: a broken lockfile on master for 5.5 hours, and verification claims in README.md:162-171 that are out of date. Fix: add a GitHub Actions workflow on Node 24 and pnpm 12.8.1 that runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, the unit tests (domain, demo-api, passenger jest, web node:test), lint and `pnpm peers check`. Add a nightly or manual job that starts the servers and runs Playwright. Then protect master. (S)
2. **Root `pnpm test` includes e2e** (package.json:17). Fix: change it to `pnpm -r --filter '!@naya/e2e' --if-present test` and correct README.md:153. (S)
3. **Lint covers 2 of the 10 workspaces.** Only apps/passenger/package.json:12 and apps/driver/package.json:12 define `lint`. There is no root lint script, and the shared code hides 22 errors. The driver app lints with eslint packages it does not declare (apps/driver/package.json:72-76). It works only because hoisting exposes the passenger app's copies. Fix: add a root flat ESLint config (RN preset for the mobile apps and packages/ui, React/TS preset for admin, Node preset for the API) and a root `lint` script, then triage the 22 errors. (S–M)
4. **No formatter.** There is no .editorconfig and no root Prettier config; only apps/web/.prettierrc.json exists. Lines over 200 characters: 117 in apps/passenger/src (longest 623), 119 in apps/driver/src (longest 567), 106 in apps/admin/src (longest 535). Both mobile apps declare prettier-plugin-tailwindcss, but Prettier itself is not installed. Fix: add a root Prettier config (printWidth about 120, with the tailwind plugin). Reformat in one commit, list that commit in .git-blame-ignore-revs, and run `prettier --check` in CI. (S)
5. **E2E setup is undocumented.** See 7.1. (S)
6. **apps/web uses both npm and pnpm.** pnpm-lock.yaml:616 has an apps/web entry, and apps/web/package-lock.json (75 KB) is also tracked. The two have drifted: lucide-react is 1.52.0 under npm and 1.49.0 under pnpm (where it is pinned on purpose, pnpm-workspace.yaml:13-14), postcss 8.5.29 vs 8.5.28, @types/node 24.19.1 vs 24.19.0. The root `dev` and `build` scripts call npm (package.json:22-23), and README.md:190 recommends npm. The root `build` builds only the marketing site. Fix: delete apps/web/package-lock.json, the two npm root scripts and the `.ignored` folder, and update README.md and apps/web/README.md:11-13. If Vercel hosts the site, set it up for the pnpm workspace. (S)
7. **packageManager is pinned; Node is not.** `packageManager: pnpm@12.8.1` is good. But engines says `node >=22` (package.json:6-8), there is no .nvmrc, README.md:55 says Node 24.12, and the web test needs Node 22.18 or later. Fix: add `.nvmrc` with 24, set engines to `>=24`, and add `"type": "module"` to apps/web/package.json. (S)
8. **The root .env does nothing.** README.md:62 says to run `cp .env.example .env`, but no process reads that file. The demo API runs `tsx watch src/main.ts` without dotenv, Vite reads apps/admin, and Expo reads apps/<app>/.env. If you set NAYA_DEV=0 in it, dev mode stays on (services/demo-api/src/main.ts:13). Fix: load it explicitly (`tsx --env-file`, Vite `envDir`), or rewrite .env.example to say which file each process reads. (S)
9. **No agent entry file.** There is no root AGENTS.md or CLAUDE.md. AGENTS.expo.md is not loaded automatically, and its advice is wrong for this repo: it says to use `npx expo install` instead of pnpm (:16) and EAS cloud builds (:34), but the team archives in Xcode locally. The `_handoff/` spec is git-ignored (.gitignore:13), even though README.md:7 calls it the source of truth. Fix: add a root AGENTS.md (and a CLAUDE.md that imports it) with the commands, gates and baselines from this section. (S)
10. **The EAS development-device profile points at localhost.** See apps/passenger/eas.json:10-13 (inherited at :19-24); the driver profile is identical. packages/ui/src/core/apiBase.ts:15-16 prefers this URL over Metro-host detection, so a dev build on a real phone calls its own localhost and every request fails. Fix: remove EXPO_PUBLIC_API_URL from that profile. (S)

### 7.5 Dependency hygiene

What is good: core libraries are installed exactly once, at the same version everywhere: react 19.2.3, react-native 0.86.3, @tanstack/react-query 5.104.0, zod 4.6.5, TypeScript 6.0.3, Tailwind 3.4.19. No secrets or signing files are tracked.

Problems:
1. **Workspace dependencies are not declared.** This works only because pnpm-workspace.yaml:8 sets `nodeLinker: hoisted`.
   - packages/ui/package.json:10-15 declares 4 dependencies, but packages/ui/src imports @naya/api (23 imports), react-native (39), react (31), @tanstack/react-query (11), lucide-react-native (11), zustand and about 20 expo-* modules.
   - services/demo-api/src/platform.native.ts:3 imports expo-crypto and src/fixtures.native.ts:1 imports expo-asset. Neither is declared.
   - packages/ui/src/core/localDemo.native.ts:3 imports `../../../../services/demo-api/src/fixtures.native` directly, bypassing the package's exports.
   - packages/ui/tsconfig.json:4 includes apps/passenger/nativewind-env.d.ts, so a shared package depends on an app.

   Switching to isolated linking, extracting a package or adding a third app will break in confusing ways, and tools like Renovate and depcheck cannot see who owns what. Fix: declare peerDependencies in packages/ui and add @naya/api, export fixtures.native from demo-api, and move the .d.ts file into packages/ui. (S–M)
2. **Unused dependencies.** No code imports expo-device, yet both apps declare it (apps/passenger/package.json:35, apps/driver/package.json:33). The passenger app declares expo-task-manager (:53), but only the driver uses it. prettier-plugin-tailwindcss is unused. Fix: remove them and re-run expo-doctor. (S)
3. **Driver eslint is undeclared.** See 7.4. (S)
4. **One unmet peer dependency.** react-reconciler@0.34.0, pulled in by @testing-library/react-native ^14.0.1 through test-renderer@1.3.0, wants React ^19.3.0 (pnpm-lock.yaml:13666-13670). README.md:171 says there are no peer issues. Fix: pin a version of the testing library that supports React 19.2, or document the issue until SDK 58. (S)
5. **The web lockfiles have drifted** (7.4 item 6), and **unrs-resolver is not allowed to build locally** until you pull 02ff3d3 (7.2).
6. **Not re-checked:** README says "expo-doctor passes 21/21", but expo-doctor needs network access, so this audit could not confirm it. Run it after the cleanup.
7. **The demo backend ships in every native build.** packages/ui/src/core/Providers.tsx:17-18 always imports the embedded demo API, including the seeded admin passwords and 812 KB of specimen documents. See 8.7.

---

## 8. Production-readiness gap

Today Naya is a well-built demo, not a pre-production system. There is no production backend: the production EAS profile points at the placeholder `https://api.naya.example` (apps/passenger/eas.json:36, apps/driver/eas.json:36). There is no deployment config (no Dockerfile or hosting manifest), no CI, no crash reporting (no Sentry or similar in any package.json) and no remote push. docs/INTEGRATIONS.md is honest about most of this and labels it demo scope. This section ranks what stands between the demo and a real launch in Rabat.

**Sizes** are rough estimates for one experienced engineer: **S** = under a week, **M** = 1–3 weeks, **L** = 1–2 months, **XL** = more than 2 months. External lead times (contracts, licences, CNDP filings) come on top, and they are often longer than the engineering.

### 8.0 Ranking at a glance

| Rank | Group | Launch blocker? | Overall size | First decision needed |
|---|---|---|---|---|
| 1 | Backend & data | Yes | XL | Backend platform: managed Postgres, host, hosting region |
| 2 | Legal & compliance | Yes. Start now: longest lead time | L, mostly external | Counsel for CNDP, transport licensing, women-only basis, minors |
| 3 | Identity/KYC & women-only eligibility | Yes | L | Reviewer policy for the women-only rule; KYC vendor or manual process |
| 4 | Payments & wallets | Yes | L–XL plus contracts | Card PSP; whether a passenger stored-value wallet ships at all |
| 5 | Safety (SOS, family, telephony) | SOS: yes. Naya Famille: can wait | L, plus staffing; Famille XL | Launch with or without Naya Famille |
| 6 | Real-time & push | Yes | M–L | APNs/FCM setup and a server push sender |
| 7 | Mobile release | Yes | M–L | Is Android in launch scope? |
| 8 | Operations/backoffice | Yes, for day-one operations | M–L | Which backoffice is canonical |

Within each group, items are ranked most important first. Each item gives the current state with evidence, then what is needed, then a size.

### 8.1 Backend & data

1. **Production backend and database.** *Now:* Hono over a single-writer JSON file (services/demo-api/src/store.ts, data in services/demo-api/.data/db.json). All timers run on a 500 ms in-process tick (services/demo-api/src/main.ts:37-41). *Needed:* managed Postgres with real transactions and row locks, migrations, opaque IDs, and a job queue for offer timeouts, scheduled rides and hold expiry. Also hosting in a chosen region, backups, logs, metrics and alerting. Keep the packages/api contracts, which match the server routes one to one, and port packages/domain as-is. **XL**
2. **Configuration that fails closed.** *Now:* dev mode is on unless NAYA_DEV=0 (main.ts:13). The server binds 0.0.0.0 (main.ts:45). CORS accepts any origin (services/demo-api/src/app.ts:202). /dev/* routes need no authentication (app.ts:895-988). The HMAC secret defaults to 'demo-provider-secret-change-me' (main.ts:15). Demo admins are seeded in every mode (main.ts:23, seed.ts:299-303). *Needed:* a production backend with no /dev or sandbox routes at all, secrets from a secret manager, one callback secret per provider with timestamped signatures, and a CORS allow-list. Do not carry these demo patterns into the new backend. **S**
3. **Role-specific responses and an authorization matrix.** *Now:*
   - The driver's family payload includes the child handover codes (services/demo-api/src/services/prototype.ts:250-257).
   - A driver who was only offered a ride receives the whole ride: the other driver's plate and the passenger's rating comment (app.ts:434-440).
   - The support role can see revenue and every driver's balance (app.ts:647-656, :688).
   - /admin/cities and /admin/providers check no permission (app.ts:859-863, 872-876).

   *Needed:* an explicit response shape (DTO) per role, plus authorization-matrix tests in CI. **M**
4. **Persistence that is safe for money.** *Now:*
   - The idempotency record is committed in a second transaction (app.ts:138-142).
   - Passenger wallet entries are rewritten in place, and GET handlers write balances outside any transaction (prototype.ts:106-118, 159-184; app.ts:360, 564).
   - These actions write no audit event: passenger cancel and fee, offer acceptance, scheduled rides, profile and payment-method changes (services/demo-api/src/services/rides.ts:464-488, 349-384, 714-782; app.ts:257-271, 365-408).
   - The audit chain is not anchored, so anyone with write access can rehash it (services/demo-api/src/audit.ts:8-12).

   *Needed:* the idempotency row written in the same DB transaction with a unique (subject, key), an append-only passenger ledger like the driver's, a written audit policy, and an anchored audit log (signed checkpoints or a write-once table). **M**
5. **Turn the /prototype module into real features.** *Now:* categories, the passenger wallet, Naya Famille, SOS and dispute reasons live under /prototype. They use inline Zod schemas (prototype.ts:25-92) and optional state created on first use (services/demo-api/src/state.ts:87). Admin edits there skip the reason, version check and before/after record (prototype.ts:269-289, 890-925). *Needed:* proper domain modules with schemas and state machines in packages/domain, routes without "prototype" in the path, and config changes that follow the updateRules pattern (services/demo-api/src/services/cities.ts:78-106). **L**
6. **File storage.** *Now:* uploads are written to a local folder (services/demo-api/src/services/uploads.ts:24-26) as base64 inside JSON, with no body size limit (app.ts:97-105) and no per-user quota. *Needed:* encrypted object storage, pre-signed uploads, size limits and retention jobs. **M**
7. **Maps, routing and zones for Rabat.** *Now:* demo routing (1.35 × straight-line distance at 24 km/h, per docs/INTEGRATIONS.md). Reverse geocoding uses a fixed list of Rabat and Casablanca places (app.ts:343-349). The fallback map uses OpenStreetMap's standard tiles, which are meant for development. *Needed:* a routing and ETA API, geocoding that handles Moroccan addresses, Rabat zone polygons, and licensed map tiles or a keyed Google Maps on Android. **M**

### 8.2 Legal & compliance

Start these now. They depend on outside counsel and regulators, and they decide the scope of 8.3 and 8.5.

1. **CNDP (law 09-08) and a DPIA.** *Now:* nothing is filed or drafted. docs/INTEGRATIONS.md lists "DPIA / CNDP declaration" as a need for identity review. Naya will process ID documents, selfies and precise location, plus minors' data if Naya Famille ships. *Needed:* CNDP declarations or authorisations, a DPIA, a record of processing, a retention schedule, and a decision on hosting location and cross-border transfers. **L (mostly external)**
2. **Legal basis for a women-only service.** *Now:* the rule exists only in help copy (apps/passenger/src/features/help/topics.ts:38) and in reviewers' heads. *Needed:* a written legal opinion for Morocco, then encode the rule as described in 8.3. **M (external)**
3. **Transport licensing, terms and contracts.** *Now:* the apps have no terms of use (CGU), privacy policy or driver agreement. The landing page's legal modal calls the site a prototype (apps/web/components/landing.tsx:862-873). *Needed:*
   - Confirm with Moroccan counsel which licence regime applies to the drivers and to Naya.
   - Insurance for passengers and drivers.
   - CGU/CGV, a privacy policy and a driver contract.

   **L (external)**
4. **Minors (Naya Famille).** *Now:* child name, age, school and notes are stored with no consent or retention rule (prototype.ts:74-92). Arrival photos are stored as support attachments, which any admin with support.resolve can read (uploads.ts:60-64; packages/ui/src/features/prototype.tsx:685). The landing page says children ride only with their mother (landing.tsx:40), but Naya Famille carries unaccompanied children aged 1–17 (prototype.ts:76). *Needed:* settle the minors policy first. Then add parental consent, access limited to the people who need it, and retention rules. **M once the policy is decided**
5. **Account deletion.** *Now:* the passenger app can only ask support (apps/passenger/src/app/(app)/preferences.tsx:60); the driver app has nothing. *Needed:* an in-app deletion request, server-side processing that keeps financial records where the law requires, and an admin view. The App Store requires this, and so do data-subject rights under law 09-08. **S–M**
6. **Copy that makes claims.** *Now:*
   - The apps list "15 (SAMU)" (packages/ui/src/features/support.tsx:149; topics.ts:48). In Morocco, 15 is the Protection civile and SAMU is 141; confirm this locally.
   - They promise masked calls (apps/passenger/src/features/ride/ContactSheet.tsx:14), priority handling and replies within 24 h (services/demo-api/src/services/support.ts:39). Nothing implements these.
   - docs/MOBILE-FEEDBACK-DEMO.md:10 calls the Naya Famille name check "child-name verification", which overstates what it does.

   *Needed:* a legal and operations review of all safety copy before launch. **S**

### 8.3 Identity/KYC & women-only eligibility

1. **Record the eligibility rule.** *Now:* IdentityDetails has no sex field (packages/domain/src/entities.ts:100-106). The review decision has no checklist item for it, only the generic 'not_eligible' reason (services/demo-api/src/services/verification.ts:27). *Needed:* an explicit checklist item that the reviewer confirms on every decision, a written policy (ADR) and an appeal path. Keep the current choice of no automated gender inference. **S–M**
2. **KYC process.** *Now:* real uploads and manual review in the admin, with no check that documents are genuine, no liveness check and no face match (docs/INTEGRATIONS.md). *Needed:* a KYC vendor, or a defined manual process with SLAs. Also a policy on which reviewers may see documents, an audit entry for every document view, and encrypted storage (8.1 item 6). **L**
3. **Driver and vehicle vetting.** *Now:* a vehicle records only make, model, color, plate and year (entities.ts:108-114). Category eligibility is a per-driver list of admin checkboxes that defaults to every category (rides.ts:262, 370; apps/admin/src/pages/Prototype.tsx:194-234), so car drivers receive Scooter requests. *Needed:* vehicle type, seats and comfort level; licence and insurance with expiry dates and re-verification; eligibility derived from the approved vehicle; and a decision on whether Scooter is in launch scope. **M**
4. **Sign-in.** *Now:*
   - Dev mode uses the fixed code 123456.
   - With NAYA_DEV=0, codes are printed to stdout (services/demo-api/src/services/auth.ts:35-36). The only limit is a 30 s resend window per phone, and codes are hashed with unsalted SHA-256 (auth.ts:41).
   - Admin login has no lockout or MFA, and its synchronous scrypt blocks the server on every attempt (auth.ts:129-133).

   *Needed:* an SMS aggregator that covers Maroc Telecom, Orange and inwi; caps per IP, per number prefix and per day; and admin MFA with user management. **M**
5. **Driver photo.** *Now:* `avatarFor` returns null, so the driver card shows initials (packages/ui/src/Ride.tsx:179, 186). *Needed:* a reviewer-approved portrait taken from verification, used with consent. **S–M**

### 8.4 Payments & wallets

1. **Card payments.** *Now:* a demo sandbox with test cards 4242, 0002 and 3155 (docs/INTEGRATIONS.md). Even with NAYA_DEV=0, a user can approve her own payment through /provider-sandbox (app.ts:593-607). *Needed:* a Moroccan PSP or acquirer with hosted fields or an SDK, signed webhooks, refunds and 3-D Secure. **L plus contract**
2. **Passenger stored-value wallet.** *Now:* a passenger can top up as much as 10,000,000 centimes (100,000 MAD) and confirm the top-up herself (prototype.ts:453-517). Wallet entries can be changed in place. The wallet does not appear in admin Finance (app.ts:816-837); only config.edit admins can see it. *Needed:* first decide whether it launches at all, because holding customer funds probably requires a licensed payment-institution partner. If it does launch: top-ups confirmed only by the provider, an append-only ledger, daily reconciliation and Finance views. My recommendation is to launch without it. **XL if kept; S to hide it**
3. **Cash, driver recharges and payouts.** *Now:* agency recharges and bank withdrawals are simulated. Cash Plus, Wafacash and the mobile wallet were added as 'cash_network' providers (prototype.ts:216-232). Rides paid by mobile wallet are confirmed instantly, with no provider step (rides.ts:625-629). *Needed:* agreements with cash networks and a payout provider, beneficiary verification and reconciliation. **L plus contracts**
4. **Money bugs to fix before real money.** *Now:*
   - Cash cancellation fees stay pending forever, although the receipt says they will be collected with the next ride (rides.ts:439-462; apps/passenger/src/app/(app)/receipt/[id].tsx:19).
   - Category commission overrides city commission, so Casablanca's 18% becomes 15% (rides.ts:127).
   - Receipts and driver screens label wallet and mobile-wallet payments as "Carte" (receipt/[id].tsx:21; apps/driver/src/app/(app)/(tabs)/earnings.tsx:69-70).

   *Needed:* fixes plus scenario tests, and an ADR on how commission is resolved. **S–M**
5. **Refunds through disputes.** *Now:* the outcome "Remboursement accordé" moves no money. The outcome defaults to "Rejetée" (apps/admin/src/pages/Ticket.tsx:12, 22), and the ticket status is inferred from the outcome text with a regex (support.ts:85). *Needed:* a fixed list of outcomes, each tied to a refund, credit or driver adjustment that requires finance permission. **M**
6. **Naya Famille billing.** *Now:* subscribing writes "paiement simulé" to the audit log and charges nothing (prototype.ts:343-350). Drivers earn nothing for family trips. *Needed:* subscription billing and driver payouts through the ledger, once the Famille model is decided (8.5). **M**

### 8.5 Safety (SOS, family, telephony)

1. **SOS end to end.** *Now:*
   - The alert lives only in the screen's local state (packages/ui/src/features/prototype.tsx:61, 67-74). The `alerts()` client call is never used (packages/api/src/client.ts:459), so the person who raised the alert never sees that help is coming.
   - Admin SOS screens require config.edit (prototype.ts:877-878, 926-928), so support agents cannot see alerts. There is no badge and no sound.
   - The recorded location is the simulated driver position (apps/passenger/src/app/(app)/ride.tsx:173).
   - In standalone builds, the app tells testers that alerts reach the back-office, but they stay on the phone (prototype.tsx:99).

   *Needed:* a safety.respond permission and a top-level SOS queue with sound alerts; alert status sent back to both apps; device GPS; a one-tap trigger with a cancel window; trusted contacts saved in the profile. Also a staffed 24/7 safety desk with an escalation runbook. **L, plus staffing**
2. **Contact between passenger and driver.** *Now:* the contact buttons do nothing, but the copy promises masked numbers (ContactSheet.tsx:14; apps/driver/src/app/(app)/ride.tsx:222). *Needed:* fix the copy now (S). Add an in-app ride chat first (M), then a number-masking telephony provider (M plus contract).
3. **Support priority and SLAs.** *Now:* SupportTicket has no priority field (entities.ts:562-578), and the admin sorts tickets by last update only (app.ts:801). Rejected tickets stay in the open queue (app.ts:801, 667). *Needed:* a priority field (safety tickets are urgent), SLA timers and a staffing plan. **M**
4. **Naya Famille.** *Now:*
   - The driver receives the handover codes (prototype.ts:250-257). Codes are fixed per recipient, and wrong guesses are not limited (prototype.ts:699-707).
   - The child check asks the driver to type the name shown on her own screen (prototype.tsx:627-628, 697-705; prototype.ts:688-698).
   - Trips ignore the addresses the parent types (prototype.tsx:549-560).
   - The dedicated driver is simply the first verified driver in the city, and dispatch ignores family trips (prototype.ts:303-319; rides.ts:245-249).
   - Parents cannot cancel or edit trips, and recipients cannot be revoked (prototype.ts:446-1027).

   *Needed:* an ADR on whether family trips are regular rides. Then:
   - one-time codes per trip, stored hashed on the server, with an attempt limit;
   - a parent-approved child photo, and parent confirmation at pickup and handover;
   - recipient revocation;
   - dispatch and eligibility integration;
   - legal sign-off.

   My recommendation is to leave it out of launch scope. **XL**
5. **Ratings and reports in both directions.** *Now:* only passengers can rate (rides.ts:503-518). Drivers see a passenger rating that never changes (apps/driver/src/app/(app)/ride.tsx:206). The drivers are women too, and they need a way to report passengers. **S–M**

### 8.6 Real-time & push

1. **Remote push.** *Now:* the apps use local notifications only (docs/INTEGRATIONS.md), and no app code requests a push token (no `getExpoPushTokenAsync` or `getDevicePushTokenAsync`). A driver whose phone is locked misses ride offers. *Needed:* an EAS project ID, an APNs key, FCM credentials, a server push sender, and delivery tests on real devices. **M**
2. **Live updates.** *Now:* live screens poll every 1.5–3 s (docs/INTEGRATIONS.md). *Needed:* WebSocket or SSE, or invalidation driven by push, plus a load test at Rabat volumes. **M**
3. **Background location.** *Now:* the driver app tracks location during a ride (apps/driver/src/lib/backgroundLocation.ts), but this was never tested with the screen locked (README.md:177). *Needed:* device testing, battery testing, and a justification for the "Always" location permission in store review. **S–M**
4. **Notification service.** *Now:* the notification preference toggles (rideUpdates, scheduledReminders, supportReplies) are stored but never read. Family events are written to trip.notifications but never shown (prototype.ts:726-729). The driver notification hard-codes "30 secondes" (apps/driver/src/app/(app)/_layout.tsx:32). *Needed:* a server notification service with an inbox that respects preferences. **M**

### 8.7 Mobile release (Android, physical-device testing)

1. **Android.** *Now:* never built or run, because the build machine has no Android SDK (README.md:55, 175). The Google Maps key path is untested. *Needed:* Android builds, a Play Console account, FCM, and tests on a range of real Android phones. **M–L**
2. **Physical-device testing.** *Now:* README.md:177 lists what has not been verified: physical devices, background location with the screen locked, push to a closed app and camera capture on a device. The Oct 6 native checks ran new JavaScript inside copies of old simulator binaries (docs/MOBILE-FEEDBACK-DEMO.md:48). *Needed:* a device test plan, plus TestFlight and Play internal tracks running against a real backend. **M**
3. **Remove demo code from release builds.** *Now:*
   - packages/ui/src/core/Providers.tsx:17-18 always imports the embedded demo API, with its seeded admin passwords and 812 KB of specimen documents.
   - Demo mode is on unless EXPO_PUBLIC_DEMO is '0' (packages/ui/src/core/apiBase.ts:4).
   - The simulation buttons are never hidden (prototype.tsx:264-276, 359-365, 89-138).
   - The wallet, Naya Famille and the six-logo gallery always appear in the account menu (apps/passenger/src/app/(app)/(tabs)/account.tsx:34-36; apps/driver/src/app/(app)/(tabs)/account.tsx:45-46).

   *Needed:* exclude the demo code at build time (a Metro alias), make demo mode opt-in, and hide every simulation control in production. **S–M**
4. **Release configuration.** *Now:* the production API URL is a placeholder (eas.json:36). Build numbers disagree in three places (7.2). The development-device profile points at localhost (7.4). The iOS path plugin is on passenger only. *Needed:* a real API URL per environment, one source for build numbers, store listings and privacy labels, and crash reporting (there is none today). **S–M**

### 8.8 Operations/backoffice

1. **One backoffice.** *Now:* there are two. The Vite admin runs on the demo API and has roles and an audit chain. The Next /backoffice runs on browser localStorage (apps/web/lib/store.ts:468) with no login and no noindex, on the public website (apps/web/components/backoffice.tsx). Its fictional people contradict the admin's, and it does money math in floats. *Needed:* make apps/admin the only backoffice. Port the useful ideas from /backoffice (work queue, ticket priority, service kill-switch), then remove /backoffice from the public site. **M**
2. **Admin access.** *Now:* the login page shows one-click demo accounts with full permissions (apps/admin/src/pages/Login.tsx:11-14, 56-74). Production sourcemaps are on (apps/admin/vite.config.ts:7). There is no admin user management. *Needed:* real admin accounts with MFA and lockout, and the demo panel shown only when VITE_DEMO is set. **M**
3. **Roles.** *Now:* Services, SOS, Naya Famille and passenger wallets all sit behind config.edit (apps/admin/src/router.tsx:75). *Needed:* separate safety, family-ops and finance roles with matching permissions. **S–M**
4. **Safe configuration editing.** *Now:* catalog edits record no reason, version check or diff (prototype.ts:890-925). Saving any catalog row turns back on the providers an admin switched off on the Paiements page (prototype.ts:913, 234-237). Clearing a fare field saves 0 MAD (apps/admin/src/pages/Prototype.tsx:512-517). *Needed:* typed forms, plus a reason, an expected version and a before/after record for every change. **M**
5. **Finance operations.** *Now:* passenger wallets are missing from the Finance page (app.ts:816-837). Cash fees that never resolve pile up in pendingPayments (app.ts:835). *Needed:* reconciliation views, a daily close and exports for accounting. **M**
6. **Opening a city.** *Now:* a new city gets no zones and no cash provider (services/demo-api/src/services/cities.ts:58-69; packages/domain/src/geo.ts:25). This matters little for a Rabat-only launch. *Needed:* a city launch checklist in the admin. **M**

### 8.9 Not covered by this audit

Tax and invoicing (VAT on commission, driver invoices), insurance products, load and performance testing, and incident response or on-call. Treat these as open questions, not as cleared.

### 8.10 Suggested sequence

1. **This week (all S):** clean up git (7.2), add CI (7.4), run the full e2e suite (7.1), make demo flags opt-in, and correct the safety and contact copy.
2. **Next 2–3 weeks (decisions):** write ADRs on the backend platform, the payment partner and wallet scope, Naya Famille scope, the women-only legal basis and the canonical backoffice. Engage counsel on CNDP, licensing and minors now, in parallel.
3. **Then build:** port the backend with KYC storage, push and payments (XL). Then SOS end to end, Android, and device testing against the real backend.

---

## 9. Decisions needed from Achraf

The 11 areas raised about 110 open questions. Many are the same question asked from different sides. They are merged here into 15 decisions. Each one maps to a Proposed ADR from section 6.6. Record each answer there, so the next chat inherits it instead of asking again.

Questions that a command can answer were dropped. Section 7.1 ran typecheck, unit tests and lint on 13 October, and they pass. The full e2e suite is still unverified, but running it is a task (section 10), not a decision.

Decide D1, D2, D3, D5 and D6 first. They touch money, the law and physical safety, and they unblock the most top priorities (P5, P6, P7, P8, P16).

### Product scope & safety

**D1. How is a user shown to be eligible for a women-only service?**
- Why it matters: the rule defines the brand and is legally sensitive, but no code, checklist or committed doc defines it. Unblocks P6. Shapes P1 and P16. ADR-0034.
- Options:
  - (a) The reviewer checks the identity document and ticks a mandatory "eligibility confirmed" item on every decision. A rejected user has an appeal path.
  - (b) Self-declaration at sign-up, plus the same reviewer check.
  - (c) A KYC vendor reads the document field automatically.
- Recommended default: (a). Keep the handoff rule that nothing is inferred from appearance. Get a written legal opinion for Morocco before launch.
- Also decide: may an adult man be an authorised Naya Famille recipient? The seed adds a "Père" (services/demo-api/src/services/prototype.ts:592-597). Default: yes, but only as a handover recipient, never as a rider. Write that into the spec.

**D2. What does SOS do at launch, and who answers it?**
- Why it matters: SOS looks finished, but it is simulated in every build and never reports back to the person who raised it. Unblocks P5. P2 can start now with the default below.
- Options:
  - (a) Phone only: one tap calls the police, and live GPS is shared with a trusted contact. No Naya desk.
  - (b) (a), plus a Naya safety desk that receives alerts during staffed hours.
  - (c) A 24/7 desk, or a security partner.
- Recommended default: (b) at launch, with copy that states the desk's hours honestly. Move to (c) when volume justifies it. Support agents answer, through a new safety.respond permission (P2). Show SOS from driver_assigned onwards, not while the app is still searching. Make the sheet closable from the UI: the e2e test reloads the page to close it (e2e/scenarios-feedback.spec.ts:78-79).
- Emergency numbers: the apps say "15 (SAMU)" (packages/ui/src/features/support.tsx:149, apps/passenger/src/features/help/topics.ts:48). Verifiers note that in Morocco 15 is the Protection civile, SAMU is 141, the Gendarmerie is 177 and 112 works from mobiles. Confirm the list with local ops. Default until then: 19 (police), 177 (Gendarmerie, outside the city), and 15 relabelled "Protection civile".

**D3. Is Naya Famille part of the launch, and if so, how does it work?**
- Why it matters: it carries unaccompanied children and their data. Today it sits outside payment, dispatch and any written policy. Unblocks the second half of P1, and P16. ADR-0036.
- Sub-questions:
  - Minors policy. The landing page says children ride only with their mother (apps/web/components/landing.tsx:40). Famille accepts unaccompanied children aged 1–17 (services/demo-api/src/services/prototype.ts:76). Are boys included, and up to what age?
  - Model: are family trips rides with a family flag, or a separate product?
  - How the subscription is charged, how the dedicated driver is paid, and what happens when she is absent.
  - Which admin role may see child data and arrival photos.
- Options:
  - (a) Leave it out of the launch, and keep it as a demo behind the demo flag.
  - (b) Launch it as rides with a family flag, going through dispatch, payments and the ledger.
  - (c) Launch it as a separate product with its own scheduling and billing.
- Recommended default: (a). Take the handover codes out of the driver's payload now, whatever you choose (the first half of P1). If you later choose (b):
  - one-time codes per trip, stored hashed, with an attempt limit;
  - a parent-approved child photo, and parent confirmation at pickup and at handover;
  - a family.ops permission for child data;
  - legal sign-off on minors.

**D4. Which service categories launch, and who may drive them?**
- Why it matters: every driver receives every category, including Scooter at Scooter prices, and vehicles have no type. Unblocks P17. ADR-0043, and ADR-0026 (confirm intent).
- Sub-questions:
  - Is Naya Scooter a real offering? It raises licence, insurance, helmet and passenger-safety rules. Or is it a placeholder from the feedback?
  - Was Naya Confort intended? It reverses the handoff rule that colour variants never imply a premium tier (handoff prompt:85).
- Options:
  - (a) Standard and Confort at launch. Scooter is dropped or hidden.
  - (b) All three, with a two-wheeler vehicle type and its own verification.
  - (c) Standard only.
- Recommended default: (a). Add a vehicle type to the vehicle record. Derive eligibility from the approved vehicle. Start with no categories until approval, with an admin override.

### Money

**D5. Does a stored-value passenger wallet ship at launch?**
- Why it matters: a passenger can confirm her own top-up, and that money becomes withdrawable driver credit. Holding customer funds in Morocco probably needs a payment partner licensed by Bank Al-Maghrib; confirm with counsel. Unblocks the second half of P7, and the wallet wording in P14. ADR-0040.
- Options:
  - (a) No wallet at launch. Hide it outside demo builds.
  - (b) A wallet run with a licensed partner. Top-ups are confirmed only by a signed provider callback. It has an append-only ledger and views in admin Finance.
- Recommended default: (a). Allowing the self-confirm route only in dev mode (the first half of P7) is needed either way. Mobile-wallet rides should also wait for a provider event before they are confirmed (services/demo-api/src/services/rides.ts:625-631).

**D6. Which commission applies: the city's, the category's, or both?**
- Why it matters: Casablanca Standard rides take 15% instead of the documented 18%. Commission edits on the admin Rules page affect no app booking (services/demo-api/src/services/rides.ts:127). Unblocks P8. Also settles what an empty field means in the P12 catalog editor. ADR-0033.
- Options:
  - (a) Always the city rate. Categories change only fares.
  - (b) A category inherits the city rate unless a per-city override is set.
  - (c) A full city × category matrix.
- Recommended default: (b). Make the category commissionBp nullable. Fare overrides per city follow the same pattern. Put category pricing under the same versioning, reason and confirmation flow as the city rules. Show the effective commission on the Rules page and on the ride detail.

**D7. How are cash cancellation fees and ride exceptions settled?**
- Why it matters: cash is the main payment method. The fee stays pending forever, the driver is never paid, and the receipt promises it will be collected "avec votre prochaine course" (apps/passenger/src/app/(app)/receipt/[id].tsx:19). Unblocks P11. ADR-0041 and ADR-0042.
- Options for cash fees:
  - (a) Add the fee to the next fare.
  - (b) Require an electronic payment method whenever a cancellation carries a fee.
  - (c) Waive the fee for cash.
- Recommended default: (a). Post it to the ledger under the key ride:<id>:cancel-fee. Credit the driver when the fee is posted, not when it is collected, so she does not carry the passenger's debt.
- Settle in the same ADR:
  - Passenger no-show: a fee plus a driver credit, instead of sending the ride back to dispatch.
  - A ride aborted after an SOS or an accident. Default: no charge to the passenger; support settles the driver's side by hand for now.
  - The arrival fee versus the "2 free minutes" promised in help (topics.ts:18).

### Platform & architecture

**D8. Which backoffice is the real one, and what is apps/web for?**
- Why it matters: the public landing page links to a second backoffice. It has no login, keeps data in localStorage, uses its own pricing and has none of the Oct 6 features. Unblocks P20. Also decides whether the website gets SEO and performance work. ADR-0038.
- Options:
  - (a) apps/admin is the only backoffice. apps/web becomes marketing only, and /backoffice leaves the public site. Port its good ideas (work queue, ticket priority, service kill-switch) into apps/admin.
  - (b) Rebuild /backoffice on @naya/api.
  - (c) Keep both, and label the web one a design exploration behind a login.
- Recommended default: (a). Then make apps/web the production marketing site. Fix its copy to match the product (children, payment methods, category names, minimum fare). Base the price estimate on @naya/domain, or label it indicative. Use @naya/tokens.

**D9. What do client demos run on, and is anything deployed?**
- Why it matters: standalone TestFlight builds cannot show the passenger → driver → admin loops (SOS, Famille sync). Every native build bundles the demo backend and the seed credentials. Sets how urgent P9 is. ADR-0012 and ADR-0044.
- First, two facts only you know:
  - Is the admin or the demo API reachable by anyone today, for example on Vercel?
  - Is the production EAS profile ever built?
- Options:
  - (a) Standalone builds remain the only demo.
  - (b) Host one shared demo API for cross-role demos, and keep standalone builds for offline demos.
- Recommended default: (b). Keep the embedded mode for offline sales demos, but load it only in demo builds, so production bundles never contain it. On any hosted instance:
  - show the demo-credential panel only when VITE_DEMO is set;
  - turn off production sourcemaps;
  - turn dev mode on explicitly, never by default.

**D10. What is the production path?**
- Why it matters: the production profile points at https://api.naya.example (apps/passenger/eas.json:36), and all data lives in one JSON file. There is no push, payment provider, KYC storage or account deletion. Unblocks the second half of P18. ADR-0045, ADR-0039 and ADR-0046.
- Sub-questions:
  - Which stack? Should the Hono routes and the packages/api contract be kept as they are?
  - Should the "prototype" layer become proper domain modules before the port?
  - Is Android in the launch? It has never been built (README.md:175).
  - Which map tile provider?
- Recommended default:
  - Keep Hono and the packages/api contract. Replace the JSON store with managed Postgres, with row locks for offer acceptance.
  - Promote and rename the prototype modules first, so the port carries one model.
  - Put Android in the launch scope. Most phones in Morocco run Android; confirm with your own market data.
  - Engage Moroccan counsel this month on CNDP (law 09-08), transport licensing, the women-only basis, minors and the wallet. These have the longest lead times (section 8.2).

### Brand & content

**D11. Which logo, and which media policy?**
- Why it matters: six logo concepts are shown inside the customer and driver apps. The website still ships the older lockup. The apps use vector art, the website uses photorealistic generated women, and the admin fixtures use generated portraits as selfies. ADR-0048, and ADR-0025 (confirm intent). The gallery part of P9 depends on it.
- Recommended default:
  - Capture the client's logo choice by a fixed date.
  - Remove the gallery from the passenger and driver apps now. Keep it in the admin or on a web /brand page.
  - Use vector illustration and initials across the apps.
  - Treat generated photos of people as website placeholders until commissioned photography exists.
  - Archive the bundled PNGs that are never shown (about 6.8 MB) and the unused web images (about 13 MB).

**D12. Which languages, and which public claims stand?**
- Why it matters: every string is French and every layout assumes left-to-right. The copy promises things that nothing implements: masked numbers, replies within 24 h and priority handling. The FAQ's wording on children contradicts Naya Famille.
- Options:
  - (a) French only for v1, with Arabic later.
  - (b) French and Arabic (RTL) at launch.
  - (c) (b) plus Darija.
- Recommended default: (a). Write new layouts with start/end instead of left/right, so Arabic costs less later. Remove every promise that nothing implements until it exists. That makes MOBILE-FEEDBACK-AUDIT finding 3 (masked numbers) a bug to fix, not accepted demo debt. Align the FAQ with D3.

### Team & process

**D13. How do you and Arselene work together?**
- Why it matters: both of you push straight to master, and there is no CI. The lockfile was broken on master for about 5.5 hours. Build numbers differ in three places: 2/3 in the docs, 3/4 locally, 4/5 on origin. Unblocks the CI half of P18. ADR-0057 and ADR-0049.
- Recommended default:
  - One branch and one PR per change, with CI required: frozen install, typecheck, unit tests and lint. Protect master once CI is green.
  - Use one source for build numbers. eas.json sets appVersionSource "remote" (apps/passenger/eas.json:4), but the TestFlight uploads were archived in Xcode. If local archives stay the path, app.config.ts is the source and eas.json moves to "local". If you build on EAS, remove buildNumber from the configs.
  - Log every upload (date, app, build, commit) in one place. Start by writing down which builds are on TestFlight now, and from which commit.

**D14. What is the source of truth, and were the five reversals intended?**
- Why it matters: README.md:7 names the git-ignored _handoff as the source of truth, and the feedback PDF is not in the repo. Five original rules were reversed with no record: dark mode, vector art, the Confort tier, the category commission and the second backoffice. An agent cannot tell an intended change from a bug. Unblocks the ADR half of P19. ADR-0056, and confirming ADR-0023, 0025 and 0026.
- Sub-question: may the _handoff text and a summary of the PDF be committed? Check for licence or confidentiality limits on the Figma-derived material.
- Recommended default:
  - Commit the text files to docs/handoff/ with a "partly superseded" banner, plus a faithful text summary of the PDF.
  - Precedence order: ADRs > specs > handoff/Figma > feedback PDF.
  - Accept dark mode and vector art as intended. Settle Confort in D4, the commission in D6 and the backoffice in D8.
  - Write project docs in English. UI copy stays French.

**D15. Repo path and screenshot weight**
- Why it matters: the path contains spaces. That needs a regex-based Xcode plugin (plugins/with-ios-build-paths.js:38-49), which is uncommitted and applied to the passenger app only. Separately, docs/screens holds 170 MB of tracked screenshots, and images make up about 95% of git history. ADR-0050 and ADR-0052.
- Options for the path:
  - (a) Move the repo to a path without spaces, and drop the plugin.
  - (b) Keep the path, and commit the plugin for both apps.
- Options for the screenshots:
  - (a) Git LFS for new captures only.
  - (b) LFS plus a history rewrite, which means a force-push to ProgixDev/naya.
- Recommended default: (a) for both. The current path is a recovery volume, and the plugin can break on Expo upgrades. Rewrite history only if clone size becomes a real problem, and only with Arselene's agreement.

### Smaller calls that can wait

Each has a default, so none of them blocks work.

- **Ratings:** may drivers rate or report passengers? Default: at least a "report passenger" action before launch, since the drivers are women too.
- **Offer timeout:** a per-city setting (10–120 s) or a fixed 30 s? Default: keep it per city, and remove the hard-coded "30 secondes" (apps/driver/src/app/(app)/_layout.tsx:32).
- **"Revenus nets":** default to confirmed money only, with pending amounts shown separately.
- **Payout accounts (RIB):** default to changes through support only, until a payout provider exists.
- **Sign-out during a ride:** default to blocking driver sign-out while a ride is active. This goes with P4.
- **Scheduled rides from 00:00 to 04:59:** the client blocks them and the server does not. Default: store the hours in city.scheduling and enforce them on the server.
- **Passenger city:** default to server user.cityId as the source of truth over device prefs (ADR-0054).
- **Account deletion:** a support-ticket link (apps/passenger/src/app/(app)/preferences.tsx:60) is unlikely to satisfy App Store guideline 5.1.1(v), and the driver app has nothing. Default: an in-app deletion request in both apps that keeps legally required financial records.
- **Sign-in:** default to phone OTP only for v1. Add Apple and Google together later.
- **Verification:** allow identity corrections during more_info_requested, with an audit entry. Give licence and insurance expiry dates, and let admins revoke an approval with a reason.
- **Admin data access:**
  - hide balances and commission KPIs from roles without finance.read;
  - audit every identity-document view, as DocViewer already claims;
  - mask document numbers for support;
  - add city scoping only when a second city opens.
- **Admin scope:**
  - at launch, offer account suspension and a system cancel of live rides;
  - remove "Remboursement accordé" until a refund actually moves money;
  - "Aujourd'hui" means the calendar day in Africa/Casablanca;
  - desktop only (1024 px and up);
  - no dark mode in the admin or web for now.
- **Engineering housekeeping:** remove NativeWind, since no mobile code uses className. Pick WalletSummary or WalletCard. Settle useSingleFlight key rotation in its PR (ADR-0053). Make apps/web pnpm-only. Write down why webpack was chosen over Turbopack, or try Turbopack.
- **Demo fares:** 100 MAD for 10 km looks high for Rabat. Calibrate before the next client demo.

---

## 10. Suggested next steps

### Before anything (about half a day)

1. Move achref-dev-skill-debt/ and achref-dev-skill-debt-images.zip out of the repo, into their own project folder. Together they are 26 MB from an unrelated project, and `git add -A` would commit them. Add `*.zip` to .gitignore.
2. Reconcile with origin/master. It is one commit ahead: 02ff3d3 by Arselene.
   - Run `git restore pnpm-lock.yaml`. Origin already has the same lockfile fix, plus the `unrs-resolver` entry in pnpm-workspace.yaml.
   - Stash apps/passenger/app.config.ts, then run `git pull --ff-only`.
   - Keep origin's lockfile, workspace file and build numbers (passenger 4, driver 5).
3. Re-apply appleTeamId and `../../plugins/with-ios-build-paths` on top of origin's passenger config, and add both to apps/driver/app.config.ts. The driver build hits the same failure on this path. Skip this step only if you move the repo first (D15).
4. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, the unit tests and `expo lint` in both apps. Then commit plugins/with-ios-build-paths.js and both configs together, on a branch, through a PR. The configs without the plugin file break prebuild for everyone else.
5. Tell Arselene about the plan, and agree on branches and PRs (D13).

### Option A: Docs foundation (recommended first)

- **Scope:**
  - A root AGENTS.md (under 150 lines; draft in section 6.5) and a CLAUDE.md that imports it. Fold the useful parts of AGENTS.expo.md into per-app AGENTS.md files, then delete it.
  - docs/README.md: an index, a reading order for a new chat, and a "last verified" date for each doc.
  - The _handoff text in docs/handoff/ with a "partly superseded" banner, plus a text summary of the feedback PDF. This needs D14.
  - The ADR template. Backfill ADR-0001 to ADR-0032 as Accepted; the confirm-intent ones wait for D14. Open ADR-0033 to ADR-0057 as Proposed. Section 9 maps onto these, so each decision becomes one ADR to accept.
  - The first five specs from section 6.7: pricing, cities and categories; eligibility and verification; SOS; Naya Famille; payments and fees. Each states its rules today, with the open points linked to the Proposed ADRs.
  - status/integrations.md (replacing INTEGRATIONS.md), and quality/verification-log.md seeded with the 13 October gate results.
  - runbooks/local-dev.md, and runbooks/e2e.md with the four servers and their ports (4010, 8081, 8082, 5173).
  - This report filed as docs/audits/2026-10-13-full-audit.md, and status/backlog.md with one row per finding.
- **Rough effort:** about 1 day for the first pass (section 6.4). 3–4 focused days with AI help for the rest.
- **What it unlocks:**
  - Closes P19.
  - Every new Claude or Codex session, and Arselene, starts from shared context instead of rediscovering the repo.
  - Section 9 becomes a list of Proposed ADRs you can decide one by one.
  - Options B and C split into small, self-contained tasks that an agent can pick up.

### Option B: Stabilise

- **Scope:**
  - CI on GitHub Actions: frozen install, typecheck, unit tests, lint and `pnpm peers check`. Change the root `pnpm test` so it no longer runs e2e. Protect master once CI is green. This is the first half of P18.
  - Run the full 40-test e2e suite on fresh servers, and add `webServer` entries to e2e/playwright.config.ts. Expect driver-flows.spec.ts:149 and :199 to fail on the duplicate provider-card, and S14 to fail until P10 is fixed.
  - The decision-free priorities: P1 (codes out of the driver payload), P2, P3, P4, P9, P10, P12, P13, P14 and P15.
  - Copy that needs no decision: remove the masked-call promises, stop calling the Famille pickup check "vérifié", and relabel the emergency numbers once D2 confirms them.
  - Check on a release build that Hermes formats 'fr-MA' dates as expected (packages/domain/src/time.ts:22) and that crypto.randomUUID exists (packages/api/src/client.ts:269-273). Check that the in-trip map framing works (docs/DESIGN.md:54).
  - A stopgap for P20: remove the /backoffice link from the public header, and make the web seed dates relative to today.
- **Rough effort:** about 1.5–2 weeks for one person with AI help.
- **What it unlocks:**
  - Demos on TestFlight and the admin that you can trust, with no known critical bug in front of the client.
  - A safety net against regressions.
  - A clean base for C.

### Option C: Product roadmap toward launch

- **Scope:**
  - A half-day decision session on section 9. Mark each answer Accepted in its ADR.
  - Engage Moroccan counsel now (D10). This runs in parallel with everything else.
  - Promote the prototype layer into domain modules with state machines, finance rules and tests. That covers categories with vehicle eligibility and SOS, and the wallet and Famille only if D5 and D3 keep them. Rename the /prototype API namespace (ADR-0039).
  - Build the items that depend on decisions: P5, P6, the second half of P7, P8, P11, P16 if Famille is in, P17 and P20.
  - Make apps/admin the only backoffice, and port the useful ideas from the web one (D8).
  - The production plan from section 8: the backend port, a card PSP, KYC storage, remote push, SMS OTP, Android, testing on real devices, and staffing the safety desk.
- **Rough effort:** about 4–8 weeks for the promote-and-unify work. The production backend and live integrations come after that (XL), plus outside lead times for contracts and filings.
- **What it unlocks:** a credible path from demo to a Rabat launch.

### Recommended sequence

1. **Day 1:** housekeeping. Send the first message to counsel the same week, because legal work has the longest lead time.
2. **Week 1:** Option A. In parallel, fix the decision-free items that are small, contained and do not touch the docs:
   - P1 (codes out of the driver payload). Do this first: it is the only one about child safety.
   - P3, P10, P13, P4 and P2.
   - P15, as a stopgap: force the light theme.
   - CI.
3. **End of week 1:** the decision session, using the Proposed ADRs from A. Take D1, D2, D3, D5 and D6 first, then D7, D4, D8 and D13. The rest can follow in short batches.
4. **Weeks 2–3:** finish B: the e2e run, P9, P12 and P14. They wait until after the session because P12 uses the D6 answer and P14's wallet wording uses D5. Start the items that the decisions unblocked.
5. **Then:** Option C, in the order set by the decisions and the launch-blocker ranking in section 8.0.
