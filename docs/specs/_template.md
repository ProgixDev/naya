---
title: "Feature area name"
status: Draft               # Draft | Current | Superseded by specs/<file>.md
owner: Achraf               # the specs/ folder owner (docs/README.md) unless named otherwise
last_verified: YYYY-MM-DD @ <commit>   # the date and commit the rules were last checked against the code
related: []                 # ADR ids, backlog IDs (docs/status/backlog.md), other specs and docs
---

# Feature area name

<!--
Copy this file to docs/specs/<area>.md. A spec states the rules of one feature area as the code applies them today,
says which ones match intent, and points at the defects and the open decisions. It is not a design doc and not a
changelog: when behaviour changes, edit the rule in place and re-date `last_verified`.
-->

**Status marks** used on every rule:

- ✅ **matches intent**: the code does what the product wants (FINANCE.md, an Accepted ADR, the founder brief or the handoff says so).
- ⚠️ **known defect**: the code differs from intent. Name the backlog ID from [status/backlog.md](../status/backlog.md) (P8, ADM-05…). A defect with no ID yet: link the [audit findings](../audits/2026-10-13-full-audit-findings.md) or ask for one.
- ❓ **open**: nobody has decided. Link the Proposed ADR that will decide it, e.g. [ADR-0033](../adr/0033-pricing-precedence-between-city-rules-and-service.md).

A rule can carry more than one mark, for example "⚠️ ❓" when today's behaviour is a defect and the fix needs a
decision. When intent is known, the bold sentence states it and the explanation says what the code does today; when
nobody has decided, the bold sentence states today's behaviour and the rule is marked ❓.

## Purpose

Two or three sentences: what this area covers, what it does not, and which spec or doc owns the neighbouring rules.

## Actors

Who acts in this area and through which surface. Use the product names: passagère (passenger app), chauffeuse
(driver app), admin with the permission it needs (apps/admin), the demo API, a payment or identity provider.

## Rules

Number rules `R1`, `R2`… and never renumber. To retire a rule, strike it through (`~~R7 …~~`) and say why. Each rule is
one testable sentence in bold, an optional short explanation, then the evidence:

**R1 · One testable sentence.** ✅

Explanation only when the sentence is not enough. Quote UI copy in French as it appears (« Débitée à l’arrivée »).

- Enforced at: `path/to/file.ts:12-30` (`functionName`). Server first; client gates are cosmetic unless the rule is about display.
- Tested by: `path/to/test.ts:NN` (S06) "test name", or **not tested**.
- Gap: backlog ID and one line, or the ADR that decides it. Omit when the rule is ✅ and complete.

Group rules under `###` headings when the area is large. Link a canonical table (FINANCE.md, a city rules table)
instead of copying it.

## States and transitions

The lifecycle of the main objects as a table (state, event, next state, who triggers it, side effects such as a ledger
posting). Name the machine when one exists (`packages/domain/src/machines/*.ts`); say "hand-coded in …" when it does
not. A Mermaid diagram is welcome when there are more than four states.

## Demo vs live

What is simulated today (providers, outcomes, timings, bots in standalone builds), how a tester triggers each outcome,
and what a live version needs. Link [status/integrations.md](../status/integrations.md) instead of repeating it.

## Requested (optional)

Only when a brief in `docs/tasks/` asks for behaviour the code does not have yet. Number the items 1, 2… (they are not
R-rules). For each: what is asked, what the code does today (cite the R-rule), and what is open (link the
[open question](../status/open-questions.md) or the Proposed ADR). When it ships, turn it into an R-rule and delete the
item. Leave the section out when there is nothing requested.

## Open questions

One bullet per undecided point: the question, today's behaviour, the recommended default if the audit gave one, and
the Proposed ADR that will record the answer. Decisions themselves go in the ADR, never here.

## Last verified

`YYYY-MM-DD @ <commit>`, by whom (a person or "AI session"). List what was read and what was run, and say what was not
checked. Line numbers in this spec refer to that commit; they drift, so always name it. Read cited files at that commit
(`git show <commit>:<path>`), not in a working tree with uncommitted changes.

<!--
Conventions
- Project docs are in English; UI copy stays in French, quoted as it appears (typographic apostrophes ’).
- Cite file:line at the commit named in `last_verified`. Prefer one precise range to five vague ones.
- Never write test counts or build numbers here. They live in docs/quality/verification-log.md and
  docs/runbooks/testflight-eas.md.
- Never paste credentials, even demo ones. Demo accounts, test cards and the demo OTP live in docs/runbooks/demo-data.md.
- Never edit docs/audits/ or docs/tasks/; link them.
- Behaviour changed: update the rule and its mark in the same change as the code. Decision made or reversed: write or
  update the ADR, then link it here.
-->
