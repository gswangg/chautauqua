# Eval findings — rebased 2026-08-15 (wave 48, task-w48-e)

Verified against `main` sha `243b3094dcc4dd9125dc01f9cec01dc396251e89`
("merge task-w47-e"), derived AT THIS TASK'S OWN RUNTIME (DEC-069
wave-17/wave-37 amendments) by running, in order: `git merge --no-edit
main` (worktree cut directly from `main`'s tip — reported "Already up to
date", no new commits pulled); `git for-each-ref --format='%(objectname)
%(refname:short)' refs/heads` (36 live branches) plus `git merge-base
--is-ancestor <ref> main` for every one, run individually (not trusted
from `ref-state` alone); and `npx tsx scripts/ref-state.ts` for the
cross-check. **Both traps reconfirmed, still live:** (1)
`.git/packed-refs` (read from the main checkout,
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua/.git/packed-refs`)
carries a STALE `refs/heads/main` entry at
`4207460470b672176e119ed3502d08d869489509` (the wave-44 boundary) — the
loose ref (`.git/refs/heads/main`, `243b3094`) overrides it and is the one
`git rev-parse main` actually returns; do not read the packed line as
current. (2) globbing `.git/refs/heads/*` on disk misses packed refs
entirely — use `git for-each-ref`. `ref-state`'s receipt, verbatim: DEC-644
three-sha boundary — HEAD `243b3094dcc4dd9125dc01f9cec01dc396251e89`;
newest first-parent product-code-bearing sha
`243b3094dcc4dd9125dc01f9cec01dc396251e89`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w46-g`, `task-w47-b`,
`task-w47-c`, `task-w47-d`, `task-w47-e`, `task-w47-f`, `task-w48-b`,
`task-w48-d`, `task-w48-e`, `task-w48-f`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
merge-base --is-ancestor`; NON-ancestor refs (IN FLIGHT this wave, or
unmerged from an earlier/later campaign): `mail-rich-shape-fallback`,
`task-w17-i`, `task-w47-a`, `task-w47-g`, `task-w47-h`, `task-w48-a`,
`task-w48-c`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
`task-w72-a` through `task-w72-j`. Individually re-run `git merge-base
--is-ancestor` per ref confirms the same split — see IN FLIGHT below for
what each non-ancestor wave-47/48 ref actually contains at this runtime
(inspected directly via `git show <ref>:<path>`/`git log -1`, not
inferred). No `task-w48-g` or `task-w48-h` ref exists yet at this runtime
(`git for-each-ref refs/heads` has no match for either name) — their
sections are not yet in `docs/verification-log/index/` either (`ls
docs/verification-log/index/ | grep -E 'w48-g|w48-h'` = zero matches).

COMPACTION per DEC-358's rebase rule: the wave-44 header (boundary
`6edb5263`) is REPLACED by this one, not prepended — the prior header
predates waves 45, 46 and 47 entirely and named none of wave 45's seven
CONFIRMED-DEFECT rows or wave 46/47's landed fixes for them. No per-item
citation below is deleted, only re-homed/compacted — dismissals are
recorded, never deleted. Every "file X exists / does not exist" claim
carried from the prior header was re-globbed before being carried; all
re-confirmed true this wave EXCEPT one duplicate found and removed (see
below): `docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md`,
`src/db/schema/embed.ts`, `src/routes/public/saved-embed.tsx` (saved
embeds), `app/src/pages/submissions/submissions-phone-card.render.test.tsx`
(phone triage cards), `src/routes/public/cfp-steps-script.tsx` and
`app/src/pages/speakers/RosterPanel.tsx` + `RosterPanel.render.test.tsx`
(CFP 2-step wizard, roster screen), `docs/mandates/
w41-falsifiability-batch-a.md` and `-batch-b.md`, `package.json` (`deploy`
script, now at `:26` not `:21` — line drifted, claim itself still true),
`app/src/pages/settings/settings.css:17-22`, `app/src/pages/agenda/
PhoneAgenda.tsx` (clash caption `:186`, "Place here anyway" `:167-176`),
`src/routes/auth.css.ts:318-336`, `src/routes/public/home.css.ts:72-76`,
and every batch-B remainder file:line (`src/server/repo/form-roles.ts:16`,
`src/routes/review/reviewer.ts:288`, `src/server/repo/files-authz.ts:185-209`,
`app/src/components/error-states.css:31`, `src/server/repo/events.ts:224-259`,
`src/server/repo/import/sessionboard.ts:620-627`,
`src/routes/comms/send.ts:125-138`) — all re-confirmed present, exact line
numbers may drift a few lines but every cited symbol/pattern is still at
the claimed location. **DUPLICATE FOUND AND REMOVED:** the batch-A
remainder list (former lines ~544-554) still carried "Home footer media
rule — `src/routes/public/home.css.ts:72-76`" as UNFALSIFIABLE, but wave
46's own discharge paragraph two lines above it already lists this exact
item as CONFIRMED TRUE with a named falsifying check
(`test/tier0-falsifiability-w46.test.ts`) — the remainder list was never
updated when the discharge landed. Removed from the remainder below; not a
new finding, a stale-carry bug in the doc itself (same decay class as
DEC-358's wave-35 "absence is a measurement" rule, applied to a presence
this time).

**This wave's own addition (folded in from the `6edb5263`..`243b3094`
range):** wave 46's five instrument/authz fixes and wave 47's five landed
product fixes are now MERGED ancestors of `main` — see the new "Landed
since the wave-44 boundary" subsection under TIER 0. `task-w46-g`
(`74d682d3`, DEC-020 upload-vocabulary scan-lock) is also confirmed a
MERGED ancestor of `main` this wave, via `git log --ancestry-path
74d682d3..main` showing `merge task-w46-g` (`185fa8d7`) landed before the
wave-47 merges — see the note under "Landed since the wave-44 boundary"
correcting DEC-358's wave-48 amendment, which was written from a stale
reading before that merge. Wave 48's own gate lanes are still IN FLIGHT or
not yet started as this rebase writes (see IN FLIGHT); the standing
open-items COUNT and verdict belong to `task-w48-g`'s triage-closure
section and `task-w48-h`'s stage-1 exit-ledger section — neither exists
yet in `docs/verification-log/index/` at this runtime (confirmed absent
above), so this file cites those lanes BY TASK ID and does not restate,
predict, or fabricate a filename for their count (ownership boundary for
this task, item 7 of the delegating brief).

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

### Landed since the wave-41 boundary (`b71a1358`..`6edb5263`), carried, re-verified present

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

  **STILL UNFALSIFIABLE (batch A remainder, the four items above now
  discharged — see wave-46 entry) — re-homed wave 48 (DEC-358 wave-46
  amendment: an owner line names a BRANCH, not a wave; no wave-47 branch
  ever covered this list, so per that rule it returned to UNOWNED at the
  close of wave 47 and stays that way here — not silently re-pointed at
  "wave-49" without a real branch to name):**
  `npm run deploy` exists —
  `package.json:26` (drifted from `:21`, re-globbed this wave). Settings
  edit-view field widths are tokens —
  `app/src/pages/settings/settings.css:17-22` (DEC-896).
  Phone agenda N-aware clash caption —
  `app/src/pages/agenda/PhoneAgenda.tsx:186`. Phone agenda "Place here
  anyway" — `:167-176,199-208`. Phone password fixed footer + Cancel —
  `src/routes/auth.css.ts:318-336`. **DUPLICATE REMOVED this wave:** "Home
  footer media rule — `src/routes/public/home.css.ts:72-76`" was carried
  here despite wave 46's own paragraph two blocks above already discharging
  this exact item as CONFIRMED TRUE with `test/tier0-falsifiability-w46.test.ts`
  — the remainder list was never pruned when the discharge landed. It does
  not belong in either an owned-or-unowned UNFALSIFIABLE list; it is
  CLOSED, see the wave-46 discharge paragraph above. UNOWNED, no branch
  claims this list — the next lane that picks it up should open the
  remaining four items directly rather than re-deriving this note.
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
re-homed wave 48: UNOWNED (DEC-358 wave-46 amendment, an owner line names
a BRANCH, not a wave — no wave-47 branch ref exists that touches any file
in this list, confirmed against this wave's own `git for-each-ref`
reading, so the prior "wave-47+ lane, branch to be named" line decayed the
moment wave 47 closed without claiming it; not silently re-pointed at
"wave-49" without a real branch):** all file:line targets re-globbed this
wave and re-confirmed present (see the compaction paragraph above) —
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

Ref-measured at THIS task's own runtime against `243b3094` (36 refs total;
`git for-each-ref --format='%(objectname) %(refname:short)' refs/heads` +
`git merge-base --is-ancestor <ref> main` run individually for every ref +
`npx tsx scripts/ref-state.ts` as a cross-check — all three agree):

- **NO `task-w30-*` through `task-w46-*` named branch is live except
  `task-w46-g`** — confirmed via `git for-each-ref refs/heads`; `task-w46-g`
  (`74d682d3`, DEC-020 upload-vocabulary scan-lock) IS an ancestor of `main`
  (merged, folded into TIER 0 above — see the correction note there). No
  other wave-30-through-46 named branch exists as a live ref today. Do not
  re-file any of those waves' scope on the strength of an old "OWNED BY"
  line (DEC-069 wave-17 amendment).
- **Wave-41/42/43/44/45/46 lanes are all either MERGED (folded into TIER 0
  above) or have no surviving branch ref** — same pattern as the prior
  bullet, re-confirmed this wave; not re-derived line-by-line here (would
  duplicate the wave-44/wave-46/wave-47 rebases' own work, which this
  header already supersedes per the compaction rule).
- **`task-w47-a`** (`030c9170`, "DEC-023: claim-before-send for task
  reminders, closes CONFIRMED-DEFECT #1, `0232`") — real commit, NOT an
  ancestor of `main` at this HEAD. `src/server/repo/tasks/reminders.ts:361`
  — `sendReminderEmails` now claims (`RETURNING` ids) a group's assignment
  ids in a conditional chunked UPDATE BEFORE mailing, deleting the old
  post-loop stamp UPDATE, so two overlapping cron ticks can no longer both
  pass `isReminderDue` and both send, and a crash between the loop and the
  old stamp write can no longer re-send the whole batch on retry. Not
  independently re-read for correctness by this task (out of write scope,
  docs-only) — filed here so the fix is not silently dropped, not
  adjudicated as CLOSED.
- **`task-w47-g`** (`9a541796`, "File version mint gets its unique-index
  contract, DEC-818 amendment") — real commit, NOT an ancestor of `main` at
  this HEAD. `migrations/0043_file_version_chain_unique.sql` replaces the
  non-unique `file_previous_file_id_idx` with a UNIQUE index on
  `previous_file_id`, encoding "at most one row may name a given
  predecessor" as a DB constraint rather than a JS-computed `versionNo` —
  closes the CONFIRMED-DEFECT filed by `0235` claim 2 (concurrent
  re-uploads onto the same chain head could both mint the same version
  number). Not independently re-read for correctness by this task (docs
  only) — filed, not adjudicated.
- **`task-w47-h`** (`416d2eb5`, "Scribe wave 47: rebase eval-findings, file
  wave-45's 7-item defect ledger") — real commit, NOT an ancestor of
  `main` at this HEAD. This is a PRIOR rebase of `docs/eval-findings.md`
  itself (the same lane this task performs), done at wave 47's own runtime
  against a boundary that has since moved (wave 47's own five product fixes
  b/c/d/e/f have since merged, described above). Its content is SUPERSEDED
  by this wave-48 rebase, which was derived fresh from `main` at
  `243b3094`, not read from `task-w47-h`'s body. Do not merge
  `task-w47-h`'s copy of this file over this one; if it is ever merged, its
  version of `docs/eval-findings.md` conflicts with this commit and the
  conflict resolves to THIS file (the newer measured tree), per DEC-099's
  "last appended is not newest, rank by newest measured tree" rule.
- **`task-w48-a`** (`ea772bc8`, "build+test+bundle gate @ `0ecff8aa`, 2 test
  failures filed, owner wave-49") — real commit, NOT an ancestor of `main`
  at this HEAD. Filed here for completeness; not independently re-read
  (docs-only, out of write scope) — the two failures and their wave-49
  ownership are that lane's own claim, not re-verified or re-counted by
  this file.
- **`task-w48-c`** (`2330f7cd`, "verification-log: task-w48-c perf-smoke
  gate @ `0ecff8aa` (`0242`)") — real commit, NOT an ancestor of `main` at
  this HEAD. Three `perf:smoke` runs, 117/117 check-rows PASS, 0 FAIL,
  including the historically marginal rows (reviewer queue, plan progress
  page 1, plan results page 1, files library page 1, onboarding grid,
  three portal rows) named in TIER 0's OWNED perf section above — that
  section's per-row ownership notes are NOT rewritten by this task
  (docs-only, ownership boundary), but a future rebase should read `0242`
  directly rather than this summary.
- **`task-w48-b`, `task-w48-d`** — tip equals `main`'s HEAD exactly (zero
  commits of their own as of this reading). RUNNING or not yet started;
  not dead by DEC-069's wave-37 amendment (a same-wave branch at its base
  may still be working).
- **`task-w48-f`** — no ref found: `git for-each-ref refs/heads` has no
  `task-w48-f` entry at this runtime (the field guide names it as the
  assembler lane; may not have created its branch yet, or already merged —
  `git log --ancestry-path` was not run for a non-existent ref). Flagged,
  not triaged.
- **`task-w48-g`, `task-w48-h`** — no ref exists yet at this runtime (see
  header). These own the wave-48 triage-closure and stage-1 exit-ledger
  respectively, per this task's own delegating brief; cited by task id
  only, per the ownership-boundary rule above.
- **`task-w48-e`** — this task itself (the eval-findings rebase you are

### Wave-45 adjudication ledger — 7 CONFIRMED-DEFECT rows, omitted by the stale wave-44 header, now filed

Wave 45 ran six FILE-NEVER-FIX adjudication-only lanes
(`docs/verification-log/index/0230`-`0237`, all sha `8c194ec9`/`8b65b63a`,
all `QUALIFYING`, all confirmed ancestors of `main` this wave — MERGED).
Between them they filed seven CONFIRMED-DEFECT rows. None of the seven
appear above this paragraph in this file because the header this rebase
replaces was pinned at `6edb5263`, predating wave 45. Each is now IN
FLIGHT this wave under the wave-47 branch named in its own task mandate —
**do not claim any of the seven closed; this rebase runs concurrently with
the lanes fixing them, it does not adjudicate or fix their scope itself:**

1. **Cron reminder send-then-stamp race** (owner: `task-w47-a`,
   "reminders") — `0232` (task-w45-c), CONFIRMED-DEFECT:
   `src/server/repo/tasks/reminders.ts:416-459` (`sendReminderEmails`)
   sends mail in a loop THEN writes the `lastRemindedAt` dedupe stamp
   afterward in a separate chunked UPDATE; no claim-before-send, no
   per-(assignment,day) unique constraint. An overlapping/retried cron
   tick can duplicate a send. Fix direction: claim-before-send (conditional
   UPDATE or a per-(assignment,day) unique ledger row with
   `onConflictDoNothing`).
2. **Portal read doors scoped in JS, not SQL** (owner: `task-w47-b`,
   "portal doors") — `0232` (task-w45-c), CONFIRMED-DEFECT:
   `getPortalSubmissionDetail` (`src/server/repo/portal/data.ts:208-273`)
   and `getResourceDownloadScope`
   (`src/server/repo/portal/resources.ts:117-152`) each run their
   content-bearing `SELECT` unscoped by `contactId`, then filter ownership
   afterward in JS. `listDeliverableCandidates`
   (`src/server/repo/portal/tasks.ts:227-232`, DEC-962-audited) is the
   counter-example both should converge on.
3. **Auto-schedule J9 fail-loud invariant, concurrent-write race** (owner:
   `task-w47-c`, "auto-schedule") — `0233` (task-w45-d), CONFIRMED-DEFECT:
   `src/server/repo/agenda/auto-schedule.ts:193-198`'s fail-loud accounting
   invariant is reachable under a concurrent-write race
   (`auto-schedule.ts:54,64-68,89,107,119-125,143-148,158,177-198`;
   `payload.ts:59-87`; `schedule.ts:406-416`; `slots.ts:45-79`;
   `routes/agenda.ts:93`). A new gap, not a re-file of the prior
   wave-42/43 `autoSchedule320` defect (0213/0215) — that one is already
   fixed (`auto-schedule.ts` now splits `slotted` by
   `isDayWithinEventRange` exactly as 0213 prescribed).
4. **CSV import duplicate-destination column mapping accepted silently**
   (owner: `task-w47-d`, "import mapping") — `0234` (task-w45-e),
   CONFIRMED-DEFECT: `src/domain/contacts-parts/import.ts:44-101` refuses
   nothing when two source columns map to the same destination field —
   silent last-write-wins.
5. **Merge preview/execute preflight parity** (owner: `task-w47-e`, "merge
   preview") — `0234` (task-w45-e), CONFIRMED-DEFECT:
   `src/routes/api/contacts/merge.ts:41-73` — preview never runs
   `planMergeFold`/`detectMergeConflicts`, so preview and execute can
   disagree.
6. **Per-contact history `events` unbounded** (owner: `task-w47-f`,
   "history events") — `0234` (task-w45-e), CONFIRMED-DEFECT:
   `src/server/repo/contacts/history.ts:119-126` — the `events` list is an
   unbounded `selectDistinct`, no limit/total, unlike the submissions/
   talks/emails lists in the same claim.
7. **File version-mint race** (owner: `task-w47-g`, "file version index")
   — `0235` (task-w45-h), CONFIRMED-DEFECT:
   `src/server/repo/files-versions.ts:477-511` (`insertFile`) is a plain
   read-then-write (SELECT predecessor `versionNo`, compute `+1` in JS,
   separate `db.insert`, no transaction); `src/db/schema/content.ts:47-80`
   has no `uniqueIndex` backstop on `file` that would refuse two
   concurrent re-uploads both minting version N. MINTING IS IO; atomic SQL
   beats read-then-write; a uniqueIndex is a CONTRACT (house rule).

Also filed by wave 45, **not one of the seven CONFIRMED-DEFECT rows** and
**not assigned a wave-47 owner branch** (no lane in this wave's roster
claims it) — `0236` (task-w45-f)'s blast-radius finding: independent
verification found 24 files non-conforming to DEC-068's header contract,
not the 7 the task named; 17 are mechanically repairable (sha derivable
from filename), 15 (`0140`-`0157`, pre-dating DEC-068's wave-37
introduction) carry no sha anywhere and need a DEC ruling (grandfather vs.
backfill) before repair. Filed as `Owner TBD, wave-46+` at `0236`'s own
writing; still TBD at this wave's re-glob (no live branch this wave or
last claims it). UNOWNED, carry forward.

`0230` (task-w45-a, review-integrity) and `0231` (task-w45-b,
comms-integrity) filed **zero** CONFIRMED-DEFECT rows each (four J4 claims
NOT-CONFIRMED with one named verification gap for review-integrity; four
J5 claims NOT-CONFIRMED/DELIBERATE-BY-DESIGN for comms-integrity) — do not
re-file either as owed a wave-47 lane; they closed clean. `0237`
(task-w45-g, slot-claim instrument repair) fixed two DEC-069
slot-claim-classifier defects directly (no product code) and is MERGED;
not re-filed here.
  reading).
- **`task-w46-a` through `-f`** — tips equal `main`'s HEAD, ancestors,
  folded into history (their wave-46 scope, if any remained open, is not
  re-derived by this docs-only lane).
- **`task-w46-g`** — real commit, NOT an ancestor of `main` at this HEAD;
  genuinely unmerged, belongs to wave 46's own campaign, not re-derived by
  this docs-only lane.
- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged across many
  waves, but its NAMED SCOPE ("Sign-in page names the event and its open
  CFP", DEC-716) is now CLOSED-SUPERSEDED — see the DISMISSED
  review-lens/instrument alarms entry above (`loadSingleEventContext`
  landed via a different lane). The literal branch ref stays unmerged and
  stale; do not resurrect it or re-file its scope.
- **Every other live ref** — `mail-rich-shape-fallback`, `manual-qa`,
  `task-custodian-w68-4`, `task-w68-b/c/d/e`, `task-w71-a/c/d/e`,
  `task-w72-a`-`j` — this wave's own `ref-state` run confirms `manual-qa`,
  `task-custodian-w68-4`, `task-w68-d`, `task-w71-c/d/e` ARE ancestors of
  `main` (their content already folded into history; stale live refs, not
  owned scope), while `mail-rich-shape-fallback`, `task-w68-b/c/e`,
  `task-w71-a`, `task-w72-a`-`j` are NOT ancestors — genuinely unmerged,
  but belong to waves numbered ahead of wave 48 (68/71/72), a
  different/later campaign. Flagged, not triaged.

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
