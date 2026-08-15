## 2026-08-12 task-w17-d — perf:smoke @ 2,000-submission seed, DEC-449 acceptance (DEC-453)

Evidence lane, log-only: no source file was changed by this task. Full transcript, per-check
verdicts, and grading detail are in `docs/verification-log/task-w17-d-perf-smoke-stage1.md`.

Sha measured: `93eabca` (`merge task-w17-a`, HEAD of `main` at cut time, includes `88aa7e1 Fix
reviewer-queue read-budget miss by deleting dead chunked round trips (DEC-449)`). Fresh worktree
(no prior `.wrangler/state/v3`), `npm run db:migrate && npm run seed && npm run perf:seed`, `npm
run dev -- --port 8798 --var PUBLIC_BASE_URL:http://localhost:8798` per DEC-448, then `PERF_URL=
http://localhost:8798 npm run perf:smoke` run four times back to back against the same seed and
server process.

All 21 checks PASSED on all 4 runs (84/84 individual results PASS); exit codes `0, 0, 0, 0`.

- **(i) reviewer queue (DEC-449 acceptance):** 13.3-19.9ms adjusted p95 across all 4 runs, wide
  margin under the 50ms read budget — down from w16-c's pre-fix 54-88ms (4/4 FAIL). No surviving
  over-budget mechanism found; DEC-449's fix (`88aa7e1`, deleting the chunked per-90-id lookups in
  `src/server/repo/review/submissions.ts` and `src/server/repo/review/evaluations.ts`) confirmed
  effective at the perf seed's own unrestricted-reviewer, 2,000-submission scale. **CLOSED.**
- **(ii) plan results (page 1) and bare schedule.ics:** re-confirmed PASS all 4 runs (14.0-17.9ms
  and 1.6-2.2ms adjusted respectively, both wide margins) — no regression from w16-c's closure.
- **(iii) event overview** (w16-c saw 1/4 FAIL at 55.8ms): did **not** reproduce — 17.3-21.8ms
  adjusted p95, 4/4 PASS, no run near budget. Read as transient host contention at w16-c's
  measurement time (that lane logged five concurrent node/wrangler processes vs. this lane's
  three), not a reproducible query-shape defect; no open item raised.

OPEN ITEMS: 0

RESULT: PASS — all 21 perf:smoke checks green on 4/4 runs at the DEC-449 sha; the reviewer-queue
read-budget miss that drove w16-c's FAIL is confirmed closed with wide margin, and w16-c's
event-overview flake did not reproduce.

