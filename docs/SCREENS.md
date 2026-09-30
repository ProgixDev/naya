# Screen coverage

47 main screens (16 passenger, 18 driver, 13 admin) and the 263 scenario frames of Figma file `nOuWsQ5MA8CdU5HsSGoXwP` are implemented as **state-driven routes** — one route per screen, whose states come from server data (ride status, offer deadline, case status, transfer status…) rather than 263 duplicated routes. The 30 countdown frames (`D07-timer-*`) are one real timer against the server deadline.

Captures: `docs/screens/passenger/` (390 pt + `375/`), `docs/screens/driver/` (390 pt + 375/430 samples), `docs/screens/admin/` (1440 and 1024), `docs/screens/native/` (iOS 27 simulator). Contact sheets are in each folder's `sheets/`.

Legend — **E2E**: covered by a Playwright spec in `e2e/tests/`; **API**: covered by `services/demo-api/test/scenarios.test.ts`.

## Passenger (apps/passenger)

| Figma | Frames covered | Route | Evidence |
|---|---|---|---|
| P01 `8:2` | P01b, P01c | `(auth)/welcome` | capture, E2E |
| P02 `8:180` | P02-consent, -keyboard, -error | `(auth)/phone` | capture, E2E S01 |
| P03 `8:217` | P03-error, -expired, -resent | `(auth)/otp` | E2E S01, API (OTP) |
| P04 `8:250` | P04-selfie, -capture, -preview, -permission, -document, -unreadable, -review | `(verify)/identity`, `(verify)/capture/[item]`, `(verify)/review` | capture, E2E S01/S02 |
| P05 `8:295` | P05-approved, -more, -rejected | `(verify)/verification-status` | capture, E2E S01/S02, cross-role S01 |
| P06 `8:339` | P06-permission, -zone, -network, -city, -casa, -reduced, -opaque | `(app)/(tabs)/index` | capture, E2E S07 |
| P07 `8:461` | P07-add, -reordered, -no-stop, -map | `(app)/route` | capture, E2E S03/S07 |
| P08 `8:539` | P08-price, -payment, -electronic, -dynamic, -casa, -schedule, -price-dynamic | `(app)/quote` | capture, E2E S03/S05/S06 |
| P09 `8:642` | P09-none, -long, -cancel, -cancelled, -electronic, -dynamic | `(app)/ride` (searching / no_driver) | capture, E2E S07 |
| P10 `8:708` | P10-contact, -cancel, -arrived, -trip, -driver-cancel, -stale, -electronic, -dynamic variants | `(app)/ride` | capture, E2E S03/S08/S09/S16 |
| P11 `8:864` | P11-payment, -rating, -rated, -cancelled, -pending, -failed, -electronic, -dynamic | `(app)/receipt/[id]` | capture, E2E S03/S04/S08/S16 |
| P12 `8:927` | P12-history, -detail, -cancel, -empty | `(app)/(tabs)/trips`, `(app)/scheduled/[id]` | capture, E2E S05/S14 |
| P13 `8:992` | P13-address, -settings, -notifications | `(app)/(tabs)/account`, `(app)/places`, `(app)/preferences` | capture, E2E |
| P14 `8:1085` | P14-card | `(app)/payments`, `(app)/card/new` | capture, E2E |
| P15 `8:1141` | — | `(app)/help`, `(app)/help/[topic]` | capture |
| P16 `8:1202` | P16-attachment, -status, -reply | `(app)/support`, `support/new`, `support/[id]` | capture, E2E S14 |

## Driver (apps/driver)

| Figma | Frames covered | Route | Evidence |
|---|---|---|---|
| D01 `9:2` | D01b | `(auth)/welcome` | capture |
| D02 `9:119` | D02-consent | `(auth)/phone` | capture |
| D03 `9:150` | D03-error | `(auth)/otp` | capture, API |
| D04 `9:180` | D04-permit, -car, -insurance, -photos, -capture, -camera, -review | `(onboard)/documents`, `docs/start`, `docs/identity`, `docs/vehicle`, `docs/capture/[item]` | capture, E2E S10 |
| D05 `9:238` | D05-more, -refused, -approved | `docs/status` (person and vehicle independent) | capture, E2E S10 |
| D06 `9:291` | D06-online, -debt, -gps, -docs, -restored, -casa, -opaque, -reduced | `(app)/(tabs)/index` | capture, E2E S11/S12 |
| D07 `9:418` | D07-10, -expired, -declined, -withdrawn, D07-timer-29…1 | `(app)/offer` | capture, E2E S11, API S11 (deadline, race) |
| D08 `9:501` | D08-arrived, -contact, -cancel, -cancelled | `(app)/ride` | capture, E2E S09 |
| D09 `9:580` | D09-stale, -stop | `(app)/ride` | capture, E2E S03 |
| D10 `9:651` | D10-cash, -electronic, -pending, -failed | `(app)/ride-end/[id]` | capture, E2E S03/S04 |
| D11 `9:711` | D11-filter, -empty | `(app)/(tabs)/earnings` | capture, cross-role S03+S04 |
| D12 `9:784` | D12-negative, -zero, -near, -after, -recharged, -after-recharged | `(app)/(tabs)/wallet` | capture, E2E S12/S13 |
| D13 `9:849` | D13-detail, -cash, -filter, -withdrawal, -withdrawal-recharged | `(app)/ledger`, `(app)/ledger/[id]` | capture, E2E |
| D14 `9:882` | D14-debt, -provider, -pending, -failed, -success, -normal variants | `(app)/recharge`, `recharge/sandbox/[id]`, `recharge/[id]` | capture, E2E S12/S16 |
| D15 `9:923` | D15-pending, -success, -failed, -insufficient, -recharged variants | `(app)/withdraw`, `withdraw/[id]` | capture, E2E S13/S16 |
| D16 `9:983` | D16-empty | `(app)/rides`, `(app)/rides/[id]` | capture |
| D17 `9:1030` | D17-settings | `(app)/(tabs)/account`, `profile/vehicle`, `profile/preferences` | capture |
| D18 `9:1133` | D18-form, -status, -reply | `(app)/support`, `support/new`, `support/[id]` | capture |

## Admin (apps/admin)

| Figma | Frames covered | Route | Evidence |
|---|---|---|---|
| A00 | A00-session, A00-denied | `/connexion`, permission gate | capture, E2E |
| A01 `10:2` | — | `/` | capture, cross-role |
| A02 `10:210` | A02-search, -filter | `/personnes` | capture |
| A03 `10:350` | — | `/personnes/:id` | capture |
| A04 `10:553` | — | `/verifications` | capture, E2E |
| A05 `10:680` | A05-vehicle, -confirm, -vehicle-confirm, -more, -reject, -done, -vehicle-done, -more-done, -rejected, -document | `/verifications/:id` | capture, E2E S01/S02/S10 |
| A06 `10:870` | — | `/courses` (rides + scheduled) | capture |
| A07 `10:1010` | A07-electronic | `/courses/:id` | capture, cross-role |
| A08 `10:1194` | A08-confirm, -resolved | `/support`, `/support/:id` | capture, E2E S14 |
| A09 `10:1291` | A09-wallet, -transaction, -failed, -correction, -correction-confirm, -corrected | `/finance` | capture, E2E |
| A10 `10:1447` | A10-add, -zone, -zone-done, -future | `/villes` | capture, E2E S15 |
| A11 `10:1573` | A11-casa, -confirm(-casa), -dynamic(-casa), -policy(-casa), -saved(-casa) | `/villes/:id/regles` | capture, E2E S06/S15 |
| A12 `10:1710` | A12-edit, -saved, -casa variants | `/paiements` | capture, E2E |
| A13 `10:1863` | A13-detail, -config, -correction, -config-casa | `/audit` | capture, E2E |

## Scenario index (S01–S16)

| Scenario | API test | UI E2E |
|---|---|---|
| S01 registration and manual approval | ✓ | passenger, admin, cross-role |
| S02 correction / refusal and resubmission | ✓ | passenger, admin |
| S03 immediate cash ride with Agdal stop | ✓ | passenger, driver, cross-role |
| S04 electronic payment and debt compensation | ✓ | passenger, cross-role |
| S05 scheduled booking, modification, cancellation | ✓ | passenger |
| S06 dynamic price disclosure and rule configuration | ✓ | passenger, admin |
| S07 GPS denied, manual pickup, out-of-zone, no availability | ✓ | passenger |
| S08 passenger cancellation with disclosed fee | ✓ | passenger |
| S09 driver cancellation and passenger recovery | ✓ | passenger, driver |
| S10 independent driver and vehicle approvals | ✓ | driver, admin |
| S11 offer acceptance, refusal, expiry, withdrawal | ✓ | driver |
| S12 debt threshold and recharge recovery | ✓ | driver |
| S13 withdrawal reservation, success, failure | ✓ | driver |
| S14 history, support ticket, reply, admin resolution | ✓ | passenger, admin |
| S15 future city with distinct rules and audit | ✓ | admin |
| S16 stale tracking and pending/failed payment, recharge, withdrawal | ✓ | passenger, driver |
