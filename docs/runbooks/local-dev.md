# Local development

How to install the repo, start each process, point the apps at the demo API and reset demo data.
Owner: build owner. Last verified: 2026-10-13 against branch `chore/docs-foundation-and-fixes` (based on c38429d).

## Prerequisites

| Tool | Version | Source |
|---|---|---|
| Node | 24 (24.12 on the build Mac) | `.nvmrc`, README toolchain line. `package.json` engines still says `>=22`; the web store test needs 22.18 or later. |
| pnpm | 12.8.1 | `packageManager` in `package.json`. Enable it with `corepack enable`. |
| Xcode | 27.0 (iOS 27 SDK) | Only for native iOS builds. |
| CocoaPods | 1.16.2 | Only for native iOS builds. |
| Android SDK | — | Not installed on the build Mac. Android code paths are unverified. |

## Install

```bash
corepack enable
pnpm install
```

- `node_modules` is hoisted (`pnpm-workspace.yaml`: `nodeLinker: hoisted`) because Metro, CocoaPods and Gradle need a flat tree.
- Use pnpm everywhere, including `apps/web`. Never npm, yarn or bun.
- Commit `pnpm-lock.yaml` with any `package.json` change. A stale lockfile broke `pnpm install --frozen-lockfile` on master once.

## Processes and ports

| Process | Command | Port | Reads env from |
|---|---|---|---|
| Demo API | `pnpm api` (`tsx watch src/main.ts`) | 4010 (`PORT`) | The process environment only. No `.env` file. |
| Passenger, Metro | `pnpm passenger` (`expo start`) | 8081 | `apps/passenger/.env*` |
| Driver, Metro | `pnpm --filter @naya/driver start --port 8082` | 8082 with this flag (8081 by default) | `apps/driver/.env*` |
| Passenger, web | `pnpm --filter @naya/passenger web` | 8081 | `apps/passenger/.env*` |
| Driver, web | `pnpm --filter @naya/driver web --port 8082` | 8082 (e2e expects it) | `apps/driver/.env*` |
| Admin | `pnpm admin` (`vite --port 5173`) | 5173; silently moves to the next free port if taken (`strictPort: false`) | `apps/admin/.env*` |
| Website | `pnpm web` (`next dev --webpack -p 3000`) | 3000 | `apps/web/.env*` |

- Both Expo apps default to Metro on 8081. Run only one on 8081 and give the other `--port 8082`.
- Do not write `--` before the flags: pnpm 12 passes it to the tool literally and the flag is lost.
- Release bundles (Xcode archives, review builds) do not inherit the shell's `EXPO_PUBLIC_*` variables. Put them in
  `apps/<app>/.env.production.local` (git-ignored). See [ios-simulator.md](ios-simulator.md).

## Environment variables

`.env.example` at the root lists the variables for every process. **No process reads a root `.env`.** Copy each
line to where its process reads it:

| Variable | Read by | Where to set it |
|---|---|---|
| `PORT`, `NAYA_DEV`, `NAYA_PROVIDER_SECRET`, `NAYA_DATA_DIR`, `NAYA_APPLE_AUTH_CONFIGURED`, `NAYA_GOOGLE_AUTH_CONFIGURED` | demo API (`services/demo-api/src/main.ts`, `app.ts`) | the shell, e.g. `NAYA_DEV=0 NAYA_PROVIDER_SECRET=… pnpm api` |
| `EXPO_PUBLIC_DEMO`, `EXPO_PUBLIC_STANDALONE`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_REVIEW`, `EXPO_PUBLIC_MAP_TILE_URL`, `EXPO_PUBLIC_MAP_ATTRIBUTION` | Expo apps, inlined at bundle time | `apps/<app>/.env` (Metro) or `apps/<app>/.env.production.local` (release bundles); restart Metro after a change |
| `GOOGLE_MAPS_ANDROID_KEY` | `apps/<app>/app.config.ts` at prebuild | the shell when you run prebuild |
| `VITE_API_URL` | admin (`apps/admin/src/lib/api.ts`), default `http://localhost:4010` | `apps/admin/.env` |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | website, baked into the build | `apps/web/.env.local` |

Today, the flags are opt-out (P9): a missing `EXPO_PUBLIC_DEMO` or `EXPO_PUBLIC_STANDALONE` means "demo, standalone",
and the API runs in dev mode (fixed OTP 123456, `/dev/*` routes) unless `NAYA_DEV=0`. Setting `NAYA_DEV=0` in a root
`.env` has no effect.

## Runtime modes in one table

| Mode | How you get it | Backend |
|---|---|---|
| Standalone (native default) | native build, `EXPO_PUBLIC_DEMO` and `EXPO_PUBLIC_STANDALONE` not `0` | demo API in-process on the phone; a bot plays the other side; no sync between apps or with the admin |
| Connected (native) | `EXPO_PUBLIC_STANDALONE=0` in `apps/<app>/.env`, plus `pnpm api` | `EXPO_PUBLIC_API_URL`, else the Metro host on :4010 (a phone on the same Wi-Fi reaches the Mac) |
| Web | Expo web or the admin | always the shared API on :4010 |
| Review capture | connected build with `EXPO_PUBLIC_REVIEW=1` | `/dev/navigate` drives the app; see [ios-simulator.md](ios-simulator.md) |
| Production | `EXPO_PUBLIC_DEMO=0` (EAS `production` profile) | placeholder `https://api.naya.example`; nothing answers |

The resolution logic is `packages/ui/src/core/apiBase.ts`.

## A typical connected session

```bash
pnpm api                                          # terminal 1
pnpm admin                                        # terminal 2 → http://localhost:5173
pnpm --filter @naya/passenger web                 # terminal 3 → http://localhost:8081
pnpm --filter @naya/driver web --port 8082        # terminal 4 → http://localhost:8082
```

Accounts and test cards: [demo-data.md](demo-data.md). Native apps need a development build, not Expo Go
(maps, camera, secure store, glass): `pnpm --filter @naya/passenger ios`, then `pnpm passenger` for Metro.

## Reset demo data

| Where | How |
|---|---|
| Node API (`services/demo-api/.data/`) | Stop the API, then `pnpm demo:reset` (wipes `.data`, writes the `default` scenario). A running API keeps its old state in memory and overwrites the file on its next write. |
| Node API, still running | `curl -X POST http://localhost:4010/dev/reset -H 'Content-Type: application/json' -d '{"scenario":"default"}'` |
| Any app in a demo build | Compte → « Lanceur de scénarios » → pick a scenario. In a standalone build this resets the store on the phone. |
| Standalone app, from outside | Delete the app. Its data lives in the app's `Documents/naya-standalone-demo/`. |
| Website prototype | Clear the site's localStorage (`naya-web-prototype-v1`). |

`pnpm e2e` resets whichever API it talks to. Scenarios and accounts: [demo-data.md](demo-data.md).
Something fails: [troubleshooting.md](troubleshooting.md).
