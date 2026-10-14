# Verification report: the work of the other chat

For Achraf. Date: 14 October 2026.

**Scope.** This report covers everything the other chat ("Project submission template (fork)") built on 13–14 October, and how it fits with this session's branch:

| Unit | Where | Base |
|---|---|---|
| Onboarding photos | Uncommitted in the main checkout (`chore/docs-foundation-and-fixes`, HEAD 87f801d) | 87f801d |
| Driver sign-up | `feat/driver-signup`, worktree `naya-worktrees/driver-signup`, HEAD 14af9ed (6 commits) | c38429d |
| Naya Famille safety | `feat/famille-safety`, worktree `naya-worktrees/famille-safety`, HEAD aea2028 (4 commits) | c38429d |
| Car wash | `feat/car-wash`, worktree `naya-worktrees/car-wash`, HEAD 83f1ec8 (5 commits) | c38429d |
| Integration trial | `integration/trial-2026-10-14`, worktree `naya-worktrees/integration-trial`, HEAD 01152f5 | 87f801d + the 3 branches + the photos |

**How it was checked.**

1. An independent verifier per unit re-ran every gate the other chat claimed. Each verifier walked the feature headless in a browser on its own ports with scratch data, probed the API, and diffed the branch against main.
2. A skeptic re-checked each verifier's findings. Severities below are the skeptic's adjusted ones. The skeptic refuted no finding outright and added findings the verifier missed (marked `-M`).
3. A trial branch merged all three features and the photos onto this session's branch, fixed the conflicts, and re-ran every gate.
4. The full Playwright suite ran on the trial branch.

Nothing was changed in the main checkout, the feature branches or their worktrees. All test servers were stopped afterwards.

---

## 1. Bottom line

- **Everything works together.** The trial branch combines this session's fixes, the three features and the photos. All gates pass on it: typecheck 11/11, domain 93, demo-api 89, passenger 22, web 8, lint 0 errors, admin build, API-reference check, and **e2e 46/46** (including 4 new e2e tests for sign-up, car wash and Famille).
- **The other chat's claims hold.** Every test count it claimed reproduced exactly. Of 84 claims checked, none was refuted. 11 were only partly true (details per unit). **No formatting churn** from the Progix hook in any of the four diffs.
- **The biggest finding: `feat/famille-safety` silently deletes this session's P1 handover lock.** On that branch, 20 wrong codes in a row are accepted and the right code still closes the trip. The trial branch restores the lock (e2d1d7e) and e2e proves it for both roles. **Never merge `feat/famille-safety` on its own.**
- **What is safe to merge:** the trial branch, as the single merge candidate, after `chore/docs-foundation-and-fixes` lands. Do not merge the three feature branches separately.
- **Fix before any shared or hosted demo** (the trial branch still has all of these):
  - dev-mode demo controls approve or cancel in real people's names, without a simulation label (FS-01, DS-1);
  - « Police 19 » tells the parent "le support Naya est informé", but no alert reaches the SOS desk (FS-10);
  - the parent's "live GPS" and the 300 m school check quietly switch to a simulated route 5 s after the last real fix (FS-03);
  - the advertised 5-minute free car-wash cancellation never applies to « Maintenant » orders (CW-01);
  - any unreviewed driver account can book a car wash (CW-02).
- **Fix before launch:** the co-parent follow link never expires and shows the home address (FS-06); criminal-record data has no consent notice, retention rule or ADR (DS-3); cash wash fees stay pending forever and wash payments are missing from admin Finance (CW-03); a locked or failed handover leaves the trip stuck with no exit (FS-09).
- **Nobody has run any of this on a simulator or a device.** That covers the live document camera, the photos on native, the Famille location stream, and the stacked passenger home screen.

---

## 2. Summary table

Claims: confirmed / partly / refuted / not checkable. Issue counts use the adjusted severities.

| Unit | Claims | Gates | E2E | Issues | Verdict |
|---|---|---|---|---|---|
| Onboarding photos | 13 / 4 / 0 / 0 (17) | 10/10 pass: typecheck 11/11, passenger jest 20/20, lint 0 errors, render in light and dark at 3 sizes | Not in the suite; headless render of both apps checked | 0 high, 0 medium, 7 low | **Works.** Commit after the slide-3 copy decision and the doc fixes. |
| Driver sign-up | 19 / 2 / 0 / 1 (22) | All pass: typecheck, domain 59, demo-api 58, passenger 15, lint 0 errors, admin build. API probes found defects. | Not run on the branch. On trial: 1 stale S10 selector fixed; new `driver-signup.spec.ts` passes. | 0 high, 0 medium, 14 low | **Works.** Merge through the trial branch. Fix DS-1 and DS-2 before a shared demo. |
| Naya Famille safety | 20 / 3 / 0 / 0 (23) | All pass: typecheck, domain 51, demo-api 62, passenger 15, lint 0 errors, admin build, web export. **Its rewritten e2e spec fails twice.** | Fails on the branch. Fixed on trial (63b56d3); new `scenarios-famille.spec.ts` (2 tests) passes. | **1 high (fixed on trial)**, 5 medium (1 fixed on trial), 14 low | **Works end to end, but not safe to merge alone** (drops the P1 lock). Merge through the trial branch. |
| Car wash | 20 / 2 / 0 / 0 (22) | All pass: typecheck, domain 55, demo-api 60, passenger 17, app lint 0 errors, admin build. Root `pnpm lint` does not exist at the base. | Existing suite 37/40 on the branch; the 3 failures exist at the base and are fixed on main. New `passenger-car-wash.spec.ts` passes on trial. | 0 high, 3 medium, 15 low | **Works.** Merge through the trial branch. Fix CW-01 and CW-02 before a shared demo, CW-03 before launch. |
| Integration trial | n/a | All pass: typecheck 11/11, domain 93, demo-api 89, passenger 22, web 8, lint 0 errors, admin build, API reference up to date (156 routes) | **46/46** in 6.9 min, no retries | 17 conflicts resolved; 3 integration fixes; 10 items left open | **Green. This is the merge candidate.** |

Screenshots live in the scratch folder below. It is temporary, so copy anything you want to keep:
`/private/tmp/claude-501/-Volumes-UNREAL-Codex-Space-Recovery-2026-10-05-Users-achrafarabi-Dev-naya/3853af2e-6d9d-4a94-b7fc-d47b6737822e/scratchpad/verify/`

---

## 3. Per unit

### 3.1 Onboarding photos (uncommitted in the main checkout)

**What was verified.**

- The diff is small and clean: 33 lines added, 11 removed, over 6 files. `git diff --check` is clean, and quotes, semicolons and wrapping match the repo.
- Three new JPEGs are in `packages/assets/photos/`, 306 KB in total. `images.ts` exports `photos`.
- `WelcomeJourney.tsx` fills the stage with the photo (`cover`, top-aligned). It keeps this session's dark-mode tokens (dcd4c8f) for slides without a photo.
- Passenger slides 1 and 3 use photos. Driver slide 1 uses a photo. Slide 2 in both apps keeps its line art.
- Headless render of both apps in light and dark at 390×844, 375×667 and 320×568: faces stay in frame, and nothing new appears in the console.
- The label pill is legible over the photos (contrast 9.17:1 in light, 9.37:1 in dark).
- Each photo has a correct French accessibility label.
- The images follow the brief's rules: Moroccan women with light-olive to caramel skin, a mix with and without headscarf, no men, and no readable logos or text (checked on 2–4× zoomed crops).
- Gates: full typecheck 11/11; passenger jest 20/20; lint 0 errors (5 warnings per app, none in touched files).
- The same change is already committed on the trial branch as a0b82dc, byte for byte.

**Partly true claims.** The images are 940 × 1100, not 941. Prompt 2 was mapped to slide 1 by meaning, and prompt 3 to slide 3 by position, under unchanged copy (see PH-1). The lint row reads as one total, but the 5 warnings are per app. The README provenance line contradicts line 3 of the same README.

**Issues** (all low after review):

| ID | Issue | Fix | On trial |
|---|---|---|---|
| PH-1 | Passenger slide 3 shows a child pick-up photo (schoolgirl, mother at the door) under « Une communauté vérifiée. », which is copy about account review. The prompt file meant this photo for a « Vos enfants, accompagnés » slide, which never existed in the code. The skeptic lowered this to low: the founder commissioned the scene, the slide is 3 of 3 behind « Passer », and Famille is already reachable in every build. | Your call (decision 1): change the slide-3 copy to a Famille message, or use a non-child photo for the verification slide. | open |
| PH-2 | Docs now describe vector-only apps: AGENTS.md repo map, ADR-0025, ADR-0048's "today" table, D11's default, backlog VIS-27/VIS-08/DOC-20, and README.md:3 ("every file here comes from Naya-Expo-Handoff.zip"). ADR-0048 also says "9:16 with an overlay"; the code uses 940×1100 crops with the title below and no overlay. | Update them in the same commit. Mark VIS-27 partly done. | open |
| PH-3 (+PH-M1) | The `images.ts` comment and README.md:7 say 941 × 1100; the files are 940. `aspect.photo = 941/1100` is wrong and used nowhere. | Write 940 and delete `aspect.photo`. | open |
| PH-4 | The verification-log rows are imprecise: "every package" (the log asks for counts), and the lint count is per app, not total. | Do not edit the rows. Append a new row with this re-run. | open |
| PH-5 | No unit test covers the photo branch. The existing dark-mode test no longer matches the real slide 1. | Add a test: photo label present, pill background in light and dark, gradient absent. | open |
| PH-6 | Committing needs care. README.md:7 links the untracked `docs/tasks/`. `achref-dev-skill-debt/` and `achref-dev-skill-debt-images.zip` sit untracked at the repo root, look unrelated to Naya, and were not inspected. `docs/screens/ios/` is untracked too (ADR-0052 undecided). | Stage paths explicitly; never use `git add -A`. Decide separately about `docs/tasks/`. | n/a |
| PH-7 | Not checked on native, where `contentPosition` and accessibility labels behave differently from web. | Run a simulator capture in light and dark (decision 15). | open |

**Screenshots** (in `verify/photos/`): `shots/passenger-light-390x844-slide1.png`, `shots/passenger-light-390x844-slide3.png` (the PH-1 slide), `shots/passenger-dark-390x844-slide1.png`, `shots/driver-light-390x844-slide1.png`, `shots/driver-dark-390x844-slide1.png`, `shots/passenger-light-320x568-slide3.png`, `crops/c3_bgcar.png`.

### 3.2 Driver sign-up (`feat/driver-signup`)

**What was verified.** A headless walk took a new driver through all 30 one-question screens: the person, the vehicle, the Famille application and the three submissions. Then:

- An admin refused the licence back with a reason (the other pieces turned « Approuvé »), approved the vehicle and approved Famille.
- Back in the driver app, the per-document statuses and the « Renvoyer » action were correct.
- Save and resume works: the seeded Yasmine resumes at the birth-date step.
- The old `docs/identity` and `docs/vehicle` links redirect.
- The licence rules work: category B, valid, issued at 18 or older, years of experience no more than the licence's age.
- A duplicate reference phone is refused, and interview days skip Sunday.
- Cross-driver writes to a dossier return 403.
- Dark mode is correct.
- All claimed gates reproduce.
- No formatting churn: diff sizes with and without `-w` are nearly identical.

**Partly true or unverifiable claims.**

- **Live camera.** It is native-only and was never run. The `expo-camera` 57 API usage matches the type definitions, and the framing guides render on web.
- **Simulate endpoint.** It is gated by dev mode, but dev mode is on by default and any role can call it.
- **The other chat's own browser walk.** Not checkable; the independent walk above replaces it.

**Issues** (all low after review). The verifier rated DS-1 to DS-4 medium; the skeptic lowered them for the reasons given.

| ID | Issue | Fix | On trial |
|---|---|---|---|
| DS-1 | `POST /dev/verification/:id/simulate` lets any signed-in user, passengers included, approve her own dossier. The decision and the hash-chained audit entry name the real admin Meryem Lahlou. Low because dev mode already allows signing in as anyone (OTP 123456). The defect is mislabelling: it breaks « Label every simulation » and the audit trail. The trial's API reference also wrongly says the route needs `verification.decide`. | Use a system actor ("Réviseuse de démonstration"), a `verification.simulated_*` action, and allow drivers only. Add a test that the audit actor is not an admin. | open |
| DS-2 | Submission does not re-validate the draft. Probe: birth date changed to 2015 and submit returned 200, while the reviewer still sees 1993. Worse variant: a valid new birth date plus the old licence gives a licence issued at age 14, and submit still returns 200. The app blocks this; a direct API call or a stale client does not. | In `submitCase`, re-run `validateSignupStep` for every step against `draftView`. Add a test. | open |
| DS-3 | Famille vetting data. There is no consent or purpose notice on the opt-in or on the criminal-record step. The support agent (`people.read`) can read the two references' names and phones. The criminal-record file is never deleted, and file reads are not audited. Mostly existing gaps (ADR-0018, ADM-19, D10). The gap specific to this branch is the missing consent notice. | Add the notice now. Decide access, retention and audit with D10 (decision 3). | open |
| DS-4 | Main's CI `gen-api-reference --check` would fail after the merge. | Done on trial (4bd8305). Optionally switch `/licence` and `/famille` to `body(c, schema)`. | **fixed on trial** |
| DS-5 | Impossible dates (30/02) pass the step check. The driver then gets stuck at submission with a generic error. | Add `.refine(isCalendarDate)` to the domain rules. | UI fixed by P13; domain still loose |
| DS-6 | On the branch, DateField wipes digit-by-digit input (old P13 bug). | Fixed by main's P13 in the merge. Not re-walked digit by digit on trial. | **fixed on trial** (re-check) |
| DS-7 | Famille can be approved while the identity case is still incomplete, and before any interview is recorded. The approval dialog shows the internal string `(familleEligibility = approved)`. | Warn or block. Remove the jargon. Add interview and training outcome fields (decision 9). | open |
| DS-8 | The experience stepper shows « 0 » but treats it as unanswered. | Initialise the answer to 0. | open |
| DS-9 | Copy and accessibility: « Les passagères voient l'habitacle » is false; « 1 étapes »; seven buttons all labelled « Modifier »; raw `draft` status in the admin history. | Small copy fixes. | open |
| DS-10 | The unused `/licence` and `/famille` routes return 500 on malformed JSON. | Use `body()` or delete them. | open |
| DS-11 | Approved pieces can be re-captured during a correction round. Licence expiry is checked only at submission. | Make accepted items read-only; track expiry with ADR-0055. | open |
| DS-12 | No e2e coverage on the branch. | `driver-signup.spec.ts` added on trial. Per-document refusal and the Famille application are still not covered. | **partly fixed** |
| DS-M1 | A Famille approval never expires. The extract's date is not recorded. The brief's "periodic re-checks" are not built and not disclosed. | Record as not done. Decide the cadence (decision 3). | open |
| DS-M2 | The seed changes without a `schemaVersion` bump. Existing stores keep the old data, while the launcher advertises Houda and Yasmine. | Bump the version, or document "reset needed" in the demo-data runbook (decision 14). | open, see 4.3 |

**Screenshots** (in `verify/driver-signup/shots/`): `signup-01-hub-empty.png`, `signup-07-id_front.png`, `signup-10-licence-cat-C-error.png`, `signup-28-famille-intro.png`, `signup-35-status-all-submitted.png`, `admin-03-person-case.png`, `admin-05-refuse-dialog-filled.png`, `admin-09-famille-approve-dialog.png` (DS-7 jargon), `after-01-status-after-review.png`, `resume-01-hub-resume.png`, `dark-04-capture-dark.png`, `signup-04-birth-incomplete-error.png` (DS-6), `baddate-01-after-impossible-date.png` (DS-5).

### 3.3 Naya Famille safety (`feat/famille-safety`)

**What was verified.** A full connected walk, headless:

- trip: example family, depart, arrive, pick-up photo with name attestation, « Démarrer »;
- approval: the parent refuses from the UI, a second request is approved on site;
- during the trip: live map, WhatsApp hand-off, driver call request, police sheet;
- follow link: the co-parent follow link works without a session (390 and 1440 px);
- end of trip: drop-off photo and code, completed;
- also: dark mode, the admin Familles tab with approval history, and the driver demo paths for refusal, timeout and the 3-request cap.

The server enforces the core rules:

- there is no `picked_up → in_progress` edge without approval;
- approval is parent-only, with a 180 s deadline and at most 3 requests;
- drivers not approved for Famille get 403;
- the driver never receives the parent's phone number;
- child photos are readable only by the parent (and some admins).

All claimed gates reproduce. No formatting churn: the big deletions are code moved to `famille.ts`.

**Partly true claims.**

- **"in_progress only through parent approval":** true for real users, but the dev bot can approve as the parent (FS-01).
- **"school photo within 300 m + code":** the 300 m check can run against a simulated position (FS-03), and a photo can be reused (FS-07).
- **Follow link:** it works, but it never expires (FS-06).

**High and medium issues.**

- **FS-02 · high · fixed on trial. The handover has no wrong-code limit, and the branch deletes main's lock.**
  - Evidence: `packages/domain/src/famille.ts:120-125` compares codes with no counter. Probe: 20 wrong codes all return 422, then `1234` completes the trip. The branch deletes the family routes from `prototype.ts`, where main's `HANDOVER_MAX_ATTEMPTS = 5` lives (e9800c3). Main's P1 tests would fail.
  - Fix: done on trial in e2d1d7e. The lock was re-implemented in `services/famille.ts`, the code field was removed from driver payloads, and the attempts-left and lock UI was ported. The e2e test `scenarios-famille` #2 proves it on both phones.
- **FS-01 · medium. Dev-mode demo controls fake the parent's consent and cancel her trips.**
  - Evidence: with dev mode on (the default), `POST /dev/family/trips/:id/demo {parent:'approve'}` makes the bot approve as Salma. The timeline line « Départ approuvé à distance par Salma » has no « simulation » tag, and the audit names Salma (`famille.ts:416-430`). Worse, and reachable from the UI: a driver tapping a demo button (`/dev/family/play`) cancels another parent's trip with a child on board. It writes the status directly, which bypasses the state machine, and records "cancelled by parent" (`famille.ts:749-760, 472-476`). It also silently moves Salma's subscription to that driver. On a shared demo, testers overwrite each other's trips. Medium rather than high: no `/dev` routes are planned in production (ADR-0044/0045).
  - Fix: only the caller's own demo trips may be simulated. `/dev/family/play` must never cancel real trips, and any cancel must go through `applyFamilyEvent`. Set `approval.simulated = true`, tag every line the bot writes, and use a system audit actor. Hide « jouer l'étape de la chauffeuse » when a real driver is assigned.
- **FS-03 · medium. GPS silently falls back to the ×20 simulation, and the 300 m geofence uses it.**
  - Evidence: `stale` is never true (`packages/domain/src/famille.ts:176-247`). Five seconds after the last real fix, the parent sees a simulated route labelled only « Déplacement simulé ×20 ». A drop-off was accepted with the last real fix 90 km away. `useLocationStream` never asks for permission (`apps/driver/src/lib/location.ts:57-59`). A Famille driver who never went online therefore sends no fixes at all, and the geofence becomes a timer. None of this is gated by dev mode.
  - Fix: use the simulation only in dev mode, and only when no real fix was ever received. Otherwise return the last fix with `stale: true` and its age, and show « Signal perdu depuis N s ». Outside dev mode, refuse a drop-off when the position is simulated or stale. Request permission on the trip screen.
- **FS-05 · medium · fixed on trial. The rewritten e2e spec fails twice.**
  - Evidence: a strict-mode failure at `scenarios-feedback.spec.ts:36` (the approval card is mounted twice), then the drop-off at `:72` fails (FS-04).
  - Fix: done in 63b56d3. The test is scoped to the trip screen, and the driver picks the adult.
- **FS-06 · medium. The co-parent follow link never expires and exposes the home address and live position.**
  - Evidence: `famille.ts:484-506, 733-745`. Only revocation invalidates the link; probe: still valid after +30 days. It returns the full pickup address (« Avenue Annakhil, Rabat ») and the live position. The timeline also leaks police, incident and refusal-reason lines. Mitigations are real: a 192-bit token stored hashed, and revoke and renew work.
  - Fix: decision 4. Then add an expiry, show a label without the street address, show the position only while the child is on board, filter the timeline, and announce new viewers.
- **FS-10 · medium. « Police 19 » says support is informed, but raises no alert.**
  - Evidence: `famille.ts:646-651` sets `t.incident` and sends « Le support Naya est informé ». The admin SOS queue stays at 0 alerts. The SOS button on the same screen does create one.
  - Fix: create a SafetyAlert linked to the family trip (main's `adminAlert` already maps family trips), or remove the wording.

**Low issues.**

| ID | Issue | Fix | On trial |
|---|---|---|---|
| FS-04 | No adult is preselected for the drop-off when the trip loads before the family list. `FamilleTripScreen.tsx` `useState(child?.recipients[0]?.id ?? '')` runs once. It happens on a cold load or reload, and one tap recovers. The e2e works around it. | `recipient \|\| child?.recipients[0]?.id`, and disable « Clôturer » until an adult is chosen. Whether to preselect at all is decision 6. | open |
| FS-07 | One upload is accepted as both the pick-up and the drop-off proof, even one made before the trip. | Single-use proofs, created after the enabling step. | open |
| FS-08 | WhatsApp hand-off: the parent gets the chauffeuse's personal number, against ADR-0031 (Accepted). It is the founder's answer F4, but there is no ADR. The demo toast prints the number. | Write the ADR (decision 2). Consider a Naya relay number. Drop the number from the toast. | open |
| FS-09 | No exit from `in_progress`: no failed handover, no admin action, no cancel. Existed before the branch. **On trial this is now reachable on purpose: a locked handover leaves the trip stuck.** | Add a `handover_failed` path resolved by the safety desk (decision 6). | open, more visible |
| FS-11 | The driver screen always says her position is shared every second, even when nothing is sent. | Show it only after a fresh real fix; otherwise label « Démo ». | open |
| FS-12 | The parent can no longer see the handover codes she set. | Show them masked, tap to reveal. | open |
| FS-13 | The notification action « Approuver le départ » approves without showing the pick-up photo. | Make the action open the approval card. | open |
| FS-14 | Map chips overlap at 390 px. Live regions announce the countdown every second. Extra h1. | Stack the chips; announce state changes only. | open |
| FS-15 | Copy forces feminine agreement for every child (« prête », « arrivée ») and uses « invité·e ». | Neutral wording. | open |
| FS-16 | The admin payload still includes every child's handover codes. Child photos are readable with `config.edit`. | Strip the codes; move to `family.ops` (ADR-0037). | open |
| FS-17 | The intermediate commits do not build (5bd9a1c removes `FAMILY_NEXT`, which is still used). | Squash, or accept a broken bisect. They are in the trial's history through the `--no-ff` merge. | carried |
| FS-18 | `familleEligibility` helpers are duplicated with driver-signup, with different labels. | Done on trial: one module, label « Approuvée ». | **fixed on trial** |
| FS-M1 | The police button dials the real 19 from demo builds, including fully simulated trips. | In demo mode, record the call without dialling, or require a second confirmation. | open |
| FS-M2 | Main's `docs/specs/family.md` (R11–R18), ADR-0036 and F2/F4 contradict the merged code. | Rewrite the spec and add the ADRs with the merge. | open |

**Screenshots** (in `verify/famille-safety/shots/`): `13-pax-approval-card.png`, `12-drv-awaiting-approval.png`, `14-pax-in-progress.png`, `17-pax-whatsapp-toast.png` (FS-08), `19-drv-police-sheet.png`, `21-coparent-follow-390.png` (FS-06), `25-drv-dropoff-wrong-code.png` (FS-04), `26-drv-completed.png`, `31-admin-familles-1440.png`, `33-drv-timeout-cap.png`, `50-pax-real-gps-far.png` and `51-pax-after-gps-stops.png` (FS-03), `28-pax-completed-dark.png`, `e2e-failed-2.png`.

### 3.4 Car wash (`feat/car-wash`)

**What was verified.** A headless walk, never done before:

- **Passenger:** booked an Extérieur wash « Maintenant » by card, and a 10h30 slot in cash. She followed réservé → assignée → en route (live map and ETA) → lavage (before photos) → terminé (after photos and receipt), rated the wash, and cancelled the slot after a preview (free, then 20 MAD). The fee charged equals the fee previewed: a stale value gets 409.
- **Driver:** booked with her vehicle prefilled and paid from her wallet. The ledger shows −60 MAD under `wash:<id>:charge`, the balance never goes below zero, and an idempotent replay does not debit twice.
- **Admin:** `/lavages` is read-only and gated on the server.
- **Entry points:** the driver's entry shows only when she is offline with no ride.
- **Prices:** placeholders, labelled as provisional everywhere.

All claimed gates reproduce. No formatting churn, no package or lockfile change.

**Partly true claims.**

- **Lint:** 0 errors, but only through the per-app commands; the base has no root `lint` script.
- **Before/after photos:** labelled placeholders (« Photos simulées »), with no upload path. That is by design for the demo.

**Medium issues.**

- **CW-01 · medium. The 5-minute free cancellation never applies to « Maintenant » orders.**
  - Evidence: the team leaves 10 s after assignment (`packages/domain/src/carWash.ts:156`), and `en_route` always charges 30 MAD (`:404`). The cancel sheet says « Annulation gratuite jusqu'à HH:MM » for a window that closes 10 s later. The domain test covers the grace period only in a state that « Maintenant » orders never reach. This would also defeat the rule in production.
  - Fix: no fee while `now < assignedAt + grace`, even en route, or start travel after the grace period. Align the copy, and test the full path through the engine.
- **CW-02 · medium. Unverified drivers can order washes.**
  - Evidence: `services/demo-api/src/services/carWash.ts:139-142` checks identity approval for passengers only. A new OTP driver whose identity is still `draft` booked LV-005 in cash. That bypasses the manual review the women-only rule rests on.
  - Fix: require an approved driver identity, and an approved vehicle when `vehicleId` is set. Add a test and spec rule R6.
- **CW-03 · medium. Cash wash fees stay pending forever, and wash payments are missing from admin Finance.**
  - Evidence: `carWash.ts:308` never resolves a cash fee. `app.ts:876-877` lists only payments whose ride exists, so failed and pending wash payments never appear (« Aucun paiement à suivre »). It is the same class of defect as P11, and spec R12 acknowledges it.
  - Fix: include wash payments in Finance, settle cash fees under D7, and add a retry for refused cards.

**Low issues.**

| ID | Issue | Fix | On trial |
|---|---|---|---|
| CW-04 | « Maintenant » is the default at night and is refused only at the final confirm. The hours are shown and the form is kept. | Check availability on the client; disable « Maintenant » with a reason. The e2e books tomorrow to avoid it. | open |
| CW-05 | 3 textual conflicts and a stale API reference on merge. | Done on trial. | **fixed on trial** |
| CW-06 | The driver receipt says « Réglé à la fin du lavage », but the wallet was debited at booking. | « Débité du portefeuille · 60 MAD ». | open |
| CW-07 (+CW-M2) | The passenger wallet history labels washes « Course · LV-001 » and « Course · LV-001-fee ». | Pass a label to `settlePassengerWallet`. | open |
| CW-08 | « Appel masqué via Naya » caption with no call action (ADR-0031). | Show it as unavailable with a reason, or remove it. | open |
| CW-09 | Mobile-wallet wash payments are confirmed instantly (ADR-0040). | Wait for a provider event. | open |
| CW-10 | The parking-notes hint invites gate codes; notes and amounts are visible to support agents. | Drop « code » from the hint; gate amounts behind `finance.read`. | open |
| CW-11 | The admin `/lavages` table clips the amount column at 1440 px. | Merge or wrap columns. | open |
| CW-12 | The cancel sheet rotates the Idempotency-Key on every error; the server key is optional. | Follow ADR-0053. | open |
| CW-13 | Cancel and rate return 403 for other customers' orders, while GET returns 404 (enumeration signal). | Return 404 everywhere. | open |
| CW-14 | A driver can go online while her own car has an open wash. | Warn, or keep the order row visible on the dashboard. | open |
| CW-15 | The read-only star rating is unlabelled on web. | Role and label on the row. | open |
| CW-16 | No ADR (ADR-0043/0039 require one), F1 and the pricing spec are stale, and nothing was added to integrations, the backlog or the log. | Add them with the merge. An e2e spec was added on trial. | partly |
| CW-M1 | A pending cash fee makes the order screen poll every 4 s forever. | Stop polling for cash fees. | open |
| CW-M3 | A wallet that cannot cover the price is still preselected, then refused at confirm. | Mark it available only when the balance covers the price. | open |
| E2E note | Package choices have `role="radio"` but no `aria-checked` on web. | Expose the checked state. | open |

**Screenshots** (in `verify/car-wash/shots/`): `p01-home.png`, `p05-step3-package.png`, `p08-now-refused-at-night.png` (CW-04), `p12-orderB-cancel-free-preview.png`, `p15-orderA-en-route.png`, `p16-orderA-cancel-preview-en-route.png` (CW-01), `p18-orderA-completed.png`, `p21-orderB-cancelled-fee.png` (CW-03), `d04-step5-payment.png`, `d07-ledger.png`, `a01-lavages.png`, `a06-finance-payments-to-watch.png` (CW-03), `p31-dark-orderA.png`.

---

## 4. Integration

### 4.1 Conflicts and how the trial resolved them

Merge order on `integration/trial-2026-10-14` (from 87f801d, all `--no-ff`): famille-safety, then driver-signup, then car-wash, then the photos.

| File(s) | Conflict | Resolution | Risk |
|---|---|---|---|
| `services/demo-api/src/services/prototype.ts` | Main's SOS queue, code stripping and 5-code lock (in the old family routes) vs famille-safety moving every family route to `famille.ts` | Kept all SOS work. Took the removal of the family routes. Re-implemented the lock and the stripping in `famille.ts` (e2d1d7e). | Medium; covered by API tests and now by e2e |
| `packages/domain/src/prototype.ts` | `handoverAttempts`/`handoverLocked`, `FAMILY_NEXT` vs the new typed timeline and machine | Kept the lock fields and the typed timeline; dropped `FAMILY_NEXT` | Low |
| `packages/ui/src/features/prototype.tsx` | Main's attempts-left caption and lock banner vs the file being moved to `features/famille/` | Took the move; ported the caption and banner into `FamilleTripScreen.tsx` | Medium at the time; **now seen working in e2e on both phones** |
| `famille.ts` (domain and service), a design conflict | Field omitted and lock at 5 (main) vs `verificationCode: ''` and no lock | The safer option: field omitted, wrong codes counted outside the rollback, lock with incident, timeline, notification and audit. The test was strengthened to "key absent". | Low–medium |
| `apps/driver/src/app/(app)/_layout.tsx` | `useRideTracking` (P4) vs `useFamilyWatcher` | Both kept | Low; native not exercised |
| `packages/api/src/client.ts` (×3), `docs/SCREENS.md` (×3), `account.tsx`, admin `Layout.tsx`, both home screens, `index.ts` files, `app.ts`, `timers.ts` | Additive imports, routes, timers, nav entries and doc rows | Unions | Low (home screens: see 4.2) |
| `e2e/tests/scenarios-feedback.spec.ts` | Label rename vs a rewritten flow | Took famille-safety's version, then fixed it (63b56d3) | Resolved |
| `services/demo-api/src/seed.ts` | Eligibility set per driver (famille-safety) vs derived from a `driver_famille` dossier (driver-signup) | The dossier is the single source. Amina, Nadia and Houda get dossiers. Khadija and Samira go back to `not_requested`. | Medium: some demo states disappeared |
| `entities.ts`, `famille.ts`, `signup.ts` (duplicate definitions) | Both branches defined `FamilleEligibility`, the labels and `familleEligibilityOf` | One of each; the label « Approuvée » | Low–medium: wording (decision 13) |
| `services/demo-api/test/signup.test.ts` | Nadia is now Famille-approved | The vetting test uses Leila (fbfacd8) | Low |

### 4.2 Fixes made on the trial branch

| Commit | What |
|---|---|
| 2875406, 6292121, 505a9c4 | The three merges |
| e2d1d7e | P1 handover lock and code-free driver view restored in Naya Famille; lock UI ported; tests adapted |
| fbfacd8 | Signup Famille vetting test moved from Nadia to Leila |
| 4bd8305 | API reference regenerated (156 routes) |
| a0b82dc | Onboarding photos, copied byte for byte from the main checkout |
| 833627f | Trial gates recorded in the verification log |
| 63b56d3 | Two stale e2e specs fixed (S10 heading by role; scenarios-feedback scoped to the trip screen) |
| 7509bf7 | New e2e: `driver-signup.spec.ts`, `passenger-car-wash.spec.ts`, `scenarios-famille.spec.ts` (2 tests, including the P1 lock) |
| 01152f5 | E2E runs recorded in the verification log |

The trial worktree is clean at 01152f5.

### 4.3 Still open on the trial branch

**Design conflicts with this session's docs** (AGENTS.md "if code contradicts a spec or an ADR, ask"):

- **ADR-0031 (Accepted, masked numbers only)** vs the WhatsApp hand-off. ADR-0031's own "Revisit when" asks for a Famille ADR. None exists. (FS-08, decision 2)
- **ADR-0036 (Proposed)** is contradicted on four points:
  - §3: fixed parent-set codes are used, not one-time hashed per-trip codes;
  - §5: there is no `handover_failed` path;
  - §6: "do not hand off to WhatsApp" and "show the age of the last position";
  - §8: proofs are visible to `config.edit` and through a public link.
- **ADR-0034 decision 5** requires the criminal-record extract for every driver; the founder's F3 answer and the code say Famille only.
- **D11 / ADR-0025 / ADR-0048:** generated photos of people now show in the apps while all three are still Proposed.
- **ADR-0018 / ADR-0037:** child photos and the Famille application follow `config.edit` and `people.read`, not a `family.ops` permission. Criminal-record file reads are not audited.
- **ADR-0040 / D5:** washes can be paid with the Portefeuille Naya and the Wallet marocain.
- **ADR-0041 / D7 / P11:** cash wash fees are left pending.
- **ADR-0043 / ADR-0039:** a confirmed car wash needs its own ADR.
- **ADR-0044 / D9:** new `/dev` routes, while dev mode still defaults to on (FS-01, DS-1).
- **ADR-0030 and ADR-0013:** Famille adds 1 s and 2 s polling for every signed-in passenger, and a foreground location stream tied to a screen rather than to the trip's state.
- **Main's SOS desk (P2)** never receives Famille police calls or incidents (FS-10).

**Merge leftovers:**

1. **Locked handover dead end.** After 5 wrong codes the trip stays `in_progress` forever. There is no cancel, no drop-off and no admin action (decision 6).
2. **Old stores.** famille-safety's `ensureFamille()` backfill marks Amina and Nadia approved on stores written before 13 October, without a dossier. There is no `schemaVersion` bump (decision 14).
3. **Seed states dropped.** Khadija « Famille en examen » and Samira « Famille refusée » are gone, because they had no dossier.
4. **Wording.** The label is « Approuvée », but `apps/driver/src/components/Dossier.tsx` still hard-codes « Agréée Naya Famille » (decision 13).
5. **No Idempotency-Key.** Famille trip mutations (advance, cancel, calls, call request, incident) send none, against the AGENTS.md invariant. The pattern is inherited.
6. **Docs not updated.** AGENTS.md repo map (`famille.ts`, `signup.ts`, `carWash.ts`), backlog P1 and QA-05 rows, `docs/specs/family.md`, the eligibility spec, `integrations.md`, and the intro prose of `gen-api-reference.mjs`.
7. **Product bugs worked around in e2e, not fixed:** FS-04 (adult not preselected) and CW-04 (« Maintenant » at night).
8. **Not viewed by anyone:**
   - the passenger home, which now stacks FamilleHomeCard, 4 quick pills and the car-wash entry (the map inset moved by 72 px);
   - the car-wash dark home after P15;
   - everything on native.
9. **Main checkout duplicate.** The photo work is still uncommitted in the main checkout and also committed on trial as a0b82dc. Pick one home for it (step 2 below).
10. **e2e screenshots.** `scenarios-feedback` still writes to `/tmp/naya-*.png`.

---

## 5. Decisions needed from Achraf

These are merged with the existing open questions where they overlap. The "default" is what the verification suggests; it is not decided.

1. **D3, Naya Famille at launch (also PH-1, D12).** The audit default is a demo only, behind the demo flag. The brief extends Famille a lot, and onboarding slide 3 now shows a child pick-up.
   - Decide whether Famille is advertised.
   - If yes: change slide 3 to a « Vos enfants, accompagnés » message and list it under D12 public claims.
   - If no: give the verification slide a non-child photo.
2. **F4 vs ADR-0031, the WhatsApp hand-off (FS-08).** The founder chose WhatsApp. Today the parent gets the chauffeuse's personal number, and the chauffeuse gets the parent's once the parent calls.
   - Write the ADR that supersedes ADR-0031 for Famille.
   - Decide between personal numbers and a Naya business or relay WhatsApp number.
3. **F3 vs ADR-0034, criminal-record scope and handling (DS-3, DS-M1, D10).**
   - Confirm Famille only, and amend ADR-0034.
   - Decide the consent and purpose notice, the legal basis (D10, law 09-08), the retention period (delete after decision + N days, and on reopen), who may read the extract and the references, the extract's maximum age (« moins de trois mois » is copy only), and the re-check cadence.
   - Should the criminal-record step stay a demo specimen in tester builds until then?
4. **F2 and the co-parent follow link (FS-06).**
   - How long does a link live: per trip, per day, or until the subscription ends?
   - Does the co-parent see the home address, and the position before the child is on board?
   - Should the parent be told when a new viewer opens it?
   - On native, share a web URL or an app link?
5. **Approval limits and the remote start (F2 remainder, FS-13).** The branch uses a 3-minute window and at most 3 requests, then « appelez le parent ou annulez ». Confirm these values. Decide whether the notification action may approve without showing the photo; the default is no, open the card.
6. **The handover (FS-04, FS-09, ADR-0036 §3, §5).**
   - Fixed parent-set codes, or one-time codes per trip? Is a code mandatory?
   - Should the first authorised adult be preselected at the school gate, or must the driver pick explicitly?
   - Who resolves a locked or failed handover (absent recipient, lost code, closed school), and how does the trip end?
7. **The school photo rule and location (FS-03, FS-07, ADR-0030).**
   - Keep the photo within 300 m plus the code?
   - What happens when the signal is lost? The default is « Signal perdu », not a simulation.
   - Are Famille trips allowed background location?
   - Should proofs be fresh and single-use?
8. **Police and SOS for Famille (FS-10, FS-M1, D2).**
   - Should « Police 19 » and incidents raise an alert on the safety desk?
   - Should demo builds dial the real 19? The default is no: record the call and show the number.
9. **Child photo retention and access (FS-16, ADR-0018, ADR-0037).** How long do pick-up and drop-off photos live? Who may see them: only the parent and `family.ops`, or also `config.edit` as today? Strip the handover codes from the admin payload.
10. **Famille approval prerequisites (DS-7).** Must the person and vehicle approvals come first? Must the reviewer record the interview and training outcome before approving?
11. **F1 remainder, car-wash staffing and prices.**
    - Who are the washers: a provider role with its own app, or a partner? Must they be women?
    - Confirm the prices. They are placeholders in `CAR_WASH_DEMO_CONFIG`.
    - Confirm the cancellation fees of 20/30 MAD, and whether the 5-minute free window covers « Maintenant » orders (CW-01).
    - Must drivers have an approved identity to order (CW-02)? The default is yes.
    - Should washes get their own ADR and admin permission, or stay under `rides.read` with amounts visible to support?
    - Is the Portefeuille Naya offered for washes (D5 / ADR-0040)?
    - How are cash fees collected (D7)?
    - Should a driver with an open wash be warned when she goes online?
12. **D9 / ADR-0044, dev mode on shared demos (FS-01, DS-1).** Should the demo controls (« Validé / Reprise / Refus », parent and driver bots) work in connected web demos, or only in standalone builds? Should `NAYA_DEV` default to off on any hosted demo?
13. **Wording.** « Approuvée » (famille-safety, now on trial) or « Agréée Naya Famille » (driver-signup, still in `Dossier.tsx`)?
14. **Demo data.** Bump `schemaVersion`, which reseeds and wipes testers' on-device data, or document "reset needed" for the 13 October scenarios? Restore the Khadija and Samira states with real dossiers?
15. **D11 / ADR-0048, media policy.** Accept generated photos of fictional women for onboarding now? Should the remaining line-art slides (passenger slide 2, driver slide 2) also get photos, for one visual language?
16. **Housekeeping.** Commit `docs/tasks/` (founder-owned; the README links it)? What are `achref-dev-skill-debt/` and the `.zip` at the repo root? Decide ADR-0052 before `docs/screens/ios/` is committed.

---

## 6. Recommended next steps (in order)

1. **Pick the merge path.** Use `integration/trial-2026-10-14` as the only merge candidate for the three features. Do not merge `feat/famille-safety` on its own: it drops the P1 lock. Keep the feature branches as they are for reference. Optionally squash famille-safety's history (FS-17) when the trial is rebuilt.
2. **Give the photos one home.** They are both uncommitted in the main checkout and committed on trial (a0b82dc). Recommended: let the trial carry them, and stash the main-checkout copy once the trial is accepted. Before that, apply the slide-3 decision (1) and the doc fixes PH-2, PH-3 and PH-4 on the trial branch.
3. **Land `chore/docs-foundation-and-fixes` first**, as its own PR to master. It holds this session's safety fixes, and the trial is built on it. Stage paths explicitly; leave out the untracked root folders.
4. **On the trial branch, fix what makes a shared demo misleading:**
   - FS-01 and DS-1: own demo trips only, system actor, label every simulated approval, no cancelling of real trips;
   - FS-10: police raises a SafetyAlert, or drop the wording;
   - FS-03: simulated GPS only in dev mode, stale positions shown, geofence refuses stale or simulated positions;
   - FS-11: label simulated position sharing;
   - CW-01: free window for « Maintenant »;
   - CW-02: verified drivers only;
   - DS-2: re-validate the draft on submit;
   - FS-04 and CW-04: once decisions 6 and 11 are in, so the e2e no longer needs workarounds.
   Add a test for each, and re-run all gates and e2e.
5. **Do the Definition-of-done docs for the merged features:**
   - rewrite `docs/specs/family.md` and update the eligibility spec;
   - write the ADRs (F4 WhatsApp, F3 amending ADR-0034, car wash, follow links);
   - update `integrations.md` (WhatsApp hand-off, follow link, GPS simulation, demo washing team, simulated review);
   - update the backlog rows (P1, P11, P16, P17, QA-05, VIS-27);
   - update the AGENTS.md repo map and F1–F4 status;
   - append a verification-log row for the final run.
6. **Run it natively before calling anything done.** Do a simulator capture of onboarding in light and dark. Test the live document camera (permission, front camera for the selfie, frame alignment, fallback). Run a Famille trip with real location on two devices. Look at the stacked passenger home and the car-wash screens in dark mode.
7. **Before launch, after the decisions:**
   - follow-link expiry and minimisation (FS-06);
   - criminal-record consent, retention, access and audit (DS-3, DS-M1);
   - failed-handover path and admin resolution (FS-09);
   - proof freshness (FS-07);
   - wash payments in Finance and cash-fee settlement (CW-03);
   - Idempotency-Keys on Famille mutations;
   - the remaining low items in the tables above.
8. **Clean up.** Decide about `docs/tasks/`, `docs/screens/ios/`, and the unrelated `achref-dev-skill-debt*` files at the repo root. Remove the trial worktree once its branch is merged.
