<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Naya

Read the root [AGENTS.md](../../AGENTS.md) for the whole repo. What is specific here:

- This is the marketing landing page plus a `/backoffice` **prototype**. It is disconnected from the rest of Naya:
  no demo API, no `@naya/*` imports, its own data model and fare formula. It is **not** the operational admin;
  that is `apps/admin`. Which backoffice is canonical is an open decision (ADR-0038).
- Prototype data persists in browser localStorage under `naya-web-prototype-v1` (Zustand persist,
  `lib/store.ts`, `version: 1`). Clear the site's storage to reset it. The `/backoffice` has no login.
- Stopgap for P20 until D8: the landing header and footer no longer link to `/backoffice`, and the page is served
  with `noindex, nofollow`. It stays reachable by URL, and the demo success modals in `components/landing.tsx` still
  link to `/backoffice/courses` and `/backoffice/verifications`.
- Seed records are written for `SEED_DAY` (2026-10-05) and moved to the current Africa/Casablanca day when the store
  hydrates (`merge` in `lib/store.ts`); records the team changed keep their own dates. Create ids with `uid()`, which
  also works over plain-http LAN addresses where `crypto.randomUUID` is missing.
- Use pnpm from the repo root: `pnpm web` (Next dev on :3000), `pnpm web:build`, `pnpm --filter @naya/web typecheck`,
  `pnpm --filter @naya/web test` (node:test store tests). Never run npm here.
- Today: `apps/web/package-lock.json` and the root `dev` / `build` npm scripts still exist, `apps/web/README.md`
  mentions npm, and `playwright.config.ts` here starts `npm run dev`. Whether to remove them is an open decision
  (ADR-0051). Do not add npm-only steps.
- `tests/prototype.spec.ts` (Playwright) is not run by any script or by CI; `pnpm --filter @naya/web test` runs only
  the node:test store tests. `playwright.config.ts` reuses whatever already answers on :3000, so another local app
  there gets tested instead: run the spec against `next start` on a free port (see the verification log).
- French copy, MAD, Africa/Casablanca, as in the apps. Public claims (children, payment methods, prices) must match
  the product; see the WEB-* rows in [docs/status/backlog.md](../../docs/status/backlog.md).
