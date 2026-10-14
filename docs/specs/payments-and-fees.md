---
title: "Payments and fees"
status: Current
owner: Achraf
last_verified: 2026-10-13 @ c38429d
related: [ADR-0058, ADR-0003, ADR-0004, ADR-0009, ADR-0010, ADR-0018, ADR-0036, ADR-0040, ADR-0041, ADR-0042, ADR-0044, ADR-0045, ADR-0053, P7, P11, P14, P16, API-02, API-03, API-05, API-07, API-13, API-15, API-19, API-24, API-25, DOM-03, DOM-04, DOM-08, DOM-15, DRV-08, DRV-09, PRD-38, docs/FINANCE.md, specs/pricing-cities-categories.md]
---

# Payments and fees

**Status marks:** ✅ matches intent · ⚠️ known defect (backlog ID) · ❓ open (Proposed ADR). See [_template.md](_template.md).

## Purpose

How a ride and a cancellation fee get paid, how that money reaches the driver's wallet, which payment methods exist,
and how the passenger wallet works today. How the fare and the commission are computed is in
[pricing-cities-categories.md](pricing-cities-categories.md). The driver wallet's arithmetic and its fixtures
(NY-001, NY-002, the 70/50/20 withdrawal) live in [FINANCE.md](../FINANCE.md#wallet), in its Wallet and Required
fixtures sections; this spec states the rules and links the tables. The passenger wallet is described as it exists, pending decision D5
([ADR-0040](../adr/0040-passenger-wallet-model.md)).

Every provider is simulated. No real money moves anywhere in this repo. Since 14 Oct 2026 the apps present the mock
provider as a real one: it answers on its own after a short delay, and no screen shows « Simuler », a sandbox page or
test-card numbers ([ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md)).

## Actors

| Actor | Surface | Role in this area |
|---|---|---|
| Passagère | Passenger app: quote, payments, card form, receipt, cancel sheet, Portefeuille Naya | Chooses a method, adds a card, pays or retries, cancels, tops up her wallet |
| Chauffeuse | Driver app: ride end, earnings, wallet, recharge, withdrawal | Confirms cash received, recharges to clear commission debt, withdraws |
| Payment provider (mock) | Signed callback `POST /providers/:provider/callback`; timed jobs (`deliverDueProviderJobs`, `settleDueWalletTopups`); sandbox route `POST /provider-sandbox/...` (no screen calls it since 14 Oct 2026) | Confirms or refuses card payments, recharges, withdrawals and passenger top-ups |
| Admin with `finance.read` / `finance.correct` | apps/admin `/finance` | Reads balances, pending and failed payments; posts exceptional corrections |
| Admin with `config.edit` | apps/admin `/paiements`, `/services` | Switches providers per city; edits the payment options catalog |
| Demo API | `services/demo-api/src/services/{rides,finance,prototype}.ts` | Creates payments, applies provider outcomes, posts the ledger |

## Rules

Line numbers are at commit `c38429d`.

### Payment methods

**R1 · A passenger pays with one of four kinds: `cash`, `card`, `wallet` (Portefeuille Naya) or `mobile_wallet`
(« Wallet marocain »; « Wallet marocain (démo) » before 14 Oct 2026). A card is stored as a provider token and its last 4 digits, never a card number.** ✅

The demo accepts only `tok_demo_NNNN` tokens and refuses the same token twice. The card form accepts any Luhn-valid
number with a future expiry and shows no test numbers; a new card is labelled « Carte •••• NNNN » (`services/demo-api/src/app.ts`,
`POST /payment-methods/card`).

- Enforced at: `packages/domain/src/entities.ts:292-305`; `services/demo-api/src/app.ts:365-380` (add a card),
  `:608-614` (tokenize). [ADR-0018](../adr/0018-sensitive-data-minimisation.md).
- Tested by: `e2e/tests/passenger-flows.spec.ts:281` (adds a card in the app and sees « Carte •••• 0077 », « Expire 12/2029 »).
  The token format and duplicate checks are **not tested**.

**R2 · Cash and card are offered only where the city has an enabled, configured ride provider of that kind.** ✅ ❓

`GET /payment-methods` computes `availableInCity` from the account's `user.cityId`; booking re-checks the method
against the quote's city and refuses with `PAYMENT_METHOD_UNAVAILABLE`.

- Enforced at: `services/demo-api/src/app.ts:357-364`; `services/demo-api/src/services/rides.ts:139-150` (`paymentRef`).
- Tested by: **not tested** (no test switches a provider off).
- Open: the two city sources can diverge: [ADR-0054](../adr/0054-source-of-truth-for-the-passenger-s.md) (PAX-05).

**R3 · Every passenger gets a wallet method and a mobile-wallet method automatically. The wallet is always
available; the mobile wallet is available when the demo catalog has an enabled `mobile` option for the city.** ⚠️ ❓

The methods are created on `GET /payment-methods` and at booking, so a read request writes to the store.

- Enforced at: `services/demo-api/src/services/prototype.ts:185-212` (`prototypeMethods`);
  `services/demo-api/src/services/rides.ts:142-146`; `services/demo-api/src/app.ts:360`, `:363`;
  catalog options at `packages/domain/src/prototype.ts:273-302`.
- Tested by: `services/demo-api/test/prototype.test.ts:285` (both kinds can book).
- Gap: whether these methods ship at all is decision D5, [ADR-0040](../adr/0040-passenger-wallet-model.md) (P7).
  The read-side write is a low-severity finding ("GET handlers mutate state outside transactions",
  [audit findings](../audits/2026-10-13-full-audit-findings.md#demo-api)).

**R4 · Only cards can be removed, and not while an active ride or a scheduled booking uses them. Removing the default
card makes cash the default.** ✅

- Enforced at: `services/demo-api/src/app.ts:391-408`.
- Tested by: **not tested**.
- Gap: removing a wallet method answers « Les espèces ne peuvent pas être supprimées. » (low-severity "Small contract
  nits", [audit findings](../audits/2026-10-13-full-audit-findings.md#demo-api)).

### Paying for a ride

**R5 · Nothing is charged at booking, except a hold on the passenger wallet (R33). The payment record is created when
the ride completes, for the frozen total.** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:190-204` (`createRide`), `:601-638` (`settleRide`).
- Tested by: `services/demo-api/test/scenarios.test.ts:156` (S04: nothing credited while pending).

**R6 · Cash: the chauffeuse keeps the fare. At completion the payment is `pending` and the commission is debited
from her wallet at once (ledger key `ride:<id>:commission`). She then confirms the amount received, which must equal
the fare exactly; confirming posts nothing more.** ✅

Until she confirms, her status carries the ride as `awaitingCashRide`. Confirming twice is harmless.

- Enforced at: `services/demo-api/src/services/rides.ts:632-637`, `:640-653` (`confirmCashCollected`);
  `packages/domain/src/wallet.ts:56-61` (`rideSettlement`); `services/demo-api/src/app.ts:174`, `:183`, `:513-516`.
- Tested by: `services/demo-api/test/scenarios.test.ts:118` (S03, NY-001: wallet −15 MAD, cash confirmed at `:135`);
  `packages/domain/test/wallet.test.ts:14`.

**R7 · A cash ride where the passenger did not pay, or paid only part, has a defined outcome.** ⚠️ ❓

There is none today: the only action is a full confirmation, while the commission debt is already posted.

- Enforced at: `services/demo-api/src/services/rides.ts:634-653`.
- Tested by: **not tested**.
- Gap: API-25. Decision D7, [ADR-0041](../adr/0041-cash-and-fee-settlement.md).

**R8 · Card: completion queues a provider outcome. Only a confirmed outcome credits the chauffeuse, with the net
(ledger key `ride:<id>:net`). Pending or failed credits nothing.** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:632-633`, `:520-526` (`queueCardOutcome`);
  `services/demo-api/src/services/finance.ts:133-153`.
- Tested by: `services/demo-api/test/scenarios.test.ts:156` (S04, NY-002: −15 → 70 MAD only after confirmation);
  `:553`, `:576` (S16: failed and pending credit nothing).

**R9 · A failed card payment for a completed ride can be retried by the passenger, with a card only. The retry is a
new payment with a new provider reference; the failed one stays as history.** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:528-546` (`retryPayment`); `services/demo-api/src/app.ts:454-458`.
- Tested by: `services/demo-api/test/scenarios.test.ts:553` (S16: 0002 refused, retried with 4242, driver credited).
- Gap: the admin "failed payments" list keeps the superseded payment (low-severity "Admin 'failed payments' never
  decreases after a successful retry", [audit findings](../audits/2026-10-13-full-audit-findings.md#demo-api)).

**R10 · Wallet and mobile-wallet rides are confirmed only by a provider event, like cards.** ⚠️ ❓

Today both are marked `confirmed` in the completion transaction, with no provider, and the chauffeuse is credited
the net at once. The domain's settlement rule only knows `cash | card`. Combined with R32, a passenger can create
money that becomes withdrawable driver credit.

- Enforced at: `services/demo-api/src/services/rides.ts:625-631`; `packages/domain/src/wallet.ts:56`.
- Tested by: `services/demo-api/test/prototype.test.ts:285` asserts today's behaviour ("settles %s rides and credits
  driver net once"); change it with the fix.
- Gap: P7, DOM-03. Decision D5, [ADR-0040](../adr/0040-passenger-wallet-model.md).

**R11 · An unpaid amount (a failed card payment, a pending fee) does not block the next booking.** ⚠️ ❓

`createRide` checks only verification and an active ride. Checked on 2026-10-13: a passenger with an unpaid cash
cancellation fee booked again. Whether it should block is open.

- Enforced at: `services/demo-api/src/services/rides.ts:190-196`.
- Tested by: **not tested**.
- Gap: API-15. Decision D7, [ADR-0041](../adr/0041-cash-and-fee-settlement.md).

**R12 · Every screen describes the payment method as it really works: icon, timing, receipt text and fee text.** ⚠️

Today the quote shows any non-card method with a banknote icon and « Débitée à l’arrivée », although the wallet is
held at booking, and shows no wallet balance. The payment row and Maintenant/Planifier sit below the fold of the quote
sheet. The receipt calls any confirmed non-cash payment « Carte · paiement confirmé ». Driver earnings label wallet
rides « Carte ».

- Enforced at: `apps/passenger/src/app/(app)/quote.tsx:189-196`, `:218`; `apps/passenger/src/app/(app)/receipt/[id].tsx:14-24`;
  `apps/driver/src/app/(app)/(tabs)/earnings.tsx:69`.
- Tested by: **not tested**.
- Gap: P14 (PAX-02, PRD-15, VIS-03, VIS-25, DRV-08). The audit's fix: one `paymentMethodPresentation(kind)` helper
  used on the quote, cancel sheet, receipt, payments and driver earnings screens.

### Cancellation fees

**R13 · The fee comes from the ride's frozen cancellation policy: free while searching or with no driver; free for
`graceSeconds` (120 s) after assignment; `feeAfterGrace` (10 MAD) after that; `feeAfterArrival` (15 MAD) once the
chauffeuse is marked arrived; not cancellable once the trip has started.** ✅ ⚠️ ❓

- Enforced at: `packages/domain/src/pricing.ts:60-87` (`passengerCancellationPreview`);
  `services/demo-api/src/services/rides.ts:433-437`, `:469-470`.
- Tested by: `packages/domain/test/pricing.test.ts:39`, `:42`, `:47`; `services/demo-api/test/scenarios.test.ts:277` (S08).
- Gap: the arrival fee applies the moment she is marked arrived, with no waiting time and no proximity check, while
  help promises 2 free minutes (DOM-15, [ADR-0042](../adr/0042-ride-exception-paths.md)). The explanation says « plus
  de 2 minutes » whatever `graceSeconds` is (`packages/domain/src/pricing.ts:80`; noted as "Explanation copy
  hard-codes '2 minutes'" in the domain feature inventory of the
  [audit findings](../audits/2026-10-13-full-audit-findings.md#domain), with no backlog ID).

**R14 · The passenger must confirm the fee she was shown. Without `acknowledgedFee` the cancellation is refused
(`VALIDATION`); with a different amount it gets `CONFLICT` and the current fee.** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:471-476`; `packages/domain/src/schemas.ts:101-106`.
  [ADR-0005](../adr/0005-server-authoritative-pricing-with-versioned-city-rules.md).
- Tested by: `services/demo-api/test/scenarios.test.ts:277` (S08, `:288-290`).

**R15 · A driver cancellation never charges the passenger: the ride goes back to searching and that driver is
excluded.** ✅ ⚠️ ❓

- Enforced at: `services/demo-api/src/services/rides.ts:655-674`; `packages/domain/src/machines/ride.ts:21-22`.
  [ADR-0007](../adr/0007-lifecycle-rules-are-declarative-state-machines-in.md).
- Tested by: `services/demo-api/test/scenarios.test.ts:298` (S09).
- Gap: a passenger no-show can only be recorded as a driver cancellation, so she is re-matched and pays nothing
  (DOM-04, [ADR-0042](../adr/0042-ride-exception-paths.md)).

**R16 · Cancelling a scheduled booking is always free, and changing its time keeps the price.** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:771-782` (« Réservation annulée · sans frais »), `:766`.
- Tested by: `services/demo-api/test/scenarios.test.ts:191` (S05; the absence of a fee is not asserted).

**R17 · Card fee: the fee payment is `pending` until the provider answers. On confirmation, the chauffeuse who was
assigned gets the fee minus the ride's commission (ledger key `ride:<id>:cancel-fee`).** ✅

- Enforced at: `services/demo-api/src/services/rides.ts:439-462` (`chargeFee`); `services/demo-api/src/services/finance.ts:148-152`.
- Tested by: `services/demo-api/test/scenarios.test.ts:277` (S08 asserts the fee payment, cash method). The driver
  credit is **not tested**.

**R18 · A refused card fee can be paid again.** ⚠️ ❓

It cannot: retry looks for `ride.paymentId`, which a fee never sets, and answers « Aucun paiement à relancer. ». The
receipt still says « Réglez avec une autre carte ».

- Enforced at: `services/demo-api/src/services/rides.ts:439-462`, `:531-532`;
  `apps/passenger/src/app/(app)/receipt/[id].tsx:22`.
- Tested by: **not tested**.
- Gap: API-24. Decision D7, [ADR-0041](../adr/0041-cash-and-fee-settlement.md).

**R19 · Cash fee: the fee is collected, and the chauffeuse who travelled is credited.** ⚠️ ❓

Neither happens. The fee payment is created `pending` with provider `cash` and no reference; nothing ever resolves
it, no ledger entry is posted, and the admin's pending-payments list grows. Checked on 2026-10-13: an hour after a
15 MAD cash fee, the payment was still `pending` and the driver's balance had not moved. The receipt promises
« … à régler avec votre prochaine course. », and so does the cancel sheet.

- Enforced at: `services/demo-api/src/services/rides.ts:439-456`; copy at
  `apps/passenger/src/app/(app)/receipt/[id].tsx:19`, `apps/passenger/src/features/ride/CancelSheet.tsx:60`.
- Tested by: **not tested**.
- Gap: P11 (DOM-08, API-02, PRD-05, PAX-16). Decision D7, [ADR-0041](../adr/0041-cash-and-fee-settlement.md). The
  audit's recommended default: add the fee to the next fare, post it under `ride:<id>:cancel-fee`, and credit the
  chauffeuse when it is posted, not when it is collected.

**R20 · Wallet and mobile-wallet fees are confirmed by a provider like any other money.** ⚠️ ❓

Today a wallet fee is taken from the passenger wallet at once, a mobile-wallet fee is simply marked confirmed, and in
both cases the chauffeuse is credited the net immediately. The cancel sheet tells both passengers the fee is « à
régler avec votre prochaine course ».

- Enforced at: `services/demo-api/src/services/rides.ts:457-460`; `apps/passenger/src/features/ride/CancelSheet.tsx:60`.
- Tested by: **not tested**.
- Gap: P7, P14. Decision D5, [ADR-0040](../adr/0040-passenger-wallet-model.md).

### Provider events, idempotency and the ledger

**R21 · Every provider outcome goes through one code path. Callbacks are signed with HMAC-SHA256 over the raw body
(`X-Naya-Signature`) and deduplicated by event id. Repeating the outcome that produced the current state is a no-op;
a contradictory outcome is refused.** ✅

Mock outcomes (timed jobs, the dev tools, the sandbox route) use the same function.

- Enforced at: `services/demo-api/src/app.ts:615-620`; `services/demo-api/src/services/finance.ts:73-82`, `:92-180`;
  `packages/domain/src/machines/transfer.ts:7-24`. [ADR-0010](../adr/0010-provider-outcomes-are-applied-through-one-code.md).
- Tested by: `services/demo-api/test/scenarios.test.ts:175-180` (the same signed event twice, S04), `:183` (a bad
  signature gets 401); `packages/domain/test/machines.test.ts:73` (transfers: duplicate is a no-op, contradiction
  throws). A contradictory outcome on a ride payment is **not tested**.
- Gap: low-severity findings in the [demo-api section](../audits/2026-10-13-full-audit-findings.md#demo-api): one shared
  secret and the `:provider` segment ignored; one conflicting job rolls back the whole delivery batch and retries
  every 500 ms.

**R22 · Only the provider confirms money. A payer can never confirm her own payment, recharge or top-up outside
dev mode.** ⚠️ ❓

Today the payer can still approve her own card payment or recharge on the sandbox route in any mode, although no
screen calls it since 14 Oct 2026. Checked on 2026-10-13 with `devMode` off: a passenger created and confirmed a
100 000 MAD top-up herself. Since 14 Oct 2026 the top-up resolve route answers 404 outside dev mode, and the mock
provider confirms every top-up on its own, so any top-up still becomes money (P7).

- Enforced at: `services/demo-api/src/app.ts:593-607` (sandbox: the owner is always allowed);
  `services/demo-api/src/services/prototype.ts:494-517` (top-up resolve).
- Tested by: `services/demo-api/test/prototype.test.ts:77` (another passenger gets 404; the owner may confirm).
- Gap: P7 (API-03, PRD-12, UI-05). Gating the routes needs no decision; the demo flag rules are
  [ADR-0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md).

**R23 · Booking and money mutations require an `Idempotency-Key`. The same key and body replay the first answer; the
same key with another body gets `IDEMPOTENCY_CONFLICT`.** ✅ ⚠️

Required on `POST /rides`, `/scheduled`, `/rides/:id/payment/retry`, `/driver/recharges`, `/driver/withdrawals`,
`/prototype/wallet/topup` and `/admin/finance/corrections`; optional on `POST /rides/:id/cancel`.

- Enforced at: `services/demo-api/src/app.ts:125-144` (`idempotent`), `:410-414`, `:444-465`, `:569-582`, `:851-857`;
  `services/demo-api/src/services/prototype.ts:459`. [ADR-0009](../adr/0009-idempotency-key-is-required-on-booking-money.md).
- Tested by: `services/demo-api/test/scenarios.test.ts:494` (S13: replay, conflict, missing key);
  `services/demo-api/test/prototype.test.ts:77` (top-up replay).
- Gap: corrections check the key but not the body, and keys are global (API-07, ADM-14); the client rotates the key
  after an error, so a retry after a timeout can duplicate a recharge or a withdrawal (UI-03,
  [ADR-0053](../adr/0053-idempotency-key-lifecycle.md)); the idempotency record is written in a second transaction
  (low-severity, [audit findings](../audits/2026-10-13-full-audit-findings.md#demo-api)).

**R24 · Each driver-ledger posting has a unique business key, so a replayed event never posts twice.** ✅

Keys: `ride:<id>:commission`, `ride:<id>:net`, `ride:<id>:cancel-fee`, `recharge:<id>`, `withdrawal:<id>`,
`correction:<Idempotency-Key>`. Amounts are signed non-zero integer centimes.

- Enforced at: `services/demo-api/src/services/finance.ts:47-69` (`postLedger`); `packages/domain/src/entities.ts:452-475`.
- Tested by: `services/demo-api/test/prototype.test.ts:285` (one net credit per ride); `services/demo-api/test/scenarios.test.ts:156`.

### Driver wallet

[FINANCE.md](../FINANCE.md#wallet) is the canonical description: definitions, the event-to-ledger table and the
required fixtures. [ADR-0004](../adr/0004-driver-wallet-is-a-projection-of-an.md) records the decision.

**R25 · The driver wallet is a projection of the ledger: balance = posted entries, reserved = pending withdrawals,
available = max(0, balance − reserved), debt = max(0, −balance). Cash collected and earnings are reported apart.** ✅

- Enforced at: `packages/domain/src/wallet.ts:23-40` (`projectWallet`); `services/demo-api/src/services/finance.ts:29-41`.
- Tested by: `packages/domain/test/wallet.test.ts:14-89`; `services/demo-api/test/scenarios.test.ts:118`, `:156`, `:446`.

**R26 · A chauffeuse whose balance is at or below −`debtLimit` gets no offers and cannot go online. Reaching the
limit during a ride does not stop that ride.** ✅ ⚠️

- Enforced at: `packages/domain/src/wallet.ts:42-43` (`isBlockedByDebt`); `services/demo-api/src/services/rides.ts:226-229`,
  `:303-305`, `:368-369`.
- Tested by: `packages/domain/test/wallet.test.ts:64`, `:75`; `services/demo-api/test/scenarios.test.ts:406`, `:428` (S12).
- Gap: a `debtLimit` of 0 (allowed by the rule bounds) blocks every driver whose balance is exactly 0, new drivers
  included (`isBlockedByDebt(0, 0)` is `true`; low-severity, [audit findings](../audits/2026-10-13-full-audit-findings.md#domain)).

**R27 · Recharges: 10 to 5 000 MAD, one pending at a time, through an enabled recharge provider of her city. Only a
confirmed outcome credits the wallet (`recharge:<id>`).** ✅ ⚠️

The mock outcome is timed: a card recharge is confirmed after 3 s (`providerDelaySeconds.payment`), any other after 8 s
(`withdrawalConfirm`), while the app shows « Paiement en cours » or the agency reference (`createRecharge` in
`services/demo-api/src/services/finance.ts`, since 14 Oct 2026; before that the sandbox page decided). A refusal
can only be forced with `POST /dev/providers/recharge/<ref>/fail`.

- Enforced at: `packages/domain/src/wallet.ts:70-74`; `services/demo-api/src/services/finance.ts:184-214`, `:102-115`;
  provider list at `services/demo-api/src/app.ts:563-568`.
- Tested by: `services/demo-api/test/scenarios.test.ts:406` (S12), `:475` (S13). The amount limits are **not tested**.
- Gap: every catalog save re-applies the demo options' enabled flags to the derived recharge providers (API-08,
  PRD-19). The driver list showed « Carte bancaire (démo) » twice (PRD-20; the « (démo) » suffix is gone since 14 Oct 2026). On branch `chore/docs-foundation-and-fixes`
  `prototypeProviders` keeps one card recharge provider per city and disables an existing copy (test:
  `services/demo-api/test/prototype.test.ts:418`); an admin who re-enables that copy on Paiements is overridden on the
  next `GET /payment-providers`. The mobile wallet is still a `cash_network` provider (PRD-20).

**R28 · Withdrawals: at least the city's `minimumWithdrawal` (20 MAD), at most `available`, one pending at a time, to
one of her payout accounts, through an enabled withdrawal provider. A request reserves the amount without posting;
confirmation posts `withdrawal:<id>`; failure releases the reservation with no compensating entry.** ✅ ⚠️

- Enforced at: `packages/domain/src/wallet.ts:63-68` (`assertWithdrawable`); `services/demo-api/src/services/finance.ts:216-253`, `:117-131`.
- Tested by: `services/demo-api/test/scenarios.test.ts:447`, `:463`, `:475`, `:494` (S13); `packages/domain/test/wallet.test.ts:36`, `:45`, `:56`, `:82`.
- Gap: there is no way to add a payout account, so a new driver can never withdraw (API-13; the audit's default:
  changes through support until a payout provider exists). Commission debits can consume funds a pending withdrawal
  has reserved, so its confirmation can create debt (low-severity, [audit findings](../audits/2026-10-13-full-audit-findings.md#domain)).

**R29 · An exceptional correction needs `finance.correct`, a non-zero amount, a reason of at least 10 characters and
an `Idempotency-Key`, and is audited with the balance before and after.** ✅ ⚠️

- Enforced at: `services/demo-api/src/services/finance.ts:284-313`; `services/demo-api/src/app.ts:851-857`;
  `packages/domain/src/schemas.ts:188-193`.
- Tested by: `services/demo-api/test/scenarios.test.ts:613`.
- Gap: API-07, ADM-14 (see R23).

**R30 · Driver earnings show confirmed money as confirmed and pending money as pending, for every payment kind.** ⚠️

« Crédité au portefeuille » and the pending banner count card rides only, so wallet and mobile-wallet credits are
missing. « Revenus nets » adds every completed ride, including failed and pending card payments.

- Enforced at: `services/demo-api/src/services/finance.ts:257-280` (`earningsOf`);
  `apps/driver/src/app/(app)/(tabs)/earnings.tsx:59`, `:69`; `apps/driver/src/app/(app)/(tabs)/index.tsx:133`
  (« Revenus nets »).
- Tested by: `services/demo-api/test/scenarios.test.ts:118`, `:156` (cash and card totals only).
- Gap: DRV-08, API-05, DRV-09. The audit's default for « Revenus nets »: confirmed money only, pending shown apart.

### Passenger wallet (as it exists, pending D5)

These rules describe the demo as built in commit `89aae18` (unchanged at `c38429d`). Whether a stored-value wallet ships at all, and on which
model, is decision D5 ([ADR-0040](../adr/0040-passenger-wallet-model.md)); the audit's default is no wallet at launch.

**R31 · The wallet is a list of entries (`pending`, `confirmed`, `failed`). Balance = sum of confirmed entries;
reserved = the pending debits. Both are stored on the record and recomputed on every read.** ⚠️

- Enforced at: `services/demo-api/src/services/prototype.ts:106-118` (`passengerWallet`); `packages/domain/src/prototype.ts:123-137`.
- Tested by: `services/demo-api/test/prototype.test.ts:77`.
- Gap: API-19; low-severity "Passenger wallet stores balance and reserved as fields" ([audit findings](../audits/2026-10-13-full-audit-findings.md#domain)).

**R32 · A top-up of 10 to 100 000 MAD goes through a payment option of the catalog enabled for the passenger's city
(« Carte bancaire », « Wallet marocain / paiement mobile », « Cash Plus », « Wafacash »). It starts `pending`, and
the mock provider confirms it on its own after 3 s (card, mobile wallet) or 8 s (agency). Until 14 Oct 2026 the
passenger confirmed or refused it herself (« Simuler la confirmation », « Simuler le refus »).** ⚠️ ❓

- Enforced at: `services/demo-api/src/services/prototype.ts` (`POST /prototype/wallet/topup`, `settleDueWalletTopups`,
  run by `deliverDueProviderJobs` on each tick); `packages/ui/src/features/prototype.tsx` (`PassengerWalletScreen`
  polls while a top-up is pending).
- Tested by: `services/demo-api/test/prototype.test.ts:77` (confirmed once; replay returns the same top-up).
- Gap: P7 (API-03, PRD-12, UI-05). See R22.

**R33 · Booking with the wallet holds the frozen total (`hold:<rideId>`) and is refused if the balance minus holds
is short (« Solde du portefeuille insuffisant. Rechargez ou choisissez un autre moyen. »). The hold is released when
the passenger cancels, when the search times out, when a scheduled booking is cancelled, expires or changes method;
it is taken again on « Relancer la recherche » and moves to the ride when a scheduled booking is dispatched.
Completion settles it for the fare.** ✅ ⚠️

A fee is debited from the wallet as a separate entry (R20).

- Enforced at: `services/demo-api/src/services/prototype.ts:119-184` (`reservePassengerWallet`, `releasePassengerWallet`,
  `settlePassengerWallet`); `services/demo-api/src/services/rides.ts:199`, `:484`, `:495`, `:626`, `:738`, `:761-763`,
  `:778`, `:793`, `:798`, `:821`.
- Tested by: `services/demo-api/test/prototype.test.ts:77` (hold and release on cancel), `:343` (release on timeout,
  hold on retry), `:285` (settlement).
- Gap: settlement rewrites the hold in place (status, amount, label, date) and release marks it `failed`, instead of
  posting new entries (API-19, [ADR-0040](../adr/0040-passenger-wallet-model.md)).

**R34 · Customer money can be refunded and is visible to finance.** ⚠️ ❓

There is no refund path: a support outcome « Remboursement accordé » moves no money. Passenger wallets are absent
from admin Finance; they appear only in `GET /admin/prototype`, which needs `config.edit`.

- Enforced at: `services/demo-api/src/app.ts:816-837` (Finance summary: drivers only);
  `services/demo-api/src/services/prototype.ts:877-889`.
- Tested by: **not tested**.
- Gap: PRD-38, ADM-17, ADM-08, PRD-14, API-14. Decision D5, [ADR-0040](../adr/0040-passenger-wallet-model.md).

### Back office

**R35 · Money figures (balances, volume, commission) are shown only to admins with `finance.read`.** ✅ ⚠️

The Finance page and the ledger require it, and list pending and failed ride payments per city; a person's detail
hides the wallet and ledger without it. The Overview shows volume and commission to any admin, and the People list
shows every driver's balance to any admin with `people.read`, which the seeded support role has.

- Enforced at: `services/demo-api/src/app.ts:816-850` (`finance.read`), `:700-707` (person detail), `:647-656`
  (Overview: no permission check), `:677`, `:688` (People list: `people.read` only, wallet for every driver);
  `services/demo-api/src/seed.ts:301` (support role).
- Tested by: `services/demo-api/test/scenarios.test.ts:591` ("authorizes every operation by role": a support agent
  gets 403 on the Finance summary and on corrections, `:600-601`). The Overview gap is **not tested**.
- Gap: API-10, PRD-27, ADM-12.

## States and transitions

**Payment** (`ride` or `cancellation_fee`), hand-coded in `services/demo-api/src/services/rides.ts` and
`services/demo-api/src/services/finance.ts` with no domain machine (low-severity "Payment status transitions are
hand-coded instead of a domain machine", [audit findings](../audits/2026-10-13-full-audit-findings.md#domain)).

| From | Event | To | By | Driver ledger |
|---|---|---|---|---|
| (none) | Cash ride completed | `pending` | Server | −commission, `ride:<id>:commission` |
| `pending` (cash ride) | Amount confirmed, equal to the fare | `confirmed` | Chauffeuse | none |
| (none) | Card ride completed | `pending` | Server | none; provider job queued |
| `pending` (card) | Provider confirms | `confirmed` | Provider | +net, `ride:<id>:net` |
| `pending` (card) | Provider refuses | `failed` | Provider | none |
| `failed` (ride) | Passenger retries with a card | new payment `pending` | Passagère | as a card payment |
| (none) | Wallet or mobile-wallet ride completed | `confirmed` at once ⚠️ | Server | +net, `ride:<id>:net` |
| (none) | Fee on a card ride | `pending` → provider | Server | on confirmation +fee net, `ride:<id>:cancel-fee` |
| (none) | Fee on a cash ride | `pending`, never resolved ⚠️ | Server | none |
| (none) | Fee on a wallet or mobile-wallet ride | `confirmed` at once ⚠️ | Server | +fee net, `ride:<id>:cancel-fee` |

`cancelled` exists in `PaymentStatus` (`packages/domain/src/entities.ts:435`) but nothing sets it.

**Recharge and withdrawal:** `pending` → `confirmed` | `failed` (`packages/domain/src/machines/transfer.ts:7-11`).
The same terminal outcome again is a duplicate; the other one is refused.

**Passenger wallet entry**

| Entry | From | Event | To |
|---|---|---|---|
| Top-up (+) | (none) | `POST /prototype/wallet/topup` | `pending` |
| Top-up | `pending` | The mock provider answers (3 s or 8 s); dev tools can force either outcome | `confirmed` or `failed` |
| Hold (−, `hold:<ref>`) | (none) | Booking, scheduling, method change or new search with the wallet | `pending` |
| Hold | `pending` | Ride completed | `confirmed`, amount rewritten to the fare |
| Hold | `pending` | Cancel, search timeout, scheduled cancel or expiry, method change | `failed` (released) |
| Fee (−, `hold:<rideId>-fee`) | (none) | Cancellation with a fee | `confirmed` at once |

## Demo vs live

- **Card outcomes** depend on the card's last 4 digits, which no screen explains: confirmed after 3 s, refused (0002),
  or pending until the dev tools resolve it (3155) ([runbooks/demo-data.md](../runbooks/demo-data.md#cards-and-payment-outcomes);
  `services/demo-api/src/services/rides.ts:520-526`).
- **Recharges** are confirmed after 3 s (card) or 8 s (agency). **Withdrawals** confirm after 8 s, or fail after 5 s
  when the payout account ends in 0000 (`services/demo-api/src/services/finance.ts`). **Passenger top-ups** are
  confirmed after 3 s or 8 s.
- **Signed callbacks** use `NAYA_PROVIDER_SECRET`; the API refuses to start with the demo secret when `NAYA_DEV=0`
  (`services/demo-api/src/main.ts:15-20`). A « Prestataire carte (production) » ride provider is seeded disabled and
  unconfigured in each city (`services/demo-api/src/seed.ts:110`).
- **Passenger wallet, mobile wallet, Cash Plus, Wafacash** are demo catalog options with no provider behind them.
  Holding customer funds in Morocco probably needs a partner licensed by Bank Al-Maghrib; confirm with counsel (audit
  D5).
- **Standalone builds** run the demo API on the phone with dev mode on (`services/demo-api/src/embedded.ts:19-21`), so
  every simulated outcome is available there; the bot's rides are cash.
- What each capability needs to go live: [status/integrations.md](../status/integrations.md) and
  [ADR-0045](../adr/0045-production-backend-and-live-integrations.md) (payments partner).

## Open questions

- **Does a stored-value passenger wallet ship, and on which model?** Ledger entries instead of in-place edits, provider
  confirmation for top-ups and mobile-wallet rides, refunds, customer funds in Finance (R3, R10, R20, R31–R34). D5,
  [ADR-0040](../adr/0040-passenger-wallet-model.md).
- **How are cash fees and payment exceptions settled?** Cash fee collection and driver credit, retrying a refused card
  fee, cash not received or partial, and whether unpaid amounts block booking (R7, R11, R18, R19). D7,
  [ADR-0041](../adr/0041-cash-and-fee-settlement.md).
- **What do no-show, the arrival fee and an aborted ride cost?** (R13, R15)
  [ADR-0042](../adr/0042-ride-exception-paths.md).
- **When does a demo payment route stay available?** The sandbox route, which no screen calls any more (R22).
  [ADR-0044](../adr/0044-demo-gating-flag-defaults-and-the-production.md).
- **When is an idempotency key rotated?** (R23) [ADR-0053](../adr/0053-idempotency-key-lifecycle.md).
- **How is Naya Famille billed and its driver paid?** Subscriptions are never charged and family trips post nothing
  (P16, DOM-16). See [family.md](family.md) and [ADR-0036](../adr/0036-naya-famille-operating-model.md).
- **How does a driver add a payout account?** No endpoint exists (R28, API-13); the audit's default is through support
  until a payout provider exists.

## Last verified

2026-10-13 @ `c38429d`, AI session (docs pass). Line numbers refer to that commit.

- Read: `packages/domain/src/{money,pricing,wallet,prototype,entities,schemas}.ts`,
  `packages/domain/src/machines/{ride,transfer}.ts`, `services/demo-api/src/services/{rides,finance,prototype}.ts`,
  `services/demo-api/src/{app,seed,main,embedded}.ts`, the passenger quote, receipt and cancel sheet, the driver
  earnings screen, the domain and demo-api tests, [FINANCE.md](../FINANCE.md), the audit and the backlog.
- Ran: `pnpm --filter @naya/domain test` (passed). A read-only probe against an in-memory demo API built from the
  working tree confirmed R11 (booking allowed with an unpaid fee), R19 (cash fee still `pending` an hour later, driver
  balance unchanged), R22 (100 000 MAD self-confirmed top-up with `devMode` off) and the R26 gap.
- Fact-checked the same day by a second AI session: every cited line re-read at `c38429d`, every link and anchor
  resolved, the probe re-run independently with the same results.
- Not checked: the e2e suite, the screens by hand, Android.
- Branch `chore/docs-foundation-and-fixes`, re-checked on 2026-10-13 (docs reconciliation): it removes the duplicate
  demo card recharge provider (R27) and nothing else in this spec's scope. None of its changes alters the payment or
  fee rules above.
