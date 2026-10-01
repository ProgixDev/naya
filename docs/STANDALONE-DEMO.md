# Standalone mobile demo — 1 October 2026

Build 1 was connected to a Mac-hosted demo API. Build 2 replaces those mobile requests with an in-process transport, persistent app-sandbox data and bundled sample documents. Neither mobile app starts a server or opens a socket for demo API requests.

## Tester flow

On the phone screen, choose **Utiliser un compte démo**, then confirm the prefilled code **123456**. This opens the approved Salma passenger account or Amina driver account. Any other supported phone number can follow the local registration and simulated document-review flow. No SMS, payment or identity review is real.

Passenger trips use a simulated driver. Going online in the driver app creates simulated passenger offers. Each app has independent data; the two phones and the web admin do not synchronize in standalone mode. Profile changes, trips, wallet balances and pending transfers persist across launches. Apple Maps may need internet to load uncached map tiles.

## Release configuration

Both apps: `EXPO_PUBLIC_DEMO=1`, `EXPO_PUBLIC_STANDALONE=1`, `EXPO_PUBLIC_REVIEW=0`. The EAS profile is `demo-testflight`. Local Xcode archives read the same flags from each app's ignored `.env.production.local`. Build number is 2 in both Expo configs.

Set `EXPO_PUBLIC_STANDALONE=0` only when deliberately using the shared demo server. The real production profile sets `EXPO_PUBLIC_DEMO=0` and needs a deployed backend.

## Validation

- All workspace TypeScript checks passed.
- 43 service/integration tests passed, including seven standalone tests with global network fetch blocked.
- The response-body regression is tested using a non-streaming Response implementation, matching React Native's relevant behavior.
- Release JavaScript ran in both native iOS 27 simulator apps. An app-side harness blocked network fetch while checking stale-session recovery, OTP, local sign-in, bundled documents and profile persistence.
- Passenger native checks completed a trip with a simulated driver, confirmed payment, and created/cancelled a scheduled booking.
- Driver native checks received an offer, completed a trip and cash collection, then confirmed a withdrawal after restarting the local runtime without double debiting.
- Both real app home screens loaded after local sign-in with the Mac demo server stopped.
- Temporary native test hooks, automatic test sign-in and diagnostics were removed before the release archives.

These checks cover native runtime and app data flows. They are not a claim that every screen was manually tapped or that Apple Maps works fully offline.
