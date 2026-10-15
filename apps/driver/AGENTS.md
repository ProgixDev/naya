# Driver app (apps/driver) — agent notes

Read the root [AGENTS.md](../../AGENTS.md) first. The Expo rules in [apps/passenger/AGENTS.md](../passenger/AGENTS.md#expo-rules-replaces-the-old-agentsexpomd)
apply here too: replace `@naya/passenger` with `@naya/driver` in every command.

Expo SDK 57 app "Naya Chauffeuse" (`ma.naya.chauffeuse`, scheme `naya-chauffeuse`). Config: `app.config.ts`. Routes: `src/app/`.
App-only code: `src/lib` (session, queries, prefs, location, backgroundLocation, time) and `src/components` (dossier hub, wallet card, tab bar).

## Route guards (src/app/_layout.tsx)
- `(auth)` when signed out; `(onboard)` until both dossiers (person and vehicle) are submitted; `(app)` once both are submitted.
- `docs/*` is open to any signed-in driver. `dev` is a modal outside the guards.
- Submission opens the dashboard. Approval of both dossiers only gates going online (server `driverEligibility`).

## Routes ↔ Figma (full map in [docs/SCREENS.md](../../docs/SCREENS.md))
| Figma | Route |
|---|---|
| D01–D03 | `(auth)/welcome`, `(auth)/phone`, `(auth)/otp` |
| D04–D05 | `(onboard)/documents`, `docs/start`, `docs/identity`, `docs/vehicle`, `docs/capture/[item]`, `docs/status` |
| D06 | `(app)/(tabs)/index` (dashboard, online toggle) |
| D07 | `(app)/offer` (full-screen modal, timed offer) |
| D08–D09 | `(app)/ride` |
| D10 | `(app)/ride-end/[id]` |
| D11–D12 | `(app)/(tabs)/earnings`, `(app)/(tabs)/wallet` |
| D13 | `(app)/ledger`, `(app)/ledger/[id]` |
| D14 | `(app)/recharge`, `recharge/sandbox/[id]` (« Paiement en cours » modal while the mock provider answers; historical name), `recharge/[id]` |
| D15 | `(app)/withdraw`, `withdraw/[id]` |
| D16 | `(app)/rides`, `(app)/rides/[id]` |
| D17 | `(app)/(tabs)/account`, `profile/vehicle`, `profile/preferences` (+ `ThemePicker` since Oct 6) |
| D18 | `(app)/support`, `support/new`, `support/[id]` |

Added on Oct 6 (89aae18), no Figma frame: `(app)/family` (`FamilyScreen role="driver"`), `(app)/brand`
(6 logo concepts; not a customer screen since R4: no row in Compte, only the dev launcher's `dev-brand`), and `dev` (`DevLauncher`; no visible entry since ADR-0058: 2 s long press on the welcome logo or
naya-chauffeuse://dev, `__DEV__` builds only).

## Background location (src/lib/backgroundLocation.ts)
- Only during an accepted ride (driver assigned → arrived → in progress), so the passenger sees the car on a locked
  phone. Never while merely online. The permission copy in `app.config.ts` promises exactly this.
- The TaskManager task `naya-driver-ride-location` is defined at import time from the root `_layout.tsx`.
  It is not defined in standalone demo builds or on web; `startRideTracking()` returns 'unsupported' there.
- « Always » is never requested on its own (DRV-16): `startRideTracking()` starts only when it is already granted and
  returns 'needs-consent' while it can still be asked. The ride screen then shows `BackgroundLocationExplainer`, which calls
  `requestRideBackgroundLocation()` only after she accepts. If refused, sharing is foreground-only.
- Start and stop follow the server's active ride (`status.activeRide`), not the ride screen: `useRideTracking()` in
  `(app)/_layout.tsx` starts it once per ride id and stops it as soon as the server reports no active ride, including
  at app start after a kill. Going home mid-ride keeps it on. Never start or stop it from `ride.tsx` (P4).
- Every sign-out stops it: `src/lib/session.ts` listens to the session store. The task also stops itself with no
  saved session, on 401/403/409 from `POST /driver/location`, or when the server answers `onRide: false`.
  Android runs it with `killServiceOnDestroy: true` (swipe from recents kills the service).
- Today: once the ride ends with the phone locked and parked, the self-stop waits for the next location fix (status
  polling pauses in the background).
- The task reads the session through `useSession` (restoring it in a fresh background JS context) and posts with the
  API client's `driver.sendLocation` (DRV-17). Permission strings live in `app.config.ts`: photos only, no microphone
  (DRV-15); they need prebuild and a new native build.

## Offer timer
- The deadline is the server's `offer.expiresAt`. `useDeadline` counts down against `serverClock`, which corrects
  device clock skew from the `X-Server-Time` header. Late or racing accepts are rejected by the server.
- The timeout is per city: `offerTimeoutSeconds`, 10–120 s, default 30 (packages/domain/src/schemas.ts, cities.ts).
  Never hard-code 30 s in copy, notifications or the countdown ring. Offers never auto-accept.
- The background « Nouvelle course » notification gives the time left from `offer.expiresAt` (`(app)/_layout.tsx`).
- The ring's total is the offer's own window (`expiresAt` − creation), else the city's `offerTimeoutSeconds`; the home
  line « N s pour répondre » and the expiry copy use the same value, and the line is hidden while she is blocked
  (DRV-05, DRV-11). Android back on a pending offer opens the decline sheet (DRV-19).

## Money screens
- Wallet, ledger, recharge and withdrawal show a projection of the server ledger. Never compute balances in the app;
  format with `formatMoney` from `@naya/domain`. Recharges and withdrawals send an Idempotency-Key.
- Earnings name the method with `paymentMethodPresentation()` and count every non-cash ride as credited (DRV-08).

## Sign-out, deletion, safety and blocks
- Sign-out goes through `useDriverSignOut` (`src/components/useDriverSignOut.ts`, account and DossierHub): offline
  first; if the server refuses (`ACTIVE_RIDE_EXISTS`) or the network fails, she stays signed in and sees the reason
  (DRV-10). Only the dev launcher (dev builds) signs out directly.
- Account deletion: Compte → « Préférences » → « Supprimer mon compte » (`POST /me/deletion`, ADR-0055 implementation
  status). The sheet's lists mirror `deleteAccount` in `services/demo-api/src/services/auth.ts`: keep both in step.
- No contact sheet on the ride while calling is not live (R8): no call button, no « Bientôt disponible » row. Safety
  is the pinned « Sécurité » disc (`SafetyDisc`, testID `sos`) with the 1.5 s hold, « Appeler le 19 » and the other
  numbers in its sheet ([safety-sos.md](../../docs/specs/safety-sos.md)). Toasts render behind modal sheets (UI-07), so
  a failure inside a sheet uses `Alert.alert`.
- A blocked chauffeuse who can lift the block herself sees that action as the main button instead of a disabled
  « Passer en ligne » (R12); while she waits on a review or a test city, the button stays disabled with the reason.
- Status glyphs and words come from `statusPresentation` / `StatusIcon` and `ActionNote kind/state`
  ([ADR-0059](../../docs/adr/0059-status-is-an-icon-problems-keep-words.md)).

## Theming
- Same rules as [apps/passenger/AGENTS.md](../passenger/AGENTS.md#theming): `@naya/tokens` + `useTheme()` or
  `themedStyles`, never `colors.*` at module scope (ActionNote tones were, DM-04). The jest guard in
  `packages/ui/src/__tests__/theme.test.tsx` also scans this app; `KNOWN` stays empty.
- Control boundaries `outline` (radio, checkbox), decorative card edges `hairline`, separators `line`, placeholders
  `muted`; `inverse` only on accent; `shadowColor` never `colors.ink`.
- `WalletCard` is artwork: fixed plum stops and fixed white text in both schemes, like the passenger WalletSummary (DM-17).

## Checks
- `pnpm --filter @naya/driver typecheck`, `pnpm --filter @naya/driver lint` (0 errors).
- There is no test script: the driver app has no unit tests (DRV-18). Its eslint packages are not declared in
  package.json and resolve through hoisting from the passenger app.
- e2e: driver web on :8082, `pnpm --filter @naya/driver web --port 8082`. See [e2e runbook](../../docs/runbooks/e2e.md).
