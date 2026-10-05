# Naya website & backoffice prototype

A standalone Next.js App Router application alongside the existing mobile apps and Vite admin. French copy, MAD, and Africa/Casablanca scheduling follow the Naya product brief.

## Run

From the repository root: `pnpm web` (port 3000). The app also supports `npm run dev --prefix apps/web`.

- Landing page: http://localhost:3000
- Backoffice: http://localhost:3000/backoffice
- Production: `npm run build --prefix apps/web` then `npm run start --prefix apps/web`
- TypeScript: `npm run typecheck --prefix apps/web`
- State tests: `npm test --prefix apps/web` (Node 24; no browser automation). UI verification uses the built-in browser.
- If port 3000 is occupied: run `cd apps/web` then `../../node_modules/.bin/next start -p 3001 --hostname 127.0.0.1` after building.

## Prototype scope

Booking and scheduled rides, chauffeur applications and decisions, ride status changes, chauffeur availability, searchable records, CSV exports, finance reconciliation, support conversations with separate resolution, individual document review, reasoned cancellation/rejection, notification read state, settings and audit history. Zustand persists demo data to `naya-web-prototype-v1` in browser localStorage. Landing and backoffice use the same store. Clear the site's local storage to reset.

There is no production authentication, payment, identity review, real messaging, or real dispatch. The backoffice is deliberately open for prototype review. Its Leaflet maps use real OpenStreetMap streets; driver positions and neighborhood endpoints are approximate demonstration data. The dashed landing connection is indicative, not a calculated driving itinerary. Support replies stay in the local browser. Data is not connected to the existing demo API.

## Design and images

See `DESIGN.md` for the reference lock, visual decisions and image prompts. GSAP animates entrance and scroll transitions, with reduced-motion support. Fonts, brand artwork and generated photography are served locally.

## Maps

Real tiles load only when a map enters the viewport. Maps support keyboard navigation, drag, zoom and recentering; mouse-wheel zoom is disabled to preserve page scrolling. Attribution remains visible. No location permission is requested.

The default raster source follows the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Set `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` together to use another licensed tile provider; these public values are baked into the build. Use a provider suited to expected traffic before a public launch.

The current hero and recruitment photographs are generated from the user's photographic references. Final assets are `public/images/hero-moroccan.png` and `public/images/driver-moroccan.png`; see `PHOTO-MOROCCAN-PROMPTS.md` for the current casting edits and `PHOTO-REFERENCE-PROMPTS.md` for the original reference roles.
