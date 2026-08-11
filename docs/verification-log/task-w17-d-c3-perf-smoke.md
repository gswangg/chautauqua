# task-w17-d — perf-smoke extension (DEC-331)

## FROZEN SHA

`1fbc7f6b9cfa77c0efe33a0069206b14ef3ecf17` (`main` tip at worktree
creation, "scribe wave 17"). This gate is a within-lane implementation
+ measurement task (sole owner of `scripts/perf-smoke.ts` this wave),
not a battery gate walking S from an anchor commit, so FROZEN SHA is
simply the branch point.

## Scope

Extended `checks: TimedCheck[]` in `scripts/perf-smoke.ts` to cover
all five SPEC §7 public surfaces plus the whole-agenda `.ics` paths,
per DEC-331/DEC-323:

- `public speakers page` — `GET /e/:slug/speakers` (`cls: "public"`,
  non-empty body assertion)
- `public gallery page` — `GET /e/:slug/gallery` (`cls: "public"`,
  non-empty body assertion)
- `public schedule page` — `GET /e/:slug/schedule` (`cls: "public"`,
  non-empty body assertion)
- `agenda.ics` — `GET /e/:slug/agenda.ics` (`cls: "public"`,
  `assertContainsVevent`)
- `schedule.ics (bare, whole agenda)` — `GET /e/:slug/schedule.ics`
  with no `?ids=` (`cls: "public"`, `assertContainsVevent`) — the
  DEC-323 whole-agenda path, previously timed nowhere in this harness.

Every pre-existing check (admin reads/writes, `public sessions page`,
`public agenda`, `schedule.ics 150 ids`, the DEC-080 pre-loop 301-id
cap assertion, the DEC-105 CSV export size probes) is unchanged. All
new checks reuse `assertContainsVevent` from `scripts/perf-smoke-lib.ts`
for the two `.ics` checks (an empty calendar can never register as a
fast pass); the three HTML surfaces get an inline non-empty-body
assertion consistent with that same "a 200 with no real content
mustn't silently pass" principle, without adding a new exported helper
since `scripts/perf-smoke-lib.ts` and `test/perf-smoke.test.ts` needed
no changes to stay green — the class-budget table (`PERF_CLASS_BUDGET_MS`
already includes `public: 150`) required no edits.

## Build / test

`npm ci --prefer-offline --no-audit --no-fund --silent` (skipped,
`node_modules` present). `npm run build` — `tsc --noEmit` root + `tsc
--noEmit -p app/tsconfig.json` + `vite build` — PASS, 138 modules
transformed. `npm test --silent` — **226 test files / 1888 tests**,
all green (includes `test/perf-smoke.test.ts`'s pure-helper suite,
unmodified and passing).

## Real-scale measurement

`rm -rf .wrangler/state`; `npm run db:migrate` (17 migrations `0000`
through `0017`, all applied clean); `npm run seed` (organizer identity
+ R2 headshot seeding, 8 objects into local `chautauqua-files`);
`npm run perf:seed` (DEC-088 2,000 submissions / 300 accepted / 800
contacts scale — all D1 SQL batches `"success": true`); `cp
.dev.vars.example .dev.vars` with `PUBLIC_BASE_URL=http://localhost:8794`
(port `d` per the wave's port table); `npx wrangler dev --port 8794`
— `GET /health` ready on first poll.

`PERF_URL=http://localhost:8794 npm run perf:smoke` — full verbatim
result table (overhead floor 2.2ms, raw ceiling 150ms):

```
  submissions list (page 1)          raw=    11.6ms  floor=   2.2ms  adjusted=     9.4ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)    raw=    14.3ms  floor=   2.2ms  adjusted=    12.1ms  budget(read)=50ms  PASS
  submission detail                  raw=    14.3ms  floor=   2.2ms  adjusted=    12.1ms  budget(read)=50ms  PASS
  event overview                     raw=    13.3ms  floor=   2.2ms  adjusted=    11.1ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)    raw=    16.8ms  floor=   2.2ms  adjusted=    14.6ms  budget(read)=50ms  PASS
  public sessions page               raw=     3.5ms  floor=   2.2ms  adjusted=     1.3ms  budget(public)=150ms  PASS
  public agenda                      raw=     5.2ms  floor=   2.2ms  adjusted=     3.0ms  budget(public)=150ms  PASS
  schedule.ics 150 ids               raw=    43.9ms  floor=   2.2ms  adjusted=    41.7ms  budget(public)=150ms  PASS
  public speakers page               raw=     5.1ms  floor=   2.2ms  adjusted=     2.9ms  budget(public)=150ms  PASS
  public gallery page                raw=     3.2ms  floor=   2.2ms  adjusted=     1.0ms  budget(public)=150ms  PASS
  public schedule page               raw=     6.8ms  floor=   2.2ms  adjusted=     4.6ms  budget(public)=150ms  PASS
  agenda.ics                         raw=     4.8ms  floor=   2.2ms  adjusted=     2.6ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)  raw=    73.3ms  floor=   2.2ms  adjusted=    71.1ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)       raw=    18.5ms  floor=   2.2ms  adjusted=    16.3ms  budget(read)=50ms  PASS
  contacts list (q=perf)             raw=     7.8ms  floor=   2.2ms  adjusted=     5.6ms  budget(read)=50ms  PASS
  rating PUT                         raw=    13.4ms  floor=   2.2ms  adjusted=    11.2ms  budget(write)=100ms  PASS
```

`perf:smoke OK`, exit code 0. The pre-loop DEC-080 cap assertion (301
ids on `schedule.ics` -> exactly 400, using the seed's 300 real
accepted-submission ids + 1 synthetic id) and the DEC-105 CSV export
size probes (`export submissions.csv` >= 2001 lines, `showflow.csv` >=
301 lines) all passed silently before the timed loop (script does not
proceed past a thrown assertion).

Note: a first invocation immediately after the server came up threw
`TypeError: Body is unusable: Body has already been read` from
`timeCheck`'s warmup `res.arrayBuffer()` call — transient (undici
`Response.clone()` racing against a request still settling right after
`wrangler dev` finished booting), not a code defect in the new checks;
the very next invocation ran clean end-to-end with the table above.
No product or harness fix was needed.

Server and `workerd` child processes killed after the run; `lsof -i
:8794` confirmed no listener remains.

## OPEN ITEMS

0. All five public surfaces plus both whole-agenda `.ics` paths are
now timed and every one passed both its class budget (`public: 150ms`
adjusted) and the unconditional 150ms raw ceiling at 2,000-submission
/ 300-accepted / 800-contact scale. The DEC-331 gap (perf-smoke timed
only two of five public surfaces and never the whole-agenda `.ics`
paths) is closed with no budget exceedances to report against
`src/server/repo/public/{speakers,agenda,sessions,detail}.ts`.

## RESULT

PASS

## RECHECK SHA

`task-w17-d` branch HEAD after this commit (see branch log) — no
`main`-side code changes were required or made; this lane's only
change is to `scripts/perf-smoke.ts` plus this log.

## POST-S DELTA

None observed. `main`'s tip did not need to be re-walked for this
gate (implementation lane, not an S-anchored battery gate); no
concurrent-swarm delta affected this measurement. Per DEC-280, any
future post-S delta discovered against this result is a delta to log,
never a STOP.
