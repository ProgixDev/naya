# Design record

## Direction

Composed, warm and precise: pearl ground (`#F8F7F9`), deep plum action (`#6B3657`), restrained mauve, Inter at explicit weights, the supplied "Rencontre" symbol and wordmark, and the original image-generated art (Salma, Amina, Naya Signature car). Tokens live in `packages/tokens` and are the Figma variables `--naya-*` plus semantic status colours.

## References consulted

- **ui-craft** (SKILL.md rules, recipes, contact sheets): Uber 05 (confirm pickup, stops editor), Google Maps 03 (place sheet over map, floating discs), Wise 01 (money home, rows 64–80, one hero figure).
- **Refero**, across categories:
  - Finance — Wise "Available to spend" (one-sentence definition sheet per figure), PayPal wallet home (balance card + activity), Mercury "User Activity" (dense audit table, filter + date chips, row → detail).
  - Wellness — Flo and Introspect onboarding (one illustration, one sentence, one pill), Waterllama (warm pastel art carrying the brand, not the chrome).
  - Productivity — Structured (time picker for planning), Miro/Dropbox admin (sidebar + table + drawer).
  - Travel — Omio and Airbnb checkout (itemised price before commitment, right-aligned figures), District cancellation sheet (refund/fee breakdown before confirming).

## Principles applied

1. **Maps are the stage** (ui-craft rule 21): the map fills the home, pickup and trip screens; controls float as frosted 44-pt discs and pills; content rises in a sheet with a grabber. One full-width decision button appears only where the screen exists for it (Confirmer, Accepter la course).
2. **One primary action per state**, 50 pt only for booking and driver decisions, 44 pt standard, 36 pt compact with 44-pt touch targets (48 on Android edges).
3. **Money is the content** (rule 19): one hero figure per money screen, tabular numerals, colour only inside numbers (green credits), never on buttons. Balance, reserved, available, debt and physical cash are separate labelled figures.
4. **Price transparency before commitment** (Omio/Airbnb/District): the quote shows base, distance, time, minimum adjustment, dynamic multiplier with its reason, and total; cancellation shows the fee and why *before* the confirm button.
5. **States are icons + words; problems keep a sentence** (rules 9, 16): every error names its cause and offers one move; empty states are one line and one action; loading is a skeleton of the final layout.
6. **Selective material**: native Liquid Glass (iOS 26+) or blur only on floating map controls, navigation and secondary pills; an opaque surface with Reduce Transparency; amounts, identity decisions and confirmations always sit on solid white.
7. **Motion with purpose**: press compression 0.985 on the UI thread, sheet gestures, segmented indicator, marker interpolation; one animation per change; app transitions off with Reduce Motion (state stays visible).

## Improvements over the prototype

| Area | Prototype | Implementation |
|---|---|---|
| Status colour | Every state in plum, success and failure looked alike | Semantic success / warning / danger / info tokens with soft fills, always paired with an icon and a sentence |
| Buttons | Several 52-pt full-width buttons stacked on one screen | One dominant action; secondary actions as 44/36-pt pills or text; loading keeps width; disabled is neutral grey with a reason |
| Disabled | Paler plum | Neutral fill + grey label (+ reason line), distinguishable from enabled |
| Wallet card | Four figures as one sentence block | Hero balance + 2×2 labelled figures; debt shown against the city limit; tap-to-explain sheets |
| Quote | Car image dominated, breakdown hidden behind a filter icon | Breakdown available from the fare card before commitment, dynamic reason spelled out, signature car art at 112 pt |
| Offer countdown | 30 frame-by-frame screens | One real timer against the server deadline (clock-skew corrected), ring + tabular seconds, urgent colour under 10 s, screen-reader announcements every 10 s |
| Tab bar | Icon + label capsule | Kept (labels always visible), active item on a plum pill with white icon and label |
| Onboarding | Centred art, large empty gap | Shared editorial opening: art stage capped at 350 pt, large left-aligned title, swipeable and vertically scrollable slides, compact progress indicator |
| Forms | Pre-filled static fields | Real validation (Zod), errors announced, OTP paste/autofill, +212 first, keyboard-safe pinned action |
| Admin | Phone-like cards stretched on desktop | Sidebar + dense tables + detail drawers + audit trail with integrity check |
| Maps | Static vector image | Real maps (Apple Maps on iOS, tiles fallback) with attribution, live marker interpolation, stale-location banner |

## Accessibility

Labels on every icon-only control, visible labels under unfamiliar icons, `accessibilityRole`/`State` on toggles and tabs, live regions for countdowns and errors, font scaling up to 1.6× with layouts that grow, 4.5:1 contrast for text (muted `#716977` on pearl exceeds 4.5:1), Reduce Motion and Reduce Transparency honoured.


## October 2026 app refinement

The shared UI now uses a quieter neutral pearl ground, white content surfaces, restrained plum actions and subtler frost. Inter screen titles are 30/36 and onboarding titles 34/39; primary controls have a 50-point minimum height and can expand for wrapped text. Fields use an 18-point radius, cards 22 and sheets 32. Shared primitives carry the treatment through forms, verification, support and payment screens as well as the main tabs.

The passenger home centres destination search and Naya Signature artwork; upcoming trips have distinct date, destination and fare rows. Quotes pair the signature car with the total before the breakdown. Both account screens use a shared profile hero. Driver availability is separated from earnings and balance, while the wallet uses a dark plum balance card with independently labelled financial figures. The admin has a dark navigation rail, calmer table surfaces and clearer page hierarchy.

The existing Rencontre identity and transparent generated artwork are retained. No generic replacement logos or car clip art were introduced. New reference review used ui-craft's Rewind and Notion contact sheets for visual hierarchy, generous image stages and restrained controls.

Native review also identified a cache-clearing race on account switches. The boundary now removes only the previous account's queries; a regression test covers preserving the incoming account and public data. Loading account guards show a progress indicator. Native map framing waits for readiness and refits when the available layout changes.


Large-text review also covers live Dynamic Type changes. Text nodes refresh their native measurement when font scale changes, wallet figures switch to a two-column layout, and onboarding content remains vertically scrollable with its action pinned. The active-trip timeline uses compact stop names so departure, intermediate stop and destination remain visible together at normal text size.


## Motion refinement — no bounce

All app-authored springs have been replaced with monotonic eased timing. Button feedback compresses to 98.5% over 90 ms and returns over 140 ms; tab and segmented selection take 180 ms; sheets open over 260 ms, close over 200 ms and settle after a drag over 220 ms. Native drill-down uses a 250 ms simple push; task screens rise from the bottom. Ordinary scroll views and onboarding pages do not rubber-band at the edges. Native pull-to-refresh remains available on trip lists. Native map movement, spinners and the gentle skeleton opacity cycle remain purposeful, without scale bounce.

Reduce Motion now consistently covers driver and passenger stacks, tabs, sheet gesture settling, country selection and confirmation dialogs. Admin transitions and press transforms are suppressed under the browser's reduced-motion preference. System-owned keyboard, maps and native gesture rendering remain platform controlled.
