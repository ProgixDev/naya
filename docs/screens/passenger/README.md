# Passenger app — coverage (P01–P16)

Captured from the Expo web build at 390 pt (375 pt subset in `375/`) against the demo API.
Regenerate: `node e2e/scripts/pax-shots.mjs [390|375|430]` and `node e2e/scripts/pax-live-shots.mjs`.

| Figma | Route | Capture |
|---|---|---|
| P01, P01b, P01c | `(auth)/welcome` | P01-onboarding |
| P02, P02-keyboard, P02-error | `(auth)/phone` | P02-phone |
| P03, P03-error/expired/resent | `(auth)/otp` | (E2E S01) |
| P04, P04-selfie/capture/preview/document/unreadable/permission | `(verify)/identity`, `(verify)/capture/[item]` | P04-identity |
| P04-review | `(verify)/review` | (E2E S01/S02) |
| P05, P05-approved/more/rejected | `(verify)/verification-status` | P05-pending, P05-more, P05-rejected |
| P06, P06-permission/zone/city/casa/network/reduced/opaque | `(app)/(tabs)/index` | P06-home, P06-city, P06-permission |
| P07, P07-add/reordered/no-stop/map | `(app)/route` | P07-route, P07-map, P07-out-of-zone |
| P08, P08-price/payment/electronic/dynamic/casa/schedule | `(app)/quote` | P08-quote, P08-dynamic, P08-price, P08-schedule |
| P09, P09-long/none/cancel/cancelled | `(app)/ride` | P09-searching, P09-long, P09-none |
| P10, P10-contact/cancel/arrived/trip/driver-cancel/stale | `(app)/ride` | P10-approaching, P10-contact, P10-arrived, P10-cancel, P10-trip, P10-stale, P10-driver-cancel |
| P11, P11-payment/rating/rated/cancelled/pending/failed/electronic | `(app)/receipt/[id]` | P11-receipt, P11-receipt-card, P11-cash-pending, P11-pending, P11-failed |
| P12, P12-history/detail/cancel/empty | `(app)/(tabs)/trips`, `(app)/scheduled/[id]` | P12-trips |
| P13, P13-address/settings/notifications | `(app)/(tabs)/account`, `(app)/places`, `(app)/preferences` | P13-* |
| P14, P14-card | `(app)/payments`, `(app)/card/new` | P14-payments, P14-card |
| P15 | `(app)/help`, `(app)/help/[topic]` | P15-help |
| P16, P16-attachment/status/reply | `(app)/support`, `support/new`, `support/[id]` | P16-support, P16-new |

Notifications: permission is asked in context (Préférences); a local notification is scheduled when the
driver arrives while the app is backgrounded but still running. Delivery to a suspended or closed app
requires server push (Expo push / APNs / FCM credentials), not configured in the demo.
