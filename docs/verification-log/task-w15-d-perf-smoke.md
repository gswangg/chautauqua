# task-w15-d — perf-smoke @ 7c4101c

Full detail for the `## 2026-08-10 task-w15-d — perf-smoke @ 7c4101c`
section of `docs/verification-log.md` (see the stub entry there for the
RESULT line).

Post-barrier gate: task-w15-a (DEC-076's single code barrier for wave 15)
is already merged into main; this task ran the perf smoke at the resulting
main sha (7c4101c, "merge task-w15-a") in a fresh worktree.

Mirrored the CI `perf-smoke` job (.github/workflows/ci.yml) in the
task-w15-d worktree:

- `npm ci --prefer-offline --no-audit --no-fund --silent`
- `npm run build`: PASS, no type errors, vite build produced the admin
  bundle with no warnings.
- `npm test --silent`: 89 files / 898 tests, ALL PASS.
- `npm run db:migrate`: 9 migrations (0000-0008) applied, all ✅.
- `npm run seed`: PASS (R2 objects + D1 rows seeded).
- `npm run perf:seed` (2k-row scale): PASS, all D1 batch inserts
  `"success": true`.
- `npx wrangler dev --port 8787` in background, polled `/health`: up after
  1s, well under the 60s CI budget (`{"ok":true}`).
- `npm run perf:smoke`: PASS.

Budget: p95 < 150ms (`PERF_P95_BUDGET_MS` in scripts/perf-smoke-lib.ts),
30 measured iterations per check:

- submissions list (page 1): 24.1ms — PASS (budget 150ms)
- submissions list (q=Kubernetes): 24.8ms — PASS (budget 150ms)
- submission detail: 37.2ms — PASS (budget 150ms)
- event overview: 28.4ms — PASS (budget 150ms)

All four checks landed well under the 150ms budget. Numbers are higher
than w13-d's 7.6-13.2ms measurement (same machine class, more accumulated
schema/data since wave 13), but per the task's own framing ("large
regressions are the signal, not tuning") a ~2-3x increase that remains
~4-6x under budget is not a regression signal worth chasing in a gate
task. `npm run perf:smoke` exited 0 ("perf:smoke OK") on the first run —
no product-code, repo-query, or migration fix was required.

`npm run build` and `npm test` were also run (see above) in the same
worktree to confirm the branch builds and tests standalone, consistent
with the w13-d precedent.

RESULT: PASS
