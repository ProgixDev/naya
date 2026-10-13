# Demo API (services/demo-api) — agent notes

Read the root [AGENTS.md](../../AGENTS.md) first. This is the only backend. It is a demo: one JSON file, no database.

`createApp(ctx)` in `src/app.ts` builds one Hono app that runs three ways:
- **Node server**: `pnpm api` (`tsx watch src/main.ts`) on :4010, data in `.data/db.json` (git-ignored; `NAYA_DATA_DIR` overrides).
- **On the phone**: `src/embedded.ts` runs the same app in-process for standalone native builds
  (data in `Documents/naya-standalone-demo/demo-v1.json`, a bot plays the other side).
- **In tests**: `test/harness.ts` calls `app.request()` with a `ManualClock`.

So code under `src/` (except `main.ts` and `cli.ts`) must run under Metro too: import fs, path and crypto from
`./platform` (Node adapter) — Metro picks `platform.native.ts` (expo-file-system, expo-crypto, @noble/hashes).

## Layout
- `src/app.ts` — routes, `body()` validation, `userOf` / `adminOf`, `idempotent()`, `/dev/*` tools.
- `src/services/*.ts` — business logic per area: auth, rides, finance, verification, cities, support, uploads, timers,
  bot, and `permissions.ts` (`requirePermission`).
- `src/services/prototype.ts` — the Oct 6 features; its routes are registered by `mountPrototypeRoutes`.
- `src/seed.ts` — `SCENARIOS`, `DEMO_ACCOUNTS`, `buildSeed`. `src/state.ts` — the `State` shape.
- `src/store.ts` (transactions), `src/audit.ts` (hash chain), `src/clock.ts` (offset clock, `ManualClock`).
- Schemas, entities, errors and French labels live in `packages/domain`, not here.

## How to add an endpoint
1. Input: a zod schema in `packages/domain/src/schemas.ts`; types in `entities.ts`; error copy in French (`errors.ts`).
2. Logic: a function in `src/services/<area>.ts` taking `(ctx, principal, input)`. Change state only inside
   `ctx.store.tx((s) => …)`. Refuse with `throw new DomainError(code, message)`; the error handler maps the code to HTTP.
3. Route in `src/app.ts` (or `mountPrototypeRoutes`): parse with `body(c, schema)`, identify the caller with
   `userOf(c, role)` or `adminOf(c)` + `requirePermission(admin, '<permission>')`.
   Booking, money, SOS and family POSTs go through `idempotent(ctx, c, subjectId, input, () => …)`.
4. Client: a method in `packages/api/src/client.ts` (pass the key for idempotent routes) and its response type.
5. Query key in `packages/api/src/keys.ts` (`['naya', accountId, …]`); invalidate it after the mutation.
6. Test in `test/*.test.ts` with `setup()` from `test/harness.ts`: fixed OTP 123456, `login()`, `adminLogin()`,
   `advance(seconds)`. Every POST gets an Idempotency-Key automatically; pass `key: false` to test the missing-key path.
7. Admin configuration change: `reasonSchema` (≥ 10 chars) + `expectedVersion` (throw `CONFLICT` on mismatch) +
   `appendAudit` with `before` and `after` (see `updateRules` in `src/services/cities.ts`).
8. Regenerate the route reference: `node scripts/docs/gen-api-reference.mjs` from the repo root, and commit
   `docs/architecture/api-reference.md`. A new auth or validation helper must be taught to that script first.

## Rules
- **Transactions.** `store.tx(fn)` snapshots the state, runs `fn`, bumps `version` and persists atomically (tmp file + rename).
  If `fn` throws, the snapshot is restored. Never mutate `ctx.store.state` outside `tx`.
- **Idempotency.** Keys are scoped by (key, subject). Same key + same route + same body replays the stored response;
  a different body or route returns `IDEMPOTENCY_CONFLICT`. The last 2,000 records are kept.
- **Money.** Driver money moves only through ledger postings with a unique business key (`postLedger`,
  `src/services/finance.ts`). Provider outcomes go through `applyProviderEvent` / `resolveManually`; callbacks are
  HMAC-SHA256 over the raw body in `X-Naya-Signature`.
- **Audit.** `appendAudit(s, at, …)` inside the same `tx`. Append-only and hash-chained; `GET /admin/audit` verifies it.
  Never edit or delete audit events.
- **Time.** Use `ctx.clock`, never `Date.now()`, so tests and `/dev/clock/advance` stay deterministic. Time rules
  (offer expiry, provider delays, scheduled dispatch) run in `tick()` every 500 ms (`main.ts`), or before each embedded request.
- **Responses** carry `X-Server-Time` (clients correct clock skew with it) and `Cache-Control: no-store`.

## NAYA_DEV and /dev routes
- Dev mode is on unless `NAYA_DEV=0` (`src/main.ts:13`). It enables the fixed OTP 123456 and registers `/dev/*`:
  scenarios, reset, clock/advance, tick, providers, bot, tracking freeze/resume, provider-jobs, navigate, sample-upload.
- Embedded builds and tests always run in dev mode. With `NAYA_DEV=0`, `NAYA_PROVIDER_SECRET` must be set or the server exits.
- Env vars are read from the process only (no dotenv): `PORT`, `NAYA_DEV`, `NAYA_PROVIDER_SECRET`, `NAYA_DATA_DIR`,
  `NAYA_APPLE_AUTH_CONFIGURED`, `NAYA_GOOGLE_AUTH_CONFIGURED`.
- Today: dev mode is opt-out and the server binds 0.0.0.0 (P9, ADR-0044).

## Store schemaVersion — read before changing State
- `State.schemaVersion` is 1. `Store.load` reseeds with `buildSeed` when the file is missing or the version differs
  (`src/store.ts:22-29`). There are no migrations, so a seed change (new admin permission, new fixture) reaches an
  existing `db.json` or phone only after a reset.
- A bump wipes `.data/db.json` and every TestFlight tester's on-device data. Prefer backward-compatible changes
  (optional fields with defaults). Bump only with an ADR (ADR-0029).

## Checks
- `pnpm --filter @naya/demo-api test` (vitest, `test/**/*.test.ts`) and `pnpm --filter @naya/demo-api typecheck`.
- `pnpm demo:reset` rewrites `.data` (stop the API first) or call `POST /dev/reset` on a running server.
- Today: the Oct 6 prototype module breaks several of these rules. The passenger confirms her own wallet top-up with
  no provider event (P7). Passenger wallet entries are edited in place and GET handlers write state (API-19). Catalog
  writes take no reason or `expectedVersion` (ADM-09). Famille handover codes are stored in plain text (P1, D3).
- Famille handover codes never reach the driver: `family()` strips them from her payload, and only the server compares
  them. A wrong code is counted on the trip and the 5th locks the handover. The refusal is returned from the
  transaction and thrown afterwards, so the count survives the rollback a throw would cause (P1).
- `POST /driver/location` refuses a driver who is neither online nor on an accepted ride (409) and answers
  `{ ok, onRide }`, so the background task can stop itself (P4). The check sits in the `app.ts` handler, not in
  `updateLocation` (`src/services/rides.ts`).
