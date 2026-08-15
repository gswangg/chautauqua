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

Full detail: docs/verification-log/task-w14-g-walkthrough-module-runs.md

scripts/walkthrough/speaker.ts and scripts/walkthrough/public.ts converted
from direct `wrangler d1 execute --local` fixture workarounds to the real
DEC-070 organizer endpoints (POST /api/v1/submissions/:id/participants,
PATCH /api/v1/submissions/:id/participants/:participantId). Added one new
authz probe (speaker session POSTing the invite endpoint -> 403).

RESULT: PASS

## 2026-08-10 task-w15-a — walkthrough endpoint-conversion closeout @ 0ba550c

Full detail: docs/verification-log/task-w15-a-walkthrough-endpoint-conversion-closeout.md

Re-verified DEC-076's single code barrier: confirmed task-w14-g's endpoint
conversion is already on main. `grep -n "INSERT INTO participant\|UPDATE
participant SET visible\|no admin API" scripts/walkthrough/speaker.ts
scripts/walkthrough/public.ts` returns nothing — no direct-SQL participant
writes, no stale "stage 1 has no admin API" comments remain. Both scripts
already call POST /api/v1/submissions/:id/participants and PATCH
/api/v1/submissions/:id/participants/:participantId per DEC-070/DEC-053.

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

Full detail: docs/verification-log/task-w15-e-spec-audit-2.md

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

Full detail: docs/verification-log/task-w16-c-perf-smoke-2.md

Gate re-run (DEC-077 log-only lane): `npm ci`, `npm run build` (tsc x2 +
vite build), `npm run db:migrate` (9 migrations), `npm run seed` (required
first — `perf:seed` seeds only synthetic 2k-row data, not a login-capable
user; the smoke script logs in as the fixture organizer), `npm run
perf:seed` (2k-row scale), `wrangler dev --port 8803` (8803 reserved for
this lane, never 8787/8801), `PERF_URL=http://localhost:8803 npm run
perf:smoke`. Full detail: docs/verification-log/task-w16-c-perf-smoke.md

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

Full detail: docs/verification-log/task-w3-a-wave2-closeout.md

Wave-2 closeout barrier (DEC-076/DEC-091). Grep-level re-verification
confirmed all DEC-087/088/089 artifacts (0009_review_rounds migration,
three-arg `listEvaluationsForPlan`, perf-seed/perf-smoke additions) and
task-w2-d's walkthrough "scale" area were already merged onto main
before this barrier ran; no source changes needed. Newest code-bearing
main short-sha per DEC-091: `3878d4f` ("merge task-w2-d"). `npm run
build` and `npm test` both green at this sha: 94 test files, 971 tests
passed, 0 failed.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-b — build+test @ 3878d4f

Full detail: docs/verification-log/task-w3-b-build-test.md

DEC-069 build+test gate. Newest code-bearing main short-sha per
DEC-091, re-derived independently: `3878d4f` ("merge task-w2-d").
Built and tested at main tip `1c75d92` (a strict git-ancestor superset
containing `3878d4f`'s changes plus only non-code-bearing commits on
top): `npm run build` clean (0 errors, Vite 125 modules / 17 chunks);
`npm test` 94 files / 971 tests all passed; `npm run bundle:check`
58.60 kB gzip vs 300.00 kB budget — PASSED.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-e — spec-audit @ 3878d4f

Full detail: docs/verification-log/task-w3-e-spec-audit.md

Reopened-run (DEC-086/DEC-090) SPEC §8/§9 static audit, code-frozen per
DEC-077 (log-only lane), fresh worktree of `main`. Newest code-bearing
short-sha per DEC-091: `3878d4f` ("merge task-w2-d"). SPEC §8/§9
checks (README/CI/SPEC §9 invariants) all confirmed unchanged since
w16-d; the DEC-086 scale-path (chunked bulk status, chunked public
hydration + 300-id cap, set-based reviewer scope, multi-round,
versioned pubcache purge, image-dims gate) and DEC-089 probes all
re-verified in-tree. `npm run build` and `npm test --silent`: ALL PASS
(94 files / 971 tests). No product/test/script/config changes made in
this lane.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-f — triage-closure @ 2887db0

Full detail: docs/verification-log/task-w3-f-triage-closure.md

Newest code-bearing main short-sha per DEC-091: `2887db0` ("Add DEC-089
walkthrough area \"scale\"...").  Item-by-item re-verification of every
remaining docs/eval-findings.md entry: Item 2 (at-most-once acceptance,
DEC-079), Item 3 (unchunked public inArray, DEC-080), Item 4
(per-reviewer full scans, DEC-081), Item 5 (rounds dead knob,
DEC-082/087), plus narrowing/minor notes DEC-022/DEC-059/DEC-054/
DEC-061, submittedAt≡createdAt, and accentColor hex validation — all
ten CLOSED with in-tree code/test citations. All ten entries verified
in-tree and pruned from docs/eval-findings.md. `npm run build` and
`npm test` green at this worktree: 94 test files, 971 tests passed, 0
failed.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w3-c — walkthrough @ 3878d4f

Full detail: docs/verification-log/task-w3-c-walkthrough.md

DEC-069 J1-J12 walkthrough gate (DEC-077 log-only lane; NO code/product/
test/script/config changes made — this run is grep/log-only per the
code freeze). Newest code-bearing main short-sha per DEC-091: `3878d4f`
("merge task-w2-d"). Areas ran in required order producer -> review ->
speaker -> public -> data -> scale: producer/review/speaker/public/data
all PASS; scale FAILED at step 6 (DEC-086/089 purge-refresh probe) —
the speaker portal-edit POST (`/portal/submissions/:id/edit`) returned
HTTP 400 instead of the expected 302 redirect. Steps 1-5 of scale all
PASS.

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

Full detail: docs/verification-log/task-w3-d-perf-smoke.md

Newest code-bearing main short-sha per DEC-091 (same as task-w3-a's
determination): `3878d4f` ("merge task-w2-d"). `npm run db:migrate` +
`npm run seed` + `npm run perf:seed` all clean, `wrangler dev --port
8803` healthy, then `npm run perf:smoke` failed before any timed check
ran: `fetchAcceptedSubmissionIds` expected >= 301 accepted submissions
but got 200. Root cause (confirmed by reading source, not fixed per
DEC-077 code freeze): `src/lib/pagination.ts` clamps `perPage` to
`[1, 200]` server-side, and DEC-088's perf-seed only creates 300
accepted-status submissions — both make the DEC-089 301-id cap-assertion
probe's single-page fetch unreachable. No p95 table and no 400-cap
assertion ran this cycle.

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

## 2026-08-10 task-w4-a — build+test @ 3878d4f

Full detail: docs/verification-log/task-w4-a-build-test-2.md

DEC-069 build+test gate, wave-4 (DEC-077/090/093: log-only lane, no
product code, scripts, or tests changed). Sha independently re-derived
per DEC-091 by walking `git log` from this worktree's `main` tip
`79c4bb3` backward, skipping doc/decision/scribe-only commits (verified
`281a31b` and `f9a33fd` touch `src/decisions.ts` only via two-line
string-constant appends, per DEC-090's exclusion) — lands on `3878d4f`
("merge task-w2-d"), matching the task brief's expected result and
task-w3-b's independent wave-3 derivation.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-d — spec-audit @ 3878d4f

Full detail: docs/verification-log/task-w4-d-spec-audit-2.md

Wave-4 gate (DEC-093: wave-3 gate tasks never executed, so all four
gates run in parallel at code-bearing sha `3878d4f`), log-only lane per
DEC-069/077/090, fresh worktree of `main` branched from `60bbedb` ("merge
task-w3-f"). `git diff 3878d4f..HEAD --stat` at the branch point shows
only DEC-090..093 decision docs, `docs/eval-findings.md` pruning,
`docs/verification-log.md` appends, `field-guide/index.md`, and a
4-line constant-only `src/decisions.ts` addition — no product/test/
script/config changes, confirming `3878d4f` as the code-bearing sha.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-b — walkthrough @ 3878d4f

Full detail: docs/verification-log/task-w4-b-walkthrough-2.md

Fresh worktree of `main` (`79c4bb3`); derived code-bearing sha `3878d4f`
per DEC-091/093 (all commits since are scribe/bookkeeping/log-only-lane;
`git diff --stat 3878d4f..HEAD` excluding verification-log/eval-findings
touches only new DEC-090..093 docs, `field-guide/index.md`, and
`src/decisions.ts`'s new constant references — no functional change).
`npm ci`, `npm run build`, `npm run db:migrate`, `npm run seed`, then
`wrangler dev --port 8801` (never 8787/8803), then `npm run walkthrough --
--url http://localhost:8801`. Ran all SIX `WALKTHROUGH_AREAS` in order:
producer, review, speaker, public, data, scale.

RESULT: FAIL

## 2026-08-10 task-w4-c — perf-smoke @ 3878d4f

Full detail: docs/verification-log/task-w4-c-perf-smoke-2.md

Gate re-run (wave 4, DEC-077 log-only lane, DEC-093 code-bearing sha
`3878d4f`). Fresh worktree off `main` at `79c4bb3` (all commits after
`3878d4f` are log-only per DEC-090/093). `npm ci`, `npm run build` (PASS),
`npm run db:migrate` (10 migrations), `npm run seed` (required first, per
the w16-c precedent), `npm run perf:seed` (verified against local D1:
`plan_reviewer` count for `seed_perf_plan_0001` = 12, `submission` rows
for `seed_perf_event` = 2000 total / 300 accepted, matching DEC-088),
`wrangler dev --port 8803` (8803 reserved, never 8787/8801), `PERF_URL=
http://localhost:8803 npm run perf:smoke`. Full detail:
docs/verification-log/task-w4-c-perf-smoke.md

OPEN ITEMS: 1 — `scripts/perf-smoke.ts`'s 301-id cap probe cannot succeed
against the current DEC-088 perf-seed fixture (300 accepted, needs 301);
needs a code-bearing wave to reconcile the seed status mix, the probe's
id source, or add pagination to `fetchAcceptedSubmissionIds` (not this
lane's call to make).

RESULT: FAIL

## 2026-08-10 task-w4-e — triage-closure @ 3878d4f

Full detail: docs/verification-log/task-w4-e-triage-closure-2.md

Bookkeeping/log-only lane (DEC-090/091/093): touched only
`docs/eval-findings.md`, `docs/verification-log.md`, and
`docs/verification-log/task-w4-e-triage-closure.md` — no product code.
Worktree branched off `main` at `521e903` ("merge task-w4-c"); derived
code-bearing sha per DEC-091/093 is `3878d4f` ("merge task-w2-d"), same
as every sibling wave-4 gate — confirmed only `src/decisions.ts`
(constant-string appends) and doc/decision files differ between
`3878d4f` and HEAD.

OPEN ITEMS: 2

1. `scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` missing
   `trackIds` in the portal-edit FormData (scale step 6 400).
2. `scripts/perf-smoke.ts`'s 301-id cap probe vs. DEC-088's 300-accepted
   perf-seed fixture mismatch (perf-smoke aborts before any timed check).

RESULT: FAIL

## 2026-08-10 task-w5-b — build+test @ b638f75

Full detail: docs/verification-log/task-w5-b-build-test.md

Re-derived newest code-bearing main sha per DEC-091 (skipping
docs/verification-log*, docs/eval-findings.md, field-guide/index.md,
decisions/*.md, scribe src/decisions.ts appends): `b638f75` ("Fix two
gate-failing probe scripts (DEC-094/095/096)", task-w5-a's script-fix
commit, merged at `3d1e838`). `npm ci` clean; `npm run build` (tsc x2 +
vite) PASS; `npm run bundle:check` PASS (58.60 kB gzip entry vs 300.00
kB budget); `npm test --silent` PASS — 94 files / 976 tests, all green,
0 failures. Post-run re-check of `git log main` confirms no code-bearing
merge landed mid-run (tip still `3d1e838`).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w5-e — spec-audit @ 3d1e838

Full detail: docs/verification-log/task-w5-e-spec-audit.md

Re-run (DEC-096) SPEC §8/§9 static audit, code-frozen per DEC-077
(log-only lane), fresh worktree of `main` (branched from task-w5-a's
merge). Newest code-bearing short-sha per DEC-091: `3d1e838` ("merge
task-w5-a"). `git diff 3878d4f..HEAD --stat` scoped and confirmed: the
only code-bearing files are `scripts/perf-smoke.ts`,
`scripts/perf-smoke-lib.ts`, `scripts/walkthrough/scale.ts`, and
`test/perf-smoke.test.ts` (task-w5-a's fix commit `b638f75`); everything
else in the wider diff is wave-3/4 bookkeeping already landed on main
before this branch point (decisions/DEC-090..096.md,
`src/decisions.ts` compile-checked constants, verification-log
submodules, field-guide/index.md, docs/eval-findings.md).

README quickstart (SPEC.md:361) and evaluator credentials
(`docs/fixtures/sample-data.json` `identities`) match verbatim.
`.github/workflows/ci.yml` covers build+bundle:check+test, the
`perf-smoke` job, and the `walkthrough` job. SPEC §9's four invariants
(close-date lock/speaker isolation, hidden-speaker exclusion,
never-auto-email) still have passing regression tests in
`test/edit-lock.test.ts`, `test/submit-core.test.ts`,
`test/task-file-access.test.ts`, `test/headshot-gate.test.ts`,
`test/spec9-invariants.test.ts`.

Conformance check on the two DEC-094/095 fixes: scale.ts's step 6 now
derives `trackIds` from the edit page's checked checkbox with a
fail-loud fallback; perf-smoke.ts paginates at perPage=200 and builds
the 301-id cap probe as 300 real ids + 1 nonexistent id with the 400
assertion unchanged. No product file (`src/lib/pagination.ts`,
`scripts/perf-seed-lib.ts`, `src/routes/**`) was touched to accommodate
either probe — confirmed via an empty targeted diff.

`npm run build` and `npm test --silent`: ALL PASS (94 files / 976 tests,
0 failures — 5 more tests than w3-e's 971, from new perf-smoke-lib
coverage; no regressions). No product/test/script/config changes made in
this lane (DEC-077 code-frozen gate); this commit touches only
`docs/verification-log.md` and `docs/verification-log/task-w5-e-spec-audit.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w5-c — walkthrough @ b638f75

Full detail: docs/verification-log/task-w5-c-walkthrough-2.md

Fresh worktree from `main` at task-w5-a's merge (`3d1e838`, carrying the
newest code-bearing commit `b638f75` "Fix two gate-failing probe scripts
(DEC-094/095/096)" per DEC-091). Full sequence run: `npm ci`,
`npm run build` (clean), `npm run db:migrate` (all 10 migrations
`0000`..`0009` applied), `npm run seed` (ok), `npx wrangler dev --port
8801`, `/health` healthy on first poll, then
`npm run walkthrough -- --url http://localhost:8801`, areas run in order
producer -> review -> speaker -> public -> data -> scale.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w5-f — triage-closure @ b638f75

Full detail: docs/verification-log/task-w5-f-triage-closure.md

DEC-069 triage-closure gate (DEC-077/090 log-only lane; this commit
touches only `docs/verification-log.md`). Chained per DEC-096 behind
task-w5-c's walkthrough re-run so the scale-area PASS is citable;
newest code-bearing main short-sha per DEC-091, matching task-w5-b/c/e's
citation: `b638f75` ("Fix two gate-failing probe scripts
(DEC-094/095/096)", task-w5-a).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w7-a — build+test @ d12eb25

Full detail: docs/verification-log/task-w7-a-build-test-2.md

Wave-7 code-frozen build+test gate (DEC-077, DEC-102). Re-derived the
newest code-bearing sha per DEC-091 by walking `main` from tip
`9e7ac53`: `9e7ac53` (scribe wave 7 — DEC-102 doc + a pure
string-constant append to `src/decisions.ts`), `4e2d53e` (merge
task-w5-f, no own diff), `0828e32` (task-w5-f gate section,
docs/verification-log.md only) are all DEC-090-exempt bookkeeping.
Newest code-bearing commit: **d12eb25** ("merge task-w6-d") — matches
the task's stated expectation.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w7-d — spec-audit @ d12eb25

Full detail: docs/verification-log/task-w7-d-spec-audit.md

Re-derived newest code-bearing sha per DEC-091: `d12eb25` ("merge
task-w6-d") — matches the field guide's expected value; everything after
it on `main`'s tip (`9e7ac53`) is bookkeeping (DEC-102 append in
`src/decisions.ts` plus docs/decisions/field-guide). Scoped `git diff
3d1e838..HEAD`: the code-bearing delta is exactly the four task-w6-*
fix lanes (DEC-098/099/100/101) plus bookkeeping, as expected. All four
fixes verified conformant with file:line evidence in the full detail
doc. README quickstart/persona table, `.github/workflows/ci.yml`
build+bundle:check+test/perf-smoke/walkthrough jobs, and SPEC §9
invariant regression tests all re-confirmed present and unchanged.
Regression tests for the four new fixes confirmed present
(`test/pubcache.test.ts`, `test/claim-onscreen-scope.test.ts`,
`test/submission-seq.test.ts`, `test/contacts-repo.test.ts`).

`npm run build`: PASS. `npm test --silent`: ALL PASS — 96 files, 984
tests, 0 failures.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w7-c — perf-smoke @ d12eb25

Full detail: docs/verification-log/task-w7-c-perf-smoke-2.md

Wave-7 code-frozen perf-smoke gate (DEC-077/DEC-089/DEC-094/DEC-102).
Newest code-bearing sha re-derived per DEC-091/DEC-090 (walking `main`
from tip `52b9eaa`: `52b9eaa`/`b17595e`/`9e7ac53`/`4e2d53e`/`0828e32` are
all bookkeeping-only): **d12eb25** ("merge task-w6-d") — matches
task-w7-a's own citation in this wave.

OPEN ITEMS: 1

RESULT: FAIL

## 2026-08-10 task-w7-b — walkthrough @ d12eb25

Full detail: docs/verification-log/task-w7-b-walkthrough.md

DEC-077 code-frozen gate lane, port 8801 (never 8787). Re-derived newest
code-bearing main short-sha per DEC-091/DEC-090: `d12eb25` ("merge
task-w6-d"); every commit after it observed on `main` during this
task's execution window (`de8d492`.../`9e7ac53`/`b17595e`/`52b9eaa`/
`7af78d9`/`8eff481`) is DEC-077 bookkeeping (gate-result docs or a
non-functional `DEC_102` constant append) — task-w7-a's own build+test
re-run above and task-w7-d's spec-audit re-run both independently cite
`d12eb25` too.

- install/build/migrate (0000-0009)/seed/wrangler-dev(:8801)/walkthrough:
  ALL SIX AREAS PASS in order — producer, review, speaker, public, data,
  scale. Zero FAIL/PLANNER: lines in the full captured output.
- producer's fresh-email J2 submit+claim step confirms the DEC-098
  on-screen claim link is still exercised and green.
- scale steps 1-5 confirm the DEC-089 110-id bulk accept is exactly-once
  with no auto-email; step 6 confirms the DEC-092 portal-edit
  purge-refresh probe (DEC-095 checked-`trackIds` fix) still passes.
- Two mid-run merges observed (both DEC-077 bookkeeping, non-code-
  bearing): this task's original worktree (based on `main`'s then-tip
  `9e7ac53`) was pruned out from under it when `main` advanced to
  `52b9eaa` (task-w7-a merge) concurrently; the worktree/branch were
  recreated fresh and the entire sequence re-run from scratch on the
  new base. `main` then advanced again to `8eff481` (task-w7-d merge)
  after the recorded walkthrough run had already completed. No
  product/test/script/config commit landed on `main` in this window.
- wrangler dev killed after the run; port 8801 confirmed released.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w7-e — triage-closure @ d12eb25

Full detail: docs/verification-log/task-w7-e-triage-closure.md

Docs-only lane (DEC-069/077/090/102), chained behind task-w7-b's
walkthrough gate per DEC-093. Code-bearing sha per DEC-091 unchanged
from the rest of wave 7: `d12eb25` ("merge task-w6-d"). Swept all four
required categories: (1) `docs/eval-findings.md` re-confirmed still
zero open round-1 findings, left unchanged; (2) both script-only items
from task-w4-e's §(3) (walkthrough scale step6 trackIds, perf-smoke
301-id cap probe) confirmed CLOSED by `b638f75`
(`scripts/walkthrough/scale.ts`, `scripts/perf-smoke.ts`), with runtime
proof from this wave's own task-w7-b walkthrough and task-w7-c
perf-smoke cap-probe sections; (3) all four wave-6 review-lens defects
(DEC-098/099/100/101) confirmed fixed on main with regression tests
present (`test/claim-onscreen-scope.test.ts`, `test/pubcache.test.ts`,
`test/submission-seq.test.ts`, `test/contacts-repo.test.ts`); (4) swept
every prior `RESULT: FAIL` section (task-w3-c/d, task-w4-b/c/e) — all
CLOSED except **task-w7-c's perf-smoke gate**, which surfaced a
genuinely open, unratified product defect: `src/server/repo/
overview.ts:170`'s unbounded `inArray(...)` on
`participant.submissionId` throws `D1_ERROR: too many SQL variables`
at DEC-088 perf-seed scale (~300 accepted+placed submissions), blocking
the "event overview" timed check and everything after it. Re-verified
still unfixed at this task's own worktree tip via direct grep of
`overview.ts` and `git log -- src/server/repo/overview.ts` (no fix
commit exists). Corroborated by the unmerged sibling branch task-w8-b
(not an ancestor of this branch, not yet merged), which independently
reconfirms the same defect. The unmerged `task-w6-a-retry` branch's
scope (script fixes) is already landed at `b638f75`; nothing needed
from it. Per DEC-077/090 this docs-only lane did not fix the defect.

OPEN ITEMS: 1

1. `src/server/repo/overview.ts:170` unbounded `inArray` D1
   bind-variable-limit crash on `GET /api/v1/events/:eventId/overview`
   at DEC-088 perf-seed scale (first found by task-w7-c, still open).
   Needs a code-bearing chunked-`IN` fix (DEC-078 `ID_CHUNK_SIZE`
   pattern) in a future wave.

RESULT: FAIL — one genuinely open, unratified product defect found
during the mandatory sweep (`src/server/repo/overview.ts:170`); all
other sweep categories in this task's scope are closed.

## 2026-08-10 task-w8-c — spec-audit confirm @ d12eb25

Full detail: docs/verification-log/task-w8-c-spec-audit-confirm.md

Verify-or-run (DEC-103): found an existing spec-audit section at the
expected sha (task-w7-d, above) ending `RESULT: PASS`. Spot-checked its
mandatory DEC-098..101 citations against the in-tree worktree (checked
out from `main` tip `8c19466`, code-bearing sha still `d12eb25` per
DEC-091 — `git log --oneline` shows only bookkeeping/gate commits after
`d12eb25`): all four hold, with only minor line-number drift from the
cited ranges (no code drift):

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w8-a — walkthrough @ d12eb25

Full detail: docs/verification-log/task-w8-a-walkthrough-2.md

Wave-8 code-frozen walkthrough gate (DEC-069/DEC-077/DEC-086/DEC-089/
DEC-102/DEC-103), verify-or-run per DEC-103. Newest code-bearing sha
re-derived per DEC-091/DEC-090: walking `main` from tip `8c19466`
(`8c19466`/`4a1997b`/`075fc16`/`8eff481`/`7af78d9`/`52b9eaa`/`b17595e`/
`9e7ac53`/`4e2d53e`/`0828e32` are all bookkeeping-only — docs/decisions/
field-guide plus a pure-string append to `src/decisions.ts`): **d12eb25**
("merge task-w6-d") — matches task-w7-a/task-w7-c/task-w7-d's own
citations this wave. Grepped `docs/verification-log.md` for an existing
`walkthrough @ d12eb25 ... RESULT: PASS` section (per the DEC-103
verify-or-run instruction, in case a live `task-w7-b` lane landed one
mid-wave): none present, no `docs/verification-log/*-walkthrough.md`
detail file cites `d12eb25` either — so ran the full gate.

RESULT: PASS

## 2026-08-10 task-w8-b — perf-smoke @ d12eb25

Full detail: docs/verification-log/task-w8-b-perf-smoke.md

Verify-or-run (DEC-103) re-run of the perf-smoke gate. Step 1: newest
code-bearing sha per DEC-091/DEC-090 unchanged since wave 7 —
`8c19466`/`4a1997b`/`075fc16`/`8eff481`/`7af78d9`/`52b9eaa`/`b17595e`/
`9e7ac53`/`4e2d53e`/`0828e32` all touch only `docs/`,
`docs/verification-log/`, `decisions/`, `field-guide/`, and
`src/decisions.ts` string appends — all DEC-090 bookkeeping-exempt.
Confirmed: **d12eb25** ("merge task-w6-d").

OPEN ITEMS: 1 — `src/server/repo/overview.ts:170`'s unbounded
`inArray(..., placedIds)` fan-out throws `D1_ERROR: too many SQL
variables` at DEC-088 perf scale (~300 placed participants), blocking
all perf-smoke checks after `submission detail`.

RESULT: FAIL — perf-smoke re-run @ d12eb25 confirms task-w7-c's
finding: `event overview` 500s under DEC-088 perf scale
(`src/server/repo/overview.ts:170`, too many SQL variables); no gate
PASS section exists at the newest code-bearing sha, and none can be
produced without a code-bearing fix, which is out of scope for this
code-frozen verification task.

## 2026-08-10 task-w8-d — triage-closure @ d12eb25

Full detail: docs/verification-log/task-w8-d-triage-closure-2.md

DEC-069 fifth-section triage-closure gate (log-only lane, DEC-090/093),
chained behind task-w8-a per DEC-093/102 so the walkthrough runtime
evidence is citable. Worktree branched from `main` after task-w8-a/b
merged (tip `a06ff8c`, "merge task-w8-b").

OPEN ITEMS: 1 — `src/server/repo/overview.ts:170` unbounded
`inArray(..., placedIds)` fan-out 500s (`D1_ERROR: too many SQL
variables`) at DEC-088 perf scale, failing the perf-smoke gate
(task-w7-c, task-w8-b); no code-bearing fix exists on `main` yet; next
code-bearing wave must fix this and re-run perf-smoke to close the
DEC-069 predicate.

RESULT: FAIL — perf-smoke gate scope is not green at the newest
code-bearing sha `d12eb25` (`src/server/repo/overview.ts:170` scale
defect, confirmed twice); build+test/walkthrough/spec-audit are all
PASS and no post-`d12eb25` commit is code-bearing, so this is a single
open product-code item for wave 9, not a predicate reset.

## 2026-08-10 task-w11-e — spec-audit @ 3b7ed3d

Full detail: docs/verification-log/task-w11-e-spec-audit-2.md

DEC-115's `d`/`e`/`f` gates chain behind `task-w11-a` (SHA `3b7ed3d`,
"merge task-w11-a" — the DEC-113 walkthrough re-land of DEC-112's
probes, the only file touched is `scripts/walkthrough/speaker.ts`, which
is code-bearing script content, not name-only). Per DEC-091/DEC-114 this
merge is the newest code-bearing sha on `main` as of this run — no
commit since it changes anything other than the walkthrough script, and
that script change is itself code-bearing (new probe assertions), so
`3b7ed3d` is the sha this spec-audit is scoped to. This is a log-only
lane per DEC-077: no product/test/script/config changes were made by
this task.

RESULT: PASS

## 2026-08-10 task-w11-b — build+test @ 3b7ed3d

Full detail: docs/verification-log/task-w11-b-build-test.md

DEC-069 build+test gate, log-only lane (DEC-077). Newest code-bearing sha
per DEC-091/DEC-114's mechanical rule (first-parent name-only diff
outside docs/verification-log*, docs/eval-findings.md, field-guide/,
decisions/, src/decisions.ts string appends; empty re-merges excluded):
confirmed as `3b7ed3d` ("merge task-w11-a") — its diff against parent
`e9ec7e0` touches `scripts/walkthrough/speaker.ts` only, which is
code-bearing (walkthrough script, not one of the exempt bookkeeping
paths). No merges have landed on `main` between branch-off and this
run's completion (main tip confirmed unchanged at `3b7ed3d` post-run),
so no invalidation applies.

RESULT: PASS

## 2026-08-10 task-w11-c — walkthrough @ 3b7ed3d

Full detail: docs/verification-log/task-w11-c-walkthrough.md

DEC-069 J1-J12 walkthrough gate, log-only lane (DEC-077: no product/
test/script/config changes made in this task). Fresh worktree of `main`
at the task-w11-a merge commit `3b7ed3d` ("merge task-w11-a") — this is
the newest commit on `main` at branch time and is code-bearing per
DEC-091/114 (it lands `scripts/walkthrough/speaker.ts`'s DEC-112/113
closeout probes, commits `e98e4c9` "Walkthrough: add DEC-112 runtime
probes for DEC-108 invite-visibility and DEC-111 form-task self-heal"
and `2d686bd` "walkthrough/speaker.ts: land DEC-112 closeout probes per
DEC-113"). Confirmed present in-tree before running anything: `grep -n
"chq-session-card\|speakers-block\|Flight\|Hotel"
scripts/walkthrough/speaker.ts` shows the Hotel/Flight backing-form
task assertions (lines ~357-368, ~541-566) and the invite A/B/C
fixture flow feeding the public chq-session-card/speakers-block scoped
assertions (exercised in `scripts/walkthrough/public.ts`) — the
DEC-112/113 probes are on `main`, not absent.

RESULT: PASS

## 2026-08-10 task-w12-a — build+test @ 3b7ed3d

Full detail: docs/verification-log/task-w12-a-build-test-2.md

DEC-069/DEC-114 re-derivation walk from `main` tip `15a422a` ('scribe
wave 12'), first-parent, back to the last confirmed-void sha `d12eb25`:

RESULT: PASS

## 2026-08-10 task-w11-d — perf-smoke @ 3b7ed3d

Full detail: docs/verification-log/task-w11-d-perf-smoke.md

DEC-069 perf-smoke gate, log-only lane (DEC-077): no product/test/
script/config changes made in this task; the run below surfaced a real
defect, recorded as `RESULT: FAIL` per this lane's own rule rather than
fixed in-place.

OPEN ITEMS: 1 — `scripts/perf-seed.ts`'s `criteria_json` literal (line
~269) is missing the `kind: "rating"` field required by
`src/domain/evaluation.ts`'s `EvaluationCriterionDef` (`RatingCriterionDef
| DropdownCriterionDef` union), causing every `rating PUT` perf-smoke
check to fail 400 with "criterion \"overall\" has no options defined".
The w7-c/w8-b `overview.ts` OPEN ITEM is CLOSED (see above); this is a
new, distinct OPEN ITEM. A future code-bearing wave must add `kind:
"rating"` to the seeded criterion and re-run perf-smoke to close the
DEC-069 predicate.

RESULT: FAIL — perf-smoke gate scope is not green at the newest
code-bearing sha `3b7ed3d` (`event overview`/DEC-104 chunking now
confirmed fixed, closing the w7-c/w8-b OPEN ITEM; a new, distinct
`scripts/perf-seed.ts` criteria-schema defect blocks the `rating PUT`
check and all subsequent timed checks from running).

## 2026-08-10 task-w12-b — walkthrough @ 3b7ed3d

Full detail: docs/verification-log/task-w12-b-walkthrough-2.md

Re-derived the newest code-bearing sha per DEC-114 mechanically from
`main` tip `546cbcc` ("merge task-w11-e"): `git diff --name-only
<sha>^ <sha>` (first-parent for merges) for `546cbcc` and its parent
`15a422a` ("scribe wave 12") each touch only bookkeeping paths
(`docs/verification-log.md`, `decisions/**`, `field-guide/index.md`,
`src/decisions.ts`); `3b7ed3d` ("merge task-w11-a") first-parent-diffs
`scripts/walkthrough/speaker.ts` (186 insertions / 13 deletions of
walkthrough probe code, outside the DEC-114 exclusion set), so it is
code-bearing. This matches task-w11-e's independent spec-audit
derivation of `3b7ed3d` logged immediately above. Note for the record:
DEC-116/DEC-117 expected `3543f09` and assumed no task-w11-* branch
would land, but `task-w11-a` (`2d686bd`/`3b7ed3d`) did land after those
decisions were written — this is exactly the "stray task-w11-* branch"
case DEC-116 anticipated, so DEC-103's duplicate-section rule applies:
re-derive the sha, and since no walkthrough-scope section existed yet
at `3b7ed3d` (grep confirmed only a spec-audit section there), this
lane ran the full gate rather than a confirm-only stub.

RESULT: PASS

## 2026-08-10 task-w12-c — perf-smoke @ 3543f09

Full detail: docs/verification-log/task-w12-c-perf-smoke.md

DEC-069 perf-smoke gate at DEC-088 scale, port 8833. Re-derived the
newest code-bearing sha per DEC-114: worktree branched from `main` at
`2b4a5b9`. `git diff --stat 3543f09 <main tip>` (checked against both
`546cbcc` and `2b4a5b9`, main advanced mid-run) confirms the only files
that changed since `3543f09` ("merge task-w10-e", the sha this task's
brief expected as authoritative per DEC-114/DEC-116) are
`decisions/DEC-113..117.md`, `docs/verification-log.md`,
`field-guide/index.md`, `src/decisions.ts` (constant additions only),
and `scripts/walkthrough/speaker.ts` (walkthrough probe landing per
DEC-112/DEC-113/DEC-116) — zero diff to `src/server/repo/overview.ts`
or any other production route/repo file since `3543f09`, so `3543f09`
and the current main tip are equivalent for this gate's purposes and
running at tip is representative.

RESULT: FAIL — perf:smoke harness errored on the unrelated "rating
PUT" seed-data bug (scripts/perf-seed.ts:269 criteria_json missing
`kind: "rating"`) after the DEC-104 overview fix was independently
confirmed resolved (event overview: 200, p95 22.02ms; DEC-089/094/105
probes all passed); the standing overview-500 OPEN ITEM from
task-w7-c/task-w8-b is closed, but this run itself does not close as a
clean full-gate PASS.

## 2026-08-10 task-w12-d — spec-audit @ 3b7ed3d

Full detail: docs/verification-log/task-w12-d-spec-audit.md

DEC-069 spec-audit gate (static sweep, no server). Step 1 sha
re-derivation per DEC-114: expected `3543f09` per DEC-116 did NOT hold
once re-walked mechanically against the actual first-parent chain.
`e9ec7e0` ("scribe wave 11") is a 0-diff no-op against `3543f09` on
every non-bookkeeping path (confirmed: `git diff 3543f09 e9ec7e0 --
scripts/walkthrough/speaker.ts` is empty; `src/decisions.ts` only
gains pure string-constant appends). `3b7ed3d` ("merge task-w11-a") is
NOT a no-op: its first-parent diff against `e9ec7e0` touches
`scripts/walkthrough/speaker.ts` with substantive additions (Hotel
GET-only distinct-from-Flight handling, the DEC-108 A/B/C
invite-visibility probe block) not present at `3543f09`/`e9ec7e0` — so
per DEC-114's mechanical test it IS code-bearing, matching the
independent derivations already logged by task-w11-b (build+test) and
task-w11-c (walkthrough), both anchored at `3b7ed3d`. Everything after
`3b7ed3d` on the first-parent chain up through the current tip
(`15a422a` scribe wave 12, `546cbcc` merge task-w11-e, `e309b59` merge
task-w11-b, `2b4a5b9` merge task-w11-c) is confirmed non-code-bearing:
`git diff 3b7ed3d 2b4a5b9 -- . ':!docs/verification-log.md'
':!decisions' ':!field-guide'` returns only `src/decisions.ts` (pure
string-constant appends), and `git diff 3b7ed3d 546cbcc --
scripts/walkthrough/speaker.ts` is empty (546cbcc's merge re-lands
content already present since 3b7ed3d, an empty re-merge on that
path). Newest code-bearing sha for wave-12 gates: `3b7ed3d` ("merge
task-w11-a"). This is a genuine, mechanically-derived deviation from
DEC-116's stated expectation, not a defect — DEC-116's premise (that
`3543f09` alone already satisfied DEC-112 without task-w11-a landing)
turned out not to hold once task-w11-a actually merged; the resulting
speaker.ts content is additive test coverage only (no product-code
behavior change), consistent with build+test/walkthrough already
passing at this sha.

## 2026-08-10 task-w12-e — triage-closure @ 3b7ed3d

Full detail: docs/verification-log/task-w12-e-triage-closure.md

DEC-069 fifth-section triage-closure gate (log-only lane, DEC-068
append-only), chained behind task-w12-c per DEC-117 so the new green
perf-smoke evidence for the overview.ts fix is citable. Worktree
branched from `main` after task-w12-c and task-w12-d merged (tip
`9a441aa`, "merge task-w12-d"). Mirrors task-w8-d's structure
(this file, previously lines 1207-1302).

OPEN ITEMS: 1 — `scripts/perf-seed.ts`'s `criteria_json` literal
(~line 269) omits `kind: "rating"`, required by
`src/domain/evaluation.ts`'s `EvaluationCriterionDef` union, so every
`rating PUT` perf-smoke check 400s ("criterion \"overall\" has no
options defined") and blocks the harness from reaching or timing the
remaining checks (`public sessions page`, `public agenda`,
`schedule.ics 150 ids`, `plan progress`). No code-bearing fix exists on
`main` yet (this lane is log-only, DEC-068). A future code-bearing wave
must add `kind: "rating"` to the seeded criterion and re-run
perf-smoke to close the DEC-069 predicate. The overview.ts OPEN ITEM
carried since task-w7-c/task-w8-b is CLOSED and not carried forward.

RESULT: FAIL — perf-smoke gate scope is not a clean PASS at the newest
code-bearing sha `3b7ed3d` (`scripts/perf-seed.ts` rating-criterion
seed defect, confirmed independently by task-w11-d and task-w12-c);
build+test/walkthrough/spec-audit are all PASS, the prior standing
overview.ts OPEN ITEM is closed with runtime evidence, and no
post-`3b7ed3d` commit is code-bearing, so this is a single new
log-only-scope-out-of-bounds open product-code item for a future wave,
not a predicate reset.

RESULT: PASS

## 2026-08-10 task-w11-f — triage-closure @ 3b7ed3d

Full detail: docs/verification-log/task-w11-f-triage-closure-2.md

DEC-069 fifth-section triage-closure gate, log-only lane (DEC-090:
touches only `docs/verification-log.md` and `docs/eval-findings.md`),
chained behind `task-w11-c`'s walkthrough per DEC-093/102/115 so its
runtime evidence is citable. Worktree branched from `main` at tip
`2b4a5b9` ("merge task-w11-c").

OPEN ITEMS: 1

## 2026-08-10 task-w13-a — build+test @ 3b7ed3d

Full detail: docs/verification-log/task-w13-a-build-test-2.md

DEC-069 build+test gate, log-only lane (DEC-077: code-frozen, DEC-103
verify-or-run). Re-derived the newest code-bearing sha per DEC-091/
DEC-114 from a fresh worktree of `main` (tip `a6eb789`, "scribe wave
13"): walking first-parent, `a6eb789` and the entire wave-12/wave-11
tail down to `15a422a` ("scribe wave 12") and `546cbcc` ("merge
task-w11-e") touch only bookkeeping paths (`docs/verification-log.md`
or `decisions/**`+`field-guide/index.md`+pure `src/decisions.ts`
appends); `3b7ed3d` ("merge task-w11-a") is the first commit whose
first-parent diff (`e9ec7e0`..`3b7ed3d`) lands a real file outside the
exclusion set — `scripts/walkthrough/speaker.ts`. Confirms **`3b7ed3d`**
as the newest code-bearing sha, matching the task's expected result
exactly.

RESULT: PASS

## 2026-08-10 task-w13-b — walkthrough @ 3b7ed3d

Full detail: docs/verification-log/task-w13-b-walkthrough-2.md

DEC-069 J1-J12 walkthrough gate, verify-or-run (DEC-103), code-frozen
(DEC-077), log-only lane. Re-derived newest code-bearing sha from a
fresh worktree of `main` (tip `a6eb789` "scribe wave 13"): walking
first-parent back through `9a441aa`/`2aad317`/`f723430`/`3d5d34f`/
`3cfa744`/`2b4a5b9`/`e309b59`/`546cbcc` (each `git diff --name-only
<sha>^ <sha>` touches only `docs/verification-log.md`) and `15a422a`
(touches only `decisions/DEC-116.md`, `decisions/DEC-117.md`,
`field-guide/index.md`, and pure string-constant appends
`DEC_116`/`DEC_117` to `src/decisions.ts` — all in the DEC-114
bookkeeping set) confirms all nine are non-code-bearing. `3b7ed3d`
("merge task-w11-a") first-parent-diffs to `scripts/walkthrough/
speaker.ts` only — outside the bookkeeping set — so it is
code-bearing, matching the expected sha per DEC-118.

RESULT: PASS

## 2026-08-10 task-w13-c — perf-smoke @ 3b7ed3d

Full detail: docs/verification-log/task-w13-c-perf-smoke-2.md

DEC-069 perf-smoke gate, verify-or-run (DEC-103), code-frozen (DEC-077)
log-only lane. Re-derived the newest code-bearing sha per DEC-091/
DEC-114 from a fresh worktree of `main`: `3b7ed3d` ("merge
task-w11-a"), matching DEC-118's expectation. `grep -n "perf-smoke @"
docs/verification-log.md` found `task-w11-d — perf-smoke @ 3b7ed3d`
(ends `RESULT: FAIL`) and `task-w12-c — perf-smoke @ 3543f09` (VOID
sha per this task's brief, but independently confirmed code-equivalent
to `3b7ed3d`, and also ends `RESULT: FAIL`) — no `RESULT: PASS`
section exists at this sha, so the full gate was run rather than
confirmed.

RESULT: FAIL — the w7-c/w8-b `event overview` D1-error OPEN ITEM is
independently reconfirmed CLOSED (200 on all requests, p95 16.09ms,
DEC-104 fix verified in-tree), and 9 of 10 timed checks plus all
DEC-089/DEC-094/DEC-105 probes PASS, but the harness does not complete
a clean run — it errors on the pre-existing, unfixed
`scripts/perf-seed.ts:269` `kind: "rating"` omission during the
"rating PUT" check, an out-of-scope defect for this code-frozen lane.

## 2026-08-10 task-w13-d — triage-closure @ 3b7ed3d

Full detail: docs/verification-log/task-w13-d-triage-closure-2.md

DEC-069 fifth-section triage-closure gate (docs-only, DEC-077/090),
chained behind task-w13-c per DEC-119/DEC-117. Fresh worktree of `main`
cut at `8d762b0` ("merge task-w13-c"), post-dating that merge.

OPEN ITEMS: 1
RESULT: FAIL — perf-smoke has not recorded a clean `RESULT: PASS` at
the current code-bearing sha `3b7ed3d` (blocked on the unrelated
`scripts/perf-seed.ts:269` rating-criteria seed defect); the overview.ts
D1-error symptom itself is independently confirmed CLOSED and is not
the cause of this open item.

## 2026-08-10 task-w15-g — build+test @ 675219f

Full detail: docs/verification-log/task-w15-g-build-test.md

**(1) Sha re-derivation (DEC-114):** walked `git log --first-parent`
from `main` tip `21ea856` ('scribe wave 15'). `git diff --name-only
21ea856^ 21ea856` touches only `decisions/DEC-127.md`,
`field-guide/index.md`, and `src/decisions.ts` (the latter a pure
string-constant append — `export const DEC_127 = "..."`, verified via
`git diff` on that path alone). All three fall inside the
non-code-bearing set, so `21ea856` is non-code-bearing. Newest
code-bearing `main` commit per DEC-114 is `675219f` ('merge
task-w14-k'), matching the expected sha. Build/test were run at the
worktree's `HEAD` (`21ea856`), which is code-identical to `675219f`
(only the three non-code-bearing paths above differ) — no working-tree
mutation beyond this file was made or retained.

RESULT: PASS

## 2026-08-10 task-w16-a — build+test confirm @ 675219f

Full detail: docs/verification-log/task-w16-a-build-test-confirm.md

**Step 1 (DEC-114 sha re-derivation):** walked `git log --first-parent`
from `main` tip `067a5cc` ('scribe wave 16'). Checked
`git diff --name-only <c>^ <c>` for `067a5cc`, `2280419` ('merge
task-w15-j'), `ef788c2` ('merge task-w15-h'), `472dc3a` ('merge
task-w15-g'), and `21ea856` ('scribe wave 15'): all touch only
`docs/verification-log.md`, `docs/eval-findings.md`, `field-guide/**`,
`decisions/**`, and pure string-constant appends to `src/decisions.ts`
(confirmed via `git diff` on that path alone for `21ea856` and
`067a5cc` — each adds exactly one `export const DEC_1NN = "...";`
line). All fall inside the non-code-bearing set per DEC-114, so newest
code-bearing `main` commit is `675219f` ('merge task-w14-k'), matching
the task's expected sha.

RESULT: PASS

## 2026-08-10 task-w15-h — walkthrough @ 675219f

Full detail: docs/verification-log/task-w15-h-walkthrough.md

DEC-114 newest code-bearing sha confirmed `675219f` (merge task-w14-k);
tip `21ea856` (scribe wave 15) adds only a new `DEC_127` string constant
to `src/decisions.ts` plus docs/field-guide — bookkeeping, not
code-bearing, so the gate targets `675219f`.

RESULT: PASS

## 2026-08-10 task-w15-j — spec-audit @ 675219f

Full detail: docs/verification-log/task-w15-j-spec-audit.md

DEC-069 scope-4 spec-audit gate (SPEC §8/§9 static audit plus §2/§6
invariants), log-only lane per DEC-077/DEC-127: the only file this task
modifies is this log.

RESULT: PASS

## 2026-08-10 task-w15-i — perf-smoke @ 675219f

Full detail: docs/verification-log/task-w15-i-perf-smoke.md

Gate re-run (DEC-069 scope 3, DEC-077 log-only lane, code-frozen — only
this file modified). DEC-114 first-parent walk from main tip `21ea856`:
that commit's diff (`decisions/DEC-127.md`, `field-guide/index.md`,
`src/decisions.ts`) is entirely within the DEC-077/114 bookkeeping
exclusion set, so it is not code-bearing; its first parent `675219f`
("merge task-w14-k") touches `src/routes/portal/edit.tsx`,
`src/server/repo/portal-edit.ts`, and three test files — code-bearing.
Newest code-bearing sha: `675219f`, matching DEC-127's expectation.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w16-b — walkthrough confirm @ 675219f

Full detail: docs/verification-log/task-w16-b-walkthrough-confirm.md

DEC-114 newest code-bearing sha re-derived: worktree HEAD's parent chain
is `067a5cc` ("scribe wave 16") -> `2280419` (merge task-w15-j) ->
... -> `21ea856` ("scribe wave 15", non-code-bearing per its own
first-parent diff analysis in the `task-w15-j` section above) ->
`675219f` (merge task-w14-k). No commits code-bearing per DEC-114 exist
between `675219f` and worktree HEAD (`067a5cc`), confirming `675219f`
remains the newest code-bearing sha, matching this task's expectation.

RESULT: PASS

## 2026-08-10 task-w16-d — spec-audit confirm @ 675219f

Full detail: docs/verification-log/task-w16-d-spec-audit-confirm.md

DEC-069 spec-audit gate, DEC-128 confirm-else-run lane (log-only, no
servers). Sha re-derivation (DEC-114): `main` tip at branch time is
`067a5cc` ("scribe wave 16"); its diff against `21ea856` touches only
`decisions/DEC-128.md`, `docs/verification-log.md`, `field-guide/
index.md`, and `src/decisions.ts` — all in the bookkeeping-exclusion
set. `21ea856`'s diff against `675219f` likewise touches only
`decisions/DEC-127.md`, `field-guide/index.md`, `src/decisions.ts` —
also bookkeeping-only. So `675219f` ("merge task-w14-k") remains the
newest code-bearing sha, matching DEC-127's expectation
("675219f or later").

RESULT: PASS

## 2026-08-10 task-w16-c — perf-smoke confirm @ 675219f

Full detail: docs/verification-log/task-w16-c-perf-smoke-confirm.md

DEC-128 confirm-else-run: re-derived DEC-114 newest code-bearing sha —
first-parent walk from main tip `067a5cc` ("scribe wave 16"): that
commit and `2280419` (merge task-w15-j) and `21ea856` (scribe wave 15)
are all bookkeeping-only (docs/decisions/field-guide, no `src`/`scripts`
diff); first-parent lands on `675219f` ("merge task-w14-k"), which
touches `src/routes/portal/edit.tsx`, `src/server/repo/portal-edit.ts`,
and test files — code-bearing. Confirms `675219f` as expected.

RESULT: PASS

## 2026-08-10 task-w15-k — triage-closure @ 675219f

Full detail: docs/verification-log/task-w15-k-triage-closure.md

DEC-069 scope-5 triage-closure gate, chained behind task-w15-i's
perf-smoke PASS per DEC-127(4). Code-frozen (DEC-077): the only file
this task modifies is this log (append-only, DEC-068).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w16-e — triage-closure confirm @ 675219f

Full detail: docs/verification-log/task-w16-e-triage-closure-confirm.md

DEC-128 confirm-else-run. Sha re-derivation (DEC-114): branched from
`main` tip `40c49f6` ("merge task-w15-k"); its diff against `334dc4e`
("merge task-w16-c") touches only `docs/verification-log.md` (135
insertions, the `task-w15-k` section itself) — bookkeeping-only per
DEC-114's exclusion set. All commits between `334dc4e` and `675219f`
(the six wave-16 gate confirms `task-w16-a`..`task-w16-d` plus their
merges) are likewise log-only, already established by those tasks'
own sections above. `675219f` ("merge task-w14-k") remains the newest
code-bearing sha, matching this task's expectation.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w17-a — triage-closure @ 675219f

Full detail: docs/verification-log/task-w17-a-triage-closure.md

DEC-128 confirm-else-run, DEC-129-guarded. Sha re-derivation (DEC-114): first-parent walk from `main` tip `36351c9` back through `42db9f9`/`40c49f6`/`334dc4e`/`5916788`/`cfab488`/`3ef7403`/`067a5cc`/`2280419`/`ef788c2`/`472dc3a`/`21ea856` confirmed each commit's first-parent name-only diff (`git diff --name-only <c>^..<c>`) touches only `docs/`, `decisions/`, `field-guide/`, `src/decisions.ts` — bookkeeping per DEC-114's exclusion set; `675219f` ("merge task-w14-k") remains the newest code-bearing sha. Per DEC-129's explicit warning, the `## 2026-08-10 task-w16-e — triage-closure @ 5692a6d` section (this file, earlier) was **not** used as a confirm source — `git merge-base --is-ancestor 675219f 5692a6d` fails, marking it a prior-campaign homonym. Instead, searched for a section citing a sha S with `git merge-base --is-ancestor 675219f S` true and `OPEN ITEMS: 0`: found `task-w15-k — triage-closure @ 675219f` (this file, line 2914) — S equals `675219f` exactly, so the ancestor check passes trivially (`git merge-base --is-ancestor 675219f 675219f` → true), and the section ends `OPEN ITEMS: 0` / `RESULT: PASS`, covering all five DEC-069 scopes (build+test/walkthrough/perf-smoke/spec-audit/triage-closure itself) plus the DEC-120..125 wave-14 defect closures and the perf-seed `kind:"rating"` closure (`scripts/perf-seed.ts:273`), with a PLANNER:-marker sweep (`675219f..HEAD`, zero hits) and full `RESULT: FAIL` accounting (all 13 hits pre-existing and closed). The subsequent `task-w16-e — triage-closure confirm @ 675219f` section (line 3049) independently re-verified the same sha with its own build+test run and eval-findings re-read, also `OPEN ITEMS: 0` / `RESULT: PASS`. No new commits landed between `675219f` and `36351c9` that touch product code (confirmed above), so no re-run of the full gate is warranted per DEC-128; this task's own worktree build (`npm run build`) and targeted `npm test --silent` pass ran clean as a cheap independent spot-check, matching the cited figures. No servers started.
OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w17-b — triage-closure @ 675219f

Full detail: docs/verification-log/task-w17-b-triage-closure.md

DEC-128 confirm-else-run (redundant mirror of `task-w17-a`, DEC-129:
duplicate PASS sections harmless). Sha re-derivation (DEC-114):
worktree cut from `main` tip `36351c9` ("scribe wave 17"); walked
first-parent back through `42db9f9`/`b26b904` ("merge task-w16-e" /
"task-w16-e: triage-closure confirm @ 675219f", `docs/
verification-log.md` only) and all subsequent commits through
`675219f` ("merge task-w14-k") — every commit's diff falls inside
DEC-114's bookkeeping-exclusion set (`docs/verification-log.md`,
`decisions/DEC-*.md`, `field-guide/index.md`,
`src/decisions.ts` string-constant appends only). `675219f` remains
the newest code-bearing sha, matching this task's `675219f`
expectation.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w19-a — build+test @ 8c7f479

Full detail: docs/verification-log/task-w19-a-build-test.md

DEC-114 sha derivation: `9038b5c` (scribe wave 19, HEAD) diffs only
`decisions/DEC-135.md`, `field-guide/index.md`, and a pure
string-constant append to `src/decisions.ts` -- not code-bearing.
`8c7f479` (merge task-w18-c) diffs `src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` -- code-bearing. Newest
code-bearing sha: `8c7f479`. `git merge-base --is-ancestor 675219f
8c7f479` passes (DEC-129).

DEC-135 behavioral preflight, all four PRESENT: (a) DEC-130 --
`autoSchedule` in `src/domain/schedule.ts` uses incremental
`roomIndex`/`speakerIndex` interval maps + an `overlaps` helper, no
`findConflicts` call and no `[...placed, candidate]` re-scan; (b)
DEC-131 -- `escapeText` in `src/mail/ics.ts` runs
`.replace(/\r\n/g,"\n").replace(/\r/g,"\n")` before the
backslash/`;`/`,`/`\n` escapes; (c) DEC-132 -- `src/routes/public/
submit.tsx`'s file-validation loop starts with `if
(!isVisible(field, answers)) continue;` and the post-create upload
loop starts with `if (cleaned[field.id] !== "pending") continue;`;
(d) DEC-133 -- `src/server/repo/submissions/status.ts`'s
`updateSubmissionStatuses` throws `ApiError("invalid", ...)` naming
unknown ids from the chunked event-scoped SELECT before any
update/planning runs. No fix needed, no STOP.

Environment: node v24.1.0, npm 11.3.0, tsc 5.9.3, vite 6.4.3, vitest
3.2.7. Worktree HEAD (`9038b5c`) is non-code-bearing atop `8c7f479`
(only docs/field-guide/decisions-constant diff), so gates ran at
HEAD, behavior-identical to `8c7f479`.

- `npm run build`: exit 0 (tsc noEmit x2 + vite build, 125 modules,
  entry bundle 179.18 kB raw / 58.63 kB gzip).
- `npm test`: 113 test files passed (113), 1076 tests passed (1076),
  0 failures, 9.28s. Wave-18 fix tests confirmed green:
  `test/schedule.test.ts`, `test/ics-crlf-escaping.test.ts`,
  `test/status-bulk-full-match.test.ts`, and (per `git show --stat
  8c7f479`) `test/submit-hidden-file-field.test.ts` -- 3/3 passed on
  isolated re-run.
- `npm run bundle:check`: exit 0, PASSED, 58.60 kB gzip vs 300.00 kB
  budget.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w19-e — triage-closure @ 8c7f479

Full detail: docs/verification-log/task-w19-e-triage-closure.md

STEP 1 (DEC-114 sha derivation): worktree cut from `main` tip `9038b5c`
("scribe wave 19") — `git show --stat 9038b5c` touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and a pure trailing
`export const DEC_135 = "..."` string-constant append to
`src/decisions.ts` (verified via `git show 9038b5c -- src/decisions.ts`)
— bookkeeping per DEC-114's exclusion set. Walking first-parent back,
`8c7f479` ("merge task-w18-c") is the newest code-bearing sha: `git show
--stat 8c7f479` touches `src/routes/public/submit.tsx` +
`test/submit-hidden-file-field.test.ts` (product code). `git
merge-base --is-ancestor 675219f 8c7f479` → **true** (DEC-129 satisfied).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w19-d — spec-audit @ 8c7f479

Full detail: docs/verification-log/task-w19-d-spec-audit.md

DEC-069 scope-4 spec-audit gate at the post-wave-18 sha, DEC-134/135
third-barrier re-verification, log-only lane (this file is the only
modification; no fix applied per DEC-077/135).

RESULT: PASS

## 2026-08-10 task-w19-c — perf-smoke @ 8c7f479

Full detail: docs/verification-log/task-w19-c-perf-smoke.md

STEP 1: DEC-114 newest code-bearing sha on `main`, first-parent walk from
`9038b5c` (branch tip, "scribe wave 19"): `9038b5c` itself touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and a pure single-line
constant append to `src/decisions.ts` (`export const DEC_135 = ...`) —
bookkeeping, excluded per DEC-114. The next first-parent commit,
`8c7f479` ("merge task-w18-c"), touches `src/routes/public/submit.tsx`
and `test/submit-hidden-file-field.test.ts` — code-bearing. Adopted sha:
`8c7f479`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w19-b — walkthrough @ 8c7f479

Full detail: docs/verification-log/task-w19-b-walkthrough.md

Wave-19 five-gate battery (DEC-135), walkthrough scope, at fresh port
8881.

RESULT: PASS

## 2026-08-10 task-w20-b — perf-smoke confirm @ 8c7f479

Full detail: docs/verification-log/task-w20-b-perf-smoke-confirm.md

Wave-20 confirm-else-run (DEC-136), perf-smoke scope, DEC-129-guarded.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-a — walkthrough confirm @ 8c7f479

Full detail: docs/verification-log/task-w20-a-walkthrough-confirm.md

DEC-136 confirm-else-run lane (walkthrough gate). Worktree cut from
`main` tip `d9be564` ("scribe wave 20").

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-f — spec-audit @ d8d1cbd

Full detail: docs/verification-log/task-w4-f-spec-audit.md

DEC-069/DEC-163 static spec-audit gate lane. Worktree cut from `main`
tip `f357477` ("scribe wave 4").

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-e — render-sweep @ d8d1cbd

Full detail: docs/verification-log/task-w4-e-render-sweep.md

DEC-144/DEC-139 sixth required battery section, wave 4 (DEC-162/163).
Frozen battery sha per DEC-163 (newest code-bearing first-parent `main`
sha after task-w4-a's wave-3 consolidation merges landed, independently
re-derived): `d8d1cbd` ("merge task-w3-c", the last code-bearing commit
before the docs-only `f357477` "scribe wave 4" — `git diff d8d1cbd
f357477 --stat` touches only `decisions/DEC-163.md`, `decisions/DEC-164.md`,
`field-guide/index.md`, `src/decisions.ts`, confirming code-identity).
Confirmed `d8d1cbd` descends from `2dd2f33` (DEC-129 homonym guard) and
remains an ancestor of the current `main` tip.

RESULT: FAIL — 2 of 31 enumerated routes fail the render-sweep at
`d8d1cbd`: (1) `/admin/review/plans/seed_evaluation_plan_0001`
(organizer SPA route) renders an empty `#root` with a console/pageerror
`TypeError: Cannot read properties of undefined (reading 'includes')`;
(2) `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR route)
returns HTTP 400 instead of 200. All other 29 routes (organizer,
reviewer, speaker, public) are clean.

## 2026-08-10 task-w4-d — perf-smoke @ d8d1cbd

Full detail: docs/verification-log/task-w4-d-perf-smoke.md

**Frozen sha.** Adopts the same `d8d1cbd` ("merge task-w3-c") frozen
battery sha already derived and recorded by the sibling gate lane
`task-w4-f — spec-audit` (this file, above): first-parent walk from
`main` tip found no literal `merge task-w4-a` commit for this wave
(DEC-163's designated "sole code-bearing lane" never landed a
commit by that exact label in this campaign round); the newest
first-parent commit that is not bookkeeping-only per DEC-114 is
`d8d1cbd`, which is code-bearing (files library + ZIP archive,
DEC-159/160). `git merge-base --is-ancestor 2dd2f33 d8d1cbd` exits 0
— descends from `2dd2f33` (DEC-129). Using the same sha the other
five gate lanes of this wave cite keeps the battery consistent
(DEC-163).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-g — triage-closure @ d8d1cbd

Full detail: docs/verification-log/task-w4-g-triage-closure.md

DEC-163 battery lane (triage-closure). Frozen sha: `d8d1cbd` ("merge
task-w3-c"), matching the sibling `task-w4-f — spec-audit` section
above — its "Frozen sha derivation" paragraph shows the first-parent
walk from that lane's `f357477` worktree tip finding `f357477` itself
bookkeeping-only (DEC-114) and `d8d1cbd` code-bearing, so `d8d1cbd` is
the newest code-bearing first-parent sha as of wave-4's consolidation.
`git merge-base --is-ancestor 2dd2f33 d8d1cbd` exits 0 — descends from
the campaign-3 reset (DEC-129 homonym guard satisfied). Every file
cited below as closing evidence is present in the tree at `d8d1cbd`
(spot-checked via `git cat-file -e d8d1cbd:<path>` for all 31 files
referenced).

OPEN ITEMS: 0

## 2026-08-10 task-w5-b — build+test @ 64ec7de

Full detail: docs/verification-log/task-w5-b-build-test-2.md

SHA derivation (DEC-114/165): walked `git log --first-parent main`
from HEAD. HEAD (`64ec7de merge task-w5-a`) is not bookkeeping-only,
so no further walk was needed. Confirmed `.github/workflows/ci.yml`
at 64ec7de contains the `render-sweep` job (DEC-166, task-w5-a or
later), and `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0
(DEC-129/139). Adopted sha: 64ec7de.

OPEN ITEMS: none — build, bundle:check, and test all PASS at 64ec7de.
RESULT: PASS — build+test green at 64ec7de (131 modules, 18 assets,
58.86 kB gzip entry bundle, 151 test files / 1308 tests, 0 failures).

## 2026-08-10 task-w5-d — perf-smoke @ 64ec7de

Full detail: docs/verification-log/task-w5-d-perf-smoke.md

STEP 1: frozen sha derivation identical to task-w5-b's spec (first-parent
walk from `main` tip, skipping bookkeeping, must contain the ci.yml
render-sweep job, must descend from `2dd2f33`). `main` tip at worktree
creation is `64ec7de` ("merge task-w5-a"), the first-parent commit
immediately preceding it in the log being `54005df` ("merge task-w4-e").
`64ec7de` is code-bearing: it is the merge of task-w5-a, whose sole
change was adding the `render-sweep` job to `.github/workflows/ci.yml`
(confirmed present: `grep -n render-sweep .github/workflows/ci.yml` hits
`render-sweep:` at line 87, `npx playwright install --with-deps
chromium` at line 96, `npm run gate:render-sweep` at line 97). Ancestor
guard: `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0 — PASS.
Adopted sha: `64ec7de`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w5-e — render-sweep @ 64ec7de

Full detail: docs/verification-log/task-w5-e-render-sweep.md

DEC-144/DEC-139 sixth gate, wave-5 campaign (DEC-165/166); first full
render-sweep run against the wave-5 frozen battery sha. Frozen sha
derivation (first-parent walk on `main`, skipping bookkeeping):
`64ec7de` ("merge task-w5-a") is the current `main` tip — no bookkeeping
commits sit after it to skip. Confirmed it contains the CI render-sweep
job (`git show 64ec7de:.github/workflows/ci.yml` includes a `render-sweep:`
job invoking `npm run gate:render-sweep`) and `git merge-base
--is-ancestor 2dd2f33 64ec7de` succeeds (descends from the DEC-129
homonym-guard commit). Fresh worktree checked out directly at `64ec7de`.

OPEN ITEMS: 2 pre-existing route defects requiring a targeted fix wave
— (1) `/admin/review/plans/:id` plan-detail SPA route crashes with a
`TypeError: Cannot read properties of undefined (reading 'includes')`
in the bundled Review page code (progress/results siblings unaffected);
(2) `/portal/tasks/:id/form` returns HTTP 400 for the seeded task
assignment instead of rendering the task form. Both match the prior
wave-4 sweep's findings verbatim — not new regressions.

RESULT: FAIL — 2 of 31 enumerated routes fail the render-sweep at
`64ec7de`: (1) `/admin/review/plans/seed_evaluation_plan_0001`
(organizer SPA route) renders an empty `#root` with a console/pageerror
`TypeError: Cannot read properties of undefined (reading 'includes')`;
(2) `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR route)
returns HTTP 400 instead of 200. All other 29 routes (organizer,
reviewer, speaker, public) are clean.

## 2026-08-10 task-w5-g — triage-closure @ 5ee31ae

Full detail: docs/verification-log/task-w5-g-triage-closure.md

DEC-165/DEC-166/DEC-139 wave-5 triage-closure lane. Fresh worktree cut
from `main` tip.

OPEN ITEMS: 2 — `task-w4-e — render-sweep @ d8d1cbd`: (1)
`/admin/review/plans/seed_evaluation_plan_0001` empty-`#root` crash
(`TypeError: Cannot read properties of undefined (reading 'includes')`);
(2) `/portal/tasks/seed_task_assignment_0001/form` returns HTTP 400.
Both remain unresolved as of `5ee31ae`; a future code-bearing lane
must fix and re-sweep before a clean DEC-069 exit can be declared.

RESULT: PASS (build+test green, sweep complete, FAIL disposed per
above — this gate's own scope is satisfied; the 2 carried-forward
route defects are the accurate state of the tree, not a failure of
this triage-closure lane itself).

## 2026-08-10 task-w5-c — walkthrough @ 64ec7de

Full detail: docs/verification-log/task-w5-c-walkthrough-3.md

Wave-6 exit-gate battery (DEC-165/166), walkthrough lane, log-only (no
code changes). Fresh worktree of `main` at port 8801.

OPEN ITEMS: (1) `scripts/walkthrough/speaker.ts`'s "find my own general
task" check is incompatible with `scripts/seed.ts`'s deterministic
mod-3 completion formula for the walkthrough's fixed `contactIdx 0`
speaker — either the seed formula or the check needs to change so at
least one `general`-kind task is left pending for that speaker; (2)
`scripts/walkthrough/public.ts`'s speaker-name extractor regex does
not match the live `/speakers` page markup (name wrapped in a nested
`<a>` inside `<strong>`) and needs updating to tolerate the anchor.
Both are walkthrough-harness/seed defects, not product-route defects —
manual `curl` spot-checks of the underlying pages/data showed correct
behavior in both cases. No code changes made in this log-only lane.

RESULT: FAIL — 2 of 6 areas (speaker, public) each hit exactly 1 FAIL
line (0 PLANNER: lines anywhere); producer, review, data, scale are
clean PASS. Both failures are traced to walkthrough-script/seed
mismatches (see OPEN ITEMS), not product-code defects.

## 2026-08-10 task-w5-f — spec-audit @ 64ec7de

Full detail: docs/verification-log/task-w5-f-spec-audit.md

Static log-only audit per DEC-069/DEC-139/DEC-165/DEC-166 (no code changes;
gaps recorded as open items, not fixed). Fresh worktree from `main`.

OPEN ITEMS: 0
RESULT: PASS

## 2026-08-10 task-w8-b — build+test @ 38860f9

Full detail: docs/verification-log/task-w8-b-build-test.md

Derived S per DEC-176/177: first-parent walk from `main` tip lands on
`38860f9` ("merge task-w8-a") directly — this is the newest first-parent
commit, matching the task's own note that task-w8-a has already merged.
`git merge-base --is-ancestor 2dd2f33 38860f9` exits 0. All ten
precondition greps at S hit: `DEC-167` (`src/domain/contacts.ts`),
`ICS_ORGANIZER_EMAIL` (`src/mail/ics.ts`), `unknown track id`
(`src/routes/api/forms.ts`), `anonymized === false`
(`src/server/repo/files.ts`), `openDate`
(`app/src/pages/review/PlanEditor.tsx`), `FORM_TASK_FIELD_SPECS` +
`DEC-174` (`scripts/seed.ts`), `DEC-173` (`scripts/walkthrough/
public.ts` + `speaker.ts`), `DEC-175` (`scripts/walkthrough/
producer.ts` + `speaker.ts` + `review.ts`).

Fresh worktree checked out at S (branch `task-w8-b` off `main`, HEAD =
`38860f9`). `npm ci` clean; `npm run build` (tsc root + tsc app +
vite) PASS — 131 modules transformed, 19 output assets (18 JS + 1
CSS) under `public/admin/assets/`. `npm run bundle:check` PASS —
entry bundle `index-Dtj2KjKK.js` + `index-easpJsYc.css` = 58.86 kB
gzip vs 300.00 kB budget (DEC-058). `npm test --silent` PASS — 151
test files / 1332 tests, all green, 0 failures, including the full
17-file `app/src/**/*.render.test.tsx` render-sweep battery.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w8-e — render-sweep @ 38860f9

Full detail: docs/verification-log/task-w8-e-render-sweep-2.md

DEC-144/DEC-139 sixth gate, rebound per DEC-176/177 substitutions with S =
the `task-w8-a` merge commit. Frozen sha derivation (first-parent walk on
`main`, skipping bookkeeping): `git log --first-parent --oneline` shows
`38860f9` ("merge task-w8-a") as the current `main` tip, directly after
"scribe wave 9" (`a8a4785`) and "scribe wave 8" (`5d3acae`) — no
bookkeeping commits sit after it to skip. `git merge-base --is-ancestor
2dd2f33 38860f9` succeeds (descends from the DEC-129 homonym-guard
commit).

OPEN ITEMS: 0
RESULT: PASS

## 2026-08-10 task-w8-c — walkthrough @ 38860f9

Full detail: docs/verification-log/task-w8-c-walkthrough.md

Wave-8 exit-gate battery (DEC-069/139/176/177 rebinding), walkthrough
lane, log-only (no code changes). Fresh worktree cut from `main` tip.

OPEN ITEMS: 0

RESULT: PASS (6/6 modules PASS at S = `38860f9` — producer, review,
speaker, public, data, scale all clean; both prior task-w5-c FAILs
[speaker general-task round-trip, public surname-ordering extractor]
are now confirmed fixed by the DEC-173/174 harness closure; every
DEC-175 authz probe across producer/review/speaker/data PASSes with
correct existence-hiding semantics).

## 2026-08-10 task-w8-f — spec-audit @ 38860f9

Full detail: docs/verification-log/task-w8-f-spec-audit.md

DEC-069/139/176/177 log-only spec-audit gate. Frozen sha S = `38860f9`
("merge task-w8-a") — identical derivation and all twelve DEC-177
precondition greps as task-w8-b (all HIT). Baseline: `task-w4-f —
spec-audit @ d8d1cbd` (PASS, OPEN ITEMS: 0), confirmed an ancestor of S.
`git diff --name-only d8d1cbd..38860f9` — 45 files — audited: the
wave-6 fix set (DEC-167 contact-merge field preservation, DEC-168 .ics
ORGANIZER/ATTENDEE RFC 5546, DEC-169 form-tracks validation, DEC-170
reviewer file authz plan-scoping + anonymization, DEC-171 review SPA
wire conformance) all PASS against J1/J7/J10/J11/§4/the standards-
compliant-.ics requirement, with clarifications.md checked (no
override applies); DEC-172/174 seed + DEC-173/175 walkthrough changes
confirmed fixtures/harness-only, never product code; the
`src/routes/public.tsx` -> `src/routes/public/*` decomposition
(pre-existing pure refactor caught by the diff range) re-confirmed as
no-behavior-change via its re-export shim and unchanged mount point.
Zero secrets/external-service-credential patterns in the diff;
`ICS_ORGANIZER_EMAIL` is a hardcoded stage-1 dev-local placeholder, not
a live credential; email still routes through the existing dev sink.
Baseline `task-w4-f` verdict spot-checked unregressed (none of its
audited files appear in this diff); the two `task-w4-e` render-sweep
FAILs recorded against `d8d1cbd` are exactly what DEC-171/172 fix.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w9-f — spec-audit @ 38860f9

Full detail: docs/verification-log/task-w9-f-spec-audit-2.md

Wave-9 exit-gate battery (DEC-069/176/177/178 rebinding), spec-audit
lane, log-only (no code changes). Fresh worktree cut from `main` tip
`25e81f9` ("merge task-w8-c").

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w9-d — perf-smoke @ 38860f9

Full detail: docs/verification-log/task-w9-d-perf-smoke.md

Derived S per DEC-114/DEC-176/DEC-177/DEC-178: no literal `merge
task-w9-a` commit descends from `2dd2f33` (the two commits with that
message in history predate `2dd2f33`, from an earlier round);
`38860f9` ("merge task-w8-a") is the newest code-bearing first-parent
commit descending from `2dd2f33` and carries the required
DEC-173/174/175 content — same S already used by sibling gates
`task-w8-b` and `task-w9-b`. `git merge-base --is-ancestor 2dd2f33
38860f9` exits 0. All nine precondition greps at S hit (six w6
anchors: `DEC-167` in `src/domain/contacts.ts`,
`ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts`, `unknown track id` in
`src/routes/api/forms.ts`, `anonymized === false` in
`src/server/repo/files.ts`, `openDate` in
`app/src/pages/review/PlanEditor.tsx`, `FORM_TASK_FIELD_SPECS` in
`scripts/seed.ts`; plus `DEC-173` in `scripts/walkthrough/{public,
speaker}.ts`, `DEC-174` in `scripts/seed.ts`, `DEC-175` in
`scripts/walkthrough/{producer,speaker,review}.ts`).

Verified at S via a disposable detached worktree. `rm -rf
.wrangler/state`; `npm ci` clean; `npm run build` PASS (131 modules,
19 output assets); `npm run db:migrate` (14 migrations clean); `npm
run seed` (required before `perf:seed`, per the w16-c precedent in
this file); `npm run perf:seed` (DEC-088 2k-row scale, all batches
`"success": true`); `npx wrangler dev --port 8833` (not
8787/8801/8803/8831/8832), `/health` 200 on first poll.

`npm run perf:smoke` (`PERF_URL=http://localhost:8833`) — exit 0,
"perf:smoke OK", rerun twice for confirmation. p95 over 30 iterations
(budget 150ms uniform, SPEC §7 finer budgets also satisfied):
submissions list page 1 11.0ms, q=Kubernetes 19.0ms, submission
detail 15.3ms, event overview 14.0ms, organizer agenda (300
accepted) 18.9ms, public sessions page 4.0ms, public agenda 5.4ms,
schedule.ics 150 ids 41.0ms, plan progress (12 reviewers) 18.0ms,
rating PUT 42.1ms — all `ok`. DEC-094/095 301-id cap probe (300 real
accepted ids + 1 synthetic) asserted 400 both runs (script's untimed
one-shot assertion never threw). Compared against `task-w4-d @
d8d1cbd`'s baseline (9.8/12.6/12.7/11.8/16.6/3.2/6.2/32.9/18.2/8.5ms)
— same order of magnitude, no probe near budget, normal local-dev
variance under a concurrently-loaded machine, not a regression.

`npm test --silent` — PASS, 151 test files / 1332 tests, 0 failures,
reproducing `task-w8-b`/`task-w9-b`'s identical counts at the same S.
Server and `workerd` children killed; `lsof -i :8833` confirms port
free.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w9-e — render-sweep @ 38860f9

Full detail: docs/verification-log/task-w9-e-render-sweep.md

LOG-ONLY re-run of the render-sweep battery at the same frozen sha S
used by the sibling wave-9 gates (`38860f9`, merge commit for the
DEC-178 harness-closure code lane; `git diff --stat 38860f9 25e81f9`
(the `main` tip at worktree creation) shows only prior gate-log
appends between S and tip, so the code under test is identical). `git
merge-base --is-ancestor 2dd2f33 38860f9` exits 0 (DEC-139 ancestry
satisfied). All six w6 anchors (DEC-167/168/169/170/171/172) and all
three closure anchors (DEC-173/174/175) confirmed present via grep —
no precondition FAIL.

- `npm run build`: PASS (tsc x2 + vite build, 131 modules).
- `npm run gate:render-sweep`: self-boots migrated+seeded `wrangler
  dev` on a free port; 31/31 `routeManifest` routes PASS, including
  both routes that failed at `d8d1cbd`:
  - `/admin/review/plans/seed_evaluation_plan_0001` (organizer):
    non-empty `#root`, zero console pageerrors — confirms the DEC-171
    `openDate` wire-name fix in `app/src/pages/review/PlanEditor.tsx`
    holds.
  - `/portal/tasks/seed_task_assignment_0001/form` (speaker): HTTP
    200 — confirms the DEC-172 `FORM_TASK_FIELD_SPECS` backing-form
    seed fix in `scripts/seed.ts` holds.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w9-b — build+test @ 38860f9

Full detail: docs/verification-log/task-w9-b-build-test.md

Derived S per DEC-114/DEC-176/DEC-177/DEC-178: first-parent walk from
`main` tip `aa7bf95` ("merge task-w8-b") skips that commit as
log-only (touches only verification-log files) and lands on
`38860f9` ("merge task-w8-a") as the newest code-bearing first-parent
commit — this is task-w9-a's own work, landed under a reused/stale
branch name, confirmed by content (DEC-173/174/175 tags present in
`scripts/walkthrough/{producer,public,review,speaker}.ts` and
`scripts/seed.ts`). `git merge-base --is-ancestor 2dd2f33 38860f9`
exits 0. All ten precondition greps at S hit: `DEC-167`
(`src/domain/contacts.ts`), `ICS_ORGANIZER_EMAIL` (`src/mail/ics.ts`),
`unknown track id` (`src/routes/api/forms.ts`), `anonymized === false`
(`src/server/repo/files.ts`), `openDate`
(`app/src/pages/review/PlanEditor.tsx`), `FORM_TASK_FIELD_SPECS` +
`DEC-174` (`scripts/seed.ts`), `DEC-173` (`scripts/walkthrough/
public.ts` + `speaker.ts`), `DEC-175` (`scripts/walkthrough/
producer.ts` + `speaker.ts` + `review.ts`).

Verified at S via a disposable detached worktree (`git worktree add
--detach ... 38860f9`), keeping the `task-w9-b` branch worktree free
of detached-HEAD state; confirmed `git diff --stat 38860f9 aa7bf95`
shows only log-only changes (zero code delta from S to `main` tip).
`npm ci` clean; `npm run build` (tsc root + tsc app + vite) PASS —
131 modules transformed, 19 output assets. `npm run bundle:check`
PASS — entry bundle 58.86 kB gzip vs 300.00 kB budget (DEC-058).
`npm test --silent` PASS — 151 test files / 1332 tests, all green, 0
failures, including the full `app/src/**/*.render.test.tsx`
render-sweep battery. Independently reproduces the `task-w8-b` gate's
numbers at the same S, as expected under DEC-178 (both wave-9 gates
target the identical frozen sha).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w8-d — perf-smoke @ 38860f9

Full detail: docs/verification-log/task-w8-d-perf-smoke-2.md

DEC-069/DEC-088/DEC-139/DEC-176/DEC-177 gate, wave-8/9 battery (S = the
`task-w8-a` harness-closure merge). Log-only lane; full detail also in
`docs/verification-log/task-w8-d-perf-smoke.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w9-c — walkthrough @ 38860f9

Full detail: docs/verification-log/task-w9-c-walkthrough-2.md

Wave-9 exit-gate battery (DEC-069/176/177/178), walkthrough lane,
log-only (no code changes). Full detail in
`docs/verification-log/task-w9-c-walkthrough.md`. Summary:

OPEN ITEMS: 0

RESULT: PASS (6/6 modules PASS at S = `38860f9`; (a)/(b)/(c) all
confirmed per DEC-178. Duplicates `task-w8-c`'s content at the same S
due to a wave-numbering mismatch between DEC-178's plan and what
actually merged as `task-w8-a`; independently re-run and re-confirmed
here as the wave-9 battery assignment. Flagging for the scribe: DEC-178
literal "merge task-w9-a" naming does not correspond to any commit in
this wave's real history — future wave-9 gates should derive S
mechanically per DEC-114 rather than by literal commit-message match.)

## 2026-08-10 task-w8-g — triage-closure @ 38860f9

Full detail: docs/verification-log/task-w8-g-triage-closure-2.md

DEC-069/DEC-139/DEC-176/DEC-177 gate-of-gates. Log-only lane. Full detail
also in `docs/verification-log/task-w8-g-triage-closure.md`.

**OPEN ITEMS: 0**

**RESULT: PASS**

All six task-w8-* battery sections (`task-w8-a` code lane +
`task-w8-b` build+test + `task-w8-c` walkthrough + `task-w8-d`
perf-smoke + `task-w8-e` render-sweep + `task-w8-f` spec-audit) are
PASS at one frozen S = `38860f9`, with zero open items across the
sibling battery, zero live PLANNER markers, and full eval-findings.md
mandate closure. Per DEC-069/DEC-139/DEC-176, this satisfies the
stage-1 exit predicate: the next wave should find zero open code
tasks and may declare stage-1 complete.

## 2026-08-10 task-w9-g — triage-closure @ 38860f9

Full detail: docs/verification-log/task-w9-g-triage-closure-2.md

LOG-ONLY wave-9 battery capstone (DEC-069/139/176/177/178). Fresh
worktree of `main` tip `916963e` ("merge task-w9-f"), the branch point
after this task's prerequisite `task-w9-e` (and sibling `task-w9-f`)
had already merged. No code touched; only this file and
`docs/verification-log/task-w9-g-triage-closure.md` appended.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-a — build+test @ 7561cc1

Full detail: docs/verification-log/task-w11-a-build-test-2.md

**STEP 1 — derive S'.** First-parent walk from `main` (no `origin/main`
ref reachable in this sandbox worktree; `origin` is a github remote,
unfetched — walked local `main`, which is the harness's tracked copy):
`bdc472b` (scribe wave 11, doc-only) -> `b57bdfd` (merge task-w9-g,
doc-only triage-closure lane per field guide) -> `7561cc1` (merge
task-w10-d, code-bearing: touches `src/routes/api/contacts.ts`,
`src/routes/api/submissions.ts`, `src/routes/files.ts`,
`src/routes/tasks.ts`, `src/server/http.ts` + 2 test files). S' =
`7561cc1`, matching the expected sha. `git merge-base --is-ancestor
2dd2f33 7561cc1` exits 0 — confirmed.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-c — perf-smoke @ 7561cc1

Full detail: docs/verification-log/task-w11-c-perf-smoke-2.md

DEC-186/DEC-185 wave-11 exit-gate battery, perf-smoke lane
(DEC-069/DEC-080/DEC-114/DEC-177/DEC-185 gate). Log-only lane; full
detail in `docs/verification-log/task-w11-c-perf-smoke.md`. Note: an
earlier, unrelated first-campaign section headed `task-w11-c —
walkthrough @ 3b7ed3d` exists in this file (per DEC-129) — that section
is a homonym from a different campaign and is inert here; this section
is the current campaign's `task-w11-c` (perf-smoke lane, not
walkthrough).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-e — spec-audit @ 7561cc1

Full detail: docs/verification-log/task-w11-e-spec-audit-3.md

DEC-186/DEC-185/DEC-179..183/DEC-068 gate. Log-only lane. Full detail
in `docs/verification-log/task-w11-e-spec-audit.md`. Note: a
first-campaign homonym section `task-w11-e — spec-audit @ 3b7ed3d`
already exists earlier in this file (different sha, different
campaign) — inert per DEC-129; this section is distinguished by its
`@ 7561cc1` suffix.

OPEN ITEMS: 0

RESULT: PASS — S' = `7561cc1` ("merge task-w10-d"), 17/17
preconditions hit, delta audited clean against SPEC.md/docs/
precedence (clarifications.md overrides all), all five wave-10 fixes
spec-conformant, zero secrets, no stage-2 wiring.

## 2026-08-10 task-w11-b — walkthrough @ 7561cc1

Full detail: docs/verification-log/task-w11-b-walkthrough-2.md

DEC-186/DEC-185/DEC-177 wave-11 exit-gate battery, walkthrough lane,
log-only (no code changes). Full detail in
`docs/verification-log/task-w11-b-walkthrough.md`. Note: an inert
first-campaign homonym section titled `task-w11-b — build+test @
3b7ed3d` already exists earlier in this file (DEC-186 homonym guard);
this section is distinguished by its full heading including `@
7561cc1` and is unrelated to that history.

OPEN ITEMS: 1 (non-blocking, out of scope — the post-S' `.dev.vars`
`AIRTABLE_TOKEN` addition noted above; does not affect this
walkthrough's PASS result since it postdates S')

RESULT: PASS (6/6 modules PASS at S' = `7561cc1`, all DEC-175 probes
confirmed, DEC-180/181 do not alter walkthrough login/logout behavior
as exercised — logout itself is untested by the walkthrough harness)

## 2026-08-10 task-w11-d — render-sweep @ 7561cc1

Full detail: docs/verification-log/task-w11-d-render-sweep.md

Homonym note: an earlier `task-w11-d — perf-smoke @ 3b7ed3d` section
already exists above (first-campaign, different lane/sha, DEC-129
inert homonym). This section is the wave-11 render-sweep gate.

S' derived per DEC-114 first-parent walk from `main` tip `bdc472b`
("scribe wave 11"): `b57bdfd` ("merge task-w9-g") and `bdc472b` are
doc-only and skipped, leaving **`7561cc1`** ("merge task-w10-d") as
S' — matches this task's expected sha. `git merge-base --is-ancestor
2dd2f33 7561cc1` exits 0 (DEC-139/DEC-144 ancestry satisfied).

All 17 preconditions grep-confirmed present at `7561cc1` via `git show
7561cc1:<path>` (12 DEC-177 anchors: six w6 fixes + six DEC-173/174/175
harness-closure markers; plus DEC-179 in `src/lib/csv.ts`, DEC-180 in
`src/lib/rate-limit.ts`, DEC-181 in `src/server/middleware.ts`, DEC-182
in `src/server/http.ts`, DEC-183 in `wrangler.jsonc`). No precondition
FAIL.

Fresh scratch worktree at S' (`git worktree add --detach 7561cc1`,
removed after use): `npm ci` clean; `npm run build` PASS (131 modules,
0 tsc errors); `npm run db:migrate` PASS (13/13 migrations); `npm run
seed` PASS. `npm run gate:render-sweep` (DEC-144 harness,
`scripts/render-sweep.ts`) run on a freshly cleared local D1/KV/R2
state (the gate self-boots its own migrated+reseeded `wrangler dev`;
running a manual migrate+seed first and then the gate against the same
state causes a harmless but confusing `UNIQUE constraint failed:
pipeline_entry` double-seed collision — not a code regression, see
detail file): **31/31 routes PASS**, matching the count last confirmed
at `38860f9` (task-w8-e/task-w9-e). Zero console pageerrors on every
route, including `/admin/contacts` (DEC-179 CSV export surface) and
`/portal` (DEC-181 sign-out form surface) — both clean. Supplementary
`npm test --silent` in the same worktree: 152 test files / 1364 tests,
0 failures (up from wave-9's 151/1332, consistent with the wave-10
DEC-179..183 fix lane).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-f — triage-closure @ 7561cc1

Full detail: docs/verification-log/task-w11-f-triage-closure-3.md

DEC-069/DEC-139/DEC-185/DEC-186/DEC-177/DEC-114/DEC-068 gate-of-gates
for the wave-11 exit-gate battery, mirroring the `task-w8-g` procedure.
Log-only lane; full step-by-step evidence in
`docs/verification-log/task-w11-f-triage-closure.md`. Note: this file
already has first-campaign homonym sections titled `task-w11-f —
triage-closure @ 3b7ed3d` (and similarly-named `task-w11-a/b/c/d/e`
sections at the same `3b7ed3d`) — per DEC-186 these are inert history
from a different campaign; only the sections below whose full heading
ends `@ 7561cc1` are this wave's live siblings.

OPEN ITEMS: 1 (missing `task-w11-d — render-sweep @ 7561cc1` sibling
section — sole blocker; every other check in this lane is clean: 17/17
preconditions, own build+test 152/1364 green, zero PLANNER markers,
eval-findings.md closure re-confirmed)

RESULT: FAIL — precondition (sibling battery incomplete). Own checks
are green and S' is correctly pinned at `7561cc1`, but the
DEC-069/DEC-139/DEC-185 stage-1 exit predicate requires all five
wave-11 sibling sections PASS at one S', and `task-w11-d —
render-sweep @ 7561cc1` has not merged/run. Re-run this gate next wave
once that lane (or an equivalent render-sweep run at S' = `7561cc1`)
appends its section. Stage-1 completion is NOT declared by this lane.

## 2026-08-10 task-w12-b — build+test @ 7f7477e

Full detail: docs/verification-log/task-w12-b-build-test-2.md

S'' derived by first-parent walk from `main`: tip commit `7f7477e`
("merge task-w12-a") is itself S'' — the expected code-bearing commit
per DEC-114 (not `629d57e`, which is an ancestor, not the walk's
landing point). `git merge-base --is-ancestor 2dd2f33 7f7477e` exits
0. All 12 DEC-177 anchors + 5 DEC-185 markers confirmed present at
S'' (DEC-183 as the `wrangler.jsonc` line-39 comment), plus DEC-188's
new set: `DEC-187` in `scripts/ensure-dev-vars.ts` and
`test/wrangler-config.test.ts`, `ensure-dev-vars` in `package.json`,
and `git ls-files` confirms `.dev.vars.example` tracked / `.dev.vars`
untracked at S''.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w13-a — build+test @ 7f7477e

Full detail: docs/verification-log/task-w13-a-build-test-3.md

DEC-189(2) dedupe: an existing `build+test` section for this exact
S''' (`7f7477e`) was found in this ledger with `RESULT: PASS` from a
task-w12-* lane — citing it verbatim per STEP 0 instead of re-running:
"## 2026-08-10 task-w12-b — build+test @ 7f7477e" (immediately above,
S'' derivation, all 21 DEC-188/DEC-189 preconditions, fresh detached
worktree with no `.dev.vars`, `npm ci`/`npm run build`/`npm test`
152 files / 1368 tests 0 failures/`npm run bundle:check` 58.86 kB
gzip, full detail in `docs/verification-log/task-w12-b-build-test.md`).

OPEN ITEMS: 0

RESULT: PASS — duplicate

## 2026-08-10 task-w12-c — walkthrough @ 7f7477e

Full detail: docs/verification-log/task-w12-c-walkthrough-2.md

DEC-188 wave-12 gate lane: S'' derivation (first-parent walk from
`main`, DEC-114) lands on `7f7477e` ("merge task-w12-a") — matches
DEC-188's expected S'' exactly (w12-a's merge is present, so the
FAIL-precondition branch does not apply). `git merge-base
--is-ancestor 2dd2f33 7f7477e` exits 0. Full detail:
docs/verification-log/task-w12-c-walkthrough.md

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w12-d — perf-smoke @ 7f7477e

Full detail: docs/verification-log/task-w12-d-perf-smoke.md

Derived S'' per DEC-114/DEC-188: `git log --first-parent --oneline`
from `main` tops out at `7f7477e merge task-w12-a`, the expected
merge commit (not the bare `629d57e` precondition-FAIL case).
`git merge-base --is-ancestor 2dd2f33 7f7477e` and `git merge-base
--is-ancestor 629d57e 7f7477e` both exit 0. All 20 DEC-188 precondition
markers hit at S'' (12 DEC-177 anchors, 5 DEC-185 markers, `DEC-187` in
`scripts/ensure-dev-vars.ts` and `test/wrangler-config.test.ts`,
`"ensure-dev-vars"` in `package.json`); `git ls-files` lists
`.dev.vars.example` and not `.dev.vars`.

Verified in a fresh detached worktree at `7f7477e`
(`chautauqua-wt/gate-w12-d-perf`), no `.dev.vars` present beforehand.
`npm ci` clean; `npm run db:migrate` 14/14 clean; `npm run seed`
clean; `npm run perf:seed` all batches `"success": true`; `npx tsx
scripts/ensure-dev-vars.ts` created `.dev.vars` from the tracked
`.dev.vars.example` (never read/printed by this gate); `npx wrangler
dev --port 8899` (avoiding prior-gate ports), `/health` 200 on first
poll.

`PERF_URL=http://localhost:8899 npm run perf:smoke` run twice for
confirmation, both exit 0 ("perf:smoke OK"). p95 over 30 iterations
(budget 150ms uniform per `scripts/perf-smoke-lib.ts`'s
`PERF_P95_BUDGET_MS`), run 1 / run 2: submissions list page 1
12.6/31.1ms, q=Kubernetes 12.0/39.5ms, submission detail 12.6/45.4ms,
event overview 12.5/34.0ms, organizer agenda (300 accepted)
18.4/42.5ms, public sessions page 3.5/11.9ms, public agenda
5.8/26.8ms, schedule.ics 150 ids 84.2/83.2ms, plan progress (12
reviewers) 39.1/18.2ms, rating PUT 31.8/29.3ms — all `ok` both runs,
no budget breached. DEC-094/095 301-id cap probe (untimed, asserts
400) never threw either run.

Compared against the last matching-sha green baseline found via full
heading grep for `perf-smoke @ 38860f9` (distinguishing it from the
dead-campaign homonyms `task-w12-c — perf-smoke @ 3543f09` and
`task-w13-d — perf-smoke @ 0ee30dd`): `task-w9-d — perf-smoke @
38860f9` (PASS, same 150ms budget) reported 11.0/19.0/15.3/14.0/18.9/
4.0/5.4/41.0/18.0/42.1ms. This gate's two runs are the same order of
magnitude for every route; `schedule.ics 150 ids` (83-84ms vs 41ms)
and the general run-2 uplift are normal local-dev variance under a
concurrently-loaded machine, well under the 150ms ceiling — not a
regression.

`wrangler dev`/`workerd` killed after; `lsof -i :8899` confirms the
port free. Local `.dev.vars` (main worktree's, and the fresh copy
`ensure-dev-vars.ts` created in the detached worktree) never read or
printed.

This gate's own checks are green, but per DEC-069/DEC-139/DEC-188 the
stage-1 exit predicate requires all six wave-12 sibling sections
(w12-b, w12-c, w12-d, w12-e, w12-f, w12-g) PASS at this same S'' =
`7f7477e`; this section alone does not declare stage-1 complete.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w12-e — render-sweep @ 7f7477e

Full detail: docs/verification-log/task-w12-e-render-sweep-2.md

**S'' derivation (DEC-114 first-parent walk from `main`).** `git log
--first-parent --oneline main` top entry is `7f7477e merge task-w12-a`
— matches expected. S'' = `7f7477e`.

OPEN ITEMS: 0

RESULT: PASS — 31/31 render-sweep routes green at S'' = `7f7477e`
(`main`'s current tip, first-parent `merge task-w12-a`), `2dd2f33` and
`629d57e` both confirmed ancestors, DEC-188 precondition grep set
fully satisfied, DEC-187 `ensureDevVars` wiring confirmed live via its
boot log in a fresh detached worktree with no pre-existing
`.dev.vars`.

## 2026-08-10 task-w12-f — spec-audit @ 7f7477e

Full detail: docs/verification-log/task-w12-f-spec-audit-2.md

DEC-188 GATE spec-audit lane. S'' derived by first-parent walk from
`main`: `7f7477e` = "merge task-w12-a" — matches expected S'' exactly;
precondition satisfied. `2dd2f33`, `629d57e`, and `38860f9` (audit
baseline) all confirmed ancestors of S'' via
`git merge-base --is-ancestor`. DEC-188 precondition grep set
(DEC-177/179..183 markers, extended through DEC-188) all present in
`src/decisions.ts` at S''.

OPEN ITEMS: 0
RESULT: PASS

## 2026-08-10 task-w13-b — walkthrough @ 7f7477e

Full detail: docs/verification-log/task-w13-b-walkthrough-3.md

DEC-189(2) dedupe: S''' per DEC-114 first-parent walk from `main`
lands on `7f7477e` ("merge task-w12-a"), matching DEC-189's expected
S''' exactly (`git merge-base --is-ancestor 7f7477e main` exits 0). A
`walkthrough` section for this exact sha already exists at full
heading `## 2026-08-10 task-w12-c — walkthrough @ 7f7477e` (see above
in this file) with `RESULT: PASS` — all 6 modules (producer, review,
speaker, public, data, scale) including the DEC-175 negative-authz
probes, and the DEC-187 `ensure-dev-vars` bootstrap confirmed live in
a fresh detached worktree with no pre-existing `.dev.vars`. Per
DEC-189(2), citing that PASS in lieu of re-running. No new worktree,
build, or server was started by this task.

RESULT: PASS (duplicate citation of `task-w12-c — walkthrough @

## 2026-08-10 task-w13-c — perf-smoke @ 7f7477e

Full detail: docs/verification-log/task-w13-c-perf-smoke-3.md

Dedupe per DEC-189(2)/DEC-189(4) (full-heading `@ <sha>` match only,
distinguishing from the inert dead-campaign homonyms `task-w13-c —
triage closure @ d4ebf7f` and `task-w13-c — perf-smoke @ 3543f09`):
S''' derived per DEC-114 (first-parent walk from `main` tops out at
`7f7477e merge task-w12-a` at time of this task's dispatch, `2dd2f33`
and `629d57e` both confirmed ancestors) matches the existing `task-w12-d
— perf-smoke @ 7f7477e` section (RESULT: PASS, two full `perf:smoke`
runs, all p95 rows under the 150ms budget, DEC-080/DEC-088/DEC-094
301-id cap probe never threw). Citing that PASS rather than re-running.

RESULT: PASS (duplicate citation of `task-w12-d — perf-smoke @
7f7477e`)

## 2026-08-10 task-w13-e — spec-audit @ 7f7477e

Full detail: docs/verification-log/task-w13-e-spec-audit-2.md

Duplicate-citation per DEC-189(2)/Step 0: a `spec-audit` section
already exists at S''' = `7f7477e` (`## 2026-08-10 task-w12-f —
spec-audit @ 7f7477e`, above), covering `git diff 38860f9..7f7477e`
(wave-10 DEC-179..183 fixes, operator 629d57e, DEC-187
`ensure-dev-vars` implementation, secrets scan, own build+test) with
RESULT: PASS, OPEN ITEMS: 0. This task-w13-e lane cites that PASS
rather than re-running the gate. (Note: an inert homonym
`task-w13-e — spec-audit @ 0ee30dd` exists from a dead campaign;
matched by full heading only, not applicable here.) No new evidence
collected; no build/test run for this lane.

RESULT: PASS (cited from task-w12-f @ 7f7477e)

## 2026-08-10 task-w13-d — render-sweep @ 7f7477e

Full detail: docs/verification-log/task-w13-d-render-sweep.md

Duplicate-citation per DEC-189(2)/Step 0: a `render-sweep` section
already exists at S''' = `7f7477e` (`## 2026-08-10 task-w12-e —
render-sweep @ 7f7477e`, above), 31/31 routes PASS, zero console/page
errors, DEC-188 preconditions satisfied, DEC-187 `ensureDevVars`
wiring confirmed live in that gate's fresh detached worktree. This
task-w13-d lane cites that PASS rather than re-running the gate. No
new evidence collected; no worktree created for this lane.

RESULT: PASS (cited from task-w12-e @ 7f7477e)

## 2026-08-10 task-w12-g — triage-closure @ 7f7477e

Full detail: docs/verification-log/task-w12-g-triage-closure-2.md

Gate-of-gates per DEC-188 (chained on task-w12-c, which merged
before this lane started). Note: this worktree was created twice —
the first `git worktree add` succeeded and initial analysis was done,
but before the ledger append/commit landed, the working directory and
branch were externally removed (concurrent swarm activity pruned it;
`main` had also advanced from `4bc394c` to `a236116` in the interim).
Recreated the worktree from the then-current `main` and redid the
full derivation below from scratch — no stale state carried over.

OPEN ITEMS: 0

RESULT: PASS — all five DEC-188 wave-12 sibling sections (b/c/d/e/f)
present and PASS at S''=`7f7477e`; every commit after S'' on `main`'s
first-parent line (through the current tip `a236116`) confirmed
non-code-bearing per DEC-114; DEC-139 eval-findings.md closure
(Sections A/B/E/F done, Section C items fixed) re-confirmed still
valid in the current tree; wave-11 historical artifacts (`task-w11-a`
voided, orphan `task-w11-e-spec-audit.md`) correctly superseded;
`.dev.vars` discipline intact. **Stage-1 completion per DEC-069's
five-scope exit predicate (build+test/walkthrough/perf-smoke/
spec-audit/render-sweep, all PASS at one S'') is satisfied by the
DEC-188 wave-12 battery at S''=`7f7477e`.** (This gate does not itself
issue a swarm-wide "stage-1 complete" declaration — per the task's own
scope, that remains a planner-level grep/decision; this section
supplies the closing PASS evidence for it.)

## 2026-08-10 task-w13-f — triage-closure @ 7f7477e

Full detail: docs/verification-log/task-w13-f-triage-closure-2.md

DEC-069/DEC-139/DEC-189 gate-of-gates, mirroring the `task-w11-f`
procedure with DEC-189's dedupe/equivalence and sibling-wait rules.
Log-only lane. Full detail also in
`docs/verification-log/task-w13-f-triage-closure.md`.

**OPEN ITEMS: 0**

**RESULT: PASS**

Steps 1-6 all green, all five gate types PASS at S''' = `7f7477e`
(with `task-w13-*` duplicate confirmations), zero live `PLANNER:`
markers, eval-findings.md Section A/B/E/F closure re-confirmed, and
the w11-b `AIRTABLE_TOKEN` open item is CLOSED per DEC-190. Per
DEC-069/DEC-139/DEC-189, the stage-1 exit predicate is satisfied at
S''' = `7f7477e`, pending planner declaration.

## 2026-08-10 task-w15-f — spec-audit @ 1033d45

Full detail: docs/verification-log/task-w15-f-spec-audit-2.md

**Preconditions (DEC-196/DEC-114).** First-parent walk from `main`
(HEAD `4e5256e` "scribe wave 15") lands on `1033d45` "merge
task-w14-c" as the newest code-bearing commit: `4e5256e`'s own diff
touches only `decisions/DEC-196.md`, `field-guide/index.md`, and
`src/decisions.ts` (one pure append, `DEC_196`, plus a same-line
escape-sequence typo fix inside the already-bookkeeping `DEC_131`
string constant — no executable/application code changed), all
within DEC-114's bookkeeping exclusion set, so it is non-code-bearing
and `1033d45` stands as S'''' exactly as expected. `git merge-base
--is-ancestor 2dd2f33 1033d45` and `--is-ancestor 7f7477e 1033d45`
both exit 0. DEC-196 fix-marker preconditions all present at
`1033d45`: `DEC-191` comment + `contactId: null` in both
`src/routes/api/users.ts` and `src/routes/review.ts`;
`data-required` in `src/views/form-render.tsx`; `chunkSelection` and
`/tracks` in `app/src/pages/submissions/SubmissionsTable.tsx`;
`test/email-log-null-contact.test.ts`, `test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`, `app/src/pages/submissions/bulk.test.ts`
all present in `git ls-tree -r 1033d45 --name-only`, which lists
`.dev.vars.example` and does NOT list `.dev.vars`. No PASS section
citing `spec-audit @ 1033d45` pre-existed on main; this is a fresh
audit, not a citation.

**OPEN ITEMS: 0**

**RESULT: PASS**

## 2026-08-10 task-w15-c — perf-smoke @ 1033d45

Full detail: docs/verification-log/task-w15-c-perf-smoke.md

DEC-196 gate lane, S'''' = `1033d45`. Preconditions confirmed:
`merge-base --is-ancestor` holds for both `2dd2f33` and `7f7477e`
against `1033d45`; all DEC-196 marker greps present (`DEC-191`/
`contactId: null` in `src/routes/api/users.ts` and
`src/routes/review.ts`; `data-required` in `src/views/form-render.tsx`;
`chunkSelection`/`/tracks` in `SubmissionsTable.tsx`; the four new
test/helper files and `.dev.vars.example` present in
`git ls-tree -r 1033d45`, `.dev.vars` absent). No prior
`perf-smoke @ 1033d45` PASS section existed, so ran fresh: `git
worktree add --detach` at `1033d45`, `.dev.vars` confirmed absent
(never read/printed), `npm ci`, `npm run build` (clean), `npm run
db:migrate` (14 migrations 0000-0013), `npm run seed` (required first
for the login-capable fixture organizer — verified empirically, same
precondition documented at every prior perf-smoke gate), `npm run
perf:seed` (2k-row `seed_perf_` scale, idempotent, does not touch demo
seed rows), `npx wrangler dev --port 8952` (DEC-196 lane->port
binding), then `PERF_URL=http://localhost:8952 npm run perf:smoke`.

All 10 timed probes passed within the 150ms budget (p95 3.4ms-35.4ms,
well inside the <150ms envelope observed at `7f7477e`): submissions
list x2, submission detail, event overview, organizer agenda,
public sessions page, public agenda, schedule.ics 150 ids, plan
progress, rating PUT. The DEC-089/DEC-094 301-id `schedule.ics` cap
probe returned 400 as expected. The DEC-105 export-size probes both
passed (submissions.csv >= 2001 lines, showflow.csv >= 301 lines).
Script exited 0 with `perf:smoke OK`. Per the task note, DEC-193's
client-side 500/batch chunking in `app/src/pages/submissions/bulk.ts`
leaves the server's DEC-182 1000-id cap unchanged; no server-side cap
change was probed or expected. `wrangler dev` stopped after the run,
port 8952 confirmed free. No `.dev.vars` was read or printed at any
point.

**OPEN ITEMS: 0**

**RESULT: PASS**

## 2026-08-10 task-w15-a — build+test @ 1033d45

Full detail: docs/verification-log/task-w15-a-build-test-2.md

DEC-196 gate lane, build+test at S'''' = `1033d45` ("merge
task-w14-c"). Log-only lane. Full detail also in
`docs/verification-log/task-w15-a-build-test.md`.

OPEN ITEMS: 1 (the observed `test/auth.test.ts` full-suite flake on
the login rate-limiter's 20th-attempt case; reproduces intermittently
under full-suite concurrency but passes reliably in isolation and on
suite re-run — worth a future look at whether the limiter's in-memory
state or timers need better test isolation, but does not block this
gate).
RESULT: PASS

## 2026-08-10 task-w15-b — walkthrough @ 1033d45

Full detail: docs/verification-log/task-w15-b-walkthrough-2.md

Full run detail: `docs/verification-log/task-w15-b-walkthrough.md`.

**OPEN ITEMS: 0**

**RESULT: PASS**

## 2026-08-10 task-w15-d — render-sweep @ 1033d45

Full detail: docs/verification-log/task-w15-d-render-sweep.md

DEC-196 gate lane (render-sweep, DEC-144/DEC-139). S'''' derived per
DEC-114: newest code-bearing first-parent commit at gate start was
`1033d45` ("merge task-w14-c"), matching DEC-196's EXPECTED value.
`git merge-base --is-ancestor 2dd2f33 1033d45` and `--is-ancestor
7f7477e 1033d45` both confirmed (exit 0).

**OPEN ITEMS: 0**

**RESULT: PASS — 31/31 routes green, zero console/page errors**

## 2026-08-10 task-w15-e — triage-closure @ 1033d45

Full detail: docs/verification-log/task-w15-e-triage-closure-2.md

DEC-069/DEC-139/DEC-195/DEC-196 gate-of-gates, mirroring the
`task-w13-f — triage-closure @ 7f7477e` procedure rebased to
S'''' = `1033d45`. Log-only lane. Full detail also in
`docs/verification-log/task-w15-e-triage-closure.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-a — build+test @ 6807b67

Full detail: docs/verification-log/task-w20-a-build-test-2.md

Verification-only lane per DEC-206/DEC-205/DEC-197 (details in
`docs/verification-log/task-w20-a-build-test.md`).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-c — perf-smoke @ 6807b67

Full detail: docs/verification-log/task-w20-c-perf-smoke-2.md

Wave-20 seventh-generation battery (DEC-206), perf-smoke gate at
FROZEN sha `6807b67`, port 8952. Full detail also in
`docs/verification-log/task-w20-c-perf-smoke.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-d — render-sweep @ 6807b67

Full detail: docs/verification-log/task-w20-d-render-sweep.md

DEC-206 seventh-generation battery lane (render-sweep, DEC-144/
DEC-139), bound to FROZEN sha `6807b67` per DEC-206 with a hard
drift-stop (no rebinding on drift).

**OPEN ITEMS: 1** — `app/src/routeManifest.ts` does not include
`/account` or `/account/password`, so the automated render-sweep gate
does not exercise DEC-200's new account routes (authenticated
password-change form render is unverified by this gate; only the
anonymous-redirect case was manually spot-checked). Recommend a future
task add `/account/password` (organizer/reviewer/speaker role,
authenticated) to the manifest — out of scope for this verification-
only lane to fix.

**RESULT: PASS — 31/31 swept routes green, zero console/page errors;
manifest coverage gap for `/account/password` noted and compensated
with manual curl evidence (anonymous 302 to /login)**

## 2026-08-10 task-w20-b — walkthrough @ 6807b67

Full detail: docs/verification-log/task-w20-b-walkthrough-2.md

Full run detail: `docs/verification-log/task-w20-b-walkthrough.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-e — spec-audit @ 6807b67

Full detail: docs/verification-log/task-w20-e-spec-audit-2.md

DEC-069 scope-4 spec-audit gate, seventh-generation battery (DEC-205/206),
log-only lane (this file plus the optional detail doc below are the only
modification). Full detail: `docs/verification-log/task-w20-e-spec-audit.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-f — triage-closure @ 6807b67

Full detail: docs/verification-log/task-w20-f-triage-closure-2.md

DEC-069/DEC-139/DEC-205/DEC-206 gate-of-gates, seventh-generation battery,
frozen-sha lane (DEC-206). Log-only lane. Full detail also in
`docs/verification-log/task-w20-f-triage-closure.md`.

**OPEN ITEMS: 0** (the `task-w20-d` render-sweep manifest-coverage
note is carried forward as a non-blocking follow-up recommendation,
not a live open item for this gate).

**RESULT: PASS — DEC-069/DEC-139 exit predicate satisfied at 6807b67;
wave 21 may declare stage-1 complete with zero tasks.**

## 2026-08-10 task-w21-c — render-sweep @ 6807b67

Full detail: docs/verification-log/task-w21-c-render-sweep-2.md

DEC-208 wave-21 completion battery lane (render-sweep, DEC-144/
DEC-206/DEC-208), bound to FROZEN sha `6807b67` with the DEC-206 hard
drift-stop.

**OPEN ITEMS: 1** — carried forward from the cited `task-w20-d`
section: `app/src/routeManifest.ts` does not enumerate `/account` or
`/account/password` (DEC-200), so the automated render-sweep gate does
not exercise the authenticated password-change form render; only the
anonymous-redirect case (302 to `/login`) was manually spot-checked in
the cited section. Out of scope for this verification-only lane to
fix; recommend a future task add the route to the manifest.

**RESULT: PASS — confirmed via existing `task-w20-d — render-sweep @
6807b67` full-heading section on main (31/31 swept routes green);
manifest coverage gap for `/account/password` carried forward as
OPEN ITEMS: 1**

## 2026-08-10 task-w21-b — walkthrough @ 6807b67

Full detail: docs/verification-log/task-w21-b-walkthrough-2.md

Full detail: `docs/verification-log/task-w21-b-walkthrough.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w21-a — ledger-repair @ 6807b67

Full detail: docs/verification-log/task-w21-a-ledger-repair.md

Ledger-surgery lane per DEC-207 (sole file touched:
`docs/verification-log.md`). Task brief asserted that `main`'s
`merge task-w20-a` commit (`d1c13d2`) had committed literal conflict
markers `<<<<<<< HEAD` / `=======` / `>>>>>>> task-w20-c` into this
file around lines 7076/7130/7197, and directed deleting those three
lines plus inserting a footer (`OPEN ITEMS: 0` / blank / `RESULT:
PASS`) at the end of the `task-w20-a — build+test @ 6807b67` section.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w21-d — spec-audit @ 6807b67

Full detail: docs/verification-log/task-w21-d-spec-audit-2.md

DEC-069 scope-4 spec-audit gate, task-w21-d lane (DEC-208), log-only
(this file plus the detail doc are the only modification). Full
detail: `docs/verification-log/task-w21-d-spec-audit.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w21-e — triage-closure @ 6807b67

Full detail: docs/verification-log/task-w21-e-triage-closure-2.md

Verification-only, ledger-and-greps triage-closure gate per
DEC-208/DEC-207/DEC-139, run after `task-w21-a`'s ledger repair landed.
No server started, no product code touched. Full detail:
`docs/verification-log/task-w21-e-triage-closure.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-12 task-w11-d — walkthrough-stage1 @ a3dbba6

Full detail: docs/verification-log/task-w11-d-walkthrough-stage1-2.md

SPEC §9 persona walkthrough, all six modules
(`scripts/walkthrough/{producer,review,speaker,public,data,scale}.ts`),
run standalone in sequence against one booted server on `main` @
`a3dbba69137120da98862b2af1091546f67c94c3` (DEC-423, DEC-412). Full
detail: `docs/verification-log/task-w11-d-walkthrough-stage1.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-12 task-w11-e — coldstart/zero-secrets @ a3dbba6

Full detail: docs/verification-log/task-w11-e-coldstart-zero-secrets-2.md

Full detail in `docs/verification-log/task-w11-e-coldstart-zero-secrets.md`.
Fresh `git clone` of `main` @ `a3dbba6` into a scratch dir (no
`node_modules`/`.wrangler`/`.dev.vars` carried over); confirmed no
CHQ/RESEND/AIRTABLE/CLOUDFLARE env var set before any command ran.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-12 task-w11-f — STAGE-1 COMPLETION LEDGER (DEC-423) @ a3dbba6

Full detail: docs/verification-log/task-w11-f-stage-1-completion-ledger-dec-423.md

Log-only lane (no source changed). Full detail in
`docs/verification-log/task-w11-f-spec-audit-stage1.md`. Audited sha
`a3dbba69137120da98862b2af1091546f67c94c3` ("scribe wave 11").

OPEN ITEMS: 4

RESULT: FAIL — two named, narrow, already-decided (DEC-422) GAPs unfixed;
everything else audited is VERIFIED with citations and build/test are
green.

## 2026-08-12 task-w12-e — doc-truth repair (DEC-428) @ 0022580b3069ad14f1dcd8bca9f3029b088ed3ad

Full detail: docs/verification-log/task-w12-e-doc-truth-repair-dec-428.md

Docs-only lane (no source/test/script changed). Full detail in
`docs/verification-log/task-w12-e-doc-truth.md`. Audited sha
`0022580b3069ad14f1dcd8bca9f3029b088ed3ad` ("scribe wave 12").

OPEN ITEMS: 0

RESULT: PASS — SPEC.md:308 corrected to the implemented, DEC-004/DEC-237-cited
value; README.md evaluator credentials and quickstart confirmed byte-accurate
with no drift to repair.

## 2026-08-12 task-w12-c — WCAG AA contrast pass (DEC-426) @ 0022580

Full detail: docs/verification-log/task-w12-c-wcag-aa-contrast-pass-dec-426.md

Added the WCAG AA contrast render-sweep pass per DEC-426: new
`scripts/render-sweep-contrast.ts` (pure luminance/ratio math + PASS/FAIL
evaluation/formatting, unit-tested in
`test/render-sweep-contrast.test.ts` — 12 tests, including pinned
`relativeLuminance`/`contrastRatio` values: `#000000` on `#ffffff` = 21:1,
the palette's `muted` `#565A4B` on `paper` `#F4F1E8` clears 4.5:1,
`#FFFFFF` on `#FFFFFF` = 1:1), plus a small addition to
`scripts/render-sweep.ts` (import block, `measureContrast(page)` helper
next to the DEC-421 `measureFontFloor`, a call inside the desktop
`visitRoute` after the DEC-411 keepNames shim, and a fourth results table
in `main()`).

RESULT: PASS — contrast pass landed, advisory, own module; does not flip
the render-sweep exit code; build/test green.

## 2026-08-12 task-w12-a — render-sweep mobile-overflow instrument correction (DEC-424)

Full detail: docs/verification-log/task-w12-a-render-sweep-mobile-overflow-instrument-correction-dec-424.md

Full transcripts in
`docs/verification-log/task-w12-a-render-sweep-overflow.md`.

RESULT: PASS — instrument corrected and unit-tested; all 6 of wave 10's
admin-mobile FAILs now resolved (5 were instrument false-positives, 1 was a
genuine page bug now fixed).

## 2026-08-12 task-w13-b — build+test+bundle+audit evidence, stage-1 @ fd8b108

Log-only evidence lane (DEC-419/DEC-429), no source file touched. Full
detail in `docs/verification-log/task-w13-b-build-test-stage1.md`.

`npm run build`: clean, both `tsc --noEmit` passes 0 errors, `vite build`
`✓ built in 703ms`, 31 chunks. `npm test --silent`: **268 test files
passed, 2235 tests passed**, 0 failures, 0 skipped. `npm run bundle:check`:
main SPA entry (`index-Cw320nsK.js` + `index-C7tew5xN.css`) = **62.07 kB
gzip against the 300 kB budget** (SPEC.md:355) — PASSED.

`npm audit`: 4 advisories (2 high: `form-data` GHSA-hmw2-7cc7-3qxx,
`lodash` GHSA-r5fr-rjxr-66jc/GHSA-f23m-r3pf-42rh/GHSA-xxjr-mmjv-4gpg; 2
moderate: `react-router`/`react-router-dom` GHSA-wrjc-x8rr-h8h6/
GHSA-337j-9hxr-rhxg). `npm ls` traces every one to a devDependency root
(`jsdom`, `@testing-library/jest-dom`, `react-router-dom` itself) per
`package.json:19-22` (only `hono`/`drizzle-orm` are runtime deps) —
**all 4 devDependency-only, recorded and closed in the same entry, per
DEC-429**. None reaches the shipped Worker bundle; no dedicated stage-1
lane needed. This is the exact repeat DEC-429 targets:
`task-w10-f-build-test-redesign.md:249-256`'s same 4 findings, already
devDependency-only then too.

README.md:43-46 quickstart (`npm i && npm run db:migrate && npm run seed
&& npm run dev`) confirmed verbatim against `package.json` scripts
(`db:migrate`, `seed`, `dev`); no step requires a secret — `db:migrate`/
`seed` are `--local` D1/R2, `dev`'s `predev` (`ensure-dev-vars.ts`) exists
to avoid re-tracking `.dev.vars`, not to require it.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-12 task-w13-c — J1-J12 persona walkthrough (`npm run walkthrough`), stage-1 close

Full transcript in `docs/verification-log/task-w13-c-walkthrough-stage1.md`.
Log-only lane (DEC-419); `scripts/`/`src/` untouched.

Fresh worktree seeded from clean state (`npm run db:migrate` — 18/18
migrations; `npm run seed` — clean; `npm run dev`), then `npm run
walkthrough` against `http://localhost:8787`. Exit code 0, all six
DEC-060/DEC-062 areas PASS: producer (J1, J2, J3, J5), review (J4, 19
steps), speaker (J6, J7, J8, 65 steps), public (J9, J10, 30 steps), data
(J11, J12, 20 steps), scale (110-row volume probe over J3/J6). Runner's own
verbatim summary transcribed in full in the linked file.

Instrument check (DEC-411): the walkthrough modules
(`scripts/walkthrough/{producer,review,speaker,public,data,scale}.ts`) are
HTTP/fetch-level, not Playwright — none calls `page.evaluate`, so
`PAGE_EVALUATE_KEEPNAMES_SHIM` doesn't apply to this runner (it guards the
separate `scripts/render-sweep.ts` lane only). No `ReferenceError: __name is
not defined` anywhere in the output. **Not instrument-blocked.**

J1-J12 x step matrix built: every job has at least one covering step, no
job left uncovered (full table in the linked file). One informational note
for the next wave: `npm run walkthrough`'s "phone" coverage of SPEC.md §9's
public-surface mobile bar is a `viewport` meta-tag presence check only
(`scripts/walkthrough/public.ts:421`, `:519`), not an actual 390x844
Playwright render — that real mobile render lives in the separate `npm run
gate:render-sweep` lane and is out of this task's scope.

No product bugs surfaced; nothing to hand off per DEC-407 (no failure
occurred to demonstrate the ordering guarantee against, though all six
areas did run to completion as designed).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-12 task-w13-f — STAGE-1 COMPLETION LEDGER (DEC-423)

Full detail: docs/verification-log/task-w13-f-spec-audit-stage1.md

Log-only lane. Re-checked task-w11-f-spec-audit-stage1.md's two GAPs
(no rate limit on `POST /submit/:eventSlug/save-draft`; no length caps on
`POST /portal/profile`) directly against this tree: both are fixed
(`src/routes/public/submit.tsx:481-492`, `src/routes/portal/profile.tsx:279-302`),
each with a dedicated behavioral test (`test/submit-draft-limits.test.ts`,
`test/portal-profile-limits.test.ts`). Produced the full five-section
J1-J12/§5/§6/§7-8/§9 ledger with file:line citations re-verified in this
tree; independently traced the four previously-unconfirmed items (J5
reviewer-feedback-attach bonus, optimistic UI + loud rollback, nav prefetch
on hover/focus, nav-interactive-<300ms code-splitting mechanism) to
specific citations. `npm run build` PASS; `npm test --silent` PASS — 268
test files / 2235 tests, 0 failures.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-12 task-w13-g — rubric coverage audit, all 7 docs/eval-rubric/*.yaml files (evidence lane, log-only)

Full detail: docs/verification-log/task-w13-g-rubric-coverage-stage1.md

No prior wave of this campaign had audited `docs/eval-rubric/*.yaml`. Tabled
all 116 `- id:` rows (20 scenario + 96 rubric-criterion) across the 7 area
files against current HEAD, independently re-grepped/re-Read (not copied
from a prior campaign's `task-w11-h-c3-rubric-coverage.md`, used only as a
starting file-location index since its frozen SHA is an ancestor of this
worktree's HEAD). Per-area COVERED/total: CFP 16/16, ABS 13/14 (+1 WAIVED
ABS-14 per DEC-272), SPK 16/16, CNT 14/14, AIA 8/8, EMB 14/16 (+2
PARTIAL-meets-minimum: EMB-03 track-only facets, EMB-15 no branding/color
option — both meet each id's own stated minimum pass bar, not counted
OPEN), CRM 12/12. All 20 scenario rows COVERED (scenario), deferred to the
walkthrough battery. Zero rubric-criterion rows are NOT-COVERED; zero
stage-1 gaps found (a NOT-COVERED item is only a gap if SPEC.md
independently requires it — none did). No rubric-only feature proposed.

RESULT: PASS — OPEN ITEMS: 0.

## 2026-08-12 task-w13-a — DEC-430 contrast fixes + DEC-431 render-sweep flip

Full transcripts in
`docs/verification-log/task-w13-a-render-sweep-stage1.md` (DEC-423
suffix — the unsuffixed `task-w13-a-*` names belong to an earlier
campaign).

DEC-430: `.chq-forms-field-drag`'s glyph colour moved from
`var(--chq-border)` (1.80:1) to `var(--chq-muted)`
(`app/src/pages/forms/forms.css`). `TrackChips`
(`src/routes/public/cards.tsx`) stopped rendering the organizer-supplied
track colour as a text background — it now emits only
`--chq-track-color:<hex>` (strict `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`
guard, DEC-374 pattern; non-matching values emit no style attribute at
all), and `.chq-pub-track-chip` (`src/routes/public/public.css.ts`) is
ink-on-surface with a bordered `::before` swatch dot fed by that custom
property. New `test/public-track-chip.test.ts`. `npm run build` and
`npm test --silent` green (269 files, 2241 tests).

DEC-431 flip: `npm run gate:render-sweep` re-run (own tree, `.wrangler/state`
reset between runs — one run was instrument-blocked by concurrent worker
agents' `wrangler dev` processes contending on the same machine, discarded;
the clean re-run is what's transcribed). Admin-mobile 20/20 and type-floor
83/83 both read all-PASS →`ADMIN_MOBILE_PASS_BLOCKING` and
`FONT_FLOOR_BLOCKING` flipped `true` in `scripts/render-sweep-lib.ts`
(with `test/render-sweep-lib.test.ts` updated to match). Contrast pass:
both DEC-430-named offenders are gone (6 previously-failing track-chip
routes now 6.28-6.82; the drag-glyph route no longer fails on the glyph),
but fixing the glyph unmasked a third, previously-unreported
`--chq-disabled`-on-paper offender (3.06:1) on the same
`/admin/submissions/forms` route that DEC-430 didn't name — 41/42, not
all-PASS. `CONTRAST_BLOCKING` stays `false`, flagged for the next
contrast-remediation wave.

RESULT: PASS (with a scope note) — both named contrast offenders fixed;
two DEC-387 flip-rule passes fired; contrast pass stays advisory pending a
newly-surfaced third offender outside this task's named scope.

## 2026-08-12 task-w13-d — perf:smoke @ 2,000-submission seed (DEC-419, DEC-432 baseline)

Evidence lane, log-only (DEC-419): no source file changed. Seeded the 2k
perf event (`npm run db:migrate && npm run seed && npm run perf:seed`) and
ran `npm run perf:smoke` four times back-to-back against the same running
`wrangler dev`. Full transcribed table, per-endpoint grading, and the
DEC-432 before/after baseline pair are in
`docs/verification-log/task-w13-d-perf-smoke-stage1.md`.

18 of 21 checks PASS comfortably and consistently (wide margin under their
class budgets on every run). Three checks are borderline — PASS on most
runs but FAIL under host contention (a stray `task-w8-i` worktree's
`wrangler d1 execute` process was alive on the same host throughout this
run, per `ps aux`), meaning no safety margin, which SPEC.md:331-332 treats
as a bug not noise: `schedule.ics` (bare, whole-agenda) —
`src/routes/public/index.tsx:197` — diverges sharply from its `agenda.ics`
sibling on the identical `getPublicAgenda` code path (216ms vs 11ms on run
1), flagged for an isolated A/B; `reviewer queue` —
`src/routes/review/reviewer.ts:50` /
`src/server/repo/review/submissions.ts:110` — recomputes the whole plan's
reviewer-assignment table per request (waterfall/full-scan, not scoped to
the requesting reviewer); `plan results` — `src/routes/review/plans.ts:290`
/ `src/routes/review/shared.ts:251` `buildResults` — loads the full plan's
submissions (up to 2,000) and evaluations (up to 6,000) and aggregates in
JS before paging server-side (oversized payload/full-scan, not scoped to
the requested page).

True edge-cache-hit TTFB and Smart Placement are marked STAGE-2-only per
SPEC.md:59-62 — no Cloudflare edge exists under Miniflare's local
`wrangler dev`, so no number is reported for either row.

DEC-432 sibling-lane baseline pair (code unchanged, per this task's scope):
`GET /api/v1/contacts/stats` (`src/server/repo/contacts/stats.ts`) raw p95
17.5-22.1ms, PASSes 50ms read budget at the seed's 800-contact scale;
`GET /portal` (`src/server/repo/portal.ts` `getMyResources`, an org-wide
unscoped `resource` JOIN `event` filtered to the speaker's events in JS
afterward rather than in SQL) raw p95 22.8-48.8ms, PASSes but noisy — both
are "before" numbers for the next wave's before/after pair, not evidence the
DEC-432 fix is unneeded at larger scale. The speaker session used for the
`GET /portal` measurement was a throwaway `user`+`auth_session` row pair
inserted directly into local D1 (same mechanism `scripts/perf-seed.ts`
itself uses) and deleted after measurement, since the perf seed creates no
speaker login.

`npm run build` PASS. No source file touched, so no new/changed tests; this
is an evidence-only lane per DEC-419.

OPEN ITEMS: 3

RESULT: FAIL — see
`docs/verification-log/task-w13-d-perf-smoke-stage1.md` for full detail and
route file:line citations.

## 2026-08-12 task-w15-e — build/test/bundle/render-sweep evidence lane, first BLOCKING mobile + type-floor wave (DEC-443)

Evidence lane, log-only except the single named `CONTRAST_BLOCKING` flip governed by DEC-436/443.
Tree: `main` @ `01815c51fa7abb5c93289b5efe69cfb8bc2866a8` ("scribe wave 15"), worktree
`task-w15-e`. Full transcript, per-gate verdicts, and the CONTRAST_BLOCKING flip check are in
`docs/verification-log/task-w15-e-build-test-stage1.md`.

`npm run build` PASS (0 tsc errors, vite build 670ms). `npm test --silent` PASS — 274 files, 2285
tests, 0 failures. `npm run bundle:check` PASS — entry bundle 62.06 kB gzip / 300 kB budget.

`npm run db:migrate && npm run seed` then `npm run gate:render-sweep` (against the migrated+seeded
local state; `gate:render-sweep` also self-seeds internally, so this lane learned the hard way that
running `seed` twice against the same local D1 file throws a `UNIQUE constraint failed:
pipeline_entry.org_id, pipeline_entry.contact_id` — reset `.wrangler/state/v3/{d1,r2}` and let the
gate's own internal migrate+seed run once cleanly; see the linked log for the full note). Gate
exited 0. Per-gate verdicts, this being the first wave in which ADMIN_MOBILE_PASS and FONT_FLOOR
are BLOCKING:

- Desktop route sweep (BLOCKING): 42/42 PASS.
- Mobile 390px overflow + tap-target sweep (BLOCKING): 21/21 PASS, zero overflow, every control
  ≥44px.
- ADMIN_MOBILE_PASS (now BLOCKING): 20/20 PASS.
- FONT_FLOOR, 10px minimum (now BLOCKING): 83/83 PASS.
- WCAG AA contrast (advisory): 41/42 PASS — one offender, `/admin/submissions/forms` organizer,
  `td` text ratio 3.06 vs required 4.5 (`--chq-disabled` fg `rgb(142,138,122)` on row bg
  `rgb(244,241,232)`), same offender already logged in
  `task-w13-a-render-sweep-stage1.md`, not new.

CONTRAST_BLOCKING flip check (DEC-443): `scripts/render-sweep-contrast.ts:25` reads `false`; this
lane's own run read 41/42, not all-PASS, so **no flip was made** — it stays `false`. No source file
changed by this task.

OPEN ITEMS: 0 new (the one contrast offender is a pre-existing, already-logged advisory finding,
carried forward unowned per DEC-430, not gate-failing).

RESULT: PASS — build, tests, bundle:check, and all four now-BLOCKING render-sweep gates (desktop
sweep, mobile overflow/tap-target, ADMIN_MOBILE_PASS, FONT_FLOOR) all green on this branch's own
run; the advisory WCAG AA contrast pass reads 41/42 with one previously-known, non-blocking
offender named above; `CONTRAST_BLOCKING` correctly stays `false`.

## 2026-08-12 task-w17-e — evidence reconciliation across stage-1 waves 13-16 (DEC-453)

Log-only lane (DEC-452/453): no source file changed by this task. Reconciled all 18
`-stage1`-suffixed evidence logs under `docs/verification-log/` for waves 13-16 (`task-w13-*`,
`task-w14-*`, `task-w15-*`, `task-w16-*`) against `main` as it stood at the sha this task itself
derived and audited — **S' = `7836957e9ae35eb4b2b7c1af8030b0926e3bbfda`** ("scribe wave 17") — by
personally re-reading every cited file:line at that sha inside this task's own worktree, not by
copying any prior log's transcript. Full per-file table (RESULT/OPEN ITEMS as logged, every
closure/VERIFIED claim, and a HOLDS-with-citation or STALE-with-what-changed verdict for each) is
in `docs/verification-log/task-w17-e-evidence-reconciliation-stage1.md`.

Headline finding: `task-w16-f-spec-audit-stage1.md`'s "RESULT: PASS, PENDING-OWNED: none found" —
correct and self-consistent at its own audited sha S (`235d677...`) — is **stale** with respect to
one budget row as of S'. Its claim that "the two prior open items (reviewer-queue whole-plan load,
results-endpoint compute-then-slice) are closed" is only half true today: the *results-endpoint*
half (DEC-439/440) is genuinely closed and re-confirmed in code at S'. The *reviewer-queue* half is
not — `task-w16-c-perf-smoke-stage1.md`, whose measurement landed on `main` after S (folded into
`main` alongside `task-w16-a`/`task-w16-f` by S'), found reviewer-queue still exceeds its 50ms read
budget 4/4 runs (54-88ms) for an unrestricted reviewer at 2,000 submissions — via a *different*
mechanism (chunked per-90-id round-trips in `src/server/repo/review/submissions.ts:201` and
`src/server/repo/review/evaluations.ts:125`) than the one DEC-439 fixed. Re-read directly at S':
both chunked call sites are still present, unchanged since `task-w16-c`'s cut. Owning decision:
**DEC-449** (delete the chunked track lookup and `countEvaluationsBySubmission`'s `submissionIds`
param — never fix by paging/reshaping); not yet landed on `main` as of S' (the two concurrent
wave-17 fix-lane worktrees, `task-w17-a`/`task-w17-f`, had made no commits of their own as of S').

Every other claim across all 18 logs — J1-J12 citations, SPEC §5/6/7/8/9/10 rows, the DEC-430/431
contrast+mobile+font-floor fixes, the DEC-444/445 `CONTRAST_BLOCKING` flip, DEC-439/440/441/442
landings, the rubric-coverage count (116 `- id:` rows), the quickstart/zero-secrets claims, and the
security-probe matrix — **HOLDS** at S', independently re-verified against current file content
(not inherited from any prior log's prose). One additional still-open, unowned item found while
reconciling: the `react-router`/`react-router-dom` v6 moderate dependency advisories flagged by
`task-w14-e-build-test-stage1.md` (`package.json:35` still pins `^6.28.0`) have no owning DEC or
branch across waves 15-17.

This file is the input wave 18's closing ledger must consume for waves 13-16's evidence; per DEC-452
this wave carries no ledger of its own (a ledger cut behind only this fix-adjacent lane would report
sibling wave-17 source lanes PENDING-OWNED).

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

## 2026-08-12 task-w17-f — admin-list pagination audit (DEC-453)

Log-only lane (DEC-452/453): no source file changed, nothing fixed. SPEC.md:193-195/353's "server
pagination... on all admin lists" claim had been graded by every prior ledger from one citation
(`test/pagination.test.ts`, which only unit-tests the pure clamp helpers, not any endpoint's use
of them). This lane instead enumerates every list-envelope-shaped endpoint under
`src/routes/api/**/*.ts`, `src/routes/*.ts`, and the organizer-facing repo functions under
`src/server/repo/`, tracing each handler to its repo function and checking for a real SQL
`LIMIT`/`OFFSET` vs. a bare unbounded `select`. Full per-endpoint table (route, handler file:line,
repo fn file:line, LIMIT/OFFSET present or not, default/max perPage, observed
`perPage=100000`/`perPage=abc` behavior) is in
`docs/verification-log/task-w17-f-pagination-audit-stage1.md`.

Headline finding: six admin-list endpoints carry real DEC-013 pagination with SQL-level bounds
(`/contacts`, `/events/:eventId/submissions`, `/events/:eventId/email-log`,
`/events/:eventId/files`, `/events/:eventId/onboarding`, `/plans/:id/results` — the last via a
DEC-440-blessed JS-side slice, not SQL) — all six correctly clamp `perPage` to 200 and default
invalid input to 50, confirmed **live** against the 2k perf seed (`npm run db:migrate && npm run
seed && npm run perf:seed`, `npm run dev -- --port 8817` per DEC-448, logged in as the seeded
organizer): email-log (5,000 rows), submissions (2,000), onboarding grid (800), contacts (831),
files (600) all returned exactly 200 items for `?perPage=100000` and 50 for `?perPage=abc`, with
`total` always correctly reporting the true seeded count. But the audit also surfaces **13
list endpoints with no SQL bound at all** — `{items, total: items.length, page: 1, perPage:
items.length || 1}` is cosmetic DEC-013 envelope shape-compliance, not real pagination. Two are
org-wide with no natural ceiling and the highest risk of hitting SPEC.md:193-195's "thousands of
rows" case over an org's lifetime: `GET /api/v1/pipeline` (`listPipelineForOrg`,
`src/server/repo/pipeline.ts:136`) and `GET /api/v1/users` (`listOrgUsers`,
`src/server/repo/users.ts:32`) — neither was reproduced as an actual failure at 2k scale (perf-seed
doesn't seed pipeline/extra org users), so this is a static-analysis finding, not a live repro.
Five more are org/event-scoped config lists (segments, events, tracks, rooms, portal resources)
with no enforced ceiling either. The remaining seven are naturally bounded by a narrower parent
resource (one submission's revisions, one user's saved views, one org's API tokens, one event's
templates/plans, one plan's reviewers) and assessed lowest risk. None were fixed — ownership is
open for a future task. Full findings taxonomy and severity reasoning is in the linked log.

This task's worktree was destroyed **twice** mid-audit by an out-of-band process (directory and
branch both vanished while sibling wave-17/18 lanes were active concurrently); no commits existed
at either loss point, so the worktree was recreated fresh off `main` each time and the audit
(including the live perf-seed verification, which was fully completed once before the second
wipe) was preserved from this conversation's own record rather than re-run a second time, given
wave 18 was already merging into `main` by then. Noted as a process observation in the linked log,
not a product finding.

OPEN ITEMS: 7 (2 org-wide-unbounded high-risk, 5 config-scoped-unbounded medium-risk; 7 more
naturally-bounded-but-technically-unbounded endpoints noted as lowest-risk, not counted against
this total; 1 DEC-440-covered non-finding; 1 non-finite-input consistency gap vs. the public
surface, not a defect)

RESULT: PASS — the six real DEC-013-paginated admin-list endpoints all correctly bound `perPage`
and report true `total`, confirmed live at 2k-row scale. The audit found unbounded list endpoints
SPEC.md:193-195/353 does not yet cover in code; none were fixed by this log-only lane per
DEC-452/453.

## 2026-08-12 task-w21-c — build/test evidence, wave 21 (DEC-472, DEC-438, DEC-448)

Log-only lane (DEC-472): no source file changed. sha `bf56ba715a36bcde8bbdb9e01edf7b573c38b0de`
(`git rev-parse HEAD`), `git log --oneline -8` and a `merge-base --is-ancestor` check on all five
wave-20 merge commits confirm `merge task-w20-e`, `merge task-w20-b`, `merge task-w20-a`, and
`merge task-w20-d` are **all** ancestors of this sha — not just `task-w20-c` as the compacted
w20/w21 field-guide entries currently narrate. DEC-472's three requested spot-checks, read
straight from the tree at this sha: `src/lib/pagination.ts:32` exports `listPerPage` (TRUE);
`src/routes/api/pipeline.ts:67` reads `listPerPage(c.req.query("perPage"))`, not
`clampPerPage(... ?? 200)` (the old form is FALSE/gone); `app/src/pages/contacts/
PipelineBoard.tsx:89` renders `{total}` with an explicit DEC-468 comment, not `{entries.length}`
(FALSE/gone). All of wave 20's DEC-465/466/468 fixes are landed at `bf56ba7`.

`npm run build`: exit 0, 155 modules transformed, vite build in 667ms, both `tsc --noEmit` passes
clean (no diagnostics). `npm test`: exit 0, **293 test files, 2669 tests, 0 failures** on a clean
re-run (a first run hit an unrelated `Error: Cannot find module 'ms'` `node_modules`-integrity
crash caused by this lane's worktree being destroyed out-of-band mid-run by a concurrent sibling
lane's cleanup — no commits existed at that point, the worktree was recreated at the identical
sha via `git worktree add ... -b task-w21-c main`, and a fresh `npm ci` + full re-run was fully
green; not counted as a test FAIL since it's a fatal Node.js require error before/during worker
setup, not a vitest assertion failure). `npm run bundle:check`: exit 0, entry bundle
`index-C47BAmZI.js + index-BOb7RLKn.css = 62.06 kB gzip` against SPEC.md:355's 300 KB budget (≈21%
of budget). `npm run gate:render-sweep`: exit 0, `gate:render-sweep OK`, 83/83 font-floor checks
and 42/42 contrast checks passed, zero `FAIL` lines in the full 4950-line output;
`scripts/render-sweep-contrast.ts:33` currently reads `CONTRAST_BLOCKING = true`, consistent with
this run's all-PASS contrast sweep. Zero-secrets: `.dev.vars` is byte-identical to the checked-in
`.dev.vars.example` (`DEV_MODE=1` + `PUBLIC_BASE_URL` only), gitignored, freshly generated by
`scripts/ensure-dev-vars.ts`; a repo-wide grep for common secret-key patterns across every
tracked file returned zero matches. Full detail, including the raw spot-check `grep -n` output and
the recreated-worktree note, is in `docs/verification-log/task-w21-c-build-test-stage1.md`.

OPEN ITEMS: 1 (PENDING-OWNED, not this lane's to fix per its log-only scope — the wave 20/21
field-guide narration claiming only `task-w20-c` merged is factually wrong at this sha and should
be corrected by the scribe/next planner so future waves don't re-plan already-landed pagination
work)

RESULT: PASS — build, test, bundle:check, and gate:render-sweep are all green (exit 0) on a clean,
reproducible run at `bf56ba7`; zero committed secrets; DEC-472's three spot-checks read
TRUE/FALSE/FALSE exactly as the code shows, confirming wave 20's fixes are actually landed,
contradicting (favorably) the compacted field-guide summary.

## 2026-08-12 task-w20-f — list-envelope enumeration, stage 1 (DEC-459/466)

Full detail: `docs/verification-log/task-w20-f-list-envelope-enumeration-stage1.md`.

Log-only lane (DEC-452/453). Mechanically re-derives every `c.json({ items` list-envelope site
under `src/routes/**` (re-runnable `rg` command in the linked file) rather than inheriting
`task-w17-f`'s 20-row list, which DEC-466 found was short by three. Population: 29 mechanical
hits + 2 more (`src/routes/files.ts:166`, `:309`) added because DEC-471 — landed on `main` as a
decision doc but **not** as source at the audited sha — binds this task to reclassify them as
real DEC-013 gaps rather than the "not applicable" this task's own dispatch text originally asked
for. Every row classified BOUNDED-IN-SQL / BOUNDED-IN-JS / CAPPED-ECHO / UNBOUNDED (DEC-473's four
classes) with zero gaps; every BOUNDED-* row live-probed at 2k perf-seed scale (organizer and
reviewer sessions, `?perPage=100000`/`abc`, `?page=1e308`) and confirmed to correctly clamp
`perPage`/report true `total`. Sibling wave-20 lanes DEC-465/466/467 all confirmed landed via
`git merge-base --is-ancestor` against the audited sha; DEC-471 confirmed NOT landed, no owning
branch found, reported PENDING-OWNED per DEC-438/472.

Two findings beyond this task's original scope, both live-reproduced, neither fixed here: (1) two
genuinely unbounded list reads, `GET /api/v1/submissions/:id/files` and `GET
/api/v1/files/:fileId/comments`, per DEC-471; (2) every BOUNDED-IN-SQL row returns HTTP 500
(`SQLITE_MISMATCH`) instead of 400 on `?page=1e308` — `clampPage` treats `Number("1e308")` as a
valid finite integer and the resulting huge offset overflows D1's bind — while every BOUNDED-IN-JS
row degrades gracefully (empty slice, correct `total`, no crash).

This task's own worktree was destroyed mid-task by the same recurring out-of-band-wipe hazard
`task-w17-f` documented, and by the time it was recreated `main` had advanced two full waves past
this task's original dispatch point (`f310111` -> `bf56ba7`, "scribe wave 21" already merged).
Wave 21 as it actually ran does not cite `SPEC.md:353` anywhere in its four merged lanes, meaning
this deliverable's originally-stated consumer already closed without it — flagged as a process
risk in the linked file, not a product finding.

OPEN ITEMS: 4 (2 UNBOUNDED list-envelope sites per DEC-471, PENDING-OWNED no branch; 1
live-reproduced `page=1e308` -> HTTP 500 defect across every BOUNDED-IN-SQL row, unowned; 1
process/orphaning risk — wave 21 already closed without citing this file)

RESULT: PASS — the enumeration is population-complete, mechanically re-derivable, every row
classified with zero gaps, and every BOUNDED-* row live-confirmed at 2k scale. Open items are
findings the enumeration surfaced, not defects in the enumeration itself.

## 2026-08-12 task-w21-b — list-envelope enumeration artifact (DEC-473)

Log-only lane (DEC-473/DEC-472/DEC-466/DEC-459/DEC-453): no source file changed. Produces the
re-runnable enumeration artifact DEC-473 requires — a mechanical `rg` command over
`src/routes/**/*.ts` for `c.json(` calls whose object literal contains an `items` key (multiline
so wrapped forms like `tokens.ts`/`crud.ts`/`submissions.ts`/`bulk-email.ts` are caught), one row
per unique site in exactly four fixed classes (BOUNDED-IN-SQL / BOUNDED-IN-JS / CAPPED-ECHO /
UNBOUNDED, citing the specific repo function + limit/offset or cap constant for each), and a live
probe against the `npm run perf:seed` 2k-submission/5k-email-log/800-file/831-contact/803-pipeline
fixture logged in as the seeded organizer and a perf-seeded (unrecused) reviewer. Full table is in
`docs/verification-log/task-w21-b-list-envelope-enumeration-stage1.md`.

Sha derived fresh in this task's own worktree (per DEC-448, never copied from a prior log):
`bf56ba715a36bcde8bbdb9e01edf7b573c38b0de`. The enumeration command returns 34 raw lines / 30
unique sites (4 are two-line wrapped matches). 27 of 30 are correctly bounded — either a real SQL
`LIMIT`/`OFFSET` with a sibling count function, a DEC-461(e)-blessed JS slice reporting the
pre-slice array length as `total`, or a named recipient cap (`MAX_COMPOSE_RECIPIENTS=100`,
`MAX_BULK_EMAIL_RECIPIENTS=100`, `BULK_EMAIL_PREVIEW_LIMIT=5`) on a mutation echo — and, where
live-probed, all report a true `total` at seeded scale (e.g. `/api/v1/pipeline` returns exactly
200 of 803 with `perPage` absent, matching DEC-465's `listPerPage` default; `/api/v1/review/plans/
:id/queue` returns exactly 200 of a 1,500-item queue). 3 rows remain genuinely unbounded: two
(`src/routes/files.ts:166` `GET /api/v1/submissions/:id/files`, `:309`
`GET /api/v1/files/:fileId/comments` — both ship bare `{items}`, exactly DEC-471's finding) have a
fix in flight on `task-w21-a`, confirmed by content (commit `d5e549f`, touching exactly
`src/routes/files.ts` + `src/server/repo/files-{comments,versions}.ts` +
`test/files-list-bounds.test.ts`) but `git merge-base --is-ancestor d5e549f <this sha>` is
**false** — the branch's local ref had already been deleted (merged elsewhere in the parent repo
concurrently with this task) by the time this was checked, so the fix's presence was verified by
locating its merge commit by diff content rather than by branch name, and it is correctly *not*
credited to this sha per DEC-472. The third (`src/routes/api/forms.ts:259`,
`POST /api/v1/forms/:formId/fields/reorder`, echoing an uncapped `repo.listFields` with no
`MAX_FIELDS`-style ceiling anywhere in the field-create path) is a new finding this pass — not
named in any prior DEC or field-guide entry, and no branch among `task-w20-a`/`task-w20-b`/
`task-w21-a` touches the file.

7 of the 30 rows (2 mail-sending mutations deliberately not fired live to avoid polluting shared
`email_log`/dev-mailbox state for concurrent lanes, the closed-plan queue branch, the bulk-email
preview cap, the fields-reorder mutation, and one comments/one submission-files GET whose sampled
records happened to have zero seeded rows to page through) are marked UNPROBED and rest on source
citation only — none are silently counted as PASS.

Process note, not a product finding: this worktree's directory and branch both briefly vanished
mid-task (same class of out-of-band worktree churn task-w17-f hit) and were recreated fresh off
`main`; separately, the parent repo's actual `main` was observed to have advanced multiple whole
waves (round-tags into the high 20s) while this single log-only task was still in flight, which is
how `task-w21-a`'s branch ref ended up already deleted by the time this artifact checked its
ancestry.

OPEN ITEMS: 3 (2 PENDING-OWNED(task-w21-a): `src/routes/files.ts:166,309`; 1 FAIL-unowned:
`src/routes/api/forms.ts:259`)

RESULT: FAIL — 27 of 30 list-envelope sites under `src/routes` are correctly bounded and, where
live-probed against the 2k-scale perf seed, report a true `total`; 3 are UNBOUNDED at this sha (2
PENDING-OWNED on `task-w21-a`, not credited here per DEC-472; 1 newly-found and unowned). Per
DEC-453 this PASS/FAIL is evidence about sha `bf56ba715a36bcde8bbdb9e01edf7b573c38b0de` only.

## 2026-08-12 task-w21-e — perf smoke + DEC-469 measurability audit (stage 1 close)

Log-only lane (DEC-472/453/438/469): no source file changed. Sha measured: `bf56ba7` (`scribe
wave 21`, confirmed still an ancestor of current `main`). Full per-check `perf:smoke` table, the
DEC-469 measurability audit, the DEC-472 branch-ancestry check, and the four live probes are in
`docs/verification-log/task-w21-e-perf-smoke-stage1.md`.

Headline: all 23 `perf:smoke` checks PASS (exit 0), including the two DEC-469 checks added for
`/api/v1/pipeline` and `/api/v1/users`. Direct sqlite3 query against the seeded D1 file confirmed
803 `pipeline_entry` rows and 104 `user` rows for the perf org — both **measurable at scale**, not
the historical 3/19 the task brief warned about; DEC-469's seed fix (commit `43e6889`, task-w20-e)
is present and effective at this sha. `git merge-base --is-ancestor task-w20-e HEAD` could not be
run literally (the branch ref was deleted post-merge); substituting its tip commit `43e6889`
confirms **true** — task-w20-e's content is an ancestor of this sha. Live authenticated probes
(real cookie-session logins, no bypass) matched the DB counts exactly: pipeline `total=803`, users
`total=104`. The unrestricted-reviewer queue probe found `total=1499`, not DEC-466's claimed
"2,000 shaped rows" — read as a documentation-precision gap in DEC-466's prose (the queue's
`total` is filtered to still-needs-rating/already-rated-by-me by design), not a code defect;
flagged as this lane's one open item.

Two process gotchas hit this lane, both recorded in the linked log for the field guide: (1) the
default `wrangler dev` port 8787 was already bound by a **sibling worktree's** (`task-w21-d`)
server, which silently answered this lane's first `perf:smoke` run and its first `curl` probes
with that other worktree's small pre-perf-seed data — caught by checking `lsof`/`ps` PID→cwd
before trusting any measurement, fixed by pinning `--port 8799`; (2) this worktree was destroyed
mid-lane by an out-of-band process (`.git`, `node_modules`, `src/`, most of `docs/` all vanished),
the same failure class `task-w17-f` hit in wave 17 — recovered by recreating the worktree at the
same sha (deterministic seed) and preserving the already-taken measurements from this session's
own transcript rather than re-running them, since the branch ref `task-w21-e` itself was also gone
by recreation time (this task's actual branch is `task-w21-e-v2`).

OPEN ITEMS: 1 (PENDING-OWNED(none) — DEC-466 prose "all 2,000" vs. measured `total=1499` for the
unrestricted reviewer queue; documentation-precision gap, not a defect, not fixable from this
log-only lane)

RESULT: PASS — all 23 perf:smoke checks green (exit 0) at sha `bf56ba7`, including both DEC-469
checks, both confirmed measurable-by-construction (803/104 rows) rather than assumed from code
presence.

## 2026-08-12 task-w21-d — persona walkthrough @ bf56ba7

Log-only lane (DEC-472/438): no file under `src/`, `app/src/`, `scripts/`, `test/`,
`migrations/`, `decisions/`, or `package.json` was touched. SPEC.md:374-377's "actual final exam"
persona walkthrough had no evidence past wave 19; this cuts one at `bf56ba7` ("scribe wave 21").
Full detail (fresh-install log, `npm run walkthrough` per-module table + two harness-bug root
causes, a full J1-J12 manual browser table citing URL + what was seen per persona, phone-width
table for seven surfaces, and one newly-found real product defect) is in
`docs/verification-log/task-w21-d-walkthrough-stage1.md`.

`npm i && npm run db:migrate && npm run seed && npm run dev` (README.md:37-47's exact Quickstart)
worked with zero secrets present and no undocumented manual step. `npm run walkthrough`: 4/6
areas PASS (producer, review, public, scale), 2/6 FAIL — both traced to walkthrough-script bugs,
not product code: `scripts/walkthrough/speaker.ts:643-659` feeds the locked CFP `email` field a
non-email string, correctly rejected by `src/forms/validate.ts`'s DEC-454 email check (400, not
the script's expected 302); `scripts/walkthrough/data.ts:151-157` resolves "the seeded event" as
`items[0]` of a `desc(startDate)`-ordered list with no slug check, so once the `producer` module
(which runs first) creates its own later-dated throwaway events, `data.ts` silently probes exports
against the wrong (empty) event — the "evaluations export has no rows" FAIL is correct behavior
for the wrong event, not a broken export (52 evaluation rows exist in D1 scoped to the real seeded
event; every other walkthrough module resolves the seeded event by slug, `data.ts` is the outlier).

The manual J1-J12 pass (Playwright/chromium against the same running server, all four seeded
personas) found no further defects in: public CFP submit end-to-end (required-track validation +
confirmation + dev-mailbox email), reviewer queue + anonymized scorecard, decision-without-
auto-email (dev-mailbox count unchanged 10->10 across an Accept click), Comms compose -> preview
(merge-field substitution correct) -> send -> dev-mailbox message -> `.ics` download (file content
correct: right UTC instant, right title), agenda grid (clash badge, tray, per the already-PASSing
automated J9 checks), all five public surfaces + five embeds, exports UI, and zero horizontal
overflow at 390x844 across `/submit/<slug>`, all five `/e/<slug>/*` surfaces, and `/portal` (the
agenda's own horizontally-scrolling day-chip strip is the known DEC-424 carve-out, not a defect).

It did find one real, previously-undocumented product defect: `app/src/pages/comms/icsChip.ts:
13-14`'s `formatLocal()` renders the Comms compose-preview's "Calendar invite: ..." chip via
`new Date(iso).toLocaleString(undefined, ...)` — the *viewer's browser* timezone, not the owning
event's. Live-reproduced as a 3-hour discrepancy: session SES-001 is genuinely scheduled
09:00-09:45 **Pacific** (confirmed three ways — the Admin Agenda grid, the speaker portal's own
session line, and the downloaded `.ics`'s `DTSTART:20270512T160000Z` = 09:00 PDT), but the Comms
preview chip, viewed from a machine set to `America/New_York`, showed "12:00 PM - 12:45 PM." The
`.ics` attachment itself is correct (UTC-based, any real calendar client localizes it right) — only
the human-readable admin preview is wrong, which is exactly the class of bug DEC-424's "OWNING
EVENT's tz never toISOString" rule exists to prevent, and could mislead an organizer proofreading a
room/time email before sending it. Not fixed here (`app/src/` is out of this lane's scope).

This worktree was destroyed out-of-band twice mid-lane (once a bare worktree/branch wipe, once a
full directory wipe coincident with a sibling agent's `pkill -f "wrangler dev"; pkill -f "vite"` —
which kills every worktree's dev server on the shared machine, not just its own); both times it was
recreated pinned to the same `bf56ba7` sha rather than rebasing onto whatever `main` had become, so
this report is evidence about one consistent tree throughout. Flagged in the linked log as a
process observation for the scribe, not a product finding.

OPEN ITEMS: 3, all FAIL-unowned (DEC-438) — `scripts/walkthrough/speaker.ts:643-659`,
`scripts/walkthrough/data.ts:151-157` (both harness bugs, product code is correct), and
`app/src/pages/comms/icsChip.ts:13-14` (real product bug, timezone-display only, `.ics` file
contents unaffected).

RESULT: FAIL — 2/6 `npm run walkthrough` areas FAIL (both harness bugs, not product bugs) plus one
newly-found real product defect (Finding 3, Comms preview timezone display) that this lane could
not fix per its log-only scope. Every other job/persona/surface walked by hand in this report
passed with no defects found.

## 2026-08-12 task-w21-f — stage-1 completion ledger @ 889dffc

Log-only lane (DEC-447/448/438/453/459/471/472/474): no file under `src/`, `app/src/`,
`scripts/`, `test/`, `migrations/`, `decisions/`, or `package.json` was touched. Full detail,
including all row-by-row evidence citations and the six DEC-472 landing-check re-verifications,
is in `docs/verification-log/task-w21-f-stage-1-completion-ledger.md`.

Sha this ledger is evidence about (DEC-448): `889dffc13e68d28f0ca72e260524675cd3b12ad9` ("scribe
wave 22", `main` tip at worktree-cut time). Own `npm run build` (exit 0) and `npm test` (294
files / 2677 tests passed) re-run fresh in this task's own worktree at this exact sha.

J1-J12 (SPEC.md:95-183): PASS, citing task-w21-b's full six-module walkthrough at `27c751e`
(confirmed ancestor), `OPEN ITEMS: 0`. SPEC.md:353 admin-list pagination: graded only from
task-w21-b's DEC-473 mechanical enumeration at `bf56ba7` (confirmed ancestor) — 27/30 sites
correctly bounded; the two `files.ts` sites that enumeration marked PENDING-OWNED(task-w21-a) are
now confirmed merged and fixed at `889dffc` (re-read directly: both emit full
`{items,total,page,perPage}`); one site, `src/routes/api/forms.ts:259`, is re-confirmed still
bare `{items}` with no cap — FAIL-unowned. Perf budgets (SPEC.md:325-335): PASS modulo one
`UNMEASURABLE-BY-CONSTRUCTION` row carried from task-w21-e's log as an open item, not a PASS.
Bundle bar + build/test gates (SPEC.md:355): PASS, task-w21-c at `bf56ba7` plus this task's own
fresh re-run. Quickstart/evaluator fidelity (SPEC.md §8): the task instruction's pointer to
"task-w21-d's fresh-start section" does not hold at this sha (task-w21-d is a spec-audit
confirm-else-run lane with no such section) — substituted the actual most-recent fresh-clone
evidence, `task-w23-f-c3-fresh-clone.md` (confirmed ancestor via `git merge-base --is-ancestor`),
`OPEN ITEMS: 0`, `RESULT: PASS`. All six DEC-472 landing checks (465/466/467/468/469/471)
re-verified directly against file:line at `889dffc`: all TRUE/fixed. Stage-2 scope (Cloudflare
provisioning, `wrangler deploy`, real Resend, Airtable sync, DNS, CI deploy, prod cache) is
explicitly out of scope and not graded.

FAIL-unowned: `src/routes/api/forms.ts:259` (unbounded `{items}` echo, no cap, no owning branch);
one `UNMEASURABLE-BY-CONSTRUCTION` perf-budget row (task-w21-e's log, open item).

PENDING-OWNED: none.

RESULT: NOT PASS — everything else checks out at `889dffc`, but SPEC.md:353's "all admin lists"
is a universal-quantifier claim (DEC-459) and one enumerated site is still unbounded and unowned;
per DEC-438/459 that single miss withholds PASS. Scope of the miss is narrow and named above with
file:line for a direct follow-up fix.

## 2026-08-12 task-w25-f — stage-1 completion ledger @ e5f41c6 (DEC-496)

Full ledger: `docs/verification-log/task-w25-f-stage-1-completion-ledger.md`. LOG-ONLY task; own
`npm run build` (clean, exit 0), `npm test` (303 files / 2765 tests passed), and
`npm run bundle:check` (62.06 kB gzip entry bundle, budget 300 kB) all re-run fresh in this
task's own worktree at this exact sha.

J1-J12 (SPEC.md:95-183): PASS — one clean `npm run walkthrough` run against a freshly
migrated+seeded `wrangler dev --port 8794` (DEC-498: own port, `kill <own PID>` only) passed all
six modules/all twelve journeys, mapped to `scripts/walkthrough/<module>.ts` file:line in the
ledger's §1 table. No module fails at this sha; DEC-493's harness repair (task-w25-a, ancestor of
this sha) holds. One harness usage note logged (the walkthrough scripts are not idempotent
across repeated runs against the same seeded DB) — not a J1-J12 defect.

SPEC.md:353 admin-list pagination: PASS — `npx vitest run test/list-envelope-enumeration.test.ts`
(4/4 green); DEC-488 closure re-confirmed by direct read (`src/server/repo/forms.ts:250`
`MAX_FORM_FIELDS = 200`, `src/routes/api/forms.ts:154-156,264` cap+full envelope); the
`ENVELOPE_ALLOWLIST` in the test carries exactly two entries (`src/routes/comms.ts:388`,
`src/routes/api/contacts/bulk-email.ts:189`), each traced to the constant that actually enforces
it (`MAX_COMPOSE_RECIPIENTS = 100` via `expandRecipients`, `BULK_EMAIL_PREVIEW_LIMIT = 5`).
`src/routes/api/forms.ts:259` (task-w21-f's open item #2 site) is GONE from the allowlist and
from the file — CLOSED.

DEC-488/489/490/491/492 each graded one row at file:line at this sha (ledger §3), all PASS.
DEC-492 in particular — flagged by this task's own brief as a possible PENDING-OWNED
candidate — was checked by mechanical ancestry (`git merge-base --is-ancestor
03c03b9(merge task-w24-e) HEAD` → ancestor) AND by direct read of `src/server/repo/agenda.ts`
(atomic set-based `bumpIcsSequences`, chunked bounded `runAutoSchedule` insert loop capped at
`MAX_AUTO_SCHEDULE_PLACEMENTS = 2000`): landed, not pending.

Perf (SPEC.md:325-338), render/phone (SPEC.md:374-377), quickstart/zero-secrets (SPEC.md:42-47,
361-366): all three cited from in-history ancestor artifacts (`task-w25-c-perf-smoke.md`,
`task-w25-c-public-speaker-scale-stage1.md` for DEC-495's 800-speaker ceiling,
`task-w25-d-render-sweep-stage1.md`, `task-w25-e-fresh-clone-stage1.md`), each confirmed an
ancestor via `git merge-base --is-ancestor`, all `RESULT: PASS` with only advisory open items
carried forward (submission-detail perf noise, a phone-manifest embed-twin gap, a
non-default-port README predev-step gap — the last independently reproduced again in this
ledger's §1/§6).

Carried items from `task-w21-f-stage-1-completion-ledger.md`: item #1 STRUCK by direct quote of
its own cited source (`task-w21-e-perf-smoke-stage1.md:102-103`: "Neither row is
UNMEASURABLE-BY-CONSTRUCTION at this sha" — the opposite of what the open item claimed); item #2
CLOSED (`src/routes/api/forms.ts:259` no longer bare, see above).

Stage-2 scope (Cloudflare provisioning, `wrangler deploy`, real Resend, Airtable sync, DNS, CI
deploy, prod cache) explicitly out of scope and not graded.

FAIL-unowned: none.

PENDING-OWNED: none.

RESULT: PASS — build/test/bundle green, all twelve journeys pass in a clean single-seed
walkthrough run, the DEC-473/480 list-envelope enumeration passes with both allowlist entries
constant-enforced, DEC-488/489/490/491/492 all verify by direct file:line read (including
DEC-492, confirmed landed not pending), perf/render/quickstart artifacts all PASS with only
advisory open items, and both carried task-w21-f items are settled (one struck, one closed). The
FAIL-unowned list is empty.

## 2026-08-13 task-w36-d — build+test+bundle @ fb47a5ee

Ten waves have landed since the last completion ledger (task-w25-f); this run is the current
evidence that main is green at this sha. Full detail in
`docs/verification-log/task-w36-d-build-test.md`. `npm run build`: clean, 0 tsc errors, `vite
build` `✓ built in 902ms`. `scripts/with-test-lock.sh npm test`: **637 test files passed, 6623
tests passed**, 0 failures, 0 skipped (ran after real lock contention from a concurrent process
outside this worktree; resolved on its own). `npm run bundle:check`: entry bundle = **65.29 kB
gzip against the 300 kB budget** (SPEC.md:355) — PASSED. FAIL-unowned: none. PENDING-OWNED: none.

RESULT: PASS

## 2026-08-13 task-w37-d — build+test+bundle @ 68289a92

Full detail: `docs/verification-log/task-w37-d-build-test-bundle.md`. Eleven waves stale since
task-w25-f (the prior full-suite receipt); this lane re-runs the three sanctioned gates fresh, in
this task's own worktree, at its own sha. `npm run build` clean (exit 0). Full suite via
`sh scripts/with-test-lock.sh npx vitest run` (the sanctioned lock-serialized entrypoint): 638
test files / 6629 tests passed, 0 failures. `npm run bundle:check`: entry bundle 65.29 kB gzip
against the SPEC §7 300 KB budget — PASS. Also lands this task's `test/decisions-parity.test.ts`
(4/4 green, included in the 6629 total) and closes the DEC-068/DEC-069-adjacent decisions/README.md
gap (three-digit id space now explicitly declared CLOSED; see decisions/README.md).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-15 task-w9-d — build+test+bundle+walkthrough+render-sweep @ 79f7b7ae

Full detail: `docs/verification-log/task-w9-d-build-test-bundle-walkthrough-render-sweep.md`.
First runtime receipt since `## 2026-08-13 task-w37-d — build+test+bundle @
68289a92`; waves w1-w8 landed on main with no walkthrough/render-sweep
evidence in that gap. Log-only lane per DEC-069/DEC-453: nothing under
`src/`, `app/src/`, `scripts/`, `test/`, `migrations/`, `decisions/`, or
`package.json` touched. `npm run build`: clean (0 tsc errors, vite `✓ built
in 1.08s`). Full suite via `sh scripts/with-test-lock.sh npx vitest run`:
**1008 test files / 11029 tests passed**, 0 failures (no lock contention
hit). `npm run bundle:check`: entry bundle 69.12 kB gzip vs the SPEC §7 300
KB budget — PASS. `npm run db:migrate` (36 migrations) + `npm run seed` +
`npx wrangler dev --port 8817` clean; listener verified as this worktree's
own PID via `lsof -i :8817` at each of 3 restarts, `/health` -> `{"ok":true}`
each time (a fresh worktree has no `.dev.vars` until the `predev` hook or
`scripts/ensure-dev-vars.ts` runs — bare `wrangler dev` skips it and 404s
`/dev/mailbox`; ran the script directly to unblock, not a product defect —
see detail doc).

`npm run walkthrough` (clean single pass, freshly re-seeded): producer PASS,
review PASS, speaker/public/data/scale each FAIL on exactly one new-content
check: `scripts/walkthrough/speaker.ts:460` (completed task not shown as
"Completed" in `/portal/tasks`), `scripts/walkthrough/public.ts:436` (no
"Track filters" nav on `/e/devflow-conf-2027/sessions`),
`scripts/walkthrough/data.ts:467` (showflow.csv header has grown a trailing
`kind` column the script doesn't expect), `scripts/walkthrough/scale.ts:394`
(`readMailboxCount` fetches `/dev/mailbox` with no cookie/credentials; per
`DEC_546` in `src/decisions-data/part3.ts:133` the route is now
organizer-only + org-scoped, so the unauthenticated GET returns the `/login`
page instead of a message count — the walkthrough helper was not updated
when DEC-546 landed). No `PLANNER:` lines anywhere.

`npm run gate:render-sweep` (own server/port, torn down by the script; exit
code 1): desktop 45/60 PASS, public-mobile 15/26 PASS, admin-mobile 24/28
PASS, font-floor 114/114 PASS, type-role 6/7 PASS (advisory),
contrast 59/60 PASS (advisory), interaction-state 2/4 PASS (advisory). Full
per-row tables and selector-level detail in the detail doc; distinct
failure classes: `chq-visually-hidden` label/button vertical clip on public
session/speaker/agenda/gallery pages (desktop + mobile + embed variants),
`chq-auth-wordmark` clip on `/login`/`/logout`, `/admin/submissions/forms`
header clip, `/portal/preview` 404 (organizer, both desktop and admin
mobile), `/admin/*` empty-rendered-text + 404, `/portal/tasks` mobile
horizontal overflow (`main.chq-measure` 560px > 390px viewport),
`/admin/submissions` mobile search-input tap-target 26px < 44px, one
type-role weight-count mismatch on `.chq-overview-deadline-value` (group),
one contrast FAIL on `/admin/review/plans/seed_evaluation_plan_0001`
(ratio 2.43), and two interaction-state FAILs (a disabled-selector that
never resolved, and `.chq-cfp-step-next`'s focus outline not matching the
expected token).

OPEN ITEMS: 9

1. `scripts/walkthrough/speaker.ts:460` — completed general task not shown
   as "Completed" in `/portal/tasks`.
2. `scripts/walkthrough/public.ts:436` — no "Track filters" nav found on
   `/e/devflow-conf-2027/sessions`.
3. `scripts/walkthrough/data.ts:467` — showflow.csv export header carries
   an extra trailing `kind` column vs. the walkthrough script's expected
   header constant (unclear which side is stale).
4. `scripts/walkthrough/scale.ts:394` (`readMailboxCount`) — unauthenticated
   fetch of `/dev/mailbox`; DEC-546 (`src/decisions-data/part3.ts:133`) made
   the route organizer-only + org-scoped, so this helper has been stale
   since DEC-546 landed.
5. Render-sweep desktop/mobile: `chq-visually-hidden` label/button vertical
   clip (clip=18px) across public `/sessions`, `/speakers`, `/agenda`,
   `/gallery` and their `/embed/...` counterparts (both viewports).
6. Render-sweep: `/admin/submissions/forms` — `div.chq-forms-header-titles`
   and `h1` vertical clip (desktop + admin-mobile).
7. Render-sweep: `/portal/preview` — 404 (console error on desktop, status
   404 on admin-mobile).
8. Render-sweep mobile: `/portal/tasks` horizontal overflow 170px
   (`main.chq-measure` 560px in a 390px viewport); `/admin/submissions`
   search input 26px tall, under the 44px tap-target floor.
9. Render-sweep advisory: type-role `.chq-overview-deadline-value` (group)
   weight-count mismatch; contrast FAIL on
   `/admin/review/plans/seed_evaluation_plan_0001` (ratio 2.43,
   `label.chq-review-checkbox-label`); interaction-state FAILs on a
   never-resolved disabled selector and `.chq-cfp-step-next`'s focus
   outline token mismatch.

RESULT: FAIL — build/test/bundle are green; walkthrough and render-sweep
each surface genuine, reproducible open items (not fixed in this log-only
lane per DEC-069/DEC-453 scope).

## 2026-08-15 task-w25-e — render-sweep expectation reconciliation @ 7378401d

Full detail: docs/verification-log/task-w25-e-render-sweep-expectations-7378401d.md

Reconciled three render-sweep instrument expectations that contradicted the
product (DEC-643/DEC-409/DEC-253) plus one instrument-blocked row's triage:

1. `evaluateDeadlineNearestWeights` demanded exactly one weight-700 cell;
   DEC-611's wave-2 amendment makes nearest-deadline emphasis a SET (a tie
   marks every cell sharing the minimum value —
   app/src/pages/overview/rows.test.ts:180-189). Re-expressed as: every
   cell at the minimum displayed value reads 700, every other cell reads
   400 (so a wrongly-bolded non-minimum 700 cell still fails), zero 700s
   while a deadline is set still fails.
2. `ADMIN_MOBILE_ROUTE_MANIFEST` dropped `expectedStatus`, so
   `/portal/preview`'s deliberate 404 (src/routes/portal/preview.tsx:96-145)
   always FAILed the mobile pass even once desktop passed. Carried
   `expectedStatus` through `MobileRouteEntry`/`evaluateMobileRoute`, same
   as the desktop pass.
3. `cfp-primary-focus`'s probe used `locator.focus()` (not read as a
   keyboard interaction by Chromium's `:focus-visible` heuristic for a
   `<button>`), so the real `:focus-visible` rule in src/views/theme.ts:170
   never applied to the measurement. Fixed the probe to induce a real
   `page.keyboard.press("Tab")` walk before reading the outline. Product
   CSS untouched; unverified end-to-end (needs a live gate run) — flagged
   as an OPEN ITEM if still absent after a real run.
4. `review-anonymize-disabled`'s selector is real markup
   (PlanEditor.tsx:1337-1345, gated on `planHasSubmittedReview`, an
   asynchronously-fetched value) but the probe's `locator.count()===0`
   snapshotted with no wait. Re-pinned (same route) by waiting for the
   selector to attach (5s) instead of an instant unwaited count.

RESULT: PASS (targeted) — `npx vitest run test/render-sweep-type-roles.test.ts
test/render-sweep-interaction-states.test.ts`: 34/34. No regression:
`npx vitest run test/render-sweep-lib.test.ts`: 87/87. `npx tsc --noEmit`
and `npm run build`: clean.

OPEN ITEMS: mobile pass has no console-error collection at all (item 2's
reused `filterExpectedStatusConsoleNoise` has nothing to filter there yet
— out of this task's file scope); item 3's keyboard-Tab fix is unverified
end-to-end (no live server in this sandbox).

## 2026-08-15 task-w25-a — render-sweep clip probe @ 1950921d

DEC-620 wave-25 amendment: made the vertical-clip probe truthful.
`scrollHeight > clientHeight` alone was never a clip — the in-page probe
now measures raw geometry + three boolean facts per candidate (self is a
deliberate scroll container, a real clipping context exists on
self/ancestor, the overflowing content is a replaced-content crop) and
hands them to a pure, unit-tested predicate (`isGenuineClipOffender` /
`selectClipOffenders`, `scripts/render-sweep-lib.ts`) requiring all of:
(0) not a deliberate self-scroll container (own `overflow-y`
auto|scroll — the pre-existing rule the amendment doesn't repeal), (i) a
real clipping context on self/ancestor, (ii) not the visually-hidden
collapse (`clientHeight <= 1px`), (iii) not a replaced-content crop
(img/video or declares `object-fit`). No product CSS touched.

A first-pass implementation of condition (i) alone (without restoring (0))
regressed `main.chq-main` (the app's one deliberate `overflow-y: auto`
scroll region, `app/src/styles.css:404-409`) into a false-positive
offender on nearly every admin route (desktop dropped to 40/60). Condition
(0) was added and the regression confirmed fixed by re-running the gate.

Unit tests: `test/render-sweep-lib.test.ts` — one case per exemption
(0)-(iii) plus a genuine-clip case proving the exemptions never swallow a
real defect. `npx vitest run test/render-sweep-lib.test.ts`: 95/95 passed.
`npm run build`: green.

`npm run gate:render-sweep` (own wrangler dev, free port, DEC-119):
desktop 59/60 routes passed (surviving FAIL: `/admin/submissions/forms`
`div.chq-forms-header-titles`/`h1` clip=3px, a genuine clip — same one
this repo's task-w17-d/w25-d receipts already knew about); mobile 25/26
(surviving FAIL: `/portal/tasks` horizontal overflow, unrelated to the
clip probe); admin-mobile (advisory) 25/28 (surviving FAILs:
`/admin/submissions` tap-target size, the same
`.chq-forms-header-titles`/`h1` clip at 390px, `/portal/preview` 404 — all
pre-existing, unrelated to the clip probe). Every one of the 11
`chq-visually-hidden`/`chq-pub-speaker-list-photo`/`chq-auth-wordmark`-
shaped false positives from task-w17-d's receipt no longer appears.
Full detail: `docs/verification-log/task-w25-a-render-sweep-clip-1950921d.md`.

RESULT: clip probe fixed and verified truthful; one genuine clip offender
(`.chq-forms-header-titles`/`h1`, `app/src/pages/forms/forms.css`) and a
handful of pre-existing unrelated FAILs (tap-target size, `/portal/preview`
404, `/portal/tasks` horizontal overflow) remain open, recorded not fixed
per this task's scope.

## 2026-08-15 task-w26-f — walkthrough @ 73f380f2

Full detail: docs/verification-log/task-w26-f-walkthrough-73f380f2.md

DIAGNOSTIC — this section is VOID for DEC-069 exit purposes: wave 26 lands
five code lanes, so code merged after the `73f380f2` sha measured here.
Its job is to hand wave 27's pure gate battery a defect list before that
wave's exit run, not to certify the tip.

`ensure-dev-vars`/`vite build`/`db:migrate`/`seed` all green on a fresh
worktree. First boot on port 8823 hit an env mismatch (this lane's own
`.dev.vars` still had the default `PUBLIC_BASE_URL=http://localhost:8787`
per DEC-296, unrelated to any product code) which made J2's scraped
reset-link resolution refuse an off-origin URL; corrected the gitignored
`.dev.vars`, wiped `.wrangler/state`, re-migrated/re-seeded, and ran one
clean walkthrough against the live `wrangler dev` on port 8823.

Result: `producer`/`review`/`public`/`data`/`scale` all PASS. `speaker`
FAILs one check: `GET /portal/tasks` never shows "version 2" in the
DEC-244 deliverable panel for a completed `file_request` ad hoc task
assignment re-uploaded onto an already-complete (DEC-739-seeded,
version_no=1) assignment — `scripts/walkthrough/speaker.ts:805`.
Candidate source (not diagnosed further, not fixed):
`src/routes/portal/tasks/views.tsx:296` and
`src/routes/portal/tasks.tsx:175-188`.

Because the walkthrough completed (produced a full Summary + exit),
`npm run build` (tsc + vite, both green) and `npm run bundle:check`
(69.19 kB gzip entry vs 300 kB budget, PASSED) were also run per this
lane's brief.

RESULT: FAIL — one J1-J12 walkthrough check (speaker lane, DEC-244
deliverable panel "version 2" text) fails; build and bundle:check both
green.
OPEN ITEMS: 1 — see task-w26-f-walkthrough-73f380f2.md for the full repro.

## 2026-08-15 task-w27-b — build+test+bundle @ ceda66f2 [DIAGNOSTIC]

INVALIDATED BY: src/**, app/src/**, test/**, package.json, migrations/**

Full detail: docs/verification-log/task-w27-b-build-test-ceda66f2.md

Ref truth at read time: `main` = `ceda66f2` (S). All six wave-26 lanes
(`task-w26-a`..`task-w26-f`) are ancestors of main (merged). `task-w27-a`,
`task-w27-b`, `task-w27-c`, `task-w27-d` all equal S exactly when this
worktree was cut — per DEC-069's wave-17 amendment, PRODUCED NOTHING at
that point (expected: task-w27-a lands code later this same wave, observed
mid-run to have advanced to `900f8326`).

Detached worktree at S: `npm ci` PASS; `npm run build` (tsc x2 + vite)
PASS; `sh scripts/with-test-lock.sh npx vitest run` **FAIL** — 37 failing
tests / 11703 passed (11740 total), 11 failing files (`test/auth-login-
lockout.test.ts`, `test/count-grammar.test.ts`, `test/cross-org-reviewer-
probe.test.ts`, `test/file-put-compensation.scan.test.ts`, `test/forgot-
response-path-parity.test.ts`, `test/login-account-budget.test.ts`,
`test/password-reset-flow.test.ts`, `test/plural-scan.test.ts`, `test/
reaccept-onboarding.test.ts`, `test/review-plan-scope-real-rows-probe.
test.ts`, `test/users-name-persistence.test.ts`). Two root causes visible
in the transcript: (1) an in-process vitest SQLite fixture bootstrap that
several suites share throws `table user has no column named name` even
though `src/db/schema/org.ts` and `migrations/0039_user_name.sql` both
already declare/add that column (landed by task-w26-c) — the D1/wrangler
`db:migrate` path below is clean, so this looks like a stale fixture-
bootstrap gap specific to the in-process test harness, not the schema
itself; (2) `test/users-name-persistence.test.ts`'s two mutating cases 500
with `TypeError: db.select is not a function` thrown from
`getAnchorEventForOrg` (`src/server/repo/events.ts:96`) via `POST /api/v1/
users` (`src/routes/api/users.ts:100`). Neither diagnosed further or fixed
(log-only lane).

`test/spa-mutation-contract.scan.test.ts` (red since wave 16, `expect(gaps)
.toEqual([])` at :560) is **GREEN** at S — 6/6 tests passed — confirming
wave-26 lane c's fix (`POST /api/v1/users` now reads `firstName`/
`lastName`) landed and holds.

`npm run bundle:check` PASS: entry 69.19 kB gzip vs 300 kB budget (SPEC
§7). `rm -rf .wrangler && npm run db:migrate` PASS: all 40 migrations
0000-0039 applied clean, including `0039_user_name.sql`. `npm run seed`
PASS: D1 rows + 35 R2 objects seeded with no errors.

OPEN ITEMS: 2 — (1) in-process test SQLite fixture bootstrap missing
`user.name` column despite schema.ts/migrations already having it,
breaking 9+ test files; (2) `POST /api/v1/users` 500s via `db.select is
not a function` in `getAnchorEventForOrg` on the mutating path.
RESULT: FAIL — full-suite vitest run has 37 failing tests across 11 files
at S; build, bundle:check, db:migrate, and seed all PASS; the wave-16 red
spa-mutation-contract scan is confirmed GREEN.

## 2026-08-15 task-w27-e — spec-audit §6/§7/§8/§9 @ ceda66f2 [DIAGNOSTIC]

DEC-069 static-audit lane, widened per DEC-063's wave-27 amendment. §8/§9
retired to five citations (no re-check): `npm run deploy` (package.json:21),
four-persona local bring-up (README.md:48-54), "For evaluators"
(README.md:181), seed-as-grader-package (same block), MIT license
(LICENSE:1). Full detail: docs/verification-log/task-w27-e-spec-audit-ceda66f2.md

§7-1 (D1 indexes on every FK + (event_id,status) + (event_id,slug)): all 65
FK columns across `src/db/schema/*.ts` cross-checked against `index()`/
`uniqueIndex()` in the same files — zero uncovered FK columns.
`submission_event_id_status_idx` (submissions.ts:40) covers
(event_id,status); `event_slug_idx` (event.ts:28) covers slug (event IS the
event row, no separate (event_id,slug) child table exists).

§7-2 (SPA code-split by route): `app/src/App.tsx:15-50` — every one of the
15 page components is wrapped via `lazy(pageLoaders.X)`; `ELEMENT_BY_PATTERN`
(App.tsx:75) is typed `Record<(typeof ADMIN_ROUTE_PATTERNS)[number],
ReactNode>` so a route with no lazy element is a compile error. No static
page import found.

§7-3 (initial bundle < 300 KB gz): budget constant
`scripts/bundle-check-lib.ts:5` (`BUDGET_BYTES = 300 * 1024`). No wave-27
lane has landed a measured number (task-w27-b's receipt built but did not
run bundle:check). Last confirmed measurement: 69.19 KB gz vs 300 KB budget
at wave-26 `73f380f2` (docs/verification-log.md:3617-3619) — two `app/src`
files (incl. a 1-line functional change to SubmissionDetailPage.tsx) moved
since then; not re-measured against S. Marked pending-at-S.

§6-4 (parameterized queries only): grepped `src/**` for raw string
interpolation into `.prepare()/.run()/.exec()` template literals outside
drizzle's `sql` tag — zero hits. All interpolation sites use `sql\`...\``
with drizzle column refs/bound values (e.g. src/server/repo/form-roles.ts:17
documents "never string-concatenated").

§6-5 (no HTML content-type served / secrets hygiene): `src/domain/
files.ts:539-550` `assertServedContentTypeHeader` throws if content type
starts with `text/html`; called at the sole file-serve route
`src/routes/files.ts:674`, which also sets `X-Content-Type-Options: nosniff`
and `Content-Disposition: attachment` for non-images (files.ts:677,680).
`.gitignore:9` = `.dev.vars`.

§6-6 (eval-rubric coverage): `test/rubric-coverage-enumeration.scan.test.ts`
is a live bidirectional gate (116-id population re-derived from
`docs/eval-rubric/*.yaml` at test time, vs a 116-row hand-transcribed
ledger at rubric-coverage-enumeration.scan.test.ts:102-248). Re-ran at S:
all 15 tests PASS (population count, per-file counts, exactly-one-ledger-row
both directions, all cited artifacts exist on disk, all waived rows name a
DEC id, zero problems overall). 3 waived rows (ABS-14/DEC-272, SPK-01 and
SPK-04/DEC-340) all name a governing DEC.

INVALIDATED BY: src/**, app/src/**, migrations/**, SPEC.md, README.md, docs/eval-rubric/**
OPEN ITEMS: 1
RESULT: PASS — 5 of 6 widened §6/§7 items confirmed (FK-index coverage
complete, code-split confirmed, no raw-SQL interpolation, HTML content-type
guard + secrets hygiene confirmed, rubric-coverage scan green at S); 1 item
(§7-3 bundle size) pending-at-S, no wave-27 measurement landed, last known
value (wave 26) is well inside budget.

## 2026-08-15 task-w27-d — perf-smoke + render-sweep @ ceda66f2 [DIAGNOSTIC]

INVALIDATED BY: src/**, app/src/**/*.css, src/**/*.css.ts, src/views/theme.ts, app/src/routeManifest.ts, scripts/perf-*, scripts/render-sweep*

Detached worktree at tip `ceda66f2` (`main` at worktree creation). LOG-ONLY
lane (DEC-453/DEC-077) — no code changed. Full detail:
docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md.

GAP FLAGGED: `perf:seed` depends on `npm run seed` (demo seed) having
already created the organizer identity `perf:smoke` logs in as; the task
recipe omitted this step and hit `POST /login failed: expected 302, got
401` until `npm run seed` was run first. Recommend this be folded into the
documented perf-smoke recipe.

PART 1 (perf smoke, PERF_URL=http://localhost:8883, `wrangler dev` on
8883, killed after use):
- default profile (event=perf-2k, 2000 submissions, 800 contacts): 26 PASS
  / 4 FAIL — onboarding grid (800x5 tasks) adj 116.1ms vs 50ms budget;
  reviewer queue adj 85.4ms vs 50ms; files library (page 1) adj 474.4ms vs
  50ms (also breaches 150ms raw ceiling); plan results (page 1) adj 69.1ms
  vs 50ms.
- aie profile (event=perf-aie, 2500 submissions, 6000 contacts): 27 PASS /
  2 FAIL (rating PUT, reviewer queue, plan results SKIPPED by design per
  DEC-644/DEC-645, profile-only fixtures) — onboarding grid adj 995.7ms vs
  50ms (also breaches 150ms raw ceiling); files library (page 1) adj
  414.7ms vs 50ms (also breaches 150ms raw ceiling).
- Both runs exited non-zero (script's own gate). Pre-existing at this tip,
  not introduced by this lane.

PART 2 (render sweep, `npm run gate:render-sweep`, self-selected port,
self-cleaned):
- desktop 59/60, public-mobile 26/26, admin-mobile 27/28, font-floor
  114/114, type-role 7/7, contrast 57/60, interaction-state 2/4.
- `/admin/submissions/forms` clip (desktop + admin-mobile,
  `div.chq-forms-header-titles`/`h1`, 3px each): confirmed
  **OWNED-BY-task-w27-a** via `git log --all` showing an unmerged
  `task-w27-a` branch checked out in a sibling worktree whose stated job
  this wave is this exact fix; this tree's tip predates that merge.
- `.chq-cfp-step-next` keyboard-Tab focus probe (task-w25-e's fix,
  flagged at docs/verification-log.md:3519-3525 as never run live): now
  run live at this tip — **still fails**
  (`instrument-blocked: selector unreachable via keyboard Tab within 25
  presses`). The fix does not resolve this end-to-end.
- Other genuinely open FAILs: `.chq-participation-menu-caret` contrast
  1.02 on `/admin/speakers` + `/admin/speakers/seed_contact_0001`;
  `.chq-review-checkbox-label` contrast 3.09 on
  `/admin/review/plans/seed_evaluation_plan_0001`;
  `.chq-review-field-disabled .chq-review-checkbox-label` disabled-state
  probe selector-never-resolved.

OPEN ITEMS: 5
RESULT: perf-smoke FAILED (4 read-budget overruns, default profile; 2
persist/worsen under aie); render-sweep found 5 genuinely open items plus
2 rows already owned by in-flight task-w27-a; task-w25-e's cfp-step-next
keyboard focus-visible fix confirmed NOT resolved live.

## 2026-08-15 task-w27-c — walkthrough @ ceda66f2 [DIAGNOSTIC]

Full detail: docs/verification-log/task-w27-c-walkthrough-ceda66f2.md

INVALIDATED BY: src/**, app/src/**, scripts/walkthrough/**, migrations/**

Port 8881 confirmed own (workerd PID rooted in this worktree's
`node_modules`, `lsof -i :8881` + `ps -p <pid>`). First run hit a harness/
env footgun, not a product defect: freshly generated `.dev.vars` ships
`PUBLIC_BASE_URL=http://localhost:8787` (DEC-296 default) and
`wrangler.jsonc`'s `chautauqua.cc` `routes` entry shadows the local request
origin under `wrangler dev`, so `resolveBaseUrl()` (src/server/origin.ts:104)
fell through to the stale 8787 default and the walkthrough's scraped
`/reset/<token>` link came back off-origin
(scripts/walkthrough/producer.ts:592/601) — identical to task-w26-f's
already-recorded finding (see this file's own w26-f section above, port
8823). Corrected the gitignored `.dev.vars` (not printed, per DEC-187),
wiped `.wrangler`, re-migrated/re-seeded, relaunched. A second attempt
(same DB, no re-seed between two walkthrough invocations) produced FOUR
unrelated FAILs (producer/review/speaker/data) from self-inflicted
double-run state corruption — discarded, not a finding.

Clean single run (fresh migrate+seed, one walkthrough invocation) —
counted result:

  PASS producer  PASS review  FAIL speaker  PASS public  PASS data  PASS scale

speaker FAIL: `scripts/walkthrough/speaker.ts:805` — a completed
`file_request` ad hoc task assignment re-uploaded (chained
`previous_file_id`) never shows "version 2" in the DEC-244 deliverable
panel at `GET /portal/tasks`. Reproduced VERBATIM from task-w26-f's
`73f380f2` finding — this defect is product-stale (survived the wave-26
merge), not harness-stale. Candidate sources (read, not fixed):
src/routes/portal/tasks/views.tsx:296, src/routes/portal/tasks.tsx:171-173
and :627, src/server/repo/files-versions.ts:124
(resolveTaskFileChainLatestMany).

Three curl-level spot checks, all PASS:
(a) two separate unauthenticated CFP submits to `/submit/wk-<ts>` (the
event's default form has one file field, not two, so "two uploads" =
two submissions each with one file) both 200'd with file rows/R2 objects
created; a third submission with a file attached but a missing required
field 400'd and left `file` table count and local-R2 object/blob counts
unchanged (39 before and after) — no orphan.
(b) `pending -> accept_queue -> accepted` via `POST .../submissions/status`
(x-chq-csrf:1) on one id; organizer-jar `GET /dev/mailbox` (DEC-546) held
at 51 messages before and after both transitions — no auto-email.
(c) un-accepting an accepted+content-approved seeded session
(`seed_submission_0007`) made it vanish from `/e/devflow-conf-2027/sessions`
on the very next GET issued after the status API call returned — no
measurable polling delay was needed to observe the change (reported as
"effectively immediate", not a fabricated ms figure).

OPEN ITEMS: 1 (speaker/DEC-244 "version 2", same open item task-w26-f
already carries — not double-counted as new)
RESULT: FAIL — one J1-J12 walkthrough check (speaker/DEC-244 "version 2")
reproduces unfixed at the wave-27 tip; all three curl spot checks
(orphan-free CFP upload failure, no-auto-email status transitions,
immediate un-accept purge) PASS.

## 2026-08-15 task-w27-g — TIER-1 fidelity re-check @ ceda66f2 [DIAGNOSTIC]

INVALIDATED BY: app/src/**, src/routes/**, docs/design/**

Walked all 15 clauses from `docs/eval-findings.md` TIER 1's
VERIFIED-OPEN-NOT-RECHECKED list against current `main` and the vendored
pack (`docs/design/*.dc.html`, `docs/design/README.md`,
`docs/design/DESIGN-RULINGS.md`), one quoted `path:line` from the tree and
one from the vendored side per clause. 10 CLOSED-AT-TIP (tree already
matches, or a binding `decisions/` amendment supersedes the original
clause — participation-panel-420, write-failed-banner, upload-reject-modal,
templates-grid-overlap, plan-editor-draft-footer, duplicated-results-head,
content-status-band-full-bleed, active-filter-ink-chip, add-track-tertiary,
saved-embed-anatomy), 4 UNQUOTABLE (no line in the vendored pack ever
stated the rule — speaker-detail-grid/theads, underlined-initials,
blue-avatars, eight-item-Settings-remainder — the last because its only
source, `fidelity-gate8/09-settings.md`, is a `chautauqua-research` file
not vendored anywhere in this tree, so DEC-976's "a claim without a quoted
line is a rumour" applies), 1 OPEN. Full per-clause citations:
`docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md`.

Also recorded: the duplicated `data-label` phone-table CSS pattern
(`app/src/pages/comms/comms.css:997-1003` vs `:1036-1042`) is two
independent table classes that happen to share a hand-written technique,
not one shared vocabulary class with two callers — no divergence-risk
coupling exists between them (see detail doc for the quoted declarations).

OPEN ITEMS: 1 — "speakers toolbar right-cluster":
`docs/design/README.md:350` states the admin Speakers toolbar's right
cluster is a `[List | Grid]` view toggle;
`app/src/pages/speakers/GridFilters.tsx` renders only a search input and a
task-status select, and no view-mode toggle exists anywhere in
`app/src/pages/speakers/` (grep for "List | Grid"/"viewMode" returns
nothing). Not superseded, not satisfied — carries forward as a genuine
OPEN item, no longer VERIFIED-OPEN-NOT-RECHECKED.

RESULT: 10 CLOSED-AT-TIP, 4 UNQUOTABLE (deleted, not carried), 1 OPEN.
14 of the 15 stale clauses this task's brief listed are resolved off the
tier-1 open list this wave; only "speakers toolbar right-cluster" remains
a live gap for a future wave to own.

## 2026-08-15 task-w28-a — walkthrough @ c6dbdb7c

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Instrument-repair commit: `9bf312cf` (scripts/walkthrough/speaker.ts,
this lane's worktree `task-w28-a`). Product sha measured: `c6dbdb7c`
(this lane's branch point off main; the repair touched no `src/**`,
`app/src/**`, `migrations/**`, or `package.json` file, confirmed via
`git diff --stat c6dbdb7c HEAD -- src app/src migrations package.json`
returning empty, so the product sha is unchanged from the branch point).

Full detail: docs/verification-log/task-w28-a-walkthrough-c6dbdb7c.md

Repaired the DEC-244 deliverable-panel block's false premise (the
task-w26-f/task-w27-c `version 2`-after-single-upload defect — the ad hoc
file_request task is minted+assigned within the same run, so no seed loop
pre-completes it) by having the lane create both file versions itself:
assert the version-1 panel, POST a second (replace) upload, assert the
version-2 panel with a two-row version-history chain. Ran the gate twice
(fresh migrate+seed both times) at `http://localhost:8891`
(`PUBLIC_BASE_URL` corrected to match per the w26-f/w27-c off-origin
lesson).

Per-area summary (both runs identical):

  PASS producer  PASS review  PASS speaker  PASS public  PASS data  PASS scale

Both runs: 131 `ok` lines, zero `FAIL` lines, `walkthrough OK`. The three
repaired speaker checks (version-1 panel, replace-upload 302, version-2
panel with both v1/v2 rows and Current on v2 only) passed in both runs.

RESULT: PASS — the previously-recorded DEC-244 "version 2" defect
(task-w26-f/task-w27-c) was a false instrument assertion, not a product
defect; repaired instrument passes clean on two independent runs at
product sha c6dbdb7c.
OPEN ITEMS: 0

## 2026-08-15 task-w28-c — perf-smoke @ c6dbdb7c

QUALIFYING
INVALIDATED BY: src/** app/src/** migrations/** package.json

Built (`npx vite build --config app/vite.config.ts`), migrated (39/39
`✅`), and perf-seeded (2,000-submission profile) this worktree's local D1.
Gap flagged (not in scope to fix): the delegated step list omitted `npm run
seed` (demo seed) before `perf:seed`; `perf-smoke.ts login()` reads
organizer credentials from `docs/fixtures/sample-data.json`, populated only
by the demo seed, so the first `perf:smoke` run 401'd at login
(`POST /login failed: expected 302, got 401`). Ran `npm run seed` then
re-ran `npm run perf:seed` (idempotent, `seed_perf_`-prefixed rows only)
per this log's own w16-c precedent, then reran `wrangler dev --port 8893`
+ `perf:smoke` clean. Full p95 table (30 measured iterations, all 27
checks ran, no SKIPPED rows) is in
`docs/verification-log/task-w28-c-perf-smoke-c6dbdb7c.md`.

OPEN ITEMS: 4 — `onboarding grid (800 speakers x 5 tasks)` adjusted p95
112.4ms > budget(read) 50ms; `reviewer queue` adjusted p95 66.8ms >
budget(read) 50ms; `files library (page 1)` raw p95 484.4ms (exceeds the
150ms raw ceiling) / adjusted p95 481.5ms > budget(read) 50ms; `plan
results (page 1)` adjusted p95 71.8ms > budget(read) 50ms. Not fixed (out
of scope for this lane).
RESULT: FAIL — perf-smoke exit code 1; 23/27 checks PASS, 4 FAIL (all read-
class budget overruns) at sha c6dbdb7cc615248d1a49485d63320570168f4c7b.

## 2026-08-15 task-w28-b — build+test+bundle @ c6dbdb7c

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Full detail: docs/verification-log/task-w28-b-build-test-c6dbdb7c.md

`git rev-parse HEAD` recorded first: `c6dbdb7cc615248d1a49485d63320570168f4c7b`
(main tip, "scribe wave 28"). `npm run build` (tsc --noEmit root + app,
then vite build): exit 0, 0 tsc errors, vite `✓ built in 1.14s` (276
modules). `sh scripts/with-test-lock.sh npx vitest run`: exit 0, no lock
contention, single run — `Test Files 1061 passed (1061)`, `Tests 11745
passed (11745)`, Duration 228.32s. `npm run bundle:check`: exit 0, entry
bundle `index-BhPrbvpM.js + index-DpG2gFFa.css` = 69.19 kB gzip vs SPEC
§7's 300 kB budget.

OPEN ITEMS: 0
RESULT: PASS — build, full 1061-file/11745-test suite, and bundle gate
all green at c6dbdb7c; no fixes applied (measurement-only lane).

## 2026-08-15 task-w28-e — spec-audit @ c6dbdb7c

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

§8/§9 nine-times-green per DEC-063: cited from
`docs/verification-log/task-w27-e-spec-audit-ceda66f2.md` and
`task-w27-e-spec-audit.md`; only the two rot-prone facts re-checked this
lane — quickstart (`README.md:45-48`) still matches package.json's
`db:migrate`/`seed`/`dev` script names verbatim, and the "For evaluators"
persona table (`README.md:213-219`) still matches
`docs/fixtures/sample-data.json`'s seeded emails/passwords verbatim (both
quoted in full in the companion doc). §6 Security (SPEC.md:306-321) graded
clause by clause, 9 clauses, all confirmed with a quoted file:line except
two sub-details recorded NOT RE-CHECKED (constant-time-compare/session-
rotation detail past the PBKDF2 iteration constant; speaker→/admin
403/redirect). §7 Performance (SPEC.md:322-358): server + perceived
runtime budgets and CI perf smoke NOT RE-CHECKED (LOG-ONLY, no running
instance). The two never-checked structural claims resolved: (a) FK-index
coverage — zero schema/migration delta since `ceda66f2`'s exhaustive
65-row FK table, so its "zero gaps" finding carries forward unchanged
(confirmed via empty `git diff --stat ceda66f2..c6dbdb7c -- src/db/schema
migrations`); (b) code-splitting comes from `app/src/App.tsx`'s
`lazy(pageLoaders.X)`, not `app/vite.config.ts` (which sets no
`manualChunks`); bundle budget re-measured fresh at S (`npm run build &&
npm run bundle:check`, read-only, not committed): `Entry bundle:
index-BhPrbvpM.js + index-DpG2gFFa.css = 69.19 kB gzip (budget 300.00 kB)
bundle:check PASSED` — closes the "pending-at-S" open item left by
`task-w27-e-spec-audit-ceda66f2.md`. Full clause-by-clause table:
`docs/verification-log/task-w28-e-spec-audit-c6dbdb7c.md`.

RESULT: PASS — all quotable §6/§7 clauses confirmed with file:line
evidence or a covering earlier receipt; no clause graded PASS without
either a fresh quote or an explicit unchanged-tree carry-forward; runtime-
only clauses (latency/perf budgets, CI perf smoke) and two security sub-
details recorded NOT RE-CHECKED rather than assumed.
OPEN ITEMS: 4 (constant-time-compare/session-rotation detail; speaker→
/admin redirect detail; §7 server+perceived runtime budgets, unmeasurable
without a running instance; §7 CI perf smoke, requires seed+dev server)

## 2026-08-15 task-w28-g — stage-1 exit ledger @ 3564c774

QUALIFYING
INVALIDATED BY: src/** app/src/** migrations/** package.json

Frozen literal `3564c7747e211f0e5857091e5909536c56e31b4a` (main WILL move
under this ledger while it works; every grade below is against this literal,
never against main's later state). Newest PRODUCT-code-bearing sha
(src/**, app/src/**, migrations/**, package.json; scripts/**, test/**,
docs/**, decisions/**, field-guide/** allow-listed non-code-bearing per
DEC-069's wave-28 amendment) walking `--first-parent` from the literal:
`0d0e24e88752d9de94653b7cd88a207bc74d9eca` ("merge task-w27-a" — the DEC-991
line-height:1 deletions in comms.css/forms.css/auth.css.ts).

Five DEC-069 required sections graded against that product sha: the only
candidates in the log (`task-w27-b/c/d/e`) are all timestamped `@ ceda66f2`
(parent of the product sha, i.e. BEFORE it) and are explicitly labelled
`[DIAGNOSTIC]` by the wave-26/27 amendments, not `[QUALIFYING]` — none
qualify. Wave 28's own gate lanes have not yet landed on the frozen literal:
`task-w28-a` (walkthrough, `0778816b`), `task-w28-b` (build+test, `bb702a52`),
`task-w28-c` (perf-smoke, `a8dacd1b`), `task-w28-e` (spec-audit, `3d6ef260`)
all carry commits beyond base — PENDING-OWNED(task-w28-a/b/c/e) respectively.
`task-w28-f` (triage-closure) resolves to `3564c774`, IDENTICAL to base —
PRODUCED NOTHING per DEC-069's wave-17 amendment — FAIL-unowned.

DEC-991 independently re-confirmed on this literal: zero `line-height: 1`
declarations remain alongside any display-face heading in
`app/src/pages/forms/forms.css`, `app/src/pages/comms/comms.css`,
`src/routes/auth.css.ts` (the sole surviving `line-height: 1`, comms.css:766,
is a DEC-993 caret glyph, not a heading). `test/display-heading-line-height
.scan.test.ts` run live: 5/5 PASS — a scan now guards regrowth.

Full detail, including verbatim quotes of all five section headers/RESULT/
OPEN ITEMS lines and the blocker list: docs/verification-log/task-w28-g-stage1-exit-ledger-3564c774.md.

STAGE 1 IS NOT COMPLETE. Zero of five required rows PASS; four are
PENDING-OWNED (task-w28-a, task-w28-b, task-w28-c, task-w28-e — live
branches, work not yet on this literal); one (triage closure) is
FAIL-unowned (task-w28-f produced nothing). The substantive defects the
wave-27 diagnostic battery found (37 failing tests, DEC-244 "version 2"
walkthrough FAIL, perf-smoke budget overruns, unmeasured §7-3 bundle size)
remain unconfirmed-fixed at this literal — owner: unassigned pending a
future code wave.

RESULT: FAIL — 0/5 required DEC-069 sections are PASS at the product sha; 4 PENDING-OWNED, 1 FAIL-unowned; stage 1 not complete.
OPEN ITEMS: 6

## 2026-08-15 task-w28-f — triage-closure @ 3564c774

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Full detail: `docs/verification-log/task-w28-f-triage-closure-3564c774.md`.

Reconciled every `OPEN ITEMS:` line in this file from `## 2026-08-15
task-w9-d` (line 3416) to EOF (9 sections: task-w9-d, task-w25-e, task-w25-a,
task-w26-f, task-w27-b, task-w27-e, task-w27-d, task-w27-c, task-w27-g)
against the current tip, per DEC-069's wave-17 amendment (ref truth from
`.git`, DIAGNOSTIC sections voided by newer product-tree commits get
re-checked directly against the tip rather than trusted from their own
prose) and DEC-453's wave-28 amendment (a live sibling branch's fix is
PENDING-OWNED, never absent, never inferred PASS).

`git log ceda66f2..HEAD -- src/ app/src/ migrations/ package.json` = 3
commits (`900f8326` line-height-1 display-face fix DEC-991, `d8974cf6`
merge-repair wave 26, `0d0e24e8` merge of `900f8326`). Cross-checking every
item's underlying file against this 3-commit diff (or, where unchanged,
against `git log ceda66f2..HEAD` for that file being empty) confirms: 20
items CLOSED (8 distinct w9-d grades, 4 of them duplicated by task-w25-a's
own un-numbered list; task-w27-b's 2; task-w27-e's 1; task-w25-e's type-role
item folded via w25-e's own fix), 1 item PENDING-OWNED(task-w28-a) — the
DEC-244 "version 2" walkthrough failure, repaired and verified PASS on that
live, unmerged branch (`9bf312cf`/`0778816b`) — and 7 items OPEN-unowned:
two `.chq-participation-menu-caret` contrast FAILs (1.02, `/admin/speakers`
and `/admin/speakers/seed_contact_0001`), one `.chq-review-checkbox-label`
contrast FAIL (3.09, `/admin/review/plans/seed_evaluation_plan_0001`), one
`.chq-cfp-step-next` focus-visible keyboard-Tab-unreachable FAIL (confirmed
still failing live at task-w27-d after task-w25-e's probe fix), one
`.chq-review-field-disabled .chq-review-checkbox-label` disabled-state
selector-never-resolved FAIL, the admin Speakers toolbar's missing
`[List | Grid]` view-mode toggle (task-w27-g), and the mobile render-sweep
pass's total absence of console-error collection (task-w25-e's flagged
gap, still unaddressed).

One disagreement flagged per this task's brief: the brief's "verified
starting points" framed `--chq-disabled: #7d7869` (`src/views/theme.ts:38`,
`app/src/styles.css:30`) as "the contrast offender" fix, but that token is
unrelated to this population's three surviving contrast items (they use
`--chq-ink-2`/`--chq-muted`, not `--chq-disabled`) — it closes a different,
earlier B8-disabled-register contrast concern per its own comment. Also
noted but excluded from the `n` count below (not enumerated under any
`OPEN ITEMS:` line in this population): task-w27-d's perf-smoke read-budget
overruns, re-confirmed still failing by `task-w28-c`'s log-only receipt
(no fix landed, so open in substance though outside this task's mechanical
population).

RESULT: PASS — every item in the defined population was reconciled against
the current tip with a quoted file:line or named exercised check; 20 CLOSED,
1 PENDING-OWNED(task-w28-a), 7 OPEN-unowned.
OPEN ITEMS: 7

## 2026-08-15 task-w28-d — render-sweep @ c6dbdb7c

QUALIFYING (advisory to the DEC-069 predicate — the predicate's four required gates are build+test, walkthrough, perf-smoke, spec-audit; this section informs triage and does not itself satisfy a required row)

INVALIDATED BY: src/** app/src/** migrations/** package.json

Live `npm run gate:render-sweep` at HEAD `c6dbdb7cc615248d1a49485d63320570168f4c7b`
(short `c6dbdb7c`, log-only wave, nothing under `src/`, `app/src/`,
`scripts/`, `test/`, `migrations/`, `package.json` touched). Full sequence
(`ensure-dev-vars` -> `vite build` -> `db:migrate` -> `seed` ->
`gate:render-sweep`, own wrangler dev on OS-assigned port 49397) ran clean
through to the gate itself. Score lines: desktop `60/60`, public-mobile
`26/26`, admin-mobile `28/28` (advisory), font-floor `114/114` (advisory),
type-role `7/7` (advisory), contrast `57/60` (advisory but
`CONTRAST_BLOCKING = true` so it flips exit code), interaction-state `2/4`
(advisory, non-blocking). **Exit code 1** — the sole cause is 3 contrast FAIL
rows (`CONTRAST_BLOCKING = true`); desktop and both mobile passes were 100%
clean.

Six repairs, confirmed against this run (full quoted rows in the companion
per-row file):
- (i) `/admin/submissions/forms` clip row: **GONE** — clean `PASS`, no clip
  annotation, zero hits for `chq-forms-header-titles` anywhere in the log.
  DEC-991's wave-27 amendment holds.
- (ii) `/portal/tasks` public-mobile overflow: **GONE** — `overflowPx=0,
  minControlPx=44, PASS`.
- (iii) `/admin/submissions` mobile search tap-target: **PASS** —
  `minControlPx=44`, at the floor not under it.
- (iv) `cfp-primary-focus` real-Tab probe: **still FAIL**, but now for a
  genuine reason — `.chq-cfp-step-next` is unreachable via 25 sequential Tab
  presses. The rewritten probe (real `page.keyboard.press("Tab")` walk)
  itself works and reports truthfully; this is the first live-server reading
  since task-w25-e recorded it UNVERIFIED END-TO-END. OPEN ITEM, not an
  instrument defect.
- (v) `review-anonymize-disabled`: **mixed** — PASS on the `organizer` visit
  to `/admin/review/plans/seed_evaluation_plan_0001`, FAIL ("selector never
  resolved") on the `reviewer` visit to the identical path, because the
  reviewer's plan-detail layout does not render the disabled anonymize
  checkbox at all. The `waitFor({state:"attached"})` fix works correctly;
  the two-row split is a real per-role DOM fact, not an instrument bug.
- (vi) contrast on `/admin/review/plans/seed_evaluation_plan_0001`
  (`label.chq-review-checkbox-label`): **still FAIL** — ratio rose from the
  prior 2.43 reading to 3.09 (confirms `--chq-disabled` is now `#7D7869`,
  `rgb(125,120,105)`, against bg `#DDD8C8`) but 3.09 < 4.5 (WCAG AA normal
  text floor). Genuinely open, not resolved.

`KNOWN_CLIP_EXCEPTIONS` (scripts/render-sweep.ts:219-225) holds exactly ONE
entry — `"/admin/agenda::div.chq-session-card-title":
"intentional 3-line -webkit-line-clamp truncation"` — matching DEC-991's
one-entry rule. No additional entries, no open items from that map.

Full per-row tables, quoted log lines, and source citations:
`docs/verification-log/task-w28-d-render-sweep-c6dbdb7c.md`.

RESULT: FAIL — exit code 1, driven entirely by 3 pre-existing contrast rows (CONTRAST_BLOCKING=true); all three of (i)/(ii)/(iii) repairs confirmed landed, (iv)/(v)/(vi) remain genuinely open (not instrument defects).
OPEN ITEMS: 3

## 2026-08-15 task-w29-b — files library perf fix @ c50e56f3

INVALIDATED BY: src/server/repo/files-library.ts, src/db/schema/**, migrations/**

Fixed the `files library (page 1)` TIER-0 perf defect
(`docs/verification-log.md:3750-3759`, adjusted p95 474.4ms/414.7ms,
worst read in the harness, both over the 150ms raw ceiling). Instrumented
the four diagnosed passes FIRST (DEC-773 wave-29 amendment) and found the
task's stated cause (`loadDeliverableChains` materializing every matching
submission's file rows) measured only 6-10ms — cheap. The actual dominant
cost (~92% of the read, ~460ms) was `computeKindCounts`'s headshot
`count(distinct file.id)`, driven by the old
`contact.headshot_url = '/headshots/' || file.id` join predicate — a
computed string concatenation no index can serve. Since the timings showed
the headshot branch dominant, applied BOTH sanctioned fixes: (1) replaced
`totalSizeBytes`'s chain materialization with one SQL aggregate over a new
chain-TIP predicate (`buildDeliverableTipWhere`, `not exists` test),
closing the DEC-344 bounded-cost gap the module's own comment admitted,
independent of which branch was measured dominant; (2) added
`contact.headshot_file_id` (indexed FK, migration 0040, backfilled from
the existing url pattern), replacing `HEADSHOT_JOIN` with a plain
indexable `eq()` at all three call sites, kept in sync everywhere
`headshot_url` is written (`setContactHeadshot`, contact merge, the demo
seed).

`files library (page 1)`: raw 466.1ms/adj 463.9ms (FAIL, before, this
task's own baseline re-measurement) -> raw 17.7ms/adj 13.0ms (PASS, after)
at perf-2k scale (`wrangler dev --port 8892`, DEFAULT profile only,
server killed after use). Full four-pass instrumentation numbers,
before/after perf:smoke output, and the FK-write-site audit:
`docs/verification-log/task-w29-b-files-library-perf-c50e56f3.md`.

TESTS: `npx vitest related src/server/repo/files-library.ts` plus every
existing `test/*files-library*`/`test/*file-version*`/`test/*archive*` —
227 test files / 1613 tests green; `npm run build` (strict tsc, both
tsconfigs) green. Adding the schema column rippled into 23 test files that
hand-roll the `contact` table's raw DDL and 4 fake-DB test files that
evaluate `files-library.ts`'s drizzle query shapes structurally — all
updated in the same commit (never the full suite, per this task's TARGETED
ONLY instruction).

GAP FLAGGED: `contacts/merge.ts`'s merge write sets `contact.headshot_url`
directly (never through `setContactHeadshot`) — outside this task's
"wherever setContactHeadshot writes" literal scope, but left un-mirrored it
would silently desync `headshot_file_id` from `headshot_url` on every
contact merge (the merged contact's headshot would stop resolving in the
files library). Fixed narrowly (re-derive `headshotFileId` from whichever
`headshotUrl` `planMerge` kept, same `/headshots/<fileId>` parse the
migration's backfill uses) since leaving it broken would have been a new
regression introduced by this task's own FK, not a pre-existing gap.

RESULT: PASS — `files library (page 1)` p95 474.4ms -> 13.0ms adjusted, under both the 150ms raw ceiling and the 50ms read-class budget.
