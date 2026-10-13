---
id: ADR-0050
title: "Repo path with spaces"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0002, ADR-0027, ADR-0052, QA-10, WEB-15]
---

# ADR-0050 · Repo path with spaces

## Context

The path half of **D15** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d15-repo-path-and-screenshot-weight)). It closes backlog QA-10 ([backlog](../status/backlog.md)), whose "uncommitted, passenger only" part `c38429d` already fixed.

- **The path.** Achraf's checkout lives on an external recovery volume, in a folder whose name contains spaces (`Codex Space Recovery`).
- **What breaks.** Expo SDK 57's Constants build phase and the Xcode phase that invokes React Native's bundle script split such paths at the spaces, so iOS prebuild output fails to build.
- **The workaround.** Commit `c38429d` (13 Oct) added `plugins/with-ios-build-paths.js` and applied it to both apps. That is option (b) of D15, already in place. [ADR-0027](0027-native-platform-constraints-are-handled-by-config.md) records the rule that native fixes live in config plugins.
- **Why the plugin is fragile.** It patches generated files by matching exact text:
  - it inserts a hook after the literal line `  post_install do |installer|` in the Podfile, and throws if that line is missing;
  - it rewrites the "Generate app.config" phase of `EXConstants`;
  - it rewrites any Xcode shell phase that calls `/scripts/react-native-xcode.sh`, with a regular expression.

  An Expo SDK upgrade that changes any of those strings either breaks prebuild or silently skips the fix ([ADR-0002](0002-track-the-stable-expo-sdk-57-line.md)).
- **The path leaks into docs.** Some docs also contain absolute local paths (backlog WEB-15).

## Decision

**Recommended, pending Achraf’s choice: D15 option (a).**

1. Move the repository to a path without spaces, for example `~/Dev/naya` on the internal disk.
2. Then remove the plugin from both `app.config.ts` files, and delete `plugins/with-ios-build-paths.js`. The rule in ADR-0027 stays; only its list of current plugins changes.
3. Until the move, keep the plugin (committed in `c38429d`). Re-run an iOS prebuild and archive for both apps after every Expo SDK upgrade.

## Consequences

- Prebuild depends only on Expo's own templates again. One less script to debug on upgrades.
- Moving the checkout changes local paths:
  - Xcode DerivedData and the git-ignored `work/` folder (move or delete them);
  - editor and agent workspaces;
  - any absolute path written in docs (a docs link check can catch these).
- Other clones (CI runners, a teammate's machine) are unaffected if their paths have no spaces.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) Keep the path and the plugin (in place since `c38429d`) | Works today; no move | Breaks or silently stops working when Expo changes the patched text; every contributor's path must be tested |
| A symbolic link without spaces | No move | Build tools often resolve the real path, so the spaces may come back; unreliable |

## Evidence

Line numbers at commit `c38429d`.

- Commit `c38429d` (2026-10-13) "Quote iOS build paths and set the Apple team in both apps".
- `plugins/with-ios-build-paths.js:1-2` (reason), `:16-36` (Podfile hook; anchor `:31`, throw `:32`), `:21` ("Generate app.config" phase), `:37-50` (Xcode phase rewrite; match `:40`, regular expression `:46`).
- `apps/passenger/app.config.ts:34`, `apps/driver/app.config.ts:34` (plugin applied).
- Enforced by: nothing; the plugin is only exercised by a local iOS prebuild.

## Revisit when

- The next Expo SDK upgrade (re-test the plugin, or remove it if the repo has moved), or
- the repository is moved.
