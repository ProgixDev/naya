# Image prompts — GPT Image, 14 October 2026

Seven prompts, in three groups. Generate each one, send the results back, and
Claude resizes, crops and swaps the files in the app.

| # | Group | Attach | Ratio | Replaces / adds |
|---|---|---|---|---|
| 1 | Cars | `packages/assets/cars/naya-signature-plum.png` (style) + any photo of a Dacia Sandero (shape) | 3:2 landscape, transparent background | `naya-signature-plum.png` |
| 2 | Cars | your approved result of #1 | 3:2 landscape, transparent background | `naya-signature-pearl.png` |
| 3 | Cars | your approved result of #1 + `packages/assets/cars/naya-signature-top.png` (framing) | 1:2 portrait, transparent background | `naya-signature-top.png` (map marker) |
| 4 | Car wash | your approved result of #1 (shape only) | 4:3 landscape | replaces the placeholder `packages/assets/mock/car-wash-before.jpg` |
| 5 | Car wash | your result of #4 | 4:3 landscape | replaces the placeholder `packages/assets/mock/car-wash-after.jpg` |
| 6 | Onboarding (optional) | none | 9:16 vertical | passenger slide 2 « À votre rythme. » (still a drawing today) |
| 7 | Onboarding (optional) | none | 9:16 vertical | driver slide 2 « Des gains clairs. » (still a drawing today) |

Rules for every image: no logo, badge, emblem, lettering or number plate; no readable
text on any screen or sign. People: Moroccan women with light, olive to caramel
skin, a natural mix with and without headscarf, no men. Real Rabat settings in daylight.

---

## Cars

Today's car reads as a concept EV (petal wheels, light-bar eyes, a badge). These keep
its render style and palette and turn it into an everyday compact hatchback seen in
Rabat — the shape family of the Dacia Sandero / Renault Clio / Peugeot 208 — with
nothing that identifies a make.

### 1 — Plum, three-quarter front

> Two attached images, each with one job. First image = render style, colour and camera angle only: keep its soft studio product-render look, the deep plum-aubergine paint with rose-gold accents, the three-quarter front view from the driver's side, the warm interior seen through the glass, the transparent background and the same size of car in the frame. Second image = body shape only: a compact five-door city hatchback like the one pictured.
>
> Draw a realistic compact five-door hatchback, the kind of everyday car seen on every street in Rabat: short bonnet, upright windscreen, tall glasshouse, a simple roof line with plain roof rails, practical proportions, 16-inch wheels. Change the details so no make can be recognised: a plain horizontal grille with thin slats and no badge or emblem, simple rectangular headlights with a thin LED strip (no eye-shaped light bars), plain door handles, a smooth bonnet without a brand crease, five-spoke alloy wheels in satin silver-rose instead of the petal wheels.
>
> Paint: deep plum-aubergine metallic body, a thin rose-gold line along the lower door sill, black plastic lower bumper and wheel-arch trims as on a real budget hatchback, tinted glass showing a warm beige interior.
>
> Camera: product render, three-quarter front from the driver's side at headlight height, 50 mm equivalent, the whole car in frame with even margins. Light: soft overhead studio softbox and a large side fill, gentle reflections along the doors, a soft contact shadow under the tyres only.
>
> Realistic proportions and panel gaps, believable tyre sidewalls, mirrors the right size for a small car. Clean illustration-render finish, not a photo.
>
> No logo, badge, emblem or lettering anywhere — not on the grille, wheels, tailgate, steering wheel or windows. No number plate. No concept-car styling, no light bars, no flower-shaped wheels. Transparent background.

### 2 — Pearl, same car

> Use the attached image as the exact car: same body, same angle, same wheels, same framing, same lighting, same transparent background. Change only the paint: a pearl-white metallic body with a faint warm pink sheen, the rose-gold sill line kept, black lower trims kept, wheels in satin silver-rose. Everything else stays identical. No logo, badge, lettering or number plate.

### 3 — Top view, for the map

> First attached image = the car to draw: same body, same plum paint and trims. Second attached image = framing only: a straight top-down view of a car, nose pointing up, centred on a transparent background.
>
> Draw the same compact hatchback seen exactly from above, nose at the top: the plum roof with two plain roof rails, the windscreen and rear window as darker tinted shapes, the mirrors just visible at the sides, a soft shadow outline around the body. Flat, simple and readable at 40 px wide on a map. No logo, no lettering, no number plate. Transparent background, portrait 1:2.

Checks before integration: zoom on grille, wheels, tailgate and steering wheel —
nothing identifies a make; the plum matches the app's plum; the pearl is not grey;
same angle and size as today's files; the top view reads as a car at 24–40 px.

---

## Car wash (mock photos for « Lavage à domicile »)

These replace the placeholder « before / after » pictures on a finished wash. Same
car, same framing, so the two read as a pair. File names, sizes and the two Naya Famille proof photos:
[packages/assets/mock/README.md](../../../packages/assets/mock/README.md).

### 4 — Before the wash

> Use the attached image for the car's body shape only. Make a realistic photograph, not a render.
>
> A compact five-door hatchback in a plain mid-grey metallic paint, parked along the kerb of a quiet residential street in Hay Riad, Rabat, in the morning. The car is visibly dirty after weeks without a wash: a fine layer of beige dust over the bonnet and roof, dried rain spots on the windscreen and side windows, grey road grime on the lower doors and wheel arches, dull brake-dust on the alloy wheels, a few dry leaves caught at the base of the windscreen.
>
> Behind: cream apartment buildings with small balconies, a trimmed ficus tree, a clean pavement. No people.
>
> Camera: three-quarter front view from the pavement side at chest height, 35 mm equivalent, the whole car in frame with a little space around it, f/5.6 so the street is readable but secondary. Light: soft morning daylight from the side, open shade, natural contrast. Realism: true-to-life dust texture, real reflections dulled by the dirt, believable tyre wear. Colour: neutral daylight, slightly muted.
>
> No logo, badge, emblem or lettering on the car; no number plate (plain blank plate area); no readable signs or text anywhere; no people. Landscape 4:3 (the app shows a 4:3 tile; export 1200 × 900 JPEG).

### 5 — After the wash

> Use the attached photo as the exact scene: same car, same parking spot, same camera position, same framing, same buildings and tree. Change only the car's condition and the light on it.
>
> The car is freshly washed and dried: deep glossy mid-grey paint with crisp reflections of the buildings and sky, spotless windows, black trims restored, clean bright wheels, a few small water droplets still beading on the bonnet. A folded plum-coloured microfiber cloth rests on the edge of the bonnet. The pavement under the car is slightly darker where the water dried.
>
> Same soft morning daylight; slightly brighter, cleaner highlights on the paint. No people, no logo, badge or lettering, no number plate, no readable text. Landscape 4:3 (export 1200 × 900 JPEG).

---

## Onboarding slide 2 in each app (optional)

Today slides 1 and 3 are photos and slide 2 is still a drawing. These two make the
whole onboarding one visual language. The app crops the centre-top of a 9:16 image,
so keep faces in the upper half and the bottom third calm.

### 6 — Passenger, « À votre rythme. »

> A candid documentary photograph. A Moroccan woman in her early thirties with light olive skin and dark wavy shoulder-length hair, no headscarf, a cream knit cardigan over a plum top, sits at a small café terrace table in Agdal, Rabat, in late-morning sun. She holds her phone in one hand and looks at it with a calm, decided half-smile, as if she has just booked her ride for later; a glass of mint tea and a small notebook sit on the table. Beside her, out of focus, a friend in a dusty-rose headscarf with light caramel skin laughs at something off-frame.
>
> Behind: the terrace's white metal chairs, a row of young palm trees and cream apartment fronts along the avenue, softly blurred.
>
> 9:16 vertical: the woman's face and phone in the upper half on the right third, her friend over her shoulder on the left, the lower third quiet (table top and tea glass).
>
> Camera: 35 mm equivalent at eye level across the table, f/2.0, gentle background blur. Light: real daylight under a parasol, warm bounce from the table, no studio light. Realism: natural skin texture, flyaway hairs, steam on the tea glass, real reflections. Colour: warm daylight, cream and plum, soft contrast.
>
> The phone screen faces away or shows only a soft plum glow — no readable interface or text. No logos, no signage text, no men. Natural hands with five fingers.

### 7 — Driver, « Des gains clairs. »

> A candid documentary photograph. A Moroccan woman driver in her late thirties with caramel skin and a neatly tied plum headscarf, a light denim shirt, sits in the driver's seat of a parked compact car with the door open, on a quiet street near the Corniche in Rabat at golden hour. She glances down at her phone with a satisfied, relaxed smile after her last ride of the day, her other hand resting on the steering wheel.
>
> Through the windscreen and open door: the low wall of the Corniche, a strip of Atlantic sea and sky in warm evening light, a few palm trees, all softly out of focus.
>
> 9:16 vertical: her face and the phone in the upper half on the right third, the open door frame on the left edge, the lower third calm (door panel and seat).
>
> Camera: 28 mm equivalent from just outside the open door at shoulder height, f/2.8. Light: low golden sun from behind the car, warm rim light on her headscarf and cheek, soft fill from the interior. Realism: skin texture, fabric weight of the denim, real reflections on the dashboard and glass. Colour: warm golden hour, plum and denim blue.
>
> The phone screen shows only a soft glow — no readable interface or text. No logos or badges on the car or steering wheel, no number plate, no men, natural hands.
