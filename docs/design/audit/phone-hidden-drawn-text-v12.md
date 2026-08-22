# Phone hidden-drawn-TEXT ledger, phone (width:390) — DEC-725 wave-31 amendment

Instrument: `app/src/phone-hidden-drawn-text.scan.test.ts`. This ledger names
the pack's population that `app/src/phone-capability-removal.scan.test.ts`
(DEC-919) does not grade: a phone `display:none` rule whose hidden `chq-`
token carries **TEXT** (not an interactive control) the pack's own 390 frame
extents still draw. `PHONE_HIDDEN_UNRECEIPTED_CEILING`'s population is
INTERACTIVE selectors keyed on a `/* phone-hidden: <reason> */` receipt; a
bare `<span>`/`<div>` carrying copy sits entirely outside it, and the prose
reason written above such a rule (e.g. "never paints at this width") is a
claim nothing previously checked. This file MEASURES AND RATCHETS ONLY — it
moves no product byte and no CSS.

## Worked example (the amendment's own motivating case)

`app/src/pages/review/review.css`'s terminal phone block sets
`.chq-review-criteria-eyebrow` and `.chq-review-criteria-head-row` to
`display: none`, arguing in its own comments that the eyebrow "never paints
at this width" and that "once the body rows below collapse to stacked cards
there are no columns left to label". `docs/design/Chautauqua Review.dc.html`'s
"Plan editor · 390" frame (line 594) draws `Weight` as a PER-CRITERION
eyebrow **inside** that very stacked card. `app/src/pages/review/PlanEditor.tsx`'s
`.chq-review-criteria-head-row` block carries a nested
`.chq-review-criteria-head-cell` span whose own static text is `Weight ` —
that literal is drawn verbatim inside the frame's phone extent, so the
premise is FALSE. `.chq-review-criteria-eyebrow`'s own text is either
composed (a "Locked — N scored..." sentence built from a live count) or a
static sentence ("Scores average by weight") that resolves against no frame
extent, so it grades UNVERIFIABLE rather than PREMISE-OK (a composed finding
on the same token means the join cannot fully clear the rule).

Both rows are included in the two rosters below. `v12m-w31-a` repairs both
in this same batch (see "Megabatch merge note" below).

## Population (DEC-808, directory walk, never a hand list)

1. **CSS side** — every phone (`max-width <= 700px`) `display: none` rule in
   `app/src/**/*.css` and `src/**/*.ts` files declaring an exported CSS
   template literal — REUSED verbatim from
   `app/src/phone-capability-removal.scan.test.ts`'s exported
   `PHONE_DISPLAY_NONE_RULES` (comment-aware, brace-matched media-block
   walk; DEC-613, never re-implemented). Unlike that file, this ledger does
   NOT narrow to "interactive" — plain prose is squarely its subject.
2. **TSX side** — every `chq-…` class token on every element under
   `app/src/**` / `src/**` (`enumerateSourceFiles` + `stripComments` from
   `test/frame-source-corpus.ts`, DEC-613), walked to its BALANCED matching
   close tag (a token's own text may sit behind further nested markup, the
   worked example above) and every text/JSX-expression run inside that
   block, keyed by whether it is a static literal or a composed JSX
   expression. A candidate must carry at least 3 consecutive letters to
   count as real prose (bare punctuation/interpolation noise from the walk
   can never manufacture a finding).
3. **Frame side** — every `width:390px`/`height:844` phone frame extent in
   `docs/design/*.dc.html`, walked with the SAME frame/label/extent-end
   grammar `test/frame-eyebrow-label.scan.test.ts` and
   `test/frame-control-label.scan.test.ts` already share (ported, this
   campaign's standing convention), matched with `labelIsMatched` /
   `normalizeSource` imported verbatim from `test/frame-source-corpus.ts`
   (DEC-613).

A CSS rule enters the graded population only if some `chq-` token on its
selector has at least one text-bearing finding; a rule with no text-bearing
element at all (a decorative/layout-only hide) is outside this population
entirely — disjoint from `PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own
INTERACTIVE population by construction.

## Grade (DEC-725 wave-31 amendment clause (c))

- **PREMISE-FALSE**: some static (non-composed) text finding for the rule's
  tokens occurs verbatim in some width:390 frame's extent — the hide's own
  premise is contradicted by the pack.
- **UNVERIFIABLE**: no static finding resolves against any frame, but at
  least one finding for the rule's tokens IS composed — the join technique
  is a static substring test and can never verify a value assembled at
  render time. Recorded WITH its reason, never a silent pass (DEC-180).
- **PREMISE-OK**: every text-bearing finding is static and none occurs in
  any frame extent — the hide's premise holds against the pack as measured.

## A coarse, honest join — the population is real and larger than the worked example

The join is a **verbatim literal match against every width:390 frame
extent in the pack**, not scoped to the hidden rule's own page or feature
(the ruling's own definition of PREMISE-FALSE names no such scoping). Short,
common UI words ("Save", "Open", "Cancel", "Sign out", "Agenda") legitimately
recur across many unrelated frames, so a number of PREMISE-FALSE rows below
are coincidental cross-page agreement rather than a same-screen contradiction
— this is the SAME coarseness DEC-393's wave-30 amendment named for
`tap-floor-exempt:` receipts ("a receipt asserts a fact about markup, and no
instrument checks it") one property over: this instrument checks the literal
claim precisely as the ruling defines it, and does not (yet) additionally
verify whether some OTHER visible element on the SAME phone surface already
carries the identical text (the "desktop twin" pattern
`PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own closed rows already document for
several of the `-desktop`-suffixed selectors below). Narrowing the join to
same-page/same-feature frame extents, and reconciling against
`PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own twin-detection precedent, is the
next wave's work, not this one's.

## Ratchet: measured `-1`, two constants, both two-sided

`PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = 59`,
`PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 35`. Both registered in
`scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` (a newly-derived,
previously-uncounted population must not move the campaign's goalposts
mid-convergence — the same disposition already given to
`FRAME_EYEBROW_DIVERGENCE_CEILING` / `FRAME_EYEBROW_UNRESOLVED_CEILING`).
Both carry a companion "never sits ABOVE the measured truth" `it`
(two-sided, per `test/campaign-ratchet-two-sided.scan.test.ts`).

## Megabatch merge note (Thunderdome)

This section was written while the sibling repair was still in flight, and
it predicted (DEC-725) that both ceilings would drop by at least one each
once the wave-31 batch landed, on the reasoning that the two
`.chq-review-criteria-*` rows in the worked example above
(`app/src/pages/review/review.css`) were about to be repaired.

**That prediction was wrong, and the merge train re-measured rather than
assuming it (DEC-725).** Both branches are now on main, the scan was
re-run on the merged tree with both ceilings forced to 0, and the measured
truth is unchanged: **59 PREMISE-FALSE / 35 UNVERIFIABLE**, exactly the
constants already recorded. Neither is tightened, because tightening a
ratchet to a number the instrument does not report would be the precise
dishonesty these two-sided guards exist to prevent.

Both worked-example rows survive the repair, for reasons the repair does
not touch:

- `.chq-review-criteria-head-row` stays PREMISE-FALSE. The phone rule still
  hides a row whose "Weight" text the pack draws verbatim in the
  "Plan editor · 390" extent, so the hide's own premise is still
  contradicted. Building the eyebrow beside it did not remove the hidden
  row that carries the drawn word.
- `.chq-review-criteria-eyebrow` stays UNVERIFIABLE. Its text child is
  assembled at render time from a live count, and a static substring join
  can never verify a composed value — an instrument-completeness fact
  about this scan's own technique, which no product change can discharge.

This file's own two probe assertions pin both gradings against the LIVE
tree, so neither claim here rests on this prose: if a later wave really
does drain either row, those probes fail and force this section to be
rewritten rather than letting it quietly go stale.

## PREMISE-FALSE roster (59 rows)

- `app/src/pages/agenda/agenda.css` :: `.chq-phone-agenda-wordmark` -- "chautauqua" (app/src/pages/agenda/PhoneAgenda.tsx) is drawn verbatim at Chautauqua Account.dc.html:121 "Sign in · 390"
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-head .chq-page-title` -- "Agenda" (app/src/pages/Agenda.tsx) is drawn verbatim at Chautauqua Agenda.dc.html:127 "Agenda"
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-head-actions .chq-btn-secondary` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id"
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-armed-bar` -- "Cancel" (app/src/pages/Agenda.tsx) is drawn verbatim at Chautauqua Account.dc.html:153 "Change password · 390"
- `app/src/pages/comms/comms.css` :: `.chq-comms-templates-table thead` -- "Name" (app/src/pages/comms/TemplatesTab.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1561 "Portal · Resources"
- `app/src/pages/comms/comms.css` :: `.chq-comms-compose-table thead` -- "Speakers" (app/src/pages/comms/ComposeWizard.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:179 "Contacts"
- `app/src/pages/comms/comms.css` :: `.chq-comms-main-landing` -- "Comms" (app/src/pages/Comms.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"
- `app/src/pages/comms/comms.css` :: `.chq-comms-batch-toggle-label-desktop` -- "Open" (app/src/pages/comms/RecentSends.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import-review-table thead` -- "Email" (app/src/pages/contacts/ImportWizard.tsx) is drawn verbatim at Chautauqua Account.dc.html:121 "Sign in · 390"
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import:has([data-chq-phone-dock]) .chq-modal-actions` -- "Save" (app/src/pages/comms/TemplatesTab.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-pipeline-head > .chq-btn` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id"
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-table thead` -- "Company" (app/src/pages/contacts/ContactsTable.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1561 "Portal · Resources"
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-title-row .chq-summary` -- "Contacts" (app/src/pages/contacts/ContactsApp.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:179 "Contacts"
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-segment-summary` -- "none" (app/src/pages/contacts/ContactsApp.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1561 "Portal · Resources"
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-filter-rules-row` -- "Remove" (app/src/pages/contacts/FilterRulesPanel.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:864 "My schedule · /schedule"
- `app/src/pages/content/content.css` :: `.chq-content-table thead` -- "Session" (app/src/pages/content/FilesLibrary.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/content/content.css` :: `.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(1)` -- "Session" (app/src/pages/content/FilesLibrary.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/content/content.css` :: `.chq-content-worklist-selecting .chq-content-table tr.chq-content-row > td:nth-child(6)` -- "Session" (app/src/pages/content/FilesLibrary.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/content/content.css` :: `.chq-content-worklist .chq-bulkbar` -- "Session" (app/src/pages/content/SessionList.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/content/content.css` :: `.chq-content-worklist-selecting .chq-bulkbar-count` -- "Session" (app/src/pages/content/SessionList.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/content/content.css` :: `.chq-content-worklist-selecting .chq-bulkbar-actions .chq-btn-tertiary` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id"
- `app/src/pages/content/content.css` :: `.chq-content-comment-actions` -- "Ask for changes" (app/src/pages/content/CommentThread.tsx) is drawn verbatim at Chautauqua Content.dc.html:373 "Session · deliverable"
- `app/src/pages/forms/forms.css` :: `.chq-forms-add-question` -- "Add a question" (app/src/pages/forms/FormsPage.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:468 "CFP form · 390"
- `app/src/pages/forms/forms.css` :: `.chq-forms-header-actions` -- "Preview" (app/src/pages/forms/FormsPage.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:468 "CFP form · 390"
- `app/src/pages/overview/overview.css` :: `.chq-overview-clash-eyebrow-group > .chq-overview-row-title-sm, .chq-overview-clash-eyebrow-group > .chq-overview-row-meta` -- "Public pages" (app/src/pages/Overview.tsx) is drawn verbatim at Chautauqua Settings.dc.html:481 "Settings · Public pages"
- `app/src/pages/review/review.css` :: `.chq-review-results-table thead` -- "Name" (app/src/pages/review/PlanEditor.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1561 "Portal · Resources"
- `app/src/pages/review/review.css` :: `.chq-review-criteria-head-row` -- "Weight" (app/src/pages/review/PlanEditor.tsx) is drawn verbatim at Chautauqua Review.dc.html:594 "Plan editor · 390"
- `app/src/pages/review/scorecard.css` :: `.chq-review-overall-line:has(.chq-review-overall-value-phone) .chq-review-overall-value` -- "Overall" (app/src/pages/review/Scorecard.tsx) is drawn verbatim at Chautauqua Review.dc.html:280 "Reviewer scorecard · /review/plans/:id/submissions/:id"
- `app/src/pages/settings/settings-drill-rows.css` :: `.chq-settings-drillrow-head-hide` -- "Add a track" (app/src/pages/settings/TracksRoomsPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:347 "Settings · Tracks and rooms"
- `app/src/pages/settings/settings-lists.css` :: `.chq-settings-token-create .chq-btn-primary, .chq-settings-people-invite-action` -- "Save" (app/src/pages/comms/TemplatesTab.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/pages/settings/settings.css` :: `.chq-settings-layout[data-drilled='true'] .chq-settings-rail` -- "Open" (app/src/pages/Settings.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/pages/settings/settings.css` :: `.chq-settings-panel .chq-table thead` -- "Speakers" (app/src/pages/comms/ComposeWizard.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:179 "Contacts"
- `app/src/pages/settings/settings.css` :: `.chq-settings-page:has(.chq-settings-layout[data-drilled='true']) > .chq-page-title` -- "Agenda" (app/src/pages/Agenda.tsx) is drawn verbatim at Chautauqua Agenda.dc.html:127 "Agenda"
- `app/src/pages/settings/settings.css` :: `.chq-settings-saved-embed-body` -- "Edit" (app/src/pages/settings/SavedEmbedsPanel.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:407 "Contact · 390"
- `app/src/pages/settings/settings.css` :: `[data-screen='true'] .chq-settings-saved-embed-heading` -- "Saved embeds" (app/src/pages/settings/SavedEmbedsPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:578 "Settings · Saved embeds"
- `app/src/pages/settings/settings.css` :: `[data-screen='true'] .chq-settings-saved-embeds-open` -- "Open" (app/src/pages/settings/SavedEmbedsPanel.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/pages/settings/settings.css` :: `.chq-settings-public-pages-own-hidden` -- "Public pages" (app/src/pages/settings/PublicPagesPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:481 "Settings · Public pages"
- `app/src/pages/settings/settings.css` :: `.chq-settings-people-header-row` -- "Role" (app/src/pages/settings/PeopleRolesPanel.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/settings/settings.css` :: `.chq-settings-panel > .chq-settings-section-head > h2` -- "Done" (app/src/pages/settings/ApiTokensPanel.tsx) is drawn verbatim at Chautauqua Content.dc.html:247 "Content · selecting"
- `app/src/pages/settings/settings.css` :: `.chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action` -- "Edit" (app/src/pages/agenda/BreaksPanel.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:407 "Contact · 390"
- `app/src/pages/speakers/task-view.css` :: `.chq-taskview-answers .chq-taskview-head-row, .chq-taskview-waiting .chq-taskview-head-row` -- "Speaker" (app/src/pages/speakers/TaskView.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1561 "Portal · Resources"
- `app/src/pages/submissions/detail.css` :: `.chq-detail-page .chq-participants-table thead` -- "Triage" (app/src/pages/submissions/SubmissionDetailPage.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:355 "Submission detail"
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-table thead` -- "Title" (app/src/pages/submissions/SubmissionsTable.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-viewtabs` -- "View" (app/src/pages/submissions/ViewTabs.tsx) is drawn verbatim at Chautauqua Settings.dc.html:481 "Settings · Public pages"
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-filterbar .chq-submissions-filterbar-select` -- "Needs triage" (app/src/pages/submissions/FilterBar.tsx) is drawn verbatim at Chautauqua Docs.dc.html:166 "Docs · an article"
- `app/src/pages/submissions/submissions.css` :: `.chq-status-pills [data-status]:not([data-status='pending']):not([data-status='accepted'])` -- "Needs triage" (app/src/pages/submissions/FilterBar.tsx) is drawn verbatim at Chautauqua Docs.dc.html:166 "Docs · an article"
- `app/src/styles.css` :: `.chq-shell:has([data-chq-phone-head]) .chq-header` -- "chautauqua" (app/src/App.tsx) is drawn verbatim at Chautauqua Account.dc.html:121 "Sign in · 390"
- `app/src/styles.css` :: `.chq-header-identity .chq-user-identity` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id"
- `app/src/styles.css` :: `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` -- "Save" (app/src/pages/comms/TemplatesTab.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/styles.css` :: `.chq-shell:has(.chq-phone-dock) .chq-tabbar` -- "Save" (app/src/pages/comms/TemplatesTab.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390"
- `app/src/styles.css` :: `body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id"
- `src/routes/portal/portal.css.ts` :: `.chq-portal-actions-footer` -- "Title and abstract show on the public pages · co-presenters do not" (src/routes/portal/edit.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `src/routes/portal/portal.css.ts` :: `.chq-portal-shell > .chq-portal-footer .chq-portal-signout` -- "chautauqua" (src/routes/portal/shared.tsx) is drawn verbatim at Chautauqua Account.dc.html:121 "Sign in · 390"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="1"] .chq-cfp-step-you` -- "Your talk" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="2"] .chq-cfp-step-talk` -- "Your talk" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft)` -- "Your talk" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="1"] .chq-cfp-step-back` -- "Your talk" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="2"] .chq-cfp-step-next` -- "Your talk" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="all"] .chq-cfp-steps, [data-chq-cfp-step="all"] .chq-cfp-step-next, [data-chq-cfp-step="all"] .chq-cfp-step-back` -- "Your talk" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms"

## UNVERIFIABLE roster (35 rows)

- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-day-tabs` -- app/src/pages/Agenda.tsx :: chq-agenda-day-tabs renders a composed (non-static) text child: "{formatDayLabel(day)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-summary` -- app/src/pages/Agenda.tsx :: chq-agenda-summary renders a composed (non-static) text child: "{`${agenda?.summary.unplaced ?? 0} unplaced · `}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/comms/comms.css` :: `.chq-comms-batch-recipients .chq-comms-recipient-col-heads-row` -- app/src/pages/comms/RecentSends.tsx :: chq-comms-batch-recipients renders a composed (non-static) text child: "{statusTally(statusCounts)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/comms/comms.css` :: `.chq-comms-batch-recipients .chq-comms-recipient-row > span:empty` -- app/src/pages/comms/ComposeWizard.tsx :: chq-comms-recipient-row renders a composed (non-static) text child: "{r.name}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-pipeline-columns` -- app/src/pages/contacts/PipelineBoard.tsx :: chq-contacts-pipeline-columns renders a composed (non-static) text child: "{PIPELINE_STAGE_LABELS[stage]}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-merge-compare-head` -- app/src/pages/contacts/MergePage.tsx :: chq-contacts-merge-compare-head renders a composed (non-static) text child: "{keepHeadLabel}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import-columns` -- app/src/pages/contacts/ImportWizard.tsx :: chq-contacts-import-columns renders a composed (non-static) text child: "{
              const sample = dataRows[0]?.[i] ?? '';
              const skipped = !mapping[col];
              return (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-merge-primary-desktop-label` -- app/src/pages/contacts/MergePage.tsx :: chq-contacts-merge-primary-desktop-label renders a composed (non-static) text child: "{keepContact ? `Merge into ${keepContact.firstName} ${keepContact.lastName}` : 'Merge'}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-merge-impact-name` -- app/src/pages/contacts/MergePage.tsx :: chq-contacts-merge-impact-name renders a composed (non-static) text child: "{keepContact.firstName} {keepContact.lastName}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import-subtitle-desktop` -- app/src/pages/contacts/ImportWizard.tsx :: chq-contacts-import-subtitle-desktop renders a composed (non-static) text child: "{(fileName ?? 'Pasted CSV') + ' · ' + countOf(dataRows.length, 'row')}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-filter-match-count` -- app/src/pages/contacts/FilterRulesPanel.tsx :: chq-contacts-filter-match-count renders a composed (non-static) text child: "{totalCount === null ? `${matchCount} match` : `${matchCount} of ${totalCount} match`}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-rail` -- app/src/pages/contacts/DirectoryRail.tsx :: chq-contacts-rail renders a composed (non-static) text child: "{  }
        {topCompaniesLoaded && topCompanies.length === 0 ? (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/content/content.css` :: `.chq-content-files-download-all-wrap` -- app/src/pages/content/FilesLibrary.tsx :: chq-content-files-download-all-wrap renders a composed (non-static) text child: "{downloadPending
                  ? 'Downloading…'
                  : items.length === total
                    ? `Download all ${items.length} (.zip)`
                    : `Download ${countOf(items.length, 'file')} (.zip)`}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/content/upload-zone.css` :: `.chq-content-upload-caps` -- app/src/pages/content/UploadZone.tsx :: chq-content-upload-caps renders a composed (non-static) text child: "{uploadHintText(kind)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/content/upload-zone.css` :: `.chq-content-upload-prompt-desktop` -- app/src/pages/content/UploadZone.tsx :: chq-content-upload-prompt-desktop renders a composed (non-static) text child: "{uploadPendingLabel.label}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/forms/forms.css` :: `.chq-forms-field-kind, .chq-forms-field-required, .chq-forms-field-optional, .chq-forms-field-help, .chq-forms-field-condition` -- app/src/pages/forms/FieldList.tsx :: chq-forms-field-help renders a composed (non-static) text child: "{row.caption}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/overview/overview.css` :: `.chq-overview-overflow` -- app/src/pages/Overview.tsx :: chq-overview-overflow renders a composed (non-static) text child: "{payload.overdueTasks.total - payload.overdueTasks.rows.length} more overdue" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/overview/overview.css` :: `.chq-overview-clash-entries-desktop` -- app/src/pages/overview/AgendaWorkSection.tsx :: chq-overview-clash-entries-desktop renders a composed (non-static) text child: "{entry.title}{' '}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/review/review.css` :: `.chq-review-criteria-eyebrow` -- app/src/pages/review/PlanEditor.tsx :: chq-review-criteria-eyebrow renders a composed (non-static) text child: "Locked — {countOf(activeRoundLockedCount, 'review')} scored against these criteria" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/review/scorecard.css` :: `.chq-review-answers` -- app/src/pages/review/Scorecard.tsx :: chq-review-answers renders a composed (non-static) text child: "{a.label}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/settings/settings-drill-rows.css` :: `.chq-settings-portal-welcome-summary` -- app/src/pages/settings/PortalSettingsPanel.tsx :: chq-settings-portal-welcome-summary renders a composed (non-static) text child: "{`Shown above the task list · ${countOf(paragraphs, 'paragraph')}`}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/settings/settings-drill-rows.css` :: `.chq-settings-drillrow-pills-desktop` -- app/src/pages/settings/YourDataPanel.tsx :: chq-settings-drillrow-pills-desktop renders a composed (non-static) text child: "{renderExportPills()}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/settings/settings.css` :: `.chq-settings-content` -- app/src/pages/Settings.tsx :: chq-settings-content renders a composed (non-static) text child: "&lsaquo; {editingSection ? editingSection.label : viewingEmbeds ? 'Public pages' : 'Settings'}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/speakers/speakers.css` :: `.chq-speakers-grid-wrap` -- app/src/pages/speakers/OnboardingGrid.tsx :: chq-speakers-grid-wrap renders a composed (non-static) text child: "{
                    const done = taskDoneLabel(task);
                    return (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/speakers/speakers.css` :: `.chq-speakers-toolbar` -- app/src/pages/speakers/OnboardingGrid.tsx :: chq-speakers-toolbar renders a composed (non-static) text child: "{REMIND_SKIP_RULE_SENTENCE}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/detail.css` :: `.chq-detail-back-full` -- app/src/pages/submissions/SubmissionDetailPage.tsx :: chq-detail-back-full renders a composed (non-static) text child: "{DECISION_ACTION_LABELS.waitlisted}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/detail.css` :: `.chq-detail-ref-position-full` -- app/src/pages/submissions/SubmissionDetailPage.tsx :: chq-detail-ref-position-full renders a composed (non-static) text child: "{detail.ref} &middot; {listPosition.position} of {listPosition.total}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-status-label, .chq-submissions-filterbar-divider, .chq-submissions-columnpicker` -- app/src/pages/submissions/ColumnPicker.tsx :: chq-submissions-columnpicker renders a composed (non-static) text child: "{columnsSummary(columns, visibleFieldIds)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-filterbar-sort-select` -- app/src/pages/submissions/FilterBar.tsx :: chq-submissions-filterbar-sort-select renders a composed (non-static) text child: "{sortLabel(sort)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-status-pending-desktop` -- app/src/pages/submissions/FilterBar.tsx :: chq-submissions-status-pending-desktop renders a composed (non-static) text child: "{STATUS_LABELS.pending}" -- a static substring join can never verify a value assembled at render time
- `app/src/styles.css` :: `.chq-nav` -- src/routes/public/shell.tsx :: chq-nav renders a composed (non-static) text child: "{SURFACE_LABELS[s]}" -- a static substring join can never verify a value assembled at render time
- `src/routes/docs-site.css.ts` :: `.chq-docs-nav` -- src/routes/docs-site.tsx :: chq-docs-nav renders a composed (non-static) text child: "{group.label}" -- a static substring join can never verify a value assembled at render time
- `src/routes/docs-site.css.ts` :: `.chq-docs-figure-placeholder` -- src/routes/docs-site.tsx :: chq-docs-figure-placeholder renders a composed (non-static) text child: "screenshot &middot; {block.shotId}" -- a static substring join can never verify a value assembled at render time
- `src/routes/portal/portal.css.ts` :: `.chq-portal-taskform-submit` -- src/routes/portal/tasks/views.tsx :: chq-portal-taskform-submit renders a composed (non-static) text child: "{TASK_FORM_SUBMIT_LABEL}" -- a static substring join can never verify a value assembled at render time
- `src/routes/public/cfp.css.ts` :: `.chq-cfp-actions-note` -- src/routes/public/submit-views.tsx :: chq-cfp-actions-note renders a composed (non-static) text child: "Resuming your saved draft from {formatEventDateTime(props.savedAt, props.timeZone)}." -- a static substring join can never verify a value assembled at render time
