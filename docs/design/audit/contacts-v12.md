# Contacts v12 phone audit (task w1-f)

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106). Finding 3 (the
> `MergePage.tsx` consequence-box split) was re-derived at wave-17 and no
> longer reproduces: `.chq-contacts-merge-rule-box` now renders a SINGLE
> `<p>` and both the named-record and generic-record spans exist, toggled
> by width — RESOLVED (w2-c, DEC-919), see that section below for
> receipts.
>
> Findings 1 and 2 (the match-columns/phone-pager findings, distinct
> from the "Finding 3" above) are RESOLVED as of the DEC-663 wave-108
> amendment — see that section below for receipts.
>
> The "Import CSV · 390" and "Contact · 390" per-frame verdict rows below
> were also re-derived at wave-17 (DEC-663): Import CSV's missing
> `backLink` is RESOLVED and its verdict row now reads MATCHES; the
> Contact row's "always-on Close" clause is RETIRED (CSS now hides it at
> phone), narrowing that row to its one surviving structural gap
> (H2-vs-H1, Finding 4). The Merge row's `.chq-contacts-merge-picks`
> block is ADJUDICATED as a frame-silent addition, not an open
> divergence — see that row below.

Findings surfaced building the "Import CSV · 390" one-column-per-screen
pager against `docs/design/Chautauqua Contacts.dc.html:483` ('Import CSV ·
390', body :487-511) and `app/src/pages/contacts/ImportWizard.tsx` +
`contacts-panels.css`. Fixable items landed in this task; the items below
need a decision or land outside this task's scope
(`app/src/pages/contacts/**` only: `ImportWizard.tsx`,
`contacts-panels.css`, `contacts-phone-frames.test.ts`, and the
`ImportWizard.*.render.test.tsx` files; no shared page header/footer band,
no touching `app/src/styles.css` or `src/views/theme.ts`).

1. **RESOLVED (DEC-663 wave-108, ruling B).** Two phone docks used to stack
   at the bottom of the match-columns step. The frame draws exactly one
   footer pair at :508-511 (`Next column` / `Skip`), full-width and pinned
   below the scrolling body. `contacts-panels.css`'s terminal
   `@media (max-width: 700px)` block now hides ModalFrame's shared footer
   (`.chq-modal-actions`) whenever the page-owned
   `.chq-contacts-import-phone-dock` is present, via
   `.chq-contacts-import:has([data-chq-phone-dock]) .chq-modal-actions {
   display: none; }` (`app/src/pages/contacts/contacts-panels.css:1777`,
   appended at the sheet's single terminal block per DEC-385) —
   reusing the same `[data-chq-phone-dock]` attribute contract that
   app/src/styles.css`.chq-main:has([data-chq-phone-dock])` (drift-proof
   citation, DEC-967 wave-115 shape -- this declaration has drifted from
   the line number originally cited here) already uses. `.chq-modal-actions`'s "Import N
   rows" / "Cancel" survive elsewhere on screen: "Import N rows" ->
   the phone dock's own last-column primary ("Review N rows",
   `ImportWizard.tsx` ~1028); "Cancel" -> ModalFrame's header Close control
   (`.chq-modal-close-btn`, `app/src/components/ModalFrame.tsx` ~132),
   which is never hidden at any width. Pinned by
   `ImportWizard.phoneColumns.render.test.tsx`'s "hides the shared
   ModalFrame footer..." test.

2. **RESOLVED (DEC-663 wave-108, ruling A).** The frame's "N rows match an
   existing contact" note position (`docs/design/Chautauqua
   Contacts.dc.html:506`, `padding: 16px 0 0`) does render at phone — but
   as the wizard's own, already-computed same-file dedupe note
   ("Same-file email repeat: N rows · the later row wins", sourced from
   `dedupeCount`), not the frame's literal existing-contact-match wording
   (which needs `plan.updated`, unavailable until the dry run runs).
   `contacts-panels.css`'s `.chq-contacts-import-dedupe { padding-top:
   16px; }` (line 1464, landed wave v12m-w9-h) re-spaces this SAME node
   under the phone radio list rather than hiding it — the previous
   `display: none` phone-hidden rule this finding described was itself
   stale by the time wave-108 re-derived it. The frame-accurate
   plan-sourced sentence still lands separately on the Review step
   (`.chq-contacts-import-matched`) once the dry run has actually run.
   Pinned by `ImportWizard.phoneColumns.render.test.tsx`'s "re-spaces the
   same-file dedupe note..." test.

3. **"Next column" and "Skip" never reach the primary Import action.**
   The frame does not show what happens after the last column (:508-511
   only draws mid-pagination state, column 2 of 5). This task's narrowest
   reasonable reading: the pager clamps at the last column and lets the
   organizer use the shared modal footer's "Import N rows" to finish (see
   finding 1 — that footer is still visible, just as a second stacked
   dock). If the intended flow is instead "Next column" on the last
   column advances straight to Review/commit, that is a state-machine
   decision this task's scope forbids inventing.

## Resolution (DEC-663, wave-87 amendment, task w5-g)

Findings 2 and 3 are decided. Finding 1 (two stacked docks) is unchanged
and stays filed — it belongs to the shell/header-footer lane.

**Finding 3 — RULED.** On the LAST column, the phone pager's primary no
longer reads "Next column"; it reads `Review N rows` (the same
`countOf(dataRows.length, 'row')` phrase the desktop primary already
used) and runs the exact same `runPreview()` call the desktop Review step
runs, landing on the Review step. "Skip" on the last column does the
same, after first clearing that column's mapping — it passes `runPreview`
an explicit override-mapping argument rather than reading the `mapping`
state closure, since `setColumnMapping`'s state update has not yet
applied when the click handler calls `runPreview` in the same tick.
`Next column` / `Skip` are, on every column but the last, unchanged.
There is no longer a cul-de-sac: the pager's own footer becomes a path
into the dry run, and the organizer never has to fall back on the shared
modal footer's primary to finish matching columns (finding 1's stacked
second dock remains visible during pagination, but is no longer the only
way forward on the last column).

**Finding 2 — RULED.** The frame's phone-position note ("N rows match an
existing contact by email · those get updated") renders ONLY from the
dry run's own `plan.updated` count, and renders NOTHING before that plan
exists. Concretely: the wizard already had exactly this note on the
Review step (`.chq-contacts-import-matched`, sourced from `plan.updated`,
landed with the desktop review-step redesign) — nothing new was needed
there. What changed is the match-columns/phone-pager step: the same-file
dedupe note (`.chq-contacts-import-dedupe`, sourced from `dedupeCount`,
a different measurement — an in-file email collision, not an
existing-contact match) that this task previously substituted at that
phone position is now DESKTOP-ONLY. `contacts-panels.css` hides
`.chq-contacts-import-dedupe` at `max-width:700px` instead of
repositioning it under the phone radio list; it keeps rendering "beneath
the column grid" on desktop, where it is true. The phone pager shows
nothing in that position pre-dry-run — a missing line, never a number
with no plan behind it.

Both rulings are implemented in `ImportWizard.tsx` (the phone dock's
button logic) and `contacts-panels.css` (`.chq-contacts-import-dedupe`'s
phone-hidden rule); new coverage in
`ImportWizard.phoneColumns.render.test.tsx`.

**Finding 3 — RESOLVED (w2-c, DEC-919).** `docs/design/Chautauqua
Contacts.dc.html:535` ("Merge · 390") draws the consequence block as ONE
line: `Labels combine, notes are appended · 3 submissions and 1 task move
to the record you keep`. `MergePage.tsx`'s `.chq-contacts-merge-rule-box`
(`app/src/pages/contacts/MergePage.tsx:365-382`) now renders this as a
SINGLE `<p className="chq-contacts-merge-rule-box-rule">` — the combine
rule and the `.chq-contacts-merge-impact` submissions/tasks span sit
inline in that one paragraph, not two stacked `<p>`s, matching the
frame's single line. The record-name half is also resolved: the
paragraph carries both a `.chq-contacts-merge-impact-name` span (first/
last name) and a `.chq-contacts-merge-impact-generic` span ("the record
you keep"), toggled by width in `contacts-panels.css:1814-1818` — desktop
keeps the name (its head band already names the kept record at :526),
phone swaps to the frame's generic phrasing, since the phone head band
does the same. This finding no longer reproduces against the tree; kept
here only as the citation the "Merge · 390" verdict row below points to.

**Finding 4 — `ContactDrawer.tsx`'s title renders through the shared
modal-title class, outside this document's file scope (DEC-959,
DEC-613).** `docs/design/Chautauqua Contacts.dc.html:410` sets the
"Contact · 390" head H1 at `font-size:25px; font-weight:700;
letter-spacing:-0.04em`. `ContactDrawer`'s title renders through the
shared `.chq-modal-title` class (app/src/components/modal-frame.css`font-size: 23px`
(drift-proof citation, DEC-967 wave-115)), which is 2px short of the frame's figure, and the
class carries no `letter-spacing` declaration at all (the frame calls for
`-0.04em`). This is the SAME shared modal-title class every other v12m
drawer/modal renders through, so widening it is a REGISTER change, not a
page-local one: DEC-613 wave-104's rule is that a page lane wires the
shared class and files the register delta here for whoever owns
`modal-frame.css`, rather than forking a page-local heading style. The
delta is recorded as a register fact, not as a claim on anyone's
calendar (DEC-518).

**Finding 5 — whether the shell header stands down for the whole
Contacts cluster during a 390 drill is a SHELL decision, outside any
page document's file scope (DEC-964, DEC-893).** `PipelineBoard.tsx` and
`DuplicatesView.tsx` now carry `.chq-phone-head`/`.chq-phone-head-drill`
for their 390 drill heads. Per DEC-964 the stand-down of the outer shell
chrome is decided by the shell, not page-locally: the only current setter
of `data-chq-phone-head` is `Scorecard.tsx:531`, and no Contacts root
sets it. `ContactsApp.tsx`'s own landing head
(`.chq-contacts-title-row` / `.chq-contacts-tabstrip-row`) IS stood down
via a markup gate (`!(isPhone && panel !== 'directory')`) so it does not
double up above a drill's own head band; the outer app shell chrome
above `.chq-page` for Contacts is a separate register surface. Recorded
here as a register fact about where the decision lives, not as a claim
on anyone's calendar (DEC-518).

## Per-frame render verdicts (w13-ri, DEC-976 wave-157)

Contacts had FIVE width:390px frames in `docs/design/Chautauqua
Contacts.dc.html` and none had ever been rendered against a per-frame
verdict before this task — several carried the CLOSED claims above,
closed on grep evidence rather than a render. Receipts for every row below
live in `app/src/pages/Contacts.frame-verdicts.render.test.tsx`, entered
through the real route each frame is actually reached by (`ContactsPage`
for the four `/contacts` frames, `MergePage` for its own `/contacts/merge`
route) — never a sub-component mounted directly.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `Chautauqua Contacts.dc.html` "Contacts" (390 landing) | DIVERGES | The frame draws a headerless card list (name / company·role / tags, one boxed "Email" action per row) under a search box, an "All of … + Rule" chip row and an All/Speakers/Reviewers pill row, ending in a shell tab-bar footer. The actual read is the SAME desktop `<table class="chq-table chq-contacts-table">` at every width — a checkbox column, "Name and email"/"Company"/"Labels" header row, and a per-row "Open" action instead of "Email" — plus the full desktop `FilterRulesPanel` rule builder above it, not the frame's chip strip. |
| `Chautauqua Contacts.dc.html` "Contact · 390" | DIVERGES (narrowed, DEC-663 wave-17) | The frame draws its own full-screen route: a `‹ Contacts` back link and nothing else in the head band. The actual screen is `ContactDrawer`, mounted through the shared `ModalFrame` as a `role="dialog"` portal — an H2 title, not the frame's own H1. The row's earlier "always-on Close button beside the back link" clause is RETIRED: `contacts-panels.css`'s terminal `max-width:700px` block now blanks `.chq-contacts-drawer .chq-modal-close-btn` at phone (v12m-w15-th, DEC-663 wave-159), leaving the back link as the drill's sole escape, matching the frame. The two-control dock below (`Email <name>` / `Edit`, DEC-959) matches exactly, as does the title-register gap already filed above (Finding 4) — the surviving divergence is exactly that title-register gap. |
| `Chautauqua Contacts.dc.html` "Pipeline · 390" | MATCHES | Back link, H1, the "N people" caption, the five-stage chip strip, the per-row card ending in a "Move ›" control, and the "Add someone"/"Filter" dock all render exactly as drawn. |
| `Chautauqua Contacts.dc.html` "Import CSV · 390" | RESOLVED (DEC-663 wave-17) → MATCHES | The frame draws a `‹ Contacts` back link in the head band (`:489`). This row previously read DIVERGES because `ImportWizard` passed `ModalFrame` no `backLink` prop; it now does (`app/src/pages/contacts/ImportWizard.tsx``backLink={{ label: '‹ Contacts', onClick: onClose }}`, landed by commit f2fd0c43), and the shared `Close` control it would have stacked beside is CSS-hidden at phone by the same `.chq-contacts-import .chq-modal-close-btn` rule cited on the Contact row above. The one-column-per-screen pager body (eyebrow, column name, samples, "Import it as" rule, radio targets) and its "Next column"/"Skip" dock match, per findings 1-2 (RESOLVED, DEC-663 wave-108) above. |
| `Chautauqua Contacts.dc.html` "Merge · 390" | ADJUDICATED, frame-SILENT addition (DEC-663 wave-17) → MATCHES | The frame body goes straight from the head band into the field-by-field compare rows — no picker block. `MergePage` renders an additional `.chq-contacts-merge-picks` radio-list block (one radio per contact, with email/company/title) above the compare rows, with no frame counterpart. Per DEC-663's wave-17 ruling this is NOT an open divergence: the compare rows are drawn showing the result of a keep/drop choice already made, which a static frame cannot depict being made, so `.chq-contacts-merge-picks` seeds that choice rather than duplicating a peer of it — removing it would leave the 390 screen unable to express the merge's primary decision (a capability removal DEC-919 forbids), and hiding it at phone only would fork the merge's semantics by width. Same disposition `docs/design/audit/account-docs-v12.md`'s "Change password · 390" row already uses for the sign-in-persists hint: an addition the frame is silent on, not a MATCHES/DIVERGES call. The consequence box is RESOLVED (Finding 3 above, w2-c) — the per-field keep/drop pair and the "Merge them"/"Not a duplicate" footer both match as drawn. |
