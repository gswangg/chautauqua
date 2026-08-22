# Submissions DESKTOP (1600) v12 audit -- Triage/Detail/New (task w26-f)

3 of Submissions' 8 desktop frames (`docs/design/Chautauqua Submissions.dc.html`).
This file owns exactly the three frames v12m-w23-f's 5-of-8 desktop ledger
(`app/src/pages/Submissions.desktop-frame-verdicts.render.test.tsx`, if/when
landed) does not: `:28` "Triage at volume · 1600", `:187` "Submission detail
· /submissions/:id", `:495` "New submission". STRICTLY MEASUREMENT ONLY
(DEC-651 wave-26) -- this task moved no desktop byte and edited no
component/stylesheet. Every claim below has a render-verdict receipt at
`app/src/pages/Submissions-triage.desktop-frame-verdicts.render.test.tsx`,
which cites its exact `docs/design/Chautauqua Submissions.dc.html:<line>`
extent via the file's own `verbatimLine` helper.

Components entered: `app/src/pages/Submissions.tsx` +
`submissions/SubmissionsTable.tsx` + `submissions/FilterBar.tsx` +
`submissions/BulkActionBar.tsx` (`:28`), `submissions/SubmissionDetailPage.tsx`
(`:187`), `submissions/NewSubmissionModal.tsx` (`:495`).

## Frame `:28` "Triage at volume · 1600" (extent 28-133)

- **MATCHES.** The table's column head set/order -- Ref, Title, Speakers,
  Track, Status, Sent, Format -- matches the frame's own header row
  (`:104`) exactly, once the checkbox-select head cell and the two
  trailing blank (Clone / list-end) cells are excluded (neither carries
  visible text in either the frame or the tree). `submissions/columns.ts`'s
  `deriveColumnsFromFormFields` is what supplies the Format column; it is
  populated from the event's default CFP form (DEC-243/DEC-249), not
  hand-listed here.
- **MATCHES.** The filter bar's control row (`submissions/FilterBar.tsx`'s
  `FilterBar` component, the frame's Status row at `:80-87`) is, in DOM
  order: the `Status` caption (`.chq-submissions-status-label`), the status
  pills group (`.chq-status-pills`), a hairline divider
  (`.chq-submissions-filterbar-divider`), the track `<select>`
  (`.chq-select.chq-submissions-filterbar-select`), then the column picker
  (`.chq-submissions-columnpicker`) -- the frame's own Status/pills/divider/
  track-select/column-picker order (`:81` opens the row).
- **DIVERGES (additively).** The bulk bar's move set agrees with the
  frame's three chips at `:95-97` -- `Move to accept queue` (primary),
  `Decline queue`, `Waitlist`, in that order -- but `BulkActionBar.tsx`
  inserts a fourth control, `Email these N submissions`, between the move
  set and `Clear` (frame `:98`). This link is not drawn in the frame at
  all. The move set itself (which three statuses a selection can move to,
  and which one is primary) is authored by `submissions/BulkActionBar.tsx`'s
  own `movesFor()` per **DEC-752** (offer the three moves relevant to the
  row's current stage, never all six statuses as equal buttons) and
  **DEC-825**, not by DEC-919 -- the mandate's citation-corrections section
  flags DEC-919 as a miscitation for this control, so this row does not
  repeat it. The added Email link is a DEC-967-findings-wave-8 (w8-b)
  addition (decide → notify handoff carrying the selection's ids into
  Comms) that predates this task and is out of this measurement-only task's
  scope to adjudicate; noted here as the frame's one undrawn addition.

## Frame `:187` "Submission detail · /submissions/:id" (extent 187-351)

- **MATCHES.** The main column's section order -- Abstract, Form answers,
  Reviews, Session details -- matches the frame's own section order
  (Abstract `:226`, Form answers `:233`, Reviews `:245`, Session details
  `:261`) exactly. `submissions/detailRows.ts`'s `buildAnswerRows` supplies
  the Form answers rows (one per non-locked form field, in the form's
  author-defined `position` order, per its own DEC-908 contract); this task
  did not re-audit that helper's row-level anatomy beyond confirming the
  section itself sits in the frame's own position.
- **MATCHES.** The aside's section order -- Decision, Speaker, History --
  matches the frame's own aside order (Decision `:307`, Speaker `:322`,
  History `:334`) exactly.
- **MATCHES -- the ruled label.** The decision rail's pending-state
  tertiary action (`SubmissionDetailPage.tsx`'s `decisionRail`,
  `.chq-detail-decision-rail`) is accessibly named **"Waitlist"** via an
  explicit `aria-label` -- never "Wait" (the width-conditioned TAP-copy
  span the tree renders alongside it at phone width per the DEC-878
  wave-129 amendment, invisible to the accessible name at every width) and
  never "Read". The frame's own drawn third chip at this size, `:314`,
  reads **"Waitlist"** too -- the desktop frame's own label and the ruled
  label agree, so no DIVERGES row is filed here. (The tree's rendered
  `textContent` for that button is the concatenated `"WaitlistWait"` --
  both spans are present in the DOM per the sibling-span idiom the file's
  own comment names; jsdom applies no stylesheet to hide either one. This
  is a DOM fact about the width-conditioned idiom, not a screen
  divergence.)

## Frame `:495` "New submission" (extent 495-530)

- **DIVERGES (additively).** The frame's four fields -- Title, Abstract,
  Speaker name, Speaker email, in that order (`:508`, `:511`, `:514`,
  `:517`) -- all render in the tree in the same order via
  `NewSubmissionModal.tsx`. The tree additionally renders a Tracks
  field (multi-select checkboxes) and a Format field (`<select>`), each
  conditional -- Tracks only when the event has any tracks, Format only
  when the default form carries a `session_format`/`format`-labelled
  dropdown field (DEC-243/DEC-249's same label match) -- per the
  component's own DEC-598/DEC-579 citation ("a submission created here
  previously could never be given a track, which silently removed it from
  track-scoped reviewer assignment"). Neither condition was seeded in this
  task's render (no tracks, no format field on the form), so the rendered
  tree matches the frame's own four-field set exactly under that
  condition; the two additional fields are a blessed, previously-ruled
  addition (cited in the component's own header comment) that this
  measurement-only task does not re-adjudicate.
- **MATCHES.** The action row is primary-first `Create it`
  (`.chq-btn-primary`) then secondary `Cancel` (`.chq-btn-secondary`),
  matching the frame's own action order at `:521`-`:522` and the
  component's own DEC-651 citation ("primary-first ('Create it', then
  'Cancel') action order").
