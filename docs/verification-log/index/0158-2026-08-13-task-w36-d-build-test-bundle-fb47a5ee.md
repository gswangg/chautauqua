## 2026-08-13 task-w36-d — build+test+bundle @ fb47a5ee

Ten waves have landed since the last completion ledger (task-w25-f); this run is the current
evidence that main is green at this sha. Full detail in
`docs/verification-log/task-w36-d-build-test.md`. `npm run build`: clean, 0 tsc errors, `vite
build` `✓ built in 902ms`. `scripts/with-test-lock.sh npm test`: **637 test files passed, 6623
tests passed**, 0 failures, 0 skipped (ran after real lock contention from a concurrent process
outside this worktree; resolved on its own). `npm run bundle:check`: entry bundle = **65.29 kB
gzip against the 300 kB budget** (SPEC.md:355) — PASSED. FAIL-unowned: none. PENDING-OWNED: none.

RESULT: PASS

