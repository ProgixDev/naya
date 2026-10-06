# Mobile app feedback audit

Reviewed on 6 October 2026 against the supplied ten-page VTC feedback PDF.

This is the initial assessment, retained as a before-change record. The authorized demo implementation and fresh verification are documented in [MOBILE-FEEDBACK-DEMO.md](MOBILE-FEEDBACK-DEMO.md).

Scope: the passenger app, the driver app, their shared UI/domain/API contracts, and the demo backend and administration screens needed to support the requested features. This is an assessment; no product functionality was changed. The separate website prototype in `apps/web` is outside this review.

## Outcome

Both apps already contain substantial ride and verification flows, but the feedback describes several new services that are absent from the mobile apps and their backend contracts. The existing wallet belongs to drivers. Passenger payments currently support cash and cards only. External payments, routing, calls, messages, and remote push require production integrations.

“Present” below means found in source; it does not certify production operation or native-device behavior. Saved native screenshots were inspected as historical visual evidence, not as a fresh run.

## Comparison with all ten feedback items

| PDF item | Passenger app | Driver app | Backend/admin assessment |
| --- | --- | --- | --- |
| 1. Vehicle/service categories | Missing. The quote displays one fixed “Naya Signature” offer. No scooter, standard, or premium selector; no per-category arrival estimate. | Missing category association and category-based offer eligibility. Vehicles have make/model/color/plate/year, but no service category. | Pricing is configurable per city, not per category. Quotes and frozen booking terms have no category identifier. No category management. |
| 2. Dedicated-driver family subscription | Missing subscription purchase, family space, child profiles, authorized recipients, and recurring family trips. Ordinary one-time scheduling exists. | Missing dedicated assignments, child manifests, arrival photos, child pickup verification, and authorized handover confirmation. Ordinary arrival/start/stop/complete actions exist. | No subscription plans, customer-driver associations, recurrence model, child/handover entities, or family administration. |
| 3. Five to six new logo concepts | Existing passenger icon and shared Naya branding. | Existing driver icon and the same brand family. | Supplied “Rencontre” symbol, wordmark, lockups, and variants are adaptations of one existing identity. No set of five to six new concepts was found in the reviewed mobile assets. |
| 4. Authentic media | Does not meet the requested direction: onboarding illustrations and demo portrait assets remain. | Same issue with onboarding illustrations and demo character imagery. | Asset provenance explicitly describes image-generated characters and illustrations. The new direction needs replacement artwork/photos and provenance review. |
| 5. SOS during rides | Partial emergency access only: a direct emergency phone link is inside the driver-contact sheet. No dedicated SOS control, confirmation, trusted-contact alert, location sharing, or platform incident creation. | No SOS workflow. In-trip support opens an ordinary ticket; the contact sheet provides emergency guidance. | No SOS entity, alert endpoint, alert queue, responder status, or incident action history. |
| 6. Detailed disputes | Partial. Category, subject, description, up to three photos, ride linkage, replies, and status already exist. | Same shared form and conversation flow. | Existing support queue, ride/payment context, and motivated resolution. Missing granular configurable reasons, document selection in the support form, required evidence rules, explicit rejected status, and complete administrative action auditing. Attachments are displayed as counts/IDs rather than viewable evidence in the ticket screen. |
| 7. Dark mode | Missing light/dark/system control and alternate palette. App configuration forces light appearance. | Same. | Shared colors provide one fixed light palette. Accessibility preferences for text size, motion, and transparency do not provide dark mode. |
| 8. Moroccan wallets/payments | Missing passenger wallet/top-up/balance-spending flows and Moroccan mobile-wallet methods. Cash and demo card methods exist. | Partial driver wallet: ledger, commissions/debt, recharge, withdrawals, and earnings exist. Card and agency recharge flows are simulated. | Provider configuration, signed callback handling, event deduplication, and transaction accounting are useful foundations. No live Cash Plus/Wafacash/mobile-wallet connector was found. Payment kinds and several UI branches remain fixed. |
| 9. Back-office coverage | Existing mobile features consume city/provider configuration. New requested modules have no app contracts yet. | Same. | Existing cities/zones/rules, identity/vehicle review, support, finance, and provider enable/disable. Missing category management, subscription plans, dedicated drivers, family safety records, and SOS operations. |
| 10. Configurable architecture | Partial: city-based fares, cancellation fees, and available payment methods come from the API. Category, dispute-reason, subscription, and wallet-method catalogs do not exist. | Partial: city rules drive eligibility, commission/debt, and provider lists. Dedicated/family services remain absent. | Adding cities/zones and updating versioned pricing rules are already supported. Existing providers can be toggled; a new provider cannot be created/configured through the reviewed admin UI. Dispute categories, cancellation reasons, payment kinds, and the single service label remain fixed in code. |

## Existing functionality to preserve

- Passenger identity submission and manual review; driver identity/licence and vehicle documentation. Backend checks enforce approval before booking/driving.
- Immediate and one-time scheduled rides, intermediate stops, arrival/start/completion transitions, fare disclosure, frozen commercial terms, and cancellation handling.
- Map tracking with demo movement and a real-GPS code path, plus stale-position indicators. Polling provides app updates; closed-app remote push is not implemented.
- Driver wallet accounting, commissions, debt limits, pending/confirmed/failed operations, recharge and withdrawal history.
- Support descriptions and photo uploads in both apps. The PDF's suggestion that disputes only collect a category is incomplete for this checkout.
- City creation, service zones, versioned fare/cancellation policies, and an audit foundation in the administration dashboard.

## Material findings

1. **The family service needs a complete workflow across both apps.** Reusing ordinary scheduled rides alone cannot provide child identity verification, recipient authorization, recurrence, pickup/handover proof, or dedicated-driver assignment. Current tracking exposes the latest driver position rather than a retained per-trip GPS history for this service.
2. **The passenger wallet is a new module.** The existing driver wallet handles earnings and commission debt; it is not a passenger stored balance that can pay for rides.
3. **Safety wording exceeds the implemented workflow.** The passenger ride screen says the trip is shared with the Naya safety team, but the reviewed backend has no corresponding SOS/incident-response workflow. Existing admin ride visibility does not establish staffed monitoring. The driver contact sheet also claims masked numbers while providing no working contact action; telephony is explicitly unconfigured in the integration documentation.
4. **Dispute evidence is collected but cannot be properly reviewed from the ticket UI.** The admin ticket shows attachment identifiers/counts, and mobile threads show attachment counts. The existing document viewer used for verification is not wired into this support flow. Only final resolution appends a support audit event; agent replies and their status changes do not.
5. **Default native demos operate separately.** Each app embeds and persists its own demo backend, and simulates the other party. Passenger, driver, and admin synchronization must be assessed in connected mode; the default standalone builds cannot demonstrate a real shared ride across the apps.
6. **Configurability has limits.** Existing city/rule configuration is useful, but adding a payment integration still requires a server adapter and extending fixed payment contracts/UI where needed. The reviewed payment implementation simulates outcomes; adding provider names in the admin alone will not create a live integration.
7. **Adding a city in the admin does not complete expansion.** Demo place search treats Casablanca specially and otherwise returns the Rabat catalog. The passenger fare-detail heading likewise labels any non-Rabat city as Casablanca. City configuration exists, but address search/routing and these fixed city labels need work for Marrakech, Tanger, Agadir, and later launches.

## Implementation order inferred from the feedback

1. Add SOS and its backend/admin response workflow; align safety/contact wording with available services.
2. Build family/dedicated-driver data and assignment workflows, recurring trips, child verification, handovers, notifications, and retained journey evidence.
3. Introduce configurable service categories and per-category/city pricing; carry the chosen category through quotes, rides, driver eligibility, and receipts.
4. Extend support reasons, evidence selection/viewing, required-evidence rules, resolution states, and action audit history.
5. Add the passenger wallet and live payment-provider adapters, using the existing accounting foundations where appropriate.
6. Add shared theming to both apps and their maps, then replace generated imagery and develop the requested logo concepts.

Admin configuration and API contracts are dependencies throughout this order. They should be implemented alongside their mobile flows.

## Evidence index

Source locations below are relative to the repository root; line numbers are from the reviewed checkout.

- `apps/passenger/src/app/(app)/quote.tsx:55` — quote API arguments; `:154` — fixed Naya Signature offer; `:186` — cash/card UI.
- `packages/domain/src/entities.ts:108` — vehicle details; `:173` — city-level rules; `:215` — provider kinds; `:290` — cash/card payment union; `:360` — ride fields; `:414` — one-time scheduled booking; `:548` — support states and categories.
- `services/demo-api/src/services/rides.ts:69` — city pricing for quotes; `:204` — driver verification eligibility; `:528` — ride transitions; `:655` — current tracking read model.
- `apps/passenger/src/app/(app)/ride.tsx:44` — local arrival notification; `:155` — contact access; `:175` — safety-team copy.
- `apps/passenger/src/features/ride/ContactSheet.tsx:15` — unavailable masked calling/messaging; `:19` — emergency dial link.
- `apps/driver/src/app/(app)/ride.tsx:214` — ordinary ride transitions; `:218` — support; `:221` — contact sheet with guidance but no call/message action.
- `packages/ui/src/features/support.tsx:51` — fixed categories; `:61` — shared passenger/driver ticket form; `:93` — library-only attachment picker; `:116` — subject/description; `:130` — three-photo limit; `:196` — attachment counts in conversations.
- `packages/ui/src/features/uploads.ts:21` — existing camera/library/document picker helper, available for reuse.
- `services/demo-api/src/services/support.ts:31` — dispute classification; `:58` — agent reply/status change; `:72` — resolution and audit.
- `apps/admin/src/pages/Ticket.tsx:42` — evidence IDs/counts; `:68` — ride/payment context; `:113` — resolution outcomes.
- `apps/passenger/app.config.ts:12`, `apps/driver/app.config.ts:12`, `packages/tokens/src/index.ts:6` — light appearance and fixed palette.
- `apps/passenger/src/app/(app)/payments.tsx:25` — card/cash payment management; `apps/passenger/src/app/(app)/(tabs)/account.tsx:32` — account services with no passenger wallet.
- `apps/driver/src/app/(app)/recharge/index.tsx:20` — provider-backed driver recharge selection; `services/demo-api/src/services/finance.ts:29` — driver wallet; `:184` — simulated recharge creation; `services/demo-api/src/seed.ts:104` — demo providers and unconfigured live placeholder.
- `apps/admin/src/pages/Providers.tsx:28` — no real configured providers; `:51` — enable/disable actions; `services/demo-api/src/services/cities.ts:42` — city creation; `:78` — rule versions; `:145` — provider toggle.
- `services/demo-api/src/app.ts:325` — demo search restricted to Rabat/Casablanca catalogs; `apps/passenger/src/app/(app)/quote.tsx:203` — fixed fare-detail city label.
- `packages/assets/README.md:3` — supplied brand provenance; `:6` — generated characters/illustrations; `packages/assets/src/images.ts:10` — car color variants do not imply fare tiers.
- `packages/ui/src/core/apiBase.ts:5`, `packages/ui/src/core/localDemo.native.ts:8`, `services/demo-api/src/embedded.ts:15` — standalone backend per app.
- `docs/INTEGRATIONS.md` — documented simulation boundaries and remaining external integrations.

## Verification

Source comparison and historical native-screen inspection completed. Mobile typecheck and lint commands triggered automatic restoration of missing dependencies in this recovered workspace. Restoration did not complete during the review and was stopped; lint did not reach execution.

| Fresh check | Result |
| --- | --- |
| Passenger direct TypeScript check | Exit 2. Missing Expo Router, Expo, React Native, NativeWind and other mobile dependencies prevent a usable compilation check; additional JSX/export errors cascade from missing configuration and types. |
| Driver direct TypeScript check | Exit 2 for the same missing mobile dependencies/configuration. |
| Mobile lint | Not executed successfully; Expo CLI dependencies were unavailable. |
| Product source changes | None. Only this audit report was added; tracked package manifests and lockfile were unchanged. |

Fresh native-device and connected-app end-to-end runs were not performed. Previous test results in the README are historical and are not used as fresh verification for this review. The failed environment checks do not establish which source errors would remain after a complete dependency installation.
