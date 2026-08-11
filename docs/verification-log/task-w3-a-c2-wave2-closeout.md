# task-w3-a - wave-2 closeout @ f3d0140

Per DEC-259 (log filename carries the mandatory `-c2-` infix) and DEC-261
(wave-3 disposes wave-2 open items; wave-4 re-runs the eight DEC-256
sections fresh). This log reads every campaign-2 wave-2 log present on
`main` as of this task's worktree base `f3d0140f3826c7419262358fef376f8cff374e0c`,
dispositions every open item / FAIL, and independently verifies the
migrations-numbering gap the DEC-256 battery never checks.

## Source logs read

`docs/verification-log/task-w2-*.md` on `main`. Per DEC-129 (homonym guard =
full heading including `@ <sha>`), `task-w2-d-interim-gate.md` and
`task-w2-e-findings-closure.md` were checked and confirmed to be
campaign-1 homonyms: neither file contains a `FROZEN SHA:` line (grep
returned nothing for either), consistent with them predating the DEC-256
freeze-derivation protocol. They are excluded from this closeout per the
task's explicit instruction.

The four files that do contain a `FROZEN SHA:` line are the campaign-2
wave-2 logs:

| section | file | FROZEN SHA | OPEN ITEMS | RESULT |
|---|---|---|---|---|
| a (build+test) | task-w2-a-build-test.md | `e330aef6a55af64f73705a6f3ec9e5a614706046` (re-derived at end of lane: `1e08bc84e70c30419910d716335febeb9808b2dc` — DRIFT) | 2 | FAIL |
| b (walkthrough) | task-w2-b-walkthrough.md | `1e08bc84e70c30419910d716335febeb9808b2dc` | 0 | PASS |
| c (perf-smoke) | task-w2-c-perf-smoke.md | `1e08bc84e70c30419910d716335febeb9808b2dc` | 0 | PASS |
| d (render-sweep + DEC-253 mobile) | task-w2-d-render-sweep.md | `e002bc9982c31f2e681435036c7f41e33dd6a51e` | 0 | PASS |
| e (spec/clarifications audit) | absent | — | — | — |
| f (wave-1 triage closure) | absent | — | — | — |
| g (DEC-257 fresh-clone bootstrap) | absent | — | — | — |
| h (116 rubric ids -> file:line) | absent | — | — | — |

Four of eight DEC-256 sections have a wave-2 log on `main`; sections e, f,
g, h never landed a wave-2 log. Of the four present, three sections (b, c,
d) independently derived and re-derived S with no drift, but they landed
at **two different FROZEN SHAs** (`1e08bc84e7...` for b/c, `e002bc998...`
for d) because each lane derived S at whatever moment its own freeze
check ran while `main` was still receiving wave-1 merges — DEC-256's
"newest first-parent commit outside the allow-list" is time-dependent
while wave-1 lanes are still landing, so sequential wave-2 lanes racing
against a moving `main` will legitimately land on different S values even
though each one's own drift check passes. Section a additionally recorded
its own S (`e330aef...`) as having drifted to `1e08bc8...` by the time its
own re-derivation ran, and self-reported FAIL per the DEC-256 protocol
rule ("if it moved, record DRIFT, OPEN ITEMS >= 1, RESULT: FAIL").

## Disposition of every open item / FAIL

1. **task-w2-a OPEN ITEM 1** (S drifted from `de2da75d...`'s child
   `e330aef...` to `1e08bc84e7...` mid-gate, RESULT: FAIL) — **OPEN**.
   This is exactly the race condition described above: wave-1 lanes
   (`task-w1-h`) were still merging into `main` while wave-2 section a ran.
   DEC-256 has no rule for reconciling per-lane S values that differ only
   because of legitimate concurrent wave-1 landings after the "all
   task-w1-* ancestors" gate is satisfied once but a later branch merges
   after. Re-running section a fresh (which is what DEC-261 wave-4
   mandates for all eight sections) is the correct remedy, not a product
   fix — there is no file:line to patch. Flagging for the wave-4 planner:
   consider tightening DEC-256 to require polling for wave-1 ancestor
   quiescence for e.g. 2 full minutes with no new merges (not just a
   single ancestor check) before deriving S, to reduce the chance of a
   section drifting mid-run. This task cannot mint that rule (would
   require a new DEC), so it stays OPEN.
2. **task-w2-a OPEN ITEM 2** (wave-1 baseline doc task-w1-a-origin-
   walkthrough.md claims 185 files/1584 tests at `c663cf2`, but task-w2-a's
   fresh checkout of the same commit measured 184 files/1573 tests) —
   **OPEN**. This is a discrepancy in a historical wave-1 document, not in
   product code; task-w2-a's own delta arithmetic reconciled exactly
   against its freshly-measured number, so it did not affect any PASS/FAIL
   determination. There is no product file to fix and no existing DEC
   that speaks to reconciling historical baseline-count typos in old
   verification logs, so this is OPEN for whoever next touches
   `task-w1-a-origin-walkthrough.md` or the eval-findings closure process
   (this task's owned-file list per DEC-259 does not include that file,
   and the instruction to keep this diff minimal/surgical argues against
   rewriting a wave-1 historical log to "correct" it).
3. **Sections e, f, g, h absent from wave-2** — **OPEN** (x4, one per
   missing section). No wave-2 log exists for the spec/clarifications
   audit, wave-1 triage closure, DEC-257 fresh-clone bootstrap, or the
   116-rubric-id mapping. DEC-261 already assigns the remedy: "w4 re-runs
   DEC-256's 8 sections unchanged" — these four sections simply need to
   run in wave-4, they are not a wave-3 product-code fix. Recorded as
   OPEN rather than CLOSED/WAIVED because DEC-261 requires the sections to
   actually execute and produce a log, which is out of this task's scope
   (a single build/test/migration-verification task, not a battery lane).
4. **FROZEN-SHA non-uniformity across b/c/d (two different SHAs, not one
   identical SHA across all present sections)** — **OPEN**. Root-caused
   above (legitimate wave-1-landing race, not a bug in any single
   section's own derivation/re-derivation, each of which is internally
   consistent and drift-free). No product file to fix; remedy is wave-4
   re-running all eight sections back-to-back against a single S once
   wave-1/wave-2/wave-3 lanes have all landed, per DEC-261.

No item is CLOSED in this pass: every open item/FAIL above is either a
cross-lane timing artifact of the DEC-256 protocol (needing a wave-4
re-run, already mandated by DEC-261) or a discrepancy in a historical
document outside this task's owned-file scope — none of them is a
reproducible product-code bug with a file:line fix and a regression test
to write. No WAIVE citation applies to any of them either (no existing DEC
says "ignore cross-lane S drift" or "ignore historical baseline
mismatches"), so all five items are left OPEN rather than force-closed or
mis-waived.

## Migrations-numbering-gap verification (battery never checks this)

`migrations/` contains 14 `.sql` files (`0000` through `0014`, with `0011`
absent — confirmed by directory listing). Wave-1 logs referencing "15
migrations applied" predate the current file set; the true count today is
14 applied migration files, matching what `wrangler d1 migrations apply`
itself reports.

Fresh-state verification performed in this task's worktree:

```
rm -rf .wrangler
npm ci --prefer-offline --no-audit --no-fund --silent
npm run db:migrate
npm run seed
```

`npm run db:migrate` output: all 14 files (`0000_secret_matthew_murdock.sql`
… `0014_task_deliverable_kind.sql`, no `0011`) show `✅`, "2 commands
executed successfully" (the second `d1 migrations apply` invocation
inside the script re-runs and reports all 14 already-applied, confirming
idempotency). `npm run seed` completed clean: `seed-r2: put 8 object(s)
into local R2 bucket 'chautauqua-files'` (matches the wave-2 baseline
count from task-w2-b and task-w2-c).

**Real applied count: 14 migrations** (`0000`-`0014` inclusive, `0011`
never existed as a file). This matches the file count exactly — nothing
is silently skipped or double-applied.

Checked whether `src/db/schema.ts` (31 `sqliteTable(...)` definitions) has
any table/column not covered by an applied migration, using
`npx drizzle-kit generate` as a diff tool. It produced a spurious
`0014_lumpy_spyke.sql` file re-declaring six tables (`api_token`,
`pipeline_activity`, `pipeline_entry`, `saved_view`, `segment`,
`submission_revision`) and three columns
(`evaluation_plan.current_round`, `evaluation_plan.round_criteria_json`,
`task.deliverable_kind`) that **already exist** — every one of those is
already created by an existing, applied migration file (`0004`-`0014`).
Root cause: `migrations/meta/` only has drizzle-kit snapshot files for
`0000`-`0004` (`0000_snapshot.json` … `0004_snapshot.json`); migrations
`0005` onward were hand-authored (per DEC-017/DEC-025/DEC-087/DEC-164,
several wave-3/4 migrations were manually renumbered to resolve filename
collisions) without regenerating their companion snapshot/journal
entries. `drizzle-kit generate` therefore diffs `schema.ts` against the
stale `0004` snapshot and reports everything added since as "new," even
though it is already applied. This is a **drizzle-kit tooling artifact**,
not a real missing-migration bug: `db:migrate` (which reads the
migrations directory + D1's own applied-migrations tracking table
directly, not the drizzle-kit meta/snapshot chain) confirms all 14 files
are applied and nothing is missing. The spurious generated file
(`migrations/0014_lumpy_spyke.sql` and its companion
`migrations/meta/0014_snapshot.json`, which also collided with the
existing real `0014_task_deliverable_kind.sql`) was deleted and
`migrations/meta/_journal.json` reverted; nothing from this diff-check
was committed.

**Disposition:** the `0011` numbering gap itself is **WAIVED** — DEC-164
explicitly states "migration filename collisions renumber to the next
free prefix preserving relative order (the 0011 gap is fine)". The
`drizzle-kit generate` snapshot-staleness (meta/ chain stuck at 0004) is
recorded as an **OPEN** item: it means `npm run db:generate` cannot be
trusted to detect real future schema drift for any table/column
introduced by migrations 0005-0014 without first regenerating the
missing snapshots, or without maintainers manually reconciling
`migrations/meta/`. No file:line product fix applies (this is a
generator-tool/metadata gap, not application code), and no existing DEC
addresses regenerating drizzle-kit snapshots retroactively, so it is left
open for a planner decision on whether to regenerate the full snapshot
chain.

## Build + test (this task's own verification)

`npm run build`: `tsc --noEmit` (root) + `tsc --noEmit -p app/tsconfig.json`
+ `vite build --config app/vite.config.ts` all clean, 0 errors, 19 output
chunks emitted.

`npm test` (`npx vitest run`): **187 test files passed (187), 1612 tests
passed (1612)**, 0 failures.

## Exit-predicate verdict

Are all eight DEC-256 sections present, PASS, OPEN ITEMS: 0, at one
identical FROZEN SHA? **No.** Only 4 of 8 sections have a wave-2 log on
`main` (b, c, d present and PASS with 0 open items each; a present but
FAIL/DRIFT with 2 open items; e, f, g, h never landed). Even among the
three PASS sections, they span two different FROZEN SHAs
(`1e08bc84e7...` for b/c, `e002bc998...` for d), not one identical SHA.
Per DEC-261, closing this gap is wave-4's job (re-run all eight sections
fresh, unchanged, against one S); this wave-3 task's job was to
disposition wave-2's open items and FAILs, which is done above (0 CLOSED,
1 WAIVED, 8 OPEN: 2 from task-w2-a, 4 missing sections, 1 SHA-
non-uniformity, 1 drizzle-kit snapshot staleness).

OPEN ITEMS: 8
RESULT: FAIL - wave-2 did not achieve the DEC-256 exit predicate (8/8
sections present, PASS, OPEN ITEMS: 0, one identical FROZEN SHA); this
closeout task itself is green (build clean, 1612/1612 tests passing, 14
migrations verified applied from a clean state with no coverage gap in
`src/db/schema.ts` beyond the DEC-164-waived `0011` filename gap), but
none of wave-2's own outstanding items were product-code-fixable in this
task's scope, so 8 remain OPEN for wave-4 (DEC-261 section re-runs) and
the planner (SHA-uniformity-under-concurrent-landing protocol question,
drizzle-kit snapshot staleness).
