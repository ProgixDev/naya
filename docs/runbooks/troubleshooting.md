# Troubleshooting

Known failures, their cause and the fix. Most come from the [13 Oct 2026 audit](../audits/2026-10-13-full-audit.md)
(sections 6.3, 7.1–7.5) and the README build notes. Owner: build owner. Last verified: 2026-10-13.
Rows marked **Today** describe a defect that is still in the code on `chore/docs-foundation-and-fixes`; delete the row
once its fix lands. Rows that say "fixed on this branch" help anyone still on an older commit (master included); delete
them once the branch is merged. Found a new one that cost you more than ten minutes? Add a row here and one line to the
root [AGENTS.md](../../AGENTS.md) Gotchas.

## Install and tooling

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm install --frozen-lockfile` fails on a fresh clone | Someone changed a `package.json` without committing `pnpm-lock.yaml` (happened on master on 6 Oct) | Run `pnpm install`, commit the lockfile with the `package.json` change |
| pnpm warns that a dependency's build script was ignored | Builds must be allowed in `pnpm-workspace.yaml` → `allowBuilds` (esbuild, unrs-resolver) | Add the package there only if it really needs to build |
| `pnpm --filter @naya/passenger test -- --ci` runs zero tests and exits 1 | pnpm 12 forwards the literal `--`, so jest reads `--ci` as a test pattern | Drop the `--`: `CI=1 pnpm --filter @naya/passenger test` |
| Root `pnpm test` fails with connection errors | Older root script also ran `@naya/e2e`, which needs four servers | The script now excludes e2e. Run Playwright with `pnpm e2e` |
| `pnpm peers check --lockfile-only` reports react-reconciler wants React ^19.3.0 (listed under `apps/driver`) | `@testing-library/react-native` pulls react-reconciler 0.34 through test-renderer 1.3; SDK 57 pins React 19.2.3 | Known and harmless for tests. Do not upgrade React outside the Expo SDK |
| `node --test` in apps/web prints `MODULE_TYPELESS_PACKAGE_JSON` | The test imports TypeScript through Node's type stripping | Harmless. It needs Node 22.18 or later (use Node 24, `.nvmrc`) |
| OS temp fills with `naya-test-*` folders | Before this branch the demo-api harness never removed its per-test data dirs | Fixed on this branch: `test/harness.ts` removes them when each test file ends. Delete old `naya-test-*` folders in your temp dir by hand |
| Something works only because of hoisting (driver eslint, packages/ui imports) | Undeclared dependencies resolve through the hoisted `node_modules` (QA-11) | Keep `nodeLinker: hoisted`. Declare the dependency when you touch the package |

## Running the apps

| Symptom | Cause | Fix |
|---|---|---|
| `NAYA_DEV=0` (or any variable) in the root `.env` has no effect | No process reads the root `.env` | Set it where the process reads it: [local-dev.md](local-dev.md#environment-variables) |
| A changed `EXPO_PUBLIC_*` value is ignored | It is inlined at bundle time | Restart Metro with a clean cache: `pnpm passenger --clear` |
| The second Expo app will not start, or opens the wrong app | Both apps default to Metro on 8081 | `pnpm --filter @naya/driver start --port 8082` (web: `web --port 8082`) |
| The admin opens on :5174 and e2e cannot find it | :5173 was taken; `vite.config.ts` has `strictPort: false` | Free :5173, or start it with `--strictPort` to fail loudly |
| Actions on a phone never show up in the admin (or the other app) | Standalone builds run their own in-process API and data | Use connected mode: `EXPO_PUBLIC_STANDALONE=0` and `pnpm api` |
| A dev build on a physical phone fails every request | The `development-device` EAS profile sets `EXPO_PUBLIC_API_URL=http://localhost:4010`, the phone's own localhost | Today: remove that variable from the profile, or set the Mac's LAN address |
| `pnpm demo:reset` seems undone | The running API kept the old state in memory and rewrote `db.json` | Stop the API before `pnpm demo:reset`, or use `POST /dev/reset` |
| Your local demo data vanished after `pnpm e2e` | Playwright reused your API on :4010 and the specs reset it | Stop `pnpm api` before e2e; Playwright then starts its own API on `.data/e2e` |
| TestFlight testers lost their data after an update | `schemaVersion` changed, so the store reseeded (`store.ts:22-29`) | Avoid bumps; when needed, warn testers in the release notes (ADR-0029) |
| `/dev/*` returns 404 | The API runs with `NAYA_DEV=0` | Restart without it. With `NAYA_DEV=0` you also need `NAYA_PROVIDER_SECRET` |
| Home, ride pill or onboarding unreadable in dark mode | Colours read at module scope or hard-coded (P15, PAX-01, PAX-14, UI-02, UI-06) | Fixed on this branch for onboarding, Home, the ride pill, the verification hero, the document picker and the capture guide (contrast computed, not yet checked on a simulator). Rule: `themedStyles()` or styles built after `useTheme()` |
| SOS page missing for `youssra@naya.demo` | Her `safety.respond` permission is in the seed only; an older `.data/db.json` keeps the old admin record (no migrations) | `pnpm demo:reset` with the API stopped, or `POST /dev/reset`. `meryem@naya.demo` keeps access through `config.edit` |
| A Famille trip shows « Remise bloquée » and nothing unlocks it | 5 wrong handover codes lock the handover; there is no unlock or failed-handover state yet (DOM-17, D3) | Today: reset the demo data or start a new trip |
| A script posting `/driver/location` gets 409 « Passez en ligne pour partager votre position. » | The server refuses positions from a driver who is offline with no accepted ride (P4) | Put the driver online first (`POST /driver/online`) |

## iOS builds

| Symptom | Cause | Fix |
|---|---|---|
| Sign-in silently fails in a simulator Release build | Unsigned build: no keychain entitlement, so SecureStore cannot save the session | Build with `CODE_SIGN_IDENTITY=-` |
| Review or TestFlight flags are not applied | Release bundling ignores the shell's `EXPO_PUBLIC_*` | Put them in `apps/<app>/.env.production.local`, and check that file before every archive |
| Build fails after `expo prebuild` (pods, codegen) | Prebuild resets the CocoaPods integration; codegen lives in `ios/build/generated` | Run `pod install` again; do not delete `ios/build` without it |
| "Generate app.config" (EXConstants) or "Bundle React Native code and images" fails with path errors | The repo path contains spaces | Both `app.config.ts` files must list `../../plugins/with-ios-build-paths`; prebuild again. Re-check after SDK upgrades |
| App traps at launch on iOS 27 (SIGTRAP, `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) | iOS 27 requires the UIScene life cycle | Keep `../../plugins/with-scene-lifecycle` in `app.config.ts` and prebuild again |
| Release build runs out of disk | A two-architecture Release build needs ~6 GB of derived data | `ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO` (~2.7 GB) |
| « Upload Symbols Failed » on upload (ExpoCameraBarcodeScanning, React, hermesvm and six more frameworks) | The archive has no dSYM for those prebuilt frameworks | A warning only; all four recorded uploads (1 Oct) succeeded with it |
| Captures from `docs/screens/ios` are never committed | Before this branch the `.gitignore` line `ios/` matched every folder named ios | Fixed on this branch: only `/apps/*/ios/` and `/apps/*/android/` are ignored, so `docs/screens/ios` shows as untracked. Whether to commit it is ADR-0052 |

## E2E

| Symptom | Cause | Fix |
|---|---|---|
| The first test of a run times out | Expo web bundles on the first request | Re-run, or open :8081 and :8082 once before `pnpm e2e`. With `CI` set, each test is retried once |
| Random failures when tests run together | More than one worker on the shared API | Keep `workers: 1` ([e2e.md](e2e.md#why-runs-are-serial)) |
| `driver-flows.spec.ts` fails on `provider-card` with a strict-mode violation | From Oct 6 the recharge list could show two « Carte bancaire (démo) » providers | Fixed on this branch: `prototypeProviders` (`services/demo-api/src/services/prototype.ts`) keeps one card recharge per city and disables an existing copy |
| S14 or a support test ends with « Rejetée » | « Résoudre » defaulted to rejection after 89aae18 (P10) | Fixed on this branch: `Ticket.tsx` has no default outcome and confirming needs a choice |
| Resolving a ticket through the API returns 422 « Issue inconnue… » | The server accepts only the labels in `TICKET_OUTCOMES` (`services/demo-api/src/services/support.ts`), plus the old code `rejected` | Send one of those labels |
| An admin dialog test passes but typing by hand scrambles fields | `fill()` bypasses focus; the dialog focus trap stole focus (P3) | Fixed on this branch (`useFocusTrap` in `apps/admin/src/components/ui.tsx`). Keep typing with `page.keyboard.type` in tests |
| A click on a button at the bottom of an admin dialog fails with "element is outside of the viewport" | Before this branch the Dialog panel did not scroll | Fixed on this branch: the panel scrolls inside the viewport |
| `apps/web` Playwright tests some other site | `apps/web/playwright.config.ts` reuses whatever answers on :3000 | Stop that server, or run the spec against `next start` on a free port with a copy of the config |
