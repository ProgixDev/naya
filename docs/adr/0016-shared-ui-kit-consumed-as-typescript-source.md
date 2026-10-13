---
id: ADR-0016
title: "Shared UI kit consumed as TypeScript source"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0001, ADR-0039, UI-18, UI-19, UI-20, QA-11]
---

# ADR-0016 · Shared UI kit consumed as TypeScript source

## Context

The handoff asks for two separate Expo apps that share mobile UI components, and shared packages for domain types, validation, API clients, design tokens and assets (handoff prompt:46). It lists the reusable components to build (prompt:66). Passenger and driver screens such as sign-in, support tickets, capture, family and brand differ mainly by role.

## Decision

Put shared mobile UI in `@naya/ui` and consume it as TypeScript source: `main` and `types` point at `src/index.ts`, with no build step; Metro and `tsc` compile it inside each app. Export everything from one barrel. When a whole screen is shared, write it once in `packages/ui/src/features/` with a `role` (or similar) parameter, and keep each app's route file a thin wrapper that wires navigation and app-specific queries. `@naya/domain`, `@naya/api`, `@naya/tokens` and `@naya/assets` also ship their source (`@naya/api` and `@naya/tokens` add small `exports` maps, such as `@naya/api/react`).

## Consequences

- One edit fixes both apps; no package build or version bump between packages.
- Every app compiles the shared code, so a type error in the kit breaks both apps' typecheck.
- `@naya/ui` declares only its workspace dependencies and none of its ~30 runtime libraries; it works because the tree is hoisted ([ADR-0001](0001-pnpm-12-workspace-with-hoisted-node-modules.md); backlog [UI-20, QA-11](../status/backlog.md)). It also reaches into `services/demo-api/src` by relative path for the native fixtures.
- The barrel exposes everything, including demo-only features; nothing stops a production screen from importing them.
- Kit tests run only through the passenger app's Jest (backlog UI-19). The Oct 6 shared features sit in one large `packages/ui/src/features/prototype.tsx` (backlog UI-18; [ADR-0039](0039-future-of-the-prototype-module.md)).

## Alternatives considered

Not recorded at the time. Compiled packages with `exports` maps were the obvious alternative; the cost of a build step was avoided.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `177cbd6` (2026-09-30) "Tokens, typed API client, shared mobile UI kit and passenger shell".
- `packages/ui/package.json:5-6` (source entry points), `:10-15` (only workspace dependencies).
- `packages/ui/src/index.ts:1-43` (single barrel).
- `packages/ui/src/core/localDemo.native.ts:3` (relative import into `services/demo-api/src`).
- Thin wrappers: `apps/driver/src/app/(app)/family.tsx` (one line around `FamilyScreen role="driver"`), `apps/driver/src/app/(app)/support/index.tsx:7-10` (`TicketListScreen`).
- `apps/passenger/jest.config.js:6` (kit tests run from the passenger app).
- Enforced by: `pnpm typecheck` across the workspace; no test checks the package boundary.

## Revisit when

- A package must be consumed outside this monorepo, or
- dependency hygiene work starts (backlog UI-20): add subpath `exports`, declare `peerDependencies` (React, React Native, Expo modules) and `dependencies`, and stop importing other packages' `src`.
