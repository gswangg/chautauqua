# Contacts v12 DESKTOP (1600) per-frame render verdicts — CRM/pipeline family (w23-g, DEC-976 wave-23 amendment)

Per-frame render VERDICTS for FOUR of Contacts' twelve desktop (1600)
frames in `docs/design/Chautauqua Contacts.dc.html`, entered through the
app's real routes and asserted against jsdom DOM structure (never a
computed style — jsdom applies no stylesheet) or, for the two claims that
are inherently a CSS fact (a phone-only span's visibility default), against
`app/src/pages/contacts/contacts-panels.css`'s own stylesheet TEXT. This is
the first render-verdicted pass over Contacts' desktop half — the sibling
`contacts-v12.md` document is a citation-only ledger for the 390 frames.
Receipts live in
`app/src/pages/Contacts.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

## Coverage: 4 of 12 desktop frames

This lane owns the CRM-surface family:

- **:312** "Pipeline · invitations for next year" — the Kanban board
- **:352** "Duplicates · merge" — the merge compare page
- **:617** "Add to the pipeline" — the enroll dialog
- **:720** "Pipeline · an empty stage" — an empty-column state

**The other eight desktop frames are UN-ADJUDICATED by this lane** and are
explicitly out of scope, per the delegating task:

- :28 "Directory · 1600"
- :229 "Contact · drawer"
- :279 "Import CSV · step 2 of 3"
- :546 "Bulk email"
- :582 "Add to an event"
- :672 "Import CSV · step 3 of 3"
- :770 "Import CSV · the file will not do"
- :808 "New contact"

Coverage reads honestly at 4/12 for this cluster's desktop half until those
eight are separately adjudicated.

## Frame :312 "Pipeline · invitations for next year"

**MOSTLY MATCHES, one additive divergence.** Entered via `ContactsPage` at
`/contacts?tab=pipeline` — the real route and its real `?tab=` navigation,
mounting `PipelineBoard`.

- The head band (`‹ Contacts` back link, H1 "Pipeline", "N people · drag
  between columns" caption — frame :318/:319/:321) MATCHES: the tree's
  `.chq-contacts-pipeline-head` renders the same three elements in the same
  order, with the desktop-only "· drag between columns" clause intact
  (`useIsPhone()` gates it off at phone width, per `PipelineBoard.tsx`'s own
  comment).
- The five columns (frame :323-330, `grid-template-columns:repeat(5,
  1fr)`) MATCH: `.chq-contacts-pipeline-column` renders once per
  `PIPELINE_STAGES` entry, in Identified/Contacted/Interested/Confirmed/
  Declined order, each headed by its own live name + count
  (`.chq-contacts-pipeline-column-name`/`-count`).
- A card's field order (name / company / fit-and-rationale row / age —
  frame :332-339) MATCHES `PipelineCard`'s own child order exactly.
- **DIVERGES (additive, harmless).** The frame's head band (:316-322) draws
  exactly two children — the titles column and the caption span — no
  third, button-shaped control. The tree adds a secondary "Add to the
  pipeline" button there (`PipelineBoard.tsx`'s header `onClick={() =>
  {setEnrollStage(...); setShowEnroll(true);}}`). This is the same control
  that opens frame :617's dialog; the frame apparently expects that dialog
  to be reached some other way (a per-empty-stage tertiary link, frame
  :720's "Add someone to Confirmed ›", is the only in-frame trigger this
  pack draws for it) — the tree's header button is a reasonable additional
  entry point, not a broken one, but it has no frame counterpart.

## Frame :720 "Pipeline · an empty stage"

**DIVERGES (structural), with the empty-column microcopy matching in part.**
Produced via a real API envelope through `mockApi` (18 pipeline entries
split 7/5/4/0/2 across the five stages, zero in `confirmed`) — never by
mounting an empty-state sub-component directly, per the mandate.

- **DIVERGES (structural).** The frame draws an entirely different page
  shape from :312: full app chrome (header/nav), an H1 + "18 people across
  five stages" caption, a **single-stage pill NAV** (Identified · 7 /
  Contacted · 5 / Interested · 4 / **Confirmed · 0** filled solid /
  Declined · 2, frame :749-755) filtering the page to ONE stage at a time,
  and one large empty-state block below it. The tree has no such page: all
  five stages render as permanent, simultaneous Kanban columns
  (`.chq-contacts-pipeline-columns`, verdicted at frame :312 above) — an
  empty stage is just one of those five columns showing its own empty
  block, never a dedicated single-stage page. The frame's single-stage
  pill-strip IS present in the tree, but only as the **phone** fallback
  (`.chq-contacts-pipeline-phone-stages`), confirming it belongs to a
  different width class, not this desktop frame's own navigation.
- **MATCHES.** The empty `confirmed` column's own heading text, "Nobody has
  said yes yet" (frame :757, `STAGE_EMPTY_HEADINGS.confirmed` in
  `PipelineBoard.tsx`), and its tertiary "Add someone to Confirmed ›"
  action (frame :760) both render verbatim inside that one column.
- **DIVERGES (content).** The frame's empty-stage body sentence (frame
  :758) reads "Five people are in **Contacted**. Cards land here when you
  move them, or you can add someone straight to this stage." — naming
  Contacted (5 people, two stages before Confirmed) as the reference point.
  `PipelineBoard.tsx`'s `stageEmptyBody()` instead names the
  **structurally immediately-preceding** stage in the five-stage sequence
  — Interested (4 people here) — producing "Four people are in
  **Interested**. Cards land here…" The second sentence is byte-identical;
  only the named prior stage and its count differ. This reads as the
  frame's own copy picking a stage two steps back rather than one, not a
  tree defect — filed here as a content divergence per the mandate's
  "file it even where the tree looks more considered" instruction.

## Frame :617 "Add to the pipeline"

**MOSTLY MATCHES, two content divergences.** Opened through the real
`PipelineBoard` header control ("Add to the pipeline") that opens it — the
`EnrollDialog`.

- The dialog title, "Add to the pipeline" (frame :624), MATCHES exactly.
- **DIVERGES (content).** The frame draws a per-contact subtitle under the
  title — "Aisha Karim · Vector Foundry" (frame :625) — implying this
  dialog is sometimes opened FROM a specific contact's context with a
  pre-filled target. The board-header trigger this lane exercises opens
  with no subtitle at all (`EnrollDialog`'s `ModalFrame` call passes no
  `subtitle` prop, so `.chq-modal-sub` never renders): there is no contact
  context to name from this entry point, and the dialog's own Contact field
  is a live search, never a pre-filled single target.
- The Stage chip row (all five `PIPELINE_STAGE_LABELS`, frame :627-635) and
  the Fit row (1-5 boxes with the "Ranks people within a stage · optional"
  helper, frame :637-643) both MATCH.
- **DIVERGES (content).** The frame's footer primary button reads "Add to
  pipeline" — three words (frame :661) — while the modal's title (:624)
  and the board-header trigger both read "Add to **the** pipeline" — four
  words. The tree's actual button text is "Add to the pipeline"
  (`EnrollDialog.tsx`'s submit `<button>`), matching the title/trigger
  register consistently rather than the frame's shorter footer label. A
  minor, easily-missed word-count slip in the frame itself.
- The footer's "Cancel" secondary and the "Adding writes a move to the
  activity feed · no email is sent" consequence line (frame :663) both
  MATCH.

## Frame :352 "Duplicates · merge"

**MOSTLY MATCHES, with one back-link content divergence and one
already-adjudicated frame-silent addition.** Entered by mounting
`MergePage` directly (it is itself the leaf route at `/contacts/merge`,
reached only by URL — the same established idiom
`Contacts.frame-verdicts.render.test.tsx`'s own "Merge · 390" case uses,
since `MergePage` is never reached FROM `ContactsPage`).

- **DIVERGES (content, confirmed against `contacts-panels.css`'s own
  stylesheet TEXT — jsdom applies no stylesheet, so a structural read alone
  cannot settle this).** The frame's back link is bare "‹ Duplicates"
  (frame :359). `MergePage.tsx`'s actual back link unconditionally renders
  a `.chq-contacts-merge-back-prefix` span carrying "Contacts · " before
  "Duplicates". That span carries a `display:none` rule **only** inside
  the `@media (max-width:700px)` block (`contacts-panels.css`, confirmed by
  grepping the file for a top-level, non-media occurrence — there is
  exactly one occurrence, and it is inside the media block). Its sibling
  spans that the file's own wave-98 comment describes as "default to
  hidden here, at TOP LEVEL" (`.chq-contacts-merge-pair-count-name`,
  `.chq-contacts-merge-primary-phone-label`) DO carry a real top-level
  rule. The prefix has no such top-level rule, so at 1600 it stays
  **visible** by ordinary cascade — the real desktop link reads "‹
  Contacts · Duplicates", not the frame's bare "‹ Duplicates". This is a
  genuine desktop divergence that the phone-only prior audit
  (`contacts-v12.md`'s "Merge · 390" row) could not have surfaced, since
  the phone media block DOES hide the prefix there.
- The H1 "Merge two records" and the right-flushed "N of M pairs" caption
  (frame :360/:362) MATCH, with no trailing kept-record name — confirmed
  both structurally (`.chq-contacts-merge-pair-count-name` is present in
  the DOM but its class, like the phone label above, carries a real
  top-level `display:none` this time) and via the CSS text.
- The compare-table head — `Field` / `Keeping · <name> · added <date>` /
  `Discarding · <name> · added <date>` (frame :367-376) — MATCHES.
- **ADJUDICATED, frame-silent addition (same disposition already ruled for
  the "Merge · 390" phone frame, DEC-663 wave-17).** The tree draws a
  "which record to keep" radio-pick list (`.chq-contacts-merge-picks`)
  immediately above the compare rows; the frame's head band (:357-362)
  goes straight into the compare-table wrapper (:365) with no picker block
  between them. Per the phone frame's existing ruling, this is necessary
  functionality the compare rows presuppose (they show the RESULT of a
  keep/drop choice a static frame cannot depict being made) rather than an
  open divergence — the same disposition applies identically at desktop,
  not re-litigated here.
- **DIVERGES (content).** The frame's consequence-line sentence (frame
  :388) reads "...move to **the kept record**." — generic, no name. The
  tree's `.chq-contacts-merge-rule-box-rule` carries a
  `.chq-contacts-merge-impact-name` span ("Marcus Okafor") alongside a
  sibling `.chq-contacts-merge-impact-generic` span ("the record you
  keep") — both render in this jsdom tree (no stylesheet applied), but
  `contacts-panels.css`'s TEXT confirms only the generic span carries a
  top-level `display:none` (two occurrences: the top-level hide, and the
  phone-block un-hide); the named span carries none at top level (one
  occurrence, inside the phone block only). So a real desktop browser shows
  the **named** reading ("...move to Marcus Okafor.") where the frame
  drew the generic one — the code's own w2-c comment states this choice
  is deliberate (the head band already names the kept record, so desktop
  keeps naming it directly while phone alone swaps to the frame's generic
  phrasing).
- The footer — "Merge into `<name>`" primary, "Swap which is kept"
  secondary, "Not a duplicate" text link (frame :392-394) — MATCHES.

## Summary

| Frame | Verdict |
| --- | --- |
| :312 Pipeline · invitations for next year | MOSTLY MATCHES (1 additive DIVERGES: unframed header "Add to the pipeline" button) |
| :352 Duplicates · merge | MOSTLY MATCHES (2 content DIVERGES: back-link prefix, impact-line naming; 1 already-adjudicated frame-silent addition) |
| :617 Add to the pipeline | MOSTLY MATCHES (2 content DIVERGES: missing per-contact subtitle, footer button word count) |
| :720 Pipeline · an empty stage | DIVERGES (structural: single-stage page vs. persistent 5-column Kanban; 1 content DIVERGES in the empty-body copy; empty-column heading/action text MATCHES) |

4 of 4 frames in this lane's scope were RENDERED, not merely cited. Every
divergence above is filed in prose only — no desktop byte was moved and no
component or stylesheet was edited to produce this verdict. 8 of Contacts'
12 desktop frames remain un-adjudicated (listed under Coverage above).
