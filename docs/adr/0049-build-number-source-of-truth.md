---
id: ADR-0049
title: "Build-number source of truth"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0012, ADR-0027, ADR-0057, P18, QA-15, docs/runbooks/testflight-eas.md]
---

# ADR-0049 · Build-number source of truth

## Context

Part of **D13** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d13-branches-ci-and-build-numbers)). It supports the release-configuration part of P18 ([backlog](../status/backlog.md)). Build numbers are written only in the build log of [runbooks/testflight-eas.md](../runbooks/testflight-eas.md); this ADR cites where they are set, never their values.

Up to four things can set the iOS build number at `c38429d`:

1. **EAS.** Both `eas.json` files use `appVersionSource: "remote"`, with `autoIncrement` on the `production` and `demo-testflight` profiles. With a remote source, EAS keeps its own counter and ignores the app config.
2. **The app config.** Both `app.config.ts` files also set `ios.buildNumber`, which a local prebuild writes into the Xcode project.
3. **The archive command.** It passes `CURRENT_PROJECT_VERSION`, which overrides the app config (runbook, step 3).
4. **The upload.** The export plist sets `manageAppVersionAndBuildNumber`, so Xcode may raise the number during upload. One driver archive was uploaded under a higher number than it was built with (runbook, step 4).

Every recorded TestFlight upload was a local Xcode archive; none used EAS. The docs (`docs/STANDALONE-DEMO.md:13`), the configs at each commit and the uploads disagree. The configs changed in `89aae18` and again in `02ff3d3`, which a teammate pushed with a message that does not mention it. A duplicate or skipped upload is easy.

## Decision

**Recommended, pending Achraf’s choice: local archives stay the path, so `app.config.ts` is the only source.**

1. Set `appVersionSource: "local"` in both `eas.json` files, and remove `autoIncrement`, because EAS cannot rewrite a dynamic `app.config.ts`.
2. Do not pass `CURRENT_PROJECT_VERSION` to `xcodebuild`. Set `manageAppVersionAndBuildNumber` to false, so the uploaded number is the archived number.
3. Before an upload, read the latest build in App Store Connect. Raise `ios.buildNumber` (and `android.versionCode` once Android ships) in a commit of its own, and add a row to the build log in the same commit.
4. If builds move to EAS or CI, write a new ADR that switches to `remote`, removes `buildNumber` from the configs, and supersedes this one.

## Consequences

- One number, one place: the commit that raised it, and the log row that records it.
- Uploads need one manual step (read App Store Connect, then commit). This fits the current team size.
- `docs/STANDALONE-DEMO.md` stops stating build numbers and links to the build log.
- Two people uploading in parallel can still collide. The log row and PR review ([ADR-0057](0057-branch-review-and-ci-policy.md)) catch it.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| EAS remote versioning | EAS hands out numbers and avoids collisions | Only works for builds that go through EAS; local archives drift from it |
| Keep both (today) | No change | Four places can set the number, and they already disagree |

## Evidence

Line numbers at commit `c38429d`.

- `apps/passenger/eas.json:4`, `apps/driver/eas.json:4` (`appVersionSource: "remote"`); `:34`, `:42` in both (`autoIncrement`).
- `apps/passenger/app.config.ts:18`, `apps/driver/app.config.ts:18` (`ios.buildNumber`).
- `docs/STANDALONE-DEMO.md:13` (build numbers stated in prose).
- Commits `89aae18` and `02ff3d3` (2026-10-06) changed `buildNumber` in both configs.
- [runbooks/testflight-eas.md](../runbooks/testflight-eas.md), steps 3–4 (`CURRENT_PROJECT_VERSION`, `manageAppVersionAndBuildNumber`).
- Enforced by: nothing.

## Revisit when

- Builds move to EAS or to CI, or
- Android ships and needs `versionCode` under the same rule.
