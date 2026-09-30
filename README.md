# Naya

Women-only mobility service launching in Rabat, Morocco. This repository contains the passenger app, the driver app (both Expo / React Native), a separate responsive administration dashboard, shared business logic and a shared demo API that all three talk to.

All customer-facing copy is French. Currency is MAD. Business scheduling uses `Africa/Casablanca`; timestamps are stored in UTC.

Source of truth: Figma file `nOuWsQ5MA8CdU5HsSGoXwP` (entry `56:2`, scenario index `53:2`), and the handoff package (`project-manifest.json`, `README.md`, `QA.md`).

## Layout

```
apps/
  passenger/      Expo app · Naya (P01–P16)
  driver/         Expo app · Naya Chauffeuse (D01–D18)
  admin/          React + Vite web dashboard (A00–A13), separate auth
packages/
  domain/         entities, money (centimes / basis points), pricing, wallet projection,
                  state machines (ride, offer, verification, transfer, scheduled), Zod schemas
  api/            typed API client + response contracts + TanStack query keys (same contract for demo and production)
  tokens/         design tokens + Tailwind 3 preset (NativeWind 4 and admin)
  ui/             shared mobile UI kit, map adapter, session/query core, shared features (auth, support, capture, dev launcher)
  assets/         supplied brand SVGs, illustrations, characters, Naya Signature car
services/
  demo-api/       authoritative demo backend (Hono, persistent JSON store, deterministic fixtures)
e2e/              Playwright end-to-end tests (mobile web builds + admin)
docs/             FINANCE.md, INTEGRATIONS.md, DESIGN.md, SCREENS.md, screenshots
```

## Versions (resolved 30 September 2026)

| Package | Version | Why |
|---|---|---|
| Expo SDK | **57.0.26** | latest stable (SDK 58 is beta, not used) |
| React Native | **0.86.3** | pinned by SDK 57 |
| React / React DOM | **19.2.3** | pinned by SDK 57 (React 19.3 exists but is not SDK-supported) |
| TypeScript | 6.0.3 | Expo template default (TS 7 not adopted) |
| expo-router | 57.0.24 | typed routes, `Stack.Protected` groups |
| NativeWind | **4.2.7** + Tailwind CSS **3.4.19** | NativeWind 5 is RC; v4 setup only |
| react-native-reanimated | **4.5.1** + react-native-worklets 0.10.1 | SDK 57 recommendation (4.7 is newer but not SDK-pinned) |
| react-native-gesture-handler | 2.32.x | SDK 57 pin (3.x not SDK-supported yet) |
| react-native-maps | 1.27.2 | SDK 57 pin |
| @tanstack/react-query | 5.104 | |
| zustand | 5.0.15 | |
| react-hook-form / zod | 7.89 / 4.6.5 | |
| Hono (demo API) | 4.13 | |
| Playwright | 1.63 | |
| React Router (admin) | 7.18.4 | v8 requires React ≥ 19.2.7; the monorepo stays on SDK 57's React 19.2.3 |
| Vite (admin) | 8.3 | |
| pnpm | 12.8.1 (hoisted `nodeLinker` for React Native) | |

Native versions were installed with `npx expo install` so they match SDK 57's `bundledNativeModules.json`. `npx expo-doctor` passes 21/21 checks on both apps and `npx expo install --check` reports no mismatches.

**Babel**: NativeWind's `nativewind/babel` preset appends `react-native-reanimated/plugin`, which would duplicate the Worklets plugin that `babel-preset-expo` already adds for Reanimated 4. The apps therefore use `babel-preset-expo` with `jsxImportSource: 'nativewind'` plus only the css-interop transform (see `apps/*/babel.config.js`).

**Toolchain**: Node 24.12, Xcode 27.0 (iOS 27 SDK), CocoaPods 1.16.2. No Android SDK is installed on the build machine used here (see *Verification*).

## Setup

```bash
corepack enable            # pnpm 12
pnpm install
cp .env.example .env       # optional overrides
```

## Run

```bash
pnpm api                   # demo API on http://localhost:4010 (persistent data in services/demo-api/.data)
pnpm passenger             # Expo dev server for the passenger app (press i / a / w)
pnpm driver                # Expo dev server for the driver app
pnpm admin                 # admin dashboard on http://localhost:5173
```

Native modules (maps, camera, glass, secure store, background location) need a **development build**, not Expo Go:

```bash
cd apps/passenger && npx expo run:ios          # or: eas build --profile development
cd apps/driver && npx expo run:ios
```

On a physical device on the same network, the apps reach the API through the Metro host automatically; otherwise set `EXPO_PUBLIC_API_URL`.

## Native builds

Development builds (native modules included) — `npx expo run:ios` / `run:android` in each app, or EAS:

```bash
cd apps/passenger
npx eas-cli@latest build --profile development      # dev client (simulator build on iOS)
npx eas-cli@latest build --profile preview          # internal distribution
npx eas-cli@latest build --profile production
```

Local iOS Simulator review build (what the captures in `docs/screens/native/` come from):

```bash
cd apps/passenger && npx expo prebuild --platform ios && (cd ios && pod install)
# review flags are read at bundle time from a git-ignored env file:
printf 'EXPO_PUBLIC_REVIEW=1\nEXPO_PUBLIC_API_URL=http://localhost:4010\n' > .env.production.local
xcodebuild -workspace ios/Naya.xcworkspace -scheme Naya -configuration Release \
  -destination 'platform=iOS Simulator,name=<device>' ONLY_ACTIVE_ARCH=YES \
  COMPILER_INDEX_STORE_ENABLE=NO CODE_SIGN_IDENTITY=- build
node e2e/scripts/native-tour.mjs passenger docs/screens/native/390 <udid>
```

Notes learned on this machine:
- Simulator builds must be **signed** (ad hoc `-` is enough). An unsigned build has no keychain entitlement, so `expo-secure-store` cannot save the session and sign-in silently fails.
- Release bundling does not inherit the shell's `EXPO_PUBLIC_*` variables; use `.env.production.local`.
- `npx expo prebuild` resets the CocoaPods integration: run `pod install` again afterwards. React Native writes codegen into `ios/build/generated`, so do not delete `ios/build` without re-running `pod install`.
- A two-architecture Release build needs ~6 GB of derived data; a single-architecture build with indexing off needs ~2.7 GB.
- `EXPO_PUBLIC_REVIEW=1` enables a development-only navigation hook (`/dev/navigate` on the demo API) used to capture screens without tapping. It is inert in any other build.

## Demo data

```bash
pnpm demo:seed             # write the default scenario
pnpm demo:reset            # wipe and rewrite (stop the API first, or use the launcher)
pnpm --filter @naya/demo-api seed first-ride   # any named scenario
```

Scenarios: `default`, `first-ride` (S03: NY-001 cash → −15 MAD), `after-cash` (S04: card → 70 MAD), `no-casablanca` (S15), `dynamic-pricing` (S06). In development builds the **scenario launcher** (tap the "Démo" badge on the welcome screen, or *Compte → Lanceur de scénarios*) resets scenarios, lists demo accounts, advances the server clock, resolves provider outcomes and toggles a simulated second driver.

### Demo accounts (OTP code `123456` in demo mode)

| App | Phone / e-mail | State |
|---|---|---|
| Passenger | +212 6 12 34 56 78 · Salma El Mansouri | approved, Casablanca tester, cards 4242 / 0002 (declines) / 3155 (stays pending) |
| Passenger | +212 6 23 45 67 89 · Nour Benali | identity submitted, awaiting review |
| Passenger | +212 6 34 56 78 90 · Imane Tazi | correction requested (ID verso) |
| Passenger | +212 6 45 67 89 01 · Rania Alaoui | refused, expired document (recoverable) |
| Driver | +212 6 61 23 45 67 · Amina Bennani | person + vehicle approved, wallet 70 MAD |
| Driver | +212 6 62 34 56 78 · Khadija Idrissi | person approved, vehicle under review |
| Driver | +212 6 65 67 89 01 · Samira Fassi | vehicle approved, licence to correct |
| Driver | +212 6 64 56 78 90 · Leila Amrani | balance −150 MAD, offers blocked |
| Driver | +212 6 63 45 67 89 · Nadia Chraibi | simulated driver (dev launcher) |
| Admin | meryem@naya.demo / `Naya-Admin-2026` | all permissions |
| Admin | youssra@naya.demo / `Naya-Support-2026` | support agent (no finance, no identity decisions) |

All people, documents, vehicles and events are fictional. Documents are "SPÉCIMEN · FICTIF" images generated by `services/demo-api/scripts/generate-fixtures.py`.

## Tests

```bash
pnpm test                                   # domain unit tests + API scenario tests (S01–S16)
pnpm --filter @naya/e2e install-browsers    # once
pnpm e2e                                    # Playwright against running servers (see e2e/playwright.config.ts)
```

## Verification (30 September 2026)

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) — domain, api, tokens, ui, demo-api, passenger, driver, admin | all clean |
| Domain unit tests (`packages/domain`) — money, pricing, every wallet invariant, state machines | **36 / 36** |
| API scenario tests (`services/demo-api`) — S01–S16, races, OTP, permissions, idempotency, audit chain | **36 / 36** |
| Playwright E2E — passenger (13), driver (10), admin (11), cross-role (2) on the real apps | **36 / 36** |
| `expo-doctor` (both apps) / `expo install --check` / `pnpm peers check` | 21/21 checks · no mismatches · no peer issues |
| `vite build` (admin) | succeeds |
| iOS 27 Simulator Release builds (passenger, driver) | build, launch and run against the demo API |
| Native captures | `docs/screens/native/390` (both apps), `390-large-text` (both, accessibility-large), `390-reduced` (Reduce Transparency/Motion), `375` (both apps), `430` (passenger subset — the run stopped when the disk filled) |
| Android | **not run** — no Android SDK/emulator on the build machine. Android-specific code paths (Google Maps key, 48-pt edges, tile fallback) are implemented but unverified on device. |

Cross-role E2E runs the passenger, driver and admin apps side by side: the driver accepts the passenger's request in her own UI, the Agdal stop is completed, cash and card settlements reconcile to 170 = 100 cash + 70 wallet, and the admin sees the same ride and ledger. It found and fixed two defects that single-app tests missed (a duplicated tab navigator after the receipt; a single-use quote reused from cache).

Not verified here: physical devices, background location with the screen locked, push delivery to a closed app, camera capture on device (the simulator and web use photo import), and any live provider.

## Documentation

- `docs/FINANCE.md` — money representation, rounding, fare, wallet, required invariants
- `docs/INTEGRATIONS.md` — what is simulated and what live operation needs
- `docs/DESIGN.md` — references, principles and improvements over the prototype
- `docs/SCREENS.md` — screen coverage mapped to Figma IDs, and verification captures
