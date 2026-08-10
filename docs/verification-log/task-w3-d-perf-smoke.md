# task-w3-d — perf-smoke gate detail

Newest code-bearing main short-sha per DEC-091 (same as task-w3-a's
determination): `3878d4f` ("merge task-w2-d", which brings in
`2887db0` DEC-089's walkthrough "scale" area — the last commit that
touches `scripts/` or `src/`; every commit after it through current
main tip `d6bc978` is log-only per its own commit message: `f9a33fd`
scribe bookkeeping, `31fa021`/`1c75d92` task-w3-a barrier, `fc32e81`/
`d6bc978` task-w3-b build+test gate).

Sequence run in worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/
Projects/chautauqua-wt/task-w3-d` (branch fresh off main @ `1c75d92`,
code identical to `3878d4f` for all files this gate touches):

1. `npm run db:migrate` — all 10 migrations applied (0000-0009), clean.
2. `npm run seed` — demo seed + R2 objects loaded, clean.
3. `npm run perf:seed` — regenerated the 2k-row perf event plus the
   DEC-088 extension (10 rooms, 300 scheduled slots, plan
   `seed_perf_plan_0001`, 12 reviewers, 600 evaluations), clean.
4. `npx wrangler dev --port 8803` — started, `/health` returned
   `{"ok":true}` on first poll.
5. `PERF_URL=http://localhost:8803 PERF_P95_BUDGET_MS=150 npm run
   perf:smoke` — **failed before any timed check ran**:

   ```
   Error: fetchAcceptedSubmissionIds: expected at least 301 accepted
   submissions, got 200
       at fetchAcceptedSubmissionIds (scripts/perf-smoke.ts:166:11)
       at async main (scripts/perf-smoke.ts:181:18)
   ```

Root cause (confirmed by reading source, not fixed — DEC-077 code
freeze): `scripts/perf-smoke.ts`'s DEC-089 one-shot 301-id
`schedule.ics` cap-assertion probe calls
`fetchAcceptedSubmissionIds(headers, 301)`, which does
`GET /api/v1/events/{id}/submissions?status=accepted&perPage=301` and
requires the response to contain >= 301 items. Two independent
constraints collide:

- `src/lib/pagination.ts` clamps any requested `perPage` to `[1, 200]`
  server-side, so the request can never return more than 200 items
  regardless of how many accepted rows exist (this is why the error
  reports "got 200", not 300).
- Even without the clamp, DEC-088's perf-seed only creates exactly 300
  `accepted`-status submissions (`PERF_STATUS_COUNTS.accepted = 300` in
  `scripts/perf-seed-lib.ts`), one short of the 301 the cap-assertion
  probe needs to fetch via a single page.

Because `fetchAcceptedSubmissionIds` throws, `main()` never reaches the
timed check loop, so none of the p95-budgeted checks (submissions list,
agenda, 150-id schedule.ics, plan progress, reviewer rating PUT) ran
this cycle — no p95 table to report. The DEC-080 301-id cap assertion
itself also never executed (it depends on the same helper).

p95 table: not applicable — run aborted before the timed loop (see
above).

400-assertion outcome: not applicable — run aborted before the 301-id
`schedule.ics` request was issued.

`npx wrangler dev --port 8803` was killed after the failure (confirmed
`/health` no longer responding). No product/test/script/config changes
were made in this worktree (DEC-077 code freeze honored); this section
and this section alone was committed.

Re-checked main after the run: `d6bc978` ("merge task-w3-b") is the
current tip, log-only (task-w3-b's build+test gate result), no
code-bearing merge landed mid-run. Newest code-bearing sha is still
`3878d4f`.

OPEN ITEMS: 1 — `scripts/perf-smoke.ts`'s DEC-089 cap-assertion probe
requests 301 accepted-submission ids via a single `perPage=301` page,
which both the 200-row server-side pagination clamp
(`src/lib/pagination.ts`) and DEC-088's 300-row accepted-submission
seed count make unreachable; either the probe needs to paginate/use a
larger accepted count, or DEC-088's accepted count needs to exceed 300,
or the pagination clamp needs a documented exception — a design
decision outside this gate's code-frozen scope.

RESULT: FAIL — perf-smoke aborted before the timed loop: the DEC-089
301-id cap-assertion helper cannot fetch 301 accepted-submission ids
(pagination clamped to 200; only 300 accepted submissions seeded), so
no p95 checks and no 400-cap assertion ran this cycle.
