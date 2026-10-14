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
(6 logo concepts), and `dev` (`DevLauncher`; no visible entry since ADR-0058: 2 s long press on the welcome logo or
naya-chauffeuse://dev, `__DEV__` builds only).

## Background location (src/lib/backgroundLocation.ts)
- Only during an accepted ride (driver assigned → arrived → in progress), so the passenger sees the car on a locked
  phone. Never while merely online. The permission copy in `app.config.ts` promises exactly this.
- The TaskManager task `naya-driver-ride-location` is defined at import time from the root `_layout.tsx`.
  It is not defined in standalone demo builds or on web; `startRideTracking()` returns 'unsupported' there.
- "Always" permission is requested in context, after foreground permission. If refused, sharing is foreground-only.
- Start and stop follow the server's active ride (`status.activeRide`), not the ride screen: `useRideTracking()` in
  `(app)/_layout.tsx` starts it once per ride id and stops it as soon as the server reports no active ride, including
  at app start after a kill. Going home mid-ride keeps it on. Never start or stop it from `ride.tsx` (P4).
- Every sign-out stops it: `src/lib/session.ts` listens to the session store. The task also stops itself with no
  saved session, on 401/403/409 from `POST /driver/location`, or when the server answers `onRide: false`.
  Android runs it with `killServiceOnDestroy: true` (swipe from recents kills the service).
- Today: once the ride ends with the phone locked and parked, the self-stop waits for the next location fix (status
  polling pauses in the background). « Always » is still requested with no prominent disclosure (DRV-16).
- The task reads the session from SecureStore key `naya.driver.session` and posts with raw fetch (DRV-17).
  If you change the session shape in packages/ui, update the task too.

## Offer timer
- The deadline is the server's `offer.expiresAt`. `useDeadline` counts down against `serverClock`, which corrects
  device clock skew from the `X-Server-Time` header. Late or racing accepts are rejected by the server.
- The timeout is per city: `offerTimeoutSeconds`, 10–120 s, default 30 (packages/domain/src/schemas.ts, cities.ts).
  Never hard-code 30 s in copy, notifications or the countdown ring. Offers never auto-accept.
- The background « Nouvelle course » notification gives the time left from `offer.expiresAt` (`(app)/_layout.tsx`).
- Today: `offer.tsx:82` (« Le délai de 30 secondes »), `:117` (`total={30}`) and `(tabs)/index.tsx:127`
  (« 30 s pour répondre ») still assume 30 s (DRV-05).

## Money screens
- Wallet, ledger, recharge and withdrawal show a projection of the server ledger. Never compute balances in the app;
  format with `formatMoney` from `@naya/domain`. Recharges and withdrawals send an Idempotency-Key.
- Today: wallet and mobile-wallet rides show as « Carte » in earnings (P14, DRV-08).

## Sign-out and contact
- Account sign-out first calls `setOnline(false)`; if the server answers `ACTIVE_RIDE_EXISTS`, it stays signed in
  with « Terminez la course en cours avant de vous déconnecter. » (DRV-10). Today: a network failure there still
  signs out, and the DossierHub and dev-launcher sign-outs do not check.
- The ride contact sheet promises no masked call: « L’appel et le message via Naya ne sont pas encore disponibles. »,
  plus an « Appeler le 19 (police) » button (`tel:19`). Toasts render behind modal sheets (UI-07), so a failure
  inside a sheet uses `Alert.alert`.

## Checks
- `pnpm --filter @naya/driver typecheck`, `pnpm --filter @naya/driver lint` (0 errors).
- There is no test script: the driver app has no unit tests (DRV-18). Its eslint packages are not declared in
  package.json and resolve through hoisting from the passenger app.
- e2e: driver web on :8082, `pnpm --filter @naya/driver web --port 8082`. See [e2e runbook](../../docs/runbooks/e2e.md).
