# Architecture decision records

One decision per file. Template: [0000-template.md](0000-template.md). An Accepted decision is never edited; it is superseded by a new ADR. Write an ADR when a change touches an invariant in [AGENTS.md](../../AGENTS.md), reverses the handoff, a spec or an earlier ADR, picks a hard-to-swap vendor or library, or changes who can see or do something (see [docs/README.md](../README.md)).

Proposed ADRs are open decisions. Each maps to a question in [status/open-questions.md](../status/open-questions.md); accepting one means changing its status, filling in the decision and date, and updating the specs it touches.

## Accepted (29)

| ADR | Title | Status |
|---|---|---|
| [0001](0001-pnpm-12-workspace-with-hoisted-node-modules.md) | pnpm 12 workspace with hoisted node_modules | Accepted |
| [0002](0002-track-the-stable-expo-sdk-57-line.md) | Track the stable Expo SDK 57 line | Accepted |
| [0003](0003-money-as-integer-centimes-and-basis-points.md) | Money as integer centimes and basis points, rounded half away from zero once where derived | Accepted |
| [0004](0004-driver-wallet-is-a-projection-of-an.md) | Driver wallet is a projection of an append-only ledger | Accepted |
| [0005](0005-server-authoritative-pricing-with-versioned-city-rules.md) | Server-authoritative pricing with versioned city rules and frozen terms | Accepted |
| [0006](0006-admin-changes-are-governed.md) | Admin changes are governed | Accepted |
| [0007](0007-lifecycle-rules-are-declarative-state-machines-in.md) | Lifecycle rules are declarative state machines in @naya/domain | Accepted |
| [0008](0008-offer-deadlines-are-server-authoritative.md) | Offer deadlines are server-authoritative | Accepted |
| [0009](0009-idempotency-key-is-required-on-booking-money.md) | Idempotency-Key is required on booking, money, SOS and family mutations | Accepted |
| [0010](0010-provider-outcomes-are-applied-through-one-code.md) | Provider outcomes are applied through one code path | Accepted |
| [0011](0011-demo-backend-architecture.md) | Demo backend architecture | Accepted |
| [0012](0012-native-demo-builds-run-the-demo-api.md) | Native demo builds run the demo API in-process (standalone) | Accepted |
| [0013](0013-real-time-by-polling-with-local-notifications.md) | Real-time by polling, with local notifications only | Accepted |
| [0014](0014-client-state-ownership.md) | Client state ownership | Accepted |
| [0015](0015-route-group-gating-with-expo-router-stack.md) | Route-group gating with Expo Router Stack.Protected and a loading cover | Accepted |
| [0016](0016-shared-ui-kit-consumed-as-typescript-source.md) | Shared UI kit consumed as TypeScript source | Accepted |
| [0017](0017-the-admin-is-a-separate-vite-spa.md) | The admin is a separate Vite SPA | Accepted |
| [0018](0018-sensitive-data-minimisation.md) | Sensitive-data minimisation | Accepted |
| [0019](0019-verification-is-a-manual-human-review-with.md) | Verification is a manual human review with no face or gender inference | Accepted |
| [0020](0020-french-only-product-mad-africa-casablanca-business.md) | French-only product, MAD, Africa/Casablanca business time, UTC ISO storage | Accepted |
| [0021](0021-demo-authentication.md) | Demo authentication | Accepted |
| [0022](0022-map-adapter-per-platform.md) | Map adapter per platform | Accepted |
| [0024](0024-motion-material-and-text-scaling-policy.md) | Motion, material and text-scaling policy | Accepted |
| [0027](0027-native-platform-constraints-are-handled-by-config.md) | Native platform constraints are handled by config plugins, never by editing ios/ | Accepted |
| [0028](0028-test-strategy.md) | Test strategy | Accepted |
| [0029](0029-demo-store-is-versioned-schemaversion-1-and.md) | Demo store is versioned (schemaVersion 1) and a mismatch reseeds from fixtures, with no migrations | Accepted |
| [0030](0030-location-policy.md) | Location policy | Accepted |
| [0031](0031-number-masking-is-the-only-planned-passenger.md) | Number masking is the only planned passenger–driver contact channel; no in-app chat | Accepted |
| [0032](0032-apps-web-stack.md) | apps/web stack | Accepted |

## Proposed — waiting on a decision (28)

| ADR | Title | Status |
|---|---|---|
| [0023](0023-mobile-styling-and-runtime-dark-mode.md) | Mobile styling and runtime dark mode | Proposed — confirm intent |
| [0025](0025-mobile-illustrations-are-vector-svg-and-avatars.md) | Mobile illustrations are vector SVG and avatars are initials | Proposed — confirm intent |
| [0026](0026-service-categories-including-a-premium-naya-confort.md) | Service categories, including a premium Naya Confort tier | Proposed — confirm intent |
| [0033](0033-pricing-precedence-between-city-rules-and-service.md) | Pricing precedence between city rules and service categories | Proposed |
| [0034](0034-women-only-eligibility-and-verification-policy.md) | Women-only eligibility and verification policy | Proposed |
| [0035](0035-sos-production-model.md) | SOS production model | Proposed |
| [0036](0036-naya-famille-operating-model.md) | Naya Famille operating model | Proposed |
| [0037](0037-admin-permission-model-for-the-new-features.md) | Admin permission model for the new features | Proposed |
| [0038](0038-canonical-backoffice.md) | Canonical backoffice | Proposed |
| [0039](0039-future-of-the-prototype-module.md) | Future of the \"prototype\" module | Proposed |
| [0040](0040-passenger-wallet-model.md) | Passenger wallet model | Proposed |
| [0041](0041-cash-and-fee-settlement.md) | Cash and fee settlement | Proposed |
| [0042](0042-ride-exception-paths.md) | Ride exception paths | Proposed |
| [0043](0043-category-vehicle-eligibility-and-scooter-scope.md) | Category–vehicle eligibility and Scooter scope | Proposed |
| [0044](0044-demo-gating-flag-defaults-and-the-production.md) | Demo gating, flag defaults and the production bundle | Proposed |
| [0045](0045-production-backend-and-live-integrations.md) | Production backend and live integrations | Proposed |
| [0046](0046-production-map-tile-provider.md) | Production map tile provider | Proposed |
| [0047](0047-nativewind-remove-it-or-adopt-it-for.md) | NativeWind: remove it, or adopt it for new mobile code | Proposed |
| [0048](0048-cross-surface-media-and-brand.md) | Cross-surface media and brand | Proposed |
| [0049](0049-build-number-source-of-truth.md) | Build-number source of truth | Proposed |
| [0050](0050-repo-path-with-spaces.md) | Repo path with spaces | Proposed |
| [0051](0051-apps-web-package-manager.md) | apps/web package manager | Proposed |
| [0052](0052-screenshot-storage.md) | Screenshot storage | Proposed |
| [0053](0053-idempotency-key-lifecycle.md) | Idempotency-key lifecycle | Proposed |
| [0054](0054-source-of-truth-for-the-passenger-s.md) | Source of truth for the passenger's city | Proposed |
| [0055](0055-account-lifecycle.md) | Account lifecycle | Proposed |
| [0056](0056-source-of-truth-order-committing-the-handoff.md) | Source-of-truth order, committing the handoff, and docs language | Proposed |
| [0057](0057-branch-review-and-ci-policy.md) | Branch, review and CI policy | Proposed |

_Index generated from each ADR's front-matter. Regenerate it when you add or change an ADR._
