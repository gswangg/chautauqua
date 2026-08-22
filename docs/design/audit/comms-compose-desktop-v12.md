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
- **CLOSED** (was DIVERGES): the attachments panel title dropped "and
  merge fields" against the frame's "Attachments and merge fields" (frame
  :96). Governed by DEC-902 wave-14m disposition (a) — the tree's wording
  carried no more information than the frame's (strictly shorter, not a
  richer or live-derived label) — and discharged by DEC-902 wave-19: the
  panel title now reads "Attachments and merge fields" verbatim
  (`ComposeWizard.tsx`'s `.chq-comms-panel-title` span). No longer a
  buildable follow-on; the frame's literal is what ships.
- "Include reviewer feedback" and "Attach calendar invite" toggles (frame
  :99, :108) MATCH by text and order.
- **CLOSED (label), still DIVERGES (visibility/default-value)**: the "From
  which plan" evaluation-plan selector is always-visible in the frame,
  sitting as a permanent sibling of the "Include reviewer feedback"
  checkbox with a preselected value ("Wave 1 — first pass, all tracks",
  frame :102-103). The label mismatch this row previously recorded — the
  tree's code-side "Evaluation plan" shortening against the frame's drawn
  "From which plan" — is discharged as of w25-h per DEC-613's ruling (a
  drawn FIELD label is the product's field label; DEC-613's own RULED
  paragraph names this exact row by coordinate). `ComposeWizard.tsx:1453`
  now renders "From which plan" verbatim, with a frame-citation comment
  above it. The tree still reveals the select only once the checkbox is
  checked, starting at an empty "Choose a plan…" placeholder — ruling
  A18's "a parameter of the checkbox it belongs to" design, per the code's
  own comment — a genuine visibility AND default-value divergence from the
  frame's always-shown, preselected control. The visibility-and-default-
  value shape is the frame's own populated demo state ("Wave 1 — first
  pass, all tracks" preselected) against the app's real cold, unchecked
  start, governed by DEC-902 wave-9 (demo-state row) and DEC-967 (frame
  sample data is not product copy); ruling A18 covers the separate
  label/placement question and is not disturbed.
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
- **DIVERGES (fixed wave 21, DEC-964)**: the step rail's "Recipients" row
  names the population "23 accepted speakers" in the frame at BOTH :376
  (step 1 of 4) and :469 (step 4 of 4) — the literal is IDENTICAL at both
  citations. Correcting this row's earlier premise: the frame's own
  vocabulary does NOT change across steps (a prior reading of this bullet
  asserted it did); the divergence was always that the TREE names
  submissions where the frame names people, at every step. The tree's rail
  (`ComposeWizard.tsx:734-738` pre-wave-21) recomputed the row's detail off
  `selection.selectedIds.size` on EVERY render regardless of step, so at
  step 4 it still read "23 submissions selected". Wave 21 fixes step 4
  only: once `sendResult` exists, the row now names the recipient total the
  send actually addressed (sent + failed + skipped, the same arithmetic the
  already-matching :497-498 headline uses), worded "N speakers emailed" via
  the shared `countOf` helper — deliberately not the frame's own "accepted"
  qualifier, which describes the frame's fixture (a selection drawn from
  accepted submissions) and not compose's general case. Steps 1-3 are an
  ADJUDICATED LIMIT, not open debt: before a preview runs, `expandRecipients`
  has not resolved submissions to distinct speakers (one speaker can carry
  several submissions), so the recipient population is a value the server
  has not yet computed, and DEC-652's standing rule holds an uncomputed
  value absent, never invented — there is no code lane pending for steps
  1-3.
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
