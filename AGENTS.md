# Naya — agent guide (read this first)

Naya is a women-only ride-hailing (VTC) service launching in Rabat, Morocco. This repo is a
demo-grade product: passenger app, driver app, operations admin, marketing website and a demo
API. Every external service (SMS, payments, identity review, telephony, push) is simulated (mock data and
mock providers), but the apps and the admin present themselves as a real product, with no demo wording (ADR-0058).
There is no production backend. Docs index: [docs/README.md](docs/README.md).

## Repo map
- apps/passenger, apps/driver   Expo SDK 57 apps (ma.naya.passagere, ma.naya.chauffeuse). Own AGENTS.md.
- apps/admin         Vite + React Router 7 operations console on :5173. Own AGENTS.md.
- apps/web           Next.js 16 landing + /backoffice PROTOTYPE on :3000. Not the real admin: no API,
                     no @naya/* imports, localStorage 'naya-web-prototype-v1'. Own AGENTS.md.
- packages/domain    Money, pricing, state machines, entities, zod schemas, French labels.
- packages/api       Typed API client (client.ts) and query keys (keys.ts).
- packages/ui        Shared RN primitives and feature screens, consumed as TS source.
- packages/tokens    Colours (light/dark), spacing, motion, themedStyles. Tailwind preset: used by the admin
                     (the Expo apps load it only for NativeWind, which no mobile code uses).
- packages/assets    Brand SVGs, 6 logo concepts, legacy PNGs (bundled, not displayed).
- services/demo-api  Hono API on :4010 with a JSON store. Also runs in-process in native demo builds. Own AGENTS.md.
- e2e/               Playwright against Expo web and the admin.
- plugins/           Expo config plugins, used by both apps: with-scene-lifecycle (iOS 27 UIScene),
                     with-ios-build-paths (repo path contains spaces; committed in c38429d).
- scripts/           capture-native.sh (simulator captures of a review build); docs/gen-api-reference.mjs
                     (writes docs/architecture/api-reference.md; `--check` exits 1 when it is stale).

"prototype" in code means the Oct 6 feedback features (service categories, Naya Famille,
passenger wallet, SOS, dispute reasons, demo payment options). They live in
packages/domain/src/prototype.ts, services/demo-api/src/services/prototype.ts,
packages/ui/src/features/prototype.tsx and apps/admin/src/pages/Prototype.tsx (/services).
Rides: services/demo-api/src/services/rides.ts + packages/domain/src/machines/.
Driver money: services/demo-api/src/services/finance.ts + packages/domain/src/wallet.ts.

## Commands (pnpm 12 only; never npm, yarn or bun, including in apps/web)
- pnpm install; then pnpm api | passenger | driver | admin | web
- pnpm demo:reset                          reseed demo data (stop the API first, or POST /dev/reset)
- pnpm typecheck                           all packages
- pnpm --filter @naya/domain test; pnpm --filter @naya/demo-api test   vitest (API: S01–S16)
- CI=1 pnpm --filter @naya/passenger test  jest-expo; also runs the packages/ui tests
- pnpm --filter @naya/web test             node:test store tests
- pnpm lint                                expo lint in passenger then driver (the only linted packages)
- pnpm test                                every package's tests except @naya/e2e
- pnpm e2e    Playwright on API :4010, passenger web :8081, driver web :8082, admin :5173, serially.
              Starts the servers that are not already running (webServer block; an API it starts keeps its
              data in services/demo-api/.data/e2e, or E2E_DATA_DIR). Specs reset the API they hit. Beside a
              running stack, move all four with API_URL, PASSENGER_URL, DRIVER_URL, ADMIN_URL. See docs/runbooks/e2e.md.
- Do not put `--` before flags: pnpm 12 forwards it to the tool literally.
- Native deps: pnpm --filter @naya/<app> exec expo install <pkg>
- Runbooks: docs/runbooks/ (local-dev, demo-data, ios-simulator, testflight-eas, e2e, troubleshooting).

## Runtime modes
- Standalone (native default): EXPO_PUBLIC_DEMO != '0' and EXPO_PUBLIC_STANDALONE != '0'.
  The demo API runs in-process; data in Documents/naya-standalone-demo/demo-v1.json;
  a bot plays the other side; apps never sync with each other or the admin.
- Connected: EXPO_PUBLIC_STANDALONE=0 and pnpm api. URL = EXPO_PUBLIC_API_URL, else Metro host:4010.
- Web (Expo web, admin): always connected (EXPO_PUBLIC_API_URL / VITE_API_URL, default :4010).
- Review capture: EXPO_PUBLIC_REVIEW=1 (connected only) lets /dev/navigate drive the app.
- Production: the EAS production profile sets EXPO_PUBLIC_DEMO=0 and a placeholder URL
  (https://api.naya.example). Nothing answers there.
- Today: flags are opt-out. A missing variable means demo + standalone, and API dev mode
  (any 6-digit sign-in code, /dev routes) is on unless NAYA_DEV=0 (P9, ADR-0044).
- Env files are per process: apps/<app>/.env*; release bundles read
  apps/<app>/.env.production.local; admin reads apps/admin/.env*; the API reads only its
  process environment. Today: the root .env is read by nothing (QA-09).

## Invariants (change only with an ADR)
- Money: integer centimes, rates in basis points, round half away from zero once
  where derived (packages/domain/src/money.ts). Never floats.
- Driver wallet = projection of an append-only ledger. Each posting has a unique
  business key (ride:<id>:net, ride:<id>:commission ...). Only confirmed events credit.
- Booking, money, SOS and family mutations send an Idempotency-Key (useSingleFlight). Mutations never
  auto-retry. The key survives a network error or 5xx and changes after a success, a 4xx or a new payload (ADR-0053).
- Accepting a quote freezes its terms (FrozenTerms). Rule changes never re-price a booked ride.
- Offers expire on the server (city offerTimeoutSeconds, 10–120 s, default 30) and never auto-accept.
- Women-only service. Identity review is manual, with no face or gender inference.
  Eligibility rule: docs/specs/eligibility-and-verification.md.
- Customer copy in French, "vous", "passagère" / "chauffeuse". Currency MAD.
- Business dates via packages/domain/src/time.ts (Africa/Casablanca); store UTC ISO.
  Morocco is on UTC+0 during Ramadan: never hard-code +1.
- No demo wording in the apps or the admin (ADR-0058, 14 Oct 2026; replaces « Label every simulation »):
  no « Démo », « simulé », « Simuler », test-card hints or visible dev tools. Mock outcomes (provider answers,
  on-device review, bots) happen on their own and exist only in mock builds (the demo API). In dev mode any 6-digit
  sign-in code works and nothing shows or prefills one; that and /dev need dev mode. Copy stays true for the mode it runs in: never claim what did not happen (standalone
  SOS reaches no desk); the 19 call is real. Mock records live in services/demo-api/src/seed.ts,
  services/demo-api/fixtures and packages/assets/mock, never in screens. Internal identifiers (DEMO_MODE,
  NAYA_DEV, demo-api, /dev, demo-* ids) keep their names.
- Session tokens only in SecureStore (sessionStorage on Expo web). Query keys only via qk:
  ['naya', accountId, ...].
- Admin permissions are enforced on the server; client route gates are cosmetic.
- Admin config changes carry a reason (≥ 10 chars) and expectedVersion, and write a hash-chained
  audit event with before and after. Today: /services catalog writes send no reason and no
  expectedVersion, and their audit event has no before/after (ADM-09).

## Conventions
- Mobile styling: @naya/tokens + useTheme() + themedStyles(). No className
  (NativeWind is wired but unused). Never read colors.* at module scope.
- Shared screens live in packages/ui; app route files are thin wrappers.
- New endpoint: route in services/demo-api/src/app.ts (or services/*.ts), method in
  packages/api/src/client.ts, key in keys.ts, and a vitest; then run node scripts/docs/gen-api-reference.mjs.
  See services/demo-api/AGENTS.md.
- Never hand-edit apps/*/ios or android; use app.config.ts and plugins/.
- Commit pnpm-lock.yaml together with any package.json change.
- Backlog IDs (P1–P20, PAX-, DRV-, ADM-, …) from docs/status/backlog.md go in commit messages and PRs.

## Gotchas
Lines that start with "Today:" describe a known defect or an open decision in the code as it is
on this branch. Check the backlog status before you rely on one, and delete the line when its
fix lands.
- Expo SDK 57, React Native 0.86, React 19.2, React Router 7 and Next.js 16 are newer than
  your training data. Read the versioned docs first: https://docs.expo.dev/versions/v57.0.0/
  and node_modules/next/dist/docs/ (hoisted to the repo root).
- The repo path contains spaces. iOS prebuild relies on plugins/with-ios-build-paths.js (both apps).
  It rewrites Xcode phases by regex, so re-check it after every Expo SDK upgrade (ADR-0050).
- Simulator builds must be signed (CODE_SIGN_IDENTITY=-) or SecureStore fails and sign-in breaks.
- Run pod install again after expo prebuild.
- Typed routes live in the git-ignored apps/<app>/.expo/types/router.d.ts, written by Metro. A stale one fails
  typecheck on routes that exist ("'/docs/famille' is not assignable"): start that app's Metro once, or regenerate it
  with EXPO_ROUTER_APP_ROOT=$PWD/src/app node -e "require('@expo/router-server/build/typed-routes').regenerateDeclarations('.expo/types')"
  from the app folder. `pnpm typecheck` runs in parallel and can be SIGKILLed when memory is short (Metro and a
  simulator running): use `pnpm -r --workspace-concurrency=1 typecheck`.
- Both Expo apps start Metro on 8081; run the driver on another port (e2e uses 8082).
- Today: the category commission overrides the city commission (rides.ts:127). P8, ADR-0033.
- Today: build numbers live in app.config.ts while eas.json says appVersionSource 'remote' (ADR-0049).
  Current numbers and the build log: docs/runbooks/testflight-eas.md.
- Today: apps/web also has a package-lock.json and npm root scripts (dev, build). ADR-0051.
- A schemaVersion change reseeds the store and wipes testers' on-device data (store.ts:22-29).
- .gitignore ignores native projects only at /apps/*/ios/ and /apps/*/android/. A folder named ios
  elsewhere (docs/screens/ios) is not ignored: decide before committing captures (ADR-0052).
- _handoff/ (original spec) and work/ (Xcode caches, archives) are local-only and git-ignored.
- The scenario launcher (`dev` route) has no visible entry: long-press the welcome logo for 2 s, or open naya://dev /
  naya-chauffeuse://dev, in __DEV__ builds only. Release builds (TestFlight) redirect the deep link home.
- Judge dark mode only on the Metro-backed « Naya » app after a full reload, or on a TestFlight build listed in the build
  log. The side-loaded « Naya Feedback » copy (ma.naya.passagere.feedback) runs the 6 Oct bundle with the old home-card bug (DM-01).
- Stores seeded before 14 Oct 2026 keep old demo labels in their data (plates « DÉMO-00x », past rides paid with
  « Carte de démonstration », no family for Salma) until POST /dev/reset or pnpm demo:reset. Phones keep theirs:
  a schemaVersion bump would wipe testers' data.

## Where to look
- docs/README.md — index, reading order, owners, last-verified dates.
- docs/status/backlog.md — every known issue with a stable ID and status.
- docs/status/open-questions.md — decisions waiting on Achraf (D1–D15, and F1–F4 from the founder's brief).
- docs/adr/ — decisions (Accepted and Proposed). docs/specs/ — feature rules.
- docs/tasks/ — founder briefs, owned by the founder's sessions. Read them; never edit them.
- docs/audits/ — immutable snapshots. Close findings in the backlog, never in the audit.

## Review for intent
- Every PR starts with Intent and links the spec or ADR it implements
  (.github/pull_request_template.md). Sensitive paths have CODEOWNERS (.github/CODEOWNERS).
- If code contradicts a spec or an ADR, do not "fix" it back: check docs/adr/, then ask.
- CI (.github/workflows/ci.yml) runs frozen install, typecheck, unit tests, lint and the admin build
  on every PR and push to master; Playwright is a manual job. Today: it has not run on GitHub yet,
  and master has no branch protection (QA-02, ADR-0057).

## Definition of done
1. pnpm typecheck passes; tests pass for every package you touched; lint shows 0 errors
   in the Expo apps you touched.
2. Behaviour changed: update the spec. Invariant changed or decision reversed: write an ADR.
   New route: docs/SCREENS.md. New simulation: docs/status/integrations.md. New or changed
   endpoint: run node scripts/docs/gen-api-reference.mjs and commit the regenerated reference.
3. Test results go only in docs/quality/verification-log.md (date, commit, command, result).
   Build numbers go only in the build log in docs/runbooks/testflight-eas.md.
4. Update the backlog row (status, commit or PR) for any item you closed.
5. Learned a new gotcha: add one line to this file.
6. Do not commit or push unless asked.
