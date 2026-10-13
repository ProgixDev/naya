# iOS Simulator builds

How to build and run the two Expo apps on the iOS Simulator, and how the native review captures are made.
Owner: build owner. Source: README "Native builds" and "Notes learned on this machine" (30 Sep 2026), updated for
pnpm and both apps. Last verified: 2026-10-13 (commands checked against the repo; no build was run for this page).

| | Passenger | Driver |
|---|---|---|
| Package | `@naya/passenger` | `@naya/driver` |
| Bundle ID | `ma.naya.passagere` | `ma.naya.chauffeuse` |
| Xcode workspace / scheme (after prebuild) | `apps/passenger/ios/Naya.xcworkspace` / `Naya` | `apps/driver/ios/NayaChauffeuse.xcworkspace` / `NayaChauffeuse` |

Toolchain on the build Mac: Xcode 27.0 (iOS 27 SDK), CocoaPods 1.16.2, Node 24.12. Find simulator names and UDIDs
with `xcrun simctl list devices`.

## Development build (day-to-day)

Native modules (maps, camera, secure store, glass, background location) need a development build, not Expo Go.

```bash
pnpm --filter @naya/passenger ios      # expo run:ios: prebuild, pod install, build, install, launch
pnpm passenger                         # Metro, if it is not already running
```

For the driver use `@naya/driver` and run Metro on another port if the passenger's Metro is on 8081. A development
build is standalone unless `apps/<app>/.env` sets `EXPO_PUBLIC_STANDALONE=0` (then start `pnpm api`). See
[local-dev.md](local-dev.md#runtime-modes-in-one-table).

## Review build (what `docs/screens/native/` comes from)

A Release build in connected mode with `EXPO_PUBLIC_REVIEW=1`, so the demo API can drive navigation through
`/dev/navigate` without tapping. Passenger shown; for the driver swap the package, workspace and scheme.

```bash
pnpm --filter @naya/passenger exec expo prebuild --platform ios
(cd apps/passenger/ios && pod install)                      # always again after prebuild
# Release bundling reads the flags from this git-ignored file, not from the shell:
printf 'EXPO_PUBLIC_REVIEW=1\nEXPO_PUBLIC_STANDALONE=0\nEXPO_PUBLIC_API_URL=http://localhost:4010\n' \
  > apps/passenger/.env.production.local
cd apps/passenger
xcodebuild -workspace ios/Naya.xcworkspace -scheme Naya -configuration Release \
  -destination 'platform=iOS Simulator,name=<device>' ONLY_ACTIVE_ARCH=YES \
  COMPILER_INDEX_STORE_ENABLE=NO CODE_SIGN_IDENTITY=- build
```

Install the built `.app` (its path is in the xcodebuild output) with `xcrun simctl install <udid> <path/to/Naya.app>`,
start `pnpm api`, then capture from the repo root:

```bash
node e2e/scripts/native-tour.mjs passenger docs/screens/native/390 <udid>
scripts/capture-native.sh <passenger|driver> <out-dir> <plan-file>   # alternative: a plan file of routes
```

`native-tour.mjs` resets the API (`/dev/reset`), signs in through `/dev/navigate`, waits a fixed time and runs
`xcrun simctl io <udid> screenshot`. Fixed sleeps can capture blank or wrong-state screens (VIS-21): check every image.

**Before you archive for TestFlight, rewrite `.env.production.local`.** The same file feeds review builds and
archives. A TestFlight build needs `EXPO_PUBLIC_DEMO=1`, `EXPO_PUBLIC_STANDALONE=1`, `EXPO_PUBLIC_REVIEW=0`
([testflight-eas.md](testflight-eas.md)).

## Rules learned on the build Mac

- **Sign simulator builds.** Ad hoc (`CODE_SIGN_IDENTITY=-`) is enough. An unsigned build has no keychain
  entitlement, so `expo-secure-store` cannot save the session and sign-in fails silently.
- **Release bundles ignore the shell's `EXPO_PUBLIC_*`.** Use `apps/<app>/.env.production.local`.
- **`expo prebuild` resets the CocoaPods integration.** Run `pod install` again afterwards. React Native writes
  codegen into `ios/build/generated`: do not delete `ios/build` without running `pod install` again.
- **Disk.** A two-architecture Release build needs about 6 GB of derived data; a single-architecture build with
  indexing off (`ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO`) about 2.7 GB.
- **`EXPO_PUBLIC_REVIEW=1` is inert elsewhere.** `DevNavigator` only polls when the build is connected and the flag is `1`.
- **The repo path contains spaces.** `plugins/with-ios-build-paths.js` (both apps, committed in c38429d) quotes the
  Expo Constants "Generate app.config" phase and the React Native bundle script. Without it those phases fail.
  It rewrites Xcode phases by regex: re-check it after any Expo SDK upgrade (ADR-0050).
- **iOS 27 needs the UIScene life cycle.** `plugins/with-scene-lifecycle.js` wires `ExpoAppSceneDelegate`; without it
  the app traps at launch (SIGTRAP).
- **`ios/` is generated.** Never edit it; change `app.config.ts` or a plugin and prebuild again.
- Xcode caches and archives have lived in `work/` (git-ignored, several GB). Keep them out of git.

Not verified on this machine: physical devices, background location with the screen locked, push to a closed app,
camera capture on device (the simulator and web use photo import), Android.
Failures: [troubleshooting.md](troubleshooting.md).
