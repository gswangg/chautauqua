# Content v12 phone conformance — audit findings

Findings surfaced while implementing w1-e (TIER 0, DEC-825 amendment: phone
Select mode). Filed here per SCOPE LIMIT rather than fixed in-place, since
the fix belongs to a different lane's files.

## Select mode should suppress `.chq-tabbar`

**Frame**: docs/design/Chautauqua Content.dc.html:278 `border-top:1px solid
#1B1D17; background:#EFEBDF; padding:12px 16px 16px` — the "selecting"
390 frame's footer is a single docked `Approve N` band; the tab bar the
"rest" frame's footer draws (:229) is gone entirely in the "selecting"
frame, replaced rather than stacked.

**Current implementation (this task)**: `app/src/pages/content/content.css`
renders the dock as a page-owned `position: sticky; bottom: 0` band inside
`.chq-main` (the app's own scrolling region), which visually docks it
*above* `.chq-tabbar` since the tab bar is a sibling flex-shrink:0 region
outside `.chq-main`'s scroll box (DEC-989) — so nothing overlaps and no
shell file is touched. But `.chq-tabbar` itself is never hidden: entering
Select mode on phone leaves the tab bar mounted and visible underneath the
dock's own space, at the very bottom of the viewport, which the frame does
not draw. The frame's footer is ONE region (the dock, full stop), not two
stacked bands.

**Why not fixed here**: `.chq-tabbar` is shell chrome, not `app/src/pages/
content/**` — this task's file scope is Content only, and the task text
names this exact deferral: "file 'select mode should suppress .chq-tabbar'
as a finding for the shell lane."

**Suggested fix (shell lane)**: shell geometry needs some signal (a route
param, a data attribute on `.chq-main`/`.chq-page`, or a shared context)
that a page's own phone Select mode is active, and a rule hiding
`.chq-tabbar` under `@media (max-width: 700px)` when that signal is set —
mirroring how other page-owned docked bars (if any) already suppress it, or
establishing that pattern if none do yet.

**Update (w13-ra, wave 157)**: this finding now reads STALE against the
current tree — `ContentApp.tsx` sets `data-chq-phone-dock` while
`phoneSelectMode` is on, and `FilesLibrary.tsx` sets the same attribute
whenever its own dock is mounted, both wired to a `.chq-main:has([data-chq-
phone-dock]) ~ .chq-tabbar` suppression rule the ContentApp.tsx comment
cites in `styles.css`. Not re-verified by this task (out of file scope —
`app/src/styles.css`/`app/src/App.tsx` are this task's forbidden files), so
left as a marginal note rather than struck, but the shell-lane deferral
above appears to have already landed.

<!-- w13-ra (DEC-976 wave 157) -->

## task-w13-ra: per-frame verdict, all four width:390px Content frames — closing the phoneA "44 of 53 phone frames never rendered" gap for this cluster

Content is recorded as `DONE` in `docs/mobile-campaign.md` on the strength
of an earlier probe; before this task, NONE of Content's four
`width:390px` frames (`docs/design/Chautauqua Content.dc.html` :198 "Content",
:247 "Content · selecting", :338 "Files · 390", :373 "Session · deliverable")
had ever been rendered against the tree through the app's real route. This
task renders all four, entered through `ContentApp`'s real route
(`<MemoryRouter initialEntries={['/content...']}><Routes>…<ContentApp/>
…</Routes></MemoryRouter>`, matching `ContentApp.render.test.tsx`'s own
`renderContentApp` helper — never a sub-component mounted directly), and
records a verdict per frame below. Render receipts:
`app/src/pages/Content.frame-verdicts.render.test.tsx` (4 passing tests,
one per frame, each opening with a DEC-967 `verbatimLine` citation of the
frame's own caption line).

**All four frames diverge.** None of the four divergences found is a
phone-CSS/markup-ORDER fix (DEC-385) — every one is either a genuine
content/control gap (a combined status+title+meta card collapsed into
table cells; a header summary line that never yields the stage to the
"selecting" meta row; a chip-strip/copy vocabulary mismatch; a two-column
detail body where the frame draws one linear stack) or a wording/format
difference (bytes always carrying one decimal place; "Recording" for the
domain kind the frame calls "Video"). None was fixed here (out of scope —
this task measures, it does not touch `app/src/pages/content/**.css` or
`ContentApp.tsx`); each is flagged for whichever lane owns that surface.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `:198` Content (worklist) | **CLOSED** (task w25-h, re-verified against tree) | See "Update (wave 25, task w25-h)" below. |
| `:247` Content · selecting | **CLOSED** (task w25-h, re-verified against tree) | See "Update (wave 25, task w25-h)" below. |
| `:338` Files · 390 | **CLOSED** (task w25-h, re-verified against tree) | See "Update (wave 25, task w25-h)" below. |
| `:373` Session · deliverable | **CLOSED** (task w25-h, re-verified against tree) | See "Update (wave 25, task w25-h)" below. |

**Nothing in this list is a phone-block-CSS or markup-order fix.** Every
row is a genuine architectural/content gap (a table-row worklist vs. a
card grammar, a two-column detail body vs. a single stack, an unguarded
summary-line clause, a vocabulary mismatch) each requiring new markup or a
conditional this task's SCOPE LIMIT (measure, don't fix) puts out of
bounds — flagged here per the task's design-gap instruction, consistent
with the disposition every prior per-frame-verdict lane in this campaign
(Settings, `settings-v12.md`) already used for the same family of finding.

**Update (w17-c, DEC-825): all four rows retired.** Re-derived each
against the current tree before writing a disposition — a verdict row
rots faster than the code it describes (field guide).

- `:198` Content (worklist) — **RESOLVED.** The checkbox-first-cell gap
  ("no selection control anywhere" vs. an always-visible tick) and the
  status-before-title ordering gap were already closed by an earlier wave
  (`.chq-content-worklist .chq-content-table tr.chq-content-row >
  td:nth-child(1)` carries a rest-state `display: none`, and the status
  cell's `order` sorts ahead of the title cell's in content.css's terminal
  `@media (max-width: 700px)` block). The one gap that survived —
  Speaker / Latest file / Status as three separate cells rather than the
  frame's one combined meta line — is closed by this task: `docs/design/
  Chautauqua Content.dc.html:220` draws `{{ row.speaker }} · {{ row.file
  }}, {{ row.when }}` as ONE line, and content.css's row now lays out with
  a wrapping flex line-box (`display: flex; flex-wrap: wrap`) so speaker
  and latest-file share a line via `order` instead of a fixed two-column
  grid split. Receipt: `app/src/pages/content/ContentApp.download-all-
  flex.receipt.render.test.tsx`.

- `:247` Content · selecting — **RESOLVED (already fixed, retired here).**
  `app/src/pages/content/ContentApp.tsx`'s idle summary-line clause now
  carries an explicit `!phoneSelectMode` guard — `{!submissionId && view
  === 'worklist' && !phoneSelectMode && counts.needs_decision !== null &&
  ...}` — so the
  summary line and the "N selected / All N / Done" meta row are mutually
  exclusive, exactly the guard this row's divergence said was missing
  (w15-ta, DEC-825 wave-159). Pinned by `app/src/pages/content/
  ContentApp.worklist-390.render.test.tsx`'s "rest summary vs selecting
  meta row are exclusive" describe block, which exercises both states
  through `ContentApp`'s real `/content` route. Not re-measured for the
  glyph/footer-placement sub-clauses this row also raised (out of this
  task's remit — content.css + this ledger only); those stay open only if
  a future probe reproduces them against the current tree.

- `:338` Files · 390 — **RESOLVED.** Three of this row's four clauses were
  already closed by earlier waves: the chip-strip vocabulary now reads
  "All" at 390 / "All types" at desktop (`app/src/pages/content/
  FilesLibrary.tsx` renders `{isPhone ? 'All' : 'All types'}`) matching
  `docs/design/Chautauqua Content.dc.html:344`'s `<span
  style="flex-shrink:0; background:#1B1D17; color:#F4F1E8;
  border-radius:99px; min-height:44px; display:flex; align-items:center;
  padding:0 14px; font-size:13px; font-weight:600">All</span>` at the
  phone width this row is about; and the "Video"/"Recording" split
  is now per-surface (`app/src/pages/content/types.ts`'s
  `LIBRARY_KIND_LABELS` declares `recording: 'Video'` in its own right,
  DEC-613 wave-159 amendment). The byte-format clause ("412.0 MB" vs. the
  frame's bare "412 MB") is NOT fixed by this task or by any lane yet —
  DEC-613's wave-17 amendment RULES `formatBytes` to trim a trailing `.0`,
  but a ruling is not a receipt of build (field guide); cited here as
  **DEC-613** (see `src/decisions-data/DEC-613.md`'s wave-17 amendment),
  never by a line number, since the fix has not landed. This task closes
  the fourth and final clause — the header's duplicate "Download …(.zip)"
  control: `docs/design/Chautauqua Content.dc.html:342` draws the header
  row as `<span style="font-size:13px; color:#565A4B">31 files · 412
  MB</span>` with no download control beside it, reserving "Download all"
  for the sticky footer dock alone — `docs/design/Chautauqua
  Content.dc.html:360` draws `<span style="flex:1; background:#4E5C31;
  color:#F7F9F0; border-radius:6px; min-height:48px; display:flex;
  align-items:center; justify-content:center; font-size:14px;
  font-weight:700">Download all</span>`. content.css's terminal
  block now hides `.chq-content-files-download-all-wrap` wholesale at 390
  (RE-LINED, not removed — the identical control is live in
  `.chq-phone-dock`'s primary `chq-btn-primary` "Download all" button).
  Receipt: `app/src/pages/content/ContentApp.download-all-flex.receipt
  .render.test.tsx`.

- `:373` Session · deliverable — **RESOLVED (already fixed, retired
  here).** `app/src/pages/content/DeliverableDetail.stack-390.render
  .test.tsx` (w15-tc, DEC-989 wave-159) pins content.css's terminal
  `@media (max-width: 700px)` block flattening `.chq-content-group-body`
  into one ordered flex column (`display: flex; flex-direction: column`)
  and hoisting both DOM columns plus `CommentThread` with `display:
  contents`, reordering the frame's five body pieces (version rows, notes
  label, comment rows, upload link, note textbox) via `order` while
  leaving the desktop two-column DOM untouched (DEC-385). Verified green
  on this branch before retiring the row.

<!-- w21-k (DEC-901/DEC-967) -->

## Update (wave 21, task w21-k): re-verified against the current tree; all four rows RESOLVED or STALE

Field guide: "a scribe amendment/ledger row is a claim about the tree, not
a receipt" — this task re-derived all four rows against the tree at HEAD
before writing anything below, rather than inheriting the w17-c prose
above (which itself already carried a citation-only claim for `:338`'s
byte-format clause that no longer holds).

- **`:373` Session · deliverable — RESOLVED, confirmed.** The w17-c row
  above already retired this; this task ADDS a second, more direct
  receipt: `app/src/pages/content/content-phone-frames.test.ts`'s
  `"Session · deliverable"` describe block now carries an explicit
  order-contract test reading every `order:` content.css's terminal phone
  block declares for the promoted grandchildren (`.chq-content
  -deliverables-label` → `.chq-chipstrip` → `.chq-content-chip-caption` →
  `.chq-content-version-list` → `.chq-content-notes-label` →
  `.chq-content-comment-list` → `.chq-content-upload-reopened-notice` →
  `.chq-content-upload-zone` → `.chq-comment-composer`), plus a DEC-967
  `verbatimLine` citation of `docs/design/Chautauqua
  Content.dc.html:417`'s dashed "Upload a file for the speaker" link. The
  render-level receipt (`Content.frame-verdicts.render.test.tsx`'s `:373`
  block) is converted from DIVERGES to RESOLVED — jsdom applies no `@media`
  so it still finds the frozen two-column DOM (`.chq-content-files-col` /
  `.chq-content-comments-col`, DEC-385: never forked), which is correct,
  not a divergence; the visual stack order is the CSS-level test's claim
  to verify, not this file's.

- **`:198` Content (worklist) — STALE, retiring the citation.** The w17-c
  row's own receipt already covers the fix; re-verified here:
  `content.css`'s terminal `@media (max-width: 700px)` block makes
  `tr.chq-content-row` a wrapping flex card
  (`.chq-content-worklist .chq-content-table tr.chq-content-row { display:
  flex; flex-wrap: wrap; ... }`) with the status cell (`td:nth-child(5)`)
  at `order: 2` ahead of the title cell (`td:nth-child(2)`) at `order: 3`,
  and the action pair (`td:nth-child(6)`) full-measure at `order: 6` —
  status-before-title and the combined speaker/file meta line both draw
  exactly as the frame's card does. No open clause remains against this
  row.

- **`:247` Content · selecting — STALE, retiring the citation.** Re-checked
  `app/src/pages/content/ContentApp.tsx`: the `!phoneSelectMode` guard the
  w17-c row already credited is present TWICE, on both clauses the
  original divergence named —
  `{!submissionId && view === 'worklist' && !phoneSelectMode &&
  counts.needs_decision !== null && reUploadedCount !== null && (` (the
  idle summary line) and `{!submissionId && view === 'worklist' &&
  !phoneSelectMode && (` (the rest-state row) — so the idle summary and
  the "N selected / All N / Done" meta row stay mutually exclusive exactly
  as the frame draws. No open clause remains against this row.

- **`:338` Files · 390 — STALE, retiring the citation.** Re-checked all
  three sub-clauses this row and its w17-c update still carried:
  - Chip vocabulary: `app/src/pages/content/FilesLibrary.tsx` renders
    `isPhone ? 'All' : 'All types'` for the leading chip's VISIBLE text,
    but that chip's accessible name is a static `aria-label="All types"`
    at every width — the frame's own "All" was never actually unreachable
    by name, only the longer text was cosmetic. The Recording/Video split
    is a per-surface register, not a per-width one: `app/src/pages/content
    /types.ts`'s `LIBRARY_KIND_LABELS` (DEC-613 wave-159 amendment) gives
    `recording: 'Video'` for the files library specifically, while
    `DELIVERABLE_LABELS` keeps `recording: 'Recording'` for the session
    deliverable strip elsewhere — so the files library's own kind chip now
    reads "Video · 4" at every width, matching the frame.
  - Byte format: the w17-c update above says this clause is "NOT fixed by
    this task or by any lane yet," citing only DEC-613's ruling, not a
    receipt of build. That is now stale — `FilesLibrary.tsx`'s own DEC-613
    wave-17-amendment comment records that `formatBytes` trims a trailing
    ".0", and `src/domain/files.ts`'s `formatBytes` confirms it in code
    (`Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)`),
    so an integral byte count like 412 MB renders bare, exactly as the
    frame draws it.
  - Header duplicate download control: **RESOLVED** (wave 27, task w27-c;
    DEC-976, the pin moves with the fix) — `app/src/pages/content
    /content.css`'s phone block now gives `.chq-content-files-download-all-
    wrap` (the header's own "Download … (.zip)" wrap: button, cap message,
    and scope message alike) the rule `{ align-items: stretch; display:
    none; }`, and that same rule's own comment records the re-lining: the
    identical `handleDownloadAll` capability is reachable at 390 via
    `.chq-phone-dock`'s primary `chq-btn-primary` "Download all" button
    (`FilesLibrary.tsx`'s terminal `.chq-phone-dock` block), which the
    frame itself reserves the dock for. Nothing the user could do at
    desktop is unreachable at 390 — only the affordance's position moves,
    from the header to the dock. This clause is no longer real.

  Receipt for the vocabulary fixes:
  `app/src/pages/Content.frame-verdicts.render.test.tsx`'s `:338` block,
  updated this task to assert the current (correct) chip vocabulary
  instead of the stale "Recording"/full-"All types"-text pin it used to
  carry (DEC-976: the pin moves with the fix). The row is now
  **RESOLVED** in full: the two vocabulary clauses that motivated the
  original citation are retired, and the header-duplicate-control clause
  is retired above.

<!-- w25-h (DEC-976 wave-25) -->

## Update (wave 25, task w25-h): all four rows CLOSED, each re-verified against the tree before writing

Per the field guide ("a ledger row is a claim about the tree, not a
receipt") and the planner's own note that the three spot-checked rows
below read STALE, this task re-derived every one of the four table rows
above against `HEAD` on this branch itself before converting a single
Verdict cell — none of the four claims below is inherited from the w17-c
or wave-21 prose earlier in this file, though all four independently
confirm it.

- **`:198` Content (worklist) — CLOSED.** `app/src/pages/content/
  content.css`'s terminal `@media (max-width: 700px)` block makes
  `.chq-content-worklist .chq-content-table tr.chq-content-row` a wrapping
  flex card, quoted verbatim:

  ```
  .chq-content-worklist .chq-content-table tr.chq-content-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 9px;
    row-gap: 9px;
  }
  ```

  with the per-cell `order` sequence status (`td:nth-child(5)`, `order: 2`)
  ahead of the session title (`td:nth-child(2)`, `order: 3`), and speaker
  (`td:nth-child(3)`, `order: 4`) sharing one flex line with latest-file
  (`td:nth-child(4)`, `order: 5`) via a `::before { content: '·'; }`
  separator — the frame's own `{{ row.speaker }} · {{ row.file }}, {{
  row.when }}` one-line meta (`docs/design/Chautauqua Content.dc.html:220`).
  This is the same DOM-fact-vs-screen-fact distinction
  `docs/design/audit/submissions-v12.md`'s clause-(b) closure for its own
  `:137` phone row uses: a `<table>`/`<tr>` ELEMENT that a `max-width:
  700px` media rule (DEC-385, single-direction) reflows into the frame's
  card is a DOM fact, not a screen fact — the row draws as the frame's
  card at 390 regardless of the tag it is built from. Receipt:
  `app/src/pages/content/ContentApp.download-all-flex.receipt.render.test.tsx`'s
  first `describe` block (`"content.css 390: worklist meta line is a
  wrapping flex line-box..."`) pins this exact rule shape byte-for-byte
  against the same design-file line quoted above.

- **`:247` Content · selecting — CLOSED.** `app/src/pages/content/
  ContentApp.tsx` carries the `!phoneSelectMode` guard on both clauses the
  row's original divergence named, quoted verbatim:

  ```
  {!submissionId && view === 'worklist' && !phoneSelectMode && counts.needs_decision !== null && reUploadedCount !== null && (
  ```

  and

  ```
  {!submissionId && view === 'worklist' && !phoneSelectMode && (
  ```

  against the "N selected / All N / Done" meta row's own guard,

  ```
  {!submissionId && view === 'worklist' && phoneSelectMode && (
  ```

  — the idle summary line and the selecting-mode meta row are mutually
  exclusive, never mounted together, exactly as the frame's "selecting"
  390 cut draws only the meta row and the "rest" cut draws only the
  summary line. Receipt: `app/src/pages/content/
  ContentApp.worklist-390.render.test.tsx`'s "rest summary vs selecting
  meta row are exclusive" describe block, exercised through `ContentApp`'s
  real `/content` route.

- **`:338` Files · 390 — CLOSED.** Every clause this row ever carried is
  now built:
  - Chip vocabulary is a per-surface register, not a per-width one:
    `app/src/pages/content/types.ts`'s `LIBRARY_KIND_LABELS` gives
    `recording: 'Video'` for the files library, and `FilesLibrary.tsx`
    renders `isPhone ? 'All' : 'All types'` for the leading chip, split by
    width as `FilesLibrary.kind-vocabulary.render.test.tsx` pins against a
    `verbatimLine` citation of the frame's own `:344` "All" chip markup.
  - The "412.0 MB" claim this row carried was itself wrong: `src/domain/
    files.ts`'s `formatBytes` renders an integral byte count bare —
    `Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)` —
    so "412 MB" already matches the frame's :342 stat line without a
    trailing ".0".
  - The header's duplicate "Download …(.zip)" control is RE-LINED away,
    not left doubled: content.css's terminal phone block hides
    `.chq-content-files-download-all-wrap` wholesale
    (`display: none;`), leaving the identical capability live only in
    `.chq-phone-dock`'s primary `chq-btn-primary` "Download all" button —
    matching the frame's own reservation of the control for the footer
    dock alone (`docs/design/Chautauqua Content.dc.html:342` draws only
    the file/size summary text at the header, `:360` draws the dock's
    primary). Receipt: `app/src/pages/content/
    ContentApp.download-all-flex.receipt.render.test.tsx`'s second
    `describe` block (`"Files header 'Download all' is RE-LINED to the
    footer dock alone, never doubled"`), which cites both frame lines
    verbatim before asserting the CSS.

- **`:373` Session · deliverable — CLOSED.** content.css's terminal
  `@media (max-width: 700px)` block flattens `.chq-content-group-body`
  into one ordered flex column, quoted verbatim:

  ```
  .chq-content-group-body {
    display: flex;
    flex-direction: column;
  }

  .chq-content-group-body > .chq-content-files-col,
  .chq-content-group-body > .chq-content-comments-col,
  .chq-content-group-body .chq-comment-thread {
    display: contents;
  }
  ```

  hoisting both DOM columns' real children (plus `CommentThread`'s own
  children) into flex items of the shared parent, then placing each with
  `order` in the frame's drawn sequence (deliverables label → chip strip →
  version list → notes label → comment list → upload notice → upload zone
  → comment composer). The desktop two-column DOM is untouched above this
  block's own 700px ceiling (DEC-385, single-direction). Receipt:
  `app/src/pages/content/content-phone-frames.test.ts`'s "Session ·
  deliverable" describe block, which reads every `order:` declaration this
  block carries for the promoted grandchildren and asserts the sequence
  against a DEC-967 `verbatimLine` citation of the frame's own dashed
  "Upload a file for the speaker" link (`docs/design/Chautauqua
  Content.dc.html:417`).

No open clause remains against any of Content's four `width:390px`
frames.

## Update (wave 12, task w12-xc): the render-verdict receipt file caught up to this ledger

`app/src/pages/Content.frame-verdicts.render.test.tsx` (the render RECEIPT
each row above cites) still carried its ORIGINAL wave-157 titles for `:198`
and `:373` -- `DIVERGES` `it()`s whose bodies asserted DOM order/containment,
contradicting this file's own `:198`/`:373` rows above (both `CLOSED` since
wave 25, task w25-h). Both `it()`s are retitled `MATCHES` and now read
`content.css`'s terminal `@media (max-width: 700px)` block as TEXT --
jsdom applies no `@media`, so a DOM-only assertion is a claim about the
desktop cascade, never the phone one, and cannot receipt a screen-level
verdict. `:198` asserts the `<thead>`-hidden / block-collapsed rule plus
the six cells' `order` sequence (select < status < session <
speaker/latest-file < actions); `:373` asserts `.chq-content-group-body`'s
`display:flex; flex-direction:column`, the three `display:contents` hoists,
and the five grandchildren's `order` sequence -- both modelled on
`DeliverableDetail.stack-390.render.test.tsx`'s own `phoneBlock`/
`phoneRule` idiom. Each `it()` keeps its original DOM-fact assertions
alongside the new CSS-text ones (both are true; only the SCREEN-fact
verdict changed). No table row above changes -- both were already
`CLOSED` -- this update brings their cited receipt file into agreement
with them.
