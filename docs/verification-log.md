# Verification Log
Append-only. One dated section per run.

Per-run full detail lives under `docs/verification-log/<file>.md` (one file
per section below, extracted to reduce merge contention on this file — see
DEC-068/DEC-069). Each section here keeps the exact `## <date> <branch> —
<scope> @ <sha>` header and, where applicable, the closing `RESULT:` /
`OPEN ITEMS:` line verbatim, so this file alone remains sufficient for the
DEC-069 exit-predicate grep.

## 2026-08-10 task-w12-a — build+test @ 01c6ace

Full detail: docs/verification-log/task-w12-a-build-test.md

- install/build/unit tests: ALL PASS (334 packages; 81 files / 859 tests, 0
  failures). No fixes required.

## 2026-08-10 task-w12-c — commit-body triage @ f6e3422

Full detail: docs/verification-log/task-w12-c-triage.md

Triage table of 6 PLANNER:/defect notes harvested from wave-8/10 merge
commit bodies: 3 fixed-cite/fixed-here (already resolved on main), 3
open-PLANNER (feature gaps at the time; all 3 later resolved — see
task-w13-c below).

## 2026-08-10 task-w12-b — walkthrough @ f6e3422

Full detail: docs/verification-log/task-w12-b-walkthrough.md

- install/build/migrate/seed/wrangler-dev/walkthrough (producer, review,
  speaker, public, data — J1-J12): ALL PASS. No FAIL lines, no PLANNER:
  lines. (Note: port 8787 collision with a concurrent worktree worked
  around by re-running on port 8797; not a product defect.)

## 2026-08-10 task-w13-a — build+test @ 0ee30dd

Full detail: docs/verification-log/task-w13-a-build-test.md

- install/build/bundle:check/test: ALL PASS (82 files / 861 tests). No
  product-code changes required.

RESULT: PASS

## 2026-08-10 task-w13-b — walkthrough @ 0ee30dd

Full detail: docs/verification-log/task-w13-b-walkthrough.md

- install/migrate/seed/wrangler-dev/walkthrough (producer, review, speaker,
  public, data — J1-J12): ALL PASS. No FAIL lines, no PLANNER: lines.

RESULT: PASS

## 2026-08-10 task-w13-d — perf-smoke @ 0ee30dd

Full detail: docs/verification-log/task-w13-d-perf-smoke.md

- perf:seed (2k-row scale) + perf:smoke, p95 < 150ms budget on submissions
  list/search, submission detail, event overview: ALL PASS (7.6-13.2ms
  measured). build + test also PASS in the same worktree.

RESULT: PASS

## 2026-08-10 task-w13-e — spec-audit @ 0ee30dd

Full detail: docs/verification-log/task-w13-e-spec-audit.md

- SPEC §8 quickstart/README parity, README evaluator credentials vs
  fixtures, CI typecheck+test coverage, SPEC §9 four named invariants
  (close-date lock, speaker isolation, hidden-speaker exclusion,
  decision-does-not-auto-email): ALL PASS. One new regression test added
  (test/spec9-invariants.test.ts). Full suite 83 files / 862 tests PASS.

RESULT: PASS

## 2026-08-10 task-w13-c — triage closure @ d4ebf7f

Full detail: docs/verification-log/task-w13-c-triage-closure.md

Dispositioned the three open-PLANNER: rows from task-w12-c: 2 got real
inline fixes (co-presenter invite endpoint, participant-visibility toggle
endpoint, both with authz + regression tests), 1 got a test-tree-only fix
(cross-org export isolation, fake-db unit test) since touching
scripts/seed.ts is out of scope under the no-eval-gaming rule. No FAIL
bullets anywhere in the log. Full suite 84 files / 869 tests PASS.

OPEN ITEMS: 0

## 2026-08-10 task-w14-g — walkthrough module runs @ 64141d0

scripts/walkthrough/speaker.ts and scripts/walkthrough/public.ts converted
from direct `wrangler d1 execute --local` fixture workarounds to the real
DEC-070 organizer endpoints (POST /api/v1/submissions/:id/participants,
PATCH /api/v1/submissions/:id/participants/:participantId). Added one new
authz probe (speaker session POSTing the invite endpoint -> 403).

- `npm run build` and `npm test` (89 files / 898 tests): ALL PASS.
- Fresh `npm run db:migrate && npm run seed` against a local wrangler dev
  on port 8799 (avoiding the port-8787 collision noted for concurrent
  worktrees in this log), then:
  - `npx tsx scripts/walkthrough/speaker.ts --url http://localhost:8799`:
    ALL PASS (49 checks, including the new 403 authz probe and both
    co-presenter invite calls returning inviteStatus 'invited').
  - `npx tsx scripts/walkthrough/public.ts --url http://localhost:8799`:
    ALL PASS (27 checks, including the hidden-participant visibility gate
    via the PATCH endpoint).

RESULT: PASS

## 2026-08-10 task-w15-a — walkthrough endpoint-conversion closeout @ 0ba550c

Re-verified DEC-076's single code barrier: confirmed task-w14-g's endpoint
conversion is already on main. `grep -n "INSERT INTO participant\|UPDATE
participant SET visible\|no admin API" scripts/walkthrough/speaker.ts
scripts/walkthrough/public.ts` returns nothing — no direct-SQL participant
writes, no stale "stage 1 has no admin API" comments remain. Both scripts
already call POST /api/v1/submissions/:id/participants and PATCH
/api/v1/submissions/:id/participants/:participantId per DEC-070/DEC-053.

- `npm run build` and `npm test` (89 files / 898 tests): ALL PASS.
- `npx vitest run test/walkthrough-lib.test.ts`: ALL PASS (10 tests).

No product-code or script changes required; this task is verification-only
per the task's own instruction (task overlapped in-flight task-w14-g, which
had already landed the conversion by the time this task started).

RESULT: PASS

## 2026-08-10 task-w15-b — build+test @ 7c4101c

Full detail: docs/verification-log/task-w15-b-build-test.md

DEC-068/069 gate lane, fresh worktree of main (`7c4101c`, "merge
task-w15-a"). `npm ci`, `npm run build` (tsc x2 + vite), `npm test`
(89 files / 898 tests, includes `test/bundle-check.test.ts` for the
DEC-058 js+css<300KB gz budget): ALL PASS. No trivial breakages hit; no
inline fixes needed. Verification-only — no product code or scripts
changed, so this merge is NOT code-bearing and does not invalidate
sibling gates under DEC-076.

RESULT: PASS

## 2026-08-10 task-w15-e — spec-audit @ 7c4101c

Re-ran the task-w13-e SPEC §8/§9 checklist at the post-DEC-076-barrier sha
in a fresh worktree of `main` (`7c4101c`). README/package.json quickstart
parity and evaluator credentials still match `docs/fixtures/sample-data.json`
verbatim; CI still covers typecheck+test plus the DEC-063 `walkthrough` job;
all four SPEC §9 invariants (close-date lock, speaker isolation,
hidden-speaker exclusion, decision-never-auto-emails) still have passing
regression tests, unchanged since w13-e. Confirmed all four wave-14 security
fixes carry regression tests on `main`: DEC-074
`test/portal-edit-track-validation.test.ts`, DEC-071
`test/portal-link-absolute.test.ts`, DEC-072
`test/rate-limit-identity-keys.test.ts`, and DEC-073's roomId test —
located at `test/agenda-room-ownership.test.ts` rather than the task's
file hint — covering both the write-path rejection
(`roomBelongsToEvent` in `src/routes/agenda.ts:60`) and the event-scoped
public room lookup (`src/server/repo/public.ts:361`). DEC-070's endpoints
reject cross-org callers — coverage lives in `test/api-participants.test.ts`
(two "cross-org isolation" tests, lines 190/259), not
`test/api-submissions.test.ts` as hinted; `api-submissions.test.ts:268`
only carries an unrelated tripwire count for the DEC-070 module move. No
invariant lacked a test, so no new test was added (verification-only, not
code-bearing). `npm run build` and `npm test` (89 files / 898 tests): ALL
PASS. Full detail: `docs/verification-log/task-w15-e-spec-audit.md`.

RESULT: PASS

## 2026-08-10 task-w15-c — walkthrough @ 7c4101c

Full detail: docs/verification-log/task-w15-c-walkthrough.md

Full J1-J12 gate in a clean worktree of main at `7c4101c` (post-barrier
per DEC-076): `npm ci`, `npm run build`, `npm test` (89 files / 898 tests)
all PASS. Fresh `npm run db:migrate` + `npm run seed` against local
wrangler dev on port 8811 (8787 was free but 8811 chosen defensively
against concurrent sibling-gate worktrees). Ran
`npx tsx scripts/walkthrough.ts --url http://localhost:8811` (DEC-062
order producer -> review -> speaker -> public -> data): ALL PASS, no FAIL
or PLANNER: lines. Explicitly confirmed the newly-converted DEC-070
participant invite/visibility endpoint calls ran and passed (co-presenter
invite, IDOR rejection, accept/decline, organizer-only authz probe in
speaker.ts; hidden-participant visibility gate in public.ts) — no
direct-SQL fallback remains in either script.

RESULT: PASS

## 2026-08-10 task-w15-d — perf-smoke @ 7c4101c

Full detail: docs/verification-log/task-w15-d-perf-smoke.md

Post-barrier (DEC-076) perf smoke, mirroring the CI `perf-smoke` job:
`npm run db:migrate` (9 migrations 0000-0008), `npm run seed`, `npm run
perf:seed` (2k-row scale), `wrangler dev` health-checked, then `npm run
perf:smoke` — p95 24.1-37.2ms, all under the 150ms budget (higher than
w13-d's 7.6-13.2ms but no regression per task guidance: large regressions
are the signal, not tuning). Also ran `npm run build` and `npm test`
(89 files / 898 tests) in the same worktree: ALL PASS.

RESULT: PASS

## 2026-08-10 task-w15-f — triage-closure @ ce451d9

Full detail: docs/verification-log/task-w15-f-triage-closure.md

Clean worktree of latest main at `ce451d9` (post walkthrough-gate w15-c,
per DEC-076 chain order). Dispositioned the three w12-c open-PLANNER
rows (all already closed on main per DEC-070/075: co-presenter invite +
visibility PATCH endpoints with route + repo tests, walkthrough scripts
converted off direct-SQL, and a route-level cross-org export test
covering every `EXPORT_KINDS` entry plus showflow.csv), harvested
merge-commit bodies `0ee30dd..HEAD` for `PLANNER:` notes (none found —
re-checked reflog/branch list to confirm no branch silently dropped),
and confirmed `docs/verification-log.md` carries zero unresolved
`RESULT: FAIL` lines. `npm run build` and `npm test` (89 files / 898
tests): ALL PASS.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w16-a — build+test @ 7ac6aef

Full detail: docs/verification-log/task-w16-a-build-test.md

Wave-16 gate re-run in a fresh worktree of main at `7ac6aef` (at/after
a05f17f, confirmed via merge-base ancestor check). `npm run build`
(root + app/ tsc --noEmit, then vite build) PASS; `npm run bundle:check`
PASS (entry 58.59 kB gzip vs 300 kB budget); `npm test --silent` PASS —
89 test files, 898 tests, no failures or skips. No code changes made
(log-only lane, DEC-077).

RESULT: PASS

## 2026-08-10 task-w16-b — walkthrough @ 7ac6aef

Full detail: docs/verification-log/task-w16-b-walkthrough.md

J1-J12 gate re-run (log-only lane, DEC-077) against main at `7ac6aef`
(later than the `0ba550c` floor; intervening commits are scribe
bookkeeping, non-code-bearing). Fresh `npm ci`, `npm run build`,
`npm run db:migrate` (9 migrations), `npm run seed`, `wrangler dev` on
port 8801 (reserved, not 8787), then `npm run walkthrough -- --url
http://localhost:8801` running producer -> review -> speaker -> public ->
data in order: 5/16/50/29/20 checks respectively, all PASS, zero FAIL or
PLANNER: lines anywhere in the output.

RESULT: PASS

## 2026-08-10 task-w16-d — spec-audit @ 7ac6aef

Full detail: docs/verification-log/task-w16-d-spec-audit.md

Wave-16 code-frozen (DEC-077) re-run of the SPEC §8/§9 static audit in a
fresh worktree of `main` at `7ac6aef`. Confirmed via `git diff
7c4101c..HEAD --stat` that zero source/test/config files changed since
the w15-e spec-audit ran at `7c4101c` (only scribe bookkeeping: DEC-077,
field-guide, `src/decisions.ts` +1 line, verification-log entries). §8
quickstart commands (`db:migrate`, `seed`, `walkthrough`, `perf:*`,
`test`) match README verbatim; README evaluator credentials diffed
exactly against `docs/fixtures/sample-data.json`; CI covers typecheck +
test + bundle:check + the DEC-063 `walkthrough` job; all four SPEC §9
invariants (close-date lock, speaker isolation, hidden-speaker exclusion,
decision-never-auto-emails) re-confirmed against
`test/edit-lock.test.ts` + `test/submit-core.test.ts`,
`test/task-file-access.test.ts:117`, `test/headshot-gate.test.ts:80`, and
`test/spec9-invariants.test.ts:58` respectively — all pre-existing, no
gap, no test added (log-only lane per DEC-077). DEC-005 route map
spot-checked against `src/index.ts` mounts and leaf routes in
`src/routes/public.tsx` / `src/routes/files.ts` — matches. `npm run
build` and `npm test` both PASS (89 files / 898 tests, identical to
w15-e).

RESULT: PASS

## 2026-08-10 task-w16-c — perf-smoke @ 7ac6aef

Gate re-run (DEC-077 log-only lane): `npm ci`, `npm run build` (tsc x2 +
vite build), `npm run db:migrate` (9 migrations), `npm run seed` (required
first — `perf:seed` seeds only synthetic 2k-row data, not a login-capable
user; the smoke script logs in as the fixture organizer), `npm run
perf:seed` (2k-row scale), `wrangler dev --port 8803` (8803 reserved for
this lane, never 8787/8801), `PERF_URL=http://localhost:8803 npm run
perf:smoke`. Full detail: docs/verification-log/task-w16-c-perf-smoke.md

p95 over 30 measured iterations (budget 150ms): submissions list (page 1)
10.7ms, submissions list (q=Kubernetes) 11.3ms, submission detail 12.3ms,
event overview 9.8ms — all well under budget, no regression vs prior
gates.

RESULT: PASS

## 2026-08-10 task-w16-e — triage-closure @ 5692a6d

Full detail: docs/verification-log/task-w16-e-triage-closure.md

Log-only lane (DEC-077), branched from main at `5692a6d` ("merge
task-w16-b"), after task-w16-b's walkthrough gate merged. Harvested
`git log --format='%h %B' 0ee30dd..HEAD | grep -n 'PLANNER:'`: one hit,
which is prose inside task-w15-f's own commit body reporting its
(negative) sweep result, not a live marker — no outstanding `PLANNER:`
notes. Re-confirmed the three w12-c items closed per DEC-075
(co-presenter invite `POST /api/v1/submissions/:id/participants` and
visibility toggle `PATCH .../participants/:participantId` in
`src/routes/api/submissions.ts` backed by `src/server/repo/
participants.ts` (DEC-070); cross-org export isolation across all
`EXPORT_KINDS` plus showflow.csv in `test/exports-cross-org.test.ts`).
Re-verified all eight external review-lens findings still hold at this
sha: claim peek-then-consume (`src/routes/auth.tsx:192-206`, DEC-064),
task-upload serving (`src/server/repo/files.ts:216-273`, DEC-065),
reviewer file access (`files.ts:119-136`, DEC-066), headshot visibility
gate (`src/server/repo/profile.ts:192-224`, DEC-067), portal_link
absolute origin (`src/routes/comms.ts:247-254` +
`src/routes/api/contacts.ts`, DEC-071), login limiter per-email+per-IP
(`src/routes/auth.tsx:107-130`, DEC-072), slot roomId event-scoping
(`src/routes/agenda.ts:60` + `repo/agenda.ts:120`, DEC-073), portal-edit
track validation (`src/routes/portal/edit.tsx:197`, DEC-074). Swept
task-w16-b's walkthrough section and detail file for FAIL/PLANNER: lines:
none found (task-w16-b's own grep already confirmed zero matches). No
code changes made (log-only lane).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-a — wave-2 closeout @ 3878d4f

Wave-2 closeout barrier (DEC-076/DEC-091). Grep-level re-verification of
everything the plan flagged as merged-during-planning at main `1cc3fe8`,
re-checked against the current tip:

VERIFIED (no changes needed):
- `migrations/0009_review_rounds.sql` present; `migrations/meta/
  _journal.json` idx 9 entry (`0009_review_rounds`, breakpoints true).
- `listEvaluationsForPlan(db: Db, planId: string, round: number)`
  three-arg signature in `src/server/repo/review.ts:528`.
- DEC-088 perf-seed artifacts in `scripts/perf-seed.ts`: `hashPassword`
  import, 10 rooms, `perf_reviewer` seed ids (12 reviewers), 600
  round-1 evaluations, `seed_perf_plan_0001`-style plan seeding.
- DEC-089 perf-smoke checks in `scripts/perf-smoke.ts`: one-shot 301-id
  `schedule.ics` request asserting exactly 400 (independent of the
  timed 150-id check), public agenda check, `perf.reviewer.1@example-
  perf.test` rating PUT.
- task-w2-d's walkthrough area "scale" was already merged: `WALKTHROUGH_
  AREAS` at `scripts/walkthrough-lib.ts:15` is `["producer", "review",
  "speaker", "public", "data", "scale"]` (scale last, per DEC-089);
  `scripts/walkthrough/scale.ts` exists and implements all six steps —
  110 fresh contacts/submissions/speaker participants, one bulk accept
  POST (110 ids), onboarding task_assignment sampling, exactly-once
  re-accept assertion, dev-mailbox-count-unchanged assertion, and a
  purge-refresh probe (public submit -> claim -> organizer accept ->
  speaker portal edit -> immediate `/e/<slug>/sessions` title check).
  Its header GAP NOTE documents that no organizer JSON PATCH-title
  route exists in `src/routes`, so the purge probe uses the real
  title-write path (speaker portal edit, DEC-041) instead — a narrowing
  the w2-d worker flagged rather than deciding broadly, consistent with
  DEC-083's "any successful mutation" purge trigger.
- `test/walkthrough-lib.test.ts` already asserts the six-area order and
  `modulePath("scale")`.

IMPLEMENTED: nothing — all DEC-087/088/089 artifacts and the DEC-089
walkthrough area were already merged onto main before this barrier ran
(landed via the late task-w1-d/w2-d branches noted in wave-3's field
guide entry). This lane made no source changes.

Newest code-bearing main short-sha per DEC-091 (skipping the
bookkeeping-only `f9a33fd` "scribe wave 3" commit, which touches only
`decisions/`, `field-guide/index.md`, and the scribe-owned constant
table in `src/decisions.ts`): `3878d4f` ("merge task-w2-d").

`npm run build` and `npm test` both green at this sha: 94 test files,
971 tests passed, 0 failed.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-b — build+test @ 3878d4f

DEC-069 build+test gate. Newest code-bearing main short-sha per DEC-091,
re-derived independently: walked `git log main` from tip `1c75d92`
(merge task-w3-a) backward — `1c75d92`/`31fa021` (task-w3-a barrier)
touch only `docs/verification-log.md`; `f9a33fd` ("scribe wave 3")
touches only `decisions/`, `field-guide/index.md`, and the
scribe-owned `src/decisions.ts` constant appends (DEC-076/077/090
exclusions). The next commit, `3878d4f` ("merge task-w2-d", DEC-089
walkthrough scale area: `scripts/walkthrough/scale.ts`,
`scripts/walkthrough-lib.ts`, `test/walkthrough-lib.test.ts`), is
code-bearing and is the cited sha. Built and tested at main tip
`1c75d92` (a strict git-ancestor superset containing `3878d4f`'s
changes plus only non-code-bearing commits on top), so results apply
to `3878d4f`.

Commands run from a fresh worktree (`git worktree add ... task-w3-b
main`), `npm ci` then:

- `npm run build` (`tsc --noEmit` root + `tsc --noEmit -p
  app/tsconfig.json` + `vite build --config app/vite.config.ts`):
  clean, 0 errors. Vite emitted 125 modules across 17 chunks (entry
  `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB largest).
- `npm test` (vitest run): **94 test files, 971 tests, all passed**, 0
  failed, 0 skipped. Duration 6.00s.
- `npm run bundle:check` (DEC-058 budget): entry bundle
  (`index-DOwNDQO_.js` + `index-easpJsYc.css`) = **58.60 kB gzip**
  against the 300.00 kB budget — PASSED, well under budget.

Post-run re-check: `git log --oneline -5 main` still shows tip
`1c75d92` — no code-bearing merge landed on main during this run, so
no sha-invalidation to note.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-e — spec-audit @ 3878d4f

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

## 2026-08-10 task-w3-f — triage-closure @ 2887db0

Newest code-bearing main short-sha per DEC-091: `2887db0` ("Add DEC-089
walkthrough area \"scale\"..."), skipping the bookkeeping-only commits
that follow it on main (`3878d4f` merge, `f9a33fd` scribe wave 3 —
decisions/field-guide/src/decisions.ts constant table only, `31fa021`
task-w3-a barrier — docs/verification-log.md only, `1c75d92` merge).

Item-by-item re-verification of every remaining docs/eval-findings.md entry:

- **Item 2 (at-most-once acceptance)** — CLOSED. DEC-079 landed:
  `src/server/repo/submissions/status.ts:104-142` (`updateSubmissionStatuses`)
  now runs `runAcceptancePlanning` BEFORE the row's status/`acceptedAt` UPDATE
  for a firing row (see the function doc comment at line ~99 and the
  `if (result.fireAcceptance)` block at line ~123-142); if planning throws,
  the row stays un-accepted so a retry re-fires. `fireAcceptance` trigger
  unchanged at `src/domain/status.ts:53-58`
  (`enteringAcceptedFirstTime = next === "accepted" && current.acceptedAt === null`).
  `void DEC_079;` reference present at `src/server/repo/submissions/status.ts:17`.

- **Item 3 (unchunked public inArray)** — CLOSED. DEC-080 landed:
  `src/lib/chunk.ts:1-13` defines `ID_CHUNK_SIZE=90`/`chunkIds`.
  `src/server/repo/public.ts` imports `chunkIds` (line 13) and batches every
  formerly-unbounded `inArray` — `hydrateSessions`-family batches at lines
  157, 178, 210, 286 (the one remaining unchunked `inArray` at line ~405 is
  over `roomIds`, an event-bounded small set, annotated "DEC-078 bounded-list
  exemption"). `src/lib/itinerary.ts:11` adds `MAX_ITINERARY_IDS = 300`;
  `src/routes/public.tsx:580-582` enforces it with a 400 on the
  `/e/:slug/schedule.ics?ids=` route. `src/server/repo/comms.ts` (`loadIcsScheduleData`)
  also imports `chunkIds` (line 11) and batches at lines 137, 155, 232, 244.

- **Item 4 (per-reviewer full scans)** — CLOSED. DEC-081 landed:
  `src/domain/evaluation.ts:289` (`resolveAssignments`, pure, set-based).
  `src/server/repo/review.ts`: `resolveReviewerSubmissions` (line 344-353)
  now does one plan-filtered load + pure `resolveAssignments`, not a
  per-reviewer scan; `isSubmissionInReviewerScope` (line 358+) does a
  targeted single-submission-scoped query instead of a full-set load;
  `countEvaluationsForSubmission` (line 563+) does a targeted `count(*)`.
  `src/routes/review.ts`: the `/progress` handler (line 271-291) and
  `/remind` handler (line 343-360+) each call `listPlanFilteredSubmissions`
  ONCE (not once per reviewer) then run pure `resolveAssignments`; the
  evaluation PUT handler (line 494-522) uses `isSubmissionInReviewerScope`
  (line 505) and `countEvaluationsForSubmission` (line 518) — no full scans
  on the hot keystroke path.

- **Item 5 (rounds dead knob)** — CLOSED. DEC-082/DEC-087 landed: migration
  `migrations/0009_review_rounds.sql` adds `evaluation_plan.current_round`
  (default 1). `src/server/repo/review.ts:153-166` implements
  `advancePlanRound`, capped at `plan.rounds` (409 once
  `current_round === rounds`). `src/routes/review.ts:226`
  (`POST /api/v1/plans/:id/advance-round`) wires it; the evaluation PUT at
  `src/routes/review.ts:515` now reads `const round = plan.currentRound`
  (no longer hardcoded to 1); `repo.listEvaluationsForPlan` takes a
  required `round` arg (three-arg form per DEC-087) used at
  `src/routes/review.ts:277, 308, 348, 438`. Tests: `test/rounds.test.ts`,
  `test/review-rounds.test.ts` both present and passing.

- **Narrowing note: DEC-022** — CLOSED, superseded by DEC-083. Real
  purge-on-publish edge caching now lands in `src/server/pubcache.ts:1-9`
  ("J10 / DEC-083: real purge-on-publish edge caching for public surfaces.
  Supersedes DEC-022's 'no purge machinery' sentence"), registered once in
  `createBaseApp` per the module's line-115 comment.

- **Narrowing note: DEC-059** — CLOSED, superseded by DEC-084.
  `src/lib/image-dims.ts:1,10` adds a server-side headshot dimension gate
  (`MAX_HEADSHOT_EDGE_PX = 2048`) amending DEC-059's client-canvas-only
  scope; `test/image-dims.test.ts` (10 tests) passes.

- **Narrowing note: DEC-054** — CLOSED, upheld by DEC-085 (decisions/DEC-085.md
  present in-tree; no further code action required per the task's own
  framing).

- **Narrowing note: DEC-061** — CLOSED, sanctioned by SPEC §10's own
  "only after J1-J12 are green" gate (no code action; listed for
  completeness per the task's own framing).

- **Minor note: submittedAt≡createdAt** — CLOSED, ruled correct under
  DEC-014/DEC-085 (no code action per the task's own framing).

- **Minor note: accentColor hex validation** — CLOSED, verified at both
  write paths: `src/routes/api/portal-config.ts:99-100` and
  `src/routes/api/events.ts:87-88` both call `isValidHexColor` server-side;
  client-side mirror at `app/src/pages/settings/formState.ts:62-63`
  (`isValidHexColorOrEmpty`), covered by
  `app/src/pages/settings/formState.test.ts:74-81`.

All ten entries verified in-tree and pruned from docs/eval-findings.md.
`npm run build` and `npm test` green at this worktree (branched from
`1c75d92`, which is `2887db0` plus only bookkeeping/merge commits):
94 test files, 971 tests passed, 0 failed.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-c — walkthrough @ 3878d4f

DEC-069 J1-J12 walkthrough gate (DEC-077 log-only lane; NO code/product/
test/script/config changes made — this run is grep/log-only per the
code freeze). Newest code-bearing main short-sha per DEC-091: `3878d4f`
("merge task-w2-d"), same sha task-w3-a and task-w3-b cited (all commits
since then — `f9a33fd` scribe wave 3, `31fa021`/`1c75d92` task-w3-a,
`fc32e81`/`d6bc978` task-w3-b — touch only `decisions/`, `field-guide/
index.md`, the scribe-owned constant table in `src/decisions.ts`, and
`docs/verification-log.md`; none are code-bearing).

Sequence run from a fresh worktree branched off main (`1c75d92`, which
contains `3878d4f`'s tree): `npm ci`, `npm run build` (clean, tsc x2 +
vite), `npm run db:migrate` (all 10 migrations applied, through
`0009_review_rounds.sql`), `npm run seed` (fixture org/event/contacts +
6 R2 objects), `npx wrangler dev --port 8801` (never 8787), waited for
`GET /health` -> `{"ok":true}`, then `npm run walkthrough -- --url
http://localhost:8801`.

Areas ran in the required order producer -> review -> speaker -> public
-> data -> scale (confirmed via `WALKTHROUGH_AREAS` output headers):

- producer: PASS — all checks (event/form/CFP setup, submission intake).
- review: PASS — queue ordering, anonymization, scorecard round-trip,
  max-evaluations cap, cross-org 403/404 isolation (DEC-039), reviewer
  progress + laggard-only remind + email_log rows, weighted-aggregate
  results sort + CSV export.
- speaker: PASS — accept/onboarding-task defaults, idempotent re-accept,
  portal dashboard, form/file-request onboarding tasks, CFP-reuse form
  attach, co-presenter invite/accept/decline (DEC-070, IDOR-safe),
  post-close-date portal-edit gating, deliverable version chaining,
  producer/speaker comment thread, content-approval visibility gate.
- public: PASS — J9 agenda (rooms/tracks/placement/conflict
  surfacing/auto-schedule/unscheduling) and J10 public surfaces + embeds
  + .ics idempotent UID + visibility gates (unaccepted/content-
  unapproved/hidden-participant all absent).
- data: PASS — J11 contacts/search/import/merge/segments/bulk-email
  (+ >100-recipient cap) + dashboard stats; J12 bearer-token mint/use/
  revoke, role-403, exports (csv+json, showflow.csv), cross-org export
  404, API docs.
- scale: FAILED at step 6 — this is the DEC-086/089 mandatory scale
  area and it did execute (not missing), exercising all six probes:
  step1 110 fresh contacts/submissions/speaker participants (PASS),
  step2 one 110-id bulk-accept POST via DEC-078/079 chunking (PASS),
  step3 onboarding task_assignments present for a 5-contact sample
  (PASS), step4 exactly-once re-accept on identical re-POST (PASS),
  step5 no-auto-email assertion — dev mailbox count unchanged by the
  bulk accept (PASS), step6 DEC-083 purge-refresh probe (public submit
  -> claim -> organizer accept -> speaker portal edit -> immediate
  `/e/<slug>/sessions` title check) — FAILED: the speaker portal-edit
  POST (`/portal/submissions/:id/edit`) returned HTTP 400 instead of
  the expected 302 redirect. Full walkthrough run aborted at this point
  per the runner's fail-fast contract (scale runs last, so no
  downstream areas were skipped).

Dev server on port 8801 was stopped after the run (`pkill -f "wrangler
dev --port 8801"`; confirmed via `curl` connection-refused).

Re-checked main after the run: `main` had advanced to `d6bc978` (merge
of task-w3-b's own build+test gate, log-only) — no code-bearing merge
landed mid-run; `3878d4f` remains the newest code-bearing sha.

OPEN ITEMS: step6 of the walkthrough "scale" area (DEC-086/089
purge-refresh probe) fails with 400 on the speaker portal-edit POST at
`3878d4f`. Per DEC-077 this lane made no code changes to investigate or
fix the 400's root cause; a follow-up task should reproduce
`scripts/walkthrough/scale.ts`'s step 6 in isolation against a running
dev server to get the JSON/HTML error detail and determine whether the
defect is in the walkthrough script's form-field construction or in the
`/portal/submissions/:id/edit` handler itself.

RESULT: FAIL — walkthrough scale area step6 (DEC-083 purge-refresh
probe via speaker portal-edit) returns 400 instead of 302 at `3878d4f`;
producer/review/speaker/public/data areas and scale steps 1-5 all PASS.

## 2026-08-10 task-w3-d — perf-smoke @ 3878d4f

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
