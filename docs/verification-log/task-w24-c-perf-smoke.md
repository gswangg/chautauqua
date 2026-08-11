# task-w24-c — perf-smoke gate @ 0a263d2 (DEC-222)

Wave-24 exit-gate battery, perf-smoke lane, per DEC-222/DEC-034/DEC-086
(and DEC-088/DEC-089/DEC-080 for the harness's probe contents). Log-only;
no product/test code changes — sole editable file is this log.

## STEP 1 — DEC-114 sha check

`main` HEAD at branch time was `cde03cd` ("scribe wave 24"): diff vs its
parent (`git show --stat cde03cd`) touches only `decisions/DEC-221.md`,
`decisions/DEC-222.md`, `field-guide/index.md`, and `src/decisions.ts`
(2 pure string-constant appends, `DEC_221`/`DEC_222`, plus one comment
whitespace fix already present pre-wave-24 in the diff hunk header — no
non-constant code line changed). All four paths fall inside DEC-114's
exclusion set (`decisions/**`, `field-guide/**`, and pure-string-constant
appends to `src/decisions.ts`), so `cde03cd` is **not code-bearing**.

Its first parent is `0a263d2` ("merge task-w22-e"), the literal FROZEN sha
cited in DEC-222.

**Newest code-bearing sha = `0a263d2e6e4dbf438f6ad9e98bffa6af527b965c`** —
matches DEC-222. No FAIL-stop.

## STEP 2 — isolated worktree gate

Own worktree at `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w24-c`
(branch `task-w24-c`, hard-reset to `0a263d2` for the gate run so the
build/test/perf steps below execute against the frozen tree exactly, not
the non-code-bearing `cde03cd` doc-only commit on top of it), own
`.wrangler/state`, own port (8962), isolated from other w24 lanes.

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean.
- `npm run build` — PASS: `tsc --noEmit` (root) clean, `tsc --noEmit -p
  app/tsconfig.json` clean, `vite build` 132 modules transformed, built
  in 599ms, 0 errors.
- `npm run db:migrate` — 13 migrations (`0000`-`0010`, `0012`, `0013`)
  applied clean against fresh local D1 state.
- `npm run seed` — run first, as prior gates note perf:seed alone seeds
  no login-capable identity (`scripts/perf-seed.ts` reuses `scripts/
  seed.ts`'s fixed `ORG_ID = seedId('org', 1)` and its organizer login
  rather than creating its own org/user rows — confirmed by reading
  `scripts/perf-seed.ts`, and empirically: `perf:smoke` failed
  `POST /login failed: expected 302, got 401` when run against a DB that
  had only `db:migrate` + `perf:seed`, no `seed`). This matches
  `.github/workflows/ci.yml`'s `perf-smoke` job order (`db:migrate` ->
  `seed` -> `perf:seed` -> boot dev -> `perf:smoke`), which the task text
  omitted but is the load-bearing prerequisite the harness assumes; ran
  clean, 8 R2 objects uploaded to local bucket `chautauqua-files`.
- `npm run perf:seed` — `tsx scripts/perf-seed.ts` + `wrangler d1 execute
  --file=.perf-seed.sql`, all batches `"success": true`, no `false`
  anywhere.
- `npm run dev -- --port 8962` (`predev` ran `ensure-dev-vars.ts`,
  created `.dev.vars` from `.dev.vars.example` — first run in this fresh
  worktree, DEC-187) started in background; `GET /` polled 200 OK.

`PERF_URL=http://localhost:8962 npm run perf:smoke` — **exit 0**
("perf:smoke OK").

### p95 table (budget: `PERF_P95_BUDGET_MS` = 150ms, from `scripts/
perf-smoke-lib.ts:8`)

```
submissions list (page 1)             9.6ms  ok
submissions list (q=Kubernetes)      10.7ms  ok
submission detail                    16.2ms  ok
event overview                       11.5ms  ok
organizer agenda (300 accepted)      15.9ms  ok
public sessions page                  3.4ms  ok
public agenda                         5.5ms  ok
schedule.ics 150 ids                 36.6ms  ok
plan progress (12 reviewers)         19.8ms  ok
rating PUT                           10.2ms  ok
```

All 10 rows well under the 150ms budget. No breach — nothing to tune,
nothing to name.

**DEC-080 301-id `schedule.ics` cap assertion** (`perf-smoke.ts`'s
untimed one-shot check at lines 201-219, run before the timed loop):
fetches 300 real accepted-submission ids (`fetchAcceptedSubmissionIds`)
+ 1 synthetic nonexistent id (301 total) against `GET /e/:slug/
schedule.ics`; the script throws synchronously (`Error: DEC-080 cap
assertion failed...`) on any response other than 400. The clean
`perf:smoke OK` exit (process exit 0, no thrown error, script continued
to and completed the timed loop after this check) confirms the assertion
passed — 301 ids -> 400 as required.

Server stopped (`pkill -f "wrangler dev --port 8962"`); confirmed no
process left listening on 8962 afterward.

Only `docs/verification-log/task-w24-c-perf-smoke.md` was modified in
this worktree; no product/test code changed.

## OPEN ITEMS: 0

## RESULT: PASS
