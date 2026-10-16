# Naya docs

Index of the project knowledge base: what each doc answers, who owns it and when it was last checked against
the code. Agents get the short version automatically from the root [AGENTS.md](../AGENTS.md).

## Reading order for a new chat (or a new person)

1. [AGENTS.md](../AGENTS.md) at the root. Claude Code loads it through `CLAUDE.md`; Codex reads it directly.
2. This page.
3. [status/backlog.md](status/backlog.md) and [status/open-questions.md](status/open-questions.md): what is known to be
   broken, and which decisions are waiting on Achraf.
4. The latest brief in [tasks/](tasks/), if your work comes from the founder.
5. The spec in [specs/](specs/) and the ADRs in [adr/](adr/) for the area you touch. If the code contradicts
   them, do not "fix" it back: check the ADR index, then ask.
6. The `AGENTS.md` of the folder you change: [apps/passenger](../apps/passenger/AGENTS.md),
   [apps/driver](../apps/driver/AGENTS.md), [apps/admin](../apps/admin/AGENTS.md), [apps/web](../apps/web/AGENTS.md),
   [services/demo-api](../services/demo-api/AGENTS.md).
7. [runbooks/](runbooks/) for anything you run, build or upload.

## One home per fact

| Fact | Its only home |
|---|---|
| Test results and counts | [quality/verification-log.md](quality/verification-log.md) |
| Build numbers and uploads | Build log in [runbooks/testflight-eas.md](runbooks/testflight-eas.md#build-log) |
| Known issues and their status | [status/backlog.md](status/backlog.md) (stable IDs: P1–P20, PAX-, DRV-, ADM-, …) |
| Decisions and their reasons | [adr/](adr/) (one file per ADR) |
| What is real and what is simulated | [status/integrations.md](status/integrations.md) |
| Route ↔ Figma map | [SCREENS.md](SCREENS.md) for now (routes with no Figma frame are listed at the end of each app's table) |

Everything else links to these homes and never copies their numbers.

## Folder owners

The owner reviews any change to the folder and keeps its "last verified" dates honest.

| Folder | Owner | Notes |
|---|---|---|
| `product/`, `specs/`, `adr/`, `status/` | Achraf | Product rules, decisions, backlog, open questions |
| `runbooks/` (including the build log) | Build owner: whoever cuts builds (name to be set) | Commands must stay runnable |
| `quality/` | Build owner (as `quality/testing-strategy.md` states) | Anyone who runs tests appends to the verification log |
| `architecture/` | Not assigned yet | |
| `audits/` | Nobody: immutable snapshots | Findings move to `status/backlog.md`; never edit an audit |
| `tasks/` | The founder's sessions | Founder briefs. Read and link them; never edit them from another session |
| Root-level docs in `docs/` (FINANCE, DESIGN, SCREENS, …) | Not assigned yet | Being folded into the folders above |

## Index

"Last verified" is the date the content was last checked against the code. Each doc should carry the same line at its
top. At each milestone (TestFlight upload, feature pass) walk this table and re-check anything older than 60 days.

### Start here

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [../AGENTS.md](../AGENTS.md) | Repo map, commands, runtime modes, invariants, gotchas, definition of done | 2026-10-13 | New |
| [../README.md](../README.md) | Human front door: what Naya is, quick start | 2026-10-13 | Fixed 13 Oct |
| [product/glossary.md](product/glossary.md) | French ↔ English ↔ code ids | 2026-10-13 | New |

### Status and decisions

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [status/backlog.md](status/backlog.md) | Every known issue, with ID, severity and status | 2026-10-13 | New, seeded from the audit |
| [status/open-questions.md](status/open-questions.md) | Decisions waiting on Achraf (D1–D15, each linked to Proposed ADRs) and the founder brief's open questions (F1–F4) | 2026-10-13 | New |
| [status/integrations.md](status/integrations.md) | Per capability: real, simulated or missing, and what live needs | 2026-10-13 | New; replaces docs/INTEGRATIONS.md (deleted on this branch) |
| [adr/](adr/) | ADR-0001 to ADR-0059, one file each; status (Proposed / Accepted / Superseded) in each file's front matter. Template: [adr/0000-template.md](adr/0000-template.md). Index: [adr/README.md](adr/README.md) | 2026-10-13 | New |
| [status/ideas.md](status/ideas.md) | Ideas, proposals and future improvements by theme, with their status, plus rejected alternatives | 2026-10-16 | New |
| [status/round-2-merge-plan.md](status/round-2-merge-plan.md) | How to merge abderraouf's `feat/feedback-round-2`: Keep table, conflicts, Famille plan, order C, open questions | 2026-10-16 | New; the 14 Oct memo recovered from the session transcript, updated with 16 Oct git numbers |

### History

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [history/README.md](history/README.md) | Index of the dated work logs | 2026-10-16 | New |
| [history/2026-10-13-to-16.md](history/2026-10-13-to-16.md) | What was asked and done from 13 to 16 Oct, who decided what, commits, environment facts, state at the end | 2026-10-16 | New |

### Design and media

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [design/media-prompts/](design/media-prompts/) | Image prompts and their results: [2026-10-14-image-prompts.md](design/media-prompts/2026-10-14-image-prompts.md) (cars, car wash, onboarding) and [2026-10-15-results.md](design/media-prompts/2026-10-15-results.md) (the 10 generated images and where they are used) | 2026-10-15 | New |

### Specs (feature rules)

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [specs/_template.md](specs/_template.md) | How to write a spec | 2026-10-13 | New |
| [specs/pricing-cities-categories.md](specs/pricing-cities-categories.md) | Fares, city rules, categories, commission precedence | 2026-10-13 | New |
| [specs/payments-and-fees.md](specs/payments-and-fees.md) | Payment methods, settlement, cancellation fees | 2026-10-13 | New |
| [specs/eligibility-and-verification.md](specs/eligibility-and-verification.md) | Women-only eligibility, document review | 2026-10-13 | New |
| [specs/safety-sos.md](specs/safety-sos.md) | SOS: who responds, states, what the user sees | 2026-10-13 | New |
| [specs/family.md](specs/family.md) | Naya Famille: children, recipients, handover, billing | 2026-10-13 | New |

### Architecture

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [architecture/overview.md](architecture/overview.md) | Apps, packages, demo API and how they depend on each other | 2026-10-13 | New |
| [architecture/runtime-modes.md](architecture/runtime-modes.md) | Standalone, connected, web, review, production; env vars per process | 2026-10-13 | New |
| [architecture/api-reference.md](architecture/api-reference.md) | Every demo API route: auth, idempotency, permission | 2026-10-13 (generated) | New; regenerate with `node scripts/docs/gen-api-reference.mjs` (`--check` exits 1 when stale) |
| [architecture/permissions.md](architecture/permissions.md) | Admin permission matrix and mobile route guards | 2026-10-13 | New |

### Quality

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [quality/testing-strategy.md](quality/testing-strategy.md) | What each test layer covers (vitest, jest-expo, Playwright, manual native) | 2026-10-13 | New |
| [quality/verification-log.md](quality/verification-log.md) | Dated test runs: date, commit, command, result | 2026-10-13 | New |

### Runbooks

| Doc | Answers | Last verified | State |
|---|---|---|---|
| [runbooks/local-dev.md](runbooks/local-dev.md) | Install, ports, env files per process, runtime modes, demo reset | 2026-10-13 | New |
| [runbooks/demo-data.md](runbooks/demo-data.md) | Mock data: accounts, sign-in code, cards and provider outcomes, scenarios, how to add mock records | 2026-10-14 | Rewritten for ADR-0058 |
| [runbooks/ios-simulator.md](runbooks/ios-simulator.md) | Development and review builds on the Simulator, native captures | 2026-10-13 | New; commands checked, no build run |
| [runbooks/testflight-eas.md](runbooks/testflight-eas.md) | Local archives, EAS profiles, build numbers, build log | 2026-10-13 | New |
| [runbooks/e2e.md](runbooks/e2e.md) | Playwright: the four servers, ports, serial runs | 2026-10-13 | New |
| [runbooks/troubleshooting.md](runbooks/troubleshooting.md) | Known failures and fixes | 2026-10-13 | New |

### Existing docs (kept where they are for now)

Verdicts from section 6.2 of the [full audit](audits/2026-10-13-full-audit.md). Read them with the caveat in the last column.

| Doc | Answers | Last meaningful update | Verdict |
|---|---|---|---|
| [FINANCE.md](FINANCE.md) | Money model: centimes, fare formula, driver wallet, idempotency | 30 Sep (f0f8d46) | Partly wrong. Accurate for the driver wallet. Nothing on the passenger wallet or categories. Its 18 % Casablanca commission does not apply to app bookings today (P8). A banner at its top now links the specs and lists these contradictions. |
| [DESIGN.md](DESIGN.md) | Design direction, principles, accessibility, motion | 1 Oct (0e0b066) | Partly wrong. Says the generated art is kept (vector art replaced it on Oct 6). No dark-mode or logo section. |
| [SCREENS.md](SCREENS.md) | Figma ID ↔ route ↔ evidence; S01–S16 scenario index | 30 Sep (0fa0487) | Partly stale. The routes with no Figma frame (Oct 6 wallet, family, brand, dev, admin `/services`, and the admin `/sos` page of 13 Oct) were added on 13 Oct; the capture folders it describes and the admin captures predate two redesigns. |
| [STANDALONE-DEMO.md](STANDALONE-DEMO.md) | On-device demo and the 1 Oct TestFlight builds | 1 Oct (d6a21d0) | Historical. Its build numbers and test counts are superseded by the build log and the verification log. |
| [MOBILE-FEEDBACK-AUDIT.md](MOBILE-FEEDBACK-AUDIT.md) | Before-state gap audit of the feedback PDF | 6 Oct (89aae18) | Historical. Line numbers match afac0b1. Finding 3 (masked-number copy) is fixed on branch `chore/docs-foundation-and-fixes`: no app screen says numbers are masked; the demo API still stores an undisplayed `phoneMasked: 'Appel masqué via Naya'` (DOC-07). |
| [MOBILE-FEEDBACK-DEMO.md](MOBILE-FEEDBACK-DEMO.md) | Walkthrough and checks of the Oct 6 features | 6 Oct (89aae18) | Current. The best description of those features; not a spec. |
| [screens/](screens/) | Screenshots (about 170 MB) | various | Partly stale (ADM-22, VIS-06). ADR-0052 covers moving them out of git. |
| [../apps/web/README.md](../apps/web/README.md) | Website and backoffice prototype | 5 Oct (afac0b1) | Partly wrong: mixes npm and pnpm (ADR-0051). |
| [../apps/web/DESIGN.md](../apps/web/DESIGN.md) | Web design reference lock | 5 Oct (afac0b1) | Current for the web only. Its photo policy conflicts with the mobile vector policy (ADR-0048). |
| [../apps/web/UI-UX-AUDIT.md](../apps/web/UI-UX-AUDIT.md) | Web UI/UX audit | 5 Oct (afac0b1) | Historical. Contains absolute `/Volumes/…` links. |
| [../packages/assets/README.md](../packages/assets/README.md) | Asset provenance | 30 Sep (177cbd6) | Partly wrong: the PNG characters are bundled but no longer displayed. |
| `_handoff/` (not in git) | Original Figma deliverable and implementation prompt | 30 Sep | Local only and partly superseded. Whether to commit its text is open (ADR-0056). |

### Audits and briefs

| Doc | Answers | State |
|---|---|---|
| [audits/2026-10-13-full-audit.md](audits/2026-10-13-full-audit.md) | Full audit: priorities P1–P20, docs plan, decisions D1–D15 | Immutable snapshot (13 Oct, 89aae18) |
| [audits/2026-10-13-full-audit-findings.md](audits/2026-10-13-full-audit-findings.md) | Every verified finding with file:line evidence | Immutable snapshot |
| [audits/2026-10-15-redesign-audit.md](audits/2026-10-15-redesign-audit.md) | Redesign of both apps: status icon system, 150 icon pairings, findings by screen, batches B0–B12, decisions R1–R18 (follow-up: RD rows in the backlog) | Immutable snapshot (15 Oct, fc6f88c) |
| [tasks/](tasks/) | The founder's briefs, e.g. [tasks/2026-10-13.md](tasks/2026-10-13.md) | Owned by the founder's sessions |

## How to keep this page true

- New doc: add a row here with its owner and "last verified" date, in the same change.
- Behaviour changed: update the spec. Decision made or reversed: write an ADR. New simulation: `status/integrations.md`.
- Never write test counts, build numbers or dated verification tables outside their homes above.
- PRs start with Intent and link the spec or ADR (`.github/pull_request_template.md`); sensitive paths have
  CODEOWNERS (`.github/CODEOWNERS`).
