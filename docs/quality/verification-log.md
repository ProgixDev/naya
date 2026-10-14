# Verification log

Every recorded run of a quality gate or a manual check, oldest first. This is the only place where test counts live;
build numbers live in the build log of [testflight-eas.md](../runbooks/testflight-eas.md#build-log). Other docs link
here instead of copying numbers. What each layer covers: [testing-strategy.md](testing-strategy.md).

## Rules

- **Append only.** Add rows at the bottom. Never edit or delete a row; if a row is wrong, add a new row that says so.
- **One row per command** (or per manual check), run from the repo root unless the command says otherwise.
- **Date**: the day of the run (Africa/Casablanca). **Commit**: the short hash of HEAD; add `+ local changes` when the
  working tree was not clean. **Result**: pass or fail, with counts. **By**: the person, or the agent session.
- **Historical rows** were copied from older docs on 2026-10-13 and were not re-run. They are marked
  "historical, as reported", with their source. Their Date is the date the source gives, and their Commit is the commit
  of the source doc: the exact commit each run used was not recorded. The README table "Verification (30 September 2026)" was
  written in a7bf4b0 (30 Sep, 23:36); its component-test row and its 39/39 e2e row were added in 5e907b4 (1 Oct, 00:53).
- Name the e2e project or spec when you run part of the suite. Write "not run" when a gate was skipped, with the reason.

## Log

| Date | Commit | Command | Result | By |
|---|---|---|---|---|
| 2026-09-30 | 5e907b4 | Typecheck (`tsc --noEmit`) in domain, api, tokens, ui, demo-api, passenger, driver, admin | all clean | historical, as reported (README.md "Verification (30 September 2026)" at 5e907b4) |
| 2026-09-30 | 5e907b4 | Domain unit tests (`packages/domain`) | 36/36 passed | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | API scenario tests (`services/demo-api`, S01–S16) | 36/36 passed | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | Component interaction tests (`apps/passenger`, jest-expo) | 14/14 passed | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | Playwright e2e: passenger, driver, admin, cross-role | 39/39 passed (passenger 15, driver 11, admin 11, cross-role 2) | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | `expo-doctor` (both apps), `expo install --check`, `pnpm peers check` | 21/21 checks; no mismatches; no peer issues | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | `vite build` (admin) | succeeds | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | iOS 27 Simulator Release builds, passenger and driver | build, launch and run against the demo API | historical, as reported (README.md at 5e907b4) |
| 2026-09-30 | 5e907b4 | Android build | not run: no Android SDK or emulator on the build Mac | historical, as reported (README.md at 5e907b4) |
| 2026-10-01 | 74a1c14 | TypeScript checks, all workspaces | all passed | historical, as reported (docs/STANDALONE-DEMO.md at d6a21d0) |
| 2026-10-01 | 74a1c14 | Service and integration tests (`services/demo-api`) | 43 passed, including 7 standalone tests with network fetch blocked | historical, as reported (docs/STANDALONE-DEMO.md at d6a21d0) |
| 2026-10-01 | 74a1c14 | Release JavaScript in both iOS 27 Simulator apps, app-side harness with network fetch blocked | stale-session recovery, OTP, local sign-in, bundled documents and profile persistence checked | historical, as reported (docs/STANDALONE-DEMO.md at d6a21d0) |
| 2026-10-01 | 74a1c14 | Passenger native check (standalone) | trip with a simulated driver completed, payment confirmed, scheduled booking created and cancelled | historical, as reported (docs/STANDALONE-DEMO.md at d6a21d0) |
| 2026-10-01 | 74a1c14 | Driver native check (standalone) | offer received, trip and cash collection completed, withdrawal confirmed after a runtime restart without double debit | historical, as reported (docs/STANDALONE-DEMO.md at d6a21d0) |
| 2026-10-01 | 74a1c14 | Both apps' home screens after local sign-in, Mac demo server stopped | loaded | historical, as reported (docs/STANDALONE-DEMO.md at d6a21d0) |
| 2026-10-06 | 89aae18 | TypeScript: passenger, driver, admin, demo API, shared UI, API, domain, tokens, assets | passed | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18, "Fresh verification") |
| 2026-10-06 | 89aae18 | Expo lint, passenger and driver | 0 errors, 5 warnings in each app | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | Domain tests | 36 passed | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | API tests | 51 passed | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | Mobile UI tests (jest-expo) | 15 passed | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | Connected feedback walkthrough in the passenger, driver and admin browser apps | passed | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | Selected existing browser regressions | 5 scenarios passed; the saved-address case passed on a rerun after a preview reload. The rest of the e2e suite was not run. | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | Admin production build | passed | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | iOS Hermes bundle export, passenger and driver | succeeded | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-06 | 89aae18 | Native walkthrough, iPhone 18 Pro Simulator, iOS 27.0 (refreshed JS in copies of the signed simulator binaries) | passed after fixing a missing driver appearance selector | historical, as reported (docs/MOBILE-FEEDBACK-DEMO.md at 89aae18) |
| 2026-10-13 | 89aae18 + local changes | `pnpm typecheck` | pass: 10/10 packages, exit 0, 11.5 s | full audit (Claude), [audit 7.1](../audits/2026-10-13-full-audit.md#71-gate-results) |
| 2026-10-13 | 89aae18 + local changes | `pnpm --filter @naya/domain test` | pass: 36/36 tests in 4 files | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `pnpm --filter @naya/demo-api test` | pass: 51/51 tests in 3 files | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `CI=1 pnpm --filter @naya/passenger test` | pass: 15/15 tests, 1 suite | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `node --test tests/store.test.mjs` in apps/web | pass: 4/4, with a MODULE_TYPELESS_PACKAGE_JSON warning | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `npx expo lint` in apps/passenger | pass: 0 errors, 5 warnings | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `npx expo lint` in apps/driver | pass: 0 errors, 5 warnings | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `eslint -c apps/passenger/eslint.config.js packages/ui/src services/demo-api/src packages/domain/src packages/api/src apps/admin/src` (not a gate) | fail: 22 errors, 10 warnings | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `pnpm test` (root; at that commit it also ran @naya/e2e) | fail unless the four e2e servers are running | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `pnpm peers check --lockfile-only` | 1 issue: react-reconciler@0.34.0 wants react ^19.3.0 (installed 19.2.3) | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | `pnpm e2e` | not run: the audit was read-only and started no servers | full audit (Claude) |
| 2026-10-13 | 89aae18 + local changes | Playwright `apps/web/tests/prototype.spec.ts` | not run: no script runs it | full audit (Claude) |
| 2026-10-13 | c38429d | `pnpm typecheck` | pass: 10/10 packages | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d | `pnpm --filter @naya/domain test` | pass: 36/36 | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d | `pnpm --filter @naya/demo-api test` | pass: 51/51 | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d | `CI=1 pnpm --filter @naya/passenger test` | pass: 15/15 | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d | `node --test tests/store.test.mjs` in apps/web | pass: 4/4 | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d | `npx expo lint` in apps/passenger | pass: 0 errors, 5 warnings | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d | `npx expo lint` in apps/driver | pass: 0 errors, 5 warnings | audit post-sync re-run (Claude); as reported in the docs brief, no log kept |
| 2026-10-13 | c38429d + local changes | `pnpm typecheck` | pass: 11/11 packages (now includes @naya/e2e), exit 0 | Gates agent (Claude), after the parallel fixes |
| 2026-10-13 | c38429d + local changes | `pnpm --filter @naya/domain test` | pass: 36/36 tests in 4 files | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `pnpm --filter @naya/demo-api test` | pass: 62/62 tests in 4 files (embedded 7, location 6, prototype 12, scenarios 37) | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `CI=1 pnpm --filter @naya/passenger test` | pass: 20/20 tests, 1 suite | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `node --test tests/store.test.mjs` in apps/web | pass: 8/8, with the MODULE_TYPELESS_PACKAGE_JSON warning | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `npx expo lint` in apps/passenger | pass: 0 errors, 5 warnings | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `npx expo lint` in apps/driver | pass: 0 errors, 5 warnings | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `pnpm --filter @naya/admin build` | pass | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `pnpm --filter @naya/web build` | pass (Next.js 16.3.8, webpack); `/` has no link to /backoffice | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `pnpm test` (root; skips @naya/e2e) | pass: 10 of 12 projects in scope, web 8, domain 36, demo-api 62, passenger 20 | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `pnpm e2e` (servers started by the new `webServer` block, ports free beforehand) | pass: 42/42 in 6.2 min (passenger 15, driver 11, admin 13, cross-role 3), no retries | Gates agent (Claude), run 1, after updating the Famille field label in scenarios-feedback.spec.ts |
| 2026-10-13 | c38429d + local changes | `pnpm e2e` | pass: 42/42 in 5.5 min, no retries; servers stopped by Playwright afterwards | Gates agent (Claude), run 2, after the follow-up fixes |
| 2026-10-13 | c38429d + local changes | Playwright `apps/web/tests/prototype.spec.ts` with a scratch config (`next start -p 3100` on the build, bundled Chromium; :3000 was taken by another project) | pass: 5/5 | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | `curl` of `/backoffice` on `next start` (browser UA and `facebookexternalhit`) | `<meta name="robots" content="noindex, nofollow"/>` inside `<head>` for both | Gates agent (Claude) |
| 2026-10-13 | c38429d + local changes | iOS and Android builds, devices | not run: no simulator or device in the Gates run | Gates agent (Claude) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | (note) rows above marked `c38429d + local changes` by the Gates agent | they are the final gate and e2e results for this working tree (branch `chore/docs-foundation-and-fixes`); not re-run, and not copied again to avoid duplicate counts | Claude (docs reconciler) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | `node scripts/docs/gen-api-reference.mjs --check` | pass: up to date, 130 routes | Claude (docs reconciler) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | relative-link and anchor check (scratch script) over `docs/**/*.md` except audits and tasks, the root `AGENTS.md`, `CLAUDE.md`, `README.md` and the per-folder `AGENTS.md` / `CLAUDE.md` | pass: 948 links in 105 files, 0 broken, after the last docs edit (links to the not-yet-generated `docs/adr/README.md` excluded) | Claude (docs reconciler) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | onboarding photos: `pnpm typecheck` | pass: every package | Claude (onboarding photos) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | onboarding photos: `CI=1 pnpm --filter @naya/passenger test` | pass: 20/20 | Claude (onboarding photos) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | onboarding photos: `pnpm lint` | pass: 0 errors, 5 warnings | Claude (onboarding photos) |
| 2026-10-13 | c38429d + working tree (chore/docs-foundation-and-fixes) | onboarding photos: passenger Expo web on :8091, `/welcome?preview=1` at 375 × 812, slides 1 and 3 inspected | pass: photo fills the stage, faces in frame, label readable; driver slide 1 not opened (same component and code path) | Claude (onboarding photos) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm install --frozen-lockfile --prefer-offline` | pass: lockfile unchanged | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm typecheck` | pass: 11/11 packages | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm --filter @naya/domain test` | pass: 93/93 (7 files) | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm --filter @naya/demo-api test` | pass: 89/89 (7 files) | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `CI=1 pnpm --filter @naya/passenger test` | pass: 22/22 (2 suites) | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm --filter @naya/web test` | pass: 8/8 | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm lint` | pass: 0 errors; 5 warnings (passenger), 3 (driver), all pre-existing unused imports | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm --filter @naya/admin build` | pass | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `node scripts/docs/gen-api-reference.mjs --check` | pass: up to date, 156 routes | Claude (integration trial) |
| 2026-10-14 | a0b82dc (integration/trial-2026-10-14) | `pnpm e2e` | not run: left to the e2e agent; no browser walk or native run in this session | Claude (integration trial) |
| 2026-10-14 | 833627f (integration/trial-2026-10-14) | `pnpm e2e` (servers started by the `webServer` block, ports 4010/8081/8082/5173 free beforehand) | fail: 40/42 in 6.1 min, no retries. admin-verifications S10 (stale locator: `getByText('Véhicule déclaré')` also matches the new vehicle checklist line) and scenarios-feedback (never run on feat/famille-safety: duplicate approval card, no authorised adult chosen before the code, completed text matched in the hidden list screen) | Claude (integration e2e) |
| 2026-10-14 | 833627f + spec fixes | `pnpm e2e tests/scenarios-feedback.spec.ts tests/admin-verifications.spec.ts` | scenarios-feedback re-run unchanged: same failure (deterministic); after the fixes in 63b56d3: 4/4 | Claude (integration e2e) |
| 2026-10-14 | 7509bf7 (integration/trial-2026-10-14) | `pnpm --filter @naya/e2e typecheck` | pass | Claude (integration e2e) |
| 2026-10-14 | 7509bf7 (integration/trial-2026-10-14) | `pnpm e2e` (servers started by the `webServer` block) | pass: 46/46 in 6.9 min, no retries (passenger 16, driver 12, admin 13, cross-role 5), including the new driver-signup, passenger-car-wash and scenarios-famille specs; servers stopped by Playwright afterwards | Claude (integration e2e) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `pnpm typecheck` | pass: every package | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `pnpm --filter @naya/domain test` | pass: 93/93 (7 files) | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `pnpm --filter @naya/demo-api test` | pass: 94/94 (7 files) | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `CI=1 pnpm --filter @naya/passenger test` | pass: 26/26 (3 suites, including the new packages/ui auth.test.tsx) | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `pnpm --filter @naya/web test` | pass: 8/8 | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `pnpm lint` | pass: 0 errors; passenger 3 warnings (unused imports in trips.tsx and preferences.tsx, React Compiler skip in identity.tsx; files this change did not touch), driver 0 | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `pnpm --filter @naya/admin build` | pass | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (the code committed as a05838e…83b719f) | `node scripts/docs/gen-api-reference.mjs --check` | fail: stale (line numbers in famille.ts and prototype.ts, `/prototype/wallet/:id/resolve` now a dev-mode branch); regenerated, then pass: up to date, 156 routes | Claude (ADR-0058 integration) |
| 2026-10-14 | 7393e27 + local changes (before the ContactSheet copy change) | `pnpm --filter @naya/e2e exec playwright test` (= `pnpm e2e`) with `API_URL=http://localhost:4510 PASSENGER_URL=http://localhost:8581 DRIVER_URL=http://localhost:8582 ADMIN_URL=http://localhost:5673 E2E_DATA_DIR=<scratch dir>` (servers started by the `webServer` block; the review stack on 4010/8081/8082 untouched) | pass: 47/47 in 6.8 min, no retries | Claude (ADR-0058 integration) |
| 2026-10-14 | 83b719f (integration/trial-2026-10-14) | same `pnpm --filter @naya/e2e exec playwright test` on ports 4510/8581/8582/5673, fresh `E2E_DATA_DIR` | pass: 47/47 in 6.7 min, no retries (passenger 16, driver 13, admin 13, cross-role 5); servers stopped by Playwright afterwards | Claude (ADR-0058 integration) |
