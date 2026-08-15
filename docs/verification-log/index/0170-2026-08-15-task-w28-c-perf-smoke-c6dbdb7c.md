## 2026-08-15 task-w28-c — perf-smoke @ c6dbdb7c

QUALIFYING
INVALIDATED BY: src/** app/src/** migrations/** package.json

Built (`npx vite build --config app/vite.config.ts`), migrated (39/39
`✅`), and perf-seeded (2,000-submission profile) this worktree's local D1.
Gap flagged (not in scope to fix): the delegated step list omitted `npm run
seed` (demo seed) before `perf:seed`; `perf-smoke.ts login()` reads
organizer credentials from `docs/fixtures/sample-data.json`, populated only
by the demo seed, so the first `perf:smoke` run 401'd at login
(`POST /login failed: expected 302, got 401`). Ran `npm run seed` then
re-ran `npm run perf:seed` (idempotent, `seed_perf_`-prefixed rows only)
per this log's own w16-c precedent, then reran `wrangler dev --port 8893`
+ `perf:smoke` clean. Full p95 table (30 measured iterations, all 27
checks ran, no SKIPPED rows) is in
`docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md`.

OPEN ITEMS: 4 — `onboarding grid (800 speakers x 5 tasks)` adjusted p95
112.4ms > budget(read) 50ms; `reviewer queue` adjusted p95 66.8ms >
budget(read) 50ms; `files library (page 1)` raw p95 484.4ms (exceeds the
150ms raw ceiling) / adjusted p95 481.5ms > budget(read) 50ms; `plan
results (page 1)` adjusted p95 71.8ms > budget(read) 50ms. Not fixed (out
of scope for this lane).
RESULT: FAIL — perf-smoke exit code 1; 23/27 checks PASS, 4 FAIL (all read-
class budget overruns) at sha c6dbdb7cc615248d1a49485d63320570168f4c7b.

