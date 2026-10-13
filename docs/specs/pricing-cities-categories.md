---
title: "Pricing, cities and service categories"
status: Current
owner: Achraf
last_verified: 2026-10-13 @ c38429d + branch chore/docs-foundation-and-fixes
related: [ADR-0003, ADR-0005, ADR-0006, ADR-0026, ADR-0033, ADR-0043, ADR-0054, P8, P12, P17, DOM-01, ADM-04, ADM-05, ADM-06, ADM-09, API-08, API-09, PAX-05, PAX-08, PRD-16, PRD-17, PRD-26, PRD-40, docs/FINANCE.md, specs/payments-and-fees.md]
---

# Pricing, cities and service categories

**Status marks:** ✅ matches intent · ⚠️ known defect (backlog ID) · ❓ open (Proposed ADR). See [_template.md](_template.md).

## Purpose

How Naya prices a ride: the fare formula, the rules each city configures, the service categories (Naya Scooter,
Naya Standard, Naya Confort) that change the fare and the commission, and how a quote is frozen into a booking.
What happens to the money after the ride (payment, cancellation fees, wallets) is in
[payments-and-fees.md](payments-and-fees.md). The worked fare fixtures (Rabat 100 MAD, Casablanca 107 MAD, ×1,2) live
in [FINANCE.md](../FINANCE.md#fare); this spec links them instead of copying them.

Every amount here is a configurable demo business rule, not a live price ([FINANCE.md](../FINANCE.md):3).

## Actors

| Actor | Surface | Role in this area |
|---|---|---|
| Passagère | Passenger app, `apps/passenger/src/app/(app)/quote.tsx` | Picks a category, reads the quote, books it now or for later |
| Chauffeuse | Driver app, offer screen | Receives offers only for the categories she may serve; sees fare, commission and net on each offer |
| Admin with `config.edit` | apps/admin `/villes`, `/villes/:id/regles`, `/services` | Creates cities and zones, changes city rules, edits the category catalog and each driver's categories |
| Demo API | `services/demo-api/src/services/rides.ts` | The only component that prices; it freezes the terms at booking |

## Rules

Line numbers are at commit `c38429d`.

### Money and the fare formula

**R1 · Amounts are integer centimes, rates are integer basis points, and every derived amount is rounded half away
from zero once, where it is derived.** ✅

- Enforced at: `packages/domain/src/money.ts:25-44` (`divRound`, `applyBp`). [ADR-0003](../adr/0003-money-as-integer-centimes-and-basis-points.md).
- Tested by: `packages/domain/test/money.test.ts:5` "rounds half away from zero, exactly".
- Gap: `mad()` rounds a float with `Math.round` (`packages/domain/src/money.ts:19-23`). It only builds literal
  amounts (city defaults, tests). Low-severity finding "Minor money helper inconsistencies" in the
  [audit findings](../audits/2026-10-13-full-audit-findings.md#domain).

**R2 · Fare = max(base + perKm·km + perMinute·min, minimum) × multiplier.** ✅

The distance and time components are each rounded to the centime, the minimum applies before the multiplier, and the
quote discloses the surcharge separately (`dynamicSurcharge = total − amount before multiplier`). A multiplier below
×1 is refused.

- Enforced at: `packages/domain/src/pricing.ts:10-36` (`computeFare`; ×1 floor at `:18`).
- Tested by: `packages/domain/test/pricing.test.ts:5`, `:8`, `:14`, `:18` (the [FINANCE.md](../FINANCE.md#fare) fixtures).

**R3 · Commission = applyBp(total, commissionBp) on the frozen total; driver net = total − commission.** ✅

- Enforced at: `packages/domain/src/pricing.ts:44-47` (`splitFare`); used for the offer at
  `services/demo-api/src/services/rides.ts:268-281` and for settlement (see [payments-and-fees.md](payments-and-fees.md)).
- Tested by: `packages/domain/test/pricing.test.ts:25`; `services/demo-api/test/scenarios.test.ts:118` (S03, net 85 MAD).
- Which commission applies is R17.

**R4 · The server computes the route used for pricing; the client sends only the stops (2 to 4).** ✅

- Enforced at: `packages/domain/src/schemas.ts:90-94` (`quoteRequestSchema`), `services/demo-api/src/services/rides.ts:81`
  (`demoRoute`, see Demo vs live).
- Tested by: `packages/domain/test/pricing.test.ts:29` (demo route Gare → Agdal → Hay Riad is 10 km / 25 min).

### City rules

**R5 · Each city has one current rule set and a version number. Every field is validated against fixed bounds.** ✅

Defaults: `packages/domain/src/cities.ts:5-30` (fares, commission and debt limit in [FINANCE.md](../FINANCE.md#fare);
both cities also use a 120 s free cancellation window, 10 MAD after it, 15 MAD after arrival, 30 s offers, 120 s
search, 600 s quotes and a 20 MAD minimum withdrawal).

| Field | Accepted values |
|---|---|
| `baseFare`, `perKm`, `perMinute`, `minimumFare`, `debtLimit`, `minimumWithdrawal`, cancellation fees | Integer centimes ≥ 0 |
| `commissionBp` | 0 to 5 000 (0 to 50 %) |
| `dynamic.multiplierBp` | 10 000 to 30 000 (×1 to ×3), with a reason of at most 160 characters |
| `cancellation.graceSeconds` | 0 to 1 800 |
| `offerTimeoutSeconds` | 10 to 120 |
| `searchTimeoutSeconds` | 30 to 900 |
| `quoteValiditySeconds` | 60 to 3 600 |
| `scheduling` | `minLeadMinutes` ≥ 10, `maxDaysAhead` 1 to 60, `modifyCutoffMinutes` ≥ 0 |

- Enforced at: `packages/domain/src/schemas.ts:153-167` (`cityRulesSchema`); types at `packages/domain/src/entities.ts:173-202`.
- Tested by: **not tested** (no test exercises the bounds).
- Gap: a `debtLimit` of 0 blocks every driver whose balance is 0 (see [payments-and-fees.md](payments-and-fees.md) R26).

**R6 · Changing a city's rules needs `config.edit`, a reason of at least 10 characters and the current version. It
creates version n+1, keeps the old version, and writes an audit entry with before and after.** ✅ ⚠️

A stale version gets `CONFLICT`. A change the server's diff does not see is refused with « Aucune modification à
enregistrer. ». That diff ignores `searchTimeoutSeconds`, `quoteValiditySeconds`, `scheduling` and the dynamic
reason, so a change to only those fields cannot be saved (checked on 2026-10-13 with an in-memory demo API), although
the admin Rules page lets the admin edit three of them (search timeout, scheduling lead and cutoff, dynamic reason)
and lists them as pending changes (the reason only while dynamic pricing is on). Mixed with other changes, they are
saved but left out of the audit summary (before and after are complete).

- Enforced at: `services/demo-api/src/services/cities.ts:78-107` (`updateRules`), `:22-40` (`diffRules`);
  `packages/domain/src/schemas.ts:169-171`; `apps/admin/src/pages/Rules.tsx:86-104` (the page's own diff), `:131`,
  `:270`. [ADR-0006](../adr/0006-admin-changes-are-governed.md).
- Tested by: `services/demo-api/test/scenarios.test.ts:249` (S06, reason and version); `:225` (audit entries at
  `:244-246`); `e2e/tests/admin-operations.spec.ts:26` (S15 in the admin, saves v2 with a reason at `:39-43`). The
  ignored fields are **not tested**.
- Gap: the ignored fields are not in the backlog yet (found while writing this spec).

**R7 · Dynamic pricing is a per-city multiplier that an admin switches on, with a French reason. While it is on,
every quote in that city carries the multiplier and the reason, and the passenger sees it before confirming.** ✅

There is no automatic surge. The quote screen shows « Demande élevée ×1,2 » and the price without the surcharge.

- Enforced at: `services/demo-api/src/services/rides.ts:82`, `:95`; `apps/passenger/src/app/(app)/quote.tsx:167-176`.
- Tested by: `services/demo-api/test/scenarios.test.ts:225` (S06); `packages/domain/test/pricing.test.ts:8`.

**R8 · A city's status gates quoting and booking: `active` for everyone, `test` only for testers
(`user.testerCities`), `inactive` for nobody (`CITY_INACTIVE`). The same rule decides whether a driver of that city
can go online.** ✅

The status is checked again at booking, so a city switched off after the quote refuses the booking. A status change
needs a reason and is audited.

- Enforced at: `services/demo-api/src/services/rides.ts:55-62` (`bookableCity`), `:112`, `:222-225`;
  `services/demo-api/src/services/cities.ts:109-121` (`setCityStatus`).
- Tested by: `services/demo-api/test/scenarios.test.ts:529` (S15: a non-tester gets `CITY_INACTIVE` at `:540`).

**R9 · Every stop must lie inside an active service zone of the city, or the quote is refused with `OUT_OF_ZONE`
and the index of the stop.** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:73-78`; `packages/domain/src/geo.ts:25` (`isInService`).
- Tested by: `services/demo-api/test/scenarios.test.ts:259` (S07).

### Quotes and frozen terms

**R10 · Only the server prices. A quote records the city, the currency (MAD), the city rule version, the route, the
fare breakdown, the conditions (cancellation policy, dynamic multiplier, city status) and an expiry of
`quoteValiditySeconds` (600 s by default).** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:70-106` (`createQuote`); `packages/domain/src/entities.ts:257-276`.
  [ADR-0005](../adr/0005-server-authoritative-pricing-with-versioned-city-rules.md).
- Tested by: `services/demo-api/test/scenarios.test.ts:225` (S06), `:118` (S03).

**R11 · A quote belongs to one passenger and can be used once, before it expires.** ✅

A used quote gets `CONFLICT` (« Ce devis a déjà été utilisé. »), an expired one `QUOTE_EXPIRED`. When a quote expires
on screen, the app fetches a new one and says « Le prix a été recalculé » before any commitment.

- Enforced at: `services/demo-api/src/services/rides.ts:108-116` (`takeQuote`); `apps/passenger/src/app/(app)/quote.tsx:79-85`.
- Tested by: `services/demo-api/test/scenarios.test.ts:632`, weakly: the assertion at `:640` also accepts
  `ACTIVE_RIDE_EXISTS`. Single use is **not tested**.

**R12 · Booking freezes the terms: quote id, rule version, breakdown, commission, cancellation policy, dynamic
multiplier and category. Later rule or catalog changes never alter a booked ride or a scheduled booking.** ✅

The commission is read from the rules at the quote's version (`rulesAtVersion`), so a rule change between quote and
booking does not change it either. A scheduled booking freezes its terms when it is made and the dispatched ride
reuses them.

- Enforced at: `services/demo-api/src/services/rides.ts:118-132` (`freezeTerms`), `:64-66`, `:198` (immediate),
  `:728` (scheduled), `:797` (dispatch of a scheduled booking); `packages/domain/src/entities.ts:278-290` (`FrozenTerms`).
- Tested by: `services/demo-api/test/scenarios.test.ts:225` (S06, `:238-243`); `services/demo-api/test/prototype.test.ts:6`
  (category terms, `:53-54`).
- Gap: the terms carry the city rule version only, not the catalog version (R18).

### Service categories

**R13 · One global catalog holds the categories. Each has an on/off switch, a city list (empty means every city),
a static ETA, a commission and four optional fare overrides.** ✅ ❓

Defaults (MAD; "city" means the field is empty and the city fare applies):

| id | Name | Base | /km | /min | Minimum | Commission | ETA |
|---|---|---:|---:|---:|---:|---:|---:|
| `scooter` | Naya Scooter | 6 | 2 | 1 | 15 | 15 % | 3 min |
| `standard` | Naya Standard | city | city | city | city | 15 % | 5 min |
| `premium` | Naya Confort | 18 | 6 | 2,50 | 50 | 18 % | 7 min |

The catalog lives in the store's optional `prototype` section and is created on first use, so changing these defaults
in code does not reach an existing store (backlog API-21).

- Enforced at: `packages/domain/src/prototype.ts:4-17` (`ServiceCategory`), `:177-223` (defaults);
  `services/demo-api/src/services/prototype.ts:95-105` (`ensurePrototype`).
- Tested by: `services/demo-api/test/prototype.test.ts:6`.
- Open: categories answer client feedback item 1 ([MOBILE-FEEDBACK-AUDIT.md](../MOBILE-FEEDBACK-AUDIT.md):19).
  Confort as a premium tier reverses a handoff rule:
  [ADR-0026](../adr/0026-service-categories-including-a-premium-naya-confort.md) (confirm intent). Whether Scooter
  launches: [ADR-0043](../adr/0043-category-vehicle-eligibility-and-scooter-scope.md).

**R14 · A category can be quoted in a city only if it is enabled and offered there. The check runs at quote time
and again at booking.** ✅

An unknown, disabled or out-of-city category gets `NOT_FOUND` (404, « Catégorie disponible introuvable. »), and the
passenger has to pick another category and re-quote. The API also accepts a quote with no category: it then uses the
city fares and the city commission, and dispatch treats the ride as `standard`. The passenger app always sends a
category; the standalone driver bot never does (Demo vs live).

- Enforced at: `services/demo-api/src/services/prototype.ts:240-249` (`categoryFor`);
  `services/demo-api/src/services/rides.ts:79`, `:113`; `packages/domain/src/schemas.ts:91` (`categoryId` optional).
- Tested by: `services/demo-api/test/prototype.test.ts:6` (disabled Confort → 404 at `:60-75`).

**R15 · Each category fare field overrides the city value when it is set and inherits it when it is empty (`null`),
field by field. The multiplier, the cancellation policy and the quote validity always come from the city.** ✅ ❓

- Enforced at: `services/demo-api/src/services/rides.ts:80` (overrides), `:82`, `:94`, `:99` (city-only fields).
- Tested by: `services/demo-api/test/prototype.test.ts:6` (Confort costs more than Standard, `:27`). Field-level
  inheritance is **not tested**.
- Open: whether category fares vary by city, and whether a category may carry its own cancellation fees or
  multiplier: [ADR-0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md).

**R16 · An empty fare in the admin catalog editor means "use the city fare" (`null`), never 0.** ✅

The server treats 0 as a real fare (`??` falls back only on `null`), so a 0 saved by mistake prices that component
at 0 MAD, and a category with all four fares at 0 is quoted at 0 MAD. At `c38429d` the editor saved 0 when a fare
that had a value was cleared, turned « 2.5 » into 25 MAD and « 2,5 » into `NaN`, although its own dialog said
« Vide sur un tarif = tarif de la ville. » (`apps/admin/src/pages/Prototype.tsx:470`, `:491-517` at `c38429d`).

On branch `chore/docs-foundation-and-fixes` the editor keeps each field as text and parses on save (`fromDraft`,
`apps/admin/src/pages/Prototype.tsx:109-160`): amounts go through `toCentimes`, so « 2,5 » and « 2.5 » both give
250 centimes; an emptied category fare saves `null`; a category minimum of 0 is refused (« Laissez vide pour le tarif
de la ville »); amounts above 10 000 000 centimes are refused; lists are split on commas; the id is read-only for an
existing row and a new id must be an unused lowercase slug; `icon`, `category` and `kind` are selects.

- Enforced at: `services/demo-api/src/services/rides.ts:80`; `services/demo-api/src/services/prototype.ts:26`, `:46-49`
  (fares: integer centimes 0 to 10 000 000, or `null`; `c38429d` lines); the editor as above (branch).
- Tested by: `e2e/tests/admin-operations.spec.ts:128` "P12 · the Services catalog editor takes decimal fares and
  lists, empties to the city fare, and keeps the id" (branch; checks the saved row through the API).
- Gap: the API itself still accepts 0 for any fare, the minimum included (the server-side fallback is not changed).
  City ids in the editor are free text. Reason, version check and diff are R18.

**R17 · Commission precedence: today the category's commission replaces the city's whenever the quote names a
category, and the passenger app always names one.** ⚠️ ❓

Consequences, checked on 2026-10-13 with an in-memory demo API: a Casablanca « Naya Standard » ride froze 1 500 bp
(15 %), the same quote without a category froze 1 800 bp, and `GET /cities` still publishes 18 % for Casablanca.
[FINANCE.md](../FINANCE.md):18 documents 18 %. Commission edits on the admin Rules page are versioned and audited but
affect no ride booked in the app, and the page's example « Commission … net chauffeuse » is wrong for those rides.
Driver net, debt and the Overview commission all follow the category value.

- Enforced at: `services/demo-api/src/services/rides.ts:127` (`quote.service?.commissionBp ?? rules.commissionBp`),
  `:85`; `packages/domain/src/prototype.ts:12` and `services/demo-api/src/services/prototype.ts:45` (category
  commission is required); `apps/passenger/src/app/(app)/quote.tsx:55`, `:60`; `services/demo-api/src/app.ts:162`
  (`publicCity`, served by `GET /cities` at `:329-332`); `apps/admin/src/pages/Rules.tsx:227`.
- Tested by: **not tested** for a booking with a category outside Rabat. The FINANCE scenarios quote without a
  category (`services/demo-api/test/scenarios.test.ts:9`), so they cannot catch it.
- Gap: P8 (DOM-01, ADM-05, DOC-03, PRD-04). Decision D6,
  [ADR-0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md). The audit's recommended default: a
  category inherits the city rate unless a per-city override is set; `commissionBp` becomes nullable; the effective
  commission shows on the Rules page and the ride detail.

**R18 · Category changes should be governed like city rules: a reason, the expected version, a recorded version
history, and an audit entry with before and after.** ⚠️

Today `PUT /admin/prototype/catalog/:kind` needs only `config.edit`. It upserts by id (editing an id creates a second
row; since branch `chore/docs-foundation-and-fixes` the console keeps the id read-only for existing rows), increments `catalog.version` without recording what changed or which quote used which version, and audits a
summary only (`entityType: 'prototype'`). Every save also re-applies the catalog's enabled flags to the derived
recharge providers, overriding toggles made on the Paiements page.

- Enforced at: `services/demo-api/src/services/prototype.ts:890-925` (version `:912`, provider reset `:913`),
  `:269-289` (`log`), `:213-239` (`prototypeProviders`).
- Tested by: `services/demo-api/test/prototype.test.ts:29-35` (happy path only).
- Gap: ADM-09, API-09; API-08, PRD-19 (provider reset); low-severity finding "Category pricing and ETA are not
  versioned or audited in frozen terms" ([audit findings](../audits/2026-10-13-full-audit-findings.md#domain)).
  How category pricing is versioned is part of [ADR-0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md).

**R19 · The quote screen should start on a category that is available in the passenger's city.** ⚠️

It always starts on `standard` and requests that quote at once, while the chips list only enabled, in-city
categories. If Standard is disabled or not offered there, the first quote fails until she taps another chip.

- Enforced at: `apps/passenger/src/app/(app)/quote.tsx:55`, `:58-66`, `:154`.
- Tested by: **not tested**.
- Gap: PAX-08, PRD-40.

**R20 · The passenger sees each category's price before choosing, and the chosen category stays visible after
booking.** ⚠️

Today the chips show the name, the static ETA and the description, with no price. The fare card always draws a car,
including for Scooter, and says « Arrivée estimée · N min (démo) ». The fare sheet says « règles vN », which is the
city rule version even when category overrides set the fare. The dynamic banner and « Prix garanti à la
confirmation » are correct. The driver's offer names the category before she accepts; after that, `terms.service` is
stored but no screen shows it (receipt, admin ride, histories, driver ride card).

- Enforced at: `apps/passenger/src/app/(app)/quote.tsx:154`, `:157`, `:160`, `:206`, `:236`;
  `apps/driver/src/app/(app)/offer.tsx:112` (category on the offer).
- Tested by: **not tested**.
- Gap: PRD-16, PRD-17, VIS-13.

**R21 · A driver receives and may accept only rides of a category she is allowed to serve. Her list defaults to
every category in the catalog.** ⚠️ ❓

A ride with no category counts as `standard`. An admin sets the list per driver on `/services`. Vehicles have no type
or class, so a car driver receives Scooter rides at Scooter prices, and the driver status still says "eligible" when
categories are what stops her offers.

- Enforced at: `services/demo-api/src/services/rides.ts:262` (dispatch), `:370` (accept);
  `services/demo-api/src/services/prototype.ts:999-1026` (admin list); `packages/domain/src/entities.ts:108-114`
  (`VehicleDetails`, no type).
- Tested by: `services/demo-api/test/prototype.test.ts:6` (a driver restricted to `standard` gets no Confort offer, `:37-59`).
- Gap: P17 (DOM-18, PRD-07, DRV-12, API-16). Decision D4,
  [ADR-0043](../adr/0043-category-vehicle-eligibility-and-scooter-scope.md): derive eligibility from an approved
  vehicle type, no category by default, admin override.

### Cities

**R22 · A new city must be able to take bookings once it is switched on. Today it cannot until an admin draws a
zone, and it never offers cash.** ⚠️

`createCity` needs `config.edit`, a lowercase id, a reason, and a status of `test` or `inactive` (never `active`
directly). It records rules v1 and an audit entry, and creates three disabled demo providers: card for rides, card
for recharges, bank transfer for withdrawals. The catalog's four recharge options are added on the next
`GET /payment-providers` or catalog save, enabled when the option is (R18), so recharges can work before rides can.
Since branch `chore/docs-foundation-and-fixes` the card option is skipped when the city already has a card recharge
provider, which `createCity` always creates (disabled): a new city gets no enabled card recharge until an admin
enables its own on Paiements (`prototypeProviders`, `services/demo-api/src/services/prototype.ts:223-240` on the
branch).
It creates no zone (every quote is `OUT_OF_ZONE`) and no cash provider.
Place search returns generated demo places for any city other than Rabat and Casablanca, and reverse geocoding only
knows Rabat and Casablanca landmarks. Switching the city to `active` runs no readiness check. Seeded cities get cash,
card and agency providers.

- Enforced at: `services/demo-api/src/services/cities.ts:42-76` (providers `:61-72`), `:109-121`;
  `packages/domain/src/schemas.ts:173-180`; `services/demo-api/src/app.ts:333-350` (places), `:563-568`
  (`GET /payment-providers`); `services/demo-api/src/services/prototype.ts:213-239` (recharge options);
  `services/demo-api/src/seed.ts:101-114` (seeded providers).
- Tested by: `services/demo-api/test/scenarios.test.ts:529` (S15 adds a zone by hand at `:534`).
- Gap: PRD-26. The minimum setup before a city goes live (zone, cash, providers, places) has no ADR yet.

**R23 · The city a passenger quotes in comes from the device, not from her account.** ❓

The quote uses the device preference `prefs.cityId`; `GET /payment-methods` marks methods available for the account's
`user.cityId`; booking re-checks the method against the quote's city. The two can diverge.

- Enforced at: `apps/passenger/src/app/(app)/quote.tsx:52`, `:60`; `services/demo-api/src/app.ts:362-363`;
  `services/demo-api/src/services/rides.ts:197`.
- Tested by: **not tested**.
- Gap: PAX-05. Decision: [ADR-0054](../adr/0054-source-of-truth-for-the-passenger-s.md) (default: the server's
  `user.cityId`).

## States and transitions

**Quote** (hand-coded in `services/demo-api/src/services/rides.ts`, no machine)

| State | Event | Next | By | Effect |
|---|---|---|---|---|
| `open` | `POST /rides` or `POST /scheduled` before `expiresAt` | `used` | Passagère | Terms frozen into the ride or the booking (R12) |
| `open` | `expiresAt` passes | stays `open` | Clock | Refused at use with `QUOTE_EXPIRED`; the app re-quotes (R11) |
| `used` | The same passenger requests a new quote | removed | Server | `services/demo-api/src/services/rides.ts:102` drops her used quotes; open ones, expired included, stay until they fall out of the last 500 |

`expired` exists in the type (`packages/domain/src/entities.ts:275`) but is never stored.

**City**

| State | Event | Next | By | Effect |
|---|---|---|---|---|
| (none) | `POST /admin/cities` | `test` or `inactive` | Admin, `config.edit` | Rules v1, three disabled providers, audit `city.created` |
| any | Status change with a reason | any other | Admin, `config.edit` | Audit `city.status_changed`; no readiness check |
| rules vN | Rule change with reason and version | rules vN+1 | Admin, `config.edit` | History in `cityRuleVersions`; booked rides keep vN |

**Category:** enabled ↔ disabled through a catalog edit. Any catalog edit (categories, Famille plans, dispute reasons
or payment options) increments the single `catalog.version`.

## Demo vs live

- **Values.** Rabat and Casablanca rules and the category defaults are demo values. The audit notes that 100 MAD for
  10 km looks high for Rabat; calibrate before the next client demo ([audit §9, "Smaller calls that can wait"](../audits/2026-10-13-full-audit.md#smaller-calls-that-can-wait)).
- **Routes.** Distance and duration come from a demo router: known legs between landmark places, otherwise 1.35 ×
  the straight-line distance at 24 km/h (`packages/domain/src/geo.ts:74-110`, `source: 'demo'`). A live version needs
  a routing provider ([status/integrations.md](../status/integrations.md)).
- **ETA.** Each category's ETA is a static catalog number, labelled « (démo) » on the quote.
- **Standalone builds.** Each phone runs its own demo API and store, so catalog or rule changes made in a desktop
  admin never reach a TestFlight build ([ADR-0012](../adr/0012-native-demo-builds-run-the-demo-api.md)). The
  standalone driver bot books cash rides in Rabat with no category, so its offers use the city commission
  (`services/demo-api/src/embedded.ts:56-60`).
- **Storage.** The catalog sits in the store's `prototype` section, with `schemaVersion` 1 and no migrations
  ([ADR-0029](../adr/0029-demo-store-is-versioned-schemaversion-1-and.md),
  [ADR-0039](../adr/0039-future-of-the-prototype-module.md)). A live pricing service needs a versioned catalog in the
  production database ([ADR-0045](../adr/0045-production-backend-and-live-integrations.md)).

## Open questions

- **Which commission applies, city or category?** Today the category always wins (R17). Recommended default: the
  category inherits the city rate unless a per-city override exists. Also to settle there: per-city category fares,
  category versioning and audit (R18), and whether a category may change the cancellation fees or the multiplier
  (R15). D6, [ADR-0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md).
- **Was Naya Confort intended as a premium tier?** It reverses the handoff rule that colour variants never imply a
  premium tier. [ADR-0026](../adr/0026-service-categories-including-a-premium-naya-confort.md).
- **Does Naya Scooter launch, and which vehicles may serve which category?** Today every driver serves every
  category (R21). D4, [ADR-0043](../adr/0043-category-vehicle-eligibility-and-scooter-scope.md).
- **Which city is the passenger in: the device's or the account's?** (R23)
  [ADR-0054](../adr/0054-source-of-truth-for-the-passenger-s.md).
- **What must exist before a city goes live?** Zone, cash provider, enabled card provider, place data (R22). No ADR
  yet; add it to [status/open-questions.md](../status/open-questions.md).
- **How is the mobile car wash priced and paid?** The founder brief adds it as a new service with open scope
  ([docs/tasks/2026-10-13.md](../tasks/2026-10-13.md), task 5 and question 1). It does not fit the ride fare formula.
  Who it is for: both passengers and drivers order washes for their own cars (founder's answer to
  [F1](../status/open-questions.md#f1-car-wash-audience), 13 Oct); who the washers are is still open.

## Last verified

2026-10-13 @ `c38429d`, AI session (docs pass). Line numbers refer to that commit.

- Read: `packages/domain/src/{money,pricing,cities,prototype,entities,schemas,geo}.ts`,
  `services/demo-api/src/services/{rides,cities,prototype}.ts`, `services/demo-api/src/{app,seed,embedded}.ts`,
  `apps/passenger/src/app/(app)/quote.tsx`, `apps/admin/src/pages/{Rules,Prototype}.tsx`, the domain and demo-api
  tests, [FINANCE.md](../FINANCE.md), the audit and the backlog.
- Ran: `pnpm --filter @naya/domain test` (passed). A read-only probe against an in-memory demo API built from the
  working tree confirmed R17 (Casablanca Standard froze 1 500 bp; without a category 1 800 bp; `GET /cities` says
  1 800 bp) and the R6 gap (changes to only the search timeout, quote validity, scheduling or dynamic reason are
  refused).
- Fact-checked the same day by a second AI session: every cited line re-read at `c38429d`, every link and anchor
  resolved, the probe re-run independently with the same results.
- Not checked: the e2e suite, the admin and mobile screens by hand, Android.
- Branch `chore/docs-foundation-and-fixes`, re-checked on 2026-10-13 (docs reconciliation): it rewrites the admin
  catalog editor (R16) and stops adding a second card recharge provider per city (R18, R22). Neither changes the
  server pricing rules.
