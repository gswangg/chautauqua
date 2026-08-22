# Docs desktop verdict — "Docs · the element library" (v12m-w26-i)

MEASUREMENT ONLY (DEC-651 wave-26 amendment): this document and its
companion test, `test/docs-library-desktop-frame-verdicts.test.ts`, fix
nothing. No route module and no `.css.ts` were touched to produce it.

This is **1 of Docs' 3 desktop frames**. The other two —
`Chautauqua Docs.dc.html:28` ("Docs · an article") and `:119` ("Docs · the
index") — are owned by task v12m-w24-g's ledger, not this one. This file
covers only the third: `docs/design/Chautauqua Docs.dc.html:226` [226–453],
"Docs · the element library", subtitled "Nothing outside this set may
appear in an article".

## What the frame draws

A docs-site shell (same header chrome as the other two Docs frames) around
a full-width reference card: H1 "The element library", the standfirst
"Nine blocks. An article is a sequence of these and nothing else — a new
kind of block is a change to this page first, not a one-off inside one
article," and nine numbered, bordered sections, each showing one block kind
with live sample content:

| # | Section label (verbatim) | DC line |
|---|---|---|
| 01 | Prose | :249 |
| 02 | Headings | :257 |
| 03 | Steps and lists | :267 |
| 04 | The aside · one weight only | :282 |
| 05 | Figure · breaks the measure to 900 | :297 |
| 06 | Definition table | :307 |
| 07 | Code and paths | :319 |
| 08 | Where next | :328 |
| 09 | Prev / next pager | :341 |

## Verdict 1 — the block-kind population: MATCHES (with a naming split worth recording)

`src/routes/docs-content/types.ts`'s `DocsBlock` union (DEC-650 wave-4
amendment, "the drawn element library … is a CLOSED set of nine block
kinds") declares 7 `kind` tags — `heading`, `prose`, `list`, `figure`,
`aside`, `deflist`, `code` — and `src/routes/docs-site.tsx`'s
`DocsBlockView` switches on exactly those 7, with no default arm
(`src/routes/docs-content/search.ts`'s own comment notes the same
exhaustiveness). Those 7 map one-to-one onto the frame's sections 01–07
(Prose→prose, Headings→heading (level 2/3), Steps and lists→list
(ordered/unordered), The aside→aside (two weights), Figure→figure,
Definition table→deflist, Code and paths→code). No block kind the frame
draws lacks a renderer case, and no renderer case lacks a frame section.

The frame's remaining two sections, 08 "Where next" and 09 "Prev / next
pager", are **not** members of `DocsBlock` — they are not something an
article author picks per-block. They are structural furniture the renderer
appends to *every* article automatically: `DocsWhereNext` (driven by
`WHERE_NEXT_BY_SLUG`) and `DocsPager` (driven by `docsArticleNeighbours`),
both called unconditionally at the end of `DocsArticlePage`'s `<main>`.
Functionally nothing is missing — both render on every real article page —
but the frame's own count ("Nine blocks… nothing else") folds two
structural elements into the same enumeration as the seven author-chosen
block kinds. `test/docs-library-desktop-frame-verdicts.test.ts`'s
population `it()` dispatches two real requests
(`/docs/running-the-software`, which alone exercises prose, heading (H2),
code, figure, deflist and aside; `/docs/start-here` for list) and asserts
all nine sections' markup classes are present — 08/09 asserted off the
same `running-the-software` response, since they render on every article
unconditionally.

One observational gap, not a divergence: no shipped `DOCS_ARTICLES` entry
currently sets `ordered: true` or `level: 3` (grep across
`src/routes/docs-content/*.ts`, excluding tests, returns zero hits for
either). The renderer *cases* for the ordered list and the H3 heading both
exist in `DocsBlockView` — they are simply unused by today's content. This
does not affect the block-KIND population verdict above (the question this
frame poses), only content coverage, which is out of this frame's scope.

## Verdict 2 — the header row: MATCHES, except one glyph-order DIVERGES

The frame's header (:230–239, drawn identically to the other two Docs
frames) is wordmark "chautauqua" + "Docs" suffix in one baseline run, a
search box, then the "API reference ↗" anchor. The shipped `DocsHeader`
(`src/routes/docs-site.tsx`) renders the same four elements in the same
left-to-right order (wordmark → suffix → compact search form → leaving
link) — confirmed against a real `/docs/running-the-software` request in
the `it()` titled "the header row otherwise matches".

One divergence: the frame's anchor text order is label-then-mark ("API
reference ↗", `:238`). The shipped `DocsHeader` renders the `aria-hidden`
mark span **before** `DOCS_API_LEAVING_LINK.label`
(`<span aria-hidden="true" class="chq-docs-leaving-mark">&#8599;</span>{label}`),
i.e. mark-then-label ("↗ API reference"). This is DEC-382's existing
"labelled leaving link" contract (the label still names the destination,
the mark is `aria-hidden`) — only the *glyph position* is reversed from the
frame. `test/docs-library-desktop-frame-verdicts.test.ts`'s glyph-order
`it()` receipts both the frame's `:238` line and the rendered anchor's
actual child order. No route/`.css.ts` change was made to fix this
(measurement-only scope) — recommend a DEVIATIONS entry or a design-lens
ruling on whether the mark leads or trails; not decided here.

## Verdict 3 — the page itself: RETIRED (wave-8, DEC-976) — no live route serves this frame, and none should be built

`src/index.ts` mounts exactly `docsRoutes` (`/docs/api`, unrelated
TOOLS_CSS chrome, DEC-382) and `docsSiteRoutes`
(`src/routes/docs-site.tsx`), which registers exactly two routes: `GET
/docs` (the index) and `GET /docs/:slug` (an article, 404 via
`publicNotFound` when the slug does not match a `DOCS_ARTICLES` entry).
There is no `/docs/elements`, `/docs/element-library`, or any other route
that serves this frame's nine-section reference body. `GET /docs` itself
renders the group/article index, not this content. Every plausible slug
for this page (`elements-library`, `element-library`, `elements`,
`the-element-library`) 404s through the ordinary not-found card —
confirmed with real dispatched requests in
`test/docs-library-desktop-frame-verdicts.test.ts`.

This reads as intentional, not a gap: the frame's own subtitle — "Nothing
outside this set may appear in an article" — and its content (a style
guide showing each block kind's typography rules, not real product prose)
mark it as the **pack's internal reference page for article authors**,
analogous to a design system's component-catalogue page. It documents the
vocabulary `DocsBlock` implements; it was never meant to be requested by an
end user. Per the task brief's explicit instruction, no route was built to
serve it (desktop freeze / measurement-only scope).

**RULED (wave-8, DEC-976), superseding this verdict's prior
"Recommendation" (that a DEVIATIONS entry be filed) — building a route to
serve this frame is not scheduled and never will be.**
This frame is the pack's own internal style-guide page for article
authors, not a screen end users reach: its subtitle ("Nothing outside this
set may appear in an article") and its content (typography rules per block
kind, not real product prose) name it as documentation-about-the-product,
analogous to a design system's own component-catalogue page. The mandate's
desktop freeze forbids inventing surface to match a drawing — building
`/docs/elements` (or any route) so this reference page can be requested
would be exactly that: manufacturing a live route whose sole purpose is
letting a documentation frame MATCH, not serving any capability an author
or reader needs. The nine-block vocabulary it documents is independently
verified BUILT and correct (Verdict 1 above, 7-for-7 plus the two
always-on structural sections) — the frame's *content* is fully honoured
by the renderer; only the frame's *own existence as a requestable page* is
not, and should not be.

Retired disposition, replacing the original recommendation to file this as
an open DEVIATIONS entry: the row is settled here instead, with its own
receipt (this Verdict 3, `test/docs-library-desktop-frame-verdicts.test.ts`
's route-absence assertions), so DEC-032's "a deviation-deferred frame is
UN-CITABLE" guard is satisfied without waiting on the separately-owned
DEVIATIONS.md file (out of this file's forbidden-files list, but owned by
another in-flight lane this wave — this document's own Verdict 3 stands as
the citable ruling in the interim).

## Summary

| Verdict | Result |
|---|---|
| 1. Block-kind population (renderer vs. frame's 01–07) | MATCHES — 7-for-7, plus 08/09 as always-on structural furniture rather than authored block kinds (naming note, not a defect) |
| 2. Header row (wordmark/suffix/search/leaving link) | MATCHES, except the leaving-link glyph is mark-then-label in product vs. label-then-mark in the frame (DIVERGES) |
| 3. The page as a whole | RETIRED (wave-8, DEC-976) — no live route serves this frame; RULED as a captioned pack-internal reference page, a route is never built for it (desktop freeze forbids inventing surface to match a drawing) |
