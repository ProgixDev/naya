# Screen coverage

Every frame of `project-manifest.json` (47 main screens, 263 scenario frames) mapped to the route that implements it. Variants are **states of one screen**, driven by server data; the 29 offer countdown frames (`D07-timer-*`) are one live timer computed from the authoritative `expiresAt`, not 29 routes.

Captures: `docs/screens/passenger/` (390 pt, 375 pt subset), `docs/screens/driver/` (390 pt, plus 375/430 samples), `docs/screens/admin/` (1440 and 1024 px). Native iOS captures: `docs/screens/ios/`.

## Passenger (P01–P16)

| Screen | Figma node | Route | States covered (Figma variants) | Captures |
|---|---|---|---|---|
| P01 | `8:2` | `(auth)/welcome` | slide 2 `13:680`, slide 3 `13:709` | P01-onboarding |
| P02 | `8:180` | `(auth)/phone` | consent `13:738`, keyboard `13:747`, error `13:776` | P02-phone |
| P03 | `8:217` | `(auth)/otp` | error `13:808`, expired `13:840`, resent `13:872` | E2E |
| P04 | `8:250` | `(verify)/identity · capture/[item] · review` | selfie `13:904`, capture `13:996`, preview `13:1054`, permission `13:1096`, document `13:1128`, unreadable `13:1214`, review `13:1246` | P04-identity |
| P05 | `8:295` | `(verify)/verification-status` | approved `13:1308`, more `13:1335`, rejected `13:1367` | P05-more, P05-pending, P05-rejected |
| P06 | `8:339` | `(app)/(tabs)/index` | permission `13:1399`, zone `13:1431`, network `13:1463`, city `13:1495`, casa `13:1524`, reduced `35:6932`, opaque `35:7077` | P06-city, P06-home, P06-permission |
| P07 | `8:461` | `(app)/route` | add `13:1556`, reordered `13:1625`, no-stop `13:1681`, map `13:1713` | P07-map, P07-out-of-zone, P07-route |
| P08 | `8:539` | `(app)/quote` | price `13:1778`, payment `13:1817`, electronic `13:1849`, dynamic `13:1908`, casa `13:1939`, schedule `13:1969`, price-dynamic `46:2073` | P08-dynamic, P08-price, P08-quote, P08-schedule |
| P09 | `8:642` | `(app)/ride (searching / no_driver)` | none `13:1993`, long `13:2025`, cancel `13:2057`, cancelled `13:2065`, electronic `35:6796`, dynamic `35:6864` | P09-long, P09-none, P09-searching |
| P10 | `8:708` | `(app)/ride (assigned / arrived / in trip)` | contact `13:2097`, cancel `13:2109`, arrived `13:2121`, trip `13:2214`, driver-cancel `13:2273`, stale `13:2305`, electronic `46:2106`, arrived-electronic `46:2188`, trip-electronic `46:2264`, dynamic `46:2334`, arrived-dynamic `46:2416`, trip-dynamic `46:2492` | P10-approaching, P10-arrived, P10-cancel, P10-contact, P10-driver-cancel, P10-stale, P10-trip |
| P11 | `8:864` | `(app)/receipt/[id]` | payment `13:2337`, rating `13:2346`, rated `13:2368`, cancelled `13:2400`, pending `13:2432`, failed `13:2464`, electronic `13:2496`, dynamic `46:2562` | P11-cash-pending, P11-failed, P11-pending, P11-receipt-card, P11-receipt |
| P12 | `8:927` | `(app)/(tabs)/trips · scheduled/[id]` | history `13:2539`, detail `13:2601`, cancel `13:2615`, empty `13:2623` | P12-trips |
| P13 | `8:992` | `(app)/(tabs)/account · places · preferences` | address `13:2655`, settings `13:2684`, notifications `13:2723` | P13-account, P13-places, P13-preferences |
| P14 | `8:1085` | `(app)/payments · card/new` | card `13:2755` | P14-card, P14-payments |
| P15 | `8:1141` | `(app)/help · help/[topic]` | — | P15-help |
| P16 | `8:1202` | `(app)/support · support/new · support/[id]` | attachment `13:2770`, status `13:2811`, reply `13:2843` | P16-new, P16-support |

## Driver (D01–D18)

| Screen | Figma node | Route | States covered (Figma variants) | Captures |
|---|---|---|---|---|
| D01 | `9:2` | `(auth)/welcome` | slide 2 `14:653` | D01-welcome, D01b-wallet |
| D02 | `9:119` | `(auth)/phone` | consent `14:682` | D02-phone |
| D03 | `9:150` | `(auth)/otp` | error `14:690` | D03-otp |
| D04 | `9:180` | `docs/start · identity · vehicle · capture/[item]` | permit `14:722`, car `14:854`, insurance `14:929`, photos `14:1004`, capture `14:1079`, camera `14:1121`, review `14:1179` | D04-car, D04-hub, D04-identity, D04-new, D04-permit |
| D05 | `9:238` | `docs/status` | more `14:1253`, refused `14:1285`, approved `14:1317` | D05-approved, D05-more, D05-vehicle-pending |
| D06 | `9:291` | `(app)/(tabs)/index` | online `14:1358`, debt `14:1437`, gps `14:1469`, docs `14:1501`, restored `14:2410`, opaque `35:7649`, reduced `35:7745`, casa `48:3362` | D06-debt, D06-docs, D06-gps, D06-offline, D06-online, D06-restored |
| D07 | `9:418` | `(app)/offer` | 10 `14:1533`, expired `14:1613`, declined `14:1645`, withdrawn `14:1677`; timer-29…1 (28 frames) → live countdown | D07-offer |
| D08 | `9:501` | `(app)/ride (pickup / arrived)` | arrived `14:1709`, contact `14:1770`, cancel `14:1782`, cancelled `14:1794` | D08-arrived, D08-cancel, D08-contact, D08-pickup |
| D09 | `9:580` | `(app)/ride (in trip / stops)` | stale `14:1826`, stop `14:1858` | D09-stop, D09-trip |
| D10 | `9:651` | `(app)/ride-end/[id]` | cash `14:1916`, electronic `14:1952`, pending `14:1987`, failed `14:2019` | D10-cash-confirmed, D10-cash, D10-electronic, D10-pending |
| D11 | `9:711` | `(app)/(tabs)/earnings` | filter `14:2051`, empty `14:2096` | D11-earnings |
| D12 | `9:784` | `(app)/(tabs)/wallet` | negative `14:2176`, zero `14:2209`, near `14:2240`, after `14:2604`, recharged `47:1957`, after-recharged `64:3660` | D12-after, D12-definition, D12-wallet |
| D13 | `9:849` | `(app)/ledger · ledger/[id]` | detail `14:2128`, cash `14:2138`, filter `14:2147`, withdrawal `14:2596`, withdrawal-recharged `64:3652` | D13-filter, D13-ledger |
| D14 | `9:882` | `(app)/recharge · recharge/sandbox/[id] · recharge/[id]` | debt `14:2271`, provider `14:2305`, pending `14:2316`, failed `14:2348`, success `14:2380`, provider-normal `47:1852`, pending-normal `47:1863`, failed-normal `47:1895`, success-normal `47:1927` | D14-debt, D14-pending, D14-provider, D14-success |
| D15 | `9:923` | `(app)/withdraw · withdraw/[id]` | pending `14:2489`, success `14:2522`, failed `14:2557`, insufficient `14:2666`, recharged `64:3496`, pending-recharged `64:3545`, success-recharged `64:3578`, failed-recharged `64:3613` | D15-insufficient-empty, D15-insufficient, D15-pending, D15-success, D15-withdraw |
| D16 | `9:983` | `(app)/rides · rides/[id]` | empty `14:2698` | D16-detail, D16-history |
| D17 | `9:1030` | `(app)/(tabs)/account · profile/vehicle · profile/preferences` | settings `14:2730` | D17-account, D17-settings, D17-vehicle |
| D18 | `9:1133` | `(app)/support · support/new · support/[id]` | form `14:2742`, status `14:2774`, reply `14:2806` | D18-form, D18-list |

## Admin (A00–A13)

| Screen | Figma node | Route | States covered (Figma variants) | Captures |
|---|---|---|---|---|
| A00 | `—` | `/connexion · permission gate` | session `15:3557`, denied `15:3639` | A00-denied-1440, A00-session-1440 |
| A01 | `10:2` | `/` | — | A01-overview-1024, A01-overview-1440 |
| A02 | `10:210` | `/personnes` | search `15:3539`, filter `15:3548` | A02-people-1024, A02-people-1440 |
| A03 | `10:350` | `/personnes/:id` | — | A03-person-1024, A03-person-1440 |
| A04 | `10:553` | `/verifications` | — | A04-verifications-1024, A04-verifications-1440 |
| A05 | `10:680` | `/verifications/:id` | vehicle `15:1819`, confirm `15:1980`, vehicle-confirm `15:1990`, more `15:1999`, reject `15:2008`, done `15:2017`, vehicle-done `15:2100`, more-done `15:2183`, rejected `15:2265`, document `15:2347` | A05-case-1024, A05-case-1440, A05-confirm-1440, A05-done-1440, A05-more-1440, A05-reject-1440, A05-vehicle-1024, A05-vehicle-1440 |
| A06 | `10:870` | `/courses (+ planifiées)` | — | A06-rides-1024, A06-rides-1440 |
| A07 | `10:1010` | `/courses/:id` | electronic `15:2354` | A07-ride-1024, A07-ride-1440 |
| A08 | `10:1194` | `/support · /support/:id` | confirm `15:2438`, resolved `15:2447` | A08-support-1024, A08-support-1440, A08-ticket-1024, A08-ticket-1440 |
| A09 | `10:1291` | `/finance` | wallet `15:2530`, transaction `15:2619`, failed `15:2704`, correction `15:2789`, correction-confirm `15:2799`, corrected `15:2809` | A09-corrected-1440, A09-correction-confirm-1440, A09-finance-1024, A09-finance-1440 |
| A10 | `10:1447` | `/villes` | add `15:2892`, zone `15:2902`, zone-done `15:2911`, future `15:2994` | A10-add-1440, A10-cities-1024, A10-cities-1440 |
| A11 | `10:1573` | `/villes/:id/regles` | casa `15:1700`, confirm `15:3076`, dynamic `15:3088`, policy `15:3098`, saved `15:3109`, confirm-casa `62:3580`, saved-casa `62:3592`, dynamic-casa `62:3768`, policy-casa `62:3778` | A11-confirm-1440, A11-rules-1024, A11-rules-1440, A11-rules-casa-1024, A11-rules-casa-1440, A11-saved-1440 |
| A12 | `10:1710` | `/paiements` | edit `15:3193`, saved `15:3204`, casa `62:3789`, edit-casa `62:3946`, saved-casa `62:3957` | A12-edit-1440, A12-providers-1024, A12-providers-1440 |
| A13 | `10:1863` | `/audit` | detail `15:3287`, config `15:3371`, correction `15:3455`, config-casa `62:3680` | A13-audit-1024, A13-audit-1440, A13-detail-1440 |

## Scenario paths

| Scenario | Figma path | Automated test |
|---|---|---|
| S01 | P01 → P02 → P03 → P04 → P04-selfie → P04-capture → P04-preview → P04-document → P04-review → P05 | API `scenarios.test.ts` · passenger-flows S01 · admin-verifications S01 |
| S02 | P05-more → P04-document → P04-review → P05 | API · passenger-flows S02 (×2) · admin-verifications S02 |
| S03 | P06 → P07 → P08 → P09 → P10 → P10-arrived → P10-trip → P11 | API · passenger-flows S03 · driver-flows S11 full trip |
| S04 | P08-electronic → P09-electronic → P10-electronic → P10-arrived-electronic → P10-trip-electronic → P11-electronic | API · passenger-flows S04 |
| S05 | P08 → P08-schedule → P12 → P12-detail → P12-cancel → P12-empty | API · passenger-flows S05 |
| S06 | P08-dynamic → P09-dynamic → P10-dynamic → P10-arrived-dynamic → P10-trip-dynamic → P11-dynamic | API · passenger-flows S06 · admin-operations S06 |
| S07 | P06-permission → P07 → P08 | API · passenger-flows S07 |
| S08 | P10 → P10-cancel → P11-cancelled | API · passenger-flows S08 |
| S09 | D08 → D08-cancel → D08-cancelled | API · passenger-flows S09 · driver-flows S09 |
| S10 | D01 → D02 → D03 → D04 → D04-permit → D04-car → D04-insurance → D04-photos → D04-review → D05 | API · driver-flows S10 · admin-verifications S10 |
| S11 | D06 → D06-online → D07 → D07-declined → D06-online | API (expiry, refusal, withdrawal, race) · driver-flows S11 (×4) |
| S12 | D06-debt → D14-debt → D14-provider → D14-pending → D14-success → D06-restored | API · driver-flows S12 |
| S13 | D15 → D15-pending → D15-success → D13-withdrawal → D12-after | API (×4) · driver-flows S13 (×2) |
| S14 | P12-history → P11 → P15 → P16 → P16-status → P16-reply | API · passenger-flows S14 · admin-operations S14 |
| S15 | A10 → A10-add → A11-casa → A11-confirm-casa → A11-saved-casa → A13-config-casa | API · admin-operations S15 |
| S16 | D15 → D15-pending → D15-failed → D15 | API (×2) · passenger-flows S16 · driver-flows S13/S16, S16 |
