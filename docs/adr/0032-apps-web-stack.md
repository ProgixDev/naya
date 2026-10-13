---
id: ADR-0032
title: "apps/web stack"
status: Accepted
date: 2026-10-05
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0022, ADR-0038, ADR-0048, ADR-0051, WEB-04, WEB-06, WEB-07, WEB-11, WEB-12]
---

# ADR-0032 · apps/web stack

## Context

The handoff did not ask for a website. On 5 October a public landing page and a backoffice prototype were added in `apps/web` (`afac0b1`), outside the mobile and admin stacks, with their own reference lock (`apps/web/DESIGN.md:1-21`). The backoffice is deliberately open and stores its data in the browser, not in the demo API (`apps/web/README.md:18-20`).

## Decision

Build `apps/web` with Next.js 16 (App Router) on React 19.2.3:

- Run `next dev` and `next build` with `--webpack`, and use a separate `distDir` in development (`.next-dev`). The reason for both was not recorded.
- Style with Tailwind 3 plus hand-written CSS and the site's own colour variables, not the `@naya/tokens` preset.
- Animate with GSAP and ScrollTrigger only inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`.
- Set display type in Newsreader and UI type in Inter, served locally through `@fontsource`.
- Keep prototype state in a Zustand `persist` store in localStorage (`naya-web-prototype-v1`) with `skipHydration`, rehydrated manually by a `Hydrate` component after mount.
- Draw maps with Leaflet and a configurable tile URL ([ADR-0022](0022-map-adapter-per-platform.md)).

## Consequences

- The website can evolve visually without touching the apps, but it shares none of their code: it re-implements pricing, money, statuses and scheduling, with float MAD amounts that break the money rules (backlog [WEB-04, WEB-06](../status/backlog.md)).
- The persisted store has no version or migration and no cross-tab sync (WEB-07).
- About 5 900 lines of hand-written CSS with an override layer and several palettes (WEB-12).
- The app is managed by both npm and pnpm (WEB-11); [ADR-0051](0051-apps-web-package-manager.md) decides.
- Whether `/backoffice` stays at all is [ADR-0038](0038-canonical-backoffice.md); the website's photoreal generated people are part of [ADR-0048](0048-cross-surface-media-and-brand.md).

## Alternatives considered

Not recorded at the time. Turbopack (the Next.js 16 default) was bypassed with `--webpack` without a written reason; the audit's engineering-housekeeping list asks to write down why webpack was chosen, or to try Turbopack (section 9, "Smaller calls that can wait").

## Evidence

Line numbers at commit `c38429d`.

- Commit: `afac0b1` (2026-10-05) "Add Naya website and backoffice prototype".
- `apps/web/package.json:6-7` (`--webpack`), `:12-23` (dependencies: Next 16, React 19.2.3, GSAP, Leaflet, Tailwind 3, Zustand, fonts).
- `apps/web/next.config.ts:4` (`.next-dev` in development).
- `apps/web/app/globals.css:5-13` (own colour variables); `apps/web/tailwind.config.ts:1-11` (own palette, no token preset).
- `apps/web/components/landing.tsx:90-126` (GSAP gated by reduced motion).
- `apps/web/app/layout.tsx:2-7` (Inter and Newsreader); `apps/web/DESIGN.md:15`.
- `apps/web/lib/store.ts:467-471` (persist name, `skipHydration`); `apps/web/components/ui.tsx:61-66` (manual rehydrate).
- Enforced by: `apps/web/package.json:10` (`node --test` on the store). The Playwright spec in `apps/web/tests` is not wired to any script (backlog WEB-09).

## Revisit when

- [ADR-0038](0038-canonical-backoffice.md) decides the backoffice's future, or
- the website becomes the production marketing site: reconsider Turbopack, the token preset and shared domain pricing, or
- a Next.js upgrade changes the bundler defaults.
