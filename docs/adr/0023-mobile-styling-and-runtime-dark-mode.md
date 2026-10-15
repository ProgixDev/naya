---
id: ADR-0023
title: "Mobile styling and runtime dark mode"
status: "Proposed — confirm intent"
date: 2026-10-06
deciders: Achraf (via implementation); confirmation pending
supersedes: []
related: [ADR-0002, ADR-0024, ADR-0047, P15, PAX-01, UI-02, UI-09, DOM-12, DOM-13, DOC-13, DM-01..DM-20]
---

# ADR-0023 · Mobile styling and runtime dark mode

> **Confirm intent.** This reverses the light-only appearance the apps shipped with until 6 October. Achraf must confirm it was intended before it is Accepted (audit decision D14, which recommends accepting it).

## Context

What the original said: the handoff describes one look, "pearl surfaces, deep plum, restrained mauve" (handoff prompt:52), asks for semantic colour tokens (prompt:56) and names NativeWind as the shared styling system (prompt:38). It never mentions dark mode. The first implementation forced the light appearance (`userInterfaceStyle: 'light'`, `177cbd6`) with one light palette, and wrote screens with inline styles from `@naya/tokens`, never with `className`.

What changed: item 7 of the client's feedback PDF asked for dark mode; the before-state audit recorded that the apps forced light appearance (`docs/MOBILE-FEEDBACK-AUDIT.md:25`). Commit `89aae18` added a dark palette and a user setting in both apps.

## Decision

Style mobile UI with React Native inline styles built from `@naya/tokens`. Read colours through the `colors` object, a Proxy that returns the light or dark palette for the current scheme. Every component that reads colours calls `useTheme()` so it re-renders when the scheme changes; styles built at module level go through `themedStyles()`. Do not use `className` (NativeWind stays installed but unused, [ADR-0047](0047-nativewind-remove-it-or-adopt-it-for.md)). The person chooses Clair, Sombre or Système in Préférences; the choice is stored in AsyncStorage under `naya.theme`, and both apps declare `userInterfaceStyle: 'automatic'`. The admin and the website stay light-only for now.

## Consequences

- Both apps follow the system or the person's choice, including maps and status bars (`docs/MOBILE-FEEDBACK-DEMO.md:15`).
- The mechanism is fragile: a component that forgets `useTheme()`, or captures `colors.*` in a module-level constant, renders light colours in dark mode. That caused the dark-mode defects on the first screens and home (backlog [P15, PAX-01, UI-02, DOM-12](../status/backlog.md)).
- Since 15 October (dark-mode audit, backlog DM-01 to DM-20) a jest guard enforces it: `packages/ui/src/__tests__/theme.test.tsx` parses packages/ui and both apps and fails on a colour read at import, a component that reads colours without `useTheme()`, or colours cached in `useState`, `useRef`, or `useMemo`/`useCallback` without the scheme in its deps. Its `KNOWN` list is empty and must stay empty. It runs in `CI=1 pnpm --filter @naya/passenger test`.
- The JavaScript cold-start flash is gone (UI-09): `packages/ui/src/core/theme.tsx` seeds the palette from `Appearance` at import, and both root layouts render nothing until `useThemeReady()` has applied the stored choice. 'Système' follows only `Appearance` change events, since iOS returns a stale value right after an override is cleared. The native splash and root background are still light until a new native build ships the dark `expo-splash-screen` variant (DM-06).
- Token roles: `outline` for control boundaries (≥ 3:1 in both schemes), `hairline` for decorative edges, `line` for separators, `muted` for placeholders. `inverse` is only for text on accent; text on media or on the fixed plum wallet card is fixed white. `shadowColor` is never `colors.ink`. `shadow.*` is scheme-aware, and `themedStyles` builds once per scheme.
- Open owner calls: the dark toast style (an elevated pill with a hairline edge was chosen and can be reverted, DM-15), and whether to lift the dark surface colours (DM-07).
- The Tailwind preset is light-only, so adopting NativeWind later needs a dark preset ([ADR-0047](0047-nativewind-remove-it-or-adopt-it-for.md)). README and the handoff still present NativeWind as the styling system (backlog DOC-13).

## Alternatives considered

Keep light only, as shipped until `89aae18`: rejected by the feedback request. React Native `useColorScheme()` alone with no user override, or NativeWind's `dark:` variants: not recorded as considered.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `177cbd6` (2026-09-30) forced light; `89aae18` (2026-10-06) set `'automatic'`, added `darkColors`, `theme.tsx` and `ThemePicker`.
- `packages/tokens/src/index.ts:6-37` (light palette), `:40-42` (dark palette), `:43-50` (scheme, `colors` Proxy, `themedStyles`).
- `packages/ui/src/core/theme.tsx:5-55` (mode, `useTheme`, persistence, `ThemeController`); `packages/ui/src/core/Providers.tsx:70`.
- `apps/passenger/app.config.ts:12` and `apps/driver/app.config.ts:12`; `apps/passenger/src/app/(app)/preferences.tsx:53`, `apps/driver/src/app/(app)/profile/preferences.tsx:41`.
- `packages/tokens/tailwind-preset.js:1-2` (light-only preset).
- Enforced by: `e2e/tests/scenarios-feedback.spec.ts:5` (dark mode selected and kept in both apps, around `:95-115`). Until 15 October no test caught a component that ignored the theme.
- Since 15 October (branch feat/passenger-polish, commits 7f5ecde to d2fa271): `packages/ui/src/core/theme.tsx:57` (palette seeded at import), `:64-71` (system events, background deferral), `:103` (`useThemeReady`); `apps/passenger/src/app/_layout.tsx:34`, `:60-63` and `apps/driver/src/app/_layout.tsx:35`, `:64-67` (navigation theme, readiness, `SystemUI` background); `packages/tokens/src/index.ts:38`, `:47` (`outline`, `hairline`, `thumb`), `:67` (`themedStyles` cache), `:132` (scheme-aware `shadow`). Tests: `packages/ui/src/__tests__/theme.test.tsx` (runtime behaviour and the AST guard, `KNOWN` at `:131`), `palette.test.tsx` (contrast from the tokens), `segmented.test.tsx`. Gate runs: [verification log](../quality/verification-log.md), 2026-10-15 dark-mode rows.

## Revisit when

- Achraf confirms or rejects this ADR, or
- [ADR-0047](0047-nativewind-remove-it-or-adopt-it-for.md) is decided, or
- the admin or website needs dark mode.
