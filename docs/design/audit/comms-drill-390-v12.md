# Comms drill 390 frame verdicts (task w31-d, DEC-976 wave-31)

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106).

## Scope

Two frames -- `docs/design/Chautauqua Comms.dc.html:286-326` ("Templates ·
390") and `:335-354` ("Send history · 390") -- had been cited only by
CSS-text/product-source scans (`comms-drill-390-counts.test.ts`,
`comms-drill-phone-frames.test.ts`) and never by a real-mount verdict.
`app/src/pages/comms/CommsDrill.frame390.render.test.tsx` (this task) closes
that gap: it mounts the real `TemplatesTab` and `HistoryTab` routes (the
exact mounts `TemplatesTab.render.test.tsx` / `HistoryTab.render.test.tsx`
already use, never a second mock stack, DEC-663) and asserts every
non-template drawn literal from each frame, in drawn order.

## Verdict: Templates · 390 (`:286-326`)

Every element the frame draws has a real referent, graded per DEC-967 (SAMPLE
DATA / SHAPE, never a pinned literal):

- `:288` `‹ Comms` -- 44px-floored back link (`.chq-comms-templates-breadcrumb`,
  templates.css terminal phone block). CONFORMS.
- `:289` `<h1>Templates</h1>` -- CONFORMS, literal.
- `:290` `5 saved` -- CONFORMS by SHAPE (`/^\d+ saved$/`, sourced from
  `templates.length`, never the frame's own numeral).
- `:293-:299` per-row name/detail/used-eyebrow stack with a bordered 44px
  `Open` chip at the row's right -- CONFORMS. The chip is rendered as inert
  decoration (`aria-hidden`, no handler) per the standing w18-e ruling that
  the row's NAME is its one control; this task re-verifies that ruling still
  holds rather than re-litigating it.
- `:302-:309` the "Insert a field · open" always-visible reference list --
  **DIVERGES (already adjudicated, DEC-993)**. DEC-993 ("One 'Insert a
  field' control per composer") replaced the frame's per-composer chip/row
  idiom with a single dropdown trigger
  (`app/src/pages/comms/InsertFieldMenu.tsx`). The real DOM has no
  always-open block headed "Insert a field · open"; it has a closed
  `Insert a field` trigger (`aria-haspopup="menu"`) with a live count hint,
  opening to a `role="menu"` panel whose rows carry the SAME shape the frame
  draws (`{tag}` + example, `.chq-insert-field-menu-item-token` /
  `-item-sample`) -- verified in this task's render test. Recorded here as a
  DIVERGES row (not a gap) because the difference is a standing ruling, not
  an unbuilt frame element.
- `:311-:312` the `Acceptance · subject` section header -- **DIVERGES
  (structural, no product referent)**. The frame concatenates the
  template's name and the word "subject" into one caption spanning both the
  subject box below it AND the body box further down. The real editor never
  renders that compound string: the eyebrow (`.chq-comms-editor-eyebrow`)
  carries the template's bare name (per the standing DEC-890 ruling that
  "the eyebrow IS the template's name"), and the Subject/Body fields carry
  their own separate `<label>` text ("Subject", "Body") instead. This
  task's render test asserts the real shape (eyebrow present, `Subject`- and
  `Body`-labelled fields present) and explicitly asserts the frame's
  compound string is absent from the DOM, rather than silently passing on a
  substring match. No fix is filed: DEC-890's own ruling already settled
  the eyebrow's shape, and inventing a second "<name> · subject" caption
  alongside it would put two captions on one field for no reader benefit --
  this stays a recorded, adjudicated divergence.
- `:315-:316` the sample subject (`Your talk has been accepted to
  {event_name}`) and body (`Hi {speaker_name}, congratulations...`) --
  CONFORMS by SHAPE. These are SAMPLE DATA for one seeded "Acceptance"
  template (DEC-967: sample data is never graded by literal match); the
  render test asserts the real Subject/Body fields carry the SELECTED
  template's own stored text, shape-matched against the merge-field grammar
  (`/\{[a-z_]+\}/`), and explicitly asserts the value is NOT the frame's own
  sample string (a different fixture subject is used, to make the
  not-a-literal-echo assertion meaningful).
- `:322-:324` the Save/Cancel dock -- CONFORMS (built wave 98, re-verified
  present via `TemplatesTab.render.test.tsx` and this task's own mount).

## Verdict: Send history · 390 (`:335-354`)

- `:337` `‹ Comms` -- 44px-floored back link
  (`.chq-comms-history-breadcrumb`, comms.css terminal phone block, READ
  only -- comms.css is a sibling lane's file). CONFORMS.
- `:338` `<h1>History</h1>` -- CONFORMS, literal.
- `:339` `57 sends · 4 in the last 7 days` -- CONFORMS by SHAPE
  (`/^\d+ sends · \d+ in the last \d+ days$/`, built from `total` +
  `rhythm.sentLast7Days`, wave-98 amendment).
- `:344-:349` per-row when/count/subject/template stack -- CONFORMS, present
  on every row (asserted for 2+ rows, not just the first), including the
  no-template case resolving to an em dash rather than a blank cell or a
  fabricated name.
- `:350` the full-width bordered 44px `See the recipients` control --
  CONFORMS on EVERY row (`.chq-comms-batch-toggle-recipients`, its
  border-colour/radius corrected in `templates.css`'s terminal phone block
  per the wave-98 amendment; the 44px floor itself and the full-width/
  phone-label swap are owned by the shared `.chq-btn` rule
  (`app/src/styles.css`) and `comms.css`'s own terminal phone block --
  read-only receipts in this task's render test, since both files are out
  of this task's MAY-FIX scope).

No unresolved gaps found for the "Send history · 390" frame: every drawn
literal this task enumerated already has a conforming, real-mount-verified
referent.

## Not touched this wave (out of scope, confirmed unrelated)

`test/citation-form-drift.scan.test.ts` fails on this branch independent of
this task's changes (5 pre-existing line-keyed citations in
`src/decisions-data/DEC-393.md`, `DEC-509.md`, `DEC-651.md` and two in
`DEC-808.md`) -- reproduced on a clean worktree before this task's files
were added, and none of the four decision docs are files this task may
touch. Left as-is; a future lane owning `src/decisions-data/` should convert
them to the drift-proof bare-path shape.
