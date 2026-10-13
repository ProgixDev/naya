---
id: ADR-0002
title: "Track the stable Expo SDK 57 line"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0001, ADR-0023, ADR-0047, DOM-13]
---

# ADR-0002 · Track the stable Expo SDK 57 line

## Context

The handoff asks for the latest stable Expo release, with the React and React Native versions that SDK supports, and says not to pick a prerelease because its number is higher (handoff prompt:31-33). It names NativeWind 4.2.7 with Tailwind CSS 3 and Reanimated 4.5.1, and asks to avoid duplicate animation plugins (prompt:38-39). On 30 September 2026 SDK 57 was stable and SDK 58 was a beta.

## Decision

Build both mobile apps on Expo SDK 57 and take every native version from it: React Native 0.86.3, React 19.2.3, Reanimated 4.5.1 with react-native-worklets 0.10.1, Gesture Handler 2.32, react-native-maps 1.27.2. Use NativeWind 4.2.7 with Tailwind 3.4.19, not the v5 release candidate. Configure Babel with `babel-preset-expo` (`jsxImportSource: 'nativewind'`) plus only the css-interop plugin, not `nativewind/babel`, because that preset adds a second Worklets plugin. Keep the whole monorepo on React 19.2.3, so the admin stays on React Router 7 (v8 needs React ≥ 19.2.7).

## Consequences

- One React version everywhere, including `apps/admin` and `apps/web`; upgrades happen SDK by SDK, never package by package.
- Native dependencies are added with versions from the SDK's compatibility list, not their latest release.
- These versions are newer than the training data of many AI coding tools: read the versioned Expo docs and `node_modules` sources before using an API (root `AGENTS.md`, "Gotchas"; drafted in audit section 6.5).
- NativeWind stays installed and configured, but no mobile code uses `className` (backlog [DOM-13](../status/backlog.md)); [ADR-0023](0023-mobile-styling-and-runtime-dark-mode.md) records the styling actually used and [ADR-0047](0047-nativewind-remove-it-or-adopt-it-for.md) decides its future.

## Alternatives considered

Recorded in the README version table: SDK 58 (beta), React 19.3 (not SDK-supported), NativeWind 5 (release candidate), Reanimated 4.7 (not SDK-pinned), Gesture Handler 3.x (not SDK-supported), TypeScript 7, React Router 8 (needs a newer React). The `nativewind/babel` preset was rejected for the duplicate plugin (`README.md:53`).

## Evidence

Line numbers at commit `c38429d`.

- Commits: `96af8c6` (2026-09-30) added the app manifests; `177cbd6` (2026-09-30) added the Babel setup.
- `README.md:29-53` (version table, reasons, Babel note).
- `apps/passenger/package.json:28` (expo), `:48` (expo-router), `:56` (nativewind), `:57` (react), `:60` (react-native), `:64` (reanimated), `:69` (worklets), `:70` (tailwindcss).
- `apps/admin/package.json:21` (react 19.2.3), `:24` (react-router 7.18.4).
- `apps/passenger/babel.config.js:1-11` (preset choice and its reason).
- Enforced by: `pnpm doctor` (`package.json:19`) runs Expo Doctor on both apps. No test pins versions.

## Revisit when

- Expo SDK 58 (or later) is released as stable: the handoff rule is "current stable", or
- a needed library requires React ≥ 19.2.7, or
- [ADR-0047](0047-nativewind-remove-it-or-adopt-it-for.md) removes NativeWind.
