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

**RESOLVED-BY-RULING (DEC-902, wave 8).** Entered via `DeliverableDetail` at
`/content/:submissionId`. Both additive controls below are blessed capabilities
under DEC-902's floor-not-ceiling clause, not gaps to fix.

- **MATCHES**: the status band (frame :122-131) carries "Content status" +
  the status value + an `Approve` primary, matching
  `.chq-content-status-band`. The frame's own `Download all` tertiary link is
  also present, in `.chq-content-status-band-actions`.
- **RESOLVED-BY-RULING (DEC-902, wave 8)**: the status band also carries a
  `Request changes` secondary. The frame's status band holds exactly two
  controls — `Approve` and the `Download all` tertiary link — and reserves
  its own note+email "Ask for changes" composer for the right (Notes) column
  (frame :181). The tree's silent, no-email `Request changes` status flip
  (DEC-720 wave-32 amendment) is a genuinely separate, additional capability
  from that composer, not a duplicate of it. DEC-902's wave-8 amendment rules
  this an additive control that adds real capability: blessed, not a
  divergence to fix.
- **RESOLVED-BY-RULING (DEC-902, wave 8)**: the title row carries `Edit title
  and abstract ›` and `Revision history ›` links. The frame's header stack
  (:116-120) is back-link, H1, and the "Speaker · CODE · slot, Room"
  subtitle only — no third action row under the title. DEC-902's wave-8
  amendment names this row explicitly and rules it blessed: a frame's
  control list is a floor, not a ceiling.
- **MATCHES**: Deliverables and Notes render as two side-by-side DOM-sibling
  columns (frame :134's `grid-template-columns:1.35fr 1fr`), the SAME shape
  the frame draws at this width — unlike the 390 frame, which the phone
  ledger (`content-v12.md`) already records as stacking them instead.

### Frame :288 "Files library"

**RESOLVED-BY-RULING (DEC-902).** Closed without a lane; everything else matches.

- **MATCHES**: the header row (frame :292-301) is breadcrumb + H1 `Files` +
  the `N files · size` stat + a `Download` control, and the search field
  (frame :304) plus the leading `All types` chip (frame :305) render
  exactly as drawn.
- **RESOLVED-BY-RULING (DEC-902)**: the frame's remaining chips (:306-308)
  read `Slides · 22` / `Video · 4` / `Other · 5` — a generic "Other" bucket
  collecting every non-slides-non-video kind. The tree's kind-chip strip
  (DEC-902) has no "other" grouping at all — it names each `LIBRARY_KIND`
  with a non-zero count directly, so the same fixture renders `Handout · 5`
  where the frame draws `Other · 5`. DEC-902's own text adjudicates this: the
  PHONE frame (:344-346) draws no residual chip over the same 31-file
  library, so the pack contradicts itself about whether the chip exists — a
  pack-internal inconsistency, not a buildable requirement — and collapsing
  the per-kind chips into one catch-all would REMOVE the organiser's
  per-kind filter. This is NOT a real vocabulary gap; it is closed without a
  lane.
- **MATCHES**: the table header row (frame :311) is File / Session /
  Version / Size / [actions], matching `FilesLibrary.tsx`'s `<thead>`.

### Frame :434 "Upload rejected" (Modal, DEC-651)

**RESOLVED-BY-RULING (DEC-902)** (structure matches; the error-band copy is blessed).

- **MATCHES**: driven via `DeliverableDetail`'s real `UploadZone`, firing an
  actual disallowed-extension file through the mounted file input (never
  `<UploadRejectedModal ... />` mounted directly, per DEC-651) — the
  resulting dialog carries all four parts the frame draws: the header
  (title + session/kind subtitle), the error band, the "What was kept"
  section, and the Choose-another/Cancel footer.
- **RESOLVED-BY-RULING (DEC-902)**: the frame's error-band headline (:448,
  `keynote-final.zip is not a slide format`) is bespoke, scenario-specific
  prose. The tree instead renders `src/domain/files.ts`'s own zip-specific
  refusal (`Zip archives are only accepted for a handout deliverable`) — the
  SAME rule the server enforces (DEC-020/DEC-653's zip-admitted-only-for-
  handout tier), never a second hand-written copy, but not the frame's own
  wording for this specific kind mismatch. DEC-902's wave-8 amendment closes
  this with DEC-967's "frame sample data is not product copy": the tree's
  server-enforced refusal, not the frame's bespoke sample prose, is the
  correct shape. NOTE (narrow
  interpretation, flagged per this task's own instruction): the brief that
  produced this receipt described driving this frame "through mockApi", but
  `validateUpload`'s refusal is a pure, client-side check that runs and
  rejects before any network request exists — there is no HTTP round trip
  for `mockApi` to intercept. The receipt instead satisfies DEC-651's own
  text (operating the real control on the real route) by firing a genuine
  file selection through the mounted input.

## Agenda

### Frame :28 "Day grid · 1600"

**RESOLVED-BY-RULING (DEC-902, wave 9); everything else matches.**

- **MATCHES**: the head summary (frame :57) reads `N unplaced · N
  conflicts · P% placed` verbatim, with only the conflict count bolded.
- **RESOLVED-BY-RULING (DEC-902, wave 9)**: the head action row also
  carries a `Breaks ›` disclosure. The frame's own 1600 head-action row
  (:59-62) is exactly two controls — `Auto-schedule` then `Publish
  schedule` — the Breaks entry point exists only on the separate Modal
  frame's own canvas (:206-211), with no drawn trigger anywhere on the
  1600 frame itself. DEC-902's wave-9 amendment names this row explicitly:
  a real, later-landed capability the frame's canvas predates, blessed
  under the floor-not-ceiling clause. (DEVIATIONS §3 / DEC-380 wave-116
  rules the 390 dock's membership question for Breaks — that ruling is
  phone-only and is not extended or touched by this finding.)
- **MATCHES**: the day-tab row (frame :65-69) carries a pill per day plus
  the "Clashes are flagged, not blocked" note.
- **MATCHES**: the desktop route mounts `DayGrid` (never the phone tree),
  with a room-header column per configured room (frame :78) and a placed
  session card carrying its ref/title/speaker (frame :87-89).
- **MATCHES**: the Unscheduled tray (frame :101-113) carries the `Unscheduled`
  label with a right-aligned count, the unplaced session, and the "Drag to a
  slot · drag back to unschedule" hint verbatim.

### Frame :209 "Breaks · Tue 12 May" (Modal, DEC-651)

**RESOLVED-BY-RULING (DEC-902, wave 9); everything else matches.**

- **MATCHES** (DEC-651, opened via the real control): clicking the agenda
  head's own `Breaks ›` disclosure opens a dialog titled `Breaks on
  <Weekday>` (day-scoped, frame :216) with "They block every room at once"
  as its subtitle (frame :217) — never `<BreaksPanel ... />` mounted in
  isolation.
- **MATCHES**: an existing break row (frame :223-226) states its label,
  start time, and duration.
- **RESOLVED-BY-RULING (DEC-902, wave 9)**: an existing row carries BOTH
  `Edit` and `Remove`. The frame's own row-actions cell (:227) is exactly
  one control, `Remove` — the tree's inline edit affordance (DEC-022
  amendment, wave 71) is a real, later-landed capability the frame's canvas
  predates, blessed under DEC-902's floor-not-ceiling clause.
- **MATCHES**: the add-break form (frame :230-245) carries `Label` /
  `Starts` / `Minutes` fields, the outside-window hint sentence verbatim,
  and `Add the break` + `Done` in one action row.

## Summary

| Frame | Verdict |
| --- | --- |
| Content :28 Worklist · 1600 | MATCHES |
| Content :111 Session deliverables | RESOLVED-BY-RULING (DEC-902, wave 8, x2) |
| Content :288 Files library | RESOLVED-BY-RULING (DEC-902) |
| Content :434 Upload rejected (Modal) | RESOLVED-BY-RULING (DEC-902, wave 8) |
| Agenda :28 Day grid · 1600 | RESOLVED-BY-RULING (DEC-902, wave 9) |
| Agenda :209 Breaks (Modal) | RESOLVED-BY-RULING (DEC-902, wave 9) |

1 of 6 frames MATCHES outright; the other five carry additive capabilities
or copy choices that DEC-902's floor-not-ceiling ruling (wave 8 amendment)
and its wave-9 extension resolve without a lane — none block the render,
and none required moving a desktop byte to file.
