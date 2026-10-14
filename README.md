# Naya

Women-only mobility service launching in Rabat, Morocco. This repository contains the passenger app, the driver app (both Expo / React Native), a separate responsive administration dashboard, a marketing website with a backoffice prototype, shared business logic and a demo engine. Native mobile demo builds run entirely on the device; the web apps and admin can use the shared demo API. Every external service (SMS, payments, identity review, telephony, push) is simulated; there is no production backend yet.

All customer-facing copy is French. Currency is MAD. Business scheduling uses `Africa/Casablanca`; timestamps are stored in UTC.

Design source: Figma file `nOuWsQ5MA8CdU5HsSGoXwP` (entry `56:2`, scenario index `53:2`). The original handoff package (`_handoff/`: `project-manifest.json`, `README.md`, `QA.md`, implementation prompt) is git-ignored, so it exists only on the build Mac, and several of its rules were reversed later. Decisions made since then are recorded in [docs/adr/](docs/adr/); whether to commit the handoff text is an open decision (ADR-0056).

**Start with [docs/README.md](docs/README.md)** (docs index and reading order). AI agents: [AGENTS.md](AGENTS.md).

## Layout

```
apps/
  passenger/      Expo app · Naya (P01–P16)
  driver/         Expo app · Naya Chauffeuse (D01–D18)
  admin/          React + Vite web dashboard (A00–A13), separate auth — the operational console
  web/            Next.js 16 landing page + /backoffice prototype (disconnected from the API, data in localStorage)
packages/
  domain/         entities, money (centimes / basis points), pricing, wallet projection,
                  state machines (ride, offer, verification, transfer, scheduled), Zod schemas
  api/            typed API client + response contracts + TanStack query keys (same contract for demo and production)
  tokens/         design tokens (light and dark), themedStyles, Tailwind 3 preset used by the admin
  ui/             shared mobile UI kit, map adapter, session/query/theme core, shared features (auth, support, capture, dev launcher, Oct 6 features)
  assets/         brand SVGs, six logo concepts, legacy PNG art (bundled, no longer displayed)
services/
  demo-api/       authoritative demo backend (Hono, persistent JSON store, deterministic fixtures)
e2e/              Playwright end-to-end tests (mobile web builds + admin) and native capture scripts
plugins/          Expo config plugins used by both apps (iOS 27 UIScene, repo path with spaces)
scripts/          capture-native.sh (Simulator screenshots of a review build), docs/gen-api-reference.mjs (API reference)
docs/             index in docs/README.md: status, ADRs, specs, runbooks, audits, screenshots
```

## Versions (resolved 30 September 2026)

| Package | Version | Why |
|---|---|---|
| Expo SDK | **57.0.26** | latest stable (SDK 58 is beta, not used) |
| React Native | **0.86.3** | pinned by SDK 57 |
| React / React DOM | **19.2.3** | pinned by SDK 57 (React 19.3 exists but is not SDK-supported) |
| TypeScript | 6.0.3 | Expo template default (TS 7 not adopted) |
| expo-router | 57.0.24 | typed routes, `Stack.Protected` groups |
| NativeWind | **4.2.7** + Tailwind CSS **3.4.19** | NativeWind 5 is RC; v4 setup only. Wired into the Expo apps but unused: no mobile code uses `className` (ADR-0047 is open) |
| react-native-reanimated | **4.5.1** + react-native-worklets 0.10.1 | SDK 57 recommendation (4.7 is newer but not SDK-pinned) |
| react-native-gesture-handler | 2.32.x | SDK 57 pin (3.x not SDK-supported yet) |
| react-native-maps | 1.27.2 | SDK 57 pin |
| @tanstack/react-query | 5.104 | |
| zustand | 5.0.15 | |
| react-hook-form / zod | 7.89 / 4.6.5 | |
| Hono (demo API) | 4.13 | |
| Playwright | 1.63 | |
| React Router (admin) | 7.18.4 | v8 requires React ≥ 19.2.7; the monorepo stays on SDK 57's React 19.2.3 |
| Next.js (website) | 16.3 | added 5 Oct (afac0b1); webpack mode (`next dev --webpack`) |
| Vite (admin) | 8.3 | |
| pnpm | 12.8.1 (hoisted `nodeLinker` for React Native) | |

Native versions match SDK 57's `bundledNativeModules.json`. Add native modules with `pnpm --filter @naya/<app> exec expo install <pkg>`; check with `pnpm doctor`.

**Mobile styling** is `@naya/tokens` + `useTheme()` + `themedStyles()`, with inline styles. NativeWind is configured but not used.

**Babel**: NativeWind's `nativewind/babel` preset appends `react-native-reanimated/plugin`, which would duplicate the Worklets plugin that `babel-preset-expo` already adds for Reanimated 4. The apps therefore use `babel-preset-expo` with `jsxImportSource: 'nativewind'` plus only the css-interop transform (see `apps/*/babel.config.js`).

**Toolchain**: Node 24 (`.nvmrc`; 24.12 on the build Mac), Xcode 27.0 (iOS 27 SDK), CocoaPods 1.16.2. No Android SDK is installed on the build machine, so Android is unverified.

## Setup

```bash
corepack enable            # pnpm 12
pnpm install
```

Use pnpm everywhere, including `apps/web`. There is no root `.env`: no process reads it. `.env.example` lists the variables; each process reads its own file (the API reads its shell environment, Expo apps read `apps/<app>/.env`, the admin reads `apps/admin/.env`). Details: [docs/runbooks/local-dev.md](docs/runbooks/local-dev.md#environment-variables).

## Run

```bash
pnpm api                   # demo API on http://localhost:4010 (persistent data in services/demo-api/.data)
pnpm passenger             # Expo dev server for the passenger app (press i / a / w)
pnpm driver                # Expo dev server for the driver app (both default to port 8081: run one at a time, or add --port 8082)
pnpm admin                 # admin dashboard on http://localhost:5173
pnpm web                   # website on http://localhost:3000 and the prototype on /backoffice
```

Native modules (maps, camera, glass, secure store, background location) need a **development build**, not Expo Go:

```bash
pnpm --filter @naya/passenger ios      # expo run:ios
pnpm --filter @naya/driver ios
```

Native demo builds are standalone by default: no backend or SMS service is required. Sign in with any Moroccan number (a new account goes through the document flow and is approved on the device 20–40 s after it is sent) or with a mock account's number below, then type any 6-digit code (no SMS is sent and none is shown). The apps show no demo wording ([ADR-0058](docs/adr/0058-present-the-mock-backed-apps-as-a-real-product.md)). Each app stores its own fictional data on the device and simulates the other party. The apps do not synchronize with one another or the admin in this mode. Map tiles may still use the map provider’s network connection.

For a connected development demo, set `EXPO_PUBLIC_STANDALONE=0` in `apps/<app>/.env` and run `pnpm api`. A physical device on the same network then uses the Metro host automatically, or set `EXPO_PUBLIC_API_URL`. Web builds always use the shared API. All modes: [docs/runbooks/local-dev.md](docs/runbooks/local-dev.md#runtime-modes-in-one-table).

## Native builds

Runbooks: [iOS Simulator builds](docs/runbooks/ios-simulator.md) (development and review builds, native captures) and [TestFlight and EAS](docs/runbooks/testflight-eas.md) (archives, EAS profiles, build numbers and the build log).

The essentials learned on the build Mac:
- Simulator builds must be **signed** (ad hoc `-` is enough). An unsigned build has no keychain entitlement, so `expo-secure-store` cannot save the session and sign-in silently fails.
- Release bundling does not inherit the shell's `EXPO_PUBLIC_*` variables; use `apps/<app>/.env.production.local`.
- `expo prebuild` resets the CocoaPods integration: run `pod install` again afterwards. React Native writes codegen into `ios/build/generated`, so do not delete `ios/build` without re-running `pod install`.
- The repo path contains spaces: both apps rely on `plugins/with-ios-build-paths.js`. iOS 27 needs `plugins/with-scene-lifecycle.js`.
- `EXPO_PUBLIC_REVIEW=1` enables a review-only navigation hook: `DevNavigator` polls `/dev/navigate` on a dev-mode demo API so screens can be captured without tapping. It is inert in standalone builds and whenever the flag is not `1`.

## Standalone TestFlight builds

Both apps use `EXPO_PUBLIC_DEMO=1`, `EXPO_PUBLIC_STANDALONE=1`, and `EXPO_PUBLIC_REVIEW=0`. Do not point a TestFlight demo at localhost or a placeholder server. `apps/*/eas.json` includes a `demo-testflight` profile; for local Xcode archives (how every recorded upload was made), place those three flags in each app’s ignored `.env.production.local` before bundling. Steps and the build log: [docs/runbooks/testflight-eas.md](docs/runbooks/testflight-eas.md).

Sign-in, document samples and simulated review, route search, bookings, driver offers, trips, payments and wallet actions execute locally. No real SMS, payment or identity review occurs. Profiles and progress persist across launches. A stale session from a previous connected build returns to sign-in. New driver offers appear shortly after going online. The scenario launcher is also local.

## Demo data

```bash
pnpm demo:seed             # write the default scenario
pnpm demo:reset            # wipe and rewrite (stop the API first, or use the launcher)
pnpm --filter @naya/demo-api seed first-ride   # any named scenario
```

Scenarios: `default`, `first-ride` (S03: NY-001 cash → −15 MAD), `after-cash` (S04: card → 70 MAD), `no-casablanca` (S15), `dynamic-pricing` (S06). In development builds (`__DEV__`) the **scenario launcher** (long-press the Naya logo on the welcome screen for 2 s, or open `naya://dev` / `naya-chauffeuse://dev`; no visible entry) resets scenarios, lists the mock accounts, advances the server clock, resolves provider outcomes and toggles a simulated second driver. More: [docs/runbooks/demo-data.md](docs/runbooks/demo-data.md).

### Mock accounts (any 6-digit code in dev mode)

| App | Phone / e-mail | State |
|---|---|---|
| Passenger | +212 6 12 34 56 78 · Salma El Mansouri | approved, Casablanca tester, Naya Famille (Lina), cards 4242 / 0002 (declines) / 3155 (stays pending) |
| Passenger | +212 6 23 45 67 89 · Nour Benali | identity submitted, awaiting review |
| Passenger | +212 6 34 56 78 90 · Imane Tazi | correction requested (ID verso) |
| Passenger | +212 6 45 67 89 01 · Rania Alaoui | refused, expired document (recoverable) |
| Driver | +212 6 61 23 45 67 · Amina Bennani | person + vehicle approved, wallet 70 MAD |
| Driver | +212 6 62 34 56 78 · Khadija Idrissi | person approved, vehicle under review |
| Driver | +212 6 65 67 89 01 · Samira Fassi | vehicle approved, licence to correct |
| Driver | +212 6 64 56 78 90 · Leila Amrani | balance −150 MAD, offers blocked |
| Driver | +212 6 63 45 67 89 · Nadia Chraibi | simulated driver (dev launcher) |
| Admin | meryem@naya.demo / `Naya-Admin-2026` | all permissions |
| Admin | youssra@naya.demo / `Naya-Support-2026` | support agent with SOS alerts (no finance, configuration, identity decisions or audit) |

All people, documents, vehicles and events are fictional. Documents are "SPÉCIMEN · FICTIF" images generated by `services/demo-api/scripts/generate-fixtures.py`.

## Tests

```bash
pnpm typecheck                              # every package (strict TypeScript)
pnpm test                                   # unit and integration tests of every package except e2e:
                                            #   domain + demo-api (vitest, API scenarios S01–S16), passenger (jest-expo, includes the packages/ui tests), web (node:test)
pnpm lint                                   # expo lint in the passenger and driver apps
pnpm --filter @naya/e2e install-browsers    # once
pnpm e2e                                    # Playwright against the API, passenger web, driver web and admin
```

CI (`.github/workflows/ci.yml`) runs the install, typecheck, unit tests, lint and the admin build on every pull request and push to master; Playwright is a manual job there. How e2e starts and reuses the four servers (ports 4010, 8081, 8082, 5173): [docs/runbooks/e2e.md](docs/runbooks/e2e.md). Record results worth citing in [docs/quality/verification-log.md](docs/quality/verification-log.md); this README does not carry current test counts.

## Feedback prototype (6 October 2026)

The mobile feedback is implemented as demo workflows across both apps and the admin: service categories, Naya Famille, passenger wallet, SOS, dispute evidence, appearance settings, and six logo concepts. See [the walkthrough and its checks](docs/MOBILE-FEEDBACK-DEMO.md). Payments and safety actions remain simulated. Known gaps in these features are tracked in [docs/status/backlog.md](docs/status/backlog.md).

## Verification (30 September 2026) — historical

Kept as a record of the first full pass; it predates the Oct 6 feature work and is not the current state. Current results live only in [docs/quality/verification-log.md](docs/quality/verification-log.md).

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) — domain, api, tokens, ui, demo-api, passenger, driver, admin | all clean |
| Domain unit tests (`packages/domain`) — money, pricing, every wallet invariant, state machines | **36 / 36** |
| API scenario tests (`services/demo-api`) — S01–S16, races, OTP, permissions, idempotency, audit chain | **36 / 36** |
| Component interaction tests (`apps/passenger`, jest-expo + Testing Library) — buttons, OTP paste, pills, segmented control, fare disclosure, wallet figures, countdown, deadline hook, single-flight | **14 / 14** |
| Playwright E2E — passenger (15), driver (11), admin (11), cross-role (2) on the real apps, incl. cold deep links | **39 / 39** |
| `expo-doctor` (both apps) / `expo install --check` / `pnpm peers check` | 21/21 checks · no mismatches · no peer issues |
| `vite build` (admin) | succeeds |
| iOS 27 Simulator Release builds (passenger, driver) | build, launch and run against the demo API |
| Native captures | `docs/screens/native/390` (both apps), `390-large-text` (both, accessibility-large), `390-reduced` (Reduce Transparency/Motion), `375` (both apps), `402` (both apps, iPhone 18 Pro), `430` (both apps) |
| Android | **not run** — no Android SDK/emulator on the build machine. Android-specific code paths (Google Maps key, 48-pt edges, tile fallback) are implemented but unverified on device. |

Cross-role E2E runs the passenger, driver and admin apps side by side: the driver accepts the passenger's request in her own UI, the Agdal stop is completed, cash and card settlements reconcile to 170 = 100 cash + 70 wallet, and the admin sees the same ride and ledger. It found and fixed two defects that single-app tests missed (a duplicated tab navigator after the receipt; a single-use quote reused from cache).

Not verified here: physical devices, background location with the screen locked, push delivery to a closed app, camera capture on device (the simulator and web use photo import), and any live provider.

## Documentation

[docs/README.md](docs/README.md) is the index: reading order, owners, "last verified" dates, status, ADRs, specs, runbooks and the older docs (`FINANCE.md`, `DESIGN.md`, `SCREENS.md`, …) with a freshness verdict for each.

## Website prototype

The Next.js landing page and backoffice prototype live in `apps/web`. Run `pnpm web` from the root, then open http://localhost:3000 or http://localhost:3000/backoffice (no longer linked from the landing header or footer, and not indexed). The website uses Tailwind CSS, GSAP and persistent Zustand state (localStorage `naya-web-prototype-v1`). The backoffice is not connected to the demo API and is not the operational admin (that is `apps/admin`); which backoffice is canonical is open (ADR-0038). `apps/web/package-lock.json` and the root `dev` / `build` npm scripts still exist; their removal is ADR-0051. See [apps/web/README.md](apps/web/README.md) for prototype scope and checks.
