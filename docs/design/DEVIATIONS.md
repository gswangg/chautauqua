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
    - Portal back-link labels: `docs/design/Chautauqua Public and
      Portal.dc.html:565` draws the session screen's back link as '‹ Your
      portal'. The app renders `<PortalBackLink to="/portal/submissions"
      />` at src/routes/portal/index.tsx`to="/portal/submissions"`,
      resolved through the DEC-914 table
      src/routes/portal/shared.tsx`Your submissions` (`PORTAL_BACK_LINKS`)
      rather than the literal '‹ Your portal'. That table exists precisely
      so a link's label can never disagree with the route it lands on —
      the session card the speaker opened came from the submissions list,
      not the portal home, and the app's back link drills up to the
      screen the card actually came from. A frame drawn once cannot see
      which list a given detail screen was reached from; the routing
      table can, and governs.
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
  inverted (DEC-576 wave-110).
- **Comms fresh empty state stays count-free (DEC-380 wave-130 amendment)**
  — `docs/design/Chautauqua Comms.dc.html:577-578` draws `Tell the 23
  accepted speakers` over the caption "23 submissions have a decision and
  nobody has been told". `RecentSends` is fed only `batches` /
  `templatesById` / `rhythm` and carries no decided-submission count to draw
  the figure from, so building the literal would fabricate a number this
  component cannot verify. The landed copy stays count-free: `Tell your
  accepted speakers` (`app/src/pages/comms/RecentSends.tsx:356-362`).

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
- Tracks/rooms drag-handle reordering — no server-side order field (09--12).
- Public-pages Publish/Unpublish control (09--07) and saved-embed "in use on"
  host column (09--09) — no backing data.
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
- Portal-resource modal Kind pair `File` / `Link` (`docs/design/Chautauqua
  Settings.dc.html:1463-1464`) — this product's second resource kind is a
  wiki page with stored markdown, not a link; there is no link kind to
  build. The chips stay `File` / `Wiki page`
  (`app/src/pages/settings/ResourcesPanel.tsx`). DEC-380 wave-130 amendment.
- CFP not-yet-open `Browse last year's sessions ›`
  (`docs/design/Chautauqua Public and Portal.dc.html:1543`) — no
  previous-edition model exists anywhere in the domain, so there is nothing
  a "last year" link could point at. The link keeps its landed destination
  and label, this event's published sessions at `/e/:slug/sessions`
  (`src/routes/public/submit-views.tsx:139`). DEC-380 wave-130 amendment.
