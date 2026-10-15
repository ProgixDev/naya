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
| All | 157 (GET 62, POST 83, PATCH 2, DELETE 2, PUT 8) |
| Caller: public | 22 |
| Caller: user (any role) | 38 |
| Caller: passenger | 30 |
| Caller: driver | 29 |
| Caller: admin | 34 |
| Caller: signed in (user or admin) | 3 |
| Caller: provider (HMAC) | 1 |
| Admin routes with a permission check | 30 of 34 |
| Idempotency-Key required | 14 |
| Idempotency-Key optional (honoured when sent) | 3 |
| Registered only in dev mode | 17 |
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
| POST | `/me/deletion` | passenger | — | required | — |  | [app.ts:301](../../services/demo-api/src/app.ts#L301) |

## Uploads and verification

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/uploads` | user (any role) | — | — | `uploadSchema` |  | [app.ts:307](../../services/demo-api/src/app.ts#L307) |
| GET | `/uploads/:id/preview` | signed in (user or admin) | inline: `config.edit`, `support.resolve`, `verification.decide` | — | — |  | [app.ts:312](../../services/demo-api/src/app.ts#L312) |
| GET | `/uploads/:id` | signed in (user or admin) | inline: `config.edit`, `support.resolve`, `verification.decide` | — | — |  | [app.ts:317](../../services/demo-api/src/app.ts#L317) |
| GET | `/verification` | user (any role) | — | — | — |  | [app.ts:323](../../services/demo-api/src/app.ts#L323) |
| POST | `/verification/vehicle` | driver | — | — | — |  | [app.ts:327](../../services/demo-api/src/app.ts#L327) |
| PUT | `/verification/:id/identity` | user (any role) | — | — | `identityDetailsSchema` |  | [app.ts:328](../../services/demo-api/src/app.ts#L328) |
| PUT | `/verification/:id/vehicle` | driver | — | — | `vehicleDetailsSchema` |  | [app.ts:329](../../services/demo-api/src/app.ts#L329) |
| PUT | `/verification/:id/licence` | driver | — | — | raw JSON (not validated) |  | [app.ts:331](../../services/demo-api/src/app.ts#L331) |
| POST | `/verification/famille` | driver | — | — | — |  | [app.ts:332](../../services/demo-api/src/app.ts#L332) |
| PUT | `/verification/:id/famille` | driver | — | — | raw JSON (not validated) |  | [app.ts:333](../../services/demo-api/src/app.ts#L333) |
| PUT | `/verification/:id/draft` | driver | — | — | `signupDraftSchema` |  | [app.ts:334](../../services/demo-api/src/app.ts#L334) |
| PUT | `/verification/:id/items/:key` | user (any role) | — | — | raw JSON (not validated) |  | [app.ts:335](../../services/demo-api/src/app.ts#L335) |
| POST | `/verification/:id/submit` | user (any role) | — | — | — |  | [app.ts:340](../../services/demo-api/src/app.ts#L340) |
| POST | `/verification/:id/reopen` | user (any role) | — | — | — |  | [app.ts:341](../../services/demo-api/src/app.ts#L341) |

## Cities and places

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/cities` | public | — | — | — |  | [app.ts:344](../../services/demo-api/src/app.ts#L344) |
| GET | `/places/search` | public | — | — | query `q`, `cityId` |  | [app.ts:348](../../services/demo-api/src/app.ts#L348) |
| GET | `/places/reverse` | public | — | — | query `lat`, `lng` |  | [app.ts:358](../../services/demo-api/src/app.ts#L358) |

## Passenger: quotes, payment methods, rides, scheduled rides

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/quotes` | passenger | — | — | `quoteRequestSchema` |  | [app.ts:368](../../services/demo-api/src/app.ts#L368) |
| GET | `/payment-methods` | passenger | — | — | — |  | [app.ts:372](../../services/demo-api/src/app.ts#L372) |
| POST | `/payment-methods/card` | passenger | — | — | `tokenizedCardSchema` |  | [app.ts:380](../../services/demo-api/src/app.ts#L380) |
| POST | `/payment-methods/:id/default` | passenger | — | — | — |  | [app.ts:396](../../services/demo-api/src/app.ts#L396) |
| DELETE | `/payment-methods/:id` | passenger | — | — | — |  | [app.ts:406](../../services/demo-api/src/app.ts#L406) |
| POST | `/rides` | passenger | — | required | `createRideSchema` |  | [app.ts:425](../../services/demo-api/src/app.ts#L425) |
| GET | `/rides/active` | passenger | — | — | — |  | [app.ts:430](../../services/demo-api/src/app.ts#L430) |
| GET | `/rides` | user (any role) | — | — | query `limit`, `cursor` |  | [app.ts:436](../../services/demo-api/src/app.ts#L436) |
| GET | `/rides/:id` | user (any role) | — | — | — |  | [app.ts:445](../../services/demo-api/src/app.ts#L445) |
| GET | `/rides/:id/cancellation-preview` | passenger | — | — | — |  | [app.ts:458](../../services/demo-api/src/app.ts#L458) |
| POST | `/rides/:id/cancel` | passenger | — | optional | `cancelSchema` |  | [app.ts:459](../../services/demo-api/src/app.ts#L459) |
| POST | `/rides/:id/retry-search` | passenger | — | — | — |  | [app.ts:464](../../services/demo-api/src/app.ts#L464) |
| POST | `/rides/:id/rating` | passenger | — | — | `ratingSchema` |  | [app.ts:465](../../services/demo-api/src/app.ts#L465) |
| POST | `/rides/:id/payment/retry` | passenger | — | required | raw JSON (not validated) |  | [app.ts:469](../../services/demo-api/src/app.ts#L469) |
| POST | `/scheduled` | passenger | — | required | `scheduleRideSchema` |  | [app.ts:476](../../services/demo-api/src/app.ts#L476) |
| GET | `/scheduled` | passenger | — | — | — |  | [app.ts:481](../../services/demo-api/src/app.ts#L481) |
| GET | `/scheduled/:id` | passenger | — | — | — |  | [app.ts:485](../../services/demo-api/src/app.ts#L485) |
| PATCH | `/scheduled/:id` | passenger | — | — | `modifyScheduledSchema` |  | [app.ts:490](../../services/demo-api/src/app.ts#L490) |
| POST | `/scheduled/:id/cancel` | passenger | — | — | `cancelSchema` |  | [app.ts:491](../../services/demo-api/src/app.ts#L491) |

## Driver

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/driver/status` | driver | — | — | — |  | [app.ts:533](../../services/demo-api/src/app.ts#L533) |
| POST | `/driver/online` | driver | — | — | `goOnlineSchema` |  | [app.ts:534](../../services/demo-api/src/app.ts#L534) |
| POST | `/driver/location` | driver | — | — | `locationUpdateSchema` |  | [app.ts:540](../../services/demo-api/src/app.ts#L540) |
| POST | `/driver/offers/:id/accept` | driver | — | optional | — |  | [app.ts:549](../../services/demo-api/src/app.ts#L549) |
| POST | `/driver/offers/:id/decline` | driver | — | — | `declineOfferSchema` |  | [app.ts:554](../../services/demo-api/src/app.ts#L554) |
| POST | `/driver/rides/:id/arrive` | driver | — | — | — |  | [app.ts:565](../../services/demo-api/src/app.ts#L565) |
| POST | `/driver/rides/:id/start` | driver | — | — | — |  | [app.ts:566](../../services/demo-api/src/app.ts#L566) |
| POST | `/driver/rides/:id/stop-complete` | driver | — | — | — |  | [app.ts:567](../../services/demo-api/src/app.ts#L567) |
| POST | `/driver/rides/:id/complete` | driver | — | — | — |  | [app.ts:568](../../services/demo-api/src/app.ts#L568) |
| POST | `/driver/rides/:id/cash-collected` | driver | — | — | `cashCollectedSchema` |  | [app.ts:569](../../services/demo-api/src/app.ts#L569) |
| POST | `/driver/rides/:id/cancel` | driver | — | — | `cancelSchema` |  | [app.ts:573](../../services/demo-api/src/app.ts#L573) |
| GET | `/driver/earnings` | driver | — | — | query `from`, `to` |  | [app.ts:577](../../services/demo-api/src/app.ts#L577) |
| GET | `/driver/wallet` | driver | — | — | — |  | [app.ts:581](../../services/demo-api/src/app.ts#L581) |
| GET | `/driver/ledger` | driver | — | — | query `type`, `limit`, `cursor` |  | [app.ts:592](../../services/demo-api/src/app.ts#L592) |
| GET | `/driver/ledger/:id` | driver | — | — | — |  | [app.ts:600](../../services/demo-api/src/app.ts#L600) |
| GET | `/driver/transfers` | driver | — | — | — |  | [app.ts:611](../../services/demo-api/src/app.ts#L611) |
| GET | `/payment-providers` | user (any role) | — | — | query `purpose` |  | [app.ts:619](../../services/demo-api/src/app.ts#L619) |
| POST | `/driver/recharges` | driver | — | required | `rechargeSchema` |  | [app.ts:625](../../services/demo-api/src/app.ts#L625) |
| GET | `/driver/recharges/:id` | driver | — | — | — |  | [app.ts:630](../../services/demo-api/src/app.ts#L630) |
| POST | `/driver/withdrawals` | driver | — | required | `withdrawalSchema` |  | [app.ts:634](../../services/demo-api/src/app.ts#L634) |
| GET | `/driver/withdrawals/:id` | driver | — | — | — |  | [app.ts:639](../../services/demo-api/src/app.ts#L639) |

## Payment provider sandbox and callbacks

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/provider-sandbox/:kind/:ref/:outcome` | signed in (user or admin) | — | — | — | dev mode only | [app.ts:653](../../services/demo-api/src/app.ts#L653) |
| POST | `/provider-sandbox/tokenize` | passenger | — | — | raw JSON (not validated) |  | [app.ts:668](../../services/demo-api/src/app.ts#L668) |
| POST | `/providers/:provider/callback` | provider (HMAC) | — | — | `providerCallbackSchema`; raw body, signed |  | [app.ts:675](../../services/demo-api/src/app.ts#L675) |

## Support (passenger and driver)

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/support/tickets` | user (any role) | — | — | — |  | [app.ts:683](../../services/demo-api/src/app.ts#L683) |
| POST | `/support/tickets` | user (any role) | — | — | `supportTicketSchema` |  | [app.ts:687](../../services/demo-api/src/app.ts#L687) |
| GET | `/support/tickets/:id` | user (any role) | — | — | — |  | [app.ts:688](../../services/demo-api/src/app.ts#L688) |
| POST | `/support/tickets/:id/messages` | user (any role) | — | — | `supportMessageSchema` |  | [app.ts:692](../../services/demo-api/src/app.ts#L692) |

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
| GET | `/prototype/catalog` | user (any role) | — | — | — |  | [services/prototype.ts:425](../../services/demo-api/src/services/prototype.ts#L425) |
| GET | `/prototype/wallet` | passenger | — | — | — |  | [services/prototype.ts:429](../../services/demo-api/src/services/prototype.ts#L429) |
| POST | `/prototype/wallet/topup` | passenger | — | required | inline zod |  | [services/prototype.ts:432](../../services/demo-api/src/services/prototype.ts#L432) |
| POST | `/prototype/wallet/:id/resolve` | passenger | — | — | inline zod | dev mode only | [services/prototype.ts:480](../../services/demo-api/src/services/prototype.ts#L480) |
| POST | `/prototype/sos` | user (any role) | — | required | inline zod |  | [services/prototype.ts:500](../../services/demo-api/src/services/prototype.ts#L500) |
| GET | `/prototype/sos` | user (any role) | — | — | — |  | [services/prototype.ts:557](../../services/demo-api/src/services/prototype.ts#L557) |
| POST | `/prototype/sos/:id/action` | user (any role) | — | — | inline zod |  | [services/prototype.ts:563](../../services/demo-api/src/services/prototype.ts#L563) |

## Admin sign-in

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/admin/auth/login` | public | — | — | `adminLoginSchema` |  | [app.ts:695](../../services/demo-api/src/app.ts#L695) |
| GET | `/admin/me` | admin | — | — | — |  | [app.ts:699](../../services/demo-api/src/app.ts#L699) |

## Admin: Oct 6 features ("prototype")

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/admin/prototype` | admin | `config.edit` | — | — |  | [services/prototype.ts:581](../../services/demo-api/src/services/prototype.ts#L581) |
| PUT | `/admin/prototype/catalog/:kind` | admin | `config.edit` | — | schema picked at runtime |  | [services/prototype.ts:597](../../services/demo-api/src/services/prototype.ts#L597) |
| GET | `/admin/prototype/alerts` | admin | `safety.respond` or `config.edit` (`canRespondToSafety`) | — | — |  | [services/prototype.ts:633](../../services/demo-api/src/services/prototype.ts#L633) |
| POST | `/admin/prototype/alerts/:id` | admin | `safety.respond` or `config.edit` (`canRespondToSafety`) | — | inline zod |  | [services/prototype.ts:650](../../services/demo-api/src/services/prototype.ts#L650) |
| POST | `/admin/prototype/assignment/:id` | admin | `config.edit` | — | inline zod |  | [services/prototype.ts:706](../../services/demo-api/src/services/prototype.ts#L706) |
| POST | `/admin/prototype/driver-categories/:id` | admin | `config.edit` | — | inline zod |  | [services/prototype.ts:756](../../services/demo-api/src/services/prototype.ts#L756) |

## Admin

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/admin/overview` | admin | — | — | query `cityId`, `period` |  | [app.ts:707](../../services/demo-api/src/app.ts#L707) |
| GET | `/admin/people` | admin | `people.read` | — | query `q`, `role`, `cityId`, `verification`, `limit`, `cursor` |  | [app.ts:735](../../services/demo-api/src/app.ts#L735) |
| GET | `/admin/people/:id` | admin | `people.read`; inline: `finance.read` | — | — |  | [app.ts:756](../../services/demo-api/src/app.ts#L756) |
| GET | `/admin/verifications` | admin | `people.read` | — | query `status`, `subject`, `cityId`, `limit`, `cursor` |  | [app.ts:776](../../services/demo-api/src/app.ts#L776) |
| GET | `/admin/verifications/:id` | admin | `people.read`; inline: `verification.decide` | — | — |  | [app.ts:791](../../services/demo-api/src/app.ts#L791) |
| POST | `/admin/verifications/:id/start-review` | admin | `verification.decide` | — | — |  | [app.ts:807](../../services/demo-api/src/app.ts#L807) |
| POST | `/admin/verifications/:id/decision` | admin | `verification.decide` | — | `decisionSchema` |  | [app.ts:808](../../services/demo-api/src/app.ts#L808) |
| GET | `/admin/rides` | admin | `rides.read` | — | query `q`, `status`, `cityId`, `method`, `sort`, `limit`, `cursor` |  | [app.ts:810](../../services/demo-api/src/app.ts#L810) |
| GET | `/admin/car-wash/orders` | admin | `rides.read` | — | query `cityId` |  | [app.ts:829](../../services/demo-api/src/app.ts#L829) |
| GET | `/admin/scheduled` | admin | `rides.read` | — | query `cityId` |  | [app.ts:833](../../services/demo-api/src/app.ts#L833) |
| GET | `/admin/rides/:id` | admin | `rides.read`; inline: `finance.read` | — | — |  | [app.ts:840](../../services/demo-api/src/app.ts#L840) |
| GET | `/admin/support` | admin | `support.resolve` | — | query `status`, `cityId`, `disputes`, `limit`, `cursor` |  | [app.ts:858](../../services/demo-api/src/app.ts#L858) |
| GET | `/admin/support/:id` | admin | `support.resolve` | — | — |  | [app.ts:871](../../services/demo-api/src/app.ts#L871) |
| POST | `/admin/support/:id/messages` | admin | `support.resolve` | — | `supportMessageSchema` |  | [app.ts:878](../../services/demo-api/src/app.ts#L878) |
| POST | `/admin/support/:id/resolve` | admin | `support.resolve` | — | `resolveTicketSchema` |  | [app.ts:879](../../services/demo-api/src/app.ts#L879) |
| GET | `/admin/finance/summary` | admin | `finance.read` | — | query `cityId` |  | [app.ts:881](../../services/demo-api/src/app.ts#L881) |
| GET | `/admin/finance/ledger` | admin | `finance.read` | — | query `driverId`, `type`, `cityId`, `limit`, `cursor` |  | [app.ts:903](../../services/demo-api/src/app.ts#L903) |
| POST | `/admin/finance/corrections` | admin | `finance.correct` | required | `correctionSchema` |  | [app.ts:916](../../services/demo-api/src/app.ts#L916) |
| GET | `/admin/cities` | admin | — | — | — |  | [app.ts:924](../../services/demo-api/src/app.ts#L924) |
| POST | `/admin/cities` | admin | `config.edit` | — | `createCitySchema` |  | [app.ts:929](../../services/demo-api/src/app.ts#L929) |
| PUT | `/admin/cities/:id/rules` | admin | `config.edit` | — | `updateRulesSchema` |  | [app.ts:930](../../services/demo-api/src/app.ts#L930) |
| POST | `/admin/cities/:id/status` | admin | `config.edit` | — | `cityStatusSchema` |  | [app.ts:931](../../services/demo-api/src/app.ts#L931) |
| POST | `/admin/cities/:id/zones` | admin | `config.edit` | — | `zoneSchema` |  | [app.ts:932](../../services/demo-api/src/app.ts#L932) |
| POST | `/admin/zones/:id/active` | admin | `config.edit` | — | `reasonSchema`; raw JSON (not validated) |  | [app.ts:933](../../services/demo-api/src/app.ts#L933) |
| GET | `/admin/providers` | admin | — | — | query `cityId` |  | [app.ts:937](../../services/demo-api/src/app.ts#L937) |
| POST | `/admin/providers/:id` | admin | `config.edit` | — | `providerToggleSchema` |  | [app.ts:942](../../services/demo-api/src/app.ts#L942) |
| GET | `/admin/audit` | admin | `audit.read` | — | query `q`, `action`, `cityId`, `actorType`, `limit`, `cursor` |  | [app.ts:944](../../services/demo-api/src/app.ts#L944) |

## Development tools

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/dev/scenarios` | public | — | — | — | dev mode only | [app.ts:961](../../services/demo-api/src/app.ts#L961) |
| POST | `/dev/reset` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:962](../../services/demo-api/src/app.ts#L962) |
| POST | `/dev/clock/advance` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:971](../../services/demo-api/src/app.ts#L971) |
| POST | `/dev/tick` | public | — | — | — | dev mode only | [app.ts:977](../../services/demo-api/src/app.ts#L977) |
| POST | `/dev/providers/:kind/:ref/:outcome` | public | — | — | — | dev mode only | [app.ts:981](../../services/demo-api/src/app.ts#L981) |
| POST | `/dev/bot` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:985](../../services/demo-api/src/app.ts#L985) |
| POST | `/dev/tracking/:rideId/freeze` | public | — | — | — | dev mode only | [app.ts:999](../../services/demo-api/src/app.ts#L999) |
| POST | `/dev/tracking/:rideId/resume` | public | — | — | — | dev mode only | [app.ts:1008](../../services/demo-api/src/app.ts#L1008) |
| GET | `/dev/provider-jobs` | public | — | — | — | dev mode only | [app.ts:1016](../../services/demo-api/src/app.ts#L1016) |
| POST | `/dev/navigate` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:1023](../../services/demo-api/src/app.ts#L1023) |
| GET | `/dev/navigate` | public | — | — | query `app` | dev mode only | [app.ts:1029](../../services/demo-api/src/app.ts#L1029) |
| POST | `/dev/verification/:id/simulate` | driver | — | — | `verificationItemKeySchema`; raw JSON (not validated) | dev mode only | [app.ts:1057](../../services/demo-api/src/app.ts#L1057) |
| POST | `/dev/sample-upload` | user (any role) | — | — | raw JSON (not validated) | dev mode only | [app.ts:1064](../../services/demo-api/src/app.ts#L1064) |
| POST | `/dev/family/play` | user (any role) | — | — | `familyDemoSchema` | dev mode only | [services/famille.ts:805](../../services/demo-api/src/services/famille.ts#L805) |
| POST | `/dev/family/trips/:id/demo` | user (any role) | — | — | `familyDemoSchema` | dev mode only | [services/famille.ts:817](../../services/demo-api/src/services/famille.ts#L817) |

## Other

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/car-wash/catalog` | user (any role) | — | — | query `cityId` |  | [app.ts:497](../../services/demo-api/src/app.ts#L497) |
| GET | `/car-wash/payment-options` | user (any role) | — | — | query `cityId` |  | [app.ts:501](../../services/demo-api/src/app.ts#L501) |
| POST | `/car-wash/orders` | user (any role) | — | required | `createWashOrderSchema` |  | [app.ts:505](../../services/demo-api/src/app.ts#L505) |
| GET | `/car-wash/orders` | user (any role) | — | — | — |  | [app.ts:510](../../services/demo-api/src/app.ts#L510) |
| GET | `/car-wash/orders/:id` | user (any role) | — | — | — |  | [app.ts:515](../../services/demo-api/src/app.ts#L515) |
| GET | `/car-wash/orders/:id/cancellation-preview` | user (any role) | — | — | — |  | [app.ts:521](../../services/demo-api/src/app.ts#L521) |
| POST | `/car-wash/orders/:id/cancel` | user (any role) | — | optional | `cancelSchema` |  | [app.ts:522](../../services/demo-api/src/app.ts#L522) |
| POST | `/car-wash/orders/:id/rating` | user (any role) | — | — | `ratingSchema` |  | [app.ts:527](../../services/demo-api/src/app.ts#L527) |

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
