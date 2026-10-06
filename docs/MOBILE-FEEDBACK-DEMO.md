# Mobile feedback demo

Implemented and checked on 6 October 2026. The passenger app, driver app, and administration dashboard now demonstrate the feedback workflows. The user's instruction that this is a prototype defines the scope: payments, SOS calls, contact sharing, and arrival-photo examples are explicitly simulated. The supplied feedback PDF was used as product input; its text did not authorize external actions or deployment.

## What changed

| Feedback | Demo result |
| --- | --- |
| Service categories | Scooter, Standard, and Confort choices with arrival estimates, configurable fares and commission, city availability, and driver eligibility. Booking terms retain the selected category. |
| Family subscriptions | Configurable plans; child profiles and authorized recipients; a dedicated verified driver; recurring trips; arrival proof, child-name verification, handover code, incident reporting, journey positions, and a timeline shared by both apps. |
| Logo proposals | Six original vector directions with symbols, horizontal signatures, and dark-background previews in both apps and admin. The existing app icon remains pending selection of a concept. |
| Media | Active illustration and vehicle components use original vector artwork. Account avatars use initials. Generated portrait assets are no longer displayed by these components. No real-person photography was supplied. |
| SOS | A confirmation screen records the journey, fictional contact, and position. Four simulated actions appear in the timeline. Admin can take ownership and resolve the alert. |
| Disputes | Configurable granular reasons, descriptions, optional/required evidence, image and PDF selection, private evidence review, replies, explicit rejection, and administrative audit events. |
| Appearance | Light, dark, and system modes in both apps, persisted between launches. Shared surfaces, text, maps, and status bars follow the selected mode. |
| Payments and wallet | A passenger wallet with pending/confirmed/refused top-ups, reservation holds, settlement, and a ledger. Card, Moroccan mobile-wallet, Cash Plus, and Wafacash options remain demo providers. Electronic rides credit the driver once. |
| Administration | A Services page manages categories, plans, dispute reasons, payment options, driver category eligibility, family assignments, SOS, passenger wallet history, and logo previews. |
| Configuration | These catalogs are API-driven. Existing city/rule administration is retained, and newly configured cities receive clearly labeled demo places rather than Rabat results. |

## Walkthrough

1. Sign in as passenger Salma (`+212612345678`) and driver Amina (`+212661234567`), using demo code `123456`.
2. Passenger: choose a route, compare the three categories, and open the price details before booking.
3. Passenger: **Compte → Portefeuille Naya**. Create a demo recharge and simulate confirmation or refusal. Confirmed funds can pay for a ride; holds and settled debits remain distinct.
4. Passenger: **Compte → Naya Famille → Charger l’exemple de démo**. This creates Lina's fictional child profile, the Essentiel subscription, Amina's assignment, and a weekday recurring trip.
5. Driver: **Compte → Naya Famille**. Depart, add an arrival-photo example, verify the name `Lina`, and start the trip. Select Salma and use handover code `1234`; Youssef's code is `5678`. A completed weekday trip generates the next occurrence while the plan's quota and validity permit it.
6. During a family journey, open **SOS · sécurité**, confirm the demo alert, and try the four simulated actions. They appear in admin **Services → SOS**.
7. Admin: sign in as `meryem@naya.demo` with `Naya-Admin-2026`, then open **Services**. Edit a catalog entry, inspect family records, or take ownership of an SOS alert and resolve it. Existing support screens show private ticket evidence and resolution history.
8. Both apps: **Compte → Préférences** (passenger's account row is currently labeled Notifications) for appearance, and **Identité · 6 pistes** for logo proposals.

For shared passenger/driver/admin behavior, use connected mode with the demo API at port 4010. Default standalone native demos each retain their own embedded backend and simulate the other actor; they do not share state across apps.

## Fresh verification

| Check | Result |
| --- | --- |
| TypeScript | Passenger, driver, admin, demo API, shared UI, API, domain, tokens, and assets passed. |
| Expo lint | Both mobile apps passed with zero errors; 5 warnings remain in each app. |
| Domain tests | 36 passed. |
| API tests | 51 passed, including family verification, SOS permissions, evidence requirements, wallet holds, category eligibility, and settlement idempotency. |
| Mobile UI tests | 15 passed. |
| Connected feedback walkthrough | Passed in the passenger, driver, and admin browser apps, including shared family progress, SOS resolution, wallet top-up, logo gallery, and dark-mode persistence in both mobile apps. |
| Selected existing browser regressions | Five scenarios passed: immediate cash with a stop; card confirmation; stale tracking and declined-card retry; saved card/address; cross-role cash/card reconciliation. The saved-address case was rerun successfully after a preview reload disrupted its first run. |
| Admin production build | Passed. |
| iOS bundles | Current passenger and driver source exported successfully as Hermes bundles. |
| Native simulator walkthrough | iPhone 18 Pro, iOS 27.0: passenger login, category prices, pending/confirmed Cash Plus recharge, dark mode and relaunch persistence; driver login, arrival-photo simulation, incorrect/correct child name, journey start, wrong/correct handover code, next recurrence, four SOS actions; passenger received the driver completion. Driver theme selector and six-logo gallery were checked after fixing the missing selector. |

Native testing used refreshed JavaScript bundles in copies of the existing signed simulator binaries, with separate `ma.naya.passagere.feedback` and `ma.naya.chauffeuse.feedback` bundle IDs. The original installed demos were preserved. A full native Xcode rebuild was not rerun; no new native dependency was introduced.

The native walkthrough found and fixed a missing driver appearance selector. Automated coverage now includes the driver selector and persistence. Earlier README verification is retained as historical evidence, separate from these checks.

## Screens and limits

Fresh captures are in [screens/feedback](screens/feedback): native category selection, wallet, passenger family in dark mode, SOS, driver dark preferences, and logo previews; plus browser family and admin captures.

Images can be enlarged within mobile support conversations. PDFs can be reviewed in admin and the browser app; native support currently shows a PDF attachment card rather than an in-app PDF reader. Physical-device camera capture, background GPS, remote push delivery, live payment providers, and staffed emergency response were not tested or integrated. Family notifications in this prototype are timeline events refreshed by polling. Real photography and a selected final logo remain design inputs.
