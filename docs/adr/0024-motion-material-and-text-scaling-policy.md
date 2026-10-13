---
id: ADR-0024
title: "Motion, material and text-scaling policy"
status: Accepted
date: 2026-10-01
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0023, docs/DESIGN.md, DRV-14, UI-08, UI-22, VIS-17]
---

# ADR-0024 · Motion, material and text-scaling policy

## Context

The handoff asks for translucent materials only on floating map controls, navigation and selected secondary actions, native glass where supported with an opaque fallback, respect for Reduce Transparency, and critical amounts and decisions on highly legible surfaces (handoff prompt:62). Motion must be purposeful, with no bouncing navigation, and essential state must stay visible under Reduce Motion (prompt:206-210). Text scaling must be able to grow layouts (prompt:60), and screens are reviewed with larger text (prompt:218).

## Decision

- **Motion.** No springs and no overshoot. Animate with monotonic eased timing from `tokens.motion` (press 90/140 ms to 98,5 %, selection 180 ms, sheets 260/200/220 ms, navigation 250 ms). One navigator transition per route; under Reduce Motion, stack transitions are removed and state stays visible.
- **Material.** Use `Glass` only for floating map controls, navigation and secondary pills. It renders native Liquid Glass on iOS 26+, blur on other iOS and web, and an opaque surface on Android and whenever Reduce Transparency is on. Never put money amounts, identity decisions or confirmations on glass.
- **Text scaling.** Honour Dynamic Type, capped at 1,6× for text and 1,4× for button labels. At a font scale of 1,3 or more (`largeText`), stack side-by-side fields and tiles into one column. Touch targets are at least 44 pt on iOS and 48 on Android (`minTouch`, applied through `hitSlopFor`).

## Consequences

- The apps feel calm and consistent; motion never hides state.
- Every new animated component must take its timing from `motionTiming` and check `reduceMotion`; there is no lint rule for it.
- Large text still overflows some fixed bottom sheets and the driver home card (backlog [DRV-14, UI-22, VIS-17](../status/backlog.md)); live-region announcements reach Android only (UI-08).

## Alternatives considered

Springs were used until `0e0b066` ("replace bounce with smooth motion"); the design log records what replaced them (`docs/DESIGN.md:61-65`), and the only stated reason is the handoff's "bouncing navigation" rule (prompt:208). Blur on Android was avoided as costly and inconsistent (`packages/ui/src/Glass.tsx:26`).

## Evidence

Line numbers at commit `c38429d`.

- Commits: `177cbd6` (2026-09-30) glass, text cap and large-text flag; `0e0b066` (2026-10-01) removed springs and added `motion.ts`.
- `packages/tokens/src/index.ts:91-99` (`motion`), `:83` (control heights); `packages/ui/src/motion.ts:5-20` (eased timing, stack motion off under Reduce Motion).
- `packages/ui/src/Glass.tsx:20-27` (material choice), `:39-43` (where glass may be used).
- `packages/ui/src/Text.tsx:20-24` (1,6× cap); `packages/ui/src/Button.tsx:53` (1,4×); `packages/ui/src/a11y.ts:5-23` (Reduce Motion and Transparency, `largeText` at 1,3), `:25-31` (touch targets); `packages/ui/src/Form.tsx:102-103` and `packages/ui/src/DocumentPicker.tsx:27-29` (rows become columns).
- `docs/DESIGN.md:23-24`, `:42-44`, `:58`, `:61-65`.
- Enforced by: `packages/ui/src/__tests__/components.test.tsx:29` (loading keeps the button's width) and `:90` (wallet figures stay distinct). Motion and material are checked by native captures (`docs/screens/native/390-reduced`, `390-large-text`), not by automated tests.

## Revisit when

- Expo or iOS changes the Liquid Glass API (`expo-glass-effect`), or
- an accessibility review sets different caps, or
- Android is tested on devices and blur becomes viable there.
