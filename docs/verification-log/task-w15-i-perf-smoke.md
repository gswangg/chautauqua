# 2026-08-10 task-w15-i — perf-smoke @ 675219f

Full detail for the `## 2026-08-10 task-w15-i — perf-smoke @ 675219f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Gate re-run (DEC-069 scope 3, DEC-077 log-only lane, code-frozen — only
this file modified). DEC-114 first-parent walk from main tip `21ea856`:
that commit's diff (`decisions/DEC-127.md`, `field-guide/index.md`,
`src/decisions.ts`) is entirely within the DEC-077/114 bookkeeping
exclusion set, so it is not code-bearing; its first parent `675219f`
("merge task-w14-k") touches `src/routes/portal/edit.tsx`,
`src/server/repo/portal-edit.ts`, and three test files — code-bearing.
Newest code-bearing sha: `675219f`, matching DEC-127's expectation.

DEC-127 six-marker preflight (all present in-tree at this sha before
running anything): `src/routes/tasks.ts:235` DEC-120 cross-org contact
guard; `src/server/repo/portal-edit.ts:16,123-125,184`
`LOCKED_SPEAKER_FIELDS` prefill-from-contact; `src/routes/comms.ts:30`
`requireFullMatch`; `src/routes/review.ts:224` DEC-123 conflict guard;
`src/forms/validate.ts:8` `MAX_TEXT_LENGTH`; `scripts/perf-seed.ts:273`
`kind: "rating"`. All six confirmed present — proceeded.

Procedure (mirrors task-w16-c, fresh port per DEC-127): `npm ci`
(node_modules already present, skipped), `rm -rf .wrangler`, `npm run
db:migrate` (10 migrations 0000-0009, all ✅), `npm run seed` (fixture
organizer login user + R2 objects), `npm run perf:seed` (DEC-088 scale:
2k submissions/300 accepted for `seed_perf_event`, 12
`seed_perf_reviewer*` users). Spot-checked the DEC-125 fix directly via
`wrangler d1 execute --local`: `evaluation_plan.criteria_json` for
`seed_perf_event` = `[{"id":"overall","label":"Overall","kind":"rating","weight":1}]`
— `kind:"rating"` present, confirming DEC-125 in effect. Started `npx
wrangler dev --port 8852` in background (8852 per DEC-127, distinct
from 8851/walkthrough and 8853/triage and every prior-wave port);
`/health` returned 200. Ran `PERF_URL=http://localhost:8852 npm run
perf:smoke`.

p95 over 30 measured iterations (budget 150ms): submissions list (page
1) 13.1ms, submissions list (q=Kubernetes) 9.9ms, submission detail
14.0ms, event overview 11.5ms, organizer agenda (300 accepted) 19.1ms,
public sessions page 3.7ms, public agenda 4.8ms, schedule.ics 150 ids
31.8ms, plan progress (12 reviewers) 18.4ms, rating PUT 9.1ms — all
`ok`, all well under the 150ms budget, `perf:smoke OK`.

**Rating PUT probe (evaluation criteria discriminant) — the exact check
that returned 400 at task-w11-d @3b7ed3d due to the
`scripts/perf-seed.ts` seed omitting `kind:"rating"` from
`criteria_json`, blocking the evaluation submission's rating-field
validation — now succeeds (9.1ms, `ok`) at `675219f` with DEC-125 in
tree.** DEC-104 overview.ts chunking (the w7-c/w8-b OPEN ITEM,
previously closed) re-confirmed still in tree at this sha:
`src/server/repo/overview.ts:11` imports `chunkIds`;
`overview.ts:170` batches `placedIds` via `for (const batch of
chunkIds(placedIds))` — "event overview" check completed all 30
measured iterations with 200 on every request, p95 11.5ms, no
regression. DEC-089 perf-smoke script structure (10-check battery,
5-warmup + 30-measured timed loop, 150ms budget) ran unmodified and
completed end-to-end with zero non-`ok` rows and zero non-200
responses. DEC-105 timed vs. untimed probe distinction: all 10 rows
above are the timed/measured probes; the untimed setup calls (login,
seed verification via `wrangler d1 execute`, health check) completed
without error prior to the timed loop, consistent with DEC-105's
separation.

Killed `wrangler dev --port 8852` after the run; `curl
http://localhost:8852/health` afterward returned no response
(connection refused), confirming clean shutdown.

Full ten-check output logged above; no code changes made (log-only
lane per DEC-077 — only `docs/verification-log.md` modified).

OPEN ITEMS: 0

RESULT: PASS
