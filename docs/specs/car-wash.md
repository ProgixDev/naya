---
title: "Lavage à domicile (mobile car wash)"
status: Draft
owner: Achraf
last_verified: 2026-10-13 @ feat/car-wash
related: [ADR-0003, ADR-0005, ADR-0007, ADR-0009, ADR-0013, ADR-0029, ADR-0040, docs/tasks/2026-10-13.md (task 5)]
---

# Lavage à domicile (mobile car wash)

**Status marks:** ✅ matches intent · ⚠️ known defect · ❓ open.

## Purpose

A washing team comes to where the car is parked (home, work, anywhere in the service zone) and washes it.
The founder decided on 13 October 2026 that the service is for **both** apps: a passagère orders a wash for her own car,
a chauffeuse for her Naya car. There is no washer app: the demo API plays the team. Ride rules stay in
[pricing-cities-categories.md](pricing-cities-categories.md) and [payments-and-fees.md](payments-and-fees.md).

## Actors

- Passagère (passenger app): Accueil → « Lavage à domicile » → `(app)/car-wash`, `car-wash/new`, `car-wash/[id]`.
- Chauffeuse (driver app): tableau de bord (hors ligne, sans course) → « Lavage à domicile » → same three routes.
- Admin with `rides.read` (apps/admin `/lavages`): read-only list.
- Demo API: prices, freezes terms, runs the simulated team in `tick()` (`services/demo-api/src/services/carWash.ts`).

## Rules

- **R1 ✅ Prices, durations, hours and fees are configuration, not code paths.** They live in
  `CAR_WASH_DEMO_CONFIG` (`packages/domain/src/carWash.ts`), per city. **Every value is a placeholder** until the client sets
  them: Rabat Extérieur 60 MAD / 45 min, Intérieur + extérieur 110 MAD / 75 min, Complet 180 MAD / 120 min (Casablanca
  70 / 125 / 200 MAD); commission 20 %; 08h00–20h00, 30-minute slots, 60 min lead, 7 days ahead. A city without an entry
  does not offer the service (`available: false`).
- **R2 ✅ The server prices every order** (ADR-0005). The client echoes the price it showed (`expectedPrice`); a different
  server price answers `CONFLICT` with `details.price`. Booking freezes `WashTerms` (rules version, package, price,
  commission, cancellation policy). Money is integer centimes (ADR-0003).
- **R3 ✅ Lifecycle is a declarative machine** (ADR-0007, `washOrderMachine`): `booked` → `washer_assigned` → `en_route` →
  `washing` → `completed`; `CUSTOMER_CANCEL` from the first three states, `SYSTEM_CANCEL` when no team exists.
  Nothing cancels a wash in progress.
- **R4 ✅ Where and which car.** The car location is a saved place, the current position or a map pin, and must be inside
  an active zone of the city (`OUT_OF_ZONE`). Parking notes (≤ 200 characters) go to the team. The car is make, model,
  colour and plate; a driver's form is prefilled from her approved vehicle, and `vehicleId` must be her own.
- **R5 ✅ When.** « Maintenant » estimates the start at now + `nowEtaMinutes` and is refused outside opening hours.
  « Planifier » accepts only an offered slot (`assertWashStartAllowed`).
- **R6 ✅ Who may order.** Passengers need an approved identity (`VERIFICATION_REQUIRED`); suspended accounts are refused;
  the city must be bookable for the account; at most 3 open orders per customer.
- **R7 ✅ Payment uses the existing methods.** Passengers: cash, card, Portefeuille Naya, wallet marocain (demo), each
  available under the same city rules as rides. Drivers: Portefeuille chauffeuse or cash.
  - Card: a payment is created at completion and confirmed by the simulated provider (same signed path as rides).
  - Portefeuille Naya: the price is held at booking, settled at completion, released on cancellation.
  - Portefeuille chauffeuse: debited at booking (ledger `car_wash`, key `wash:<id>:charge`, needs the available balance),
    refunded minus the fee on cancellation (`car_wash_refund`, key `wash:<id>:refund`).
  - Cash and wallet marocain: confirmed at completion (simulation).
  - No driver ledger is credited: washers are not Naya drivers.
- **R8 ✅ Cancellation** (`washCancellationPreview`, frozen policy): free before assignment; after assignment free for 5 min
  or until 2 h before the slot, whichever is later; then 20 MAD; 30 MAD once the team is en route; never above the price.
  The customer must acknowledge the fee shown (`acknowledgedFee`); a changed fee answers `CONFLICT`.
- **R9 ✅ Tracking.** The order screen polls every 2 s while the order is open (ADR-0013) and shows the five-step timeline,
  the team's simulated position and ETA while en route, before photos when washing starts, after photos and the receipt
  at completion, then a 1–5 rating (once).
- **R10 ✅ Demo labelling.** Teams, positions and photos are simulated and say so (« Démo », « Position simulée »,
  « Photos simulées »). Demo timing: assignment 15 s after booking, departure 10 s later (or 60 s before a scheduled
  slot), 60 s of travel, washing 20× faster than its real duration.
- **R11 ❓ Who the washers are.** The copy says « l’équipe de lavage » and team names, with no gender, until the founder
  says whether washers are women-only like drivers.
- **R12 ⚠️ Not done yet:** admin cannot edit the configuration (it is a code constant, versioned by hand); no support
  ticket links to a wash; a refused card payment shows « Contactez l’assistance » with no retry; a cash cancellation fee
  stays pending (same open question as rides, ADR-0041); wash payments are not in admin Finance totals.

## Evidence

- Domain: `packages/domain/src/carWash.ts`, `machines/carWash.ts`, schemas `createWashOrderSchema`; tests
  `packages/domain/test/carWash.test.ts`.
- API: `GET /car-wash/catalog`, `GET /car-wash/payment-options`, `POST /car-wash/orders` (Idempotency-Key required),
  `GET /car-wash/orders`, `GET /car-wash/orders/:id`, `GET /car-wash/orders/:id/cancellation-preview`,
  `POST /car-wash/orders/:id/cancel`, `POST /car-wash/orders/:id/rating`, `GET /admin/car-wash/orders` (`rides.read`);
  tests `services/demo-api/test/carWash.test.ts`.
- UI: `packages/ui/src/features/carWash.tsx` (`CarWashEntry`, `CarWashOrdersScreen`, `CarWashBookingScreen`,
  `CarWashOrderScreen`), routes in both apps under `(app)/car-wash/`, admin `apps/admin/src/pages/CarWash.tsx`.
