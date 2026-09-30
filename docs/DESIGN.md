# Design record

## Direction

Composed, warm and precise: pearl ground (`#FAF4F7`), deep plum action (`#6B3657`), restrained mauve, Inter at explicit weights, the supplied "Rencontre" symbol and wordmark, and the original image-generated art (Salma, Amina, Naya Signature car). Tokens live in `packages/tokens` and are the Figma variables `--naya-*` plus semantic status colours.

## References consulted

- **ui-craft** (SKILL.md rules, recipes, contact sheets): Uber 05 (confirm pickup, stops editor), Google Maps 03 (place sheet over map, floating discs), Wise 01 (money home, rows 64–80, one hero figure).
- **Refero**, across categories:
  - Finance — Wise "Available to spend" (one-sentence definition sheet per figure), PayPal wallet home (balance card + activity), Mercury "User Activity" (dense audit table, filter + date chips, row → detail).
  - Wellness — Flo and Introspect onboarding (one illustration, one sentence, one pill), Waterllama (warm pastel art carrying the brand, not the chrome).
  - Productivity — Structured (time picker for planning), Miro/Dropbox admin (sidebar + table + drawer).
  - Travel — Omio and Airbnb checkout (itemised price before commitment, right-aligned figures), District cancellation sheet (refund/fee breakdown before confirming).

## Principles applied

1. **Maps are the stage** (ui-craft rule 21): the map fills the home, pickup and trip screens; controls float as frosted 44-pt discs and pills; content rises in a sheet with a grabber. One full-width decision button appears only where the screen exists for it (Confirmer, Accepter la course).
2. **One primary action per state**, 54 pt only for booking and driver decisions, 44 pt standard, 36 pt compact with 44-pt touch targets (48 on Android edges).
3. **Money is the content** (rule 19): one hero figure per money screen, tabular numerals, colour only inside numbers (green credits), never on buttons. Balance, reserved, available, debt and physical cash are separate labelled figures.
4. **Price transparency before commitment** (Omio/Airbnb/District): the quote shows base, distance, time, minimum adjustment, dynamic multiplier with its reason, and total; cancellation shows the fee and why *before* the confirm button.
5. **States are icons + words; problems keep a sentence** (rules 9, 16): every error names its cause and offers one move; empty states are one line and one action; loading is a skeleton of the final layout.
6. **Selective material**: native Liquid Glass (iOS 26+) or blur only on floating map controls, navigation and secondary pills; an opaque surface with Reduce Transparency; amounts, identity decisions and confirmations always sit on solid white.
7. **Motion with purpose**: press compression 0.96 on the UI thread, sheet gestures, segmented indicator, marker interpolation; one animation per change; everything off with Reduce Motion (state stays visible).

## Improvements over the prototype

| Area | Prototype | Implementation |
|---|---|---|
| Status colour | Every state in plum, success and failure looked alike | Semantic success / warning / danger / info tokens with soft fills, always paired with an icon and a sentence |
| Buttons | Several 52-pt full-width buttons stacked on one screen | One dominant action; secondary actions as 44/36-pt pills or text; loading keeps width; disabled is neutral grey with a reason |
| Disabled | Paler plum | Neutral fill + grey label (+ reason line), distinguishable from enabled |
| Wallet card | Four figures as one sentence block | Hero balance + 2×2 labelled figures; debt shown against the city limit; tap-to-explain sheets |
| Quote | Car image dominated, breakdown hidden behind a filter icon | Breakdown inline under the total, dynamic reason spelled out, car art at 130 pt |
| Offer countdown | 30 frame-by-frame screens | One real timer against the server deadline (clock-skew corrected), ring + tabular seconds, urgent colour under 10 s, screen-reader announcements every 10 s |
| Tab bar | Icon + label capsule | Kept (labels always visible), active item on a tinted pill |
| Onboarding | Centred art, large empty gap | Art capped at 330 pt, text left-aligned under it, progress dots as a pill indicator |
| Forms | Pre-filled static fields | Real validation (Zod), errors announced, OTP paste/autofill, +212 first, keyboard-safe pinned action |
| Admin | Phone-like cards stretched on desktop | Sidebar + dense tables + detail drawers + audit trail with integrity check |
| Maps | Static vector image | Real maps (Apple Maps on iOS, tiles fallback) with attribution, live marker interpolation, stale-location banner |

## Accessibility

Labels on every icon-only control, visible labels under unfamiliar icons, `accessibilityRole`/`State` on toggles and tabs, live regions for countdowns and errors, font scaling up to 1.6× with layouts that grow, 4.5:1 contrast for text (muted `#756775` on pearl is 4.9:1), Reduce Motion and Reduce Transparency honoured.
