# Eval findings — rebased 2026-08-15 (wave 50, task-w50-i)

Verified against `main`/HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`
("scribe wave 50"), MEASURED_SHA `87cee8b9`, derived AT THIS TASK'S OWN
RUNTIME (DEC-069 wave-17/wave-37, DEC-358 rebase rule) by running, in
order: `git merge --no-edit main` (worktree cut directly from `main`'s
tip — reported "Already up to date"); `npx tsx scripts/ref-state.ts`;
`git for-each-ref --format='%(refname:short) %(objectname:short)'
refs/heads` (46 live branches) plus `git merge-base --is-ancestor <ref>
HEAD` for every one, run individually (never a `.git/refs/heads/*` glob,
never the `.git/packed-refs` `refs/heads/main` line). `ref-state`'s
receipt, verbatim: DEC-644 three-sha boundary — HEAD `87cee8b9`; newest
first-parent product-code-bearing sha `c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`;
ancestors of HEAD: `main`, `manual-qa`, `task-custodian-w68-4`,
`task-w47-a`, `task-w47-g`, `task-w47-h`, `task-w48-a`, `task-w48-c`,
`task-w48-f`, `task-w50-e`, `task-w50-h`, `task-w50-i`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`. NON-ancestors: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w48-b`, `task-w48-d`, `task-w48-e`, `task-w48-g`,
`task-w49-a` through `-h`, `task-w50-a`, `task-w50-b`, `task-w50-c`,
`task-w50-d`, `task-w50-f`, `task-w50-g`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a` through `-j`. **The pinned mandate
(`32921050`, wave 47/task-w47-h) is now confirmed an ancestor of HEAD** —
every wave-47 branch (`-a` through `-h`) landed since that pin; see the new
TIER 0 "Landed since the wave-47 boundary" subsection.

COMPACTION per DEC-358's rebase rule: the wave-47 header is REPLACED by
this one, not prepended (three waves stale: it predated wave 48's battery
sections and every wave-49 lane). No per-item citation is deleted, only
re-homed/compacted. Re-glob receipt (programmatic, this runtime): every
backtick-quoted file-path citation in this document (169 distinct paths)
was resolved against the working tree by exact path or, where a citation
uses a bare filename inside a list, by unique basename match; **all 169
resolved to a real file — zero false "exists" claims carried forward.**
No "does not exist" claim is currently carried in this document (the two
prior absence claims, `localhost:8799` and `TBD`, were themselves CLOSED
by wave-46/task-w46-f and are cited as closures, not re-asserted as
absences needing re-globbing).

**This wave's own addition — folding the wave-47/48 range in.** All seven
wave-45 CONFIRMED-DEFECT rows the wave-47 header carried as IN FLIGHT are
now CLOSED: every `task-w47-a`..`-g` owning branch is a confirmed ancestor
of this HEAD, and this task independently re-ran each item's falsifying
check against the live tree (not inherited) — see the new TIER 0
subsection below, which also folds in wave-48's three landed gate
sections (`0240` build+test+bundle, `0242` perf-smoke, `0244`
render-sweep) and reconciles `0240`'s two filed OPEN ITEMS against the
current tree. Wave 49's eight lanes and wave 50's non-scribe siblings are
NOT ancestors of this HEAD — named as OWNED-BUT-UNMERGED in IN FLIGHT
below, per this task's own boundary (a discharge status this lane did not
itself verify is never restated as closed).

## USER RULING (2026-08-16): EVAL TURN-DIETS MUST NEVER DEGRADE THE REAL PRODUCT

"We shouldn't hack the app in obviously detrimental ways to pass the eval." Applied
retroactively: the w12-c templates[0] AUTO-APPLY is REMOVED (it silently pre-filled the
composer and made "Write from scratch" lie — the user hit the confusion live). A diet is
legitimate when it's invisible or genuinely better UX (deep links, Enter-to-commit,
fewer clicks, instant first paint); it is FORBIDDEN when it changes what the product
does without the user asking (silent pre-fills, surprising defaults, skipped
confirmations). SWARM: audit the remaining turn-diet features against this rule and
file anything that fails it.

## GATE-9 USER-FILED BATCH (all fixed + deployed 9089cac3): fixed-table width:1px column
hack (13 columns starved under table-layout:fixed, content bleeding past the measure —
scan-locked in test/fixed-table-column-hack.scan.test.ts) · explicit "Write from
scratch" now empties the composer · contacts rows baseline-align (middle floated
single-line cells against two-line COMPANY) · participant DELETE route (earlier).


## USER-FILED P1 (2026-08-16, on prod) — FIXED + a scan gap to close

**Remove co-presenter failed live**: "No route matches DELETE /api/v1/submissions/:id/
participants/:pid" — the detail page's Remove action shipped with NO server half (its
render test mocks the API). Orchestrator built the route (ad84367d: scoped delete, lead
protection, 20/20 tests) and hotfix-deployed (version 8c4c5170). **SCAN GAP for the
swarm: the DEC-817 SPA↔route mutation-contract scan missed the DELETE verb** — extend it
to enumerate EVERY api* helper call (get/post/patch/DELETE) in app/src against
registered routes, so a UI control can never again ship without its endpoint.


## Standing rules (still bind)

- **Targeted tests only, in-wave**; full suite only at merge-train
  batches/exit waves via `scripts/with-test-lock.sh`.
- **Items close on measured or runtime evidence, never a code read alone.**
- **docs/ precedence:** `docs/clarifications.md` overrides all;
  `decisions/DEC-*.md` binding, compile-checked via `src/decisions.ts`
  (never hand-edit); rest of `docs/` informs, doesn't override.
- **No eval gaming.** Rubric/fixtures inform what to build; product code
  never references fixture values or rubric IDs.
- **A mandate item moves tier only on a citation re-run at the moving
  wave's own runtime** — never inheriting a prior verdict or a brief's
  restated claim (DEC-069, DEC-976 wave-25 amendment).
- **IN FLIGHT is built from `.git` ref state at the writing task's own
  runtime** (DEC-069 wave-17 amendment). A branch whose tip equals its
  merge-base with `main` produced zero commits — UNLESS it was created
  within this same wave and may still be running (DEC-069 wave-37
  amendment): check `.git/logs/refs/heads/<branch>`'s creation timestamp
  against sibling lanes before calling it dead.
- **A recorded ruling is not a landed fix** (DEC-358 wave-31 amendment): a
  DEC amendment's argued file:line is a mandate, not a receipt — only a
  diff or an exercised check closes an item.
- **A branch-local PASS is not a closure** (DEC-644 wave-35 amendment): a
  perf/sweep row moves out of FAIL only on a reading taken at a boundary
  that contains EVERY fix credited with closing it; two lanes each
  measuring their own fix with the sibling fix absent produce two PASS
  readings and zero readings of the tree that actually shipped.
- **A closed TIER 0 row names its falsifying check** (DEC-358 wave-37
  amendment): a code-shape citation alone is not a closure backing; label
  it `UNFALSIFIABLE — owner: wave-38 lane` and keep it, don't delete it.
- **An absence is a measurement, not a note to carry** (DEC-358 wave-35
  amendment): a rebase re-globs every "file X does not exist" claim before
  carrying it; an existence claim that survives a rebase unre-globbed is
  DELETED rather than carried forward. Same applies to ref-existence
  claims — a `.git/packed-refs` stale entry is a live trap, not a citation.
- **The vendored frame pack is `docs/design/*.dc.html`**; where a research
  render measurement conflicts with vendored `docs/design/README.md`, the
  README wins.

## TIER 0 — re-verified, already correct or already merged, do not re-file

### Landed since the wave-44 boundary (`6edb5263`..`243b3094`), verified this wave

**Wave 46's five instrument/authz fixes, folded in, each file:line
re-opened directly at `243b3094` (not inherited from the field guide) and
each falsifying test file confirmed present:**

- **`scripts/exit-predicate.ts:346-352`** — `isAncestor`'s git-subprocess
  wrapper now catches status `128` ("fatal: Not a valid object name",
  an unresolvable ancient header sha) and treats it as NOT an ancestor with
  a `console.warn`, rather than rethrowing and aborting the whole grading
  run before any slot is graded. FALSIFYING CHECK: `test/exit-predicate-ancestry.test.ts`
  (exercises the exported `gitAncestorResult` mapping directly, status
  128 -> not-an-ancestor).
- **`scripts/assemble-verification-log.ts:97`** — `deriveSyntheticHeader`
  synthesizes a header from the FILENAME (`NNNN-YYYY-MM-DD-<branch>-<scope
  words>-<sha>.md`) for any index file whose first line does not conform,
  rather than letting a malformed header donate its RESULT/OPEN ITEMS lines
  to the preceding conforming section. FALSIFYING CHECK:
  `test/verification-log-header-contract.test.ts` (fixture-string only, no
  filesystem/process spawn, exercises `nonConformingHeaders`).
- **`src/routes/tasks.ts:500`** — `POST /api/v1/tasks/:id/assign` now
  builds its response grid via `parseOnboardingGridQuery(c.req.query(),
  Date.now())` (the CALLER's own query string), echoing the same parser
  `GET .../onboarding` uses, instead of a hand-written literal. FALSIFYING
  CHECK: `test/onboarding-assign-echoes-query.test.ts`.
- **`src/routes/auth-claim.tsx:59-81`** — the per-IP `claim` rate-limit
  bucket is consumed BEFORE the token lookup, then explicitly refunded
  (`refundScopedLimit`) the instant the token is confirmed to resolve — a
  real speaker with a real token is never charged against the bucket a
  stranger's failed guesses fill. FALSIFYING CHECK:
  `test/claim-rate-limit-failure-budget.test.ts` (DEC-949 wave-46
  amendment: the bucket is a failure budget, not an admission gate; every
  fixture request lands in the "unknown"-IP bucket on purpose).
- **`src/server/repo/public/detail.ts:16,143`** — the public speaker DETAIL
  page's page-level HEADER title/company now reads the contact's own
  person-level record (DEC-258 wave-46 amendment), while per-session
  entries keep exposing their own frozen participant snapshot
  (`title_at_time`/`org_at_time`) elsewhere per the ORIGINAL DEC-258 rule —
  a header is about a person, a snapshot is about a participation.
  FALSIFYING CHECK: `test/public-speaker-detail-identity.test.ts` (exercises
  `getPublicSpeakerDetail` directly against a fake db).

**Wave 47's five landed product fixes (five wave-47 refs — `task-w47-b/c/d/e/f`
— confirmed ancestors of `main` at this runtime; `task-w47-a/g/h` are NOT
ancestors, see IN FLIGHT):**

- **Portal submission-detail/resource-download reads scoped in SQL (DEC-962
  amendment)** — `src/server/repo/portal/data.ts:203-215`,
  `src/server/repo/portal/resources.ts:111-125` — `getPortalSubmissionDetail`
  and `getResourceDownloadScope` now carry a correlated `sql\`exists (...)\``
  over `participant`/`PORTAL_VISIBLE_INVITE_STATUSES` inside the SELECT's
  own WHERE, so a foreign submission/resource id contributes zero rows by
  construction instead of being materialized and checked in JS afterward.
  FALSIFYING CHECK: `test/portal-detail-download-scope-sql.test.ts`,
  `test/portal-invite-scope.test.ts`.
- **Auto-schedule unplaced accounting is set-based and snapshot-scoped
  (DEC-615 amendment)** — `src/server/repo/agenda/auto-schedule.ts:195-217`
  — reconciles `payloadUnplacedIds` against `reasonIds` by SET membership
  against this run's own `snapshotIds` (not a length comparison against a
  second post-write read), so a benign concurrent accept/unaccept no longer
  throws an uncaught 500 and can no longer let two compensating differences
  cancel silently; an id outside the run's own snapshot is now labelled
  `changed_during_run` rather than crashing. FALSIFYING CHECK:
  `test/auto-schedule-unplaced-reconciliation.test.ts`,
  `test/schedule-unplaced-reasons.test.ts`.
- **Contacts import refuses a two-columns-one-field mapping (DEC-478
  amendment)** — `src/domain/contacts-parts/import.ts:63`
  (`validateImportMapping`) — closes a silent-data-loss bug where
  `mapImportRow` kept only the rightmost of two CSV columns aimed at the
  same destination field. FALSIFYING CHECK:
  `test/contacts-import-mapping-injective.test.ts`.
- **Merge preview runs the write door's own preflight (DEC-026 amendment)**
  — `src/server/repo/contacts/merge.ts:711` (`checkMergeConflicts`,
  extracted and shared), called from both
  `src/routes/api/contacts/merge.ts:78` (preview) and the write door's own
  `:773` preflight — a preview can no longer show a clean merge that the
  write door then refuses. FALSIFYING CHECK:
  `test/contacts-merge-preview-parity.test.ts`.
- **Contacts "Across your events" list capped, `eventsTotal` added (DEC-534
  amendment)** — `src/server/repo/contacts/history.ts:30,140`
  (`MAX_CONTACT_HISTORY_EVENTS = 20`) — closes the one remaining unbounded
  surface in `getContactHistory` (submissions/emails were already
  capped-with-total). FALSIFYING CHECK: `test/contacts-history-event-id.test.ts`.

**`task-w46-g` (`74d682d3`, "DEC-020: scan-lock the upload accepted-type/size-cap
vocabulary, J8 ENUMERATION") — CORRECTION to DEC-358's wave-48 amendment.**
That amendment records this branch as a STRANDED, non-ancestor commit the
wave-46 merge train never picked up. At THIS task's own runtime,
`git merge-base --is-ancestor 74d682d3 main` returns true, and
`git log --ancestry-path 74d682d3..main` shows `merge task-w46-g`
(`185fa8d7`), landed before the wave-47 merges — the branch is MERGED, the
amendment's premise was current when written and has since been overtaken
by a later merge. The custody RULE the amendment states (a live ref
carrying a non-ancestor commit stays OWNED and is never re-filed) is
unaffected and still binds for the NEXT stranded ref; this specific
instance is simply no longer an example of one. Do not carry the STRANDED
label forward for `task-w46-g`. Formal census ownership (naming it CLOSED
in a wave-48 triage table) belongs to `task-w48-g`, per the ownership
boundary above — this is a ref-truth correction, not a census entry.

### Landed since the wave-47 boundary (`32921050`..`87cee8b9`), verified this wave

**Wave-45's seven CONFIRMED-DEFECT rows — all seven CLOSED**, every
`task-w47-a`..`-g` owning branch a confirmed ancestor of HEAD, each item
re-checked directly against the live tree this task (not inherited):

1. **Reminder send-then-stamp race** — CLOSED, `task-w47-a` (`030c9170`).
   `reminders.ts:415-459` (DEC-023) claims via a conditional chunked
   `UPDATE...RETURNING` BEFORE the mail loop. `test/reminders-claim-before-send.test.ts` 2/2.
2. **Portal read doors scoped in JS** — CLOSED, `task-w47-b`.
   `portal/data.ts:13-23,75`, `portal/resources.ts:116-154` (DEC-962) now
   prove `contactId` via correlated `EXISTS` in the SQL `WHERE`.
   `test/portal-detail-download-scope-sql.test.ts` 4/4,
   `test/portal-resources-scope.test.ts` 2/2.
3. **Auto-schedule accounting race** — CLOSED, `task-w47-c`.
   `auto-schedule.ts:188-198` (DEC-615) reconciles by SET membership
   against this run's own snapshot. `test/auto-schedule-unplaced-reconciliation.test.ts` 2/2.
4. **CSV import duplicate-destination mapping** — CLOSED, `task-w47-d`.
   `contacts-parts/import.ts:44-130` throws, never coerces/drops.
   `test/contacts-import-mapping-injective.test.ts` 6/6.
5. **Merge preview/execute preflight parity** — CLOSED, `task-w47-e`.
   `api/contacts/merge.ts:35-83` (DEC-705/DEC-026) preview now runs
   `repo.checkMergeConflicts`, returns `blocked` in the 200 body.
   `test/contacts-merge-preview-parity.test.ts` 3/3.
6. **Contact history `events` unbounded** — CLOSED, `task-w47-f`.
   `contacts/history.ts:30,140` — `MAX_CONTACT_HISTORY_EVENTS = 20` now
   bounds it. `test/contacts-history-event-id.test.ts` 6/6.
7. **File version-mint race** — CLOSED, `task-w47-g` (`9a541796`).
   `migrations/0043_file_version_chain_unique.sql` (on disk,
   ancestor-confirmed) + `content.ts:81-83` `uniqueIndex`. Second insert
   onto the same predecessor now throws a conflict `ApiError`.
   `test/file-version-chain-unique.test.ts` 2/2.

(All eight FALSIFYING CHECK files re-run this task, green — no citation
inherited from a branch's own commit message.) `0236` (task-w45-f)'s
24-file header-contract blast-radius finding stays UNOWNED (re-glob: no
live branch claims it; `assemble-verification-log.ts:97-121`'s
`deriveSyntheticHeader` already covers 17/24 mechanically, 15 sha-less
legacy files still need a grandfather-vs-backfill DEC ruling).

**Wave-48's three landed gate sections, folded in.**
`docs/verification-log/index/0240` (task-w48-a, build+test+bundle @
`0ecff8aa`, `FAIL`, 2 open items), `0242` (task-w48-c, perf-smoke,
`PASS`, 117/117), `0244` (task-w48-f, render-sweep @ `243b3094`, `PASS`,
all seven passes clean) — all ancestors of HEAD. `0240`'s two items,
re-checked directly at this HEAD:
   - **Item 1** (DEC-818 cited a non-existent migration) — CLOSED, the
     file now exists (item 7 above). `test/decision-path-references.scan.test.ts` 2/2.
   - **Item 2** (`test/spec9-invariants.test.ts:131` DEC-041 assertion
     fails) — STILL FAILS, RECLASSIFIED as a TEST DEFECT not a product
     regression (DEC-522 w49 finding, reconfirmed this task by re-running
     it): the test feeds `Date.now() - 24h` against a UTC calendar DAY
     LABEL, so which of lines 131/133 fails depends on the hour the suite
     runs — `src/domain/edit-lock.ts:22`'s DEC-041 carve-out is unchanged.
     This run: line 131 (`"pending"`) failed, not line 133
     (`"accepted"`) as `0240` reported — same clock-boundary defect,
     different assertion. Owner: wave-51 lane should freeze the test's
     clock/day-label as `test/edit-lock.test.ts:9-11` does; do not
     re-file as a product regression.

### Landed since the wave-41 boundary (`b71a1358`..`6edb5263`), verified this wave

- **Wave 42's six lanes, folded in.** `docs/verification-log/index/0210`
  (task-w42-a triage-closure, `OPEN ITEMS: 1`), `0211` (task-w42-c
  contacts-integrity adjudication, `OPEN ITEMS: 1` — mergeContacts
  non-atomicity CONFIRMED-DEFECT), `0212` (task-w42-d content-lifecycle
  adjudication, `OPEN ITEMS: 0`), `0213` (task-w42-e gate-gap adjudication,
  `OPEN ITEMS: 2` — autoSchedule window-blind filter + perf-seed wiring gap
  both CONFIRMED-DEFECT), `0214` (task-w42-f tier-1 fidelity recheck,
  `OPEN ITEMS: 0`), `0216` (task-w42-b stage-1 exit ledger, mechanical
  five-slot table, `RESULT: FAIL`, `OPEN ITEMS: 4`) — all six files present
  and re-read at this HEAD. `0216`'s ledger names four blocking items: (1)
  the mechanically-graded triage-closure slot reading FAIL because a
  higher-sequence stale section (`0215`) supersedes a fresher one (`0210`)
  by append order alone; (2) mergeContacts non-atomicity; (3) autoSchedule
  window-blind `existing` filter; (4) `scripts/perf-seed.ts` perf-speaker
  wiring gap. Items (2) and (3) are CLOSED by named wave-43 fixes below;
  item (4) is FALSE (see DISMISSED below); item (1) is a sequencing
  artifact, addressed by DEC-099 w44's recency rule (newest measured tree
  wins) rather than a product fix — see task-w44-f's `0225` for the current
  reading.
- **`mergeContacts` multi-id merge non-atomicity — CLOSED.**
  `src/server/repo/contacts/merge.ts:702-716` carries the "DEC-629/DEC-026
  wave-43 amendment: set-based, ALL-OR-NOTHING merge" comment, with a
  whole-operation preflight (`merge.ts:388`, `:410`) that resolves every id
  in the batch BEFORE any write, so a refusal on any single id means ZERO
  writes for the whole call. FALSIFYING CHECK:
  `test/contacts-merge-integrity.test.ts`,
  `test/contacts-merge-authz-batch.test.ts` — both present; would fail if
  the preflight were reverted to per-pair (partial-write) semantics.
- **`autoSchedule()` window-blind `existing` filter — CLOSED.**
  `src/server/repo/agenda/auto-schedule.ts:60-68` now shares
  `isDayWithinEventRange` (imported `:18`) with `payload.ts`, splitting
  `slotted` into `inRangeSlotted`/`outOfRangeSlotted` so a slot outside the
  event's window can no longer be counted "existing" and silently suppress
  an unplaced-reason. FALSIFYING CHECK:
  `test/schedule-unplaced-reasons.test.ts`,
  `test/agenda-auto-schedule-params.test.ts`,
  `test/auto-schedule-persistence.test.ts` — all present; would fail if the
  shared-window-predicate were reverted to the old blind filter.
- **`deleteContact` FK-integrity (DEC-979) — CLOSED, confirmed still in
  force.** `src/server/repo/contacts/crud.ts:306-332` NULLs
  `email_log.contact_id`, `file.uploaded_by_contact_id`,
  `file_comment.author_contact_id` (never deletes the audit row), and
  deletes `pipeline_entry`/`pipeline_activity`/`task_assignment`/dismissal
  rows ahead of the contact row itself. FALSIFYING CHECK:
  `test/contact-delete-fk-integrity.test.ts`,
  `test/contact-delete-refusal-rows.test.ts` — both present.

### Closed, carried (boundary `0db68e36`, re-verified present on `494b6c01`)

- **`files library (page 1)` perf FAIL** (raw 484.4ms/adj 481.5ms vs 50ms
  budget, `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:67-84`)
  — CLOSED. `task-w29-b`'s real commit `c50e56f3` (ancestor of `main`)
  replaced the non-indexable `headshot_url` string-concat join with an
  indexed FK (`contact.headshotFileId`, `src/db/schema/org.ts:72,98`) at all
  three call sites and rewrote `totalSizeBytes` as a SQL aggregate.
  FALSIFYING CHECK: `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`
  — reconfirmed 3-of-3 PASS at `f5783479` (adj 16.8/12.0/15.7ms), the newest
  measurement of this row. Lands DEC-773's wave-29 "option 3" (real FK); do
  not re-file as unfixed.
- **`onboarding grid` perf FAIL** — CLOSED. `task-w29-a`, adjusted p95
  116.1ms → 23.0ms (PASS). FALSIFYING CHECK: reconfirmed 3-of-3 PASS at
  `f5783479` in `task-w36-c`'s perf-smoke run (adj 38.0/24.0/37.7ms),
  `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`.
- **Render-sweep interaction-state (2/4→3/3) incl. `.chq-cfp-step-next`
  focus** — CLOSED. `task-w29-c`. FALSIFYING CHECK:
  `docs/verification-log/task-w36-e-render-sweep-f5783479.md` — the
  wave-36 `task-w36-e` fresh full-gate render-sweep run scored
  interaction-state `3/3` with zero FAIL rows at `f5783479`, third
  independent reconfirmation after `task-w29-c` and `task-w35-b`.
- **`.chq-participation-menu-caret` contrast row** — CLOSED, RELABELLED
  falsifiable this wave. `task-w29-d` (`add09a9e`, ancestor of `main`):
  `app/src/pages/speakers/speakers.css:405`, `color: inherit;` (was
  hard-coded `var(--chq-muted)`). Prior wave's caveat is RESOLVED, not
  carried as a caveat: `task-w35-b`'s wave-35 finding that the gate had NO
  contrast row for this selector was itself CLOSED by `task-w36-e`
  (`docs/verification-log/index/0188-2026-08-15-task-w35-b-render-sweep-a0b8501b.md:29-39`
  cites the gap; `docs/verification-log/task-w36-e-render-sweep-f5783479.md`
  closes it). `task-w36-e` added `NAMED_CONTRAST_SELECTOR` to
  `scripts/render-sweep-contrast.ts:43` and an in-page contrast probe to
  `scripts/render-sweep.ts`, then ran the gate: `[NAMED-PAIR
  .chq-participation-menu-caret: ... ratio=6.82 ... PASS]` on both
  `/admin/speakers` and `/admin/speakers/seed_contact_0001`, clearing WCAG
  AA's 4.5:1 minimum with margin. FALSIFYING CHECK:
  `test/render-sweep-contrast.test.ts` (asserts the `NAMED_CONTRAST_SELECTOR`
  named-pair machinery; 18/18 passed at `f5783479`) plus the gate row itself
  — this selector now has both a unit-test-backed instrument and a runtime
  gate reading, not a code-shape citation alone.

### TIER 0 OWNED — perf rows, resolved this wave

Per DEC-644's wave-35 amendment, a row closes only on a single `perf:smoke`
run timing it at a boundary containing every credited fix. **This wave finds
that run:** `task-w36-e`'s ANCESTOR check confirms `task-w36-c` (HEAD
`f5783479`) is an ancestor of every live wave-36 sibling, and `task-w36-c`'s
own perf-smoke entry (`docs/verification-log/task-w36-c-perf-smoke-f5783479.md`)
confirms both `74c6377a` (`task-w32-b`, `reviewer.ts`) and `904dd3d8`
(`task-w32-a`, `shared.ts`/`plans-progress.ts`) as proven ancestors of that
same HEAD, and times BOTH mandate rows in the same three-run sequence. This
IS the merged-boundary reading DEC-644 wave-35 required — not a brief's
restated claim, a citation re-run at this wave's own runtime.

- **`plan results (page 1)`** — CLOSED. `task-w36-c`'s run at `f5783479`:
  3 of 3 PASS (adj 30.6/19.5/25.7ms) vs the 50ms budget, with both credited
  fixes (`74c6377a`, `904dd3d8`) proven ancestors of the reading boundary —
  the exact joint-boundary reading DEC-644 wave-35 demanded. FALSIFYING
  CHECK: `docs/verification-log/task-w36-c-perf-smoke-f5783479.md`
  ("plan results (page 1)" row).
- **`reviewer queue`** — STAYS OPEN, now a REGRESSION finding rather than an
  ownership gap. `task-w36-c`'s run at the SAME joint boundary (`f5783479`,
  both `74c6377a` and `904dd3d8` ancestors): run1 raw 54.2/adj 51.5ms FAIL,
  run2 raw 36.5/adj 34.1ms PASS, run3 raw 58.5/adj 55.3ms FAIL — 1 of 3 PASS
  vs the 50ms budget, markedly less stable than `task-w35-a`'s earlier 3-of-3
  PASS at the same fix set. This is now a joint-boundary reading (the
  ownership question DEC-644 wave-35 raised is answered: the boundary
  exists, and at it the row FAILs), not a missing-reading gap. FINDING
  (logged by `task-w36-c`, not fixed): `src/routes/review/reviewer.ts`'s
  `GET /api/v1/review/plans/:id/queue` handler now straddles the 50ms
  budget line. OWNED BY NAME by no lane; next wave should re-measure or
  investigate the straddle, not re-file the ownership question as unsettled
  — it is settled (FAIL, not "no reading yet"). Deleted this wave: the
  `task-w35-a` OWNED-BY-NAME line — superseded by the joint reading above.
  **Wave-41 rebase note: STAYS OPEN, not graded from prose this task.**
  `docs/verification-log/task-w40-c-perf-smoke-2e99b272.md` shows a newer
  3-of-3 PASS at `2e99b272` (raw 25.4/25.4/27.1ms, adj 22.9/23.0/24.8ms),
  a visible improvement over the 1-of-3 PASS above — but this rebase task
  is docs-only and does not itself own the closing verdict; per this
  task's own instruction, ownership of the closing measurement for this
  row stays with wave-40's perf-smoke lane (`task-w40-c`), which is the
  one that ran it. Whether `2e99b272` constitutes the DEC-644 joint
  boundary (every credited fix an ancestor) is for that lane's own report
  to state, not this file.
- **`plan progress (page 1)`** — NOT GRADED FROM PROSE HERE. `task-w44-c`
  (the branch this row was previously pointed at) no longer exists as a
  live ref at this wave's runtime (re-glob per DEC-358 wave-35: a
  ref-existence claim decays like any other) — its measurement, if it ran,
  either merged silently into an earlier boundary or was lost with the
  branch. `task-w48-c` (`2330f7cd`, real commit, NOT an ancestor of `main`
  at this HEAD — see IN FLIGHT) reports a fresh three-run `perf:smoke`
  covering this exact row among its 117/117 PASS rows, at its own tip
  `0ecff8aa` (0242) — this docs-only rebase does not itself read or
  re-derive that verdict (ownership boundary), but names `task-w48-c` as
  the current candidate owner rather than the dead `task-w44-c` ref. Do
  not carry a stale verdict for this row until a merged boundary's own
  perf-smoke reading closes it by name.

### DISMISSED review-lens/instrument alarms

- **`0193`/`0195`/`0196`/`0213` `scripts/perf-seed.ts` perf-speaker wiring
  gap** — DISMISSED, FALSE, re-checked this wave. `grep -c PERF_SPEAKER
  scripts/perf-seed.ts` = 13 at `6edb5263`; perf contact/user/participant
  inserts at `scripts/perf-seed.ts:608,627,643,659`. `0210` (wave-42
  triage-closure) already ruled this CLOSED; `0213` (a sibling wave-42
  lane, same wave) re-filed it as CONFIRMED-DEFECT anyway with no
  contradicting grep of its own — re-derived directly this wave and `0210`
  is the verdict that holds. `scripts/` is out of this task's write scope
  (DEC-358 w44); nothing to fix here, the wiring already exists.
- **`0197`/`0213` row 2 `resolveBaseUrl` dev-loopback footgun** —
  NOT-A-DEFECT (standing reclassification, carried from `0213`'s own read,
  unchanged this wave). `src/server/origin.ts:123-128`: outside `devMode`,
  an unset `PUBLIC_BASE_URL` throws (`resolveBaseUrl: PUBLIC_BASE_URL is
  not set...`) rather than guessing from the request `Host` header
  (DEC-252 wave-18 amendment) — the footgun is dev-only, and stage-2
  provisioning is the actual fix surface (analogous to the email-provider
  framing in `docs/clarifications.md:33`). Re-read directly at `6edb5263`;
  standing verdict, not re-litigated.
- **Bare-email login-account budget locks the real owner out** — DISMISSED
  this wave, FIXED in-tree. `src/routes/auth-helpers.ts:69`
  (`AUTH_ACCOUNT_RATE_LIMIT_MAX`) + `src/routes/auth-login.tsx:79-135`
  (DEC-072 wave-38 amendment): the bare-email `login-account` bucket is now
  a SOFT failure budget, not an admission gate — exhausting it forces a
  WRONG password to 429 instead of 401, while the CORRECT password still
  succeeds, so a stranger who merely knows the victim's address can no
  longer lock the real owner out with no unlock path. Re-read directly at
  `b71a1358`; not a code-shape guess.
- **`api/users.ts` routes reachable without a cookie session** — DISMISSED
  this wave, FIXED in-tree. `src/routes/api/users.ts:67,138,168` — the
  list, create, reset-password and role-patch handlers all carry
  `requireCookieSession` alongside `requireOrganizer`/`csrfJson`.
  FALSIFYING CHECK: `test/users-bearer-containment.test.ts`,
  `test/credential-route-cookie-session.scan.test.ts` (a scan-lock, so a
  future route added without the guard fails it too, not just these four).
- **Task-reminder due-day label drifts from the shared helper** —
  DISMISSED this wave, FIXED in-tree.
  `src/server/repo/tasks/reminders.ts:29,148` imports and calls the shared
  `effectiveAssignmentDueDayLabel` (`src/domain/task-due.ts`) rather than
  a local recompute. FALSIFYING CHECK: `test/task-due.test.ts`.
- **`rule-match.ts` silently resolves an unknown rule op** — DISMISSED
  this wave, FIXED in-tree. `src/forms/rule-match.ts:145` throws
  `Error('unknown rule op: ' + rule.op)` rather than falling through to a
  default. FALSIFYING CHECK: `test/forms-rule-match.test.ts`.
- **`task-w17-i` (DEC-716, sign-in names the event and its open CFP)** —
  DISMISSED as an open scope, LANDED BY ANOTHER PATH. The literal
  `task-w17-i` branch (`7b78d8b6`) is still unmerged and stale, but its
  scope shipped via a different lane:
  `loadSingleEventContext` (`src/routes/auth-helpers.ts:98-106`) is
  consumed at all three `LoginPage` render sites in
  `src/routes/auth-login.tsx:50,146,169,198`. Re-read directly at
  `b71a1358`. Moved from IN FLIGHT to here — do not re-file the scope, and
  do not resurrect the `task-w17-i` branch on the strength of the old
  "OWNED BY" line.
- **Wave-39 plan-progress rewrite undercounts `total`** — DISMISSED this
  wave, review-lens question re-read and found FALSE.
  `src/routes/review/plans-progress.ts:129-131` computes
  `const total = users.length;` BEFORE `users.slice(start, start + perPage)`
  runs — `total` still reads the full reviewer set, never the paged
  slice's length. The wave-39 fan-out-kill refactor (DEC-829) did not
  change this semantic.
- **"DEC-358 cited with no backing"** — DISMISSED, `decisions/DEC-358.md:9-11`
  carries the wave-27 compaction amendment verbatim; a decision file is its
  own backing.
- **"37 failing tests"** — DISMISSED, suite green, reconfirmed at `f5783479`
  by `task-w36-a`: `docs/verification-log/task-w36-a-build-test-f5783479.md`
  — "Test Files 1084 passed (1084)", "Tests 11898 passed (11898)", bundle
  69.20 kB gzip vs 300 kB budget.
- **DEC-244 "version 2" walkthrough defect** — DISMISSED, instrument bug,
  repaired, PASS twice — `docs/verification-log.md:3912-3930` (ad hoc
  `file_request` task minted+assigned same-run so no seed loop
  pre-completed it; repaired script creates both versions itself).
- **`migrations/0039_user_name.sql` untracked-file alarm** — DISMISSED,
  `docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md:15`: "all 39
  migrations (`0001`..`0039`) applied ✅" — tracked and applied. Migration
  count reconfirmed current: `task-w36-b`'s walkthrough ran `db:migrate` to
  43 migrations at `f5783479` clean.
- **"routes lacking `requireOrganizer`"** — DISMISSED, mount-guarded: admin
  sub-apps are guarded at the mount point, not re-declared per route, and
  several handlers additionally carry inline `c.var.auth.role` checks a
  route-signature grep for the literal string does not recognize — grepping
  under-reports the guarded surface by construction.
- **"`.chq-participation-menu-caret` contrast row has no gate check"** —
  RESOLVED, not just dismissed. `task-w35-b` found the gap; `task-w36-e`
  built the gate row and closed it (see TIER 0 CLOSED entry above). Do not
  re-file.

### STALE-ON-MEASUREMENT (do not re-file — closed, re-checked this wave)

- **`.chq-review-checkbox-label` contrast** ratio 3.09 — NOT a live defect.
  Closed via DEC-426's wave-29 exemption path: an inactive-component
  disabled-token pair (`--chq-disabled` on `--chq-disabled-bg`) is exempt
  under WCAG 2.1 SC 1.4.3, recorded as `EXEMPT-BY-RULE` rather than a FAIL
  — `scripts/render-sweep-contrast.ts:77-84,112-115` (the `exempted`/
  `exemptNote` fields), asserted by `test/render-sweep-contrast.test.ts:61`.
  Reconfirmed present in `task-w36-e`'s wave-36 fresh full-gate run at
  `f5783479` (contrast `60/60`, advisory, zero FAIL rows).
- **Mobile render-sweep console-error collection** — CLOSED, DEC-253
  wave-30 amendment: `scripts/render-sweep.ts:1023-1032` attaches the same
  `console`/`pageerror` collectors to the phone-viewport pass that the
  desktop pass already had, because a phone-only component (e.g.
  `PhoneAgenda`) mounts only at 390px and the desktop pass never observed
  its errors. Not a live gap.
- **Chunked/absent-`Content-Length` `application/x-www-form-urlencoded` and
  `multipart/form-data` body refusal** — CLOSED, DEC-020 wave-30 amendment
  (body-limit ceiling): `src/server/body-limit.ts:30-55` refuses an absent
  `Content-Length` for exactly those two content-types (buffered whole
  BEFORE auth by `csrfForm`'s `c.req.parseBody()`,
  `src/server/middleware.ts:283`), leaving JSON/other bodies (read only
  inside handlers behind `requireRole`/`csrfJson`) unrestricted by design —
  not a live gap.
- **`logoUrl` XSS** — CLOSED via `safeImageSrc`
  (`src/domain/brand-url.ts:25`), applied at the portal settings read door
  (`src/server/repo/portal/data.ts:167`) — rejects non-`http(s)`/`data:`
  image sources before they reach a self-hosted branding `<img src>`. Not a
  live gap.
- **Content-note zero-recipient 400** — CLOSED, DEC-317/DEC-720 wave-30
  amendment: `src/routes/content-notes.ts:8` — zero recipients is
  deliberately not an error (the durable content-status write proceeds
  regardless of whether any recipient exists to notify). Not a live gap.
- **AUDIT.md compose recipient cap claim** — CLOSED, DEC-618: `docs/AUDIT.md`
  previously mis-stated the compose cap as `MAX_PER_PAGE=200`; the real
  cap is `MAX_COMPOSE_RECIPIENTS = 100`
  (`src/domain/compose.ts:9`, enforced at
  `src/routes/comms/compose-core.ts:107-109`). The doc was corrected, and
  `test/audit-claims.test.ts` now resolves every `METHOD /path` backtick
  span against the composed route table so a future drift fails a test
  instead of sitting silently. Not a live gap.
- **Acceptance task fan-out** (one task minted per accepted participant
  rather than one per submission) — DELIBERATE, DEC-932. Not a live gap.

### RULED-NOT-IMPLEMENTED (DEC-358 wave-31 amendment)

No item currently qualifies for this tier at this boundary (`494b6c01`) —
every DEC amendment checked across waves 29-37 (DEC-773 wave-29/31, DEC-830
wave-29, DEC-829 wave-32, DEC-644 wave-31/32/35/36/37, DEC-099 wave-35,
DEC-426 wave-36) has either a landed, ref-verified fix or, as of this wave,
a resolved joint-boundary reading (see TIER 0 OWNED above — both rows now
have a verdict, one CLOSED and one a confirmed FAIL/regression, neither is
"zero commits" or "no reading yet"). Section kept (empty) so a future wave
files into it rather than re-deriving the header, and so "checked, none
found" is itself a citation.

### DISMISSED-VERIFIED-CLOSED (carried, wave 24-29 boundaries, not re-checked this wave beyond ref presence)

- **`task-w29-f` / `0174`-G / `0210` "admin Speakers `[List | Grid]`
  toolbar missing"** — VOID, DISMISSED-VERIFIED-CLOSED, RE-FILED AND
  RE-DISMISSED AGAIN THIS WAVE (third time this row has been closed — see
  RESTATED DO-NOT-RE-FILE note below). The wave-28 gate quoted
  `docs/design/README.md:350` under the heading `:343` "Public filter bar —
  one idiom, four surfaces" (`:345` names Sessions/Agenda/Speakers/Home as
  the four PUBLIC surfaces this row governs), then searched the admin
  onboarding-grid toolbar — irrelevant, never named by that quote. The
  named controls are already built PUBLIC-side: `SpeakerViewToggle`
  (`src/routes/public/speakers.tsx:20`, rendered `:235`/`:314`,
  `aria-current` at `:45`/`:52`) and `TrackFacetSelect` (`:72-103`);
  verified by `test/public-speakers-filter-bar.render.test.ts`. Re-verified
  at `6edb5263` this wave (file:line re-read directly, not inherited) and
  independently cross-checked against task-w44-f's own `0225` row for the
  same item, same verdict. **RESTATED, STRONGER: do not re-file this row a
  fourth time.** It was ruled VOID here at the wave-37/38 boundary, closed
  again as DISMISSED-VERIFIED-CLOSED at wave-41, and STILL re-filed as an
  open item by wave-42's `0210` triage-closure section — a `docs/design/
  README.md` heading naming the PUBLIC surfaces is not evidence of an
  ADMIN gap, and grepping for a control under `app/src/pages/speakers/**`
  will never find it because it was never spec'd to live there. Do not
  touch `app/src/pages/speakers/**` on this basis.
- `src/routes/tasks.ts` onboarding-grid status refuses unrecognised tokens
  — `src/routes/tasks.ts:164-213` (DEC-340 wave-18 amendment).
  FALSIFYING CHECK (wave-39, DEC-358): `test/onboarding-grid-query.test.ts` —
  opened and confirmed it exercises `parseOnboardingGridQuery` directly
  (not the route), asserting (a) a lone unrecognised `status` throws
  `ApiError('invalid')` with `fields.status` set, (b) a lone unrecognised
  `overdueOnly` token throws the same shape, and (c) `status: "bogus"` +
  `inviteStatus: "nope"` together throw ONE `ApiError` whose `fields` names
  BOTH `status` AND `inviteStatus` — i.e. the accumulate-both-bad-tokens
  shape at `:208-210` is covered, not just the single-bad-token case.
  Reverting the accumulate-then-throw block to a first-bad-token-wins throw
  would fail the two-bad-tokens assertion.
- `countEvaluationsBySubmission` caps `MAX_PLAN_SUBMISSION_SCAN + 1` —
  `src/server/repo/review/evaluations.ts`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/review-repo-aggregates.test.ts`'s
  "refuses past MAX_PLAN_SUBMISSION_SCAN distinct submissions, in submission
  vocabulary" — builds `MAX_PLAN_SUBMISSION_SCAN + 1` distinct-submission
  fixture rows through a fake db that recovers and applies the repo
  function's actual drizzle `where` bindings, then asserts the call rejects
  with an `ApiError` whose message contains
  `"more than {cap} submissions"`. Reverting the cap check would resolve
  instead of reject.
- `isSubmissionInReviewerScope` shares `resolveReviewerSubmissions`'s cap —
  `src/server/repo/review/submissions.ts:396-407` vs `:241-252`. This claim
  was FALSE AS AN "already covered" claim: every existing call site that
  imports `isSubmissionInReviewerScope` (`review-idor.test.ts`,
  `admin-list-bounds-review.test.ts`, `eval-scorecard-caps.test.ts`, and
  others) mocks the function rather than exercising its real cap-refusal —
  a revert of the `:401-407` cap check would have passed every test in the
  tree silently before this wave. WRITTEN this wave:
  `test/tier0-falsifiability.test.ts` — asserts, against the real function
  and the real `MAX_REVIEWER_SCOPE_ROWS` constant, that (a) a plan_reviewer
  read of `MAX_REVIEWER_SCOPE_ROWS + 1` rows rejects with an `ApiError`
  naming the cap, (b) exactly-at-cap resolves without throwing. Observable
  behavior only (thrown error + message), never query shape/call order, per
  this wave's co-ownership note with task-w39-d/e.
- `clearSessionCookie` appends `Secure` like `buildSessionCookie` —
  `src/auth/cookies.ts:32-44` vs `:18-30`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/cookie-flags.test.ts`'s `clearSessionCookie` describe
  block — asserts (a) `secure:false` omits `Secure` entirely, (b)
  `secure:true` appends `; Secure` as the last attribute, and (c) a direct
  attribute-name-order comparison against `buildSessionCookie({secure:true})`
  (minus the token/Max-Age value) so the two builders' Secure-placement
  can't silently drift apart. Reverting either builder to unconditionally
  omit/include `Secure` fails (a)/(b); reordering one relative to the other
  fails (c).
- Public sessions LIST hydrates speakers via `visibleParticipantConditions()`
  — `src/server/repo/public/sessions.ts:405-417`. FALSIFYING CHECK (wave-39,
  DEC-358): `test/public-invite-visibility.test.ts`'s "the hydrateSessions
  speaker-hydration query gates on visibleParticipantConditions()" — slices
  `hydrateSessions`'s body around its `schema.participant.submissionId,
  batch` call site and asserts the literal `visibleParticipantConditions()`
  call appears in that slice (not merely present anywhere in the file).
  Removing the call from that query's `.where(...)` (even while leaving the
  function/import elsewhere) fails this. Weaker than a runtime probe, but
  pinned to the actual call site, so a revert of THIS behavior (not just
  deletion of the function) is caught; `test/participant-invite-audience.scan.test.ts`'s
  scan-lock backs this further (a marker-less rewrite of the query fails
  that scan too), cited as supporting, not primary.
- `isSlugTaken` has no `orgId` predicate, DELIBERATE (`/e/:slug` global
  namespace) — `src/server/repo/events.ts:141-147`. DELIBERATE-BY-DESIGN,
  not a defect; falsifiability n/a.
- **DISCHARGED — batch A, `docs/mandates/w41-falsifiability-batch-a.md`,
  `task-w41-d`, MERGED.** Six items opened and closed with a named
  FALSIFYING CHECK each (all test files re-confirmed present at `6edb5263`
  this wave): per-person reminder scope on send AND preview
  (`src/routes/tasks.ts:564-613`, DEC-694) —
  `test/reminders-contact-scope.test.ts`; Comms preview `.ics` chip
  formatted in the event's own timezone
  (`app/src/pages/comms/icsChip.ts:18-19`, DEC-494) —
  `app/src/pages/comms/icsChip.test.ts`; reviewer multi-track scope renders
  a list, never "All tracks" (`src/domain/evaluation/progress.ts:39`,
  DEC-845) — `test/evaluation.test.ts`; EMB session-card speaker
  title/company (`src/routes/public/cards.tsx:102-116`) —
  `test/public-speaker-identity-line.test.ts`; seeded dates all relative to
  one seed clock (`scripts/seed.ts:261-278`, DEC-591) — NEW test written
  that wave, `test/tier0-falsifiability.test.ts`; portal edit-toggles
  (`app/src/pages/settings/PortalSettingsPanel.tsx:306`) —
  `app/src/pages/settings/PortalSettingsPanel.render.test.tsx`. Do not
  re-file these six as UNFALSIFIABLE.
  - **Accepted speakers keep editing past close** (`src/domain/edit-lock.ts:22`,
    DEC-041) — FALSIFYING CHECK: `test/edit-lock.test.ts` — opened and
    confirmed it directly asserts `canEditSubmission("accepted", PAST_CLOSE,
    NOW, LA)` is `true` (labelled "DEC-041 amendment, wave 6") while the
    sibling `"pending" + closed` case is `false` — the accepted-stays-open
    carve-out is exercised against its own negative control, not just
    asserted in isolation. (Discharged wave-39, carried unchanged.)
  - **Pipeline fit score + rationale** (`src/domain/pipeline-fit.ts`) —
    FALSIFYING CHECK: `test/pipeline-fit.test.ts` — opened and confirmed
    `sortByFit` (descending by score, null/unrated last, non-mutating) and
    `validateFitScore`/`validateRationale` (integer 1-5 or null; bounded
    text or null; throw a named `ApiError` field rather than coerce) are
    each exercised directly against the real functions, not a shape guess.
    (Discharged wave-39, carried unchanged.)
  - Phone-block override assertion —
    `app/src/phone-block-visibility.test.ts:186-205`; Comms phone landing —
    `app/src/phone-block-visibility.test.ts:109-121` (DEC-621). Already
    exempt from the UNFALSIFIABLE label (cited inline in the source batch).

  **DISCHARGED wave-46 (`task-w46-f`, DEC-358 amendment): four items from the
  batch-A remainder below, each with a real exercised falsifying check
  written after confirming the claim true at this worker's own runtime.**
  Saved embeds exist — `src/db/schema/embed.ts`,
  `src/routes/public/saved-embed.tsx` — CONFIRMED TRUE. FALSIFYING CHECK:
  `test/tier0-falsifiability-w46.test.ts` (schema columns + a real
  `GET /embed/e/:embedId` request through `publicRoutes`: unknown 404s,
  disabled is an empty 200 per DEC-822, enabled renders the event name).
  `/account/password` has real Cancel + 820 bare-page column —
  `src/routes/account.tsx:139-144` — CONFIRMED TRUE. FALSIFYING CHECK:
  `test/tier0-falsifiability-w46.test.ts` (renders `PasswordPage`, asserts
  a real `<a href={backHref}>Cancel</a>`, and that `BARE_PAGE_CSS`'s
  `.chq-bare-page` rule carries `max-width: 820px`). Overview §01
  skips-last-hour caption — `app/src/pages/Overview.tsx:325` — CONFIRMED
  TRUE. FALSIFYING CHECK:
  `app/src/pages/Overview.caption.w46.render.test.tsx` (mounts the real
  `OverviewPage`; caption renders with ≥1 overdue row, is absent at zero).
  Home footer media rule — `src/routes/public/home.css.ts:72-76` —
  CONFIRMED TRUE. FALSIFYING CHECK: `test/tier0-falsifiability-w46.test.ts`
  (asserts the `@media (max-width: 700px)` block's `.chq-home-footer` rule
  is present and differs from the base rule, and that `root.tsx` actually
  renders a `<footer class="chq-home-footer">` the rule targets).

  **DISCHARGED wave-49 (`task-w49-f`, DEC-358: the batch-A remainder,
  re-homed UNOWNED by wave 47's `task-w47-h`, decayed to that state after
  wave 45's lanes closed without taking it and none of wave 47's lanes a-g
  covered it either — this branch is the owner) — five items, each
  CONFIRMED TRUE at this worker's own runtime with a real exercised
  falsifying check. Full detail in
  `docs/mandates/w41-falsifiability-batch-a.md`'s wave-49 entry.**
  `npm run deploy` exists — `package.json:26`. FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts`. Settings edit-view field
  widths are tokens — `app/src/pages/settings/settings.css:17-21`
  (DEC-896). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts`. Phone agenda N-aware
  clash caption — `app/src/pages/agenda/PhoneAgenda.tsx:186`. FALSIFYING
  CHECK: `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx`. Phone
  agenda "Place here anyway" — `:167-176,199-208`. FALSIFYING CHECK:
  `app/src/pages/agenda/PhoneAgenda.w49.render.test.tsx`. Phone password
  fixed footer + Cancel — `src/routes/auth.css.ts` (media block shifted
  under wave 48's `:has()` re-scoping). FALSIFYING CHECK:
  `test/tier0-falsifiability-w49-batch-a.test.ts`.

  The batch-A remainder's sixth item, the Home footer media rule
  (`src/routes/public/home.css.ts:72-76`), was already discharged wave-46
  — see the entry above; nothing remains open from this batch.
- **DEC-099 wave-35 Vary: Cookie population + fix** — `task-w35-c`
  (`beb58e29` at filing, MERGED as of this wave — `3a041507` on `main`'s
  first-parent line per `task-w36-a`/`task-w36-b`/`task-w36-c`/`task-w36-e`'s
  shared "merge task-w35-c" citation): built
  `test/public-cacheability-enumeration.test.ts`, enumerating every GET
  route under `/e/*`, `/embed/*` and `/` and asserting `Cache-Control !=
  no-store <=> Vary: Cookie`; found and fixed a real violation in
  `publicNotFound`/`publicErrorDocument`/`publicRoutes.onError`. CLOSED —
  no longer a pointer, the fix is confirmed landed and merged.
  FALSIFYING CHECK: `test/public-cacheability-enumeration.test.ts`.

### DO-NOT-RE-FILE (carried, waves 14-23, not re-checked this wave beyond ref presence)

**DISCHARGED — batch B, `docs/mandates/w41-falsifiability-batch-b.md`,
`task-w41-e`, MERGED.** Eight items, each with a named FALSIFYING CHECK
(all test files re-confirmed present at `6edb5263` this wave; two were
written new that wave and re-confirmed non-tautological): `createUser`
insert-then-select onConflictDoNothing race guard
(`src/server/repo/users.ts:98-129`, DEC-552) —
`test/tier0-falsifiability-legacy.test.ts` (new that wave); `send.ts`'s
unconditional `bumpIcsSequences` (`src/routes/comms/send.ts:243-258`) —
`test/tier0-falsifiability-legacy.test.ts` (new that wave); bulk-email
two-stage dedupe (`src/routes/api/contacts/bulk-email.ts:214-250`,
DEC-238) — `test/contacts-bulk-email-dedupe.test.ts`; breaks validation
accumulates (`src/routes/api/breaks.ts:130-166`) —
`test/schedule-breaks.test.ts`; `MAX_PARTICIPANTS_PER_SUBMISSION` binds
all four participant-writer doors
(`src/routes/api/submissions.ts:598`, `src/server/repo/portal-edit.ts:487`,
`src/routes/api/contacts/import.ts:194`,
`src/server/repo/import/sessionboard.ts:622`) —
`test/api-participants.test.ts`, `test/portal-copresenter.test.ts`,
`test/contacts-import-participant-cap.test.ts`,
`test/sessionboard-participant-cap.test.ts`; mail envelope via
`addressValue` (`src/mail/email-binding.ts:236-240`) —
`test/mail-envelope-address.test.ts`; duplicate `trackIds` deduped on both
write doors (DEC-598) — `test/submission-tracks-are-a-set.test.ts`;
saved-view cap predicate is authorship not visibility
(`src/routes/api/views.ts:87`, DEC-422) —
`test/saved-view-cap-authorship.test.ts`. Both new-test items surfaced no
actual defect (coverage gaps only, per the mandate's own text). Do not
re-file these eight as UNFALSIFIABLE.

**STILL UNFALSIFIABLE (batch B remainder, not reached that wave) —
OWNED-BUT-UNMERGED this wave: `task-w49-g` (`73c2a306`, "discharge unowned
batch-B falsifiability remainder (DEC-358)") claims the items below with
re-confirmed-true checks and new/upgraded falsifying tests per its own
commit message; committed, NOT an ancestor of HEAD at this runtime. Same
caveat as batch A above — a named branch is a plan fact, not this lane's
own re-verified discharge; do not read as CLOSED until `task-w49-g` lands
or a lane independently re-runs its checks:**
`answerFieldRoleCondition` missing event join — DISMISSED, DEC-592 wave-18
amendment (`src/server/repo/form-roles.ts:16`);
`countEvaluationsBySubmission`'s whole-plan map — DISMISSED, DEC-449;
reviewer plan window on lone-submission read + file authz
(`src/routes/review/reviewer.ts:288`,
`src/server/repo/files-authz.ts:185-209`, DEC-018); `task-w14-d` AUTH_CSS
`.chq-field-invalid` cascade
(`app/src/components/error-states.css:31`, DEC-124 wave-14 amendment);
`task-w15-c/d` `updateEvent` slug guard (`src/server/repo/events.ts:224-259`,
DEC-111); `task-w15-d` sessionboard participant cap
(`src/server/repo/import/sessionboard.ts:620-627`, DEC-604); `task-w15-b`
send.ts intra-batch collapse (`src/routes/comms/send.ts:125-138`, DEC-238);
`task-w8-c` review round name+window
(`app/src/pages/review/ReviewerQueue.tsx:31,508`); `task-w8-d` compose
step-1 slot+footer
(`app/src/pages/comms/ComposeWizard.tsx:713-716,1226-1230`); `task-w8-b`
Submissions→Comms `?ids=` handoff
(`app/src/pages/submissions/BulkActionBar.tsx:77`); `task-w8-e` Comms
History pager (`app/src/pages/comms/HistoryTab.tsx:42-160`); `task-w10-b`
MERGED; `task-w17-b` perf-seed/perf-smoke harness bugs MERGED (`956fe263`);
`task-w23-e` frame-citation quoting audit MERGED (`c0fe6948`);
`task-w18-b/c/d/e/f/g` (reviewer-scope, compose defaults, History Export,
files-library table-layout, templates Delete, ENVELOPE_ALLOWLIST) all
MERGED between `956fe263` and `39ac22d0`; `task-w23-f` MERGED via
`f519f562` (DEC-902 column contract + DEC-937 review phone label). This
remainder is still UNFALSIFIABLE (no per-item exercised check named) except
items that already cite a test file inline elsewhere in this doc (e.g.
`test/audit-claims.test.ts`-adjacent items).

### Verification-log walkthrough items (docs/verification-log.md:3468-3478) — all FOUR fixed, harness-side

Script bugs, not product defects: (1) `scripts/walkthrough/speaker.ts:459-467`
now asserts `chq-portal-flag-done` (DEC-366 froze "Done"/"To do"); (2)
`scripts/walkthrough/public.ts:437` now asserts
`id="chq-pub-filter-trackId"` (DEC-919 wave-40); (3)
`scripts/walkthrough/data.ts:492-497` show-flow header now includes
trailing `kind` (DEC-022 wave-66); (4)
`scripts/walkthrough/scale.ts:393-407` `readMailboxCount` now threads an
authenticated organizer cookie jar (DEC-546). FALSIFYING CHECK: the
`task-w36-b` wave-36 walkthrough re-run at `f5783479`
(`docs/verification-log/task-w36-b-walkthrough-f5783479.md`) exercised all
six areas including `data`/`scale` PASS with zero FAIL lines — the harness
fixes are live-exercised, not merely present in source.

### Render-sweep items closed in the tree (carried, quoted)

- `/portal/tasks` measure fix — `src/routes/portal/portal.css.ts:417-430`
  (`min-width: 0` on `.chq-measure`, DEC-253 wave-25 amendment).
  DISCHARGED this wave (DEC-358): re-read the gate this task was asked to
  weigh, `scripts/render-sweep.ts`/`scripts/render-sweep-lib.ts`'s DEC-253
  mobile pass. `/portal/tasks` IS one of the entries in the BLOCKING
  `MOBILE_ROUTE_MANIFEST` (`scripts/render-sweep.ts:160`), and
  `evaluateMobileRoute` (`scripts/render-sweep-lib.ts:265-286`) fails the
  route on ANY page-level horizontal overflow
  (`document.scrollingElement.scrollWidth` / `maxElementRight` vs
  `window.innerWidth`, 1px slack). This IS a genuine falsifying check for
  THIS row specifically (not just a generic assertion of no relation): a
  reverted `min-width: 0` on `.chq-measure` is exactly the kind of
  unconstrained-flex-child overflow this assertion exists to catch on a
  narrow (390px) viewport, and the row is in the manifest that actually
  blocks the gate. Caveat: this reasons from the assertion's shape and the
  manifest membership, not from an actual booted-server run (out of scope
  for a docs-only task with no server to boot) — a wave-40 owner should take
  one real `npm run gate:render-sweep` reading to make this a runtime
  reading rather than a code-read.
- `/admin/submissions` filterbar 44px floor —
  `app/src/pages/submissions/submissions.css:557-564` (DEC-253/DEC-367).
  CORRECTION (DEC-358 wave-39): the delegating task description characterized
  the render-sweep mobile-pass floor as 40px — that's WRONG as re-read this
  wave. `scripts/render-sweep-lib.ts:258` defines
  `MIN_TAP_TARGET_PX = 44` exactly (comment at `:264` cites DEC-393), and
  `evaluateMobileRoute` (`:280-286`) fails any route whose
  `minControlHeight < MIN_TAP_TARGET_PX`. `/admin/submissions` (role
  `organizer`) is a member of `ADMIN_MOBILE_ROUTE_MANIFEST`
  (`scripts/render-sweep.ts:191-193`, filtered from `ROUTE_MANIFEST` by
  role), and `ADMIN_MOBILE_PASS_BLOCKING = true`
  (`scripts/render-sweep-lib.ts:387`) — this pass blocks the gate, it is not
  advisory. So the 44px claim is NOT rounded up from 40px — the gate's own
  constant is 44px, matching the row's claim exactly. DISCHARGED on the same
  code-read basis and same caveat as the `/portal/tasks` row above (no
  booted-server reading taken this task; a wave-40 owner should take one).

## IN FLIGHT — owned by a branch, do not re-file

Ref-measured at THIS task's own runtime against HEAD `87cee8b9` (46 refs
total; `git for-each-ref --format='%(refname:short) %(objectname:short)'
refs/heads` + `npx tsx scripts/ref-state.ts` + `git merge-base
--is-ancestor <ref> HEAD` run individually for every ref). Wave 45's
seven-item defect ledger and wave-30-through-47's named branches are gone
from this section — folded into TIER 0 above (all seven items CLOSED, all
owning branches merged). **Only a discharge status this lane itself
verified moved this wave; every branch below is named by sha and scope,
not re-adjudicated (DEC-358 w50 boundary).**

### Wave 48 — non-landed lanes

- `task-w48-b` (`2c3c4210`) — "DEC-069 gate slot 2/5 J1-J12 walkthrough @
  243b3094 (FAIL producer)".
- `task-w48-d` (`edea9219`) — "SPEC §6-9 static audit @ 243b3094".
- `task-w48-e` (`6b03b916`) — SIBLING rebase of this same file, older
  boundary (`243b3094`); do not hand-merge both, whichever lands first
  the other re-derives from the landed tree.
- `task-w48-g` (`bc04eb75`) — "DEC-069 gate slot 5/5 triage-closure @
  243b3094 (0245)".

All four committed, none an ancestor of HEAD.

### Wave 49 — all eight lanes committed, none landed (plan facts only, no verdict carried)

`task-w49-a` (`22aeb2fc`, likely fixes the item-2 clock test above),
`task-w49-b` (`e2929273`, CFP field-edit 409 on sibling-rule invalidation,
DEC-505), `task-w49-c` (`9d870db7`, gate repair: build admin SPA before
server-boot), `task-w49-d` (`db1dbc49`, public agenda feed reports a row
ceiling not a count), `task-w49-e` (`1ec6b285`, closes standing
DEC-099/DEC-068 items, pre-allocated seq `0250`), `task-w49-h` (`0aaf596e`,
CFP/public-submit integrity adjudication, seq `0251`) — named, not
independently re-read. `task-w49-f` (`b280d310`) and `task-w49-g`
(`73c2a306`) each claim to discharge one UNOWNED wave-41 falsifiability
remainder (see batch-A/batch-B entries above) — **OWNED, not verified by
this lane**; this task did not re-run either branch's checks, so the
remainder lists stay UNFALSIFIABLE-but-claimed, not CLOSED, until a
landing or an independent re-verification says so.

`0230` (task-w45-a, review-integrity) and `0231` (task-w45-b,
comms-integrity) filed **zero** CONFIRMED-DEFECT rows each (four J4 claims
NOT-CONFIRMED with one named verification gap for review-integrity; four
J5 claims NOT-CONFIRMED/DELIBERATE-BY-DESIGN for comms-integrity) — do not
re-file either as owed a wave-47 lane; they closed clean. `0237`
(task-w45-g, slot-claim instrument repair) fixed two DEC-069
slot-claim-classifier defects directly (no product code) and is MERGED;
not re-filed here.

### Wave 50 — this wave's own siblings (boundary text: a/b/c/d/e gates, f/g/h adjudications)

`task-w50-a` (`94cff3c8`, frozen-gate build+test+bundle), `task-w50-b`
(`c69591cc`, frozen-gate walkthrough — FAIL producer, day-label test
defect, consistent with item 2 above), `task-w50-c` (sha diverged past
worktree-creation value — a live sibling still committing, perf-smoke
three-run receipt), `task-w50-d` (`7bbd7b6d`, spec-audit SPEC §6-9),
`task-w50-f` (`dd95ef4c`, J3 submissions-triage adjudication, docs-only),
`task-w50-g` (`65e491eb`, J12 data-out adjudication, docs-only) — all
committed, none an ancestor of HEAD. `task-w50-e`/`task-w50-h` — tip
equals HEAD exactly (zero commits at this reading), RUNNING per DEC-069
wave-37, scope triage-closure per the slot roster. `task-w50-i` — this
task itself. None of these nine's counts, verdicts or RESULT/OPEN ITEMS
lines are restated or predicted here — named by branch, sha and one-line
scope only, per this task's own boundary.

### Other live refs (not wave 47-50)

- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged across many
  waves, but its NAMED SCOPE ("Sign-in page names the event and its open
  CFP", DEC-716) is CLOSED-SUPERSEDED — see the DISMISSED review-lens/
  instrument alarms entry above (`loadSingleEventContext` landed via a
  different lane). Do not resurrect the branch or re-file its scope.
- `manual-qa`, `task-custodian-w68-4`, `task-w68-d`, `task-w71-c/d/e` —
  ancestors of HEAD (folded into history; stale live refs, not owned
  scope).
- `mail-rich-shape-fallback`, `task-w68-b/c/e`, `task-w71-a`,
  `task-w72-a`-`j` — NOT ancestors, genuinely unmerged, but belong to
  waves numbered ahead of wave 50 (68/71/72), a different/later campaign.
  Flagged, not triaged.

### TIER-1 pointer — `task-w27-g` owns fidelity-recheck verdicts, cite as OWNED

Re-globbed again this wave: `ls
docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md` — file EXISTS
(unchanged from the wave-35 correction). Not independently re-read for
content this task (DOCS ONLY rebase); next TIER-1 touch should read it
rather than trust this note.

## TIER 1 — open items (gate-7 evidence, boundary `ea2a5543`; not re-derived this wave)

1. Compose-flow turn diet — structural fixes MERGED
   (`task-w8-b`/`task-w8-d`); diet half `task-w12-c`/`647a61b4`/DEC-967 —
   verify landed state before re-filing.
2. CNT-S3 session-edit loop — not owned by any wave-27+ lane.
3. Gate-7 fleet MARJORs, walked sub-item by sub-item (nothing deleted):
   12-home chrome — CLOSED, SUPERSEDED-BY-VENDORED-PACK
   (`docs/design/README.md:407-417`, `src/routes/public/home.css.ts:21`).
   07 comms step-1 SLOT/footer — CLOSED (`task-w8-d`); templates-grid
   overlap/history-tab chrome sub-clauses VERIFIED-OPEN (History-tab owned
   by `task-w18-f`'s Export door, `src/routes/api/exports.ts:120-147` —
   verify landed UI before re-filing). 05 files-library column swap +
   orphan row — CLOSED (`app/src/pages/content/FilesLibrary.tsx:252-253,340`);
   upload-reject modal / content-detail container sub-clauses
   VERIFIED-OPEN. 04 participation/speaker-detail — "search excluded from
   hasActiveNarrowing" CLOSED
   (`app/src/pages/speakers/OnboardingGrid.tsx:128-135`, DEC-678);
   "reminders modal localhost:8799" CLOSED (no literal under `app/src`);
   remaining sub-clauses VERIFIED-OPEN-NOT-RECHECKED. CLASS 1 admin measure
   — CLOSED, SUPERSEDED-BY-VENDORED-PACK (`app/src/styles.css:109-111`,
   DEC-744/989). 11 AUTH_CSS cascade — CLOSED (`task-w14-d`). 02 SESSION
   DETAILS label-left grid — CLOSED
   (`app/src/pages/submissions/SubmissionDetailPage.tsx:1197-1205,1413`).
   03 FORM ANSWERS stacked — CLOSED (`:1101,1106-1127`); results-head/
   plan-editor footer sub-clauses VERIFIED-OPEN-NOT-RECHECKED. 09/10 —
   "TBD room public" CLOSED (no literal under `src/routes/public`); CFP-edit
   intro/description binding — likely CLOSED via `submit-views.tsx:421-431`
   (DEC-976 wave-25 amendment), not independently re-read this task;
   remaining sub-clauses VERIFIED-OPEN-NOT-RECHECKED; "speakers toolbar
   right-cluster" moved to TIER 0 DISMISSED-VERIFIED-CLOSED (see above).

**CFP-16 — RECORDED DELIBERATE FORFEIT** (DEC-041): accepted speakers keep
editing past close per `docs/clarifications.md:39` + `SPEC.md:297-298`.
Joins ABS-14 as a deliberate forfeit (~0.5-1.1 composite ceded).

## TIER 2 — unverified, candidate for re-check

Archive: `docs/mandates/findings-archive-2026-08-15.md`. Highest-value
starting points: mailer implementation/MIME-construction status (gated on
an orchestrator prod deploy the swarm cannot itself trigger); design-fidelity
gap classes vs the vendored pack (settings edit-view anatomy, public
register widths, error-vocab states) — needs fresh measurement; the SKIP
LIST (AI-evaluation claims, nested per-round remodel, participant-level
custom fields, per-file share links + ZIP grouping dialog, separate CRM
analytics page, deadline extensions, contract/COI task kinds) — standing
negative constraint, costs nothing to keep honoring.

## Mobile / phone queue (carried forward, own lane, not re-measured this wave)

Desktop fidelity was priority; mobile deferred. Done items cited (STRUCTURAL,
listed in DISMISSED-VERIFIED-CLOSED above): phone-block-visibility override
assertion, N-aware clash caption, "place here anyway" path, Comms phone
landing, phone password fixed footer + Cancel, Home footer media rule.
Additional: Settings subscreens are URL state not path routes, DELIBERATE
(`app/src/pages/Settings.tsx:13-30`, DEC-728); Phone submissions triage
cards exist (`app/src/pages/submissions/submissions-phone-card.render.test.tsx`,
DEC-610).

**Deleted this wave (DEC-358 wave-37 amendment — false claim, re-verified
against the tree):** the prior "Still open/unverified: CFP 2-step wizard,
roster screen" line. Both exist and were verified present at this wave's
runtime: `src/routes/public/cfp-steps-script.tsx` (1.9 KB) plus
`src/routes/public/submit-views.tsx`'s `data-chq-cfp-step`/`.chq-cfp-steps`
markup (`:556-567`) implement the CFP 2-step wizard; `app/src/pages/speakers/
RosterPanel.tsx` (14 KB) plus its
`app/src/pages/speakers/RosterPanel.render.test.tsx` (9.7 KB) implement and
test the roster screen. Neither is a live gap; this was a stale claim
carried forward unre-verified, the same class of defect DEC-358's wave-35
amendment named for "does not exist" file claims — an existence claim
("still open/unverified") decays exactly the same way and needed re-globbing
before being carried, and on re-globbing was found false.

**Governing principle (affirmed, still binds):** mobile is additive
reflow — a mobile change must never move a desktop pixel (scan-lock).
Phone grammar (action bars, sheets, stacking, 44px targets) is a legitimate
translation of desktop affordances; a phone-only surface never lets
desktop be inferred from it.
