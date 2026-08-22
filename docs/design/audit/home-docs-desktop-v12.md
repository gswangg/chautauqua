# Home + Docs v12 DESKTOP (900/1600) per-frame render verdicts (w24-g, DEC-613)

Per-frame render VERDICTS for the three Home hub-state frames (`Chautauqua
Home.dc.html`) and the three Docs frames (`Chautauqua Docs.dc.html`), entered
through the app's real routes and asserted against the returned HTML
STRING's structure/order/text -- an SSR response, never a computed style.
Receipts live in `test/home-docs-desktop-frame-verdicts.test.ts`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose -- they move no
desktop byte and edit no route module or `*.css.ts`, even where a claim
turns on a stylesheet fact rather than markup.

Home and Docs each render exactly ONE markup tree per route -- no
server-side branch on viewport width, geometry is CSS-media-query-only
(DEC-385 single-direction). So the fixtures that already produced a MATCHES
verdict on the corresponding PHONE frame (`test/home-account-docs-390-frame-verdicts.test.ts`)
produce the SAME rendered HTML string here; what differs is which of the
frame's own drawn desktop anatomy is checked against it.

## Frame :28 "Event hub · desktop"

**MATCHES.** Entered via `GET /` (`rootRoutes`, `src/routes/root.tsx`) with
an open-CFP event and a published event.

- Hero `<h1>Events</h1>` matches the frame's H1 text.
- The open-CFP row's primary action (`Submit a talk`) renders as
  `class="chq-home-action-primary"` linking to `/submit/open-cfp-event`,
  matching the frame's inline primary-action span in the same row.
- The published row's secondary action (`Browse sessions`) renders as
  `class="chq-home-action-secondary"`, matching the frame's row.
- The archive row's `Sessions ›` link renders as a real anchor, matching the
  frame's own anchor (the desktop frame's copy carries no `min-height`
  token on this control; the 390 companion frame's sibling anchor does --
  both are the SAME `<a>` element in the DOM, `src/routes/root.tsx`'s
  `ArchiveRow`, geometry differs only by CSS).
- The footer's right-hand `API docs` link (`href="/docs/api"`) renders,
  matching the frame's footer anchor -- the `full` state's footer markup is
  unconditional and unchanged between the desktop and phone companions.

## Frame :181 "Between cycles · desktop"

**MATCHES**, with one fact verdicted against a stylesheet rather than the
SSR markup (per this task's ruling). Entered via `GET /` with only a past
event and no open CFP or published programme.

- Hero `<h1>No open calls right now</h1>` matches.
- The archive row's `Sessions ›` link renders, matching the frame.
- The desktop-only sign-in row (`class="chq-home-action-secondary"` linking
  to `/login`, plus a `class="chq-home-cap-note"` "Organisers and
  reviewers" caption) renders, matching the frame's own row of the same
  two elements.
- **Footer anchor placement.** The frame's own footer (:219-220) ends
  "...event-content management" with NO trailing anchor at this width --
  unlike the 390 companion frame (:261), which draws one. `Footer()`
  (`src/routes/root.tsx`) renders the `API docs` anchor UNCONDITIONALLY in
  the DOM for `state === "between_cycles"` (carrying an extra class,
  `chq-home-footer-link-end-phone`, alongside the base token), so the raw
  HTML string this frame's request produces DOES contain the anchor. An
  SSR response carries no computed layout, so whether that anchor is
  visible at this frame's 900px width is not a fact the HTML string can
  answer -- it is answered by the stylesheet's own text instead:
  src/routes/public/home.css.ts`.chq-home-footer-link-end-phone { display: none; }`
  is that file's BASE rule for the class, revealed only inside that file's
  existing `@media (max-width: 700px)` block (DEC-385 single-direction). At
  this frame's width the anchor renders nothing, which is what the frame
  itself draws -- no divergence.

## Frame :269 "Fresh deploy · desktop"

**MATCHES.** Entered via `GET /` with no events at all.

- Hero `<h1>Nothing here yet</h1>` matches.
- The frame draws the primary `Sign in` action and the tertiary `API docs
  ›` link in ONE row (unlike the 390 companion frame, which stacks them) --
  the tree renders both `class="chq-home-action-primary"` and
  `class="chq-home-action-tertiary"` inside the SAME
  `class="chq-home-signin-row"` container, matching the frame's single-row
  placement.
- The footer carries no `API docs` anchor at all for this state (the third,
  `null` branch of `Footer()`'s state switch) -- matching the frame's own
  anchor-less footer.

## Frame :28 "Docs · an article"

**MATCHES.** Entered via `GET /docs/:slug` (`docsSiteRoutes`,
`src/routes/docs-site.tsx`), `reviewing-start-to-finish`.

- The header carries the COMPACT search field (`class="chq-docs-search
  chq-docs-search-compact"`, placeholder "Search the docs…") alongside the
  `API reference ↗` leaving link -- matching the frame's header row, and
  unlike the 390 companion frame's article header, which drops search
  entirely in favour of a `‹ Docs` / `Contents` toolbar.
- The sticky grouped side nav (`id="chq-docs-nav"`, `aria-label="Docs
  sections"`) is present in the DOM at every width -- base-shown, hidden
  only inside `src/routes/docs-site.css.ts`'s own phone media block
  (DEC-385 single-direction) -- matching the frame's own nav column, which
  the 390 companion frame draws no equivalent of (it substitutes the
  toolbar's `Contents` disclosure instead).
- The article's `<h1>`, eyebrow span, and standfirst `<p>` render, matching
  the frame's drawn structure (the frame's own H1 text, "Triaging
  submissions", is illustrative mockup prose -- no such slug exists in
  `DOCS_ARTICLES` -- so the STRUCTURE is graded, same convention the 390
  companion frame's verdict already uses).
- A heading block renders as `class="chq-docs-h2"`, matching the frame's H2
  block.
- The bottom-of-article pager (`class="chq-docs-pager"`) renders, matching
  the frame's own prev/next row.

## Frame :119 "Docs · the index"

**MATCHES.** Entered via `GET /docs` (no `?q=`).

- The header carries ONLY the `API reference ↗` leaving link, with NO
  compact search field -- matching the frame's header row exactly; the
  frame's search field for this page lives in the intro block instead.
- The intro block's `<h1>Chautauqua docs</h1>`, standfirst paragraph, and
  LARGE search field (`class="chq-docs-search chq-docs-search-large"`,
  placeholder "Search the docs…") all render, matching the frame's intro
  block.
- Grouped sections render (`class="chq-docs-group-label"` heads over
  `class="chq-docs-article-title"` rows), matching the frame's grouped
  grid structure. `DOCS_ARTICLES` is non-empty, so at least one such
  section renders for real content, not an empty-state placeholder.

## Frame :226 "Docs · the element library"

**UNREACHED.** No route in the app serves this frame. `docsSiteRoutes`
(`src/routes/docs-site.tsx`) registers exactly two `GET`s -- `/docs` and
`/docs/:slug` -- and no entry in `DOCS_ARTICLES` names or slugs an
"element library" article; the frame's content (nine block kinds: prose,
headings, list, aside, deflist, code, figure, where-next, pager) is
reflected in the type system instead, as `DocsBlock`'s own closed union
(`src/routes/docs-content/types.ts`), never rendered as a page of its own.
`test/frame-caption-ledger/exclusions/explainer.ts` independently treats
this frame's caption text as design-system reference vocabulary, not
product copy the app renders, for the same underlying reason. This frame is
recorded UNREACHED rather than rescued with a new mock stack or a guessed
route (task contract, DEC-613).

## Summary

| Frame | Verdict |
| --- | --- |
| Home :28 Event hub · desktop | MATCHES |
| Home :181 Between cycles · desktop | MATCHES (footer anchor verdicted against `src/routes/public/home.css.ts`'s own text) |
| Home :269 Fresh deploy · desktop | MATCHES |
| Docs :28 Docs · an article | MATCHES |
| Docs :119 Docs · the index | MATCHES |
| Docs :226 Docs · the element library | UNREACHED -- no route serves it |

5 of 6 frames MATCH as rendered; the sixth is UNREACHED, not a divergence --
it is design-system reference material the pack draws as a frame but the
app never turns into a page. No desktop byte was moved to produce this
verdict.
