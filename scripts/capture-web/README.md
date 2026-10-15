# Web capture harness (redesign review)

Playwright scripts that sign in as the seeded accounts, walk the passenger and driver apps on Expo web at 390×844 @2x
and save one PNG per screen state. They produced the before and after captures of the
[redesign audit](../../docs/audits/2026-10-15-redesign-audit.md) (§8). Decision R14 (15 Oct 2026): the scripts are
committed, the PNGs are not ([ADR-0052](../../docs/adr/0052-screenshot-storage.md)).

## Run

1. Start a scratch stack on ports nobody else uses. Never 8081 (the owner's Metro) and never the API on 4010:
   every script starts with `POST /dev/reset` and the bot settings, which wipe that API's data. `lib.mjs` refuses
   4010 unless `CAPTURE_ALLOW_4010=1`.

   ```sh
   NAYA_DEV=1 PORT=4610 NAYA_DATA_DIR="$PWD/work/capture-web/data" pnpm --filter @naya/demo-api start
   EXPO_PUBLIC_API_URL=http://localhost:4610 pnpm --filter @naya/passenger exec expo start --web --port 8681
   EXPO_PUBLIC_API_URL=http://localhost:4610 pnpm --filter @naya/driver exec expo start --web --port 8682
   ```

2. Warm the bundles once (the first Expo web load takes minutes): `node scripts/capture-web/warm.mjs`.
3. Run the scripts from the repo root, one at a time (each resets the API):

   | Script | Captures |
   |---|---|
   | `p1.mjs [light\|dark]` | passenger welcome, onboarding, sign-in, code, verification states |
   | `p2.mjs [light\|dark]` | passenger home, search, quote, schedule, trips, account, money, Famille, help, support, car wash |
   | `p3.mjs [light\|dark]` | the ride across both apps, the Famille live trip, home with an active ride |
   | `d1.mjs [light\|dark]` | driver sign-in, money, account, dossier states, sign-up steps |
   | `x1.mjs` | driver sign-up steps for a new number |
   | `fx.mjs`, `fx2.mjs` | Famille live trip approved on site, the approval banner over other screens (`SCHEME=dark` for fx2) |
   | `dark.mjs`, `dark2.mjs` | the dark set (6 passenger, 6 driver screens) |
   | `lt.mjs` | key screens at the largest text size: `FONT_SCALE=1.6 node scripts/capture-web/lt.mjs` (`FONT_SCALE=1` gives the same screens at default size) |
   | `light-contrast.mjs` | key light screens with `CONTRAST=1` |

4. Optional: `python3 scripts/capture-web/compare.py <before-dir> <after-dir>` builds before | after sheets (needs
   Pillow) into `<after-dir>`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `CAPTURE_API_URL` | `http://localhost:4610` | scratch demo API (dev mode on: any 6-digit code signs in) |
| `CAPTURE_PASSENGER_URL` | `http://localhost:8681` | passenger Expo web |
| `CAPTURE_DRIVER_URL` | `http://localhost:8682` | driver Expo web |
| `CAPTURE_OUT` | `work/capture-web` (git-ignored) | where PNGs, `_log-*.json` and `*.contrast.json` go |
| `CONTRAST` | unset | `1`: also writes WCAG text contrast per shot (`contrast.mjs`) |
| `FONT_SCALE` | `1` | emulated Dynamic Type (see below) |

Use `localhost`, not `127.0.0.1`, in the URLs (the same rule as the e2e runbook).

## Limits

- Expo web, not a phone: no blur on frosted surfaces, blue focus rings after a tap, `adjustsFontSizeToFit` does not
  shrink text, and the native camera, maps and push are not there.
- `FONT_SCALE` patches React Native web's `Dimensions` and multiplies every font size and line height. It ignores lower
  per-text caps (for example 1.3 on « Sécurité »), so those labels look slightly larger than on a phone.
- The scripts select by `testID`. When a batch renames or removes one, update the script in the same change.
- Stop every server you started when you are done.
