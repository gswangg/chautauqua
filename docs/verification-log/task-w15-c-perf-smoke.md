# task-w15-c — perf-smoke @ 1033d45

Gate lane (DEC-196, wave 15). Fresh detached worktree
`chautauqua-wt/task-w15-c-perfrun` at `1033d45` ("merge task-w14-c"),
port 8952 per DEC-196's lane->port mapping (walkthrough=8951,
perf-smoke=8952).

## Preconditions (DEC-196)

- `S'''' = 1033d45` per DEC-114 (newest code-bearing first-parent
  commit on `main` at gate start) — matches expected.
- `git merge-base --is-ancestor 2dd2f33 1033d45` — YES.
- `git merge-base --is-ancestor 7f7477e 1033d45` — YES.
- Marker greps at `1033d45`, all present:
  - `DEC-191` and `contactId: null` in `src/routes/api/users.ts`
    (line 88) and `src/routes/review.ts` (line 470).
  - `data-required` in `src/views/form-render.tsx` (lines 33/43/55/85).
  - `chunkSelection` and `/tracks` in
    `app/src/pages/submissions/SubmissionsTable.tsx`.
  - `git ls-tree -r 1033d45 --name-only` lists
    `test/email-log-null-contact.test.ts`,
    `test/form-render-rules.test.ts`,
    `app/src/pages/submissions/bulk.ts`,
    `app/src/pages/submissions/bulk.test.ts`, and `.dev.vars.example`;
    it does NOT list `.dev.vars`.
- Dedupe check: no pre-existing `perf-smoke @ 1033d45` PASS section on
  `main` before this run.

## Steps run

1. `git worktree add --detach chautauqua-wt/task-w15-c-perfrun 1033d45`
   — clean checkout, detached HEAD confirmed at `1033d45`.
2. Confirmed no `.dev.vars` file present in the fresh worktree (never
   read/printed one).
3. `npm ci --prefer-offline --no-audit --no-fund --silent` — clean
   install, no errors.
4. `npm run build` — `tsc --noEmit` (root), `tsc --noEmit -p
   app/tsconfig.json`, `vite build` all succeeded, largest chunk
   `index-C0u1DC3L.js` 180.16 kB / 58.90 kB gz.
5. `npm run db:migrate` — 14 migrations (`0000`..`0013`) applied
   cleanly to local D1 (`chautauqua`), no errors.
6. `npm run seed` — required first (same dependency documented at
   w16-c/w15-d): `scripts/perf-smoke.ts` logs in as the fixture
   organizer from `docs/fixtures/sample-data.json`
   `identities.organizer`, which only exists after the regular demo
   seed runs. Confirmed empirically: running `perf:smoke` before `npm
   run seed` fails at `POST /login` with `401` (not a regression —
   same precondition as every prior perf-smoke gate).
7. `npm run perf:seed` — emitted `.perf-seed.sql`, applied via
   `wrangler d1 execute chautauqua --local --file=.perf-seed.sql`.
   Idempotent delete-then-insert of `seed_perf_`-prefixed rows only;
   does not touch the demo seed rows from step 6.
8. Started `npx wrangler dev --port 8952` in the background; confirmed
   `Ready on http://localhost:8952` and `GET / 200 OK`.
9. `PERF_URL=http://localhost:8952 npm run perf:smoke` — 5 warmup + 30
   measured iterations per check; all timed probes, the DEC-089/DEC-094
   301-id `schedule.ics` cap assertion (400 expected/received), and the
   DEC-105 CSV export-size probes (submissions.csv >= 2001 lines,
   showflow.csv >= 301 lines) all passed. Script exited 0 with
   `perf:smoke OK`.
10. Stopped the `wrangler dev` process (`pkill -f "wrangler dev
    --port 8952"`); confirmed port 8952 free afterward.

## p95 results (30 measured iterations, 150ms budget)

| Probe | p95 | Status |
|---|---|---|
| submissions list (page 1) | 9.5ms | ok |
| submissions list (q=Kubernetes) | 11.5ms | ok |
| submission detail | 12.5ms | ok |
| event overview | 12.8ms | ok |
| organizer agenda (300 accepted) | 20.0ms | ok |
| public sessions page | 3.4ms | ok |
| public agenda | 6.6ms | ok |
| schedule.ics 150 ids | 35.4ms | ok |
| plan progress (12 reviewers) | 19.2ms | ok |
| rating PUT | 9.3ms | ok |

All 10 timed probes within the 150ms budget (largest 35.4ms, well
inside envelope, consistent with the <150ms envelope observed at
`7f7477e`).

## Note on DEC-193 client-side chunking

`app/src/pages/submissions/bulk.ts`'s 500/batch client-side chunking
(DEC-193) does not change the server's DEC-182 1000-id cap; this gate
does not probe a server-side cap change and none was observed.

## Secrets

No `.dev.vars` file was read or printed at any point during this run.
`git ls-tree -r 1033d45 --name-only` confirms `.dev.vars.example`
present and `.dev.vars` absent from the tree.

**OPEN ITEMS: 0**

**RESULT: PASS**
