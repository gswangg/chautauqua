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

### CLOSED-with-receipt — :381 status-line copy (DEC-874 wave-8, task w8-g)

- **Frame** (`docs/design/Chautauqua Content.dc.html:124` desktop status
  band and `:381` the 390 drill — the SAME sentence at both widths, so this
  was always a desktop-frame-demanded change, not a phone-only one):
  `Re-uploaded · you asked for changes 8 days ago` — names the re-upload,
  then explains *why* the session is back for review (an organizer-authored
  "you asked for changes" framing) with an age in days.
- **Ruling**: `DeliverableDetail.tsx`'s `.chq-content-status-band-copy` now
  composes the value line as `<statusLabel> · you asked for changes <age>`
  when the row's status "needs you" for a change-request reason — either
  the pill itself reads `changes_requested`, or the pill is back to
  `pending` but the header's own `reuploaded` flag is true (the speaker
  already addressed a prior change request; `worklistStatusEmphasisClass`
  draws this identical "Changes requested"/"Re-uploaded" boundary
  elsewhere) — and `<statusLabel> · Updated <age>` otherwise (`Approved`,
  plain `Not reviewed`). `<age>` is `formatRelativeDays(headerDetail.
  updatedAt, Date.now())` (`app/src/lib/dates.ts`) at BOTH widths — the ONE
  relative-time reader already in the SPA, not a new second copy of the
  same vocabulary (DEC-613). A literal `pill === 'changes_requested'`
  condition alone would have left this very frame's own worked example (a
  `Re-uploaded` row) unfixed, since a re-uploaded row's pill has already
  moved back to `pending` by the time the speaker's new version lands.
- **Receipt**: `DeliverableDetail.frame390.render.test.tsx`'s `:380/:381`
  block now asserts the exact composed sentence (`Re-uploaded · you asked
  for changes <N> days ago`, with the fixture's `updatedAt` pinned 8 real
  days before render time to match the frame's own worked example
  byte-for-byte in substance), plus two new sibling cases: the
  `changes_requested` pill (same cause clause) and the plain `pending`/
  `Not reviewed` case (neutral "Updated" clause, no cause). The desktop
  companion (`DeliverableDetail.render.test.tsx`) converts every
  `formatDate(...)`-keyed status-band assertion to `formatRelativeDays(...)`
  and updates the reuploaded-flag case to expect the cause clause, so
  desktop and phone read the identical relative-day, cause-aware sentence.

## Citation integrity

Every design-file line cited by either new test file is
`verbatimLine()`'d byte-for-byte against `docs/design/Chautauqua
Content.dc.html` (DEC-967 shape) — a stale `:line` reference in either
test fails loudly rather than rotting silently.
