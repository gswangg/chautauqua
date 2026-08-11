# task-w24-a build+test gate — FAIL-stop (sha mismatch, DEC-219)

## Verdict: FAIL-stop — did not proceed to build/test. No rebind performed.

## Step 1: sha check

Command:
```
git log --first-parent --oneline -8 main
```
Output:
```
cde03cd scribe wave 24
b2dc2c1 merge task-w23-b
871ee28 merge task-w23-a
617679b scribe wave 23
0a263d2 merge task-w22-e
f459735 merge task-w22-f
2af5277 merge-train fix: mock getSubmissionSummaryInEvent in PUT-evaluations test fakes (DEC-211)
a486b5d merge task-w22-b
```

Command:
```
git diff --name-only 0a263d2 main
```
Output:
```
app/src/pages/review/PlanEditor.tsx
decisions/DEC-218.md
decisions/DEC-219.md
decisions/DEC-220.md
decisions/DEC-221.md
decisions/DEC-222.md
field-guide/index.md
src/decisions.ts
test/users-reset-password.test.ts
```

## Finding

Per DEC-222/DEC-114, the newest code-bearing sha on `main` must be
`0a263d2` ("merge task-w22-e"), with every later commit confined to
`decisions/`, `field-guide/`, `docs/verification-log*`, and pure
string-appends to `src/decisions.ts`. That precondition does not hold:

- `app/src/pages/review/PlanEditor.tsx` was modified after `0a263d2`
  (commit `f5ff947`, merged via `merge task-w23-b` at `b2dc2c1`). The
  diff adds real product code: a `resettingUserId` state variable and
  wiring to disable the roster "Reset password" button while the
  request is in flight (DEC-215 follow-up).
- `test/users-reset-password.test.ts` is a brand-new 354-line test file
  added after `0a263d2` (commit `cfd7f9b`, merged via `merge task-w23-a`
  at `871ee28`), covering `POST /api/v1/users/:id/reset-password`
  (DEC-215/DEC-220).

Both files are code-bearing (product `app/src` and a `test/` file) and
fall outside the DEC-222 allow-list. This directly contradicts DEC-221,
which stated task-w23-a/b/c were "zero-commit" / void and that "the
entire w23 remit [was] already on main" prior to 0a263d2 — i.e. DEC-221
asserted no new commits should exist between 0a263d2 and main from the
w23 lane. The commit graph shows otherwise: two non-trivial merges
(`merge task-w23-a` at `871ee28`, `merge task-w23-b` at `b2dc2c1`) each
carrying a real commit (`cfd7f9b`, `f5ff947`) landed strictly after
`0a263d2`, before the `cde03cd` scribe-wave-24 commit.

Per DEC-114 (sha rule) and DEC-219 (fail-stop on sha mismatch, no
rebind by workers), this task stops here without running
`npm run build` / `npm test` / `npm run bundle:check`. Reconciling
whether these two commits should be considered part of the frozen
baseline (i.e. FROZEN sha needs to move past `b2dc2c1`/`cde03cd`) or
should be reverted/re-litigated is a planner decision, not a worker
decision.

## Steps 2-4

Not executed — blocked by Step 1 FAIL-stop per DEC-219.

## OPEN ITEMS: 1

1. Sha drift: `main` has code-bearing commits past the DEC-222 FROZEN
   `0a263d2` (via `merge task-w23-a` / `merge task-w23-b`), contradicting
   DEC-221's "zero-commit" characterization of task-w23-a/b. Planner
   must reconcile (re-freeze at a later sha covering these commits, or
   direct removal) before a build+test gate can run.
