# Eval findings — rebased 2026-08-15 (wave 27, task-w27-f)

Verified against `main` sha `ceda66f20989684f702384e60a574a4e9c4fa68a` ("scribe
wave 27"), derived AT THIS TASK'S OWN RUNTIME (not from any planning brief)
by running, in order: `git rev-parse main`; `git for-each-ref refs/heads`
(35 live branches); and `git merge-base --is-ancestor <ref> main` for every
one of them. This is a COMPACTION per DEC-358's wave-27 amendment, not
another prepended header: the prior generation (1,076 lines, four stacked
headers and four stacked REF TRUTH blocks going back to wave 16) is deleted
in favor of this single header plus the collapse pointers below. Nothing
that was a per-item file:line citation is deleted — every dismissal below
still carries its citation, per DEC-358's original text ("dismissals are
recorded, never deleted").

**Superseded headers/REF TRUTH blocks, collapsed** (each was itself already
kept "for its own boundary citations" and never re-read after superseding):
wave-24 header + REF TRUTH (boundary `39ac22d0`, 2026-08-15), wave-18 header
+ REF TRUTH (`956fe263`), wave-17 REF TRUTH (`9b21309c`), wave-16 rewrite
(`c557cff9`). None of their ref-status prose is current; every per-item
citation any of them established has been re-homed below under TIER 0 or IN
FLIGHT, re-verified against THIS wave's own boundary, not inherited.

## Standing rules (still bind)

- **Targeted tests only, in-wave.** Full suite runs at merge-train batches
  and verification/exit waves via `scripts/with-test-lock.sh`, never ad hoc
  inside a task wave.
- **Items close on measured or runtime evidence, never a code read alone.**
  A file:line citation proves intent, not behavior; a behavior claim needs
  an exercised check.
- **The vendored frame pack is `docs/design/*.dc.html`** — where a test
  contradicts it, the test is wrong, not the frame. Where a research-repo
  render measurement (`chautauqua-research/...`) conflicts with the
  vendored `docs/design/README.md` rule for the same surface, the README
  wins (12-home / CLASS-1 admin-measure precedents below).
- **docs/ precedence** (`docs/README.md`): `docs/clarifications.md`
  overrides all; `decisions/DEC-*.md` binding, compile-checked via
  `src/decisions.ts` (never hand-edit); rest of `docs/` informs, doesn't
  override.
- **No eval gaming.** `docs/eval-rubric/`/`docs/fixtures/` inform what to
  build; product code never references fixture values or rubric IDs.
- **A mandate item moves tier only on a citation against current `main`,**
  re-run at the moving wave's own runtime — never on inheriting a prior
  wave's verdict or a task brief's restated claim (DEC-069, DEC-976 wave-25
  amendment: "a claim without a quoted line is a rumour").
- **IN FLIGHT is built from `.git` ref state at the writing task's own
  runtime**, never copied forward from a previous wave's prose (DEC-069
  wave-17 amendment). A branch whose tip equals its merge-base with `main`
  produced zero commits and measured nothing.
- **DEC-976 wave-27 amendment**: TIER 1's long-unrecheck clauses need a
  quoted verdict each (OPEN / CLOSED-AT-TIP / UNQUOTABLE) — that re-walk is
  `task-w27-g`'s owned scope (see the TIER-1 pointer below), not
  re-derived here.

## TIER 0 — re-verified, already correct or already merged, do not re-file

### Closed this wave (task-w27-f, boundary `ceda66f2`) — wave-26 lanes, ref-measured MERGED

The brief that assigned this rebase assumed wave-26 lanes (`task-w26-a`
through `-e`) might still be mid-merge at runtime. Measured directly instead
of trusting that assumption: `git merge-base --is-ancestor <ref> main`
succeeds for ALL SIX current `task-w26-*` refs, and `main`'s log tail
carries `merge task-w26-a` through `merge task-w26-f` directly. All six are
CLOSED, not owned/in-flight:

- **`task-w26-a`** (`85106f67`) — "Fix R2 upload fan-out to own its cleanup
  on partial put failure (DEC-530 amendment)." MERGED via `39a7c450`.
- **`task-w26-b`** (`386e9802`) — "Fix accepted_at repair: independent
  fireAcceptance/setsAcceptedAt routing." MERGED via `0a1844b6`.
- **`task-w26-c`** (`279c1313`) — "Fix DEC-757 gap: user.name persists so
  teammates aren't always emails." MERGED via `1b026b99`. Closes the field
  guide's w26 mandate item (`test/spa-mutation-contract.scan.test.ts:560`,
  red since wave 16 — `POST /api/v1/users` never read `firstName`/
  `lastName`); not independently re-run this task (DOCS ONLY).
- **`task-w26-d`** (`c06d0f0f`) — "Fix org-wide unbounded read in
  password-reset anchor lookup (DEC-013)" — the anchor-event ordering fix.
  MERGED via `0a5991f9`.
- **`task-w26-e`** (`95a19378`) — "pubcache: honest staleness bound +
  session-cookie bypass (DEC-083 w26)." MERGED via `674745a4`.
- **`task-w26-f`** (`f48ad0a0`) — "task-w26-f: diagnostic walkthrough @
  73f380f2 (DEC-069)." MERGED via `b0cd495a`.

### DISMISSED-VERIFIED-CLOSED (carried, wave 24 boundary `39ac22d0`, not re-checked this wave beyond ref presence)

- **`task-w29-f` — "speakers toolbar right-cluster" (wave-28 gate's one
  surviving OPEN ITEM, `docs/verification-log.md:3877-3884`) — VOID,
  DISMISSED-VERIFIED-CLOSED.** The wave-28 gate quoted
  `docs/design/README.md:350` (a row in the mock table `Speakers
  [Search speakers…] [All tracks ▾] [List | Grid]`) but that quote lives
  under the enclosing heading **`docs/design/README.md:343` "Public filter
  bar — one idiom, four surfaces"** (heading body confirms at `:345`: "the
  1180 pair layout['s] ... 820px content column" shared by "Sessions, agenda
  and speakers" — i.e. the PUBLIC surfaces), not the admin toolbar. The gate
  then searched `app/src/pages/speakers/GridFilters.tsx` (the admin
  onboarding-grid toolbar) and found no toggle there, which is correct but
  irrelevant — that file was never named by the quoted line. The controls
  the heading actually names are already built on the PUBLIC speakers
  surface: `SpeakerViewToggle` (the `List`/`Grid` two-half segmented control,
  `aria-current="page"` on the active half) at
  `src/routes/public/speakers.tsx:20-58`, and `TrackFacetSelect` (the `All
  tracks ▾` select) at `:72-103`, both mounted on `SpeakersContent`
  (`:216-269`) and its gallery twin `GalleryContent` (`:271-348`); `q`,
  `trackId` and `limit` all carry forward across the toggle (`:32-38`).
  Verified with a new render test,
  `test/public-speakers-filter-bar.render.test.ts`, which renders both
  `SpeakersContent` and `GalleryContent` directly and asserts the search
  box, the `All tracks` select and the `List`/`Grid` toggle are all present,
  that the active half carries `aria-current="page"`, and that switching
  halves preserves an active `q`/`trackId`. Do not re-file; do not touch
  `app/src/pages/speakers/**` on this basis — that surface never claimed to
  have this control and is out of scope for this clause.
- **`src/routes/tasks.ts` onboarding-grid `status`/`inviteStatus`** REFUSE an
  unrecognised token, accumulated into one fields map —
  `parseOnboardingGridQuery`, `src/routes/tasks.ts:164-209` (DEC-340
  wave-18 amendment).
- **`countEvaluationsBySubmission` caps on `MAX_PLAN_SUBMISSION_SCAN + 1`,**
  documented reason the evaluation-row constant would be wrong —
  `src/server/repo/review/evaluations.ts:158-200`.
- **`isSubmissionInReviewerScope` carries the SAME `MAX_REVIEWER_SCOPE_ROWS
  + 1` cap and refusal as `resolveReviewerSubmissions`** —
  `src/server/repo/review/submissions.ts:396-407` vs `:241-252`.
- **`clearSessionCookie` appends `Secure` on https exactly like
  `buildSessionCookie`** — `src/auth/cookies.ts:31-42` vs `:26-28`.
- **Public sessions LIST hydrates speakers through
  `visibleParticipantConditions()`** — `src/server/repo/public/sessions.ts:405-417`.
- **`isSlugTaken` has no `orgId` predicate, by construction** (DELIBERATE) —
  `src/server/repo/events.ts:141-147`: `/e/:slug` is a single global
  namespace, not org-prefixed. Do not re-file as a missing-scope defect.
- **Seeded dates relative to one seed clock** — `scripts/seed.ts:261-278`
  (`SEED_NOW`, DEC-591).
- **Saved embeds exist** — `src/db/schema/embed.ts`,
  `src/routes/public/saved-embed.tsx`.
- **Per-person reminder scope on both send and preview** —
  `src/routes/tasks.ts:564-613` (DEC-694).
- **EMB session-card speaker title/company** —
  `src/routes/public/cards.tsx:102-116`.
- **Reviewer multi-track scope renders a list, never "All tracks"** —
  `src/domain/evaluation/progress.ts:39` (DEC-845),
  `src/routes/review/reviewer.ts:99-101`.
- **Accepted speakers keep editing past close** (DEC-041 forfeit, see also
  the CFP-16 note below) — `src/domain/edit-lock.ts:22`.
- **`npm run deploy` exists** — `package.json:21`.
- **Comms preview `.ics` chip formats in event's own timezone** —
  `app/src/pages/comms/icsChip.ts:18-19` (DEC-494).
- **Settings edit-view field widths are tokens** —
  `app/src/pages/settings/settings.css:17-22` (DEC-896).
- **`/account/password` has a real Cancel + 820 bare-page column** —
  `src/routes/account.tsx:139-144`, `src/routes/auth.css.ts:318-336`.
- **Overview §01 "Skips anyone reminded in the last hour"** —
  `app/src/pages/Overview.tsx:325`.
- **Pipeline fit score + rationale** — `src/domain/pipeline-fit.ts`.
- **Portal "what speakers may edit" toggles** —
  `app/src/pages/settings/PortalSettingsPanel.tsx:306`.
- **Phone agenda N-aware clash caption** —
  `app/src/pages/agenda/PhoneAgenda.tsx:186`.
- **Phone agenda "Place here anyway" path** —
  `app/src/pages/agenda/PhoneAgenda.tsx:167-176,199-208`.
- **Phone-block override assertion exercises the override side** —
  `app/src/phone-block-visibility.test.ts:186-205`.
- **Phone password screen fixed footer + Cancel** —
  `src/routes/auth.css.ts:318-336`.
- **Comms phone landing** —
  `app/src/phone-block-visibility.test.ts:109-121` (DEC-621).
- **Home footer media rule** — `src/routes/public/home.css.ts:72-76`.

### DO-NOT-RE-FILE (carried from waves 14-18, not re-checked this wave beyond ref presence)

- Bulk-email two-stage dedupe — `src/routes/api/contacts/bulk-email.ts:214-250` (DEC-238).
- `createUser` insert-then-select with `onConflictDoNothing` —
  `src/server/repo/users.ts:106-124` (DEC-552).
- Breaks validation accumulates, DEC-022 cross-check still reached —
  `src/routes/api/breaks.ts:130-166`.
- `send.ts`'s unconditional `bumpIcsSequences` — `src/routes/comms/send.ts:243-258` — RULED DELIBERATE.
- `MAX_PARTICIPANTS_PER_SUBMISSION` binds all four participant-writer doors
  — `src/routes/api/submissions.ts:598`, `src/server/repo/portal-edit.ts:487`,
  `src/routes/api/contacts/import.ts:194`, `src/server/repo/import/sessionboard.ts:622`,
  `src/server/repo/participants.ts:105,191`.
- Mail envelope goes through `addressValue` — `src/mail/email-binding.ts:236-240`,
  `test/mail-envelope-address.test.ts`.
- `answerFieldRoleCondition` missing event join — DISMISSED, DEC-592
  wave-18 amendment (`src/server/repo/form-roles.ts:16`): every call site
  hands it an already-event-scoped answer set.
- `countEvaluationsBySubmission`'s whole-plan map — DISMISSED, DEC-449:
  the plan+round `WHERE` scope is the sanctioned shape, not a paging gap.
- Duplicate `trackIds` deduped on both write doors —
  `src/routes/api/submissions.ts:131`, `src/routes/public/submit-body.ts:75-79` (DEC-598).
- Reviewer plan window enforced on lone submission read + file authz —
  `src/routes/review/reviewer.ts:288`, `src/server/repo/files-authz.ts:185-209` (DEC-018).
- Saved-view cap predicate is authorship, not visibility —
  `src/routes/api/views.ts:87`, `src/server/repo/views.ts:137-143` (DEC-422).
- `task-w14-d` AUTH_CSS `.chq-field-invalid` doubled-specificity cascade —
  `app/src/components/error-states.css:31`, `src/views/error-states.css.ts:46`
  (DEC-124 wave-14 amendment), guarded by `test/error-invalid-outranks-base.test.ts`.
- `task-w15-c/d` `updateEvent` slug guard (`isUniqueViolation`) —
  `src/server/repo/events.ts:224-259` (DEC-111).
- `task-w15-d` `sessionboard.ts` participant cap —
  `src/server/repo/import/sessionboard.ts:620-627` (DEC-604).
- `task-w15-b` send.ts intra-batch collapse — `src/routes/comms/send.ts:125-138` (DEC-238).
- `task-w8-c` review round name + window — `app/src/pages/review/ReviewerQueue.tsx:31,508`.
- `task-w8-d` compose step-1 slot column + footer —
  `app/src/pages/comms/ComposeWizard.tsx:713-716,1226-1230`.
- `task-w8-b` Submissions→Comms `?ids=` handoff —
  `app/src/pages/submissions/BulkActionBar.tsx:77`.
- `task-w8-e` Comms History pager — `app/src/pages/comms/HistoryTab.tsx:42-160`.
- `task-w10-b` — MERGED (was field-guide-flagged dead in error; corrected
  wave 12, re-confirmed since).
- `task-w17-b` perf-seed/perf-smoke harness bugs — MERGED, `956fe263`.
- `task-w23-e` frame-citation quoting audit — MERGED, `c0fe6948`.
- `task-w18-b/c/d/e/f/g` (reviewer-scope bounding, compose default-filter +
  step-2 ics-refusal, History Export door, files-library table-layout,
  templates Delete-subtractive, `ENVELOPE_ALLOWLIST` drift fix) — all
  MERGED between `956fe263` and `39ac22d0`; ref absence confirms landed
  (standard pattern for a deleted post-merge lane in this repo).
- `task-w23-f` — MERGED via `f519f562` — "DEC-902 column contract scan +
  DEC-937 review phone label guard."

### DISMISSED review-lens claims (wave 16, boundary `c557cff9`, carried)

- Duplicate `trackIds` deduped — see DO-NOT-RE-FILE above (same citation).
- Reviewer plan window on lone read + file authz — see above.
- Saved-view cap predicate is authorship — see above.

## Verification-log walkthrough items (docs/verification-log.md:3468-3478) — re-cited, all FOUR now FIXED IN THE HARNESS

The last runtime receipt's four "OPEN ITEMS" numbered 1-4 are walkthrough
SCRIPT bugs, not product defects — each script has since been repaired to
match already-correct product behavior. Quoted at this boundary:

1. **`scripts/walkthrough/speaker.ts:459-467`** — the assertion now reads
   the correct on-screen label: `assert(tasksPage.body.includes
   ("chq-portal-flag-done"), "task list does not show the task as Done
   after marking it");` with the comment explaining DEC-366 froze the
   wording as "Done"/"To do", never "Completed"/"Pending" — the script
   previously asserted the wrong label.
2. **`scripts/walkthrough/public.ts:437`** — `assert(sessionsHtml.includes
   ('id="chq-pub-filter-trackId"'), "no track filter select found");` with
   the comment explaining DEC-919 (wave 40 amendment) replaced the
   "Track filters" pill-row nav with `PublicFilterSelectForm`'s single
   auto-submitting `<select id="chq-pub-filter-trackId">` — behavior
   unchanged, only the probe was stale.
3. **`scripts/walkthrough/data.ts:492-497`** — `const expectedShowflowHeader
   = "ref,title,description,day,start,end,room,tracks,speakers,deck_file,
   deck_url,kind";` with the comment explaining DEC-022 (wave 66 amendment)
   made schedule_break rows interleave on the show-flow distinguished by a
   trailing `kind` marker column; the walkthrough predated that amendment.
4. **`scripts/walkthrough/scale.ts:393-407`** (`readMailboxCount`) — now
   `async function readMailboxCount(organizerJar: CookieJar): Promise<number>
   { const res = await jarFetch(organizerJar, \`${BASE_URL}/dev/mailbox\`);
   ... }`, with the comment explaining DEC-546 (`guardDevMailbox`,
   `src/decisions-data/part3.ts:133`) made `/dev/mailbox` organizer-only +
   org-scoped; the script now threads an authenticated organizer cookie
   jar instead of an unauthenticated fetch.

Not independently re-run this task (DOCS ONLY, no server started, no tests
executed) — closed on the harness source reading FIXED, per the standing
rule that a behavior claim needs an exercised check; the actual walkthrough
PASS/FAIL receipt is `task-w27-g`'s scope (see TIER-1 pointer below).

## Render-sweep items closed in the tree (re-cited, quoted)

Two of the render-sweep receipt's items are CLOSED at this boundary:

- **`/portal/tasks` measure** — `src/routes/portal/portal.css.ts:417-430`:
  `.chq-portal-shell > .chq-measure { flex: 1; min-height: 0; min-width: 0;
  width: 100%; max-width: 100%; overflow-y: auto; }`, with the preceding
  comment (DEC-253 wave-25 amendment) explaining the fix — a flex item's
  stretched cross size can exceed the viewport via its own content's
  intrinsic min-content width, and `min-width: 0` stops the overflow the
  render sweep measured.
- **`/admin/submissions` filterbar 44px floor** —
  `app/src/pages/submissions/submissions.css:557-564`:
  `.chq-submissions-filterbar-search, .chq-submissions-filterbar-select {
  min-height: 44px; }`, with the preceding comment (DEC-253/DEC-367)
  explaining the desktop 26px chip height (shared with `.chq-pill`) falls
  under the 44px touch-target minimum and is raised phone-only here.

## IN FLIGHT — owned by a branch, do not re-file

Ref-measured at THIS task's own runtime (`git for-each-ref refs/heads`,
`git merge-base --is-ancestor <ref> main` against `ceda66f2`):

- **`task-w27-a`** (`900f8326`) — UNMERGED, real commit: "Fix last
  render-sweep offender: drop line-height:1 on display-face headings
  (DEC-991)." This is the display-heading line-height fix the field guide's
  w27 entry names (three sites shared the clip bug; one measured, two
  latent). OWNED, do not re-file the underlying clip complaint.
- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged status across
  many waves: "Sign-in page names the event and its open CFP (DEC-716),"
  `src/routes/auth.tsx`. Now stale — needs a fresh boundary before its
  scope is re-attempted, not a merge of this old diff. Do not re-file the
  underlying scope as unowned.
- **`task-w27-b`** (`989810fb`) and **`task-w27-e`** (`068440a5`) — both
  UNMERGED, real commits, observed in this wave's ref sweep but OUTSIDE
  this task's assigned scope (DOCS ONLY on `eval-findings.md`; not
  triaged): `task-w27-b` = "build+test+bundle diagnostic receipt @
  ceda66f2"; `task-w27-e` = "DEC-069 static-audit widened per DEC-063
  (§6/§7 mechanical checks)." Flagging their existence only, so a future
  wave doesn't assume the ref sweep missed them.
- **Every other live `task-w*` ref** (`task-w68-b/c/e`, `task-w71-a`,
  `task-w72-a` through `-j`, `mail-rich-shape-fallback`) is UNMERGED but
  belongs to waves ahead of/adjacent to wave 27's own scope — not triaged
  here. `task-custodian-w68-4` and `manual-qa` are MERGED, not owned scopes.

### TIER-1 pointer — `task-w27-g` owns the fidelity-recheck verdicts, cite as OWNED, do not re-derive

The task brief for this rebase expected a path matching
`docs/verification-log/task-w27-g-fidelity-recheck-*.md`. At this task's own
runtime, the file actually present is **`docs/verification-log/task-w27-g-
stage1-ledger.md`** (325 lines, "closing stage-1 ledger (DEC-496/DEC-507)",
frozen at `aef16163` — a stage-1 completion accounting ledger, NOT a walk of
TIER 1's fidelity clauses). The expected `-fidelity-recheck-` filename does
not exist in the tree as of `ceda66f2`. Recording this discrepancy rather
than inventing the expected path as fact: `task-w27-g`'s DEC-976 wave-27
walk of TIER 1's VERIFIED-OPEN-NOT-RECHECKED clauses (see amendment text
under Standing rules) is either not yet landed under that name, or lands
under a different filename than the brief anticipated — the next wave
touching TIER 1 should re-glob `docs/verification-log/task-w27-g-*.md`
rather than trust either this note or the brief's guessed pattern.

## TIER 1 — open items (gate-7 evidence, measured boundary `ea2a5543`; per-clause verdicts owned by `task-w27-g`, see pointer above)

1. **Compose-flow turn diet** — CFP-04/16 cannot_judge, compose steps eat
   the budget. Structural fixes (`?ids=` handoff, step-1 slot column) are
   `task-w8-b`/`task-w8-d`, MERGED. The diet half (`task-w12-c`, commit
   `647a61b4`, DEC-967) — verify its landed state before re-filing.
2. **CNT-S3 session-edit loop** — CNT-10 cannot_judge, admin session detail
   edit-save-reload. Not owned by any wave-27 lane.
3. **Gate-7 fleet remaining MAJORs** (`fidelity-gate7/pair*/report.md`),
   walked sub-item by sub-item, nothing deleted:
   - **12-home chrome 46px/732** — CLOSED, SUPERSEDED-BY-VENDORED-PACK.
     `docs/design/README.md:407-417` fixes Home at 820px centred, `:78`
     sets 26-34px frame padding; `src/routes/public/home.css.ts:21`:
     `padding-inline: max(34px, calc((100% - 820px) / 2))`.
   - **07 comms step-1 SLOT/footer** — CLOSED (`task-w8-d`). "templates-grid
     overlap" and "history-tab chrome" sub-clauses — VERIFIED-OPEN,
     not re-checked; History-tab chrome is owned by `task-w18-f`'s landed
     scope (Export door at `src/routes/api/exports.ts:120-147`) — verify
     landed UI state before re-filing.
   - **05 files-library column swap + orphan row** — CLOSED.
     `app/src/pages/content/FilesLibrary.tsx:252-253,340`. "upload-reject
     modal anatomy" and "content-detail 1180/32 container" sub-clauses —
     VERIFIED-OPEN, not re-checked.
   - **04 participation/speaker-detail bundle** — "search excluded from
     hasActiveNarrowing" CLOSED (`app/src/pages/speakers/OnboardingGrid.tsx:128-135`,
     DEC-678). "reminders modal prints localhost:8799" CLOSED (no literal
     under `app/src`; the one `localhost:<port>` string is an unrelated
     test assertion, `FormsPage.render.test.tsx:140`). "participation panel
     420", "speaker-detail grid/theads", "write-failed banner anatomy" —
     VERIFIED-OPEN-NOT-RECHECKED.
   - **CLASS 1 admin measure 1372@114 + topbar 59** — CLOSED,
     SUPERSEDED-BY-VENDORED-PACK. `app/src/styles.css:109-111`
     (`--chq-measure-table: 1440px`, DEC-744/DEC-989), gated by
     `app/src/page-measure.test.ts` (enumerates every page, no hand-list).
   - **11 AUTH_CSS `.chq-field-invalid` cascade inert** — CLOSED
     (`task-w14-d`, see DO-NOT-RE-FILE above).
   - **02 SESSION DETAILS label-left grid + participant chips** — CLOSED.
     `app/src/pages/submissions/SubmissionDetailPage.tsx:1197-1205,1413`,
     `detail.css:247-249`.
   - **03 FORM ANSWERS stacked** — CLOSED.
     `SubmissionDetailPage.tsx:1101,1106-1127`. "duplicated results head"
     (`ResultsTable.tsx`) and "plan-editor draft footer" (`PlanEditor.tsx`)
     — VERIFIED-OPEN-NOT-RECHECKED.
   - **09/10 bundle** — "TBD room on public (ruling A25)" CLOSED (no `TBD`/
     "No room yet" under `src/routes/public`; `PhoneAgenda.tsx:34,42`'s TBD
     fallback is a DIFFERENT admin-phone surface, not evidence either way).
     "CFP-edit intro/description binding" clause — OWNED by `task-w26-c`'s
     `219b0cad` scope lineage; VERIFY landed state (was UNMERGED as
     `task-w24-c` two waves ago; `submit-views.tsx:421-431` per DEC-976
     wave-25 amendment already renders `form.description` as lede with
     computed fallback — likely CLOSED, not independently re-read this
     task). Remaining clauses ("active-filter ink chip", "underlined
     initials", "blue avatars", "Add-track tertiary", "saved-embed
     single-card anatomy") — VERIFIED-OPEN-NOT-RECHECKED. "speakers toolbar
     right-cluster" moved to TIER 0 DISMISSED-VERIFIED-CLOSED this wave
     (`task-w29-f`, DEC-976 wave-29 amendment) — the wave-28 gate's carry of
     this item was itself mis-attributed; see that entry.

**CFP-16 — RECORDED DELIBERATE FORFEIT** (DEC-041): accepted speakers keep
editing past close per `docs/clarifications.md:39` + `SPEC.md:297-298` +
the portal edit frame. Eval accounting: CFP-16 joins ABS-14 as a deliberate
forfeit (~0.5-1.1 composite ceded); the eval kit does not outrank the
customer's clarification.

## TIER 2 — unverified, candidate for re-check

Archive: `docs/mandates/findings-archive-2026-08-15.md` (full prior
mandate, nothing live until re-verified). Highest-value starting points:

- Mailer implementation/MIME-construction status — last status "REVERT
  LANDED, one open runtime question," gated on an orchestrator prod deploy
  the swarm cannot itself trigger.
- Design-fidelity gap classes against the vendored `docs/design/*.dc.html`
  pack (settings edit-view anatomy, public register widths, error-vocab
  states) — needs fresh measurement, not inheritance.
- The "SKIP LIST" (things not to build: AI-evaluation claims, nested
  per-round remodel, participant-level custom fields, per-file share links
  + ZIP grouping dialog, separate CRM analytics page, deadline extensions,
  contract/COI task kinds) — standing negative constraint, costs nothing to
  keep honoring.

## Mobile / phone queue (carried forward, own lane)

Desktop fidelity was priority; mobile deferred. Done items cited (STRUCTURAL,
listed in TIER 0 DISMISSED-VERIFIED-CLOSED above): phone-block-visibility
override assertion, N-aware clash caption, "place here anyway" path, Comms
phone landing, phone password fixed footer + Cancel, Home footer media
rule. Additional closures:

- **Settings subscreens are URL state, not path routes — DELIBERATE.**
  `app/src/pages/Settings.tsx:13-30` (DEC-728).
- **Phone submissions triage cards exist.**
  `app/src/pages/submissions/submissions-phone-card.render.test.tsx` (DEC-610).

Still open/unverified: CFP 2-step wizard, roster screen — NOT re-checked
this wave.

**Governing principle (affirmed, still binds):** mobile is additive reflow
— a mobile change must never move a desktop pixel (scan-lock). Phone
grammar (action bars, sheets, stacking, 44px targets) is a legitimate
translation of desktop affordances, not something to strip for minimalism;
a phone-only surface never lets desktop be inferred from it — desktop
derives from the width system + affordance grammar, any gap goes to the
design-standard brief.

None of the mobile queue was re-measured against current `main` this wave;
treat it as a starting point for the next mobile-lane sweep, not a closed
inventory.
