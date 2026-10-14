# Integrations status

What is real, what is simulated and what is missing for every external system Naya touches.
Owner: Achraf. Last verified: 2026-10-13 against branch `chore/docs-foundation-and-fixes` (based on c38429d); rows touched
by [ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md) re-checked on 2026-10-14 on `integration/trial-2026-10-14`.
This page replaces `docs/INTEGRATIONS.md` (30 September, f0f8d46; deleted on this branch), which had no rows for the
Oct 6 features and said that nothing is dialled.

Nothing below is live. There is no production backend: the production EAS profile points at the placeholder
`https://api.naya.example` (`apps/passenger/eas.json`, `apps/driver/eas.json`). Since 14 Oct 2026 the simulations
remain but carry no label in the apps or the admin ([ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md)):
they answer on their own after a realistic delay, and their copy stays true for the mode it runs in (no claim that
something happened when it did not). Tell anyone who gets a build that it runs on mock data. When you add or change a
simulation, update this page in the same PR (see the [PR template](../../.github/pull_request_template.md)).

**Two runtime modes change some rows** (details in [AGENTS.md](../../AGENTS.md#runtime-modes) and
[ADR-0012](../adr/0012-native-demo-builds-run-the-demo-api.md)):

- **Connected**: the apps call the demo API on :4010. Web builds and the admin are always connected.
- **Standalone** (default for native builds): the demo API runs inside each app, with its own data on the phone.
  The two apps and the admin never share state, and dev mode is always on.

Dev mode is on unless `NAYA_DEV=0` (`services/demo-api/src/main.ts:13`). It gates the fixed OTP (and so its delivery
on the device), the `/dev` routes, the passenger's own top-up resolution (`POST /prototype/wallet/:id/resolve`, which no
screen calls any more), the Famille example route, the parent's Famille steps and the stand-in proof photos. It does
**not** gate the payer's own outcome on the provider sandbox route (no screen calls it any more; see Payments). The
apps' demo flag is on unless `EXPO_PUBLIC_DEMO=0` (`packages/ui/src/core/apiBase.ts:4-5`). Both are opt-out today
(P9, [ADR-0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md)).

## Sign-in and identity

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| Phone sign-in (SMS OTP) | No SMS is sent. In dev mode the code is always `123456`; the API returns it and the app delivers it like a text message, about 1.6 s later: a local notification « Naya » (« Votre code de connexion Naya : 123456 »), or a message card « Nouveau message · Naya » on the code screen when notifications are not allowed and on the web. Tapping either fills and verifies the code; the code field has iOS one-time-code autofill (`deliverSignInCode` in `packages/ui/src/features/auth.tsx`). Any valid number signs in or opens an account. With `NAYA_DEV=0` the code is random and printed to the API's stdout. Codes expire after 5 min, can be resent after 30 s, and lock after 5 wrong attempts (`services/demo-api/src/services/auth.ts:8-55`). | SMS provider covering Maroc Telecom, Orange and inwi; a sender ID; rate limiting at the edge. |
| Sign in with Apple | Hidden. Passenger app only: the native `AppleAuthenticationButton` appears when `GET /auth/providers` reports Apple (`NAYA_APPLE_AUTH_CONFIGURED=1`) and the device supports it. The button gets a token from Apple, but nothing sends it to the server and no server route verifies it (`ProviderButtons` in `apps/passenger/src/app/(auth)/phone.tsx`; `GET /auth/providers` in `services/demo-api/src/app.ts`). The driver app has no Apple button. | Apple Developer team, Services ID, server-side identity-token verification and account linking. |
| Google sign-in | Hidden. `/auth/providers` can report it (`NAYA_GOOGLE_AUTH_CONFIGURED=1`), but no app renders a Google button and no Google asset is bundled. | OAuth client IDs (iOS, Android, web), official button assets from Google's branding page, server verification. |
| Admin sign-in | Email and password checked by the demo API (scrypt hashes, `auth.ts:17-18`). The token is kept per browser tab in `sessionStorage` (`apps/admin/src/lib/api.ts:13-29`). The login page shows only the form since 14 Oct 2026 (ADM-15); the seeded accounts stay valid ([runbooks/demo-data.md](../runbooks/demo-data.md#admin-accounts-appsadmin)). | Real staff accounts, a second factor or SSO. |
| Identity and vehicle review | Real file handling: camera, photo library or PDF, uploaded to authenticated endpoints. The server checks magic bytes, refuses SVG and files over 10 MB (`services/demo-api/src/services/uploads.ts`). The app resizes images to at most 1600 px and re-encodes them as JPEG, which strips location metadata (`packages/ui/src/features/uploads.ts:18-47`). A human with `verification.decide` decides in the admin. Nothing infers face or gender. No shortcut since 14 Oct 2026: every piece is taken or imported (`packages/ui/src/features/capture.tsx`). In standalone builds an on-device reviewer takes a dossier submitted on the phone up after 6 s (« Vérification en cours ») and approves it 20–40 s after submission; it never requests a correction or refuses (`REVIEW_PICKUP_MS`, `reviewDelayMs` in `services/demo-api/src/embedded.ts`). | Encrypted object storage with a retention policy, a reviewer access policy, the CNDP declaration (law 09-08) and a DPIA, and the eligibility rule ([open question D1](open-questions.md#d1-women-only-eligibility)). |

## Payments and money

Money rules: [FINANCE.md](../FINANCE.md) and [specs/payments-and-fees.md](../specs/payments-and-fees.md).

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| Card payment for a ride | A stand-in form replaces the provider's hosted fields. Only the last 4 digits go to `POST /provider-sandbox/tokenize`, which returns `tok_demo_<last4>`; Naya stores the token and the last 4 (`apps/passenger/src/app/(app)/card/new.tsx:25-44`; `POST /provider-sandbox/tokenize` in `services/demo-api/src/app.ts`). The form accepts any Luhn-valid number. The outcome follows the last 4 digits, which the app never explains: `0002` fails after 3 s, `3155` stays pending, any other number confirms after 3 s (`queueCardOutcome`, `services/demo-api/src/services/rides.ts:520-526`). New cards read « Carte •••• NNNN ». The payer can still settle her own pending payment through `POST /provider-sandbox/:kind/:ref/:outcome`, even with `NAYA_DEV=0` (route in `services/demo-api/src/app.ts`), but no screen calls it. | Payment service provider with hosted fields or an SDK, and signed webhooks. Remove the sandbox route outside demo builds. |
| Driver wallet recharge | Each city has « Carte bancaire » and « Réseau d’agences », the second enabled only in Rabat (`city()` in `services/demo-api/src/seed.ts`). Each enabled non-card payment option of the catalog adds one more provider: « Wallet marocain / paiement mobile », « Cash Plus », « Wafacash » (`prototypeProviders` in `services/demo-api/src/services/prototype.ts`). Older stores' « (démo) » suffixes are dropped when read (`providerName`). The mock provider answers on its own: a card recharge is confirmed after 3 s while the app shows « Paiement en cours » (`apps/driver/src/app/(app)/recharge/sandbox/[id].tsx`, historical file name), any other recharge after 8 s (`createRecharge` in `services/demo-api/src/services/finance.ts`). A refusal can only be forced through `POST /dev/providers/recharge/<ref>/fail`. The sandbox route still accepts the driver's own outcome in every mode, but no screen calls it. | Provider accounts per city and purpose, signed webhooks. |
| Driver withdrawal | Mock bank transfer. A payout account ending `0000` fails after 5 s (« Compte bénéficiaire refusé par la banque. »); any other account (the seed uses ••4821 for Amina) confirms after 8 s (`createWithdrawal` in `services/demo-api/src/services/finance.ts:241-249`; payout accounts in `seed.ts`). No admin approval step. | Payout provider, beneficiary verification, reconciliation, a way for drivers to add a payout account. |
| Provider callbacks | `POST /providers/:provider/callback`: HMAC-SHA256 over the raw body in `X-Naya-Signature`, deduplicated by event id (route in `services/demo-api/src/app.ts`; `verifySignature` and `applyProviderEventIn` in `finance.ts:74-98`). Demo timers and sandbox screens apply their outcomes through the same code path ([ADR-0010](../adr/0010-provider-outcomes-are-applied-through-one-code.md)). With `NAYA_DEV=0` the API refuses to start on the default secret (`main.ts:15-20`). | Set `NAYA_PROVIDER_SECRET`, one secret per provider, replay protection by timestamp as well as event id. |
| Passenger wallet top-up (« Portefeuille Naya ») | Top-up options come from the catalog: « Carte bancaire », « Wallet marocain / paiement mobile », « Cash Plus », « Wafacash » (`defaultPrototypeCatalog()` in `packages/domain/src/prototype.ts`). A top-up of 10 to 100 000 MAD is created as pending; the mock provider confirms it on its own after 3 s (card, mobile wallet) or 8 s (agency) (`settleDueWalletTopups` in `services/demo-api/src/services/prototype.ts`, run by the server's tick). There is no signature; any top-up is accepted (P7). The old self-resolution route (`POST /prototype/wallet/:id/resolve`) now exists only in dev mode and no screen calls it. Confirmed funds can pay rides and become withdrawable driver credit. | Decision [D5](open-questions.md#d5-passenger-wallet) (probably a partner licensed by Bank Al-Maghrib; confirm with counsel). Top-ups confirmed only by a signed provider callback. An append-only ledger visible in admin Finance. |
| Ride paid from « Portefeuille Naya » | Internal to the demo API. The fare is held at booking, released on cancellation or when no driver is found, and settled at completion; the driver is then credited the net (`services/demo-api/src/services/rides.ts:199`, `:484`, `:821`, `:625-629`). | As above (D5, [ADR-0040](../adr/0040-passenger-wallet-model.md)). |
| Ride paid with « Wallet marocain » (`mobile_wallet`) | No provider step at all. At completion the payment is marked confirmed (provider `mobile-wallet-demo`) and the driver is credited at once (`rides.ts:625-629`). | A mobile-wallet provider; confirm only on a provider event (D5). |

## Safety and contact

SOS rules: [specs/safety-sos.md](../specs/safety-sos.md).

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| SOS (« SOS · sécurité ») | Shown on the passenger and driver ride screens and on family trips. « Déclencher l’alerte » stores an alert with the ride or family trip, a typed trusted-contact name and a position. For rides that position is the ride's last driver position (GPS or simulated), else the pickup point; the app never reads the device location when the alert is raised, so on the passenger's phone it is never her own position (the `SafetyButton` calls in `apps/passenger/src/app/(app)/ride.tsx` and `apps/driver/src/app/(app)/ride.tsx`). Since 14 Oct 2026 the sheet has two real actions: « Appeler le 19 (police) » (`tel:19`, logged as « Appel au 19 lancé ») and « Prévenir un proche », which opens the phone's share sheet with a map link (logged as « Position partagée avec un proche » once shared). Older builds' « (simulation) » action names are recorded under these (`services/demo-api/src/services/prototype.ts`). The copy follows the mode: in connected mode « Transmise à l’équipe sécurité Naya avec votre position », and an admin with `safety.respond` (the support agent has it) can take charge of the alert and resolve it with a note on the admin « Alertes SOS » page (`/sos`, P2), which the open sheet shows; in standalone builds there is no desk, so the sheet says the alert is recorded with the position and offers the 19, without claiming that anyone was notified (`SafetyButton` in `packages/ui/src/features/prototype.tsx`). Statuses only move forward. | Decision [D2](open-questions.md#d2-sos-at-launch) and [ADR-0035](../adr/0035-sos-production-model.md): who answers and when, a real call, device GPS, live location sharing with a trusted contact, status back to the user. |
| Emergency call to the police (19) | **Real.** The passenger contact sheet (« Urgence · police (19) », `apps/passenger/src/features/ride/ContactSheet.tsx`) and the driver contact sheet (« Appeler le 19 (police) », `apps/driver/src/app/(app)/ride.tsx`, added 13 Oct), both with `testID="call-police"`, open `tel:19` in the phone's dialler; a device that cannot dial shows « Appel impossible depuis cet appareil ». The old INTEGRATIONS.md said nothing is dialled; that was wrong. | Confirm the emergency numbers with local ops (D2). Help copy still says « 15 (SAMU) » (PAX-11). |
| Call or message the other party through Naya | Not available. The passenger sheet lists « Appeler via Naya » and « Envoyer un message » as « Bientôt disponible », under « L’appel et le message via Naya ne sont pas encore disponibles. » (`ContactSheet.tsx`). The driver sheet says « L’appel et le message via Naya ne sont pas encore disponibles. ». No number is shown or dialled. The demo API still stores an undisplayed `phoneMasked: 'Appel masqué via Naya'` on the ride's driver (`services/demo-api/src/services/rides.ts:240`, `seed.ts:247`). | A number-masking telephony provider ([ADR-0031](../adr/0031-number-masking-is-the-only-planned-passenger.md)). Until then, no copy may promise masked numbers (DOC-07). |
| In-app voice or video call (Naya Famille) | Missing. Asked for in the founder's brief ([task 4](../tasks/2026-10-13.md)); see [open question F4](open-questions.md#f4-video-call). | A decision first (F4), then a calling provider or a hand-off. |
| Turn-by-turn navigation (driver) | **Real hand-off.** The driver ride screen opens Apple Maps (`maps://`) on iOS, Google Maps navigation (`google.navigation:`) on Android, and a Google Maps web link elsewhere (`openNavigation` in `apps/driver/src/app/(app)/ride.tsx`). | Nothing new; check on physical devices. |

## Naya Famille

All Famille steps run through `/prototype/family/*` in `services/demo-api/src/services/famille.ts`. Rules:
[specs/family.md](../specs/family.md). Salma's family (Lina, Amina, a weekday school trip) is seeded in every scenario
(`MOCK_FAMILIES` in `services/demo-api/src/seed.ts`); there is no « exemple de démo » button any more.

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| Subscription billing | Mock. Subscribing assigns an approved Famille chauffeuse in the city and writes « Abonnement famille activé · <plan> » to the audit log (`addSubscription`). Nothing is charged and the dedicated driver earns nothing (P16). | Decision [D3](open-questions.md#d3-naya-famille-at-launch) and [ADR-0036](../adr/0036-naya-famille-operating-model.md): billing through the payment layer, driver pay through the ledger. |
| Pick-up and drop-off photos | The chauffeuse takes a real photo, uploaded and checked to be her own image. With the mock backend, a device without a camera (web, iOS Simulator) attaches a stand-in proof instead, which the server accepts only in dev mode and the parent sees as the mock photo from `packages/assets/mock/` (`takePhoto` in `packages/ui/src/features/famille/FamilleTripScreen.tsx`; `proofFrom` in `services/demo-api/src/services/famille.ts`). No label marks it. | Camera capture checked on devices, and a child-data access and retention policy (D3). |
| Pickup check | The driver types the child's first name and the server compares it with the stored name (`pickupVerified`). This is an attestation, not an identity check: the driver already sees the name. It comes with the pick-up photo and the parent's approval (below). | Decision D3 and [open question F2](open-questions.md#f2-parent-at-pick-up). |
| Handover code | A 4-digit code per authorised recipient, set by the parent and stored in plain text. On « Confirmer la remise » the server compares the code. The driver's payload never carries the codes, and the handover locks after 5 wrong codes, with no unlock (`HANDOVER_MAX_ATTEMPTS` in `packages/domain/src/prototype.ts`; first half of P1). The seeded family uses `1234` (Salma) and `5678` (Youssef). | One-time codes per trip, stored hashed (D3, ADR-0036). |
| Trip position for the parent | The chauffeuse's phone posts a position during the trip (`POST /prototype/family/trips/:id/position`); when no fix comes (standalone builds, the web, the mock bot) the server moves the position along the route itself, with no label (`services/demo-api/src/services/famille.ts`). | Live GPS from the driver's phone (the brief asks for every second), shown to the parent. |
| Parent notifications | Timeline entries stored on the trip and read by polling. Nothing is pushed to the parent's phone. | Remote push (see below). |
| Parent-approved start, drop-off photo at school | Built since the founder's brief ([task 4](../tasks/2026-10-13.md)): the chauffeuse asks to start, the parent approves on site or remotely within 3 min (`FAMILY_APPROVAL_TIMEOUT_SECONDS`) or refuses; the drop-off needs a photo and, when the child has recipients, the handover code. On mock trips a bot may play the chauffeuse or the parent; its steps read like real ones and only the audit trail names it (`runFamilyBots`). | Decision D3 ([ADR-0036](../adr/0036-naya-famille-operating-model.md)). |

## Location, maps and routing

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| Device location | **Real.** Passenger: foreground permission and one position for the pickup, with a manual pin when refused (`apps/passenger/src/features/location/useLocation.ts:16-21`). Driver: device GPS posted to `POST /driver/location` while she is online or on a ride (`useLocationStream` in `apps/driver/src/lib/location.ts`), and in the background during an accepted ride through a TaskManager task (`apps/driver/src/lib/backgroundLocation.ts`). The background task follows the server's active ride (`useRideTracking` in `apps/driver/src/app/(app)/_layout.tsx`), stops at sign-out, and stops itself when the server answers `onRide: false` or refuses the position; the server refuses positions from a driver who is offline with no ride (P4). Standalone builds send no GPS at all: going online uses a fixed Rabat position and the movement is simulated. Never verified on a physical device with the screen locked. | Physical-device tests on iOS and Android; the Play background-location declaration. |
| Maps in the mobile apps | iOS: Apple Maps through react-native-maps, no key. Android: Google Maps only if `GOOGLE_MAPS_ANDROID_KEY` was set at build time (`apps/*/app.config.ts`). Otherwise, and on web: raster tiles from `EXPO_PUBLIC_MAP_TILE_URL`, default OpenStreetMap standard tiles, with attribution (`packages/ui/src/map/NayaMap.tsx:13-16`, `TileMap.tsx:17-24`). | A keyed Google Maps SDK on Android, or a licensed tile provider for the fallback ([ADR-0046](../adr/0046-production-map-tile-provider.md)). |
| Maps in the admin and the website | Admin: `MiniMap` loads `tile.openstreetmap.org` tiles directly (`apps/admin/src/components/MiniMap.tsx:64`). Website: `NEXT_PUBLIC_MAP_TILE_URL`, default OpenStreetMap (`apps/web/components/map.tsx:27-28`). | Same as above, plus a privacy mention on the website (ADR-0046). |
| Routing and ETA | Deterministic demo routing. Known legs are fixed (Gare Rabat Ville → Agdal → Hay Riad is 10 km / 25 min); other legs use 1,35 × great-circle distance at 24 km/h. Routes carry `source: 'demo'` (`packages/domain/src/geo.ts:60-80`). | A routing API (distance matrix and polyline). |
| Driver movement | When the driver app sends no GPS, the server interpolates her position (towards the pickup, then along the route) 20 times faster than real time (`DEMO_TIME_FACTOR` at `services/demo-api/src/services/rides.ts:48`; `withTracking`), with `source: 'demo'`. Since 14 Oct 2026 no label shows it (« Déplacement simulé » and « Trajet simulé » were removed). A mock driver (bot) accepts offers after 3 s and drives the ride: started from the dev launcher in connected mode (`services/demo-api/src/services/bot.ts`), always present in standalone passenger builds (`embedded.ts:30-34`). Real positions (`source: 'gps'`) win when the driver app posts them. | Background location in a development or production build, on real phones. |

## Notifications and real time

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| Push notifications | Local notifications only, scheduled by the app while it runs: the passenger's « … est arrivée » (`apps/passenger/src/app/(app)/ride.tsx`) and the driver's « Nouvelle course » (`apps/driver/src/app/(app)/_layout.tsx`). No remote push, so nothing reaches a closed app. | EAS project ID, APNs key, FCM credentials and a server push sender ([ADR-0013](../adr/0013-real-time-by-polling-with-local-notifications.md)). |
| Real-time updates | Polling: 1,5–4 s on live mobile screens (driver status, active ride, wallet, family), 5–15 s on idle screens and in the admin. Refetch on focus and reconnect; paused while the app is in the background (`packages/ui/src/core/query.ts`, `apps/*/src/lib/queries.ts`). | WebSocket or push-driven invalidation. |

## Data and runtime

| Capability | Demo behaviour | Needed for live |
|---|---|---|
| Persistence (connected) | One JSON file, `services/demo-api/.data/db.json` (override with `NAYA_DATA_DIR`; an API that Playwright starts itself uses `.data/e2e`). Single writer; each request runs in one transaction that rolls back on error; writes go to a temp file, then rename. Uploads are files beside it. A `schemaVersion` other than 1 silently reseeds the demo data (`services/demo-api/src/store.ts:22-29`, [ADR-0029](../adr/0029-demo-store-is-versioned-schemaversion-1-and.md)). | Managed Postgres behind the same contracts (`packages/api`), with row locks for offer acceptance ([ADR-0045](../adr/0045-production-backend-and-live-integrations.md)). |
| On-device persistence (standalone) | The embedded demo API keeps its data in the app's Documents folder, `naya-standalone-demo/demo-v1.json`, with uploads beside it and bundled specimen documents (`packages/ui/src/core/localDemo.native.ts`, `embedded.ts:14-23`). Data survives relaunch and is never synced. A simulated counterpart plays the other side: a driver for passenger trips, and a new cash offer about every 30 s for an online driver (`embedded.ts:49-61`). | None: demo builds only. Production bundles must not contain the embedded API, its fixtures or the seeded credentials (P9, ADR-0044). |
| Website (`apps/web`) | Not connected to the demo API. The landing page's booking and driver forms and the `/backoffice` prototype read and write this browser's `localStorage` (key `naya-web-prototype-v1`, `apps/web/lib/store.ts`). Nothing is sent anywhere. The price estimate uses its own formula, not `@naya/domain`. | Decision [D8](open-questions.md#d8-which-backoffice) ([ADR-0038](../adr/0038-canonical-backoffice.md)). |

## Not integrations

- **Appearance** (light, dark or system): stored on the device in AsyncStorage under `naya.theme`
  (`packages/ui/src/core/theme.tsx:33-39`). No external service is involved.
- **Logo concepts**: static vector assets in `packages/assets` (`logoConcepts`), shown in the apps' « Identité · 6 pistes »
  screen (`packages/ui/src/features/brand.tsx`).

## Changes from docs/INTEGRATIONS.md (30 September)

- Corrected: the apps do dial a number. `tel:19` opens the phone's dialler from the passenger and driver contact sheets.
- Added: passenger wallet top-ups and wallet or mobile-wallet ride payments, the extra driver recharge providers,
  SOS, Naya Famille proofs, standalone on-device persistence, the driver navigation hand-off, admin sign-in and the website.
- Unchanged in substance: OTP, Apple and Google sign-in, identity review, card test numbers, withdrawals, provider
  callbacks, maps, routing, push and polling.

## Changes on 14 October 2026 ([ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md))

- Every simulation above stays; none is labelled in the apps or the admin any more.
- Sign-in: no « compte démo » button and no prefilled code; the code arrives as a notification or an in-app message.
- Payments: the mock provider answers recharges and passenger top-ups on its own; the sandbox screen and the
  « Simuler » buttons are gone, and the card form shows no test numbers.
- Identity review: no « Passer » shortcut; standalone builds approve a dossier sent on the phone 20–40 s later.
- SOS: real 19 call and share sheet; the copy says a desk was reached only in connected mode.
- Naya Famille: Salma's family is seeded; stand-in proof photos come from `packages/assets/mock/`.
