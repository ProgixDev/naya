# Glossary

French UI term ↔ English docs term ↔ code identifier. Owner: Achraf. Last verified: 2026-10-13 against branch
`chore/docs-foundation-and-fixes` (based on c38429d).

- **UI copy is French**: « vous », « passagère », « chauffeuse », amounts in MAD. **Project docs are English.**
  **Code identifiers are English.** French labels live in `packages/domain/src/labels.ts`,
  `packages/domain/src/machines/verification.ts` and `packages/domain/src/prototype.ts`, or inline in the screens.
- "Defined in" points to the type or constant. Paths are relative to the repo root.
- Add a row when a new term reaches the UI or the API, and check the identifier in code first.

## People and roles

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| passagère | passenger | `MobileRole` `'passenger'` | `packages/domain/src/entities.ts` |
| chauffeuse | driver | `MobileRole` `'driver'` | `entities.ts` |
| chauffeuse simulée | simulated driver (bot) | `DriverPresence.bot` | `services/demo-api/src/state.ts`; behaviour in `services/demo-api/src/services/bot.ts` |
| testeuse (« Ville en test · accès testeuse ») | tester: may book or drive in a city that is in test | `User.testerCities` | `entities.ts` |
| administratrice, agente support | admin, support agent | `AdminUser`, `AdminPermission` | `entities.ts` |
| la famille (« Signaler à la famille ») | parent: the passenger who subscribes to Naya Famille | `FamilyChild.passengerId`, `FamilySubscription.passengerId` | `packages/domain/src/prototype.ts` |
| enfant | child | `FamilyChild` | `prototype.ts` |
| personne autorisée | authorised recipient (may receive the child at handover) | `AuthorizedRecipient`, `FamilyChild.recipients` | `prototype.ts` |
| contact de confiance | trusted contact (named on an SOS alert) | `SafetyAlert.contactName` | `prototype.ts` |

Admin permissions (no French label in the data): `verification.decide`, `finance.read`, `finance.correct`,
`config.edit`, `support.resolve`, `safety.respond` (SOS alerts, 13 Oct), `rides.read`, `audit.read`,
`people.read` (`AdminPermission` in `entities.ts`).

## Rides and pricing

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| course | ride | `Ride` | `entities.ts` |
| devis (admin copy and API errors); « Détail du prix » on the quote screen | quote (single-use, expires) | `Quote` | `entities.ts` |
| — | frozen terms (fixed at booking) | `FrozenTerms`, `Ride.terms` | `entities.ts` |
| proposition (« Nouvelle course » notification) | offer to a driver | `DriverOffer` | `entities.ts` |
| Maintenant / Planifier | immediate / scheduled | quote-screen values `now` / `schedule` | `apps/passenger/src/app/(app)/quote.tsx` |
| réservation planifiée | scheduled booking | `ScheduledBooking` | `entities.ts` |
| point de départ; prise en charge (driver offer and ride screens) | pickup (first stop) | `Route.stops[0]` | `entities.ts` |
| arrêt (« Arrêt effectué ») | intermediate stop | `Route.stops`, `Ride.completedStops` | `entities.ts` |
| destination | destination (last stop) | `Route.stops` | `entities.ts` |
| zone desservie | service zone | `ServiceZone` | `entities.ts` |
| ville active / en test / inactive | city status | `CityStatus` `'active' \| 'test' \| 'inactive'` | `entities.ts` |
| règles (admin « Villes & règles ») | city rules (versioned) | `CityRules`, `CityConfig.rulesVersion` | `entities.ts` |
| prise en charge (fare line) | base fare | `CityRules.baseFare`, `FareBreakdown.baseFare` | `entities.ts` |
| ajustement au tarif minimum | minimum-fare adjustment | `minimumFare`, `FareBreakdown.minimumAdjustment` | `entities.ts` |
| demande élevée ×1,2 | dynamic pricing multiplier | `DynamicPricingRule.multiplierBp`, `FareBreakdown.dynamicSurcharge` | `entities.ts` |
| annulation gratuite, délai gratuit | free cancellation window | `CancellationPolicy.graceSeconds` | `entities.ts` |
| frais d’annulation | cancellation fee | `CancellationPolicy.feeAfterGrace`, `feeAfterArrival`; `RideCancellation.fee` | `entities.ts` |
| durée d’une proposition (admin Rules form), délai d’offre (rule history) | offer timeout (per city, 10–120 s) | `CityRules.offerTimeoutSeconds` | `entities.ts` |
| Naya Scooter / Naya Standard / Naya Confort | service category | `ServiceCategory` ids `scooter` / `standard` / `premium` | `defaultPrototypeCatalog()` in `prototype.ts` |
| note | rating | `Ride.rating`, `User.ratingAverage` | `entities.ts` |

## Driver money

The rules are in [FINANCE.md](../FINANCE.md). Money is integer centimes (`Centimes`), rates are basis points
(`BasisPoints`, 15 % = 1 500 bp), both in `packages/domain/src/money.ts`.

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| portefeuille (chauffeuse) | driver wallet: a projection of the ledger | `Wallet` | `entities.ts` |
| solde comptable | balance (sum of posted ledger entries) | `Wallet.balance` | `entities.ts` |
| réservé | reserved (held by pending withdrawals; not a ledger movement) | `Wallet.reserved` | `entities.ts` |
| disponible au retrait, disponible | available to withdraw | `Wallet.available` | `entities.ts` |
| dette de commission, dette | commission debt | `Wallet.debt` | `entities.ts` |
| plafond de dette | debt limit (offers blocked at or below −limit) | `CityRules.debtLimit`, `Wallet.offersBlockedByDebt` | `entities.ts` |
| commission | commission | `commissionBp`; ledger type `ride_commission` | `entities.ts` |
| revenu net, revenus nets | net earnings (fare − commission) | `EarningsSummary.net`; ledger type `ride_net_credit` | `entities.ts` |
| espèces encaissées | cash collected (kept by the driver, never in the balance) | `EarningsSummary.cashCollected` | `entities.ts` |
| crédité au portefeuille | credited to the wallet | `EarningsSummary.walletCredited` | `entities.ts` |
| grand livre | ledger | `LedgerEntry`, `LedgerEntryType` | `entities.ts` |
| recharge | recharge (driver tops up her wallet) | `Recharge`; ledger type `recharge` | `entities.ts` |
| retrait | withdrawal | `Withdrawal`; ledger type `withdrawal` | `entities.ts` |
| virement bancaire | bank transfer | provider kind `bank_transfer` | `PaymentProviderConfig` in `entities.ts` |
| compte de destination | payout account (a bank account for withdrawals) | `PayoutAccount` | `entities.ts` |
| correction exceptionnelle, régularisation | correction (needs `finance.correct` and a reason) | ledger type `correction` | `entities.ts` |
| prestataire | payment or payout provider | `PaymentProviderConfig` (`mode: 'demo' \| 'live'`) | `entities.ts` |
| réseau d’agences | agency cash network | provider kind `cash_network` | `entities.ts` |

## Passenger payments

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| moyen de paiement | payment method | `PaymentMethod`, `PaymentMethodKind` | `entities.ts` |
| espèces | cash | `'cash'` | `PaymentMethodKind` |
| carte bancaire | card (stored as a provider token and the last 4) | `'card'`, `PaymentMethod.providerToken` | `PaymentMethodKind` |
| Portefeuille Naya | passenger wallet (stored value) | `'wallet'`; `PassengerWallet` | `entities.ts`, `prototype.ts` |
| Wallet marocain (paiement mobile) | mobile wallet | payment method `'mobile_wallet'`; catalog option `demo-mobile` (kind `mobile`) | `entities.ts`, `prototype.ts` |
| Cash Plus, Wafacash | agency top-up networks (demo) | catalog options `demo-cashplus`, `demo-wafacash` (kind `agency`) | `prototype.ts` |
| recharge (Portefeuille Naya) | passenger top-up | `PassengerWalletEntry`; `POST /prototype/wallet/topup` | `prototype.ts` |
| paiement en attente / confirmé / échoué / annulé | payment status | `PaymentStatus` `pending` / `confirmed` / `failed` / `cancelled` | `entities.ts`, `labels.ts` |
| — | idempotency key (sent on every booking and money mutation) | `Idempotency-Key` header | `services/demo-api/src/app.ts` |

## Verification

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| dossier | verification case | `VerificationCase`, `VerificationSubject` `passenger_identity` / `driver_identity` / `vehicle` | `entities.ts` |
| pièce | required item (document or photo) | `VerificationItem`, `VerificationItemKey` | `entities.ts` |
| pièce d’identité · recto / verso | ID document front / back | `id_front` / `id_back` | `machines/verification.ts` |
| CIN, passeport, titre de séjour | national ID card, passport, residence permit | `IdentityDetails.documentType` `cin` / `passport` / `residence_permit` | `entities.ts` |
| selfie | selfie | `selfie` | `machines/verification.ts` |
| permis de conduire | driving licence | `driving_licence` | `machines/verification.ts` |
| carte grise | vehicle registration | `vehicle_registration` | `machines/verification.ts` |
| attestation d’assurance | insurance certificate | `insurance` | `machines/verification.ts` |
| photos du véhicule | vehicle photos | `vehicle_photos` | `machines/verification.ts` |
| à reprendre (apps), à corriger (admin) | item needs correction | `VerificationItem.status` `'needs_correction'` | `entities.ts` |

Not in the code yet: « extrait de casier judiciaire » (criminal-record extract) and « visite technique » (technical
inspection), both proposed in the founder's brief; the extract is for Naya Famille drivers only ([F3](../status/open-questions.md#f3-criminal-record-extract-scope), answered 13 Oct).

## Support and disputes

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| demande (« Vos demandes en cours »), assistance | support ticket, support | `SupportTicket` | `entities.ts` |
| litige (admin « Motifs de litige ») | dispute: a ticket about a ride or a payment | `SupportTicket.isDispute` | `entities.ts` |
| issue (admin « Issue » : « Tarif confirmé », « Rejetée »…) | ticket outcome; « Rejetée » closes the ticket as `rejected`, every other outcome as `resolved` | `TICKET_OUTCOMES`, `SupportTicket.resolution.outcome` | `services/demo-api/src/services/support.ts` |
| motif | dispute reason | `DisputeReason`, `SupportTicket.reasonId` | `prototype.ts` |
| preuve (« preuve requise », « Preuve facultative ») | evidence | `DisputeReason.evidenceRequired` | `prototype.ts` |
| pièce jointe | attachment | `SupportMessage.attachments`; upload purpose `support_attachment` | `entities.ts` |

"Pièce justificative" does not appear in the UI: the apps say « preuve » for dispute evidence and « pièce » for a
verification document.

## Safety

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| SOS · sécurité; admin « Alertes SOS » | SOS alert | `SafetyAlert`, `/prototype/sos` | `prototype.ts` |
| Urgence · police (19) | emergency call (opens `tel:19`) | — | `apps/passenger/src/features/ride/ContactSheet.tsx` |
| retard ou incident, « Signaler à la famille » | delay or incident reported to the parent (Famille trip) | `FamilyTrip.incident` | `prototype.ts` |

## Naya Famille

| Français (UI) | English (docs) | Code | Defined in |
|---|---|---|---|
| Naya Famille | family service (supervised child trips) | `/prototype/family/*`, `FamilyOverview` | `prototype.ts` |
| abonnement · Famille Essentiel, Famille Confiance | subscription, plan | `FamilySubscription`; `FamilyPlan` ids `family-essential`, `family-plus` | `prototype.ts` |
| chauffeuse dédiée | dedicated driver | `FamilySubscription.driverId` | `prototype.ts` |
| trajet | family trip | `FamilyTrip` | `prototype.ts` |
| photo d’arrivée | arrival proof | `FamilyTrip.arrivalProof` (`'demo-arrival-photo'` in demo) | `prototype.ts` |
| prise en charge (« Confirmer la prise en charge »), prénom confirmé | pickup check: the driver attests the child's first name | `FamilyTrip.pickupVerified` | `prototype.ts` |
| remise | handover to an authorised recipient | status `completed`; `FamilyTrip.recipientId` | `prototype.ts` |
| code de remise | handover code | `AuthorizedRecipient.verificationCode`; `HANDOVER_MAX_ATTEMPTS`, `FamilyTrip.handoverLocked` | `prototype.ts` |

## Status labels

| Entity | Code → French label | Defined in |
|---|---|---|
| Ride | `searching` « Recherche d’une chauffeuse » · `driver_assigned` « Chauffeuse en route » · `driver_arrived` « Chauffeuse arrivée » · `in_progress` « Trajet en cours » · `completed` « Terminée » · `cancelled` « Annulée » · `no_driver` « Aucune chauffeuse disponible » | `labels.ts` |
| Offer | `pending` « En attente » · `accepted` « Acceptée » · `declined` « Refusée » · `expired` « Expirée » · `withdrawn` « Retirée » | `labels.ts` |
| Recharge, withdrawal | `pending` « En cours » · `confirmed` « Confirmé » · `failed` « Échoué » | `labels.ts` |
| Scheduled booking | `scheduled` « Enregistrée » · `dispatched` « Course lancée » · `cancelled` « Annulée » · `expired` « Expirée » | `labels.ts` |
| Support ticket | `open` « Ouverte » · `in_progress` « En cours de traitement » · `awaiting_user` « Réponse attendue » · `resolved` « Résolue » · `rejected` « Rejetée » | `labels.ts` |
| Verification case | `draft` « À compléter » · `submitted` « Envoyé » · `in_review` « En cours d’examen » · `approved` « Approuvé » · `more_info_requested` « Complément demandé » · `rejected` « Refusé » | `machines/verification.ts` |
| SOS alert | `new` « Nouvelle » · `responding` « Prise en charge » · `resolved` « Résolue » | `SAFETY_STATUS_LABELS` in `prototype.ts` |
| Family trip | `scheduled` « Planifié » · `en_route` « Chauffeuse en route » · `arrived` « Chauffeuse arrivée » · `picked_up` « Enfant récupéré » · `in_progress` « Trajet en cours » · `completed` « Remis à une personne autorisée » | `prototype.ts` |

## Platform and demo

| Term | Meaning | Code |
|---|---|---|
| Démo (badge or banner) | marks anything simulated; never present a simulation as live | `DemoBadge`, `DEMO_MODE` (`packages/ui/src/core/apiBase.ts`) |
| standalone | native demo build with the demo API in-process | `STANDALONE_DEMO`, `EXPO_PUBLIC_STANDALONE` |
| connected | apps call the demo API on :4010 | `EXPO_PUBLIC_API_URL` |
| dev mode | fixed OTP `123456`, `/dev` routes, self-confirm routes | `NAYA_DEV`, `ctx.config.devMode` |
| prototype (in code) | the Oct 6 feedback features: categories, Famille, passenger wallet, SOS, dispute reasons, demo payment options | `packages/domain/src/prototype.ts`, `services/demo-api/src/services/prototype.ts`, `/prototype/*` routes |
| en ligne / hors ligne | driver presence | `DriverPresence.online` (`services/demo-api/src/state.ts`) |
| journal d’audit | append-only, hash-chained audit log | `AuditEvent` (`entities.ts`), `services/demo-api/src/audit.ts` |

## Words with more than one meaning

- **« prise en charge »** has three senses: the **base fare** (fare breakdown and admin Rules), an SOS alert
  **taken in charge** (`responding`), and a **pickup**: of the passenger on the driver's offer and ride screens
  (« Prise en charge à … de vous »), and of a child in Naya Famille (« Confirmer la prise en charge »).
- **« recharge »**: the driver's wallet **recharge** (`Recharge`, provider sandbox) is not the passenger's wallet
  **top-up** (`PassengerWalletEntry`, `/prototype/wallet/topup`).
- **« portefeuille »**: the driver's **wallet** (`Wallet`, a ledger projection) is not « Portefeuille Naya », the
  passenger's **stored-value wallet** (`PassengerWallet`, payment kind `wallet`).
- **« réservé » / « réservation »**: **reserved** funds (`Wallet.reserved`), a **scheduled booking**
  (`ScheduledBooking`), and « Naya est réservé aux femmes » (women-only).
- **Naya Confort** has the id `premium`. The icon is also `premium`.
- **Wallet marocain**: the catalog option is kind `mobile` (`demo-mobile`); the passenger's payment method is kind
  `mobile_wallet`; the driver's recharge provider for it is kind `cash_network`.
- **« demande »**: usually a support ticket (« Aide et demandes », « Vos demandes en cours »), but also a ride request
  while searching (« Annuler la demande », « La passagère a annulé sa demande »).

## ID prefixes

IDs are `<PREFIX>-<number>`, from `nextId()` in `services/demo-api/src/store.ts`. Exceptions: seeded admins have literal ids
(`AD-001`, `AD-002`), seeded ride history uses the series `NY-H`, and Famille recipients have free-form ids (`mother`,
`father` in the demo example).

| Prefix | Entity | Prefix | Entity |
|---|---|---|---|
| `PA` | passenger account | `DR` | driver account |
| `VP` | passenger identity case | `VD` | driver identity case |
| `VV` | vehicle case | `VE` | vehicle |
| `QT` | quote | `NY` | ride (NY-001 and NY-002 are the FINANCE.md fixtures) |
| `OF` | offer | `RP` | scheduled booking |
| `PY` | payment | `PM` | payment method |
| `LE` | ledger entry | `CO` | correction |
| `RC` | recharge | `WD` | withdrawal |
| `PO` | payout account | `PJ` | provider job (simulated provider outcome) |
| `PW` | passenger wallet entry | `SUB` | Famille subscription |
| `CH` | child | `FT` | family trip |
| `SOS` | SOS alert | `SU` | support ticket |
| `MSG` | support message | `UP` | upload |
| `AU` | audit event | `ZN` | service zone |
| `SP` | saved place | | |
