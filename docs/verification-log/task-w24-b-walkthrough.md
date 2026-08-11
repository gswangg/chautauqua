# task-w24-b: Walkthrough Gate — FAIL-STOP (sha drift, per DEC-219/DEC-221)

## STEP 1: DEC-114 sha check

Task frozen sha (DEC-222): `0a263d2e6e4dbf438f6ad9e98bffa6af527b965c` ("merge task-w22-e").

Actual `main` HEAD at time of verification: `cde03cd` ("scribe wave 24").

`git log --oneline main` (top of history, newest first) shows the following
commits **above** (i.e. descendants of, more recent than) the frozen sha:

```
cde03cd scribe wave 24                                              <- bookkeeping only (decisions/, field-guide/)
b2dc2c1 merge task-w23-b                                            <- CODE-BEARING
f5ff947 DEC-215: disable roster row Reset password button while ... <- CODE-BEARING (app/src/pages/review/PlanEditor.tsx)
871ee28 merge task-w23-a                                            <- CODE-BEARING
cfd7f9b DEC-215/DEC-220: add test/users-reset-password.test.ts ...  <- CODE-BEARING (new test file, 354 lines)
617679b scribe wave 23                                              <- bookkeeping only (decisions/, field-guide/)
0a263d2 merge task-w22-e                                            <- FROZEN SHA (DEC-222)
```

Verified commit contents via `git show --stat`:
- `cfd7f9b`: adds `test/users-reset-password.test.ts` (354 insertions) — code/test-bearing.
- `f5ff947`: modifies `app/src/pages/review/PlanEditor.tsx` (12 ins/2 del) — code-bearing.
- `617679b` and `cde03cd`: touch only `decisions/*.md`, `field-guide/index.md`,
  `src/decisions.ts` constant stubs — bookkeeping-only, consistent with the
  scribe-commit exemption noted in DEC-222.

**Newest code-bearing sha on main is `b2dc2c1` ("merge task-w23-b"), NOT
`0a263d2`.** This is exactly the sha-drift scenario DEC-221 called out
prospectively: *"late w23 merge = sha drift FAIL-stop"*. `task-w23-a` and
`task-w23-b` did in fact merge to main (with real, non-trivial diffs — a new
354-line test file and a UI disabled-state fix) after the wave-24 freeze
point was declared, even though DEC-221 had voided task-w23-a/b/c as
zero-commit/duplicate work relative to the earlier late-drains of w22-e/w22-f.

## Verdict

**FAIL-STOP.** Per DEC-219 ("battery only after planner verifies all task-w*
merged/VOID, sha frozen LITERALLY in task text") and DEC-221's explicit
sha-drift clause, this lane does not proceed to STEP 2 (worktree build/seed/
dev/walkthrough) or STEP 3/STEP 4 (DEC-215/220 curl checks). The frozen sha
0a263d2 no longer reflects the tip of main's code-bearing history; rebinding
to a new sha is a planner decision (per DEC-219, "never rebind" — this is a
worker constraint, not license to silently substitute a new target).

## Recommendation for planner

- Re-declare the wave-24 freeze point at the current main tip's newest
  code-bearing sha (`b2dc2c1`, "merge task-w23-b"), or explicitly re-confirm
  whether `cfd7f9b`/`871ee28`/`f5ff947`/`b2dc2c1` duplicate content already
  covered elsewhere (they do not appear to — `test/users-reset-password.test.ts`
  and the `PlanEditor.tsx` disabled-button change are new, not present at
  `0a263d2`).
- Once a stable sha is confirmed with zero unmerged/late task-w* branches
  outstanding, this gate (task-w24-b) should be re-run end-to-end (STEP 2-4)
  against the newly confirmed sha.
- No product code, decisions/, or other files were modified by this lane;
  only this verification-log file was written, per the sole-editable-file
  constraint.
