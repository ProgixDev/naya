# Testing strategy

What each test layer covers, how to run it, and where coverage is missing. Owner: not assigned yet (`quality/` in
[docs/README.md](../README.md#folder-owners)).
Last verified: 2026-10-13 against branch `chore/docs-foundation-and-fixes` (based on c38429d).
The decision behind this setup is [ADR-0028](../adr/0028-test-strategy.md).

Results never go here: append them to [verification-log.md](verification-log.md), the only place test counts live.

## Layers

| Layer | Tool | Lives in | Run with | In CI |
|---|---|---|---|---|
| Domain rules | vitest | `packages/domain/test/*.test.ts` | `pnpm --filter @naya/domain test` | yes |
| API scenarios | vitest against the real Hono app, in memory | `services/demo-api/test/*.test.ts` | `pnpm --filter @naya/demo-api test` | yes |
| Shared mobile components | jest-expo (iOS preset) and React Native Testing Library, run through the passenger app | `packages/ui/src/__tests__/` | `CI=1 pnpm --filter @naya/passenger test` | yes |
| Website store | `node:test` | `apps/web/tests/store.test.mjs` | `pnpm --filter @naya/web test` | yes |
| Types | `tsc` in every package (11, `e2e` included through `e2e/tsconfig.json`) | each package's `typecheck` script | `pnpm typecheck` | yes |
| Lint | `expo lint` (ESLint flat config) | apps/passenger, apps/driver only | `pnpm lint` | yes |
| Admin build | `vite build` | apps/admin | `pnpm --filter @naya/admin build` | yes |
| End-to-end | Playwright, Chromium | `e2e/tests/*.spec.ts` | `pnpm e2e` | manual job only |
| Native iOS | by hand on the iOS Simulator | [ios-simulator.md](../runbooks/ios-simulator.md) | by hand | no |
| Android | none | none | never built | no |

- `pnpm test` at the root runs every package's `test` script except `@naya/e2e`, so it needs no server (before this
  branch it also ran the e2e suite, QA-03).
- CI is `.github/workflows/ci.yml`. The `checks` job runs on every pull request and every push to master: frozen
  install, peer check (informational), typecheck, the four unit layers, lint and the admin build. The `e2e` job runs
  only when started by hand (Actions → CI → Run workflow). It has not run on GitHub yet (QA-02).
- pnpm 12 forwards a literal `--` to the tool. Never write `pnpm … test -- --ci`: jest then runs no test and exits 1.
  Put flags straight after the script name, or use `CI=1`.

## What each layer covers

### Domain rules (vitest)

Pure functions and state machines in `packages/domain`, with no I/O.

| File | Covers |
|---|---|
| `money.test.ts` | Rounding half away from zero, integer-only amounts, French formatting, parsing typed amounts. |
| `pricing.test.ts` | The city fare fixtures of [FINANCE.md](../FINANCE.md), the minimum fare before the multiplier, commission, the demo route length, cancellation-fee disclosure. |
| `wallet.test.ts` | Every driver-wallet invariant of FINANCE.md: NY-001 and NY-002, withdrawals, recharges, debt limit. |
| `machines.test.ts` | Ride, offer, verification, transfer and scheduling state machines, including the authoritative offer deadline. |

Not covered: `prototype.ts` (catalog, `FAMILY_NEXT`, SOS transitions), `time.ts`, `phone.ts`, `schemas.ts`, and
`packages/api` (DOM-09).

### API scenarios (vitest)

`services/demo-api/test/harness.ts` builds the real app per test on a seeded in-memory store, with a `ManualClock`
that starts at 2026-10-01 08:00 UTC, dev mode on and any 6-digit OTP accepted (`setup(s, { devMode: false })` runs
the NAYA_DEV=0 code check). `call()` adds an `Idempotency-Key` to every POST unless you pass `key: false`. `advance(seconds)` moves the clock and runs the timers. Temp data directories are removed
after each file.

| File | Covers |
|---|---|
| `scenarios.test.ts` | S01–S16, one `describe` per scenario (index in [SCREENS.md](../SCREENS.md#scenario-index-s01s16)), plus platform guarantees: authorization by role, OTP limits, audited corrections, audit-chain tamper detection, one ride at a time, quote expiry, and ticket outcomes (P10: unknown text refused, « Rejetée » rejects, closed tickets leave `status=open`). |
| `prototype.test.ts` | The Oct 6 features: category pricing and eligibility, passenger wallet top-ups and holds, Famille proofs, handover and recurrence, no handover code in any driver payload and the 5-attempt lock (P1), the SOS queue for `safety.respond` with forward-only statuses (P2), one card recharge provider per city, dispute evidence. |
| `embedded.test.ts` | Standalone mode with every network call blocked: React Native's response bodies, local sign-in and restart, simulated review, trips and offers without a second app, withdrawals across a restart, scheduled bookings. |
| `location.test.ts` | When the server accepts a driver's position (P4): refused offline without a ride, accepted online or during a ride, refused again after completion or cancellation once offline. |

Add a test here for every new endpoint (see [services/demo-api/AGENTS.md](../../services/demo-api/AGENTS.md)).

### Shared mobile components (jest-expo)

`apps/passenger/jest.config.js` uses the `jest-expo/ios` preset, adds `packages/ui/src` to its roots and matches
`**/__tests__/**/*.test.tsx`. The only suite is `packages/ui/src/__tests__/components.test.tsx`: Button, OTPField,
DateField, the welcome screen in dark mode, Pill and SegmentedControl, the money components, `useDeadline`,
`useSingleFlight` and account cache isolation. It renders components; it does not render passenger or driver screens.

### Website store (node:test)

`apps/web/tests/store.test.mjs` imports `apps/web/lib/store.ts` with an in-memory `localStorage` and checks the
prototype's approval, cancellation, support and persistence rules, and the re-dating of seed records to the current day. It relies on Node's native TypeScript stripping, so
it needs Node 22.18 or later (`.nvmrc` pins 24). `apps/web/tests/prototype.spec.ts` is a separate Playwright spec with
its own `apps/web/playwright.config.ts`; no script runs it (WEB-09).

### End-to-end (Playwright)

The real apps in a browser: the passenger and driver apps as Expo web builds at phone size, the admin in a desktop
viewport, all against one demo API. Projects `passenger`, `driver`, `admin` and `cross-role`; specs run one at a time
because each resets the shared API. Servers, ports, environment variables and test-writing rules are in
[runbooks/e2e.md](../runbooks/e2e.md); known failures in [troubleshooting.md](../runbooks/troubleshooting.md#e2e).

- `scenarios-cross-role.spec.ts` drives the passenger, driver and admin side by side (S01, S03 + S04).
- `scenarios-feedback.spec.ts` covers the Oct 6 features in one long test.
- Admin dialogs must be typed with `page.keyboard.type`: `fill()` hides focus bugs such as P3.
- Not covered by e2e: anything native (maps SDKs, camera, background location, notifications, SecureStore).

### Native iOS (manual)

Release or review builds on the iOS Simulator, following [ios-simulator.md](../runbooks/ios-simulator.md). Captures come
from `scripts/capture-native.sh` and `e2e/scripts/native-tour.mjs`; they are screenshots, not tests. Record what you
checked, and what you did not check on a physical device, as a row in the verification log.

## Which test for which change

| Change | Minimum |
|---|---|
| Money, pricing or wallet rule | A domain test and an API scenario; update [FINANCE.md](../FINANCE.md) or the spec. |
| State-machine transition | A domain test in `machines.test.ts` and an API scenario. |
| New or changed endpoint | An API test in `services/demo-api/test/`. |
| Shared component or hook in `packages/ui` | A test in `packages/ui/src/__tests__/`. Type one character at a time when the component formats input (P13). |
| Admin page or dialog | An e2e test using `keyboard.type` (the admin has no unit runner). |
| Flow across passenger, driver and admin | A Playwright test in `e2e/tests/scenarios-*.spec.ts`. |
| Native-only behaviour | A manual Simulator check, logged with what was not checked on a device. |
| Visual or theme change | Screenshots in light and dark mode; there is no automated visual check. |

## Gaps

From the [13 October audit](../audits/2026-10-13-full-audit.md#7-repo-hygiene-tooling-and-quality-gates). Track each
one by its ID in [backlog.md](../status/backlog.md).

1. **No driver or admin tests.** apps/driver and apps/admin have no test runner; their screens are tested only by e2e
   (DRV-18, ADM-23). The passenger app has no screen tests either: its jest run covers the shared UI kit only
   (PAX-13, UI-19).
2. **The Oct 6 features have thin coverage.** No domain test for `prototype.ts` (DOM-09). The API harness always runs
   in dev mode and adds idempotency keys itself, so `NAYA_DEV=0` paths and missing-key refusals are barely tested
   (API-23). In e2e they rely on one long test: at the audit nothing covered category choice, dispute evidence upload,
   admin Services catalog edits, wallet-paid rides, refused top-ups, passenger-side SOS or the Famille error paths
   (QA-05). `admin-operations.spec.ts` now covers the Services catalog editor (P12) and typing key by key in a
   multi-field admin dialog (P3); the other gaps remain.
3. **E2E is not in CI by default.** It runs only as a manual job. At the time of the audit the full suite had not been
   run since the Oct 6 change set (QA-04); it ran in full again on 13 Oct (see the verification log).
4. **Lint covers two of the workspaces.** Shared UI, admin, API and domain code are not linted, and running the passenger
   config over them reports untriaged errors (QA-06).
5. **Blind spots in existing tests.** API tests built quotes without a category, which hid the commission override (P8).
   Pasting a whole date hid the per-keystroke DateField bug (P13). `fill()` hid the admin focus bug (P3).
6. **Website.** The store tests cover a few rules only (WEB-10); the Playwright spec is stale and not wired (WEB-09).
7. **Native.** No automated native tests (no Detox or Maestro, by ADR-0028). Android has never been built. Not verified
   on physical devices: camera capture, background location with the screen locked, push to a closed app, maps
   without network. The native capture tour waits on fixed sleeps (VIS-21).
8. **Dark mode** has no automated check (P15).
