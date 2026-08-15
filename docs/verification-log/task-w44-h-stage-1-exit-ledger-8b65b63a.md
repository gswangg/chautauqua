# task-w44-h — stage-1 exit ledger, full detail

Companion to
`docs/verification-log/index/0226-2026-08-15-task-w44-h-stage-1-exit-ledger-8b65b63a.md`
(sequence `0226`, pre-allocated per DEC-068 w44, no collision at worktree
cut).

Scope: DEC-069/DEC-644/DEC-099/DEC-068. Frozen wave, adjudication/reporting
only — no `src/**`, `app/src/**`, `migrations/**`, or `package.json` byte
touched. `scripts/exit-predicate.ts` not touched (owned by task-w44-g per
this lane's own hard-scope fence).

## Summary

The index section above carries the full STEP 0-2 detail and RESULT
verbatim (poll receipt, `ref-state` receipt, the `exit:predicate` crash
stack trace, the manual slot re-derivation, the six-section sibling
census, and the two CONFIRMED-DEFECT rows). This detail file exists only
to satisfy the two-file convention (recipe:
`docs/verification-log/index/0216-2026-08-15-task-w42-b-stage-1-exit-ledger-8b647c67.md`
+ `docs/verification-log/task-w42-b-stage-1-exit-ledger-8b647c67.md`); no
content is duplicated here beyond this pointer to avoid a second copy
drifting from the index section's verbatim quotes.

## Headline

`npm run exit:predicate -- --product-sha 14da2921a5be66408057712be877bc44c19de6c4`
crashes uncaught (git exit status 128, "Not a valid object name
7561cc1") rather than producing a five-row table — the same class of
defect task-w44-f already filed at
`docs/verification-log/index/0225-2026-08-15-task-w44-f-triage-closure-6edb5263.md`,
still open after task-w44-g's merged ranking fix (`aa485c78`, which
addressed DEC-099 candidate ranking only, not the git-status-128 crash
path). Manual, diagnostic-only re-derivation additionally shows two
slots — build-test-bundle and triage-closure — would read FAIL even
under a fixed instrument. RESULT: FAIL, OPEN ITEMS: 2 (both owned by a
wave-45 lane, named verbatim in the index section's RESULT block).
