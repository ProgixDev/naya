# Reference lock

User authorized direct build without questions. Existing Naya pearl/plum palette, French copy, brand SVGs and business scope are the product target.

Research: full Refero styles for Zoox, Navan and Attio; Chargetrip analytics and Stellate metrics screens. Awwwards: https://www.awwwards.com/sites/zoox

Primary direction: Zoox's measured mobility composition, restrained navigation, large readable typography, warm human photography and alternating wide sections, adapted to Naya's existing palette. Preserve generous section rhythm, image-led hero, clear action hierarchy and comfortable rounded media.

Borrow only: Attio's editorial display hierarchy and precise hairline separation in product UI; Chargetrip's table filters and export toolbar. Navan provides a comparison for travel-product photography, without adopting its gradients or bright CTA colors.

| Decision | Source | Role |
| --- | --- | --- |
| Pearl canvas, plum actions | Existing Naya tokens | Brand surfaces, actions, selected states |
| Large calm split hero, rounded image | Zoox mobility style | Marketing storytelling |
| Newsreader display, Inter UI | Attio hierarchy; locally available substitutes | Serif for display, sans for functional UI |
| Thin neutral borders, compact table | Attio + Chargetrip | Operational clarity |
| Warm contextual photography | Zoox media strategy + user instruction | Human trust; no fake product screenshots |
| Map, filters and drilldown | Stellate metrics screen | Overview to concrete detail |
| Real state mutations with local persistence | User request for good state management | Consistent landing/backoffice prototype |

Reject: bright gradients, random accent colors, decorative dashboard data, disconnected buttons, generated UI screenshots, excessive shadows. Status colors communicate semantic state only.

## Image generation

Built-in image generation was used. AVB prompt skill references: direction.md, characters.md, bank-patterns.md and Bank 2 lifestyle examples. The people are fictional. Rabat-inspired architecture is a creative setting rather than a claim of an exact location.

Current assets: `public/images/hero-moroccan.png`, `public/images/driver-moroccan.png`. Earlier `hero.png` and `driver.png` are retained for comparison. The supplied Naya car and logos remain in their original brand roles.

### Hero prompt

Create a premium photorealistic editorial lifestyle photograph for Naya, a women-only mobility service in Rabat Morocco. Landscape 3:2 image. Two adult Moroccan women, passenger in ivory blouse in the rear seat and a woman driver in dusty plum blouse in the front, smiling naturally and exchanging a warm glance. Shot from outside the open side window, looking into a light beige modern car interior. Sunlit Rabat-inspired streets with palms and creamy architecture softly blurred outside. Natural late-afternoon sunlight, warm neutral tones, restrained film grain. Authentic people, relaxed mood. No writing, branding or watermark.

### Chauffeur prompt

Photorealistic square photograph of an adult Moroccan woman chauffeur standing beside the open driver door of a parked pearl-white compact sedan, smiling toward camera. Plain dusty plum blouse and cream tailored trousers, natural dark shoulder-length hair, minimal makeup. One hand rests on the upper door edge, the other rests naturally at her side. Fictional contemporary Rabat-inspired residential avenue with pale stucco facades and softly receding palms. Eye-level medium portrait with a natural 50mm-equivalent perspective; face and blouse sharp, surroundings gently soft. Clear air. Broad open-sky daylight from camera-left with cream wall bounce, soft cheek transitions and subtle shadows. Clean warm-neutral color treatment with natural skin, cotton folds and coherent car reflections. No text, watermark or glamour retouching.

### User-requested correction

Remove the foreground white hood that blocks the car's door. Exactly one car, the one beside the woman. Reconstruct the lower open door with coherent geometry and asphalt beneath; no vehicle between camera and subject. Preserve face, outfit, pose, upper composition, background, soft daylight and color treatment. Final corrected asset replaced the rejected composition in the website.

## Initial prototype validation (superseded by the UI/UX audit)

Reference lock compared to rendered desktop and mobile pages. Evidence is saved in `review/`: complete landing page, desktop landing and dashboard, mobile landing and dashboard, and the corrected chauffeur section. Typography, spacing, image crop, photo geometry, accent roles and data hierarchy reviewed. The later UI/UX audit identified additional legibility and workflow improvements; see UI-UX-AUDIT.md for those findings and their implementation status.

Production build and TypeScript validation pass. Five Playwright browser flows pass: booking/persistence/completion, scheduled date preservation, candidature/approval/availability, support/settings/audit, and filtering/export/mobile navigation. Responsive overflow checks pass at 375, 768, 1024 and 1440px. Reduced-motion rendering is verified; the normal experience retains GSAP entrance and scroll transitions.

## Audit refinement direction — 5 October 2026

The audit adds VanMoof/ALSO composition references and Lemni triage/conversation patterns. The revised landing moves the journey earlier, strengthens photography, removes decorative five-star proof and makes demo intent explicit. The backoffice prioritizes urgent work, keeps record context visible through side panels, and uses Inter for functional hierarchy.

Hero and chauffeur images use responsive Next.js image delivery with AVIF/WebP. Fictional profile portraits were replaced with initials. The corrected chauffeur image is preserved. Real Leaflet/OpenStreetMap maps replace the schematic street artwork, with approximate neighborhood endpoints and simulated driver positions explicitly labeled. A dashed connection shows endpoint context; it is not a driving route.

See the audit implementation log for current build, state-test and built-in-browser evidence. Historical browser-test results above belong to the initial prototype; no Playwright was used for this refinement pass.

## Final photography replacement

The user requested stronger realism and natural imperfections. Both photographs were regenerated with the prompt skill and built-in image generation: ordinary expressions, natural skin texture and under-eye detail, flyaway hair, wrinkled cotton, restrained grain and modest car interiors. The driver photo preserves coherent open-door geometry with one unobstructed car. The hero shows both women with believable seated posture and seatbelts in a parked car. New URLs avoid serving cached versions of the previous images. Exact prompts and direction notes are saved in PHOTO-PROMPTS.md.

## User-supplied photographic references

The final generation uses the supplied close driver/passenger photograph and daylight driver photograph for the hero, and the seated open-door portrait for recruitment. The recruitment scene now shows a seated driver rather than the earlier standing pose. All three references inform photographic realism; new fictional people and Naya plum/cream clothing are used. The current casting edit prompts are in PHOTO-MOROCCAN-PROMPTS.md; the initial reference prompts are in PHOTO-REFERENCE-PROMPTS.md; earlier candid candidates are retained for comparison.
