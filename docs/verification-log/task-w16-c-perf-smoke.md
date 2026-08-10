# task-w16-c — perf-smoke @ 7ac6aef

Gate re-run (wave 16, DEC-077 log-only lane). Fresh worktree
`chautauqua-wt/task-w16-c` off `main` @ `7ac6aef` ("scribe wave 16",
non-code-bearing per DEC-069/DEC-077 — no code-bearing commit newer than
`0ba550c` at time of this run).

## Steps run

1. `npm ci --prefer-offline --no-audit --no-fund --silent` — clean install, no errors.
2. `npm run build` — `tsc --noEmit` (root), `tsc --noEmit -p app/tsconfig.json`,
   `vite build` all succeeded. Bundle sizes unchanged from prior gates
   (largest chunk `index-CxBQBN1X.js` 179.18 kB / 58.62 kB gz — within the
   DEC-058 <300KB gz budget).
3. `npm run db:migrate` — 9 migrations (`0000`..`0008`) applied cleanly to
   local D1 (`chautauqua`), no errors.
4. `npm run seed` — required first: `scripts/perf-seed.ts` seeds only the
   2,000 synthetic `seed_perf_`-prefixed submissions/contacts/tracks, not
   any login-capable user. `scripts/perf-smoke.ts` logs in as the fixture
   organizer (`docs/fixtures/sample-data.json` `identities.organizer`),
   which only exists after `npm run seed` (the regular demo seed) has run.
   Without this step, `perf:smoke` fails at `POST /login` with 401 (verified
   this empirically before adding the step — not a regression, this
   dependency exists in every prior gate run too, e.g. w15-d's log entry
   lists `db:migrate`, `seed`, then `perf:seed` in that order).
5. `npm run perf:seed` — emitted `.perf-seed.sql` and applied via
   `wrangler d1 execute chautauqua --local --file=.perf-seed.sql`
   (2,000 submissions, 800 contacts, 8 tracks, 6,000 answer rows). Idempotent
   delete-then-insert of `seed_perf_`-prefixed rows only; did not touch the
   demo seed rows from step 4.
6. Started `npx wrangler dev --port 8803` (8803 reserved for this lane per
   task instructions — never 8787/8801) in the background; confirmed
   `Ready on http://localhost:8803` and bindings (D1/KV/R2/ASSETS) attached.
7. `PERF_URL=http://localhost:8803 npm run perf:smoke` — script convention
   confirmed by reading `scripts/perf-smoke.ts`: reads `PERF_URL` env var
   (default `http://localhost:8787`), so it was overridden explicitly for
   port 8803. 5 warmup + 30 measured iterations per check.
8. Stopped the `wrangler dev` process after the run (`pkill -f "wrangler dev
   --port 8803"`); confirmed port 8803 free afterward.

## Measured p95 (budget: 150ms, DEC-058/prior w13-d gate)

| endpoint                          | p95 (ms) | status |
|------------------------------------|---------:|--------|
| submissions list (page 1)          |     10.7 | ok     |
| submissions list (q=Kubernetes)    |     11.3 | ok     |
| submission detail                  |     12.3 | ok     |
| event overview                     |      9.8 | ok     |

All four checks passed well under budget (comparable to w13-d's
7.6-13.2ms baseline; well below w15-d's 24.1-37.2ms — no regression
signal, normal run-to-run variance on a local Miniflare/D1 harness).

`perf:smoke` script exit code: 0 ("perf:smoke OK").

## Scope note (DEC-077 log-only lane)

This lane touched only `docs/verification-log.md` and
`docs/verification-log/task-w16-c-perf-smoke.md` — no `src/`, `app/`,
`scripts/`, or `migrations/` changes. No defects were found; nothing to
report as an open item.

RESULT: PASS
