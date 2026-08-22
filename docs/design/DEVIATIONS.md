# Blessed deviations from the design frames

The frames (design-frames-v12, 158 frames) are the authority. This file lists
every place the implementation deliberately departs from them, with the reason
and the ruling that blessed it. Fidelity audits cite this file instead of
re-flagging these; the design agent should read it as input to any next
iteration — several entries exist only because static frames cannot draw
states, and would dissolve if the frames adopted them.

## 1. Ruled omissions

- **"Archive this event" (frame 09--11, destructive footer)** — NOT built.
  USER RULING 2026-08-16: deferred until a real customer requests it; no
  reference may appear in implementation or docs. The control implies an
  undesigned subsystem (archived-state visibility, un-archive path, public
  lifecycle). Mandate commit 90dcbf73.
- **Settings "Keeping and deleting" retention block
  (`docs/design/Chautauqua Settings.dc.html:1161-1180`)** — NOT built. The
  frame draws a `Keep declined submissions for [24 months]` select, a
  `Keep uploaded files after the event ends` checkbox, and a `Let speakers
  delete their own contact record` checkbox, captioned "After that the
  abstract and reviews are deleted; the contact stays" (:1175). DEC-032:
  no retention column, no endpoint, and no deletion job backs any of the
  three controls — building them alone would declare a setting nothing
  reads. `app/src/pages/settings/ExportsPanel.tsx`'s own header comment
  already records the same non-build.
- **`docs/design/Chautauqua Speakers.dc.html:549` ("Speakers · a write
  failed")** — its status pills are hand-styled in the frame's PRE-inversion
  vocabulary (the old fill-for-overdue/outline-for-complete reading v12
  replaced). DEC-650 (planner ruling, v12m-w2-c): this frame is STALE and the
  implementation does NOT match it. The landed inverted
  `.chq-speakers-status-*` family (v12: complete recedes bare-text, overdue
  is the filled exception) wins everywhere, including this row-rollback
  state — otherwise a cell's meaning would depend on whether an unrelated
  write on the page had just failed, which is not a real distinction any
  reader should have to track. No code change; the frame should be redrawn
  with the current pill vocabulary in a future design pass.

## 2. State-layer additions (frames draw no row/selection states)

The frames render tables and rows stateless; the app has hover fills, active
bands, selections, and dirty states. These rules exist so the drawn geometry
survives contact with state:

- **Shared `.chq-table` first/last-cell 16px insets** — content never touches
  a row fill's edge. Narrow first columns absorb the inset by widening
  (worklist checkbox 42px, submissions select 44px, contacts select 46px,
  results rank 56px). User-filed; frames show no fills, so no insets were
  drawn.
- **Review plan-row 16px right inset** (mirrors the drawn left inset) — the
  actions cluster sat flush against the active band's edge.
- **Bulk-action bars are ALWAYS mounted** (submissions, contacts, content
  worklist): idle is a visible quiet state — one muted `.chq-bulkbar-hint`
  line naming what selection unlocks (on content, plus the "N re-uploads are
  waiting for re-review — Select them" quick-select), no fill, no
  aria-hidden — with geometry identical to the armed bar, so first selection
  never shifts the table (USER RULING 2026-08-16; supersedes the earlier
  invisible + aria-hidden reserved band). Frames draw only the selected
  state in flow; the user ruled the no-shift behavior for all multi-select
  surfaces.
- **Tracks/rooms edit rows use a fixed 200px actions track** (frames draw no
  dirty state) — the dirty-only Save/Cancel pair appears without moving the
  row. Same rule as the people-and-roles rows.
- **Speakers grid task cells top-align on one shared pill line** (fixed 22px
  offset) — a cell that grows a second line (deliverable filename) no longer
  floats its pill off the siblings' line. Frames draw single-line cells only.
- **Disabled tertiary/link-shaped controls keep NO surface and no hover**
  — B8's disabled register (label on --chq-disabled-bg) is read as applying
  to FILLED tiers only; a disabled link-style control renders muted text with
  no box, no underline, no hover response. The frames never draw a disabled
  tertiary.

## 3. Interpretations where the frames underspecify

- **Agenda phone head-band `line-height:1`, DEC-991 wave-156 verdict** —
  `docs/design/Chautauqua Agenda.dc.html:129` draws `line-height:1` on the
  wordmark `<span>` and `:133` draws `line-height:1` on the `<h1>Agenda</h1>`,
  but `app/src/pages/agenda/agenda.css`'s `.chq-phone-agenda-wordmark`
  (around line 1210) and `.chq-phone-agenda-h1` (around line 1240)
  deliberately OMIT `line-height`. `decisions/DEC-991.md`'s wave-27
  amendment bans a display-face `line-height <= 1` outright (measured clip
  receipt: `docs/verification-log.md:3591`, `div.chq-forms-header-titles`);
  `src/decisions-data/DEC-991.md`
  proposed a frame-cited exemption mechanism to carve out this exact case.
  Per `src/decisions-data/DEC-991.md`'s wave-156 amendment, **the ban
  governs**: the exemption mechanism is retired unbuilt and is not to be
  built. The two omitted declarations are blessed as-is because a frame
  drawing `line-height:1` on this 27px display-face `<h1>` inside the fixed
  390×844 card is declaring the HEAD BAND's tightness (the gap between the
  wordmark row, the title row, and the chip row below it) — geometry the
  app already satisfies through the band's own drawn `padding: 14px 16px;`
  and `gap: 12px;` between rows (`gap: 10px;` inside the wordmark row) —
  not a glyph metric the app must reproduce verbatim, and the font's own
  `normal` line box cannot clip by definition. See
  `docs/design/audit/decision-registry-collision-v12.md` for the full
  colliding-id verdict.
- **Track colour picking is a cycle control** — frame 09--12 draws only the
  swatch beside the name; the ruling says "beside the name rather than in a
  separate picker". Selecting the swatch cycles the five system-token
  colours in place. The mechanism (cycle vs popover) is our interpretation.
- **Contact drawer footer** — the frame's footer is buttons-only in the order
  Cancel · Save · Email · Add to event with no helper text. The app keeps
  the recorded A20 ruling (Delete far left as destructive tertiary,
  Cancel/Save as the right-flushed terminal pair) and keeps the save-scope
  sentence on its own line above the bar (added for a judge-verified
  ambiguity; the drawer's section structure alone did not carry it).
- **Wordmark vertical position** — −2.5px optical nudge (glyph-tight line
  box, ink-measured x-height centering + user-tuned 0.75px). The frames
  center the raw line boxes, which reads visually low; the miss exists in
  the design files too.
- **Submissions 390 phone head, DEC-919 amendment (wave 7, task w7-e)** —
  `docs/design/Chautauqua Submissions.dc.html:138-152` draws the phone head
  as two clean bands (wordmark + title row, then search + chip strip) with
  NO action buttons; the app's head carries three (Forms / Export CSV / New
  submission) with nowhere in the frame's copy to put them. Kept, re-lined
  per DEC-919 ("re-line, never remove"): `.chq-submissions-head` stacks the
  titles row above a full-width `.chq-submissions-head-actions` row,
  mirroring the frame's own card action triple at `:164-167` (`flex:1 /
  flex:1 / auto`) — Forms and Export CSV share the row, New submission
  (the primary action) keeps its own content width.
  - `.chq-submissions-columnpicker`'s phone `display:none` (submissions.css)
    **stands**: it governs table columns that are not on the screen once
    the table stacks into cards at 390 — the one legal case DEC-919 allows
    for a control that has nothing left to govern.
  - `.chq-status-pills [data-status]` narrowing to the two named pills
    (submissions.css) **stands**: the frame draws exactly three named
    chips ("Needs triage" / "Accepted" / "All 47"), narrowed per the
    existing wave-2 ruling to the two real status members the app's own
    vocabulary supports (see the comment at the rule's definition).
  - The Sort `<select>`'s phone `display:none`
    (`.chq-submissions-filterbar-searchsort .chq-submissions-filterbar-sort-select`)
    was **deleted**: sorting is a capability the frame never removes, and
    the filterbar strip it sits in already scrolls (`overflow-x:auto`), so
    the control re-lines into the strip at the 44px floor instead of
    vanishing.
- **Plan editor phone dock copy is the new-plan captioning, not a third
  button pair** — `docs/design/Chautauqua Review.dc.html:665-667` draws a
  docked "Save the plan" + "Cancel" pair. An existing plan's title-row
  renders "Duplicate" + "Save" and has no Cancel-while-editing affordance
  anywhere in the app; adding one here would be a behaviour change (and
  would evict Duplicate) with no ruling behind it, which this task does not
  make. The dock (`review.css`'s phone `.chq-review-editor-title-actions`
  block) is a CSS-only fixed-position repositioning of whichever pair the
  title row already renders — new-plan's Cancel/Create or an existing
  plan's Duplicate/Save — never a second copy of the buttons, so a save
  triggered from the dock and a save triggered from the title row are
  always the one `save()` call. The frame's "Save the plan"/"Cancel" copy
  is read as the new-plan state's captioning (matching the title row's own
  "Cancel"/"Create the plan" pair for `isNew`), not as a mandate to add
  Cancel to the existing-plan pair. DEC-745 wave-98 amendment.
- **Sign-in 390 keeps "Forgot your password?", re-lined (DEC-919 wave-114
  amendment)** — `docs/design/Chautauqua Account.dc.html:118` ("Sign in ·
  390") draws the submit row (:127-136) with the primary Sign in action
  alone, full width, and carries no reset link anywhere in the card. Filed
  as an open design gap in `docs/design/audit/account-docs-v12.md` and
  never ruled on until now. RULED: the link stays. A frame is the geometry
  authority, not a capability manifest — reading an omitted control as a
  mandate to delete the only password-reset entry point on phones would
  strand every phone user who forgot their password. This is DEC-919's
  "re-line, never remove" applied at a phone width, and the shipped
  treatment already implements it: `.chq-auth-submitrow` sets
  `flex-direction: column-reverse`, so the full-width primary sits first
  and the tertiary link (`Forgot your password?`) is centred beneath it at
  the 44px floor. See `docs/design/audit/account-docs-v12.md` for the
  resolved finding.
- **Agenda 390 phone dock stays exactly the two frame controls; Publish
  schedule and Breaks live in the head's action row (DEC-380 wave-116
  amendment)** — `docs/design/Chautauqua Agenda.dc.html`'s 390 column
  draws its dock as exactly two controls, `Unscheduled <span
  style="font-size:11px; font-weight:800">6</span></span>` and
  `Auto-schedule` (:199-200), and nothing else. `docs/mobile-campaign.md`
  carried this as an open design question for several waves: "Whether
  [Publish schedule] belongs in the phone dock instead is a frame
  deviation needing a proper ruling later — the frame's dock draws only
  Unscheduled + Auto-schedule." RULED, closing the question: the dock is
  the frame's, unchanged — exactly the two drawn controls, no third. This
  is DEC-919's "re-line, never remove" read the other way around — a
  frame is the geometry authority, not a capability manifest, so its
  silence about Publish schedule and Breaks removes geometry, not
  capability, and neither control has any other home on the phone
  surface. Both stay in the head's own full-width action row at the 44px
  floor: app/src/pages/agenda/agenda.css`.chq-agenda-head-actions .chq-btn,` (drift-proof citation, DEC-967 wave-115) floors
  `.chq-btn` there (Publish schedule), and the dedicated
  `.chq-agenda-head-actions .chq-link-button` rule appended at the end of
  the same phone block floors Breaks, which the shared `.chq-btn` rule
  does not reach.
- **Contact drawer's phone EDIT stack is not the frame's read dock (DEC-959;
  DEC-380 wave-120 struck)** — `docs/design/Chautauqua Contacts.dc.html:433-436`
  draws only the 390 READ screen's footer (Email / Edit, both min-height:48px,
  `padding:12px 16px 16px`), which the app implements via the shell's shared
  `.chq-phone-dock`. The phone EDIT state's five-control bar (Delete this
  contact / Email / Add to event / Cancel / Save) is a state the frame does
  not draw at all, so its shape is our interpretation: it takes the frame
  footer's own floor — min-height:48px, padding:0 16px — one control per line,
  and its capability is reached through the dock's own `Edit` control.
- **Contacts Pipeline keeps its landed head action; no phone dock is minted
  (DEC-576 wave-120/124)** — `Pipeline · 390`
  (`docs/design/Chautauqua Contacts.dc.html:472-475`) draws `Add someone`
  at flex:1 and `Filter` beside it. The app has the first; it has no
  second, and "Filter" names precisely the affordance the frame itself
  draws DIRECTLY ABOVE the list on the same screen — the five-stage
  horizontal scroller at :451-458, landed as
  `.chq-contacts-pipeline-phone-stages`. Minting a dock control that opens
  nothing to satisfy a drawing would INVENT capability, the exact inverse
  of DEC-380 wave-116's finding that a frame's silence removes geometry and
  not capability, and just as wrong; and relocating the single remaining
  action buys a dock whose only member already clears the frame's floor
  where it stands
  (`app/src/pages/contacts/contacts-panels.css`'s
  `.chq-contacts-pipeline-head > .chq-btn {` rule declares width 100%,
  min-height 48px and padding 0 16px). RULED: Merge adopts its dock;
  Pipeline does not, its one action keeps the landed full-width 48px head
  placement, and that is recorded as a blessed deviation rather than left
  as an untracked gap. The general rule this sets, for the drills that
  follow: adopt the band when the frame's membership is satisfiable from
  controls the surface already owns; where a drawn control has no
  referent, keep the app's placement, state which same-screen affordance
  discharges it, and record it — never a control that is only a shape.

- **Portal · Your profile dock has no Cancel (DEC-154 wave-125, DEC-576
  wave-110/wave-119)** — `docs/design/Chautauqua Public and Portal.dc.html:544-547`
  draws a bordered `Cancel` (min-height:48px) beside the docked `Save` on
  this page. The profile form has no "leave without saving" destination
  distinct from the header/footer sign-out and the existing `‹ Your
  portal` back-link already on screen (unlike Edit submission's Cancel,
  which returns to a specific parent submission), so minting one here
  would be a control invented to fill the band — the exact thing DEC-576's
  wave-110 amendment forbids ("a second control is never manufactured just
  to fill the band"). The dock (`src/routes/portal/profile.tsx`'s
  `profileDock`) carries only the primary `Save profile`, reached through
  `PortalLayout`'s existing dock slot the same way `edit.tsx` and
  `index.tsx`'s session-detail dock already do.
  - Round-2's "portal session" row is discharged, not re-opened, by this
    task: `src/routes/portal/index.tsx:496-510` already docks the Upload
    task action + Edit submission through the same `dock` slot as of the
    wave-110 ruling above — no further work was outstanding there.
  - **Shared-vocabulary control labels beat the frame's per-instance copy
    (DEC-613 wave-128 amendment, task w3-m)** — four more rows where a
    frame prints one instance's words and the app composes the same
    control's label from a single shared source; the source governs and
    the frame's literal is not built:
    - Portal task action labels: `docs/design/Chautauqua Public and
      Portal.dc.html:588` docks 'Upload slides' as the session dock's
      primary; `:493` docks 'Mark the release signed' as the tasks dock's
      primary. The app never types either literal. The session dock and
      the row action beside the slides deliverable both render
      src/routes/portal/index.tsx`taskActionLabel(t)`, one function with
      three outcomes — 'Fill out form' for a form task, 'Upload file' for
      a file-request task, 'Open task' otherwise — used at three call
      sites in that file. 'Upload slides' is right only for the one
      file-request task that happens to be slides; every other
      file-request task (a bio photo, a signed release scan, a W-9) would
      carry the wrong verb if the frame's instance copy were built
      literally. The tasks-list dock is the same family with a different
      shared source: src/routes/portal/tasks/views.tsx`tasksPageDockPrimary(`
      resolves the next incomplete task's own control rather than a
      task-specific verb, rendering
      src/routes/portal/tasks/views.tsx`Mark complete` for a general task
      (a signature task is a `general`-kind task in this schema) — never
      'Mark the release signed', which names one instance's subject
      matter, not the action.
    - Portal back-link labels (RETIRED, DEC-029 wave-21): `docs/design/Chautauqua
      Public and Portal.dc.html:565` draws the session screen's back link
      as '‹ Your portal'. The app used to render `<PortalBackLink
      to="/portal/submissions" />` at src/routes/portal/index.tsx, resolved
      through the DEC-914 table
      src/routes/portal/shared.tsx`Your submissions` (`PORTAL_BACK_LINKS`)
      to '‹ Your submissions' rather than the frame's literal — the same
      divergence existed on the tasks drill (frame :507, was
      `to="/portal/tasks"` → '‹ Your tasks'). DEC-029's wave-21 amendment
      repointed both hrefs at `/portal` (the frame's drawn destination for
      every 390 drill except the session-edit one), so both now render
      src/routes/portal/index.tsx`<PortalBackLink to="/portal" />` and
      src/routes/portal/tasks/views.tsx`<PortalBackLink to="/portal" />`,
      resolving through the same DEC-914 table to the frame's own '‹ Your
      portal' — no override needed any more.
    - Docs article pager: `docs/design/Chautauqua Docs.dc.html:201-202`
      draw the phone pager as '‹ Previous' and 'Next ›'. `DocsPager` in
      src/routes/docs-site.tsx`function DocsPager(` renders
      src/routes/docs-site.tsx`{prev.title}` and
      src/routes/docs-site.tsx`{next.title}` instead — the same
      component's desktop rendering already names the neighbour article,
      and the named form is strictly more informative to a reader
      deciding whether to follow the link. Only the frame's GEOMETRY binds
      here: `docs-site.css.ts`'s phone terminal block cites `:201`'s
      `min-height:46px` bordered-button triple for the pager's own shape;
      the copy is the one piece the shared component supplies instead.
    - Portal form primary (cross-reference task w3-l, which docks this
      control): `docs/design/Chautauqua Public and Portal.dc.html:519`
      docks 'Send this in' as the hotel-form primary. `TaskFormPage`
      adopts the frame's docked BAND — geometry, placement, the
      second-submit idiom — and, as of task w4-m on this same wave, its
      word as well: the two submit controls (dock and inline) both render
      src/routes/portal/tasks/views.tsx`TASK_FORM_SUBMIT_LABEL`, one const
      declared src/routes/portal/tasks/views.tsx`= "Send this in"`, in
      place of the "Submit" literal each used to type separately.
      This row therefore records NO divergence in copy —
      it stays in this family because the shape is the family's shape:
      one shared source, two call sites, the frame's per-instance literal
      never re-typed at either. Docking a control is a layout decision and
      naming it a vocabulary one; w3-l settled the former, w4-m the
      latter, and they agree.
    - Cross-reference: `docs/design/Chautauqua Review.dc.html:666` ('Save
      the plan') is the fifth member of this same family, already blessed
      above under "Plan editor phone dock copy is the new-plan captioning,
      not a third button pair" (DEC-745 wave-98) — recorded here so a
      future control-label audit finds all five entries in one place.
- **Plan-editor new-plan footer `Save as draft` / `Open the plan` names an
  unrepresentable state (DEC-380 wave-130 amendment)** — `docs/design/Chautauqua
  Review.dc.html:919-921` draws a footer pair captioned "You can save this as
  a draft plan and open it later". A plan's openness is derived from
  `openDate` alone, and `isPlanOpen(openDate=null, closeDate=null, …)` reads
  an UNSET open date as open NOW (`app/src/pages/review/PlanList.tsx:33-45`),
  so "save without opening" is unrepresentable in the schema and the caption
  would be false if built. The title row keeps its existing `Cancel` /
  `Create the plan` pair (`app/src/pages/review/PlanEditor.tsx:1353-1382`).
  This is the mirror of DEC-380 wave-116's "a frame's silence removes
  geometry, not capability": a frame's DRAWING does not create a data model
  either, and a control minted only to satisfy a shape is the same error
  inverted (DEC-576 wave-110). Re-tested at wave-140 against the narrowed
  rule ("a caption naming data the SCHEMA lacks" — DEC-380 wave-133/135/137
  amendments): `evaluation_plan` (`src/db/schema/review.ts`) still carries
  only `openDate`/`closeDate`, no draft/status column of any kind — the
  clause that keeps this deferred is SCHEMA LACKS THE COLUMN, unchanged.
- **Co-presenter add row keeps its no-email truth over the frame's caption
  (DEC-909 wave-134, task w9-dd; corrected and confirmed by DEC-380
  wave-139)** — `docs/design/Chautauqua
  Submissions.dc.html:298` draws the caption "A new co-presenter is emailed
  a portal link · the lead presenter is not changed". The app keeps
  `SubmissionDetailPage.tsx:1855`'s truthful line ("Adding a co-presenter
  here sends no email — sending a portal invite is a separate, explicit
  action. The lead presenter is not changed.") because
  `src/routes/api/submissions.ts:6` states, and a source-scan test
  enforces, that the submissions routes never import a mailer: adding a
  participant cannot send anything, and the portal invite is a separate
  explicit act (see the DEC-604 wave-70 amendment recorded in the
  component's own comment). The frame's second clause ("the lead presenter
  is not changed") already matches the app; only the first clause is
  superseded. `SubmissionDetailPage.render.test.tsx:1421-1427` pins the
  app's sentence verbatim and calls the frame's version "the stale DEC-900
  'emails them' claim" in its own comment — that pin is the check that a
  literal build of the frame's caption would break. DEC-380's own wave-137
  amendment briefly ruled the OPPOSITE — that the frame's caption is a
  build, not a residue row — without weighing this pin or the mailer-import
  scan; DEC-380 wave-139 corrects that on the merits: a caption that
  asserts a SIDE EFFECT is graded against the app's actual behaviour, not
  merely against whether it has a live referent on screen, and shipping the
  frame's sentence here would ship a lie about the mailer.
- **Reminder skip-window wording stays "reminded", not "emailed" (DEC-909
  wave-134, task w9-dd)** — `docs/design/Chautauqua Speakers.dc.html:697`
  draws the caption "skips anyone emailed in the last hour". The shared
  vocabulary at `app/src/pages/speakers/remindSkipVocabulary.ts:8` says
  "skips anyone reminded in the last hour", which is the true predicate:
  the dedupe gate is `task_assignment.last_reminded_at`
  (`src/server/repo/tasks/reminders.ts:214`), not any generic email send.
  The app's word stands across all 11 consumers of the shared vocabulary
  module; the frame's word is superseded.
- **Agenda 390 phone head band omits the frame's `line-height:1` on the
  wordmark and the `<h1>`; the declaration is BAND geometry, not a glyph
  metric (DEC-991 wave-156 supersession)** — the 390 card's head band in
  docs/design/Chautauqua Agenda.dc.html draws two display-face lines with
  the literal declaration, quoted verbatim: docs/design/Chautauqua
  Agenda.dc.html`font-size:20px; font-weight:700; letter-spacing:-0.03em;
  line-height:1; position:relative; top:-2.5px` on the phone wordmark span,
  and docs/design/Chautauqua Agenda.dc.html`font-size:27px;
  font-weight:700; letter-spacing:-0.04em; line-height:1` on the phone
  `<h1>` immediately below it. app/src/pages/agenda/agenda.css
  `.chq-phone-agenda-wordmark` and app/src/pages/agenda/agenda.css
  `.chq-phone-agenda-h1` both OMIT `line-height`, letting the font's own
  `normal` line box govern instead. This is a deliberate, blessed
  divergence, not an unnoticed miss: two colliding `DEC-991` documents once
  disagreed on this exact point (decisions/DEC-991.md's wave-27 amendment
  bans a display-face `line-height <= 1` outright, citing a measured clip
  receipt — docs/verification-log.md`clip=3px, a genuine clip` on
  `div.chq-forms-header-titles h1`, app/src/pages/forms/forms.css — while
  src/decisions-data/DEC-991.md originally carved out a frame-cited
  exemption for these two selectors). `src/decisions-data/DEC-991.md`'s
  wave-156 amendment resolves the collision: the ban governs, because a
  `normal` line box is by definition the font's own line box and therefore
  cannot clip, while a bare `line-height:1` is not guaranteed to contain
  the glyphs at every size/weight. A frame drawing `line-height:1` on a
  26–27px display-face `<h1>` inside a fixed 390×844 card is read as
  declaring the HEAD BAND's tightness — geometry the app already satisfies
  through the band's own drawn `padding:14px 16px` and `gap:8px` — not a
  per-glyph metric the app must reproduce literally. The frame-cited
  exemption mechanism this entry once implied for
  `test/display-heading-line-height.scan.test.ts` is retired unbuilt; see
  `src/decisions-data/DEC-991.md`'s own head note.
- **Settings embed-edit head omits the frame's `line-height:1` on the
  `<h1>` (DEC-996)** — `docs/design/Chautauqua Settings.dc.html:1047`
  draws the saved-embed edit view's title with the literal, quoted
  verbatim: docs/design/Chautauqua Settings.dc.html`font-size:30px;
  font-weight:700; letter-spacing:-0.04em; line-height:1`. Commit
  `bee981791` copied that declaration verbatim onto
  `.chq-settings-embed-edit-head h1`, tripping the same display-face
  `line-height<=1` ban the Agenda entry immediately above resolves — a
  frame's drawn literal is authority for geometry, never a defense
  against a design-system ban (DEC-996). The declaration is deleted
  outright (never substituted with 1.05, never scan-exempted), the same
  disposition as the Agenda wordmark/`<h1>` pair: the rule keeps `normal`
  (the font's own line box) to contain the glyphs.
- **Plan editor's v4 title-row shell is BLESSED, not the unrecorded
  divergence the audit flagged, and the `Reviewers` → `Who reviews what`
  section-heading rename ships as part of the same shell (DEC-745
  wave-20 amendment).** `docs/design/Chautauqua Review.dc.html`'s 390
  plan-editor frame draws the plan name as a standalone `<h1>`, a
  separate footer band with `Save the plan` / `Cancel`, and labels the
  reviewer roster section `Reviewers`. `docs/design/audit/review-v12.md`
  recorded this shell as the plan editor's one surviving divergence and
  said it was unrecorded here. It is not a removal: the frame's static
  `<h1>` cannot express renaming, so `app/src/pages/review/PlanEditor.tsx`
  keeps the plan's rename capability in its editable
  `aria-label="Plan name"` input, on the same `chq-review-editor-title-row`
  as the `‹ Review` back link and Duplicate/Save (already recorded above
  under "## 7. Settled frame divergences"), and the footer band's
  `Save the plan` / `Cancel` are the same two controls re-lined onto that
  row, not dropped. The roster heading rename is the DEC-745 wave-98
  amendment's own text, not an unblessed rewording:
  `app/src/pages/review/PlanEditor.tsx` renders
  `<h2 className="chq-section-label">Who reviews what</h2>` in place of
  the frame's `Reviewers`. `src/decisions-data/DEC-745.md`'s wave-20
  amendment rules both.
- **The Contacts 390 rule chip's label ink resolves to `--chq-brand`, not a
  third olive (DEC-367 amendment, wave-16 r5).**
  `docs/design/Chautauqua Contacts.dc.html:190` draws the active-rule chip
  with `border:1px solid #4E5C31; background:#EFF1E4; color:#2E3A16`, one
  step darker than its own border. The palette has no third olive between
  `--chq-brand` (#4e5c31) and `--chq-brand-hover` (#3c471f), and spending a
  hover/active token as the chip's REST ink would make the label's own B8
  hover state a no-op against the identical hover rule already declared on
  `.chq-contacts-filter-rule-chip-edit`. So `#2E3A16` resolves to
  `--chq-brand` instead — the app draws the chip's label and its border in
  the same olive where the frame draws the label a step darker — which
  restores a strictly monotone rest → hover → active ladder
  (`--chq-brand` → `--chq-brand-hover` → `--chq-brand-active`). Two further
  approximations on the same chip, neither byte-equal to the frame and
  both now recorded as such rather than claimed `exactly`: the chip's
  background `#EFF1E4` resolves to `--chq-surface-sunk` (#efebdf), and the
  dismiss glyph's `#5E6B47` resolves to `--chq-muted` (#565a4b). All three
  are the palette's nearest existing tokens; none mints a new hex literal.
- **`.chq-submissions-table-wrap` (`app/src/pages/submissions/submissions.css`)
  is BLESSED-DEFENSIVE for the organiser-toggled custom-column picker
  content class (DEC-367 wave-34 amendment).**
  `docs/design/Chautauqua Submissions.dc.html` draws the results table on a
  fixed 1600px desktop canvas (`:32`/`:190`/`:402`/`:565`/`:609`) with no
  `overflow-x` anywhere — the frame is a static mock of one fixed column
  set, so it has no way to draw what happens when an organiser toggles
  `.chq-submissions-columnpicker-panel`'s optional columns on. The wrapper
  exists to hold that live-configured, wider-than-fixed-canvas table, not
  to compensate for anything the frame drew and the app dropped. No frame
  line is cited because none applies: a static canvas cannot depict a
  column set the viewer chooses at runtime.
- **`.chq-day-grid` (`app/src/pages/agenda/agenda.css`) is BLESSED-DEFENSIVE
  for the live room-lane matrix content class (DEC-367 wave-34
  amendment).** The day grid lays rooms across the top and time down the
  left; the room count is live event data, not a fixed design-time
  quantity, so no `docs/design/Chautauqua Agenda.dc.html` frame can draw
  the matrix at every width a real room count could produce. The frame
  draws one snapshot count on a fixed canvas; the scroller exists so the
  matrix keeps working when an event's real room count exceeds whatever
  count that snapshot happened to show. This is the same "deliberately
  wide matrix that scrolls inside its own container" shape DEC-424 already
  blesses for other data-sized layouts, applied here to room lanes instead
  of columns.
- **`.chq-docs-code` (`src/routes/docs-site.css.ts`) is BLESSED-DEFENSIVE
  for the author-supplied markdown code-block content class (DEC-367
  wave-34 amendment).** `docs/design/Chautauqua Docs.dc.html`'s "Docs · an
  article" frame (`:27`) sets the article's reading measure to 680px but
  never happens to render a fenced code block in its one captured article,
  so no frame line draws this exact scroller. Docs articles are
  markdown-sourced prose whose authors can paste code of any line length;
  the scroll container exists so that content class does not blow out the
  680px reading column, independent of which article the frame's mock
  happened to snapshot.
- **`table` / `pre` (`src/routes/portal/portal.css.ts`) are
  BLESSED-DEFENSIVE for the embedded-content content class (DEC-367
  wave-34 amendment).** "Chautauqua Public and Portal.dc.html" draws no
  `<table>` and no preformatted block anywhere in its portal frames, so
  neither selector has a literal frame citation. Portal pages render
  organiser-authored embedded content (the same class of author-supplied
  material `.chq-docs-code` guards above, on the portal side of the
  product) whose shape the static frame set cannot enumerate in advance;
  the rule gives any such embed its own scroll container instead of
  letting it push the page wide, which is a property of the content class
  and not of any one frame's drawn example.

## 4. Voice

- **Docs prose follows the STE-derived house rules, not the design's "house
  voice" note** — USER DIRECTIVE arc: full ASD-STE100 (writing rules +
  Issue-9 dictionary) applied 2026-08-16, then deliberately relaxed to
  writing-rules-plus-natural-rhythm (dictionary conformance retired; the
  declared technical-names glossary kept at
  src/routes/docs-content/technical-names.ts). Bans that stand: should/might
  ambiguity, metaphors, synonym wobble on domain terms.

## 4a. Docs screenshots: tall frames, prepared states, and focus (USER RULINGS 2026-08-16 / 2026-08-17)

DESIGN-RULINGS.md:308-316 rule 1/3 said every docs figure is "exactly
1600 x 900", "full frames, not crops". The user OVERRODE that on release
night, after reviewing the shot set: *"theyre all cutoff"*. The admin shell
scrolls inside `.chq-main`, not on `<body>` (app/src/styles.css), so a
1600x900 viewport clip cut every long screen off mid-row — a crop by another
name, and worse than a tall figure.

What changed in `scripts/docs-shots.ts` / `scripts/docs-shots-lib.ts`:

- **Capture is `fullPage` by default, still at 1600 wide.** The width is the
  invariant; the height grows to whatever the screen actually needs
  (`growViewportToFit`, capped at 6000px). `capture: "frame"` keeps the
  literal 1600x900 viewport and is used ONLY for `position: fixed` overlays
  (modal cards, `.chq-toast`), which a tall frame strands instead of showing.
- **A row may declare `prep` steps** — click / clickRole / fill / select /
  upload / waitFor — so a figure can show the STATE its caption names. Same
  user report: several figures were byte-identical route twins whose captions
  promised different states (a new break, an import dry-run, a recused queue
  row, a compose result). The interactions are performed in the real app, by
  the same personas, against the same seed.

### Focus: clips and highlights on same-screen figures (USER RULING 2026-08-17)

The user reviewed the re-shot set and filed a second defect against the same
surface: *"the agenda screenshots are still not distinct. if we have to use
the same screens, we should at least highlight what the focus is in each
context."* Three figures were tall captures of the same `/admin/agenda`
screen, and at the docs page's ~820px rendered width the things that made
them different — a 20-minute break strip, a publish report — shrank to a few
pixels. Rule 5's "no drawn annotation" and rule 3's "full frames, not crops"
are OVERRIDDEN for this case, narrowly:

- **`clip: { selector, padding }`** — the frame becomes a **vertical band**
  around one element: still the full declared 1600 width (that is the real
  invariant; a doc set at mixed widths is not comparable), with `padding` px
  of page kept above and below. Generous context is required, not optional —
  a band with nothing around its subject is the crop the rule forbade.
- **`highlight: { selectors, dim? }`** — a `var(--chq-brand)` outline plus a
  soft glow on the caption's subject, optionally fading everything else to
  0.34. **No arrows, no callouts, no added text**: only the subject's own
  edge is drawn. The treatment is injected by `scripts/docs-shots.ts` with
  `page.addStyleTag` at shutter time and never exists in app code, and it is
  layout-neutral by construction (`outline` + `box-shadow` + `opacity`), so
  the figure is the pixels the app really renders with an edge drawn on them.

Applied where a figure's subject was not obvious at ~820px, or where two
figures read as the same screen twice: the three agenda figures (tray /
break band / publish report), the embed builder inside a 3271px Settings
page, the CFP field dialog, the compose send report, and the recused reviewer
queue. The `/admin/overview` twin (`getting-started-start-here-01` and
`running-the-software-running-the-software-01`) stays deliberately full and
untreated — both captions genuinely describe the whole dashboard — and
`test/docs-shots-manifest.test.ts` pins that.

Unchanged: seeded data only (DevFlow Conf 2027), no image post-processing, and
the shoot is still a script that is re-run every release. Mutating prep flows
(publish, send, recuse, add a break) are legal because the shoot runs against
a dev server that is reseeded afterwards; the CSV-import flow deliberately
STOPS at the dry-run step so it writes nothing at all.

## 5. Pending adjudication (not yet blessed — sweep should verdict)

No adjudication is currently open. The tracks-and-rooms save model this
section used to list as pending was verdicted by the G13 srv1 adjudication
and is recorded, resolved, in §6's "Adjudications recorded" — see
"Tracks-and-rooms save model" below.

## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)

The G13 frame-complete sweep confirmed these frames draw features or reworks the
build does not carry. The user blessed deferring them past the submission
deadline; they are scope decisions, not defects. Audits cite this section
instead of re-flagging.

**Unbuilt features (no data model or endpoint behind the drawing):**
- "Your data" edit view: retention select, keeping-and-deleting checkboxes,
  revoke-every-token footer (09--16). Drawn at
  `docs/design/Chautauqua Settings.dc.html:1111` (`Settings · editing your data`).
  The block's head consequence line, `docs/design/Chautauqua Settings.dc.html:1139`
  ("Retention applies to every event in this org"), is part of the same
  deferral and returns verbatim the moment the block is built (DEC-032,
  task w9-kb).
- Tracks/rooms drag-handle reordering — no server-side order field (09--12).
- Public-pages Publish/Unpublish control (09--07) and saved-embed "in use on"
  host column (09--09) — no backing data. Same disposition for the Settings
  resource-delete modal's download-count line
  (`docs/design/Chautauqua Settings.dc.html:1422`, "Downloaded 18 times by 12
  speakers"): the `resource` table (`src/db/schema/content.ts`) carries no
  download-count column and no read-tracking endpoint exists anywhere in the
  repo, so the count is absent by design — building a counter over a column
  nobody writes would be exactly DEC-851/DEC-988's declared knob with no
  reader (DEC-032, task w4-aq).
- Per-person scope column and per-row Change on people-and-roles read view —
  users are org-scoped (09--02/--14).
- Hotel-form save-draft, per-recipient reminder triage rows, speaker-detail
  header restructure (04/07 frames).
- AI-assisted triage (eval ABS-14) — roadmap, never sketched in frames.
- Plan editor reviewer-row "Swap" — `docs/design/Chautauqua Review.dc.html:652`
  draws `<span ... >Swap</span>` as each reviewer row's action. There is no
  reassign-in-place capability anywhere in the domain or route layer (only
  assign and unassign exist), so the copy stays "Remove" behind
  ConfirmDialog (DEC-941). The row's GEOMETRY already matches the frame —
  `border:1px solid #BAB6A6; border-radius:6px; min-height:44px;
  display:flex; align-items:center; padding:0 14px; font-size:13px;
  font-weight:600` (`Chautauqua Review.dc.html:652`) — only the label
  differs. DEC-745 wave-98 amendment.
- Portal task-list dock "Later" — `docs/design/Chautauqua Public and
  Portal.dc.html:492` draws the "Portal · Your tasks" dock as `Mark the
  release signed` (flex:1, olive, min-height:48px) + `Later` (bordered
  secondary, min-height:48px). The dock's GEOMETRY is legitimate and may
  be built for whatever primary the page already renders — but the
  portal task model exposes only complete-or-not: `src/routes/portal/**/
  *.tsx` and `src/server/repo/portal*` carry no snooze, defer, dismiss, or
  later capability anywhere in the tree. "Later" persists nothing, returns
  on no schedule, and is visible to no organiser, so the second button's
  copy is not manufactured — it names a real gap in the domain. DEC-967
  wave-106.

**Reworks larger than the freeze window:**
- CSV import "THE FIRST THREE" rejection screen (560 card, no step rail,
  download-the-rows action) — the validation itself SHIPPED; this is the
  presentation (08--15).
- Embed editor drill-page anatomy (09--15), Sessionboard importer modal +
  per-entity dispositions (09--25), plan-editor footer draft-vs-open model,
  email HTML shells' CTA/callout/signature anatomy (07--09..12), shared
  ConfirmDialog 480/subtitle/typed-label anatomy (09--21/22), portal
  resources-block rework (09--13), docs IA expansion (14 further articles).
  The Sessionboard importer modal is drawn at
  `docs/design/Chautauqua Settings.dc.html:1507` (`Import from Sessionboard`).

**Adjudications recorded:**
- Portal measure WIDENED against the frames: --chq-portal-measure 560px (drawn)
  -> var(--chq-measure) (the 820px admin/overview measure). USER RULING 2026-08-16 (release night): the 560 column reads as a
  phone view on desktop. Single-token change; the portal keeps its narrow
  editorial character relative to the 820 admin measure.
- Tracks-and-rooms save model: per-row dirty-reveal BLESSED (G13 srv1
  adjudication); frame 09--12's page-footer model filed as post-deadline
  rework. The Done control now confirms before discarding dirty rows.
- Auth input fill stays `--chq-surface` (`#FAF8F2`); no change. RULED
  (DEC-383 wave-114 amendment): `docs/design/Chautauqua Account.dc.html`
  draws `background:#FFFFFF` on the desktop card's inputs at :195, :248,
  :253, :310, :314, while the same file's 390 cuts sample the identical
  controls at `background:#FAF8F2` (:130, :134, :161, :165, :169) — already
  `--chq-surface`, already what the app ships. Grounds, in order: (1) the
  pack contradicts itself on one control in one file, so no single frame
  reading licenses the literal; (2) `#FFFFFF` is not a palette member and
  DEC-383's colour-literal closure allows exactly one allowlisted
  exception, which this is not; (3) the campaign freezes desktop, where a
  desktop-affecting change is legal only when a v12 desktop frame DEMANDS
  it, and a demand cannot be read off a contradiction. No code changed;
  the frame should be redrawn with a single consistent input fill in a
  future design pass, the same way §1's stale-speakers-pills entry is.
- Settings 760 measure (09--00) rejected: collides with the app-wide 820
  measure token (DEC-744/DEC-808).
- Speakers status vocabulary under write-failure (DEC-730, wave-90
  amendment): `Chautauqua Speakers.dc.html:549` ("Speakers · a write
  failed") draws a hand-styled filled-olive Complete pill / ink-outlined
  Overdue / outlined Pending, contradicting the inverted `DONE`/`PEND`/`LATE`
  vocabulary every other cut of the grid in the same file draws (:28/:129,
  :598, :665). Ruled stale — a status field cannot change its
  meaning-to-appearance mapping depending on an unrelated write outcome; the
  v12 inversion is one vocabulary in every state, including under a
  write-failure banner. No code changed; the app already implements the
  inverted vocabulary everywhere.

- Speakers status-chip HOVER: quiet background tint, NOT the frame's
  style-hover box-shadow ring. USER RULING 2026-08-19 (v12 review): the
  frame's 2px outset halo (`Chautauqua Speakers.dc.html` style-hover;
  DEC-383/DEC-989, DESIGN-RULINGS.md:113) was drawn around FILLED status
  pills. After v12's weight inversion two of the three states paint no box
  at all, so on screen the halo reads as a rectangle floating around loose
  text rather than a control lighting up. The family now tints with
  `--chq-surface-sunk` on hover -- the same quiet-tint register
  `.chq-nav-link`, `.chq-table tbody tr` and `.chq-contacts-row` already
  use -- rounded by the density rules' `var(--chq-r-ctl)`. Scoped to
  `button.chq-speakers-status`: the identical classes also render as
  read-only `<span>` labels (the task view's roomy chips, the neutral
  content/session chips), and hover feedback on a non-control is a false
  affordance. `-overdue`, the one modifier that paints a fill, lightens one
  step inside the ink family instead of tinting cream, so the page keeps its
  one strong mark. Keyboard `:focus-visible` is untouched and still wears
  the 2px brand ring -- now rounded by the same radius. This supersedes the
  wave-64 reasoning that deliberately KEPT the `#CFC7B7` shadow.
- Focus/hover ring GEOMETRY on bare-text controls: cancelled inline padding.
  USER RULING 2026-08-19 (v12 review): a control with no inline padding
  shrink-wraps its ring around the glyphs, which reads as a cramped native
  ring. The quiet-action families (`.chq-link-button`, `.chq-btn-tertiary`
  in both stylesheet roots, the dense/roomy status chips) carry
  `padding-inline` cancelled by an equal-and-opposite negative
  `margin-inline`, so the ring and the hit box gain room while no glyph
  moves. The invariant that rides with it: wherever such a family renders as
  ADJACENT SIBLINGS, the rule owning their separation adds the cancelled
  padding back, or the rendered gap closes (this regressed the two-session
  identity cell on the roster grid before it was measured and fixed). The
  ring is rounded with `var(--chq-r-ctl)`, the same corner `.chq-btn`
  already uses.
- Contacts 390 rule chip: the frame's drawn `gap:9px` is now met as HIT-BOX
  separation, not literal optical separation (DEC-393 wave-16 r4
  amendment). `docs/design/Chautauqua
  Contacts.dc.html:190` draws `gap:9px; padding:0 12px` between the chip's
  edit label and its `✕` dismiss control. Meeting the 44px width floor on
  both (DESIGN-RULINGS.md:189) makes each an outward-only cancelled-padding
  box, per the invariant above — no negative margin faces its sibling — so
  the two 44px hit boxes now sit edge-to-edge with a real 9px gap between
  them. Because the `✕` glyph is only ~10px wide and its 44px box is mostly
  empty on its leading side, the READING between the label's last glyph and
  the ✕ is optically wider than 9px, even though the hit-box separation is
  frame-exact. The 44px width floor and a literal 9px drawn gap between
  glyphs cannot both hold at this glyph size; the floor wins per DEC-393,
  and this optical residual is recorded rather than left as a silent
  divergence.
- Portal-resource modal Kind pair `File` / `Link` (`docs/design/Chautauqua
  Settings.dc.html:1463-1464`) — this product's second resource kind is a
  wiki page with stored markdown, not a link; there is no link kind to
  build. The chips stay `File` / `Wiki page`
  (`app/src/pages/settings/ResourcesPanel.tsx`). DEC-380 wave-130 amendment,
  reconfirmed wave-140: the resource-content schema's `kind` column
  (`src/db/schema/content.ts`) is still populated only by `'file'` and
  `'wiki'` — the clause that keeps this deferred is THE PRODUCT HAS NO SUCH
  OBJECT, unchanged.
- CFP not-yet-open page's link now points at the prior edition — THIS
  RETIRES the entry recorded above through wave-149 (DEC-745 wave-150
  amendment). `NotYetOpenPage` (`src/routes/public/submit-views.tsx`)
  resolves `getPriorPublicEvent` (`src/server/repo/public/event.ts:79`) at
  each of its three call sites — `submit-get.tsx`, `submit-post.tsx`,
  `submit-draft.tsx` — and, when a qualifying prior edition exists
  (same-org, most recent event whose `endDate` precedes this event's
  `startDate`, with a non-zero publicly-visible session count), renders the
  frame's own label `Browse last year's sessions ›`
  (`docs/design/Chautauqua Public and Portal.dc.html:1543`) pointing at
  `surfacePath(lastYear.event, "sessions", "/e")` — the same path helper
  the public sessions fresh-empty page's "Last year" aside already uses
  (`src/routes/public/sessions.tsx:397-410`). With no qualifying prior
  edition the page keeps its original link and label unchanged —
  `Browse the sessions ›` to this event's own `/e/:slug/sessions` — per
  DEC-986's rule against fabricating a destination the window state cannot
  know. No further code change beyond the wiring; this entry only
  reconciles the authority with the landed build.
- Contacts Pipeline · 390 dock IS minted — THIS REVERSES DEC-576
  wave-120/124's "no phone dock is minted" ruling recorded in §3
  (v12m-w19-a, DEC-967 wave-145 amendment). `Pipeline · 390`
  (`docs/design/Chautauqua Contacts.dc.html:472-475`) draws `Add someone`
  at flex:1 and `Filter` beside it; the earlier ruling held that "Filter"
  had no referent worth minting a dock for and kept the single action in
  its landed full-width head placement. That premise no longer holds: the
  same 390 screen already renders, directly above the list, the five-stage
  horizontal facet strip `.chq-contacts-pipeline-phone-stages` — and
  `PipelineBoard.tsx` now docks both controls (`data-chq-phone-dock`),
  wiring `Filter` to open that same five-stage set as a sheet
  (`showPhoneFilter`) rather than inventing a new capability. The dock's
  membership is satisfied entirely from controls the surface already
  owns — exactly the general rule the superseded ruling itself set
  ("adopt the band when the frame's membership is satisfiable from
  controls the surface already owns"); wave-120/124 read that clause as
  pointing away from a dock, wave-19-a's build shows it was always the
  argument FOR one. No further code change; this entry only reconciles
  the authority with the landed build.
- Field-name eyebrows drawn as bordered chips, rendered as plain text — A
  CLASS, not a per-row allowlist (DEC-393 wave-155 amendment, task pe).
  `test/desktop-control-floor.scan.test.ts`'s desktop drawn-floor ledger
  extracts any pack element carrying `min-height:NNpx` + `border-radius` +
  (`border:` or `background:`) as a DRAWN CONTROL, with no way to tell a
  real interactive control from decoration — a scan cannot infer
  interactivity from a border. Twelve of that ledger's 23 wave-151
  offenders are the pack drawing a plain field-name or section-name label
  ("First name", "Last name", "Company", "Sessions", "Reviewer", "Speaker",
  "Form") inside a bordered chip shape at 44-46px, where the app correctly
  renders the SAME name as an unbordered text label:
  `.chq-portal-field-label` (contact/portal/invite field labels),
  `.chq-page-title` (page/section eyebrows named "Speaker"/"Reviewer"),
  `.chq-section-label` (section headers named "Sessions"/"Form"). None of
  these three classes is a control anywhere in the app — no click handler,
  no href, no form association — and none carries or needs a min-height: a
  text label has no tap target to floor. BLESSED: the twelve rows stay
  offenders in the ledger (the scan has no decoration/control distinction
  to encode a waiver into) but no CSS byte moves for them. Any FUTURE row
  the ledger reports whose resolved token is one of the three classes above
  and whose drawn label is a bare field/section name (not a value, not a
  button caption) is the same class, blessed the same way — a scan finding
  in this shape is not itself grounds to add real interactivity CSS.
  Measured on this branch (`docs/design/audit/desktop-control-floor-v12.md`
  carries the row-by-row receipts): `Chautauqua Contacts.dc.html:601/602`,
  `:824/828/839`; `Chautauqua Public and Portal.dc.html:1435/1439`;
  `Chautauqua Settings.dc.html:1287/1291/1302`; `Chautauqua Speakers.dc.html:209`.

## 7. Settled frame divergences (wave 16 amendment, DEC-663)

Five measured divergences, re-derived against main and closed here so no
future wave spends a lane re-deriving them. `src/decisions-data/DEC-663.md`
carries this section's ruling in full; these five entries are its record.

- **Contacts Merge · 390 picker block.** The frame's 390 drill goes straight
  from the head band into the field-by-field compare rows: `docs/design/Chautauqua Contacts.dc.html:528` `mergeRows` opens the
  compare loop immediately after the head's subtitle line, drawing no
  intervening control. `MergePage` renders an additional radio list above
  those rows: app/src/pages/contacts/MergePage.tsx`chq-contacts-merge-picks`.
  It selects WHICH pair is being merged — a capability the frame's
  already-chosen-pair mock (its subtitle names one fixed pair, "Marcus
  Okafor") silently assumes — so removing it would strand a 3+-member
  duplicate group's route to a usable merge. `src/decisions-data/DEC-663.md`
  already deferred this decision here; this entry closes that deferral.
- **Speaker portal landing's fourth section and its Resources footer link.**
  `docs/design/Chautauqua Public and Portal.dc.html:414` opens the "Two
  things to do" 390 landing frame and draws no further section past its
  task list. `GET /portal` renders a fourth section between "Waiting on
  you" and "Your session": src/routes/portal/index.tsx`Your submissions`,
  and a footer link the frame also omits: src/routes/portal/index.tsx`chq-portal-footer-resources`. Both are shipped
  product ruled real by DEC-729 and DEC-988: the frame predates the
  features, so the frame is stale, not the route.
- **Speakers 390 landing's "Roster ›" trigger.** No Speakers 390 frame draws
  an entry point into the roster drill — the landing cut's own action row
  ends with Filter and nothing after it — but the drill's own destination
  frame IS drawn: `docs/design/Chautauqua Speakers.dc.html:260` `Roster ·
  390` (line begins the 390 card). Without a trigger that destination is
  unreachable dead code, so the app adds the narrowest possible entry point:
  app/src/pages/speakers/OnboardingGrid.tsx`chq-speakers-phone-roster-link`.
  The component's own comment beside it already records this as scaffolding,
  not a frame match.
- **Submit-a-talk's `Format` legend.** The frame draws the bare word
  `Format`: `docs/design/Chautauqua Public and Portal.dc.html:1051` `Format`
  labels the 390 submit form's format-choice group. `FormatChoices` renders
  `<legend>{field.label}</legend>` (src/routes/public/submit-views.tsx`<legend>{field.label}</legend>`), and the seeded
  fixture's stored label is "Session format", not the frame's bare word. The
  label is ORGANIZER-AUTHORED content — the frame is sampling one fixture's
  value, not specifying a product string — so hardcoding the frame's word
  would overwrite what an organizer typed into their own CFP form.
- **CFP wizard dock's `Save draft` vs the frame's `Draft` — ALREADY RULED,
  recorded here only so the ledger stops re-filing it.**
  `src/routes/public/cfp.css.ts` states the disposition in the sheet itself:
  the accessible name stays "Save draft" per DEC-613's wave-96 amendment,
  one control with one name at every width, and the frame's `Draft` is a
  drawing abbreviation rather than a label to ship. Cite the sheet, not a
  line number: src/routes/public/cfp.css.ts`the accessible name stays "Save draft" per DEC-613 wave-96 amendment`.
- **Plan editor's v4 title-row shell (name-as-input + Duplicate/Save on the
  back-link row) is BLESSED, superseding the frame's separate-H1 +
  footer-Save/Cancel anatomy.** `docs/design/Chautauqua Review.dc.html`'s
  390 plan-editor frame draws a standalone `<h1>` plus a docked
  footer `Save the plan`/`Cancel` pair below the fields. The shipped shell
  instead renders the plan's name as an editable
  `<input aria-label="Plan name">` with `Duplicate`/`Save` on the SAME row
  as the `‹ Review` back link (`app/src/pages/review/PlanEditor.tsx`'s
  `chq-review-editor-title-row`) — rebuilding the frame's separate anatomy
  would delete rename-in-place, a shipped capability the frame predates,
  and the row's Duplicate/Save-not-Cancel pair is itself an earlier,
  already-blessed deviation (DEC-745 wave-98 amendment, recorded above).
- **Settings · Event's read-drill footer has no Cancel.** The frame draws a
  content+Save/Cancel-footer anatomy for the drilled Event screen; the read
  view instead stands the head's own "Change" action down at 390 (a read
  view holds no form to submit, so no Cancel is manufactured to pair with
  it) because the read drill's own footer primary already carries the
  identical edit route: app/src/pages/settings/settings.css`.chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action {`.
  The frame's full Save/Cancel pair renders in the edit drill itself, where
  a form genuinely exists to submit or discard:
  app/src/pages/settings/EventSettingsPanel.tsx`className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>`.
  This is the same never-manufactured-to-fill-the-band principle recorded
  above for the portal tasks and profile docks (this section's "Portal ·
  Your profile dock has no Cancel" entry, and the tasks dock's identical
  "Later" omission) — a control is drawn only where a same-screen affordance
  actually discharges it, never invented to complete a shape the frame
  drew.
  What was genuinely missing — a level-1 heading naming the plan, since
  the name previously existed only as a form-control's `aria-label` — is
  now built: `PlanEditor.tsx` renders one visually-hidden
  `<h1 className="chq-review-editor-title-h1">` naming the current plan,
  styled by a top-level (non-media) rule in `app/src/pages/review/review.css`
  since a heading carrying the string the input already shows is not a
  desktop geometry change (DEC-385). The input keeps its `aria-label` and
  stays the one rename affordance — the heading is not a second editable
  copy of the name (DEC-613). DEC-745 wave-19 amendment.
- **A `ModalFrame` dialog's title stays an `<h2>` referenced by
  `aria-labelledby`, not the frame's `<h1>`.** Every `docs/design/*.dc.html`
  390 drill frame that stands in for a `ModalFrame`-built dialog (e.g.
  `Chautauqua Contacts.dc.html:410` "Contact · 390") draws its head as an
  `<h1>`, because a static frame has no concept of "this screen is a
  dialog layered over a page" — it draws every full-screen drill as if it
  were the page. `ModalFrame.tsx` renders the dialog's title as an
  `<h2 id="…">` and points the dialog's `role="dialog"` root at it via
  `aria-labelledby`, which is the correct document outline for a modal:
  the page underneath already owns the one `<h1>` for that route, and a
  dialog is a transient layer on top of it, not a replacement page. The
  frame's `<h1>` is a drawing convention for a full-screen drill, not a
  semantic instruction — demoting the page's real `<h1>` so a dialog's
  title could outrank it would trade an accessibility contract (one
  `<h1>` per document, dialogs labelled relative to their trigger) for a
  pixel-level resemblance to the mock. Left as `<h2>`; the title's visual
  register (size/weight/tracking) still matches the frame at 390 (v12m-w21-m,
  DEC-613 wave-21, `app/src/components/modal-frame.css`) — only the tag
  name diverges, and it diverges on purpose. Recorded here per DEC-613
  wave-21's ruling so no future wave spends a lane rebuilding it.
- **Contacts 390 stands down three purely-informational readings with no
  surviving path (wave-16 r5 amendment, `src/decisions-data/DEC-919.md`).**
  Two title-row summary clauses and one rail aggregate are lost outright at
  390, not re-lined: **returning speakers** (`ContactsApp.tsx`'s
  `stats.returningSpeakers > 0 ? countOf(stats.returningSpeakers,
  'returning speaker') : null` clause — "R returning speakers"), **reach
  across events** (its `stats.eventCount > 1 ? across N events : null`
  clause, template-literal-built — "across E events"), and the
  DirectoryRail's **ranked top-companies aggregate**
  (which companies rank highest, and by how much, over the full directory
  — `contacts.css`'s `.chq-contacts-rail { display: none }`; only the
  drill-through action on `{field:'company', op:'eq', value:<name>}`
  survives, via the FilterRulesPanel "+ Rule" chip composing the identical
  rule by hand, which already requires knowing the ranking the aggregate
  supplied). All three are readings with no action attached — DEC-919's
  capability carve-out is about capability, not information — and the
  frame's phone band has no slot left for any of them:
  `docs/design/Chautauqua Contacts.dc.html:180` `border-bottom:1px solid
  #1B1D17; padding:14px 16px; flex-shrink:0; display:flex;
  flex-direction:column; gap:11px` is the frame's ENTIRE 390 head band,
  already fully spent on the wordmark row, the page title and the
  re-lined three-clause summary, with no further row for a fourth or
  fifth clause, and the frame's phone body below it is the scrolling card
  list alone, with no rail slot at all. Stood down as recorded
  deviations, not silently dropped inside a receipt that claims
  re-lining.
- **Settings · Event's Slug field stays "Slug", not the frame's "Public
  URL" (DEC-613 wave-24 amendment).** `docs/design/Chautauqua
  Settings.dc.html:739` `Public URL` labels a field whose drawn value is a
  full rendered origin+slug (`chautauqua.cc/e/devflow-conf-2027`), but
  `EventSettingsPanel.tsx`'s control edits the slug segment alone —
  `app/src/pages/settings/EventSettingsPanel.tsx``value={form.slug}`. The
  panel's own PATCH payload and `EventSettingsForm` state key are `slug`,
  never a composed URL, so adopting the frame's label without also
  building the origin-prefix presentation the label implies would name the
  field something the input does not accept (typing a bare slug into a
  field labeled "Public URL" reads as a bug, not fidelity). This wave's
  companion renames ("Name" -> "Event name", "Start date"/"End date" ->
  "Starts"/"Ends") adopt the frame verbatim because those three have no
  such mismatch between the label and what the control edits; Slug is the
  one outlier, reasoned and recorded rather than silently left stale.
- **Content 390 chip strip keeps its third chip, "All accepted sessions"
  (DEC-919 wave-28 amendment).** `docs/design/Chautauqua Content.dc.html`
  draws three chips in its desktop extent (`:65-67` "Needs a decision · 5" /
  "Approved · 9" / "All accepted sessions · 23") and only the first two in
  both of its 390 extents (`:210-211` landing, `:260-261` selecting); the
  product renders all three at every width (`WORKLIST_TABS` in
  `app/src/pages/content/worklist.ts`, labels in `SessionList.tsx`). RULED:
  the third chip STAYS at 390, for two reasons taken from the artifacts
  themselves. First, DEC-919's re-line-never-remove governs controls, and a
  filter tab is a capability, not prose — hiding it at phone width removes
  the only way to see every accepted session. Second, the frame's own 390
  chip row itself declares `overflow-x:auto;
  -webkit-overflow-scrolling:touch` — the pack draws a SCROLLING strip, so a
  member sitting past the drawn 390 viewport is a drawing boundary, not an
  omission the app is meant to match. `app/src/pages/content/ContentApp.landing390.render.test.tsx`
  pins all three tabs and asserts the strip carries that same scrolling
  affordance, so "keeps three chips" is paid for by the mechanism that makes
  the third one reachable.

### CFP display-only overrides (wave 30 amendment, `src/decisions-data/DEC-582.md`)

`src/routes/public/submit-views.tsx`'s `displayFields` map (built around the
locked-field `helpText`/`placeholder` overrides just above it) applies five
display-only overrides to the CFP form's locked fields, plus one deliberate
NON-override. Quoting DEC-613's ruling sentence VERBATIM, from
`submit-views.tsx`'s own comment: "the bio field's stored label ships at
every width -- a frame's abbreviated legend never renames stored data
(DEC-613 wave-27)." That principle -- frame copy wins for display-only
chrome the frame itself draws, stored data always wins over a frame's own
abbreviation of it -- governs every row below, each measured against
`docs/design/Chautauqua Public and Portal.dc.html`:

- **Abstract helper text (`CFP_ABSTRACT_HELP_TEXT`).** The frame draws
  `docs/design/Chautauqua Public and Portal.dc.html` `Shown on the public
  sessions page if your talk is accepted` beneath the Abstract field. The
  product ships the identical literal, overriding whatever helper text a
  producer's own stored field carries. Frame-copy override, matches the
  frame exactly. Guard: `test/submit-cfp-frame-copy.test.ts` "overrides the
  abstract field's counter cap and helper text".
- **Bio helper text (`CFP_BIO_HELP_TEXT`).** The frame draws
  `docs/design/Chautauqua Public and Portal.dc.html` `Shown on the public
  speakers page · you can edit it later in your portal` beneath the Bio
  field. The product ships the identical literal. Frame-copy override,
  matches the frame exactly. Guard: `test/submit-cfp-frame-copy.test.ts`
  "ships the stored 'Speaker bio' label as-is … with its own display-only
  helper, dropping the old helpText".
- **Email helper text (`CFP_EMAIL_HELP_TEXT`) -- the one addition, not a
  frame match.** The frame draws no helper text under Email at all:
  `docs/design/Chautauqua Public and Portal.dc.html` labels the field
  `Email` and shows only the stored value (`priya@example.com`) beneath it,
  no third line. The product adds `We send your portal link here, so a
  typo means you never get it`, stating a real, invisible cost (a typo here
  strands the speaker with no other way to reach their portal) that the
  frame's static mock has no room to draw. Guard:
  `test/submit-cfp-frame-copy.test.ts` "adds an email helper the frame does
  not draw, stating the portal-link cost of a typo".
- **Notes-for-reviewers placeholder (`CFP_NOTES_FOR_REVIEWERS_PLACEHOLDER`).**
  The frame draws `docs/design/Chautauqua Public and Portal.dc.html` `Never
  shown publicly` as example content INSIDE the textarea control itself
  (DEC-380 wave-133), not a below-field caption. The product ships the
  identical literal as the control's `placeholder` attribute -- the closest
  DOM equivalent of "content drawn inside the box." Guard:
  `test/submit-cfp-frame-copy.test.ts` "draws the notes-for-reviewers and
  accessibility-needs empty state as placeholder text, not a below-field
  caption".
- **Accessibility-needs placeholder (`CFP_ACCESSIBILITY_NEEDS_PLACEHOLDER`).**
  Same pattern as Notes for reviewers: the frame draws
  `docs/design/Chautauqua Public and Portal.dc.html` `Goes to the venue
  team only` inside the control; the product ships it as `placeholder`.
  Guard: the same "draws the notes-for-reviewers and accessibility-needs
  empty state as placeholder text" test above (both fields asserted
  together).
- **Bio LABEL -- deliberately NOT overridden.** The frame draws
  `docs/design/Chautauqua Public and Portal.dc.html` `Bio · optional` as
  the field's legend/label. `submit-views.tsx`'s `displayFields` map
  applies no label override for `bio` -- only `helpText` is touched -- so
  the stored, producer-authored label ships as-is (seeded as "Speaker bio"
  in the pin below; "Speaker biography · optional" in
  `docs/design/audit/cfp-legend-register-v12.md`'s own register). This is
  the DEC-613 wave-27 ruling itself, quoted verbatim above: a frame's
  abbreviated legend never renames stored data. Guard: the same "ships the
  stored 'Speaker bio' label as-is" test cited above, which also asserts no
  `CFP_BIO_LABEL`-shaped override exists.

Each row's guard is a RESOLUTION GUARD in the DEC-099 sense: if
`submit-views.tsx` ever stops shipping one of these literals, the cited
test fails and this entry is stale -- the entry cannot outlive the
behaviour it blesses. `docs/design/audit/cfp-legend-register-v12.md`'s
DIVERGES rows for this same population cite this subsection.

## 8. Wave 9 rulings (DEC-976 / DEC-781 wave-9 amendments)

- **A pack frame that documents a VOCABULARY is not a screen.** Two
  instances: `Chautauqua Comms.dc.html:686-749` ("What each template
  renders" / "DevFlow Conf 2027") — a 4-up reference gallery whose
  distinguishing text (`seenIn`, `seenWhy`, `One shell`, `560px measure`)
  appears nowhere in the tree, whose nearest real analogue `PreviewPane`
  renders exactly ONE resolved card with Prev/Next; and `Chautauqua
  Docs.dc.html:226` ("Docs · the element library") — `docsSiteRoutes`
  registers only `/docs` and `/docs/:slug`, and the nine block kinds it
  draws live in `DocsBlock`'s closed union (src/routes/docs-content/types.ts),
  with test/frame-caption-ledger/exclusions/explainer.ts already treating
  its caption as design-system vocabulary. Neither is built under the
  desktop freeze. DEC-976 wave-9 amendment (`decisions/DEC-976.md`).
- **`ConfirmDialog` gains no subtitle slot** (frame `Chautauqua
  Settings.dc.html:1392`/:1400, `It is embedded on notion.so`). The
  referent is an embed HOST the schema has never carried —
  SavedEmbedsPanel.tsx's own comment (near line 26) records that grepping
  src/server/repo/embeds.ts and the schema finds no referrer/host column,
  and DEC-781 already ruled the data-backed consequence lines unbuilt
  because DEC-380 governs (a frame's drawing does not create a data
  model). A slot with no reader is DEC-851/DEC-988's declared knob with
  no reader. Deferred on the same footing as :1422's `Downloaded 18 times
  by 12 speakers`. DEC-781 wave-9 amendment (`src/decisions-data/DEC-781.md`).
- **Settings :950's edit footer keeps its single `Close`.** The frame
  draws a Cancel/Save-changes pair at :1009-:1010, but this form has no
  fields to submit — every role change and removal writes immediately
  from the row-level controls — so there is nothing for Save to commit
  and nothing for Cancel to revert. The "Change your own password" link
  the frame draws beside them IS built (SettingsEditForm's destructive
  footer slot, DEC-919 wave-130).
- **Contacts :720's single-stage pill page is the PHONE register.** The
  tree's `.chq-contacts-pipeline-phone-stages` IS the frame's pill strip,
  at the width it belongs to; desktop's five simultaneous Kanban columns
  are settled truth verdicted MATCHES at frame :312. Also record that
  `stageEmptyBody()` naming the structurally immediately-preceding stage
  (Interested) rather than the frame's copy's two-back reference
  (Contacted) is the correct derivation of the frame's own sentence, not
  a defect. DEC-976 wave-9 amendment.
