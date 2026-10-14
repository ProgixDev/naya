---
id: ADR-0044
title: "Demo gating, flag defaults and the production bundle"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0011, ADR-0012, ADR-0021, ADR-0035, ADR-0038, ADR-0040, ADR-0045, ADR-0048, P9, PAX-04, DRV-13, UI-04, UI-05, UI-10, API-06, API-23, ADM-15, QA-12, PRD-11, PRD-24, PRD-28, docs/architecture/runtime-modes.md]
---

# ADR-0044 · Demo gating, flag defaults and the production bundle

## Context

Decision **D9** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d9-demo-runtime-and-hosting)). Fixing P9 needs no decision; D9 sets how urgent it is ([backlog](../status/backlog.md)). Two facts only Achraf knows:

- Is the admin or the demo API reachable by anyone today, for example on Vercel?
- Is the production EAS profile ever built?

At `c38429d` every switch fails open:

- `DEMO_MODE` is on unless `EXPO_PUBLIC_DEMO` is `'0'`. Standalone mode is on unless `EXPO_PUBLIC_STANDALONE` is `'0'`. API dev mode is on unless `NAYA_DEV` is `'0'`.
- With dev mode on, the `/dev` routes are registered. The server binds `0.0.0.0` and CORS reflects any origin.
- `Providers.tsx` statically imports the embedded demo, which imports the demo API and its fixture documents. Every native build bundles them, including the seeded admin accounts, whatever the profile.
- None of these is gated by a flag:
  - the simulated SOS;
  - « Simuler la confirmation »;
  - « Charger l’exemple de démo »;
  - the six-logo gallery in both apps' account menus.
- The admin login page lists one-click demo accounts in every build, and production sourcemaps are on.
- Only the production EAS profile sets `EXPO_PUBLIC_DEMO` to `'0'`.

## Decision

**Recommended, pending Achraf’s choice: D9 option (b), a hosted shared demo API for cross-role demos, plus standalone builds for offline demos.**

1. **Fail closed.** `DEMO_MODE` and standalone mode are on only when their variable is `'1'`. A release build fails when a required flag is missing. API dev mode is on only when `NAYA_DEV=1`.
2. **Gate every simulation.** Every simulated control and route renders only when `DEMO_MODE` (apps) or dev mode (API) is on. This covers:
   - SOS and Famille simulations;
   - the simulate buttons and the PSP sandbox screens;
   - « Charger l’exemple de démo »;
   - `/dev` and the scenario launcher;
   - the logo gallery, which leaves the customer apps altogether ([ADR-0048](0048-cross-surface-media-and-brand.md)).
3. **Keep the demo backend out of production bundles.** Load the embedded backend and its fixtures through a module that resolves to a stub unless the build is a demo build (a Metro resolver alias). Add a bundle check that fails if the demo API is in a production bundle.
4. **Admin.** Show the demo-account panel only when `VITE_DEMO=1`. Turn off production sourcemaps.
5. **Labels.** Mark any simulated surface with the « Démo » badge. Do not put "démo" wording inside buttons or data labels.
   *Replaced on 14 Oct 2026 by [ADR-0058](0058-present-the-mock-backed-apps-as-a-real-product.md): no demo labels in the apps or the admin.*
6. **Hosted demo.** It turns dev mode on explicitly, uses a CORS allow-list, and has no public link ([ADR-0038](0038-canonical-backoffice.md)).

## Consequences

- Developers must set the flags. The development EAS profiles already set `EXPO_PUBLIC_DEMO=1`. `.env.example` and [architecture/runtime-modes.md](../architecture/runtime-modes.md) must say which file each process reads.
- Production bundles shrink and no longer ship seed accounts or specimen identity documents.
- Cross-role loops (SOS, Famille sync) can be shown on the hosted demo. Standalone builds keep working offline.
- API tests must cover `NAYA_DEV=0` (backlog API-23).
- The production backend ([ADR-0045](0045-production-backend-and-live-integrations.md)) has no `/dev` or sandbox routes at all.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (a) Standalone builds remain the only demo | No hosting to run or secure | Cross-role loops cannot be shown; each tester's data stays on her phone |
| Keep flags on by default | Zero setup for developers | One missing variable ships simulations, seed accounts and fixtures to production |

## Evidence

Line numbers at commit `c38429d`.

- `packages/ui/src/core/apiBase.ts:4-5` (flags on by default); `services/demo-api/src/main.ts:13` (dev mode on by default), `:45` (`0.0.0.0`); `services/demo-api/src/app.ts:202` (CORS reflects any origin), `:895` (`/dev` routes registered in dev mode).
- `packages/ui/src/core/Providers.tsx:18`, `:28` (static import of the embedded demo); `packages/ui/src/core/localDemo.native.ts:2-3` (demo API and fixtures).
- `packages/ui/src/features/prototype.tsx:89-138` (simulated SOS), `:264-276` (« Simuler la confirmation »), `:359-365` (« Charger l’exemple de démo »).
- `apps/passenger/src/app/(app)/(tabs)/account.tsx:36` and `apps/driver/src/app/(app)/(tabs)/account.tsx:46` (« Identité · 6 pistes »).
- `apps/admin/src/pages/Login.tsx:11-14`, `:56-59` (demo accounts panel); `apps/admin/vite.config.ts:7` (`sourcemap: true`).
- `apps/passenger/eas.json:37` and `apps/driver/eas.json:37` (only the production profile sets `EXPO_PUBLIC_DEMO` to `'0'`).
- Enforced by: no test or build check covers flag defaults or bundle contents.

## Revisit when

- The production backend exists: delete the demo routes from it entirely, or
- a hosted demo is set up: review its exposure before sharing the link.
