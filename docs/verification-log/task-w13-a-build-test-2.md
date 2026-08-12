# 2026-08-10 task-w13-a — build+test @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w13-a — build+test @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069 build+test gate, log-only lane (DEC-077: code-frozen, DEC-103
verify-or-run). Re-derived the newest code-bearing sha per DEC-091/
DEC-114 from a fresh worktree of `main` (tip `a6eb789`, "scribe wave
13"): walking first-parent, `a6eb789` and the entire wave-12/wave-11
tail down to `15a422a` ("scribe wave 12") and `546cbcc` ("merge
task-w11-e") touch only bookkeeping paths (`docs/verification-log.md`
or `decisions/**`+`field-guide/index.md`+pure `src/decisions.ts`
appends); `3b7ed3d` ("merge task-w11-a") is the first commit whose
first-parent diff (`e9ec7e0`..`3b7ed3d`) lands a real file outside the
exclusion set — `scripts/walkthrough/speaker.ts`. Confirms **`3b7ed3d`**
as the newest code-bearing sha, matching the task's expected result
exactly.

NOTE: the round-0 namesake `## 2026-08-10 task-w13-a — build+test @
0ee30dd` section above does not count (DEC-118/119) — `0ee30dd` is not
this wave's derived sha.

Two independent `RESULT: PASS` build+test sections already exist at
this exact sha — `task-w11-b — build+test @ 3b7ed3d` and `task-w12-a —
build+test @ 3b7ed3d` — both reporting a clean `npm run build` (tsc x2
+ vite) and `npm test`: 104 test files / 1030 tests, 0 failures. Per
DEC-103 (verify-or-run), this task spot-checks rather than re-runs:
this worktree's own `find . -name "*.test.ts" | wc -l` (excluding
`node_modules`) returns 104, matching both cited sections exactly, and
`src/` is fully populated (87 `.ts` files) with no truncation. No
discrepancy found. Drift vs the `task-w7-a @ d12eb25` baseline (96
files / 984 tests) is consistent with wave 9-11 additions — counts grew,
none shrank. Full detail: `docs/verification-log/task-w13-a-build-test.md`.

RESULT: PASS
