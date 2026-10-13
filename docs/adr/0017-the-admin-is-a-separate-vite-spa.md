---
id: ADR-0017
title: "The admin is a separate Vite SPA"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0006, ADR-0014, ADR-0037, ADR-0038, ADR-0044, ADM-12, ADM-15, API-10]
---

# ADR-0017 · The admin is a separate Vite SPA

## Context

The handoff asks for `apps/admin` as a responsive React web app with a desktop-appropriate interface and separate authentication, and forbids an admin role switch in the public mobile apps (handoff prompt:46). It lists the admin screens A01–A13 (prompt:158) and says the backend owns permissions and authorises every operation (prompt:109).

## Decision

Build the admin as its own Vite + React Router 7 single-page app. Administrators sign in with email and password against `/admin/auth/login` (passwords stored as scrypt hashes); the bearer token lives in `sessionStorage`, so it lasts for one browser tab. Rights are a set of permission strings on the admin account, eight at `c38429d`: `verification.decide`, `finance.read`, `finance.correct`, `config.edit`, `support.resolve`, `rides.read`, `audit.read`, `people.read`. The server authenticates every admin request and checks the required permission on every protected action; the client gates are cosmetic. Show locked navigation items and an "Accès refusé" page rather than hiding what a role cannot open. The mobile apps contain no admin code and no role switch.

## Consequences

- Closing the tab drops the admin token; mobile sessions and admin sessions never mix.
- A support agent sees which areas exist but cannot open or act on finance, audit or identity decisions.
- New features must add permissions deliberately: the Oct 6 SOS, catalog and family actions all reuse `config.edit` ([ADR-0037](0037-admin-permission-model-for-the-new-features.md)). Branch `chore/docs-foundation-and-fixes` moves SOS to its own `safety.respond` permission and `/sos` page, with `config.edit` still accepted for older admin records ([architecture/permissions.md](../architecture/permissions.md)). Some reads leak beyond their permission (balances without `finance.read`, backlog [ADM-12, API-10](../status/backlog.md)).
- The login page lists demo credentials in every build (backlog ADM-15; [ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)).
- A second, unauthenticated backoffice exists in `apps/web` ([ADR-0038](0038-canonical-backoffice.md)).

## Alternatives considered

Not recorded at the time. An admin mode inside the mobile apps was excluded by the handoff (prompt:46).

## Evidence

Line numbers at commit `c38429d`.

- Commit: `f0f8d46` (2026-09-30) "Passenger app P01–P16 and admin dashboard A00–A13".
- `apps/admin/src/lib/api.ts:5-29` (API URL, per-tab session), `:57-63` (documents fetched with the token).
- `packages/domain/src/entities.ts:53-69` (`AdminPermission`, `AdminUser`).
- `services/demo-api/src/services/permissions.ts:3-7` (`requirePermission`); `services/demo-api/src/app.ts:635-639` (admin login); `services/demo-api/src/services/auth.ts:17-18` (scrypt).
- `apps/admin/src/lib/auth.tsx:48` (`can`); `apps/admin/src/components/Layout.tsx:33`, `:44` (locked items), `:152-165` (access denied page).
- `apps/admin/package.json:24` (React Router 7).
- Enforced by: `e2e/tests/admin-auth.spec.ts:6` (login and logout), `:20` "support agent cannot open finance or audit and cannot decide cases", `:32` (expired session); `services/demo-api/test/scenarios.test.ts:591` "authorizes every operation by role", `:108` "support agents cannot decide identity cases".

## Revisit when

- [ADR-0037](0037-admin-permission-model-for-the-new-features.md) or [ADR-0038](0038-canonical-backoffice.md) is decided, or
- a second city opens and admins need city scoping, or
- the admin is deployed anywhere reachable: add a second factor and rate limiting on admin login (sessions already expire server-side, `services/demo-api/src/services/auth.ts:21-24`).
