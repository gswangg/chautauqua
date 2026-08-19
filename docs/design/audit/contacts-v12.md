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
> here.

Findings surfaced building the "Import CSV · 390" one-column-per-screen
pager against `docs/design/Chautauqua Contacts.dc.html:483` ('Import CSV ·
390', body :487-511) and `app/src/pages/contacts/ImportWizard.tsx` +
`contacts-panels.css`. Fixable items landed in this task; the items below
need a decision or land outside this task's scope
(`app/src/pages/contacts/**` only: `ImportWizard.tsx`,
`contacts-panels.css`, `contacts-phone-frames.test.ts`, and the
`ImportWizard.*.render.test.tsx` files; no shared page header/footer band,
no touching `app/src/styles.css` or `src/views/theme.ts`).

1. **Two phone docks now stack at the bottom of the match-columns step.**
   The frame draws exactly one footer pair at :508-511 (`Next column` /
   `Skip`), full-width and pinned below the scrolling body. This task
   built that pair as a page-owned sticky band inside
   `.chq-contacts-import-match`
   (`.chq-contacts-import-phone-dock`), per its explicit scope note ("do
   not build a page header/footer band — shared `.chq-phone-head`/
   `.chq-phone-dock` land in v12m-w1-a"). But `ModalFrame`'s own shared
   footer (`.chq-modal-actions`, rendered from the `actions` prop) is
   unconditional across every width, and still shows "Import N rows" /
   Cancel below our new sticky band regardless of the pager's position —
   so a phone user of this step sees TWO stacked docks, not the frame's
   one. Once the v12m-w1-a header/footer scaffold lands, this wizard's
   phone-only actions should route through it instead of a second,
   page-owned band; that consolidation is out of this task's scope.

2. **The frame's "N rows match an existing contact" note has no client-
   side data to back it.** Frame :507's literal text is "9 rows match an
   existing contact by email · those get updated" — a count that can only
   come from the server's dry-run response (`plan.updated`), which does
   not exist until `runPreview()` is called from the Review step, well
   after the match-columns step this note sits in. Rather than fabricate
   an existing-contact count with nothing behind it, this task reused the
   wizard's existing, already-computed same-file dedupe note ("Same-file
   email repeat: N rows · the later row wins", sourced from
   `dedupeCount`) at that position for phone, unchanged from what desktop
   already shows below its column grid. This is a narrower claim than the
   frame's literal copy and should be revisited if/when a planner wants a
   real per-column existing-contact match count computed some other way
   (e.g. a lightweight pre-check endpoint), which is a product decision,
   not a CSS/markup fix.

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
