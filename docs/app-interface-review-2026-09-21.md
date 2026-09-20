# App interface review — 2026-09-21

## Finding and design decisions

Trevor rejected the three editorial SVG heroes as text pages. Applied gstack design-review to this bounded issue. Replace posters with captures of real HTML/CSS/JavaScript interfaces: Second Brain uses a workspace tree, editor and export controls; Trips uses an illustrated map, selectable stops, visit tracking and packing checklist; Bodybrain uses an activity ring, switchable weekly charts, notes and a separate source view. Original project evidence remains in each gallery. Fictional data, illustrative geography and absent live integrations are labelled explicitly. Demo pages are noindex and make no network writes.

## Implementation and evidence

FINDING-001 verified. Code 774f056; behavior tests 31ffe69. Sources: scripts/generate-app-concepts.mjs and public/prototypes/. Captures: 480 × 950 CSS pixels at 3×, lossless WebP variants 480/960/1440. Import with scripts/import-app-captures.mjs after gstack recapture. Before/after case screenshots are in ignored .local/{bodybrain,trips,second-brain-builder}-{before,after}.png; app captures .local/*-app.png. Added working local demos via each case's “Try the interface concept” link. These do not change the underlying live products.

## Collection order

Turnkeep, Padlano, Parent Portal, Second Brain Builder, Bodybrain, Reggio projects, A school for making, Pomodoist, project dashboard, ESP32 experiments, Trips, custom media databank. The remaining projects retain their previous relative order. Catalog sort order, picker and previous/next case navigation agree; a dedicated regression test checks this. Existing navigation assertions were updated to follow the requested ordering, without removing coverage.

## Validation and release state

8 catalog/build checks and 27 browser tests pass. New tests exercise blueprint naming/download, map selection/visited state/checklist, Bodybrain chart/week/source controls and three phone widths (320/390/480). Existing portfolio checks cover 320/390/768/1440, accessibility, no-JS navigation and transfer budgets. Gstack visual inspection includes app portraits and desktop case pages. A blueprint string-escaping failure was found and fixed before completion. Subjective review: product recognisability improved from low to clear; no numeric design score claimed. Local commits only; live deployment remains unchanged.
