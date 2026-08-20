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
   dropped the cancelled-padding idiom. app/src/pages/comms/comms.css`.chq-comms-head-actions > .chq-pill {` with a comment above it
   ("tap-floor-exempt: DEC-383 wave-109 amendment -- .chq-pill is a
   filled/bordered control... dropped here") and no padding-inline/
   margin-inline pair; the .chq-btn siblings (.chq-comms-history-head-actions,
   .chq-comms-preview-actions, .chq-comms-refusal-actions,
   .chq-comms-select-actions) carry the same "bordered, cancelled padding
   dropped" note at comms.css:2178/:2189/:2198/:2208. settings.css's Saved
   embeds/Public-pages rows carry the equivalent fix (settings.css:2154-2163
   comment block, same amendment).
   CLOSED (wave 115): app/src/pages/comms/comms.css`.chq-comms-head-actions > .chq-pill {`
2. .chq-settings-section-action (settings.css:210) is 15px tall with no
   phone floor — it is the ONLY route into edit mode on all nine Settings
   panels. ROOMY per DESIGN-RULINGS:189.
   RESOLVED (DEC-393 wave-109 amendment): settings.css:2197 now declares
   `.chq-settings-section-action {` with `min-height: 44px;` and the
   cancelled-padding idiom (legal here — it is borderless), per the comment
   at settings.css:2187 ("Fix 1 (DEC-393 wave-109 amendment):
   .chq-settings-section-action (settings.css:210 -- ...) is the ONLY
   control that opens edit mode... DESIGN-RULINGS' density standard puts a
   real target in the ROOMY register").
   CLOSED (wave 115): app/src/pages/settings/settings.css:2197 `.chq-settings-section-action {`

## S1 breaks (reach/read)
- Settings People-edit: main overflows 390 by 240px; Person column 0px wide;
  Change-password/Remove overlap. Event-edit +86px, CFP-edit +46px
  (.chq-settings-field fixed 420px/200px at 390). Submission detail +91px
  (.chq-participant-email-cell 210px).
  CLOSED (wave 120): app/src/pages/settings/settings.css:2248 `.chq-settings-people-table {`
  CLOSED (wave 120, the Event/CFP-edit `.chq-settings-field` clause): app/src/pages/settings/settings.css:2228 `/* Lane v12m-w5-o appends its own separately-commented sub-section    */`
  CLOSED (wave 120, the submission-detail `.chq-participant-email-cell` clause): app/src/pages/submissions/detail.css:108 `@media (max-width: 900px) {`
- CFP form stat strip clips values mid-string ("5 Aug 202").
  CLOSED (wave 120, verified against the tree): app/src/pages/forms/FormsPage.tsx:278 `// close date and received total the desktop Opens/Closes/Received strip`
- Submission detail back link renders a bare ‹ with no label (frame: ‹ Triage).
  CLOSED (wave 115): app/src/pages/submissions/SubmissionDetailPage.tsx`'‹ Triage' label; desktop keeps '‹ All submissions' byte-`
- Header-label leakage into cards: Contacts rows print COMPANY:/LABELS:
  prefixes + stray checkbox; Templates rows print NAME:.
  CLOSED (wave 118): app/src/pages/contacts/contacts.css`.chq-contacts-table tbody td[data-label]::before {`
  CLOSED (wave 118): app/src/pages/comms/comms.css:1567 `.chq-comms-templates-table td[data-label='Name']::before {`
- Portal/Tracks rows stranded in half-width columns (left ~62%).

## S2 structure vs frames
- Tab bar slot 4 must be CONTEXTUAL (Contacts on Contacts frames, Comms on
  Comms, More-active on Settings) — App.tsx:135 is fixed; dot belongs ABOVE
  the label on ALL items (inactive #BAB6A6), App.tsx:317 renders active-only
  and below.
  RESOLVED (DEC-381 wave-109 amendment): App.tsx:358 now renders a
  `chq-dot` span with `aria-hidden="true"` immediately before
  `{section.label}` at App.tsx:359, for every tab, not just the active one
  (comment at App.tsx:350-357, "the frame's row draws the dot BEFORE the
  label, every tab (not just the active one)"); the More button carries
  the matching before-label dot at App.tsx:375.
  CLOSED (wave 115): app/src/App.tsx:146 `const PHONE_TAB_FIXED_PATHS = ['/overview', '/submissions', '/speakers'] as const;`
  CLOSED (wave 115): app/src/App.tsx:358 `isActive ? ' is-on' : ''`
- Comms Templates/History unreachable on phone without a localStorage draft:
  phoneEntered ignores ?tab=; landing has zero nav without a draft.
  CLOSED (wave 115): app/src/pages/Comms.tsx:71 `const [phoneEntered, setPhoneEntered] = useState(() => isTab(rawTab));`
- Drill-ins keep the parent page head (Contacts pipeline/dupes/merge, Comms
  drills) — frames are one-screen-at-a-time.
  OWNED (wave 120, DEC-380 wave-120 ruling): taken by v12m-w9-o this wave —
  not duplicated here.
- Pinned docks missing on 12 of 14 framed screens (Contact detail, Pipeline,
  Merge, Templates, Files, Session deliverable, Settings Event...); Content
  select-mode dock renders at TOP not bottom (frame :247).
  CLOSED (wave 120, the Content select-mode dock TOP/bottom clause only —
  the "12 of 14" count is unverified in full and moves to Still Live below):
  app/src/pages/content/content.css:1625 `position: sticky;`
- Contact detail inverts hierarchy: frame's wide-primary "Email Priya" +
  Edit vs live 2x2 secondaries with Save primary; save-scope line misplaced.
  OWNED (wave 120, DEC-380 wave-120 ruling): taken by v12m-w9-o this wave —
  not duplicated here.
- Import CSV phone wizard (frame :487 one-column-per-screen + Next/Skip
  dock) not built; desktop modal overflows at 390.
  CLOSED (wave 115): app/src/pages/contacts/ImportWizard.phoneColumns.render.test.tsx:1 `v12m-w2-b: the phone-only "one column per screen" pager added for the`
- Settings read/edit split leaves five of nine frames never rendering as
  drawn; Your data drops masked tokens/Revoke/New token in read mode; edit
  mode inverts title/back-link order.
  CLOSED (wave 118, "Your data drops masked tokens/Revoke/New token in read
  mode" clause only — the frame-count and title/back-link clauses are
  unverified and remain open): app/src/pages/settings/ApiTokensPanel.tsx:204 `{creating ? 'Creating…' : 'New token'}`
- Submissions head: three filter strips (VIEW 753px + status 759px both
  clipped) where frame :137 draws search + three chips.
  CLOSED (wave 120, the "clipped" clause — content no longer truncates,
  scrolling replaces clipping, same idiom the frame itself uses for its
  own status-pill row): app/src/pages/submissions/submissions.css:714 `.chq-submissions-filterbar,`
- Saved embeds: frame's Turn off + Get code pair became four flush buttons;
  ON/OFF misplaced; host line + footnote gone.
  CLOSED (wave 120): app/src/pages/settings/settings.css:2019 `.chq-settings-saved-embed-actions .chq-link-button {`
  (44px-floored, bordered, 8px-gapped buttons — no longer flush; ON/OFF
  renders as its own state-pill span, SavedEmbedsPanel.tsx:245
  `<span`, ahead of the action cluster per docs/design/Chautauqua
  Settings.dc.html:150-161; footnote renders at SavedEmbedsPanel.tsx:202
  `Turning one off breaks it wherever it is pasted`; the frame's `{{
  e.used }}` "host" column is a documented, reasoned omission — no
  endpoint stores that data — per the comment at SavedEmbedsPanel.tsx:20-31.)

## S3 44px floor (all buttons/links below; see probe for counts)
.chq-settings-section-action 15px · .chq-submissions-clone 14px · .chq-check
18px · .chq-forms-strip-label 16px · contacts name links 25.6px · content
file links 22-24px · .chq-submissions-viewtab 29px · strip datefield 28.4px
· .chq-color-swatch 22px · portal add-resource 34px.

Positive: zero horizontal document overflow on all 24; CFP form dock is the
model implementation; dock-suppression mechanism works; Merge is strongest.

## Still live at wave 120
- Portal/Tracks rows stranded in half-width columns: `.chq-settings-track-edit-row`
  (app/src/pages/settings/settings.css:1081 `.chq-settings-track-edit-row {`,
  :1082 `grid-template-columns: minmax(0, 1fr) 150px 200px;`) has no phone
  override anywhere in the file — its sibling `.chq-settings-room-edit-row`
  DOES get one (settings.css:2176 `.chq-settings-room-edit-row {`, :2177
  `grid-template-columns: 1fr;`, per a DEC-919 wave-109 comment at
  settings.css:2171-2175), but the track row's own 150px+200px fixed tracks
  plus two 16px gaps (382px) still exceed the ~358px phone content box, so
  TrackEditRow.tsx's name input / submission-count / actions keep sharing
  one too-narrow row instead of stacking. Read-view rows for both Tracks
  and Portal (`.chq-settings-tracks-rooms-grid`,
  `.chq-settings-portal-resource-row`) DO get phone overrides
  (settings.css:1568, :1573) — only the Tracks EDIT row is unfixed.
- Pinned docks: of the seven screens the original finding named, six
  remain undocked at wave 120 — grepped for `chq-phone-dock` across each
  page component and found no match in
  app/src/pages/contacts/PipelineBoard.tsx,
  app/src/pages/contacts/MergePage.tsx,
  app/src/pages/content/DeliverableDetail.tsx (Session deliverable),
  app/src/pages/content/FilesLibrary.tsx,
  app/src/pages/contacts/ContactDrawer.tsx (Contact detail), and
  app/src/pages/settings/EventSettingsPanel.tsx (Settings Event) — only
  Templates and Content select-mode are now docked (see the CLOSED
  receipt above). The mobile-campaign mandate's dock membership ruling
  (docs/mobile-campaign.md:147 `## RULED (DEC-380 wave-116): agenda 390
  dock membership`) establishes the pattern these six screens still lack.
