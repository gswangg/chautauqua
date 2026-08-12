# 2026-08-10 task-w4-d — perf-smoke @ d8d1cbd

Full detail for the `## 2026-08-10 task-w4-d — perf-smoke @ d8d1cbd` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

**Frozen sha.** Adopts the same `d8d1cbd` ("merge task-w3-c") frozen
battery sha already derived and recorded by the sibling gate lane
`task-w4-f — spec-audit` (this file, above): first-parent walk from
`main` tip found no literal `merge task-w4-a` commit for this wave
(DEC-163's designated "sole code-bearing lane" never landed a
commit by that exact label in this campaign round); the newest
first-parent commit that is not bookkeeping-only per DEC-114 is
`d8d1cbd`, which is code-bearing (files library + ZIP archive,
DEC-159/160). `git merge-base --is-ancestor 2dd2f33 d8d1cbd` exits 0
— descends from `2dd2f33` (DEC-129). Using the same sha the other
five gate lanes of this wave cite keeps the battery consistent
(DEC-163).

**Procedure**, worktree checked out detached at `d8d1cbd`, zero
secrets: `rm -rf .wrangler/state` (nothing present, fresh worktree),
`npm ci --prefer-offline --no-audit --no-fund --silent`, `npm run
db:migrate` (14 migrations `0000`..`0013` applied clean), `npm run
seed` (required first so the perf script's login identity
`sbek-organizer@example.com`-equivalent fixture exists — `perf:seed`
alone only seeds synthetic `seed_perf_`-prefixed rows, per the
`task-w19-c` precedent in this file), `npm run perf:seed` (DEC-088
scale: 2,000 submissions / 300 accepted+placed, 10 rooms, 12
reviewers + 600 round-1 evaluations — all SQL batches
`"success": true`), `npx wrangler dev` on the default port 8787
(`GET /health` 200 OK, "Ready on http://localhost:8787" observed),
`npm run perf:smoke`.

`npm run perf:smoke` exit 0 ("perf:smoke OK"). Full p95 table over
30 measured iterations (script budget 150ms uniform, all `ok`),
cross-checked here against SPEC.md §7's finer-grained budgets
(admin API reads p95 < 50ms, writes p95 < 100ms; public
uncached-SSR pages < 150ms):

```
submissions list (page 1)             9.8ms  ok   (admin read,  budget 50ms)
submissions list (q=Kubernetes)      12.6ms  ok   (admin read,  budget 50ms)
submission detail                    12.7ms  ok   (admin read,  budget 50ms)
event overview                       11.8ms  ok   (admin read,  budget 50ms)
organizer agenda (300 accepted)      16.6ms  ok   (admin read,  budget 50ms)
public sessions page                  3.2ms  ok   (public SSR,  budget 150ms)
public agenda                         6.2ms  ok   (public SSR,  budget 150ms)
schedule.ics 150 ids                 32.9ms  ok   (public SSR,  budget 150ms)
plan progress (12 reviewers)         18.2ms  ok   (admin read,  budget 50ms)
rating PUT                            8.5ms  ok   (admin write, budget 100ms)
```

Every measured endpoint is within budget under both the script's
uniform 150ms threshold and SPEC.md §7's per-category numbers, at
the DEC-088 seeded row scale (2,000 submissions / 300 accepted /
12 reviewers / 10 rooms). Server stopped (`lsof -ti:8787 | xargs -r
kill -9`) after the run. No file other than this log was touched
(worktree was a disposable detached checkout, discarded after the
run; this commit's only diff is this section).

OPEN ITEMS: 0

RESULT: PASS
