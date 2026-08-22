# Comms compose-wizard v12 DESKTOP (1600) per-frame render verdicts (w26-c)

2 of Comms' 9 desktop frames in `docs/design/Chautauqua Comms.dc.html`.
Sibling lanes: `v12m-w23-e` owns the four frames at :222 (Templates ·
1600), :360 (Send history · 1600), :544 (Nothing sent yet), and :589
(likely a further compose/history state) — 4-of-9 per that lane's own
coverage doc. The remaining three desktop frames (Comms' landing/overview
frame and any other residue) are un-owned by either lane and are NOT
covered here — see the campaign ledger for the current residue count.

This document covers exactly the two compose-wizard steps neither lane
above claims:

- **Frame :28** "Compose · step 3 of 4 · 1600" — the review/preview step
  (recipient list, attachments/merge-fields panel, the per-recipient
  preview pane, the step-3 primary action).
- **Frame :453** "Compose · step 4 of 4" — the send/confirm step, drawn in
  its POST-SEND report state ("Send complete" / "21 of 23 speakers were
  emailed" / the skipped-recipient disclosure / the final action row).

Entered through `CommsPage`'s real route (`MemoryRouter` + `?tab=compose`,
DEC-651: a Modal/Menu/STATE frame is verdicted by operating the control
that opens it on the real route, never a direct component mount), driving
the real `ComposeWizard` forward through a `?ids=` landing → template
step → preview step → send step → send report, exactly the path an
organiser takes. Receipts live in
`app/src/pages/Comms-compose.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this document and its test
file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below. No line cited here falls inside a DEVIATIONS
§6 deferred extent, and no Settings frame is cited (DEC-032).

## Frame :28 "Compose · step 3 of 4 · 1600"

Entered via the preview step (`ComposeWizard`'s `step === 'preview'`
branch), reached from a `?ids=` landing with 23 recipients (matching the
frame's own demo numbers) through the template step's Subject/Body fields.

**Mostly MATCHES, with one blessed structural divergence and two
visibility-gating divergences.**

- "Recipients · 23" section head and "Change selection" control (frame
  :81-82) MATCH exactly.
- The overflow footer — "18 more · 23 is under the 100-recipient cap"
  (frame :93) — MATCHES byte-for-byte against the app's own overflow line
  once the recipient count matches the frame's own 23.
- **Additive divergence**: the app inserts a reconciliation sentence the
  frame never draws — "N submissions resolved to M recipients"
  (`ComposeWizard.tsx:1364-1376`, DEC-829 wave-128 Cut-2 item 5). This is
  the exact counting-vocabulary seam this task was asked to pay attention
  to: the frame's :28 header just says "Recipients · 23" without stating
  where that number came from; the app additionally states the
  submissions→recipients relationship explicitly. Additive, not
  contradictory — filed as a divergence because it is content the frame
  does not draw, not because it is wrong.
- **DIVERGES**: the attachments panel title drops "and merge fields" —
  the frame draws "Attachments and merge fields" (frame :96); the tree
  renders "Attachments" only (`ComposeWizard.tsx`'s `.chq-comms-panel-title`
  span). Governed by DEC-902 wave-14m: the tree's wording carries no more
  information than the frame's (it is strictly shorter, not a richer or
  live-derived label), so this row takes disposition (a) — the frame's
  literal is the one to adopt — not disposition (b), and it is never filed
  as "measurement only, desktop is frozen." Adopting the literal is a
  one-line component edit outside this measurement-only lane's file scope
  (`docs/design/audit/**` only); it is flagged here as the buildable
  follow-on this row leaves for the next code lane, not left unclassified.
- "Include reviewer feedback" and "Attach calendar invite" toggles (frame
  :99, :108) MATCH by text and order.
- **DIVERGES**: the "From which plan" evaluation-plan selector is
  always-visible in the frame, sitting as a permanent sibling of the
  "Include reviewer feedback" checkbox with a preselected value ("Wave 1 —
  first pass, all tracks", frame :102-103). The tree instead reveals a
  DIFFERENTLY-labelled select ("Evaluation plan") only once that checkbox
  is checked, starting at an empty "Choose a plan…" placeholder — ruling
  A18's "a parameter of the checkbox it belongs to" design, per the code's
  own comment, but a genuine label AND visibility AND default-value
  divergence from the frame's always-shown, preselected control. The
  visibility-and-default-value shape is the frame's own populated demo
  state ("Wave 1 — first pass, all tracks" preselected) against the app's
  real cold, unchecked start, governed by DEC-902 wave-9 (demo-state row)
  and DEC-967 (frame sample data is not product copy); ruling A18 covers
  the separate label/placement question and is not disturbed.
- **DIVERGES**: the "N have no slot yet — those get no invite" advisory
  (frame :110) is drawn in the frame directly beneath an UNCHECKED "Attach
  calendar invite" box (frame :107's unfilled `border:1px solid #8E8A7A`,
  contrasting :98's filled/checked reviewer-feedback box) — i.e. the frame
  shows this note regardless of the toggle's own state. The tree instead
  gates the entire note on `attachIcs && noSlotCount > 0`
  (`ComposeWizard.tsx:1461`): with the toggle unchecked (matching the
  frame's own drawn state) the tree shows nothing at all. Checking the
  toggle does then produce the exact matching text ("3 of 23 have no slot
  yet — those get no invite"). Governed by DEC-902 wave-9 (demo-state row)
  and DEC-967: the frame's own drawn demo state pairs the advisory with an
  unchecked toggle, a static composition the app's real toggle-gated
  behaviour does not need to reproduce — checking the toggle is the exact
  state the frame's advisory answers to.
- The Preview pane header ("Preview · <name>", frame :116) and its
  Prev/Next controls (frame :118-119) MATCH.
- The preview card's "To" / "Subject" field labels (frame :124, :128)
  MATCH.
- **DIVERGES (blessed)**: the frame's step-3 primary action directly
  SENDS — "Send 23 emails" (frame :144), paired with a "Back to the
  template" secondary (frame :145). The tree's step-3 primary only
  ADVANCES to step 4 — "Next: send ›" — with no "Send N emails" control
  anywhere on this step. `ComposeWizard.tsx:1548-1553`'s own comment
  names this explicitly: "Send moves to step 4 -- this primary only
  advances; the dedicated ConfirmDialog is gone because step 4 pre-send
  IS the confirmation (one ask, same click depth)." This is a real,
  deliberate product decision (not new debt), filed here per the
  mandate's instruction to record divergences even where they are already
  ruled correct — its authority is the code's own comment cited above,
  under DEC-651 wave-26's measurement-only mandate (this lane records the
  row, it does not move the desktop control that answers it).

## Frame :453 "Compose · step 4 of 4"

Entered via the send step after the send completes
(`step === 'sent' && sendResult`), which is the state the frame itself
draws — "Send complete" / "21 of 23 speakers were emailed" is a POST-SEND
report, not a pre-send confirmation screen.

**Mostly MATCHES, with one real counting-vocabulary divergence.**

- The step rail's "Preview" row detail — "One email per recipient" (frame
  :482-483) — MATCHES verbatim.
- **DIVERGES**: the step rail's "Recipients" row names the population "23
  accepted speakers" in the frame (frame :468-469) — an outcome
  population, who was actually reached. The tree's own rail
  (`ComposeWizard.tsx:734-738`) recomputes this same row's detail off
  `selection.selectedIds.size` on EVERY render regardless of step, so at
  step 4 it still reads "23 submissions selected" — the step-1 selection
  count, never switched over to name the sent/recipient population the
  frame's step-4 rail names. This is exactly the "submissions selected vs
  recipients" vocabulary reconciliation this task asked to be verdicted:
  the frame's OWN vocabulary changes across the two steps (a generic
  "Recipients" label whose DETAIL text tracks the step — a selection count
  early, an outcome population late); the tree's rail detail text never
  makes that same transition. This is a behavioural gap, not a wording-only
  residual (DEC-902 wave-14m's scope guard excludes it), and it is not an
  additive control, a demo-state row, or a pill-count row either, so none
  of DEC-902 waves 8/9/14m apply; no existing ruling governs the rail's
  source switch. Left open, ungoverned, for a future ruling or code lane —
  not self-blessed and not retired.
- The send-report headline — "21 of 23 speakers were emailed" (frame
  :497-498, "Send complete" eyebrow + headline) — MATCHES exactly, with
  the same arithmetic (21 sent + 0 failed + 2 skipped = 23 total).
- The "Two were skipped" section head and its "Nothing was sent to these
  two" caption (frame :514-515) MATCH exactly (spelled-count copy,
  computed off the same `skippedRecipients.length`).
- The dedupe-window explainer sentence (frame :527) MATCHES byte-for-byte.
- The footer note "All 21 are in History, each with the address it went
  to" (frame :531) and the "Compose another" / "Back to Comms" action pair
  (frame :533-534) MATCH.

## What this document does NOT cover

The compose wizard's OTHER two steps (select/template, frames not in this
task's scope) and Comms' remaining desktop frames (Templates, History,
landing/overview, and whatever residue the campaign ledger still lists
beyond the four frames at :222, :360, :544, and :589 named in the sibling
coverage note above) are unverdicted by this file. This file also does not
re-derive whether that sibling coverage's own 4-of-9 claim is accurate — a
measurement-only lane grades only the frames it names, never a separately
filed lane's count, so re-auditing another lane's coverage claim is out of
scope for this measurement-only lane.
