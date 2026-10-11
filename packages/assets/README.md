# @naya/assets

No AI-generated images ship in the apps.

- `brand/` — "Rencontre" symbol, drawn wordmark, lockups and app marks, unchanged SVG from `Naya-Expo-Handoff.zip` (Figma file nOuWsQ5MA8CdU5HsSGoXwP).
- `src/spots.ts` — original vector illustrations, one per context (journey, schedule, verified, support, earnings, wallet, drive) plus the car in side and top view. Drawn from simple shapes in the theme colours, so they follow light and dark mode.
- `src/concepts.ts` — the six logo concepts (vector).
- `photos/` — real photographs for the onboarding, Pexels licence; sources in `photos/CREDITS.md`. Replace with Naya's own shoot when available.

No third-party logos are stored here. Apple sign-in uses the native `AppleAuthenticationButton`; Google sign-in is hidden until configured (see docs/INTEGRATIONS.md).
