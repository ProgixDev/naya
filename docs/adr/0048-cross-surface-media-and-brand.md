---
id: ADR-0048
title: "Cross-surface media and brand"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0023, ADR-0025, ADR-0032, ADR-0038, ADR-0043, ADR-0044, P9, VIS-05, VIS-08, VIS-18, VIS-20, VIS-26, VIS-27, DOM-14, UI-11, DOC-14, DOC-20, docs/tasks/2026-10-13.md]
---

# ADR-0048 · Cross-surface media and brand

## Context

Decision **D11** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d11-logo-and-media-policy)). It settles [ADR-0025](0025-mobile-illustrations-are-vector-svg-and-avatars.md) (confirm intent) and the logo-gallery part of P9 ([backlog](../status/backlog.md)).

**What each surface shows today**

| Surface | Media at `c38429d` |
|---|---|
| Passenger and driver apps | `Illustration` ignores the image it is given and draws one generic line drawing or a plum car. Onboarding slides still point at raster files that are bundled but never shown (about 6.8 MB, backlog DOM-14). The car is always plum, whatever the vehicle's colour (UI-11). People are shown as initials |
| Website | Photorealistic generated women (hero and driver images), plus its own copies of the logo and symbol |
| Admin | Fixture documents are marked « SPÉCIMEN · FICTIF ». The fixture selfies are the handoff's generated character portraits, with no such mark |

**Logo.** The supplied « Rencontre » symbol and wordmark are the identity in use. At small sizes the symbol reads as the ⌘ key (backlog VIS-18). Six new logo concepts, sketched as vectors, are shown inside both customer apps (« Identité · 6 pistes »). The client has not chosen one.

**What was asked**

- The handoff required raster art from the supplied assets, with image generation for new art (handoff prompt:74-87).
- The client's feedback asked for "authentic media" (item 4). Commit `89aae18` answered with vector art and initials, which is what ADR-0025 records.
- The founder brief of 13 Oct ([tasks 1 and 6](../tasks/2026-10-13.md)) changes direction again:
  - **Onboarding.** Photographic images of Moroccan and North African women (light, olive to caramel skin; with and without a headscarf), in real Rabat places, in the plum palette, with no logos or text, cropped 9:16 with a calm lower third. They are generated from reference images.
  - **Cars.** Redraw the cars as unbranded cars common in Morocco (Dacia Logan and Sandero, Clio, 208 and 301, Accent, Yaris) "in the same animated-illustration style as today", in `packages/assets/cars/`.

## Decision

**Recommended, pending Achraf’s choice.** The audit's default was vector illustration and initials across the apps. The founder brief asks for photographic onboarding, so this recommendation departs from that default for onboarding only. Use one media policy per role, the same on every surface:

| Role | Medium |
|---|---|
| Onboarding (passenger, driver) | Generated photographic images that follow the founder-brief rules. The people are fictional, and the provenance is noted in `packages/assets/README.md`. Raster 9:16, compressed, with a theme-safe overlay for the title |
| In-app states (empty, success, verification) | Vector illustrations drawn from tokens, so they follow dark mode |
| Cars | One unbranded vector set with Moroccan-common silhouettes, drawn in the vehicle's real colour |
| People in the product (driver card, profile) | Initials, until a reviewer-approved photo exists with consent |
| Website | Generated photos as placeholders until commissioned photography exists, with the same casting rules as onboarding |
| Admin fixtures | Fictional, and every image marked « SPÉCIMEN · FICTIF », selfies included |

1. **ADR-0025.** Accept it for in-app illustrations and avatars only. Onboarding follows this ADR. `Illustration` must render raster sources again for onboarding.
2. **Logo.** Achraf sets a date for the client's logo choice. Until then the Rencontre identity stays. Move the six-concept gallery out of the passenger and driver apps now, into the admin or a web `/brand` page ([ADR-0044](0044-demo-gating-flag-defaults-and-the-production.md)).
3. **Unused files.** Remove bundled PNGs that are never displayed once their replacements land. Remove the unused website images (backlog VIS-20).

## Decision update (15 Oct 2026): cars and onboarding images

Achraf decided two rows of the table above on 15 Oct 2026. The rest (logo, people in the product, website, admin fixtures, unused files) stays Proposed.

- **Cars: real unbranded PNG renders, not vector.** This replaces the « Cars » row. Achraf asked for car images and generated them: the Naya Signature car in plum and pearl (`packages/assets/cars/naya-signature-{plum,pearl}{,-small}.png`) and a top view (`naya-signature-top.png`, plum, left-hand drive) for the map marker. They are transparent PNGs with no badge, plate or text. The apps show them instead of `vehicleSvg`: `Illustration` for car sources, `VehicleImage` (plum for « Prune », pearl otherwise; full-size file from 140 pt), the service options on the quote screen (pearl for every category, because colour does not imply a fare tier), and the driver car marker on every map engine (Apple Maps, Google Maps, tile fallback). The cars do not follow dark mode; the renders were checked on dark backgrounds with no halo.
- **Moroccan-common silhouettes (brief task 6) are not done.** One Naya Signature model stands for every vehicle. A pearl top view does not exist yet, so a pearl car shows plum on the map.
- **Other illustrations stay vector.** In-app states keep the token-drawn line art (`journeySvg`), as recommended above.
- **Onboarding.** Achraf chose to use all the images generated that day, including passenger slide 3 (the school gate photo, « Une communauté vérifiée »), which follows the « Onboarding » row.

## Consequences

- The onboarding images need generation, review and on-device checks in light and dark mode. The founder is collecting reference images.
- "The same animated-illustration style as today" needs confirming. The cars shown today are the vector `vehicleSvg`; the PNG "Naya Signature" cars in `packages/assets/cars/` are bundled but not shown. This ADR assumes vector. (Settled 15 Oct 2026: PNG renders; see the update above.)
- Generated people meet the client's "authentic media" request only partly. Commissioned photography is the long-term target.
- Bundle size falls once unused rasters go. `docs/DESIGN.md` must describe the current policy (backlog DOC-14).

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Vector everywhere (ADR-0025 as written) | Consistent, light, dark-mode safe | The founder finds the current onboarding random and not representative of Naya's users |
| Generated or photographic everywhere | One visual language | Heavy bundles, dark-mode issues, uncanny faces at small sizes, hard to keep consistent |
| Commissioned photography now | Truly authentic | Cost and lead time before launch; the target for later |

## Evidence

Line numbers at commit `c38429d`.

- `packages/ui/src/Brand.tsx:20-28` (`Illustration` draws `journeySvg` or `vehicleSvg` whatever the source); `packages/assets/src/concepts.ts:62-64` (`vehicleSvg`, `journeySvg`).
- `apps/passenger/src/app/(auth)/welcome.tsx:6-10` (slides reference PNG illustrations); `packages/assets/src/images.ts:2-30` (bundled rasters).
- `packages/ui/src/Ride.tsx:173` (`VehicleImage`), `:179` (`avatarFor` returns null).
- `apps/web/DESIGN.md:23-27` (generated website images); `apps/web/components/landing.tsx:180` (website logo file); `services/demo-api/src/seed.ts:163` (selfie fixtures); `services/demo-api/scripts/generate-fixtures.py:40-42` (selfies made from `packages/assets/characters/*-portrait.png`); `README.md:148` (documents marked « SPÉCIMEN · FICTIF »); `docs/DESIGN.md:5` (Salma and Amina are image-generated art).
- `packages/assets/src/brand.ts:1` (Rencontre identity); `packages/assets/src/concepts.ts:2-33` (six concepts).
- `apps/passenger/src/app/(app)/(tabs)/account.tsx:36`, `apps/driver/src/app/(app)/(tabs)/account.tsx:46` (gallery in the apps).
- Handoff prompt:74-87; `docs/MOBILE-FEEDBACK-AUDIT.md:22` (feedback item 4).
- Enforced by: nothing.

## Revisit when

- The client picks a logo, or
- commissioned photography is available, or
- the first user test of the new onboarding is done.
