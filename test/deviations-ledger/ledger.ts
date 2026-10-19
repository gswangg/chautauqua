// Ledger data, split out of test/deviations-ledger.scan.test.ts
// (contention decomposition, no behavior change). This is the file most
// waves touch (a new docs/design/DEVIATIONS.md row needs a new entry
// here) -- isolating it from the derivation/resolver/test logic means
// those additions no longer collide with unrelated changes to this
// scan's machinery.
//
// See test/deviations-ledger.scan.test.ts's header comment for the full
// population, lead-in-extraction, and verdict-shape documentation this
// data answers to -- unchanged by this split.

import type { LedgerEntry } from "./types";

export const LEDGER: LedgerEntry[] = [
  // ---- ## 1. Ruled omissions -------------------------------------------
  {
    key: "archive-this-event-frame-09-11-destructive-footer",
    status: "honored",
    reason: 'USER RULING 2026-08-16: deferred until a real customer requests it -- "Archive this event" must not appear anywhere in implementation or docs.',
    honored: { kind: "absent", term: "archive this event" },
  },
  {
    key: "settings-keeping-and-deleting-retention-block-docs-design-chautauqua-settings-dc-html-1161-1180",
    status: "honored",
    reason:
      "DEC-032 (task w17-g): the frame's retention select and two checkboxes are a deliberate non-build -- no retention column, no endpoint and no deletion job backs any of the three controls, so building them would declare a setting nothing reads. The panel that would have carried them records the same non-build in its own header comment.",
    honored: {
      kind: "present",
      file: "app/src/pages/settings/ExportsPanel.tsx",
      literal: "deliberate non-build on DEC-032.",
      testFile: "app/src/pages/settings/ExportsPanel.render.test.tsx",
    },
  },
  {
    key: "docs-design-chautauqua-speakers-dc-html-549-speakers-a-write-failed",
    status: "superseded",
    reason:
      "the same finding (a hand-styled, pre-inversion status pill under a write-failure banner) is recorded a second time, resolved, in section 6's Adjudications: 'Speakers status vocabulary under write-failure (DEC-730, wave-90 amendment)' -- the inverted vocabulary is ruled to apply in every state, no code change needed.",
    superseded: { literal: "Speakers status vocabulary under write-failure (DEC-730, wave-90" },
  },
  // ---- ## 2. State-layer additions --------------------------------------
  {
    key: "shared-chq-table-first-last-cell-16px-insets",
    status: "honored",
    reason: "the shared .chq-table first/last-cell inset is a real, shared CSS rule, not a per-page one-off.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-table th:first-child,", testFile: "test/table-class-conformance.test.ts" },
  },
  {
    key: "review-plan-row-16px-right-inset",
    status: "honored",
    reason: "the review plan-row carries its own dedicated class, styled to mirror the shared inset.",
    honored: { kind: "present", file: "app/src/pages/review/review.css", literal: ".chq-review-plan-row {", testFile: "app/src/pages/review/PlanList.render.test.tsx" },
  },
  {
    key: "bulk-action-bars-are-always-mounted",
    status: "honored",
    reason: "the always-mounted idle bulk bar with its muted hint line is a shared, shell-level construct, reused (never re-declared) across surfaces.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-bulkbar-hint {", testFile: "app/src/pages/submissions/BulkActionBar.render.test.tsx" },
  },
  {
    key: "tracks-rooms-edit-rows-use-a-fixed-200px-actions-track",
    status: "honored",
    reason: "the dirty-only Save/Cancel pair renders in place without shifting the row, per-row.",
    honored: { kind: "present", file: "app/src/pages/settings/tracksRooms/TrackEditRow.tsx", literal: "onSave(track)", testFile: "app/src/pages/settings/TracksRoomsPanel-edit-save.render.test.tsx" },
  },
  {
    key: "speakers-grid-task-cells-top-align-on-one-shared-pill-line",
    status: "honored",
    reason: "task cells share one fixed top-align offset so a two-line cell never floats its pill off its siblings' line.",
    honored: { kind: "present", file: "app/src/pages/speakers/speakers.css", literal: "Top-align every task cell with ONE fixed offset", testFile: "app/src/pages/speakers/OnboardingGrid-refusal-shapes.render.test.tsx" },
  },
  {
    key: "disabled-tertiary-link-shaped-controls-keep-no-surface-and-no-hover",
    status: "honored",
    reason: "a disabled tertiary/link-style control keeps no box and no hover response, distinct from B8's filled-tier disabled register.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-btn-tertiary:disabled,", testFile: "test/button-vocabulary.test.ts" },
  },
  // ---- ## 3. Interpretations where the frames underspecify -------------
  {
    key: "track-colour-picking-is-a-cycle-control",
    status: "honored",
    reason: "the swatch beside the track name is a cycle control (click cycles the five system-token colours in place), not a separate picker.",
    honored: { kind: "present", file: "app/src/pages/settings/tracksRooms/TrackEditRow.tsx", literal: "Track colour for", testFile: "app/src/pages/settings/TracksRoomsPanel.render.test.tsx" },
  },
  {
    key: "agenda-phone-head-band-line-height-1-dec-991-wave-156-verdict",
    status: "honored",
    reason:
      "DEC-991 wave-156 verdict: the wave-27 ban on display-face line-height<=1 governs; the exemption mechanism src/decisions-data/DEC-991.md proposed is retired unbuilt. agenda.css's phone wordmark/h1 rules correctly omit line-height (satisfying the ban) while the frame's own line-height:1 is read as head-band geometry, already met by the band's drawn padding/gap.",
    honored: { kind: "present", file: "src/decisions-data/DEC-991.md", literal: "the BAN governs", testFile: "test/display-heading-line-height.scan.test.ts" },
  },
  {
    key: "contact-drawer-footer",
    status: "honored",
    reason: "the contact drawer keeps the recorded A20 ruling's footer order and its save-scope sentence above the bar.",
    honored: { kind: "present", file: "app/src/pages/contacts/ContactDrawer.tsx", literal: "email: 'Email',", testFile: "app/src/pages/contacts/ContactDrawer.render.test.tsx" },
  },
  {
    key: "wordmark-vertical-position",
    status: "honored",
    reason: "the wordmark's optical nudge is applied and pinned by its own scan test.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-wordmark {", testFile: "test/wordmark-optical-nudge.scan.test.ts" },
  },
  {
    key: "submissions-390-phone-head-dec-919-amendment-wave-7-task-w7-e",
    status: "honored",
    reason: "the phone head re-lines into a titles row above a full-width actions row (Forms / Export CSV share the row, New submission keeps its own width), per DEC-919 ('re-line, never remove').",
    honored: { kind: "present", file: "app/src/pages/submissions/submissions.css", literal: ".chq-submissions-head-actions {", testFile: "app/src/pages/submissions/submissions-landing-phone-frame.test.ts" },
  },
  {
    key: "plan-editor-phone-dock-copy-is-the-new-plan-captioning-not-a-third-button-pair",
    status: "honored",
    reason: "the phone dock is a CSS-only repositioning of whichever button pair the title row already renders -- never a second copy of the buttons.",
    honored: { kind: "present", file: "app/src/pages/review/review.css", literal: ".chq-review-editor-title-actions {", testFile: "app/src/pages/review/review-admin-phone-frames.test.ts" },
  },
  {
    key: "sign-in-390-keeps-forgot-your-password-re-lined-dec-919-wave-114-amendment",
    status: "honored",
    reason:
      "DEC-919 wave-114 amendment: a frame is the GEOMETRY authority, not a capability manifest -- the 390 sign-in cut drawing the primary alone does not license deleting the only password-reset entry point on phones. The link stays, re-lined: .chq-auth-submitrow goes column-reverse at phone width so the full-width primary sits first and the tertiary is centred beneath it.",
    honored: { kind: "present", file: "src/routes/auth.css.ts", literal: "flex-direction: column-reverse;", testFile: "test/account-docs-phone-frames.test.ts" },
  },
  {
    key: "contact-drawers-phone-edit-stack-is-not-the-frames-read-dock-dec-959-dec-380-wave-120-struck",
    status: "honored",
    reason:
      "DEC-959/DEC-380 wave-120: the frame draws only the 390 READ footer (Email / Edit), so the phone EDIT state's five-control bar is our interpretation, not a frame deviation. It takes the frame footer's own floor (min-height:48px, padding:0 16px), one control per line, and its capability is reached through the dock's own Edit control -- the drawer flips between the two trees on `readMode`, never renders both.",
    honored: { kind: "present", file: "app/src/pages/contacts/ContactDrawer.tsx", literal: "const readMode = isPhone && !phoneEditing;", testFile: "app/src/pages/contacts/ContactDrawer.phoneRead.render.test.tsx" },
  },
  {
    key: "agenda-390-phone-dock-stays-exactly-the-two-frame-controls-publish-schedule-and-breaks-live-in-the-heads-action-row-dec-380-wave-116-amendment",
    status: "honored",
    reason:
      "DEC-380 wave-116 amendment, closing the mandate's open design question: the frame's 390 dock draws exactly Unscheduled + Auto-schedule, unchanged. Publish schedule and Breaks stay in the head's own full-width action row -- a frame is the geometry authority, not a capability manifest, and neither control has any other home on the phone surface. Both reach the 44px floor: the shared .chq-btn rule floors Publish schedule, and a dedicated .chq-link-button rule (appended, not edited in place) floors Breaks.",
    honored: { kind: "present", file: "app/src/pages/agenda/agenda.css", literal: ".chq-agenda-head-actions .chq-link-button {", testFile: "app/src/pages/agenda/PhoneAgenda.dock-membership.render.test.tsx" },
  },
  {
    key: "co-presenter-add-row-keeps-its-no-email-truth-over-the-frames-caption-dec-909-wave-134-task-w9-dd-corrected-and-confirmed-by-dec-380-wave-139",
    status: "honored",
    reason:
      "DEC-909 wave-134, corrected and confirmed by DEC-380 wave-139: the frame's caption claims a new co-presenter 'is emailed a portal link', but the submissions routes never import a mailer (DEC-604 wave-70), so adding a participant cannot send anything. The landed caption states the truth and the portal invite stays a separate explicit act. DEC-380's own wave-137 amendment briefly ruled the frame's caption a build without weighing this pin or the mailer-import scan; wave-139 corrects that on the merits.",
    honored: {
      kind: "present",
      file: "app/src/pages/submissions/SubmissionDetailPage.tsx",
      literal: "Adding a co-presenter here sends no email",
      testFile: "app/src/pages/submissions/SubmissionDetailPage.render.test.tsx",
    },
  },
  {
    key: "reminder-skip-window-wording-stays-reminded-not-emailed-dec-909-wave-134-task-w9-dd",
    status: "honored",
    reason:
      "DEC-909 wave-134: the frame draws 'skips anyone emailed in the last hour', but the dedupe gate is task_assignment.last_reminded_at, not any generic email send. The shared vocabulary module owns the one true phrase for all its consumers, so the app's 'reminded' stands over the frame's 'emailed'.",
    honored: {
      kind: "present",
      file: "app/src/pages/speakers/remindSkipVocabulary.ts",
      literal: "skips anyone reminded in the last hour",
      testFile: "app/src/pages/speakers/remind-skip-vocabulary.scan.test.ts",
    },
  },
  {
    key: "agenda-390-phone-head-band-omits-the-frames-line-height-1-on-the-wordmark-and-the-h1-the-declaration-is-band-geometry-not-a-glyph-metric-dec-991-wave-156-supersession",
    status: "honored",
    reason:
      "DEC-991 wave-156 supersession: the display-face line-height<=1 ban governs, and the frame's line-height:1 on the phone wordmark/h1 declares head-band tightness, not a glyph metric the app must reproduce literally. agenda.css's .chq-phone-agenda-wordmark and .chq-phone-agenda-h1 both omit line-height, and each rule carries its own comment recording the omission under this ruling.",
    honored: {
      kind: "present",
      file: "app/src/pages/agenda/agenda.css",
      literal: "DEC-991 wave-27 amendment bans line-height:1 on the display face",
      testFile: "app/src/pages/agenda/agenda-phone-frame.test.ts",
    },
  },
  {
    key: "settings-embed-edit-head-omits-the-frames-line-height-1-on-the-h1-dec-996",
    status: "honored",
    reason:
      "DEC-996: commit bee981791 copied docs/design/Chautauqua Settings.dc.html:1047's line-height:1 verbatim onto .chq-settings-embed-edit-head h1, tripping the same display-face line-height<=1 ban the Agenda entry above resolves. The declaration is deleted outright (never substituted, never scan-exempted); the rule keeps normal (the font's own line box) to contain the glyphs, same disposition as the Agenda wordmark/h1 pair.",
    honored: {
      kind: "present",
      file: "app/src/pages/settings/settings.css",
      literal: "DEC-991 wave-27 amendment bans line-height:1 on the display face",
      testFile: "test/display-heading-line-height.scan.test.ts",
    },
  },
  {
    key: "plan-editors-v4-title-row-shell-is-blessed-not-the-unrecorded-divergence-the-audit-flagged-and-the-reviewers-who-reviews-what-section-heading-rename-ships-as-part-of-the-same-shell-dec-745-wave-20-amendment",
    status: "honored",
    reason:
      "DEC-745 wave-20 amendment: the plan editor's v4 title-row shell (already recorded under \"## 7. Settled frame divergences\") is BLESSED rather than an unrecorded divergence, and the same ruling covers the roster section heading's rename from the frame's 'Reviewers' to 'Who reviews what' (DEC-745 wave-98 amendment's own text).",
    honored: {
      kind: "present",
      file: "app/src/pages/review/PlanEditor.tsx",
      literal: '<h2 className="chq-section-label">Who reviews what</h2>',
      testFile: "app/src/pages/review/PlanEditor.render.test.tsx",
    },
  },
  // ---- ## 4. Voice (DEC-967 wave-31 amendment) --------------------------
  {
    key: "docs-prose-follows-the-ste-derived-house-rules-not-the-designs-house-voice-note",
    status: "gap",
    reason:
      "a broad style/voice policy governing ALL docs prose (full ASD-STE100 applied 2026-08-16, then deliberately relaxed to writing-rules-plus-natural-rhythm), not a fact any single file discharges. The bullet names one real supporting artifact -- the declared technical-names glossary at src/routes/docs-content/technical-names.ts -- but that file only carries the domain-terms half of the policy (the should/might ambiguity and metaphor bans have no single artifact at all); citing it as though it proved the whole voice policy would be exactly the force-fit this scan's 'gap' verdict exists to avoid. Recorded gap under the same divider reasoning test/design-rulings-ledger.scan.test.ts already applies to its 'governing-principle-applied' row -- a cross-surface prose axiom, not a single-artifact claim.",
  },
  // ---- ## 4a. Docs screenshots: tall frames, prepared states, and focus -
  {
    key: "capture-is-fullpage-by-default-still-at-1600-wide",
    status: "honored",
    reason: "capture defaults to fullPage (grows the viewport to fit the real screen height) unless a row explicitly opts into the fixed 1600x900 frame capture for position:fixed overlays.",
    honored: { kind: "present", file: "scripts/docs-shots.ts", literal: 'const fullPage = (entry.capture ?? "fullPage") === "fullPage";', testFile: "test/docs-shots-manifest.test.ts" },
  },
  {
    key: "a-row-may-declare-prep-steps",
    status: "honored",
    reason: "DocsShotEntry carries an optional prep array of declarative click/fill/select/waitFor steps, run against the real app before the shutter fires.",
    honored: { kind: "present", file: "scripts/docs-shots-lib.ts", literal: "readonly prep?: readonly DocsShotStep[];", testFile: "test/docs-shots-manifest.test.ts" },
  },
  {
    key: "clip-selector-padding",
    status: "honored",
    reason: "a row may declare clip:{selector,padding} to become a vertical band around one element at the full 1600px width, generous context required (never a tight crop) -- a real row uses it for the agenda break-band figure.",
    honored: {
      kind: "present",
      file: "scripts/docs-shots-lib.ts",
      literal: 'clip: { selector: \'.chq-agenda-break-band:has-text("Afternoon break")\', padding: 300 },',
      testFile: "test/docs-shots-manifest.test.ts",
    },
  },
  {
    key: "highlight-selectors-dim",
    status: "honored",
    reason: "a row may declare highlight:{selectors,dim} to draw a brand outline/glow on the caption's subject, optionally dimming the rest -- a real row uses it (with dim) for the agenda held-back/toast figure.",
    honored: {
      kind: "present",
      file: "scripts/docs-shots-lib.ts",
      literal: 'highlight: { selectors: [".chq-agenda-held-back", ".chq-toast"], dim: true },',
      testFile: "test/docs-shots-manifest.test.ts",
    },
  },
  // ---- ## 5. Pending adjudication -- divider row (DEC-967 wave-31) ------
  {
    key: "5-pending-adjudication-not-yet-blessed-sweep-should-verdict",
    status: "gap",
    reason:
      "the section's own text says 'No adjudication is currently open' -- the one entry it used to list (tracks-and-rooms save model) was verdicted by the G13 srv1 adjudication and is recorded, resolved, under ## 6's Adjudications (see the 'tracks-and-rooms-save-model' row below, which cites that section, never this one). A section whose whole content is a statement that nothing is open draws zero top-level bullets, so it is recorded as a single divider-style gap row keyed to its own heading -- same reasoning test/design-rulings-ledger.scan.test.ts applies to its own section-divider headings -- never force-fit to the ## 6 row's citation.",
  },
  // ---- ## 6. Deferred post-deadline -------------------------------------
  {
    key: "your-data-edit-view",
    status: "gap",
    reason: "USER RULING 2026-08-16, G13 sweep: no data model or endpoint behind the retention-select/keeping-and-deleting/revoke-every-token drawing -- recorded as scope, not disguised as built.",
  },
  {
    key: "tracks-rooms-drag-handle-reordering",
    status: "gap",
    reason: "no server-side order field exists to back drag-handle reordering.",
  },
  {
    key: "public-pages-publish-unpublish-control-09-07-and-saved-embed-in-use-on-host-column-09-09",
    status: "gap",
    reason: "no backing data exists for either control.",
  },
  {
    key: "per-person-scope-column-and-per-row-change-on-people-and-roles-read-view",
    status: "gap",
    reason: "users are org-scoped; no per-person scope model exists to read or change.",
  },
  {
    key: "hotel-form-save-draft-per-recipient-reminder-triage-rows-speaker-detail-header-restructure-04-07-frames",
    status: "gap",
    reason: "deferred reworks, G13 sweep -- no code behind the drawings.",
  },
  {
    key: "ai-assisted-triage-eval-abs-14",
    status: "gap",
    reason: "roadmap item, never sketched in the design frames -- there is nothing to cite.",
  },
  {
    key: "plan-editor-reviewer-row-swap",
    status: "honored",
    reason: "the reviewer row's GEOMETRY matches the frame; only the label differs -- copy stays 'Remove' behind ConfirmDialog because no reassign-in-place capability exists in the domain or route layer (DEC-941, DEC-745 wave-98 amendment).",
    honored: { kind: "present", file: "app/src/pages/review/review.css", literal: ".chq-review-reviewer-row {", testFile: "app/src/pages/review/PlanEditor.render.test.tsx" },
  },
  {
    key: "portal-task-list-dock-later",
    status: "gap",
    reason: "the dock's GEOMETRY (Mark the release signed / Later, both min-height:48px) is legitimate future work for whatever primary the page renders, but the portal task model exposes only complete-or-not -- src/routes/portal/**/*.tsx and src/server/repo/portal* carry no snooze/defer/dismiss/later capability -- so 'Later' is recorded openly as unbuilt, not disguised as done.",
  },
  {
    key: "csv-import-the-first-three-rejection-screen-560-card-no-step-rail-download-the-rows-action",
    status: "gap",
    reason: "the validation itself SHIPPED; only the 560-card/no-step-rail/download-the-rows PRESENTATION is deferred -- recorded as scope, not disguised as built.",
  },
  {
    key: "embed-editor-drill-page-anatomy-09-15-sessionboard-importer-modal-per-entity-dispositions-09-25-plan-editor-footer-draft-vs-open-model-email-html-shells-cta-callout-signature-anatomy-07-09-12-shared-confirmdialog-480-subtitle-typed-label-anatomy-09-21-22-portal-resources-block-rework-09-13-docs-ia-expansion-14-further-articles-the-sessionboard-importer-modal-is-drawn-at-docs-design-chautauqua-settings-dc-html-1507-import-from-sessionboard",
    status: "gap",
    reason: "reworks larger than the freeze window -- a bundle of deferred anatomy changes, none built.",
  },
  {
    key: "portal-measure-widened-against-the-frames",
    status: "honored",
    reason: "USER RULING 2026-08-16 (release night): the portal keeps the app-wide --chq-measure (820px) token instead of the drawn 560px --chq-portal-measure.",
    honored: { kind: "present", file: "app/src/styles.css", literal: "--chq-portal-measure: 560px;", testFile: "test/portal-phone-fit.test.ts" },
  },
  {
    key: "tracks-and-rooms-save-model",
    status: "honored",
    reason: "G13 srv1 adjudication: per-row dirty-reveal Save/Cancel is BLESSED; the Done control confirms before discarding dirty rows.",
    honored: { kind: "present", file: "app/src/pages/settings/TracksRoomsPanel.tsx", literal: "confirmingDiscard", testFile: "app/src/pages/settings/TracksRoomsPanel-errors.render.test.tsx" },
  },
  {
    key: "auth-input-fill-stays-chq-surface-faf8f2-no-change-ruled-dec-383-wave-114-amendment",
    status: "honored",
    reason:
      "DEC-383 wave-114 amendment closed the last open adjudication: Chautauqua Account.dc.html draws #FFFFFF on the DESKTOP card's inputs but #FAF8F2 (= --chq-surface) on the same controls in its own 390 cuts, so the pack contradicts itself and no frame reading licenses the off-palette literal. RULED no change -- the app already ships --chq-surface, which is what the card paints.",
    honored: { kind: "present", file: "src/routes/auth.css.ts", literal: "background: var(--chq-surface);", testFile: "test/auth-card-geometry.test.ts" },
  },
  {
    key: "settings-760-measure-09-00-rejected",
    status: "honored",
    reason: "Settings keeps the app-wide --chq-measure token (DEC-744/DEC-808); the drawn 760px literal is not used.",
    honored: { kind: "present", file: "app/src/pages/settings/settings.css", literal: "max-width: var(--chq-measure);", testFile: "app/src/pages/settings/TracksRoomsPanel-css.test.ts" },
  },
  {
    key: "speakers-status-vocabulary-under-write-failure-dec-730-wave-90-amendment",
    status: "honored",
    reason: "the inverted DONE/PEND/LATE vocabulary (complete recedes bare-text, overdue is the filled exception) is the same class family in every state, including under a write-failure banner -- no separate write-failure styling exists.",
    honored: { kind: "present", file: "app/src/pages/speakers/speakers.css", literal: ".chq-speakers-status-complete {", testFile: "app/src/pages/speakers/speakers-css.test.ts" },
  },
  {
    key: "speakers-status-chip-hover",
    status: "honored",
    reason: "USER RULING 2026-08-19 (v12 review): a quiet --chq-surface-sunk background tint on hover, not the frame's box-shadow ring -- rounded status-fill states already paint, so a floating ring read as a false affordance around loose text.",
    honored: { kind: "present", file: "app/src/pages/speakers/speakers.css", literal: "button.chq-speakers-status:hover {", testFile: "app/src/pages/speakers/speakers-css.test.ts" },
  },
  {
    key: "focus-hover-ring-geometry-on-bare-text-controls",
    status: "honored",
    reason: "USER RULING 2026-08-19 (v12 review): quiet-action families (e.g. .chq-link-button) cancel inline padding with an equal-and-opposite negative margin-inline, so the focus/hover ring and hit box gain room while no glyph moves.",
    honored: { kind: "present", file: "app/src/styles.css", literal: ".chq-link-button {", testFile: "app/src/focus-treatment.scan.test.ts" },
  },
  {
    key: "portal-your-profile-dock-has-no-cancel-dec-154-wave-125-dec-576-wave-110-wave-119",
    status: "honored",
    reason:
      "DEC-154 wave-125 / DEC-576 wave-110-119: the 390 frame draws a bordered Cancel beside the docked Save on Your profile, but the page has no leave-without-saving destination distinct from the sign-out and the back-link already on screen -- DEC-576 forbids manufacturing a second control just to fill the band, so the dock carries only the primary Save profile.",
    honored: {
      kind: "present",
      file: "src/routes/portal/profile.tsx",
      literal: "const profileDock = (",
      testFile: "test/portal-phone-frames.test.ts",
    },
  },
  {
    key: "plan-editor-new-plan-footer-save-as-draft-open-the-plan-names-an-unrepresentable-state-dec-380-wave-130-amendment",
    status: "gap",
    reason:
      "DEC-380 wave-130 amendment, reconfirmed wave-140: the new-plan footer's caption names a save-without-opening state the schema has no column for -- a plan's openness is derived from openDate alone and isPlanOpen(openDate=null, closeDate=null, ...) reads an unset open date as open NOW, so the caption would be false if built. Re-tested against the narrowed rule at wave-140: evaluation_plan (src/db/schema/review.ts) still carries no draft/status column -- SCHEMA LACKS THE COLUMN. Recorded openly; the title row keeps its existing Cancel / Create the plan pair.",
  },
  {
    key: "contacts-pipeline-keeps-its-landed-head-action-no-phone-dock-is-minted-dec-576-wave-120-124",
    status: "superseded",
    reason:
      "DEC-967 wave-145: a build landed a Pipeline · 390 phone dock (app/src/pages/contacts/PipelineBoard.tsx renders both Add someone and Filter inside a docked .chq-phone-dock band), reversing this bullet's own 'no phone dock is minted' ruling now that 'Filter' has a wired referent -- the same-screen five-stage facet strip. The reversal is recorded, on its merits, in section 6's Adjudications as 'Contacts Pipeline · 390 dock IS minted; THIS REVERSES DEC-576 wave-120/124'.",
    superseded: { literal: "Contacts Pipeline · 390 dock IS minted" },
  },
  {
    key: "contacts-pipeline-390-dock-is-minted",
    status: "honored",
    reason:
      'DEC-967 wave-145: the reversal\'s two halves, both checked against the tree. Positive -- the dock is real: PipelineBoard.tsx renders a data-chq-phone-dock band with both Add someone and Filter. Negative -- the reversal invents no new domain capability: "Filter" re-slices entries the page already fetched (the same PIPELINE_STAGES the chq-contacts-pipeline-phone-stages strip draws above the list), never a new server query -- src/routes/api/pipeline.ts\'s GET /pipeline reads only page/perPage, no stage query param, so "Filter" cannot be quietly backed by a route this ledger never graded.',
    honored: [
      {
        kind: "present",
        file: "app/src/pages/contacts/PipelineBoard.tsx",
        literal: "data-chq-phone-dock",
        testFile: "app/src/pages/contacts/PipelineBoard.render.test.tsx",
      },
      { kind: "absent", term: 'query("stage")' },
    ],
  },
  {
    key: "the-contacts-390-rule-chips-label-ink-resolves-to-chq-brand-not-a-third-olive-dec-367-amendment-wave-16-r5",
    status: "honored",
    reason:
      "DEC-367 amendment, wave-16 r5: checked against the tree both halves. Positive -- the chip label really does draw --chq-brand: app/src/pages/contacts/contacts.css's .chq-contacts-filter-rule-chip sets color: var(--chq-brand), and the rule's own header comment confirms #2E3A16 resolves there so the label's REST ink is never a state token. Negative -- the resolution mints no new hex literal: --chq-brand (#4E5C31/#4e5c31), --chq-surface-sunk (#EFEBDF/#efebdf) and --chq-muted (#565A4B/#565a4b) are all pre-existing tokens declared in src/views/theme.ts and app/src/styles.css, not a fresh third olive.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/contacts.css",
      literal: "color: var(--chq-brand);",
      testFile: "app/src/pages/contacts/FilterRulesPanel.ruleChips.render.test.tsx",
    },
  },
  {
    key: "chq-submissions-table-wrap-app-src-pages-submissions-submissions-css-is-blessed-defensive-for-the-organiser-toggled-custom-column-picker-content-class-dec-367-wave-34-amendment",
    status: "honored",
    reason:
      "DEC-367 wave-34 amendment: Submissions.dc.html's desktop frame is a fixed 1600px canvas with no overflow-x drawn for the table -- the wrapper exists so the table keeps working once an organiser toggles the custom-column picker's optional columns on, a content class a static mock cannot depict.",
    honored: {
      kind: "present",
      file: "app/src/pages/submissions/submissions.css",
      literal: ".chq-submissions-table-wrap {",
      testFile: "test/horizontal-scroller-premise.scan.test.ts",
    },
  },
  {
    key: "chq-day-grid-app-src-pages-agenda-agenda-css-is-blessed-defensive-for-the-live-room-lane-matrix-content-class-dec-367-wave-34-amendment",
    status: "honored",
    reason:
      "DEC-367 wave-34 amendment: the day-grid room-lane matrix's room count is live event data, not a fixed design-time quantity, so no static frame can draw the matrix at every width a real room count could produce.",
    honored: {
      kind: "present",
      file: "app/src/pages/agenda/agenda.css",
      literal: ".chq-day-grid {",
      testFile: "test/horizontal-scroller-premise.scan.test.ts",
    },
  },
  {
    key: "chq-docs-code-src-routes-docs-site-css-ts-is-blessed-defensive-for-the-author-supplied-markdown-code-block-content-class-dec-367-wave-34-amendment",
    status: "honored",
    reason:
      "DEC-367 wave-34 amendment: Docs articles are markdown-sourced prose whose authors can paste code of any line length; the scroller guards that content class independent of which article a static mock's one captured example happened to render.",
    honored: {
      kind: "present",
      file: "src/routes/docs-site.css.ts",
      literal: ".chq-docs-code { max-width: 680px;",
      testFile: "test/horizontal-scroller-premise.scan.test.ts",
    },
  },
  {
    key: "table-pre-src-routes-portal-portal-css-ts-are-blessed-defensive-for-the-embedded-content-content-class-dec-367-wave-34-amendment",
    status: "honored",
    reason:
      "DEC-367 wave-34 amendment: portal pages render organiser-authored embedded content whose shape a static frame set cannot enumerate in advance, so any such embed gets its own scroll container instead of pushing the page wide.",
    honored: {
      kind: "present",
      file: "src/routes/portal/portal.css.ts",
      literal: "table {",
      testFile: "test/horizontal-scroller-premise.scan.test.ts",
    },
  },
  {
    key: "portal-resource-modal-kind-pair-file-link-docs-design-chautauqua-settings-dc-html-1463-1464",
    status: "honored",
    reason:
      "DEC-380 wave-130 amendment, reconfirmed wave-140: this product's second resource kind is a wiki page with stored markdown, not a link, so there is no link-kind referent to build. Re-tested against the narrowed rule at wave-140: the content schema's kind column (src/db/schema/content.ts) still admits only 'file'/'wiki' -- THE PRODUCT HAS NO SUCH OBJECT. The chips stay File / Wiki page. Multi-portal decision 74 moved resource creation into the portal library, where the same two kinds read Write a page / Upload a file -- still no link kind.",
    honored: { kind: "present", file: "app/src/pages/portals/NewLibraryItemModal.tsx", literal: "Upload a file", testFile: "app/src/pages/portals/LibraryPage.render.test.tsx" },
  },
  {
    key: "cfp-not-yet-open-pages-link-now-points-at-the-prior-edition",
    status: "superseded",
    reason:
      "DEC-745 wave-150 amendment: the still-owed build recorded through wave-149 (getPriorPublicEvent existed but NotYetOpenPage was never wired to it) landed -- NotYetOpenPage now resolves getPriorPublicEvent at all three call sites and renders the frame's 'Browse last year's sessions' label pointing at the prior edition's sessions surface when one qualifies, falling back to the original link/label unchanged otherwise. This bullet is its own record of that build; nothing external adjudicates it.",
    superseded: { literal: "RETIRES the entry recorded above through wave-149" },
  },
  {
    key: "field-name-eyebrows-drawn-as-bordered-chips-rendered-as-plain-text",
    status: "honored",
    reason:
      "DEC-393 wave-155 amendment (task pe): test/desktop-control-floor.scan.test.ts's desktop drawn-floor ledger extracts any pack element with a min-height + border-radius + (border/background) shape as a DRAWN CONTROL, with no way to tell a real control from decoration. Twelve of that ledger's 23 wave-151 offenders are field-name/section-name labels the pack draws as bordered chips that the app correctly renders as plain, unbordered text via .chq-portal-field-label / .chq-page-title / .chq-section-label -- none of the three is a control anywhere in the app.",
    honored: { kind: "present", file: "src/routes/portal/portal.css.ts", literal: ".chq-portal-field-label {", testFile: "test/desktop-control-floor.scan.test.ts" },
  },
  {
    key: "contacts-390-rule-chip",
    status: "honored",
    reason:
      "DEC-393 wave-16 r4 amendment: the frame's drawn gap:9px between the chip's edit label and its dismiss control is met as hit-box separation, not literal optical separation -- the 44px width floor and a literal 9px drawn gap between glyphs cannot both hold at this glyph size, and the floor wins per DEC-393.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/contacts.css",
      literal: ".chq-contacts-filter-rule-chip-edit",
      testFile: "app/src/pages/contacts/contacts-rule-chip-geometry-390.test.ts",
    },
  },
  // ---- ## 7. Settled frame divergences (wave 16 amendment, DEC-663) -----
  {
    key: "contacts-merge-390-picker-block",
    status: "honored",
    reason:
      "the frame's 390 drill goes straight from the head band into the field-by-field compare rows, drawing no intervening control, but MergePage renders an additional radio list above those rows that selects WHICH duplicate pair is being merged -- a capability the frame's already-chosen-pair mock silently assumes; removing it would strand a 3+-member duplicate group's route to a usable merge.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/MergePage.tsx",
      literal: "chq-contacts-merge-picks",
      testFile: "app/src/pages/contacts/MergePage.frame390.render.test.tsx",
    },
  },
  {
    key: "speaker-portal-landings-fourth-section-and-its-resources-footer-link",
    status: "honored",
    reason:
      "GET /portal renders a fourth section between 'Waiting on you' and 'Your session' ('Your submissions') and a footer Resources link that the frame's 390 landing cut, drawn before these features existed, omits -- both are shipped product ruled real by DEC-729 and DEC-988.",
    honored: [
      { kind: "present", file: "src/routes/portal/index.tsx", literal: '<section aria-label="Your submissions" class="chq-section">', testFile: "test/portal-390-frame-verdicts.test.ts" },
      { kind: "present", file: "src/routes/portal/index.tsx", literal: '<a href="/portal/resources" class="chq-portal-footer-resources">Resources</a>', testFile: "test/portal-390-frame-verdicts.test.ts" },
    ],
  },
  {
    key: "speakers-390-landings-roster-trigger",
    status: "honored",
    reason:
      "no Speakers 390 landing frame draws an entry point into the roster drill, but the drill's own destination frame IS drawn -- without a trigger that destination would be unreachable dead code, so the app adds the narrowest possible entry point, already commented as scaffolding rather than a frame match.",
    honored: { kind: "present", file: "app/src/pages/speakers/OnboardingGrid.tsx", literal: "chq-speakers-phone-roster-link", testFile: "app/src/pages/speakers/OnboardingGrid.render.test.tsx" },
  },
  {
    key: "submit-a-talks-format-legend",
    status: "honored",
    reason:
      "the frame draws the bare word 'Format' for the 390 submit form's format-choice group legend, but FormatChoices renders <legend>{field.label}</legend> and the seeded fixture's stored label is organizer-authored content ('Session format'), not a product string the frame is specifying -- hardcoding the frame's word would overwrite what an organizer typed into their own CFP form.",
    honored: { kind: "present", file: "src/routes/public/submit-views.tsx", literal: "<legend>{field.label}</legend>", testFile: "test/cfp-stored-label-register.test.ts" },
  },
  {
    key: "cfp-wizard-docks-save-draft-vs-the-frames-draft-already-ruled-recorded-here-only-so-the-ledger-stops-re-filing-it",
    status: "honored",
    reason:
      "the accessible name stays 'Save draft' per DEC-613's wave-96 amendment, one control with one name at every width -- the frame's 'Draft' is a drawing abbreviation rather than a label to ship. The sheet states its own disposition inline; recorded here only so the ledger stops re-filing it.",
    honored: {
      kind: "present",
      file: "src/routes/public/cfp.css.ts",
      literal: 'the accessible name stays "Save draft" per DEC-613 wave-96 amendment',
      testFile: "test/cfp-desktop-frame-verdicts.test.ts",
    },
  },
  {
    key: "plan-editors-v4-title-row-shell-name-as-input-duplicate-save-on-the-back-link-row-is-blessed-superseding-the-frames-separate-h1-footer-save-cancel-anatomy",
    status: "honored",
    reason:
      "the frame's 390 plan-editor draws a standalone <h1> plus a docked footer Save/Cancel pair below the fields; the shipped shell instead renders the plan's name as an editable input with Duplicate/Save on the SAME row as the back link -- rebuilding the frame's separate anatomy would delete rename-in-place, a shipped capability the frame predates.",
    honored: { kind: "present", file: "app/src/pages/review/PlanEditor.tsx", literal: "chq-review-editor-title-row", testFile: "app/src/pages/review/PlanEditor.render.test.tsx" },
  },
  {
    key: "settings-events-read-drill-footer-has-no-cancel",
    status: "honored",
    reason:
      "the frame draws a content+Save/Cancel-footer anatomy for the drilled Event screen; the read view instead stands the head's own 'Change' action down at 390 (a read view holds no form to submit, so no Cancel is manufactured to pair with it) because the read drill's own footer primary already carries the identical edit route. The frame's full Save/Cancel pair renders in the edit drill itself, where a form genuinely exists to submit or discard.",
    honored: [
      {
        kind: "present",
        file: "app/src/pages/settings/settings.css",
        literal: ".chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action {",
        testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx",
      },
      {
        kind: "present",
        file: "app/src/pages/settings/EventSettingsPanel.tsx",
        literal: 'className="chq-btn chq-btn-secondary" onClick={closeEdit} disabled={saving}>',
        testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx",
      },
    ],
  },
  {
    key: "a-modalframe-dialogs-title-stays-an-h2-referenced-by-aria-labelledby-not-the-frames-h1",
    status: "honored",
    reason:
      "every docs/design/*.dc.html 390 drill frame standing in for a ModalFrame-built dialog draws its head as an <h1>, because a static frame has no concept of 'this screen is a dialog layered over a page'. ModalFrame.tsx renders the dialog's title as an <h2> pointed at by aria-labelledby -- the correct document outline (one <h1> per document, dialogs labelled relative to their trigger) -- left as <h2> on purpose; only the tag name diverges.",
    honored: { kind: "present", file: "app/src/components/ModalFrame.tsx", literal: '<h2 className="chq-modal-title">{title}</h2>', testFile: "app/src/components/modal-frame-title-phone-drill.test.ts" },
  },
  {
    key: "contacts-390-stands-down-three-purely-informational-readings-with-no-surviving-path-wave-16-r5-amendment-src-decisions-data-dec-919-md",
    status: "honored",
    reason:
      "two title-row summary clauses (returning speakers, reach across events) and the DirectoryRail's ranked top-companies aggregate are lost outright at 390, not re-lined -- all three are readings with no action attached, and the frame's phone head band has no slot left for any of them (fully spent on the wordmark row, the page title and the re-lined three-clause summary), with no rail slot at all in the body. Stood down as recorded deviations via the rail's own phone display:none rule, not silently dropped inside a receipt that claims re-lining.",
    honored: {
      kind: "present",
      file: "app/src/pages/contacts/contacts.css",
      literal: "  .chq-contacts-rail {\n    display: none;\n  }",
      testFile: "app/src/pages/contacts/DirectoryRail.phone390.render.test.tsx",
    },
  },
  {
    key: "settings-events-slug-field-stays-slug-not-the-frames-public-url-dec-613-wave-24-amendment",
    status: "honored",
    reason:
      "the frame's 'Public URL' label names a field whose drawn value is a full rendered origin+slug, but EventSettingsPanel.tsx's control edits the slug segment alone -- the panel's own PATCH payload and form state key are 'slug', never a composed URL, so adopting the frame's label without also building the origin-prefix presentation it implies would name the field something the input does not accept.",
    honored: { kind: "present", file: "app/src/pages/settings/EventSettingsPanel.tsx", literal: "slug: 'Slug',", testFile: "app/src/pages/settings/EventSettingsPanel.render.test.tsx" },
  },
  // The seven rows below were added by the WAVE-31 MERGE TRAIN, not by task
  // w31-c. w31-c derived this population from DEVIATIONS.md's live headings
  // (replacing the old hand-listed INCLUDED_HEADINGS) while `## 7` carried 10
  // bullets; main had meanwhile grown the section to 17 -- the wave-30
  // megabatch landed DEC-582's "CFP display-only overrides" subsection (six
  // bullets) plus DEC-919's Content-390 chip-strip entry. The merge surfaced
  // all seven as "derived bullet with no ledger row", which is w31-c's
  // derivation working exactly as built: a hand-listed population would have
  // stayed silently green. Each was graded by the same rule as the original
  // ten -- open the cited artifact, confirm it carries the cited literal --
  // and each cites the SAME guard test DEVIATIONS.md's own bullet names, so
  // no row here invents a resolver the prose did not already claim.
  {
    key: "content-390-chip-strip-keeps-its-third-chip-all-accepted-sessions-dec-919-wave-28-amendment",
    status: "honored",
    reason:
      "DEC-919 wave-28 amendment: the frame draws three chips at desktop and only two in both 390 extents, but the product renders all three at every width. RULED that the third stays -- a filter tab is a capability, not prose, so DEC-919's re-line-never-remove governs it, and the frame's own 390 chip row declares overflow-x:auto, meaning a member past the drawn viewport is a drawing boundary rather than an omission to match.",
    honored: {
      kind: "present",
      file: "app/src/pages/content/worklist.ts",
      literal: "export const WORKLIST_TABS = ['needs_decision', 'approved', 'all'] as const;",
      testFile: "app/src/pages/content/ContentApp.landing390.render.test.tsx",
    },
  },
  {
    key: "abstract-helper-text-cfp-abstract-help-text",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: frame-copy override. The frame draws this helper beneath the Abstract field and the product ships the identical literal, overriding whatever helper text a producer's own stored field carries -- display-only chrome the frame itself draws, which is the half of DEC-613 wave-27's rule where frame copy wins.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_ABSTRACT_HELP_TEXT = "Shown on the public sessions page if your talk is accepted";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "bio-helper-text-cfp-bio-help-text",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: frame-copy override. The frame draws this helper beneath the Bio field and the product ships the identical literal. Note this row touches helpText only -- the bio LABEL is the deliberate non-override recorded in its own row below.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_BIO_HELP_TEXT = "Shown on the public speakers page · you can edit it later in your portal";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "email-helper-text-cfp-email-help-text-the-one-addition-not-a-frame-match",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: the one ADDITION in this subsection, recorded as such rather than dressed up as a frame match. The frame draws no helper under Email at all; the product adds one stating a real, invisible cost (a typo strands the speaker with no other route to their portal) that a static mock has no room to draw.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_EMAIL_HELP_TEXT = "We send your portal link here, so a typo means you never get it";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "notes-for-reviewers-placeholder-cfp-notes-for-reviewers-placeholder",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment (DEC-380 wave-133 for the shape): the frame draws this string as example content INSIDE the textarea, not as a below-field caption, so the product ships it as the control's placeholder attribute -- the closest DOM equivalent of 'content drawn inside the box'.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_NOTES_FOR_REVIEWERS_PLACEHOLDER = "Never shown publicly";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "accessibility-needs-placeholder-cfp-accessibility-needs-placeholder",
    status: "honored",
    reason:
      "DEC-582 wave-30 amendment: same pattern as the notes-for-reviewers row above -- the frame draws the string inside the control, so the product ships it as a placeholder. Both fields are asserted together by the one cited guard.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: 'const CFP_ACCESSIBILITY_NEEDS_PLACEHOLDER = "Goes to the venue team only";',
      testFile: "test/submit-cfp-frame-copy.test.ts",
    },
  },
  {
    key: "bio-label-deliberately-not-overridden",
    status: "honored",
    reason:
      "DEC-613 wave-27, quoted verbatim by DEVIATIONS.md itself: 'the bio field's stored label ships at every width -- a frame's abbreviated legend never renames stored data.' The frame draws 'Bio · optional' as the legend, but displayFields applies NO label override for bio, so the producer-authored stored label ships as-is. This row's claim is a NON-build, so it carries the two-cite shape DEC-967 wave-145 requires: the built half (the helpText-only override that proves displayFields reaches this field at all) and the not-built half (no CFP_BIO_LABEL-shaped constant anywhere), so the row cannot go stale by someone later adding the override.",
    honored: [
      {
        kind: "present",
        file: "src/routes/public/submit-views.tsx",
        literal: "return { ...f, helpText: CFP_BIO_HELP_TEXT };",
        testFile: "test/submit-cfp-frame-copy.test.ts",
      },
      { kind: "absent", term: "CFP_BIO_LABEL" },
    ],
  },
  {
    key: "cfp-form-builders-add-a-question-copy-and-delete-this-question-render-as-real-button-s-not-the-frames-a-href-dec-663-wave-34-amendment",
    status: "honored",
    reason:
      "DEC-663 wave-34 amendment: a .dc.html frame is a static drawing, so a `<a href=\"#\">` there is a control TREATMENT, never a claim about the shipped element type. `Add a question` (frame :433), `Copy` (frame :455) and `Delete this question` (frame :722) each write local state or copy to the clipboard and never navigate, so the product ships <button> for each -- the pack governs text, position and geometry, never element type. Blesses what is already built; closes submissions-desktop-v12.md's two open :399 control-type rows.",
    honored: [
      { kind: "present", file: "app/src/pages/forms/FormsPage.tsx", literal: 'className="chq-link-button chq-forms-add-question"', testFile: "app/src/pages/Submissions.desktop-frame-verdicts.render.test.tsx" },
      { kind: "present", file: "app/src/pages/forms/FormsPage.tsx", literal: 'className="chq-btn chq-btn-tertiary" onClick={() => void handleCopyPublicLink()}', testFile: "app/src/pages/Submissions.desktop-frame-verdicts.render.test.tsx" },
      { kind: "present", file: "app/src/pages/forms/FieldModal.tsx", literal: "Delete this question", testFile: "app/src/pages/Submissions.desktop-frame-verdicts.render.test.tsx" },
    ],
  },
  // ---- ## 8. Wave 9 rulings (DEC-976 / DEC-781 wave-9 amendments) -------
  {
    key: "a-pack-frame-that-documents-a-vocabulary-is-not-a-screen",
    status: "honored",
    reason:
      "two pack frames document a VOCABULARY rather than a screen (Comms's 4-up template reference gallery, and Docs's element-library frame drawing nine block kinds); neither is built under the desktop freeze. docsSiteRoutes registers only /docs and /docs/:slug, and the nine block kinds the Docs frame draws live in DocsBlock's own closed union, confirming the vocabulary reading rather than a missed screen.",
    honored: { kind: "present", file: "src/routes/docs-content/types.ts", literal: "DocsBlock's union is DEC-650's closed nine-block element library", testFile: "test/docs-block-vocabulary.test.ts" },
  },
  {
    key: "confirmdialog-gains-no-subtitle-slot",
    status: "honored",
    reason:
      "the frame's ConfirmDialog subtitle names an embed HOST the schema has never carried -- SavedEmbedsPanel.tsx's own comment records that the embeds repo and schema carry no referrer/host column, and DEC-781 already ruled the data-backed consequence lines unbuilt because DEC-380 governs (a frame's drawing does not create a data model). A slot with no reader is deferred on the same footing as the frame's other unbacked consequence line.",
    honored: { kind: "present", file: "app/src/pages/settings/SavedEmbedsPanel.tsx", literal: "Copy rule 3 forbids asserting what no endpoint stores.", testFile: "app/src/pages/settings/SavedEmbedsPanel.render.test.tsx" },
  },
  {
    key: "settings-950s-edit-footer-keeps-its-single-close",
    status: "honored",
    reason:
      "the frame draws a Cancel/Save-changes pair, but this form has no fields to submit -- every role change and removal writes immediately from the row-level controls -- so there is nothing for Save to commit and nothing for Cancel to revert. The frame's 'Change your own password' link beside them IS built, as SettingsEditForm's destructive footer slot.",
    honored: { kind: "present", file: "app/src/pages/settings/PeopleRolesPanel.tsx", literal: '<button type="button" className="chq-btn chq-btn-primary" onClick={closeEdit}>', testFile: "app/src/pages/settings/PeopleRolesPanel.roleChange.render.test.tsx" },
  },
  {
    key: "contacts-720s-single-stage-pill-page-is-the-phone-register",
    status: "honored",
    reason:
      "the tree's .chq-contacts-pipeline-phone-stages IS the frame's pill strip, at the width it belongs to; desktop's five simultaneous Kanban columns are settled truth verdicted MATCHES at the frame's desktop cut. stageEmptyBody() naming the structurally immediately-preceding stage (not the frame copy's two-back reference) is the correct derivation of the frame's own sentence, not a defect.",
    honored: { kind: "present", file: "app/src/pages/contacts/PipelineBoard.tsx", literal: "function stageEmptyBody(stage: PipelineStage, entries: PipelineEntry[]): string {", testFile: "app/src/pages/contacts/PipelineBoard.render.test.tsx" },
  },
  // ---- ## 9. Wave 34 rulings (DEC-021 wave-34 amendment) ----------------
  {
    key: "breakspanels-outside-the-window-hint-no-longer-matches-chautauqua-agenda-dc-html-244-verbatim",
    status: "honored",
    reason:
      "DEC-021 wave-34: a break with no intersection at all with the day window gets no band (fixed by gridMath.ts's clampBreakToWindow), so BreaksPanel's hint was split into two clauses (still-overlaps -> greyed band; falls-entirely-outside -> no band) to state both outcomes truthfully instead of continuing to assert the frame's disproven unconditional 'always greyed' claim. The frame's own caption is recorded SUPERSEDED in the frame-caption ledger (test/frame-caption-ledger/exclusions/superseded.ts) citing this same ruling.",
    honored: {
      kind: "present",
      file: "app/src/pages/agenda/BreaksPanel.tsx",
      literal: "if it falls entirely outside them, it is listed here but no band is drawn.",
      testFile: "app/src/pages/agenda/BreaksPanel.render.test.tsx",
    },
  },
  // ---- ## 10. Wave 35 rulings (DEC-393 wave-35 amendment) ---------------
  // Three rung-3 outcomes of the inline-prose grounding ladder: the pack
  // draws no standalone control and the surface carries no floored twin for
  // any of the three destinations, so each link stays running-prose
  // typography and the deviation is recorded. DEC-996 wave-35 gave each
  // anchor its own `chq-` class token, which is what these rows cite -- the
  // token IS the built artifact the ruling promises (an instrument-reachable
  // receipt), and test/public-390-inline-link-grounding.test.ts pins all
  // three end to end against the rendered HTML.
  {
    key: "cfp-new-speaker-create-an-account-src-routes-public-submit-views-tsx-chq-cfp-intro-cta-link",
    status: "honored",
    reason:
      "DEC-393 wave-35 (task w35-b): neither the desktop nor the 390 'Submit a talk' frame extent draws this affordance at all, and no same-surface floored control reaches #chq-cfp-submit-form -- rungs 1 and 2 both fail, so the link keeps its line-box height. What IS built, per DEC-996 wave-35, is the anchor's own class token, so the exemption is scoped by token and reachable by the tap-floor instruments instead of living only in prose.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: '<a class="chq-cfp-intro-cta-link" href="#chq-cfp-submit-form">',
      testFile: "test/public-390-inline-link-grounding.test.ts",
    },
  },
  {
    key: "cfp-already-have-an-account-sign-in-to-the-speaker-portal-src-routes-public-submit-views-tsx-chq-cfp-identity-note-link",
    status: "honored",
    reason:
      "DEC-393 wave-35 (task w35-b): the same two frame extents draw no sign-in control, and the page carries no other floored control reaching /login -- rungs 1 and 2 fail for the identical reason as the entry above. The built artifact is the anchor's own DEC-996 class token, which scopes the tap-floor exemption by token.",
    honored: {
      kind: "present",
      file: "src/routes/public/submit-views.tsx",
      literal: '<a class="chq-cfp-identity-note-link" href="/login">',
      testFile: "test/public-390-inline-link-grounding.test.ts",
    },
  },
  {
    key: "docs-login-reference-src-routes-docs-tsx-chq-docs-auth-link",
    status: "honored",
    reason:
      "DEC-393 wave-35 (task w35-b): /docs/api has no v12 frame of any kind -- it is one of DEC-382's three operator 'chrome' surfaces, not a designed screen -- so rungs 1 and 2 fail by construction and the reference-page prose link stays unfloored. The built artifact is the anchor's own DEC-996 class token, which scopes the tap-floor exemption by token.",
    honored: {
      kind: "present",
      file: "src/routes/docs.tsx",
      literal: '<a class="chq-docs-auth-link" href="/login">',
      testFile: "test/public-390-inline-link-grounding.test.ts",
    },
  },
];
