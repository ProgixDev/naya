# Naya: redesign audit (passenger and driver apps)

| | |
|---|---|
| Date | 15 October 2026 |
| Commit | `fc6f88c` on `feat/passenger-polish` |
| Scope | Passenger app, driver app and the shared screens in `packages/ui`. The admin appears only where it shares a pattern (status tones). The web prototype is out of scope. |
| Method | 1. A code sweep of every icon and label pairing (150) and every way a status is shown, with file:line references. 2. A rendered review of 168 light screens and 12 dark screens at 390×844 pt, captured from Expo web against a scratch API. 3. Both were scored against the ui-craft rules (numbers below are points on a 390-pt screen) and against this repo's tokens, which win where the two disagree. |
| Owner's brief | "We need a redesign audit to make sure the UX is enhanced. We reduce the icon + name thing and start using icons to explain the status of something. There are a lot of details we need to work on." |
| Status | Immutable snapshot. Track follow-up in `docs/status/backlog.md` (suggested prefix `RD-`), never by editing this file. |

**Fixed constraints.** French customer copy with « vous », « passagère », « chauffeuse ». No demo wording (ADR-0058). Dark-mode token rules (ADR-0023): `outline`, `line` and `hairline` for edges, no `colors.*` read at module scope. Accessibility: every icon-only control or status has an `accessibilityLabel`, no state is shown by colour alone, touch targets are 44 pt, and text follows Dynamic Type.

**Project tokens that override the generic rules.** Gutter `gutter = 20`. Control heights in `control`: major 50, standard 44, compact 36, chip 32, field 56. Type scale in `type`: screen 30, title 21, heading 18, body 16, label 15, caption 13, micro 12. Radii in `radius`: row 16, card 22, sheet 32. Spacing in `space`: 4, 8, 12, 16, 20, 24, 32, 40, 48. Where this report quotes a generic number (for example a 44-pt main button), read it as "unless the token says otherwise". R2 asks whether the 50-pt major button stays.

**Where the screenshots are.** Paths such as `shots/passenger/07a-quote.png` are relative to the session capture folder listed in the appendix. That folder is temporary and is not committed. R14 asks whether to commit it.

## Contents

1. TL;DR and design principles
2. Status icon system
3. Icon and label rules, and the 150 pairings
4. Findings by screen
5. Cross-cutting issues
6. Implementation plan
7. Owner decisions
8. Appendix: screenshot index

---

## 1. TL;DR and design principles

### TL;DR

- **Most states are shown as words in tinted pills, and they differ only by colour.** `StatusPill` (`packages/ui/src/Feedback.tsx:64`) puts the same 6-pt dot in front of every word, and the driver's `ActionNote` uses one clock for info, warning and neutral (`apps/driver/src/components/Kit.tsx:149-155`). Toasts carry no icon at all. A single domain `statusPresentation(kind, state)` plus a `StatusIcon` component would give each of about 90 states (17 status enums and 10 other states) its own glyph shape, a tone token and a short word. The admin's tone tables could use the same map.
- **About half of the icon and label pairings should change.** Of 150 pairings, 41 drop a decorative icon, 34 merge an icon and a word into one state glyph, 6 become icon-only, and 69 keep both because the icon says something (place type, payment method, action). 17 of those 69 need a different or an added glyph. The pattern to remove is the 32–40 pt icon disc beside every settings, help and account row, and the leading icons in form fields.
- **Rows and screens say the same thing two to four times.** Examples: a clock plus an « En vérification » chip on 8 dossier rows (`43b`), and a header, hero, subtitle and banner on the verification status screen (`04c`). Other examples are the receipt's pill plus banner and the Famille pill plus title. The rule becomes one signal per row and one status line per screen, with banners kept for problems.
- **Four screens matter most and need real redesign, not polish.** The quote (`07a`) has options without prices and the fare below the fold. The live ride (`16b`) shows the plate as a 12-pt chip, and recognising the plate is the core safety check. Passenger home (`05a`) has 9 choices against a budget of 5. The SOS sheet (`16o`) has a 40-pt alert button, raw coordinates, and an SOS pill that scrolls away and gets covered.
- **Fix the shared layer first.** Five shared pieces repair most screens by themselves: `StatusIcon`, the list row (one signal, a check for choices instead of a chevron), the screen frame (collapsing title, tab-bar inset, toast anchoring), a pinned safety disc with its SOS sheet, and the quote option row. Section 6 splits the work into 13 batches with disjoint file sets, so most of them can run in parallel.

### Design principles for the redesign

1. **One job and one filled primary per screen state.** Cancel and secondary actions are text, or a 36-pt grey button. Two equal buttons never sit side by side unless they are a strict pair.
2. **Icons carry state; text carries detail.** A state is a glyph. Its word goes to the screen reader everywhere, and on screen only where the state is new to the user: the hero of a detail screen, or the first time it appears in a flow. In lists and rows, where the same state repeats, the glyph stands alone.
3. **Problems always keep their words.** Failed, refused, to fix, no driver, blocked and expired show a glyph, a word, the reason and one move (« Renvoyer », « Recharger 150 MAD »).
4. **Each state in an enum has its own shape.** Colour adds meaning and never carries it alone (WCAG 1.4.1). Each glyph keeps one meaning across both apps (vocabulary in §2.2).
5. **No decorative icons.** An icon appears only when it says something the label does not: place type, payment method, state, direction of money, or an action. There are no icon discs on settings, help or account rows, and no icons inside form fields except a picker's trailing chevron.
6. **Actions keep their labels.** Tab bars, wallet actions and ride actions keep icon plus label (ui-craft rule 12). Only back, close, locate, send, in-place delete and call may stand alone, and each has an `accessibilityLabel`. The owner's "reduce icon + name" applies to states and decorations, not to actions.
7. **One signal per row, and counts in the section header.** A row shows its state once, either as its leading glyph or as a trailing glyph. A section header gives the count (« 8 pièces en vérification »).
8. **A chevron means "opens another screen".** A choice shows a check or a radio. Selected means a 2-pt accent outline plus a check, never a tint alone (rule 20).
9. **Say it once per screen.** Header, hero, pill and banner never repeat each other. Banners are for problems, and for facts the screen shows nowhere else.
10. **Safety is pinned, red and never covered.** The SOS entry never scrolls away, toasts and cards never cover it, and the 19 call is never the primary action of an unrelated sheet.
11. **On money screens the number is the hero.** It uses tabular figures and is never truncated (`adjustsFontSizeToFit`, minimum scale 0.8). Colour lives inside the number, not on the buttons.
12. **Customer UI shows customer things.** No rule versions, raw coordinates, logo boards or values the server owns (the hard-coded 30 s).

---

## 2. Status icon system

### 2.1 Icon set

- The set is `lucide-react-native` 1.48.0, imported directly in 55 files. There is no shared `Icon` component today.
- Every glyph below exists in 1.48.0 under the canonical name used here (checked against `node_modules/lucide-react-native/dist/types/lucide-react-native.d.ts`). Three names the code sweep proposed survive only as deprecated aliases. Use the canonical names: `ShieldQuestionMark` (not ShieldQuestion), `MessageCircleQuestionMark` (not MessageCircleQuestion) and `FileExclamationPoint` (not FileWarning).
- The code already mixes deprecated aliases with current names: `CheckCircle2`, `XCircle`, `AlertTriangle`, `Home`, `BarChart3` and `Clock3` sit next to `CircleAlert` and `House`. New code uses `CircleCheck`, `CircleX`, `TriangleAlert`, `House` and `ChartColumn`. The passenger tab bar imports `Home` and the driver tab bar imports `House`.
- One stroke width everywhere: 2 (§5.3).

### 2.2 Glyph vocabulary: one meaning per glyph, across both apps

| Glyph | Means | Never use it for |
|---|---|---|
| `CircleCheck` | done, paid, confirmed, approved (a document) | bullets, reassurance lines (`CaptureGuide.tsx:126`, passenger `ride.tsx:172`) |
| `BadgeCheck` | a verified person or eligibility (identity approved, Famille approved, « Compte vérifié ») | a finished task |
| `CircleX` | failed or refused: a problem, always with a word | cancellation by a person |
| `CircleSlash` | cancelled or withdrawn by someone, with no fault | failure |
| `CircleDashed` | not started, missing, to add | |
| `Hourglass` | waiting on someone else (provider, operator, other parent) | durations |
| `Clock` | a duration or an ETA only (« 5 min », « Fin prévue ») | any state. It is the status icon today in Kit, Dossier and `wallet.tsx:37/40`, and that stops. |
| `Send` | sent by you, not yet opened | |
| `ScanSearch` | being reviewed by a person | |
| `CircleAlert` | needs your action (« À reprendre »), with a word | |
| `TriangleAlert` | a warning about conditions (unstable connection, high demand) | |
| `TimerOff` | expired | |
| `Lock` / `LockOpen` | money held for a ride / released; `Lock` alone also means "secure" on the card form | « Paiement en cours » (`recharge/sandbox/[id].tsx:44`) |
| `CalendarClock` | a booking for later | « Planifier » with a map pin (`ride.tsx:178` uses `MapPinned`) |
| `Phone` | places a call (19, 15, 177, the driver) | `ShieldAlert` on call rows (`help/[topic].tsx:28`, `ContactSheet.tsx:32`) |
| `Siren` | SOS / safety alert | |
| `LifeBuoy` | help and support | `MessageCircle` for help (`help/index.tsx:23`, `receipt/[id].tsx:129`) |
| `ArrowUpRight` | nothing. Retire it. Today it means « Retirer », a card chevron and « Continuer ». | |
| `Plus` / `Landmark` | « Recharger » / « Retirer » in the driver wallet | |

### 2.3 Tones

`StatusTone` maps to tokens. Read them in render or inside `themedStyles`, never at module scope.

| Tone | Glyph and word | Disc fill | When |
|---|---|---|---|
| `accent` | `accent` | `selected` | live, in motion (en route, in progress) |
| `info` | `info` | `infoSoft` | waiting on someone else |
| `success` | `success` | `successSoft` | done, paid, approved |
| `warning` | `warning` | `warningSoft` | the viewer must act, or something is late |
| `danger` | `danger` | `dangerSoft` | failed, refused, blocked |
| `neutral` | `muted` | `mauveSoft` | ended with no fault (cancelled, declined, expired by choice), not started |

These rules settle the tone conflicts the sweep found (inventory D4). R5 asks the owner to confirm them.

- **Ride cancelled:** neutral everywhere. Today the driver shows danger (`rides/[id].tsx:30`) and the admin neutral.
- **Scheduled booking cancelled:** neutral. Today the passenger shows danger.
- **Payment pending:** info everywhere. Today it is warning in `paymentReceiptState` and the admin, and info in `ride-end/[id].tsx:68`. The driver's cash confirmation is carried by her button, not by the tone.
- **Verification in_review:** info. Today the admin shows accent.
- **Famille eligibility pending:** info. Today `FamilleScreen.tsx:109` shows warning and `docs/famille.tsx:49` shows info.
- **Car wash « Lavage en cours »:** accent. Today it is warning (`carWash.tsx:69`), but nothing is wrong.
- **Famille trip:** one mapping from `statusPresentation`, replacing the four mappings today (`FamilleScreen.tsx:123`, `FamilleTripScreen.tsx:38`, `FamilleFollowScreen.tsx:42`, driver `(tabs)/index.tsx:140`).
- **Neutral, non-problem states** never use warning: Famille en route, washing, « ville en test ».

### 2.4 State tables

★ marks a problem state. Its word is always visible next to the glyph, whatever the size. « Mot » is the short word shown in a chip or the first-time hint. « Lecteur d'écran » is the `accessibilityLabel`. Today it comes from the label maps in `packages/domain/src/labels.ts` and its siblings.

**C1. RideStatus** (`labels.ts:3`)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| searching | `Radar`, pulsing | info | Recherche | Recherche d'une chauffeuse | passenger ride top chip, home resume card, admin rides |
| driver_assigned | `CarFront` | accent | En route | Chauffeuse en route | same, driver ride header |
| driver_arrived | `MapPinCheck` | accent | Arrivée | Chauffeuse arrivée | same |
| in_progress | `Navigation` | accent | En cours | Trajet en cours | same |
| completed | `CircleCheck` | success | Terminée | Course terminée | passenger history, driver rides list, receipt, driver end screen (today `MapPin`, `ride.tsx:234`) |
| cancelled | `CircleSlash` | neutral | Annulée | Course annulée | same |
| no_driver ★ | `CircleOff` | warning | Aucune chauffeuse | Aucune chauffeuse disponible | passenger ride, home resume card |

**C2. OfferStatus** (`labels.ts:13`, unused on mobile today)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| pending | `Hourglass` | info | En attente | Offre en attente de réponse | driver dashboard note, admin offers |
| accepted | `CircleCheck` | success | Acceptée | Offre acceptée | driver offer end hero (today `Clock3` in green, `offer.tsx:80`) |
| declined | `CircleX` | neutral | Refusée | Vous avez refusé l'offre | driver offer end hero |
| expired | `TimerOff` | neutral | Expirée | Le délai de réponse est écoulé | same |
| withdrawn | `Undo2` | neutral | Retirée | La passagère a annulé sa demande | same |
| taken (UI only) | `CircleSlash` | neutral | Déjà attribuée | Course déjà attribuée | same |

**C3. PaymentStatus** (`labels.ts:21`). Shown as the payment-method glyph with a 12-pt state badge at its bottom-right (§2.6).

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| pending | `Hourglass` | info | En attente | Paiement en attente | receipt, driver ride end, driver ride detail, earnings rows, car-wash order |
| confirmed | `CircleCheck` | success | Payé | Paiement confirmé | same |
| failed ★ | `CircleX` | danger | Échoué | Paiement échoué | same, plus « Réessayer » |
| cancelled | `CircleSlash` | neutral | Annulé | Paiement annulé | same |

**C4. TransferStatus** (`labels.ts:28`; driver recharges and withdrawals). The leading glyph is the type (`Plus` recharge, `Landmark` withdrawal) and the state is the trailing glyph.

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| pending | `Hourglass` | info | En cours | Opération en cours | wallet in-flight rows (today one `Clock` for both types), ledger detail, recharge/withdraw detail hero |
| confirmed | `CircleCheck` | success | Confirmé | Opération confirmée | same |
| failed ★ | `CircleX` | danger | Échoué | Opération échouée | same, with the reason |

**C5. ScheduledStatus** (`labels.ts:34`)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| scheduled | `CalendarClock` | info | Enregistrée | Réservation enregistrée, chauffeuse à confirmer | trips upcoming card (trailing), scheduled detail hero |
| dispatched | `CalendarCheck` | accent | Course lancée | Course lancée | same |
| cancelled | `CalendarX` | neutral | Annulée | Réservation annulée | trips history, detail |
| expired ★ | `TimerOff` | warning | Expirée | Réservation expirée, aucune chauffeuse | same |

**C6. SupportStatus** (`labels.ts:41`)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| open | `Inbox` | info | Ouverte | Demande ouverte | support list (trailing), thread header |
| in_progress | `Hourglass` | info | En cours | En cours de traitement | same |
| awaiting_user ★ | `MessageCircleQuestionMark` | warning | Réponse attendue | Nous attendons votre réponse | same, plus a composer focus |
| resolved | `CircleCheck` | success | Résolue | Demande résolue | same |
| rejected ★ | `CircleX` | danger | Rejetée | Demande rejetée | same, with the reason |

**C7. VerificationStatus** (`STATUS_LABELS`, `machines/verification.ts:59`; passenger identity and driver dossier)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| draft | `CircleDashed` | neutral | À compléter | Dossier à compléter | verification status hero (56 disc), driver account hero |
| submitted | `Send` | info | Envoyé | Dossier envoyé | same (today `Clock3`, the same as in_review) |
| in_review | `ScanSearch` | info | En examen | Dossier en cours d'examen | same |
| approved | `BadgeCheck` | success | Approuvé | Dossier approuvé | same, plus the « Compte vérifié » seal |
| more_info_requested ★ | `FileExclamationPoint` | warning | Complément demandé | Un complément est demandé | same, with what is missing and « Compléter » |
| rejected ★ | `CircleX` | danger | Refusé | Dossier refusé | same, with the reason and « Aide » |

**C8. DocumentStatus** (`signup.ts:40`; driver dossier rows)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| missing | `CircleDashed` | neutral | Manquant | Pièce manquante | dossier and sign-up hub rows, leading only (no chip) |
| sent | `Send` | info | Envoyé | Pièce envoyée | same (today `UploadCloud` plus a chip) |
| in_review | `ScanSearch` | info | En vérification | Pièce en vérification | same (today `Clock` plus a chip) |
| approved | `CircleCheck` | success | Approuvé | Pièce approuvée | same |
| rejected ★ | `CircleX` | danger | Refusé | Pièce refusée, à renvoyer | same, with the reason line and « Renvoyer » |

**C9. VerificationItem.status** (`entities.ts:121`; no label map today, the passenger UI uses ok, fix and todo)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| missing | `CircleDashed` | neutral | À ajouter | Pièce à ajouter | passenger `(verify)/review.tsx` |
| provided | `CircleCheck` | success | Ajoutée | Pièce ajoutée | same (drop the visible word « Ajoutée ») |
| accepted | `BadgeCheck` | success | Validée | Pièce validée | same |
| needs_correction ★ | `CircleAlert` | warning | À reprendre | Pièce à reprendre | same, with the reason |

**C10. FamilleEligibility** (`famille.ts:17`; driver)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| not_requested | `CircleDashed` | neutral | Non demandée | Agrément Famille non demandé | driver account row, `docs/famille.tsx` |
| pending | `ScanSearch` | info | En examen | Agrément Famille en cours d'examen | same, driver home Famille card |
| approved | `BadgeCheck` | success | Approuvée | Agrément Famille approuvé | same |
| rejected ★ | `CircleX` | danger | Refusée | Agrément Famille refusé | same, with the reason |

**C11. FamilyTripStatus** (`prototype.ts:356`). Today's labels are too long for chips (« Départ en attente de l'accord du parent »). Add a `shortLabel` and keep the long one for the screen reader.

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| scheduled | `CalendarClock` | info | Planifié | Trajet planifié | Famille home card, TripCard, history, follow screen, driver dashboard |
| en_route | `CarFront` | accent | En route | Chauffeuse en route | same |
| arrived | `MapPinCheck` | accent | Arrivée | Chauffeuse arrivée | same |
| picked_up | `UserCheck` | accent | Récupéré | Enfant récupéré | same |
| awaiting_approval ★ | `ShieldQuestionMark` | warning | Votre accord | Départ en attente de votre accord | same; the driver reads « Accord du parent attendu » |
| in_progress | `Navigation` | accent | En cours | Trajet en cours | same (today `School`) |
| completed | `CircleCheck` | success | Déposé | Déposé, photo et remise confirmées | same (`School` stays the destination marker only) |
| cancelled | `CircleSlash` | neutral | Annulé | Trajet annulé | same |

**C12. FamilyStartApproval.status** (`prototype.ts:113`, no labels today)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| pending ★ | `ShieldQuestionMark` + countdown ring | warning | Accord attendu | Accord attendu, N secondes restantes | approval card (`parts.tsx:260`) |
| approved | `ShieldCheck` | success | Départ autorisé | Départ autorisé | journal, trip screen |
| refused ★ | `ShieldX` | danger | Départ refusé | Départ refusé | same |
| expired ★ | `TimerOff` | warning | Délai dépassé | Délai de réponse dépassé | same |

**C13. Guardian status** (`prototype.ts:207`, text only today)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| invited | `Send` | info | Invitation envoyée | Invitation envoyée | guardian rows (`parts.tsx:505`, today a `UserPlus` disc on every row) |
| active | `UserCheck` | success | Suivi ouvert | Suivi ouvert | same |
| revoked | `CircleSlash` | neutral | Accès retiré | Accès retiré | same |

**C14. Famille subscription** (`prototype.ts:86`, no labels today)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| active | `CircleCheck` | success | Active | Formule active | plans screen: the current plan gets an outline plus a check (rule 20) instead of the « Votre formule » pill |
| paused | `CirclePause` | neutral | En pause | Formule en pause | same |

**C15. WashOrderStatus** (`carWash.ts:280`)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| booked | `CalendarClock` | info | Réservé | Lavage réservé | order rows, order header, timeline |
| washer_assigned | `UserCheck` | accent | Équipe assignée | Équipe de lavage assignée | same |
| en_route | `Van` | accent | En route | Équipe en route | same |
| washing | `Droplets`, pulsing | accent | En cours | Lavage en cours | same (today the warning tone) |
| completed | `CircleCheck` | success | Terminé | Lavage terminé | same |
| cancelled | `CircleSlash` | neutral | Annulé | Lavage annulé | same |

**C16. SafetyAlert.status** (`prototype.ts:270`)

| State | Glyph | Tone | Mot | Lecteur d'écran | Where |
|---|---|---|---|---|---|
| new | `Siren` | danger | Envoyée | Alerte envoyée | SOS sheet after sending (today an info banner whatever the state, `prototype.tsx:229`) |
| responding | `ShieldCheck` | accent | Prise en charge | Alerte prise en charge | same |
| resolved | `CircleCheck` | success | Résolue | Alerte résolue | same |

ADR-0058: in standalone builds no desk receives the alert, so the sheet must not show « Prise en charge » unless the server says so. The glyph follows the server state and never a timer.

**C17. PassengerWalletEntry.status** (`prototype.ts:316`; labels hard-coded in `ui/features/prototype.tsx:269`). The leading glyph is the direction (`ArrowDownLeft` for credit, `ArrowUpRight` is retired, so use `Car` or `Droplets` for debits, by what was paid). The state is trailing.

| Direction · state | Glyph | Tone | Mot | Lecteur d'écran |
|---|---|---|---|---|
| debit · pending | `Lock` | info | Réservé | Montant réservé pour votre course |
| debit · confirmed | `CircleCheck` | success | Payé | Payé |
| debit · failed | `LockOpen` | neutral | Libéré | Montant libéré, rien n'a été débité. Today this reads only « Libéré », which hides that the payment did not happen (R11). |
| credit · pending (online) | `Hourglass` | info | En cours | Recharge en cours de confirmation |
| credit · pending (agency) | `Store` | info | À payer en agence | En attente du paiement en agence |
| credit · confirmed | `CircleCheck` | success | Créditée | Recharge créditée |
| credit · failed ★ | `CircleX` | danger | Refusée | Recharge refusée |

**C18. LedgerEntryType** (`entities.ts:550`; `ui/Ride.tsx:278`). These are types, not states. Keep a leading 40 disc and change two glyphs.

| Type | Today | Proposed |
|---|---|---|
| ride_commission | Banknote | `Percent` (it is Naya's cut, not cash) |
| ride_net_credit | CreditCard | `Car` |
| cancellation_fee_credit | Receipt | `ReceiptText` |
| recharge | ArrowDownLeft | `Plus` |
| withdrawal | ArrowUpRight | `Landmark` |
| correction | Wrench | `Wrench` |
| car_wash | Droplets | `Droplets` |
| car_wash_refund | ArrowDownLeft (same as recharge) | `Undo2` |

Credit versus debit is shown by the sign and by the tint (`success` only on incoming money, rule 19), never by the tint alone.

**C19. Payment methods.** There is one presentation in `packages/domain/src/payments.ts` (`paymentMethodPresentation`, icon names banknote, credit-card, wallet, smartphone). Map those names to components once, in `packages/ui` (`paymentIcon(name)`), and delete the 4 copies of `PAY_ICONS` (`quote.tsx`, `receipt/[id].tsx:14`, `scheduled/[id].tsx:16`, `payments.tsx:14`). The driver app uses the same presentation instead of its cash-or-« Carte » binary: `offer.tsx:120`, `rides/index.tsx:34`, `ledger/[id].tsx:50`, `rides/[id].tsx:42`, `earnings.tsx:69`, and `ride.tsx:189` (a raw label, against P14). `WashPaymentKind` (`carWash.ts:300`) gets the same icons.

**C20. Other states without label maps**

| State | Glyph | Tone | Mot | Where |
|---|---|---|---|---|
| Driver online | `Radar`, pulsing | success | En ligne | driver home status row, 24 pt (today a 12-pt dot) |
| Driver offline | `PowerOff` | neutral | Hors ligne | same |
| Driver blocked ★ | `Lock` | danger | Bloquée | same, with the reason and the unblocking action (D-06) |
| Account suspended ★ (`User.status`) | `Ban` | danger | Compte suspendu | driver home reason card, account |
| City in test (`CityStatus`) | `FlaskConical` | info | En test | city picker trailing, word kept (it is information, not a state the user knows) |
| Location permission off ★ | `MapPinOff` | warning | Localisation désactivée | home, with « Activer » |
| Tracking stale ★ | `WifiOff` | warning | Position en attente | passenger ride, Famille GPS (today one `Signal` glyph that turns from green to amber, `parts.tsx:77`) |
| Preferred payment method | `Check` trailing | accent | Préféré | payments (today a pill repeating the subtitle) |
| Selected city | `Check` trailing | accent | Sélectionnée | city sheet (today a green pill) |
| Verified account | `BadgeCheck` 16 beside the name | success | Compte vérifié | passenger account (today a pill) |

**C21. Admin.** `apps/admin/src/components/status.tsx` keeps 7 tone tables (vTone, rTone, pTone, tTone, sTone, oTone, bTone) on a dot `Badge` (`ui.tsx:101`). It reads the same `statusPresentation` and draws the glyph with `lucide-react` from the same name. R9 asks whether this happens in this round.

### 2.5 Motion

Use only animations that are cheap in React Native: `Animated` with `useNativeDriver: true` on opacity, scale and rotation. All of them stop when Reduce Motion is on (`useA11yPrefs().reduceMotion`, `packages/ui/src/a11y.ts`).

| State | Motion | Cost |
|---|---|---|
| Ride searching (`Radar`) | the glyph's ring pulses: scale 1 → 1.25 and opacity 0.5 → 0 over 1.6 s, looped | native driver, one view |
| Driver online (`Radar`) | the same pulse, 2.4 s | same |
| Wash in progress (`Droplets`) | opacity 1 → 0.6, 1.2 s | same |
| Loading in a row (rare) | `LoaderCircle` rotating 360° per 0.9 s | same |
| Driver en route | none on the glyph. The car already moves on the map; animating the glyph too would be a second motion for one change. | — |

### 2.6 Shared API proposal

**Domain** (new `packages/domain/src/status.ts`, with no UI imports):

```ts
export type StatusKind =
  | 'ride' | 'offer' | 'payment' | 'transfer' | 'scheduled' | 'support'
  | 'verification' | 'document' | 'verificationItem' | 'familleEligibility'
  | 'familyTrip' | 'familyApproval' | 'guardian' | 'familleSubscription'
  | 'wash' | 'safetyAlert' | 'walletEntry' | 'driverAvailability' | 'account';
export type StatusTone = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type StatusGlyph = 'circle-check' | 'circle-x' | 'circle-slash' | 'hourglass' | /* … kebab names from §2.4 */ string;
export interface StatusPresentation {
  label: string;      // full French label, used as the accessibilityLabel (from labels.ts)
  shortLabel: string; // chip word, ≤ 18 characters
  tone: StatusTone;
  glyph: StatusGlyph; // kebab-case lucide name; the UI maps it to a component
  problem: boolean;   // true → the word is always visible
  motion?: 'pulse' | 'spin';
}
export function statusPresentation<K extends StatusKind>(kind: K, state: StateOf<K>): StatusPresentation;
```

- Unit tests: every state of every enum has an entry, and no two states of one kind share a glyph. That second test is the "colour is never the only cue" guarantee.
- `labels.ts` stays the source of the long labels; `statusPresentation` reads them.

**UI** (new `packages/ui/src/StatusIcon.tsx`):

```tsx
<StatusIcon kind="ride" state={ride.status} size="sm" />                     // 16 glyph, inline in text
<StatusIcon kind="document" state={doc.status} size="md" />                  // 20 glyph, row trailing or leading
<StatusIcon kind="verification" state={s} size="lg" variant="disc" />        // 56 disc with a 28 glyph, screen hero
<StatusIcon kind="payment" state={p.status} badgeOn={<PaymentGlyph method={m} />} /> // method glyph + 12 badge
<StatusIcon kind="support" state={t.status} showLabel />                     // glyph + word chip, 28 tall
```

- `showLabel` defaults to `'auto'`: the word shows when `problem` is true. `true` forces the chip, for heroes and first sight; `false` forces glyph-only.
- `variant`: `'bare'` (default) or `'disc'`, which uses the tone's soft fill. Discs come in 40 (row leading) and 56 (hero) only.

**Accessibility rules for `StatusIcon`:**

1. The glyph alone: `accessible`, `accessibilityRole="image"`, `accessibilityLabel={p.label}`. With a visible word, the word is the label and the glyph is hidden (`importantForAccessibility="no-hide-descendants"` on the SVG), so the state is never read twice.
2. Inside a pressable row, the row is the accessible element. Rows compose their label with the helper `statusA11y(kind, state)`, for example `accessibilityLabel={\`${title}, ${statusA11y('document', s)}\`}` gives « Permis de conduire, pièce en vérification ». `ListRow` gets a `status` prop that does this itself.
3. Glyph sizes scale with `PixelRatio.getFontScale()`, clamped to 1–1.4, so they keep pace with Dynamic Type next to text. Chip words use the `caption` token (13), never `micro` (12), because the word carries meaning (rule 23).
4. Status changes that the user is waiting for (ride status, approval, payment) announce the new label through the live-region helper (UI-08): `AccessibilityInfo.announceForAccessibility` on iOS.
5. Contrast: the glyph uses the tone's text token (≥ 4.5:1 on surface in both schemes), never the soft fill.

**Migration**

- `StatusPill` becomes a thin wrapper over `StatusIcon` with `showLabel`, and is marked deprecated.
- `StatusBanner` takes its glyph from the same map, through an optional `kind` and `state`, or keeps its tone icon for free text. Its tone map changes: info `Info`, success `CircleCheck`, warning `TriangleAlert`, danger `CircleX`, neutral `Info`.
- The driver's `ActionNote` (`Kit.tsx:149`) drops its own map and reuses the banner map, so warning never shows a clock again.
- `Toast` gains the tone glyph (16, leading) and uses `success` for confirmations (« Carte ajoutée », « Merci pour votre note »). Today only 2 of 77 call sites use success.

---

## 3. Icon and label rules, and the 150 pairings

### 3.1 Rules

| Verdict | Use it when | Example |
|---|---|---|
| **REMOVE-ICON** | The icon repeats the label or decorates it (settings rows, help topics, form fields, list rows of one kind, CTA arrows). | « Moyens de paiement » with a `CreditCard` disc → text row. |
| **ICON-ONLY** | The icon is a universal control or a state already named on the screen, and it has an `accessibilityLabel`. | « Compte vérifié » pill → `BadgeCheck` 16 beside the name. |
| **MERGE** | Icon and word say one state twice. The state glyph replaces both; the word goes to the screen reader, or stays visible only for problems or first sight. | Dossier row `Clock` + « En vérification » chip → one `ScanSearch` glyph. |
| **KEEP-BOTH** | The icon adds information (place type, payment method, a direction of money) or it is an action, which keeps its label (rule 12). | « Retirer » / « Recharger » with their glyphs. |
| **KEEP-BOTH (fix)** | As above, but the glyph is wrong or missing. | Help call rows: `ShieldAlert` → `Phone`. |

**Sizes inside the rules.** Bare row-leading icons are 24 (`route.tsx:110`, `payments.tsx:52`, `places.tsx:54`, `carWash.tsx:358` drift between 18 and 20). Row discs are 40 with a 20 glyph. Inline glyphs are 16. Trailing state glyphs are 20. A list uses one style only: all bare or all discs (rule 4).

### 3.2 The pairings, by screen

Today's file and line are from the code sweep at `fc6f88c`. Already compliant and not listed: header back and close, sheet close, Trash2 deletes, locate, camera close and switch, support send and attachment remove, the driver ride call and navigate discs (see D-12 for their labels), and the stars.

**packages/ui primitives**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A1 | `Feedback.tsx:40,52` | StatusBanner tone icon + title | MERGE | Success and info banners become one line with a glyph; only problems keep a title plus a sentence. |
| A2 | `Feedback.tsx:68-72` | StatusPill dot + word | MERGE | The per-state glyph replaces the dot (§2.6). |
| A3 | `Feedback.tsx:109` | ErrorState WifiOff or AlertTriangle disc 56 + title | KEEP-BOTH | Problems keep their words. |
| A4 | `Ride.tsx:63-74` | RouteStopRow marker + « · effectué » | MERGE | A done stop becomes a check marker; drop « · effectué ». |
| A5 | `Ride.tsx:192-194` | DriverCard Star + « 4,8 · Chauffeuse » | KEEP-BOTH | Drop the word « Chauffeuse ». |
| A6 | `Ride.tsx:278-299` | TransactionRow type disc + label | KEEP-BOTH | Glyphs per C18; the sign plus tint shows the direction. |
| A7 | `WelcomeJourney.tsx:75` | ShieldCheck 14 + slide note | REMOVE-ICON | Drop the note (P-01). |
| A8 | `WelcomeJourney.tsx:79` | ArrowUpRight on « Continuer / Commencer » | REMOVE-ICON | The arrow means « Retirer » elsewhere. |
| A9 | `DocumentPicker.tsx:48-51` | IdCard, BookUser, FileUser + CIN / Passeport / Titre de séjour | KEEP-BOTH | |
| A10 | `Form.tsx:150` | DateField CalendarDays | REMOVE-ICON | It is a masked text field, not a picker. |

**Car wash** (`packages/ui/src/features/carWash.tsx`)

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A11 | `:81-92` | CarWashEntry Droplets disc 36 | KEEP-BOTH | Disc 40. |
| A12 | `:358` | MapPin on every saved place | KEEP-BOTH (fix) | `House`, `Briefcase`, `Star` as in `route.tsx:110`. |
| A13 | `:363` | LocateFixed « Ma position » | KEEP-BOTH | As a row, not a tile (P-54). |
| A14 | `:364` | MapPin « Choisir sur la carte » | KEEP-BOTH | Same. |
| A15 | `:395` | Clock 13 « N min » | KEEP-BOTH | Clock = duration (§2.2). |
| A16 | `:403` | Check on package includes | KEEP-BOTH | Famille plans adopt the same check (§5.9). |
| A17 | `:596` | Clock « Arrivée dans ~N min » | KEEP-BOTH | |
| A18 | `:612` | Droplets disc 44 + team name | REMOVE-ICON | Use the team avatar 40. |
| A19 | `:669` | Timeline dot with Check | MERGE | The model to copy: filled check = done, ring = current, hollow = to do. Becomes the shared `Timeline`. |

**Support, SOS, capture**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A20 | `support.tsx:141` | Paperclip « Photo » | KEEP-BOTH (fix) | `ImageIcon` as in `capture.tsx:175`. |
| A21 | `support.tsx:142` | « PDF » with no icon | KEEP-BOTH (fix) | Add `FileText`. |
| A22 | `support.tsx:202` | MessageCircle + author name | REMOVE-ICON | |
| A23 | `prototype.tsx:165` | « SOS · sécurité » with no icon | KEEP-BOTH (fix) | Becomes the pinned `Siren` safety disc labelled « Sécurité » (X-02). |
| A24 | `prototype.tsx:210,244` | « Appeler le 19 (police) » with no icon | KEEP-BOTH (fix) | Add `Phone`. |
| A25 | `CaptureGuide.tsx:126` | CheckCircle2 as tip bullets | REMOVE-ICON | The glyph means "done". |
| A26 | `capture.tsx:161` | RotateCcw « Reprendre », guided mode only | KEEP-BOTH (fix) | Show it in every mode. |
| A27 | `capture.tsx:166` | Camera « Prendre une photo » | KEEP-BOTH | |
| A28 | `capture.tsx:175` | ImageIcon « Galerie » | KEEP-BOTH | |
| A29 | `capture.tsx:180` | FileText « PDF » | KEEP-BOTH | |

**Famille** (`packages/ui/src/features/famille`)

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A30 | `FamilleHomeCard.tsx:27-29` | fixed ShieldCheck 22 + StatusPill | MERGE | The leading glyph becomes the trip state (C11); drop the pill and the warning border. |
| A31 | `FamilleScreen.tsx:61` | ShieldCheck banner « Un trajet en confiance » | REMOVE-ICON | Remove the banner for subscribers (P-43). |
| A32 | `FamilleScreen.tsx:94` | History disc on every row + « Enfant · statut » | MERGE | Leading state glyph; title = child and date. |
| A33 | `FamilleScreen.tsx:128 + :136` | TripCard pill + TripStatusLine icon | MERGE | Keep the icon line, drop the pill. |
| A34 | `FamilleScreen.tsx:257` | CalendarClock in the primary button | REMOVE-ICON | |
| A35 | `FamilleScreen.tsx:302` | Baby disc on each child | REMOVE-ICON | Initial avatar 40. |
| A36 | `FamilleScreen.tsx:352` | « Votre formule » pill | MERGE | Outline plus check on the current plan (C14). |
| A37 | `parts.tsx:77` | Signal or Clock « GPS · il y a N s » | KEEP-BOTH | Stale = `WifiOff` plus a word, not a colour change (C20). |
| A38 | `parts.tsx:84` | MapPin or School « Prise en charge / École dans N » | KEEP-BOTH | |
| A39 | `parts.tsx:260` | ShieldCheck disc « X demande à démarrer » | MERGE | `ShieldQuestionMark` plus the countdown ring (C12). |
| A40 | `parts.tsx:328` | Eye / EyeOff on the handover-code chip | ICON-ONLY | Already done, with a label. |
| A41 | `parts.tsx:392` | MessageCircle « WhatsApp / Demander un appel » | KEEP-BOTH | |
| A42 | `parts.tsx:396` | ShieldAlert « Police 19 » | KEEP-BOTH (fix) | `Phone`, and it moves into the safety sheet (P-63). |
| A43 | `parts.tsx:398` | UserPlus « Inviter » | KEEP-BOTH | As a row (P-42). |
| A44 | `parts.tsx:505` | UserPlus disc on every guardian + state text | MERGE | Trailing guardian glyph (C13). |
| A45 | `FamilleTripScreen.tsx:222` | Camera « Photographier X » | KEEP-BOTH | |

**Passenger: tabs and home**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A46 | `components/TabBar.tsx:53-55` | Home, Route, UserRound + labels | KEEP-BOTH | Import `House` (as the driver does). |
| A47 | `(tabs)/index.tsx:91` | MapPin + city name | REMOVE-ICON | Trailing `ChevronDown`, so it reads as a picker. |
| A48 | `(tabs)/index.tsx:104-109` | Resume card StatusPill + ChevronRight | MERGE | Leading ride glyph (C1). |
| A49 | `(tabs)/index.tsx:123` | Search « Où allez-vous ? » | KEEP-BOTH | |
| A50 | `(tabs)/index.tsx:127-128` | ArrowRight disc in the search pill | REMOVE-ICON | A duplicate affordance. |
| A51 | `(tabs)/index.tsx:132` | Home « Maison / Maison + » | KEEP-BOTH | A `Plus` badge replaces the text « + ». |
| A52 | `(tabs)/index.tsx:133` | Briefcase « Travail » | KEEP-BOTH | |
| A53 | `(tabs)/index.tsx:134` | CalendarClock « Plus tard » | KEEP-BOTH | Moves into the search pill as a « Maintenant ▾ » chip (P-11). |
| A54 | `(tabs)/index.tsx:135` | Baby « Famille » | KEEP-BOTH | Moves to the services rail (P-11). |
| A55 | `(tabs)/index.tsx:152` | Trailing pill « Sélectionnée » / « Test » | MERGE | `Check` for the selected city; « Test » stays as a word (C20). |

**Passenger: ride**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A56 | `ride.tsx:119` | Text-only status chip | MERGE | Ride glyph in the header; the sheet title carries the word (P-58). |
| A57 | `ride.tsx:141` | Signal « Position en attente » | KEEP-BOTH | `WifiOff`. |
| A58 | `ride.tsx:150` | Clock « Toutes occupées » | KEEP-BOTH | Drop it; it repeats the title (inventory D7). |
| A59 | `ride.tsx:153` | Phone IconButton + « Contacter » | ICON-ONLY | Matches the driver app; label in `accessibilityLabel`. |
| A60 | `ride.tsx:172` | CheckCircle2 « Votre trajet s'affiche en direct · SOS… » | REMOVE-ICON | |
| A61 | `ride.tsx:178` | MapPinned « Planifier » | KEEP-BOTH (fix) | `CalendarClock`. |

**Passenger: trips, receipt, scheduled**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A62 | `(tabs)/trips.tsx:55` | CalendarClock + date + footer « Réservation enregistrée · chauffeuse à confirmer » | MERGE | Trailing `CalendarClock` with the label for the screen reader (C5). |
| A63 | `(tabs)/trips.tsx:57` | ArrowUpRight as a chevron | REMOVE-ICON | |
| A64 | `receipt/[id].tsx:69-70` | Payment pill + « Course terminée » | MERGE | Method glyph plus state badge, one line under the amount (P-30). |
| A65 | `receipt/[id].tsx:77` | Method icon 14 + method label | KEEP-BOTH | 16. |
| A66 | `receipt/[id].tsx:128` | Route disc on the route row | REMOVE-ICON | |
| A67 | `receipt/[id].tsx:129` | MessageCircle « Aide sur cette course » | KEEP-BOTH (fix) | `LifeBuoy`. |
| A68 | `receipt/[id].tsx:137` | CreditCard in the retry sheet | KEEP-BOTH | |
| A69 | `scheduled/[id].tsx:89` | CalendarClock disc + date | REMOVE-ICON | |
| A70 | `scheduled/[id].tsx:90` | Route disc + route | REMOVE-ICON | |
| A71 | `scheduled/[id].tsx:91` | Payment disc + method | KEEP-BOTH | |

**Passenger: quote and route**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A72 | `quote.tsx:185` | TrendingUp « Demande élevée ×… » | KEEP-BOTH | |
| A73 | `quote.tsx:255` | Method icon in the payment sheet | KEEP-BOTH | Trailing check for the selected one, no chevron (P-23). |
| A74 | `quote.tsx:277` | PaymentRow icon | KEEP-BOTH | |
| A75 | `route.tsx:73` | Plus « Ajouter un arrêt » | KEEP-BOTH | As a row (P-19). |
| A76 | `route.tsx:75` | MapPin « Départ sur la carte » | KEEP-BOTH | As a row. |
| A77 | `route.tsx:106` | MapPin « Choisir sur la carte » | KEEP-BOTH | |
| A78 | `route.tsx:110` | House, Briefcase, Star saved places | KEEP-BOTH | 24 bare. |
| A79 | `route.tsx:117` | MapPin on every search result | REMOVE-ICON | Use `Clock` only for recents, which is a real type (P-17). |

**Passenger: account, payments, places, card**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A80 | `(tabs)/account.tsx:32` | « Compte vérifié » pill | ICON-ONLY | `BadgeCheck` 16 beside the name. |
| A81 | `(tabs)/account.tsx:37` | CreditCard disc « Moyens de paiement » | REMOVE-ICON | |
| A82 | `(tabs)/account.tsx:38` | MapPin disc « Adresses enregistrées » | REMOVE-ICON | |
| A83 | `(tabs)/account.tsx:39` | Bell disc « Préférences » | REMOVE-ICON | |
| A84 | `(tabs)/account.tsx:42` | LifeBuoy disc « Aide et demandes » | REMOVE-ICON | |
| A85 | `payments.tsx:52` | Method icon | KEEP-BOTH | 24. |
| A86 | `payments.tsx:55` | « Préféré » pill (the subtitle says it too) | ICON-ONLY | Trailing `Check`. |
| A87 | `places.tsx:54` | Kind icon + label | KEEP-BOTH | |
| A88 | `places.tsx:63` | Sheet pills « Maison / Travail / Autre » with no icon | KEEP-BOTH (fix) | Add the same glyphs as the list. |
| A89 | `places.tsx:70` | MapPin on every result | REMOVE-ICON | |
| A90 | `card/new.tsx:71` | Lock « Paiement sécurisé… » | KEEP-BOTH | The only meaning of `Lock` alone. |

**Passenger: help, sheets, verification**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A91 | `help/index.tsx:19` | 7 topic discs | REMOVE-ICON | The topics become text rows; only the safety topic keeps a glyph (`Siren`, danger) (P-45). The code sweep kept all 7; the rendered review overrides it. |
| A92 | `help/index.tsx:23` | MessageCircle « Mes demandes » | KEEP-BOTH (fix) | `Inbox`: it is a list of requests; `LifeBuoy` stays the entry to help. |
| A93 | `help/[topic].tsx:28` | ShieldAlert danger disc ×3 on emergency numbers | KEEP-BOTH (fix) | The number at 17/700 leads, with a trailing `Phone` (P-49). |
| A94 | `features/ride/ContactSheet.tsx:22-23` | Greyed Phone and MessageSquare « Bientôt disponible » | REMOVE-ICON | Collapse to one line, or hide (R8). |
| A95 | `features/ride/ContactSheet.tsx:32` | ShieldAlert ×3 on emergency numbers | KEEP-BOTH (fix) | `Phone`. |
| A96 | `features/location/LocationExplainer.tsx:13,17` | LocateFixed, MapPin on why/control rows | KEEP-BOTH | |
| A97 | `(verify)/identity.tsx:84` | Hash on the document number | REMOVE-ICON | |
| A98 | `(verify)/identity.tsx:88` | UserRound on « Prénom » only | REMOVE-ICON | |
| A99 | `(verify)/identity.tsx:91` | CalendarDays on the birth date | REMOVE-ICON | |
| A100 | `(verify)/review.tsx:41-68` | CheckCircle2, CircleAlert, Circle + « Ajoutée / À reprendre / À ajouter » | MERGE | C9 glyphs; drop the word « Ajoutée », keep « À reprendre ». |
| A101 | `(verify)/verification-status.tsx:40` | FileText disc + status in the subtitle | MERGE | |
| A102 | `(verify)/verification-status.tsx:49-103` | StatusHero discs + hero title | KEEP-BOTH | Glyphs per C7; submitted and in_review stop sharing `Clock3`. |

**Driver: tabs, home, wallet**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A103 | `components/TabBar.tsx:39-41` | House, BarChart3, Wallet, UserRound + labels | KEEP-BOTH | `ChartColumn` for `BarChart3`. |
| A104 | `(tabs)/index.tsx:95` | MapPin on a non-tappable city pill | REMOVE-ICON | The city also repeats at `:115` (D-03). |
| A105 | `(tabs)/index.tsx:118-121` | 12-pt dot « Vous êtes en ligne / hors ligne » | MERGE | `Radar` pulsing / `PowerOff` (C20). |
| A106 | `(tabs)/index.tsx:139-142` | ActionNote default Clock for info and warning | MERGE | Banner map (§2.6). |
| A107 | `(tabs)/index.tsx:158` | Navigation « Utiliser ma dernière position connue » | KEEP-BOTH | |
| A108 | `(tabs)/wallet.tsx:27` | ArrowUpRight « Retirer » | KEEP-BOTH (fix) | `Landmark`. |
| A109 | `(tabs)/wallet.tsx:28` | ArrowDownLeft « Recharger » | KEEP-BOTH (fix) | `Plus`. |
| A110 | `(tabs)/wallet.tsx:29` | ListOrdered « Mouvements » | KEEP-BOTH | |
| A111 | `(tabs)/wallet.tsx:37` | Clock disc « Retrait X » + « En cours · réservé » | MERGE | Leading `Landmark`, trailing `Hourglass` (C4). |
| A112 | `(tabs)/wallet.tsx:40` | Clock disc « Recharge X » + « En attente du prestataire » | MERGE | Leading `Plus`, trailing `Hourglass`. |
| A113 | `components/WalletCard.tsx:46` | Info 12 beside figure labels | KEEP-BOTH | Down to one explanation link (D-21). |
| A114 | `(tabs)/earnings.tsx:63` | Hourglass « N carte en attente » | KEEP-BOTH | |
| A115 | `(tabs)/earnings.tsx:70` | Banknote / CreditCard disc + « (refusé / en attente) » | MERGE | Method glyph with a state badge (C3). |
| A116 | `recharge/index.tsx:73` | Provider disc + name | KEEP-BOTH | |
| A117 | `recharge/sandbox/[id].tsx:44` | Lock disc 52 « Paiement en cours » | MERGE | `Hourglass` disc 56. |
| A118 | `withdraw/index.tsx:76` | Landmark disc + bank account | KEEP-BOTH | |
| A119 | `components/Kit.tsx:165` | OperationHero disc + kicker | KEEP-BOTH | Glyph per C4; disc 56. |
| A120 | `rides/index.tsx:35` | XCircle / Banknote / CreditCard disc + « Annulée » subtitle | MERGE | Cancelled = `CircleSlash` (neutral), not `XCircle`. |

**Driver: account, ride, offer, dossier**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A121 | `(tabs)/account.tsx:44` | ProfileHero pill | MERGE | Seal glyph beside the name. |
| A122 | `(tabs)/account.tsx:46` | UserRound disc + trailing pill « Chauffeuse » | MERGE | Trailing state glyph only. |
| A123 | `(tabs)/account.tsx:47` | Car disc + trailing pill on the vehicle | MERGE | Same. |
| A124 | `(tabs)/account.tsx:48` | FileText disc « Documents et dossier » | REMOVE-ICON | |
| A125 | `(tabs)/account.tsx:49` | Baby disc « Agrément Naya Famille » + eligibility | MERGE | Trailing C10 glyph. |
| A126 | `(tabs)/account.tsx:54` | History disc « Historique des courses » | REMOVE-ICON | |
| A127 | `(tabs)/account.tsx:55` | Bell disc « Préférences » | REMOVE-ICON | |
| A128 | `(tabs)/account.tsx:56` | LifeBuoy disc « Aide et demandes » | REMOVE-ICON | |
| A129 | `ride.tsx:142` | Route on the « Prise en charge / Arrivée à » eyebrow | REMOVE-ICON | |
| A130 | `ride.tsx:169` | CheckCircle2 or square + « · effectué » | ICON-ONLY | Drop the word. |
| A131 | `ride.tsx:182` | UserRound disc + passenger name | REMOVE-ICON | Avatar. |
| A132 | `ride.tsx:209` | « Appeler le 19 (police) » with no icon | KEEP-BOTH (fix) | `Phone`, and not the sheet's primary (D-11). |
| A133 | `ride.tsx:234` | MapPin disc 56 for every end state | MERGE | C1 glyphs. |
| A134 | `offer.tsx:74-84` | Terminal discs (CircleSlash, Clock3, XCircle) + end title | MERGE | C2 glyphs. |
| A135 | `offer.tsx:120-123` | Banknote / CreditCard « Espèces / Carte / Portefeuille » | KEEP-BOTH (fix) | Wallet shows `Wallet` (C19). |
| A136 | `ride-end/[id].tsx:56` | Method glyph + « Tarif final · … confirmé / refusé » | MERGE | Method glyph with a state badge. |
| A137 | `components/DossierHub.tsx:71` | Baby disc on the Famille opt-in | KEEP-BOTH | |
| A138 | `components/Dossier.tsx:65 + :79` | DocIcon + pill | MERGE | One C8 glyph (D-34). |
| A139 | `components/Dossier.tsx:125-138` | Section disc tint + pill + progress bar | MERGE | Count in the header, no pill. |
| A140 | `components/Dossier.tsx:165-176` | CheckCircle2 / Circle + « Complété / À compléter » | ICON-ONLY | |
| A141 | `components/Dossier.tsx:224-265` | ActionNotes with explicit icons | KEEP-BOTH | Through the banner map. |

**Driver: sign-up fields and Famille requirements**

| ID | Where | Today | Verdict | Change |
|---|---|---|---|---|
| A142 | `components/signup/Fields.tsx:26` | Phone glyph + « +212 » prefix | REMOVE-ICON | The prefix is enough. |
| A143 | `Fields.tsx:113` | UserRound on « Prénom » only | REMOVE-ICON | |
| A144 | `Fields.tsx:122` | MapPin « Adresse » | REMOVE-ICON | |
| A145 | `Fields.tsx:123` | Building2 « Ville » | REMOVE-ICON | |
| A146 | `Fields.tsx:136` | Hash on the document number | REMOVE-ICON | |
| A147 | `Fields.tsx:143` | Hash on the licence number | REMOVE-ICON | |
| A148 | `Fields.tsx:222` | UserRound on the reference name | REMOVE-ICON | |
| A149 | `Fields.tsx:250` | 3 training rows | KEEP-BOTH | |
| A150 | `docs/famille.tsx:56` | 5 requirement discs | MERGE | Each glyph shows done or to do from the dossier (C8). |

---

## 4. Findings by screen

Severity: **H** blocks the task or safety, or the screen reads broken. **M** is clear friction or a rule broken with a measurement. **L** is polish. The paths are under the capture folder (§8).

### 4.1 Cross-app findings

| ID | Sev | Screen | Problem | Fix |
|---|---|---|---|---|
| X-01 | H | Account, both apps (`passenger/10a`, `driver/40b`, `passenger/14a`) | « Identité · 6 pistes — Explorer les propositions de logo » (the internal logo board) sits in the customer account under « Vos essentiels » (`(tabs)/account.tsx:36` passenger, `:53` driver). | Remove the row, or show it in dev mode only (R4). |
| X-02 | H | Live ride, both apps (`passenger/16h`, `16b`, `driver/22e`) | SOS is an accent outline pill inside the scrolling sheet. Content covers it in `16h`, and the Famille toast covers it in `16b`. | A pinned 44 `Siren` disc on the map's right edge, labelled « Sécurité » (11 pt under it), in both apps. It opens the SOS sheet (P-57). |
| X-03 | M | Status everywhere | `StatusPill` shows the same dot for every state (21 call sites) and toasts carry no icon. | §2. |
| X-04 | M | All tab screens (`passenger/10b`) | The floating tab bar covers the last rows (« Se déconnecter », « À vos côtés »). | Bottom content inset = tab bar height + 16, set once in `Screen`. |
| X-05 | M | Large-title screens (`passenger/10b`, `10d`) | The large title stays put and content scrolls under it with no backdrop, cutting the name in half. | Collapse to a 17/600 centred header with a backdrop once content scrolls under it. |
| X-06 | M | Toasts (`passenger/11e`, `15j`, `16b`) | Toasts land mid-screen over the entry they talk about, over totals, and over SOS. | Anchor above the pinned footer, or under the status bar when there is no footer. Never over the primary or SOS. |
| X-07 | M | Disabled primaries (`03a`, `15h`, `16p`, `driver/24a`) | Disabled is a paler tint of the plum and reads as missing (rule 20). | `disabledFill` and `disabledText` tokens, a reason line under the button, or the unblocking action instead (D-06). |
| X-08 | M | Selection lists (`05c`, `07c`, `15h`) | Choices are drawn with chevrons, like navigation. | Trailing check; chevron only for "opens a screen" (principle 8). |
| X-09 | M | Forms (`11b`, `15d`, `12d`, `13f`) | The floating-label phone field sits next to placeholder-only fields elsewhere. | One field primitive with a floating label everywhere (§5.8). |
| X-10 | L | Dark mode (`passenger-dark/D3`) | The outline car illustrations are faint on the dark ground. | Replace them with the vehicle photo (P-59), or give the line art the `outline` token. |

### 4.2 Passenger

| ID | Sev | Screen | Problem | Fix |
|---|---|---|---|---|
| P-01 | M | Onboarding `01a–c` | Each slide stacks four text layers: the same eyebrow chip on every photo, the title, the body, and a shield badge that repeats the body. | Image, title 28/700, one 15 grey sentence, dots, one CTA. Drop the eyebrow and the badge (A7). |
| P-02 | M | Onboarding `01b` | Slide 2 is a line illustration in a pink card; slides 1 and 3 are photos. | A photo for slide 2 too. |
| P-03 | L | Onboarding `01a` | The « ↗ » on « Continuer / Commencer » means nothing (A8). | Remove it. |
| P-04 | M | Phone `02a` | « Recevoir le code » is filled and enabled while the field is empty. | Disabled (neutral fill) until 9 digits. |
| P-05 | M | Phone `02a` | The placeholder « 6 12 34 56 78 » at 17 pt mid-grey reads like a prefilled number. | A 13 grey example line under the field (« Ex. 6 12 34 56 78 »), with no placeholder. |
| P-06 | L | Phone `02a` | About 450 pt of empty space sits between the field and the CTA. | Pin the CTA above the keyboard; the field sits 12 under the title. |
| P-07 | M | OTP `03a/b` | The disabled « Vérifier » is a paler tint. | Submit automatically at the 6th digit and drop the button; « Renvoyer » stays as text (R16). |
| P-08 | M | Identity `04a` | The most visible header control is a white « Se déconnecter » pill. | « Plus tard » as text, as in the driver app. |
| P-09 | M | Identity `04a` | Field icons are mixed: CIN `#`, Prénom a person, Nom nothing, date a calendar (A97–A99). | No field icons. |
| P-10 | M | Verification status `04c–e` | The status is said four times: screen title, card title, paragraph, info pill. | 56 disc with the C7 glyph, title 21/600, one 15 grey line, no card. The current glyph shapes are the model. |
| P-11 | H | Home `05a` | 9 choices in the first viewport against a budget of 5: city pill, avatar, locate, search pill plus an arrow disc, 4 shortcut tiles (14-pt icon over an 11-pt label), and a « Lavage à domicile » row with a truncated sub-line. | « Où allez-vous ? » pill 52 with no arrow and a « Maintenant ▾ » chip inside it. Maison and Travail as 2 rows of 52 with their addresses. Famille and Lavage in one services rail below the fold (R7). No car illustration, no « Bonjour Salma » eyebrow. |
| P-12 | M | Home `05a` | The map takes about 55% of the screen and says nothing. | Show a labelled pickup pin and nearby cars, or shrink the map to the peek height. |
| P-13 | M | Home `05a` | The « S » avatar duplicates the Compte tab. | Remove it. |
| P-14 | M | Home `05a` | The accent appears 5 times (search pill, active tab, tile icons, promo icon, locate) against a limit of 3. | Accent on the active tab and the search pill only. |
| P-15 | L | City sheet `05c` | The selected city has a green « Sélectionnée » pill and a chevron. | Trailing check (A55). |
| P-16 | L | City sheet `05c` | The « Test » chip repeats the sub-line « Ville en test ». | Keep one: the chip with `FlaskConical` (C20). |
| P-17 | M | Route search `06a/b` | All 10 rows have the same pin and a chevron. | The leading glyph says the type: `House`, `Briefcase`, `Clock` for recent, nothing for suggestions. No chevrons, because a tap selects. |
| P-18 | M | Itinerary `06c/d` | « Votre itinéraire » is a mostly empty step whose only button is « Voir l'estimation »: a step, not a decision. | Go straight to the quote and edit the route there (R6). |
| P-19 | L | Itinerary `06c` | « Ajouter un arrêt » and « Départ sur la carte » are equal tiles whose labels wrap to 2 lines. | Two 48 rows. |
| P-20 | H | Quote `07a/b` | The service options are bordered chips sized to their content (61 tall, 226–278 wide) with no price. The price sits in a separate fare card below the fold (y ≈ 560, behind the pinned footer), with a car illustration. The options cannot be compared. | Full-width option rows of 72: vehicle image 48, name 16/600 and « 5 min · 4 places » 13 grey, price 16/600 tabular on the right. Selected = 2-pt accent outline plus a check. No fare card; « Détail du prix » is an (i) on the selected row. |
| P-21 | M | Quote `07a` | The title « Votre trajet, tout simplement. » is a slogan. | « Centre-ville → Gare Rabat Ville » at 18/600 with « Modifier ». |
| P-22 | M | Quote `07a` | The pinned footer is about 190 pt (segmented control, payment row, CTA, legal line), leaving about 200 pt for the options. | « Maintenant ▾ » chip, a 44 payment row, one CTA « Confirmer Naya Standard · 70,40 MAD », legal on one line. |
| P-23 | M | Payment sheet `07c` | The rows are a choice but are drawn as navigation, and the selected row has a check plus a chevron. | Trailing check only. |
| P-24 | M | Payment sheet `07c` | The wallet at 0 MAD can still be chosen. | Disabled, with « Solde insuffisant · Recharger ». |
| P-25 | M | Schedule picker `07e/f` | Days and times are two horizontal chip rails cut off at the right edge, with 40+ quarter-hour chips and no scroll hint. | One « Aujourd'hui · 18h15 ▾ » row that opens a date and time wheel sheet. |
| P-26 | M | Trips `08a` | The upcoming card has a 64×32 car illustration, an unexplained « ↗ » and the status as a sentence at the bottom. | A 72 row: date 15/600, route 13 grey, price on the right, trailing `CalendarClock` (C5). |
| P-27 | L | Trips history `08b` | Good rows; no method cue. | 16 method glyph; keep the word « Annulée ». |
| P-28 | M | Scheduled detail `08c` | « Modifier l'horaire » and « Annuler » are equal outline buttons side by side. | « Modifier l'horaire » as the 44 button, « Annuler la réservation » as red text. |
| P-29 | L | Scheduled detail `08d` | The blue info banner and the « Historique » row say the same thing. | Keep the history row. |
| P-30 | M | Receipt `09a`, `16l` | The status is a pill in the amount card and also a full-width banner. | One line under the amount: method glyph with a state badge and « Espèces à remettre » or « Payé en espèces ». |
| P-31 | M | Receipt `16m`, fare sheet | « règles v1 » (`receipt/[id].tsx:86`, `quote.tsx:239`) is internal versioning. | Remove it. |
| P-32 | L | Receipt `16j` | The rating stars are 24. | 36–40, as the hero action once the ride is paid. |
| P-33 | L | Receipt `16k` | « Merci, vous avez noté Amina 5/5 » has its own card. | One line. |
| P-34 | M | Account `10a` | Row icons are mixed: Portefeuille, Famille and Identité have none, the next 4 rows have discs. | No discs (A81–A84). |
| P-35 | L | Account `10a` | The « Compte vérifié » pill. | `BadgeCheck` 16 beside the name (A80). |
| P-36 | M | Preferences `10c/d` | « Commandes flottantes · Givrées » and « Réduire les animations · Désactivé » look tappable but are read-only system mirrors, in jargon. | One footnote: « Naya suit les réglages d'accessibilité de votre téléphone. » |
| P-37 | L | Preferences `10c` | The appearance choice is a list. | A 3-segment control (`SunMoon`, `Sun`, `Moon` with labels). |
| P-38 | M | Payments `11a`, places `10e` | A red trash on every row (3 on Payments), a green « Préféré » pill, and the preferred method set by a hidden tap explained in a footnote. | Trailing check for the preferred method, tap to set it; delete by swipe or a ⋯ menu, with an `accessibilityActions` entry for VoiceOver. |
| P-39 | L | New card `11b` | Placeholder-only fields. | The floating-label field (X-09). |
| P-40 | M | Wallet `11c–e` | The top-up form sits inline: amount, 4 provider chips on 2 rows, a filled « Recharger 100 MAD » mid-screen, then « Opérations ». | Money home: balance hero, one « Recharger » button that opens the driver's amount screen pattern, activity rows (C17). |
| P-41 | M | Wallet `11e` | The pending top-up says « En cours de confirmation » in words, and the toast covered that entry. | Trailing `Hourglass` (C17); toast anchoring (X-06). |
| P-42 | M | Famille home `12a` | Three CTAs in three styles: « Ajouter un enfant » (outline, hugging), « Planifier un trajet » (filled with an icon), « Inviter l'autre parent à suivre » (outline, full width). | One pinned primary « Planifier un trajet ». « + Ajouter un enfant » as the last row of the children card. « Inviter » as a row. |
| P-43 | M | Famille home `12a` | A marketing banner (« Un trajet en confiance ») shows to an active subscriber. | Hide it once subscribed. |
| P-44 | L | Famille home `12b` | The « Planifié » pill. | `CalendarClock` (C11). |
| P-45 | M | Help `13a` | 8 topics, each with a 32 accent icon disc. | Text rows; only the safety topic keeps `Siren` in danger. |
| P-46 | M | Help safety `13c` | The 3 emergency numbers have the same red shield. | The number leads at 17/700 (19, 15, 177), name 13 grey, trailing `Phone`. |
| P-47 | M | Support list `13e` | The empty state reuses the onboarding illustration at 220 pt. | 48 `Inbox` glyph, one line, one button (rule 9). |
| P-48 | M | New request `13f` | 9 category chips on 4 rows mixing categories and sub-reasons, plus 2 fields and attachments: 14 choices. | Step 1 is a category list; step 2 is the form. From a ride, preselect « Course NY-001 ». |
| P-49 | L | Support thread `13g` | The « Ouverte » pill. | C6 glyph in the header. |
| P-50 | H | Car wash photos `15o/p` | Photos are 2-column portrait tiles of about 130×520, cropping the car to a sliver; before and after take 3 screen heights, and some tiles are blank (`15p`, `15r`). | One row per angle with Avant and Après as 4:3 thumbnails (167×125) with 12 labels, tap for full screen. Or one 16:10 before/after slider (R13). Fix the blank tiles. |
| P-51 | M | Car wash payment `15h/i` | Chevron rows as a radio list; « Total 60 MAD » is clipped by the pinned CTA; the cancellation policy is 5 lines at 11 pt. | Trailing checks; content inset for the footer; one policy line plus « Conditions ». |
| P-52 | M | Car wash order `15j` | The « Lavage réservé » toast covers the total, and « Annuler le lavage » is a full-width outline as the only action. | Toast anchoring; cancel as red text. |
| P-53 | M | Car wash vehicle `15d` | Four placeholder-only fields. | The driver sign-up shortcut chips (makes, colours). |
| P-54 | M | Car wash place `15b/c` | « Ma position » and « Choisir sur la carte » are equal tiles, one wrapping to 2 lines; choosing a place inserts a map that pushes the list down. | Two rows; the map opens as a sheet. |
| P-55 | L | Car wash packages `15e` | The selected package is tinted and outlined with no check. | Add the check (rule 20). |
| P-56 | H | Ride assigned and arrived `16b`, `16g` | The plate is a 12-pt bordered chip, the car is an outline drawing and the driver is an initial disc. Recognising the plate is the core safety check (« Vérifiez la plaque »). | Title « Amina arrive dans 2 min » 21/600. Plate 20/700 tabular in a 36-tall plate chip (28/700 when arrived). Driver photo 48. Car model and colour 15. |
| P-57 | H | SOS sheet `16o` | « Déclencher l'alerte » is a 40-pt red pill hugging its label, under an optional field. The sheet shows raw coordinates (« 34.01890, -6.83670 »). | The alert as a full-width 56 red button, held 1.5 s to confirm. « Appeler le 19 » as a full-width 44 with `Phone`. A place name instead of coordinates. The trusted-contact field after (R10). |
| P-58 | M | Ride searching `16a` | The header pill repeats the sheet title, and « Annuler la demande » is full-width. | The pulsing `Radar` at pickup; cancel as text. |
| P-59 | M | Cancel sheet `16p` | 5 reason chips, a pale disabled « Annuler sans frais », a green banner and « Garder ma course ». | « Garder ma course » filled; cancel as red text; reasons as radio rows, skipped when cancelling is free. |
| P-60 | L | No driver `16n` | « Planifier » and « Annuler » are equal outlines under the primary. | Text actions. |
| P-61 | H | Home with active ride and Famille `17a` | Two floating status cards (Famille approval, ride en route) sit on top of the full home card, leaving about 30% of the map. The route is truncated (« Gare Ra… ») and the statuses are coloured dots. | The active ride replaces the home card (« Amina arrive · 2 min », plate, C1 glyph). The Famille approval becomes a top banner with the countdown ring. At most one card above the sheet. |
| P-62 | H | Famille live trip `18a–e` | While the passenger was on her own ride, the app navigated to the Famille approval screen by itself; the contact and SOS taps in `18d/e` landed there. | Urgent interruptions are a sheet or banner over the current screen, never a route change. |
| P-63 | M | Famille live trip `18a` | The safety row has « WhatsApp », a large red filled « Police 19 », « Inviter », and a separate « SOS · sécurité ». Police and SOS are duplicated, and a red police button always on a parent's screen is alarming. | Both behind the one safety disc (X-02) and its sheet. |
| P-64 | M | Famille journal `18b` | Every journal line shows raw latitude and longitude (« 33.9594, -6.8747 »). | Place names; the shared timeline glyphs (A19). |
| P-65 | L | Famille approval `18a` | The approval countdown is 13-pt text. | The driver offer's countdown ring. |

### 4.3 Driver

| ID | Sev | Screen | Problem | Fix |
|---|---|---|---|---|
| D-01 | M | Welcome and sign-in `10a–11b` | The same eyebrow, badge, « ↗ » and placeholder issues as the passenger app. | As P-01, P-03, P-04, P-05. |
| D-02 | H | Home `20e` | The money tile breaks: « 229,84 MA » with « D » on its own line, and « Aujourd'hui · 2 cour… » is truncated in every state. | 22/700 tabular with `adjustsFontSizeToFit` (minimum scale 0.8), « MAD » as a 13 suffix, sub-line « 2 courses ». |
| D-03 | M | Home `20a` | The city appears twice (header pill and a grey « Rabat » beside « Bonjour Amina »). | Keep the header pill, without its icon (A104). |
| D-04 | M | Home `20a`, `20c` | Online versus offline is a 10-pt ring versus a 10-pt green dot. | A 24 state glyph (`PowerOff` grey / pulsing `Radar` green), « Passer en ligne » as the major pill. Once online, « Hors ligne » is a 36 secondary, not a full-width outline (in dark mode its pink border reads as primary). |
| D-05 | M | Home `20c`, offer `21a` | « 30 s pour répondre » and « délai de 30 secondes » are hard-coded; the ring uses `total={30}` (DRV-05). | Use the offer's real deadline and the city's `offerTimeoutSeconds`. |
| D-06 | M | Blocked home `24a–26a` | The reason card and a pale disabled « Passer en ligne » both say "you can't". | Replace the disabled button with the unblocking action: « Recharger 150 MAD », « Corriger mon permis », « Voir le dossier ». `Lock` in the status row (C20) (R12). |
| D-07 | L | Home `20a` | The passenger « Lavage à domicile » cross-sell sits on a work tool. | Move it to Compte (R7). |
| D-08 | L | Home `27a` | The Famille card shows its state by tint only (blue vs amber). | C10 glyph. |
| D-09 | M | Offer `21a` | The net amount (59,84), which she decides on, sits in a 3-line tinted box. | Co-hero next to the fare, same size, labelled « Net pour vous ». |
| D-10 | L | Offer `21a` | At 10 s or less, the ring only turns red. | Add a haptic tick at 10 s and 5 s, and keep the number visible. |
| D-11 | H | Contact sheet `22b` | The sheet says calling and messaging are not yet available, and its only filled action is a red « Appeler le 19 (police) ». The passenger sheet has the same structure (`18d`). | Hide the phone disc until calling works (R8). The 19 call lives in the safety sheet and is never the primary of a contact sheet. |
| D-12 | M | Ride `22a` | The call and navigate discs are 36 and icon-only, and the « ↗ » navigate glyph is ambiguous. | 44 discs with 11-pt labels, or a « Naviguer » pill 36 with `Navigation`. |
| D-13 | M | Ride `22a` | The header status (« Rejoindre Salma ») is drawn in a search-pill shape and looks like an input. | A plain 17/600 header title with the C1 glyph. |
| D-14 | M | Ride `22e` | The SOS pill has the same problem as the passenger's. | X-02. |
| D-15 | L | Ride `22d` | « Commencer » and « Terminer » are single taps. | Consider slide-to-confirm (R17). |
| D-16 | L | Cancel sheet `22c` | The first reason is preselected. | No preselection; the button stays disabled until a reason is chosen. |
| D-17 | M | Ride end `23a/b` | About 330 pt of empty space; the status is an eyebrow plus a banner. | Method glyph with a state badge and one line under the hero; add the passenger rating. Keep « J'ai encaissé 70,40 MAD ». |
| D-18 | M | Earnings `30a` | No chart for 7 or 30 days. | One bar chart, full width, no gridlines (R18). |
| D-19 | M | Earnings `30a` | The row title mixes the id and the amount (« NY-002 · 85 MAD net »). | Amount on the right, tabular; title = time and route. |
| D-20 | M | Wallet `31a` | No activity on the wallet home, so half the screen is empty. | The last 3 movements and « Tout voir ». |
| D-21 | M | Wallet `31a` | 3 ⓘ icons beside the figure labels. | One « Comment c'est calculé ? » link. |
| D-22 | M | Wallet `31a` | « ↗ » / « ↙ » for Retirer and Recharger are ambiguous. | `Landmark` and `Plus` (A108–A109). |
| D-23 | M | Ledger `32c` | The back button on a deep-linked ledger raises « The action 'GO_BACK' was not handled ». | Fall back to the wallet tab when there is no history; check every deep-linked screen. |
| D-24 | M | Ledger `32a` | Rows do not open a detail. | Open `ledger/[id]`. |
| D-25 | M | Recharge `33a` | All 5 method sub-lines are truncated (« confirmé en quelq… »). | Sub-lines of 28 characters or fewer, or 2 lines. |
| D-26 | L | Recharge `33a` | 3 agency networks as 3 rows. | One « En agence » row with the networks in a sub-line. |
| D-27 | L | Withdraw result `34d` | The reserve is said twice (banner and table). | Keep the table row. |
| D-28 | L | Ride history `35a` | The « Terminée » pill. | C1 glyph. |
| D-29 | M | Account `40a` | The status is said three ways: « Approuvé » pills beside two row titles and the sub-line « Approuvée ». | One trailing C7 glyph per row. |
| D-30 | M | Account `40a` | Mixed icon discs (A124–A128). | No discs. |
| D-31 | L | Preferences `40d` | « Réduire la transparence · Verre dépoli » is jargon. | As P-36. |
| D-32 | L | Famille `41a` | Titled « Mes familles » here and « Naya Famille » in the passenger app. | « Naya Famille ». |
| D-33 | M | New request `42b` | Two chips both read « Autre ». | Rename one, as part of P-48's category list. |
| D-34 | H | Dossier status `43b` | Every document row has a leading clock and a trailing « En vérification » chip: 8 identical chips, each status said twice. | One C8 glyph per row. The section header gives the count (« 8 pièces en vérification »). Problems keep the word, the reason and « Renvoyer ». |
| D-35 | M | Dossier fix `43c/d` | Rows mix grey « Complété » text, blue « Envoyé » chips with an upload glyph, and red error text. | C8 glyphs only. |
| D-36 | M | Dossier fix `43c` | Two amber banners are stacked. | One banner with the count of pieces to redo. |
| D-37 | M | Dossier approved `43a` | « 96 % · 26 étapes sur 27 » shows while everything is approved. | Hide progress once approved; the hero is `BadgeCheck` « Dossier approuvé ». |
| D-38 | L | Dossier `43a` | An « Actualiser » button. | Pull to refresh, or refresh on focus. |
| D-39 | M | Sign-up hub `51a/b`, `54b` | Every row has an empty circle, a « Manquant » chip and a chevron. The section adds an « À compléter » pill, « 0/12 » and a progress bar; the hero shows « 0 % », « 0 étapes sur 22 » and a pink button. « Voir le suivi » is pinned and competes with « Commencer ». | A leading glyph only, no chips; one progress figure in the hero; unpin « Voir le suivi ». |
| D-40 | M | Sign-up steps `52a` | The eyebrow « VOUS · ÉTAPE 1 SUR 13 » repeats the segmented bar. | Keep the bar. |
| D-41 | M | Sign-up steps `52c` | Field icons are mixed (A142–A148). | No field icons. |
| D-42 | M | Review step `53e` | 7 « — » values with 7 accent « Modifier » links. | Missing values as « À compléter » in grey with one row tap; the accent appears once. |
| D-43 | M | Locked steps `53h/i` | Locked steps can be reached and show a « Commencez par… · Y aller » banner. | Lock the row in the hub (`Lock` glyph and the reason) so the step cannot open. |
| D-44 | L | Experience `53d` | A stepper and chips both set the same value. | Chips only. |
| D-45 | L | Famille intro `53k` | The intro paragraph runs 5 lines. | One sentence and 3 benefit rows. |

**What is already good, so keep it and spread it:** the driver offer screen (countdown ring, fare hero, one filled Accept, Refuser as text); the car-wash timeline (`15k`, `15n`); the verification-status glyph shapes; the driver sign-up steps (one question per screen, « Plus tard », shortcut chips); the recharge and withdraw amount entry (`33c`, `34c`); the sign-out alert (`40e`); and the card and cash glyphs on earnings and history rows.

---

## 5. Cross-cutting issues

### 5.1 Spacing

- One gutter: `gutter = 20` (the token). Sheets and cards use the same 20 inside. The capture shows 16 in some sheets and 20 in screens.
- Section rhythm: title → content `space[3]` (12); section → section `space[6]` (24); after a list, `space[10]` (40).
- Rows: settings 48–52, rows with a sub-line 56–64, money rows 72 (rule 4). Today the Famille plan and passenger wallet cards pad each entry by 18 inside a card; make them rows.

### 5.2 Type

- The scale exists (`type`). Two drifts: chip words at `micro` (12) carry meaning and must move to `caption` (13); some hero titles use `screen` (30) on detail screens where `title` (21) fits.
- Tabular figures for every amount, plate, countdown and ETA. The plate today is not tabular.
- No uppercase eyebrows over titles (onboarding, sign-up steps). Uppercase only on 11–12 tool labels.

### 5.3 Icon sizes and strokes

- Today there are 17 sizes (11–40) and 4 stroke widths (1.8, 2, 2.2, 3). Two tab bars use different strokes (passenger 2.3 / 1.9, driver 2.2 / 1.8).
- Target: 4 sizes. 16 inline, 20 trailing state and disc glyph, 24 bare row leading, header and tab bar, 28 inside a 56 hero disc. One stroke: 2. The tab bars use 2 for inactive and 2.4 for active, the same in both apps.
- A shared `Icon` wrapper (`packages/ui/src/Icon.tsx`) fixes the size steps and stroke, reads the tone colour in render, and scales with font scale (§2.6).

### 5.4 Discs

- Today there are 6 disc sizes: 36 (14 uses), 40 (default, 23), 44, 48, 52 and 56.
- Target: 40 (row leading, when a list uses discs at all), 44 (map and media actions), 56 (hero status). Delete 36, 48 and 52.

### 5.5 Cards

- `Card` is radius 22 with a hairline `line` border and padding 20. Cards are for objects (a ride, a plan, an order), not for grouping text.
- Remove cards inside cards: verification status, Famille plans and receipt « Merci » cards.
- Banners are not cards: one line with a glyph, `radius.row`, no border.

### 5.6 Sheets

- One sheet anatomy: grabber 36×4, title 18/600, × disc 32, gutter 20, actions as rows of 48–56.
- Destructive actions go last, in red, in their own group. « Annuler » is text.
- Choice sheets (payment, city, cancel reasons) use trailing checks.
- Interruptions (Famille approval, offer for the driver) are sheets or banners, never route changes (P-62).

### 5.7 Empty, loading and error states

- Empty: one 15/600 line, one 13 grey line, an optional 48 glyph, one button. No reused onboarding illustration (P-47).
- Loading: skeletons of the final rows, never a spinner in a void. The searching state on the ride is the one exception: the pulsing `Radar`.
- Errors name the cause and offer one move. Today the deep-link back error (D-23) is a raw navigation error.

### 5.8 Forms

- One field primitive: a floating label, a 56 field (`control.field`), no leading icon. A picker shows a trailing `ChevronDown`. The phone field keeps « +212 » as a prefix, without the phone glyph.
- Placeholders are examples, not labels. Put an example in a 13 grey line under the field.
- Primary buttons stay disabled (neutral fill) until the form is valid, with the reason when it is not obvious.

### 5.9 Copy

- Say a state once (principle 9). Remove « · effectué », « · Chauffeuse » and the repeated city.
- Short status words come from `shortLabel` (§2.6); the long labels stay for the screen reader.
- No internal terms: « règles v1 », « Givrées », « Verre dépoli », raw coordinates, « Identité · 6 pistes ».
- Feature lists use one bullet: the `Check` glyph (car-wash packages and Famille plans alike).
- Sign-out: the passenger uses accent and the driver danger. Make both danger text, as the last row (rule 8).
- One toggle: the driver preferences use a native `Switch` (`profile/preferences.tsx:38`) and the passenger app uses `Toggle`. Use `Toggle` in both.

---

## 6. Implementation plan

Every batch has its own file set, so batches in the same wave can run in parallel without conflicts. Each batch ends with the same check:

1. `pnpm -r --workspace-concurrency=1 typecheck`.
2. `pnpm --filter @naya/domain test` (wave 0 only), then `CI=1 pnpm --filter @naya/passenger test` (it also runs the `packages/ui` tests).
3. `pnpm lint`: 0 errors in the apps touched.
4. Light and dark screenshots of every screen in the batch at 390×844, compared with the "before" captures in §8, plus one capture with the largest text size.
5. Docs as needed: the spec for changed behaviour, `docs/SCREENS.md` for a new route, the backlog row.

**Wave 0. Foundations (two batches, in parallel)**

| Batch | Files | Covers | Done when |
|---|---|---|---|
| **B0 Status system** | `packages/domain/src/status.ts` (new), `labels.ts` (short labels), `prototype.ts` (Famille short labels only), `domain/src/index.ts`, domain tests; `packages/ui/src/StatusIcon.tsx` (new), `Icon.tsx` (new), `paymentIcons.ts` (new), `Feedback.tsx`, `Toast.tsx` (glyph and anchoring), `ui/src/index.ts`, ui tests; `apps/driver/src/components/Kit.tsx` (ActionNote and OperationHero) | §2 entire, A1, A2, A106, A117, A119, X-03, X-06, inventory D2, D3 and D4 | The domain test passes: every state has a presentation and no two states of one kind share a glyph. `StatusPill` renders a glyph. Toasts show a glyph. |
| **B1 Frame and lists** | `packages/ui/src/Screen.tsx`, `Header.tsx`, `List.tsx` (`ListRow` gets `status`, `selected` and the leading rule; `IconDisc` sizes 40, 44, 56), `BottomSheet.tsx`, `Form.tsx` (floating-label field, no leading icons, DateField without the calendar), `Button.tsx` (disabled style), `SegmentedControl.tsx`, `Toggle.tsx`, `ProfileHero.tsx`; `apps/passenger/src/components/TabBar.tsx`, `apps/driver/src/components/TabBar.tsx` | X-04, X-05, X-07, X-08, X-09, A10, A46, A103, §5.3–5.8 | Tab screens scroll their last row above the bar; the large title collapses; a choice row shows a check; a disabled button uses the neutral fill. |

**Wave 1. Screens (in parallel, after wave 0)**

| Batch | Files | Covers |
|---|---|---|
| **B2 Passenger home and booking** | `apps/passenger/src/app/(app)/(tabs)/index.tsx`, `route.tsx`, `quote.tsx`, `features/schedule/SchedulePicker.tsx`, `features/location/LocationExplainer.tsx` | P-11 to P-25, P-61, A47–A55, A72–A79. P-18 needs R6, P-11 needs R7. |
| **B3 Ride, safety and passenger wallet** | `packages/ui/src/Ride.tsx`, `packages/ui/src/features/prototype.tsx`, `packages/ui/src/map/*` (safety disc placement only), `apps/passenger/src/app/(app)/ride.tsx`, `apps/passenger/src/features/ride/ContactSheet.tsx`, `CancelSheet.tsx`, `apps/passenger/src/app/(app)/wallet.tsx` | X-02, P-40, P-41, P-56 to P-60, A4–A6, A23, A24, A56–A61, A94, A95, C16, C17. P-57 needs R10, the ContactSheet needs R8. |
| **B4 Passenger trips, receipt, account** | `apps/passenger/src/app/(app)/(tabs)/trips.tsx`, `receipt/[id].tsx`, `scheduled/[id].tsx`, `(tabs)/account.tsx`, `payments.tsx`, `places.tsx`, `card/new.tsx`, `preferences.tsx`, `help/index.tsx`, `help/[topic].tsx`, `packages/ui/src/features/ThemePicker.tsx` | X-01 (passenger), P-26 to P-39, P-45, P-46, A62–A71, A80–A93. X-01 needs R4. |
| **B5 Sign-in and passenger verification** | `packages/ui/src/WelcomeJourney.tsx`, `features/auth.tsx`, `DocumentPicker.tsx`, `features/CaptureGuide.tsx`, `features/capture.tsx`, `features/LiveCamera.tsx`; both apps' `app/(auth)/*`; `apps/passenger/src/app/(verify)/identity.tsx`, `review.tsx`, `verification-status.tsx`, `capture/[item].tsx` | P-01 to P-10, D-01, A7–A9, A25–A29, A97–A102. P-07 needs R16. |
| **B6 Famille** | `packages/ui/src/features/famille/*`; `apps/passenger/src/app/(app)/family/*`; `apps/driver/src/app/(app)/family/*`, `apps/driver/src/app/docs/famille.tsx`, `apps/passenger/src/app/suivi/[token].tsx` | P-42 to P-44, P-62 to P-65, D-32, A30–A45, A150, C11–C14. P-62 touches navigation in `apps/passenger/src/app/(app)/_layout.tsx`, so that file belongs to B6. |
| **B7 Car wash** | `packages/ui/src/features/carWash.tsx`; both apps' `app/(app)/car-wash/*` | P-50 to P-55, A11–A19, C15. P-50 needs R13. |
| **B8 Support** | `packages/ui/src/features/support.tsx`, `features/Attachment.tsx`; both apps' `app/(app)/support/*`, `apps/passenger/src/app/(verify)/support/*` | P-47 to P-49, D-33, A20–A22, C6. |
| **B9 Driver money** | `apps/driver/src/app/(app)/(tabs)/wallet.tsx`, `(tabs)/earnings.tsx`, `components/WalletCard.tsx`, `ledger/*`, `recharge/*`, `withdraw/*` | D-18 to D-27, A108–A118, C4, C18. D-18 needs R18. |
| **B10 Driver account and dossier** | `apps/driver/src/app/(app)/(tabs)/account.tsx`, `profile/*`, `components/Dossier.tsx`, `DossierHub.tsx`, `components/signup/*`, `app/docs/*` except `famille.tsx`, `app/(onboard)/documents.tsx` | X-01 (driver), D-29 to D-31, D-34 to D-45, A121–A128, A137–A149, C7, C8, C10. |

**Wave 2. Depends on B3**

| Batch | Files | Covers |
|---|---|---|
| **B11 Driver home, offer, ride** | `apps/driver/src/app/(app)/(tabs)/index.tsx`, `offer.tsx`, `ride.tsx`, `ride-end/[id].tsx`, `rides/*` | D-02 to D-17, A104–A107, A120, A129–A136, C1, C2, C20, DRV-05. It reuses B3's safety disc and ride primitives. D-06 needs R12, D-11 needs R8. |

**Wave 3. Optional**

| Batch | Files | Covers |
|---|---|---|
| **B12 Admin status** | `apps/admin/src/components/status.tsx`, `apps/admin/src/components/ui.tsx` (Badge) | C21; admin build plus e2e smoke (needs R9). |

**Docs to write alongside.** An ADR (Proposed) "Status is an icon; problems keep words", covering principles 2–4 and the glyph vocabulary in §2.2. The spec changes for P-18 (itinerary step), P-57 (SOS hold-to-confirm) and P-62 (interruptions). Backlog rows `RD-01`… mapped to the IDs in this report. Some e2e specs select status text that this plan hides or rewrites (for example `getByText('Réponse attendue')`, `getByText('Planifier')`, `getByText('Merci, vous avez noté')`). Move them to `testID` or the accessibility label in the batch that changes the text, and run `pnpm e2e` at the end of each wave.

---

## 7. Owner decisions

| # | Decision | Options (recommendation first) | Blocks |
|---|---|---|---|
| R1 | Do states go icon-only in lists? | (a) Yes, glyph alone in rows and lists, word on heroes, first sight and problems (principle 2). (b) Glyph plus word everywhere, only smaller. | B0 default for `showLabel` |
| R2 | Main button height | (a) Keep the 50-pt `control.major` for booking and driver decisions, 44 elsewhere. (b) 44 everywhere (ui-craft default). | B1 |
| R3 | Status tones (§2.3) | (a) Accept the rules: cancelled neutral, pending info, washing accent. (b) Keep the per-screen tones. | B0 |
| R4 | « Identité · 6 pistes » in customer accounts | (a) Remove the row; keep `/brand` reachable from the dev launcher. (b) Show it in dev mode only. | B4, B10 |
| R5 | One Famille trip tone mapping | (a) The C11 table. (b) Another mapping. | B0, B6 |
| R6 | Remove the itinerary step (go from search straight to the quote) | (a) Yes, edit the route on the quote. (b) Keep the step. | B2, spec |
| R7 | Home services: Famille and Lavage | (a) One services rail below the fold on passenger home; the car-wash cross-sell leaves driver home for Compte. (b) Keep the tiles. | B2, B11 |
| R8 | Contact sheets while calling and messaging are not live | (a) Hide the call and message actions and the « Bientôt disponible » rows; 19 moves to the safety sheet. (b) Keep one line « Appel et messagerie bientôt disponibles ». | B3, B11 |
| R9 | Does the admin adopt `statusPresentation` now? | (a) Later (B12). (b) In this round. | B12 |
| R10 | SOS gesture | (a) Hold 1.5 s on a full-width 56 button, with a haptic and a progress fill. (b) Tap, then a confirmation dialog. Either way, a pinned safety disc in both apps. Copy stays true per ADR-0058 (standalone reaches no desk). | B3, safety spec |
| R11 | Wording for a failed wallet debit (« Libéré ») | (a) « Montant libéré · rien n'a été débité ». (b) « Paiement annulé ». | B3 |
| R12 | Driver blocked: replace the disabled « Passer en ligne » with the unblocking action | (a) Yes. (b) Keep the disabled button plus the reason. | B11 |
| R13 | Car-wash photos layout | (a) A row per angle with Avant / Après thumbnails. (b) A before/after slider. | B7 |
| R14 | Commit the captures and the capture scripts | (a) Commit the scripts under `scripts/capture-web/`, not the PNGs (ADR-0052). (b) Commit both to `docs/screens/`. (c) Neither. | §8 |
| R15 | Backlog prefix for these findings | (a) `RD-`. (b) Fold into PAX-, DRV- and UI-. | docs |
| R16 | OTP: auto-submit at the 6th digit and drop « Vérifier » | (a) Yes. (b) Keep the button, disabled with the neutral fill. | B5 |
| R17 | Slide-to-confirm for « Commencer » / « Terminer » | (a) Not now. (b) Yes, with an accessibility action as the alternative. | B11 |
| R18 | Earnings chart (new feature) | (a) One 7- or 30-day bar chart. (b) Not now. | B9 |

---

## 8. Appendix: screenshot index

**Capture setup.** Expo web at 390×844 @2x against a scratch demo API (ports 4610, 8681, 8682; stopped afterwards). Scripts: `lib`, `p1`, `p2`, `p3`, `d1`, `x1`, `dark`, `dark2` in the session's `redesign/scripts/` folder. Ignore these web-only artefacts: blue focus rings after a tap, no blur on frosted surfaces, and dev error overlays.

**Root folder** (temporary, not committed; R14):
`/private/tmp/claude-501/-Volumes-UNREAL-Codex-Space-Recovery-2026-10-05-Users-achrafarabi-Dev-naya/3853af2e-6d9d-4a94-b7fc-d47b6737822e/scratchpad/redesign/shots/`

**`passenger/` (90 light)**

| Group | Files |
|---|---|
| Onboarding, sign-in | 01a-welcome, 01b-onboarding-2, 01c-onboarding-3, 02a-signin-phone, 02b-signin-phone-filled, 03a-otp-empty, 03b-otp-partial |
| Identity | 04a-verify-identity-start, 04b-verify-identity-scrolled, 04c-verify-pending, 04d-verify-needs-more, 04e-verify-rejected |
| Home | 05a-home-idle, 05b-home-idle-scrolled, 05c-home-city-sheet, 17a-home-active-ride-famille |
| Route and quote | 06a-route-search-empty, 06b-route-search-results, 06c-route-filled, 06d-route-with-stop, 06e-plan-later-entry, 06f-route-pin-picker, 07a-quote, 07b-quote-scrolled, 07c-quote-payment-sheet, 07e-quote-planifier, 07f-quote-schedule-picker |
| Trips and receipt | 08a-trips-upcoming, 08b-trips-history, 08c-scheduled-detail, 08d-scheduled-detail-scrolled, 09a-receipt-past, 09b-receipt-past-scrolled |
| Account and money | 10a-account, 10b-account-scrolled, 10c-preferences, 10d-preferences-scrolled, 10e-places, 11a-payments, 11b-card-new, 11c-wallet, 11d-wallet-scrolled, 11e-wallet-topup, 14a-brand-concepts |
| Famille | 12a-famille-home, 12b-famille-home-scrolled, 12c-famille-plans, 12d-famille-invite-sheet, 18a-famille-trip-live, 18b-famille-trip-live-scrolled, 18c-famille-trip-live-scrolled-2, 18d-famille-trip-contact-sheet, 18e-famille-trip-sos-sheet |
| Help and support | 13a-help, 13b-help-scrolled, 13c-help-topic-safety, 13d-help-topic-trip, 13e-support-list, 13f-support-new, 13g-support-thread |
| Car wash | 15a-carwash-home, 15b-carwash-place, 15c-carwash-place-selected, 15d-carwash-vehicle, 15e-carwash-packages, 15f-carwash-when, 15h-carwash-payment-summary, 15i-carwash-payment-scrolled, 15j-carwash-order-booked, 15k-carwash-order-washing-live, 15l-carwash-order-completed-team, 15n-carwash-order-completed, 15o-carwash-completed-photos, 15p-carwash-completed-photos-2, 15q-carwash-rating, 15r-carwash-rated, 15s-carwash-home-with-orders |
| Ride | 16a-ride-searching, 16b-ride-driver-assigned, 16c-ride-driver-assigned-scrolled, 16g-ride-driver-arrived, 16h-ride-in-progress, 16i-ride-in-progress-scrolled, 16j-ride-completed-receipt, 16k-ride-completed-receipt-scrolled, 16l-receipt-payment-confirmed, 16m-receipt-fare-detail, 16n-ride-no-driver, 16o-ride-sos-sheet, 16p-ride-cancel-sheet |

**`driver/` (78 light)**

| Group | Files |
|---|---|
| Onboarding, sign-in | 10a-welcome, 10b-onboarding-2, 11a-signin-phone, 11b-otp |
| Home | 20a-home-offline, 20b-home-offline-scrolled, 20c-home-online, 20d-home-with-active-ride, 20e-home-after-ride, 24a-home-debt-blocked, 25a-home-vehicle-in-review, 26a-home-licence-to-fix, 27a-home-famille-in-review |
| Offer and ride | 21a-offer, 21b-offer-decline-sheet, 22a-ride-assigned, 22b-ride-contact-sheet, 22c-ride-cancel-sheet, 22d-ride-arrived, 22e-ride-in-progress-stop1, 22f-ride-in-progress-final, 23a-ride-end-cash-pending, 23b-ride-end-cash-confirmed |
| Money | 30a-earnings, 30b-earnings-scrolled, 30c-earnings-period-last, 31a-wallet, 31b-wallet-scrolled, 31c-wallet-debt-blocked, 32a-ledger, 32b-ledger-scrolled, 32c-ledger-deeplink-back-error, 33a-recharge, 33b-recharge-processing, 33c-recharge-result, 33d-recharge-debt, 34a-withdraw, 34b-withdraw-scrolled, 34c-withdraw-filled, 34d-withdraw-result |
| History | 35a-rides-history, 35b-ride-detail |
| Account | 40a-account, 40b-account-scrolled, 40c-vehicle-profile, 40d-preferences, 40e-signout-dialog, 41a-famille, 41b-famille-scrolled, 41c-famille-application-review, 42a-support-list, 42b-support-new, 44a-carwash |
| Dossier | 43a-dossier-status-approved, 43b-dossier-status-vehicle-review, 43c-dossier-status-fix, 43d-dossier-status-fix-scrolled |
| Sign-up | 50a-signup-resume-hub, 51a-signup-hub-new, 51b-signup-hub-new-scrolled, 52a-signup-signup-step-name, 52b-signup-signup-step-birth, 52c-signup-signup-step-address, 52d-signup-signup-step-id_document, 52e-signup-signup-step-id_front, 53a-signup-step-id_front, 53b-signup-step-licence_number, 53c-signup-step-licence_dates, 53d-signup-step-experience, 53e-signup-step-person_review, 53f-signup-step-vehicle_model, 53g-signup-step-vehicle_plate, 53h-signup-step-vehicle_registration, 53i-signup-step-vehicle_photo_front, 53j-signup-step-vehicle_review, 53k-signup-famille-intro, 54a-signup-capture-id-front, 54b-docs-start |

**Dark (12):** `passenger-dark/` D1-home-idle, D2-quote, D3-ride-driver-assigned, D4-receipt, D5-wallet, D6-account; `driver-dark/` D1-home-online, D2-offer, D3-ride-assigned, D4-wallet, D5-dossier-status, D6-earnings.

**Contact sheets:** `passenger/sheets/sheet-01.jpg` to `sheet-15.jpg`, and `driver/sheets/sheet-01.jpg` to `sheet-13.jpg` (six screens each).

**Not captured** (check these by hand before the matching batch is called done):
- Famille trip after approval (en route, at school, completed with the photo), and the driver side of a Famille trip.
- Driver ride end with card payment: pending, confirmed, failed.
- Passenger identity photo capture and review with uploads, and the native camera (web shows only Galerie and PDF).
- The dynamic-pricing banner and the "no-casablanca" scenario.
- Car wash « Équipe en route » with the live map.
- Push notifications.
