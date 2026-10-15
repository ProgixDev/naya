---
id: ADR-0059
title: "Status is an icon; problems keep words"
status: Accepted
date: 2026-10-15
deciders: Achraf
supersedes: []
related: [ADR-0023, ADR-0024, ADR-0058, R1, R3, R5, R11, RD-01, audits/2026-10-15-redesign-audit.md, status/open-questions.md]
---

# ADR-0059 · Status is an icon; problems keep words

## Context

The [redesign audit of 15 Oct 2026](../audits/2026-10-15-redesign-audit.md) (§1, §2) found that most states in the
passenger and driver apps were words in tinted pills that differed only by colour: `StatusPill` drew the same 6-pt dot
before every word, the driver's `ActionNote` used one clock for info, warning and neutral, and toasts had no icon. Rows
and screens said the same state two to four times, and the same state had different tones on different screens
(a cancelled ride was danger for the chauffeuse and neutral in the admin; a pending payment was warning in one place
and info in another). The owner's brief: « reduce the icon + name thing and start using icons to explain the status of
something ». On 15 Oct 2026 Achraf accepted the audit's recommended option for every decision (R1–R18,
[open questions](../status/open-questions.md#redesign-decisions-r1r18-15-october)); this ADR records R1, R3 and R5.

## Decision

Show a state as a glyph, from one map, in both apps:

1. **One source.** Every state of every status enum (rides, offers, payments, transfers, bookings, support, verification,
   documents, Famille, car wash, SOS, wallet entries, driver availability, account) is presented through
   `statusPresentation(kind, state)` in `packages/domain/src/status.ts`: a glyph (kebab-case lucide name), a tone, a short
   word (≤ 18 characters), the full French sentence for screen readers, a `problem` flag and an optional motion. Screens
   never pick a colour, glyph or word for a state themselves; they render `StatusIcon` (or `StatusBanner`, `ListRow
   status`, `ActionNote kind/state`) from `packages/ui`. `labels.ts` stays the source of the long labels.
2. **Glyph alone in rows and lists (R1).** Where a state repeats (lists, rows, badges on a payment-method glyph), the glyph
   stands alone. The word shows on screen on a detail hero, the first time a state appears in a flow, and always for a
   problem (failed, refused, to fix, no driver, blocked, expired), with the reason and one move. The full sentence is
   always in the `accessibilityLabel` (`statusA11y` for a row's composed label); a visible word hides the glyph from screen
   readers so the state is never read twice.
3. **One shape per state, one meaning per glyph.** No two states of one kind share a glyph, so colour never carries the
   meaning alone (WCAG 1.4.1). Each glyph keeps one meaning across both apps (audit §2.2): `Clock` is a duration or ETA,
   never a state; `CircleSlash` is a cancellation without fault, `CircleX` a failure; `ArrowUpRight` is retired.
4. **Tones (R3).** `accent` live, `info` waiting on someone else, `success` done, `warning` the viewer must act, `danger`
   failed or refused, `neutral` ended without fault or not started. So a cancelled ride or booking is neutral, a pending
   payment or a review in progress is info, and « Lavage en cours » is accent. The Famille trip, approval, eligibility and
   subscription states follow the C11–C14 table of the audit (R5). Tones map to tokens read in render (ADR-0023).
5. **Motion** only on searching, online, washing and loading, on the native driver, and none under Reduce Motion
   (ADR-0024).

## Consequences

- One change in `status.ts` restyles a state everywhere; the domain test fails if a state has no entry, if two states of
  one kind share a glyph, if `Clock` becomes a state or if a tone rule of §2.3 is broken.
- `StatusPill` is a thin wrapper and deprecated; toasts and banners carry the tone glyph (`TONE_GLYPHS`).
- e2e specs can no longer select a routine state by its visible text: they use a `testID` or the accessibility label.
- The admin still uses its own tone tables; adopting the map there is batch B12, deferred (R9, RD-13).
- Customer copy rules do not change: French, « vous », no demo wording (ADR-0058).

## Alternatives considered

- **Glyph and word everywhere, smaller** (R1 option b): keeps the repetition the audit counted on lists and heroes.
- **Per-screen tones** (R3 option b): keeps the conflicts listed in audit §2.3, the same state in two colours.
- **A per-app status map**: the apps share most states and the same people switch between them; two maps would drift.

## Evidence

Commits on `feat/passenger-polish`: `81c7955` (the audit), `61e2413` (B0 status system and B1 lists and frame), then
the screen batches `820a87e` … `d50e2c7` that moved the screens onto the map.

- Code: `packages/domain/src/status.ts` (`statusPresentation`, `statusA11y`, `TONE_GLYPHS`, `STATUS_STATES`);
  `packages/ui/src/StatusIcon.tsx`, `packages/ui/src/Icon.tsx`, `packages/ui/src/Feedback.tsx`,
  `packages/ui/src/List.tsx`; `apps/driver/src/components/Kit.tsx` (`ActionNote`).
- Enforced by: `packages/domain/test/status.test.ts` ("covers every state of every enum, and nothing else", "never lets
  two states of one kind share a glyph (colour is never the only cue)", "keeps one meaning per glyph", "applies the tone
  rules of §2.3 (R3, R5)", "marks the problem states, which always keep their word");
  `packages/ui/src/__tests__/statusIcon.test.tsx` ("shows the glyph alone for a routine state, with the sentence for
  screen readers (R1)", "stops every animation under Reduce Motion").

## Revisit when

A new status enum or state is added (give it an entry and a distinct glyph first), the admin adopts the map (B12), or a
usability test shows that a glyph alone is not understood in a list.
