# Financial model

These are **configurable demo business rules**, not live provider pricing.

## Representation

- Money is an integer number of **centimes** (1 MAD = 100). Rates are integer **basis points** (15 % = 1 500 bp, ×1,2 = 12 000 bp).
- **Rounding**: every derived amount (distance fare, time fare, multiplier, commission) is rounded **half away from zero to the centime**, once, where it is derived (`divRound`, `applyBp` in `packages/domain/src/money.ts`). No binary floating-point value ever becomes a stored amount.
- Display: `100 MAD`, `128,40 MAD`, `−15 MAD` (true minus, narrow no-break spaces), tabular figures.

## Fare

`total = max(base + perKm·km + perMinute·min, minimum) × multiplier`

| City | Base | /km | /min | Min | Commission | Debt limit | 10 km / 25 min | ×1,2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rabat (active) | 10 | 4 | 2 | 30 | 15 % | 150 | **100 MAD** | **120 MAD** |
| Casablanca (test) | 12 | 4,5 | 2 | 35 | 18 % | 200 | **107 MAD** | **128,40 MAD** |

Quotes carry city, currency, rule version, breakdown, expiry (10 min) and conditions (cancellation policy, dynamic reason). Accepting a quote **freezes** its terms (including the commission of that rule version) into the ride or scheduled booking; later rule changes never alter them (tested in S06).

## Wallet

The wallet is a projection, never a mutable number:

- **Solde comptable (balance)** = sum of posted ledger entries. Only confirmed events post.
- **Réservé (reserved)** = sum of *pending* withdrawals. A hold, not a ledger movement.
- **Disponible au retrait (available)** = max(0, balance − reserved).
- **Dette de commission (debt)** = max(0, −balance). Offers are blocked when `balance ≤ −debtLimit`.
- **Espèces encaissées (physical cash)** and **revenus (earnings)** are reported separately and never mixed into the balance.

| Event | Ledger effect |
|---|---|
| Cash ride completed | −commission (driver keeps the fare physically) |
| Card ride, payment **confirmed** | +net (fare − commission) |
| Card ride, payment pending / failed | nothing |
| Recharge **confirmed** | +amount |
| Recharge pending / failed | nothing |
| Withdrawal requested | nothing (reservation appears) |
| Withdrawal **confirmed** | −amount (reservation disappears) |
| Withdrawal failed | nothing (reservation released, no compensating credit) |
| Cancellation fee confirmed | +fee − commission to the driver who travelled |
| Exceptional correction | ±amount, permission `finance.correct`, reason ≥ 10 chars, audit with before/after |

## Recharge providers

Passengers (prepaid wallet) and drivers (commission wallet) recharge through the **same providers**: card, Moroccan wallet, mobile payment, Cash Plus, Wafacash. Each provider can be restricted to one audience and to a minimum / maximum amount. A recharge is *pending* until the provider confirms; a failure or an expired agency code credits nothing. See `docs/INTEGRATIONS.md` for the adapter architecture.

## Required fixtures (all asserted in `services/demo-api/test/scenarios.test.ts` and `packages/domain/test/wallet.test.ts`)

- NY-001 cash 100 → wallet −15, net 85. NY-002 card 100 → +85, wallet 70.
- Both rides: gross 200, commission 30, net 170 = cash 100 + wallet 70.
- Withdrawal 50 from 70: pending 70/50/20 → confirmed 20/0/20 → failed 70/0/70.
- Recharge 50 from 70: only confirmation gives 120. Then withdrawal 50: pending 120/50/70, success 70, failure 120.
- Debt: −150 blocks in Rabat; confirmed recharge 50 → −100 restores; pending/failed leave −150. −15 does not block. Reaching the threshold mid-ride does not stop the ride.

## Safety properties

- **Idempotency**: booking, recharge, withdrawal, payment retry and correction require an `Idempotency-Key`; same key + same body replays, different body is refused. Each ledger posting has a unique business key (`ride:NY-002:net`, `withdrawal:WD-001`…), so a replayed event cannot post twice.
- **Duplicate provider events**: callbacks are HMAC-SHA256 signed (`X-Naya-Signature`), deduplicated by event id, and a repeated terminal outcome is a no-op; a contradictory one is a conflict.
- **Transactions**: each request mutates state inside one transaction that is rolled back on any error; Node runs handlers one at a time, so two drivers accepting the same ride are serialised (tested).
- **No optimistic confirmation**: the apps show *pending* until the server reports the provider outcome.
