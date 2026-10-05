# Home v2: Host Grotesk + filmstrip collection

Paste the prompt below into Claude Code, opened in `Tr3v0r86.github.io` on `main`. Copy this `home-v2/` folder into the repo root first, as `handoff/home-v2/`.

Reference render: `trevorcardozo.com Home v2.html` in the design project.

---

## Prompt for Claude Code

Implement the home v2 redesign from `handoff/home-v2/`. Trevor has explicitly authorised push and deployment for this change.

1. **Font.** `npm i -D @fontsource-variable/host-grotesk`. Copy its latin `wght` woff2 to `public/fonts/host-grotesk.woff2`, and copy its license to `public/fonts/Host-Grotesk-LICENSE.txt`. Remove `display.woff2`, `body.woff2` and their licenses once nothing references them. Drop the Bricolage/Hanken `@font-face` rules and every `Bricolage`/`Hanken` font-family reference in `src/styles.css`. Case-page special cases (Georgia for Bodybrain/Trips) stay. Preload the new font on every page. Keep within the 180KB font budget.
2. **Styles.** Delete the whole "native, mobile-first project carousel" block and the later home-only overrides in `src/styles.css` (everything that targets `.home .collection`, `.home .piece…`, `.carousel-*`, `.slide-*`, `.phone-frame`, `.school-stack` or `.brain-focus` on home). Append `handoff/home-v2/src/home-v2.css`. Keep the `:root` tokens from the new file and remove the old olive tokens, apart from anything case pages still use: re-point those to `--accent`.
3. **Script.** Replace `src/collection.js` with `handoff/home-v2/src/collection.js`.
4. **Catalog.** Merge `handoff/home-v2/content/collection-frames.json` into `content/projects.json` as per-project fields. Extend the content validator: `collectionFrame` must be `photo|screen`, and `collectionTint` must be one of `sea|persimmon|cobalt|plum|chartreuse|sky` (required when the frame is `screen`).
5. **Generator.** Change the home template to emit exactly the structure in `handoff/home-v2/home-markup.html`.
   - Use `collectionCover ?? cover` for the image, with srcset from its variants.
   - Remove the per-slide "About this piece" details popover and the duplicate "View project" links: the whole card is now the link.
   - Wrap each h1 line in a `<span>`.
   - Use `loading="lazy"` from the 5th card on.
   - Remove `.carousel-hint` and `.work-jump`.
   - The footer "Made for real life." section is unchanged in content.
6. **Tests.** Update the e2e selectors for the new markup: the popover and the hint are gone, and the counter now contains a `<span>`. Keep coverage for touch, keyboard, no-JS (the track must still scroll natively and every card must still be a link), reduced motion, 320/390/768/1440, axe, CLS ≤ 0.1, and the transfer budgets. Add a test that `.artifact--screen` images are not cropped (`object-fit: contain`).
7. **Ship.** Run `npm run check` and `npm run test:e2e` until both are green. Visually inspect home at 390 and 1440. Commit as "Home v2: Host Grotesk and filmstrip collection". Then follow the README's "Deliberate release" steps: record the current Pages state, push `main`, dispatch the Pages workflow, and verify `/`, every `/work/<slug>/` page, `404.html`, `/turnkeep/`, `/turnkeep/setup.html` and `/projects-dashboard-template/`. Keep CNAME `trevorcardozo.com`. Never create a root `turnkeep/`.

## Design rules (for review)
- One holding frame (8:9, 24px radius) for every cover. Photos are cropped to fill it. Screens and simulator captures sit whole on a 50% tint of their project colour.
- At desktop width the first viewport shows about 3.5 cards, with the right edge cut off on purpose so it's clear there are more. The big "01 / 17" counter and the progress bar repeat that message.
- Host Grotesk only: 800 for headings and the counter, 700 for card titles, 500 for UI, 400 for body text.
- Palette: paper `#F3F1EC`, ink `#17181C`, muted `#55575E`, line `#D3D0C7`, accent cobalt `#2D46D6`. Tints: sea, persimmon, cobalt, plum, chartreuse, sky.
