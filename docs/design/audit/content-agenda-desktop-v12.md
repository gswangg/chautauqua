# Content + Agenda v12 DESKTOP (1600) per-frame render verdicts (w24-d, DEC-651)

Per-frame render VERDICTS for the six DESKTOP frames covering two clusters
(Content's four frames plus the Modal, Agenda's Day grid plus its Modal),
entered through the app's real routes and asserted against jsdom DOM
structure — jsdom applies no stylesheet, so nothing here is a computed-style
claim. This supersedes nothing citation-only; these are the first render
receipts for either cluster's desktop frames. Receipts live in
`app/src/pages/Content.desktop-frame-verdicts.render.test.tsx` and
`app/src/pages/Agenda.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its two test files render, verdict, and file divergences in prose — they
move no desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

DEC-651 (Amendment wave 24): a Modal/Menu/STATE frame is verdicted by
operating the control that opens it on the real route — a direct component
mount verdicts the component, not the screen. Content's "Upload rejected"
modal and Agenda's "Breaks" modal are both driven that way below (a real
rejected file selection; a real click on the head's "Breaks ›" disclosure).

## Content

### Frame :28 "Worklist · 1600"

**MATCHES.** Entered via `ContentApp` at `/content`.

- Title-row actions — `All files` then `Refresh` (frame :59-60) — match
  `ContentApp.tsx`'s `.chq-content-summary-actions` exactly, order and
  labels.
- The chipstrip (frame :65-67) carries the three worklist tabs in the
  frame's order, `Needs a decision` active by default (DEC-881).
- The table header row (frame :82) is select / Session / Speaker / Latest
  file / Status / actions, matching `SessionList.tsx`'s `<thead>`.
- A row (frame :84-101) carries Approve + Open and its cells read Session /
  Speaker / Latest file / Status in the frame's order.
- Ticking two rows arms the bulk bar exactly as the frame's own static
  illustration (:71-77) draws it — `N selected`, the "Approving sends
  nothing…" consequence note, `Approve N`, `Clear`.

### Frame :111 "Session deliverables · /content/:submissionId"

**RETIRED (wave-8, DEC-976/DEC-902): both additive rows below are BLESSED
capability, not divergences to fix.** `src/decisions-data/DEC-902.md`'s
wave-8 amendment ("An additive control is not a divergence to fix; a
control the frame draws and the app omits is") names this exact frame by
citation — `content-agenda-desktop-v12.md :111` — as the first of four
carried rows of one shape: "a frame's control list is a FLOOR, not a
ceiling. An extra control that adds real capability is blessed and its row
is retired with a caption." Entered via `DeliverableDetail` at
`/content/:submissionId`.

- **MATCHES**: the status band (frame :122-131) carries "Content status" +
  the status value + an `Approve` primary, matching
  `.chq-content-status-band`.
- **BLESSED ADDITIVE (retired)**: the status band also carries a `Request
  changes` secondary. The frame's status band holds exactly two controls —
  `Approve` and the `Download all` tertiary link — and reserves its own
  note+email "Ask for changes" composer for the right (Notes) column
  (frame :181). The tree's silent, no-email `Request changes` status flip
  (DEC-720 wave-32 amendment) is a genuinely separate, additional capability
  from that composer, not a duplicate of it. Per DEC-902's wave-8
  amendment, an extra control that adds real capability the frame never
  drew is blessed, not a gap to remove.
- **BLESSED ADDITIVE (retired)**: the title row carries `Edit title and
  abstract ›` and `Revision history ›` links. The frame's header stack
  (:116-120) is back-link, H1, and the "Speaker · CODE · slot, Room"
  subtitle only — no third action row under the title. Same DEC-902 wave-8
  disposition: additive capability, blessed.
- **MATCHES**: Deliverables and Notes render as two side-by-side DOM-sibling
  columns (frame :134's `grid-template-columns:1.35fr 1fr`), the SAME shape
  the frame draws at this width — unlike the 390 frame, which the phone
  ledger (`content-v12.md`) already records as stacking them instead.

### Frame :288 "Files library"

**RETIRED (wave-8, DEC-902): the kind-chip vocabulary gap is settled,
CLOSED without a lane.** `src/decisions-data/DEC-902.md` (top-level
ruling, not the wave-8 amendment): "Content Files `Other · N` is a
pack-internal inconsistency, not a buildable requirement — CLOSED without
a lane. Four consecutive waves carried this row as 'adjudicate before
building'. Adjudicated: the DESKTOP frame (Content.dc.html:308) draws
`Other · 5` while the PHONE frame (:344-346) draws NO residual chip over
the SAME 31-file library — the pack contradicts itself about whether the
chip exists. Precedent is settled (Speakers :57 vs :469): a pack-internal
inconsistency is a captioned ruling, not a defect. Independently, the app
enumerates six kinds (FILE_KINDS + headshot) and DEC-902 already ships a
count-driven strip that omits empty kinds; collapsing poster/handout/photo/
headshot into one catch-all would REMOVE the organiser's per-kind filter,
and the campaign never removes capability to match a drawing (DEC-380/582).
The row is retired, not scheduled."

- **MATCHES**: the header row (frame :292-301) is breadcrumb + H1 `Files` +
  the `N files · size` stat + a `Download` control, and the search field
  (frame :304) plus the leading `All types` chip (frame :305) render
  exactly as drawn.
- **RETIRED (blessed pack inconsistency)**: the frame's remaining chips
  (:306-308) read `Slides · 22` / `Video · 4` / `Other · 5` — a generic
  "Other" bucket collecting every non-slides-non-video kind. The tree's
  kind-chip strip (DEC-902) has no "other" grouping at all — it names each
  `LIBRARY_KIND` with a non-zero count directly, so the same fixture
  renders `Handout · 5` where the frame draws `Other · 5`. Per DEC-902
  above, this is the pack contradicting itself (desktop draws the
  catch-all, phone does not, over the same library) and building the
  catch-all would remove the per-kind filter — retired, not a gap.
- **MATCHES**: the table header row (frame :311) is File / Session /
  Version / Size / [actions], matching `FilesLibrary.tsx`'s `<thead>`.

### Frame :434 "Upload rejected" (Modal, DEC-651)

**RETIRED (wave-8, DEC-967/DEC-902): structure matches; the error-band copy
divergence is settled, not a gap.** `src/decisions-data/DEC-902.md`'s
wave-8 amendment: "The upload-refusal band (:434) resolves the same way in
the other direction: the tree renders `src/domain/files.ts`'s own
server-enforced refusal rather than the frame's bespoke sample prose,
which DEC-967's 'frame sample data is not product copy' already settles."

- **MATCHES**: driven via `DeliverableDetail`'s real `UploadZone`, firing an
  actual disallowed-extension file through the mounted file input (never
  `<UploadRejectedModal ... />` mounted directly, per DEC-651) — the
  resulting dialog carries all four parts the frame draws: the header
  (title + session/kind subtitle), the error band, the "What was kept"
  section, and the Choose-another/Cancel footer.
- **RETIRED (bespoke sample prose, not a copy gap)**: the frame's
  error-band headline (:448,
  `keynote-final.zip is not a slide format`) is bespoke, scenario-specific
  prose. The tree instead renders `src/domain/files.ts`'s own zip-specific
  refusal (`Zip archives are only accepted for a handout deliverable`) — the
  SAME rule the server enforces (DEC-020/DEC-653's zip-admitted-only-for-
  handout tier), never a second hand-written copy, but not the frame's own
  wording for this specific kind mismatch. NOTE (narrow
  interpretation, flagged per this task's own instruction): the brief that
  produced this receipt described driving this frame "through mockApi", but
  `validateUpload`'s refusal is a pure, client-side check that runs and
  rejects before any network request exists — there is no HTTP round trip
  for `mockApi` to intercept. The receipt instead satisfies DEC-651's own
  text (operating the real control on the real route) by firing a genuine
  file selection through the mounted input.

## Agenda

### Frame :28 "Day grid · 1600"

**MATCHES, plus one blessed additive control retired below (wave-8,
DEC-976).**

- **MATCHES**: the head summary (frame :57) reads `N unplaced · N
  conflicts · P% placed` verbatim, with only the conflict count bolded.
- **RETIRED (wave-8, DEC-976): the head action row's `Breaks ›` disclosure
  is closed by ruling, not an open divergence.** `docs/design/DEVIATIONS.md`
  §3: "Agenda 390 phone dock stays exactly the two frame controls; Publish
  schedule and Breaks live in the head's action row (DEC-380 wave-116
  amendment) … RULED, closing the question: the dock is the frame's,
  unchanged — exactly the two drawn controls, no third. This is DEC-919's
  're-line, never remove' read the other way around — a frame is the
  geometry authority, not a capability manifest, so its silence about
  Publish schedule and Breaks removes geometry, not capability, and
  neither control has any other home on the phone surface. Both stay in
  the head's own full-width action row." The frame's own 1600 head-action
  row (:59-62) draws exactly `Auto-schedule` then `Publish schedule`, with
  the Breaks entry point drawn only on the separate Modal frame's own
  canvas (:206-211) and no trigger anywhere on the 1600 canvas itself —
  but DEC-380 wave-116's ruling is that a frame's silence about a control
  removes geometry, not capability, and the head's own full-width action
  row is precisely where the ruling places both Publish schedule AND
  Breaks, at every width the row exists. The desktop head action row
  carrying the same `Breaks ›` disclosure the ruling already assigns there
  is the ruling applied, not a divergence from it.
- **MATCHES**: the day-tab row (frame :65-69) carries a pill per day plus
  the "Clashes are flagged, not blocked" note.
- **MATCHES**: the desktop route mounts `DayGrid` (never the phone tree),
  with a room-header column per configured room (frame :78) and a placed
  session card carrying its ref/title/speaker (frame :87-89).
- **MATCHES**: the Unscheduled tray (frame :101-113) carries the `Unscheduled`
  label with a right-aligned count, the unplaced session, and the "Drag to a
  slot · drag back to unschedule" hint verbatim.

### Frame :209 "Breaks · Tue 12 May" (Modal, DEC-651)

**DIVERGES (additively); everything else matches.**

- **MATCHES** (DEC-651, opened via the real control): clicking the agenda
  head's own `Breaks ›` disclosure opens a dialog titled `Breaks on
  <Weekday>` (day-scoped, frame :216) with "They block every room at once"
  as its subtitle (frame :217) — never `<BreaksPanel ... />` mounted in
  isolation.
- **MATCHES**: an existing break row (frame :223-226) states its label,
  start time, and duration.
- **DIVERGES (additively)**: an existing row carries BOTH `Edit` and
  `Remove`. The frame's own row-actions cell (:227) is exactly one control,
  `Remove` — the tree's inline edit affordance (DEC-022 amendment, wave 71)
  is a real, later-landed capability the frame's canvas predates.
- **MATCHES**: the add-break form (frame :230-245) carries `Label` /
  `Starts` / `Minutes` fields, the outside-window hint sentence verbatim,
  and `Add the break` + `Done` in one action row.

## Summary

| Frame | Verdict |
| --- | --- |
| Content :28 Worklist · 1600 | MATCHES |
| Content :111 Session deliverables | RETIRED (wave-8, DEC-902 wave-8 amendment) — blessed additive, x2 |
| Content :288 Files library | RETIRED (wave-8, DEC-902) — pack-internal inconsistency, CLOSED without a lane |
| Content :434 Upload rejected (Modal) | RETIRED (wave-8, DEC-967/DEC-902 wave-8 amendment) — bespoke sample prose, not a copy gap |
| Agenda :28 Day grid · 1600 | RETIRED (wave-8, DEC-976) — Breaks disclosure closed by DEVIATIONS §3 / DEC-380 wave-116 |
| Agenda :209 Breaks (Modal) | DIVERGES (additively — Edit control) |

4 of 6 frames are now RETIRED by ruling (wave-8, DEC-976/DEC-902) and 1 of
6 MATCHES outright; only Agenda :209's `Edit` control remains an open,
unscheduled additive divergence — none of these ever blocked the render,
and none required moving a desktop byte to file. Retiring a row restates
its verdict and cites its ruling in place; it does not delete the row or
the frame's original prose above.
