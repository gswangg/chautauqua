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

## WAVE B — tokens + localized layouts
- Tap-floor tokens still under 44 (mechanical; sibling pattern at
  settings.css:2087): .chq-submissions-clone 14px · .chq-check 18px ·
  .chq-forms-strip-label 16px · .chq-forms-strip-datefield 28.4px (also
  clipped: sw108>cw93) · contacts name links 25.6px · content file links
  24px · .chq-color-swatch 22px · portal add-resource 34px ·
  .chq-review-queue-footer-showall 30px.
  SPOT-VERIFIED (wave-140/w15-ff, source read not a re-measure — full
  pixel re-run is a separate scan task): every named selector now has a
  dedicated terminal-phone-block rule in its own stylesheet — a
  `.chq-submissions-clone` rule inside `app/src/pages/submissions/submissions.css`'s
  phone block; a `.chq-forms-strip-datefield` rule and a `label.chq-forms-strip-label`
  rule inside `app/src/pages/forms/forms.css`'s phone block; a
  `.chq-settings-panel li .chq-color-swatch` rule inside
  `app/src/pages/settings/settings.css`, under a comment naming
  DEC-393/DESIGN-RULINGS:189; a `.chq-review-queue-footer-showall` rule
  inside `app/src/pages/review/review.css`, under a comment naming the
  same DEC-393/DESIGN-RULINGS:189 pairing; and a floor comment in
  `app/src/pages/contacts/contacts.css` naming this exact probe row
  ("round-2 WAVE B row \"contacts name links") next to its fix. Left OPEN
  rather than CLOSED: this wave did not re-run the pixel scan to confirm
  the computed height at 390, only that a floor rule now targets each
  token — a genuine re-measure is still owed.
- N2 MED: /login password↔button 0px gap AND email focus-ring overlaps the
  PASSWORD label by 4px on load (R1's "not reproducible" REFUTED — live
  measured). Add the gap.
  PARTIALLY CLOSED (re-verified wave-140/w15-ff, matches
  metafid-phoneB-ssr-2026-08-19.md's "RESOLVED since wave 120" entry): the
  gap clause is closed — `src/routes/auth.css.ts`'s `.chq-auth-card`
  declares `gap: 22px;`, its direct parent, so password↔button no longer
  measures 0px. The focus-ring clause stays OPEN: no `focus-visible` rule
  targets `.chq-auth-card input[type=password]` in `src/routes/auth.css.ts`
  at all (grepped, zero matches, positive or negative), so nothing in the
  tree confirms or denies the 4px label-overlap this row measured live —
  left open per DEC-967 rather than guessed closed on an absence of
  contrary evidence.
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
