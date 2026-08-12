# 2026-08-10 task-w20-c — perf-smoke @ 6807b67

Full detail for the `## 2026-08-10 task-w20-c — perf-smoke @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-20 seventh-generation battery (DEC-206), perf-smoke gate at
FROZEN sha `6807b67`, port 8952. Full detail also in
`docs/verification-log/task-w20-c-perf-smoke.md`.

STEP 1: DEC-114 sha check. Worktree cut from `main` tip `78bb286`
("scribe wave 20"). `git diff --name-only 78bb286^ 78bb286` touches
only `decisions/DEC-205.md`, `decisions/DEC-206.md`,
`field-guide/index.md`, and `src/decisions.ts` — the `src/decisions.ts`
hunk is a pure two-line `export const DEC_205 = "...";` /
`export const DEC_206 = "...";` string-constant append, no other
change — so `78bb286` falls inside DEC-114's bookkeeping-exclusion set
and is not code-bearing. Its first parent is `6807b67` ("merge
task-w18-b"), matching the DEC-206 FROZEN sha exactly. No drift — sha
check PASSES, proceeding.

STEP 2: DEC-203 precondition greps at `6807b67` (working tree, sha
confirmed identical per STEP 1): `email.trim().toLowerCase()` present
in `src/routes/api/users.ts:57`; `lower(${schema.user.email})` present
in `src/server/repo/users.ts:54`; `accountRoutes` imported and mounted
(`app.route("/", accountRoutes)`) in `src/index.ts`; welcome email
copy in `src/routes/api/users.ts:79` contains no password value
("Sign in at /login with the temporary password your organizer will
share with you; you can change it at /account/password after signing
in.") — password-free. All four markers present.

STEP 3: fresh state. `rm -rf .wrangler`. `npm run db:migrate`: 14
migrations `0000`-`0013` applied clean. `npm run seed`: clean, 8 R2
objects uploaded (required first for the login-capable fixture
organizer identity, same precondition documented at every prior
perf-smoke gate). `npm run perf:seed`: DEC-086/DEC-088 scale (2,000
submissions / 300 accepted+placed, 12 reviewers), all SQL batches
`"success": true`.

STEP 4: `npx wrangler dev --port 8952` started in background; ready
log observed (`[wrangler:info] Ready on http://localhost:8952`).

STEP 5: `PERF_URL=http://localhost:8952 npm run perf:smoke` — exit 0
("perf:smoke OK"). Full p95 table (budget printed by the script:
150ms, all `ok`):

```
submissions list (page 1)            12.2ms  ok
submissions list (q=Kubernetes)      15.6ms  ok
submission detail                    14.1ms  ok
event overview                       15.6ms  ok
organizer agenda (300 accepted)      27.2ms  ok
public sessions page                  3.4ms  ok
public agenda                         8.5ms  ok
schedule.ics 150 ids                 41.4ms  ok
plan progress (12 reviewers)         22.2ms  ok
rating PUT                           12.6ms  ok
```

DEC-080 cap assertion (301-id `schedule.ics` -> 400, run untimed
before the measured loop inside `scripts/perf-smoke.ts`): the script
throws synchronously on any non-400 response, so the clean `perf:smoke
OK` exit confirms this assertion passed. Every measured p95 above sits
well inside the local budget printed by the script; no breach, script
exit code 0 (would exit 1 on breach per the task brief).

Server stopped (`pkill -f "wrangler dev --port 8952"`) after the run,
port 8952 confirmed free. `.dev.vars` was created via `npx tsx
scripts/ensure-dev-vars.ts` (DEC-187) when absent, and was never read
or printed at any point.

OPEN ITEMS: 0

RESULT: PASS
