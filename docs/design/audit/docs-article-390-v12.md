# Docs · an article · 390 — verdict, task w30-b

Frame: `docs/design/Chautauqua Docs.dc.html:166` ("Docs · an article"),
extent 166 to EOF (the last frame in the file). Measured before this task
at 11/18 drawn literals asserted anywhere in the suite — the
worst-instrumented frame in the Docs cluster. This task adds
`test/docs-article-390-frame-verdicts.test.ts`, a real SSR-request grading
of the frame's anatomy (DEC-976 wave-30 amendment: grade the frame's DRAWN
COPY from its own extent, a citation count is not a coverage measure).

## Anatomy verdict

Every element the frame draws in order — `‹ Docs` back control, `Contents`
control, the group label, article title, lede paragraph, body prose, a
figure with caption, an ordered how-to section, and the pager — has a
rendering path in `src/routes/docs-site.tsx`. Grading below is per DEC-976:
the article's own words (title, standfirst, prose, list items, figcaption)
are content owned by `src/routes/docs-content/*.ts` and graded by SHAPE,
never by the frame's sample literal (the frame's article is "Triaging
submissions", which `src/routes/docs-content` does not ship — see
`test/frame-caption-ledger/exclusions/exemplar-article.ts`, which already
excludes that sample article's lines, including this frame's own
screenshot-placeholder line, from the citation ledger for exactly this
reason). Two things ARE graded as literals, per this task's brief:

## 1. Figure phone affordance — genuine gap, fixed

`docs/design/Chautauqua Docs.dc.html:185` draws `screenshot · 390 · tap to
zoom` inside the figure's placeholder box. Before this task, no equivalent
affordance existed anywhere in `src/` or `app/src/` under any name (grepped
clean) — the existing not-yet-captured placeholder
(`src/routes/docs-site.tsx`, `DocsBlockView`'s figure branch) rendered only
`screenshot · {block.shotId}`, a desktop-oriented route/id label with no
width marker and no interaction hint, unconditionally at every viewport.

**Why this is a genuine gap, not adjudicated sample content**: the
exemplar-article.ts exclusion for this exact literal (line 185) reasons
that it is "the pack's sample article ... none with this slug or IA, so no
screen owes these words" — that adjudication is about the citation
LEDGER's literal-match scan (whether this string must appear verbatim
somewhere in product source to satisfy that ledger), not about whether the
underlying UI PATTERN it describes (a phone screenshot naming its own
width and a tap-to-zoom affordance, as distinct from desktop's
route+dimensions label) should exist. Unlike the desktop placeholder text
(route + resolution, which varies per screenshot and is legitimately
per-article content), "390 · tap to zoom" names the viewport and a generic
interaction, not this article's copy — it belongs with the pager as
chrome the frame docks once, not prose.

**What shipped**: `src/routes/docs-site.tsx`'s not-yet-captured figure
branch now renders a second span, `chq-docs-figure-phone-affordance`,
carrying the frame's literal text. It ships with the native `hidden`
attribute rather than a CSS-declared base rule, because this task's
`src/routes/docs-site.css.ts` edit is scoped to the terminal
`@media (max-width: 700px)` block only (DEC-385 wave-30 amendment: another
lane may own the rest of the file this wave) — `hidden` supplies the
default-off state with zero bytes outside that block, and the terminal
block's `display: block` on the new class overrides the `[hidden]` UA
default on cascade ORIGIN (author beats user-agent), never `!important`
(DEC-409). The pre-existing desktop-oriented `chq-docs-figure-placeholder`
span is hidden at phone width by the same terminal block, additively —
no desktop byte changed.

**Reachability note**: every one of the 20 real figures across
`src/routes/docs-content/*.ts` already has a captured shot in
`DOCS_SHOTS_AVAILABLE`, so the not-yet-captured branch (and this new
affordance) is not reachable through any live `DOCS_ARTICLES` request
today — it is the generated fallback for a fresh checkout or an emptied
shot list. The new test reaches it by mocking
`../src/routes/docs-content/shots-available` to `[]` for one `it()`,
exercising the real `docsSiteRoutes` request handler and the real render
branch; only the generated availability constant is substituted.

## 2. Pager — DEVIATIONS-governed, asserted as the deviation's shape

`docs/design/Chautauqua Docs.dc.html:201-202` draw `‹ Previous` / `Next ›`.
`DEVIATIONS.md` (~lines 277-283) already rules that `DocsPager` renders
`{prev.title}` / `{next.title}` instead, and that the geometry (not the
copy) is what binds. The new test asserts the DEVIATION's actual shape
(`‹ {title}` / `{title} ›`) and says so inline, so it never goes red
against a recorded, deliberate divergence.

## 3. Ordered how-to section — filed, not fixed

The frame's :192-196 `<ol>` ("Working through the queue": Filter to
**Needs triage** / Open the oldest / Decide, then use **Next ›**) is a
SAMPLE numbered how-to belonging to the same non-shipped "Triaging
submissions" article as the figure caption above. `DocsBlockView` already
has a correctly-shaped `ordered` render branch (`<ol class="chq-docs-list">`
vs `<ul class="chq-docs-list">`), but grepping every file under
`src/routes/docs-content/*.ts` (excluding `types.ts`) turns up zero
`ordered: true` list blocks — no shipped article can ever reach that
branch through a live request today. This is content (`docs-content/*.ts`
is out of this task's FILES-I-OWN scope, and is not a stylesheet or route
this task's brief authorizes touching), so it is filed here rather than
fixed: the new test grades the render branch's SHAPE via a source-scan
(confirms the `<ol class="chq-docs-list">` token exists in the same
`block.ordered` branch already shipping `<ul class="chq-docs-list">`) and
separately documents, with a passing assertion, that no article
instantiates it yet.

## Everything else on the frame

Back control, Contents control, group label/eyebrow, title, lede, body
prose, and figure+figcaption were already correctly shaped in
`src/routes/docs-site.tsx` before this task (confirmed by the new test's
live-request coverage against a real fixture article,
"Call for papers and submissions" / group "running-an-event", whose group
label happens to equal the frame's own "Running an event" literal by
coincidence of content, not by this test pinning it as a literal). No
DIVERGES rows are filed for those elements.
