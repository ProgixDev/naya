---
id: ADR-0001
title: "pnpm 12 workspace with hoisted node_modules"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0002, ADR-0051, QA-08, QA-11, UI-20]
---

# ADR-0001 · pnpm 12 workspace with hoisted node_modules

## Context

The handoff asks for one workspace with `apps/passenger`, `apps/driver`, `apps/admin` and shared packages (handoff prompt:46), and a committed lockfile (prompt:31). It does not name a package manager. React Native tooling (Metro, CocoaPods and Gradle autolinking) finds native modules by walking `node_modules`; pnpm's default isolated layout keeps transitive packages out of reach.

## Decision

Use one pnpm 12 workspace (`apps/*`, `packages/*`, `services/*`, `e2e`) with `nodeLinker: hoisted`, so every package sees a flat `node_modules`. Pin pnpm in `package.json` (`packageManager`) and run root scripts through pnpm (`--filter` for one package, `-r` across the workspace). When a transitive range pulls React Native tooling off the SDK 57 line, pin it back with a workspace `overrides` entry (today `@react-native/metro-config` 0.86.3).

## Consequences

- Metro and native autolinking work without per-package workarounds.
- Hoisting hides undeclared dependencies: a package can import something it never declared and still build (backlog [QA-11, UI-20](../status/backlog.md)). Typecheck and tests do not catch this.
- Every override must be re-checked at each Expo SDK upgrade.
- `pnpm-lock.yaml` changes with every `package.json` change and is committed with it.
- Exception today: `apps/web` also has an npm lockfile, and the root `dev` and `build` scripts call npm (backlog QA-08). [ADR-0051](0051-apps-web-package-manager.md) decides it.

## Alternatives considered

Not recorded at the time. The comment at `pnpm-workspace.yaml:7` states why the isolated linker was not used.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `96af8c6` (2026-09-30) created the workspace with `nodeLinker: hoisted`; `a7bf4b0` (2026-09-30) added the `@react-native/metro-config` override.
- `pnpm-workspace.yaml:1-5` (members), `:7-8` (hoisted linker and its reason), `:17-19` (override and its reason).
- `package.json:5` (`packageManager`), `:10-21` (pnpm scripts: `--filter`, plus `-r` for `typecheck` and `test`), `:22-23` (npm scripts for apps/web).
- `README.md:49` records the choice in the version table.
- Enforced by: no test. A broken layout shows up as Metro resolution or `pod install` failures.

## Revisit when

- Expo and React Native autolinking support pnpm's isolated linker, or
- an Expo SDK upgrade makes the override unnecessary or wrong, or
- [ADR-0051](0051-apps-web-package-manager.md) is decided.
