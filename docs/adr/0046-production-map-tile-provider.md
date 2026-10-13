---
id: ADR-0046
title: "Production map tile provider"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0022, ADR-0032, ADR-0045, P18, UI-14]
---

# ADR-0046 · Production map tile provider

## Context

A sub-question of **D10** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d10-production-path)): which map tile provider? It is part of the production path in P18 ([backlog](../status/backlog.md)).

[ADR-0022](0022-map-adapter-per-platform.md) uses Apple Maps on iOS, and Google Maps on Android only when a key is set at build time. Everything else draws raster tiles:

| Surface | Tiles at `c38429d` | Configurable |
|---|---|---|
| Mobile fallback (`TileMap`: web builds, Android without a key) | `tile.openstreetmap.org` by default | Yes, `EXPO_PUBLIC_MAP_TILE_URL` and `EXPO_PUBLIC_MAP_ATTRIBUTION` |
| Admin `MiniMap` | `tile.openstreetmap.org`, hard-coded | No |
| Website (Leaflet) | `tile.openstreetmap.org` by default | Yes, `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` |

- The OpenStreetMap Foundation's public tile servers are for light use. The `TileMap` comment says production needs a licensed provider, and the website README says to switch to a provider suited to the traffic before a public launch. No build profile sets a Google Maps key (backlog UI-14).
- Loading tiles from a third party sends each visitor's IP address to that server. The website's privacy notice must say so.

## Decision

**Recommended, pending Achraf’s choice.**

1. **One provider for every raster surface.** Use one commercial tile provider, under contract and with an API key, for the mobile fallback, the admin `MiniMap` and the website. Candidates include MapTiler, Stadia Maps and Mapbox; the vendor ADR picks one.
2. **Configuration.** Read the tile URL and attribution from the environment on every surface, the admin included. Restrict keys by domain or bundle identifier.
3. **Android.** Ship production Android builds with a keyed Google Maps SDK, so the tile fallback is rare.
4. **Routing and geocoding.** Prefer a provider that also offers geocoding and routing for Moroccan addresses ([ADR-0045](0045-production-backend-and-live-integrations.md)).
5. **Privacy and loading.** Name the provider in the privacy policy. The website keeps loading tiles only when a map scrolls into view.

## Consequences

- A monthly cost tied to map views, and keys to manage per environment.
- The admin `MiniMap` gains environment variables.
- The visual style can be matched to the Naya palette, instead of the CSS filter on OSM tiles in the admin.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Keep the public OSM tiles | Free | Against the tile usage policy for production traffic; can be blocked without notice |
| Self-host OSM tiles | Full control; no per-view fee | Servers, storage and updates to run |
| Google Maps everywhere | One look on every surface | Cost per load; terms restrict mixing with other providers' data |

## Evidence

Line numbers at commit `c38429d`.

- `packages/ui/src/map/TileMap.tsx:17-22` (comment: production needs a licensed provider), `:23-24` (OSM default and attribution).
- `apps/admin/src/components/MiniMap.tsx:64` (hard-coded OSM URL with a CSS filter).
- `apps/web/components/map.tsx:27-31` (OSM default, configurable); `apps/web/README.md:30` (use a suitable provider before launch).
- `apps/passenger/app.config.ts:3`, `:26` (Google Maps only when `GOOGLE_MAPS_ANDROID_KEY` is set); `docs/INTEGRATIONS.md:15` (at `c38429d`; now [status/integrations.md](../status/integrations.md)).
- Enforced by: nothing.

## Revisit when

- Map-view traffic or cost crosses a budget set with the vendor, or
- a routing and geocoding provider is chosen.
