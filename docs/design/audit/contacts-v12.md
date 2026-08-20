# Contacts v12 phone audit (task w1-f)

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106). Finding 3 was
> re-derived (wave 106) against `app/src/pages/contacts/MergePage.tsx` and
> still reproduces as written — `.chq-contacts-merge-rule-box` (line 347)
> still splits the frame's one line across `.chq-contacts-merge-rule-box-rule`
> (line 348) and `.chq-contacts-merge-impact` (line 350), naming the kept
> record by `{keepContact.firstName} {keepContact.lastName}` rather than
> the frame's generic "the record you keep" — left OPEN, and left for task
> `v12m-w2-c`, which owns landing this in the same batch; not pre-closed
> here. Findings 1 and 2 (the match-columns/phone-pager findings, distinct
> from the "Finding 3" above) are RESOLVED as of the DEC-663 wave-108
> amendment (task `v12m-w4-m`) — see that section below for receipts.

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
   `app/src/styles.css:2302` (`.chq-main:has([data-chq-phone-dock])`)
   already uses. `.chq-modal-actions`'s "Import N
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

**Finding 3 — filed by v12m-w1-c, not fixed (out of that task's file
scope).** `docs/design/Chautauqua Contacts.dc.html:535` ("Merge · 390")
draws the consequence block as ONE line: `Labels combine, notes are
appended · 3 submissions and 1 task move to the record you keep`.
`MergePage.tsx`'s `.chq-contacts-merge-rule-box` (around line 330) splits
this across TWO `<p>` elements (`.chq-contacts-merge-rule-box-rule` for
the combine rule, `.chq-contacts-merge-impact` for the submissions/tasks
line) and names the kept record by first/last name
(`{keepContact.firstName} {keepContact.lastName}`) instead of the
frame's generic "the record you keep." Reconciling this touches the
component's core data-flow (the impact paragraph currently needs
`keepContact` for its name interpolation and is conditionally rendered
only when `impact` has loaded) and is a copy/structure decision, not a
one-line fix -- left for a future wave rather than expanding v1-c's
scope beyond its four assigned divergences.
