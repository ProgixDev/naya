<!-- GENERATED FILE: do not edit by hand. Run `node scripts/docs/gen-api-reference.mjs`. -->

# Demo API reference

Generated — run `node scripts/docs/gen-api-reference.mjs` after you add, remove or change a route, and commit the result.
`node scripts/docs/gen-api-reference.mjs --check` exits 1 when this file no longer matches the code.
Last verified: whenever the check above passes. Owner: whoever changes a route.

Every HTTP route of `services/demo-api`, read from its Hono registrations in
[app.ts](../../services/demo-api/src/app.ts) and [services/famille.ts](../../services/demo-api/src/services/famille.ts) and [services/prototype.ts](../../services/demo-api/src/services/prototype.ts).
The same app serves the Node server on :4010, the in-process demo inside native standalone builds and the tests
(see [runtime-modes.md](runtime-modes.md)). Request and response types live in `packages/api/src/client.ts`;
schemas in `packages/domain/src/schemas.ts`, except the Oct 6 feature schemas (`childSchema`, `categorySchema`…),
which are local to `services/prototype.ts`. Who may call what, and why: [permissions.md](permissions.md).

## Summary

| | Routes |
|---|---|
| All | 156 (GET 62, POST 82, PATCH 2, DELETE 2, PUT 8) |
| Caller: public | 22 |
| Caller: user (any role) | 38 |
| Caller: passenger | 29 |
| Caller: driver | 29 |
| Caller: admin | 34 |
| Caller: signed in (user or admin) | 3 |
| Caller: provider (HMAC) | 1 |
| Admin routes with a permission check | 30 of 34 |
| Idempotency-Key required | 13 |
| Idempotency-Key optional (honoured when sent) | 3 |
| Registered only in dev mode | 15 |
| Body read without validation | 12 |

## Global behaviour

- `app.use('*')` at [app.ts:206](../../services/demo-api/src/app.ts#L206) — only when `!options.embedded`.
- `app.use('*')` at [app.ts:207](../../services/demo-api/src/app.ts#L207).
- `app.onError` at [app.ts:214](../../services/demo-api/src/app.ts#L214).
- Every response carries `X-Server-Time` and, unless the handler sets its own (`GET /uploads/:id`),
  `Cache-Control: no-store`. Errors are
  `{ error: { code, message, details } }`; the HTTP status comes from `httpStatusFor(code)` in `packages/domain`;
  zod failures return 422 with `details.fields`.
- Authentication is a bearer token (`Authorization: Bearer …`) from `POST /auth/otp/verify` (mobile) or
  `POST /admin/auth/login` (admin). The middleware resolves it to a principal on every request.

## How the columns are derived

The generator follows each handler into every function it calls inside `services/demo-api/src`.

| Column | Source in code |
|---|---|
| Caller | `userOf(c, role)` → that role; `userOf(c)` → any user role; `adminOf(c)` → admin; `c.get('principal')` → any signed-in principal; `verifySignature` → provider callback; none → public. |
| Permission | `requirePermission(admin, p)` → required. "or … (helper)": a `@naya/domain` helper that also accepts another permission. "inline": the code reads `admin.permissions.includes(p)` to filter fields or grant access; read the source. |
| Idempotency-Key | `idempotent(…)` → required, or optional when its last argument is `false`; a handler that reads the header and throws without it → required. |
| Input | `body(c, schema)` or `<name>Schema.parse(…)` → validated; `z.object(…).parse(…)` → inline zod; `c.req.json()` not passed to a parser → raw JSON; `c.req.query(name)` → query parameters. |
| Notes | "dev mode only": registered inside `if (ctx.config.devMode)`. "403 unless dev mode": the handler refuses when dev mode is off. "dev-mode branch": the handler behaves differently in dev mode. |

## Health and sync

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/health` | public | — | — | — |  | [app.ts:230](../../services/demo-api/src/app.ts#L230) |
| GET | `/sync` | public | — | — | — |  | [app.ts:231](../../services/demo-api/src/app.ts#L231) |

## Mobile sign-in

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/auth/otp/request` | public | — | — | `otpRequestSchema` |  | [app.ts:234](../../services/demo-api/src/app.ts#L234) |
| POST | `/auth/otp/verify` | public | — | — | `otpVerifySchema` |  | [app.ts:238](../../services/demo-api/src/app.ts#L238) |
| POST | `/auth/logout` | public | — | — | — |  | [app.ts:243](../../services/demo-api/src/app.ts#L243) |
| GET | `/auth/providers` | public | — | — | — |  | [app.ts:247](../../services/demo-api/src/app.ts#L247) |

## Profile

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/me` | user (any role) | — | — | — |  | [app.ts:257](../../services/demo-api/src/app.ts#L257) |
| PATCH | `/me` | user (any role) | — | — | `profileUpdateSchema` |  | [app.ts:262](../../services/demo-api/src/app.ts#L262) |
| POST | `/me/places` | passenger | — | — | `savedPlaceSchema` |  | [app.ts:277](../../services/demo-api/src/app.ts#L277) |
| DELETE | `/me/places/:id` | passenger | — | — | — |  | [app.ts:290](../../services/demo-api/src/app.ts#L290) |

## Uploads and verification

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/uploads` | user (any role) | — | — | `uploadSchema` |  | [app.ts:302](../../services/demo-api/src/app.ts#L302) |
| GET | `/uploads/:id/preview` | signed in (user or admin) | inline: `config.edit`, `support.resolve`, `verification.decide` | — | — |  | [app.ts:307](../../services/demo-api/src/app.ts#L307) |
| GET | `/uploads/:id` | signed in (user or admin) | inline: `config.edit`, `support.resolve`, `verification.decide` | — | — |  | [app.ts:312](../../services/demo-api/src/app.ts#L312) |
| GET | `/verification` | user (any role) | — | — | — |  | [app.ts:318](../../services/demo-api/src/app.ts#L318) |
| POST | `/verification/vehicle` | driver | — | — | — |  | [app.ts:322](../../services/demo-api/src/app.ts#L322) |
| PUT | `/verification/:id/identity` | user (any role) | — | — | `identityDetailsSchema` |  | [app.ts:323](../../services/demo-api/src/app.ts#L323) |
| PUT | `/verification/:id/vehicle` | driver | — | — | `vehicleDetailsSchema` |  | [app.ts:324](../../services/demo-api/src/app.ts#L324) |
| PUT | `/verification/:id/licence` | driver | — | — | raw JSON (not validated) |  | [app.ts:326](../../services/demo-api/src/app.ts#L326) |
| POST | `/verification/famille` | driver | — | — | — |  | [app.ts:327](../../services/demo-api/src/app.ts#L327) |
| PUT | `/verification/:id/famille` | driver | — | — | raw JSON (not validated) |  | [app.ts:328](../../services/demo-api/src/app.ts#L328) |
| PUT | `/verification/:id/draft` | driver | — | — | `signupDraftSchema` |  | [app.ts:329](../../services/demo-api/src/app.ts#L329) |
| PUT | `/verification/:id/items/:key` | user (any role) | — | — | raw JSON (not validated) |  | [app.ts:330](../../services/demo-api/src/app.ts#L330) |
| POST | `/verification/:id/submit` | user (any role) | — | — | — |  | [app.ts:335](../../services/demo-api/src/app.ts#L335) |
| POST | `/verification/:id/reopen` | user (any role) | — | — | — |  | [app.ts:336](../../services/demo-api/src/app.ts#L336) |

## Cities and places

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/cities` | public | — | — | — |  | [app.ts:339](../../services/demo-api/src/app.ts#L339) |
| GET | `/places/search` | public | — | — | query `q`, `cityId` |  | [app.ts:343](../../services/demo-api/src/app.ts#L343) |
| GET | `/places/reverse` | public | — | — | query `lat`, `lng` |  | [app.ts:353](../../services/demo-api/src/app.ts#L353) |

## Passenger: quotes, payment methods, rides, scheduled rides

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/quotes` | passenger | — | — | `quoteRequestSchema` |  | [app.ts:363](../../services/demo-api/src/app.ts#L363) |
| GET | `/payment-methods` | passenger | — | — | — |  | [app.ts:367](../../services/demo-api/src/app.ts#L367) |
| POST | `/payment-methods/card` | passenger | — | — | `tokenizedCardSchema` |  | [app.ts:375](../../services/demo-api/src/app.ts#L375) |
| POST | `/payment-methods/:id/default` | passenger | — | — | — |  | [app.ts:391](../../services/demo-api/src/app.ts#L391) |
| DELETE | `/payment-methods/:id` | passenger | — | — | — |  | [app.ts:401](../../services/demo-api/src/app.ts#L401) |
| POST | `/rides` | passenger | — | required | `createRideSchema` |  | [app.ts:420](../../services/demo-api/src/app.ts#L420) |
| GET | `/rides/active` | passenger | — | — | — |  | [app.ts:425](../../services/demo-api/src/app.ts#L425) |
| GET | `/rides` | user (any role) | — | — | query `limit`, `cursor` |  | [app.ts:431](../../services/demo-api/src/app.ts#L431) |
| GET | `/rides/:id` | user (any role) | — | — | — |  | [app.ts:440](../../services/demo-api/src/app.ts#L440) |
| GET | `/rides/:id/cancellation-preview` | passenger | — | — | — |  | [app.ts:453](../../services/demo-api/src/app.ts#L453) |
| POST | `/rides/:id/cancel` | passenger | — | optional | `cancelSchema` |  | [app.ts:454](../../services/demo-api/src/app.ts#L454) |
| POST | `/rides/:id/retry-search` | passenger | — | — | — |  | [app.ts:459](../../services/demo-api/src/app.ts#L459) |
| POST | `/rides/:id/rating` | passenger | — | — | `ratingSchema` |  | [app.ts:460](../../services/demo-api/src/app.ts#L460) |
| POST | `/rides/:id/payment/retry` | passenger | — | required | raw JSON (not validated) |  | [app.ts:464](../../services/demo-api/src/app.ts#L464) |
| POST | `/scheduled` | passenger | — | required | `scheduleRideSchema` |  | [app.ts:471](../../services/demo-api/src/app.ts#L471) |
| GET | `/scheduled` | passenger | — | — | — |  | [app.ts:476](../../services/demo-api/src/app.ts#L476) |
| GET | `/scheduled/:id` | passenger | — | — | — |  | [app.ts:480](../../services/demo-api/src/app.ts#L480) |
| PATCH | `/scheduled/:id` | passenger | — | — | `modifyScheduledSchema` |  | [app.ts:485](../../services/demo-api/src/app.ts#L485) |
| POST | `/scheduled/:id/cancel` | passenger | — | — | `cancelSchema` |  | [app.ts:486](../../services/demo-api/src/app.ts#L486) |

## Driver

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/driver/status` | driver | — | — | — |  | [app.ts:528](../../services/demo-api/src/app.ts#L528) |
| POST | `/driver/online` | driver | — | — | `goOnlineSchema` |  | [app.ts:529](../../services/demo-api/src/app.ts#L529) |
| POST | `/driver/location` | driver | — | — | `locationUpdateSchema` |  | [app.ts:535](../../services/demo-api/src/app.ts#L535) |
| POST | `/driver/offers/:id/accept` | driver | — | optional | — |  | [app.ts:544](../../services/demo-api/src/app.ts#L544) |
| POST | `/driver/offers/:id/decline` | driver | — | — | `declineOfferSchema` |  | [app.ts:549](../../services/demo-api/src/app.ts#L549) |
| POST | `/driver/rides/:id/arrive` | driver | — | — | — |  | [app.ts:560](../../services/demo-api/src/app.ts#L560) |
| POST | `/driver/rides/:id/start` | driver | — | — | — |  | [app.ts:561](../../services/demo-api/src/app.ts#L561) |
| POST | `/driver/rides/:id/stop-complete` | driver | — | — | — |  | [app.ts:562](../../services/demo-api/src/app.ts#L562) |
| POST | `/driver/rides/:id/complete` | driver | — | — | — |  | [app.ts:563](../../services/demo-api/src/app.ts#L563) |
| POST | `/driver/rides/:id/cash-collected` | driver | — | — | `cashCollectedSchema` |  | [app.ts:564](../../services/demo-api/src/app.ts#L564) |
| POST | `/driver/rides/:id/cancel` | driver | — | — | `cancelSchema` |  | [app.ts:568](../../services/demo-api/src/app.ts#L568) |
| GET | `/driver/earnings` | driver | — | — | query `from`, `to` |  | [app.ts:572](../../services/demo-api/src/app.ts#L572) |
| GET | `/driver/wallet` | driver | — | — | — |  | [app.ts:576](../../services/demo-api/src/app.ts#L576) |
| GET | `/driver/ledger` | driver | — | — | query `type`, `limit`, `cursor` |  | [app.ts:587](../../services/demo-api/src/app.ts#L587) |
| GET | `/driver/ledger/:id` | driver | — | — | — |  | [app.ts:595](../../services/demo-api/src/app.ts#L595) |
| GET | `/driver/transfers` | driver | — | — | — |  | [app.ts:606](../../services/demo-api/src/app.ts#L606) |
| GET | `/payment-providers` | user (any role) | — | — | query `purpose` |  | [app.ts:614](../../services/demo-api/src/app.ts#L614) |
| POST | `/driver/recharges` | driver | — | required | `rechargeSchema` |  | [app.ts:620](../../services/demo-api/src/app.ts#L620) |
| GET | `/driver/recharges/:id` | driver | — | — | — |  | [app.ts:625](../../services/demo-api/src/app.ts#L625) |
| POST | `/driver/withdrawals` | driver | — | required | `withdrawalSchema` |  | [app.ts:629](../../services/demo-api/src/app.ts#L629) |
| GET | `/driver/withdrawals/:id` | driver | — | — | — |  | [app.ts:634](../../services/demo-api/src/app.ts#L634) |

## Payment provider sandbox and callbacks

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/provider-sandbox/:kind/:ref/:outcome` | signed in (user or admin) | — | — | — | dev-mode branch | [app.ts:644](../../services/demo-api/src/app.ts#L644) |
| POST | `/provider-sandbox/tokenize` | passenger | — | — | raw JSON (not validated) |  | [app.ts:659](../../services/demo-api/src/app.ts#L659) |
| POST | `/providers/:provider/callback` | provider (HMAC) | — | — | `providerCallbackSchema`; raw body, signed |  | [app.ts:666](../../services/demo-api/src/app.ts#L666) |

## Support (passenger and driver)

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/support/tickets` | user (any role) | — | — | — |  | [app.ts:674](../../services/demo-api/src/app.ts#L674) |
| POST | `/support/tickets` | user (any role) | — | — | `supportTicketSchema` |  | [app.ts:678](../../services/demo-api/src/app.ts#L678) |
| GET | `/support/tickets/:id` | user (any role) | — | — | — |  | [app.ts:679](../../services/demo-api/src/app.ts#L679) |
| POST | `/support/tickets/:id/messages` | user (any role) | — | — | `supportMessageSchema` |  | [app.ts:683](../../services/demo-api/src/app.ts#L683) |

## Oct 6 features ("prototype"): passenger and driver

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/prototype/family` | user (any role) | — | — | — |  | [services/famille.ts:571](../../services/demo-api/src/services/famille.ts#L571) |
| POST | `/prototype/family/children` | passenger | — | — | inline zod |  | [services/famille.ts:575](../../services/demo-api/src/services/famille.ts#L575) |
| POST | `/prototype/family/subscribe` | passenger | — | required | inline zod |  | [services/famille.ts:595](../../services/demo-api/src/services/famille.ts#L595) |
| POST | `/prototype/family/trips` | passenger | — | required | inline zod |  | [services/famille.ts:600](../../services/demo-api/src/services/famille.ts#L600) |
| POST | `/prototype/family/example` | user (any role) | — | — | — | 403 unless dev mode | [services/famille.ts:606](../../services/demo-api/src/services/famille.ts#L606) |
| GET | `/prototype/family/trips/:id` | user (any role) | — | — | — |  | [services/famille.ts:620](../../services/demo-api/src/services/famille.ts#L620) |
| GET | `/prototype/family/trips/:id/live` | user (any role) | — | — | — |  | [services/famille.ts:625](../../services/demo-api/src/services/famille.ts#L625) |
| POST | `/prototype/family/trips/:id/position` | driver | — | — | `familyPositionSchema` |  | [services/famille.ts:629](../../services/demo-api/src/services/famille.ts#L629) |
| POST | `/prototype/family/trips/:id/advance` | user (any role) | — | — | `familyAdvanceSchema` | dev-mode branch | [services/famille.ts:643](../../services/demo-api/src/services/famille.ts#L643) |
| POST | `/prototype/family/trips/:id/approval` | passenger | — | required | `familyApprovalSchema` |  | [services/famille.ts:669](../../services/demo-api/src/services/famille.ts#L669) |
| POST | `/prototype/family/trips/:id/cancel` | user (any role) | — | — | `familyCancelSchema` |  | [services/famille.ts:683](../../services/demo-api/src/services/famille.ts#L683) |
| POST | `/prototype/family/trips/:id/calls` | user (any role) | — | — | `familyCallSchema` |  | [services/famille.ts:694](../../services/demo-api/src/services/famille.ts#L694) |
| POST | `/prototype/family/trips/:id/call-request` | driver | — | — | — |  | [services/famille.ts:718](../../services/demo-api/src/services/famille.ts#L718) |
| POST | `/prototype/family/trips/:id/incident` | user (any role) | — | — | inline zod |  | [services/famille.ts:730](../../services/demo-api/src/services/famille.ts#L730) |
| POST | `/prototype/family/guardians` | passenger | — | required | `familyGuardianSchema` |  | [services/famille.ts:747](../../services/demo-api/src/services/famille.ts#L747) |
| POST | `/prototype/family/guardians/:id/:action` | passenger | — | — | — |  | [services/famille.ts:766](../../services/demo-api/src/services/famille.ts#L766) |
| GET | `/prototype/family/follow/:token` | public | — | — | — |  | [services/famille.ts:789](../../services/demo-api/src/services/famille.ts#L789) |
| GET | `/prototype/catalog` | user (any role) | — | — | — |  | [services/prototype.ts:423](../../services/demo-api/src/services/prototype.ts#L423) |
| GET | `/prototype/wallet` | passenger | — | — | — |  | [services/prototype.ts:427](../../services/demo-api/src/services/prototype.ts#L427) |
| POST | `/prototype/wallet/topup` | passenger | — | required | inline zod |  | [services/prototype.ts:430](../../services/demo-api/src/services/prototype.ts#L430) |
| POST | `/prototype/wallet/:id/resolve` | passenger | — | — | inline zod | dev-mode branch | [services/prototype.ts:476](../../services/demo-api/src/services/prototype.ts#L476) |
| POST | `/prototype/sos` | user (any role) | — | required | inline zod |  | [services/prototype.ts:496](../../services/demo-api/src/services/prototype.ts#L496) |
| GET | `/prototype/sos` | user (any role) | — | — | — |  | [services/prototype.ts:553](../../services/demo-api/src/services/prototype.ts#L553) |
| POST | `/prototype/sos/:id/action` | user (any role) | — | — | inline zod |  | [services/prototype.ts:559](../../services/demo-api/src/services/prototype.ts#L559) |

## Admin sign-in

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/admin/auth/login` | public | — | — | `adminLoginSchema` |  | [app.ts:686](../../services/demo-api/src/app.ts#L686) |
| GET | `/admin/me` | admin | — | — | — |  | [app.ts:690](../../services/demo-api/src/app.ts#L690) |

## Admin: Oct 6 features ("prototype")

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/admin/prototype` | admin | `config.edit` | — | — |  | [services/prototype.ts:577](../../services/demo-api/src/services/prototype.ts#L577) |
| PUT | `/admin/prototype/catalog/:kind` | admin | `config.edit` | — | schema picked at runtime |  | [services/prototype.ts:593](../../services/demo-api/src/services/prototype.ts#L593) |
| GET | `/admin/prototype/alerts` | admin | `safety.respond` or `config.edit` (`canRespondToSafety`) | — | — |  | [services/prototype.ts:629](../../services/demo-api/src/services/prototype.ts#L629) |
| POST | `/admin/prototype/alerts/:id` | admin | `safety.respond` or `config.edit` (`canRespondToSafety`) | — | inline zod |  | [services/prototype.ts:646](../../services/demo-api/src/services/prototype.ts#L646) |
| POST | `/admin/prototype/assignment/:id` | admin | `config.edit` | — | inline zod |  | [services/prototype.ts:702](../../services/demo-api/src/services/prototype.ts#L702) |
| POST | `/admin/prototype/driver-categories/:id` | admin | `config.edit` | — | inline zod |  | [services/prototype.ts:752](../../services/demo-api/src/services/prototype.ts#L752) |

## Admin

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/admin/overview` | admin | — | — | query `cityId`, `period` |  | [app.ts:698](../../services/demo-api/src/app.ts#L698) |
| GET | `/admin/people` | admin | `people.read` | — | query `q`, `role`, `cityId`, `verification`, `limit`, `cursor` |  | [app.ts:726](../../services/demo-api/src/app.ts#L726) |
| GET | `/admin/people/:id` | admin | `people.read`; inline: `finance.read` | — | — |  | [app.ts:747](../../services/demo-api/src/app.ts#L747) |
| GET | `/admin/verifications` | admin | `people.read` | — | query `status`, `subject`, `cityId`, `limit`, `cursor` |  | [app.ts:767](../../services/demo-api/src/app.ts#L767) |
| GET | `/admin/verifications/:id` | admin | `people.read`; inline: `verification.decide` | — | — |  | [app.ts:782](../../services/demo-api/src/app.ts#L782) |
| POST | `/admin/verifications/:id/start-review` | admin | `verification.decide` | — | — |  | [app.ts:798](../../services/demo-api/src/app.ts#L798) |
| POST | `/admin/verifications/:id/decision` | admin | `verification.decide` | — | `decisionSchema` |  | [app.ts:799](../../services/demo-api/src/app.ts#L799) |
| GET | `/admin/rides` | admin | `rides.read` | — | query `q`, `status`, `cityId`, `method`, `sort`, `limit`, `cursor` |  | [app.ts:801](../../services/demo-api/src/app.ts#L801) |
| GET | `/admin/car-wash/orders` | admin | `rides.read` | — | query `cityId` |  | [app.ts:820](../../services/demo-api/src/app.ts#L820) |
| GET | `/admin/scheduled` | admin | `rides.read` | — | query `cityId` |  | [app.ts:824](../../services/demo-api/src/app.ts#L824) |
| GET | `/admin/rides/:id` | admin | `rides.read`; inline: `finance.read` | — | — |  | [app.ts:831](../../services/demo-api/src/app.ts#L831) |
| GET | `/admin/support` | admin | `support.resolve` | — | query `status`, `cityId`, `disputes`, `limit`, `cursor` |  | [app.ts:849](../../services/demo-api/src/app.ts#L849) |
| GET | `/admin/support/:id` | admin | `support.resolve` | — | — |  | [app.ts:862](../../services/demo-api/src/app.ts#L862) |
| POST | `/admin/support/:id/messages` | admin | `support.resolve` | — | `supportMessageSchema` |  | [app.ts:869](../../services/demo-api/src/app.ts#L869) |
| POST | `/admin/support/:id/resolve` | admin | `support.resolve` | — | `resolveTicketSchema` |  | [app.ts:870](../../services/demo-api/src/app.ts#L870) |
| GET | `/admin/finance/summary` | admin | `finance.read` | — | query `cityId` |  | [app.ts:872](../../services/demo-api/src/app.ts#L872) |
| GET | `/admin/finance/ledger` | admin | `finance.read` | — | query `driverId`, `type`, `cityId`, `limit`, `cursor` |  | [app.ts:894](../../services/demo-api/src/app.ts#L894) |
| POST | `/admin/finance/corrections` | admin | `finance.correct` | required | `correctionSchema` |  | [app.ts:907](../../services/demo-api/src/app.ts#L907) |
| GET | `/admin/cities` | admin | — | — | — |  | [app.ts:915](../../services/demo-api/src/app.ts#L915) |
| POST | `/admin/cities` | admin | `config.edit` | — | `createCitySchema` |  | [app.ts:920](../../services/demo-api/src/app.ts#L920) |
| PUT | `/admin/cities/:id/rules` | admin | `config.edit` | — | `updateRulesSchema` |  | [app.ts:921](../../services/demo-api/src/app.ts#L921) |
| POST | `/admin/cities/:id/status` | admin | `config.edit` | — | `cityStatusSchema` |  | [app.ts:922](../../services/demo-api/src/app.ts#L922) |
| POST | `/admin/cities/:id/zones` | admin | `config.edit` | — | `zoneSchema` |  | [app.ts:923](../../services/demo-api/src/app.ts#L923) |
| POST | `/admin/zones/:id/active` | admin | `config.edit` | — | `reasonSchema`; raw JSON (not validated) |  | [app.ts:924](../../services/demo-api/src/app.ts#L924) |
| GET | `/admin/providers` | admin | — | — | query `cityId` |  | [app.ts:928](../../services/demo-api/src/app.ts#L928) |
| POST | `/admin/providers/:id` | admin | `config.edit` | — | `providerToggleSchema` |  | [app.ts:933](../../services/demo-api/src/app.ts#L933) |
| GET | `/admin/audit` | admin | `audit.read` | — | query `q`, `action`, `cityId`, `actorType`, `limit`, `cursor` |  | [app.ts:935](../../services/demo-api/src/app.ts#L935) |

## Development tools

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/dev/scenarios` | public | — | — | — | dev mode only | [app.ts:952](../../services/demo-api/src/app.ts#L952) |
| POST | `/dev/reset` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:953](../../services/demo-api/src/app.ts#L953) |
| POST | `/dev/clock/advance` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:962](../../services/demo-api/src/app.ts#L962) |
| POST | `/dev/tick` | public | — | — | — | dev mode only | [app.ts:968](../../services/demo-api/src/app.ts#L968) |
| POST | `/dev/providers/:kind/:ref/:outcome` | public | — | — | — | dev mode only | [app.ts:972](../../services/demo-api/src/app.ts#L972) |
| POST | `/dev/bot` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:976](../../services/demo-api/src/app.ts#L976) |
| POST | `/dev/tracking/:rideId/freeze` | public | — | — | — | dev mode only | [app.ts:990](../../services/demo-api/src/app.ts#L990) |
| POST | `/dev/tracking/:rideId/resume` | public | — | — | — | dev mode only | [app.ts:999](../../services/demo-api/src/app.ts#L999) |
| GET | `/dev/provider-jobs` | public | — | — | — | dev mode only | [app.ts:1007](../../services/demo-api/src/app.ts#L1007) |
| POST | `/dev/navigate` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:1014](../../services/demo-api/src/app.ts#L1014) |
| GET | `/dev/navigate` | public | — | — | query `app` | dev mode only | [app.ts:1020](../../services/demo-api/src/app.ts#L1020) |
| POST | `/dev/verification/:id/simulate` | driver | — | — | `verificationItemKeySchema`; raw JSON (not validated) | dev mode only | [app.ts:1048](../../services/demo-api/src/app.ts#L1048) |
| POST | `/dev/sample-upload` | user (any role) | — | — | raw JSON (not validated) | dev mode only | [app.ts:1055](../../services/demo-api/src/app.ts#L1055) |
| POST | `/dev/family/play` | user (any role) | — | — | `familyDemoSchema` | dev mode only | [services/famille.ts:805](../../services/demo-api/src/services/famille.ts#L805) |
| POST | `/dev/family/trips/:id/demo` | user (any role) | — | — | `familyDemoSchema` | dev mode only | [services/famille.ts:817](../../services/demo-api/src/services/famille.ts#L817) |

## Other

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/car-wash/catalog` | user (any role) | — | — | query `cityId` |  | [app.ts:492](../../services/demo-api/src/app.ts#L492) |
| GET | `/car-wash/payment-options` | user (any role) | — | — | query `cityId` |  | [app.ts:496](../../services/demo-api/src/app.ts#L496) |
| POST | `/car-wash/orders` | user (any role) | — | required | `createWashOrderSchema` |  | [app.ts:500](../../services/demo-api/src/app.ts#L500) |
| GET | `/car-wash/orders` | user (any role) | — | — | — |  | [app.ts:505](../../services/demo-api/src/app.ts#L505) |
| GET | `/car-wash/orders/:id` | user (any role) | — | — | — |  | [app.ts:510](../../services/demo-api/src/app.ts#L510) |
| GET | `/car-wash/orders/:id/cancellation-preview` | user (any role) | — | — | — |  | [app.ts:516](../../services/demo-api/src/app.ts#L516) |
| POST | `/car-wash/orders/:id/cancel` | user (any role) | — | optional | `cancelSchema` |  | [app.ts:517](../../services/demo-api/src/app.ts#L517) |
| POST | `/car-wash/orders/:id/rating` | user (any role) | — | — | `ratingSchema` |  | [app.ts:522](../../services/demo-api/src/app.ts#L522) |

## By admin permission

Permissions are the `AdminPermission` union in [packages/domain/src/entities.ts](../../packages/domain/src/entities.ts).
"Required" means the route refuses without it (403). "Read inline" means the code checks it to filter fields or grant access.

| Permission | Required by | Read inline by |
|---|---|---|
| `verification.decide` | POST `/admin/verifications/:id/start-review`<br>POST `/admin/verifications/:id/decision` | GET `/uploads/:id/preview`<br>GET `/uploads/:id`<br>GET `/admin/verifications/:id` |
| `finance.read` | GET `/admin/finance/summary`<br>GET `/admin/finance/ledger` | GET `/admin/people/:id`<br>GET `/admin/rides/:id` |
| `finance.correct` | POST `/admin/finance/corrections` | — |
| `config.edit` | GET `/admin/prototype`<br>PUT `/admin/prototype/catalog/:kind`<br>GET `/admin/prototype/alerts` (instead of `safety.respond`)<br>POST `/admin/prototype/alerts/:id` (instead of `safety.respond`)<br>POST `/admin/prototype/assignment/:id`<br>POST `/admin/prototype/driver-categories/:id`<br>POST `/admin/cities`<br>PUT `/admin/cities/:id/rules`<br>POST `/admin/cities/:id/status`<br>POST `/admin/cities/:id/zones`<br>POST `/admin/zones/:id/active`<br>POST `/admin/providers/:id` | GET `/uploads/:id/preview`<br>GET `/uploads/:id` |
| `support.resolve` | GET `/admin/support`<br>GET `/admin/support/:id`<br>POST `/admin/support/:id/messages`<br>POST `/admin/support/:id/resolve` | GET `/uploads/:id/preview`<br>GET `/uploads/:id` |
| `safety.respond` | GET `/admin/prototype/alerts` (or `config.edit`)<br>POST `/admin/prototype/alerts/:id` (or `config.edit`) | — |
| `rides.read` | GET `/admin/rides`<br>GET `/admin/car-wash/orders`<br>GET `/admin/scheduled`<br>GET `/admin/rides/:id` | — |
| `audit.read` | GET `/admin/audit` | — |
| `people.read` | GET `/admin/people`<br>GET `/admin/people/:id`<br>GET `/admin/verifications`<br>GET `/admin/verifications/:id` | — |
| (no permission: any signed-in admin) | GET `/admin/me`<br>GET `/admin/overview`<br>GET `/admin/cities`<br>GET `/admin/providers` | |
