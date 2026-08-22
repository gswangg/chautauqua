# Code-comment citation audit (DEC-967 doc-integrity lens widened to code comments)

Task w11-aa (INSTRUMENT ONLY -- no repairs performed in that lane).
Instrument: `test/code-comment-citation.scan.test.ts`. Ratchet:
`CODE_COMMENT_CITATION_CEILING = 37`, measured on that branch by forcing
the constant to `-1` and reading the printed offender list.

## Wave-141 repair pass (task w16-aa, DEC-967 / DEC-808)

The 37 offenders below (catalogued when this document was written) were
re-read against the tree at repair time. This is a re-audit and repair of
THIS DOCUMENT's own citations, not of the underlying code comments
(`src/**`, `app/src/**`), which is a separate lane's scope (owner clusters
noted per row, below). The original markdown-table shape (`| file:line |
citation | reason |`) put a real `path:line` immediately next to another
cell's backtick-quoted text; `test/decision-doc-citation.scan.test.ts`'s
citation grammar (any `path:line` in the prose, paired with the nearest
following backtick literal within its gap window) read the TABLE'S OWN
STRUCTURE as citation+receipt pairs across unrelated cells -- the audit
document about dead code-comment citations had re-entered the population
of broken citations it exists to describe. Repaired here by (a) dropping
the pipe-table for prose bullets, so a source location and its target
citation are never backtick-adjacent, and (b) applying one of the three
repairs DEC-967/DEC-808 (wave-141, task w16-aa) prescribes to each
individual citation: convert to the drift-proof bare-path shape where the
quoted text still exists in the cited file (most rows below -- the actual
code comments had ALREADY been repaired or never drifted the way this
table's stale line numbers implied), mark with `EXHIBIT!` where the row
genuinely still catalogues dead evidence, or disambiguate a bare basename
to its real repo-relative path first. Every quote below was hand-verified
against the tree at repair time (`git rev-parse HEAD` at commit time of
this change).

Repair-lane ownership is unchanged: **v12m-w11-bb** owns `src/**` code
comments, **v12m-w11-cc** owns `app/src/**` code comments -- this pass
touches only this document, never those source files. Where a code
comment had already been independently corrected since this table was
written (several had), that current, correct state is what is recorded
below.

### agenda (app/src/**)

- Comment in `app/src/pages/agenda/BreaksPanel.tsx` (around line 168)
  cited the ambiguous bare basename `breaks.ts` line 144. The claim ("the API
  reads key PRESENCE") is about `src/routes/api/breaks.ts`, which is
  the correct full path: src/routes/api/breaks.ts`body.location !== undefined`
  (verbatim at that file's line 144, the presence check the comment
  describes).

### comms (app/src/**)

- Comment in `app/src/pages/comms/HistoryTab.tsx` (around line 174)
  cites `app/src/pages/settings/ExportsPanel.tsx` with no line number --
  already the drift-proof bare shape in the code today (the line-keyed
  `:87` this table originally catalogued has already been removed at the
  source). Nothing left to repair here; recorded for completeness.

### contacts (app/src/**)

- Comment in `app/src/pages/contacts/contacts-panels.css` (around line
  1280) cites the Pipeline phone markup: app/src/pages/contacts/PipelineBoard.tsx`chq-contacts-pipeline-phone-stages`
- Comment in `app/src/pages/contacts/contacts-panels.css` (around line
  1819) cites the shared dock contract selector: app/src/styles.css`.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar`
- Comment in `app/src/pages/contacts/contacts-panels.css` (around line
  1848) cites the base `.chq-phone-dock` rule: app/src/styles.css`.chq-phone-dock {`
- Comment in `app/src/pages/contacts/contacts.css` (around line 995)
  cites the Export CSV control's painted-face class: app/src/pages/contacts/ContactsApp.tsx`chq-btn chq-btn-secondary`
- Comment in `app/src/pages/contacts/contacts.css` (around line 1129)
  self-cites the base record-value rule: app/src/pages/contacts/contacts.css`.chq-contacts-record-value {`

### forms (app/src/**)

- Comment in `app/src/pages/forms/forms.css` (around line 794)
  cross-cites the same contacts record-value rule: app/src/pages/contacts/contacts.css`.chq-contacts-record-value {`

### overview (app/src/**)

- Comment in `app/src/pages/overview/types.ts` (around line 54) cited the
  ambiguous bare basename `scheduling.ts` line 101. The claim ("roomName falls
  back to `slot.roomId` when a room-name lookup misses") is server-side
  conflict-resolution logic; the correct full path is
  `src/server/repo/overview/scheduling.ts` (NOT `src/db/schema/scheduling.ts`,
  the other ambiguous match, which is a schema table, not this
  fallback logic): src/server/repo/overview/scheduling.ts`roomNameById.get(slot.roomId) ?? slot.roomId`
- Comment in `app/src/pages/overview/types.ts` (around line 90) makes the
  same claim for the placement-suggestion sibling, same disambiguated
  target: src/server/repo/overview/scheduling.ts`roomNameById.get(slot.roomId) ?? slot.roomId`

### review (app/src/** + src/**)

- Comment in `app/src/pages/review/review.css` (around line 2469)
  self-cites the earlier phone-narrow criterion-row collapse: app/src/pages/review/review.css`.chq-review-criterion-row {`
- Comment in `app/src/pages/review/review.css` (around line 2641)
  self-cites the earlier phone-narrow reviewer-row collapse: app/src/pages/review/review.css`.chq-review-reviewer-row {`
- Comment in `app/src/styles.css` (around line 391) cites the reviewer
  plans phone note this file mirrors: app/src/pages/review/review.css`.chq-reviewer-plans-phone-note {`
- Comment in `src/routes/review/reviewer.ts` (around line 286) cited the
  missing bare path `src/server/repo/agenda.ts` lines 316-330 (that module was
  split, and the batching helper it means moved to
  `src/server/repo/agenda/rows.ts`): src/server/repo/agenda/rows.ts`loadDurationMinBySubmission`
- Comment in `src/server/repo/review/recusal.ts` (around line 32) cited
  the missing bare path `src/db/schema.ts` line 376 (schema.ts was split by
  domain, and the recusal uniqueIndex actually moved to
  `src/db/schema/review.ts`): src/db/schema/review.ts`review_recusal_plan_submission_user_idx`
- Comment in `src/server/repo/review/submissions.ts` (around line 19)
  cited `src/server/repo/files-library.ts` line 39, which exists but has only
  33 lines; the constant it actually means,
  `MAX_FILE_LIBRARY_SCAN`, lives in the correctly-named sibling module
  the comment text itself already spells:
  src/server/repo/files-library-scope.ts`MAX_FILE_LIBRARY_SCAN`
- Comment in `src/server/repo/review/submissions.ts` (around line 845)
  makes the same batching claim as reviewer.ts:286 above, same
  disambiguated target: src/server/repo/agenda/rows.ts`loadDurationMinBySubmission`

### settings (app/src/**)

- Comment in `app/src/pages/settings/formState.ts` (around line 144)
  cited the ambiguous bare basename `events.ts` lines 416-536; the "Invalid
  room"/"Invalid track" fields map this describes is minted by the API
  route handler, `src/routes/api/events.ts` (NOT
  `src/server/repo/events.ts`, the other ambiguous match, which has no
  such field-error map): src/routes/api/events.ts`Invalid room`
- Comment in `app/src/pages/settings/settings-drill-rows.css` (around
  line 160) cites the real anchor this phone rule restates: app/src/pages/settings/YourDataPanel.tsx`chq-settings-drillrow-export-download`
- Comment in `app/src/pages/settings/settings.css` (around line 2513)
  cites the desktop-density base rule it deliberately does not disturb: app/src/styles.css`.chq-color-swatch {`
- Comment in `app/src/pages/settings/settings.css` (around line 2518)
  self-cites the page-scoped hook it restates the floor beside: app/src/pages/settings/settings.css`.chq-settings-panel li .chq-color-swatch {`
- Comment in `app/src/pages/settings/tracksRooms/types.ts` (around line
  39) cites the same ambiguous `events.ts` lines 416-536 as formState.ts above,
  same disambiguated target: src/routes/api/events.ts`Invalid room`
- **EXHIBIT** -- comment in `app/src/phone-overflow-scan/cascade.ts`
  (around line 8) illustrates the scanner's OWN historical bug shape via
  `settings.css` line 1142's `.chq-settings-row-hint` / `white-space: nowrap`
  adjacency. That specific adjacency no longer holds at that line (the
  base rule there has neither the same neighbouring rule nor that
  declaration today) -- catalogued, not repaired, because the comment is
  citing evidence for a fix already landed in the scanner itself, not
  asserting a live fact about the CSS file:
  EXHIBIT!`app/src/pages/settings/settings.css:1142` still reads `white-space: nowrap`

### speakers (app/src/**)

- Comment in `app/src/pages/speakers/speakers.css` (around line 805)
  cited the missing bare basename `ceda66f2.md` lines 127-133; the full
  verification-log path the comment's own wrapped text names is
  `docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md`: docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md`ratio=1.02, fg=rgb(86,90,75)`
- Comment in `app/src/pages/speakers/speakers.css` (around line 1229)
  cites the Roster row's own name-link markup: app/src/pages/speakers/RosterPanel.tsx`chq-row-title chq-speakers-name-link`
- Comment in `app/src/pages/speakers/speakers.css` (around line 1819)
  cites the phone-only Remind/Filter button pair (its exact line number
  drifted as OnboardingGrid.tsx grew; the pair still exists, now further
  down the file): app/src/pages/speakers/OnboardingGrid.tsx`chq-speakers-phone-head-actions`
- Comment in `app/src/pages/speakers/task-view.css` (around line 268)
  cites the file-action download anchor: app/src/pages/speakers/TaskView.tsx`chq-taskview-open`

### shared shell (app/src/**)

- Comment in `app/src/styles.css` (around line 2526) self-cites the
  shell-scrolling-region ruling: app/src/styles.css`flex:1; min-height:0; overflow-y:auto`
- Comment in `app/src/styles.css` (around line 2627) self-cites the
  desktop drawer margin it must stay equal to: app/src/styles.css`margin: 0 -26px 0;`

### domain/lib (src/**)

- Comment in `src/domain/brand-url.ts` (around line 15) cited the
  ambiguous bare basename `types.ts` line 18 (17 files share that basename);
  the sibling function it means, `safeExternalUrl`, is defined in
  `src/domain/contacts-parts/types.ts`: src/domain/contacts-parts/types.ts`export function safeExternalUrl`
- Comment in `src/lib/home-hub.ts` (around line 41) cited the missing
  bare basename `schema.ts` lines 116-117; the NOT NULL `startDate`/`endDate`
  columns it means live in `src/db/schema/event.ts`: src/db/schema/event.ts`text("start_date").notNull()`

### public routes (src/**)

- Comment in `src/routes/public/saved-embed.tsx` (around line 48) cites
  the sibling route registration, ambiguous bare basename `index.tsx` line 61
  (two files share that basename); the relative `./index.tsx` resolves
  by directory to `src/routes/public/index.tsx` (its own line number has
  since drifted from 61 to 62, so cited here drift-proof): src/routes/public/index.tsx`publicRoutes.route("/", savedEmbedRoutes);`
- Comment in `src/routes/public/saved-embed.tsx` (around line 49) cites
  the parent's later `/embed/*` middleware registration, same
  disambiguated file, its own line number drifted from 89-90 to 106: src/routes/public/index.tsx`publicRoutes.use("/embed/*", publicCacheMiddleware(defaultCache));`
- Comment in `src/server/auth-session.ts` (around line 7) cites where
  the `chq_session` cookie is built. The line-keyed target this table
  originally catalogued, `src/routes/auth.tsx` lines 384-387, is stale twice
  over (that file has only 40 lines, and the citation itself has since
  been corrected at the source to the right file with no line number):
  `buildSessionCookie` is defined in src/auth/cookies.ts`buildSessionCookie`

### server/repo (src/**)

- Comment in `src/server/repo/import/sessionboard.ts` (around line 179)
  cited the missing bare basename `schema.ts` line 289; the participant-pair
  uniqueIndex it means lives in `src/db/schema/submissions.ts`: src/db/schema/submissions.ts`participant_submission_id_contact_id_idx`
- Comment in `src/server/repo/pipeline.ts` (around line 254) cited the
  missing bare path `src/db/schema.ts` line 669; schema.ts was split by
  domain, and the pipeline-entry uniqueIndex it means moved to
  `src/db/schema/crm.ts`: src/db/schema/crm.ts`pipeline_entry_org_id_contact_id_idx`
- Comment in `src/server/repo/portal-config.ts` (around line 107) cited
  the missing bare path `src/db/schema.ts` line 505; schema.ts was split
  by domain, and the portal-settings
  uniqueIndex it means moved to `src/db/schema/content.ts`: src/db/schema/content.ts`portal_settings_event_id_idx`
- Comment in `src/server/repo/tasks/reminders.ts` (around line 632)
  cites the send-path field discipline it mirrors; the exact line
  drifted from the cited 283-299 range to the real assignment further
  down the same function: src/routes/comms/send.ts`status: "skipped"`

## Population sanity

- `POPULATION_FILES` (src/** + app/src/**, `.test.` excluded, via
  `enumerateSourceFiles`): > 100 files (asserted in the scan itself).
- Total `path:line` comment citations found across that population:
  > 50 (asserted; measured count is in the hundreds once `.dc.html` is
  excluded and before resolution is attempted).
- The `CODE_COMMENT_CITATION_CEILING = 37` ratchet in
  `test/code-comment-citation.scan.test.ts` measures the CODE comments
  directly (owned by v12m-w11-bb/v12m-w11-cc, not this document); this
  document's own repair pass (wave-141, task w16-aa) only fixed how THIS
  FILE cites those same locations, so the underlying 37 code-comment
  offenders are unaffected by this change and remain that lane's to fix.
