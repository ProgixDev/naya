<!-- GENERATED FILE: do not edit by hand. Run `node scripts/docs/gen-api-reference.mjs`. -->

# Demo API reference

Generated — run `node scripts/docs/gen-api-reference.mjs` after you add, remove or change a route, and commit the result.
`node scripts/docs/gen-api-reference.mjs --check` exits 1 when this file no longer matches the code.
Last verified: whenever the check above passes. Owner: whoever changes a route.

Every HTTP route of `services/demo-api`, read from its Hono registrations in
[app.ts](../../services/demo-api/src/app.ts) and [services/prototype.ts](../../services/demo-api/src/services/prototype.ts).
The same app serves the Node server on :4010, the in-process demo inside native standalone builds and the tests
(see [runtime-modes.md](runtime-modes.md)). Request and response types live in `packages/api/src/client.ts`;
schemas in `packages/domain/src/schemas.ts`, except the Oct 6 feature schemas (`childSchema`, `categorySchema`…),
which are local to `services/prototype.ts`. Who may call what, and why: [permissions.md](permissions.md).

## Summary

| | Routes |
|---|---|
| All | 130 (GET 53, POST 68, PATCH 2, DELETE 2, PUT 5) |
| Caller: public | 21 |
| Caller: user (any role) | 24 |
| Caller: passenger | 26 |
| Caller: driver | 22 |
| Caller: admin | 33 |
| Caller: signed in (user or admin) | 3 |
| Caller: provider (HMAC) | 1 |
| Admin routes with a permission check | 29 of 33 |
| Idempotency-Key required | 10 |
| Idempotency-Key optional (honoured when sent) | 2 |
| Registered only in dev mode | 12 |
| Body read without validation | 9 |

## Global behaviour

- `app.use('*')` at [app.ts:202](../../services/demo-api/src/app.ts#L202) — only when `!options.embedded`.
- `app.use('*')` at [app.ts:203](../../services/demo-api/src/app.ts#L203).
- `app.onError` at [app.ts:210](../../services/demo-api/src/app.ts#L210).
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
| GET | `/health` | public | — | — | — |  | [app.ts:225](../../services/demo-api/src/app.ts#L225) |
| GET | `/sync` | public | — | — | — |  | [app.ts:226](../../services/demo-api/src/app.ts#L226) |

## Mobile sign-in

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/auth/otp/request` | public | — | — | `otpRequestSchema` |  | [app.ts:229](../../services/demo-api/src/app.ts#L229) |
| POST | `/auth/otp/verify` | public | — | — | `otpVerifySchema` |  | [app.ts:233](../../services/demo-api/src/app.ts#L233) |
| POST | `/auth/logout` | public | — | — | — |  | [app.ts:238](../../services/demo-api/src/app.ts#L238) |
| GET | `/auth/providers` | public | — | — | — |  | [app.ts:242](../../services/demo-api/src/app.ts#L242) |

## Profile

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/me` | user (any role) | — | — | — |  | [app.ts:252](../../services/demo-api/src/app.ts#L252) |
| PATCH | `/me` | user (any role) | — | — | `profileUpdateSchema` |  | [app.ts:257](../../services/demo-api/src/app.ts#L257) |
| POST | `/me/places` | passenger | — | — | `savedPlaceSchema` |  | [app.ts:272](../../services/demo-api/src/app.ts#L272) |
| DELETE | `/me/places/:id` | passenger | — | — | — |  | [app.ts:285](../../services/demo-api/src/app.ts#L285) |

## Uploads and verification

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/uploads` | user (any role) | — | — | `uploadSchema` |  | [app.ts:297](../../services/demo-api/src/app.ts#L297) |
| GET | `/uploads/:id/preview` | signed in (user or admin) | inline: `config.edit`, `support.resolve`, `verification.decide` | — | — |  | [app.ts:302](../../services/demo-api/src/app.ts#L302) |
| GET | `/uploads/:id` | signed in (user or admin) | inline: `config.edit`, `support.resolve`, `verification.decide` | — | — |  | [app.ts:307](../../services/demo-api/src/app.ts#L307) |
| GET | `/verification` | user (any role) | — | — | — |  | [app.ts:313](../../services/demo-api/src/app.ts#L313) |
| POST | `/verification/vehicle` | driver | — | — | — |  | [app.ts:317](../../services/demo-api/src/app.ts#L317) |
| PUT | `/verification/:id/identity` | user (any role) | — | — | `identityDetailsSchema` |  | [app.ts:318](../../services/demo-api/src/app.ts#L318) |
| PUT | `/verification/:id/vehicle` | driver | — | — | `vehicleDetailsSchema` |  | [app.ts:319](../../services/demo-api/src/app.ts#L319) |
| PUT | `/verification/:id/items/:key` | user (any role) | — | — | raw JSON (not validated) |  | [app.ts:320](../../services/demo-api/src/app.ts#L320) |
| POST | `/verification/:id/submit` | user (any role) | — | — | — |  | [app.ts:325](../../services/demo-api/src/app.ts#L325) |
| POST | `/verification/:id/reopen` | user (any role) | — | — | — |  | [app.ts:326](../../services/demo-api/src/app.ts#L326) |

## Cities and places

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/cities` | public | — | — | — |  | [app.ts:329](../../services/demo-api/src/app.ts#L329) |
| GET | `/places/search` | public | — | — | query `q`, `cityId` |  | [app.ts:333](../../services/demo-api/src/app.ts#L333) |
| GET | `/places/reverse` | public | — | — | query `lat`, `lng` |  | [app.ts:343](../../services/demo-api/src/app.ts#L343) |

## Passenger: quotes, payment methods, rides, scheduled rides

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/quotes` | passenger | — | — | `quoteRequestSchema` |  | [app.ts:353](../../services/demo-api/src/app.ts#L353) |
| GET | `/payment-methods` | passenger | — | — | — |  | [app.ts:357](../../services/demo-api/src/app.ts#L357) |
| POST | `/payment-methods/card` | passenger | — | — | `tokenizedCardSchema` |  | [app.ts:365](../../services/demo-api/src/app.ts#L365) |
| POST | `/payment-methods/:id/default` | passenger | — | — | — |  | [app.ts:381](../../services/demo-api/src/app.ts#L381) |
| DELETE | `/payment-methods/:id` | passenger | — | — | — |  | [app.ts:391](../../services/demo-api/src/app.ts#L391) |
| POST | `/rides` | passenger | — | required | `createRideSchema` |  | [app.ts:410](../../services/demo-api/src/app.ts#L410) |
| GET | `/rides/active` | passenger | — | — | — |  | [app.ts:415](../../services/demo-api/src/app.ts#L415) |
| GET | `/rides` | user (any role) | — | — | query `limit`, `cursor` |  | [app.ts:421](../../services/demo-api/src/app.ts#L421) |
| GET | `/rides/:id` | user (any role) | — | — | — |  | [app.ts:430](../../services/demo-api/src/app.ts#L430) |
| GET | `/rides/:id/cancellation-preview` | passenger | — | — | — |  | [app.ts:443](../../services/demo-api/src/app.ts#L443) |
| POST | `/rides/:id/cancel` | passenger | — | optional | `cancelSchema` |  | [app.ts:444](../../services/demo-api/src/app.ts#L444) |
| POST | `/rides/:id/retry-search` | passenger | — | — | — |  | [app.ts:449](../../services/demo-api/src/app.ts#L449) |
| POST | `/rides/:id/rating` | passenger | — | — | `ratingSchema` |  | [app.ts:450](../../services/demo-api/src/app.ts#L450) |
| POST | `/rides/:id/payment/retry` | passenger | — | required | raw JSON (not validated) |  | [app.ts:454](../../services/demo-api/src/app.ts#L454) |
| POST | `/scheduled` | passenger | — | required | `scheduleRideSchema` |  | [app.ts:461](../../services/demo-api/src/app.ts#L461) |
| GET | `/scheduled` | passenger | — | — | — |  | [app.ts:466](../../services/demo-api/src/app.ts#L466) |
| GET | `/scheduled/:id` | passenger | — | — | — |  | [app.ts:470](../../services/demo-api/src/app.ts#L470) |
| PATCH | `/scheduled/:id` | passenger | — | — | `modifyScheduledSchema` |  | [app.ts:475](../../services/demo-api/src/app.ts#L475) |
| POST | `/scheduled/:id/cancel` | passenger | — | — | `cancelSchema` |  | [app.ts:476](../../services/demo-api/src/app.ts#L476) |

## Driver

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/driver/status` | driver | — | — | — |  | [app.ts:482](../../services/demo-api/src/app.ts#L482) |
| POST | `/driver/online` | driver | — | — | `goOnlineSchema` |  | [app.ts:483](../../services/demo-api/src/app.ts#L483) |
| POST | `/driver/location` | driver | — | — | `locationUpdateSchema` |  | [app.ts:489](../../services/demo-api/src/app.ts#L489) |
| POST | `/driver/offers/:id/accept` | driver | — | optional | — |  | [app.ts:498](../../services/demo-api/src/app.ts#L498) |
| POST | `/driver/offers/:id/decline` | driver | — | — | `declineOfferSchema` |  | [app.ts:503](../../services/demo-api/src/app.ts#L503) |
| POST | `/driver/rides/:id/arrive` | driver | — | — | — |  | [app.ts:514](../../services/demo-api/src/app.ts#L514) |
| POST | `/driver/rides/:id/start` | driver | — | — | — |  | [app.ts:515](../../services/demo-api/src/app.ts#L515) |
| POST | `/driver/rides/:id/stop-complete` | driver | — | — | — |  | [app.ts:516](../../services/demo-api/src/app.ts#L516) |
| POST | `/driver/rides/:id/complete` | driver | — | — | — |  | [app.ts:517](../../services/demo-api/src/app.ts#L517) |
| POST | `/driver/rides/:id/cash-collected` | driver | — | — | `cashCollectedSchema` |  | [app.ts:518](../../services/demo-api/src/app.ts#L518) |
| POST | `/driver/rides/:id/cancel` | driver | — | — | `cancelSchema` |  | [app.ts:522](../../services/demo-api/src/app.ts#L522) |
| GET | `/driver/earnings` | driver | — | — | query `from`, `to` |  | [app.ts:526](../../services/demo-api/src/app.ts#L526) |
| GET | `/driver/wallet` | driver | — | — | — |  | [app.ts:530](../../services/demo-api/src/app.ts#L530) |
| GET | `/driver/ledger` | driver | — | — | query `type`, `limit`, `cursor` |  | [app.ts:541](../../services/demo-api/src/app.ts#L541) |
| GET | `/driver/ledger/:id` | driver | — | — | — |  | [app.ts:549](../../services/demo-api/src/app.ts#L549) |
| GET | `/driver/transfers` | driver | — | — | — |  | [app.ts:560](../../services/demo-api/src/app.ts#L560) |
| GET | `/payment-providers` | user (any role) | — | — | query `purpose` |  | [app.ts:568](../../services/demo-api/src/app.ts#L568) |
| POST | `/driver/recharges` | driver | — | required | `rechargeSchema` |  | [app.ts:574](../../services/demo-api/src/app.ts#L574) |
| GET | `/driver/recharges/:id` | driver | — | — | — |  | [app.ts:579](../../services/demo-api/src/app.ts#L579) |
| POST | `/driver/withdrawals` | driver | — | required | `withdrawalSchema` |  | [app.ts:583](../../services/demo-api/src/app.ts#L583) |
| GET | `/driver/withdrawals/:id` | driver | — | — | — |  | [app.ts:588](../../services/demo-api/src/app.ts#L588) |

## Payment provider sandbox and callbacks

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/provider-sandbox/:kind/:ref/:outcome` | signed in (user or admin) | — | — | — | dev-mode branch | [app.ts:598](../../services/demo-api/src/app.ts#L598) |
| POST | `/provider-sandbox/tokenize` | passenger | — | — | raw JSON (not validated) |  | [app.ts:613](../../services/demo-api/src/app.ts#L613) |
| POST | `/providers/:provider/callback` | provider (HMAC) | — | — | `providerCallbackSchema`; raw body, signed |  | [app.ts:620](../../services/demo-api/src/app.ts#L620) |

## Support (passenger and driver)

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/support/tickets` | user (any role) | — | — | — |  | [app.ts:628](../../services/demo-api/src/app.ts#L628) |
| POST | `/support/tickets` | user (any role) | — | — | `supportTicketSchema` |  | [app.ts:632](../../services/demo-api/src/app.ts#L632) |
| GET | `/support/tickets/:id` | user (any role) | — | — | — |  | [app.ts:633](../../services/demo-api/src/app.ts#L633) |
| POST | `/support/tickets/:id/messages` | user (any role) | — | — | `supportMessageSchema` |  | [app.ts:637](../../services/demo-api/src/app.ts#L637) |

## Oct 6 features ("prototype"): passenger and driver

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/prototype/catalog` | user (any role) | — | — | — |  | [services/prototype.ts:557](../../services/demo-api/src/services/prototype.ts#L557) |
| GET | `/prototype/wallet` | passenger | — | — | — |  | [services/prototype.ts:561](../../services/demo-api/src/services/prototype.ts#L561) |
| POST | `/prototype/wallet/topup` | passenger | — | required | inline zod |  | [services/prototype.ts:564](../../services/demo-api/src/services/prototype.ts#L564) |
| POST | `/prototype/wallet/:id/resolve` | passenger | — | — | inline zod |  | [services/prototype.ts:605](../../services/demo-api/src/services/prototype.ts#L605) |
| GET | `/prototype/family` | user (any role) | — | — | — |  | [services/prototype.ts:629](../../services/demo-api/src/services/prototype.ts#L629) |
| POST | `/prototype/family/children` | passenger | — | — | `childSchema` |  | [services/prototype.ts:632](../../services/demo-api/src/services/prototype.ts#L632) |
| POST | `/prototype/family/subscribe` | passenger | — | required | inline zod |  | [services/prototype.ts:644](../../services/demo-api/src/services/prototype.ts#L644) |
| POST | `/prototype/family/trips` | passenger | — | required | inline zod |  | [services/prototype.ts:653](../../services/demo-api/src/services/prototype.ts#L653) |
| POST | `/prototype/family/example` | user (any role) | — | — | — | 403 unless dev mode | [services/prototype.ts:672](../../services/demo-api/src/services/prototype.ts#L672) |
| POST | `/prototype/family/trips/:id/advance` | user (any role) | — | — | inline zod | dev-mode branch | [services/prototype.ts:741](../../services/demo-api/src/services/prototype.ts#L741) |
| POST | `/prototype/family/trips/:id/incident` | user (any role) | — | — | inline zod |  | [services/prototype.ts:896](../../services/demo-api/src/services/prototype.ts#L896) |
| POST | `/prototype/sos` | user (any role) | — | required | inline zod |  | [services/prototype.ts:921](../../services/demo-api/src/services/prototype.ts#L921) |
| GET | `/prototype/sos` | user (any role) | — | — | — |  | [services/prototype.ts:978](../../services/demo-api/src/services/prototype.ts#L978) |
| POST | `/prototype/sos/:id/action` | user (any role) | — | — | inline zod |  | [services/prototype.ts:984](../../services/demo-api/src/services/prototype.ts#L984) |

## Admin sign-in

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| POST | `/admin/auth/login` | public | — | — | `adminLoginSchema` |  | [app.ts:640](../../services/demo-api/src/app.ts#L640) |
| GET | `/admin/me` | admin | — | — | — |  | [app.ts:644](../../services/demo-api/src/app.ts#L644) |

## Admin: Oct 6 features ("prototype")

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/admin/prototype` | admin | `config.edit` | — | — |  | [services/prototype.ts:1008](../../services/demo-api/src/services/prototype.ts#L1008) |
| PUT | `/admin/prototype/catalog/:kind` | admin | `config.edit` | — | schema picked at runtime |  | [services/prototype.ts:1021](../../services/demo-api/src/services/prototype.ts#L1021) |
| GET | `/admin/prototype/alerts` | admin | `safety.respond` or `config.edit` (`canRespondToSafety`) | — | — |  | [services/prototype.ts:1057](../../services/demo-api/src/services/prototype.ts#L1057) |
| POST | `/admin/prototype/alerts/:id` | admin | `safety.respond` or `config.edit` (`canRespondToSafety`) | — | inline zod |  | [services/prototype.ts:1074](../../services/demo-api/src/services/prototype.ts#L1074) |
| POST | `/admin/prototype/assignment/:id` | admin | `config.edit` | — | inline zod |  | [services/prototype.ts:1130](../../services/demo-api/src/services/prototype.ts#L1130) |
| POST | `/admin/prototype/driver-categories/:id` | admin | `config.edit` | — | inline zod |  | [services/prototype.ts:1180](../../services/demo-api/src/services/prototype.ts#L1180) |

## Admin

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/admin/overview` | admin | — | — | query `cityId`, `period` |  | [app.ts:652](../../services/demo-api/src/app.ts#L652) |
| GET | `/admin/people` | admin | `people.read` | — | query `q`, `role`, `cityId`, `verification`, `limit`, `cursor` |  | [app.ts:680](../../services/demo-api/src/app.ts#L680) |
| GET | `/admin/people/:id` | admin | `people.read`; inline: `finance.read` | — | — |  | [app.ts:700](../../services/demo-api/src/app.ts#L700) |
| GET | `/admin/verifications` | admin | `people.read` | — | query `status`, `subject`, `cityId`, `limit`, `cursor` |  | [app.ts:720](../../services/demo-api/src/app.ts#L720) |
| GET | `/admin/verifications/:id` | admin | `people.read`; inline: `verification.decide` | — | — |  | [app.ts:735](../../services/demo-api/src/app.ts#L735) |
| POST | `/admin/verifications/:id/start-review` | admin | `verification.decide` | — | — |  | [app.ts:751](../../services/demo-api/src/app.ts#L751) |
| POST | `/admin/verifications/:id/decision` | admin | `verification.decide` | — | `decisionSchema` |  | [app.ts:752](../../services/demo-api/src/app.ts#L752) |
| GET | `/admin/rides` | admin | `rides.read` | — | query `q`, `status`, `cityId`, `method`, `sort`, `limit`, `cursor` |  | [app.ts:754](../../services/demo-api/src/app.ts#L754) |
| GET | `/admin/scheduled` | admin | `rides.read` | — | query `cityId` |  | [app.ts:773](../../services/demo-api/src/app.ts#L773) |
| GET | `/admin/rides/:id` | admin | `rides.read`; inline: `finance.read` | — | — |  | [app.ts:780](../../services/demo-api/src/app.ts#L780) |
| GET | `/admin/support` | admin | `support.resolve` | — | query `status`, `cityId`, `disputes`, `limit`, `cursor` |  | [app.ts:798](../../services/demo-api/src/app.ts#L798) |
| GET | `/admin/support/:id` | admin | `support.resolve` | — | — |  | [app.ts:811](../../services/demo-api/src/app.ts#L811) |
| POST | `/admin/support/:id/messages` | admin | `support.resolve` | — | `supportMessageSchema` |  | [app.ts:818](../../services/demo-api/src/app.ts#L818) |
| POST | `/admin/support/:id/resolve` | admin | `support.resolve` | — | `resolveTicketSchema` |  | [app.ts:819](../../services/demo-api/src/app.ts#L819) |
| GET | `/admin/finance/summary` | admin | `finance.read` | — | query `cityId` |  | [app.ts:821](../../services/demo-api/src/app.ts#L821) |
| GET | `/admin/finance/ledger` | admin | `finance.read` | — | query `driverId`, `type`, `cityId`, `limit`, `cursor` |  | [app.ts:843](../../services/demo-api/src/app.ts#L843) |
| POST | `/admin/finance/corrections` | admin | `finance.correct` | required | `correctionSchema` |  | [app.ts:856](../../services/demo-api/src/app.ts#L856) |
| GET | `/admin/cities` | admin | — | — | — |  | [app.ts:864](../../services/demo-api/src/app.ts#L864) |
| POST | `/admin/cities` | admin | `config.edit` | — | `createCitySchema` |  | [app.ts:869](../../services/demo-api/src/app.ts#L869) |
| PUT | `/admin/cities/:id/rules` | admin | `config.edit` | — | `updateRulesSchema` |  | [app.ts:870](../../services/demo-api/src/app.ts#L870) |
| POST | `/admin/cities/:id/status` | admin | `config.edit` | — | `cityStatusSchema` |  | [app.ts:871](../../services/demo-api/src/app.ts#L871) |
| POST | `/admin/cities/:id/zones` | admin | `config.edit` | — | `zoneSchema` |  | [app.ts:872](../../services/demo-api/src/app.ts#L872) |
| POST | `/admin/zones/:id/active` | admin | `config.edit` | — | `reasonSchema`; raw JSON (not validated) |  | [app.ts:873](../../services/demo-api/src/app.ts#L873) |
| GET | `/admin/providers` | admin | — | — | query `cityId` |  | [app.ts:877](../../services/demo-api/src/app.ts#L877) |
| POST | `/admin/providers/:id` | admin | `config.edit` | — | `providerToggleSchema` |  | [app.ts:882](../../services/demo-api/src/app.ts#L882) |
| GET | `/admin/audit` | admin | `audit.read` | — | query `q`, `action`, `cityId`, `actorType`, `limit`, `cursor` |  | [app.ts:884](../../services/demo-api/src/app.ts#L884) |

## Development tools

| Method | Path | Caller | Permission | Idempotency-Key | Input | Notes | Source |
|---|---|---|---|---|---|---|---|
| GET | `/dev/scenarios` | public | — | — | — | dev mode only | [app.ts:901](../../services/demo-api/src/app.ts#L901) |
| POST | `/dev/reset` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:902](../../services/demo-api/src/app.ts#L902) |
| POST | `/dev/clock/advance` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:911](../../services/demo-api/src/app.ts#L911) |
| POST | `/dev/tick` | public | — | — | — | dev mode only | [app.ts:917](../../services/demo-api/src/app.ts#L917) |
| POST | `/dev/providers/:kind/:ref/:outcome` | public | — | — | — | dev mode only | [app.ts:921](../../services/demo-api/src/app.ts#L921) |
| POST | `/dev/bot` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:925](../../services/demo-api/src/app.ts#L925) |
| POST | `/dev/tracking/:rideId/freeze` | public | — | — | — | dev mode only | [app.ts:939](../../services/demo-api/src/app.ts#L939) |
| POST | `/dev/tracking/:rideId/resume` | public | — | — | — | dev mode only | [app.ts:948](../../services/demo-api/src/app.ts#L948) |
| GET | `/dev/provider-jobs` | public | — | — | — | dev mode only | [app.ts:956](../../services/demo-api/src/app.ts#L956) |
| POST | `/dev/navigate` | public | — | — | raw JSON (not validated) | dev mode only | [app.ts:963](../../services/demo-api/src/app.ts#L963) |
| GET | `/dev/navigate` | public | — | — | query `app` | dev mode only | [app.ts:969](../../services/demo-api/src/app.ts#L969) |
| POST | `/dev/sample-upload` | user (any role) | — | — | raw JSON (not validated) | dev mode only | [app.ts:984](../../services/demo-api/src/app.ts#L984) |

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
| `rides.read` | GET `/admin/rides`<br>GET `/admin/scheduled`<br>GET `/admin/rides/:id` | — |
| `audit.read` | GET `/admin/audit` | — |
| `people.read` | GET `/admin/people`<br>GET `/admin/people/:id`<br>GET `/admin/verifications`<br>GET `/admin/verifications/:id` | — |
| (no permission: any signed-in admin) | GET `/admin/me`<br>GET `/admin/overview`<br>GET `/admin/cities`<br>GET `/admin/providers` | |
