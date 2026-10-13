---
id: ADR-0051
title: "apps/web package manager"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0001, ADR-0032, ADR-0038, ADR-0057, QA-08, WEB-11]
---

# ADR-0051 · apps/web package manager

## Context

One of the "Engineering housekeeping" calls in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#smaller-calls-with-defaults)). The audit's default is pnpm only. It closes backlog QA-08 and WEB-11 ([backlog](../status/backlog.md)).

At `c38429d`, `apps/web` is managed by both pnpm and npm:

- It is a pnpm workspace member, with an entry in `pnpm-lock.yaml`. The root `web` and `web:build` scripts use pnpm.
- It also has a tracked npm lockfile, `apps/web/package-lock.json` (about 75 KB). The root `dev` and `build` scripts call npm.
- The root README recommends npm. `apps/web/README.md` starts with `pnpm web`, but gives npm commands for the build, typecheck and tests.
- The two lockfiles have drifted (audit 7.4, item 6):
  - lucide-react 1.52.0 under npm against 1.49.0 under pnpm, a version the workspace names on purpose;
  - postcss and @types/node differ by a patch version.
- An npm install left a 458 MB `apps/web/node_modules/.ignored` folder (audit 7.3).
- The workspace relies on pnpm's hoisted layout ([ADR-0001](0001-pnpm-12-workspace-with-hoisted-node-modules.md)). The root `build` script builds only the marketing site.

## Decision

**Recommended, pending Achraf’s choice: pnpm only.**

1. Delete `apps/web/package-lock.json` and the root `dev` and `build` scripts. Keep `web` and `web:build`.
2. Delete `apps/web/node_modules/.ignored`.
3. Rewrite the npm commands in `README.md` and `apps/web/README.md` as pnpm commands.
4. If Vercel hosts the site, configure it for the pnpm workspace: install from the repo root and build `@naya/web`.

## Consequences

- One lockfile. CI's frozen install ([ADR-0057](0057-branch-review-and-ci-policy.md)) covers the website too.
- The website can import `@naya/domain` for its price estimate, as [ADR-0038](0038-canonical-backoffice.md) recommends.
- The root names `dev` and `build` become free. Do not reuse them for the website alone.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| npm only: take `apps/web` out of the workspace | The site builds on its own | Loses `@naya/domain` and `@naya/tokens`, and with them the shared price and money rules |
| Keep both | No change | Two lockfiles that drift; two install trees; confusing for people and agents |

## Evidence

Line numbers at commit `c38429d`.

- `pnpm-workspace.yaml:2` (`apps/*` in the workspace), `:14-15` (lucide-react 1.49.0 exempted from the minimum release age); `pnpm-lock.yaml:616` (`apps/web` importer).
- `apps/web/package-lock.json` (tracked, 75,211 bytes, `git ls-tree -l`).
- `package.json:20-21` (pnpm scripts), `:22-23` (npm scripts).
- `README.md:190`; `apps/web/README.md:7`, `:11-13` (npm instructions).
- Enforced by: nothing.

## Revisit when

`apps/web` moves to its own repository.
