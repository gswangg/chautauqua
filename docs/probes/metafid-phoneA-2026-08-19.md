# Meta-fidelity probe: phone clusters A (verified reds, evidence in
# scratchpad/metafid-b/). Cluster verdicts: Contacts FAIL, Comms FAIL,
# Settings FAIL, Submissions MARGINAL, Content MARGINAL. Tier 0.

## Two disproportionate root fixes FIRST
1. The cancelled-padding idiom (padding-inline + negative margin-inline) is
   applied to BORDERED controls where it is NOT layout-neutral: comms.css
   :2068 (.chq-comms-head-actions > .chq-pill overlaps siblings by 11px/side)
   and seven sibling rules (:2078,:2089,:2098,:2108,:2132,:2143), plus the
   same idiom in settings.css (left-bleeding rows on Public pages; four
   flush-joined Saved-embeds buttons). Idiom is for borderless quiet controls
   ONLY — bordered boxes need real gaps. Fix at every bordered application.
   RESOLVED (DEC-383 wave-109 amendment): every bordered subject named above
   dropped the cancelled-padding idiom. app/src/pages/comms/comms.css now
   reads `.chq-comms-head-actions > .chq-pill {` with a comment above it
   ("tap-floor-exempt: DEC-383 wave-109 amendment -- .chq-pill is a
   filled/bordered control... dropped here") and no padding-inline/
   margin-inline pair; the .chq-btn siblings (.chq-comms-history-head-actions,
   .chq-comms-preview-actions, .chq-comms-refusal-actions,
   .chq-comms-select-actions) carry the same "bordered, cancelled padding
   dropped" note at comms.css:2178/:2189/:2198/:2208. settings.css's Saved
   embeds/Public-pages rows carry the equivalent fix (settings.css:2168-2177
   comment block, same amendment).
   CLOSED (wave 115): app/src/pages/comms/comms.css`.chq-comms-head-actions > .chq-pill {`
2. .chq-settings-section-action (settings.css:210) is 15px tall with no
   phone floor — it is the ONLY route into edit mode on all nine Settings
   panels. ROOMY per DESIGN-RULINGS:189.
   RESOLVED (DEC-393 wave-109 amendment): settings.css now declares
   `.chq-settings-section-action {` with `min-height: 44px;` and the
   cancelled-padding idiom (legal here — it is borderless), per the comment
   at settings.css:2201 ("Fix 1 (DEC-393 wave-109 amendment):
   .chq-settings-section-action (settings.css:210 -- ...) is the ONLY
   control that opens edit mode... DESIGN-RULINGS' density standard puts a
   real target in the ROOMY register").
   CLOSED (wave 115): app/src/pages/settings/settings.css`.chq-settings-section-action {`

## S1 breaks (reach/read)
- Settings People-edit: main overflows 390 by 240px; Person column 0px wide;
  Change-password/Remove overlap. Event-edit +86px, CFP-edit +46px
  (.chq-settings-field fixed 420px/200px at 390). Submission detail +91px
  (.chq-participant-email-cell 210px).
  CLOSED (re-verified wave 154, DEC-069 amendment -- landed wave 109 per the
  in-tree comment, never CLOSED here until now): `OVERFLOW_OFFENDERS_CEILING`
  (app/src/phone-horizontal-overflow.scan.test.ts) reads 0 and its
  population walk covers both app/src/pages/settings/settings.css and
  app/src/pages/submissions/detail.css (DEC-808, every app/src/**/*.css) --
  predicate verified by reading the file, not cited blind. People/Event/CFP:
  app/src/pages/settings/settings.css`Change password and Remove overlap`
  (same terminal `@media (max-width: 700px)` comment names Event-edit
  "overflows 390 by 86px" and CFP-edit "by 46px", both closed by the
  `.chq-settings-field-date,` sibling group two rules below going
  `width: 100%`). Submission detail: `.chq-participant-email-cell` carries no
  fixed width in the current tree --
  app/src/pages/submissions/detail.css`word-break: break-all;` is its only
  non-typographic declaration.
- CFP form stat strip clips values mid-string ("5 Aug 202").
  CLOSED (re-verified wave 154): the CFP form builder's Opens/Closes/Received
  three-cell strip (`.chq-forms-strip`, not the Settings CFP-edit panel --
  the CFP FORM's own stat strip) reflows to one column at phone, DEC-919
  wave-11-o amendment --
  app/src/pages/forms/forms.css`they just stack instead of sitting in three 1fr columns`
  (`.chq-forms-strip { grid-template-columns: 1fr; }` immediately below), and
  the datefield gained its own 44px floor (task w13-n /
  v12m-w10-jj) with no `overflow`/`nowrap` clipping declared anywhere in the
  rule.
- Submission detail back link renders a bare ‹ with no label (frame: ‹ Triage).
  CLOSED (wave 115): app/src/pages/submissions/SubmissionDetailPage.tsx`'‹ Triage' label; desktop keeps '‹ All submissions' byte-`
- Header-label leakage into cards: Contacts rows print COMPANY:/LABELS:
  prefixes + stray checkbox; Templates rows print NAME:.
  CLOSED (wave 118): app/src/pages/contacts/contacts.css`.chq-contacts-table tbody td[data-label]::before {`
  CLOSED (wave 118): app/src/pages/comms/comms.css`.chq-comms-templates-table td[data-label='Name']::before {`
- Portal/Tracks rows stranded in half-width columns (left ~62%).
  CLOSED (re-verified wave 154): both reflow to a single column inside
  settings.css's terminal phone block --
  app/src/pages/settings/settings.css`.chq-settings-tracks-rooms-grid {`
  (`grid-template-columns: 1fr; gap: 20px 0;`) and
  app/src/pages/settings/settings.css`.chq-settings-portal-resource-row {`
  (`flex-direction: column; align-items: stretch;`), both inside the same
  `@media (max-width: 700px)` block as the other Settings phone fixes.

## S2 structure vs frames
- Tab bar slot 4 must be CONTEXTUAL (Contacts on Contacts frames, Comms on
  Comms, More-active on Settings) — App.tsx:135 is fixed; dot belongs ABOVE
  the label on ALL items (inactive #BAB6A6), App.tsx:317 renders active-only
  and below.
  RESOLVED (DEC-381 wave-109 amendment): App.tsx`chq-dot` now renders a
  span with `aria-hidden="true"` immediately before
  `{section.label}` at App.tsx:359, for every tab, not just the active one
  (comment at App.tsx:350-357, "the frame's row draws the dot BEFORE the
  label, every tab (not just the active one)"); the More button carries
  the matching before-label dot at App.tsx:375.
  CLOSED (wave 115): app/src/App.tsx`const PHONE_TAB_FIXED_PATHS = ['/overview', '/submissions', '/speakers'] as const;`
  CLOSED (wave 115): app/src/App.tsx`isActive ? ' is-on' : ''`
- Comms Templates/History unreachable on phone without a localStorage draft:
  phoneEntered ignores ?tab=; landing has zero nav without a draft.
  CLOSED (wave 115, drift-proof citation DEC-967 wave-115 shape -- this
  declaration has drifted from the line number originally cited here):
  app/src/pages/Comms.tsx`const [phoneEntered, setPhoneEntered] = useState(() => isTab(rawTab));`
- Drill-ins keep the parent page head (Contacts pipeline/dupes/merge, Comms
  drills) — frames are one-screen-at-a-time.
  CLOSED (re-verified wave 154): DEC-964 stands the parent head down whenever
  a phone drill is showing --
  app/src/pages/contacts/ContactsApp.tsx`Pipeline and Duplicates are one-screen-at-a-time phone`
  -- and every named drill carries its own `chq-phone-head-drill` band:
  app/src/pages/contacts/PipelineBoard.tsx`chq-contacts-pipeline-head chq-phone-head chq-phone-head-drill`,
  plus `app/src/pages/contacts/MergePage.tsx`, `app/src/pages/contacts/DuplicatesView.tsx`,
  `app/src/pages/comms/HistoryTab.tsx` and `app/src/pages/comms/TemplatesTab.tsx`
  all reference `chq-phone-head-drill` (grep-verified, DEC-964).
- Pinned docks missing on 12 of 14 framed screens (Contact detail, Pipeline,
  Merge, Templates, Files, Session deliverable, Settings Event...); Content
  select-mode dock renders at TOP not bottom (frame :247).
  CLOSED (re-verified wave 154, DEC-069 amendment): `PHONE_DOCK_UNCLAIMED_CEILING`
  (test/phone-dock-ledger.scan.test.ts) reads 0 across the full 34-dock
  population derived from all 53 phone frames (predicate read, not cited
  blind: it requires the SAME file to both declare a dock band and render
  EVERY one of its labels, scoped per-file, no membership shortcut) --
  test/phone-dock-ledger.scan.test.ts`frame-enumeration grammar and the balanced` and
  docs/design/audit/phone-dock-membership-v12.md`41 of the 53 phone frames carry such a band`
  name Contact detail/Pipeline/Merge/Templates/Files/Settings by their own
  call sites explicitly, not by a hand-list. Content select-mode dock's
  bottom placement:
  app/src/pages/content/SessionList.tsx`const dockBulkbarLast = isPhone && phoneSelectMode;`
  moves the bar to mount after the pager (DOM-last) only at phone in
  select mode, matched by
  app/src/pages/content/content.css`.chq-content-worklist-selecting .chq-bulkbar {` (`position: sticky; bottom: 0;`).
- Contact detail inverts hierarchy: frame's wide-primary "Email Priya" +
  Edit vs live 2x2 secondaries with Save primary; save-scope line misplaced.
  CLOSED (re-verified wave 154): DEC-959 replaces the five-control edit
  action bar with the frame's own two-control read-mode dock whenever
  `isPhone && !phoneEditing` --
  app/src/pages/contacts/ContactDrawer.tsx`DEC-959: Contact · 390's read mode replaces the five-control`
  rendering a first-name-templated "Email {name}" primary
  (app/src/pages/contacts/ContactDrawer.tsx`{firstName.trim() ? `) as
  the wide primary and `Edit` as the secondary
  (app/src/pages/contacts/ContactDrawer.tsx`onClick={() => setPhoneEditing(true)}`).
  The 2x2/Save-primary bar and the save-scope note are now edit-mode only
  (both densities), and the scope line already sits on its own line above
  that bar per the DEC-616 wave-70 amendment
  (app/src/pages/contacts/ContactDrawer.tsx`own line above the action bar`) --
  not a phone-specific misplacement.
- Import CSV phone wizard (frame :487 one-column-per-screen + Next/Skip
  dock) not built; desktop modal overflows at 390.
  CLOSED (wave 115): app/src/pages/contacts/ImportWizard.phoneColumns.render.test.tsx`v12m-w2-b: the phone-only "one column per screen" pager added for the`
- Settings read/edit split leaves five of nine frames never rendering as
  drawn; Your data drops masked tokens/Revoke/New token in read mode; edit
  mode inverts title/back-link order.
  CLOSED (wave 118, "Your data drops masked tokens/Revoke/New token in read
  mode" clause only — the frame-count and title/back-link clauses are
  unverified and remain open): app/src/pages/settings/ApiTokensPanel.tsx`{creating ? 'Creating…' : 'New token'}`
  CLOSED (re-verified wave-140/w15-ff, w14-m/DEC-728 wave-125, same
  evidence as round-2 N3): the title/back-link clause is now also closed —
  `app/src/pages/Settings.tsx` renders `<button ... className="chq-btn
  chq-btn-tertiary chq-settings-back">` BEFORE `<h1 className="chq-page-title
  chq-settings-drill-title">` in source order (back above H1, per
  DESIGN-RULINGS:247). The frame-count clause ("five of nine frames never
  rendering as drawn") -- superseded by the per-frame table below.
  CLOSED (wave 154, w10-ne, DEC-976 amendment — re-measured by actually
  rendering all nine 390 READ frames through Settings.tsx's real panel
  routing; the original "five of nine" undercounted, per-frame verdicts in
  docs/design/audit/settings-v12.md): eight of nine diverge from the frame
  (only Public pages matches); every divergence is a missing control or a
  missing screen (DEC-728's read/edit split vs. the frame's field-list+
  footer anatomy, per-row actions absent, Saved embeds never its own
  screen), none a phone-CSS/markup-order fix. Render receipts:
  app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :578 Saved embeds -- MATCHES (nested): its own screen carries an own back-link, own H1, and the on-off summary under it`
  UPDATED (wave 155, v12m-w11-pa, DEC-919 amendment): nine-row per-frame
  verdict, superseding the narrative summary above with one row per frame.
  "Rendering surface" names the real component this drill mounts;
  CLOSED-with-receipt means nothing further is owed for that frame,
  OPEN-with-date names a still-real, dated gap.

  | Frame | Rendering surface | Verdict |
  | --- | --- | --- |
  | `:275` Settings (landing) | `Settings.tsx` index list | CLOSED-with-receipt — app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :275 Settings landing -- MATCHES: index row order is the frame` |
  | `:316` Settings · Event | `EventSettingsPanel.tsx` via `SummarySection` | CLOSED-with-receipt (wave-22, was OPEN-2026-08-21) — (a) the head+Change-first read view IS the frame's content+Save/Cancel-footer anatomy at 390: a phone rule stands the head's own action down because the read drill's footer already carries the identical route, app/src/pages/settings/settings.css`.chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action {`; (b) the frame's Save/Cancel pair renders in full in the edit drill, app/src/pages/settings/EventSettingsPanel.tsx`className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>`; receipted in app/src/pages/Settings.frame-verdicts.render.test.tsx |
  | `:347` Settings · Tracks and rooms | `TracksRoomsPanel.tsx` via `SummarySection` | CLOSED-with-receipt (wave-156, was OPEN-2026-08-21) — the per-row boxed Edit and the dashed Add-a-track/Add-a-room row now render in the read drill; app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :347 Tracks and rooms -- MATCHES: per-row Edit box and dashed Add-a-track/Add-a-room row now render in read mode (DEC-919 wave-156)` |
  | `:393` Settings · Your data | `YourDataPanel.tsx` (`ApiTokensPanel` readOnly) via `SummarySection` | CLOSED-with-receipt (wave-156, was OPEN-2026-08-21) — the per-row Download/Revoke actions AND the filled "New token" primary (`:426`) all render in the read drill now — app/src/pages/settings/ApiTokensPanel.tsx`New token` renders in the `readOnly` branch too, opening the edit drill with `intent=new`; receipted in app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :393 Your data -- MATCHES: per-row Download/Revoke actions and the New-token primary render in the read drill`, app/src/pages/settings/ApiTokensPanel.render.test.tsx`ApiTokensPanel read-drill "New token" primary (DEC-919 wave-155 amendment)` and app/src/pages/settings/settings-phone-390.frames.test.ts`46px filled full-width "New token" action in the read drill too, opening the edit drill with intent=new` |
  | `:444` Settings · Call for papers | `CallForPapersPanel.tsx` via `SummarySection` | CLOSED-with-receipt (wave-157, was OPEN-2026-08-21) — the per-question list renders with a boxed Edit per row, each carrying that question's id into the form builder; app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :444 Call for papers -- MATCHES: per-question list with a boxed Edit link per row, carrying the question id (DEC-919 wave-157)` |
  | `:481` Settings · Public pages | `PublicPagesPanel.tsx` (no head-first gate, DEC-896 B10) | CLOSED-with-receipt — app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :481 Public pages -- MATCHES: row order (name, path, state, actions) with only the DEVIATIONS-blessed toggle omitted` |
  | `:510` Settings · Speaker portal | `PortalSettingsPanel.tsx` via `SummarySection` | CLOSED-with-receipt (wave-157, was OPEN-2026-08-21) — the Welcome note renders the stored text verbatim in the drawn readout box; app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :510 Speaker portal -- MATCHES: Welcome note renders the stored text verbatim in the drawn readout box (DEC-919 wave-157)` |
  | `:552` Settings · People and roles | `PeopleRolesPanel.tsx` via `SummarySection` | CLOSED-with-receipt (wave-22, was OPEN-2026-08-21) — no per-row boxed Change action in read mode is DEVIATIONS §6-blessed (users are org-scoped) and not re-litigated, per this row's own record in docs/design/audit/settings-v12/w10-frame-verdicts.md`DEVIATIONS.md §6 blesses this omission (users are org-scoped), not re-litigated.`; the frame's OTHER phone-only primary drawn here, the filled "Invite someone" button (`:568`), is CLOSED-with-receipt — app/src/pages/settings/PeopleRolesPanel.tsx`Invite someone` renders on the read path too. DEC-919 wave-156 superseded wave-155's `intent=invite` round trip into the edit drill: the invite dialog is hoisted out of the edit-gated children, so the read drill opens it in place. Receipted end to end in app/src/pages/settings/PeopleRolesPanel.summary.render.test.tsx`PeopleRolesPanel read-drill "Invite someone" primary (DEC-919 wave-156)` and app/src/pages/settings/settings-phone-390.frames.test.ts`46px filled full-width "Invite someone" action in the READ drill, opening the existing invite dialog directly (DEC-919 wave-156)` |
  | `:578` Settings · Saved embeds | `SavedEmbedsPanel` nested inside `PublicPagesPanel.tsx` | CLOSED-with-receipt (wave-156, was OPEN-2026-08-21) — it renders as its own 390 screen at `?section=public-pages&view=embeds` with an own back-link, own H1 and the on-off summary under it (DEC-728); app/src/pages/Settings.frame-verdicts.render.test.tsx`frame :578 Saved embeds -- MATCHES (nested): its own screen carries an own back-link, own H1, and the on-off summary under it` |
- Submissions head: three filter strips (VIEW 753px + status 759px both
  clipped) where frame :137 draws search + three chips.
  CLOSED (re-verified wave 154): the wave-6 task w6-f ruling (superseding
  wave-2's DEC-919 reading) re-lines the head into search-on-its-own-line +
  a horizontally-scrolling chip strip instead of clipping --
  app/src/pages/submissions/submissions.css`keep every chip reachable by scrolling instead of wrapping/clipping`
  applies `flex-wrap: nowrap; overflow-x: auto;` to
  `.chq-submissions-filterbar`, `.chq-submissions-filterbar .chq-status-pills`
  AND `.chq-submissions-viewtabs` alike (all three strips the row names),
  each child `flex-shrink: 0` so nothing clips mid-string; search/select
  floored at 44px by
  app/src/pages/submissions/submissions.css`.chq-submissions-filterbar-search,` (`min-height: 44px;`).
- Saved embeds: frame's Turn off + Get code pair became four flush buttons;
  ON/OFF misplaced; host line + footnote gone.
  CLOSED (re-verified wave 154): the flush-button clause was already
  CLOSED above (root fix #1, wave 115, same cancelled-padding repair
  covers "four flush-joined Saved-embeds buttons"). Action order is fixed
  to the frame's own Edit / Get code / Turn on-off sequence by the DEC-785
  wave-63 amendment --
  app/src/pages/settings/SavedEmbedsPanel.tsx`w63-d/DEC-785 amendment (wave 63): action cluster order` --
  which also documents Delete as a genuine pack disagreement (a real,
  reachable endpoint the frame's own editor footer never draws a control
  for), appended after rather than invented into the frame's order. The
  "host line" clause is the SAME field as the row's own DEVIATIONS
  candidate one section up (`{{ e.used }}`, no referrer/host tracking in
  the data model) --
  app/src/pages/settings/SavedEmbedsPanel.tsx`grep src/server/repo/embeds.ts and the schema turns up no referrer/host`
  -- restated here rather than duplicated as a second open row; a
  "footnote" distinct from that field was not found anywhere in the
  frame's saved-embed row markup and is not independently verified.

## S3 44px floor (all buttons/links below; see probe for counts)
.chq-settings-section-action 15px · .chq-submissions-clone 14px · .chq-check
18px · .chq-forms-strip-label 16px · contacts name links 25.6px · content
file links 22-24px · .chq-submissions-viewtab 29px · strip datefield 28.4px
· .chq-color-swatch 22px · portal add-resource 34px.

CLOSED (re-verified wave 154, DEC-069 amendment, all ten tokens): every
named token carries a phone-block 44px floor (min-height PLUS centred flex
PLUS horizontal padding, per DESIGN-RULINGS:189) in the current tree.
`.chq-settings-section-action` and `.chq-forms-strip-label` were already
CLOSED above (root fix #2 / the CFP stat-strip row). The remaining eight:
`.chq-submissions-clone` and `.chq-submissions-viewtab` --
app/src/pages/submissions/submissions.css`w13-m (DEC-989/DESIGN-RULINGS:189): four undeclared-height offenders` ·
`.chq-check` (the table select-all/row-select usage the probe measured) via
its `.chq-check-hit` label wrapper --
app/src/styles.css`.chq-check-hit is the label wrapper added around every table-cell` ·
`.chq-color-swatch` (portal/tracks colour-cycle usage) --
app/src/pages/settings/settings.css`Tracks & rooms colour-cycle swatch (probe: 22px` ·
`.chq-settings-portal-add-resource` --
app/src/pages/settings/settings.css`Portal 'Add resource' (probe: 34px` ·
the CFP strip datefield --
app/src/pages/forms/forms.css`.chq-forms-strip-datefield {` (`min-height: 44px;`) ·
and contacts/content name-and-file links, both rendered on the shared
`.chq-link-button` class (ContactsTable.tsx`chq-link-button chq-contacts-name`,
FilesLibrary.tsx uses the same bare class), floored globally at phone by
app/src/styles.css`.chq-link-button is the house's bare-text Link register`
(`min-height: 44px;` two rules below).

Positive: zero horizontal document overflow on all 24; CFP form dock is the
model implementation; dock-suppression mechanism works; Merge is strongest.
