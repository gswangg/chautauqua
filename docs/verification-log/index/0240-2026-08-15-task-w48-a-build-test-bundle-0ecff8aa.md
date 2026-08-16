## 2026-08-15 task-w48-a — build+test+bundle @ 0ecff8aa

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Step 0 sync-then-measure: `git merge --no-edit main` in this worktree (cut
directly from `main` tip) reported "Already up to date." Eight
`task-w47-*` heads exist locally (`task-w47-a` `030c9170`, `task-w47-b`
`279a9744`, `task-w47-c` `699b1cc8`, `task-w47-d` `2e23a785`, `task-w47-e`
`96a18f73`, `task-w47-f` `3346d5ef`, `task-w47-g` `9a541796`, `task-w47-h`
`416d2eb5`); `git merge-base --is-ancestor <sha> HEAD` was run
individually for each (never a glob over `.git/refs/heads/*`, never the
`.git/packed-refs` `refs/heads/main` line, per the known STALE trap at
`42074604`). All eight were non-ancestor on every poll. The bounded poll
ran the full budget: 10 attempts of `git merge --no-edit main` (each
reporting "Already up to date."), ~30s apart, re-checking all eight refs
after every merge; all eight remained non-ancestor at the end of the
budget. Per instructions, proceeding without blocking: task-w47-a,
task-w47-b, task-w47-c, task-w47-d, task-w47-e, task-w47-f, task-w47-g,
task-w47-h are named as still non-ancestor when the budget was exhausted.

`npx tsx scripts/ref-state.ts` receipt (verbatim):

DEC-644 three-sha boundary: HEAD `0ecff8aa30939f9fcc741f68be2dfb19e9be58e4`;
newest first-parent product-code-bearing sha
`ae1ea6aee5e4e320936a0e7511fe1e4b43f34192`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w48-a`, `task-w48-b`,
`task-w48-c`, `task-w48-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
--is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w46-g`,
`task-w47-a`, `task-w47-b`, `task-w47-c`, `task-w47-d`, `task-w47-e`,
`task-w47-f`, `task-w47-g`, `task-w47-h`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
`task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
`task-w72-i`, `task-w72-j`.

MEASURED_SHA = `git rev-parse --short HEAD` = `0ecff8aa` (taken after the
last sync, before this commit).

`npm run build` (worker `tsc --noEmit`, app `tsc --noEmit -p
app/tsconfig.json`, then `vite build --config app/vite.config.ts`): clean,
no errors.

Full suite run inside the single lock acquisition per DEC-644 (`sh
scripts/with-test-lock.sh sh -c 'npm run build && npx vitest run && npm run
bundle:check'`, never nesting `npm test`/`test:full` inside the wrapper):

```
 Test Files  2 failed | 1107 passed (1109)
      Tests  2 failed | 12142 passed (12144)
```

2 failures, unrelated to each other. Because the wrapped command chain
uses `&&`, `npm run bundle:check` did NOT execute inside the sanctioned
lock acquisition (the chain aborted at the `vitest run` non-zero exit
code). `npm run bundle:check` was subsequently run standalone, outside the
lock, purely to obtain the informational bundle figure for this report:
`Entry bundle: index-DLJqKX_u.js + index-DpG2gFFa.css = 69.20 kB gzip
(budget 300.00 kB)` — `bundle:check PASSED` in isolation, but this number
is NOT part of the sanctioned single full-suite run since that run did not
reach the bundle step.

DEFECT FILED (owner: wave-49 lane, per DEC-453 — this frozen gate lane
does not fix, files only):

1. `test/decision-path-references.scan.test.ts:122` — failing test:
   "decision path references scan (DEC-518 wave-33 amendment) > every
   extracted path either exists on disk or its sentence carries an
   explicit historical marker". `decisions/DEC-818.md` references
   `migrations/0043_file_version_chain_unique.sql`, which does not exist
   on disk, and the referencing sentence ("RULING: the invariant to
   encode is the chain one, not the number one ... expressible as a
   partial unique index ... `CREATE UNIQUE INDEX
   file_previous_file_id_unique ON file(previous_file_id) WHERE
   previous_file_id IS NOT NULL`, in
   `migrations/0043_file_version_chain_unique.sql` (0042 is the current
   maximum; no other wave-47 lane writes a migration) with the matching
   drizzle `uniqueIndex` in `src/db/schema/content.") carries no
   historical marker (former/formerly/was at/superseded/deleted/renamed/
   moved to/replaced by). This is DEC-818's own prose describing planned
   wave-47 work; either the migration was never landed by its owning
   wave-47 lane (consistent with all eight `task-w47-*` refs still being
   non-ancestor of HEAD per Step 0 above), or DEC-818's sentence needs a
   historical marker if the plan changed. Fix belongs in whichever lands
   first: the migration file at `migrations/0043_file_version_chain_unique.sql`
   plus matching `uniqueIndex` in `src/db/schema/content.ts`, OR an
   amendment to `decisions/DEC-818.md` marking the reference historical.

2. `test/spec9-invariants.test.ts:131` — failing test: "SPEC §9 invariant:
   close-date lock (SPEC.md:297-298) > an ACCEPTED speaker keeps editing
   past close -- the recorded deliberate carve-out
   (src/domain/edit-lock.ts:22, DEC-041, docs/clarifications.md:39)".
   `expect(canEditSubmission("accepted", pastClose, now,
   "America/Los_A...")).toBe(...)` at line 131 got `true`, expected
   `false` — i.e. `canEditSubmission` in `src/domain/edit-lock.ts` is no
   longer honoring the documented DEC-041 carve-out that lets an accepted
   speaker keep editing past the close date; either `edit-lock.ts` was
   changed without updating this test, or the test's expectation was
   written before a since-landed change and is now stale relative to
   `src/domain/edit-lock.ts:22`. Fix belongs in whichever of
   `src/domain/edit-lock.ts` or `test/spec9-invariants.test.ts:131` is out
   of sync with the DEC-041 carve-out as documented at
   `docs/clarifications.md:39`.

RESULT: FAIL — 2/12144 tests failed (test/decision-path-references.scan.test.ts:122
and test/spec9-invariants.test.ts:131, both filed above, owner: wave-49
lane); build was clean; bundle check did not run inside the sanctioned
lock acquisition because the `&&` chain aborted at the test failure (a
standalone out-of-lock bundle:check run afterward measured 69.20 kB gzip
vs the 300 kB budget, informational only); at 0ecff8aa, all eight live
task-w47-* refs remained NON-ancestor after the full 10-attempt bounded
poll (named above), proceeding per instructions without blocking.
OPEN ITEMS: 2
