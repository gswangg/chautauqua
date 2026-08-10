# task-w3-e — spec-audit gate detail

Reopened-run (DEC-086/DEC-090) SPEC §8/§9 static audit, code-frozen per
DEC-077 (log-only lane), fresh worktree of `main`. Newest code-bearing
short-sha per DEC-091: `3878d4f` ("merge task-w2-d") — confirmed via
`git diff 3878d4f..HEAD --stat` at the branch point (`1c75d92`, "merge
task-w3-a"): only `decisions/DEC-090.md`, `decisions/DEC-091.md`,
`docs/verification-log.md`, `field-guide/index.md`, and a 2-line
scribe-owned addition to `src/decisions.ts` changed — no product/test/
script/config changes, matching task-w3-a's own log entry.

SPEC §8/§9 checks (mirroring task-w13-e/w15-e/w16-d):
- `README.md:19-22` quickstart (`npm i`, `db:migrate`, `seed`, `dev`)
  matches SPEC.md:361 verbatim.
- `README.md:34-59` "For evaluators" persona credentials
  (`sbek-organizer@example.com`/`SbekTest!2027-org`, speaker/speaker2/
  reviewer rows) match `docs/fixtures/sample-data.json` `identities`
  block verbatim, byte-for-byte on email/password.
- `.github/workflows/ci.yml:21-24` covers build+bundle:check+test;
  lines 34-52 the `perf-smoke` job; lines 65-82 the `walkthrough` job —
  SPEC.md:367 "CI: typecheck + unit tests" plus the DEC-063
  perf/walkthrough jobs both present, unchanged since w16-d.
- SPEC §9 four invariants still have passing regression tests, same
  locations as w16-d: close-date lock / speaker isolation
  (`test/edit-lock.test.ts`, `test/submit-core.test.ts`), hidden-speaker
  exclusion (`test/task-file-access.test.ts:117`,
  `test/headshot-gate.test.ts:80`), decision-never-auto-emails
  (`test/spec9-invariants.test.ts:57` describe block, confirmed present).

Reopened-run scale-path re-verification (a):
- Chunked bulk status with plan-before-commit:
  `src/server/repo/submissions/status.ts:15` imports `chunkIds`
  (`../../../lib/chunk`), line 18 references `DEC_079`, line 58 chunks
  `participantContactIds` before `planAcceptance` (line 71) runs, and
  line 111-115's comment plus the line-128/168 `chunkIds(ids)` loops
  confirm planning-before-UPDATE ordering and chunked batched writes.
- Chunked public hydration + 300-id cap: `src/server/repo/public.ts`
  imports `chunkIds` (line 13) and chunks at lines 157/178/210/286;
  `src/lib/itinerary.ts:11` defines `MAX_ITINERARY_IDS = 300`;
  `src/routes/public.tsx:581-582` rejects `ids.length > MAX_ITINERARY_IDS`
  on the `.ics` route with a 400 `ApiError`.
- Set-based reviewer scope + targeted counts + three-arg
  `listEvaluationsForPlan`: `src/domain/evaluation.ts:289`
  `resolveAssignments`; `src/server/repo/review.ts:343-351` calls it
  from a single set-based load; `src/server/repo/review.ts:528`
  `listEvaluationsForPlan(db: Db, planId: string, round: number)`.
- Multi-round with advance-round 409:
  `src/routes/review.ts:224-226` `POST /api/v1/plans/:id/advance-round`
  comment confirms current_round+1 with 409 on repeat.
- Versioned pubcache purge: `src/server/pubcache.ts:1-20` documents the
  DEC-083 versioned-key purge design and exports `PUBVER_KEY =
  "chq:pubver"`.
- Image-dims gate: `src/lib/image-dims.ts:10`
  `MAX_HEADSHOT_EDGE_PX = 2048`.

Reopened-run DEC-086 probe re-verification (b):
- `scripts/perf-smoke.ts:8,177-186` one-shot 301-id `schedule.ics`
  request asserting exactly 400, independent of the timed 150-id check
  at lines 241-246; line 33 the `perf.reviewer.1@example-perf.test`
  rating probe; line 237-238 the public agenda check.
- `scripts/walkthrough/scale.ts:42` `SCALE_COUNT = 110`; step 1
  (lines 168-208) 110 fresh contacts/submissions/speaker participants;
  step 2 (lines 213-223) one bulk-accept POST of 110 ids exercising
  DEC-078/079 chunking; step 4 (lines 228-292) re-POST identical bulk
  status asserting exactly-once (assignment counts unchanged); step 5
  (lines 296-347) dev-mailbox message count unchanged by the bulk
  accept; step 6 (lines 351+) the purge-refresh probe (public submit ->
  claim -> organizer accept -> speaker portal edit -> immediate
  `/e/<slug>/sessions` title check, per DEC-083 immediate-purge, no
  60s staleness).

`npm run build` and `npm test --silent`: ALL PASS (94 files / 971 tests,
0 failures, identical counts to task-w3-a's barrier run). No product/
test/script/config changes made in this lane (DEC-077 code-frozen gate);
this commit touches only `docs/verification-log.md`.

OPEN ITEMS: 0

RESULT: PASS
