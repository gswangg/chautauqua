## 2026-08-12 task-w17-e — evidence reconciliation across stage-1 waves 13-16 (DEC-453)

Log-only lane (DEC-452/453): no source file changed by this task. Reconciled all 18
`-stage1`-suffixed evidence logs under `docs/verification-log/` for waves 13-16 (`task-w13-*`,
`task-w14-*`, `task-w15-*`, `task-w16-*`) against `main` as it stood at the sha this task itself
derived and audited — **S' = `7836957e9ae35eb4b2b7c1af8030b0926e3bbfda`** ("scribe wave 17") — by
personally re-reading every cited file:line at that sha inside this task's own worktree, not by
copying any prior log's transcript. Full per-file table (RESULT/OPEN ITEMS as logged, every
closure/VERIFIED claim, and a HOLDS-with-citation or STALE-with-what-changed verdict for each) is
in `docs/verification-log/task-w17-e-evidence-reconciliation-stage1.md`.

Headline finding: `task-w16-f-spec-audit-stage1.md`'s "RESULT: PASS, PENDING-OWNED: none found" —
correct and self-consistent at its own audited sha S (`235d677...`) — is **stale** with respect to
one budget row as of S'. Its claim that "the two prior open items (reviewer-queue whole-plan load,
results-endpoint compute-then-slice) are closed" is only half true today: the *results-endpoint*
half (DEC-439/440) is genuinely closed and re-confirmed in code at S'. The *reviewer-queue* half is
not — `task-w16-c-perf-smoke-stage1.md`, whose measurement landed on `main` after S (folded into
`main` alongside `task-w16-a`/`task-w16-f` by S'), found reviewer-queue still exceeds its 50ms read
budget 4/4 runs (54-88ms) for an unrestricted reviewer at 2,000 submissions — via a *different*
mechanism (chunked per-90-id round-trips in `src/server/repo/review/submissions.ts:201` and
`src/server/repo/review/evaluations.ts:125`) than the one DEC-439 fixed. Re-read directly at S':
both chunked call sites are still present, unchanged since `task-w16-c`'s cut. Owning decision:
**DEC-449** (delete the chunked track lookup and `countEvaluationsBySubmission`'s `submissionIds`
param — never fix by paging/reshaping); not yet landed on `main` as of S' (the two concurrent
wave-17 fix-lane worktrees, `task-w17-a`/`task-w17-f`, had made no commits of their own as of S').

Every other claim across all 18 logs — J1-J12 citations, SPEC §5/6/7/8/9/10 rows, the DEC-430/431
contrast+mobile+font-floor fixes, the DEC-444/445 `CONTRAST_BLOCKING` flip, DEC-439/440/441/442
landings, the rubric-coverage count (116 `- id:` rows), the quickstart/zero-secrets claims, and the
security-probe matrix — **HOLDS** at S', independently re-verified against current file content
(not inherited from any prior log's prose). One additional still-open, unowned item found while
reconciling: the `react-router`/`react-router-dom` v6 moderate dependency advisories flagged by
`task-w14-e-build-test-stage1.md` (`package.json:35` still pins `^6.28.0`) have no owning DEC or
branch across waves 15-17.

This file is the input wave 18's closing ledger must consume for waves 13-16's evidence; per DEC-452
this wave carries no ledger of its own (a ledger cut behind only this fix-adjacent lane would report
sibling wave-17 source lanes PENDING-OWNED).

