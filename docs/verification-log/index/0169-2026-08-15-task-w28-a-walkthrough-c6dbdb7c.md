## 2026-08-15 task-w28-a — walkthrough @ c6dbdb7c

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Instrument-repair commit: `9bf312cf` (scripts/walkthrough/speaker.ts,
this lane's worktree `task-w28-a`). Product sha measured: `c6dbdb7c`
(this lane's branch point off main; the repair touched no `src/**`,
`app/src/**`, `migrations/**`, or `package.json` file, confirmed via
`git diff --stat c6dbdb7c HEAD -- src app/src migrations package.json`
returning empty, so the product sha is unchanged from the branch point).

Full detail: docs/verification-log/task-w28-a-walkthrough-c6dbdb7c.md

Repaired the DEC-244 deliverable-panel block's false premise (the
task-w26-f/task-w27-c `version 2`-after-single-upload defect — the ad hoc
file_request task is minted+assigned within the same run, so no seed loop
pre-completes it) by having the lane create both file versions itself:
assert the version-1 panel, POST a second (replace) upload, assert the
version-2 panel with a two-row version-history chain. Ran the gate twice
(fresh migrate+seed both times) at `http://localhost:8891`
(`PUBLIC_BASE_URL` corrected to match per the w26-f/w27-c off-origin
lesson).

Per-area summary (both runs identical):

  PASS producer  PASS review  PASS speaker  PASS public  PASS data  PASS scale

Both runs: 131 `ok` lines, zero `FAIL` lines, `walkthrough OK`. The three
repaired speaker checks (version-1 panel, replace-upload 302, version-2
panel with both v1/v2 rows and Current on v2 only) passed in both runs.

RESULT: PASS — the previously-recorded DEC-244 "version 2" defect
(task-w26-f/task-w27-c) was a false instrument assertion, not a product
defect; repaired instrument passes clean on two independent runs at
product sha c6dbdb7c.
OPEN ITEMS: 0

