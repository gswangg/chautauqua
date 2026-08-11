# task-w8-a - build+test @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d
OPEN ITEMS: 0
RESULT: PASS

## Protocol

- Scratch worktree: `git -C .../chautauqua worktree add --detach /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-scratch/w8-a-battery 80b811d250285de0d37417ddc12f65445ce27f96` — all checks below ran inside that worktree.
- `git -C .../chautauqua merge-base --is-ancestor 80b811d250285de0d37417ddc12f65445ce27f96 refs/heads/main` → succeeded (ANCESTOR_OK).
- Environment: node v24.1.0, npm 11.3.0.
- Lockfile present (`package-lock.json`); used `npm ci` (no fallback needed).

## Commands run (in order, at FROZEN SHA)

1. `npm ci --prefer-offline --no-audit --no-fund`
   - Exit 0. Wall time: 2.4s (`added 423 packages in 2s`).
2. `npm run build` (= `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`)
   - Exit 0. Wall time: 6s.
   - No type errors from either `tsc --noEmit` pass. Vite build produced 19 chunks, largest `index-O4Fjbd2D.js` 180.16 kB raw / 58.90 kB gzip, built in 609ms.
3. `npm test` (= `vitest run`, includes both `test/` and `app/src/**/*.test.*`)
   - Exit 0. Wall time: 19.70s (vitest-reported duration).
   - Totals: **Test Files 199 passed (199)**, **Tests 1690 passed (1690)**, 0 failed, 0 skipped.
   - Only stderr output was expected React Router v7 future-flag deprecation warnings (non-fatal, not test failures).
4. `npm run bundle:check` (= `tsx scripts/bundle-check.ts`, SPEC §7 budget)
   - Exit 0. Wall time: <1s.
   - Entry bundle (index JS + CSS) = 58.87 kB gzip vs budget 300.00 kB gzip → well under budget.
   - Output: `bundle:check PASSED`.

No port was taken; no server was started.

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty delta. Per DEC-280 this is not a failure/stop condition. Re-checked below.

## RECHECK (at 50354380d299969b12d0b46548cb77d28e861c9d)

Second scratch worktree: `git -C .../chautauqua worktree add --detach /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-scratch/w8-a-recheck 50354380d299969b12d0b46548cb77d28e861c9d`.

The delta touches `src/server/repo/{contacts,tasks,pipeline}.ts`, which feeds directly into this section's own build+test claims (build/test are not scoped to individual files, so both were rerun in full at RECHECK SHA):

- `npm ci` → exit 0.
- `npm run build` → exit 0, wall time 6s. No new type errors.
- `npm test` → exit 0, wall time 16.17s. **Test Files 201 passed (201)**, **Tests 1703 passed (1703)**, 0 failed, 0 skipped (file/test counts grew vs FROZEN SHA because the merged task-w7-a branch added test coverage alongside its fixes).

Result: build and test claims hold at RECHECK SHA — still PASS, no regressions introduced by the delta. `bundle:check` was not rerun at RECHECK SHA since none of the delta commits touch `app/` or bundling; the FROZEN-SHA bundle result stands.

## KNOWN IN-FLIGHT AT S

Per DEC-285, at FROZEN SHA the following were open:

1. `src/server/repo/contacts.ts:192/207` (`buildMergeRepointOps`) repointed only six contact FK tables (`participant`, `task_assignment`, `email_log`, `user`, `file`, `file_comment`), omitting `pipeline_entry`, causing `src/server/repo/pipeline.ts:161` to throw org-wide after a merge left a dangling `pipeline_entry.contact_id`. Confirmed present at FROZEN SHA (verified via `sed`/`grep` inside the FROZEN-SHA worktree before re-checking).
2. `src/server/repo/tasks.ts:263` `listAcceptedContactIds` had no active-participant filter.

Both are fixed in the POST-S DELTA (commits `50a2947` DEC-282 and `7f003dd` DEC-283, merged via `c3b0932 merge task-w7-a`). Re-checked at RECHECK SHA:

- `contacts.ts` now lists `"pipeline_entry"` as a seventh entry in the FK-table union type/array feeding `buildMergeRepointOps`, with an explicit comment documenting the former DEC-282 gap.
- `tasks.ts` `listAcceptedContactIds` (now at line ~274) imports `isActiveParticipant` from `../../domain/acceptance` and filters rows through it before returning ids.

Both items are RESOLVED at RECHECK SHA → **0 OPEN ITEMS** from this pre-registered pair.

## Scope note

This section (a) is build+test only. It does not independently verify DEC-282/283's correctness beyond confirming the fix is present in the code and that `npm test`/`npm run build` are green at RECHECK SHA; deeper behavioral verification of the merge/task-assignment logic is out of this section's scope.
