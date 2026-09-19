# Trevor Cardozo · a working collection

A static portfolio of tools, objects and learning experiences. Ten selected projects, native case-page navigation, and optional desktop previews. Node 24.14.1 generates the site from one validated JSON catalog. No runtime framework, backend or third-party requests.

## Local development

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm run preview
```

Open `http://127.0.0.1:4173`. Edit templates/styles in `src/`, then run `npm run build` and reload. The build emits `dist/`; do not hand-edit generated pages. The original root `index.html` is retained as the legacy production baseline until the deliberate hosting migration.

## Add or change a project

Edit `content/projects.json`. Copy an existing record, use a unique kebab-case slug and positive `order`, add its slug to `expectedSlugs`, and set `featured` deliberately. Required fields: title, descriptor, role, status, one summary paragraph (maximum 90 words), cover, at least one distinct gallery image and a links array. The current ten entries are featured; select deliberately as the collection expands. Additional entries still get direct case URLs and appear in case navigation; an archive index is a later addition.

Allowed statuses: Live web app; Live school platform; Open-source prototype; Educational practice; In development; Hardware/software prototype; Public source; Ongoing experiments. Label photos, CAD, interface references, simulator captures and concepts accurately. The school case must remain anonymous and undated, with no external links. Preserve institution/collaborator credits on other relevant work. Keep private sources and approval records outside this repository.

For an already-cleared image, run `node scripts/media.mjs /path/to/image.png descriptive-name`. It creates metadata-free, content-hashed WebP variants in `public/media/` and prints a catalog record. Replace the alt text and caption before using it. Captions are at most 12 words; put required attribution in `credit.text` (optional `credit.url`). Essential text in an image needs `textEquivalent` or `accessibleLink` to a cleared public derivative. Geometry/source for the original diagrams is in `src/illustrations/`. Re-run the media script after editing a diagram.

```json
{"slug":"a-new-piece","title":"A new piece","descriptor":"A short explanation of the thing","role":"Design and development","status":"Ongoing experiments","order":9,"featured":false,"summary":"One concise paragraph explaining the artifact, its purpose and your contribution.","cover":{"src":"/media/cover-480-hash.webp","width":480,"height":360,"alt":"Describe the visible artifact"},"gallery":[{"src":"/media/detail-480-hash.webp","width":480,"height":360,"alt":"Describe a distinct view","layout":"wide","caption":"A useful detail"}],"links":[]}
```

## Quality checks

`check` validates content, safe paths/URLs, decoding and dimensions, anonymous-case fields, attribution rendering and code/font budgets. Browser tests exercise every route at 320/390/768/1440px, focus-over-hover precedence, keyboard navigation, one-tap touch, no-JS navigation, broken images, reduced motion, root anchors and 404. Axe checks all nine pages; cold-load tests measure transfer and layout stability.

Budgets: JS 20KB gzip, CSS 30KB gzip, fonts 180KB; initial transfer under 900KB at 390px and 1.5MB at desktop, CLS at most 0.1. Lazy images retain intrinsic dimensions. Inspect final images and copy manually; automated accessibility checks do not replace a screen-reader pass. Native page transitions are deliberately omitted after a no-JS browser failure; native links stay immediate.

## Deliberate release and rollback

No deploy runs on pull requests or main pushes. They only build/test and attach a preview artifact. `.github/workflows/pages.yml` deploys `dist/` only on manual dispatch from main, after the build job, with scoped Pages permissions. Local commits are not publication permission.

On explicit publish authorization: record the current root commit/Pages settings, inspect the complete diff and media, finish visual/content review, then push the approved branch and merge through the chosen review path. Change root Pages from legacy main/root to GitHub Actions as part of that authorized release. Keep `trevorcardozo.com`, HTTPS and DNS unchanged. Dispatch the workflow and verify `/`, all `/work/<slug>/` routes and `404.html`. Verify existing `/turnkeep/`, `/turnkeep/setup.html` and `/projects-dashboard-template/` remain live. The build must never create a root `turnkeep/` directory.

Baseline: root commit `f3eac5043200c7ff92ef00a67059d67163ac42b0`, legacy main/root, CNAME `trevorcardozo.com`, HTTPS enforced. Roll back by redeploying the previous artifact; for the first migration, use a new revert commit restoring the previous root content and restore Pages to legacy main/root. Never force-push or change DNS as a rollback shortcut. Recheck root and inherited project routes afterward.
