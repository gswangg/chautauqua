# Content drill frames at 390 — instrumentation audit (w29-h)

MEASUREMENT ONLY: no product file changed by this lane. This records what
the two new markup instruments below found, for the planner to route.

- NEW `app/src/pages/content/ContentApp.selecting390.render.test.tsx` —
  instruments `docs/design/Chautauqua Content.dc.html:247-286`, "Content ·
  selecting" (390).
- NEW `app/src/pages/content/DeliverableDetail.frame390.render.test.tsx` —
  instruments `docs/design/Chautauqua Content.dc.html:373-429`, "Session ·
  deliverable" (390).

Both frames were, going into this wave, Content's two worst-instrumented
390 frames (11/13 and 17/19 drawn strings asserted by no markup instrument).
Both are now covered by a citing test file that mounts the real component
tree (`ContentApp` via its `/content` route for frame 1, `DeliverableDetail`
directly for frame 2, matching the existing `*-390.render.test.tsx`
mount idioms already in this directory) and issues real assertions against
the rendered DOM, not source-text `toContain` checks.

## FRAME 1 — "Content · selecting" (:247-286): CONFORMS

Every drawn literal this task named resolves to a real, correctly-scoped
DOM element once phone Select mode is engaged with rows ticked:

| Frame line(s) | Literal / template | Product finding |
| --- | --- | --- |
| :253 | `Content` (H1) | Present, `<h1>`, unconditional while selecting. |
| :255-257 | `N selected` / `All N` / `Done` | One `.chq-content-phone-selecting-meta` unit; mutually exclusive with the rest-state summary+Select toggle (DEC-825 wave-159, already locked by `ContentApp.worklist-390.render.test.tsx`). |
| :260-261 | `Needs a decision · N` / `Approved · N` | Chipstrip `role="tab"` labels, shape `/^Needs a decision · \d+$/` / `/^Approved · \d+$/`, unaffected by selecting. |
| :269-273 | row template (`check`/`status`/`title`/`speaker · file, when`) | One checkbox (`Select <title>`), one `.chq-flag` status span, the title text, and the speaker name, all scoped to the same `<tr>`. |
| :279 | `Approve 2` | Docked bar primary, scoped to `[data-chq-phone-dock] .chq-bulkbar`, shape `/^Approve \d+$/`, count 1. |
| :280 | consequence caption | One `.chq-bulkbar-note` element inside the same scoped dock. |

No DIVERGES row for this frame — the gap was purely a missing markup
instrument, not a product defect. content.css's own reflow of the merged
speaker/file line (order-based, DEC-825 wave-159) is out of this lane's
scope (owned by w29-b this wave) and already covered by
`ContentApp.worklist-390.render.test.tsx`'s CSS-shape assertions; this
lane's new file deliberately does not duplicate that CSS coverage.

## FRAME 2 — "Session · deliverable" (:373-429): ONE DIVERGES ROW

Six of the seven literals this task named match the frame exactly. One
does not:

| Frame line(s) | Literal / template | Product finding |
| --- | --- | --- |
| :375 | `‹ Content` | One back control, text ends `Content`. Matches. |
| :376/:377 | title + `speaker · ref` | One `<h1>` with the session title; `.chq-content-detail-subtitle` renders `Priya Raman · DFC-014` directly beneath it in the same `.chq-content-detail-title-col`. Matches. |
| :380 | `Content status` | Present as the band's label span. Matches. |
| **:381** | **`Re-uploaded · you asked for changes 8 days ago`** | **DIVERGES — see below.** |
| :383 | `Approve` | One control, scoped to `.chq-content-status-band-actions`, count 1 (DEC-874: the desktop action row alongside it, `.chq-content-detail-actions`, carries no Approve of its own). Matches. |
| :386/:387 | `Slides · 3 versions` / `Recording · 1 version` | Deliverable chip strip, `role="tab"`, shape `/ · \d+ versions?$/`, one entry per kind. Matches. |
| :389 | scoping caption | One `.chq-content-chip-caption` element. Matches. |

### DIVERGES — :381 status-line copy

- **Frame** (`docs/design/Chautauqua Content.dc.html:381`): `Re-uploaded ·
  you asked for changes 8 days ago` — names the re-upload, then explains
  *why* the session is back for review (an organizer-authored "you asked
  for changes" framing) with an age in days.
- **Product** (`DeliverableDetail.tsx`'s `.chq-content-status-band-copy`,
  composed from `worklist.ts`'s `worklistStatusLabel` +
  `` ` · Updated ${formatDate(...)}` ``): renders `Re-uploaded · Updated
  <date>` — same underlying fact (a re-upload happened, and when the status
  last changed), different vocabulary: a plain "Updated" timestamp instead
  of the frame's "you asked for changes N days ago" narrative clause, and a
  formatted date instead of a relative day count.
- **Why this wasn't fixed here**: this lane is MEASUREMENT ONLY — "record
  findings, change no product file" is explicit in the brief, and
  `DeliverableDetail.tsx` is a product file outside this lane's OWNS list
  (new test files + this doc only). The new render test
  (`DeliverableDetail.frame390.render.test.tsx`) asserts the REAL rendered
  shape (`/^Re-uploaded · Updated /`), not the frame's literal, so it is
  green against the current tree and will fail loudly the next time either
  side of this drifts further apart.
- **Suggested resolution shape for whichever lane picks this up**: either
  (a) compose the band's value line from a relative-days clause sourced
  from `headerDetail.updatedAt` (the same field `formatDate` already reads)
  instead of the absolute date, matching the frame's "N days ago" register,
  or (b) treat this as a deliberate vocabulary divergence (absolute date
  reads more honestly across long gaps than a rolling day count that ages
  poorly) and land it in `docs/design/DEVIATIONS.md` instead. This audit
  takes no position on which — that's a design decision, not a worker's to
  make (per this campaign's own narrowest-interpretation instruction).

## Citation integrity

Every design-file line cited by either new test file is
`verbatimLine()`'d byte-for-byte against `docs/design/Chautauqua
Content.dc.html` (DEC-967 shape) — a stale `:line` reference in either
test fails loudly rather than rotting silently.
