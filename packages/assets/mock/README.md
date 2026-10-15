# Mock photos (`packages/assets/mock/`)

Photos shown in the apps where the mock backend stands in for someone else's camera: the car-wash
team's before and after shots, and the Naya Famille proof photos taken by a chauffeuse who is played
by the mock bot (or attached on a device without a camera). They are exported as `mockPhotos` from
`@naya/assets` (`src/mock.ts`) and never labelled as mock in the UI.

The files committed today are photos generated on 15 October 2026 with GPT Image from the prompts below
(car wash: prompts #4 and #5 of `docs/design/media-prompts/`) and QC'd before export
(lettering on a tyre softened in « Après », which is aligned to « Avant »; 1200 × 900, JPEG q72–q82). To swap them, replace a file **with the same name, the same
format (JPEG) and the same 4:3 ratio**. No code change is needed; restart Metro so it picks up the
new file.

| File | Shown | Size |
|---|---|---|
| `car-wash-before.jpg` | Car wash order · « Photos » · « Avant » (both shots of the stage) | 1200 × 900 JPEG, 4:3, < 200 KB |
| `car-wash-after.jpg` | Car wash order · « Photos » · « Après » | 1200 × 900 JPEG, 4:3, < 200 KB |
| `famille-pickup.jpg` | Naya Famille trip · photo at the pick-up (parent's approval card, « Photos ») | 1200 × 900 JPEG, 4:3, < 200 KB |
| `famille-dropoff.jpg` | Naya Famille trip · photo at the school (« Photos ») | 1200 × 900 JPEG, 4:3, < 200 KB |

The UI crops each photo to a 4:3 tile with rounded corners: keep the subject centred, with a
margin of about 10 % on every side.

## Prompts for generating the real mock photos

Generate at 4:3 (or larger and crop to 4:3), then export JPEG at quality ~80, 1200 × 900. No logos, no readable
licence plates, no text in the image.

**car-wash-before.jpg** and **car-wash-after.jpg**: use prompts #4 and #5 of
[docs/design/media-prompts/2026-10-14-image-prompts.md](../../../docs/design/media-prompts/2026-10-14-image-prompts.md)
(section « Car wash »).
They draw the same compact hatchback as the app's Naya car (prompt #1), before and after the wash, from the same
spot, so « Avant » and « Après » read as one car.

**famille-pickup.jpg**

> Realistic smartphone photo taken at the front door of a family apartment building in Rabat:
> an 8-year-old girl seen from behind, wearing a lilac backpack and a school smock, holding the
> hand of an adult woman (only the arm visible), stepping towards a parked white car with its
> rear door open. Morning light, warm and calm. Faces not visible, no logos, no readable text or
> plate.

**famille-dropoff.jpg**

> Realistic smartphone photo at the entrance gate of a primary school in Rabat, morning: an
> 8-year-old girl seen from behind with a lilac backpack walking through the open school gate
> into the courtyard, a teacher waiting inside (out of focus). Whitewashed walls, green gate,
> soft daylight. Faces not visible, no readable signage, no logos.

Provenance: generated on 15 October 2026 with GPT Image from the prompts above, QC'd and exported at 1200 × 900 under 200 KB. They replace the Pillow placeholder art
of 14 October 2026. Known limits: the car in `famille-pickup.jpg` is a cool white and its open door is the front
one; `car-wash-before.jpg` leaves about 3 % margin in front of the bumper.
