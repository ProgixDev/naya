# Open questions

Decisions waiting on Achraf. Owner: Achraf. Last updated: 2026-10-15.

- **D1–D15** come from section 9 of the [13 October audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf),
  which merged about 110 questions into 15 decisions. Each one except D12 maps to Proposed ADRs in [docs/adr/](../adr/).
  The audit has the full reasoning; this page keeps the question, the options and the recommended default.
- **R1–R18** are the owner decisions of the [redesign audit of 15 October](../audits/2026-10-15-redesign-audit.md#7-owner-decisions).
  All eighteen were decided on 15 Oct 2026 (the recommended option each time); see
  [Redesign decisions](#redesign-decisions-r1r18-15-october) at the end of this page.
- **F1–F4** are the open questions of the founder's brief, [docs/tasks/2026-10-13.md](../tasks/2026-10-13.md#open-questions-for-the-founder-answered-above).
  The founder answered them the same day ([Founder’s answers](../tasks/2026-10-13.md#founders-answers-13-october-2026)); no ADR or spec records the answers yet.

**How to close one.** Write the answer into its ADR and mark it Accepted (for F-items, write a new ADR or spec when the
answer sets a rule). Set the status here to `decided (ADR-NNNN, date)`. Then update the backlog rows marked
`needs decision` that it unblocks, in [backlog.md](backlog.md). Do not delete answered rows.

Order suggested by the audit (sections 9 and 10): D1, D2, D3, D5 and D6 first (money, the law and physical safety), then
D7, D4, D8 and D13. In the founder's brief, F1–F4 are answered; the document list of task 2, the Famille extensions of task 4 and the
scope of task 5 now wait on an ADR or spec for each answer, and on D1, D3 and D10 where they touch policy.

## Summary

| ID | Question | ADR | Unblocks | Status |
|---|---|---|---|---|
| [D1](#d1-women-only-eligibility) | How is a user shown to be eligible for a women-only service? | [0034](../adr/0034-women-only-eligibility-and-verification-policy.md) | P6; shapes P1, P16 | open |
| [D2](#d2-sos-at-launch) | What does SOS do at launch, and who answers it? | [0035](../adr/0035-sos-production-model.md) | P5 (P2, which needed no decision, is done on branch `chore/docs-foundation-and-fixes`) | open |
| [D3](#d3-naya-famille-at-launch) | Is Naya Famille in the launch, and how does it work? | [0036](../adr/0036-naya-famille-operating-model.md), [0034](../adr/0034-women-only-eligibility-and-verification-policy.md) | second half of P1, P16 | open |
| [D4](#d4-service-categories-and-who-drives-them) | Which service categories launch, and who may drive them? | [0043](../adr/0043-category-vehicle-eligibility-and-scooter-scope.md), [0026](../adr/0026-service-categories-including-a-premium-naya-confort.md) | P17 | open |
| [D5](#d5-passenger-wallet) | Does a stored-value passenger wallet ship at launch? | [0040](../adr/0040-passenger-wallet-model.md) | second half of P7; wallet wording in P14 | open |
| [D6](#d6-commission-precedence) | City commission, category commission, or both? | [0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md) | P8; empty-field meaning in P12 | open |
| [D7](#d7-cash-fees-and-ride-exceptions) | How are cash cancellation fees and ride exceptions settled? | [0041](../adr/0041-cash-and-fee-settlement.md), [0042](../adr/0042-ride-exception-paths.md) | P11 | open |
| [D8](#d8-which-backoffice) | Which backoffice is the real one, and what is apps/web for? | [0038](../adr/0038-canonical-backoffice.md) | P20 | open |
| [D9](#d9-demo-runtime-and-hosting) | What do client demos run on, and is anything deployed? | [0012](../adr/0012-native-demo-builds-run-the-demo-api.md), [0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md) | urgency of P9 | open |
| [D10](#d10-production-path) | What is the production path? | [0045](../adr/0045-production-backend-and-live-integrations.md), [0039](../adr/0039-future-of-the-prototype-module.md), [0046](../adr/0046-production-map-tile-provider.md) | second half of P18 | open |
| [D11](#d11-logo-and-media-policy) | Which logo, and which media policy? | [0048](../adr/0048-cross-surface-media-and-brand.md), [0025](../adr/0025-mobile-illustrations-are-vector-svg-and-avatars.md) | logo-gallery part of P9 | open |
| [D12](#d12-languages-and-public-claims) | Which languages, and which public claims stand? | none proposed; see [0020](../adr/0020-french-only-product-mad-africa-casablanca-business.md), [0031](../adr/0031-number-masking-is-the-only-planned-passenger.md) | copy fixes (DOC-07) | open |
| [D13](#d13-branches-ci-and-build-numbers) | How do Achraf and Arselene work together? | [0057](../adr/0057-branch-review-and-ci-policy.md), [0049](../adr/0049-build-number-source-of-truth.md) | CI half of P18 | open |
| [D14](#d14-source-of-truth-and-the-five-reversals) | What is the source of truth, and were the five reversals intended? | [0056](../adr/0056-source-of-truth-order-committing-the-handoff.md); confirm [0023](../adr/0023-mobile-styling-and-runtime-dark-mode.md), [0025](../adr/0025-mobile-illustrations-are-vector-svg-and-avatars.md), [0026](../adr/0026-service-categories-including-a-premium-naya-confort.md) | ADR half of P19 | open |
| [D15](#d15-repo-path-and-screenshot-weight) | Move the repo off a path with spaces? Where do screenshots live? | [0050](../adr/0050-repo-path-with-spaces.md), [0052](../adr/0052-screenshot-storage.md) | QA-07, QA-10 | open |
| [F1](#f1-car-wash-audience) | Car wash: who is it for? | none yet | brief task 5 | answered 2026-10-13 (brief), not yet in an ADR or spec |
| [F2](#f2-parent-at-pick-up) | Famille: must the parent be present at every pick-up? | none yet; related [0036](../adr/0036-naya-famille-operating-model.md) | brief task 4 | answered 2026-10-13 (brief), not yet in an ADR or spec |
| [F3](#f3-criminal-record-extract-scope) | Driver documents: criminal-record extract for all drivers or only Famille? | none yet; related [0034](../adr/0034-women-only-eligibility-and-verification-policy.md) | brief tasks 2 and 4 | answered 2026-10-13 (brief), not yet in an ADR or spec |
| [F4](#f4-video-call) | Video call: in-app, or a hand-off to WhatsApp or the phone? | none yet; related [0031](../adr/0031-number-masking-is-the-only-planned-passenger.md) | brief task 4 | answered 2026-10-13 (brief), not yet in an ADR or spec |

P-items are the top priorities in [backlog.md](backlog.md#top-priorities-p1p20).

## Product scope and safety

### D1. Women-only eligibility

How is a user shown to be eligible for a women-only service? The code does not define or check the rule anywhere, and
the reviewer checklist has no item for it.

- Options: (a) the reviewer checks the identity document and ticks a mandatory "eligibility confirmed" item on every
  decision, with an appeal path after a rejection; (b) self-declaration at sign-up plus the same reviewer check;
  (c) a KYC vendor reads the document field automatically.
- Recommended default: (a). Keep the rule that nothing is inferred from appearance. Get a written legal opinion for
  Morocco before launch.
- Also decide: may an adult man be an authorised Naya Famille recipient? The seed adds a « Père ». Default: yes, as a
  handover recipient only, never as a rider.
- Rules today: [specs/eligibility-and-verification.md](../specs/eligibility-and-verification.md).

### D2. SOS at launch

What does SOS do at launch, and who answers it? Today every action is simulated and nothing comes back to the person
who raised the alert ([integrations](integrations.md#safety-and-contact)).

- Options: (a) phone only: one tap calls the police, and live GPS is shared with a trusted contact; (b) (a) plus a
  Naya safety desk that receives alerts during staffed hours; (c) a 24/7 desk or a security partner.
- Recommended default: (b), with copy that states the desk's hours honestly; move to (c) when volume justifies it.
  Support agents answer through the `safety.respond` permission (P2; on branch `chore/docs-foundation-and-fixes`). Show SOS from `driver_assigned` onwards. Make the
  sheet closable from the UI.
- Emergency numbers: the copy says « 15 (SAMU) ». Verifiers note that in Morocco 15 is the Protection civile, SAMU is
  141, the Gendarmerie is 177 and 112 works from mobiles. Default until local ops confirm: 19 (police), 177
  (Gendarmerie, outside the city), and 15 relabelled « Protection civile ».
- Rules today: [specs/safety-sos.md](../specs/safety-sos.md).

### D3. Naya Famille at launch

Is Naya Famille part of the launch, and if so, how does it work? It carries unaccompanied children and their data, and
it sits outside payment and dispatch today. No policy for it has been decided.

- Sub-questions: minors policy (the FAQ mentions children only as « accompagnés de leur mère »; Famille accepts children
  aged 1–17 alone; are boys included, up to what age?); family trips as rides with a family flag or a separate product;
  how the subscription is charged, how the dedicated driver is paid and what happens when she is absent; which admin
  role may see child data and arrival photos.
- Options: (a) leave it out of the launch and keep it as a demo behind the demo flag; (b) launch it as rides with a
  family flag, through dispatch, payments and the ledger; (c) launch it as a separate product with its own scheduling
  and billing.
- Recommended default: (a). The handover codes are out of the driver's payload whatever the answer (first half of P1, done
  on branch `chore/docs-foundation-and-fixes`, with a lock after 5 wrong codes). If (b) later: one-time codes per trip stored hashed with an attempt limit, a parent-approved child photo, parent
  confirmation at pickup and handover, a `family.ops` permission for child data, legal sign-off on minors.
- The founder's brief extends Famille (live GPS, pick-up photo, parent-approved start, drop-off photo, calls, stricter
  vetting). F2, F3 and F4 below depend on this answer.
- Rules today: [specs/family.md](../specs/family.md).

### D4. Service categories and who drives them

Which service categories launch, and who may drive them? Every driver receives every category today, including Scooter
at Scooter prices, and vehicles have no type.

- Sub-questions: is Naya Scooter a real offering (licence, insurance, helmet and passenger-safety rules) or a
  placeholder from the feedback? Was Naya Confort intended? It reverses the handoff rule that colour variants never
  imply a premium tier.
- Options: (a) Standard and Confort at launch, Scooter dropped or hidden; (b) all three, with a two-wheeler vehicle
  type and its own verification; (c) Standard only.
- Recommended default: (a). Add a vehicle type to the vehicle record, derive eligibility from the approved vehicle,
  start with no categories until approval, with an admin override.
- Rules today: [specs/pricing-cities-categories.md](../specs/pricing-cities-categories.md).

## Money

### D5. Passenger wallet

Does a stored-value passenger wallet ship at launch? A passenger can confirm her own top-up today, and that money
becomes withdrawable driver credit. Holding customer funds in Morocco probably needs a partner licensed by Bank
Al-Maghrib; confirm with counsel.

- Options: (a) no wallet at launch, hidden outside demo builds; (b) a wallet run with a licensed partner: top-ups
  confirmed only by a signed provider callback, an append-only ledger, views in admin Finance.
- Recommended default: (a). Either way, allow the self-confirm route only in dev mode (first half of P7). Mobile-wallet
  rides should also wait for a provider event before they are confirmed.
- Rules today: [specs/payments-and-fees.md](../specs/payments-and-fees.md).

### D6. Commission precedence

Which commission applies: the city's, the category's, or both? Casablanca Standard rides take 15 % instead of the
documented 18 %, and commission edits on the admin Rules page affect no app booking.

- Options: (a) always the city rate, categories change only fares; (b) a category inherits the city rate unless a
  per-city override is set; (c) a full city × category matrix.
- Recommended default: (b). Make the category `commissionBp` nullable; per-city fare overrides follow the same pattern.
  Put category pricing under the same versioning, reason and confirmation flow as city rules. Show the effective
  commission on the Rules page and the ride detail.
- Rules today: [specs/pricing-cities-categories.md](../specs/pricing-cities-categories.md).

### D7. Cash fees and ride exceptions

How are cash cancellation fees and ride exceptions settled? The fee stays pending forever, the driver is never paid,
and the receipt promises collection « avec votre prochaine course ».

- Options for cash fees: (a) add the fee to the next fare; (b) require an electronic payment method whenever a
  cancellation carries a fee; (c) waive the fee for cash.
- Recommended default: (a). Post it to the ledger under `ride:<id>:cancel-fee`, and credit the driver when the fee is
  posted, not when it is collected.
- Settle in the same ADRs: passenger no-show (a fee plus a driver credit instead of re-dispatch); a ride aborted after
  an SOS or an accident (default: no charge to the passenger, support settles the driver's side by hand); the arrival
  fee versus the « 2 free minutes » promised in help.
- Rules today: [specs/payments-and-fees.md](../specs/payments-and-fees.md).

## Platform and architecture

### D8. Which backoffice

Which backoffice is the real one, and what is apps/web for? The public landing page links to a second backoffice with
no login, data in `localStorage`, its own pricing and none of the Oct 6 features.

- Options: (a) apps/admin is the only backoffice; apps/web becomes marketing only and /backoffice leaves the public
  site; port its good ideas (work queue, ticket priority, service kill-switch) into apps/admin; (b) rebuild /backoffice
  on `@naya/api`; (c) keep both and label the web one a design exploration behind a login.
- Recommended default: (a). Then make apps/web the production marketing site: copy that matches the product, an
  estimate based on `@naya/domain` or labelled indicative, and `@naya/tokens`.

### D9. Demo runtime and hosting

What do client demos run on, and is anything deployed? Standalone TestFlight builds cannot show the passenger → driver
→ admin loops, and every native build bundles the demo backend and the seed credentials.

- First, two facts only Achraf knows: is the admin or the demo API reachable by anyone today (for example on Vercel)?
  Is the production EAS profile ever built?
- Options: (a) standalone builds remain the only demo; (b) host one shared demo API for cross-role demos and keep
  standalone builds for offline demos.
- Recommended default: (b). Load the embedded mode only in demo builds. On any hosted instance: show the
  demo-credential panel only when `VITE_DEMO` is set, turn off production sourcemaps, and turn dev mode on explicitly,
  never by default.

### D10. Production path

What is the production path? The production profile points at a placeholder API and all data lives in one JSON file.
There is no push, payment provider, KYC storage or account deletion.

- Sub-questions: which stack, and do the Hono routes and the `packages/api` contract stay? Should the "prototype" layer
  become domain modules before the port? Is Android in the launch (it has never been built)? Which map tile provider?
- Recommended default: keep Hono and the `packages/api` contract and replace the JSON store with managed Postgres, with
  row locks for offer acceptance. Promote and rename the prototype modules first. Put Android in the launch scope
  (confirm with market data). Engage Moroccan counsel this month on the CNDP (law 09-08), transport licensing, the
  women-only basis, minors and the wallet.

## Brand and content

### D11. Logo and media policy

Which logo, and which media policy? Six logo concepts are shown inside the customer and driver apps; the website ships
an older lockup; the apps use vector art, the website generated photorealistic women, the admin fixtures generated
portraits as selfies.

- Recommended default: capture the client's logo choice by a fixed date. Remove the gallery from the passenger and
  driver apps now (keep it in the admin or a web /brand page). Use vector illustration and initials across the apps.
  Treat generated photos of people as website placeholders until commissioned photography exists. Archive the bundled
  PNGs that are never shown and the unused web images.
- Related: the founder's brief asks for new onboarding images and car illustrations
  ([tasks 1 and 6](../tasks/2026-10-13.md)); they should follow the policy chosen here.

### D12. Languages and public claims

Which languages, and which public claims stand? Every string is French and every layout assumes left-to-right. The copy
promises things nothing implements: masked numbers, replies within 24 h, priority handling.

- Options: (a) French only for v1, Arabic later; (b) French and Arabic (RTL) at launch; (c) (b) plus Darija.
- Recommended default: (a). Write new layouts with start/end instead of left/right. Remove every promise that nothing
  implements until it exists, which makes the masked-number copy a bug to fix (DOC-07). Align the website FAQ on children
  with D3.

## Team and process

### D13. Branches, CI and build numbers

How do Achraf and Arselene work together? Both pushed straight to master, the lockfile was broken on master for about
5.5 hours, and build numbers disagreed between the docs, the local configs and origin.

- Recommended default: one branch and one PR per change, with CI required (frozen install, typecheck, unit tests,
  lint); protect master once CI is green. One source for build numbers: if local Xcode archives stay the path,
  `app.config.ts` is the source and `eas.json` moves to `appVersionSource: "local"`; if builds move to EAS, remove
  `buildNumber` from the configs. Log every upload in the build log of
  [testflight-eas.md](../runbooks/testflight-eas.md#build-log).
- A CI workflow, a PR template and CODEOWNERS exist on branch `chore/docs-foundation-and-fixes` (`.github/`); the
  workflow has not run on GitHub yet. The policy (branch protection, required reviews, Arselene's handle in CODEOWNERS)
  is still open.

### D14. Source of truth and the five reversals

What is the source of truth, and were the five reversals intended? README names the git-ignored `_handoff/` as the
source of truth, and the feedback PDF is not in the repo. Five original rules were reversed with no record: dark mode,
vector art, the Confort tier, the category commission and the second backoffice.

- Sub-question: may the `_handoff/` text and a summary of the feedback PDF be committed (licence or confidentiality
  limits on the Figma-derived material)?
- Recommended default: commit the text files to `docs/handoff/` with a "partly superseded" banner, plus a faithful text
  summary of the PDF. Precedence: ADRs > specs > handoff/Figma > feedback PDF. Accept dark mode and vector art as
  intended (ADR-0023, ADR-0025); settle Confort in D4, the commission in D6 and the backoffice in D8. Project docs in
  English; UI copy stays French.

### D15. Repo path and screenshot weight

The repo path contains spaces, which needs a regex-based Xcode plugin (`plugins/with-ios-build-paths.js`, committed in
c38429d for both apps). Separately, `docs/screens` holds about 170 MB of tracked screenshots, and images make up about
95 % of git history.

- Options for the path: (a) move the repo to a path without spaces and drop the plugin; (b) keep the path and the
  plugin.
- Options for the screenshots: (a) Git LFS for new captures only; (b) LFS plus a history rewrite, which means a
  force-push to ProgixDev/naya.
- Recommended default: (a) for both. Rewrite history only if clone size becomes a real problem, and only with
  Arselene's agreement.

## Smaller calls with defaults

The audit lists fourteen smaller calls that each have a default and block nothing (ratings by drivers, offer
timeout copy, "Revenus nets", payout accounts, sign-out during a ride, night-time scheduled rides, the passenger's
city, account deletion, sign-in providers, verification corrections, admin data access and scope, housekeeping, demo
fares). See [audit section 9, "Smaller calls that can wait"](../audits/2026-10-13-full-audit.md#smaller-calls-that-can-wait).
Promote one to this page only when someone disagrees with its default.

## From the founder's brief (13 October)

Source: [docs/tasks/2026-10-13.md](../tasks/2026-10-13.md#open-questions-for-the-founder-answered-above). The founder
answered all four the same day ([Founder’s answers](../tasks/2026-10-13.md#founders-answers-13-october-2026)). Each
entry quotes the answer and lists what the repo already constrains and what is still to decide.

### F1. Car wash audience

Who is the mobile car wash for: passengers ordering a wash for their own car, drivers ordering one for their Naya car,
or washers as a new provider role with their own app or space? Is it women-only like the rest of Naya?

- Blocks: brief task 5. Nothing in the code exists for it.
- Repo constraints: the mobile apps know two roles only (`MobileRole = 'passenger' | 'driver'`,
  `packages/domain/src/entities.ts:15`). A washer role means a new app or a new role with its own verification and
  payouts. Selling washes to passengers touches the category decision (D4) and the payment decisions (D5, D7).
- Answer (founder, 13 Oct): both. Passengers order a wash for their own car, and drivers for theirs. Not answered:
  who the washers are (a provider role with its own app or space), and whether washers must be women.
- Status: answered 2026-10-13 (brief); not yet in an ADR or spec.

### F2. Parent at pick-up

Must the parent be physically present at every Famille pick-up (for example from home in the morning), or only approve
remotely when the child is collected elsewhere (for example from school)?

- Blocks: brief task 4 ("Parent-approved start").
- Repo constraints: depends on D3 (default: Famille stays a demo at launch). Today the trip steps are linear
  (`FAMILY_NEXT` in `packages/domain/src/prototype.ts`) with no approval step, and the parent learns of each step only
  by polling: there is no remote push ([ADR-0013](../adr/0013-real-time-by-polling-with-local-notifications.md)). A
  remote approval needs push, or the parent's app open at the time. Rules today: [specs/family.md](../specs/family.md).
- Answer (founder, 13 Oct): both. The parent can be present at pick-up, or approve the start remotely from the
  notification. Still open: what happens when she does not answer, and remote push (ADR-0045).
- Status: answered 2026-10-13 (brief); not yet in an ADR or spec.

### F3. Criminal-record extract scope

Confirm the driver document list in task 2 of the brief, in particular whether the criminal-record extract (fiche
anthropométrique / extrait de casier judiciaire) is required for all drivers or only for Famille drivers.

- Blocks: brief task 2 (driver sign-up) and the Famille vetting in task 4.
- Repo constraints: the driver person case requires a selfie, the ID front and back and the driving licence; the
  vehicle case requires the registration, the insurance and vehicle photos (`REQUIRED_ITEMS` in
  `packages/domain/src/machines/verification.ts:16-20`). There is no item for a criminal-record extract or a technical
  inspection, and no expiry date on any document. Part of the eligibility policy (D1, ADR-0034); needs the legal review
  in D10 because it is criminal-record data. Rules today:
  [specs/eligibility-and-verification.md](../specs/eligibility-and-verification.md).
- Answer (founder, 13 Oct): Naya Famille drivers only. The rest of the task 2 list is not confirmed item by item.
- Status: answered 2026-10-13 (brief); not yet in an ADR or spec. Still needs the legal review in D10.

### F4. Video call

In-app voice and video calls between the parent and the driver: built in (WebRTC), or a hand-off to WhatsApp or the
phone's own call app?

- Blocks: brief task 4 ("Parent ↔ driver contact").
- Repo constraints: [ADR-0031](../adr/0031-number-masking-is-the-only-planned-passenger.md) makes number masking the only
  planned contact channel, with no in-app chat; an in-app call would supersede it with a new ADR. A hand-off to
  WhatsApp or the phone's dialler exposes phone numbers, which the masking rule is meant to avoid. No telephony or
  calling dependency exists in the repo ([integrations](integrations.md#safety-and-contact)).
- Answer (founder, 13 Oct): a WhatsApp call with a confirmation from the parent, a police call one tap away, and the
  other parent may be invited to follow the trip. A WhatsApp hand-off exposes phone numbers, so it needs an ADR that
  supersedes ADR-0031 for Famille.
- Status: answered 2026-10-13 (brief); not yet in an ADR or spec.

## Redesign decisions R1–R18 (15 October)

Source: section 7 of the [redesign audit](../audits/2026-10-15-redesign-audit.md#7-owner-decisions). On 15 Oct 2026
Achraf accepted the recommended option (a) for every decision. R1, R3 and R5 are recorded in
[ADR-0059](../adr/0059-status-is-an-icon-problems-keep-words.md). The work is tracked in the RD rows of the
[backlog](backlog.md#15-october-redesign-rd); commits are on branch `feat/passenger-polish`.

| # | Decision | Chosen (15 Oct 2026) | Outcome | Status |
|---|---|---|---|---|
| R1 | Do states go icon-only in lists? | (a) Glyph alone in rows and lists; the word on detail heroes, at first sight and for problems; always in the accessibilityLabel | `StatusIcon` `showLabel: 'auto'` (61e2413); every screen batch | decided (ADR-0059, 2026-10-15), done |
| R2 | Main button height | (a) 50-pt `control.major` for booking and driver decisions, 44 elsewhere | `Button` and `control` tokens (61e2413), applied per screen | decided 2026-10-15, done |
| R3 | Status tones | (a) Cancelled neutral, pending info, washing accent (§2.3) | `status.ts` tones; card payment waiting for the bank is info (61e2413) | decided (ADR-0059, 2026-10-15), done |
| R4 | « Identité · 6 pistes » in customer accounts | (a) Remove the row; `/brand` stays reachable from the dev launcher | Row removed in both apps (5500275, e07ef01); `dev-brand` in the launcher (e07ef01) | decided 2026-10-15, done |
| R5 | One Famille trip tone mapping | (a) The C11 table | `status.ts` (61e2413), Famille screens (87282c3) | decided (ADR-0059, 2026-10-15), done |
| R6 | Remove the itinerary step | (a) Search goes straight to the quote; the route is edited on the quote | 820a87e; [SCREENS.md](../SCREENS.md) `(app)/route` | decided 2026-10-15, done |
| R7 | Home services: Famille and Lavage | (a) One services rail below the main card on passenger home; the car-wash cross-sell leaves driver home for Compte | Passenger home (820a87e); driver Compte (e07ef01), driver home (d50e2c7) | decided 2026-10-15, done |
| R8 | Contact sheets while calling and messaging are not live | (a) Hide the call and message actions and the « Bientôt disponible » rows; the 19 call moves to the safety sheet | Passenger (953b79a), Famille (87282c3), driver (d50e2c7). The passenger city sheet still says « Bientôt disponible » for a city that is not open: a true statement about the city, not a feature row, kept | decided 2026-10-15, done |
| R9 | Does the admin adopt `statusPresentation` now? | (a) Later (batch B12) | Not started (RD-13) | decided 2026-10-15, deferred |
| R10 | SOS gesture | (a) Hold 1.5 s on a full-width 56-pt button with haptic and progress fill; pinned safety disc in both apps; copy true per mode (ADR-0058) | 953b79a, 87282c3, d50e2c7; [safety-sos.md](../specs/safety-sos.md) R2, R6 | decided 2026-10-15, done |
| R11 | Wording for a failed wallet debit | (a) « Montant libéré · rien n'a été débité » | 61e2413, 953b79a | decided 2026-10-15, done |
| R12 | Driver blocked | (a) Show the unblocking action instead of a disabled « Passer en ligne » | d50e2c7; the button stays disabled with its reason when she cannot act (review, test city) | decided 2026-10-15, done |
| R13 | Car-wash photos layout | (a) One row per angle with Avant / Après thumbnails | 4754a60 | decided 2026-10-15, done |
| R14 | Commit the captures and the capture scripts | (a) Scripts under `scripts/capture-web/`, not the PNGs (ADR-0052) | `scripts/capture-web/` (docs commit of 15 Oct) | decided 2026-10-15, done |
| R15 | Backlog prefix | (a) `RD-` | [backlog](backlog.md#15-october-redesign-rd) | decided 2026-10-15, done |
| R16 | OTP: auto-submit at the 6th digit | (a) Yes, no « Vérifier » button; « Réessayer » after a network or server error | 0c7bdd3; `packages/ui/src/__tests__/auth.test.tsx` | decided 2026-10-15, done |
| R17 | Slide-to-confirm for « Commencer » / « Terminer » | (a) Not now | Nothing built (d50e2c7 keeps buttons) | decided 2026-10-15, done (no change) |
| R18 | Earnings chart | (a) One 7- or 30-day bar chart, simple Views, no chart library | 8aa9451 | decided 2026-10-15, done |
