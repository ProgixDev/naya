---
id: ADR-0056
title: "Source-of-truth order, committing the handoff, and docs language"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0020, ADR-0023, ADR-0025, ADR-0026, ADR-0033, ADR-0038, ADR-0048, P19, QA-01, DOC-02, DOC-04, DOC-05, PRD-37, docs/tasks/2026-10-13.md]
---

# ADR-0056 · Source-of-truth order, committing the handoff, and docs language

## Context

Decision **D14** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d14-source-of-truth-and-the-five-reversals)). It unblocks the ADR half of P19 ([backlog](../status/backlog.md)).

- **Unreadable source of truth.** The README names the Figma file and the handoff package as the source of truth. The handoff folder `_handoff/` is git-ignored and exists only on Achraf's Mac. It holds about 14 MB:
  - the implementation prompt (240 lines);
  - `README.md` (79 lines) and `QA.md` (44 lines);
  - `project-manifest.json`;
  - PNG art.

  Agents and Arselene cannot read the rules that ADRs cite as "handoff prompt:N".
- **Missing feedback.** The client's ten-page feedback PDF is not in the repo. Only its assessment is (`docs/MOBILE-FEEDBACK-AUDIT.md`).
- **Licence.** The handoff text files carry no licence or confidentiality notice. Their only licence lines cover OpenStreetMap data and Lucide icons. Whether the Figma file or the PDF come with terms is not known from the repo.
- **Five reversals with no record.** An agent cannot tell an intended change from a bug:
  - dark mode ([ADR-0023](0023-mobile-styling-and-runtime-dark-mode.md));
  - vector art instead of generated characters ([ADR-0025](0025-mobile-illustrations-are-vector-svg-and-avatars.md));
  - the Confort tier ([ADR-0026](0026-service-categories-including-a-premium-naya-confort.md));
  - the category commission ([ADR-0033](0033-pricing-precedence-between-city-rules-and-service.md));
  - the second backoffice ([ADR-0038](0038-canonical-backoffice.md)).
- **A new kind of source.** Dated founder briefs now exist: [docs/tasks/2026-10-13.md](../tasks/2026-10-13.md) is the task list drawn from the founder's brief of 13 October 2026.
- **Language.** Existing project docs are in English. All UI copy is French ([ADR-0020](0020-french-only-product-mad-africa-casablanca-business.md)).

## Decision

**Recommended, pending Achraf’s choice.**

1. **Precedence.** When sources disagree, the higher one wins:
   1. Accepted ADRs;
   2. specs (`docs/specs/`);
   3. founder briefs (`docs/tasks/`, newest first);
   4. the handoff and Figma;
   5. the feedback PDF summary.

   A founder brief is a request. Once work starts, it becomes a spec or an ADR. The audit proposed the same order without founder briefs, which did not exist yet.
2. **Commit the handoff text.** Once Achraf confirms there is no licence or confidentiality limit:
   - commit the handoff text files to `docs/handoff/`, with a banner: "partly superseded — see docs/adr";
   - add a faithful text summary of the PDF (`docs/handoff/feedback-pdf-summary.md`);
   - keep the PNGs out of git.

   Then "handoff prompt:N" points at a committed file.
3. **Language.** Write project docs in English. Keep UI copy in French, and quote it in French in docs.
4. **The five reversals.** Accept dark mode and vector art as intended; [ADR-0048](0048-cross-surface-media-and-brand.md) narrows vector art to in-app states. Settle Confort in [ADR-0043](0043-category-vehicle-eligibility-and-scooter-scope.md), the commission in ADR-0033 and the backoffice in ADR-0038.
5. **README.** Point the README's "source of truth" line at the planned `docs/product/source-of-truth.md`.

## Consequences

- Every rule an ADR cites becomes readable in the repo, by Arselene and by any agent.
- Conflicts have one tie-breaker. An agent that finds code contradicting a higher source asks instead of "fixing" it back.
- Founder briefs stay in `docs/tasks/` as dated inputs. They are never edited after the fact.
- If a licence limit exists, only a summary written by the team is committed, and ADRs cite that summary.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Keep the handoff git-ignored | No licence risk | Rules stay unreadable for the team and agents (P19) |
| Commit the PDF itself | A faithful copy | Unknown terms; a binary in git |
| Write the docs in French | Matches the UI and the client | The existing docs, ADRs and code comments are English; a split language costs more than it gains |
| The audit's order, without founder briefs | Matches the audit | Leaves the newest product direction with no rank |

## Evidence

Line numbers at commit `c38429d` for tracked files, and the local `_handoff/` folder on 13 Oct 2026.

- `README.md:7` (source of truth); `.gitignore:13` (`_handoff/`).
- `_handoff/README.md:78` (the only licence lines); `wc -l _handoff/*.md` (240, 79 and 44 lines).
- `docs/MOBILE-FEEDBACK-AUDIT.md:3` (reviewed against the ten-page PDF).
- Commit `89aae18` (dark mode: `userInterfaceStyle` changed from `'light'` to `'automatic'` in both app configs).
- Enforced by: nothing.

## Revisit when

- The client or a French-speaking contributor needs the docs in French, or
- the client sends new feedback, or
- the licence question is answered.
