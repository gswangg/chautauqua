# Content "Files · 390" (`Chautauqua Content.dc.html:338-368`) — first markup-level verdict (w29-b)

**Receipt**: `app/src/pages/content/FilesLibrary.frame390.render.test.tsx`
— mounts `<FilesLibrary>` directly (the harness
`FilesLibrary.render.test.tsx` already uses), stubbing `matchMedia` to
force the phone (`useIsPhone` → true) register the same way
`FilesLibrary.kind-vocabulary.render.test.tsx` already does. Every
`verbatimLine()` citation in that file reads the actual pack line and
asserts it byte-for-byte before the product is asserted against it
(DEC-967 shape).

## Pre-existing coverage note

Before this task, `app/src/pages/Content.frame-verdicts.render.test.tsx`
(task w13-ra, wave 157) already carried one `it()` for this same frame
(`'frame :338 Files library (phone) -- DIVERGES …'`), mounting through the
real `<ContentApp>` route. This task's brief was written against the
premise that the frame had **zero** markup instrument — that premise does
not hold; the frame had one, at the route level. This file adds a second,
narrower receipt (component-level, not route-level) with assertions the
existing one does not make (shared-parent H1/stat-line row, per-row
version/session/uploader/Download coverage over the row template, and a
scoped dock length assertion) rather than duplicating it. Flagging for the
scribe: `w13-ra`'s claim that Content was closing a "44 of 53 phone frames
never rendered" gap should be cross-checked before any ledger counts this
frame among the still-zero set again. Per DEC-099 wave-14m clause 1, this
paragraph's marker occurrence is a narration of the PRIOR (w13-ra) row's
own text quoted for context, not a new open finding — the verdict below
this section is the current one, and it is MATCHES.

## Verdict: MATCHES, with one frame-silent addition (row 7 fused, task w11-tb)

**Back control (:340)** — MATCHES. `‹ Content` renders as a real `<button>`
whose text ends `Content`.

**H1 + stat line (:341-342)** — MATCHES. Exactly one `<h1>` reading
`Files`; the `N files · SIZE` stat line shares the frame's own
`.chq-content-files-header-row` ancestor with the H1 (FilesLibrary.tsx's
own :180-182 comment: "H1 'Files', and the total/size stat ON this same
row (never a separate band below it)").

**Type tab strip (:344-346)** — MATCHES at the DOM-order and per-tab-shape
level. The leading chip renders first; its visible text is bare `All` at
this (390, phone-stubbed) register while its accessible name stays pinned
to `All types` at every width (DEC-833 shape, already recorded by
`FilesLibrary.kind-vocabulary.render.test.tsx`) — queried here by
`aria-label`, never by the shrunk visible text, and never asserted at both
registers in the same file. Every remaining chip matches `Label · N`.

**Row template (:351-356)** — MATCHES (fused, task w11-tb, DEC-825). The
frame draws one fused line, `{{ f.session }} · {{ f.size }}` (verbatim at
:354); content.css's terminal `@media (max-width: 700px)` block now places
the session `<td>` (nth-child(2)) and the size `<td>` (nth-child(4)) on the
SAME grid row of the file card (`.chq-content-files-library .chq-content
-table tr.chq-content-row`, `grid-row: 2` for both, one column each), with
the size cell's `::before { content: '· ' }` carrying the frame's separator
as punctuation, never a label source. This component remains a `<table>`
at every width, not the frame's stacked phone card list (the same
table-vs-card shape `Content.frame-verdicts.render.test.tsx` already
records for the worklist frame at :198, unaffected by this row). Name,
version marker (`v{n}`), uploader, and a `Download {filename}` link all
render per row, matching the frame's remaining four row fields. Receipt:
`app/src/pages/content/FilesLibrary.session-size-fuse.receipt.render.test.tsx`
(CSS source-scan over the terminal block + a render receipt over the real
`<FilesLibrary>` mount asserting session and size share one row).

**Pinned dock (:359-361)** — MATCHES structurally: exactly two controls,
DOM order `['Download all…', 'Search']`, scoped to `.chq-phone-dock`
(DEC-874 wave-29 scoped-length discipline). One frame-silent addition:
`Download all` at :359 draws bare, but the real control renders `Download
all N (.zip)` — the DEC-901 scoped-download-count contract also documented
in `FilesLibrary.tsx`'s own :412-426 comment block. The frame's own line
does not contradict this (no fixed literal is drawn over it), so per this
task's brief this is recorded as a frame-silent scoping addition, not a
divergence.

## Drawn-string coverage (10/10)

| # | Frame text/template | Line | Verdict |
|---|---|---|---|
| 1 | `‹ Content` | 340 | MATCHES |
| 2 | `Files` (H1) | 341 | MATCHES |
| 3 | `31 files · 412 MB` (stat line shape) | 342 | MATCHES |
| 4 | `All` (leading chip) | 344 | MATCHES (visible text; a\c\c-name pinned to "All types") |
| 5 | `Slides · 22` (chip shape) | 345 | MATCHES |
| 6 | `Video · 4` (chip shape) | 346 | MATCHES |
| 7 | `{{ f.name }}` / `{{ f.ver }}` / `{{ f.session }} · {{ f.size }}` / `{{ f.who }}` / `Download` (row template) | 351-356 | MATCHES (session·size fused onto one grid row, task w11-tb, DEC-825) |
| 8 | `Download all` | 360 | MATCHES + frame-silent `N (.zip)` suffix (DEC-901) |
| 9 | `Search` | 361 | MATCHES |
