# Admin console (apps/admin) — agent notes

Read the root [AGENTS.md](../../AGENTS.md) first. This is the real operations console. apps/web `/backoffice` is a
separate, disconnected prototype (ADR-0038 is open); do not copy rules from it.

Vite 8 + React 19 + React Router 7 single-page app. `pnpm admin` serves it on :5173 (`vite --port 5173`). `vite.config.ts`
sets `strictPort: false`, so if 5173 is taken Vite silently moves to 5174 while e2e still targets :5173.
API: `VITE_API_URL` from `apps/admin/.env*`, default `http://localhost:4010` (`src/lib/api.ts:5`).
React Router 7 is newer than your training data: import from `react-router` (not `react-router-dom`) and read
`node_modules/react-router` before using an API you are unsure of.

## Auth
- Own email + password (`POST /admin/auth/login`), separate from the mobile OTP. No role switch in the mobile apps.
- The session lives in `sessionStorage` key `naya.admin.session`: one per browser tab, gone when the tab closes.
- `RequireAuth` sends signed-out visitors to `/connexion`; `GuestOnly` sends signed-in admins away from it.

## Routes and permission gates (src/router.tsx)
| Route | Page | Client gate | Figma |
|---|---|---|---|
| `/connexion` | Login | guests only | A00 |
| `/` | Overview | any admin | A01 |
| `/verifications`, `/verifications/:id` | Verifications, CaseReview | `people.read` (deciding needs `verification.decide`) | A04, A05 |
| `/personnes`, `/personnes/:id` | People, Person | `people.read` | A02, A03 |
| `/courses`, `/courses/:id` | Rides, Ride | `rides.read` | A06, A07 |
| `/support`, `/support/:id` | Support, Ticket | `support.resolve` | A08 |
| `/sos` | Sos (« Alertes SOS ») | `safety.respond`, or `config.edit` (`canRespondToSafety` in `packages/domain/src/prototype.ts`) | — (P2) |
| `/finance` | Finance | `finance.read` (corrections need `finance.correct`) | A09 |
| `/villes`, `/villes/:id/regles` | Cities, Rules | none (edit controls need `config.edit`) | A10, A11 |
| `/paiements` | Providers | none (edit controls need `config.edit`) | A12 |
| `/services` | Prototype (« Services et familles ») | `config.edit` | — (Oct 6) |
| `/audit` | Audit | `audit.read` | A13 |

- Permission strings are the `AdminPermission` union in `packages/domain/src/entities.ts` (9, `safety.respond`
  included). Seeded admins (`services/demo-api/src/seed.ts`): `meryem@naya.demo` holds every permission;
  `youssra@naya.demo` is a support agent (support, SOS, rides, people) with no finance, configuration, identity
  decisions or audit.
- Locked pages stay in the menu with a lock icon (`components/Layout.tsx`). A gated route renders « Permission requise ».
- **The server is the authority.** Admin mutations and gated reads call `requirePermission` in services/demo-api.
  Client gates and hidden buttons are cosmetic. A new gated page needs the server check first, then the route gate,
  then the menu entry. Some reads need only an admin session (overview, cities, providers); Overview and People
  show balances and commission without `finance.read` (ADM-12).
- SOS alerts have their own page, `/sos`, with a menu badge for open alerts and an Overview card (one query,
  `useSosAlerts` in `components/Layout.tsx`). The server check is `safetyResponder` in
  `services/demo-api/src/services/prototype.ts`; statuses only move forward and resolving needs a note (P2).
  The menu and route gates use `useAllowed()` (Layout.tsx), which applies the same `canRespondToSafety` rule.
- Existing stores keep their seeded admins (no migrations): reset the demo data to give Youssra `safety.respond`.
  Meryem keeps SOS access through `config.edit`.
- Today: the old SOS tab of `/services` is still there, behind `config.edit`, with raw coordinates and no map
  (VIS-24). Use `/sos`.
- Ticket outcomes: the select in `pages/Ticket.tsx` (no default, « Rejetée » in its own group) and
  `TICKET_OUTCOMES` in `services/demo-api/src/services/support.ts` must list the same labels. The server derives
  the status from the label and refuses unknown text with 422 (P10).

## Changing configuration (the governed pattern, ADR-0006)
- Every change asks for a reason (≥ 10 characters, `reasonSchema`), shows the diff, asks for confirmation and sends
  `expectedVersion`. A `CONFLICT` response shows a reload banner (`pages/Rules.tsx:142,165`). The server writes an
  audit event with before and after.
- Money in forms: parse with `toCentimes`, display with `fromCentimes` / `money` (`src/lib/format.ts`). Never floats.
- The `/services` catalog editor keeps each field as text and parses on save: amounts with `toCentimes`, an emptied
  category fare as `null` (city fare), lists split on commas, the id read-only for existing rows (P12).
- Today: that editor asks for no reason or confirmation and sends no `expectedVersion`; its audit event has no
  before/after (ADM-09). City ids are free text, not a choice from the cities list.

## Styling
- Tailwind 3 with the `@naya/tokens/tailwind-preset` (`tailwind.config.cjs`). Use token classes (`bg-surface`,
  `text-muted`, `bg-selected`, `rounded-card`, `text-accent`), not hex values. The preset is light-only.
- Shared primitives are in `src/components/ui.tsx` (Button, Card, Banner, DataTable, Dialog, Drawer, Field, Input,
  Select, Textarea, Segmented, toast). Reuse them; do not add a component library.
- `Dialog` and `Drawer` use `useFocusTrap` (`ui.tsx`). Its effect must depend on `open` only; callbacks go through a
  ref. Re-running it on each render sent typed text to the first field of every multi-field dialog (P3, ADM-01).
  The Dialog panel scrolls (`max-h-full overflow-y-auto`), so a tall dialog keeps its buttons reachable.
- Today: the mobile menu overlay in `components/Layout.tsx` has no focus trap and no Escape (ADM-20).

## Checks
- `pnpm --filter @naya/admin typecheck` and `pnpm --filter @naya/admin build`.
- No unit tests yet (ADM-23). e2e: `admin-*.spec.ts` at 1440×960 against :5173. Type with `page.keyboard.type`
  in multi-field dialogs: `fill()` hides focus bugs. See [e2e runbook](../../docs/runbooks/e2e.md).
