# TestFlight and EAS builds

How the standalone demo reaches TestFlight, what the EAS profiles do, and the build log. This page is the only
place where build numbers are written (see [docs/README.md](../README.md)).
Owner: build owner. Sources: [STANDALONE-DEMO.md](../STANDALONE-DEMO.md), README "Standalone TestFlight builds",
`apps/*/eas.json`, `apps/*/app.config.ts`, and the local archive logs in `work/archive/` (git-ignored, on the build Mac).
Last verified: 2026-10-13 against HEAD c38429d.

## What a TestFlight demo build is

- Standalone: the demo API runs inside the app, with its own data on the phone. No backend, SMS or payment
  provider is needed, and the two apps never sync with each other or the admin.
- Flags, both apps: `EXPO_PUBLIC_DEMO=1`, `EXPO_PUBLIC_STANDALONE=1`, `EXPO_PUBLIC_REVIEW=0`.
  Never point a TestFlight build at localhost or at the placeholder `https://api.naya.example`.
- Tester flow (since 14 Oct 2026, ADR-0058): type a mock account's number (Salma +212 6 12 34 56 78 in the passenger
  app, Amina +212 6 61 23 45 67 in the driver app) or any other valid number; the code 123456 arrives as a notification
  « Naya » (or a message card when notifications are off). Other numbers follow the sign-up and are approved on the
  phone 20–40 s after sending the dossier. The apps show no demo wording: tell testers the build runs on mock data.
  Release builds have no scenario launcher; to start over, delete and reinstall the app.
- Testers' data persists across launches. **A `schemaVersion` change in the demo store wipes it on the next launch**
  (`services/demo-api/src/store.ts:22-29`). Say so in the release notes if you bump it.

## Local Xcode archive (how every recorded upload was made)

1. Write the three flags into each app's git-ignored `apps/<app>/.env.production.local`. Check it first: review
   builds use the same file with `EXPO_PUBLIC_REVIEW=1` and `EXPO_PUBLIC_STANDALONE=0`
   ([ios-simulator.md](ios-simulator.md)).
2. Prebuild and install pods (both apps use the config plugins in `plugins/`):
   ```bash
   pnpm --filter @naya/passenger exec expo prebuild --platform ios
   (cd apps/passenger/ios && pod install)
   ```
3. Archive. This is the invocation recorded on 1 Oct 2026 (`work/archive/passenger-2.log`, line 2), run from the
   repo root; only the archive path and build number change:
   ```bash
   xcodebuild archive -workspace apps/passenger/ios/Naya.xcworkspace -scheme Naya -configuration Release \
     -destination generic/platform=iOS -archivePath "<archives dir>/Naya <build>.xcarchive" \
     -derivedDataPath work/archive/passenger-<build>-derived -allowProvisioningUpdates -jobs 2 \
     DEVELOPMENT_TEAM=89884BGNZR CODE_SIGN_STYLE=Automatic CURRENT_PROJECT_VERSION=<build> COMPILER_INDEX_STORE_ENABLE=NO
   ```
   Driver: `-workspace apps/driver/ios/NayaChauffeuse.xcworkspace -scheme NayaChauffeuse` (`work/archive/driver-2.log`).
   `CURRENT_PROJECT_VERSION` overrides the `buildNumber` from `app.config.ts`.
4. Upload with `xcodebuild -exportArchive -archivePath <archive> -exportOptionsPlist <plist>`. The plist used on 1 Oct
   (`work/archive/ExportOptions-upload.plist`) sets `method` app-store-connect, `destination` upload, `teamID`
   89884BGNZR, `signingStyle` automatic, `uploadSymbols` true and `manageAppVersionAndBuildNumber` true. The exact
   export command line was not logged. A successful upload logs « Upload succeeded. » and ends with « Uploaded Naya » (driver: « Uploaded NayaChauffeuse »)
   and `** EXPORT SUCCEEDED **` (`work/archive/*-upload.log`).
   - `manageAppVersionAndBuildNumber` lets Xcode raise the build number during upload: the driver's build 2 archive
     was uploaded as build 3 on 1 Oct. Record the number App Store Connect shows, not the one you archived.
   - « Upload Symbols Failed » warnings (no dSYM for nine prebuilt frameworks, among them
     ExpoCameraBarcodeScanning, React and hermesvm) appeared on all four 1 Oct uploads and did not block them.
5. Add a row to the build log below in the same commit as any `buildNumber` change.

## EAS profiles (apps/passenger/eas.json and apps/driver/eas.json are identical)

| Profile | Distribution | Env | Notes |
|---|---|---|---|
| `development` | internal, iOS simulator | `EXPO_PUBLIC_API_URL=http://localhost:4010`, `DEMO=1`, `STANDALONE=0` | dev client |
| `development-device` | internal, device | inherits `development` | Today: the localhost URL makes every request fail on a real phone (audit 7.4 item 10) |
| `preview` | internal | `DEMO=1`, `STANDALONE=1`, `REVIEW=0` | standalone demo |
| `demo-testflight` | store, `autoIncrement` | `DEMO=1`, `STANDALONE=1`, `REVIEW=0` | standalone demo for TestFlight |
| `production` | store, `autoIncrement` | `EXPO_PUBLIC_API_URL=https://api.naya.example`, `DEMO=0` | needs a real backend; none exists |

- `cli.appVersionSource` is `remote`: EAS keeps its own build number and ignores `buildNumber` in `app.config.ts`.
- eas-cli is not a workspace dependency; the 30 Sep README ran `npx eas-cli@latest build --profile <profile>` from the
  app folder. No recorded TestFlight upload used EAS.

## Build numbers

Open decision: ADR-0049 (EAS remote versioning or `app.config.ts`, not both). Until it is decided:

- Current values in `app.config.ts` (`ios.buildNumber`, version 1.0.0): **passenger 4, driver 5** (set by 02ff3d3 on
  6 Oct 2026, unchanged at c38429d).
- History in git: 2 / 2 at 74a1c14 (1 Oct), 2 / 3 at d6a21d0 (1 Oct, "Record accepted standalone TestFlight build
  numbers"), 3 / 4 at 89aae18 (6 Oct), 4 / 5 at 02ff3d3 (6 Oct). Older docs say 2 / 3.
- Whether builds 3 / 4 or 4 / 5 were ever uploaded is not recorded in the repo. A passenger 1.0.0 (3) archive dated
  6 Oct exists in `work/archives/`, with no upload log next to it.
- Before an upload: read the latest build in App Store Connect, use the next number, and log it below.

## Build log

Append one row per upload attempt, newest last. Status: uploaded, processing, available in TestFlight, rejected.

Before this log (from [STANDALONE-DEMO.md](../STANDALONE-DEMO.md) and `work/archive/`): build 1 of each app was
connected to a Mac-hosted demo API. On 1 Oct 2026 Apple accepted passenger build 2 and driver build 3, both standalone.

| Date | App | Version | Build | Commit | Method (Xcode / EAS) | Uploaded by | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |
