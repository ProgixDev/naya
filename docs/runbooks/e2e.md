# End-to-end tests (Playwright)

How to run the Playwright suite in `e2e/` against the real apps. Owner: build owner.
Last verified: 2026-10-14 against `e2e/playwright.config.ts` on branch `integration/trial-2026-10-14`, with a full
run that started all four servers on alternate ports (4510/8581/8582/5673) through the `webServer` block. Check the file if this page and the config disagree.
Results go in
[docs/quality/verification-log.md](../quality/verification-log.md), never here.

## What runs where

| Project | Specs | App under test | Viewport |
|---|---|---|---|
| `passenger` | `passenger*.spec.ts`, `deeplinks-passenger.spec.ts` | Expo web build of apps/passenger on :8081 | phone, 390×844 |
| `driver` | `driver*.spec.ts`, `deeplinks-driver.spec.ts` | Expo web build of apps/driver on :8082 | phone, 390×844 |
| `admin` | `admin*.spec.ts` | Vite admin on :5173 | 1440×960 |
| `cross-role` | `scenarios*.spec.ts` | all three apps side by side | 390×844 |

Every project talks to one demo API on :4010. Locale `fr-MA`, timezone `Africa/Casablanca`, Chromium only.
Native iOS and Android are not covered by e2e; see [ios-simulator.md](ios-simulator.md).

## Run it

```bash
pnpm --filter @naya/e2e install-browsers     # once per machine (playwright install chromium)
pnpm e2e                                     # whole suite
pnpm e2e --project admin                     # one project
pnpm e2e tests/admin-auth.spec.ts            # one spec file
```

No `--` before the flags (pnpm 12 forwards it literally).

## The four servers

`pnpm e2e` needs these four. With the `webServer` block, Playwright starts each one that does not answer yet and
reuses any you already started:

| Server | URL | Started by Playwright with |
|---|---|---|
| Demo API | http://localhost:4010 (`/health`) | `pnpm --filter @naya/demo-api start`, `NAYA_DEV=1`, data in `services/demo-api/.data/e2e` |
| Passenger web | http://localhost:8081 | `pnpm --filter @naya/passenger exec expo start --web --port 8081`, `EXPO_PUBLIC_API_URL` = the API URL |
| Driver web | http://localhost:8082 | `pnpm --filter @naya/driver exec expo start --web --port 8082`, `EXPO_PUBLIC_API_URL` = the API URL |
| Admin | http://localhost:5173 | `pnpm --filter @naya/admin exec vite --port 5173 --strictPort`, `VITE_API_URL` = the API URL |

- **Your own `pnpm api` gets wiped.** If an API already answers on :4010, Playwright reuses it, and every spec calls
  `POST /dev/reset` on it (`e2e/tests/helpers.ts`). Stop your API first if you care about its data. The API that
  Playwright starts itself writes to `.data/e2e`, so your `.data/db.json` is left alone.
- The API must run in dev mode (`/dev/reset` and the fixed OTP only exist then).
- Expo web bundles on the first request, so the first test of a cold run is slow; the config allows 300 s per Expo server
  to start. The bundle itself is built inside the first test's 90 s, so on CI (`CI` set) each test is retried once and a
  cold-bundle timeout shows as flaky in the report. Locally there are no retries.
- Playwright stops the servers it started when the run ends; the ones you started yourself keep running.
- `API_URL` moves all four: the API that Playwright starts listens on its port, and the apps it starts call it.
- Without the `webServer` block (checkouts older than this branch), start the four commands above by hand before
  `pnpm e2e`.
- Other URLs: set `API_URL`, `PASSENGER_URL`, `DRIVER_URL`, `ADMIN_URL`. A custom Chromium:
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. `E2E_DATA_DIR` sets where an API that Playwright starts keeps its data
  (default `services/demo-api/.data/e2e`).
- Beside a running stack (for example a simulator review on :4010, :8081 and :8082), move all four so nothing is
  reused or reset:

  ```bash
  API_URL=http://localhost:4510 PASSENGER_URL=http://localhost:8581 DRIVER_URL=http://localhost:8582 \
  ADMIN_URL=http://localhost:5673 E2E_DATA_DIR=/tmp/naya-e2e pnpm e2e
  ```

## Why runs are serial

`workers: 1` and `fullyParallel: false`: there is one shared API, and specs reset it to a named scenario
(`resetScenario()` in `helpers.ts`). Two workers would reset each other's data mid-test. Do not raise the worker count
without giving each worker its own API.

## Writing tests

- Select by `testID` (rendered as `data-testid` on web). Sign the mobile apps in with `signInMobile()` (`helpers.ts`:
  it writes the session to sessionStorage) and the admin with `adminLogin()` (`admin-helpers.ts`); call the API with
  `tokenFor()` / `adminToken()`. Type the OTP flow only in a test about sign-in.
- Reset the scenario at the start of each test that changes data.
- The apps show no demo shortcuts since 14 Oct 2026 ([ADR-0058](../adr/0058-present-the-mock-backed-apps-as-a-real-product.md)),
  so specs drive the real flows:
  - Sign-in code: nothing is prefilled. On the web the message card `sms-code` appears about 1.6 s after
    « Recevoir le code »; clicking it fills and verifies the code. Typing `123456` into `otp-input` also verifies.
  - Documents: import a fixture (`import-photo`, then the file chooser, then `use-photo`); there is no skip.
  - Payments, recharges and top-ups: the mock provider answers on its own (3 s for a card, 8 s for an agency) by server
    time; call `POST /dev/clock/advance` or wait. A card recharge shows `recharge-processing` until then. Force a
    refusal with `POST /dev/providers/<kind>/<ref>/fail` (refs from `GET /dev/provider-jobs`).
  - Naya Famille: Salma's family is seeded in every scenario. On the web, `famille-pickup-camera` and
    `famille-dropoff-camera` attach the stand-in photo at once.
  - SOS in connected mode: the sheet says the alert reached the « équipe sécurité » (`sos-recorded`); the admin shows
    « Alerte déclenchée · position enregistrée ».
- Admin dialogs: type with `page.keyboard.type`. `fill()` sets the value directly and hides focus bugs such as P3.
- One behaviour per test. `scenarios-feedback.spec.ts` is one 240 s test, so a failure hides every later check (a
  low-severity finding in the [audit findings](../audits/2026-10-13-full-audit-findings.md); the Oct 6 coverage gaps are QA-05).
- Reports: `e2e/playwright-report/` (HTML) and `e2e/test-results/` (traces, screenshots on failure). Both are git-ignored.

## Not part of `pnpm e2e`

- `apps/web/tests/prototype.spec.ts` (website prototype) has its own `apps/web/playwright.config.ts`; no root script runs it.
  That config uses Chrome (`channel: 'chrome'`), starts `npm run dev` and reuses whatever answers on :3000, even another
  project's server. To run it, copy the config, point it at `next start` on a free port (the 13 Oct run used :3100) and
  the bundled Chromium.
- Native capture scripts in `e2e/scripts/` (`native-tour.mjs`, `shoot*.mjs`) take screenshots; they are not tests.

Known failures and fixes: [troubleshooting.md](troubleshooting.md#e2e).
