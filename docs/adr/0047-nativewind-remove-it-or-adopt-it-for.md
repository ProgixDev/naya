---
id: ADR-0047
title: "NativeWind: remove it, or adopt it for new mobile code"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0002, ADR-0016, ADR-0023, DOM-13, DOC-13, QA-11]
---

# ADR-0047 · NativeWind: remove it, or adopt it for new mobile code

## Context

One of the "Engineering housekeeping" calls in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#smaller-calls-with-defaults)). The audit's default is to remove it. No P-item depends on it; it closes backlog DOM-13 and DOC-13 ([backlog](../status/backlog.md)).

- **Wired into both apps.** NativeWind 4 is set up in both mobile apps:
  - the Babel `jsxImportSource` and the css-interop plugin;
  - `withNativeWind` in Metro;
  - a `global.css` import in the root layout;
  - a Tailwind config with the NativeWind preset;
  - the `nativewind` dependency and its type reference.
- **Leaks into the UI kit.** `packages/ui` type-checks against the passenger app's NativeWind declaration file.
- **Unused.** No mobile source uses `className`. The only trace is an unused prop type in `PressableScale`.
- **The real styling system.** Mobile styling is inline styles from tokens, with `useTheme()` and `themedStyles()` ([ADR-0023](0023-mobile-styling-and-runtime-dark-mode.md)).
- **Light only.** The shared Tailwind preset says the scheme "is never switched by the OS", which contradicts runtime dark mode.
- **Admin.** The admin also uses this preset through plain Tailwind.
- **Upgrade risk.** NativeWind's own Babel preset had to be dropped to avoid a duplicate Worklets plugin ([ADR-0002](0002-track-the-stable-expo-sdk-57-line.md)). It adds work to every SDK upgrade.

## Decision

**Recommended, pending Achraf’s choice: remove NativeWind from both mobile apps.**

1. **What goes.**
   - the Babel `jsxImportSource` and plugin;
   - the Metro wrapper;
   - the `global.css` files and their imports;
   - the app Tailwind configs;
   - the `nativewind` and css-interop dependencies;
   - `nativewind-env.d.ts`;
   - the `packages/ui` tsconfig include;
   - the `className` prop type.
2. **What stays.** Keep `@naya/tokens/tailwind-preset.js` for the admin only, and correct its comment.
3. **Check after removal.** Run typecheck, the jest suite, `expo lint`, a web export and an iOS prebuild.

## Consequences

- Shorter Babel and Metro pipelines, and one less dependency to align on each Expo SDK upgrade.
- One styling system on mobile: tokens with `useTheme()`.
- Docs that present NativeWind as the mobile styling system must change (backlog DOC-13).
- The removal needs `pnpm remove` and a lockfile update, so it lands as its own PR with CI green.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Adopt it for new mobile code | Utility classes, shared vocabulary with the admin | Needs a dark-mode preset built on CSS variables; two styling systems in one codebase; every shared component is already inline |
| Keep it wired but unused | No work | Build and upgrade cost with no use; misleads readers and agents |

## Evidence

Line numbers at commit `c38429d`.

- `apps/passenger/babel.config.js:8-9`, `apps/driver/babel.config.js:8-9` (jsxImportSource and plugin).
- `apps/passenger/metro.config.js:3-6`, `apps/driver/metro.config.js:3-6` (`withNativeWind`).
- `apps/passenger/src/app/_layout.tsx:2`, `apps/driver/src/app/_layout.tsx:2` (`global.css`).
- `apps/passenger/tailwind.config.js:4`, `apps/driver/tailwind.config.js:4`; `apps/passenger/package.json:56`, `apps/driver/package.json:54` (`nativewind` 4.2.7).
- `packages/ui/tsconfig.json:4` (includes the passenger's `nativewind-env.d.ts`); `packages/ui/src/PressableScale.tsx:12` (the only `className`).
- `packages/tokens/tailwind-preset.js:22-23` (light-only comment); `apps/admin/tailwind.config.cjs:4` (admin uses the preset).
- Enforced by: nothing; `git grep className` over `apps/passenger/src`, `apps/driver/src` and `packages/ui/src` finds only the prop type.

## Revisit when

A designer or developer wants utility classes on mobile. Then adopt NativeWind fully, with a dark preset, in a new ADR that supersedes this one.
