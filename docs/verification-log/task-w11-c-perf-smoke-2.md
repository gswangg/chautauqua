# 2026-08-10 task-w11-c — perf-smoke @ 7561cc1

Full detail for the `## 2026-08-10 task-w11-c — perf-smoke @ 7561cc1` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-186/DEC-185 wave-11 exit-gate battery, perf-smoke lane
(DEC-069/DEC-080/DEC-114/DEC-177/DEC-185 gate). Log-only lane; full
detail in `docs/verification-log/task-w11-c-perf-smoke.md`. Note: an
earlier, unrelated first-campaign section headed `task-w11-c —
walkthrough @ 3b7ed3d` exists in this file (per DEC-129) — that section
is a homonym from a different campaign and is inert here; this section
is the current campaign's `task-w11-c` (perf-smoke lane, not
walkthrough).

**STEP 1 — S' derivation.** First-parent walk from `main` tip in a
fresh detached worktree at `7561cc1`: `main` HEAD was `bdc472b` ("scribe
wave 11"), preceded first-parent by `b57bdfd` ("merge task-w9-g") — both
doc-only bookkeeping — then `7561cc1` ("merge task-w10-d"), code-bearing
and the newest such commit reachable. **S' = `7561cc1`**, matching
DEC-185's expected sha. `git merge-base --is-ancestor 2dd2f33 7561cc1`
exits 0 — DEC-139 ancestor check PASS.

**STEP 2 — 17 preconditions.** All 12 DEC-177 anchors (six w6 fixes +
harness closure) plus all 5 wave-10 anchors (DEC-179 `src/lib/csv.ts:145`,
DEC-180 `src/lib/rate-limit.ts:41`, DEC-181 `src/server/middleware.ts:262`,
DEC-182 `src/server/http.ts:51`, DEC-183 `wrangler.jsonc:39`) grepped
present in the S' worktree. No miss.

**STEP 3 — gate.** Fresh detached worktree at `7561cc1`: `npm ci`
clean; `npm run build` PASS (dual `tsc --noEmit` + `vite build`, 131
modules, 0 errors); `rm -rf .wrangler/state`; `npm run db:migrate` (13
migrations) clean; `npm run seed` clean (8 R2 objects); `npm run
perf:seed` clean, all D1 batches `"success": true`; verified DEC-088
scale directly (`seed_perf_%` count = 2000, `status='accepted'` = 300).
`npx wrangler dev --port 8845`, `/health` 200.

`PERF_URL=http://localhost:8845 npm run perf:smoke` — **run 1: exit 0**,
**run 2: exit 0**, both `perf:smoke OK`. Full p95 tables (budget 150ms,
all `ok` both runs):

Run 1:
```
submissions list (page 1)            12.1ms  ok
submissions list (q=Kubernetes)      17.7ms  ok
submission detail                    24.0ms  ok
event overview                       19.5ms  ok
organizer agenda (300 accepted)      27.3ms  ok
public sessions page                  5.4ms  ok
public agenda                         8.5ms  ok
schedule.ics 150 ids                 46.7ms  ok
plan progress (12 reviewers)         20.5ms  ok
rating PUT                           13.4ms  ok
```

Run 2:
```
submissions list (page 1)            15.5ms  ok
submissions list (q=Kubernetes)      15.5ms  ok
submission detail                    18.9ms  ok
event overview                       18.3ms  ok
organizer agenda (300 accepted)      25.0ms  ok
public sessions page                  4.9ms  ok
public agenda                         6.1ms  ok
schedule.ics 150 ids                 39.4ms  ok
plan progress (12 reviewers)         21.0ms  ok
rating PUT                            9.1ms  ok
```

Both runs pass every row, well under the 150ms budget.

DEC-080 301-id `schedule.ics` cap assertion (untimed, one-shot, before
the measured loop): 300 real accepted ids + 1 synthetic nonexistent id
fetched against `GET /e/:slug/schedule.ics`; script throws on any
non-400 response. Clean `perf:smoke OK` exit on both runs confirms this
assertion passed both times.

DEC-182 1000-id bound check: audited every `parseBoundedIdArray` call
site present at S' (`src/routes/files.ts`, `src/routes/tasks.ts`,
`src/routes/api/submissions.ts`, `src/routes/api/contacts.ts`) against
`scripts/perf-smoke.ts`'s calls — perf-smoke never invokes any
bulk-id route gated by `parseBoundedIdArray`. The only multi-id call it
makes (`schedule.ics?ids=`, 150 timed / 301 untimed-cap) is bounded by
DEC-080's own 300-cap logic in `src/routes/public.tsx`, independent of
DEC-182. No DEC-182 bound was tripped — nothing to record as FAIL.

Server killed (`pkill -f "wrangler dev --port 8845"`); `lsof -i :8845`
confirmed free afterward. Detached perf-run worktree removed after the
gate.

OPEN ITEMS: 0

RESULT: PASS
