# Round-2 merge plan (`feat/feedback-round-2`)

Last verified: 2026-10-16, against local git refs (origin heads confirmed with `git ls-remote` the same day).
State: open. Waiting on the owner (Achraf) and abderraouf.

## How to read this page

This page rebuilds a lost decision memo and brings it up to date.

- **[Recovered, 14 Oct]** sections reproduce `ROUND2-DECISION.md`, written on 14 Oct 2026 (about 03:08 UTC) by a
  read-only comparison workflow in the main Claude session. The file lived in the session scratchpad and was deleted when
  the scratchpad was cleared at the 16 Oct restart. Its **full text** was recovered from the session transcript (the
  assistant read the whole file back at 03:08 UTC). Only headings, links and a few words were edited. Numbers, commits and
  `file:line` references are unchanged and refer to the commits of 14 Oct: master was 02ff3d3 then. "Ours" meant 87f801d.
- **[Updated, 16 Oct]** sections are new. They use today's git and say what changed.
- The memo's evidence files (`scratchpad/round2/logs/*.log`, the P3 harnesses, `jestscratch/`, `kbc-mock.setup.js`,
  the `thumbs/` images) are lost. See [section 12](#12-what-could-not-be-recovered).
- The round-2 gate results below are a 14 Oct snapshot of a branch the [verification log](../quality/verification-log.md)
  does not cover. They are kept here because they are the memo's evidence.

---

## 1. Summary [Updated, 16 Oct]

- **The recommendation is still order C:** our work first, then abderraouf merges master into his branch and makes it
  pass CI, then the remaining features land as separate PRs.
- **Step 1 is done, and bigger than planned.** On 15 Oct the owner said "put everything on master", so master was
  fast-forwarded to `integration/trial-2026-10-14` (0a791ff). The memo planned only the chore branch (87f801d) for step
  1. Master now also holds the other chat's three features (car wash, driver sign-up, Naya Famille), the ADR-0058 "real
  app" pass and the demo-blocker fixes. The merge abderraouf faces grew from 28 files to **66 files**.
- **The branch has not moved since 12 Oct** (88e9432). Its CI problems from 14 Oct still stand.
- **New since 14 Oct:** our own redesign on `feat/passenger-polish` (local, 33 commits, not pushed) competes with
  round-2's redesign. The two use different icon libraries. If `feat/passenger-polish` lands on master first, the merge
  grows to **114 files**. Which redesign wins is now an owner decision that comes before step 2 (see
  [section 11](#11-questions)).
- **What a careless merge would undo:** the P1 handover lock, the P3 dialog fix, the P4 location lifecycle,
  the ADR-0058 copy rules and the Famille parent-approval flow. Round-2's family routes would silently answer instead of
  ours (see [section 7](#7-naya-famille-merge-plan)).

## 2. Current numbers from git [Updated, 16 Oct]

| Measure | Value | Command |
|---|---|---|
| Round-2 head | 88e9432 (12 Oct 23:45 +0100, abderraouf.z), same on origin on 16 Oct | `git ls-remote origin` |
| Commits on round-2 not on master | 57 (7 on 9 Oct, 37 on 10 Oct, 6 on 11 Oct, 7 on 12 Oct), all by abderraouf.z | `git log --oneline master..origin/feat/feedback-round-2 \| wc -l` |
| Merge base | 02ff3d3 (Arselene, 6 Oct) | `git merge-base master origin/feat/feedback-round-2` |
| Size of round-2 | 238 files, +12,670 / −2,795 | `git diff --stat master...origin/feat/feedback-round-2 \| tail -1` |
| Commits on master not on round-2 | 53 | `git log --oneline origin/feat/feedback-round-2..master \| wc -l` |
| Dry-run merge with master (0a791ff) | **66 files**: 60 content, 4 add/add, 2 modify/delete; 179 conflict hunks | `git merge-tree --write-tree --name-only master origin/feat/feedback-round-2` |
| Dry-run merge with `feat/passenger-polish` (5dc002e) | **114 files**: 103 content, 4 add/add, 7 modify/delete; 317 conflict hunks | same, with `HEAD` |

Hunks are counted as conflict-marker blocks in the tree that `merge-tree` writes. The 14 Oct memo measured with
scratch merges, so its line counts are not comparable; its file counts are.

The 66 files of the merge with master:

- **Admin (11):** `components/DocViewer.tsx`, `components/Layout.tsx`, `components/ui.tsx`, `pages/CaseReview.tsx`,
  `pages/Cities.tsx`, `pages/Finance.tsx`, `pages/Overview.tsx`, `pages/Prototype.tsx`, `pages/Providers.tsx`,
  `pages/Ticket.tsx`, `router.tsx`.
- **Driver app (13):** `(app)/(tabs)/account.tsx`, `(app)/_layout.tsx`, `(app)/family/[id].tsx` (add/add),
  `(app)/family/index.tsx` (add/add), `(app)/recharge/[id].tsx`, `(app)/recharge/index.tsx`,
  `(app)/recharge/sandbox/[id].tsx`, `(app)/ride.tsx`, `(auth)/welcome.tsx`, `docs/identity.tsx`, `docs/status.tsx`,
  `components/Dossier.tsx`, `components/DossierHub.tsx`.
- **Passenger app (11):** `(app)/(tabs)/account.tsx`, `(app)/(tabs)/index.tsx`, `(app)/_layout.tsx`,
  `(app)/family/index.tsx` (add/add), `(app)/family/plans.tsx` (add/add), `(app)/payments.tsx`, `(app)/quote.tsx`,
  `(app)/ride.tsx`, `(auth)/welcome.tsx`, `(verify)/verification-status.tsx`, `features/ride/ContactSheet.tsx`.
- **Shared packages (18):** `api/src/client.ts`; `assets/README.md`, `assets/src/images.ts`; `domain/src/entities.ts`,
  `domain/src/prototype.ts`, `domain/src/schemas.ts`; `ui/src/Form.tsx`, `ui/src/Ride.tsx`, `ui/src/WelcomeJourney.tsx`,
  `ui/src/index.ts`, `ui/src/features/{auth,capture,prototype,support}.tsx`, `ui/src/features/uploads.ts`.
- **Demo API (10):** `src/app.ts`, `src/seed.ts`, `src/services/{auth,cities,finance,prototype,support,timers,uploads}.ts`,
  `test/prototype.test.ts`; plus `scripts/generate-fixtures.py` (modify/delete: round-2 deleted it, master changed it).
- **Other (3 + 1):** `apps/web/components/operations.tsx`; e2e `admin-operations`, `passenger-flows`,
  `scenarios-feedback` specs; `docs/INTEGRATIONS.md` (modify/delete: master deleted it, round-2 changed it).

---

## 3. What the branch contains [Recovered, 14 Oct]

- **Who and when:** 57 commits by abderraouf.z between 9 and 12 Oct (37 of them on 10 Oct), based on 02ff3d3.
- **Size:** 238 files, +12,670 / −2,795.
- **Content:** the client's second feedback round plus a full redesign.
  - Look: cream background, solid buttons, capsule tab bar; redesigned passenger, driver and admin screens; admin dark
    mode.
  - Features: its own categories, Naya Famille (hub, child editor, plans, trip stepper, automatic alerts), SOS with
    hold-to-trigger and real phone actions, disputes, pluggable payment providers, and a `/securite` admin page.
  - Media and fixes: full-bleed photo onboarding (Pexels), vector art in place of the AI PNGs, lucide icons swapped for
    iconsax, the DateField fix plus DatePickerSheet, and Fabric crash fixes.
- **We had never seen it** before this pass.

## 4. CI state

### [Recovered, 14 Oct] Gates, run in a scratch worktree at 88e9432

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Pass: lockfile up to date, supply-chain check passed (1275 entries), exit 0 |
| `pnpm typecheck` | Pass: 10/10 packages |
| domain tests | Pass: 36/36 |
| demo-api tests | Pass: 72/72 (master then: 51) |
| admin build | Pass |
| `CI=1 pnpm --filter @naya/passenger test` | **Fail: the suite does not run, 0 of 15 tests execute.** `Form.tsx:12` imports DatePickerSheet, which imports BottomSheet, which imports `react-native-keyboard-controller`, and jest has no mock for it. Introduced by 88e9432. With the mock added: 14/15 pass. The Button loading-label test still fails after the redesign. |
| `expo lint` passenger | **Fail: 2 errors, 67 warnings** (master then: 0 errors, 5 warnings). Errors at `profile.tsx:32` (setState in an effect) and `quote.tsx:471` (unescaped entity). |
| `expo lint` driver | **Fail: 1 error**, 52 warnings. Error at `withdraw/index.tsx:30` (setState in an effect). |
| `gen-api-reference --check` (our CI step) | Would fail: round-2 adds 13 routes. Not run; inferred from the route diff. |
| P3 reproduction (jsdom) | **Fail.** In an admin dialog, after typing « Motif » only "M" lands; focus jumps to « Fermer » and the rest is lost. Our `ui.tsx` keeps all 5 characters. |

Verdict: the code is sound where it compiles, but the branch is **not CI-green**. It needs the jest mock, a fix or update
for the Button test, the 3 lint fixes and a regenerated API reference. None of this could be enforced on 14 Oct, because
CI existed only on our branch.

### [Updated, 16 Oct]

- The branch has not changed, so the results above still describe it. They were not re-run on 16 Oct.
- CI (`.github/workflows/ci.yml`) is now on master. The first run on GitHub was the push of 0a791ff on 15 Oct; its
  result has not been reported back.
- Once round-2 merges master, master's CI runs on it: the jest mock, the Button test, the 3 lint errors and the API
  reference all have to be fixed before it lands.

---

## 5. Comparison with our work: the Keep table

### [Recovered, 14 Oct]

"Ours" means 87f801d (P-fixes plus CI and docs). The Keep column is the default for the merge.

| Item | Ours (87f801d) | Round-2 (88e9432) | Keep |
|---|---|---|---|
| **P1** Famille codes, wrong-code lock | e9800c3: the code field is left out of the driver payload, the phone too; `HANDOVER_MAX_ATTEMPTS=5` with a lock, audit and tests | Code sent as `''` (`prototype.ts:280`), recipient phone sent and shown to the driver (ui `prototype.tsx:1546`), **no attempt limit** (`prototype.ts:934`) | **Combine:** round-2's flow plus our lock and our narrower driver view (no code field, no phone) |
| **P2** SOS desk and permission | `/sos` page, `GET /admin/prototype/alerts`, forward-only statuses, resolution note required | `/securite`, `GET /admin/safety/alerts`, any status to any status, canned notes (`Safety.tsx:16`) | **Round-2's page and route**, plus our server rules (forward-only, real note, a separate "note" action). Drop `Sos.tsx`. |
| **P3** admin dialog typing | b50c6fe: effect deps `[open]`, onEscape held in a ref, first focus on the first field, keyboard e2e | Unchanged trap (`ui.tsx:305-331`, deps at `:329`); the « Fermer » button (`:361`) now takes focus. **Worse than master.** | **Ours**, inside round-2's restyled Dialog. Initial focus must skip « Fermer ». Adapt the e2e to the Finance test IDs. |
| **P4** driver location lifecycle | 35096cb: `useRideTracking` in `_layout`, sign-out stops it, server refuses updates when the driver is off duty | Still tied to the ride screen (`ride.tsx:48`, `:54`, `:57`) | **Ours.** Keep round-2's family-trip stream in `_layout` as well. |
| **P10** ticket outcomes | Fixed list (`TICKET_OUTCOMES`), no default | Explicit Résoudre / Rejeter plus a `decision` field (`Ticket.tsx:44`, `:62-63`; `schemas.ts:232`) | **Round-2.** Drop our label map (it would return 422 for round-2's labels). Keep our `isTicketClosed` for the overview count (`app.ts:696`). |
| **P12** catalog editor | Generic editor in `Prototype.tsx` | Dedicated editors (CategoryEditor, CatalogEditors), `toCentimes`, null fares, ids locked | **Round-2.** Drop our hunks and our P12 e2e. |
| **P13** DateField | No value until the date is complete; impossible-date message; 4 tests | lastEmitted ref and a picker; sends partial digits; no message, no tests | **Round-2's field and picker**, plus our message. Port the tests, adapted. |
| **P15** dark-mode literals | Tokens on welcome, home, ride pill, picker | Fixed independently; photo onboarding on a fixed dark scrim | **Round-2.** Optionally move 2 hairlines to `colors.line`. |
| Masked-call copy (ADR-0031) | Promise removed in 4 places | Kept in 5 places (`ContactSheet.tsx:14`, driver `ride.tsx:217`, both `phone.tsx`), plus a new Famille sheet | **Ours.** Patch the new sheet too. |
| Duplicate demo card provider | `prototypeProviders` dedupe | `migrateProviders` / `defaultProviders` (`payments.ts:230-262`) | **Round-2** |
| Icons | lucide (`Sos.tsx`, `Overview.tsx`, `Layout.tsx` and others) | lucide removed, iconsax wrappers added | **Round-2.** Port our imports; add Siren, UserCheck and LifeBuoy, or map them. |
| CI, PR template, CODEOWNERS, root scripts, `.nvmrc`, e2e webServer | 083db77 | none | **Ours** |
| Website stopgap | 355c1b1 | icon swaps only; `/backoffice` links still shown | **Ours** |
| Docs foundation | 87f801d | edits `docs/INTEGRATIONS.md`, which we moved (modify/delete conflict) | **Ours**, then a refresh after the merge |
| P8 commission precedence | open | still there (`rides.ts:138`) | Neither; D6 decision |
| P9 demo gating | open | still there; the new wallet tab, payments and SOS screens add more ungated simulations | Neither; fix on top of round-2 |
| P11 cash cancellation fee | open | still there (`rides.ts:450-473`) | Neither; D7 decision |

Two hidden breaks that a plain merge does not flag as conflicts:
- `Sos.tsx` still imports lucide, which round-2 removed, so the admin build fails.
- `safety.respond` appears twice in `AdminPermission` (`entities.ts`).

### [Updated, 16 Oct] What changed per row

| Item | Status on 16 Oct |
|---|---|
| P1 | Our lock and narrow driver view are on master (e9800c3, plus e2d1d7e, which restored the lock after the Famille merge). Round-2 still has no limit. Keep unchanged. |
| P2 | Unchanged. `apps/admin/src/pages/Sos.tsx` is on master and does not exist on round-2, so it still breaks the admin build after the merge unless it is ported or dropped. |
| P3, P4, P10, P12, P13 | Unchanged. Our versions are on master. |
| P15 | **Changed.** Dark mode was reworked on `feat/passenger-polish` (7f5ecde, c951f54, e3e93a3, d2fa271, fc6f88c: scheme resolved before the first frame, scheme-aware tokens, an AST guard test; backlog DM-01 to DM-21). "Keep round-2" no longer holds for mobile theming. Round-2's admin dark mode is a separate item and can still be kept. |
| Masked-call copy | Ours on master. On `feat/passenger-polish`, R8 also hides the call and message rows until they are live. |
| Icons | **Changed, and now an owner decision.** The 14 Oct row was about the admin. On `feat/passenger-polish`, ADR-0059 (Accepted) builds the mobile status icon system on lucide: 48 files in `packages/ui`, `apps/passenger` and `apps/driver` import `lucide-react-native`. Round-2 removed lucide from both apps and uses `iconsax-react-nativejs` in `packages/ui`. On master, 11 admin files import lucide. Round-2's versions of 10 of them have none. |
| CI, website stopgap, docs foundation | On master. Round-2 still edits `docs/INTEGRATIONS.md` (modify/delete). |
| P9 | **Changed.** ADR-0058 (on master) removed visible simulations from the apps and admin. Round-2's ungated « Simuler » buttons and its SOS wording now break an Accepted ADR, not just a backlog item. |
| P8, P11 | Unchanged, still waiting on D6 and D7. |
| SOS gesture | **New overlap.** Round-2 has hold-to-trigger SOS. `feat/passenger-polish` has its own (R10: hold 1.5 s on a full-width button, pinned safety disc, copy true per mode). Pick one. |

---

## 6. What round-2 would undo

[Recovered, 14 Oct] unless marked. Taking round-2's side wholesale in the conflicted files would:

1. **Remove the P1 lock:** no wrong-code limit, the code sent as `''`, and the recipient's phone shown to the driver.
2. **Bring back P3:** admin dialogs lose typed text (worse than before our fix).
3. **Undo P4:** driver location tied to the ride screen again.
4. **Bring back the masked-number promise** (« Vos numéros restent masqués ») in 5 places, though no masking exists.
5. **Bring back ungated simulations** (P9): the wallet's « Simuler la confirmation / le refus » buttons and the
   passenger self-resolve route.
6. **Make SOS claim a desk in every build:** « position et trajet transmis à l'équipe sécurité » even in standalone
   builds where no desk exists (ui `prototype.tsx:217`; ADR-0035 rule 7).
7. **Replace the Famille safety flow** through the route-shadowing hazard (section 7): no parent approval, no lock.
8. **Bring back Pexels onboarding photos** that break the founder's brief (section 8b).
9. **Rename the driver app « Naya Conductrice »** (`app.config.ts:6`, 21d9735). Prebuild probably renames the Xcode
   scheme, which would break the archive commands in [testflight-eas.md](../runbooks/testflight-eas.md). Not verified.

[Updated, 16 Oct] Also at risk now that master holds more:
- **ADR-0058:** any-code sign-in in mock mode (927137e), the self-confirm route closed outside dev mode (88b49c1, API-03),
  the « Vérification automatique » reviewer (edc5cd3) and the no-demo-wording copy, all in files round-2 also edits
  (`auth.ts`, `app.ts`, `prototype.ts`, the ui features).
- **The demo-blocker fixes on master** (CW-01, CW-02, DS-1, DS-2) live in files round-2 never touched, but `app.ts` and
  `seed.ts` conflict, so taking "theirs" there could drop their wiring. The guard is their tests.
- **`docs/INTEGRATIONS.md`** would come back (master replaced it with [integrations.md](integrations.md)).
- **In-place store migrations** on round-2 may reverse ADR-0029 (« Write no migrations »); open since 14 Oct.

---

## 7. Naya Famille merge plan

### [Recovered, 14 Oct] The only real functional duplicate

| | Fork (trial 7393e27, from `feat/famille-safety`) | Round-2 (fc154fb, 3887894, a0fc59b) |
|---|---|---|
| Server rules | One guard, `assertFamilyStep` (domain `famille.ts:79-125`). Parent-approved start (180 s, at most 3 requests). Pick-up photo required. School drop-off photo within 300 m plus the code. 5-code lock (e2d1d7e). | `FAMILY_NEXT` machine. The driver starts the trip with no parent approval. Pick-up photo optional. No drop-off photo, no geofence. **No lock.** |
| Driver eligibility | Famille-only vetting with the criminal-record extract (`signup.ts:157-163`) | Any verified driver, plus an admin availability toggle |
| Screens | One list page; typed date and time fields; old design | Hub, child editor with photo, 14-day strip, stepper; new design |
| Extras | WhatsApp, police and co-parent follow link; 1 s GPS | Late, unusual-stop and long-trip alerts; child editing; subscription admin; 30 s track sampling |
| Merge hazard | n/a | Both register the same `/prototype/family/*` paths. `mountPrototypeRoutes` is mounted first (merged `app.ts:243-244`), so **round-2's handler wins silently**: no approval, no lock. |

**Recommendation: combine.** The fork's domain guard and `famille.ts` routes become the only backend. Round-2's screens
are rebuilt on top of them, and round-2's alerts, child editing and admin controls are ported.
- Delete round-2's family routes and its `runFamilyTimers` from `prototype.ts`.
- Store the child photo under a private upload purpose. Round-2 uses `support_attachment`, which support agents can read.
- Prove that only one handler answers: re-run `famille.test.ts` and the e2e `scenarios-famille` #2 on the merged build.

### [Updated, 16 Oct] The hazard, checked on today's code

- On master, `services/demo-api/src/app.ts:227` calls `mountPrototypeRoutes` and line 228 calls `mountFamilleRoutes`.
  The order still makes round-2's handlers win once its `prototype.ts` is merged in.
- **Seven paths are registered on both sides:** `GET /prototype/family`, `POST /prototype/family/children`,
  `POST …/subscribe`, `POST …/trips`, `POST …/example`, `POST …/trips/:id/advance`, `POST …/trips/:id/incident`.
  `advance` carries the approval step and the lock, so the hazard hits exactly the safety rules.
- **Round-2 only:** `PUT /prototype/family/children/:id` (child editing), `POST …/trips/:id/location`,
  `POST …/trips/:id/stop`. These are the routes to port.
- **Ours only:** trip detail and live, `position`, `approval`, `cancel`, `calls`, `call-request`, `guardians`,
  `guardians/:id/:action`, `follow/:token`.
- Round-2 still uploads child and proof photos as `support_attachment` (ui `prototype.tsx:1070`, `:1480`, `:1511`) and
  runs `runFamilyTimers` from `services/timers.ts:11`.
- The four Famille route files are add/add conflicts: `apps/{passenger,driver}/src/app/(app)/family/index.tsx`, driver
  `family/[id].tsx` and passenger `family/plans.tsx`.
- **Screens:** "round-2's screens on our engine" was the 14 Oct plan. Since then, `feat/passenger-polish` redesigned our
  Famille screens (87282c3: one tone table, an approval banner, the trip screen). Which screens to keep follows the
  redesign decision in [section 11](#11-questions).

Steps, in order:
1. Keep `famille.ts` and the domain guard as the only Famille backend. Remove round-2's family handlers and
   `runFamilyTimers` from `prototype.ts` and `timers.ts`.
2. Port round-2's late, unusual-stop and long-trip alerts as server timers on our trip model, and its child editing
   (`PUT …/children/:id`) and subscription admin.
3. Add a private upload purpose for child and proof photos, readable only by the parent and the role that D3 names.
4. Resolve the four add/add route files on the chosen screens. Keep the masked codes and the « Approuver le départ »
   path from 6f263a6.
5. Gates: `famille.test.ts`, the P1 lock tests, the Famille e2e specs, and a check that each `/prototype/family/*` path
   has exactly one handler.
6. Still waiting on D3 (Famille at launch), so these blockers stay open: FS-01, FS-03, FS-10 (see section 10).

---

## 8. The other duplicates [Recovered, 14 Oct]

### 8a. Driver dossier and sign-up

| | Fork (`feat/driver-signup` 6379115..14af9ed) | Round-2 (533e2ab, 51a179d) |
|---|---|---|
| Function | 30 one-question steps, 15 document types, per-document statuses, server-side save and resume, Famille opt-in. This is task 2 of the brief, item by item. | Visual only: a progress-ring overview, step cards, a plum capture stage. Same 7 documents, no new fields. |
| Capture | One guide per document plus a live camera (CaptureGuide, LiveCamera) | 3 generic tips and a privacy note |

**Recommendation: keep the fork's flow** and restyle it with round-2's visuals: the progress ring, extended to 3
sections and fed by `dossierOverview()`; the fork's guides and live camera inside round-2's plum stage. This is not a
functional duplicate.

### 8b. Onboarding photos

| | Fork (a0b82dc) | Round-2 (74462d5, slide text from f2e038d) |
|---|---|---|
| Images | 3 GPT Image photos that follow the founder's brief, cropped to 940×1100 | 5 Pexels stock photos, 9:16 |
| Layout | Photo inside the stage, title below | Full-bleed photo, white title. The founder's 13 Oct brief was written against this layout and text. |
| Problems | In the full-bleed layout the crop keeps about 54 % of the width: the mother and the back-seat passengers are cut off | Break the brief: a US street, a showroom sign with text, lettering on a jacket, a forest, and two women outside the casting rule |

**Recommendation: combine.** Keep round-2's layout and slide text. Put the fork's 3 images on the slides they were
written for, re-exported at 9:16. Commission 2 more photos. Record the source in CREDITS.md. Discard the uncommitted
photo edits in the main checkout.

[Updated, 16 Oct] The photo set changed on 15 Oct: the owner generated 10 images, and `feat/passenger-polish` now uses
them on every onboarding slide (0e62877; slide 3 is the school gate). They are 940×1100, not 9:16, so round-2's
full-bleed layout would need new 9:16 exports. Both earlier photo commissions are covered; the Pexels set should still
go.

---

## 9. Landing order

### [Recovered, 14 Oct]

Conflict counts on 14 Oct came from `git merge-tree --write-tree` and from scratch merges that were then aborted:
- round-2 vs chore: **28 files**, 65 hunks, 1,374 conflict lines.
- round-2 vs trial: **52 files**, 127 hunks, 4,227 lines, including 4 add/add Famille routes and a modify/delete on
  `generate-fixtures.py`.

The 28 files are the same whichever side lands first.

| | A. Round-2 first | B. Ours first: chore plus trial | **C. Chore now, round-2 second, fork features third** |
|---|---|---|---|
| Steps | Round-2 fixes its gates and fast-forwards master. Then we merge master into chore, then the trial features. | Chore and trial fast-forward master. Then round-2 merges master. | 1) Chore fast-forwards master, and CI is on. 2) Round-2 merges master. 3) Car wash, sign-up and Famille are re-ported as 3 PRs. |
| Conflicts | 0, then 28 files / 65 hunks for chore, then about 62 more hunks for the features (52 files / 127 hunks in total) | 0, then 52 files / 127 hunks / 4,227 lines in **one merge** | 0, then 28 / 65 / 1,374, then about 62 hunks / ~2,850 lines split over 3 PRs (approximate) |
| Effort | 10–14 h, then 20–30 h | 30–45 h in one block (4–6 days) | 0, then 10–14 h, then about 25–35 h (car wash 3–5, sign-up 6–8, Famille 14–20) |
| Risk | Master gets a CI-red branch with no CI gate, plus the P3 keystroke loss, no P1 lock, the « live » SOS wording and the masking promise. We resolve conflicts in code we did not write. Our own branch, which the owner asked to land, waits. | The largest single merge. abderraouf resolves code he has never seen, and must pick a Famille engine before his work can land. Round-2 is blocked for days. The same-path route hazard is easy to miss. | Our P-fixes could be lost if "theirs" is taken wholesale; the guard is that the tests must pass (P3 keyboard e2e, P1 lock tests, `location.test.ts`). The trial's e2e pass has to be re-earned feature by feature. |
| Who | Us | abderraouf | 1) Achraf merges the PR. 2) **abderraouf** resolves, using the Keep column; we review (CODEOWNERS). 3) Us, with abderraouf reviewing design fidelity. |

**Recommended: C.** It is the order the owner asked for (land our branch), it costs zero conflicts now, it puts CI on
master before round-2 arrives (so round-2's jest, lint and API-reference failures must be fixed before it lands), it
gives the round-2 merge to the person who knows that code, and it keeps the product decisions (Famille, sign-up,
imagery) out of round-2's critical path.

### [Updated, 16 Oct] Where order C stands

1. **Step 1, done on 15 Oct, but as B's first half.** Master was fast-forwarded to the trial (0a791ff), so the fork's
   features landed on master directly instead of waiting for step 3. The owner asked for it ("put everything on
   master"). Effect: abderraouf's merge is now 66 files (B's shape), not 28.
2. **Before step 2, two owner calls:**
   - which redesign wins (round-2's cream and iconsax, ours from ADR-0059 on lucide, or a blend);
   - whether `feat/passenger-polish` lands on master first. That is already recommended so the next build matches a
     GitHub commit, but it raises the merge to 114 files.
3. **Step 2:** abderraouf merges master into `feat/feedback-round-2`, applies the Keep table (both parts of section 5)
   and the Famille plan (section 7), and makes master's CI pass. We review the CODEOWNERS paths.
4. **Step 3 changes meaning.** The three features are already on master, so there is nothing to re-port from the trial.
   Step 3 now means restyling them to the chosen design and porting round-2's remaining items as separate PRs.

**For discussion, not decided:** with 114 files and two competing redesigns, merging the whole branch may cost more than
porting round-2's distinct items onto master one PR at a time: the ticket decision model (P10), the catalog editors
(P12), DatePickerSheet (P13), the provider migration, `/securite` with our server rules, the Famille alerts and child
editing, admin dark mode, disputes, the payment providers and the Fabric crash fixes. abderraouf should weigh in. The
14 Oct effort estimates are stale and were not redone.

---

## 10. Demo blockers under order C

### [Recovered, 14 Oct]

| Blocker | Code (fork-only unless noted) | Under C |
|---|---|---|
| **CW-01** 5-minute free cancellation never applies to « Maintenant » | domain `carWash.ts:156`, `:404` | Still applies. Fork-only files, so the fix ports unchanged. Do it now. |
| **CW-02** unreviewed drivers can book a wash | services `carWash.ts:139-142` | Still applies. Do it now. |
| **CW-04** « Maintenant » offered at night | `carWash.tsx` | Still applies. Do it with the re-port. |
| **DS-1** dev "simulate review" acts as a real admin | `/dev/verification/:id/simulate` | Still applies. Server-only; round-2 never touched it. Do it now. |
| **DS-2** submit does not re-validate the draft | `submitCase` | Still applies. Do it now. |
| **FS-01** dev controls fake the parent's consent and cancel other parents' trips | `famille.ts:416-430`, `472-476`, `749-760` | Applies if the fork's engine is kept (recommended). |
| **FS-03** GPS falls back to the simulation; the geofence uses it | domain `famille.ts:176-247` | Applies if the fork's engine is kept. Round-2 has the same class of problem (`prototype.ts:605-631`) but no geofence depends on it. |
| **FS-10** « Police 19 » says support is informed, but no alert is raised | `famille.ts:646-651` | Still applies, whichever desk survives. Create a SafetyAlert with `familyTripId`. |
| **FS-11** driver screen claims her position is shared every second | FamilleTripScreen | Moot as code if round-2's trip screen replaces it. Carry the rule over. |
| **FS-04** no adult preselected at drop-off | FamilleTripScreen | Moot as code. Re-check round-2's recipient picker. |
| P1 lock (fixed on the trial, e2d1d7e) | `famille.ts` | Must survive the Famille consolidation. Round-2 has no lock. |

New demo blockers that round-2 brings (fix in step 2, or before any demo built from it): P3; SOS desk wording in every
build; Famille phone shown and no code limit; the masked-number promise in 5 places; ungated « Simuler » buttons and the
self-resolve route; the Pexels photos; the « Naya Conductrice » rename.

### [Updated, 16 Oct] Status

| Blocker | Status | Where |
|---|---|---|
| CW-01, CW-02, DS-1, DS-2 | Fixed | master (3690b95, 9f2352b, d689e99, 3885da8, f5fdb57) |
| API-03 self-confirm route | Fixed (dev mode only) | master (88b49c1) |
| CW-04 | Fixed | `feat/passenger-polish` (59f9cf9) |
| P1 lock | Fixed | master (e9800c3, e2d1d7e) |
| FS-01, FS-03, FS-10 | Open, waiting on D3 | [backlog](backlog.md) |
| FS-04, FS-11 | Open | [backlog](backlog.md) |
| Round-2's new blockers | Open on round-2 | this page, section 6 |

---

## 11. Questions

### [Recovered, 14 Oct] For Achraf and the team

1. **Order.** Do you approve C: land chore now, round-2 merges master and must pass CI, then the fork's features land as
   3 PRs, with the trial no longer the merge candidate? Do you accept the Keep column as the default, including
   round-2's `/securite` with our server rules and round-2's ticket decision model?
   *(16 Oct: overtaken. The owner put the whole trial on master on 15 Oct. The Keep column is still unanswered.)*
2. **Owner.** Will abderraouf own the merge of master into his branch, with us reviewing? Does he know the branch is
   CI-red (the jest suite does not run, and there are 3 lint errors)?
3. **Next demo.** Which build is it, and when: round-2's redesign, or the trial (old design plus the new features)?
   *(16 Oct: the next build is planned from `feat/passenger-polish` after it merges into master.)*
4. **Naya Famille (D3).** Should there be one engine: the fork's server (parent approval, photos, 300 m check, 5-code
   lock, Famille vetting) under round-2's screens, with no recipient phone shown to the driver?
5. **Onboarding (D11).** Should we use round-2's layout and text with our GPT Image photos at 9:16, plus 2 new ones, and
   drop the Pexels photos? That reverses round-2's « no generated imagery » rule (5e5345c).
6. **Round-2 housekeeping, for abderraouf.**
   - Is « Naya Conductrice » intended?
   - May the client PDF stay at the repo root (D14)?
   - Was npm run in `apps/web` (`package-lock.json` was edited)?
   - Are the in-place store migrations meant to reverse ADR-0029 (« Write no migrations »)?

### [Updated, 16 Oct] New questions

7. **Which redesign wins?** Round-2's (cream background, solid buttons, capsule tab bar, iconsax) or ours (ADR-0059
   status icons on lucide, the 15 Oct redesign, dark-mode rework), or a blend? This decides most of the 114 files.
8. **Icon library.** ADR-0059 is Accepted and built on lucide; round-2 removed lucide. Keep lucide, move to iconsax, or
   map one to the other?
9. **Land `feat/passenger-polish` before abderraouf merges?** Recommended for the build, but it makes his merge 114 files
   instead of 66.
10. **Whole-branch merge, or item-by-item ports?** See the end of section 9.
11. **Has abderraouf been told?** It was on the owner's 15 Oct to-do list; no reply is recorded.
12. **Did the first CI run on master pass?** No result was reported back.
13. **SOS gesture:** round-2's hold-to-trigger or ours (R10, 1.5 s hold)?

---

## 12. What could not be recovered

- The memo's evidence files: the gate logs (`logs/*.log`, `install.log`), the P3 jsdom harnesses (`p3/`, `p3ours/`), the
  jest scratch folder and `kbc-mock.setup.js` (the `react-native-keyboard-controller` mock), and the onboarding crop
  thumbnails (`thumbs/fork-fullbleed-390x844.png`, `thumbs/r2-*.jpg`). They can be regenerated by re-running the gates in
  a scratch worktree at 88e9432.
- The memo's exact formatting. The text is complete, but headings and a few phrases were adapted to this page.
- The exact line-count method of 14 Oct (scratch merges). Today's numbers use `git merge-tree` hunks only.
