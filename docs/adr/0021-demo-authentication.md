---
id: ADR-0021
title: "Demo authentication"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0012, ADR-0017, ADR-0044, ADR-0045, API-06, QA-09]
---

# ADR-0021 · Demo authentication

## Context

The handoff asks for phone sign-in with OTP, resend and errors (handoff prompt:121-122), Apple and Google sign-in only with authentic provider buttons (prompt:89-91), and says to display only the authentication options the configured environment supports and never to present a simulated OAuth as live (prompt:94, :113). No SMS provider and no Apple or Google server verification are configured.

## Decision

Phone number plus a six-digit OTP is the only working sign-in. In dev mode (`NAYA_DEV` is anything but `'0'`, and always in the embedded standalone demo) the code is the fixed `123456`, returned to the client as `demoCode` and shown with a "Démo" label; with `NAYA_DEV=0` codes are random and only logged on the server. Either way the server stores a hash of the code, expires it after 5 minutes, allows a resend after 30 s and locks after 5 wrong attempts. In the passenger app (the driver app has no social sign-in), Sign in with Apple stays hidden unless the server reports it configured (`NAYA_APPLE_AUTH_CONFIGURED=1`) and the device supports it, and then uses the native `AppleAuthenticationButton`. The server also reports `NAYA_GOOGLE_AUTH_CONFIGURED`, but no Google button exists yet.

## Consequences

- Testers and demos can sign in with any number, with no SMS cost or delivery delay.
- Dev mode is on by default: an API started without `NAYA_DEV=0` accepts the fixed code and exposes `/dev` routes (backlog [API-06](../status/backlog.md)). The root `.env` that the README suggests is not read by the API, so setting `NAYA_DEV=0` there has no effect (backlog QA-09). [ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md) decides the defaults.
- `NAYA_DEV=0` refuses to start with the default provider secret, which prevents one class of accidental production run.
- Even when shown, the Apple button does not complete a sign-in: the identity token is never sent to the server (`apps/passenger/src/app/(auth)/phone.tsx:28-31`).

## Alternatives considered

Not recorded at the time. A live SMS provider is listed as the requirement for production in `docs/INTEGRATIONS.md:7` (at `c38429d`; now [docs/status/integrations.md](../status/integrations.md)).

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added OTP auth and the provider flags; `f0f8d46` (2026-09-30) added the passenger sign-in screen.
- `services/demo-api/src/main.ts:13` (dev mode unless `'0'`), `:17-20` (secret check), `:29` (fixed OTP in dev mode); `services/demo-api/src/embedded.ts:19` (standalone always fixed).
- `services/demo-api/src/services/auth.ts:8-13` (TTL, resend, attempts, demo code), `:35-53` (issue), `:57-70` (hashed, constant-time check, lockout).
- `services/demo-api/src/app.ts:242-249` (`/auth/providers`).
- `apps/passenger/src/app/(auth)/phone.tsx:7-17` (Apple only when configured and available).
- `docs/INTEGRATIONS.md:7-9`.
- Enforced by: `services/demo-api/test/scenarios.test.ts:604` "OTP: wrong code, rate limit and expiry"; `packages/ui/src/__tests__/components.test.tsx:48` (OTP paste).

## Revisit when

- An SMS provider is chosen ([ADR-0045](0045-production-backend-and-live-integrations.md)), or
- any API instance becomes reachable from the internet: dev mode must be off there, or
- Apple or Google sign-in is wanted: add server-side token verification first (audit section 9, "Sign-in": phone OTP only for v1 by default).
