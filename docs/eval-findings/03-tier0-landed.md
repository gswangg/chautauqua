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

