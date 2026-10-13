---
id: ADR-0038
title: "Canonical backoffice"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0006, ADR-0017, ADR-0032, ADR-0044, ADR-0051, P20, ADM-21, WEB-01, WEB-02, WEB-04, WEB-06, WEB-14, VIS-07, DOC-19, PRD-13, PRD-30]
---

# ADR-0038 · Canonical backoffice

## Context

Decision **D8** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d8-which-backoffice)). It unblocks P20 and decides whether the website gets SEO and performance work ([backlog](../status/backlog.md)). A second backoffice was added on 5 October (`afac0b1`) without a decision record. It is one of the five unrecorded reversals in [ADR-0056](0056-source-of-truth-order-committing-the-handoff.md).

| | `apps/admin` | `apps/web` `/backoffice` |
|---|---|---|
| Data | The demo API, shared with both apps | The browser's localStorage, key `naya-web-prototype-v1`; not connected to the API |
| Access | Email and password; 8 permissions checked on the server ([ADR-0017](0017-the-admin-is-a-separate-vite-spa.md)) | None: "deliberately open for prototype review" |
| Rules | `@naya/domain`: integer money, versioned rules, audit chain ([ADR-0006](0006-admin-changes-are-governed.md)) | Its own pricing, statuses and verification, with money in floats (backlog WEB-04, WEB-06) |
| Oct 6 features | Services, SOS, Famille, wallets | None |
| Linked from | Nothing public | The public landing header and footer (« Backoffice », « Espace équipe ») |

The web seed is pinned to 5 October and the period defaults to today, so the default view is now empty (backlog WEB-01). The web console has good ideas worth keeping: a work queue, ticket priority and a service kill-switch.

## Decision

**Recommended, pending Achraf’s choice: D8 option (a).** `apps/admin` is the only operational backoffice. `apps/web` becomes the marketing site.

1. Remove the links to `/backoffice` from the public site now. Keep the route only outside production builds, with `noindex`, or delete it.
2. Write the work queue, ticket priority and service kill-switch as specs, and build them in `apps/admin`.
3. If a hosted console demo is needed, host `apps/admin` against a demo API ([ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)).
4. Before any console is deployed publicly, it needs real authentication, `noindex`, no public link, no demo credentials on screen and no production sourcemaps.
5. Make the website copy match the product (child policy, payment methods, category names, minimum fare). Compute its price estimate with `@naya/domain`, or label it « indicatif ».

## Consequences

- One console to keep aligned with the domain rules. Work on the web store and its tests stops being product work.
- The website can be optimised as a public marketing site (backlog WEB-13).
- The localStorage model, and the web tests that cover it, become disposable.
- The website needs `@naya/domain` through the pnpm workspace ([ADR-0051](0051-apps-web-package-manager.md)).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) Rebuild `/backoffice` on `@naya/api` | Keeps the web console's design | A second console that duplicates `apps/admin`; double maintenance on every rule change |
| (c) Keep both, label the web one a design exploration behind a login | Least work now | Two sets of rules keep drifting; acceptable only as a short stopgap |

## Evidence

Line numbers at commit `c38429d`.

- Commit `afac0b1` (2026-10-05) "Add Naya website and backoffice prototype".
- `apps/web/README.md:18-20` (localStorage key, deliberately open, not connected to the demo API).
- `apps/web/components/landing.tsx:197-204` (header links), `:573-575` (footer « Espace équipe »).
- `apps/web/lib/store.ts:468` (persist key); `apps/web/components/backoffice.tsx:80` (period defaults to `'today'`).
- `apps/admin/src/router.tsx:70-77` (permission-gated admin routes).
- Enforced by: nothing prevents a public deployment today.

## Revisit when

- `apps/admin` cannot meet a need, such as public pages or server rendering, or
- the web console's visual design is chosen for the admin. Then port the design, not the data model.
