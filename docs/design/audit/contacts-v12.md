# Contacts v12 phone audit (task w1-f)

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
