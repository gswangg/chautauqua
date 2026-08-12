# 2026-08-10 task-w5-d — perf-smoke @ 64ec7de

Full detail for the `## 2026-08-10 task-w5-d — perf-smoke @ 64ec7de` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

STEP 1: frozen sha derivation identical to task-w5-b's spec (first-parent
walk from `main` tip, skipping bookkeeping, must contain the ci.yml
render-sweep job, must descend from `2dd2f33`). `main` tip at worktree
creation is `64ec7de` ("merge task-w5-a"), the first-parent commit
immediately preceding it in the log being `54005df` ("merge task-w4-e").
`64ec7de` is code-bearing: it is the merge of task-w5-a, whose sole
change was adding the `render-sweep` job to `.github/workflows/ci.yml`
(confirmed present: `grep -n render-sweep .github/workflows/ci.yml` hits
`render-sweep:` at line 87, `npx playwright install --with-deps
chromium` at line 96, `npm run gate:render-sweep` at line 97). Ancestor
guard: `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0 — PASS.
Adopted sha: `64ec7de`.

STEP 2: `npm ci --prefer-offline --no-audit --no-fund --silent` (cached,
clean). `npm run build` — clean (tsc x2 + vite build, no errors). `rm -rf
.wrangler/state` — fresh worktree, nothing present. `npm run db:migrate`
— 11 migrations (`0000`..`0010`, `0012`, `0013`; `0011` does not exist in
this tree) applied clean via `wrangler d1 migrations apply chautauqua
--local`. `npm run seed` — required first (perf:seed alone seeds only
synthetic `seed_perf_`-prefixed rows, not a login-capable identity); ran
clean, 8 R2 objects uploaded to local bucket `chautauqua-files`. `npm run
perf:seed` — DEC-088 scale (2,000 submissions / 300 accepted, 12
reviewers), all SQL batches report `"success": true`. `npx wrangler dev
--port 8803` started in background (port 8803 reserved for this lane,
never 8787/8801); `GET /health` returned `{"ok":true}` (200) on the first
poll.

`PERF_URL=http://localhost:8803 npm run perf:smoke` — exit 0
("perf:smoke OK"), re-run a second time to confirm exit code explicitly
(`echo $?` -> `0`). Full p95 table (budget 150ms, all `ok`):

```
submissions list (page 1)            11.8ms  ok
submissions list (q=Kubernetes)      13.6ms  ok
submission detail                    15.4ms  ok
event overview                       15.6ms  ok
organizer agenda (300 accepted)      19.1ms  ok
public sessions page                  4.2ms  ok
public agenda                         6.7ms  ok
schedule.ics 150 ids                 40.2ms  ok
plan progress (12 reviewers)         22.8ms  ok
rating PUT                            8.0ms  ok
```

DEC-080 301-id cap assertion: `perf-smoke.ts` throws synchronously on any
non-400 response to the 301st synthetic nonexistent `schedule.ics` id
request (run untimed before the measured loop), so the clean `perf:smoke
OK` exit on both runs confirms this assertion passed — noted explicitly
per this gate's instructions, no separate assertion output is printed by
the script.

Server killed after the run (`pkill -f "wrangler dev --port 8803"`);
`lsof -i :8803` confirms the port is free.

OPEN ITEMS: 0

RESULT: PASS
