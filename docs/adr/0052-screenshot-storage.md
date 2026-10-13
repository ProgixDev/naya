---
id: ADR-0052
title: "Screenshot storage"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0050, ADR-0057, QA-07, VIS-06, VIS-21]
---

# ADR-0052 · Screenshot storage

## Context

The screenshot half of **D15** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d15-repo-path-and-screenshot-weight)). It closes backlog QA-07 ([backlog](../status/backlog.md)).

- **What is tracked.** At `c38429d`, `docs/screens` holds 421 files, about 173 MB (sizes from `git ls-tree -l`):

  | Folder | Size |
  |---|---|
  | native | 94 MB |
  | driver | 35 MB |
  | passenger | 33 MB |
  | admin | 9 MB |
  | feedback | 3 MB |

- **History.** All tracked files total about 208 MB. The git pack is 222.6 MiB (`git count-objects -vH`). The audit measured about 216 MB of screenshot blobs in history, and images are about 95 % of all blob weight.
- **Churn.** 9 of the 22 commits up to `c38429d` touch `docs/screens`. Every refresh adds tens of MB that stay in history for good. Many captures are stale or blank (backlog VIS-06, VIS-21). A new set (`docs/screens/ios/`) sits untracked: branch `chore/docs-foundation-and-fixes` anchored the `ios/` ignore rule to `/apps/*/ios/`, so the folder is no longer ignored, and nobody has decided whether to commit it.
- **Tooling.** There is no `.gitattributes`, and Git LFS is not installed on this Mac (`git lfs` is not a command, 13 Oct).
- **Shared remote.** The remote, `github.com/ProgixDev/naya`, is shared with Arselene. Rewriting history means a force push.

## Decision

**Recommended, pending Achraf’s choice: D15 option (a), Git LFS for new captures only.**

1. Install git-lfs on both machines.
2. Add a `.gitattributes` that sends `*.png`, `*.jpg` and `*.jpeg` under `docs/screens/` and `apps/web/review/` to LFS.
3. Keep a small curated set (contact sheets) in plain git.
4. Check the GitHub LFS storage and bandwidth quota for the ProgixDev organisation first.
5. Do not rewrite history now. Rewrite it with `git filter-repo` only if clone size becomes a real problem, and only with Arselene's agreement.

## Consequences

- History stops growing with each capture refresh. Existing blobs stay, so today's clone size does not shrink.
- Every contributor and CI job needs git-lfs. Without it, clones get pointer files instead of images.
- LFS quota and bandwidth count against the organisation's plan.
- Capture scripts and docs keep the same paths.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) LFS plus a history rewrite | Shrinks the clone by about 200 MB | Force push to a shared remote; every clone must be re-made; commit hashes cited in docs and ADRs change |
| External storage (drive or bucket) with links | Git stays light; no LFS quota | Captures detach from the commit they document; links rot |
| Keep plain git | No setup | History keeps growing; slow clones; agents and search tools index images |

## Evidence

Measured at commit `c38429d` on 13 Oct 2026.

- `git ls-tree -r -l c38429d docs/screens` (421 files, 173.4 MB; per-folder sizes above).
- `git count-objects -vH` (pack 222.62 MiB); `git log --oneline c38429d -- docs/screens` (9 commits of 22).
- Audit section 7.3 (history and blob-weight figures).
- Enforced by: nothing.

## Revisit when

- A fresh clone takes too long for a new contributor or for CI, or
- LFS quota warnings appear.
