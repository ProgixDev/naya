---
id: ADR-0022
title: "Map adapter per platform"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0030, ADR-0046, UI-12, UI-13, UI-14, VIS-16]
---

# ADR-0022 · Map adapter per platform

## Context

The handoff asks for a compatible native map integration behind an adapter, with appropriate attribution and configured keys; manual pickup when GPS is denied; service-zone validation; stale-location messaging; and demo movement that is deterministic and visibly a demo (handoff prompt:174). Apple Maps needs no key on iOS. Google Maps on Android needs an API key, and no key is configured. `react-native-maps` has no web renderer.

## Decision

Screens use one component, `NayaMap`, and never a map library directly. It picks the engine per build:

| Platform | Engine |
|---|---|
| iOS | Apple Maps through `react-native-maps` (MapKit draws its own attribution) |
| Android with `GOOGLE_MAPS_ANDROID_KEY` at build time | Google Maps through `react-native-maps` |
| Android without a key, and all web builds | `TileMap`: raster tiles from `EXPO_PUBLIC_MAP_TILE_URL` (default OpenStreetMap) with a visible, linked attribution |

The admin draws its own lightweight `MiniMap` from OSM tiles with an attribution line. The `apps/web` website uses Leaflet with `NEXT_PUBLIC_MAP_TILE_URL` and its attribution control. Every map that shows tiles shows their attribution.

## Consequences

- iOS needs no key; Android without a key falls back to the tile map (never verified on a device, `README.md:175`).
- Three map implementations exist (mobile adapter, admin MiniMap, web Leaflet), configured separately; the admin MiniMap's tile URL is hard-coded.
- The public OSM tile servers are for light development use only; production needs a licensed provider or a keyed native map ([ADR-0046](0046-production-map-tile-provider.md); backlog [UI-14](../status/backlog.md)). Keyless Android and web have no pinch-zoom (UI-14).
- Known defects: marker interpolation re-renders the map every frame (UI-12), refitting ignores user panning (UI-13), the attribution chip is illegible in dark mode (VIS-16).

## Alternatives considered

Not recorded at the time. Requiring a Google key for every Android build was avoided because none exists (`apps/passenger/app.config.ts:25-26`).

## Evidence

Line numbers at commit `c38429d`.

- Commit: `177cbd6` (2026-09-30) added `NayaMap` and `TileMap`; `f0f8d46` (2026-09-30) the admin `MiniMap`; `afac0b1` (2026-10-05) the web Leaflet map.
- `packages/ui/src/map/NayaMap.tsx:13-16` (engine choice), `:20-28` (adapter); `packages/ui/src/map/NayaMap.web.tsx:1-9` (web always tiles); `packages/ui/src/map/TileMap.tsx:17-24` (tile source and attribution), `:145-146` (linked attribution).
- `apps/passenger/app.config.ts:3`, `:25-26`, `:30` (key only at build time, `googleMapsConfigured`).
- `apps/admin/src/components/MiniMap.tsx:64` (OSM tiles), `:90` (attribution).
- `apps/web/components/map.tsx:28-31` (tile URL and attribution), `:62` (Leaflet tile layer).
- `docs/INTEGRATIONS.md:15` (removed after `c38429d`; its successor is [docs/status/integrations.md](../status/integrations.md)).
- Enforced by: no test checks the engine choice or attribution. The e2e suites run on the web tile map.

## Revisit when

- [ADR-0046](0046-production-map-tile-provider.md) picks a production provider, or
- an Android Google Maps key is issued, or
- Android is verified on a device for the first time (`README.md:175`).
