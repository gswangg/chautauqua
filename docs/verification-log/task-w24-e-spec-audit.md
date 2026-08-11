# task-w24-e: Spec-Audit Gate — FAIL-STOP at STEP 1 (DEC-114/DEC-219 sha check)

Gate bound to FROZEN sha `0a263d2e6e4dbf438f6ad9e98bffa6af527b965c` (DEC-222).

## STEP 1: DEC-114 newest-code-bearing-sha check

Result: **FAIL-STOP**. The frozen sha 0a263d2 (merge task-w22-e) is NOT the newest
code-bearing sha on `main`. Four commits with real code/test changes exist on
`main` between 0a263d2 and HEAD:

```
main (HEAD) cde03cd  scribe wave 24            (decisions/, field-guide/, src/decisions.ts string-appends only — non-code-bearing, per the same standard DEC-222 used for 617679b)
            b2dc2c1  merge task-w23-b           <- CODE-BEARING
            f5ff947  DEC-215: disable roster row Reset password button while request is in flight
                       app/src/pages/review/PlanEditor.tsx | 14 ++++++++++++--   (1 file changed, 12 insertions(+), 2 deletions(-))
            871ee28  merge task-w23-a            <- CODE-BEARING
            cfd7f9b  DEC-215/DEC-220: add test/users-reset-password.test.ts for reset-password API
                       test/users-reset-password.test.ts | 354 ++++++++++++++++++++++++++++++++++++++ (new file, 354 insertions)
            617679b  scribe wave 23              (non-code-bearing, per DEC-222)
            0a263d2  merge task-w22-e  <-- FROZEN sha this gate is bound to
```

Verified with:
```
git -C .../chautauqua log --oneline main   # HEAD = cde03cd
git -C .../chautauqua show --stat cfd7f9b 871ee28 f5ff947 b2dc2c1 cde03cd
```

`cfd7f9b` adds a wholly new test file (`test/users-reset-password.test.ts`,
354 lines) and `f5ff947` changes production UI code
(`app/src/pages/review/PlanEditor.tsx`, 12 insertions / 2 deletions). Both are
merged into main via `871ee28 merge task-w23-a` and `b2dc2c1 merge task-w23-b`,
timestamped 2026-08-10 22:57-22:59, i.e. after 0a263d2/617679b and after
DEC-221 was recorded (DEC-221 asserted "The branches task-w23-a/b/c carry zero
commits (tips == 617679b == main)" and that "any post-freeze code-bearing merge
of a task-w23-* branch is sha drift = FAIL-stop per DEC-219").

This is a direct contradiction of DEC-221's zero-commit premise for
task-w23-a/b: those branches did in fact carry code-bearing commits, and they
landed on main after the wave-24 freeze point. This is the sha-drift failure
mode DEC-219/DEC-221/DEC-222 explicitly designate as FAIL-stop.

**Per task instructions ("STEP 1: DEC-114 sha check ... else FAIL-stop per
DEC-219"), this gate halts here.** Steps 2-4 (SPEC.md J1-J12 / rubric-id audit,
DEC-211..217 re-verification, new-defect verdict) were NOT performed, because
the gate is explicitly scoped to the frozen sha 0a263d2 and the tree available
for audit (main HEAD cde03cd) is materially different from that sha (contains
+354/-0 and +12/-2 line diffs not present at 0a263d2).

## Disposition

This is a **process/lane-sequencing finding**, not a product defect: the
content of `cfd7f9b`/`f5ff947` (additional reset-password test coverage;
disabling the roster "Reset password" button while a request is in flight)
appears to be legitimate, narrowly-scoped work consistent with DEC-215/220 and
does not on its face regress anything. No new *product* defect is being
claimed here. What is being flagged is the exit-battery precondition itself:
the planner's sha-freeze for wave 24 (DEC-222) does not match the current tip
of main by the time this gate lane ran, for the third time this campaign
(after the w18 and w22-e/f late-drain incidents noted in the field guide).

## Recommendation (informational only — this worker does not replan)

Re-derive the newest code-bearing sha on main (currently `b2dc2c1`, or
`cde03cd`'s tree if `cde03cd` is treated as non-code-bearing scribe
bookkeeping consistent with the DEC-222 precedent for 617679b) and either
(a) refreeze the wave-24 battery at that sha and rerun all six gates, or
(b) explicitly ratify via a new DEC that 0a263d2 remains the audit sha of
record for wave 24 despite the drift, with rationale for why the task-w23-a/b
diffs are considered out-of-scope/non-conflicting for this campaign's stage-1
completion determination.

## Verdict

**FAIL-STOP** (gate precondition violated at STEP 1; steps 2-4 not run).
This worker made zero edits outside this file.
