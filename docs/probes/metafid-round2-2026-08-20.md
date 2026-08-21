# Meta-fidelity ROUND 2 (74 screens @390, measured; evidence
# scratchpad/metafid-r2/). SUPERSEDES the two round-1 probe files' open
# rows — R1 findings not listed below are FIXED and verified.

## Verdicts: DONE at 390 (6): Docs, Overview, Speakers, Review, Home,
## Submissions. Remaining (7): Content (worst), Contacts, Comms, Settings,
## Public/Portal, Agenda-admin, Account. Both criticals CLOSED end-to-end.
## Zero horizontal overflow on all 74 screens.

## WAVE A — docks (ONE mechanism, ~6 screens + one DOM reorder)
- N1 HIGH: Content select-mode dock is INERT — .chq-bulkbar is sticky
  bottom:0 but DOM child 1 of 6 above a 3139px table; sticky-bottom never
  pins from there (probe: same element as LAST child pins at 788). DOM
  reorder, not CSS. Evidence content-sticky-chain.json.
  CLOSED (re-verified wave-140/w15-ff): `app/src/pages/content/SessionList.tsx`
  declares `const dockBulkbarLast = isPhone && phoneSelectMode;` and uses it
  to gate two render sites — `{!dockBulkbarLast && bulkbar}` (the normal,
  non-selecting position) and `{dockBulkbarLast && bulkbar}` (rendered
  after the pager, LAST child, so `position:sticky; bottom:0` actually
  pins) — exactly the DOM-reorder fix this row asked for, per the
  component's own comment: "needs to be the LAST child of this flex column
  for its `position:sticky; bottom:0` rule (content.css) to actually pin".
- Missing docks, same mechanism as the 7 screens that already pin
  (chq-phone-dock band + suppression): Contacts Pipeline, Content Files,
  Content Session-deliverable, CFP wizard, portal profile, portal session.
  Tab-bar presence on these screens is a SYMPTOM of the missing dock.
  PARTIALLY CLOSED (re-verified wave-140/w15-ff) — five of six built:
  Content Files (`app/src/pages/content/FilesLibrary.tsx`:
  `{...(items.length > 0 ? { 'data-chq-phone-dock': true } : {})}`),
  Content Session-deliverable (`app/src/pages/content/CommentThread.tsx`:
  `<div className="chq-phone-dock" data-chq-phone-dock>`), CFP wizard
  (`src/routes/public/cfp.css.ts`'s task-w13-k block: `.chq-cfp-actions` IS
  the sticky dock band, per its own comment, "no second
  `data-chq-phone-dock` declaration needed"), portal profile
  (`src/routes/portal/profile.tsx`: `dock={profileDock}` passed to
  `PortalLayout`), portal session (`src/routes/portal/index.tsx`: `const
  dock = ...` passed the same way, per its DEC-576 comment).
  STILL OPEN — Contacts Pipeline: this row's premise needs correcting, not
  striking. `docs/design/Chautauqua Contacts.dc.html` DOES draw a
  width:390px "Pipeline · 390" frame (line 447-483, its own footer band:
  `flex-shrink:0; border-top:1px solid #1B1D17` holding "Add someone"
  (primary, flex:1) + "Filter" (secondary) at min-height:48px) — confirmed
  live by `app/src/pages/contacts/contacts-phone-frames.test.ts`'s
  `describe('v12 phone frame "Pipeline · 390"'` block and
  `PipelineBoard.render.test.tsx`'s "matches the v12 'Pipeline · 390'
  frame" describe. `app/src/pages/contacts/PipelineBoard.tsx` renders no
  `data-chq-phone-dock` anywhere (grepped, zero matches) — its "Add
  someone" action lives in the head (`chq-contacts-pipeline-head`, one
  full-width 48px action) with no "Filter" companion and no bottom-pinned
  band, so the tab bar is left standing where the frame pins a dock. The
  "tab-bar presence is a symptom" line is correct for this one screen and
  is NOT struck. (The "Duplicates" name in the original finding was a
  mislabel — `docs/design/Chautauqua Contacts.dc.html` has no separate
  390 frame for Duplicates; per
  `app/src/pages/contacts/contacts-drill-phone-heads.test.ts`'s own
  comment, "Duplicates has no 390 frame of its own" and its phone drill
  head is derived from the Pipeline · 390 frame's band. The five real
  390 frames are Contacts/Directory, "Contact · 390", "Pipeline · 390",
  "Import CSV · 390", "Merge · 390".)
  CLOSED (wave 149, DEC-967 superseding the old no-dock DEVIATIONS entry):
  app/src/pages/contacts/PipelineBoard.tsx `<div className="chq-phone-dock" data-chq-phone-dock>`,
  with a companion comment naming the frame's dock band as replacing the
  head's own "Add to the pipeline" action at phone width.

## WAVE B — tokens + localized layouts
- Tap-floor tokens originally reported under 44 (mechanical; sibling
  pattern at settings.css:2087): .chq-submissions-clone 14px · .chq-check
  18px · .chq-forms-strip-label 16px · .chq-forms-strip-datefield 28.4px
  (also clipped: sw108>cw93) · contacts name links 25.6px · content file
  links 24px · .chq-color-swatch 22px · portal add-resource 34px ·
  .chq-review-queue-footer-showall 30px.
  CLOSED (task v12m-w20-g, DEC-989 wave-145 amendment: "a floor RULE is
  not a MEASUREMENT... closes only on measured pixels, in both
  dimensions"). Real Chromium measurement at 390x844 via
  `scripts/render-sweep-lib.ts`'s landed `minControlWidth`/`widthFails`
  shape (v12m-w19-f), a fresh browser session per persona, `npm run
  db:migrate` + `npm run seed` fixture data, each token's own owning
  route, `getBoundingClientRect()` over the visible (offsetParent !==
  null) population. Every one of the nine now measures at or above the
  44px floor in BOTH dimensions:
  - `.chq-submissions-clone` (/admin/submissions, organizer, n=30):
    min 48.1×44px.
  - `label.chq-forms-strip-label` (/admin/submissions/forms, organizer,
    n=2 — only the Opens/Closes `<label>` form, the Received `<span>` is
    deliberately unfloored per forms.css's own comment): min 334×44px.
  - `.chq-forms-strip-datefield` (/admin/submissions/forms, organizer,
    n=2): min 326×44px. The reported clip (sw108>cw93) does not
    reproduce: `.chq-forms-strip` now carries `grid-template-columns: 1fr`
    inside its terminal phone block (forms.css, DEC-919 amendment,
    "the frame removes GEOMETRY, not CAPABILITY... they just stack
    instead of sitting in three 1fr columns"), so each cell — and its
    datefield — gets the full 358px content width, not a narrow grid
    track. Measured scrollWidth === clientWidth (324 === 324) on both
    fields at rest and on focus; the clip clause closes on this same
    measurement, separately from the height clause per this task's own
    instruction.
  - contacts name links, i.e. `.chq-contacts-record-value`
    (/admin/contacts?openContact=seed_contact_0001, organizer): the class
    renders as two different elements per DEC-380's readMode split — the
    inert readonly `<span>` (phone READ mode, min observed height 23px,
    deliberately exempt: DEC-991, it is text not a control) and the real
    click-to-edit `<button>` (phone EDIT mode, reached by clicking the
    drawer dock's "Edit" control). Measuring the button form only
    (`:not(.chq-contacts-record-readonly)`, n=14): min 365×44px.
  - content file links, i.e. `.chq-link-button` (/admin/content,
    organizer, n=1 visible on the seeded library): min 49.8×44px.
  - `.chq-color-swatch` (/admin/settings?section=tracks-rooms&edit=1,
    organizer, the `.chq-settings-panel li .chq-color-swatch`
    element-qualified rule, n=3): min 44×44px.
  - portal add-resource, i.e. `.chq-settings-portal-add-resource`
    (/admin/settings?section=portal&edit=1, organizer, n=1): min
    112.4×44px.
  - `.chq-review-queue-footer-showall` (/admin/review/plans/
    seed_evaluation_plan_0001, reviewer persona — this class only renders
    when a reviewer's queue exceeds 5 rows, true for the seeded plan at
    11 rows; the organizer visit to the same path renders PlanEditor, not
    ReviewerQueue, and has no match, DEC-409's viewport/persona split):
    n=1, 72.9×44px.
  - `.chq-check` (18×18px raw box, unchanged and correctly so): this
    token is itself tap-floor-exempt by design (styles.css's own
    `tap-floor-exempt` comment, DEC-393 wave-124 amendment — "the phone
    tap floor is met by the LABEL wrapping the box, not by inflating the
    box"). The real phone tap target is `.chq-check-hit`, the wrapping
    label every bare table-cell checkbox now renders inside
    (check-hit-receipt.scan.test.ts). Measured directly on
    /admin/contacts (n=25) and /admin/submissions (n=30): every instance
    44×44px exactly, zero under floor.
  No stylesheet edit was needed — every rule floored in wave-140's
  source-only spot-verification (DEC-393/DESIGN-RULINGS:189: min-height
  44px plus centred flex plus horizontal padding, appended in each
  sheet's terminal `max-width` phone block, DEC-385) reaches the floor on
  a live pixel measurement too, in both dimensions, with zero clipping.
- N2 MED: /login password↔button 0px gap AND email focus-ring overlaps the
  PASSWORD label by 4px on load (R1's "not reproducible" REFUTED — live
  measured). Add the gap.
  CLOSED (re-verified wave-19/w19-h, matches
  metafid-phoneB-ssr-2026-08-19.md's "RESOLVED since wave 120" entry): the
  gap clause was already closed — `src/routes/auth.css.ts`'s `.chq-auth-card`
  declares `gap: 22px;`, its direct parent, so password↔button no longer
  measures 0px. The focus-ring clause is now also closed on content-anchored
  evidence, not an absence: `src/routes/auth.css.ts`'s terminal phone block
  carries a `.chq-auth-stack .chq-auth-fields { gap: 14px; }` rule under a
  comment naming this exact row ("N2 (live-measured at 390, round-1 \"not
  reproducible\" refuted)") and stating that the earlier zero-gap rule
  "collapsed BOTH reported defects at once" — the Password↔button gap and
  the ring's 4px overlap onto the Password label both trace to the same
  zeroed `.chq-auth-fields` gap, and the `gap: 14px` restore (later in the
  same terminal block, so it wins the cascade per DEC-385 append-only)
  clears both: the ring's 4px reach now lands inside the restored 14px
  gap band instead of on the Password label.
- N3 MED: all 7 Settings edit panels invert back/title order
  (DESIGN-RULINGS:247: back above H1). JSX reorder x7.
  CLOSED (re-verified wave-140/w15-ff, w14-m/DEC-728 wave-125): the seven
  panels share ONE primitive (`SummarySection.tsx`) rather than needing a
  x7 reorder; `app/src/pages/Settings.tsx` itself renders `<button ...
  className="chq-btn chq-btn-tertiary chq-settings-back">` (line ~336)
  BEFORE `<h1 className="chq-page-title chq-settings-drill-title">` (line
  ~358) — back above H1, matching DESIGN-RULINGS:247.
- N4 MED: Comms drills (?tab=) still render the parent page head above the
  drill head — apply Contacts' suppression.
  CLOSED (re-verified wave-140/w15-ff): `app/src/pages/Comms.tsx` reads
  `phoneEntered` once at mount from `?tab=` (`useState(() =>
  isTab(rawTab))`) and its own comment states "Templates and History are
  phone drills with their own... showing so its band doesn't double up
  above the drill's own" head — the parent landing band is suppressed
  whenever a drill (`.chq-phone-head-drill`) is showing, the same
  suppression Contacts uses.
- CFP column 290px vs 358 budget — root cause: main.chq-measure 34px
  padding-inline STACKS with .chq-cfp-body 16px (390-68-32=290).
  CLOSED (re-verified wave-140/w15-ff, task-w13-k): `src/routes/public/cfp.css.ts`
  declares `main.chq-measure:has(.chq-cfp-body) { padding-inline: 0; }` in
  its terminal phone block — the OUTER `<main class="chq-measure">` gives
  up its own padding so `.chq-cfp-body`'s 16px left/right is the ONE
  gutter owner (per the rule's own comment, "single... gutter owner"),
  closing the 290-vs-358 stack.
- N5 LOW: More-tab badge dot below label shifts its baseline 6.5px.
  CLOSED (re-verified wave-140/w15-ff, DEC-919/DEC-381): `app/src/styles.css`'s
  terminal phone block declares `.chq-tabbar button.chq-nav-link {
  position: relative; }` and `.chq-tabbar .chq-nav-link .chq-badge-dot {
  position: absolute; top: 6px; right: 6px; }` — the badge dot is taken
  out of flex flow entirely (absolutely positioned against the tab
  button), so it can no longer shift the label's baseline the way an
  inline sibling would.
- N6 LOW: Settings hint alignment differs read (right) vs edit (left);
  frame left-aligns.
  CLOSED (re-verified wave-140/w15-ff): `app/src/pages/settings/settings.css`
  carries a fix already citing this exact row by name — a rule comment
  reading "task-w13-i/DEC-976 (N6 LOW): a read-drilled row's hint...
  visually reads as RIGHT-aligned... The frame left-aligns the hint in
  both views" followed by `.chq-settings-row-hint { align-self:
  flex-start; }` appended after the offending `align-self:flex-end` rule
  so it wins the cascade.

## Probe's ledger cross-check (NOT defects): agenda head action row is
## RULED (DEC-380 w116); saved-embed host col, embed drill anatomy,
## Your-data edit view, portal "Later" are DEFERRED in DEVIATIONS.
