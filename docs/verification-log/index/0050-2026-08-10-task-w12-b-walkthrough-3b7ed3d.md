## 2026-08-10 task-w12-b — walkthrough @ 3b7ed3d

Full detail: docs/verification-log/task-w12-b-walkthrough-2.md

Re-derived the newest code-bearing sha per DEC-114 mechanically from
`main` tip `546cbcc` ("merge task-w11-e"): `git diff --name-only
<sha>^ <sha>` (first-parent for merges) for `546cbcc` and its parent
`15a422a` ("scribe wave 12") each touch only bookkeeping paths
(`docs/verification-log.md`, `decisions/**`, `field-guide/index.md`,
`src/decisions.ts`); `3b7ed3d` ("merge task-w11-a") first-parent-diffs
`scripts/walkthrough/speaker.ts` (186 insertions / 13 deletions of
walkthrough probe code, outside the DEC-114 exclusion set), so it is
code-bearing. This matches task-w11-e's independent spec-audit
derivation of `3b7ed3d` logged immediately above. Note for the record:
DEC-116/DEC-117 expected `3543f09` and assumed no task-w11-* branch
would land, but `task-w11-a` (`2d686bd`/`3b7ed3d`) did land after those
decisions were written — this is exactly the "stray task-w11-* branch"
case DEC-116 anticipated, so DEC-103's duplicate-section rule applies:
re-derive the sha, and since no walkthrough-scope section existed yet
at `3b7ed3d` (grep confirmed only a spec-audit section there), this
lane ran the full gate rather than a confirm-only stub.

RESULT: PASS

