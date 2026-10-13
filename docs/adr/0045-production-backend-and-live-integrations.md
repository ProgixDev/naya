---
id: ADR-0045
title: "Production backend and live integrations"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0018, ADR-0019, ADR-0031, ADR-0034, ADR-0036, ADR-0039, ADR-0040, ADR-0044, ADR-0046, P18, PRD-08, PRD-10, PRD-31, docs/status/integrations.md]
---

# ADR-0045 · Production backend and live integrations

## Context

Decision **D10** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d10-production-path)). It unblocks the second half of P18 ([backlog](../status/backlog.md)). The gaps and constraints at `c38429d`:

- **API URL.** The production EAS profile points at the placeholder `https://api.naya.example`.
- **Storage.** All data lives in one JSON file behind a single-writer store. Timers run on a 500 ms in-process tick. Uploads go to a local folder.
- **Integrations.** There is no payment provider (a sandbox only), no telephony, no remote push (no app code requests a push token), no SMS provider and no crash reporting.
- **Android.** It has never been built.
- **Contract.** Shared zod schemas and the typed client in `packages/api` are the API contract, with no OpenAPI ([ADR-0011](0011-demo-backend-architecture.md)).
- **Founder brief 13 Oct** ([task 4](../tasks/2026-10-13.md)). Famille needs driver GPS every second and in-app voice and video calls. Polling every 1.5–3 s cannot deliver the first, and nothing supports the second.
- **Legal.** Lead times (CNDP law 09-08, transport licensing, payments) are longer than the engineering (audit section 8.2).

## Decision

**Recommended, pending Achraf’s choice.** This ADR fixes the shape. Each vendor choice gets its own ADR.

1. **API.** Keep Hono and the `packages/api` contract. Port `packages/domain` unchanged. Promote the prototype module first ([ADR-0039](0039-future-of-the-prototype-module.md)).
2. **Database.** Replace the JSON store with managed Postgres:
   - real transactions and row locks for offer acceptance;
   - idempotency rows written in the same transaction, unique on (subject, key);
   - migrations;
   - a job queue for offer timeouts, scheduled dispatch and hold expiry.
3. **Hosting.** Choose the region with counsel before choosing a vendor, because it decides cross-border transfer under CNDP.
4. **Vendors.** Each gets its own ADR.

   | Need | Shape |
   |---|---|
   | Payments | A Moroccan PSP or acquirer with hosted fields, signed webhooks, refunds and 3-D Secure, applied through one code path ([ADR-0010](0010-provider-outcomes-are-applied-through-one-code.md)) |
   | Identity documents | Encrypted object storage, pre-signed uploads, size limits and retention jobs. Review stays manual ([ADR-0019](0019-verification-is-a-manual-human-review-with.md), [ADR-0034](0034-women-only-eligibility-and-verification-policy.md)) |
   | SMS | An aggregator covering Maroc Telecom, Orange and inwi, with rate limits |
   | Telephony | Number masking ([ADR-0031](0031-number-masking-is-the-only-planned-passenger.md)), plus in-app VoIP if [ADR-0036](0036-naya-famille-operating-model.md) is accepted |
   | Push and live updates | Remote push (APNs, FCM, a server sender), and a WebSocket or SSE channel for live tracking |
   | Operations | Crash reporting, logs, metrics, alerting and backups |

5. **Platforms.** Put Android in the launch scope. Build, test on real devices and ship it.
6. **Demo builds.** They keep the embedded JSON store as an adapter behind the same repository interface ([ADR-0012](0012-native-demo-builds-run-the-demo-api.md)), with no demo routes in production ([ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)).

## Consequences

- This is the largest engineering item (XL). Contracts with partners add lead time.
- The storage layer gains a repository interface, so the demo and production share the service code.
- Each vendor ADR must cover data location, cost and exit.
- Real-time and push replace polling on live screens ([ADR-0013](0013-real-time-by-polling-with-local-notifications.md)).
- Engage Moroccan counsel this month on CNDP, transport licensing, the women-only basis, minors and the wallet.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| A backend-as-a-service (managed auth, storage, realtime) | Faster auth, storage and realtime | The Hono rules must be rewritten as row policies and functions; the shared contract is lost |
| Rewrite in another server framework | A familiar stack for new hires | A rewrite with no product benefit; the Hono app and its tests already exist |
| Keep the JSON store | No migration | One writer, no row locks, no backups: not safe for money |

## Evidence

Line numbers at commit `c38429d`.

- `apps/passenger/eas.json:36` and `apps/driver/eas.json:36` (`https://api.naya.example`).
- `services/demo-api/src/store.ts:5-12` (single-writer store), `:61-67` (whole-file persist); `services/demo-api/src/main.ts:37-43` (500 ms tick); `services/demo-api/src/services/uploads.ts:21-27` (local upload folder).
- `docs/INTEGRATIONS.md` at `c38429d`, now [status/integrations.md](../status/integrations.md): `:7` (SMS), `:11` (card sandbox), `:18` (no remote push), `:19` (polling), `:20` (no masked calls), `:21` (JSON persistence).
- `README.md:175` (Android not run).
- `git grep getExpoPushTokenAsync` and `git grep getDevicePushTokenAsync` return nothing.
- Enforced by: nothing; this ADR is the plan.

## Revisit when

- Vendor quotes and counsel's opinion arrive, or
- load tests at Rabat volumes show the shape does not hold.
