---
id: ADR-0025
title: "Mobile illustrations are vector SVG and avatars are initials"
status: "Proposed — confirm intent"
date: 2026-10-06
deciders: Achraf (via implementation); confirmation pending
supersedes: []
related: [ADR-0048, docs/tasks/2026-10-13.md, DOM-14, VIS-05, VIS-08, VIS-20, VIS-26, VIS-27, DOC-14, DOC-20, PRD-33]
---

# ADR-0025 · Mobile illustrations are vector SVG and avatars are initials

> **Confirm intent.** This reverses an explicit handoff rule, and the founder brief of 13 October asks for new image work. Achraf must confirm what the apps should show before this is Accepted (audit decisions D11 and D14).

## Context

What the original said: the handoff required the supplied transparent PNG illustrations, characters and Naya Signature cars, raster art with transparency, and forbade replacing them with "hand-coded SVG cartoons" or generic car icons (handoff prompt:74-87; also prompt:27). The first implementation displayed those PNGs.

What changed: item 4 of the client's feedback PDF asked for authentic media instead of the generated characters (`docs/MOBILE-FEEDBACK-AUDIT.md:22`). No real photography was supplied, so commit `89aae18` replaced every displayed illustration and car with original vector line art drawn at runtime, and dropped character portraits for initials (`docs/MOBILE-FEEDBACK-DEMO.md:12`). Since then, the founder's brief asks for new realistic onboarding images and for car art redrawn as cars common in Morocco ([docs/tasks/2026-10-13.md](../tasks/2026-10-13.md), tasks 1 and 6).

## Decision

As implemented at `c38429d`: `Illustration` renders one of a few vector drawings from `@naya/assets` (`vehicleSvg` for any car, `journeySvg` in identity, wallet or journey variants), tinted with the current theme, and uses the image passed in only to pick the variant; avatars show the person's initial (`avatarFor` returns no image). The supplied "Rencontre" brand SVGs stay, recoloured for dark mode (`packages/ui/src/Brand.tsx:15`). The PNG illustrations, characters and cars remain in `@naya/assets` but are not displayed.

## Consequences

- Art follows dark mode and costs no raster weight on screen.
- One generic line drawing now stands in for every illustration, including consecutive onboarding slides, and the car art no longer shows the vehicle's real colour (backlog [VIS-05, VIS-26, VIS-27](../status/backlog.md)).
- About 6.8 MB of PNGs are still bundled but never rendered (DOM-14, VIS-20).
- Docs still present the PNG art as the art in use (`docs/DESIGN.md:5`, `:53`; `packages/assets/README.md:6-7`, which also says the top-view car is the map marker, though markers no longer use it; backlog DOC-14).
- Mobile (vector), website (photoreal generated people) and admin fixtures (generated portraits) follow different media policies (VIS-08, DOC-20); [ADR-0048](0048-cross-surface-media-and-brand.md) sets one policy.

## Alternatives considered

Keep the supplied PNG characters (the handoff rule): rejected by feedback item 4. Commissioned photography: not available (`docs/MOBILE-FEEDBACK-DEMO.md:12`, `:56`). Generated photographs, as on the website: not chosen for the apps; the founder brief now proposes them for onboarding.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `89aae18` (2026-10-06).
- `packages/ui/src/Brand.tsx:20-28` (`Illustration` draws SVG; the comment still says raster), `:30-46` (`Avatar` falls back to the initial); `packages/ui/src/Ride.tsx:179` (`avatarFor` returns `null`).
- `packages/assets/src/concepts.ts:62-64` (`vehicleSvg`, `journeySvg`); `packages/assets/src/images.ts:1-25` (PNG sources still required).
- `docs/MOBILE-FEEDBACK-AUDIT.md:22`; `docs/MOBILE-FEEDBACK-DEMO.md:12`.
- Enforced by: no test.

## Revisit when

- Achraf confirms or rejects this ADR. Questions to answer: vector art, generated images or photography for onboarding (brief task 1)? Car art as vector or raster, and in which style (brief task 6)? Initials or photos for driver avatars, given passengers check who picks them up (backlog PRD-33)?
- [ADR-0048](0048-cross-surface-media-and-brand.md) is decided.
