# task-w24-d: render-sweep gate — FAIL-STOP (sha drift, DEC-219)

Bound sha (DEC-222 frozen literal): `0a263d2e6e4dbf438f6ad9e98bffa6af527b965c` (merge task-w22-e)

## STEP 1 — DEC-114 newest code-bearing sha check

Re-derived the first-parent chain of `main` at gate-execution time:

```
cde03cd scribe wave 24                                (docs+decisions.ts appends only — non-code-bearing)
b2dc2c1 merge task-w23-b                               (app/src/pages/review/PlanEditor.tsx — CODE-BEARING)
871ee28 merge task-w23-a                               (test/users-reset-password.test.ts — CODE-BEARING)
617679b scribe wave 23                                 (docs+decisions.ts appends only — non-code-bearing)
0a263d2 merge task-w22-e                                <- DEC-222 FROZEN sha
f459735 merge task-w22-f
...
```

`git -C chautauqua log --first-parent --oneline main -8` output confirms two code-bearing
merges (871ee28 "merge task-w23-a", b2dc2c1 "merge task-w23-b") landed on main's first-parent
chain strictly after the DEC-222 frozen sha 0a263d2, contradicting the DEC-222 premise
("first-parent chain of main is 617679b <- 0a263d2 ... 617679b non-code-bearing") that was
true only at planning time.

This is precisely the failure mode DEC-221 warned about and defined as fail-stop: "any
post-freeze code-bearing merge of a task-w23-* branch is sha drift = FAIL-stop per DEC-219."
DEC-221's own premise ("task-w23-a/b/c carry zero commits (tips == 617679b == main)") has been
invalidated by a subsequent late merge of both branches with real code content:

- `871ee28` "merge task-w23-a" adds `test/users-reset-password.test.ts` (354 lines) — a file
  DEC-221 explicitly says "was never created and is NOT owed."
- `b2dc2c1` "merge task-w23-b" edits `app/src/pages/review/PlanEditor.tsx` (+12/-2), a second
  copy of the DEC-215 roster-row disable-while-in-flight change (commit f5ff947, same diff
  already noted as landed via task-w22-e per DEC-221's own file/line citation
  app/src/pages/review/PlanEditor.tsx:259-270,560-570).

Newest code-bearing sha in main's first-parent chain as of gate execution: **b2dc2c1**
(`merge task-w23-b`), not the frozen `0a263d2`.

## Verdict

**FAIL-STOP per DEC-219.** Per task instructions ("STEP 1: DEC-114 sha check ... else
FAIL-stop per DEC-219"), execution halts here. STEP 2 (detached worktree at 0a263d2, chromium
install, build, `npm run gate:render-sweep`) and STEP 3/4 (DEC-217 /account/password x3-role
coverage confirmation, +3-over-144 entry-count check, full PASS/FAIL table) were **not run**,
because running the sweep against a sha main has already drifted past would not verify what
DEC-222 bound this gate to, and per DEC-219 gates never silently rebind.

## Recommendation (informational only — this worker does not decide)

The planner needs to either (a) re-freeze the wave-24 battery sha to reflect main's true
current first-parent tip (b2dc2c1) and re-verify all six task-w24-* lanes against the new
sha, or (b) determine whether 871ee28/b2dc2c1 were an erroneous duplicate late-merge (the
content substantially duplicates already-landed w22-e work per DEC-221's own citations) that
should be investigated before re-freezing. This is a planning/scribe decision, not something
this verification-only lane can resolve — its sole editable file is this log.
