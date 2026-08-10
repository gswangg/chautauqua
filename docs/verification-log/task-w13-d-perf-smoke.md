# task-w13-d — perf-smoke @ 0ee30dd

Full detail for the `## 2026-08-10 task-w13-d — perf-smoke @ 0ee30dd`
section of `docs/verification-log.md` (extracted per the
contention-decomposition of that file; see the stub entry there for the
RESULT line).

Mirrored the CI `perf-smoke` job (.github/workflows/ci.yml lines 26-55)
exactly in the task-w13-d worktree: `npm ci --no-audit --no-fund`, `npm
run db:migrate` (9 migrations, 0000-0008, all applied), `npm run seed`,
`npm run perf:seed` (2k-row scale), `npx wrangler dev --port 8787` in
background, polled `/health` (up after 1s, well under the 60s budget),
then `npm run perf:smoke`.

Budget: p95 < 150ms (PERF_P95_BUDGET_MS in scripts/perf-smoke-lib.ts),
30 measured iterations per check:

- submissions list (page 1): 10.7ms — PASS (budget 150ms)
- submissions list (q=Kubernetes): 10.2ms — PASS (budget 150ms)
- submission detail: 13.2ms — PASS (budget 150ms)
- event overview: 7.6ms — PASS (budget 150ms)

`npm run perf:smoke` exited 0 ("perf:smoke OK") on the first run — no
product-code, repo-query, or migration fix was required.

Also ran `npm run build` (PASS, no type errors) and `npm test` (861/861
tests passed across 82 files) in the same worktree to confirm the branch
builds and tests standalone.

RESULT: PASS
