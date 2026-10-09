# Integration status

Nothing below is presented as live. The demo API simulates external systems explicitly and labels them as such in the apps.

| Capability | Demo behaviour | Needed for live operation |
|---|---|---|
| Phone sign-in (SMS OTP) | Fixed code `123456`, shown on screen with a "Démo" label. `NAYA_DEV=0` switches to random codes logged server-side. | SMS provider (e.g. an aggregator covering Maroc Telecom / Orange / inwi), sender ID, rate limiting at the edge. |
| Sign in with Apple | Hidden. Code path uses the native `AppleAuthenticationButton` and appears only when `/auth/providers` reports it configured **and** the device supports it. | Apple Developer team, Services ID, server-side identity-token verification. |
| Google sign-in | Hidden. No Google asset is bundled (official assets must come from Google's branding page when enabled). | OAuth client IDs (iOS/Android/web), official button assets, server verification. |
| Identity review | Real uploads (camera, library, PDF) to a protected endpoint; manual decision in the admin. No automated face or gender inference, by design. | Secure object storage with encryption and retention policy; reviewer tooling access policy; DPIA / CNDP declaration. |
| Card payments | Tokenised through the demo provider sandbox: test cards `4242` (confirms in 3 s), `0002` (declines), `3155` (stays pending). Naya screens never send a card number to the Naya API. | Payment service provider with hosted fields / SDK, webhooks with signing secret. |
| Recharges (passengers and drivers) | Card (hosted page), Moroccan wallet (approval in the wallet app), mobile payment (SMS confirmation), Cash Plus and Wafacash (8-digit code paid at a counter, expires after 48 h). Outcome decided on the sandbox screen or by expiry. | One account per provider, its adapter (see below), webhook endpoint. |
| Withdrawals | Demo bank transfer: account ••4821 confirms after 8 s, test account ••0000 fails after 5 s. No routine admin approval. | Payout provider, beneficiary verification, reconciliation. |
| Provider callbacks | `POST /providers/:id/callback`, HMAC-SHA256 over the raw body, event-id deduplication. | Set `NAYA_PROVIDER_SECRET`; one secret per provider. |
| Maps | iOS: Apple Maps via react-native-maps (no key). Android: Google Maps only if `GOOGLE_MAPS_ANDROID_KEY` is set at build time; otherwise and on web, a tile map on OpenStreetMap standard tiles (development use, attribution shown). | Keyed Google Maps SDK on Android, or a licensed tile provider for the fallback. |
| Routing / ETA | Deterministic demo routing (known legs fixed, 1,35 × great-circle otherwise, 24 km/h). | Routing API (distance matrix + polyline). |
| Driver movement | Deterministic simulation, 20× time compression, labelled "Démo"; real GPS is used when the driver app sends positions. | Background location in a development/production build. |
| Push notifications | Local notifications scheduled by the apps. No remote push. | EAS project ID, APNs key, FCM credentials, server push sender. |
| Real-time updates | Polling (1,5–3 s on live screens, refetch on focus/reconnect). | WebSocket or push-driven invalidation. |
| Masked calls / SMS to the driver | Explained as unavailable in the demo; nothing is dialled. | Number-masking telephony provider. |
| Persistence | JSON file in `services/demo-api/.data`, single writer, transactional. | Managed Postgres with the same contracts (`packages/api` types). |

## Payment providers: Moroccan wallets, mobile payment and cash networks

Every payment, recharge and payout goes through a **provider configuration** (back-office → Paiements, per city and purpose) that points to an **adapter** in `services/demo-api/src/services/payments.ts`. The finance core never knows which company processes an operation:

1. the adapter starts the operation and returns a provider reference plus what the payer must do (`flow`);
2. the provider later reports `confirmed` / `failed` for that reference through `POST /providers/:id/callback` (HMAC-SHA256, event-id deduplication);
3. only a confirmation posts to the ledger (drivers) or credits the wallet (passengers).

| Flow | Payer experience | Demo adapter | Production slot |
|---|---|---|---|
| `hosted_page` | Provider's secure page (3-D Secure) | `demo-card` | `live-card` (card PSP / acquirer) |
| `wallet_approval` | Request sent to her wallet or mobile-money app for her phone number | `demo-mobile-wallet`, `demo-mobile-payment` | `live-mobile-wallet` (interoperable Moroccan mobile wallet) |
| `voucher` | 8-digit code paid in cash at an agency, expires after 48 h | `demo-cash-network` (Cash Plus, Wafacash) | `live-cash-network` |
| `bank_transfer` | Payout to the driver's bank account | `demo-bank-transfer` | `live-bank-transfer` |

**Adding or replacing a provider**: implement `PaymentAdapter.initiate` (call the provider's API, return its reference and instructions) and map its webhook to a `ProviderCallback`. Then, in the back-office, create a provider with that adapter or switch an existing one to it. Pending operations keep their reference and finish normally; the switch is audited. Settings per provider: display name, audience (passengers, drivers or both, for recharges), minimum and maximum amount, instructions shown to the payer.

Candidates to evaluate for production (none is contracted or connected): a card acquirer / PSP for hosted card pages, an interoperable mobile wallet operator (Bank Al-Maghrib framework), telecom mobile-money wallets, and the Cash Plus and Wafacash agency networks. Each needs a merchant agreement, sandbox credentials and a signed webhook.
