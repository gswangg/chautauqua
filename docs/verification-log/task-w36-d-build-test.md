# task-w36-d — build+test+bundle @ fb47a5ee

Full-suite verification lane, run through `scripts/with-test-lock.sh` per this
task's brief. Ten waves have landed since the last completion ledger
(`task-w25-f-stage-1-completion-ledger.md`); this run is the current evidence
that main is green at this sha.

## Steps run, in order

1. `npm run build` — clean. Both `tsc --noEmit` passes report 0 errors,
   `vite build` `✓ built in 902ms`, 51 emitted asset files (chunked per
   route), no warnings besides the two expected unresolved-at-build-time font
   references (`/fonts/FamiljenGrotesk-var.woff2`,
   `/fonts/Figtree-var.woff2` — resolved at runtime, same as every prior
   build-test entry).

2. `scripts/with-test-lock.sh npm test` — acquired the shared lock (there was
   real contention: another process outside this worktree held
   `/tmp/chq-test.lock` for several minutes concurrently — this run waited
   for it rather than stealing it, and the wait resolved on its own well
   under the 45-minute stale threshold). Once acquired:

   ```
   Test Files  637 passed (637)
        Tests  6623 passed (6623)
     Duration  132.35s (transform 5.73s, setup 5.44s, collect 92.87s,
                tests 58.71s, environment 19.64s, prepare 22.89s)
   ```

   0 failures, 0 skipped. Two expected `console.error`-level stderr lines
   from `test/html-error-shape.test.ts` (`unhandled error Error: boom`) are
   the test's own intentional 500-path fixture (DEC-841 HTML vs API error
   shape), not failures — the file itself reports `✓ (4 tests) 9ms`.

3. `npm run bundle:check` — entry bundle `index-ZWTpiDXc.js` +
   `index-l7CESiyf.css` = **65.29 kB gzip** against the **300 kB budget**
   (SPEC.md:355) — PASSED, comfortably under budget. Full per-chunk table
   printed and reviewed; largest non-entry chunks are route-level
   `Settings-*.js` (16.92 kB gzip) and `Review-*.js` (16.55 kB gzip), both
   well within normal range for this codebase.

## sha

All three steps run at `fb47a5eec6f629bcf99cad4f6075a8998d75f4d5` (short
`fb47a5ee`) — this task's own worktree base commit (`main` at time of
worktree creation), unmodified by product code (only `decisions/README.md`
and this verification-log pair were touched by this task).

## FAIL-unowned

None. No test failure was observed in this run at all — build, full suite,
and bundle check all passed cleanly, so there is nothing to attribute to an
in-flight lane's owned files.

## PENDING-OWNED

None.

## Grep for stray conflict markers

`grep -R '<<<<<<<' --include='*.ts' --include='*.tsx' --include='*.css'
--include='*.md'` across `src/`, `app/`, `test/`, `docs/`, `decisions/` at
this sha: no matches.

## RESULT: PASS
