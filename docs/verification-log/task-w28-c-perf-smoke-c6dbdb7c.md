# task-w28-c — perf-smoke detail @ c6dbdb7c

sha under test (literal, recorded first per DEC-069 wave-28 amendment):
`c6dbdb7cc615248d1a49485d63320570168f4c7b` (`main` tip at worktree creation,
= scribe wave 28 commit).

## Procedure

1. `git rev-parse HEAD` -> `c6dbdb7cc615248d1a49485d63320570168f4c7b`.
2. `npx tsx scripts/ensure-dev-vars.ts` (created `.dev.vars` from
   `.dev.vars.example`); edited `PUBLIC_BASE_URL=http://localhost:8893`
   (port 8893 reserved to this lane).
3. `npx vite build --config app/vite.config.ts` — clean build, admin SPA
   bundle emitted to `public/admin/`.
4. `npm run db:migrate` — all 39 migrations (`0001`..`0039`) applied `✅`.
5. `npm run perf:seed` — all batches `"success": true`.
6. **Gap found and closed (flagged per worker instructions — narrowest
   reasonable interpretation, not a scope decision):** the delegated task
   steps list only `db:migrate` + `perf:seed` before starting the server,
   but `scripts/perf-smoke.ts`'s `login()` reads organizer credentials from
   `docs/fixtures/sample-data.json` (`fixture.identities.organizer`), which
   is populated by `npm run seed` (the demo seed), not `perf:seed` (which
   only inserts `seed_perf_`-prefixed rows on top of an existing demo-seed
   user roster per its own header comment: "on top of the demo seed's ~19
   users"). First `perf:smoke` attempt failed immediately at login:
   `POST /login failed: expected 302, got 401`. This exact dependency is a
   documented, repeated precedent in this same log (e.g. "npm run seed
   (required before perf:seed, per the w16-c precedent)", "GAP FLAGGED:
   perf:seed depends on npm run seed (demo seed) having..."). Ran
   `npm run seed` (demo seed, ~19 users + R2 headshots), then re-ran
   `npm run perf:seed` (idempotent, only touches `seed_perf_`-prefixed
   rows) to restore the 2k-submission profile on top of the demo seed.
   perf-smoke then logged in successfully.
7. `npx wrangler dev --port 8893` in background; `GET /health` ->
   `{"ok":true}` after ~8s.
8. `PERF_URL=http://localhost:8893 npm run perf:smoke` — full output below.
   Exit code 1.

## Full p95 table (verbatim)

```
perf:smoke profile=default event=perf-2k submissions=2000 contacts=800

p95 over 30 measured iterations (overhead floor: 2.9ms, raw ceiling: 150ms):

  submissions list (page 1)                    raw=    21.0ms  floor=   2.9ms  adjusted=    18.0ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)              raw=    22.9ms  floor=   2.9ms  adjusted=    19.9ms  budget(read)=50ms  PASS
  submission detail                            raw=    23.4ms  floor=   2.9ms  adjusted=    20.5ms  budget(read)=50ms  PASS
  event overview                               raw=    28.4ms  floor=   2.9ms  adjusted=    25.5ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)              raw=    23.4ms  floor=   2.9ms  adjusted=    20.4ms  budget(read)=50ms  PASS
  public sessions page                         raw=     7.7ms  floor=   2.9ms  adjusted=     4.7ms  budget(public)=150ms  PASS
  public agenda                                raw=    10.0ms  floor=   2.9ms  adjusted=     7.1ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                         raw=    54.9ms  floor=   2.9ms  adjusted=    51.9ms  budget(public)=150ms  PASS
  public speakers page                         raw=     8.3ms  floor=   2.9ms  adjusted=     5.3ms  budget(public)=150ms  PASS
  public speakers page at row ceiling          raw=    15.2ms  floor=   2.9ms  adjusted=    12.2ms  budget(public)=150ms  PASS
  public speakers deepest page                 raw=    15.3ms  floor=   2.9ms  adjusted=    12.4ms  budget(public)=150ms  PASS
  public sessions deepest rows                 raw=    12.5ms  floor=   2.9ms  adjusted=     9.5ms  budget(public)=150ms  PASS
  public gallery page                          raw=     7.8ms  floor=   2.9ms  adjusted=     4.9ms  budget(public)=150ms  PASS
  public schedule page                         raw=    12.6ms  floor=   2.9ms  adjusted=     9.7ms  budget(public)=150ms  PASS
  public programme (whole agenda)              raw=     8.6ms  floor=   2.9ms  adjusted=     5.7ms  budget(public)=150ms  PASS
  home hub (anonymous)                         raw=    15.0ms  floor=   2.9ms  adjusted=    12.0ms  budget(public)=150ms  PASS
  agenda.ics                                   raw=     6.4ms  floor=   2.9ms  adjusted=     3.5ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)            raw=     7.1ms  floor=   2.9ms  adjusted=     4.2ms  budget(public)=150ms  PASS
  contacts list (q=perf)                       raw=     8.6ms  floor=   2.9ms  adjusted=     5.7ms  budget(read)=50ms  PASS
  rating PUT                                   raw=    13.0ms  floor=   2.9ms  adjusted=    10.1ms  budget(write)=100ms  PASS
  contacts duplicates                          raw=    13.1ms  floor=   2.9ms  adjusted=    10.2ms  budget(read)=50ms  PASS
  onboarding grid (800 speakers x 5 tasks)     raw=   115.4ms  floor=   2.9ms  adjusted=   112.4ms  budget(read)=50ms  FAIL
      adjusted p95 112.4ms exceeds read class budget 50ms
  reviewer queue                               raw=    69.8ms  floor=   2.9ms  adjusted=    66.8ms  budget(read)=50ms  FAIL
      adjusted p95 66.8ms exceeds read class budget 50ms
  email log list (page 1)                      raw=     7.7ms  floor=   2.9ms  adjusted=     4.7ms  budget(read)=50ms  PASS
  files library (page 1)                       raw=   484.4ms  floor=   2.9ms  adjusted=   481.5ms  budget(read)=50ms  FAIL
      raw p95 484.4ms exceeds 150ms ceiling; adjusted p95 481.5ms exceeds read class budget 50ms
  plan results (page 1)                        raw=    74.7ms  floor=   2.9ms  adjusted=    71.8ms  budget(read)=50ms  FAIL
      adjusted p95 71.8ms exceeds read class budget 50ms
  pipeline list (page 1)                       raw=    10.1ms  floor=   2.9ms  adjusted=     7.2ms  budget(read)=50ms  PASS
  org users list (page 1)                      raw=     7.1ms  floor=   2.9ms  adjusted=     4.2ms  budget(read)=50ms  PASS
  contacts bulk-email preview (50 recipients)  raw=     8.5ms  floor=   2.9ms  adjusted=     5.6ms  budget(write)=100ms  PASS
  onboarding remind preview (all outstanding)  raw=    26.1ms  floor=   2.9ms  adjusted=    23.2ms  budget(write)=100ms  PASS
  submission PATCH (description edit)          raw=    16.7ms  floor=   2.9ms  adjusted=    13.8ms  budget(write)=100ms  PASS
  pipeline stage move                          raw=    12.0ms  floor=   2.9ms  adjusted=     9.1ms  budget(write)=100ms  PASS
  bulk status change                           raw=    44.5ms  floor=   2.9ms  adjusted=    41.6ms  budget(write)=100ms  PASS
  schedule slot PUT                            raw=    21.3ms  floor=   2.9ms  adjusted=    18.4ms  budget(write)=100ms  PASS
  task assignment check-off                    raw=     7.3ms  floor=   2.9ms  adjusted=     4.3ms  budget(write)=100ms  PASS

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

No SKIPPED rows printed (`default` profile resolved, so the DEC-644/645
plan/reviewer-queue/rating-PUT checks all ran, not skipped). No harness
abort message beyond the final `perf:smoke FAILED` summary line — the run
completed all 30 measured iterations and printed every check row; exit
code was `1`.

## FAIL rows (name / measured p95 / budget)

- `onboarding grid (800 speakers x 5 tasks)` — adjusted p95 **112.4ms**
  vs budget(read) **50ms**.
- `reviewer queue` — adjusted p95 **66.8ms** vs budget(read) **50ms**.
- `files library (page 1)` — raw p95 **484.4ms** (exceeds the 150ms raw
  ceiling outright) / adjusted p95 **481.5ms** vs budget(read) **50ms**.
- `plan results (page 1)` — adjusted p95 **71.8ms** vs budget(read)
  **50ms**.

23 of 27 checks PASS; 4 FAIL. Exit code 1.

Cleanup: `wrangler dev --port 8893` process killed after the run; port
8893 confirmed free (`lsof -i :8893` empty).
