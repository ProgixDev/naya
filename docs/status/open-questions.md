# Open questions

Decisions waiting on Achraf. Owner: Achraf. Last updated: 2026-10-16.

- **D1–D15** come from section 9 of the [13 October audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf),
  which merged about 110 questions into 15 decisions. Each one except D12 maps to Proposed ADRs in [docs/adr/](../adr/).
  The audit has the full reasoning; this page keeps the question, the options and the recommended default.
- **R1–R18** are the owner decisions of the [redesign audit of 15 October](../audits/2026-10-15-redesign-audit.md#7-owner-decisions).
  All eighteen were decided on 15 Oct 2026 (the recommended option each time); see
  [Redesign decisions](#redesign-decisions-r1r18-15-october) at the end of this page.
- **O1–O6** are smaller calls raised while building on 15 Oct 2026 (dark mode, account deletion, images); see
  [Smaller open calls](#smaller-open-calls-o1o6-15-october) at the end of this page.
- **F1–F4** are the open questions of the founder's brief, [docs/tasks/2026-10-13.md](../tasks/2026-10-13.md#open-questions-for-the-founder-answered-above).
  The founder answered them the same day ([Founder’s answers](../tasks/2026-10-13.md#founders-answers-13-october-2026)); no ADR records the answers yet
  (F1 is described in [specs/car-wash.md](../specs/car-wash.md)).
- **O7–O56** are calls raised in the two chats of 13–16 Oct 2026 and in the agent reports of those days that were never
  put on this page. They are grouped by theme in [Open calls O7–O56](#open-calls-o7o56-1316-october). Questions that
  were answered later in the chats are listed in [Answered in chat](#answered-in-chat-1316-october).

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
| [D11](#d11-logo-and-media-policy) | Which logo, and which media policy? | [0048](../adr/0048-cross-surface-media-and-brand.md), [0025](../adr/0025-mobile-illustrations-are-vector-svg-and-avatars.md) | logo-gallery part of P9 | open; partly answered 2026-10-15 (cars only) |
| [D12](#d12-languages-and-public-claims) | Which languages, and which public claims stand? | none proposed; see [0020](../adr/0020-french-only-product-mad-africa-casablanca-business.md), [0031](../adr/0031-number-masking-is-the-only-planned-passenger.md) | copy fixes (DOC-07) | open |
| [D13](#d13-branches-ci-and-build-numbers) | How do Achraf and Arselene work together? | [0057](../adr/0057-branch-review-and-ci-policy.md), [0049](../adr/0049-build-number-source-of-truth.md) | CI half of P18 | open |
| [D14](#d14-source-of-truth-and-the-five-reversals) | What is the source of truth, and were the five reversals intended? | [0056](../adr/0056-source-of-truth-order-committing-the-handoff.md); confirm [0023](../adr/0023-mobile-styling-and-runtime-dark-mode.md), [0025](../adr/0025-mobile-illustrations-are-vector-svg-and-avatars.md), [0026](../adr/0026-service-categories-including-a-premium-naya-confort.md) | ADR half of P19 | open; car art partly answered 2026-10-15 |
| [D15](#d15-repo-path-and-screenshot-weight) | Move the repo off a path with spaces? Where do screenshots live? | [0050](../adr/0050-repo-path-with-spaces.md), [0052](../adr/0052-screenshot-storage.md) | QA-07, QA-10 | open |
| [F1](#f1-car-wash-audience) | Car wash: who is it for? | none yet | brief task 5 | answered 2026-10-13 (brief); described in specs/car-wash.md, no ADR; who the washers are still open |
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
- Partly answered (15 Oct 2026, chat): the owner generated and installed photos and car renders. The apps now show the
  cars as unbranded plum and pearl PNG renders (quote options, `VehicleImage`, map marker) and every onboarding slide is a
  photo (0e62877, 39fb2d4; « Decision update » sections in ADR-0025 and ADR-0048, both still Proposed). The default
  above ("vector illustration across the apps") no longer holds for cars and onboarding. Still open: the logo, avatars
  and driver photos (PRD-33), people in product screens, the website and the admin fixtures, and renders of cars common
  in Morocco (brief task 6).

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
- Since 15 Oct 2026: the owner asked for the dark-mode work (ADR-0023 updated, still Proposed) and chose raster car
  renders over vector art for cars (see D11). Neither ADR has been marked Accepted.

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
  who the washers are (Naya staff or partner companies, and whether a washer app exists), and whether washers must be
  women (spec R11).
- Status: answered 2026-10-13 (brief); built on `feat/car-wash` (now on master) and described in
  [specs/car-wash.md](../specs/car-wash.md); no ADR (ADR-0039 and ADR-0043 ask for one; backlog CW-16). The other
  car-wash calls are O45–O48.

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
- Also decide in that ADR (14 Oct verification, FS-08): the chauffeuse's personal number, or a Naya business or relay
  number. In mock builds the WhatsApp action is not opened, because the seeded numbers could belong to real people (O32).
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

## Smaller open calls O1–O6 (15 October)

Raised in the dark-mode, account and image work of 15 Oct 2026 on branch `feat/passenger-polish`. Each has a default
already in the code, so nothing is blocked; the default stays until Achraf answers.

| # | Question | Default in the code today | Where | Status |
|---|---|---|---|---|
| O1 | A passenger with money in her Naya wallet cannot delete her account, and nothing can refund a passenger wallet. Add an admin refund, or allow deletion and let support settle the balance? | Deletion refused with a message to contact support | [ADR-0055](../adr/0055-account-lifecycle.md), backlog PRD-35; tied to [D5](#d5-passenger-wallet) | open |
| O2 | Toasts in dark mode: dark pill with a hairline edge (red / green tint for errors and successes), or the bright inverse pill? Same call for the map pin labels and the selected wallet top-up pill | Dark pill | backlog DM-15 | open (sign-off) |
| O3 | Lift the dark card colours (surface about `#2A2330`, elevated about `#352C3B`) so cards stand out more? Changes every screen | Not lifted; shadows and hairline edges instead | backlog DM-07 | open |
| O4 | Light mode: `muted` text on the `selected` fill is 4.21:1 (unselected segment labels, selected option subtitles). Darken light `muted` slightly to reach 4.5:1? | Unchanged (the wallet line was moved to ink) | backlog DM-21 | open |
| O5 | Regenerate two images? (a) a pearl top view so pearl drivers' cars are not plum on the map; (b) Famille pick-up with the rear door open and warm pearl paint | Current images kept | [media results](../design/media-prompts/2026-10-15-results.md) | open (optional) |
| O6 | Terms of use and privacy policy texts: the sign-in consent line is ready for links but no page exists | Plain text, no link | backlog PAX-18; legal (CNDP law 09-08) | open (needs the texts) |

## Open calls O7–O56 (13–16 October)

Collected on 16 Oct 2026 from the two chats of 13–16 Oct (session 3853af2e and the « Project submission template
(fork) » chat that built car wash, driver sign-up and Famille safety), from the agent reports of the 15 workflow runs
of those days, and from section 5 of the [14 October verification](../audits/2026-10-14-verification.md#5-decisions-needed-from-achraf)
(its « decision N » numbers are cited below). Questions already on this page (D1–D15, F1–F4, O1–O6) were not repeated;
where a call extends one of them, the row says so. "Default" is what the code does today, or the recommendation when
the code does nothing yet. Backlog IDs are in [backlog.md](backlog.md#16-october-items-found-in-the-1316-oct-agent-reports).
Status `open` means nobody has answered.

### Branch, release and team

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O7 | Land `feat/passenger-polish` (about 33 local commits up to 5dc002e, not pushed) on master and push? | (a) merge, push, then build; (b) build from the branch first | Recommended (a), so every build matches a commit on GitHub. Nothing is pushed | D13, [ADR-0057](../adr/0057-branch-review-and-ci-policy.md) | chat, 15 Oct (« Say go and I'll start with the merge ») and 16 Oct | open |
| O8 | When to make the next native build, and with which numbers? The dark splash (DM-06), the permission changes (DRV-15, DRV-16) and the new images need prebuild, pod install and a new build | (a) right after O7: passenger 4 → 5, driver 5 → 6, logged in the build log; (b) later | Recommended (a). Today `buildNumber` is '4' (`apps/passenger/app.config.ts:24`) and '5' (`apps/driver/app.config.ts:26`); the build log is empty | [ADR-0049](../adr/0049-build-number-source-of-truth.md), [testflight-eas.md](../runbooks/testflight-eas.md#build-log), O10 | chat, 15 Oct | open |
| O9 | What happens to abderraouf's `origin/feat/feedback-round-2` (88e9432, 57 commits, 9–12 Oct) now that master moved to the trial branch? Does he know which side won? Confirm the six merge choices master made by default (SOS desk `/sos` vs `/securite`, handover, ticket outcome model, Famille engine, sign-up flow, onboarding imagery). Is the driver-app rename « Naya Conductrice » intended? | (a) he merges master into his branch and makes it CI-green, then ideas come back as small PRs; (b) we cherry-pick his ideas; (c) close the branch | Recommended (a). It is not CI-green (passenger jest does not run, 3 lint errors) and merging it as it stands would silently undo safety fixes (QA-21) | QA-21, D13 | chat 14–15 Oct; agent report naya-round2-comparison, 14 Oct | open |
| O10 | Did abderraouf upload builds passenger 5 / driver 6? His branch bumps to those numbers with no build-log row, the same numbers O8 plans | ask him; if uploaded, the next build is 6 / 7 | No default; ask before the next upload | QA-20, O8 | agent report naya-round2-comparison, 14 Oct | open (ask) |
| O11 | Did the first CI run on GitHub Actions pass (push of 0a791ff to master, 15 Oct)? Then protect master and require CI? | (a) protect master once CI is green; (b) not yet | Recommended (a) (D13). Nobody has looked at the Actions tab yet | QA-02, D13, `.github/workflows/ci.yml` | chat, 15 Oct | open (owner action) |
| O12 | Arselene's GitHub handle for CODEOWNERS, and confirm that `@Achref23illi` is right and has write access | send the handle | `.github/CODEOWNERS:5-7` still has the TODO. With a single owner nobody can approve that owner's PRs | D13, ADR-0057 | chat 13 Oct; agent reports foundation-and-fixes | open |
| O13 | What are `achref-dev-skill-debt/` and `achref-dev-skill-debt-images.zip` at the repo root? They look like another project's assets (Apollo / moon images, about 26 MB) | (a) move them out of the repo and ignore `*.zip`; (b) keep them | Recommended (a). Still untracked; a `git add -A` would commit them | PH-6 | audit 13 Oct; verification 14 Oct decision 16; chat 15 Oct | open |
| O14 | Commit `docs/tasks/` (the founder brief and two prompt files) and `docs/screens/ios/passenger-01-welcome.png` (3.7 MB)? | commit / keep untracked, for each | Recommended: commit `docs/tasks/` (small text, `packages/assets` docs link it); decide ADR-0052 (D15) before `docs/screens/ios/`. Both untracked | PH-6, D15, [ADR-0052](../adr/0052-screenshot-storage.md) | verification 14 Oct decision 16; chat 15 Oct | open |
| O15 | Clean up the merged branches and worktrees: `chore/docs-foundation-and-fixes`, `integration/trial-2026-10-14`, `fix/demo-blockers-portable`, `feat/car-wash`, `feat/driver-signup`, `feat/famille-safety`, the worktrees in `../naya-worktrees/` (integration-trial, demo-blockers, car-wash, driver-signup, famille-safety), and the two stashes in the main folder | delete / keep | Recommended: delete the local branches and worktrees once O7 lands (all are in master); keep the pushed `chore/…` branch until its PR question is closed | — | chat, 15 Oct (task list item 4) | open (needs a go) |
| O16 | Accept [ADR-0053](../adr/0053-idempotency-key-lifecycle.md) (idempotency key lifecycle), [ADR-0054](../adr/0054-source-of-truth-for-the-passenger-s.md) (the server's `cityId` is the source of truth) and [ADR-0055](../adr/0055-account-lifecycle.md) (account lifecycle)? | accept each / change | The client parts are built as recommended (6cf0a2e, 7df778c, 402c835, e07ef01); the server parts are not (API-07 for 0053, steps 3–4 for 0054, the 30-day queue, suspension and revocation for 0055, and API-27). Recommended: accept the designs, track the server parts as backlog rows | UI-03, PAX-05, PRD-35, API-27 | agent report passenger-polish, 15 Oct | open |
| O17 | Test on a real iPhone, and build Android once? Nothing has run on a physical device: live document camera, background location, photos, native shadows, dark splash, SOS hold haptics, map marker rotation, real Dynamic Type | (a) one device pass after the O8 build, with the QA-22 checklist; (b) keep Expo web only | Recommended (a). Android has never been built | QA-22, PH-7, D10 | chat 13–15 Oct; verification 14 Oct decision 15; agent report redesign-implementation | open (owner action) |
| O18 | Who owns the build log and the verification log? `docs/README.md` lists the owner of runbooks/ and quality/ as « name to be set » | name a person | No owner | `docs/README.md` | agent report foundation-and-fixes, 13 Oct | open |

### Copy, onboarding and design sign-offs

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O19 | Passenger onboarding slide 3 shows the school-gate photo (a chauffeuse, a mother and her daughter) under the copy « Une communauté vérifiée. », which is about account review. Change the copy or the photo? | (a) Famille copy, for example « Vos enfants, accompagnés. »; (b) a photo with no child (the prompt pack has a variant); (c) keep both | In the code: the school-gate photo with the review copy (`apps/passenger/src/app/(auth)/welcome.tsx`). The owner chose to replace slide 3 (13 Oct) and to use this photo (15 Oct), but the copy was never answered. If Famille stays out of the launch (D3 default), (b) | PH-1, D3, [ADR-0048](../adr/0048-cross-surface-media-and-brand.md) | other chat 13 Oct (Q1); verification 14 Oct decision 1; agent report images, 15 Oct | open |
| O20 | On on-device (standalone) builds an automatic reviewer approves dossiers, but the copy says « Une personne de l'équipe Naya examine vos documents ». Soften it there? | (a) copy per mode, for example « Vos documents sont en cours de vérification »; (b) keep | Recommended (a): ADR-0058 says copy stays true for the mode it runs in. The phrase is in both apps today | PRD-41, [ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md) | chat 14 Oct and 15 Oct (task list item 25); agent report real-app-feel | open |
| O21 | « Approuvée » or « Agréée Naya Famille » for an approved Famille application? | one wording everywhere | The integration chose « Approuvée »; the driver dossier still hard-codes « Agréée Naya Famille » (`apps/driver/src/components/Dossier.tsx:247`) | DRV-32 | verification 14 Oct decision 13 | open |
| O22 | Sign off the status-system choices the redesign made on its own: neutral chip words drawn in ink (muted on mauve is 4.3:1), the short labels « GPS désactivé », « Signal perdu », « Accès aux courses bloqué », and the new kinds `city`, `selection`, `preference`, `progress` | keep / change | As built (`packages/domain/src/status.ts`); not recorded in ADR-0059 or R1–R18 | [ADR-0059](../adr/0059-status-is-an-icon-problems-keep-words.md) | agent report redesign-implementation B0, 15 Oct | open (sign-off) |
| O23 | Sign off the light-mode side effects of the dark-mode work: field and OTP borders now use `outline` (a visible grey edge in light), the selected document tile is mauve, the ride pill is solid, the verification hero has a hairline | keep / revert in light | As built; partly superseded by the redesign | DM-03, DM-09 | agent reports foundation-and-fixes 13 Oct, dark-mode fixes 15 Oct | open (sign-off) |
| O24 | Three small dark-mode design calls: the quote payment row has no border and is 1.13:1 against the sheet (`quote.tsx:276`; a border changes light too); the field focus ring is about 2.4:1 against the resting outline (3:1 needs a 2 px ring); the card at `packages/ui/src/List.tsx:102` still uses `line` | change each / keep | Unchanged in the code | DM-10, DM-03, DM-08 | chat and agent report dark-mode fixes, 15 Oct | open (design) |
| O25 | Confirm the DateField message for an impossible date: « Cette date n’existe pas. Vérifiez le jour et le mois. » | keep / reword | In the code (`packages/ui/src/Form.tsx`) | DS-5 | agent report foundation-and-fixes, 13 Oct | open (low) |
| O26 | Set `barcodeScannerEnabled: false` on expo-camera in both apps? No code scans barcodes, so the binary shrinks; it changes the native build | yes / no | Not set | `apps/*/app.config.ts` | agent report redesign-implementation, 15 Oct | open |
| O27 | Should the admin console (and the web backoffice) get dark mode now that both apps have it? | yes / not for v1 | Audit default: no dark mode in admin or web for now. ADR-0023 lists it as a trigger to revisit | [ADR-0023](../adr/0023-mobile-styling-and-runtime-dark-mode.md) | audit 13 Oct (visual, web) | open |

### Mock data and mock builds

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O28 | In mock builds a « Maintenant » car wash is never charged a cancellation fee: the mock team arrives in about 85 s, inside the 5-minute free window (a side effect of the CW-01 fix). Accept, or slow the mock team so testers can see a fee? | (a) accept; (b) slow the mock engine; (c) mention it in the demo script | (a) in the code | CW-01, [specs/car-wash.md](../specs/car-wash.md) R8 | chat 14 Oct; agent report portable-demo-blockers | open |
| O29 | On the phone, a Naya Famille application is approved automatically 20–40 s after it is sent, although the flow offers an interview slot; seeded Khadija (vehicle) and Houda (Famille) are approved on their first request. Keep them « en cours » on the device instead? | (a) keep pending on device; (b) keep auto-approval | (b) in the code (`services/demo-api/src/embedded.ts:62-79`) | API-32 | agent report real-app-feel, 14 Oct | open |
| O30 | Agency top-ups and recharges (Cash Plus, Wafacash, agency network) confirm on their own after 8 s, although the copy asks the person to pay at a counter. Leave them pending in mock builds? | auto-confirm / leave pending | Auto-confirm (the ADR-0058 rule « mock outcomes happen on their own ») | `services/demo-api/src/services/finance.ts`, `prototype.ts` | agent report real-app-feel, 14 Oct | open |
| O31 | The mock payout accounts use real Moroccan bank names (Attijariwafa bank, CIH Bank, Banque Populaire). Swap them for invented names? | swap / keep | Real names (`services/demo-api/src/seed.ts:491-494`) | — | agent report real-app-feel, 14 Oct | open |
| O32 | The seeded phone numbers (+2126…) could belong to real people. Move them to a reserved or obviously fictional range? | change the seed / keep | Kept; WhatsApp is not opened in mock builds for this reason, but a share sheet or a future SMS could reach a stranger | PRD-42 | agent report real-app-feel, 14 Oct | open |
| O33 | The country picker offers France, Spain, Belgium and Senegal besides +212, and the server accepts any E.164 number. Morocco only at launch? | Morocco only / keep the list | The list in `packages/domain/src/phone.ts:12-18` | — | agent report real-app-feel, 14 Oct | open |
| O34 | Old demo data: bump `schemaVersion` (wipes testers' phones) or keep « reset needed »? Restore Khadija « Famille en examen » and Samira « Famille refusée » with real dossiers? | bump / reset; restore / drop | Reset documented (AGENTS.md gotcha); the two states are gone since the 14 Oct integration | DS-M2 | verification 14 Oct decision 14 | open |
| O35 | Should demo fares look realistic? Rabat shows 100 MAD for 10 km / 25 min and 127,60 MAD for 9,1 km in Confort | recalibrate / keep | The seeded `RABAT_RULES` | `services/demo-api/src/seed.ts` | audit 13 Oct (visual; §9 « Demo fares ») | open |
| O36 | Dev-mode Famille controls on a shared demo: `/dev/family/play` cancels another parent's trip, and `/dev/family/trips/:id/demo` approves in the parent's name. Limit them to the caller's own demo trips, and set `NAYA_DEV=0` on any hosted demo? | limit / keep | Routes unchanged (`services/demo-api/src/services/famille.ts:805-817`); extends D9 | FS-01, D9 | verification 14 Oct decision 12 | open |

### Naya Famille details (all depend on D3)

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O37 | Confirm the approval limits: the parent has 3 minutes to approve the start, at most 3 requests, then « appelez le parent ou annulez » | keep / change the numbers | 180 s and 3 requests (`packages/domain/src/famille.ts`); values invented by the build agent | F2, [specs/family.md](../specs/family.md) | other chat 13 Oct (Q5); verification 14 Oct decision 5 | open |
| O38 | The other parent: follow only, or may she also approve the start? And the follow link: lifetime (per trip, day or subscription), does it show the home address and the position before pick-up, are new viewers announced, web URL or app link? | — | Follow only; the link never expires (only revocation ends it) and shows the full pick-up address and the live position. Recommended: follow only, expiry per subscription, no street address, position only while the child is on board | FS-06, F4 | other chat 13 Oct (Q4); verification 14 Oct decision 4 | open |
| O39 | School drop-off proof: keep « photo within 300 m plus the handover code »? When GPS is lost, show « Signal perdu » instead of the ×20 simulation, and refuse the drop-off on a stale or simulated position? Is a photo of the gate enough when a school refuses photos? | — | 300 m; the simulation takes over 5 s after the last real fix in every build. Recommended: simulation in dev mode only, refuse stale positions | FS-03, FS-07 | other chat 13 Oct (Q6); verification 14 Oct decision 7 | open |
| O40 | Handover: fixed codes set by the parent, or one-time codes per trip? Is a code mandatory? Preselect the first authorised adult? Who resolves a locked or failed handover (absent adult, lost code, closed school), and how does the trip end? | — | Fixed codes stored in plain text; no preselection after a reload; after 5 wrong codes the trip stays « en cours » with no exit | FS-04, FS-09, P1, DOM-17 | verification 14 Oct decision 6 | open |
| O41 | Should « Police 19 » and Famille incidents raise an alert on the SOS desk? | yes / no | No alert today (`famille.ts:702-707` notes the call on the trip only). Recommended: yes | FS-10, D2 | verification 14 Oct decision 8 | open |
| O42 | Child pick-up and drop-off photos: how long are they kept, and who may see them (parent plus a `family.ops` permission, or `config.edit` too)? | — | No retention rule; `config.edit` admins see photos and handover codes. Recommended: parent plus `family.ops`, codes stripped from the admin payload | FS-16, PRD-29, [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) | other chat 13 Oct (Q7); verification 14 Oct decision 9 | open |
| O43 | Famille approval prerequisites: must person and vehicle be approved first? Must the reviewer record the interview and training outcomes? Where and when do interviews happen (the flow offers the next 6 days except Sunday, morning or afternoon), and is training mandatory before the first trip? | — | None is required; an admin can approve Famille while identity is « Complément demandé » | DS-7 | other chat 13 Oct (Q15); verification 14 Oct decision 10 | open |
| O44 | In a Famille correction round that comes after the chosen interview day, the driver must pick a new day before she can resubmit. Intended? | keep / drop | Built that way in the app and the server (spec eligibility R21) | [specs/eligibility-and-verification.md](../specs/eligibility-and-verification.md) | agent report portable-demo-blockers, 14 Oct | open |

### Car wash (the rest of F1)

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O45 | Should the wash price depend on the car's size (city car vs SUV)? | yes / one price per package | One price per package | `packages/domain/src/carWash.ts` (`CAR_WASH_DEMO_CONFIG`) | other chat 13 Oct (Q11) | open |
| O46 | Can drivers pay a wash by card? Today they pay from their Naya wallet or in cash | yes / no | Wallet or cash | [specs/car-wash.md](../specs/car-wash.md) | other chat 13 Oct (Q12) | open |
| O47 | The real packages, prices, durations, hours, commission and cancellation fees | provide the values | Placeholders: Rabat 60/110/180 MAD, Casablanca 70/125/200 MAD, 20 % commission, 08h00–20h00; free cancellation for 5 min after assignment or until 2 h before the slot, then 20 MAD (30 MAD en route) | `CAR_WASH_DEMO_CONFIG`, spec car-wash | other chat 13 Oct (Q10); verification 14 Oct decision 11 | open |
| O48 | Car-wash governance: its own ADR and admin permission (today `rides.read`, with amounts visible to support)? May washes be paid with the Portefeuille Naya and the Wallet marocain (D5)? How are cash wash fees collected (D7)? Warn a driver who goes online while her car has an open wash? | — | No ADR; wallet and mobile wallet accepted; cash fees stay pending; no warning | CW-16, CW-03, CW-09, CW-14 | verification 14 Oct decision 11 | open |

### Driver sign-up

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O49 | Minimum years of driving, and should licence categories other than B (A, C, D) be accepted? | — | Category B only; experience no more than the licence's age; no minimum | `packages/domain/src/signup.ts` | other chat 13 Oct (Q13) | open |
| O50 | Famille references: may a family member be one? Is « casier judiciaire de moins de 3 mois » the right rule? | — | Any person; the extract's date is copy only and is not recorded | `apps/driver/src/components/signup/copy.ts`, DS-M1 | other chat 13 Oct (Q14) | open |
| O51 | Criminal-record extract handling (F3 says Famille drivers only): amend ADR-0034 decision 5; consent and purpose notice; legal basis under law 09-08; retention (delete after the decision plus N days, and on reopening); who may read the extract and the references; its maximum age; the re-check cadence; keep it a specimen in tester builds meanwhile? | — | No notice; support (`people.read`) can read the references; the file is never deleted and reads are not audited; Famille approval never expires | DS-3, DS-M1, F3, D10, [ADR-0034](../adr/0034-women-only-eligibility-and-verification-policy.md) | verification 14 Oct decision 3 | open |

### Money, legal and data

| # | Question | Options | Default (in the code?) and recommendation | Where | Source | Status |
|---|---|---|---|---|---|---|
| O52 | A deleted account is stored as `status: 'suspended'` named « Compte supprimé », so the admin shows « Suspendue ». Add a real `deleted` status or a `deletedAt` field with its own admin label? | (a) new status or field; (b) keep | (b) in the code (`User.status` allows only active or suspended). Recommended (a) | API-36, ADR-0055 | agent report passenger-polish (account deletion), 15 Oct | open |
| O53 | What is kept after an account is deleted, and for how long (law 09-08)? Identity documents and details are erased, but audit events keep her phone (`account.created`) and children's names (`family.*`), and ride and Famille addresses, car-wash plates and support messages stay | erase more / keep with a retention period | Erase documents, keep the append-only audit trail. Needs counsel's retention schedule (D10) | API-35, ADR-0055 | agent report passenger-polish, 15 Oct | open |
| O54 | Driver debt limit: does a limit of 0 mean "prepaid commission" (every driver at a zero balance, new ones included, is blocked)? Should a pending withdrawal count against the limit (post the debit at request, count reserved funds, or refuse confirmation when the balance would go negative)? | — | A 0 limit blocks at zero; pending withdrawals are ignored, so a driver can go past the limit by the withdrawn amount. Recommended: count pending withdrawals as reserved | DOM-19 | audit 13 Oct (domain); agent report foundation-and-fixes | open |
| O55 | Can a service category carry its own cancellation fees or dynamic multiplier? Today both come from the city | yes / city only | City only (`services/demo-api/src/services/rides.ts:82,94`); not in ADR-0033's questions | D6, [ADR-0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md) | agent report foundation-and-fixes (money spec), 13 Oct | open |
| O56 | What must exist before a new city goes live (a zone, a cash ride provider, an enabled card provider, place data, a readiness check on activation)? A new city can take recharges before it can take rides | define a checklist | No check | PRD-26, API-59 | agent report foundation-and-fixes (money spec), 13 Oct | open |

## Answered in chat (13–16 October)

Questions raised in the chats and answered later in them, recorded so they are not asked again.

| Question | Answer | Date and source | Recorded in |
|---|---|---|---|
| Land `chore/docs-foundation-and-fixes` on master? | Yes: « Put everything on the master branch for now. » Master was fast-forwarded from 02ff3d3 to 0a791ff (the trial branch, 53 commits) and pushed; `feat/feedback-round-2` was kept out | owner, chat, 15 Oct | memory note `naya-branch-state.md`; O9 for round-2 |
| Which sign-in code works in mock builds? | Any 6 digits, in mock builds only (dev API or on-device); a real backend checks the code | owner, chat, 14 Oct | ADR-0058 item 2 |
| Where does the school pick-up photo go: a 4th passenger slide or slide 3? | « just replace slide 3 »; on 15 Oct the generated school-gate photo replaced it. The copy question stays open (O19) | owner, other chat 13 Oct; images 15 Oct | ADR-0048 decision update |
| Cars: vector drawings or the generated renders? | The renders: plum and pearl PNGs in the quote, `VehicleImage` and the map marker; the owner did not object when asked | 15 Oct, chat | ADR-0025, ADR-0048 (decision updates); D11 |
| Onboarding images: format and cast | 9:16, women only, Moroccan women with light-olive to caramel skin, with and without headscarf | owner, other chat 13 Oct | memory note on depicting Moroccan people; image prompts |
| Remove the demo wording and let any phone number sign up? | Yes: a real-app feel with mock data behind it | owner, chat, 14 Oct | ADR-0058 |
| Redesign decisions R1–R18 | Option (a) for all eighteen | owner, chat, 15 Oct | [R1–R18](#redesign-decisions-r1r18-15-october) |
