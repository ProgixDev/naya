# Permissions

Who may see and do what: the admin permission matrix, the admin console's route gates, the mobile route guards and
the known gaps. Owner: not assigned yet (see [docs/README.md](../README.md)).
Last verified: 2026-10-13 against branch `chore/docs-foundation-and-fixes` (based on c38429d), which adds the SOS
permission.

Every endpoint with its caller and permission, generated from the code: [api-reference.md](api-reference.md)
(section "By admin permission"). Decisions: [ADR-0017](../adr/0017-the-admin-is-a-separate-vite-spa.md) (admin model,
Accepted), [ADR-0015](../adr/0015-route-group-gating-with-expo-router-stack.md) (mobile route groups, Accepted),
[ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) (permissions for the Oct 6 features, Proposed).

## How authorization works

- **Two kinds of principal.** A *user* (passenger or driver) signs in by phone and OTP; the session lasts 30 days and
  the role is fixed by the account. An *admin* signs in with e-mail and password; the session lasts 12 hours
  (`services/demo-api/src/services/auth.ts:11-12`). Tokens are bearer tokens, stored hashed on the server.
- **The server decides.** Handlers call `userOf(c, role)` or `adminOf(c)` (`services/demo-api/src/app.ts:107-119`),
  then `requirePermission(admin, p)` (`services/demo-api/src/services/permissions.ts`), which answers 403 `FORBIDDEN`
  with `details.permission`. A user with the wrong role also gets 403; no token gets 401.
- **Permissions are read on every request** from the stored admin record (`authenticate`, `auth.ts:144-158`), so a
  change applies at once on the server. The admin console keeps the copy it received at sign-in
  (`sessionStorage` key `naya.admin.session`, `apps/admin/src/lib/api.ts:6-29`): its menu and page gates catch up only
  after the next sign-in.
- **Client gates are cosmetic.** `RequirePermission` (`apps/admin/src/components/Layout.tsx:173-197`) shows
  « Accès refusé » with the missing permission; the menu keeps locked items visible with a lock icon
  (`Layout.tsx:47-64`), as [ADR-0017](../adr/0017-the-admin-is-a-separate-vite-spa.md) requires. Hiding a button is never the protection.
- **Permission strings** are the `AdminPermission` union in `packages/domain/src/entities.ts:53-63`. There are
  no roles: an admin holds a list of strings. There is no city scoping and no admin-management screen.

## Admin permission matrix

| Permission | Allows | Console routes gated on it (`apps/admin/src/router.tsx`) | API endpoints that require it | Also read inline by |
|---|---|---|---|---|
| `people.read` | People, profiles and the verification queue (read) | `/verifications`, `/verifications/:id`, `/personnes`, `/personnes/:id` | `GET /admin/people`, `/admin/people/:id`, `/admin/verifications`, `/admin/verifications/:id` | — |
| `verification.decide` | Take a case in review; approve, reject or request changes; open identity documents | none (CaseReview shows the actions when the API returns `canDecide`) | `POST /admin/verifications/:id/start-review`, `POST /admin/verifications/:id/decision` | `GET /admin/verifications/:id` (`canDecide`); `GET /uploads/:id` and `/uploads/:id/preview` (any upload) |
| `rides.read` | Rides, ride detail, scheduled bookings | `/courses`, `/courses/:id` | `GET /admin/rides`, `/admin/rides/:id`, `/admin/scheduled` | — |
| `support.resolve` | Ticket queue, replies, resolution | `/support`, `/support/:id` | `GET /admin/support`, `/admin/support/:id`, `POST /admin/support/:id/messages`, `/resolve` | `GET /uploads/:id` and `/uploads/:id/preview` (support attachments) |
| `safety.respond` (added 13 Oct, P2) | SOS queue: list, take charge, resolve with a note | `/sos` (also opens with `config.edit`) | `GET /admin/prototype/alerts`, `POST /admin/prototype/alerts/:id` (also accept `config.edit`, see below) | — |
| `finance.read` | Driver wallets, ledgers, transfers, failed and pending payments | `/finance` | `GET /admin/finance/summary`, `/admin/finance/ledger` | `GET /admin/people/:id` (wallet, ledger); `GET /admin/rides/:id` (ledger) |
| `finance.correct` | Exceptional ledger correction (reason, confirmation, `Idempotency-Key`) | none (the button on `/finance` needs it, `Finance.tsx:30`) | `POST /admin/finance/corrections` | — |
| `config.edit` | Cities, rules, zones and payment providers (writes); everything under « Services et familles » | `/services` | `POST /admin/cities`, `PUT /admin/cities/:id/rules`, `POST /admin/cities/:id/status`, `/zones`, `POST /admin/zones/:id/active`, `POST /admin/providers/:id`, `GET /admin/prototype`, `PUT /admin/prototype/catalog/:kind`, `POST /admin/prototype/assignment/:id`, `/driver-categories/:id` | `GET /uploads/:id` and `/uploads/:id/preview` (support attachments); SOS endpoints and the `/sos` page through `canRespondToSafety` |
| `audit.read` | Audit log with chain check | `/audit` | `GET /admin/audit` | — |
| *(none: any admin)* | — | `/` (Overview), `/villes`, `/villes/:id/regles`, `/paiements` | `GET /admin/me`, `/admin/overview`, `/admin/cities`, `/admin/providers` | — |

On `/villes`, `/villes/:id/regles` and `/paiements` the pages open for every admin; the edit controls appear only with
`config.edit` (`Cities.tsx:37`, `Rules.tsx:119`, `Providers.tsx:23`, all in `apps/admin/src/pages/`), and the server
refuses writes without it.

### SOS: `safety.respond`, with a fallback to `config.edit`

Added on branch `chore/docs-foundation-and-fixes` (backlog P2, ADM-03, API-04). Before it, SOS lived only in a tab of
`/services`, behind `config.edit`, so the support agent could not see an alert. Now:

- `safety.respond` exists (`packages/domain/src/entities.ts:59-60`) and both seeded admins hold it
  (`services/demo-api/src/seed.ts:300-301`).
- `/sos` has its own page, menu entry and open-count badge (`router.tsx:73`, `Layout.tsx:19,33-37,58-63`).
- The server and the console both use `canRespondToSafety` (`packages/domain/src/prototype.ts:153-159`):
  `safety.respond` **or** `config.edit`. The fallback keeps access for admin records stored before the new
  permission existed (the demo store is not migrated, [ADR-0029](../adr/0029-demo-store-is-versioned-schemaversion-1-and.md)).
  It can go once every store has been reseeded; [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md)
  decides what `config.edit` keeps.
- Tests: `services/demo-api/test/prototype.test.ts` checks the 403 without either permission and the `config.edit`
  fallback.

## Seeded admins

From `services/demo-api/src/seed.ts:299-303`. Passwords: [runbooks/demo-data.md](../runbooks/demo-data.md).

| Permission | AD-001 Meryem Lahlou (Administratrice) | AD-002 Youssra Kettani (Agente support) |
|---|---|---|
| `people.read` | yes | yes |
| `verification.decide` | yes | — |
| `rides.read` | yes | yes |
| `support.resolve` | yes | yes |
| `safety.respond` | yes | yes |
| `finance.read` | yes | — |
| `finance.correct` | yes | — |
| `config.edit` | yes | — |
| `audit.read` | yes | — |

In standalone builds the in-process demo uses the first admin (AD-001) to auto-approve documents a tester submits
(`services/demo-api/src/embedded.ts:44-47`).

## Admin console routes and the calls behind them

What each page fetches, so a page gate and its endpoints can be compared. "Layout" calls run on every page.

| Route | Page gate | Calls (permission each needs) |
|---|---|---|
| `/connexion` | signed out only | `POST /admin/auth/login` (public) |
| Layout | signed in | `GET /admin/cities` (none, city switcher); `GET /admin/prototype/alerts` (`safety.respond` or `config.edit`, menu badge; skipped without either) |
| `/` Overview | none | `GET /admin/overview` (none), `GET /admin/cities` (none); SOS card from the alerts query when allowed |
| `/verifications` | `people.read` | `GET /admin/verifications` (`people.read`) |
| `/verifications/:id` | `people.read` | `GET /admin/verifications/:id` (`people.read`); `POST …/start-review`, `…/decision` (`verification.decide`); documents via `GET /uploads/:id` (`verification.decide`) |
| `/personnes` | `people.read` | `GET /admin/people` (`people.read`) |
| `/personnes/:id` | `people.read` | `GET /admin/people/:id` (`people.read`; wallet and ledger only with `finance.read`) |
| `/courses` | `rides.read` | `GET /admin/rides`, `GET /admin/scheduled` (`rides.read`) |
| `/courses/:id` | `rides.read` | `GET /admin/rides/:id` (`rides.read`; ledger only with `finance.read`) |
| `/support`, `/support/:id` | `support.resolve` | `GET /admin/support[/:id]`, `POST …/messages`, `POST …/resolve` (`support.resolve`); attachments via `GET /uploads/:id` |
| `/sos` | `safety.respond` or `config.edit` (`useAllowed` in `Layout.tsx` applies `canRespondToSafety`) | `GET /admin/prototype/alerts`, `POST /admin/prototype/alerts/:id` (`safety.respond` or `config.edit`) |
| `/finance` | `finance.read` | `GET /admin/finance/summary`, `/ledger` (`finance.read`); `POST /admin/finance/corrections` (`finance.correct`) |
| `/villes`, `/villes/:id/regles` | none | `GET /admin/cities` (none); city, zone and rule writes (`config.edit`) |
| `/services` | `config.edit` | `GET /admin/prototype`, `PUT /admin/prototype/catalog/:kind`, `POST /admin/prototype/assignment/:id`, `/driver-categories/:id` (`config.edit`); arrival photos via `GET /uploads/:id`. Today: the page still has its own SOS tab posting to `/admin/prototype/alerts/:id` |
| `/paiements` | none | `GET /admin/providers` (none); `POST /admin/providers/:id` (`config.edit`) |
| `/audit` | `audit.read` | `GET /admin/audit` (`audit.read`) |

## Mobile route guards

Both apps gate route groups with Expo Router `Stack.Protected` in their root layout
([ADR-0015](../adr/0015-route-group-gating-with-expo-router-stack.md)). While the account loads, the navigator stays
mounted (so a deep link survives) and an opaque cover hides the screen until the guard is known.

**Passenger** (`apps/passenger/src/app/_layout.tsx:24-35`). `verified` means the `passenger_identity` case from
`GET /me` is `approved` (`useIdentityCase`, `apps/passenger/src/lib/queries.ts:16-19`).

| Group | Guard | Holds |
|---|---|---|
| `(auth)` | signed out | welcome, phone, OTP |
| `(verify)` | signed in, loaded, not verified | identity, document capture, review, verification status, support |
| `(app)` | signed in, and loading or verified | tabs (home, trips, account), route, quote, ride, receipt, scheduled, payments, card, wallet, Famille, places, preferences, help, support, logo gallery |
| `dev` | **none** | scenario launcher (modal) |

**Driver** (`apps/driver/src/app/_layout.tsx:25-39`). `submitted` means both the person case and the vehicle case
have left `draft` (`isSubmitted`, `apps/driver/src/lib/queries.ts:24`). Approval is not a route guard.

| Group | Guard | Holds |
|---|---|---|
| `(auth)` | signed out | welcome, phone, OTP |
| `(onboard)` | signed in, loaded, not both submitted | document checklist |
| `(app)` | signed in, and loading or both submitted | tabs (home, earnings, wallet, account), offer, ride, ride end, ledger, recharge, withdraw, rides, support, Famille, profile, logo gallery |
| `docs` | signed in | start, identity, vehicle, capture, status (reachable before and after submission) |
| `dev` | **none** | scenario launcher (modal) |

What the server enforces behind those screens:

- **Role.** Every passenger route uses `userOf(c, 'passenger')` and every driver route `userOf(c, 'driver')`; a
  token of the other role gets 403. Tested in `services/demo-api/test/scenarios.test.ts` ("authorizes every
  operation by role").
- **Passenger approval.** `POST /rides`, `POST /scheduled` and `POST /prototype/family/subscribe` refuse with
  `VERIFICATION_REQUIRED` unless the identity case is approved (`requireVerifiedPassenger` in
  `services/demo-api/src/services/rides.ts`; `addSubscription` in `services/prototype.ts`). Quotes do not check it.
- **Driver eligibility.** `POST /driver/online` refuses with `NOT_ELIGIBLE` or `DEBT_LIMIT_REACHED` unless identity
  and vehicle are approved, the city is open to her, her debt is under the city limit and her account is active
  (`setOnline` and `driverEligibility` in `services/rides.ts`). `dispatch()` offers rides only to eligible drivers.
- **Suspended accounts.** `authenticate` accepts a user session only while `user.status` is `active`. Nothing sets
  another status yet ([ADR-0055](../adr/0055-account-lifecycle.md)).
- **Session storage.** Mobile tokens live in SecureStore, this device only, and in `sessionStorage` on Expo web
  (`packages/ui/src/core/session.ts`).

## Known gaps

Lines that start with "Today:" describe the code on 2026-10-13. Delete a line when its fix lands, and update the
backlog row.

| Gap | Evidence | Backlog |
|---|---|---|
| Today: the Overview shows ride volume, commission and the split by payment method to every admin. `GET /admin/overview` checks no permission. | `services/demo-api/src/app.ts:652-678`; `apps/admin/src/pages/Overview.tsx:74-75` | ADM-12, API-10, PRD-27 |
| Today: the People list shows every driver's balance to `people.read` holders. `GET /admin/people` returns `walletOf` for each driver, while the profile endpoint hides it without `finance.read`. | `app.ts:693` vs `app.ts:705,711-712`; `People.tsx:71` | ADM-12, API-10 |
| Today: `GET /admin/cities` and `GET /admin/providers` check no permission, and `/villes`, `/villes/:id/regles` and `/paiements` have no page gate. Any admin reads full rule versions and provider settings. | `app.ts:864-868`, `app.ts:877-881`; `router.tsx:75-76,78` | API-10 |
| Today: `config.edit` is the catch-all for the Oct 6 features. Whoever edits city rules can also change category prices, reassign a Famille driver, change driver categories, and read `GET /admin/prototype`: every child profile and its recipients, every family trip, every passenger wallet and every SOS alert. | `services/demo-api/src/services/prototype.ts` (`/admin/prototype*` routes) | DOM-11, [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) |
| Today: child arrival photos are uploaded as `support_attachment`, so any admin with `support.resolve` or `config.edit` can open them, and `verification.decide` opens every upload. | `services/demo-api/src/services/uploads.ts:60-64`; « Prendre une photo d’arrivée » calls `uploadFile(api, f, 'support_attachment')` in `packages/ui/src/features/prototype.tsx` | PRD-29, [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) |
| Today: passenger wallet balances (customer funds) are visible only under `/services` (`config.edit`), not to `finance.read`. | `/admin/finance/summary` covers drivers only (`app.ts:821-842`) | PRD-38 |
| Today: in dev mode, which is on unless `NAYA_DEV=0`, every `/dev/*` route answers without sign-in, including `POST /dev/reset`. | `app.ts:900-993`; `services/demo-api/src/main.ts:13` | P9, API-06, [ADR-0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md) |
| Today: the admin sign-in page lists the demo accounts, with their passwords, in every build. | `apps/admin/src/pages/Login.tsx:11-14` | P9, ADM-15, PRD-28 |
| Today: the mobile `dev` route (scenario launcher) is outside every guard; only the entry points to it check `DEMO_MODE`. | `apps/passenger/src/app/_layout.tsx:34`, `apps/driver/src/app/_layout.tsx:38` | P9 |
| No test walks the whole matrix. Spot checks exist in `scenarios.test.ts` and `prototype.test.ts`. [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) proposes a CI test that fails when an admin endpoint has no permission check. | `services/demo-api/test/` | API-23, [ADR-0037](../adr/0037-admin-permission-model-for-the-new-features.md) |

To list the admin endpoints that check no permission, read the last row of the "By admin permission" table in
[api-reference.md](api-reference.md), or regenerate it with `node scripts/docs/gen-api-reference.mjs`.
