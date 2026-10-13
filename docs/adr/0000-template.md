---
id: ADR-NNNN
title: "Short title that states the decision"
status: Proposed            # Proposed | "Proposed — confirm intent" | Accepted | Rejected | "Superseded by ADR-NNNN"
date: YYYY-MM-DD            # day of the decision; for a backfilled ADR, the date of the commit that introduced it
deciders: Achraf            # who decided; "Achraf (via implementation)" when the code made the call and nobody wrote it down
supersedes: []              # ADR ids this one replaces, e.g. [ADR-0007]
related: []                 # ADR ids, backlog IDs (docs/status/backlog.md), specs and docs
---

# ADR-NNNN · Short title

<!-- One page at most. Copy this file to NNNN-short-slug.md, take the next free number, and never renumber. -->

## Context

What forced a decision, in facts. Link the original requirement when one exists: a handoff line (`handoff prompt:N`), a feedback item, a founder brief, a backlog ID. Quote at most a short phrase.

## Decision

One paragraph in the imperative: "Store money as …", "Never …". Someone who reads only this paragraph must know what to do.

## Consequences

What becomes easier, what becomes harder, what is now forbidden. Name known gaps with their backlog IDs.

## Alternatives considered

Each option and why it lost. For a backfilled ADR: "Not recorded at the time", then only what the repo shows (README notes, commit messages, comments).

## Evidence

Line numbers at commit `<hash>` (they drift; always name the commit).

- Commits: `<hash>` (YYYY-MM-DD) …
- Code: `path/to/file.ts:12-30` …
- Enforced by: `path/to/test.ts:NN` "test name". Say so when no test enforces it.

## Revisit when

A concrete trigger: an event, a dependency, a date or a number. Never "later".

<!--
Conventions
- Status flow: Proposed → Accepted or Rejected (keep a rejected ADR; it records why). To change an Accepted ADR, write a new one,
  list the old id in `supersedes`, and set the old one's status to "Superseded by ADR-NNNN". Do not rewrite history.
- "Proposed — confirm intent": the code already does it, but it reverses an original rule, so Achraf must confirm it before it is Accepted.
- `handoff prompt:N` means line N of _handoff/Naya-Expo-React-Native-Implementation-Prompt.md. That folder is git-ignored
  (listed in .gitignore) and exists only on Achraf's Mac; see ADR-0056.
- Project docs are in English; quote UI copy in French as it appears.
- Never write test counts or build numbers here. They live in docs/quality/verification-log.md and docs/runbooks/testflight-eas.md.
- Never paste passwords, keys or tokens, even demo ones.
-->
