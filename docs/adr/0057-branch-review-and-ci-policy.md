---
id: ADR-0057
title: "Branch, review and CI policy"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0001, ADR-0028, ADR-0049, ADR-0051, ADR-0052, P18, QA-02, QA-03, QA-04, QA-06, QA-15, DOC-21]
---

# ADR-0057 · Branch, review and CI policy

## Context

Decision **D13** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d13-branches-ci-and-build-numbers)). It unblocks the CI half of P18 ([backlog](../status/backlog.md)).

- **Straight to master.** Two people push straight to `master`, with no pull request, review or branch protection.
- **The broken lockfile.** On 6 October:
  - `89aae18` (06:17, Achref) added eslint to the passenger app without updating `pnpm-lock.yaml`, so `pnpm install --frozen-lockfile` failed on `master`;
  - `02ff3d3` (11:51, Arselene) fixed the lockfile by hand. Its message mentions only one of its three changes.

  The audit puts the broken window at about 5.5 hours.
- **No CI.** At `c38429d` the repo has no `.github` directory.
- **Gaps in the gates.**
  - The root `pnpm test` also runs the Playwright suite, which needs four servers started by hand (backlog QA-03).
  - Lint covers 2 of the 10 workspaces (backlog QA-06).
  - The full e2e suite last ran around 30 September. After the 6 October changes only the feedback scenario ran (backlog QA-04).
  - Branch `chore/docs-foundation-and-fixes` closes two of these: the root `pnpm test` now skips e2e (QA-03), and the full e2e suite passed on 13 Oct (QA-04; see the [verification log](../quality/verification-log.md)).
- **Drafts on the branch.** Branch `chore/docs-foundation-and-fixes` adds three files (13 Oct); the workflow has not run on GitHub yet:
  - `.github/workflows/ci.yml`: frozen install, typecheck, unit tests, lint and the admin build on every pull request and push to `master`, plus a manual Playwright job;
  - `.github/CODEOWNERS`;
  - `.github/pull_request_template.md`.

## Decision

**Recommended, pending Achraf’s and Arselene’s agreement.**

1. **One branch per change.** Every change goes through its own branch and pull request, including docs. Nobody pushes to `master` directly.
2. **Required CI on every pull request:**
   - `pnpm install --frozen-lockfile`;
   - `pnpm typecheck`;
   - the unit tests (domain, demo API, shared components through the passenger app, website store);
   - lint.

   Playwright runs manually or nightly until it is reliable enough to gate merges.
3. **Protect `master`** once CI has passed on it:
   - require a pull request with 1 approval from the other person;
   - require the CI checks;
   - require Code Owner review on money, safety, eligibility and permission paths;
   - block force pushes.

   CODEOWNERS needs both people's GitHub handles before Code Owner review is turned on. Otherwise nobody can approve the owner's own pull requests.
4. **Merging.** Use squash merges. The pull request title becomes the commit message and cites backlog IDs (for example `P3, ADM-01`).
5. **When the reviewer is away.** If the other person is unavailable for more than a working day, the author may merge after CI passes, with a note in the pull request. The review then happens after the merge.
6. **Builds.** Every TestFlight upload adds a row to the build log in the same pull request as its build-number change ([ADR-0049](0049-build-number-source-of-truth.md)).

## Consequences

- A broken lockfile or a type error can no longer reach `master` unnoticed.
- Each change waits for CI and a review, which takes minutes to hours. The away rule keeps one person from blocking the other.
- `pnpm test` must stop including e2e, or CI must call each unit suite directly (backlog QA-03). The draft workflow does the latter.
- CI exercises the pnpm-only website setup ([ADR-0051](0051-apps-web-package-manager.md)), and needs git-lfs once [ADR-0052](0052-screenshot-storage.md) is applied.
- The PR template's docs checklist keeps specs, ADRs and the verification log current (audit section 6.8).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Trunk-based with CI on push only | Fast; no waiting | A failure is found after it lands on `master`; still no review |
| GitFlow (`develop` and release branches) | Clear release staging | Heavy for two people and one product |
| Pull requests without branch protection | Light | Depends on discipline; the 6 October incident happened without any |

## Evidence

Line numbers at commit `c38429d`.

- Commits `89aae18` (2026-10-06 06:17, Achref23illi) and `02ff3d3` (2026-10-06 11:51, Arselene) pushed straight to `master` (`git log`).
- `git ls-tree c38429d .github` is empty: no CI at `c38429d`.
- `package.json:17` (`pnpm -r --if-present test` includes `@naya/e2e`); `apps/passenger/package.json:12` and `apps/driver/package.json:12` (the only `lint` scripts).
- Audit sections 7.1, 7.2 and 7.4 (gate results, lockfile incident, tooling gaps).
- Enforced by: the draft workflow, once committed and required by branch protection.

## Revisit when

- A third contributor joins, or
- store releases need release branches, or
- the e2e suite is stable enough to become a required check.
