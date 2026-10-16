# Naya ideas bank

Owner: Achraf · Last updated: 2026-10-16

This page lists every idea and proposal raised from 13 to 16 Oct 2026 so that none is lost. Sources: the Claude
sessions, the agent reports of the 15 multi-agent workflow runs, and the founder brief. It also lists the alternatives
that were rejected, with the reason, so nobody proposes them again.

What does not belong here:
- Bugs and risks go to the [backlog](backlog.md).
- Questions for the owner go to [open questions](open-questions.md).

A row here may link to either page.

**How to promote an idea.** Give it a backlog row, or write an ADR if it changes an invariant or a decision. Then set
its status here and put the backlog ID or ADR in the Link column. Never delete a row. Mark it done, deferred or
rejected instead. New ideas get the next free ID (IDs are stable and sequential across the whole file).

**Status.**
- open: proposed, nobody has started it.
- planned: agreed and queued.
- deferred: postponed on purpose, with the reason given.
- done (commit): implemented, with the commit that did it. Each commit was checked against `git log`. Commits after
  0a791ff are on `feat/passenger-polish` and are not merged to master yet.
- rejected: see the last section.

"Needs Dn" means the idea waits on that owner decision.

**Source key.**
- *chat*: the main Claude session of 13–16 Oct (owner requests and the assistant's proposals).
- *other chat*: the 13 Oct session that wrote the founder brief and built the driver sign-up, Famille and car-wash
  branches.
- *brief*: the [founder brief][brief] of 13 Oct.
- *audit*: the [13 Oct full audit][audit], with its [findings][findings].
- *verification*: the [14 Oct verification][verif].
- *redesign audit*: the [15 Oct redesign audit][redesign]. R1–R18 are its decisions.
- *run X*: an agent report from a workflow run. The runs are:
  - 13 Oct: full-audit, foundation.
  - 14 Oct: verify, round-2 comparison (feat/feedback-round-2 against our branches), blockers (portable demo
    blockers), real-app (real-app feel), any-code.
  - 15 Oct: polish (passenger polish), dark-audit, dark-fixes, prompt-pack (prompt pack and redesign audit),
    redesign (redesign implementation), images (images prep and integration).

## Passenger app

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-001 | Home with 5 choices instead of 9: « Maintenant » inside the search pill, one services rail for Famille and Lavage | Too many competing entries on the first screen | 15 Oct · redesign audit (R7) | done (820a87e) | RD-03 |
| IDEA-002 | Drop the itinerary step: search goes straight to the quote, where the route stays editable | One step less to book | 15 Oct · redesign audit (R6) | done (820a87e) | RD-03 |
| IDEA-003 | Quote: the price on each category row, the fare above the fold, and the payment row and Maintenant/Planifier pinned next to « Confirmer » | Payment and mode were below the fold; the fare is the hero | 13 Oct · audit; 15 Oct · redesign audit | done (890b28b, 820a87e) | VIS-03, RD-03 |
| IDEA-004 | Nearby cars on the home map (P-12) | Shows that cars are around before booking | 15 Oct · redesign audit | deferred (needs a nearby-cars endpoint) | RD-03 |
| IDEA-005 | Route on the quote as one « A → B · Modifier » line instead of stop rows (P-21) | Saves space on the quote | 15 Oct · redesign audit | open | RD-03 |
| IDEA-006 | Searching radar pulses at the pickup on the map, not in the header disc (P-58) | Ties the search to the place | 15 Oct · redesign audit | open (needs a marker change) | RD-04 |
| IDEA-007 | Seat count on quote rows (« 4 places ») and recent places in search | The Uber-style rows of the audit assume both | 15 Oct · run redesign (B2) | open (needs a seat field in the catalog and a recent-places API) | — |
| IDEA-008 | Price and live ETA per category, from one quote request for all categories | ETA is a static constant | 13 Oct · audit | open | PRD-17, VIS-13 |
| IDEA-009 | Keep the booked category visible after booking: receipt, ride screens, admin ride list and filters | The category disappears once booked | 13 Oct · audit | open | PRD-16 |
| IDEA-010 | Label straight-line routes « Itinéraire indicatif », or draw a routed polyline | A straight segment across city blocks looks like a wrong route | 13 Oct · run full-audit (visual) | open | — |
| IDEA-011 | Live ride with the plate as the hero | The passenger must recognise the car | 15 Oct · redesign audit | done (953b79a) | RD-04 |
| IDEA-012 | Driver photo (a reviewer-approved portrait) on the driver card | Recognise the driver before boarding; women-only trust | 13 Oct · audit; 15 Oct · runs redesign, images | open (no driver photos exist) | PRD-33, VIS-26 |
| IDEA-013 | In-app ride chat (cheap first step) and masked calls between passenger and driver | No contact path exists; the copy is honest about it now | 13 Oct · audit | open (needs a telephony provider) | PRD-10, DRV-04, [ADR-0031][a31] |
| IDEA-014 | While calls and messages are not live, hide those rows and move the 19 call to the safety sheet (R8) | No dead « Bientôt disponible » rows | 15 Oct · redesign audit (R8) | done (953b79a) | RD-04 |
| IDEA-015 | Code entry submits itself at the 6th digit; « Réessayer » after a network or server error (R16) | Fewer taps | 15 Oct · redesign audit (R16) | done (0c7bdd3) | RD-06 |
| IDEA-016 | Profile screen, phone-number change (request + verify) and a trusted-contacts screen, ported from feat/feedback-round-2 | Missing on master | 14 Oct · run round-2 comparison | open | — |
| IDEA-017 | Round-2's calendar DatePickerSheet on DateField, kept with master's date rules and its 4 tests | Easier birth-date entry | 14 Oct · run round-2 comparison | open | — |
| IDEA-018 | In-app account deletion in both apps | App Store rule 5.1.1(v) | 13 Oct · audit (smaller calls) | done (402c835 passenger, e07ef01 driver) | PRD-35, PAX-12, [ADR-0055][a55] |
| IDEA-019 | Show the deletion blockers on step 1, not after « Supprimer définitivement » | She learns too late that she cannot delete | 15 Oct · run polish | open (needs a blockers endpoint) | O1 |
| IDEA-020 | Guess the card brand from the first digits (« Visa •••• 1234 ») | Seeded cards show a brand, new ones do not | 14 Oct · run real-app | open | — |
| IDEA-021 | Help topics for the wallet, Famille, SOS and car wash | Help lagged behind the Oct 6 features | 15 Oct · chat (mobile task list) | done (92b77be) | PAX-11, PRD-23 |
| IDEA-022 | Open support on the right category from every entry point (car wash, dossier, ride) | Skips step 1 when the topic is known | 15 Oct · run redesign (B8) | open | RD-09 |
| IDEA-023 | Scheduling picker fed by the city rules, and the city read from /me | One source of truth for the city | 15 Oct · chat (mobile task list) | done (7df778c) | PAX-07, PAX-05, [ADR-0054][a54] |
| IDEA-024 | Real long-press drag for stop reordering, or chevron buttons of at least 44 pt | Both buttons use the drag glyph and nothing drags | 13 Oct · run full-audit (ui-kit); 15 Oct · redesign audit | open | — |

## Driver app

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-025 | Sign-up with one question per screen, save-and-resume, camera guides shaped per document, a dossier overview with progress, per-document status and « Renvoyer » | Brief task 2: missing steps, weak UI | 13 Oct · brief; other chat | done (6379115, e9c82aa, 7762e36; on master through the trial) | DS-1, DS-2, DS-5 |
| IDEA-026 | Full document list: CIN, selfie, licence (category, issue and expiry dates, years), criminal-record extract, carte grise, insurance, visite technique, vehicle photos | Brief task 2 | 13 Oct · brief | done (same commits; criminal record for Famille only) | F3, [eligibility spec][s-elig] |
| IDEA-027 | Licence rules: category B, still valid, issued at 18 or older, experience no longer than the licence | Basic eligibility | 13 Oct · other chat | done; other categories and a minimum number of years are open | — |
| IDEA-028 | Restyle the sign-up with round-2's progress ring (3 sections fed by dossierOverview()) and its plum capture stage | Best of both branches | 14 Oct · run round-2 comparison | open (e07ef01 restyled the dossier; the ring was not ported) | RD-11 |
| IDEA-029 | Privacy note on the capture stage (« Chiffrée et vue uniquement par l'équipe de vérification Naya ») and a check question on the preview | Reassurance at the most sensitive step | 14 Oct · run round-2 comparison | open | — |
| IDEA-030 | After a refused submission, open the step named in `details.step` instead of showing a toast | The server already names the step | 14 Oct · run blockers | open | DS-2 |
| IDEA-031 | Keep approved documents read-only during a correction round; track licence and insurance expiry; revoke an approval with a reason | Accepted documents get re-reviewed; approvals never expire | 13 Oct · audit (smaller calls); 14 Oct · verification (DS-11) | open | [ADR-0055][a55], [eligibility spec][s-elig] |
| IDEA-032 | A UI pass over the other driver screens: home, offer, ride, earnings, wallet, account | Brief task 3 | 13 Oct · brief | done (8aa9451, e07ef01, d50e2c7) | RD-10, RD-11, RD-12 |
| IDEA-033 | Offer shows « Net pour vous » beside the fare; offer timer from the city timeout | She decides on net pay; no hard-coded 30 s | 13 Oct · audit; 15 Oct · redesign audit | done (d50e2c7) | DRV-05, RD-12 |
| IDEA-034 | A blocked driver sees the action that unblocks her instead of a disabled « Passer en ligne » (R12) | She knows what to do | 15 Oct · redesign audit (R12) | done (d50e2c7) | RD-12 |
| IDEA-035 | Name the amount in that action (« Recharger 150 MAD ») | Design principle: one move, with its amount | 15 Oct · redesign audit | open (the recharge screen takes no amount) | RD-17 |
| IDEA-036 | One 7- or 30-day earnings bar chart drawn with plain Views, no chart library (R18); amounts never wrap (FitMoney) | Earnings at a glance | 15 Oct · redesign audit (R18) | done (8aa9451) | RD-10 |
| IDEA-037 | Earnings rows titled with the time and the route | The audit's row design | 15 Oct · run redesign (B9) | open (the API rows have no route field) | RD-10 |
| IDEA-038 | A chevron or other cue on pressable ledger rows (D-24) | They open a detail but look static | 15 Oct · run redesign (B9) | open | RD-10 |
| IDEA-039 | The driver rates or reports the passenger at ride end; ratings stored as sum and count | Two-way trust; the rounded average drifts | 13 Oct · audit; 15 Oct · redesign audit (D-17) | deferred (needs an endpoint) | PRD-32, RD-12 |
| IDEA-040 | Block driver sign-out during an active ride | A ride must not lose its driver | 13 Oct · audit (smaller calls) | done (e07ef01) | DRV-10 |
| IDEA-041 | No microphone prompt; explain background location before asking for « Toujours » | Store review and honesty | 13 Oct · audit; 15 Oct · chat | done (50dfb3e; needs a native build) | DRV-15, DRV-16 |
| IDEA-042 | Ask for notification permission and alert « Nouvelle course » in the background | Offers are missed when the app is in the background | 13 Oct · audit | open | DRV-07 |
| IDEA-043 | A saved-card picker in the driver's card recharge | It goes straight to the bank screen today | 14 Oct · run real-app | open | — |
| IDEA-044 | Move the « Paiement en cours » screen out of `recharge/sandbox/` | « sandbox » shows in the web URL | 14 Oct · run real-app | open | — |
| IDEA-045 | Famille opt-in intro with three benefit rows | One sentence today | 15 Oct · run redesign (B6) | open (needs facts from the owner) | — |
| IDEA-046 | A driver help centre | Parity with the passenger help topics | 15 Oct · chat (mobile task list) | open | — |

## Shared UI and design system

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-047 | Present the apps as a real product: no demo wording, any phone number signs up, mock outcomes happen on their own, an on-device reviewer (« Vérification automatique »), a hidden scenario launcher (2 s press on the logo, `__DEV__` only) | Owner: "make it a real app with mock data" | 14 Oct · chat | done (a05838e to a99b1ba, edc5cd3, 927137e) | [ADR-0058][a58] |
| IDEA-048 | Status is an icon: `statusPresentation` and `StatusIcon` give one glyph, tone and word per state. The glyph stands alone in rows, the word appears on heroes and problems, the sentence is always in the accessibility label | Owner asked to cut the "icon + name" pattern | 15 Oct · chat; redesign audit (R1, R3, R5) | done (61e2413) | RD-01, [ADR-0059][a59] |
| IDEA-049 | Twelve design principles: one primary action per screen state, problems keep words, a chevron opens a screen, safety is pinned, the money number is the hero, and the rest | A shared review language | 15 Oct · redesign audit | done (adopted) | [redesign audit][redesign] |
| IDEA-050 | Rework the 150 icon + label pairings; remove the 32–40 pt icon discs on rows and leading icons in fields | Visual noise | 15 Oct · redesign audit | done (61e2413 and the B2–B11 commits) | RD-02 |
| IDEA-051 | Keep 50 pt main buttons for booking and driver decisions, 44 pt elsewhere (R2) | Weight where it matters | 15 Oct · redesign audit (R2) | done (61e2413) | RD-02 |
| IDEA-052 | Screen frame: collapsing large title, tab-bar inset, choice rows with a check, floating-label fields | Consistency across screens | 15 Oct · redesign audit | done (61e2413) | RD-02 |
| IDEA-053 | Toasts shown above sheets and announced; placed under the status bar or above a pinned footer (ToastAnchor); one tone glyph each | Toasts hid behind sheets and footers | 15 Oct · chat; redesign audit (X-06) | done (79a6493, 61e2413) | UI-07, UI-08, RD-15 |
| IDEA-054 | A ToastLayer in the Form picker modal, the LiveCamera modal and the native route modals | Toasts raised there stay hidden | 15 Oct · run polish | open | UI-07 |
| IDEA-055 | One shared Timeline component (check, ring, hollow) for ride, car-wash and Famille journals | The audit's best status pattern | 15 Oct · redesign audit (A19) | open | RD-14 |
| IDEA-056 | SegmentedControl with an icon slot and a per-option disabled state | Appearance glyphs; VoiceOver must hear a disabled option | 15 Oct · runs redesign, polish | open | RD-05, CW-04 |
| IDEA-057 | Heading levels on section titles (not every title an h1 on web); one section-header primitive for Famille and Préférences | Accessibility and consistency | 13 Oct · run full-audit (visual); 15 Oct · run polish | open | — |
| IDEA-058 | Use a non-action glyph, or another place, for the in-progress state shown beside the back button | It reads as a navigate button | 15 Oct · run redesign (B11) | open | — |
| IDEA-059 | One shared payment icon map instead of four local ones | Same method, same glyph | 15 Oct · run polish | done (61e2413, `paymentIcons.ts`) | — |
| IDEA-060 | One date and time formatter built from parts in packages/domain, imported by the admin too | Date strings differ by surface | 13 Oct · run full-audit (visual) | open | — |
| IDEA-061 | One CTA radius and shape across the apps, admin and website; serif display only on marketing | Brand consistency | 13 Oct · run full-audit (visual) | open | [ADR-0032][a32] |
| IDEA-062 | French only for v1, with start/end layouts so Arabic (RTL) and Darija can come later | Cheaper to prepare now | 13 Oct · audit (D12) | open (needs D12) | D12 |
| IDEA-063 | Record the Dynamic Type cap (1.6×, buttons 1.4×) and consider a higher cap for body text | Accessibility policy | 13 Oct · run full-audit (ui-kit) | open | [ADR-0024][a24] |
| IDEA-064 | A French error screen instead of expo-router's default English ErrorBoundary (both apps) | French-only product | 13 Oct · run full-audit (passenger) | open | — |
| IDEA-065 | One shared sign-out helper; the passenger's verify screens revoke the server token like the driver app does | Same behaviour everywhere | 13 Oct · run full-audit (passenger) | open | — |
| IDEA-066 | Move duplicated passenger and driver code (useAccountId, useMe, support, sign-out) into packages/ui | The two apps drift | 15 Oct · chat (mobile task list 43) | open | — |
| IDEA-067 | Remove the DemoBadge export | No demo wording (ADR-0058) | 14 Oct · chat | done (68d76c6) | [ADR-0058][a58] |
| IDEA-068 | Remove NativeWind, or adopt it | Wired but unused | 13 Oct · audit | open | DOM-13, [ADR-0047][a47] |
| IDEA-069 | `useA11yPrefs` as one module-level store, set before the splash hides | One listener per component; one animated frame for Reduce Motion users | 13 Oct · run full-audit (ui-kit) | open | — |
| IDEA-070 | Kit cleanup: Illustration takes a `kind` union, not a PNG it never shows. Delete the dead exports (MapSheet, RouteSummary, Title, Caption). Keep one of WalletCard and WalletSummary | Smaller, honest API | 13 Oct · runs full-audit (ui-kit, domain) | open | DOM-14 |
| IDEA-071 | Call SplashScreen.preventAutoHideAsync from the app root layouts, and add subpath exports to @naya/ui | Importing the kit runs side effects and pulls every feature | 13 Oct · run full-audit (ui-kit) | open | UI-04 |
| IDEA-072 | Migrate `runOnJS` to `scheduleOnRN` (Reanimated 4.5); review the exhaustive-deps suppressions | Deprecated API; one suppression hid a bug | 13 Oct · run full-audit (ui-kit) | open | QA-06 |
| IDEA-073 | Turn off expo-camera's barcode scanner (`barcodeScannerEnabled: false`) | Nothing scans barcodes; smaller binary | 15 Oct · run redesign (native config) | open (owner call; changes the native build) | — |
| IDEA-074 | Resolve the colour scheme before the first frame (the splash stays up until then); « Système » follows Appearance events; navigation theme from tokens | Dark phones opened in light | 15 Oct · run dark-audit | done (7f5ecde) | UI-09, DM-19 |
| IDEA-075 | Cache `themedStyles` per scheme, with the scheme on a global store | Speed; survives Fast Refresh | 15 Oct · run dark-audit | done (7f5ecde) | DM-19 |
| IDEA-076 | A jest guard that fails on colours read at import or cached without the scheme; its KNOWN list stays empty | Blocks the PAX-01 class of bug | 15 Oct · run dark-audit | done (d2fa271) | DM-20 |
| IDEA-077 | Literal-colour ratchet: flag `#hex` and `rgba(` in style objects outside tokens, with an allowlist and a baseline that may only shrink (in jest, since lint does not cover packages/ui) | No new hard-coded colours | 15 Oct · run dark-audit | deferred | DOM-12 |
| IDEA-078 | Replace the mutable Proxy palette with a `useColors()` hook that returns the palette and per-scheme styles | The design still relies on every component calling useTheme() | 15 Oct · run dark-audit | deferred | UI-09, [ADR-0023][a23] |
| IDEA-079 | Token rules: `outline` for control edges, `hairline` for decoration, `line` for separators; placeholders `muted`; `inverse` only on accent; no `colors.ink` shadows | One rule per use | 15 Oct · run dark-fixes | done (c951f54; rules in the AGENTS guides) | DM-03 to DM-12 |
| IDEA-080 | Scheme-aware shadows and a hairline edge on dark cards | Cards merged into the background | 15 Oct · run dark-fixes | done (c951f54) | DM-07 |
| IDEA-081 | Lift the dark surface colours (about #2A2330 and #352C3B) | Cards would stand out more | 15 Oct · run dark-fixes | open (owner call; changes every screen) | O3, DM-07 |
| IDEA-082 | Dark toast pill: elevated surface, hairline edge, tinted fills for errors and successes | The near-white pill was the brightest thing on dark screens | 15 Oct · run dark-fixes | done (e3e93a3; owner sign-off open) | DM-15, O2 |
| IDEA-083 | Dark Google map style on Android | `userInterfaceStyle` is iOS-only | 15 Oct · run dark-fixes | done (e3e93a3) | DM-18 |
| IDEA-084 | Dark tiles for the keyless TileMap fallback (web, Android without a key) | Light OSM tiles in dark mode | 15 Oct · run dark-fixes | open | DM-18 |
| IDEA-085 | A dark splash variant in app.config | A light flash on dark phones | 15 Oct · run dark-fixes | done in config (d2fa271); needs a native build | DM-06 |
| IDEA-086 | A 2 px focus ring to reach a strict 3:1 | 2.4:1 against the new field outline | 15 Oct · run dark-fixes | open | DM-03 |
| IDEA-087 | Generate the Tailwind preset from the tokens, or at least add `outline`, `thumb`, `hairline` and dark values | The preset is light-only and out of sync | 13 Oct · run full-audit (domain); 15 Oct · run polish | open | DOM-13 |
| IDEA-088 | A fixed plum wallet-card gradient with fixed white text in both schemes | `inverse` means "text on accent", not white | 15 Oct · run dark-fixes | done (e3e93a3; driver WalletCard in 8aa9451) | DOM-12 |

## Naya Famille

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-089 | Famille safety flow: GPS every second shown to the parent, a pick-up photo, a parent-approved start, a drop-off photo within 300 m of the school plus the handover code, and a follow link for the other parent | Brief task 4: "really sensitive work" | 13 Oct · brief; other chat | done (5bd9a1c, 42bdb4b, 87bb432, aea2028; on master through the trial) | [family spec][s-family], [ADR-0036][a36] |
| IDEA-090 | The parent is present at pick-up or approves the start from the notification (a mandatory awaiting_approval step) | Founder answer F2 | 13 Oct · brief | done (same commits) | F2 |
| IDEA-091 | Famille entry on the passenger home | Proposal in the brief | 13 Oct · brief | done (aea2028; services rail in 820a87e) | RD-03 |
| IDEA-092 | Let the other parent approve the start too, not only follow | Shared custody | 13 Oct · other chat | open | [family spec][s-family] |
| IDEA-093 | The approval request as a banner or sheet, not a full screen pushed mid-ride (P-62) | Less disruptive | 15 Oct · redesign audit | done (87282c3) | RD-07 |
| IDEA-094 | Handover codes masked for the parent (tap to reveal); approval only from the card | Codes visible over a shoulder | 15 Oct · chat (mobile task list) | done (6f263a6) | FS-12, FS-13 |
| IDEA-095 | One-time hashed handover codes per trip, with an attempt limit | Codes are static and stored in plain text | 13 Oct · audit (D3) | deferred (parents read the code back; needs a decision on how it is shown) | PRD-01, D3 |
| IDEA-096 | Pick-up check by a parent-approved child photo, the code and the parent's confirmation, instead of retyping a name the driver already sees | P1, second half | 13 Oct · audit | open | PRD-02, P1 |
| IDEA-097 | Port round-2's automatic alerts: late pick-up (+5 min), unusual stop, long trip, logged by a system actor | Safety monitoring master lacks | 14 Oct · run round-2 comparison | open | — |
| IDEA-098 | Port round-2's child profile: edit a child, several authorised adults, a square child photo the driver checks at pick-up, stored under a private upload purpose (not `support_attachment`) | Master cannot edit a child | 14 Oct · run round-2 comparison | open | PRD-39, PRD-29 |
| IDEA-099 | Port round-2's operations: pause, resume or cancel a subscription (reason of 10+ characters), per-driver Famille availability, a dedicated-driver summary, least-busy assignment, pool plans | Master has no admin action on subscriptions | 14 Oct · run round-2 comparison | open | ADM-10 |
| IDEA-100 | Port round-2's traceability: vehicle frozen at departure, per-step timestamps, a GPS track sampled every 30 s | Audit trail for child trips | 14 Oct · run round-2 comparison | open | — |
| IDEA-101 | Round-2's trip planner: trip-type tiles, a 14-day strip, quick times, a weekday summary | Faster than free date and time fields | 14 Oct · run round-2 comparison | open (re-check after 87282c3) | — |
| IDEA-102 | Real place search, zone check and SchedulePicker for Famille trips | Any address maps to fixed Hay Riad → Agdal points | 13 Oct · audit | open | PRD-09, VIS-09 |
| IDEA-103 | Parents cancel, skip or pause trips, end a subscription, edit children, revoke or rotate recipients | Parents have no control after booking | 13 Oct · audit; 15 Oct · chat | open (needs D3) | PRD-39, API-26 |
| IDEA-104 | Famille money and dispatch: payment, driver payout and dispatch integration, as a family flag on rides or as a separate product | Famille moves no money; a dedicated driver can be double-booked | 13 Oct · audit (D3) | open (needs D3) | PRD-03, DOM-16, P16, D3 |
| IDEA-105 | « Police 19 » during a Famille trip also raises a desk alert (a SafetyAlert with the family trip id) | The desk never hears of it | 14 Oct · verification (FS-10) | open (needs D2, D3) | D2, D3 |
| IDEA-106 | « Signal perdu » with the position's age; simulated GPS only in dev mode; the 300 m check refuses stale or simulated positions | The simulation silently replaces real GPS | 14 Oct · verification (FS-03) | open | [ADR-0036][a36] |
| IDEA-107 | A « remise échouée » state that support resolves; a failure path for trips | A trip cannot fail today | 13 Oct · audit; 14 Oct · verification (FS-09) | open (needs D3) | DOM-17 |
| IDEA-108 | Fresh, single-use proof photos (reject reused uploads; created after the enabling step) | The school photo can be replayed | 14 Oct · verification (FS-07) | open | — |
| IDEA-109 | Stream the driver's position from the app layout whenever a Famille trip is active, and ask for permission | Today only the trip screen streams, and it never asks | 14 Oct · runs round-2 comparison, verify | open | — |
| IDEA-110 | Famille vetting: criminal-record extract, two references, experience with children, a training commitment, an interview day, a `familleEligibility` flag | Stricter vetting than regular rides | 13 Oct · brief; other chat | done (6379115, 214fa37, e9c82aa) | F3, [ADR-0034][a34] |
| IDEA-111 | Periodic re-checks of Famille vetting | Vetting goes stale | 13 Oct · brief | open | [ADR-0055][a55] |
| IDEA-112 | A `family.ops` permission; only the parent and family.ops see child photos and data | Data minimisation | 13 Oct · audit (D3) | open | [ADR-0037][a37], PRD-29 |
| IDEA-113 | Push to a closed app for approval requests | The parent must see the request at once | 13 Oct · other chat | open | PRD-31, [ADR-0045][a45] |
| IDEA-114 | Invite the other parent to follow through an account-less link | Founder answer F4 | 13 Oct · brief | done (follow page); link lifetime and what it shows are open | [verification][verif] (FS-06) |
| IDEA-115 | Parent and driver talk through a WhatsApp call after the parent confirms; police one tap away | Founder answer F4 (replaces in-app video) | 13 Oct · brief | open (hidden in mock builds; needs a Famille exception to ADR-0031) | F4, [ADR-0031][a31] |

## Car wash

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-116 | « Lavage à domicile » for passengers and drivers: 5-step booking, timeline, live team position, before and after photos, receipt, rating, cancel sheet with a fee preview; read-only admin list | Brief task 5; answer F1 | 13 Oct · brief; other chat | done (b8843b7, beed664, 0a317ec, 9b38ab7, 83f1ec8; on master through the trial) | [car-wash spec][s-wash], F1 |
| IDEA-117 | One row per angle with Avant and Après thumbnails (R13) | Easy to compare | 15 Oct · redesign audit (R13) | done (4754a60) | RD-08 |
| IDEA-118 | A distinct mock photo per angle (Jantes, Habitacle) | Every angle shows the same full-car photo, which gives the mock away | 14 Oct · run real-app; 15 Oct · run images | open | — |
| IDEA-119 | Washers as a provider role with their own app, or partner companies | Who washes is undecided | 13 Oct · other chat | open | F1 |
| IDEA-120 | Admin editing of car-wash packages and prices | Prices are placeholders in code | 13 Oct · other chat | open | [car-wash spec][s-wash] |
| IDEA-121 | Price by car size (city car or SUV) | Bigger cars take longer | 13 Oct · other chat | open (owner question) | — |
| IDEA-122 | Drivers pay a wash by card, not only wallet or cash | More payment choice | 13 Oct · other chat | open (owner question) | — |
| IDEA-123 | Wash payments in admin Finance, a retry for failed card wash payments, settlement of cash wash fees | Support cannot see failed wash payments | 14 Oct · verification (CW-03) | open | P11, D7 |
| IDEA-124 | Hide or disable the driver's wash entry until her dossier is approved; prefill only an approved vehicle | She is refused only at confirm | 14 Oct · chat; run blockers | open (the entry moved to Compte with R7) | CW-02 |
| IDEA-125 | Warn or block a driver going online while a wash of her car is open; a compact open-order row on her dashboard | The team may arrive while the car is out | 14 Oct · verification (CW-14) | open | — |
| IDEA-126 | Slow the mock team for « Maintenant », or say it in the demo script | The cancel button vanishes before the time it promises | 14 Oct · run blockers | open | — |
| IDEA-127 | Parking notes that do not invite access codes, and that support does not see | Data minimisation | 14 Oct · verification (CW-10) | open | [ADR-0018][a18] |
| IDEA-128 | A car-wash ADR and its own permission | ADR-0043 and ADR-0039 ask for one | 14 Oct · verification (CW-16) | open | [ADR-0043][a43] |

## Safety and SOS

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-129 | Hold to trigger: 1.5 s on a full-width 56 pt button with haptics and a progress fill; a pinned safety disc in both apps; copy true for each mode (R10) | Fast, hard to trigger by mistake | 15 Oct · redesign audit (R10) | done (953b79a) | RD-04, [SOS spec][s-sos] |
| IDEA-130 | Moroccan emergency numbers from one module (19 police, 177 Gendarmerie, 15 Protection civile, 112), with the other numbers on the driver and Famille sheets | 15 was labelled SAMU | 13 Oct · audit (D2); 15 Oct · chat | done (92b77be, 953b79a) | PAX-11, [ADR-0035][a35] |
| IDEA-131 | The support banner reads `EMERGENCY_NUMBERS` instead of a hand-written copy | One source for the numbers | 15 Oct · runs polish, redesign | open | — |
| IDEA-132 | Show the operator's response to the person who raised the SOS (status, who took it, note) | The loop never closes for her | 13 Oct · audit (P5) | open | PRD-06, VIS-23, P5 |
| IDEA-133 | Port round-2's SOS extras: device GPS at trigger, an SMS to trusted contacts, a share sheet, an automatic support ticket, live status, alerts enriched with the people and vehicle (copy true per mode) | Richer alert | 14 Oct · run round-2 comparison | open | PRD-06 |
| IDEA-134 | Trusted contacts stored in the profile (and listed in the privacy inventory) | Needed for SMS alerts | 13 Oct · audit; 14 Oct · run round-2 comparison | open | PRD-06 |
| IDEA-135 | An SOS queue for support (/sos) under a `safety.respond` permission | Only config.edit admins saw alerts | 13 Oct · audit (P2) | done (e9800c3) | P2 |
| IDEA-136 | Remove the old SOS tab in Services, or point it to /sos | It shows raw coordinates next to the new page | 13 Oct · run foundation | open | VIS-24 |
| IDEA-137 | SOS at launch: phone (police and GPS to a trusted contact) plus a Naya desk in staffed hours, honest about the hours; SOS from `driver_assigned` on; a closable sheet | Recommended option (b) of D2 | 13 Oct · audit (D2) | open (needs D2) | D2, [ADR-0035][a35] |
| IDEA-138 | A safety-alert state machine in packages/domain (forward-only) | Status can go from resolved back to new | 13 Oct · run full-audit (domain) | open (/sos already enforces forward-only on the server) | [ADR-0007][a07] |
| IDEA-139 | Real ticket priority for safety requests | Safety tickets wait like others | 13 Oct · audit | open | PRD-23 |

## Money and payments

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-140 | Describe each payment method as it really works, from one label helper | The wallet showed « Carte » | 13 Oct · audit (P14) | done (890b28b, 8aa9451) | P14, PRD-15 |
| IDEA-141 | A failed wallet debit reads « Montant libéré · rien n'a été débité » (R11) | Says what happened to her money | 15 Oct · redesign audit (R11) | done (953b79a) | RD-04 |
| IDEA-142 | Commission: a category inherits the city rate unless a per-city override exists (nullable commissionBp); show the effective commission | Casablanca charges 15 % instead of 18 % | 13 Oct · audit (D6) | open (needs D6) | P8, D6, [ADR-0033][a33] |
| IDEA-143 | Cash cancellation fee added to the next fare, ledger key `ride:<id>:cancel-fee`, driver credited when it is posted | The fee is never collected | 13 Oct · audit (D7) | open (needs D7) | P11, D7, [ADR-0041][a41] |
| IDEA-144 | No passenger stored-value wallet at launch, or a licensed partner with signed callbacks; mobile-wallet rides wait for a provider event | Customer funds are regulated | 13 Oct · audit (D5) | open (needs D5) | D5, P7, [ADR-0040][a40] |
| IDEA-145 | A `mobile_wallet` provider kind instead of `cash_network` | The mobile wallet is described as an agency | 13 Oct · audit | open | PRD-20 |
| IDEA-146 | One PaymentChannel type with mapping functions, replacing three payment taxonomies | They drift | 13 Oct · run full-audit (domain) | open | — |
| IDEA-147 | A domain payment state machine instead of hand-coded status changes | Same rule everywhere | 13 Oct · run full-audit (domain) | open | [ADR-0007][a07] |
| IDEA-148 | Dispute outcomes as an enum with financial actions (a refund tool); no « Remboursement accordé » until it moves money | The outcome promises a refund nobody makes | 13 Oct · audit | open | PRD-14, ADM-08 |
| IDEA-149 | An admin refund for a passenger wallet balance | A balance blocks account deletion | 15 Oct · run polish | open | O1 |
| IDEA-150 | Passenger wallet totals and the top-up ledger in admin Finance, under finance.read | Customer funds are invisible to finance | 13 Oct · audit | open | PRD-38, ADM-17 |
| IDEA-151 | A payout-account endpoint so a new driver can withdraw | Withdrawal is a dead end | 13 Oct · audit | open | API-13 |
| IDEA-152 | « Revenus nets » counts confirmed money only; RIB changes go through support | Smaller calls with defaults | 13 Oct · audit (smaller calls) | open | — |
| IDEA-153 | Calibrate the demo fares (100 MAD for 10 km looks high for Rabat) | Client demo credibility | 13 Oct · audit | open | — |
| IDEA-154 | Cancellation copy derived from the city grace period (like round-2's `graceLabel()`), not a hard-coded « 2 minutes » | The grace is a city rule (0–1800 s) | 13 Oct · run full-audit (domain); 14 Oct · run round-2 comparison | open | D7 |
| IDEA-155 | Wallet cancellation fee labelled « Frais d'annulation · R-xxx »; old « Course · LV-xxx » entries renamed « Lavage » | Wallet history should say what it was | 15 Oct · run polish | open | CW-07 |
| IDEA-156 | FrozenTerms records the catalog version and the category price overrides | Trace which catalog produced a price | 13 Oct · run full-audit (domain) | open | — |
| IDEA-157 | Provider callbacks: one secret per provider, a timestamp window, a check that the provider owns the reference, a bounded dedupe list | The pattern will carry into the real payment integration | 13 Oct · run full-audit (demo-api) | open | — |
| IDEA-158 | Self-confirm money routes only in dev mode | A payer could confirm her own payment | 13 Oct · audit; 14 Oct · chat | done (88b49c1) | API-03, PRD-12 |

## Admin and operations

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-159 | One backoffice: apps/admin only, the website becomes marketing. Port the web prototype's work queue, ticket priority and service kill-switch | Two backoffices drift | 13 Oct · audit (D8) | open (needs D8) | D8, P20, [ADR-0038][a38] |
| IDEA-160 | CSV export of tables, audit-log export and date-range filters | Export exists only in the web prototype | 13 Oct · run full-audit (admin) | open | — |
| IDEA-161 | Operator account management (create, disable, change permissions) and MFA | The console holds identity documents and child data | 13 Oct · run full-audit (product) | open | — |
| IDEA-162 | Suspension, a system cancel and live-ride intervention | Ops cannot act on a live problem | 13 Oct · audit | open | ADM-18, API-14 |
| IDEA-163 | Ticket page: « Envoyer la réponse » is the primary action, « Résoudre » comes after a reply | It nudges agents to close without answering | 13 Oct · run full-audit (visual) | open | — |
| IDEA-164 | Round-2's ticket model: an explicit decision plus a free-text outcome and a history; keep master's `isTicketClosed`; no preselected « Remboursement accordé » | Richer dispute flow | 14 Oct · run round-2 comparison | open | ADM-13, PRD-14 |
| IDEA-165 | Catalog editor with a reason, expectedVersion, a diff and confirm step, a fare preview, and a city multi-select instead of free-text ids | Governed-change invariant; admins edit live fares blind | 13 Oct · run foundation | open | ADM-09, P12 |
| IDEA-166 | A city launch checklist in the admin (zones, cash provider, categories, places) and city-aware reverse geocoding | A new city cannot take bookings | 13 Oct · audit | open | PRD-26 |
| IDEA-167 | Service zones as polygons, not rectangles around the centre, with a maximum size | Real service areas are not rectangles | 13 Oct · run full-audit (admin) | open | — |
| IDEA-168 | Create a city and its pilot zone in one call | A failure between the two calls leaves a city a retry cannot fix | 13 Oct · run full-audit (admin) | open | — |
| IDEA-169 | The add-city dialog starts empty, not with Casablanca's values | It looks prefilled with demo values | 14 Oct · run real-app | open (e2e S15 relies on the values) | — |
| IDEA-170 | Finance tables with driver names, server pagination and search | Readable money screens | 13 Oct · run full-audit (admin) | open | — |
| IDEA-171 | Real breadcrumbs, table rows as links (middle-click, new tab), one session across tabs | Navigation basics | 13 Oct · run full-audit (admin) | open | — |
| IDEA-172 | Specific copy for 404 and 403, and a neutral « réservé aux rôles habilités » tile for the support role | Every error reads the same | 13 Oct · run full-audit (admin) | open | — |
| IDEA-173 | Console polish: the dynamic-pricing switch says what it does, a plural helper instead of « (s) », tab semantics and a distinct icon for Services, the OSM credit only inside maps | Reads unfinished | 13 Oct · run full-audit (visual) | open | — |
| IDEA-174 | Admin dark mode (round-2's theme) | The mobile apps have it | 14 Oct · run round-2 comparison | open (ADR-0023 keeps admin light for now) | [ADR-0023][a23] |
| IDEA-175 | Create and edit payment providers with adapters (round-2) | Master can only toggle providers | 14 Oct · run round-2 comparison | open | — |
| IDEA-176 | Upload the mock Famille proof images so the admin shows a thumbnail behind « reçue » | « reçue » with nothing to open | 14 Oct · run real-app | open | — |
| IDEA-177 | Data access: hide balances without finance.read, audit every document view, mask document numbers, scope by city later | Least privilege | 13 Oct · audit (smaller calls) | open | API-10, ADM-12, ADM-19 |
| IDEA-178 | Clean internal strings out of the console: the `demo-card` id, `demo.seeded`, `verification.simulated_*`, bot names | ADR-0058 | 14 Oct · chat; run real-app | open | [ADR-0058][a58] |
| IDEA-179 | The admin uses `statusPresentation` for its tones (B12) | Cancelled and pending tones differ from mobile | 15 Oct · redesign audit (R9) | deferred (R9) | RD-13 |
| IDEA-180 | Admin data layer: a query-key factory with targeted invalidation, permissions refreshed from /admin/me on boot and focus, money math from `splitFare`, colours from tokens | Every mutation refetches everything; stale permissions | 13 Oct · run full-audit (admin, domain) | open | — |
| IDEA-181 | Debounced searches with `keepPreviousData`, server-side sorting on paginated tables, a route `errorElement` | Request per keystroke; misleading sorts; English error page | 13 Oct · run full-audit (admin) | open | — |
| IDEA-182 | Accessible primitives: arrow keys in Segmented, a close button on Dialog, Cancel in the catalog editor, error toasts that stay | Keyboard and screen-reader use | 13 Oct · run full-audit (admin) | open | ADM-20 |
| IDEA-183 | Admin scope: desktop only (1024 px and up); « Aujourd'hui » means the Casablanca day | Smaller calls with defaults | 13 Oct · audit (smaller calls) | open | ADM-16 |

## Website

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-184 | Stopgap: no public /backoffice link, noindex, seed dates relative to today | An unprotected backoffice that looked empty | 13 Oct · chat (P20) | done (355c1b1) | P20 |
| IDEA-185 | Seed times relative to now, not only the dates | In the morning, today's rides read as finished | 13 Oct · run foundation | open | — |
| IDEA-186 | A `robots.ts` that disallows /backoffice, or an X-Robots-Tag header | Defence in depth | 13 Oct · run foundation | open | — |
| IDEA-187 | The price estimate from @naya/domain (or labelled indicative); the website on @naya/tokens | Prices and palette drift | 13 Oct · audit (D8) | open | WEB-04, D8 |
| IDEA-188 | Align the landing and FAQ with the apps (child policy, prices, naming, payments), and claim nothing the product does not do (masked numbers, 24 h replies, priority handling) | Public claims must be true | 13 Oct · audit (D12) | open | PRD-30, WEB-14, PRD-23 |
| IDEA-189 | Privacy notice mentions the OSM tile requests; a commercial tile provider before launch | Third-party requests | 13 Oct · audit | open | [ADR-0046][a46] |
| IDEA-190 | Map tiles filtered to the pearl and plum palette, as TileMap does | Full-colour tiles clash | 13 Oct · run full-audit (visual) | open (low while D8 is open) | — |
| IDEA-191 | Backoffice polish: undo for cancel and reject, no 10–11 px text, a card view for tables on mobile | Leftovers from the web UI audit | 13 Oct · run full-audit (web) | deferred (needs D8) | D8 |
| IDEA-192 | Split the 881-line client landing into server components with small client islands | Smaller client bundle | 13 Oct · run full-audit (web) | open (low) | — |
| IDEA-193 | Harden the CSV export (formula neutralisation, revoke the URL later, one Finance export) before anyone copies it | It will be copied into a real export | 13 Oct · run full-audit (web) | open | — |
| IDEA-194 | Remove the dead website code: `.backoffice-link` and `.mobile-backoffice` CSS, an unused modal, a mislabelled icon; extend tsconfig.base; add ESLint | Hygiene | 13 Oct · runs foundation, full-audit (web) | open | QA-06 |
| IDEA-195 | Write down why webpack rather than Turbopack, or try Turbopack | Undocumented choice | 13 Oct · audit | open | — |

## Media and images

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-196 | Onboarding photos of Moroccan women in real Rabat places (Agdal, Hay Riad), plum wardrobe, no logos, a calm lower third for the title, 9:16, women only | Brief task 1: images looked random | 13 Oct · brief; other chat | done (a0b82dc; every slide in 0e62877) | RD-06, [ADR-0048][a48] |
| IDEA-197 | People rule for every image: Moroccan or North African women, light to caramel skin, with and without headscarf, no men, no readable text or logos | The founder's representation rule | 13 Oct · brief | done (applied to every prompt) | [ADR-0048][a48] |
| IDEA-198 | The school-gate photo on passenger slide 3 | Shows Famille at sign-up | 13 Oct · other chat; 15 Oct · chat | done (0e62877) | D3 |
| IDEA-199 | Retitle slide 3 « Vos enfants, accompagnés. », or use the no-child variant if Famille is not advertised | The title says « Une communauté vérifiée » over a child | 13 Oct · other chat; 14 Oct · verification | open (needs D3) | D3 |
| IDEA-200 | Cars as plum and pearl PNG renders in the quote, VehicleImage and the map marker | The cars read as fantasy | 13 Oct · brief (task 6); 15 Oct · chat | done (39fb2d4) | UI-11, [ADR-0025][a25], [ADR-0048][a48] |
| IDEA-201 | Unbranded renders of cars common in Morocco (Dacia Logan and Sandero, Clio, 208…) and in other colours | Brief task 6 | 13 Oct · brief | open | UI-11 |
| IDEA-202 | A pearl top view for the map marker | Pearl drivers show a plum car on the map | 15 Oct · run images | open (optional) | O5 |
| IDEA-203 | Regenerate the Famille pick-up with the rear door open and warm pearl paint | The image shows the front door and cool white paint | 15 Oct · run images | open (optional) | O5 |
| IDEA-204 | Rebuild the vehicle-document fixtures from the new renders | The admin still shows the old car art | 15 Oct · run images | deferred (the capture checklist asks for a visible plate) | — |
| IDEA-205 | Raise the mock-photo budget to 250–300 KB so every photo can use q82 | Dust texture compresses badly | 15 Oct · run images | open (optional) | — |
| IDEA-206 | Smooth the blank plate recess on the plum car | Cleaner render | 15 Oct · run images | open (optional) | — |
| IDEA-207 | Licensed or commissioned real photos later; generated photos are placeholders | Long-term media policy | 13 Oct · audit (D11); 15 Oct · chat | open | D11 |
| IDEA-208 | Capture the client's logo choice by a fixed date | Six concepts, no choice | 13 Oct · audit (D11) | open | D11, VIS-18 |
| IDEA-209 | Archive the unused PNGs (about 5–7 MB in the apps, 13 MB on the website); each app ships only the photos it uses | Bundle and repo weight | 13 Oct · audit; 14 Oct · verification | open | DOM-14, VIS-20 |
| IDEA-210 | Own art for empty states | Every empty state shares one journey glyph | 13 Oct · run full-audit (visual) | open | VIS-27 |
| IDEA-211 | Keep "Naya …" for service categories; use realistic makes in seed vehicles | "Naya Signature" is a category, a car and a render | 13 Oct · run full-audit (product) | open | — |
| IDEA-212 | Image prompt pack: AVB method, 2–4 role-locked Pexels references per image, attach order, export sizes, a QC checklist, README, CREDITS | Owner generates the images himself | 15 Oct · chat | done (delivered as a zip outside the repo) | [image results][results] |
| IDEA-213 | Seven prompts (3 cars, 2 car-wash photos, 2 onboarding photos) plus 2 Famille mock-photo prompts | Same | 14 Oct · chat | done | [image prompts][prompts] |

## Backend and API

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-214 | Production backend that keeps Hono and the packages/api contract, on managed Postgres with row locks for offer acceptance | Production path | 13 Oct · audit (D10) | open (needs D10) | D10, PRD-08, [ADR-0045][a45] |
| IDEA-215 | Promote the "prototype" layer into domain modules with state machines, tests and schemas in packages/domain (same limits on both sides) | A side module bypasses the domain | 13 Oct · audit (Option C) | open | PRD-36, DOC-16, [ADR-0039][a39] |
| IDEA-216 | A hosted shared demo API for cross-role demos. The embedded backend ships only in demo builds, with `VITE_DEMO` gating and no production sourcemaps. Demo flags fail closed, and dev mode is explicit | Standalone builds cannot show the cross-app loops; demo is on by default | 13 Oct · audit (D9) | open (needs D9) | D9, P9, QA-12, UI-04, UI-10, [ADR-0044][a44] |
| IDEA-217 | Idempotency-Key on every remaining booking, money, Famille and SOS mutation: driver complete and cash-collected, Famille actions, SOS actions, admin alerts, scheduled edit and cancel, car-wash rating, and ticket, message, child, zone and place creation | AGENTS invariant | 13 Oct · run foundation; 14 Oct · verification; 15 Oct · run polish | open | CW-12, [ADR-0053][a53], [ADR-0009][a09] |
| IDEA-218 | Pass mutation payloads as `run()` variables (quote booking, cancel sheet) | A changed payload reuses the key and gets a 409 | 15 Oct · run polish | open | [ADR-0053][a53] |
| IDEA-219 | When porting: store the idempotency record in the same transaction, unique on (subject, key), with a canonical body hash | The demo pattern must not be copied to Postgres as is | 13 Oct · run full-audit (demo-api) | open | [ADR-0053][a53] |
| IDEA-220 | A request-body limit before parsing, multipart or pre-signed uploads, a per-user quota | Base64 uploads inside JSON | 13 Oct · run full-audit (demo-api) | open | UI-15 |
| IDEA-221 | Production auth hardening: OTP caps per day, IP and prefix, a salted hash, real SMS; no seeded admin passwords when NAYA_DEV=0, lockout, forced password change | Needed once anything is hosted | 13 Oct · run full-audit (demo-api) | open | [ADR-0021][a21], [ADR-0044][a44] |
| IDEA-222 | Any 6-digit code works only in mock mode; a real backend checks the code | Otherwise a phone number alone opens an account | 14 Oct · chat | done (927137e) | [ADR-0058][a58] |
| IDEA-223 | Skip admin seeding (pure-JS scrypt) in embedded builds, or precompute the hashes | Slower first launch and resets | 13 Oct · run full-audit (demo-api) | open | — |
| IDEA-224 | Validate every request body with `body()` and a schema (13 raw `c.req.json()` calls) | Bad JSON gives 500 instead of 422 | 13 Oct · runs full-audit, foundation | open | — |
| IDEA-225 | Dedicated error codes: location not shared, insufficient balance, Famille quota, wrong handover code, used quote | Clients match French text | 13 Oct · runs full-audit, foundation | open (some Famille codes added) | — |
| IDEA-226 | One shared list of active-ride statuses; the location check moves into rides.ts | The list is repeated three times | 13 Oct · run foundation | open | — |
| IDEA-227 | Ticket outcomes as one domain enum used by the admin and the server | Two copies drift | 13 Oct · chat; run foundation | open | ADM-13 |
| IDEA-228 | GET handlers stop writing state | Reads that write, outside a transaction | 13 Oct · audit | open | API-19 |
| IDEA-229 | Store migrations, or at least a log, instead of a silent reseed | A reseed wipes testers' data | 13 Oct · audit | open | API-21, [ADR-0029][a29] |
| IDEA-230 | Backfill new admin permissions instead of the `config.edit` fallback for safety.respond | The fallback is a stopgap | 13 Oct · run foundation | open | — |
| IDEA-231 | A city service-hours rule enforced on the server | The server accepts 00:00–04:59 | 15 Oct · run polish | open | PAX-07 |
| IDEA-232 | Quotes refuse a city other than the user's; changing the city on /me writes an audit event (ADR-0054 steps 3–4) | City source of truth | 15 Oct · run polish | open | PAX-05, API-12, [ADR-0054][a54] |
| IDEA-233 | A server notification service (push and inbox) that honours preferences and renders Famille events | Preferences are stored but unused | 13 Oct · audit | open | PRD-31 |
| IDEA-234 | A distinct reason code (or none) for free passenger cancellations | Every free cancel is stored as « Autre raison » | 15 Oct · run redesign | open | — |
| IDEA-235 | A real `deleted` account status (or deletedAt) instead of `suspended` named « Compte supprimé » | The admin shows « Suspendue » | 15 Oct · run polish | open (owner call) | [ADR-0055][a55] |
| IDEA-236 | Query keys only through `qk`: passenger wallet, SOS, catalog, quote, reverse geocode | AGENTS invariant | 13 Oct · run full-audit; 14–15 Oct · runs real-app, polish | open | UI-18 |
| IDEA-237 | Scope polling: stop on settled receipts and final verification states; poll only while focused | Battery and data on a real backend | 13 Oct · run full-audit | open | — |
| IDEA-238 | API client: a per-call timeout and a TIMEOUT code; clock skew from the fastest round trip; typed prototype methods (Centimes) | Uploads share a 15 s timeout | 13 Oct · run full-audit (domain) | open | — |
| IDEA-239 | Normalise IsoUtc (or compare with Date.parse); hoist the Intl formatter out of `casablancaOffsetMinutes` | Correctness; speed on Hermes | 13 Oct · run full-audit; 15 Oct · run polish | open | — |
| IDEA-240 | Share response types between the server and the client | Types drift | 13 Oct · audit | open | DOM-10 |
| IDEA-241 | A lighter store: no deep clone of the whole state per transaction; a bounded idempotency cache | The standalone bot grows the state every 30 s | 13 Oct · audit | open | API-20 |
| IDEA-242 | Small cleanups: delete or validate the unused licence and Famille verification PUT routes; one exported MIME table; `balance` on WashPaymentOption | Dead and duplicated code | 14 Oct · verification; 15 Oct · run polish | open | — |

## Testing and QA

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-243 | Dark e2e project: colorScheme dark, a contrast script that fails below 4.5:1, screenshot baselines for key screens in both schemes, one theme-switch spec | Regression net for dark mode | 13 Oct · run foundation; 15 Oct · run dark-audit | deferred | DM-20 |
| IDEA-244 | Token-pair contrast tests (text 4.5, outlines 3, thumb lighter than track) | A palette change cannot silently fail AA | 13 Oct · run full-audit (visual); 15 Oct · run dark-audit | done in part (palette.test.tsx in 7f5ecde, segmented.test.tsx) | O4 |
| IDEA-245 | Move the scratch theme probes into the repo: a light → dark → light switch through NativeWind's wrapper, and a dark render of the real passenger Home | The guard test has no real screen | 15 Oct · run dark-audit | open | — |
| IDEA-246 | A test script for packages/tokens | `pnpm --filter @naya/tokens test` does nothing | 15 Oct · run dark-fixes | open | UI-19 |
| IDEA-247 | Native device pass. Check: the live document camera, onboarding photos, Famille on two devices, Android marker rotation, SOS haptics, the background-location explainer, real Dynamic Type, the dark splash, native shadows, Hermes fr-MA dates and randomUUID | Everything so far ran on Expo web; nothing ran on a phone; Android was never built | 13 Oct · audit; 14 Oct · verification; 15 Oct · runs redesign, images | open | DM-02, DM-13 |
| IDEA-248 | Background-location lifecycle on a dev build: lock the phone, cancel while locked, swipe-kill, relaunch | P4 was verified by reading code | 13 Oct · run foundation | open | P4 |
| IDEA-249 | e2e for ride → home → resume → completion → receipt | PAX-15 has no regression test | 13 Oct · run full-audit (passenger) | open | PAX-15 |
| IDEA-250 | Wallet tests: a pending withdrawal plus commissions past the debt limit, what a limit of 0 means, a wallet ride whose cancel fee exceeds the balance | Money edge cases | 13 Oct · run full-audit (domain); 15 Oct · run polish | open | — |
| IDEA-251 | Pricing tests with grace periods of 0, 90 and 1800 s | Checks the fee copy | 13 Oct · run full-audit (domain) | open | — |
| IDEA-252 | A test for a contradictory provider outcome on a ride payment | Money-path gap | 13 Oct · run foundation | open | — |
| IDEA-253 | Authorization-matrix tests and tests with NAYA_DEV=0 | The harness always runs in dev mode | 13 Oct · audit | open | API-23 |
| IDEA-254 | A test that a Casablanca category quote applies the right commission | Only the no-category path is tested | 13 Oct · audit | open | PRD-04, P8 |
| IDEA-255 | Unit tests: driver app, Famille, car-wash and wallet screens, admin, time, phone and geo helpers | Only e2e and API scenarios cover them | 13 Oct · audit; 15 Oct · chat (mobile task list 44) | open | DRV-18, PAX-13, ADM-23, UI-19, DOM-09 |
| IDEA-256 | Kit tests by accessibility label, the wallet test on the shipping WalletCard, the WelcomeJourney photo branch, car-wash photo pairing and placeholders, useCityId | Gaps found by several reviewers | 13–15 Oct · runs full-audit, verify, redesign, polish | open | — |
| IDEA-257 | Split the monolithic feedback e2e; write screenshots to `testInfo.outputPath()`, not /tmp; close the SOS sheet through the UI | One 240 s test | 13 Oct · run full-audit (quality); 14 Oct · verification | open | — |
| IDEA-258 | Simplify the car-wash e2e "book tomorrow" workaround | « Maintenant » now switches by itself | 15 Oct · run polish | open | CW-04 |
| IDEA-259 | Dev scenarios that survive deleting the seeded passenger (look her up by id; specs that delete her reset afterwards) | /dev/family/play and the bot break | 15 Oct · run polish | open | — |
| IDEA-260 | Re-run expo-doctor, `expo install --check` and `pnpm peers check`, and log the results | Last run 30 Sep | 13 Oct · run full-audit (quality) | open | — |
| IDEA-261 | Capture native screens from the real build with `simctl status_bar override` | The side-loaded copies show a breadcrumb and an old bundle | 13 Oct · run full-audit (visual) | open | DM-01, VIS-21 |
| IDEA-262 | Capture the states the harness never reached: later Famille states, ride-end card states, identity capture, dynamic pricing, car-wash team en route, push, the dark Famille proofs, the admin MiniMap | The redesign changed them with no before/after evidence | 15 Oct · runs prompt-pack, images | open | VIS-06 |
| IDEA-263 | A browser pass of the website at 375, 768, 1024 and 1440 px, plus Lighthouse | Never done | 13 Oct · run full-audit (web) | open | — |
| IDEA-264 | Run actionlint on ci.yml and render the Mermaid diagrams | Both checked by eye only | 13 Oct · run foundation | open | — |
| IDEA-265 | An e2e globalSetup that warms Metro, if CI retries keep hiding cold-bundle timeouts | First test pays the bundle time | 13 Oct · run foundation | open (only if needed) | — |
| IDEA-266 | Run `e2e/scripts/driver-review.mjs` once after the flow changes; trace the jest worker that fails to exit | Unverified script; an open handle | 14 Oct · run real-app | open | — |
| IDEA-267 | Round-2 lands only when CI-green (keyboard-controller mock, Button test, lint); keep master's keyboard-typing P3 e2e | Its suites do not run; its e2e hides P3 | 14 Oct · run round-2 comparison | open | QA-02 |
| IDEA-268 | e2e and capture selectors on testIDs, not status text | The redesign hides status words | 15 Oct · redesign audit | done (820a87e, 0c7bdd3, 87282c3, e07ef01, d50e2c7) | RD-18 |
| IDEA-269 | e2e starts its own servers and can run beside a live stack on other ports | Four servers by hand | 13 Oct · audit | done (083db77, 83b719f) | QA-14 |
| IDEA-270 | Append verification-log rows from CI or a script | The hand-written log drifted before | 13 Oct · run full-audit (docs) | open | DOC-21 |

## Docs and knowledge

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-271 | Docs foundation: root AGENTS.md and CLAUDE.md, per-app guides, a docs index, ADRs, specs, status, runbooks, glossary, verification log | Every new chat starts with the full picture | 13 Oct · chat (Option A) | done (87f801d) | DOC-01, DOC-04 |
| IDEA-272 | A generated API reference with a `--check` in CI | Agents look things up instead of searching | 13 Oct · chat (source-control article) | done (87f801d, 083db77) | DOC-21 |
| IDEA-273 | Generate the SCREENS.md route table from the `src/app` trees, with a drift check | It drifted by 9 routes in one week | 13 Oct · run full-audit (docs) | open | DOC-09 |
| IDEA-274 | Commit the `_handoff` text to docs/handoff with a « superseded » banner and a summary of the feedback PDF. Precedence: ADRs, then specs, then handoff and Figma, then the PDF | The source of truth must be versioned | 13 Oct · audit (D14) | open (needs D14) | D14, DOC-02, [ADR-0056][a56] |
| IDEA-275 | An account-deletion spec: blockers, what is erased, kept and cancelled | The rules live only in code | 15 Oct · run polish | open | [ADR-0055][a55] |
| IDEA-276 | A theming section (in DESIGN.md or a spec) covering outline, line and hairline, thumb, inverse on accent, on-media whites, and also dark mode, the logo, the photos, the car PNGs and the status icons | DESIGN.md contradicts the product | 15 Oct · runs polish, dark-fixes, images | open | DOC-14, VIS-05 |
| IDEA-277 | The spec updates the redesign asked for: money screens, dossier and sign-up, car-wash photos and « Conditions », ride flow | Definition of done, item 2 | 15 Oct · run redesign | open | — |
| IDEA-278 | Re-check the specs against the code: family R11–R16 and the bot's retry and hand-back, the « none of this is built » line, eligibility R8 (cite functions, not line numbers), the licence fields, the SOS R10 quotes | Specs written before the rewrites | 14 Oct · chat; runs blockers, real-app; other chat | open | [family spec][s-family], [eligibility spec][s-elig], [SOS spec][s-sos] |
| IDEA-279 | integrations.md rows for the WhatsApp hand-off, the follow link, the Famille GPS simulation and the simulated car-wash team | Definition of done: new simulation goes there | 14 Oct · verification | open | [integrations](integrations.md) |
| IDEA-280 | Import the remaining 14 Oct findings (PH-, FS-, DS-, CW-) as backlog rows | An audit can never change status | 14 Oct · verification; run blockers | open | [verification][verif] |
| IDEA-281 | Write the pending ADRs: the Famille WhatsApp exception (F4), criminal record for Famille only (F3), the follow-link policy, ADR-0036 updates where code differs, a car-wash ADR | Code contradicts the ADRs | 14 Oct · verification | open | F3, F4, [ADR-0031][a31], [ADR-0034][a34], [ADR-0036][a36] |
| IDEA-282 | Cross-link partial supersessions between ADRs (0031 and 0036, 0029 and 0039, 0025 and 0048, 0027 and 0050) and fix the citations of the deleted INTEGRATIONS.md | Accepted ADRs don't say they may be superseded | 13 Oct · run foundation | open | — |
| IDEA-283 | After each merge, replace branch-name statuses with commits, re-pin spec line references, drop "fixed on this branch" notes | Statuses must point at commits | 13 Oct · run foundation | open | — |
| IDEA-284 | A data-model reference (docs/architecture/data-model.md) | The architecture docs lack it | 13 Oct · audit | open | DOC-15 |
| IDEA-285 | A privacy and data-protection doc (CNDP law 09-08) and a safety-operations runbook | The product stores IDs, child data and journey evidence | 13 Oct · audit | open | DOC-22 |
| IDEA-286 | Split FINANCE.md into driver-wallet, passenger-wallet and payments specs | Partly wrong today | 13 Oct · audit | open | DOC-08 |
| IDEA-287 | Record the prompt for image 10 (school gate) | It cannot be regenerated or audited | 15 Oct · run images | open | [image results][results] |
| IDEA-288 | Document the capture scripts in e2e/scripts and the review hook (/dev/navigate) | Agents rebuild tooling | 13 Oct · run full-audit (docs, ui-kit) | open | — |
| IDEA-289 | Add the missing gotchas to AGENTS.md. Theming: themedStyles is lazy and cached per scheme. Tests: jest treats a path as a regex; ENOSPC needs TMPDIR on the data volume; a cold vitest run times out on a new worktree. e2e: use getByRole for a collapsed title; two toast layers exist while a sheet is open. Docs: register new helpers in the generator's INTRINSICS; the repo map lacks famille.ts, signup.ts and carWash.ts; cite the ADR template's conventions | Each one cost an agent time | 13–15 Oct · runs foundation, verify, blockers, polish, dark-fixes, redesign | open | [AGENTS.md][agents] |
| IDEA-290 | Pin audit evidence to a commit hash | Line numbers rot | 13 Oct · run full-audit (docs) | open | — |
| IDEA-291 | Status hygiene, part 1. Correct the stale backlog rows UI-03, PRD-28, PRD-40, QA-05, ADM-19 and API-05, and re-check PRD-17 and VIS-01, 12, 13 and 14 | Rows that drift from the code mislead the next session | 13–15 Oct · several runs | open | [backlog](backlog.md) |
| IDEA-292 | Status hygiene, part 2. Mark F1, D11 and D14 as partly answered. Remove two items: the refuted EAS localhost claim in two runbooks, and the build numbers written in STANDALONE-DEMO prose | Same | 13–15 Oct · several runs | open | [open questions](open-questions.md) |
| IDEA-293 | Status hygiene, part 3. List the 14 Oct verification in the docs index. Keep one current set of apps/web/review captures | Same | 13–15 Oct · several runs | open | — |
| IDEA-294 | Keep the redesign audit's "before" screenshots, or note that they are lost | They sat in a temporary scratch folder | 15 Oct · run prompt-pack | open | [redesign audit][redesign] |
| IDEA-295 | Record the /brand dark-mode choice (the tile shows the light preview) | Undocumented choice | 15 Oct · run polish | open | — |
| IDEA-296 | Save the reusable planning prompt for a new app (8 phases, Naya's 10 guardrails) somewhere durable | It exists only in the chat | 13 Oct · chat | open | — |
| IDEA-297 | Turn the audit into a shareable web page for the team or the client | Easier to read than Markdown | 13 Oct · chat | open (no answer) | [audit][audit] |
| IDEA-298 | Record whether builds 3/4 and 4/5 were uploaded, and log every upload | No release history | 13 Oct · run foundation | open | [ADR-0049][a49] |
| IDEA-299 | Docs in English, UI copy in French | One rule for agents | 13 Oct · audit (D14) | done (AGENTS rule) | D14 |

## Process and tooling

Git, CI, PR review and the lessons of the source-control article.

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-300 | Stay on git and GitHub, and keep five lessons from Anthropic's source-control article: guard the core rules, review for intent, review risky paths more strictly, give agents fast lookups, keep the repo light | Fits a two-person team | 13 Oct · chat (article) | done | [ADR-0057][a57] |
| IDEA-301 | A PR template that opens with Intent and links the spec or ADR | Review for intent | 13 Oct · chat (article) | done (083db77) | [ADR-0057][a57] |
| IDEA-302 | CODEOWNERS on money, safety and admin-permission code (copy and style changes not gated) | Stricter review where it matters | 13 Oct · chat (article) | done (083db77); the second developer's handle is still to add | [ADR-0057][a57] |
| IDEA-303 | CI on every PR and push to master: frozen install, typecheck, unit tests, lint, admin build, API reference check | There was no CI | 13 Oct · audit (Option B) | done (083db77); the first GitHub run was not checked yet | QA-02, [ADR-0057][a57] |
| IDEA-304 | Protect master; one branch and one PR per change, with required CI, agreed with the second developer | Both pushed to master; the lockfile stayed broken for 5.5 h | 13 Oct · audit (D13) | open (needs D13) | D13, QA-02, [ADR-0057][a57] |
| IDEA-305 | CI housekeeping: shared setup steps, newer action versions, a root `docs:api` script | Maintainability | 13 Oct · run foundation | open | — |
| IDEA-306 | Move the repo to a path without spaces | The regex plugin can break on every SDK upgrade | 13 Oct · audit (D15) | open (needs D15) | D15, [ADR-0050][a50] |
| IDEA-307 | Git LFS for new screenshots; rewrite history only with the second developer's agreement | 95 % of history is images | 13 Oct · audit (D15); chat (article) | open (needs D15) | D15, QA-07, [ADR-0052][a52] |
| IDEA-308 | Commit the capture scripts, not the PNGs (R14) | Captures stay reproducible without repo weight | 15 Oct · redesign audit (R14) | done (7873a9c) | [ADR-0052][a52] |
| IDEA-309 | One source for build numbers, and every upload in the build log | Numbers differed in three places | 13 Oct · audit (D13) | done in part (build log exists); ADR-0049 is open | [ADR-0049][a49] |
| IDEA-310 | apps/web managed by pnpm only | Two lockfiles | 13 Oct · audit | open | QA-08, [ADR-0051][a51] |
| IDEA-311 | A root Prettier and EditorConfig; lint packages/ui, the admin and the API | 22 errors hidden outside the Expo apps | 13 Oct · audit | open | DOC-17, QA-06 |
| IDEA-312 | Declare undeclared dependencies (driver eslint, e2e typescript, the kit's 29); drop unused ones (expo-device, expo-task-manager in passenger) | Hoisting hides them | 13 Oct · run full-audit (quality) | open | QA-11 |
| IDEA-313 | Work order: housekeeping, docs foundation, decision-free fixes in parallel, a decision session, then the roadmap | Docs first so every chat has context | 13 Oct · audit | done for the docs and fixes; the roadmap waits on the decisions | [audit][audit] |
| IDEA-314 | A one-hour decision session on D1–D15 (D1, D2, D3, D5 and D6 first) | Unblocks most open fixes | 13 Oct · audit; 15 Oct · chat | open | [open questions](open-questions.md) |
| IDEA-315 | Merge feat/passenger-polish into master and push before the next build; passenger build 4 → 5, driver 5 → 6 | A build must match a GitHub commit | 15–16 Oct · chat | planned (waiting for the owner's go) | [ADR-0049][a49] |
| IDEA-316 | Round-2 lands after master. Its author merges master into it, makes CI pass and drops its Famille routes and timers (they shadow master's). Its features then come back as separate PRs | Merging it as it is would undo safety fixes | 14 Oct · run round-2 comparison; 15 Oct · chat | open | QA-02 |
| IDEA-317 | Clean up merged branches, worktrees and the old stash | Clutter | 14–15 Oct · chat | open | — |
| IDEA-318 | Move `achref-dev-skill-debt/` and its zip out of the repo; ignore `*.zip` | 26 MB unrelated to Naya | 13 Oct · chat | open (owner) | — |
| IDEA-319 | Parallel agents on disjoint files, a reviewer per area, gates and e2e on alternate ports, local commits only | Speed without collisions | 13–15 Oct · chat | done (used since 13 Oct) | — |
| IDEA-320 | Fold small fixes into the batch that already owns the file | Each file edited once | 15 Oct · chat | done | — |
| IDEA-321 | No second session edits code while a run or e2e is going; each agent gets its own scratch tools folder | A live reload flaked e2e; parallel agents overwrote QC scripts | 13 Oct · chat; 15 Oct · runs polish, images | open | — |
| IDEA-322 | Every commit builds: no broken intermediate commits in merged branches | `git bisect` fails across famille-safety and the redesign | 14 Oct · verification (FS-17); 15 Oct · run redesign | open | — |
| IDEA-323 | Copy deliverables out of the session scratchpad at once, and send prompts in the chat, not only in repo files | The scratchpad is cleared on restart; the owner works from the chat | 14–16 Oct · chat | done (habit) | — |
| IDEA-324 | Judge dark mode only on the Metro-backed « Naya » app; delete the side-loaded « Naya Feedback » copies | A stale 6 Oct bundle misled the review | 15 Oct · run dark-audit | done (AGENTS gotcha); deleting the copies is the owner's job | DM-01 |
| IDEA-325 | A dark-mode checklist in the PR template: seen in dark, no new hex literal, no colours outside render, no `inverse` off accent | Review discipline | 15 Oct · run dark-audit | deferred | DM-20 |

## Business and legal

| ID | Idea | Why | Source | Status | Link |
|---|---|---|---|---|---|
| IDEA-326 | Engage Moroccan counsel now: CNDP law 09-08, transport licensing, the women-only basis, minors, the wallet | Longest lead time | 13 Oct · audit | open | D10 |
| IDEA-327 | Women-only eligibility. The reviewer checks the ID and ticks a mandatory eligibility item, and there is an appeal path. Nothing is inferred from appearance | Core rule, undefined | 13 Oct · audit (D1) | open (needs D1) | D1, PRD-34, [ADR-0034][a34] |
| IDEA-328 | Naya Famille at launch: kept out behind a flag (audit default), or rides with a family flag (ADR-0036) | Safety and legal weight | 13 Oct · audit (D3) | open (needs D3) | D3, [ADR-0036][a36] |
| IDEA-329 | Categories: Standard and Confort, Scooter dropped; a vehicle type decides eligibility, and no category until approval | Scooter rides went to cars | 13 Oct · audit (D4) | open (needs D4) | D4, PRD-07, P17, [ADR-0043][a43] |
| IDEA-330 | Android in the launch scope | Most phones in Morocco run Android | 13 Oct · audit (D10) | open (needs D10) | D10 |
| IDEA-331 | Phone-code sign-in only for v1; Apple and Google later (the Apple button is a stub behind a flag) | Scope | 13 Oct · audit (smaller calls) | open | — |
| IDEA-332 | Live integrations: SMS, payment provider, push, number masking, KYC storage, a safety desk | Nothing real answers today | 13 Oct · audit (Option C) | open | PRD-08, [ADR-0045][a45] |
| IDEA-333 | Terms of use and privacy texts, reachable while signed out | The consent line cites documents that do not exist | 15 Oct · run redesign | open | O6, PAX-18 |
| IDEA-334 | Receipts as fiscal invoices (number, legal mentions, category) | Business riders and Moroccan tax rules | 13 Oct · run full-audit (product) | open | PRD-16 |
| IDEA-335 | Criminal-record extract for Famille drivers only, with a consent notice, legal basis, retention, access rules and a re-check cadence | Founder answer F3 differs from ADR-0034 | 13 Oct · brief; 14 Oct · verification (DS-3) | open | F3, [ADR-0034][a34] |
| IDEA-336 | A production map tile provider | OSM tiles are not for production use | 13 Oct · audit | open | [ADR-0046][a46] |
| IDEA-337 | A Naya case study on the Progix site (a cleaned 67 s video, no personal data or demo badges) | Portfolio | 13 Oct · other chat | done (in the Progix repo) | — |

## Rejected alternatives

Do not propose these again without new facts. The second table lists findings that skeptics refuted or downgraded,
so nobody files them again.

| What | Why rejected | Date | Source |
|---|---|---|---|
| A different version-control system (Scion-style), merge queues, agents monitoring production | They pay off only at Anthropic's scale or with a real backend; Naya has 2 people and a small history | 13 Oct | chat (source-control article) |
| Merge orders A (round-2 first), B (our branch first as one 52-file merge) and C from the round-2 memo | Master was fast-forwarded to the integration trial on 15 Oct instead; round-2 was not CI-green | 14–15 Oct | run round-2 comparison; chat |
| Merging feat/famille-safety on its own | It dropped the P1 lock (5 wrong codes) and the code-free driver view; only the integration trial was merged | 14 Oct | verification |
| Committing the main checkout first and restarting the three feature agents on top of it | Not chosen; the branches were merged later in the trial | 13 Oct | other chat |
| Round-2's Famille engine (linear steps, driver starts the trip herself, optional pick-up photo, no drop-off photo, geofence or code lock) | The fork's engine is safer and matches the brief and founder answers 2–4 | 14 Oct | run round-2 comparison |
| Round-2's SOS desk (/securite, any-to-any statuses, canned notes) | Weaker governance than master's /sos with forward-only states, an owner and a required note | 14 Oct | run round-2 comparison |
| Round-2's driver dossier (visual redesign of the 7-document model) | The fork's 30-step sign-up with 15 document types and Famille vetting follows brief task 2 item by item | 14 Oct | run round-2 comparison |
| Round-2's Pexels stock photos in a full-bleed onboarding layout | They break the brief (US street, readable signs, a forest, casting outside the rules) and show real people; master keeps generated photos with the title below | 14 Oct | run round-2 comparison |
| Round-2's switch from lucide to iconsax | It breaks every new master file, glyphs are missing, the package is very young | 14 Oct | run round-2 comparison |
| Round-2's vector « spots » replacing all generated imagery (and deleting the car PNGs) | The brief asks for generated images; ADR-0025 and ADR-0048 were updated for photos and car renders | 14–15 Oct | run round-2 comparison; chat |
| Audit default "vector art and initials everywhere" | Set aside for onboarding photos and car renders after the brief and the owner's images | 13–15 Oct | run foundation (ADR-0048); chat |
| A 4th passenger slide for Naya Famille | Owner: "just replace slide 3" | 13 Oct | other chat |
| In-app (WebRTC) or FaceTime-style video call between parent and driver | Owner chose a WhatsApp call after parent confirmation (F4) | 13 Oct | brief |
| Opening WhatsApp for Famille calls in mock builds | Mock numbers could belong to real people; the call is noted on the trip instead | 14 Oct | run real-app |
| Sign-in code as a local notification or an SMS-style in-app card | Replaced the same day by « any 6-digit code » (owner) | 14 Oct | chat; runs real-app, any-code |
| Any 6-digit code on a real backend | Anyone knowing a phone number could sign in; any-code is for mock mode only | 14 Oct | chat |
| Keeping « Démo · examen simulé » and « Réviseuse de démonstration » for the system reviewer | No demo wording (ADR-0058); renamed « Vérification automatique » | 14 Oct | run any-code |
| Not dialling the real 19 in demo builds | Someone may really need it; the 19 call stays real (ADR-0058) | 14 Oct | run verify (skeptic) |
| Removing the « démonstration » wording from apps/web | Its booking is not backed by any API, so the wording is true | 14 Oct | run real-app |
| Removing « SPÉCIMEN · FICTIF » from fixture identity documents | Fabricated IDs must stay marked, even under ADR-0058 | 14 Oct | run real-app |
| A « Production » badge on live payment providers only | It implies the others are not real; « Identifiants manquants » marks a live provider instead | 14 Oct | run real-app |
| Renaming the seeded admin login addresses | Breaks the admin login, the test harness and e2e; they are never displayed | 14 Oct | run real-app |
| Changing the seeded test card endings and the 0000 payout account | They are deterministic test hooks that tests, e2e and rides.ts route on; the UI never mentions them | 14 Oct | run real-app |
| Bumping `schemaVersion` (to give admins safety.respond, or to clear old demo labels) | It wipes testers' on-device data; a config.edit fallback and a documented reset are used instead | 13–14 Oct | runs foundation, real-app |
| A one-time migration of the website seed dates | It would go stale again the next day; seeds are re-dated from the seed record on every load | 13 Oct | run foundation |
| `"type": "module"` in apps/web/package.json | It can break CommonJS config files | 13 Oct | run foundation |
| De-duplicating payment providers by id | The driver testID is per kind; the rule is one card provider per city | 13 Oct | run foundation |
| A STANDALONE_DEMO guard on stopRideTracking | A task registered by an earlier dev build must still be cleaned up | 13 Oct | run foundation |
| A toast when the tel:19 call fails | Toasts rendered behind modal sheets; Alert.alert is used | 13 Oct | run foundation |
| Dropping the « 15 » emergency label | Reverted to the audit default: offer 19 and 177, relabel 15 « Protection civile » until local ops confirm | 13 Oct | run foundation |
| Adding 141 (SAMU) | Not in the confirmed list; ADR-0035 has it "to confirm" | 15 Oct | run polish |
| Keying the whole navigator on the colour scheme to force a remount | Every switch would lose drafts, open sheets, scroll, the map camera and pending mutations (double-submit risk). It would also fire during iOS app-switcher snapshots and would not fix colours captured at import | 15 Oct | run dark-audit |
| A ThemeContext or NativeWind dark variants | Kept the colours Proxy with useTheme() and themedStyles() (ADR-0023) | 13 Oct | audit |
| Making `frostShadow` or `frostOutline` a Proxy, or reassigning the export on scheme change | React Native skips a style object it has seen, and Metro copies exports; a fixed shadow and a spread getter are used | 15 Oct | run dark-audit |
| An `onMedia` token for text on camera and photos | Fixed white was used instead | 15 Oct | run dark-fixes |
| One SegmentedControl track token for both schemes | No single token works in both; the track picks its token by scheme | 15 Oct | run dark-fixes |
| A darker switch thumb in dark mode | The light thumb follows iOS convention; the track has 9.37:1 against the surface | 15 Oct | run polish |
| FullWindowOverlay to show toasts above native route modals | Risky for VoiceOver and stacking with Modals; a ToastLayer per screen is preferred | 15 Oct | run polish |
| A separate SOS help topic | Folded into « SOS et sécurité » so two safety topics do not overlap | 15 Oct | run polish |
| An ADR for account deletion | The rules fit a spec; ADR-0055 covers the policy (the spec is still to write, IDEA-275) | 15 Oct | run polish |
| A second confirmation modal to delete a payment method | On iOS a modal opened while another closes gets dropped; confirmation stays inside the « ⋯ » sheet | 15 Oct | run redesign |
| R1 (b): glyph and word everywhere, smaller | The glyph stands alone in rows; words stay on heroes and problems | 15 Oct | redesign audit |
| R2 (b): 44 pt for every main button | Booking and driver decisions keep 50 pt | 15 Oct | redesign audit |
| R3 (b): tones chosen per screen | One tone per state | 15 Oct | redesign audit |
| R4 (b): the logo gallery as a dev-mode-only account row | Removed from accounts; /brand is reachable from the dev launcher | 15 Oct | redesign audit |
| R6 (b): keeping the itinerary step | Search goes straight to the quote | 15 Oct | redesign audit |
| R7 (b): separate Famille and Lavage tiles on home | One services rail; the driver's car-wash cross-sell moved to Compte | 15 Oct | redesign audit |
| R8 (b): one « bientôt disponibles » line for call and message | Hidden until they work | 15 Oct | redesign audit |
| R9 (b): admin status icons in this round | Deferred to RD-13 | 15 Oct | redesign audit |
| R10 (b): tap then a confirm dialog for SOS | Hold 1.5 s with a progress fill | 15 Oct | redesign audit |
| R11 (b): « Paiement annulé » for a failed wallet debit | « Montant libéré · rien n'a été débité » says what happened | 15 Oct | redesign audit |
| R12 (b): a disabled « Passer en ligne » with a reason | Show the unblocking action | 15 Oct | redesign audit |
| R13 (b): a before/after slider for car-wash photos | One row per angle | 15 Oct | redesign audit |
| R14 (b, c): committing both scripts and PNGs, or neither | Scripts only (ADR-0052) | 15 Oct | redesign audit |
| R15 (b): folding redesign rows into PAX-, DRV- and UI- | Their own RD- prefix | 15 Oct | redesign audit |
| R16 (b): keeping a disabled « Vérifier » button | Auto-submit at the 6th digit | 15 Oct | redesign audit |
| R17: slide-to-confirm for « Commencer » and « Terminer » | "Not now"; the buttons stay | 15 Oct | redesign audit |
| R18 (b): no earnings chart | One simple bar chart without a library | 15 Oct | redesign audit |
| A single-colour pearl car | The two-tone plum roof reads better on the light background | 15 Oct | runs prompt-pack, images |
| A car colour per fare tier on the quote | Colour does not imply a tier; every category shows the pearl car | 15 Oct | run images |
| expo-image for the map marker, and view rotation on Android | react-native-maps documents `Image`; the frozen snapshot left the heading stale; Android uses the marker's native rotation | 15 Oct | run images |
| Automatic fills to remove phone bumps and a parasol from photos | They left smudges; a manual fill was used | 15 Oct | run images |
| Pexels references with men, fair or blonde subjects, watermarks, readable signs or plates, car badges, wrong body shapes or non-Moroccan settings | People rule, unbranded cars, Rabat setting | 15 Oct | run prompt-pack |
| The brief's car-wash camera (35 mm f/5.6), cars at 16:9, and car-wash photos at 3:2 | iPhone 24 mm at chest height reads as the team's photo; cars generated at 3:2 then cropped; wash photos at 4:3 to match the tile | 14–15 Oct | chat; run prompt-pack |
| The audit's numbered docs tree (00-overview, 01-architecture…) | The repo uses docs/{adr,specs,architecture,product,quality,runbooks,status,audits}; do not "fix" toward the audit tree | 13 Oct | run full-audit (docs) |
| Project docs in French | Docs in English, UI copy in French (D14) | 13 Oct | audit |
| Squashing famille-safety's history | The history is already published on master | 14 Oct | verification (FS-17) |
| Remote build numbers (EAS remote, CURRENT_PROJECT_VERSION, manageAppVersionAndBuildNumber) | Proposed: app.config.ts as the only source (ADR-0049, still Proposed) | 13 Oct | run foundation |
| Keeping the with-ios-build-paths plugin as the permanent fix | Proposed: move the repo to a path without spaces (ADR-0050, still Proposed) | 13 Oct | run foundation |
| Marking backlog items done without a commit or PR | Status must point at evidence | 13 Oct | run foundation (gates) |

### Refuted or downgraded findings (do not re-file)

| Claim | Why it does not hold | Date | Source |
|---|---|---|---|
| The EAS development-device profile points a real phone at localhost | A dev client gets its JS from local Metro, which inlines EXPO_PUBLIC_* from the developer's shell; the runbooks still repeat it (IDEA-292) | 13 Oct | run full-audit (skeptic) |
| Leaving the ride screen loses the receipt | expo-router pushes a new Home and keeps /ride mounted; the real bug was stack growth (PAX-15, done) | 13 Oct | run full-audit (skeptic) |
| Commit the local lockfile because master's is out of sync | The teammate's 02ff3d3 had already fixed it; committing would have overwritten the fix | 13 Oct | run full-audit (skeptic) |
| Timeout retries duplicate withdrawals and recharges on the demo server | Server guards block a second operation; the key contract still matters for a real backend | 13 Oct | run full-audit (skeptic) |
| The demo backend is reachable in production builds | EXPO_PUBLIC_DEMO=0 is inlined, so it is dead weight, not exposure (size and coupling remain: QA-12) | 13 Oct | run full-audit (skeptic) |
| Every Android production build uses OSM tiles | The Google key may come from EAS secrets; current TestFlight demos are iOS | 13 Oct | run full-audit (skeptic) |
| In-trip maps need sheet-height padding | Commit 0e0b066 already fixed the framing; the padding would undo it | 13 Oct | run full-audit (skeptic) |
| A debt limit of 0 blocks everyone (as a bug) | It follows the documented threshold rule; it is a configuration choice | 13 Oct | run full-audit (skeptic) |
| A pending withdrawal plus commissions creates extra debt | The final balance equals an immediate debit; only the limit overshoot remains (IDEA-250) | 13 Oct | run full-audit (skeptic) |
| Stored passenger-wallet fields go stale | `passengerWallet()` recomputes them on every read | 13 Oct | run full-audit (skeptic) |
| The approval note also leaks to drivers | The dossier shows the decision message only for more-info and rejected | 13 Oct | run full-audit (skeptic) |
| The system asserts a refund | The outcome is a label; the real gap is that no refund tool exists (IDEA-148) | 13 Oct | run full-audit (skeptic) |
| Zod schemas and TS entities drift | The server assigns schema output to the entity, so drift fails typecheck | 13 Oct | run full-audit (skeptic) |
| The API client crashes and loses 401 handling on non-JSON | The query just fails; the demo API always returns JSON | 13 Oct | run full-audit (skeptic) |
| tailwindcss is undeclared in packages/tokens | Only referenced in a JSDoc type import | 13 Oct | run foundation |
| Standalone ID photos are never cleared; the shipping WalletCard is untested | Reset removes uploads; e2e asserts the WalletCard balance | 13 Oct | run full-audit (skeptic) |
| The open web /backoffice is a security hole; the landing bundle is a performance problem | Per-browser localStorage only; measured bundle sizes are modest (both downgraded to low) | 13 Oct | run full-audit (skeptic) |

[brief]: ../tasks/2026-10-13.md
[audit]: ../audits/2026-10-13-full-audit.md
[findings]: ../audits/2026-10-13-full-audit-findings.md
[verif]: ../audits/2026-10-14-verification.md
[redesign]: ../audits/2026-10-15-redesign-audit.md
[prompts]: ../design/media-prompts/2026-10-14-image-prompts.md
[results]: ../design/media-prompts/2026-10-15-results.md
[agents]: ../../AGENTS.md
[s-family]: ../specs/family.md
[s-wash]: ../specs/car-wash.md
[s-sos]: ../specs/safety-sos.md
[s-elig]: ../specs/eligibility-and-verification.md
[a07]: ../adr/0007-lifecycle-rules-are-declarative-state-machines-in.md
[a09]: ../adr/0009-idempotency-key-is-required-on-booking-money.md
[a18]: ../adr/0018-sensitive-data-minimisation.md
[a21]: ../adr/0021-demo-authentication.md
[a23]: ../adr/0023-mobile-styling-and-runtime-dark-mode.md
[a24]: ../adr/0024-motion-material-and-text-scaling-policy.md
[a25]: ../adr/0025-mobile-illustrations-are-vector-svg-and-avatars.md
[a29]: ../adr/0029-demo-store-is-versioned-schemaversion-1-and.md
[a31]: ../adr/0031-number-masking-is-the-only-planned-passenger.md
[a32]: ../adr/0032-apps-web-stack.md
[a33]: ../adr/0033-pricing-precedence-between-city-rules-and-service.md
[a34]: ../adr/0034-women-only-eligibility-and-verification-policy.md
[a35]: ../adr/0035-sos-production-model.md
[a36]: ../adr/0036-naya-famille-operating-model.md
[a37]: ../adr/0037-admin-permission-model-for-the-new-features.md
[a38]: ../adr/0038-canonical-backoffice.md
[a39]: ../adr/0039-future-of-the-prototype-module.md
[a40]: ../adr/0040-passenger-wallet-model.md
[a41]: ../adr/0041-cash-and-fee-settlement.md
[a43]: ../adr/0043-category-vehicle-eligibility-and-scooter-scope.md
[a44]: ../adr/0044-demo-gating-flag-defaults-and-the-production.md
[a45]: ../adr/0045-production-backend-and-live-integrations.md
[a46]: ../adr/0046-production-map-tile-provider.md
[a47]: ../adr/0047-nativewind-remove-it-or-adopt-it-for.md
[a48]: ../adr/0048-cross-surface-media-and-brand.md
[a49]: ../adr/0049-build-number-source-of-truth.md
[a50]: ../adr/0050-repo-path-with-spaces.md
[a51]: ../adr/0051-apps-web-package-manager.md
[a52]: ../adr/0052-screenshot-storage.md
[a53]: ../adr/0053-idempotency-key-lifecycle.md
[a54]: ../adr/0054-source-of-truth-for-the-passenger-s.md
[a55]: ../adr/0055-account-lifecycle.md
[a56]: ../adr/0056-source-of-truth-order-committing-the-handoff.md
[a57]: ../adr/0057-branch-review-and-ci-policy.md
[a58]: ../adr/0058-present-the-mock-backed-apps-as-a-real-product.md
[a59]: ../adr/0059-status-is-an-icon-problems-keep-words.md
