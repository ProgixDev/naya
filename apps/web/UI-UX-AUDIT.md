# Naya UI/UX audit

Audited 5 October 2026. Scope: landing page, responsive layouts, booking, dashboard, ride details, support and navigation. Standard: a flagship demonstration of website craftsmanship, with a believable operational product behind it.

## Verdict

Naya has a coherent foundation: a restrained pearl/plum palette, expressive display typography, warm photography and functioning prototype journeys. It does not yet demonstrate exceptional art direction or operational UX. The page relies on familiar split sections, small supporting text and repeated cards. The backoffice looks orderly but makes the operator search for the next important action.

The next iteration should preserve the brand and introduce a stronger visual narrative, comfortable functional typography, clearer service expectations and faster task completion. Adding more decoration or more entrance animations alone would not address these gaps.

This is an expert inspection, not a moderated usability study or a complete accessibility conformance assessment. Conversion impact is a hypothesis to validate, not a measured result. No production performance score was collected. No interface implementation was changed during this audit.

## Method and evidence

Initial desktop/mobile screenshots and computed-style measurements were collected before the instruction to stop using Playwright. After that instruction, the remaining inspection used the built-in browser: native accessibility snapshots, screenshots and UI interaction. Booking, ride detail, support priority, mobile menus and the tablet hero were inspected there. Browser viewport overrides were reset; no bookings, cancellations, approvals or support replies were submitted in the user's browser.

Desktop inspection used 1440px; initial mobile measurements used 390px. The built-in browser also checked mobile and tablet layouts. Full-page captures can hide lazy-loaded imagery until it enters the viewport; the chauffeur photo was scrolled into view before the final landing capture. An initially blank offscreen image was not treated as a product defect.

Evidence:

- [Desktop landing](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/audit-landing-desktop.png>)
- [Desktop overview](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/audit-office-desktop.png>)
- [Mobile overview](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/audit-office-mobile.png>)
- [Tablet hero, built-in browser](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/audit-iab-tablet-hero.jpg>)
- [Booking, built-in browser](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/audit-iab-booking.jpg>)
- [Support detail, built-in browser](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/audit-iab-support-detail.jpg>)

## Priority findings

P1: address in the next iteration because it affects legibility, trust or correct task completion. P2: improve to reach the desired showcase standard. These are design priorities, not security classifications.

| Priority | Finding | Recommended change | Acceptance criterion |
| --- | --- | --- | --- |
| P1 | Functional text is too small; several text styles fail minimum contrast. | Establish a deliberate text scale and darker secondary/status tokens. | Normal text meets 4.5:1 contrast; core table text is 13–14px and landing body text 16–18px as design targets. |
| P1 | The page says “bientôt à Rabat” but presents operational booking language. | Make the launch state and demo action explicit beside the primary CTA. | A visitor can identify whether they are trying a demo or requesting a real ride without opening the footer. |
| P1 | Dashboard priorities omit a high-priority support ticket. | Sort one unified work queue by urgency and age; move it above charts. | The high-priority payment ticket precedes normal-priority tickets; all six pending items are reachable from the queue. |
| P1 | Support Export downloads courses. | Export the current section's filtered dataset, or remove irrelevant export actions. | Support produces support records; passenger/journal/settings pages do not silently produce a rides CSV. |
| P1 | Map pins do not follow zoom. | Put streets and markers in the same coordinate system; bind markers to driver records. | Pins maintain their geographic relationship at every zoom level and represent the displayed online drivers. |
| P1 | Closed mobile backoffice navigation remains exposed in the accessibility tree. | Hide/inert the closed drawer; add expanded state, focus management and Escape dismissal. | Keyboard users cannot enter a closed drawer; opening and closing it moves/restores focus predictably. |
| P1 | Cancellation and rejection actions immediately mutate state without a reason or recovery path. | Use a compact confirmation with consequences and reason; offer undo where the state transition permits it. | An operator can review the action before committing; the reason is visible in the activity history. |
| P2 | The landing page repeats the same editorial split/card rhythm. | Create contrasting section scales, one dominant visual moment and a clearer narrative sequence. | Each section has a distinct role and composition, with fewer interchangeable slogans. |
| P2 | Tablet hero crops out most of the passenger and wraps the heading into three lines. | Stack earlier, change column proportions or provide an alternate crop. | Both women remain readable at tablet widths; headline line breaks are intentional at 375, 390, 768, 1024 and 1440px. |
| P2 | “Voir mon trajet” repeats route selection before revealing an estimate. | Carry the selected route directly into the estimate/review state. | One route entry leads to price, timing and trip review; edit controls preserve the selection. |
| P2 | Mobile dashboard tables conceal status and amount offscreen. | Use concise ride cards on narrow screens or pin essential columns with an explicit scroll cue. | Reference, status, route and amount are readable without guessing that the table scrolls. |
| P2 | Backoffice drilldowns interrupt the list with centered modals. | Use a desktop detail drawer or list/detail workspace; retain mobile full-screen detail. | Closing a detail restores the same filter, selected row and scroll position. |
| P2 | Photography, stylized vehicle art and avatars feel like different asset families. | Define shared lighting, vehicle identity, cropping and realism rules. | The hero, recruitment photo, vehicle and avatars feel deliberately related; any illustration has an explicit explanatory role. |
| P2 | Large source PNGs are served without responsive image variants. | Deliver appropriately sized AVIF/WebP assets and reserve aspect ratios. | Mobile does not download the full desktop source; verify LCP and layout stability on a production build. |

## Readability measurements

These ratios use rendered foreground and solid background colors, not screenshot sampling. They describe the inspected states, not every possible component state.

| Element | Font size | Text / background | Contrast |
| --- | --- | --- | --- |
| Inactive period controls | 10px | `#9c8796` / `#efebef` | 2.82:1 |
| Table headings | 10px | `#aa92a1` / `#fcfafc` | 2.76:1 |
| Plum status labels | 9px | `#956980` / `#f1e8ee` | 3.80:1 |
| Green status labels | 9px | `#61836a` / `#edf4ef` | 3.79:1 |
| Panel descriptions | 10px | `#806b79` / white | 4.89:1 |

The first four are below the 4.5:1 threshold for normal text in [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). The panel descriptions pass contrast but remain uncomfortably small for this product. WCAG does not prescribe the suggested 13–18px type sizes; those are usability recommendations.

Desktop nav links measured 18px high. The legal button measured 128×13px with 8px text. Increase padded hit areas, especially on touch devices. Use approximately 44px controls as a comfort target; [WCAG 2.2 AA target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies 24px with spacing and other exceptions, so small visible height alone is not proof of a violation.

Retain the existing positive accessibility work: reduced-motion handling, named controls, labelled form fields and the modal's Escape/focus restoration. Bring mobile menus to the same standard. The built-in browser confirmed Escape leaves the landing menu expanded; the mobile backoffice drawer also remained visibly open after Escape.

## Landing page direction

The strongest idea is human independence within the city. Let the photography and an actual journey carry that idea. The current repeated “Votre… / Notre…” and “Plus… / Moins…” structures dilute the hierarchy; emotional headlines should be supported by concrete answers about where, when, price and what happens next.

Recommended sequence:

1. **Hero:** preserve the two-woman relationship in the image. Keep the headline, add one concrete sentence explaining Naya and Rabat, and use one clear primary demo action. Make the launch status readable beside it.
2. **Journey preview:** bring the route-and-price interaction closer to the first screen. Selection should reveal an estimated trip directly, with a clear edit path and an honest demo label.
3. **Trust:** replace decorative five-star social proof with concrete product safeguards that the prototype can demonstrate. Publish customer ratings/testimonials only when supported by real evidence. Keep fictional ratings explicitly inside the demo.
4. **Human story:** introduce a generous full-width photographic section with a different background/scale. Use one specific story or service scenario rather than another abstract card trio.
5. **Driver recruitment:** visually distinguish this audience and make application requirements, steps and expected follow-up clear. Preserve the corrected single-car photograph.
6. **FAQ and final action:** answer the remaining practical objections, then repeat the same primary action label.

Motion should explain this journey: a route progressing through selection, review and arrival is a stronger signature than making every section enter with the same fade/vertical movement. Keep supporting interaction feedback brief and predictable, with the existing reduced-motion alternative. Avoid scroll hijacking and decorative motion that delays reading.

Use a consistent image brief for future generated photography: believable people, coherent car geometry, shared warm-neutral lighting, clean focal separation and breakpoint-specific composition. The corrected chauffeur image should remain the quality bar. The hero and chauffeur source PNGs are approximately 1.9MB and 1.7MB; the vehicle PNG is approximately 797KB. These are asset weights, not measured Core Web Vitals results.

## Backoffice direction

The first question should be “What needs my attention?” Put the work queue immediately after a compact live status summary, with urgent tickets, unassigned/problem trips and pending verification. Analytics can follow. The current mobile overview stacks KPIs, activity, distribution and map before priorities, forcing substantial scrolling to reach actionable work.

The priority implementation displays two pending applications and the first open ticket rather than sorting by urgency. In the inspected seed state, the normal-priority lost-item ticket is shown while the high-priority payment ticket is omitted. Its badge says six, but only three items are shown and the footer opens only verifications. Give the mixed queue a matching “Voir les 6 demandes” destination and visible urgency/age.

Use Inter for operational hierarchy, readable row density, stronger status text, aligned amounts and timestamps. Reserve editorial display type for genuinely useful top-level moments. Clarify metric names: “Volume des courses” currently displays MAD, so “Montant des courses” is clearer. Visually distinguish live fleet counts from period-dependent metrics rather than making the period tabs appear to govern all cards.

Support should separate composing/saving a response from resolving the ticket. The present single “Enregistrer et résoudre” action allows no ongoing conversation state. A richer prototype can support an assignee, priority, age, linked trip, response history and a separate resolution action. Demonstrate document review with individual pending/accepted/rejected states instead of showing every document as “Validé” before the application has been examined.

The map currently has only three hard-coded named markers and transforms the street SVG separately from the marker overlay. Beyond zoom correction, tie marker identities to the same driver state used by the counter. Keep the schematic/demo label; do not imply actual tracking.

## Reference synthesis

Refero research covered full VanMoof and ALSO style records, the [Lemni inbox screen](https://refero.design/pages/af1843a7-a566-4c19-b835-d1c201ae5a9d) and its [conversation review and triage flow](https://refero.design/flows/4596).

- **VanMoof:** adapt strong product/media hierarchy and variation in section scale. Naya should keep its warmer human emphasis and brand colors.
- **ALSO:** adapt a recognizable visual grammar and decisive section boundaries. Use one repeatable Naya motif, with deliberate restraint.
- **Lemni:** adapt persistent list/detail context and visible status/priority/assignment, especially for support. Its flow demonstrates in-place metadata updates followed by priority-based filtering.

The existing design record also cites Awwwards' Zoox reference. Attempts to retrieve Zoox and VanMoof Awwwards pages during this audit timed out, so no new visual claims or award-status claims are based on those pages.

## Implementation order and release checks

**Pass 1 — usable and credible:** text/contrast tokens, mobile drawer semantics, corrected exports, map coordinates, urgent queue ordering, action confirmation and explicit demo/launch language.

**Pass 2 — distinctive landing experience:** hero composition across breakpoints, consistent image family, revised section narrative, direct estimate flow and one purposeful motion sequence.

**Pass 3 — operational depth:** contextual details, mobile ride cards, meaningful support and verification states, clearer metrics and production image delivery.

Verify with the built-in browser: keyboard-only navigation, Escape and focus restoration, 200% text zoom, reduced motion, empty/error/loading states, filter persistence, exports matching the current section, all online drivers represented on the map, and resize/orientation changes without hidden content. Run production performance measurements before setting performance targets; check actual LCP, INP and CLS rather than relying on localhost impressions.

Once implemented, a small task-based usability study should test whether a first-time visitor understands the service/launch status, reaches an estimate without repeated entry, and whether an operator identifies and handles the most urgent item without searching through analytics.

## Implementation follow-up — 5 October 2026

The original observations above describe the audited version. The authorized refinement pass implements the findings in the proposed order, then incorporates the user's request for real maps.

| Audit item | Implemented change |
| --- | --- |
| Readability | Larger functional type, 44px controls, darker muted and semantic status colors. Selected revised foreground/background pairs range from 5.43:1 to 6.74:1. This is a token check, not a complete accessibility certification. |
| Launch/demo clarity | Explicit launch and no-payment copy beside the primary action; consistent “Essayer un trajet” label. |
| Work queue | Urgent support precedes pending applications; the queue sits above analytics and expands to all six seed requests. |
| Exports | Section-specific, filtered support/driver/passenger/finance/journal datasets; irrelevant Settings export removed. Built-in browser observed `naya-support.csv`. |
| Map and markers | Real Leaflet/OpenStreetMap streets on landing and overview; markers use geographic coordinates and online-driver records. Pan, zoom, recenter and driver popups work. Demo driver positions and approximate endpoint connection are labeled. |
| Mobile navigation | Closed navigation is hidden from the accessibility tree; opening moves focus, traps it and hides background content. Escape returns focus to the trigger. Landing navigation also handles Escape. |
| Cancellation/rejection | Required reason and consequence review before confirmation. Reasons persist in the record and activity history. |
| Landing composition | Journey brought earlier; flat editorial trust section, purposeful route motion and contrasting full-width recruitment photograph. Unsupported decorative star ratings removed. |
| Hero crop | Earlier tablet stacking, stable 3:2 image ratio and intentional two-line headline. Both women remain visible. Tablet navigation collapses before links crowd. |
| Estimate flow | Selected route opens directly in the quote/review state; editing preserves values. Browser verified Agdal → Hassan and a 50 MAD demo estimate. |
| Mobile rides | Cards retain reference, status, route, names, payment method, time and amount. |
| Detail context | Desktop side drawers retain the list; mobile uses full-screen details. Background is inert and focus returns to the initiating row. |
| Asset consistency | Realistic hero and corrected single-car recruitment photography retained; fictional CGI avatars replaced by initials; unrelated decorative vehicle artwork removed from the landing flow. |
| Image delivery | Next.js responsive image variants, AVIF/WebP and reserved aspect ratios. Field Core Web Vitals have not been measured. |
| Operational depth | Separate reply saving/resolution, conversation history, assignee and priority; individual document review states and approval gating. Live fleet counts are distinguished from period metrics. |

Validation uses TypeScript, a production build, four isolated Node state tests and the built-in browser. No Playwright was used in this refinement pass. State tests cover document approval gating, recorded cancellation/rejection reasons, support conversation persistence with separate resolution, and scheduled ride persistence. Browser inspection confirmed queue ordering, support export filename, estimate flow, document-review gating, focus restoration, mobile ride cards, real-map tiles/markers and responsive layouts. Layout measurements found no horizontal page overflow at 375, 390, 768 and 1024px; desktop composition was reviewed at 1440px. A server/browser timestamp hydration mismatch found during verification was corrected.

This remains a local prototype. Map points do not represent real tracking, and the dashed endpoint connection is not a calculated driving itinerary. No real support message, payment or identity approval is sent. Production performance and task-based usability measurement remain separate follow-up work.

Current visual evidence:

- [Refined desktop landing](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/ux-fixed-landing-desktop.jpg>)
- [Tablet landing](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/ux-fixed-landing-tablet.jpg>)
- [Mobile landing](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/ux-fixed-landing-mobile.jpg>)
- [Real map in backoffice](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/ux-fixed-real-map.jpg>)
- [Mobile ride cards](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/ux-fixed-rides-mobile.jpg>)

### Button consistency with the mobile app

The website shares `#6B3657` and Inter with the mobile app. Its flat buttons use 7px corners and 44/52px minimum heights. The shared native component uses pills, glossy primary material, frosted secondary material and 44/50px heights. These are related brand treatments, not identical button styles. This comparison was requested during implementation; no app-button redesign was inferred from the question.

### Final requested image replacement

Both photographs were regenerated using the prompt skill and built-in image generation, emphasizing natural skin, expression, hair and fabric imperfections. The new `hero-candid.png` and `driver-candid.png` replace the photographs in the page; the driver composition retains one car with an unobstructed door. The generated assets were inspected before integration. Exact prompts and source notes are saved in PHOTO-PROMPTS.md.

### Supplied-reference finalization

The final photographs are `hero-moroccan.png` and `driver-moroccan.png`, generated using the user’s three actual photographic references. The hero adopts close driver/passenger framing; recruitment adopts a seated open-door pose. Natural texture and single-car geometry are preserved. These supersede the initial candid candidates. The current Moroccan casting uses light-to-medium olive complexions and dark wavy hair. Exact casting edit prompts are in PHOTO-MOROCCAN-PROMPTS.md, with original reference roles in PHOTO-REFERENCE-PROMPTS.md.

Final supplied-reference photographs were checked in the built-in browser at desktop, mobile and tablet widths. Evidence above now uses the final hero image; [the recruitment section](</Volumes/UNREAL/Codex Space Recovery/2026-10-05/Users/achrafarabi/Dev/naya/apps/web/review/ux-fixed-recruitment-desktop.jpg>) shows the final seated pose. The browser observed AVIF hero variants requested at 384px and 828px widths, rather than the full 1536px source, and reported no console errors or warnings in the final preview. Responsive and reduced-motion test overrides were reset. The final production build passes; image-only changes did not alter the four previously passing state tests.
