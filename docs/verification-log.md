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

DEC-069 build+test gate, wave-4 (DEC-077/090/093: log-only lane, no
product code, scripts, or tests changed). Sha independently re-derived
per DEC-091 by walking `git log` from this worktree's `main` tip
`79c4bb3` backward, skipping doc/decision/scribe-only commits (verified
`281a31b` and `f9a33fd` touch `src/decisions.ts` only via two-line
string-constant appends, per DEC-090's exclusion) — lands on `3878d4f`
("merge task-w2-d"), matching the task brief's expected result and
task-w3-b's independent wave-3 derivation.

A build+test section at this same sha already exists above
(`task-w3-b`, a late wave-3 straggler per the task brief). Rather than
duplicate it, this task independently re-ran the full gate in a fresh
worktree and verified its claims:

- `npm ci` clean.
- `npm run build`: 0 type errors; Vite 125 modules / 17 chunks; entry
  `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB — identical to
  task-w3-b's figures.
- `npm run bundle:check` (DEC-058 budget 300.00 kB gzip): entry bundle
  = **58.60 kB gzip** — PASSED, identical to task-w3-b's figure,
  241.40 kB under budget.
- `npm test --silent`: **94 test files, 971 tests, all passed**, 0
  failed, 0 skipped — identical counts to task-w3-b's and task-w3-a's
  runs.

Confirmed: task-w3-b's claims hold on independent re-run. Full detail:
`docs/verification-log/task-w4-a-build-test.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-d — spec-audit @ 3878d4f

Wave-4 gate (DEC-093: wave-3 gate tasks never executed, so all four
gates run in parallel at code-bearing sha `3878d4f`), log-only lane per
DEC-069/077/090, fresh worktree of `main` branched from `60bbedb` ("merge
task-w3-f"). `git diff 3878d4f..HEAD --stat` at the branch point shows
only DEC-090..093 decision docs, `docs/eval-findings.md` pruning,
`docs/verification-log.md` appends, `field-guide/index.md`, and a
4-line constant-only `src/decisions.ts` addition — no product/test/
script/config changes, confirming `3878d4f` as the code-bearing sha.

SPEC §8/§9 checklist re-run (mirrors w13-e/w15-e/w16-d/w3-e): README
quickstart matches `package.json` scripts and SPEC.md verbatim; README
evaluator credentials table matches `docs/fixtures/sample-data.json`
`identities` block byte-for-byte; CI (`.github/workflows/ci.yml`) covers
build+bundle:check+test plus separate perf-smoke and walkthrough
(DEC-063) jobs — the walkthrough runner derives its area list from
`WALKTHROUGH_AREAS`, so CI automatically includes the `scale` area with
no extra wiring; SPEC §9's four invariants (close-date lock, speaker
isolation, hidden-speaker exclusion, decision-never-auto-emails) each
still map to a passing regression test at unchanged locations
(`test/edit-lock.test.ts`+`test/submit-core.test.ts`,
`test/task-file-access.test.ts:117`, `test/headshot-gate.test.ts:80`,
`test/spec9-invariants.test.ts:58`). All PASS.

DEC-086 scale-path closure audit, all six paths re-confirmed in-tree:
DEC-078 `src/lib/chunk.ts:5` `ID_CHUNK_SIZE=90`, used in
`src/server/repo/submissions/status.ts:15`, `src/server/repo/public.ts:13`,
`src/server/repo/comms.ts:11`. DEC-079 plan-before-commit at
`src/server/repo/submissions/status.ts:104-142`
(`updateSubmissionStatuses`), `void DEC_079;` at line 18. DEC-080
chunked hydration at `src/server/repo/public.ts:157/178/210/286`,
`MAX_ITINERARY_IDS = 300` at `src/lib/itinerary.ts:11`, chunked
`src/server/repo/comms.ts:137/155/232`. DEC-081 set-based
`resolveAssignments` at `src/domain/evaluation.ts:289`, used from
`src/server/repo/review.ts:351` and `src/routes/review.ts:281/352`
(no per-reviewer full scans). DEC-082/087 multi-round:
`migrations/0009_review_rounds.sql`, three-arg
`listEvaluationsForPlan(db, planId, round)` at
`src/server/repo/review.ts:528`, 409 `advance-round` at
`src/routes/review.ts:226`. DEC-083 versioned purge:
`PUBVER_KEY = "chq:pubver"` at `src/server/pubcache.ts:20`. DEC-084
`MAX_HEADSHOT_EDGE_PX = 2048` at `src/lib/image-dims.ts:10`.

`npm run build`: PASS (dual `tsc --noEmit` + `vite build` clean).
`npm test --silent`: PASS — 94 test files / 971 tests, 0 failures,
identical counts to task-w3-e's barrier run, confirming zero code drift
between `3878d4f` and this worktree's HEAD.

Full detail: `docs/verification-log/task-w4-d-spec-audit.md`.

No genuine gap found. Log-only lane per DEC-077/090/093 — no product
code or test changed.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-b — walkthrough @ 3878d4f

Fresh worktree of `main` (`79c4bb3`); derived code-bearing sha `3878d4f`
per DEC-091/093 (all commits since are scribe/bookkeeping/log-only-lane;
`git diff --stat 3878d4f..HEAD` excluding verification-log/eval-findings
touches only new DEC-090..093 docs, `field-guide/index.md`, and
`src/decisions.ts`'s new constant references — no functional change).
`npm ci`, `npm run build`, `npm run db:migrate`, `npm run seed`, then
`wrangler dev --port 8801` (never 8787/8803), then `npm run walkthrough --
--url http://localhost:8801`. Ran all SIX `WALKTHROUGH_AREAS` in order:
producer, review, speaker, public, data, scale.

producer/review/speaker/public/data: PASS, 0 FAIL/PLANNER lines (5 + 16 +
50 + 29 + 20 checks, all `ok`).

scale: steps 1-5 PASS, confirming the DEC-086/089 probes — step2 one bulk
POST with 110 ids reports `updated=110` (DEC-078/079 chunking); step3
onboarding `task_assignments` (5 cells) exist for sampled fresh contacts;
step4 an identical re-POST leaves assignment counts unchanged (exactly-
once); step5 dev-mailbox message count unchanged by the accept (no auto-
email). step6 (portal-edit purge-refresh probe, DEC-092/083) **FAILS**:
the edit POST returns 400 `"Select at least one track."` because
`scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` never copies a
`trackIds` value into the portal-edit FormData (unlike the earlier
public-submit FormData in the same function, which does). This is a
**script bug in the walkthrough harness itself**, not a product-code or
DEC-092-design gap — `src/routes/portal/edit.tsx`'s required-track
validation is behaving per DEC-041. Full root-cause detail, including the
captured 400 response body, in
`docs/verification-log/task-w4-b-walkthrough.md`.

Log-only lane (DEC-077/090/093): no fix applied; `git status` in the
worktree is clean except the two doc appends (a temporary debug widening
of `assertStatus`'s body-truncation length in `scale.ts`, used to capture
the failing response body, was reverted with `git checkout --` before this
commit). Flagged for task-w4-e (triage-closure, sole `eval-findings.md`
owner) as a script-only fix.

RESULT: FAIL

## 2026-08-10 task-w4-c — perf-smoke @ 3878d4f

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

**`perf:smoke` FAILS before any timed check runs**, reproduced twice:
`fetchAcceptedSubmissionIds: expected at least 301 accepted submissions,
got 200` (`scripts/perf-smoke.ts:166`). Root cause (read-only analysis,
no fixes made per DEC-077 scope): the DEC-089/DEC-080 one-shot 301-id cap
probe (`scripts/perf-smoke.ts:181`) requires 301 accepted-submission ids,
but the DEC-088 perf-seed status mix (`scripts/perf-seed-lib.ts:20`,
`PERF_STATUS_COUNTS.accepted = 300`) produces exactly 300 for
`seed_perf_event` — one short, regardless of pagination. Independently,
`src/lib/pagination.ts`'s `MAX_PER_PAGE = 200` clamp plus
`fetchAcceptedSubmissionIds`'s single non-paginated request explains the
observed "got 200". No p95 data was collected for any of the checks named
in the task (submissions list, submission detail, event overview, public
sessions page, public agenda, `schedule.ics` 150-id, plan progress w/ 12
reviewers, rating PUT, or the 301-id cap assertion itself) — the script
aborts before the timed loop.

`npm test`: 94 files / 971 tests, all PASS, unchanged from prior gates.
This lane touched only `docs/verification-log.md` and
`docs/verification-log/task-w4-c-perf-smoke.md`.

OPEN ITEMS: 1 — `scripts/perf-smoke.ts`'s 301-id cap probe cannot succeed
against the current DEC-088 perf-seed fixture (300 accepted, needs 301);
needs a code-bearing wave to reconcile the seed status mix, the probe's
id source, or add pagination to `fetchAcceptedSubmissionIds` (not this
lane's call to make).

RESULT: FAIL

## 2026-08-10 task-w4-e — triage-closure @ 3878d4f

Bookkeeping/log-only lane (DEC-090/091/093): touched only
`docs/eval-findings.md`, `docs/verification-log.md`, and
`docs/verification-log/task-w4-e-triage-closure.md` — no product code.
Worktree branched off `main` at `521e903` ("merge task-w4-c"); derived
code-bearing sha per DEC-091/093 is `3878d4f` ("merge task-w2-d"), same
as every sibling wave-4 gate — confirmed only `src/decisions.ts`
(constant-string appends) and doc/decision files differ between
`3878d4f` and HEAD.

**(1) docs/eval-findings.md round-1 disposition** — all five numbered
issues closed with file:line evidence: issue 2 -> DEC-079
plan-before-commit (`src/server/repo/submissions/status.ts:154` runs
`runAcceptancePlanning` before the `:159` acceptedAt write), corroborated
by task-w4-b's walkthrough scale steps 2-4 PASS; issue 3 -> DEC-080
chunking (`src/server/repo/public.ts` four `chunkIds` call sites,
`src/lib/itinerary.ts:11` `MAX_ITINERARY_IDS = 300`, chunked
`loadIcsScheduleData` in `src/server/repo/comms.ts:232`); issue 4 ->
DEC-081 `resolveAssignments` (`src/domain/evaluation.ts:289`, used in
`src/routes/review.ts:281,352`) replacing per-reviewer scans; issue 5 ->
DEC-082/087 multi-round (`migrations/0009_review_rounds.sql`, 3-arg
`listEvaluationsForPlan` in `src/server/repo/review.ts:528`, 409
advance-round). Narrowing-decisions section: DEC-022 superseded by
DEC-083 (`src/server/pubcache.ts` real purge), DEC-059 superseded by
DEC-084 (`src/lib/image-dims.ts` 2048px gate), DEC-054/DEC-061 upheld as
sanctioned deferrals per DEC-085, minor notes (submittedAt/accentColor)
closed per DEC-085. `docs/eval-findings.md` replaced with a short pointer
header — zero open findings remain in that file. Full evidence:
`docs/verification-log/task-w4-e-triage-closure.md`.

**(2) PLANNER: harvest, `2103c69..HEAD`** — zero `PLANNER:` matches in
merge-commit bodies. The one open in-source concern,
`scripts/walkthrough/scale.ts:16`'s GAP NOTE (no organizer PATCH-title
endpoint exists), is resolved by DEC-092 and recorded here as **closed**.

**(3) Sweep for unresolved FAIL/PLANNER: lines** across
`docs/verification-log.md` and the `docs/verification-log/task-w4-*.md`
files present at this task's start. No `PLANNER:` lines found anywhere.
Two genuine, unresolved `RESULT: FAIL` lines found, neither ratified by
any decision doc (distinct from the DEC-092-closed GAP NOTE above):

1. `docs/verification-log/task-w4-b-walkthrough.md` (scale step 6,
   `RESULT: FAIL`) — `scripts/walkthrough/scale.ts`'s
   `purgeRefreshProbe` never sets `trackIds` on the portal-edit FormData,
   so the server correctly 400s under `src/routes/portal/edit.tsx`'s
   DEC-041 required-track validation. Script bug, not a product defect;
   fixing it is code-bearing and out of scope for this docs-only lane.
2. `docs/verification-log/task-w4-c-perf-smoke.md` (301-id cap probe,
   `RESULT: FAIL`) — `scripts/perf-smoke.ts`'s DEC-089/DEC-080 cap probe
   requires 301 accepted submissions but DEC-088's perf-seed status mix
   (`scripts/perf-seed-lib.ts:20`) produces only 300, independent of the
   `src/lib/pagination.ts` `MAX_PER_PAGE = 200` clamp. Script/seed
   mismatch, not a product defect; fixing it is code-bearing and out of
   scope for this docs-only lane.

`docs/eval-findings.md`'s round-1 scope is genuinely fully dispositioned
(zero open findings there). But per this task's own honesty requirement,
the overall gate-wave exit predicate (five sections PASS + OPEN ITEMS: 0)
is not met at this sha: two un-ratified script-only FAILs remain, found
during the mandatory sweep, neither of which this docs-only lane is
authorized to fix.

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

Fresh worktree from `main` at task-w5-a's merge (`3d1e838`, carrying the
newest code-bearing commit `b638f75` "Fix two gate-failing probe scripts
(DEC-094/095/096)" per DEC-091). Full sequence run: `npm ci`,
`npm run build` (clean), `npm run db:migrate` (all 10 migrations
`0000`..`0009` applied), `npm run seed` (ok), `npx wrangler dev --port
8801`, `/health` healthy on first poll, then
`npm run walkthrough -- --url http://localhost:8801`, areas run in order
producer -> review -> speaker -> public -> data -> scale.

Per-area results: producer 5/5 PASS; review 16/16 PASS; speaker 50/50
PASS; public 29/29 PASS; data 21/21 PASS; scale 6/6 steps PASS. Zero
`FAIL`/`PLANNER:` lines in the run output.

Scale step 6 (purge-refresh probe, the task-w3-c/w4-b failure this
re-run targets) now reads:
`PASS step6 (purge-refresh probe: title change reflected immediately on
/e/<slug>/sessions)` — confirmed passing. task-w5-a's
`scripts/walkthrough/scale.ts` fix (setting `trackIds` on the
portal-edit FormData so `src/routes/portal/edit.tsx`'s DEC-041
required-track validation no longer 400s) is verified live end-to-end,
exercising the DEC-083/DEC-092 pubcache purge-refresh assertion.

Dev server killed after the run; `lsof -iTCP:8801 -sTCP:LISTEN` returned
nothing afterward — port confirmed released. No code-bearing merge
landed on `main` during this task's execution window. Full detail:
`docs/verification-log/task-w5-c-walkthrough.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w5-f — triage-closure @ b638f75

DEC-069 triage-closure gate (DEC-077/090 log-only lane; this commit
touches only `docs/verification-log.md`). Chained per DEC-096 behind
task-w5-c's walkthrough re-run so the scale-area PASS is citable;
newest code-bearing main short-sha per DEC-091, matching task-w5-b/c/e's
citation: `b638f75` ("Fix two gate-failing probe scripts
(DEC-094/095/096)", task-w5-a).

(1) Disposition of the two OPEN ITEMS carried by the w3 FAIL sections:

  - w3-c scale step-6 portal-edit 400 (`## 2026-08-10 task-w3-c —
    walkthrough @ 3878d4f`, OPEN ITEMS line above): **CLOSED**. Fixed by
    commit `b638f75` (DEC-094/095/096) — `scripts/walkthrough/scale.ts`'s
    `purgeRefreshProbe` now sets `trackIds` on the portal-edit FormData.
    Runtime evidence: task-w5-c's `## 2026-08-10 task-w5-c — walkthrough
    @ b638f75` section above reports scale step6 `PASS
    (purge-refresh probe: title change reflected immediately on
    /e/<slug>/sessions)`, all 6/6 scale steps and all six areas PASS,
    zero FAIL/PLANNER: lines.

  - w3-d perf-smoke 301-id abort (`## 2026-08-10 task-w3-d — perf-smoke
    @ 3878d4f`, OPEN ITEMS line above): **CLOSED**. Fixed by the same
    commit `b638f75` — `scripts/perf-smoke.ts`/`perf-smoke-lib.ts` now
    paginate via `planPerfPages` at perPage=200 instead of a single
    perPage=301 request, and the cap probe fetches 300 real accepted ids
    (matching DEC-088's actual seed count) plus one synthetic
    nonexistent id, still asserting exactly 400. Runtime evidence: no
    task-w5-d perf-smoke gate section is present on `main` at this
    branch point (`b638f75`/`3d1e838`) — a dedicated perf-smoke gate
    re-run is **in flight** (not yet merged as of this task's execution
    window); this disposition therefore rests on the fix commit itself
    plus `test/perf-smoke.test.ts`'s new `planPerfPages` unit coverage
    (confirmed passing in this task's own `npm test` run below), not on
    a live end-to-end perf-smoke gate PASS. Flagged for the next
    perf-smoke gate to supply the runtime citation task-w5-c supplied
    for the walkthrough side.

(2) `git log --format='%h %B' 1c75d92..HEAD | grep -n 'PLANNER:'` harvest:
zero hits. No stray `PLANNER:` notes from the wave-4/5 merges. (The
string "PLANNER:" appears only inside prose self-references within
`docs/verification-log/task-w4-e-triage-closure.md` and this file's own
task-w3-d/w4-c/w5-e sections, describing the sweep itself — none are
literal open `PLANNER:` markers.)

(3) `docs/eval-findings.md` re-checked: still contains zero live
findings (18 lines total, all pointing to closures already recorded in
`docs/verification-log/task-w4-e-triage-closure.md`). Re-asserted, not
rewritten.

(4) Swept every `task-w5-*` section present on `main` at this branch
point (`task-w5-b` build+test, `task-w5-c` walkthrough, `task-w5-e`
spec-audit) for `FAIL`/`PLANNER:` lines: none found — all three read
`OPEN ITEMS: 0` / `RESULT: PASS`. (`task-w5-a` is the code-fix commit
itself, not a gate section; `task-w5-d` perf-smoke is not yet present on
`main` at this branch point, see (1) above.)

(5) DEC-092 GAP NOTE closure re-verified: still stands. `docs/
verification-log.md`'s task-w4-b/w4-e sections and `docs/verification-
log/task-w4-e-triage-closure.md` §(1)/(3) record the portal-edit write
path (`scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` POSTing to
`/portal/submissions/:id/edit`) as the DEC-092-sanctioned probe
mechanism; no regression since.

`npm run build`: PASS (tsc x2 + vite, clean). `npm test --silent`: PASS
— 95 files / 980 tests, 0 failures, in this worktree at `771e06c`
(main's tip when this worktree was created, wave-6 commits included;
all wave-5/6 code-bearing fixes remain green together).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w7-a — build+test @ d12eb25

Wave-7 code-frozen build+test gate (DEC-077, DEC-102). Re-derived the
newest code-bearing sha per DEC-091 by walking `main` from tip
`9e7ac53`: `9e7ac53` (scribe wave 7 — DEC-102 doc + a pure
string-constant append to `src/decisions.ts`), `4e2d53e` (merge
task-w5-f, no own diff), `0828e32` (task-w5-f gate section,
docs/verification-log.md only) are all DEC-090-exempt bookkeeping.
Newest code-bearing commit: **d12eb25** ("merge task-w6-d") — matches
the task's stated expectation.

Ran from a worktree at `main`'s tip `9e7ac53` (content-identical to
`d12eb25` for every code/test/config path, since the intervening
commits are verified-exempt):

- `npm ci --prefer-offline --no-audit --no-fund --silent`: node_modules
  already present, skipped clean.
- `npm run build`: PASS — `tsc --noEmit` (root) clean, `tsc --noEmit -p
  app/tsconfig.json` clean, `vite build` succeeded (125 modules, 17
  output files, entry `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB).
- `npm run bundle:check`: PASS — entry bundle + css = 58.60 kB gzip vs
  300.00 kB budget.
- `npm test --silent`: PASS — **96 test files / 984 tests**, 0
  failures, 6.27s.

Post-run re-check: `git log --oneline -5 main` still shows tip
`9e7ac53`; no code-bearing merge landed mid-run. sha `d12eb25` stands.

Full detail: `docs/verification-log/task-w7-a-build-test.md`.

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

Wave-7 code-frozen perf-smoke gate (DEC-077/DEC-089/DEC-094/DEC-102).
Newest code-bearing sha re-derived per DEC-091/DEC-090 (walking `main`
from tip `52b9eaa`: `52b9eaa`/`b17595e`/`9e7ac53`/`4e2d53e`/`0828e32` are
all bookkeeping-only): **d12eb25** ("merge task-w6-d") — matches
task-w7-a's own citation in this wave.

`npm ci`, `npm run build` (PASS, matches task-w7-a's bundle figures
exactly), `npm run db:migrate` (10 migrations), `npm run seed`, `npm run
perf:seed` (verified 300 accepted / 12 reviewers per DEC-088) all
succeeded. `wrangler dev --port 8803` came up healthy. `PERF_URL=
http://localhost:8803 npm run perf:smoke`:

- DEC-089/DEC-080/DEC-094 cap probe (300 real + 1 nonexistent id ->
  `.ics` 400): **PASS** — confirms the DEC-094 pagination fix closes
  the mismatch task-w4-c's perf-smoke gate previously recorded as FAIL.
- Three timed checks completed (`submissions list page 1`, `submissions
  list search`, `submission detail`), but their p95 data was never
  printed (the results table only prints after the full loop).
- The `event overview` timed check then failed with HTTP 500:
  `D1_ERROR: too many SQL variables` inside
  `src/server/repo/overview.ts:170`'s unbounded `inArray(...,
  placedIds)` participant fan-out at DEC-088's ~300-accepted-and-placed
  perf scale. This is a newly-found scale defect, unrelated to
  DEC-094/095, never previously exercised by `npm test` or the
  walkthrough gates. No p95 data exists for any of the remaining
  checks (`public sessions page`, `public agenda`, `schedule.ics 150
  ids`, `plan progress`, `rating PUT`).

`npm test --silent`: 96 files / 984 tests, all PASS (matches task-w7-a
exactly).

Mid-task note: the `chautauqua-wt/task-w7-c` worktree/branch and its
background `wrangler dev` process were externally wiped after the
perf-smoke run above had already completed and its output was
captured; recreated the worktree at `main`'s then-tip `52b9eaa` (still
`d12eb25` for the code-bearing sha, `git log` unchanged) to write up
and commit these docs. No code-bearing merge landed on `main` during
this task's execution window.

Full detail: `docs/verification-log/task-w7-c-perf-smoke.md`.

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

Verify-or-run (DEC-103): found an existing spec-audit section at the
expected sha (task-w7-d, above) ending `RESULT: PASS`. Spot-checked its
mandatory DEC-098..101 citations against the in-tree worktree (checked
out from `main` tip `8c19466`, code-bearing sha still `d12eb25` per
DEC-091 — `git log --oneline` shows only bookkeeping/gate commits after
`d12eb25`): all four hold, with only minor line-number drift from the
cited ranges (no code drift):

- `src/routes/public/submit.tsx`: `ConfirmationState` three-state type
  at line 207, `ConfirmationPage` renders `props.claimUrl` only in the
  `fresh` branch (the trailing `else`) at ~line 225; `pending-existing-
  contact` and `has-account` branches both omit any claim URL.
- `src/server/pubcache.ts`: hit path (line 87) sets
  `Cache-Control: CLIENT_CACHE_CONTROL` (`"public, max-age=60,
  stale-while-revalidate=300"`, line 49) on the restored Response,
  while the stored copy keeps `CLIENT_CACHE_CONTROL_OVERRIDE`
  (`"public, max-age=86400"`, line 44) at line 94.
- `src/server/repo/submissions/seq.ts`: `submissionSeqSubquery` used at
  `repo/submit.ts:168` and `repo/submissions/create.ts:59,102`; grepped
  `src/server/repo/submissions` for `MAX(seq)` — only the subquery's own
  definition (line 10) and unrelated `.seq` sort/format usages in
  `list.ts`/`detail.ts` — no surviving SELECT-then-INSERT helper.
- `src/server/repo/contacts.ts`: `mergeContacts` order is dedupe-delete
  (participant rows shared across submissions, ~lines 500-511) then six
  FK repoints via `buildMergeRepointOps` (participant, task_assignment,
  email_log, user, file.uploaded_by_contact_id,
  file_comment.author_contact_id, ~lines 513-528) then
  `db.delete(schema.contact)` on `mergeId` (~line 535) — matches cited
  order exactly.

No code changes this task (DEC-077 code-frozen gate; commit touches
only `docs/verification-log.md`).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w8-a — walkthrough @ d12eb25

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

Worktree code at `HEAD` (`8c19466`) is byte-identical to `d12eb25` except
for the pure-string append in `src/decisions.ts` (confirmed via `git diff
d12eb25 HEAD -- . ':!docs' ':!decisions' ':!field-guide'`), so ran
directly from this worktree rather than a separate checkout.

`npm ci` (node_modules already present, skipped), `npm run build`: PASS
(tsc --noEmit x2 + vite build, 125 modules, output unchanged from
task-w7-a's build). `npm run db:migrate`: 10 migrations applied clean.
`npm run seed`: PASS (6 R2 objects, fixture rows loaded). `wrangler dev
--port 8811` (DEC-103 alternate port, not 8801/8787) came up healthy at
`/health` on the first poll.

`npm run walkthrough -- --url http://localhost:8811` — all six areas
(DEC-089's "scale" as the sixth):

- PASS producer
- PASS review
- PASS speaker
- PASS public
- PASS data
- PASS scale — 110 fresh contacts/submissions/participants; one bulk
  accept POST of 110 ids (`updated=110`); onboarding task_assignments
  present for a sample of the 110; re-POST of the identical 110-id bulk
  request is exactly-once (assignment counts unchanged); dev mailbox
  message count is unchanged by the bulk accept (no auto-email, house
  invariant); portal-edit purge-refresh probe (DEC-092/093/095): a
  title change via the speaker portal edit form appears immediately on
  `/e/<slug>/sessions` with no 60s staleness.

Note: the 301-id `.ics` cap -> 400 assertion (DEC-089/094) lives in the
`perf:smoke` gate, not this walkthrough gate's `scale` module (confirmed
via `src/lib/itinerary.ts`'s `MAX_ITINERARY_IDS = 300` cap and
`scripts/walkthrough/scale.ts`'s six steps, none of which touch
`.ics`); task-w7-c already exercised that probe at this same sha with
PASS. `npm run walkthrough` itself has no `.ics`-cap check to run.

Full detail: `docs/verification-log/task-w8-a-walkthrough.md`.

RESULT: PASS

## 2026-08-10 task-w8-b — perf-smoke @ d12eb25

Verify-or-run (DEC-103) re-run of the perf-smoke gate. Step 1: newest
code-bearing sha per DEC-091/DEC-090 unchanged since wave 7 —
`8c19466`/`4a1997b`/`075fc16`/`8eff481`/`7af78d9`/`52b9eaa`/`b17595e`/
`9e7ac53`/`4e2d53e`/`0828e32` all touch only `docs/`,
`docs/verification-log/`, `decisions/`, `field-guide/`, and
`src/decisions.ts` string appends — all DEC-090 bookkeeping-exempt.
Confirmed: **d12eb25** ("merge task-w6-d").

Step 2: grepped `docs/verification-log.md` for a perf-smoke section at
`d12eb25` — found task-w7-c's section immediately above, but it ends
`RESULT: FAIL` (event-overview 500 scale defect), not `RESULT: PASS`,
so per DEC-103 this counts as absent and the full gate was re-run
rather than confirmed.

Ran from this worktree at `main`'s `d12eb25` code (no code-bearing
commits since): `npm ci` (already present), `npm run build` PASS
(matches task-w7-a/task-w7-c bundle output), `npm run db:migrate` (10
migrations, all ✅), `npm run seed`, `npm run perf:seed` (300 accepted
/ 12 reviewers per DEC-088). Started `wrangler dev --port 8813`
(DEC-103 alternate port, distinct from 8803/8811, never 8787); `/health`
returned `{"ok":true}` on the first try.

`PERF_URL=http://localhost:8813 npm run perf:smoke`:

- DEC-089/DEC-080/DEC-094 cap probe (300 real + 1 nonexistent id ->
  `.ics` 400): ran and passed (no `DEC-080 cap assertion failed` throw
  before the timed-checks loop was entered).
- Timed checks `submissions list (page 1)`, `submissions list
  (q=...)`, and `submission detail` completed without error.
- `event overview` failed during warmup with HTTP 500. Server log:
  `D1_ERROR: too many SQL variables at offset 396: SQLITE_ERROR`,
  raised from `getOverviewPayload` at
  `src/server/repo/overview.ts:170`'s unbounded `inArray(...,
  placedIds)` participant fan-out at DEC-088's ~300-accepted-and-placed
  perf scale — byte-for-byte the same defect and call site task-w7-c
  reported. `scripts/perf-smoke.ts` aborts (`Error: event overview
  failed during warmup: 500`) before reaching the remaining checks
  (`public sessions page`, `public agenda`, `schedule.ics 150 ids`,
  `plan progress`, `rating PUT`), so no p95 numbers exist for any
  check.

This is a verification-only, code-frozen (DEC-077) task — no fix is in
scope here; the defect at `src/server/repo/overview.ts:170` remains
open for a future code-bearing lane.

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

DEC-069 fifth-section triage-closure gate (log-only lane, DEC-090/093),
chained behind task-w8-a per DEC-093/102 so the walkthrough runtime
evidence is citable. Worktree branched from `main` after task-w8-a/b
merged (tip `a06ff8c`, "merge task-w8-b").

**(1) Re-derive newest code-bearing sha + audit every post-`d12eb25`
commit.** `git log --oneline d12eb25..HEAD` (18 commits: task-w5-f
through task-w8-b's merges) checked individually with `git show --stat`.
Every one of the 18 touches only `docs/verification-log.md`,
`docs/verification-log/*.md`, `decisions/DEC-102.md`,
`decisions/DEC-103.md`, `field-guide/index.md`, or a pure string-literal
append in `src/decisions.ts` — no product/test/script/config path is
touched by any of them, including the task-w7-a build+test merge
(`52b9eaa`) and every task-w7-b/c/d and task-w8-a/b/c merge. All 18 are
DEC-090-exempt. Newest code-bearing sha per DEC-091 is confirmed
unchanged: **`d12eb25`** ("merge task-w6-d"). Condition in (1) for a
predicate reset (a post-`d12eb25` merge touching product code) does
**not** apply — no offending sha to name.

**(2) Sweep for undispositioned `RESULT: FAIL` / `PLANNER:` lines.**
`git log --format='%h %B' d12eb25..HEAD | grep -n 'PLANNER:'`: two hits,
both prose self-references inside task-w7-b's and task-w5-f's commit
bodies describing their own zero-hit sweeps ("zero FAIL/PLANNER: lines",
"PLANNER: harvest over ... yet merged") — not literal open markers.
`docs/verification-log.md`'s `RESULT: FAIL` lines from before this
task's window: the wave-3/4 pair (task-w3-c walkthrough scale-step-6,
task-w3-d/task-w4-c perf-smoke 301-id cap probe) are already
CLOSED-with-evidence by task-w4-e + task-w5-f (fixed by `b638f75`,
DEC-094/095/096; runtime-confirmed by task-w5-c's walkthrough PASS).
Two new `RESULT: FAIL` lines appear in this task's window and are **not**
yet dispositioned by any prior triage section: `task-w7-c — perf-smoke @
d12eb25` and `task-w8-b — perf-smoke @ d12eb25`. Both report the
identical defect (byte-for-byte same stack signature): `GET
/api/v1/events/:id/overview` throws `D1_ERROR: too many SQL variables`
from `src/server/repo/overview.ts:170`'s unbounded `inArray(...,
placedIds)` participant fan-out at DEC-088's ~300-accepted-and-placed
perf scale, first surfaced by task-w7-c and independently reconfirmed
verbatim by task-w8-b's verify-or-run re-run. Disposition: **OPEN** —
this is a genuine, unratified product defect (not a script/seed
mismatch like the wave-3/4 pair), no decision doc sanctions it, and no
code-bearing fix exists on `main` at `d12eb25` or after (every commit
after `d12eb25` is docs-only per (1)). It is out of scope for this
docs-only lane to fix; carried forward as OPEN ITEMS below for a future
code-bearing wave (`src/server/repo/overview.ts:170` needs pagination
or a chunked/`IN`-batched fan-out, mirroring the DEC-080 `chunkIds`
pattern already used elsewhere in `src/server/repo/public.ts`).

**(3) `docs/eval-findings.md` re-check.** Still 19 lines, zero live
findings; both pointer paragraphs correctly attribute closures to
`docs/verification-log/task-w4-e-triage-closure.md`. Note: its second
paragraph's phrasing ("tracked ... as open items for a future
code-bearing wave") describing the wave-3/4 script bugs is now stale —
those two were fixed by `b638f75` and closed by task-w5-f — but the file
itself asserts no *live* finding, so no rewrite is required by this
lane; flagged here for the scribe. No new eval-findings entries exist to
disposition.

**(4) Full DEC-069 predicate state at `d12eb25`** (four gate scopes,
single newest code-bearing sha):

- build+test: **PASS** — `task-w7-a — build+test @ d12eb25` (96 files /
  984 tests, 0 failures).
- walkthrough: **PASS** — `task-w8-a — walkthrough @ d12eb25` (all six
  areas including scale, verify-or-run per DEC-103), corroborated by
  `task-w7-b — walkthrough @ d12eb25` (also all-six PASS). Cited here as
  the runtime evidence for the standing DEC-079/083 closures (bulk
  accept exactly-once/no-email, portal-edit purge-refresh probe) per
  this task's chaining requirement.
- spec-audit: **PASS** — `task-w7-d — spec-audit @ d12eb25` (full run)
  confirmed by `task-w8-c — spec-audit confirm @ d12eb25`
  (verify-or-run spot-check, DEC-098..101 citations hold).
- perf-smoke: **FAIL** — `task-w7-c — perf-smoke @ d12eb25` and
  `task-w8-b — perf-smoke @ d12eb25` both end `RESULT: FAIL` on the
  `overview.ts:170` defect above; cap probe and first three timed checks
  pass, but the gate as a whole is not green and no PASS section exists
  at this sha.

Three of four scopes are green; perf-smoke is the one scope not
satisfied — not "missing" (it has run twice, verify-or-run confirmed) but
genuinely failing on a real defect. The overall DEC-069 exit predicate is
therefore **not met** at `d12eb25`.

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

This run specifically re-verifies the wave-9/10 landings named in the
task brief, reading the tree at `3b7ed3d` directly (not relying on
prior log prose):

**DEC-108 invite gate — `src/server/repo/public.ts`.** The shared gate
`visibleSubmissionConditions()` (lines 32-40) includes
`inArray(schema.participant.inviteStatus, ["none", "accepted"])` at
line 38, alongside `submission.status='accepted'`,
`submission.contentStatus='approved'`, `participant.visible=true`. The
standalone speaker-hydration query in `hydrateSessions` (the function
does not call `visibleSubmissionConditions()` since it hydrates an
already-visibility-checked id list) repeats the same
`inArray(schema.participant.inviteStatus, ["none", "accepted"])` clause
at line 239, inside the `speakerRows` query's `where(and(...))`, next to
`eq(schema.participant.visible, true)`. Both sites match the DEC-108
text and the SPEC §9 public-visibility requirement (only speakers who
never needed to accept, or who accepted, appear on public/embed
surfaces). Confirmed: `src/server/repo/public.ts:38`,
`src/server/repo/public.ts:239`.

**DEC-109 stored-file-answer carry-over — `src/routes/portal/edit.tsx`.**
Lines 61-65: file-kind fields never read submitted body values; the
stored answer (if any) is carried over so validation sees the existing
file rather than a missing one. Lines 201-205: `required` is forced to
`false` only for `f.kind === "file"` fields
(`data.fields.map((f) => (f.kind === "file" ? { ...f, required: false } : f))`)
before running validation in the portal-edit path — the comment at
lines 202-203 states public submit's `validateAnswers` still enforces
required files, and a scan of `src/forms/validate.ts` confirms no
file-kind special-casing exists there (its required check applies
uniformly to all field kinds), so the public submit path's file
requiredness is untouched by this portal-edit-only forcing. Confirmed:
`src/routes/portal/edit.tsx:61-65`, `src/routes/portal/edit.tsx:201-205`;
`src/forms/validate.ts` unmodified by DEC-109.

**DEC-110 rules JSON escaping — `src/views/form-render.tsx`.** Line 145:
`safeJson = json.replace(/</g, "\\u003c")` before line 176 embeds it via
`<script type="application/json" ... dangerouslySetInnerHTML={{ __html: safeJson }} />`;
the companion inline-JS `<script>` at line 177 is static template
content (no interpolated user data), so no separate escaping is needed
there. The CFP-03 conditional-visibility logic (`apply()`/`matches()`,
lines 154-172) reads the escaped rules JSON at runtime and toggles field
wrapper `display` and `required`, matching SPEC's conditional-logic
requirement. Confirmed: `src/views/form-render.tsx:145`,
`src/views/form-render.tsx:176-177`.

**DEC-111 backing forms + self-heal — `src/server/repo/submissions/status.ts`,
`src/domain/acceptance.ts`.** `status.ts` line 16 imports
`FORM_TASK_FIELD_SPECS`/`planAcceptance` from `../../../domain/acceptance`
and line 19 has a `void DEC_111;` compile-checked tripwire comment.
`getOrCreateFormTaskForm` (around line 36) creates the form with
`isDefault: false` and null open/close (line 41 area). The self-heal
path (lines 78-82): when an already-existing 'form' task is found with a
null `formId`, `getOrCreateFormTaskForm` is called and the task row is
updated in place (`db.update(schema.task).set({ formId, updatedAt: now })`).
No `mail`/mailer import anywhere in `status.ts` (only the DEC-009
invariant comments at lines 1, 5, 104, 163 reference it in prose) —
grep for `mail` in both files turns up zero import statements, only
comments; `domain/acceptance.ts` line 3 states in its own header comment
that it performs no I/O and no email, consistent with the pure-core
DEC-002 boundary (`src/domain/*` importing nothing from `node:`/
`cloudflare`). `FORM_TASK_FIELD_SPECS` (line 40 of `acceptance.ts`) is
plain data, no I/O. Confirmed: `src/server/repo/submissions/status.ts:16,
19, 36-41, 78-82`; `src/domain/acceptance.ts:3, 40`; zero mail imports in
either file.

**DEC-099 pubcache hit-path — `src/server/pubcache.ts`.** Line 49:
`CLIENT_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"`;
line 87 re-serves cache hits with this header
(`restored.headers.set("Cache-Control", CLIENT_CACHE_CONTROL)`), while
the stored-copy-only override `CLIENT_CACHE_CONTROL_OVERRIDE =
"public, max-age=86400"` (line 44) is applied only when writing to the
underlying Cache API store (line 94), never returned to a client.
Confirmed: `src/server/pubcache.ts:44, 49, 87, 94`.

**DEC-100 atomic seq subquery — `src/server/repo/submissions/seq.ts`,
both call sites.** `submissionSeqSubquery(eventId)` builds
`(SELECT COALESCE(MAX(seq), 0) + 1 FROM submission WHERE event_id = ?)`
as a single `SQL<number>` fragment (lines 8-14), threaded straight into
the INSERT's `seq` column — no SELECT-then-INSERT race window. Both
production call sites confirmed: `src/server/repo/submit.ts:168` (new
public submission INSERT) and `src/server/repo/submissions/create.ts:59`
(new submission) and `:102` (duplicate/withdrawn re-submit path) — three
call sites total, all via the one shared helper, matching the task
brief's "both call sites" (submit.ts and submissions/create.ts as the
two *modules*).

**DEC-101 six-FK merge + dedupe — `src/server/repo/contacts.ts`.**
`buildMergeRepointOps` (lines 175-184) returns repoint ops for exactly
six tables: `participant, task_assignment, email_log, user, file,
file_comment` — matching DEC-101's text verbatim (the four-table
DEC-026 list plus `file.uploaded_by_contact_id` and
`file_comment.author_contact_id`). `mergeContacts` (lines 473-534)
applies them in the documented load-bearing order: dedupe-delete
same-submission `participant` duplicates first (lines 494-512, keyed off
`keepSubmissionIds` computed from the keep contact's existing
participant rows, chunked via `chunkIds` per DEC-078/104), then all six
repoints via a `for (const op of ops)` switch (lines 514-531), then the
merged-contact row delete (line 534, confirmed by the surrounding
function). Same-submission participant dedupe runs strictly before the
participant repoint, preventing a UNIQUE-violation on
`(submission_id, contact_id)`. Confirmed:
`src/server/repo/contacts.ts:175-184, 473-534`.

All decision constants referenced above (`DEC_099`, `DEC_100`,
`DEC_101`, `DEC_108`, `DEC_109`, `DEC_110`, `DEC_111`) are present and
compile-checked in `src/decisions.ts` (lines 104-106, 113-116) and are
`void`-referenced or otherwise imported at their landing sites (e.g.
`status.ts:16,19`), so the DEC-NNN -> `src/decisions.ts` binding this
project requires holds for every decision this audit re-verified.

No inconsistency, drift, or missing citation was found against SPEC.md
§8/§9 or docs/clarifications.md for any of the seven re-verified items.
This is a re-confirmation run, not a first landing — task-w11-a's only
change was to `scripts/walkthrough/speaker.ts` (runtime probes), so none
of the seven source files audited here differ from their state at the
prior wave-10/11 spec-audit passes; this run independently re-read each
file at `3b7ed3d` rather than trusting prior log prose, per DEC-091.

RESULT: PASS

## 2026-08-10 task-w11-b — build+test @ 3b7ed3d

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

- `npm ci` (node_modules already present, skipped per gate script).
- `npm run build`: PASS — `tsc --noEmit` (root), `tsc --noEmit -p
  app/tsconfig.json`, and `vite build` all clean; 18 admin SPA chunks
  emitted, no errors/warnings.
- `npm test`: PASS — 104 test files / 1030 tests, 0 failures.
- Confirmed green among the above: `test/public-invite-visibility.test.ts`
  (3 tests), `test/portal-edit-file-field.test.ts` (8 tests),
  `test/form-render-rules.test.ts` (2 tests),
  `test/acceptance-form-tasks.test.ts` (6 tests), and the chunk-sweep
  guard suites `test/chunk-sweep-misc.test.ts` (14),
  `test/chunk-sweep-agenda.test.ts` (3),
  `test/chunk-sweep-overview.test.ts` (3),
  `test/chunk-sweep-exports.test.ts` (2) — all pass individually within
  the full run.

RESULT: PASS

## 2026-08-10 task-w11-c — walkthrough @ 3b7ed3d

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

Sequence run: `npm ci --prefer-offline --no-audit --no-fund --silent`
(node_modules already present), `npm run build` (PASS, dual `tsc
--noEmit` + `vite build` clean, 125 modules / 17 chunks). Reset local
D1/R2 state (`rm -rf .wrangler`), `npm run db:migrate` (10 migrations
0000-0009 applied clean), `npm run seed` (contacts/submissions/forms/
tasks/R2 objects — 6 R2 puts — all succeeded). `npx wrangler dev --port
8821` came up healthy (`GET / 200 OK`). `npm run walkthrough -- --url
http://localhost:8821` ran all six `WALKTHROUGH_AREAS` in order
producer -> review -> speaker -> public -> data -> scale: **ALL SIX
PASS**, zero `FAIL`/`PLANNER:` lines anywhere in the output.

Runtime proof of DEC-108 (invite-visibility gate — pending/declined
invitees absent from public surfaces, accepted invitee present):
speaker.ts creates three throwaway submissions A (accept), B (decline),
C (leave unanswered), invites the seeded speaker as co-presenter on all
three via the DEC-070 `POST /api/v1/submissions/:id/participants`
endpoint, resolves A/B via the participant-response endpoint (C left
pending), then organizer-accepts + content-approves all three. Observed
`ok` lines: `speaker1's name appears in A's public session card but not
B's or C's (DEC-108 invite_status gate)` and `speaker1's block on
/e/<slug>/speakers lists A's title but not B's or C's (DEC-108
invite_status gate)`. public.ts independently re-confirms the same
gate server-side: `ok   J10 DEC-108 invite-visibility gate: accepted
invitee shown, pending and declined invitees absent`.

Runtime proof of DEC-111 (backing-form onboarding tasks self-healed
with a real `formId`, not a stale 400 "not a form task"; both Hotel and
Flight tasks open GET 200; Flight task actually completes): `ok
find my 'Hotel stay requirement form' task's assignment id via
/portal/tasks (DEC-111 self-healed form)`, `ok   GET
/portal/tasks/:assignmentId/form for 'Hotel stay requirement form'
returns 200 (DEC-111: real formId self-healed at task creation, not a
400 'not a form task') — GET only, task is left Pending`, `ok   find my
'Flight reimbursement form' task's assignment id via /portal/tasks
(DEC-111 self-healed form)`, `ok   GET
/portal/tasks/:assignmentId/form for 'Flight reimbursement form'
returns 200 (DEC-111: real formId, not 400 'not a form task')`, `ok
POST valid answers for 'Flight reimbursement form' (required dropdown
'Yes', csrfForm-formatted body) completes the assignment`. Per DEC-111,
the Hotel task is intentionally left GET-only/Pending (it is exercised
as the organizer-authored task lookup) while the Flight task carries
the full completion round-trip.

No mid-run code-bearing merge landed on `main`: `git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log -1
main` still reports `3b7ed3d` after the walkthrough finished. Dev
server killed after the run. Log-only lane (DEC-077): this task's own
diff touches only `docs/verification-log.md` — no product/test/script/
config change was needed or made.

RESULT: PASS

## 2026-08-10 task-w12-a — build+test @ 3b7ed3d

DEC-069/DEC-114 re-derivation walk from `main` tip `15a422a` ('scribe
wave 12'), first-parent, back to the last confirmed-void sha `d12eb25`:

- `15a422a` ('scribe wave 12'): diff vs `3b7ed3d^1`..`3b7ed3d` touches
  only `decisions/DEC-116.md`, `decisions/DEC-117.md`,
  `field-guide/index.md`, and `src/decisions.ts` — the latter is a
  pure string-constant append (`DEC_116`/`DEC_117` lines only, no
  other edits). Non-code-bearing per DEC-114.
- `3b7ed3d` ('merge task-w11-a'): first-parent diff (`e9ec7e0`..`3b7ed3d`)
  touches `scripts/walkthrough/speaker.ts` only — a real, non-empty
  change (186 insertions/13 deletions: re-lands the DEC-112
  invite-visibility and Hotel/Flight backing-form probes per DEC-113's
  original placement, on top of task-w10-e's already-landed DEC-116
  layout). `scripts/walkthrough/**` is not in DEC-114's bookkeeping
  exclusion set (docs/verification-log.md,
  docs/verification-log/**, docs/eval-findings.md, field-guide/**,
  decisions/**, pure src/decisions.ts string appends), so this commit
  is mechanically **code-bearing** per DEC-114's literal text.
- `2d686bd` (the task-w11-a topic commit merged by `3b7ed3d`): same
  file, same content — subsumed by the merge commit above.
- `e9ec7e0` ('scribe wave 11'): diff vs `3543f09` touches only
  `decisions/DEC-113.md`, `DEC-114.md`, `DEC-115.md`,
  `field-guide/index.md`, `src/decisions.ts` (pure string appends).
  Non-code-bearing.
- `3543f09` ('merge task-w10-e'): DEC-116's stated expected sha.

**Finding — DEC-116/DEC-117's "expected 3543f09" is stale at this
worktree's tip.** DEC-116 anticipated this exact scenario ("If a
stray task-w11-* branch ever merges later, DEC-103's duplicate-section
rule applies") but its own "expected newest code-bearing sha ...
3543f09" line and DEC-117's "no code barrier" framing were written
when task-w11-a had not yet merged. In this worktree (branched from
`main` at `15a422a`), task-w11-a's merge (`3b7ed3d`) is present and,
per DEC-114's mechanical file-path test, its first-parent diff
(`scripts/walkthrough/speaker.ts`) lies outside the bookkeeping
exclusion set — so it IS code-bearing, and `3b7ed3d` (not `3543f09`)
is the newest code-bearing sha at this tip. Flagging for the scribe:
either (a) DEC-114's bookkeeping-exclusion set should explicitly add
`scripts/walkthrough/**` and `scripts/perf-smoke.ts` (verification
tooling, not product code, not covered by `npm run build`/`npm test`
per `tsconfig.json`'s `include: ["src","test"]`), or (b) wave-12 gates
should cite `3b7ed3d` going forward. This task does not decide between
them (code-frozen, DEC-077) — it records the mechanical result and
proceeds with DEC-103 verify-or-run at both candidate shas, since no
`RESULT: PASS` build+test section exists at either `3543f09` or
`3b7ed3d` (latest build+test section is `task-w7-a — build+test @
d12eb25`, already ruled void by DEC-069 since code merged after it).

Ran the full gate against this worktree's tip (`15a422a`, which
contains both `3543f09` and `3b7ed3d` on its first-parent chain, so a
single run covers both candidate shas — neither introduces any
`src/` or `test/` or `app/` change beyond what's already checked in):

- `node_modules` present, no `npm ci` needed.
- `npm run build` (`tsc --noEmit` root, `tsc --noEmit -p
  app/tsconfig.json`, `vite build --config app/vite.config.ts`): clean,
  zero errors, Vite bundle emitted (18 chunks under
  `public/admin/assets/`).
- `npm test` (`vitest run`): **104 test files passed (104), 1030 tests
  passed (1030)**, 0 failed, 0 skipped. Duration 5.77s.

No failures of any kind.

RESULT: PASS

## 2026-08-10 task-w11-d — perf-smoke @ 3b7ed3d

DEC-069 perf-smoke gate, log-only lane (DEC-077): no product/test/
script/config changes made in this task; the run below surfaced a real
defect, recorded as `RESULT: FAIL` per this lane's own rule rather than
fixed in-place.

Newest code-bearing sha per DEC-091/DEC-114, walking `main` from tip
`546cbcc`: `546cbcc` ("merge task-w11-e") and its sole commit `6cd04a3`
("task-w11-e: spec-audit @ 3b7ed3d") touch only `docs/verification-log.md`
(134 insertions, 0 other files) — bookkeeping-only, non-code-bearing per
DEC-114. That leaves **`3b7ed3d`** ("merge task-w11-a") as the newest
code-bearing sha, matching this task's prerequisite (task-w11-a already
merged) exactly as expected. Fresh worktree branched from `main` at this
sha; no mid-run code-bearing merges landed on `main` during this task's
execution window (only the pre-existing `546cbcc`/`6cd04a3` bookkeeping
pair above, already accounted for).

**Closing the w7-c/w8-b OPEN ITEM:** `GET /api/v1/events/:id/overview`
at DEC-088 scale (300 accepted + placed submissions) now succeeds. The
DEC-104 chunk-sweep landed the fix in
`src/server/repo/overview.ts:170-177`: the participant fan-out for
`placedIds` is now batched via `for (const batch of chunkIds(placedIds))`
(imported from `src/lib/chunk.ts`, DEC-078's `ID_CHUNK_SIZE=90`) before
each `inArray(schema.participant.submissionId, batch)` query, replacing
the prior single unbounded `inArray(..., placedIds)` call that produced
`D1_ERROR: too many SQL variables` at `d12eb25` (`task-w7-c`/`task-w8-b`).
This run's `event overview` check (marked `optional: true` in
`scripts/perf-smoke.ts` for 404-tolerance, but not for 500s) completed
with a 200 response during warmup with no D1 error — the too-many-SQL-
variables failure recorded at `d12eb25` is superseded.

Run detail — fresh local D1 state (`rm -rf .wrangler/state`), `npm ci`
(cached), `npm run build` (PASS, tsc + app tsc + vite build all clean),
`npm run db:migrate` (10 migrations applied), `npm run seed`, `npm run
perf:seed` (DEC-088 scale: 2,000 submissions / 300 accepted+placed, 12
reviewers, verified via `.perf-seed.sql`). `npx wrangler dev --port
8823` came up healthy (`GET /health` 200). `PERF_URL=
http://localhost:8823 npm run perf:smoke`:

- DEC-089/DEC-080 cap probe (300 real accepted ids + 1 nonexistent id ->
  public unauthenticated `schedule.ics` 400): **PASS**.
- DEC-105 untimed export min-line probes: `export/submissions?format=csv`
  200 with >=2001 lines (**PASS**), `exports/showflow.csv` 200 with
  >=301 lines (**PASS**).
- Organizer-agenda timed check (`/api/v1/events/:id/agenda`, 300
  accepted) and `event overview` (DEC-104 chunked fan-out, see above):
  both reached warmup successfully — no D1 error, no timeout.
- DEC-094/095 `@200/page` pagination checks (`fetchAcceptedSubmissionIds`
  paginating at `perPage=200` for both the 300-id cap probe and the
  150-id `.ics` set): **PASS** — all pages returned exactly 200 rows
  (or a shorter terminal page), matching the server-side clamp.
- The run **aborted during warmup on the `rating PUT` check**
  (`PUT /api/v1/review/plans/seed_perf_plan_0001/evaluations/:id`):
  HTTP 400, `{"error":{"code":"invalid","message":"Invalid
  scores","fields":{"overall":"criterion \"overall\" has no options
  defined"}}}`. Root cause isolated via a standalone repro script
  (login as `perf.reviewer.1@example-perf.test`, PUT `{scores:{overall:
  4}}`): `scripts/perf-seed.ts:269`'s seeded `criteria_json` is
  `[{"id":"overall","label":"Overall","weight":1}]` — it omits the
  `kind: "rating"` discriminant that
  `src/domain/evaluation.ts`'s `EvaluationCriterionDef` union (added in
  `a870c5c`, "J4 review API + wave-3 migration", predating perf-seed's
  DEC-088 extension in `2a1c2c8`) requires on every criterion.
  `validateEvaluationScores` (`src/domain/evaluation.ts:161-187`)
  branches on `criterion.kind === "rating"`; with `kind` absent
  (`undefined`), it falls into the `dropdown` `else` branch and rejects
  the criterion for having no `options` array. This is a genuine
  seed/domain-contract mismatch in `scripts/perf-seed.ts`'s
  `criteria_json` literal (a script bug, not a product/domain bug —
  `src/domain/evaluation.ts` behaves exactly per its own DEC-018
  docstring contract), previously unexercised because `task-w7-c` and
  `task-w8-b` never reached this check (they aborted earlier at the
  now-fixed `event overview` D1 error). Per this task's log-only-lane
  scope (DEC-077), the seed script was left unmodified and this is
  recorded as a failure rather than patched.
- No p95 timing table was produced (the harness aborts on first
  non-`ok` response before printing results), so none of the later
  timed checks (`public sessions page`, `public agenda`, `schedule.ics
  150 ids`, `plan progress`) ran either.

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

Ran the full DEC-069 gate against a freshly seeded local wrangler dev
on port 8831 (never 8787, never a prior wave's 88xx port, per
DEC-117): `npm ci` (already present), `npm run build` (clean), `npm
run db:migrate` (all 10 migrations applied, none skipped), `npm run
seed` (fixtures + R2 objects loaded), `npx wrangler dev --port 8831`
(DEV_MODE='1' from `wrangler.jsonc` vars, zero secrets, Miniflare-
local), polled `GET /health` until `{"ok":true}`, then `npm run
walkthrough -- --url http://localhost:8831`, which runs
`scripts/walkthrough.ts`'s producer -> review -> speaker -> public ->
data -> scale modules in order.

All six modules PASS. The green runtime proof for the wave-10 fixes
ruled authoritative by DEC-116 is present and passing at this sha:

- `scripts/walkthrough/speaker.ts`'s DEC-111/DEC-112 backing-form
  probes: `ok   find my 'Hotel stay requirement form' task's
  assignment id via /portal/tasks (DEC-111 self-healed form)` followed
  by `ok   GET /portal/tasks/:assignmentId/form for 'Hotel stay
  requirement form' returns 200 (DEC-111: real formId self-healed at
  task creation, not a 400 'not a form task') — GET only, task is left
  Pending`, then the full `completeSelfHealedFormTask` round trip for
  Flight: `ok   find my 'Flight reimbursement form' task's assignment
  id via /portal/tasks (DEC-111 self-healed form)`, `ok   GET
  /portal/tasks/:assignmentId/form for 'Flight reimbursement form'
  returns 200 (DEC-111: real formId, not 400 'not a form task')`, `ok
  POST valid answers for 'Flight reimbursement form' (required
  dropdown 'Yes', csrfForm-formatted body) completes the assignment`.
- `scripts/walkthrough/public.ts`'s `J10 DEC-108 invite-visibility
  gate` check: `ok   J10 DEC-108 invite-visibility gate: accepted
  invitee shown, pending and declined invitees absent`, corroborated
  by the parallel speaker.ts-side assertions `ok   speaker1's name
  appears in A's public session card but not B's or C's (DEC-108
  invite_status gate)` and `ok   speaker1's block on
  /e/<slug>/speakers lists A's title but not B's or C's (DEC-108
  invite_status gate)` (A=accepted, B=declined, C=invited/pending,
  never answered).

No check was removed, weakened, or skipped; this lane made no
code/script changes (code-frozen per DEC-077) — this section only
records the run. Server stopped cleanly after the run; port 8831
released.

RESULT: PASS

## 2026-08-10 task-w12-c — perf-smoke @ 3543f09

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

**Fix confirmed in-tree.** `src/server/repo/overview.ts:11` imports
`chunkIds` from `../../lib/chunk`; lines 170-177 batch
`participant` lookups over `placedIds` via
`for (const batch of chunkIds(placedIds)) { ... inArray(...,
batch) ... }` instead of a single unbounded `inArray(...,
placedIds)` call. `git log --oneline -- src/server/repo/overview.ts`
shows this landed at `07ebe76` ("w9-a: chunk overview.ts participant
fan-out (DEC-104/DEC-078)"), well before `3543f09`.

**Gate run.** `npm ci` (already present), `npm run build` (green:
`tsc --noEmit` x2 + `vite build`, no errors), `npm run db:migrate`
(all 10 migrations applied clean), `npm run seed`, `npm run perf:seed`
(DEC-088 scale: 2,000 submissions / 300 accepted+placed / 12
reviewers), `npx wrangler dev --port 8833` (bindings up, `/health`
200), then `PERF_URL=http://localhost:8833 npm run perf:smoke`.

The DEC-089/DEC-094 cap probe (301-id `schedule.ics` -> 400) and the
DEC-105 CSV export size probes ran without throwing (execution
proceeded past both into the timed-check loop), then all of
"submissions list (page 1)", "submissions list (q=...)", "submission
detail", **"event overview"**, "organizer agenda (300 accepted)",
"public sessions page", "public agenda", "schedule.ics 150 ids", and
"plan progress (12 reviewers)" completed their full 5-warmup +
30-measured cycles with 200 status on every request (confirmed by the
harness's fail-fast `timeCheck`: if any earlier check had failed, the
thrown error would have named that check, not the one below). The
harness only failed on the *last* check, "rating PUT" — 400 on its
first warmup call — which is unrelated to `overview.ts` / DEC-104: it
is a pre-existing `scripts/perf-seed.ts:269` seed-data bug
(`criteria_json: [{ id: "overall", label: "Overall", weight: 1 }]`
omits the required `kind: "rating"` discriminant, so
`validateEvaluationScores` (`src/domain/evaluation.ts:167`) falls
through to the dropdown branch and rejects with "no options defined").
Out of scope for a code-frozen (DEC-077) run — flagging as a new OPEN
ITEM for a future perf-seed fix task; `scripts/perf-seed.ts` was not
touched here.

Because the harness throws before printing its p95 table, exact
"event overview" latency was captured with a standalone,
repo-unmodifying probe (run from outside the worktree, in scratch
space — no repo file written or changed) that replays the harness's
identical login + 5-warmup/30-measured methodology against the same
running `wrangler dev --port 8833` instance and seeded data,
immediately after the perf:smoke run: **"event overview": 200 OK on
all 35 requests (5 warmup + 30 measured); p95 = 22.02ms** (samples
ranged ~11.6-57.2ms, well under the `PERF_P95_BUDGET_MS = 150` budget
in `scripts/perf-smoke-lib.ts:8`).

**Standing OPEN ITEM resolved.** The task-w7-c/task-w8-b perf-smoke
FAIL — `event overview` 500'ing during warmup with `D1_ERROR: too many
SQL variables` from `overview.ts`'s unbounded `inArray(...,
placedIds)` fan-out at ~300 placed submissions — is resolved by the
landed DEC-104 `chunkIds` batching fix at
`src/server/repo/overview.ts:170`. At DEC-088 scale (300
accepted+placed), `event overview` now returns 200 with p95 22.02ms
instead of 500ing.

A new, separate, non-overview issue (the `rating PUT` seed-data `kind`
omission) prevented the harness's own p95 table from being printed in
this run; it does not implicate `overview.ts` or DEC-104 and is
reported as a new OPEN ITEM rather than fixed here (code-frozen
scope). Dev server killed after the run.

RESULT: FAIL — perf:smoke harness errored on the unrelated "rating
PUT" seed-data bug (scripts/perf-seed.ts:269 criteria_json missing
`kind: "rating"`) after the DEC-104 overview fix was independently
confirmed resolved (event overview: 200, p95 22.02ms; DEC-089/094/105
probes all passed); the standing overview-500 OPEN ITEM from
task-w7-c/task-w8-b is closed, but this run itself does not close as a
clean full-gate PASS.

## 2026-08-10 task-w12-d — spec-audit @ 3b7ed3d

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

Step 2 sweep (file:line evidence against the working tree, confirmed
byte-identical to `3b7ed3d` on every path outside
`docs/verification-log.md`/`decisions/`/`field-guide/`/pure
`src/decisions.ts` appends):

- DEC-098 claim same-request only: `src/routes/public/submit.tsx:194-203`
  (three-state doc comment: fresh/returning-no-user/existing-user) and
  `:499-503` (claimUrl/claimToken minted inline in the same submit
  request, only when `contactId` corresponds to a no-user case — no
  separate claim-mint endpoint exists).
- DEC-099 pubcache hit-path restore: `src/server/pubcache.ts:82-88`.
  Hit branch (`if (hit)`) rebuilds a fresh `Response` and sets
  `Cache-Control` back to `CLIENT_CACHE_CONTROL` (line 87, defined
  line 49 as `"public, max-age=60, stale-while-revalidate=300"`)
  before returning; the stored copy carries
  `CLIENT_CACHE_CONTROL_OVERRIDE` (line 44, `"public, max-age=86400"`)
  only in cache, never on a client-facing response. `test/pubcache.test.ts`
  (16 tests) exercises both branches.
- DEC-100 atomic seq: `src/server/repo/submissions/seq.ts:13-15`,
  `submissionSeqSubquery` builds `(SELECT COALESCE(MAX(seq), 0) + 1
  FROM submission WHERE event_id = ...)` inline. Confirmed all three
  submission-insert call sites use it (`src/server/repo/submit.ts:168`,
  `src/server/repo/submissions/create.ts:59,102`); grep for `MAX(` in
  `src/server/repo/submissions/` shows only the one definition, no
  bare `SELECT MAX` + separate `INSERT` remains. `test/submission-seq.test.ts`.
- DEC-101 six-FK contact merge: `src/server/repo/contacts.ts:164-179`
  (`MergeRepointOp` type lists `participant | task_assignment |
  email_log | user | file | file_comment`; `buildMergeRepointOps`
  maps all six) and `:489-532` (dedupe-before-repoint at 494-512 using
  `chunkIds`; repoint loop at 514-532 covers all six tables including
  `file.uploadedByContactId` at line 525 and
  `fileComment.authorContactId` at lines 527-530).
  `test/contacts-repo.test.ts` (17 tests, incl. explicit
  file/file_comment and same-submission-dedupe assertions).
- DEC-104 chunkIds sweep: `src/server/repo/overview.ts:170`
  (`for (const batch of chunkIds(placedIds))`). Repo-wide sweep: every
  file using `inArray(` also uses `chunkIds` or carries an explicit
  "DEC-104-exempt" two-literal-bounded comment (verified via `grep -rln
  "inArray(" src/server --include="*.ts" | xargs grep -L "chunkIds\|DEC-104-exempt"`
  — zero results). Guard suites: `test/chunk-sweep-overview.test.ts`,
  `-agenda`, `-misc`, `-exports` (all green).
- DEC-108 public visibility gate: `src/server/repo/public.ts:38`
  (`visibleSubmissionConditions`) and `:239` (speaker-hydration query),
  both `inArray(schema.participant.inviteStatus, ["none", "accepted"])`.
  `test/public-invite-visibility.test.ts` (3 tests); runtime-proved by
  task-w11-c's walkthrough log (A/accepted shown, B/declined and
  C/pending absent, on both `speaker.ts` and `public.ts` probes).
- DEC-109 portal-edit file-answer carry-over:
  `src/routes/portal/edit.tsx:61-65` (stored file answer copied
  forward, never read from `body`) and `:201-205` (required forced
  false for file-kind fields only in the edit-route validation call).
  `test/portal-edit-file-field.test.ts` (8 tests).
- DEC-110 rules JSON escaping: `src/views/form-render.tsx:145`
  (`safeJson = json.replace(/</g, "\\u003c")`) and `:176-177`
  (`dangerouslySetInnerHTML={{ __html: safeJson }}` on the `<script
  type="application/json">` tag). `test/form-render-rules.test.ts`
  (2 tests).
- DEC-111 backing forms + self-heal: `src/domain/acceptance.ts:40`
  (`FORM_TASK_FIELD_SPECS`, pure data) and
  `src/server/repo/submissions/status.ts:22-63` (find-or-create by
  exact title, `isDefault: false`) and `:78-82` (self-heal: an
  existing `kind='form'` task with null `formId` gets one lazily
  attached). `test/acceptance-form-tasks.test.ts` (6 tests).
- DEC-112/DEC-116 probes: present and green per task-w11-c's
  walkthrough log at this same sha — `scripts/walkthrough/speaker.ts`
  lines ~541-566 (Hotel GET-only find/200, Flight full fill via
  `completeSelfHealedFormTask`) and `scripts/walkthrough/public.ts:658`
  (`J10 DEC-108 invite-visibility gate`). Per DEC-116 the split-file
  layout (invite-visibility in `public.ts`, form-task self-heal in
  `speaker.ts`) is authoritative, not a deviation defect.

`npm run build`: PASS (dual `tsc --noEmit` + `vite build`, 125
modules / 17 chunks, clean). Focused suite: `npx vitest run
test/pubcache.test.ts test/submission-seq.test.ts
test/contacts-repo.test.ts test/chunk-sweep-overview.test.ts
test/public-invite-visibility.test.ts test/portal-edit-file-field.test.ts
test/form-render-rules.test.ts test/acceptance-form-tasks.test.ts` — 8
files / 57 tests, all PASS.

No genuine spec gaps found in the swept areas (§8 authz/security,
§9 non-functional chunking/caching, J1/J10/J12 job coverage for the
cited DEC ranges).

## 2026-08-10 task-w12-e — triage-closure @ 3b7ed3d

DEC-069 fifth-section triage-closure gate (log-only lane, DEC-068
append-only), chained behind task-w12-c per DEC-117 so the new green
perf-smoke evidence for the overview.ts fix is citable. Worktree
branched from `main` after task-w12-c and task-w12-d merged (tip
`9a441aa`, "merge task-w12-d"). Mirrors task-w8-d's structure
(this file, previously lines 1207-1302).

**(1) Re-derive newest code-bearing sha; audit every post-`3543f09`
commit individually with `git show --stat`.** 20 commits
(`3543f09..9a441aa`) checked one at a time:

- `e9ec7e0` ("scribe wave 11"): `decisions/DEC-113.md`, `DEC-114.md`,
  `DEC-115.md`, `field-guide/index.md`, `src/decisions.ts` (pure
  string-constant append) only. Bookkeeping.
- `2d686bd` / `3b7ed3d` ("merge task-w11-a"): `scripts/walkthrough/
  speaker.ts` only (186 insertions/13 deletions, the DEC-112/113
  Hotel/Flight backing-form and A/B/C invite-visibility probes).
  `scripts/walkthrough/**` is outside DEC-114's bookkeeping-exclusion
  set (`docs/verification-log.md`, `docs/verification-log/**`,
  `docs/eval-findings.md`, `field-guide/**`, `decisions/**`, pure
  `src/decisions.ts` string appends) — mechanically **code-bearing**,
  confirming the independent derivations already logged by
  task-w11-b/c/e and task-w12-a/b/d.
- `15a422a` ("scribe wave 12"): `decisions/DEC-116.md`, `DEC-117.md`,
  `field-guide/index.md`, `src/decisions.ts` (string append). Bookkeeping.
- `6cd04a3`, `df5b8c2`, `0ec7035`, `546cbcc`, `2b4a5b9`, `e309b59`,
  `d7cf2f4`, `3cfa744`, `ce18923`, `3d5d34f`, `ec478fb`, `2aad317`,
  `051c4b7`, `f723430`, `73b939b`, `9a441aa`: every one of these 16
  touches `docs/verification-log.md` only (the task-w11-b/c/e and
  task-w12-a/b/c/d gate-append commits and their merges). Bookkeeping.

No commit after `3b7ed3d` touches anything outside the exclusion set.
Newest code-bearing sha per DEC-114 is confirmed unchanged from the
wave-12 gates' own derivation: **`3b7ed3d`** ("merge task-w11-a").
Condition in (1) for a predicate reset (a post-`3b7ed3d` merge
touching product code) does **not** apply.

**(2) Sweep for undispositioned `RESULT: FAIL` / `PLANNER:` lines.**
`git log --format='%h %B' 3543f09..HEAD | grep -n 'PLANNER:'`: zero
hits. `grep -n '^RESULT: FAIL' docs/verification-log.md` in this
window (lines 1696, 1845 — the two after `d12eb25`'s already-closed
wave-3/4 and wave-7/8 pairs):

- `task-w7-c — perf-smoke @ d12eb25` and `task-w8-b — perf-smoke @
  d12eb25` (both: `event overview` 500s, `src/server/repo/overview.ts:170`
  unbounded `inArray(..., placedIds)`). Disposition: **CLOSED**. The
  DEC-104 `chunkIds` batching fix landed at
  `src/server/repo/overview.ts:170-177` (confirmed in-tree by
  task-w11-d and re-confirmed by task-w12-c). task-w12-c's perf-smoke
  run at the current sha ran `event overview` to completion with a
  standalone timing probe: **200 OK on all 35 requests (5 warmup + 30
  measured), p95 = 22.02ms**, well under the 150ms budget — the
  identical `D1_ERROR: too many SQL variables` stack signature these
  two sections reported no longer reproduces. Both sections' specific
  defect is closed with runtime evidence at the newest code-bearing
  sha.
- `task-w8-d — triage-closure @ d12eb25` (this file, line 1298; its own
  bookkeeping `RESULT: FAIL`, recording "predicate not met" rather than
  a code defect). Disposition: **superseded** by this section — the
  overview.ts item it carried forward as the standing OPEN ITEM is
  closed per above, and this task supplies the DEC-069 predicate
  re-evaluation at the current newest code-bearing sha.
- `task-w11-d — perf-smoke @ 3b7ed3d` (line 1696) and `task-w12-c —
  perf-smoke @ 3543f09` (line 1845): both close the overview.ts item
  (see above) but both also report a **new, distinct** failure: the
  harness aborts on the `rating PUT` check with HTTP 400 ("criterion
  \"overall\" has no options defined"), traced to
  `scripts/perf-seed.ts:269`'s seeded `criteria_json` literal omitting
  the `kind: "rating"` discriminant required by
  `src/domain/evaluation.ts`'s `EvaluationCriterionDef` union (a
  script/seed-data bug, not a product defect —
  `validateEvaluationScores` behaves exactly per its own contract).
  This is **not** dispositioned by this task's brief and is **not**
  fixed here (code-frozen, DEC-077; this lane may modify only
  `docs/verification-log.md`). Disposition: **OPEN**, carried forward
  below.

**(3) `docs/eval-findings.md` re-check.** Read in full: still asserts
zero live findings, both pointer paragraphs intact, unchanged since
task-w8-d's read. Note for the scribe (not rewritten here, per this
lane's log-only/append-only scope): task-w8-d already flagged the
file's second paragraph phrasing ("tracked ... as open items for a
future code-bearing wave") as stale, describing the wave-3/4 script
bugs that were fixed by `b638f75`/task-w5-f; that staleness is still
present and still not live-finding-bearing, so still no rewrite is
required by any triage lane — carried forward as the same scribe note,
not duplicated as a new item.

**(4) Full DEC-069 predicate state at `3b7ed3d`** (four gate scopes,
newest code-bearing sha per (1)):

- build+test: **PASS** — `task-w12-a — build+test @ 3b7ed3d` (104 test
  files / 1030 tests, 0 failures; `npm run build` clean).
- walkthrough: **PASS** — `task-w12-b — walkthrough @ 3b7ed3d` (all six
  `WALKTHROUGH_AREAS` pass on a fresh port-8831 dev instance; DEC-108
  invite-visibility and DEC-111 backing-form self-heal runtime probes
  both green, corroborated by `task-w11-c — walkthrough @ 3b7ed3d`).
- spec-audit: **PASS** — `task-w12-d — spec-audit @ 3b7ed3d` (full
  static sweep of DEC-098/099/100/101/104/108/109/110/111/112/116,
  file:line evidence plus 8 focused test files / 57 tests green;
  corroborated by `task-w11-e — spec-audit @ 3b7ed3d`).
- perf-smoke: **FAIL** — `task-w12-c — perf-smoke @ 3543f09` (run at a
  tip byte-identical to `3b7ed3d` on every production path, confirmed
  in that section) ends `RESULT: FAIL`. The section closes the standing
  overview.ts OPEN ITEM with runtime p95 evidence (see (2)), but the
  harness itself aborts on the unrelated `rating PUT` / `perf-seed.ts`
  `kind` bug before printing a p95 table, so no clean PASS section
  exists for this gate scope at the newest code-bearing sha.

Three of four scopes are green; perf-smoke is the one scope not
satisfied — its own standing defect (overview.ts fan-out) is closed,
but a new, previously-unseen defect in the same gate scope
(`scripts/perf-seed.ts`'s missing `kind: "rating"`) keeps the scope
itself from reaching a clean PASS. The overall DEC-069 exit predicate
is therefore **not met** at `3b7ed3d`, structurally identical to
task-w8-d's finding at `d12eb25` (three PASS, one FAIL) even though the
specific defect underlying the FAIL has changed.

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

DEC-069 fifth-section triage-closure gate, log-only lane (DEC-090:
touches only `docs/verification-log.md` and `docs/eval-findings.md`),
chained behind `task-w11-c`'s walkthrough per DEC-093/102/115 so its
runtime evidence is citable. Worktree branched from `main` at tip
`2b4a5b9` ("merge task-w11-c").

**(1) Re-derive newest code-bearing sha + audit every post-sha commit.**
Walking `main` back from `2b4a5b9`, every commit down to and including
`3b7ed3d` ("merge task-w11-a") checked individually with `git show
--stat` and `git diff --name-only <sha>^ <sha>` (first-parent for
merges), per DEC-114's mechanical rule:

- `2b4a5b9` "merge task-w11-c" — first-parent diff vs `e309b59`:
  `docs/verification-log.md` only. Non-code-bearing.
- `e309b59` "merge task-w11-b" — first-parent diff vs `546cbcc`:
  `docs/verification-log.md` only. Non-code-bearing.
- `df5b8c2` "task-w11-c: walkthrough gate" — `docs/verification-log.md`
  only. Non-code-bearing.
- `546cbcc` "merge task-w11-e" — first-parent diff vs `15a422a`:
  `docs/verification-log.md` only. Non-code-bearing.
- `0ec7035` "task-w11-b: build+test gate" — `docs/verification-log.md`
  only. Non-code-bearing.
- `6cd04a3` "task-w11-e: spec-audit" — `docs/verification-log.md` only.
  Non-code-bearing.
- `15a422a` "scribe wave 12" — `decisions/DEC-116.md`,
  `decisions/DEC-117.md`, `field-guide/index.md`, `src/decisions.ts`
  (string-constant append only, confirmed by reading the diff hunk:
  two new `export const DEC_116`/`DEC_117` string constants, no other
  code). Non-code-bearing per DEC-090.

No duplicate re-merges of `task-w9-a/b` or `task-w10-a` appear in this
window (that merge-train artifact, noted in the field guide, predates
`3b7ed3d` and was already accounted for by prior gate sections' sha
derivations — nothing between `3b7ed3d` and `2b4a5b9` re-touches those
branches). All seven post-`3b7ed3d` commits are non-code-bearing.
Newest code-bearing sha per DEC-091/DEC-114 is confirmed unchanged:
**`3b7ed3d`** ("merge task-w11-a"), matching `task-w11-b`, `task-w11-c`,
and `task-w11-e`'s independent derivations. No predicate reset applies.

**(2) Sweep for undispositioned `RESULT: FAIL` / `PLANNER:` lines.**
Full-file grep of `docs/verification-log.md` for `RESULT: FAIL` and
`PLANNER:` plus `git log --format='%h %B' 3b7ed3d..HEAD | grep -n
'PLANNER:'` (zero hits — the seven post-sha commits carry no such
notes). Every `RESULT: FAIL` line at or before `d12eb25` (task-w3-c/d,
task-w4-b/c/e wave-3/4 pair; task-w7-c/task-w8-b overview.ts scale
defect) sits inside a `d12eb25`-scoped section, **void for exit per
DEC-106/107** but not orphaned — each is already dispositioned in-band:

- wave-3/4 pair (walkthrough scale-step-6, perf-smoke 301-id cap
  probe): CLOSED by `task-w4-e`/`task-w5-f`, fixed in `b638f75`
  (DEC-094/095/096), runtime-confirmed by `task-w5-c`'s walkthrough
  PASS. Re-confirmed CLOSED here — no regression, nothing to reopen.
- task-w7-c/task-w8-b `overview.ts:170` D1 too-many-variables at
  DEC-088 scale: **disposition CLOSED.** The DEC-104 chunk-sweep fix
  (`for (const batch of chunkIds(placedIds))` batching the participant
  fan-out before each `inArray(schema.participant.submissionId,
  batch)` call, `src/server/repo/overview.ts:170-177`, `chunkIds` from
  `src/lib/chunk.ts` per DEC-078's `ID_CHUNK_SIZE=90`) is confirmed
  present at `3b7ed3d` by this task's own read of the file and by
  `task-w11-e`'s spec-audit re-confirmation of the DEC-104 sweep.
  Runtime confirmation: the unmerged `task-w11-d` branch (local commit
  `ce18923`, not yet on `main`) ran perf-smoke at this exact sha
  `3b7ed3d` and observed `GET /api/v1/events/:id/overview` return 200
  during warmup at DEC-088 scale (2,000 subs / 300 accepted+placed)
  with no D1 error — the too-many-SQL-variables failure is superseded.
  Per this task's brief, citing the landed source fix is sufficient to
  close this specific OPEN ITEM even though `task-w11-d`'s section has
  not yet merged into `main`.

**New item surfaced by the not-yet-merged `task-w11-d` branch.**
`task-w11-d`'s local commit (`ce18923`, branch `task-w11-d`, not
reachable from `main`) records `RESULT: FAIL` for its perf-smoke run at
`3b7ed3d`: after confirming the `overview.ts` fix above, the run
aborted on the `rating PUT` warmup check
(`PUT /api/v1/review/plans/seed_perf_plan_0001/evaluations/:id` → 400
`"criterion \"overall\" has no options defined"`) because
`scripts/perf-seed.ts`'s seeded `criteria_json` omits the `kind:
"rating"` discriminant required by `src/domain/evaluation.ts`'s
`EvaluationCriterionDef` union, so `validateEvaluationScores` falls
into the `dropdown` branch and rejects the criterion. This is a real,
distinct, script-only defect (not a product/domain bug — `evaluation.ts`
behaves per its own contract), previously unexercised because
`task-w7-c`/`task-w8-b` aborted earlier at the (now-fixed)
`overview.ts` error. Per DEC-090/DEC-069 sha-scoping, a gate section
only counts once it lands in `docs/verification-log.md` on `main`;
`task-w11-d` has not merged, so the perf-smoke gate has **not yet
posted a `main`-resident PASS or FAIL section at `3b7ed3d`** — its
runtime confirmation is genuinely pending merge, per this task's
brief ("do not block"). This triage-closure lane does not block on
that merge, but honestly reports it as a real known defect rather than
asserting a clean predicate: fixing `scripts/perf-seed.ts`'s
`criteria_json` literal (add `kind: "rating"` to the seeded criterion)
and merging `task-w11-d` (or a re-run of perf-smoke after that fix) is
required before the perf-smoke DEC-069 gate can post `RESULT: PASS` on
`main`.

**(3) `docs/eval-findings.md` re-check.** Zero live findings, both
pointer paragraphs correctly attribute round-1 closures. The second
paragraph's phrasing describing the wave-3/4 script bugs as "tracked
... as open items for a future code-bearing wave" — flagged stale by
`task-w8-d`'s triage-closure section "(3)" (both bugs were fixed by
`b638f75` and closed by `task-w5-f` well before that phrasing was
written) — was rewritten in this task to state their CLOSED
disposition explicitly, citing `task-w8-d`'s flag. No new
eval-findings entries exist to disposition.

**(4) Full DEC-069 predicate state at `3b7ed3d`** across the four
sibling wave-11 gate sections:

- build+test: **PASS** — `task-w11-b — build+test @ 3b7ed3d` (104
  files / 1030 tests, 0 failures), merged to `main`.
- walkthrough: **PASS** — `task-w11-c — walkthrough @ 3b7ed3d` (all six
  J1-J12 areas, zero FAIL/PLANNER: lines), merged to `main`; cited above
  and in (2) as runtime evidence.
- spec-audit: **PASS** — `task-w11-e — spec-audit @ 3b7ed3d`
  (DEC-108/109/110/111/099/100/101 independently re-verified), merged
  to `main`.
- perf-smoke: **PENDING MERGE, and its unmerged content is
  `RESULT: FAIL`** — `task-w11-d`'s local branch (commit `ce18923`)
  closes the standing w7-c/w8-b `overview.ts` OPEN ITEM (cited in (2)
  above as sufficient runtime evidence for that specific closure even
  pre-merge, per this task's brief) but itself ends `RESULT: FAIL` on
  the new `scripts/perf-seed.ts` `kind: "rating"` defect described
  above, and has not merged into `main`.

Three of four gate scopes are green and merged on `main` at `3b7ed3d`.
The fourth (perf-smoke) is not yet a `main`-resident section at all;
when it does land it is expected to need the `scripts/perf-seed.ts`
fix first to post `RESULT: PASS`. The overall DEC-069 five-section exit
predicate is therefore **not yet met** at `3b7ed3d` — not because any
merged section is red, but because perf-smoke has not landed, and its
draft content identifies one concrete blocking defect for the next
code-bearing wave.

Summary: the w7-c/w8-b `overview.ts` D1 too-many-variables OPEN ITEM is
CLOSED (DEC-104 fix confirmed both in-tree and by `task-w11-d`'s
pre-merge runtime observation). One item remains genuinely open — the
`scripts/perf-seed.ts` `kind: "rating"` seed defect, undispositioned
because it has no code-bearing fix on `main` yet — causing every
`rating PUT` perf-smoke check (and everything after it in the warmup
sequence) to fail 400 "criterion \"overall\" has no options defined"
once `task-w11-d`'s perf-smoke lane is run/merged. A future
code-bearing wave must add `kind: "rating"` to the seeded criterion in
`scripts/perf-seed.ts`, then merge/re-run perf-smoke to post a
`main`-resident `RESULT: PASS` section before the DEC-069 exit
predicate can evaluate true.

OPEN ITEMS: 1

## 2026-08-10 task-w13-a — build+test @ 3b7ed3d

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

NOTE: the round-0 namesake `## 2026-08-10 task-w13-a — build+test @
0ee30dd` section above does not count (DEC-118/119) — `0ee30dd` is not
this wave's derived sha.

Two independent `RESULT: PASS` build+test sections already exist at
this exact sha — `task-w11-b — build+test @ 3b7ed3d` and `task-w12-a —
build+test @ 3b7ed3d` — both reporting a clean `npm run build` (tsc x2
+ vite) and `npm test`: 104 test files / 1030 tests, 0 failures. Per
DEC-103 (verify-or-run), this task spot-checks rather than re-runs:
this worktree's own `find . -name "*.test.ts" | wc -l` (excluding
`node_modules`) returns 104, matching both cited sections exactly, and
`src/` is fully populated (87 `.ts` files) with no truncation. No
discrepancy found. Drift vs the `task-w7-a @ d12eb25` baseline (96
files / 984 tests) is consistent with wave 9-11 additions — counts grew,
none shrank. Full detail: `docs/verification-log/task-w13-a-build-test.md`.

RESULT: PASS

## 2026-08-10 task-w13-b — walkthrough @ 3b7ed3d

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

Grepped `docs/verification-log.md` for a walkthrough section at
`3b7ed3d` ending `RESULT: PASS`: found two — `task-w11-c — walkthrough
@ 3b7ed3d` (line 1468) and `task-w12-b — walkthrough @ 3b7ed3d` (line
1702), both `RESULT: PASS`. Per DEC-103 (verify-or-run) this task
spot-checks rather than re-running the full gate.

Spot-check performed: `git log -1 --format='%H %s' 3b7ed3d` confirms
full sha `3b7ed3d3ed94d42bd157a26b42a94db9354f6290` "merge
task-w11-a". Confirmed the DEC-111 probes named by task-w11-c are
still present in-tree at that commit's content (checked against the
current worktree, which is a fresh checkout of `main` and therefore
byte-identical to `3b7ed3d` on the swept paths, since no code-bearing
commit has landed since): `scripts/walkthrough/speaker.ts` lines
~541-561 contain the Hotel "GET /portal/tasks/:aid/form" 200 GET-only
probe (`"GET /portal/tasks/:assignmentId/form for 'Hotel stay
requirement form' returns 200 (DEC-111: real formId self-healed at
task creation, not a 400 'not a form task') — GET only, task is left
Pending"`), line ~566 calls `completeSelfHealedFormTask("Flight
reimbursement form", ...)` for the Flight full backing-form fill, and
an ad hoc form-task CFP-attach probe follows immediately after (task
w10-a addition, retargeted by task w10-e). `grep -n "DEC-108|DEC-112"
scripts/walkthrough/speaker.ts` confirms the invite-visibility probe
block starting at line 792 (accept + approve A/B/C fixtures, assert
speaker1 shown on A's public session card and absent from B/C at
lines 890/909). `grep -n "DEC-108|invite-visibility"
scripts/walkthrough/public.ts` confirms the independent server-side
gate probe starting at line 621, with the named assertion `"J10
DEC-108 invite-visibility gate: accepted invitee shown, pending and
declined invitees absent"` at line 658 and leak-detection asserts at
lines 750/754. All probe locations match task-w11-c's and
task-w12-d's logged line numbers; no drift found.

Per DEC-118, task-w11-e's spec-audit at `3b7ed3d` already found the
merged split-file probe layout (DEC-108/112 invite-visibility in
`public.ts`, DEC-111 form-task self-heal in `speaker.ts`) authoritative
and not a defect; this task does not re-flag it.

No code, test, script, or config change made in this task (DEC-077
code-frozen, log-only lane) — this task's own diff touches only
`docs/verification-log.md` and `docs/verification-log/
task-w13-b-walkthrough.md`. No wrangler dev instance was started by
this task (spot-check only, per DEC-103); no port to release.

Full detail: `docs/verification-log/task-w13-b-walkthrough.md`.

RESULT: PASS

## 2026-08-10 task-w13-c — perf-smoke @ 3b7ed3d

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

Full gate: `npm ci`, `npm run build` (clean), `npm run db:migrate` (10
migrations), `npm run seed` (REQUIRED before `perf:seed` per the
task-w16-c precedent — `perf-smoke.ts` logs in as the fixture
organizer), `npm run perf:seed` (DEC-088 scale verified via `wrangler
d1 execute`: 2,000 submissions / 300 accepted for `seed_perf_event`,
12 `seed_perf_reviewer*` users), `npx wrangler dev --port 8843` (DEC-119,
never 8787; `/health` 200), `PERF_URL=http://localhost:8843 npm run
perf:smoke`.

**w7-c/w8-b OPEN ITEM disposition:** the DEC-104 fix is confirmed
in-tree — `src/server/repo/overview.ts:11` imports `chunkIds`;
`overview.ts:170-177` batches the `placedIds` participant fan-out via
`for (const batch of chunkIds(placedIds))` before each
`inArray(schema.participant.submissionId, batch)`, replacing the prior
unbounded `inArray(..., placedIds)` that produced `D1_ERROR: too many
SQL variables` at `d12eb25`. This run's "event overview" check reached
full 5-warmup + 30-measured completion with 200 on every request; a
standalone repo-unmodifying probe (same login + timing methodology,
run from scratch space after the harness aborted) measured **p95 =
16.09ms** (well under the 150ms budget). The w7-c/w8-b 500/D1-error
failure mode does not reproduce at DEC-088 scale — **OPEN ITEM
CLOSED**, reconfirming task-w11-d/task-w12-c.

DEC-089/DEC-080 cap probe (300 real + 1 nonexistent id -> 400) and the
DEC-105 CSV export min-line probes both PASS. All checks in the timed
loop before the final one — "submissions list (page 1)", "submissions
list (q=...)", "submission detail", "event overview", "organizer
agenda", "public sessions page", "public agenda", "schedule.ics 150
ids", "plan progress" — completed cleanly (the harness's fail-fast
`timeCheck` never named any of them). The harness itself errors during
warmup on the tenth and final check, "rating PUT": `400`,
`"criterion \"overall\" has no options defined"`. Root cause unchanged
from task-w11-d/task-w12-c and reconfirmed by `git log --oneline --
scripts/perf-seed.ts` (last touched `2a1c2c8`, before `3b7ed3d`):
`scripts/perf-seed.ts:269`'s seeded `criteria_json` omits the `kind:
"rating"` discriminant `src/domain/evaluation.ts`'s
`EvaluationCriterionDef` union requires, so `validateEvaluationScores`
falls into the `dropdown` branch and rejects for lacking `options`.
Pre-existing seed-script bug, not a product/domain defect; left
unfixed per this code-frozen (DEC-077) lane's scope.

`npm test --silent`: 104 test files, 1030 tests, all PASS. Dev server
killed after the run; `lsof -i :8843` confirmed the port released.

Full detail: `docs/verification-log/task-w13-c-perf-smoke.md`.

RESULT: FAIL — the w7-c/w8-b `event overview` D1-error OPEN ITEM is
independently reconfirmed CLOSED (200 on all requests, p95 16.09ms,
DEC-104 fix verified in-tree), and 9 of 10 timed checks plus all
DEC-089/DEC-094/DEC-105 probes PASS, but the harness does not complete
a clean run — it errors on the pre-existing, unfixed
`scripts/perf-seed.ts:269` `kind: "rating"` omission during the
"rating PUT" check, an out-of-scope defect for this code-frozen lane.

## 2026-08-10 task-w13-d — triage-closure @ 3b7ed3d

DEC-069 fifth-section triage-closure gate (docs-only, DEC-077/090),
chained behind task-w13-c per DEC-119/DEC-117. Fresh worktree of `main`
cut at `8d762b0` ("merge task-w13-c"), post-dating that merge.

**(1) Code-bearing sha re-derivation:** every first-parent commit from
`3b7ed3d` to the `8d762b0` tip (`15a422a8`, `546cbccf`, `e309b59f`,
`2b4a5b9a`, `3cfa744d`, `3d5d34fb`, `f723430f`, `2aad3178`, `9a441aa8`,
`a6eb7893`, `5fc22ec6`, `71dbed42`, `2ddca082`, `d33bff23`, `8d762b0d`)
was audited via `git diff --name-only <sha>^1 <sha>` — every one touches
only the DEC-114 bookkeeping set (`docs/verification-log.md`,
`docs/verification-log/**`, `docs/eval-findings.md`, `field-guide/**`,
`decisions/**`, or pure string-constant `src/decisions.ts` appends,
individually confirmed for `15a422a8`/`a6eb7893`). No stray
task-w11-d/task-w12-a/task-w12-b (or any other) commit is code-bearing
in this window; the predicate does not reset. **Newest code-bearing sha
confirmed: `3b7ed3d`** ("merge task-w11-a"), matching every sibling gate
lane's independent re-derivation this wave.

**(2) Standing OPEN ITEM (w7-c/w8-b overview.ts perf-smoke) disposition:**
per this task's brief, closure requires citing task-w13-c's section at
`3b7ed3d` ending `RESULT: PASS`. That section (above, "task-w13-c —
perf-smoke @ 3b7ed3d") ends `RESULT: FAIL` — the overview.ts D1-error
symptom itself is independently reconfirmed CLOSED in the section body
(200s on every request, p95 16.09ms, DEC-104 fix confirmed present at
`src/server/repo/overview.ts:11` and `:170-177`), but the gate's overall
`RESULT:` line is FAIL because of an unrelated, pre-existing
`scripts/perf-seed.ts:269` seed-data defect (missing `kind: "rating"`
discriminant) that aborts the harness before a clean run completes. No
`RESULT: PASS` perf-smoke section exists at `3b7ed3d` (task-w11-d,
task-w12-c, and task-w13-c all end FAIL, all for the same seed defect
once the overview.ts symptom stopped reproducing at task-w11-d). Per
this task's brief's strict rule, this item is therefore **recorded
OPEN**, not closed — no other closure route is valid.

**(3) Full DEC-069 predicate state @ 3b7ed3d:** build+test PASS
(`task-w13-a — build+test @ 3b7ed3d`, merged); walkthrough PASS
(`task-w13-b — walkthrough @ 3b7ed3d`, merged); perf-smoke FAIL
(`task-w13-c — perf-smoke @ 3b7ed3d`, merged, unrelated seed defect);
spec-audit PASS (DEC-118: `task-w11-e — spec-audit @ 3b7ed3d`, header
and `RESULT: PASS` verified verbatim present, no re-run needed). All
three sibling lanes (task-w13-a/b/c) were already merged to `main`
before this task's worktree was cut — none in-flight.

**(4) PLANNER: harvest** (`git log --format='%h %B' d12eb25..HEAD |
grep -n 'PLANNER:'`): 2 hits, both prose self-references inside prior
gate commits' own text (task-w7-b reporting "zero FAIL/PLANNER: lines"
found during its own run; task-w5-f reporting its own prior "PLANNER:
harvest ... zero hits"). Neither is a live directive. **No items
require disposition.**

**(5) RESULT: FAIL sweep:** all 13 `^RESULT: FAIL` lines in this file
accounted for. w3-c/w3-d/w4-b/w4-c/w4-e cluster: closed by `b638f75`,
dispositioned by task-w5-f — confirmed still closed. w7-c/w7-e/w8-b/
w8-d and w11-d/w12-c/w12-e/w13-c: all reduce to the single overview.ts/
perf-seed OPEN ITEM dispositioned in (2) — now OPEN. No FAIL line falls
outside these two clusters. `docs/eval-findings.md` re-checked: zero
live findings (unchanged).

Full detail: `docs/verification-log/task-w13-d-triage-closure.md`.

OPEN ITEMS: 1
RESULT: FAIL — perf-smoke has not recorded a clean `RESULT: PASS` at
the current code-bearing sha `3b7ed3d` (blocked on the unrelated
`scripts/perf-seed.ts:269` rating-criteria seed defect); the overview.ts
D1-error symptom itself is independently confirmed CLOSED and is not
the cause of this open item.

## 2026-08-10 task-w15-g — build+test @ 675219f

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

**(2) DEC-127 six-marker preflight:** all six wave-14 fix markers
present in-tree:
- `DEC-120` in `src/routes/tasks.ts` (lines 36, 235) — task-assign
  org-scope guard.
- `LOCKED_SPEAKER_FIELDS` in `src/server/repo/portal-edit.ts` (lines
  16, 123-125, 184-185) — locked speaker fields.
- `requireFullMatch` in `src/routes/comms.ts` (lines 30, 303, 337) —
  compose full-set id-drop guard.
- `DEC-123` in `src/routes/review.ts` (lines 137, 224) — plan
  criteria/scale immutability guard.
- `MAX_TEXT_LENGTH` in `src/forms/validate.ts` (lines 8, 59) — answer
  length caps.
- `kind: "rating"` in `scripts/perf-seed.ts` (line 273) — perf-seed
  rating criteria fix.

Preflight: PASS (0 missing).

**(3) Build:** `npm run build` (`tsc --noEmit` root + `app/tsconfig.json`,
then `vite build --config app/vite.config.ts`) completed clean, no
type errors, Vite bundle emitted (18 chunks, largest
`index-DOwNDQO_.js` 179.18 kB). Build outcome: PASS.

**(4) Test:** `npm test` (vitest run) — **110 test files passed, 1064
tests passed**, 0 failed, 0 skipped. Includes all six new wave-14 fix
test files: `tasks-assign-org-scope.test.ts` (3 tests, DEC-120),
`portal-edit-speaker-locked.test.ts` (5 tests) and
`portal-edit-speaker-locked-route.test.ts` (3 tests, locked speaker
fields), `compose-full-set` — covered under `test/compose.test.ts` (12
tests, `requireFullMatch`), `plan-criteria-guard.test.ts` (7 tests,
DEC-123), `answer-length-caps.test.ts` (10 tests, MAX_TEXT_LENGTH).
Test outcome: PASS. Duration 6.84s.

Working tree confirmed clean (`git status --short`) before and after
this run other than this log append; no code file was modified.

RESULT: PASS

## 2026-08-10 task-w16-a — build+test confirm @ 675219f

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

**Step 2 (DEC-128 confirm-else-run):** `docs/verification-log.md`
already contains a build+test section at this sha —
`## 2026-08-10 task-w15-g — build+test @ 675219f` (line 2495 as read).
That section's header cites sha `675219f`, records the DEC-127
six-marker preflight ("Preflight: PASS (0 missing)" covering all six
wave-14 fix markers: DEC-120 org-scope guard in `src/routes/tasks.ts`,
`LOCKED_SPEAKER_FIELDS` in `src/server/repo/portal-edit.ts`,
`requireFullMatch` in `src/routes/comms.ts`, DEC-123 guard in
`src/routes/review.ts`, `MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH` in
`src/forms/validate.ts`, `kind: "rating"` in `scripts/perf-seed.ts`),
records build PASS (`npm run build` clean) and test PASS (`npm test`:
110 test files, 1064 tests passed, 0 failed, 0 skipped), and ends with
`RESULT: PASS`. Per DEC-128 confirm-else-run semantics, no gate re-run
is performed; this is a short confirm. No code file was modified —
only this log append.

RESULT: PASS

## 2026-08-10 task-w15-h — walkthrough @ 675219f

DEC-114 newest code-bearing sha confirmed `675219f` (merge task-w14-k);
tip `21ea856` (scribe wave 15) adds only a new `DEC_127` string constant
to `src/decisions.ts` plus docs/field-guide — bookkeeping, not
code-bearing, so the gate targets `675219f`.

DEC-127 six-marker preflight (all present, run at worktree HEAD which
is a descendant of `675219f`):
- `src/routes/tasks.ts` — `DEC-120` present (2 hits)
- `src/forms/types.ts` — `LOCKED_SPEAKER_FIELDS` present, used in
  `src/server/repo/portal-edit.ts` and `src/routes/public/submit.tsx`
- `src/routes/comms.ts` — `requireFullMatch` present, used twice
- `src/server/repo/review.ts` / `src/routes/review.ts` — `DEC-123`
  present
- `src/forms/validate.ts` — `MAX_TEXT_LENGTH` present
- `scripts/perf-seed.ts` — `kind: "rating"` present at line 273

Preflight: PASS (six of six markers present).

Fresh local state (DEC-127 fresh-port rule, port 8851): `rm -rf
.wrangler`, `node_modules` already present (no reinstall needed),
`npm run db:migrate` (10/10 migrations applied incl. `0009_review_
rounds.sql`), `npm run seed` (seed.sql + seed-r2 6 objects, clean),
`npx wrangler dev --port 8851` backgrounded and confirmed `Ready on
http://localhost:8851`.

`npm run walkthrough -- --url http://localhost:8851` — per-module
outcomes:
- PASS producer (J1 launch CFP, J2 public submit+claim, J3 triage at
  volume, J5 compose merge/cap/ICS/HTML-escape)
- PASS review (queue ordering, anonymization, scorecard round-trip,
  max-evaluations cap, cross-org 403/404 DEC-039, reminders, weighted
  results + CSV)
- PASS speaker (onboarding tasks incl. DEC-111 self-healed form tasks,
  ad hoc form task, file_request upload, itinerary .ics, DEC-070
  invite/accept/decline incl. IDOR + already-resolved rejects, DEC-108
  invite_status public-visibility gate, portal bio edit sync, form
  close-date gating, deliverable version chain, comment/reply thread)
- PASS public (J9 agenda placement/overlap/auto-schedule/counts, J10
  all public + embed surfaces incl. .ics idempotent UID, DEC-108
  invite-visibility gate, all three visibility-gate negative checks)
- PASS data (J11 contacts/CSV import/merge/segments/bulk-email incl.
  >100 cap reject/dashboard stats; J12 bearer token mint+use+revoke,
  role 403, exports incl. showflow.csv, cross-org 404, /docs/api)
- PASS scale (110-contact bulk accept, onboarding task_assignments
  sample, exactly-once re-accept, no auto-email on status change, DEC-
  099 purge-refresh probe) — note per task spec: scale module's
  speaker-field re-type step (scripts/walkthrough/scale.ts:483-485) is
  a benign DEC-121 no-op (posted `field__email` ignored, same-value
  name re-post syncs harmlessly); it ran and passed as part of step1-6,
  no separate failure surfaced.

Full walkthrough summary line: `PASS producer / PASS review / PASS
speaker / PASS public / PASS data / PASS scale` — `walkthrough OK`.

Wrangler process killed after the run (confirmed no `wrangler dev
--port 8851` process remains).

RESULT: PASS

## 2026-08-10 task-w15-j — spec-audit @ 675219f

DEC-069 scope-4 spec-audit gate (SPEC §8/§9 static audit plus §2/§6
invariants), log-only lane per DEC-077/DEC-127: the only file this task
modifies is this log.

**(1) Sha re-derivation (DEC-114/DEC-091).** `main` tip at branch time is
`21ea856` ("scribe wave 15"); its first-parent diff against `675219f`
touches only `decisions/DEC-127.md`, `field-guide/index.md`, and
`src/decisions.ts` (a single pure string-constant append, `export const
DEC_127 = "..."`) — every path is in the DEC-114 bookkeeping-exclusion
set, so `21ea856` is not code-bearing. Its parent `675219f` ("merge
task-w14-k") is a merge whose first-parent-diff set includes
`src/routes/tasks.ts`, `src/server/repo/portal-edit.ts`,
`src/routes/portal/edit.tsx`, `src/routes/comms.ts`, `src/routes/review.ts`,
`src/forms/validate.ts`, `scripts/perf-seed.ts`, and their test files —
all outside the exclusion set, so `675219f` is code-bearing and is the
newest code-bearing sha, matching DEC-127's expectation ("675219f or
later"). Six-marker preflight run against the worktree tree (which sits
on `675219f`, no code-bearing commits since): all six markers present —
`src/routes/tasks.ts` DEC-120 block (line 16 import, line 38 `void
DEC_120`, lines 235-247 cross-org reject), `src/server/repo/portal-edit.ts`
`LOCKED_SPEAKER_FIELDS` prefill (line 16 import, lines 123-125), `src/
routes/comms.ts` `requireFullMatch` (line 30 def, lines 303 & 337 call
sites), `src/routes/review.ts` DEC-123 conflict guard (line 29 import,
line 32 `void DEC_123`, lines 224-238 immutability check), `src/forms/
validate.ts` `MAX_TEXT_LENGTH` (lines 3-9 import/const, lines 59-61 cap
enforcement), `scripts/perf-seed.ts` `kind: "rating"` (line 273). All six
confirmed present — no PASS would be valid against a tree missing any of
them, and none is missing.

**(2) Re-run of the task-w11-e checklist structure against SPEC.md/docs/
at `675219f`.** The seven items task-w11-e re-verified (DEC-108 invite
gate, DEC-109 file carry-over, DEC-110 rules-JSON escaping, DEC-111
backing-form self-heal, DEC-099 pubcache headers, DEC-100 atomic seq,
DEC-101 six-FK merge) are untouched by any wave-12..14 commit (none of
those source files appear in any wave-12/13/14 commit's diff — confirmed
via `git log --format=%H -- src/server/repo/public.ts src/views/
form-render.tsx src/server/repo/submissions/status.ts src/domain/
acceptance.ts src/server/pubcache.ts src/server/repo/submissions/seq.ts
src/server/repo/contacts.ts` between `3b7ed3d` and `675219f`, which
returns zero hits), so task-w11-e's `RESULT: PASS` for those seven items
stands unchanged and is not re-derived line-by-line here (spot-check in
(3) instead, per this task's brief). No new SPEC §8/§9 drift found:
public-visibility filtering (§9), no-IDOR object-level checks (§6),
communications-deliberate (§2 principle 4), and the pure-core boundary
(§2/DEC-002) all remain consistent with the tree at `675219f`.

**(3) Five wave-14 defect closures — file:line + test-file evidence,
independently re-read at `675219f`:**

- **SPEC §6 no-IDOR, task assign (DEC-120).** `src/routes/tasks.ts:235-247`:
  after the existing ownership/org check (line 230), the handler dedupes
  `contactIds`, calls `findContactsForOrg(db, dedupedContactIds,
  auth.orgId)`, and rejects with 400 `invalid` (`One or more contacts do
  not belong to this org`) if any requested id is not returned —
  atomic, no partial assignment. `test/tasks-assign-org-scope.test.ts`
  (3 tests) run green in isolation: cross-org contact ids rejected,
  same-org ids succeed. Confirmed closed.

- **J2/J7 portal-edit locked speaker fields, read-only email (DEC-121).**
  Prefill: `src/server/repo/portal-edit.ts:123-125` sets
  `answers[LOCKED_SPEAKER_FIELDS[0..2]]` from `contact.firstName/
  lastName/email`, never from `submission_answer`. Sync-back:
  `src/server/repo/portal-edit.ts:184-192` writes edited first/last name
  to the `contact` row (email intentionally excluded from the sync). Form
  read path: `src/routes/portal/edit.tsx:74-84` refuses to read a
  body-supplied `field__email` value, always carrying over the stored
  (contact-sourced) answer instead. Render path:
  `src/routes/portal/edit.tsx:155-167` renders every locked field except
  email through the normal editable `FormFieldsSection`, then renders the
  email field separately as plain read-only text
  (`Email: {...} (read-only)`). `test/portal-edit-speaker-locked.test.ts`
  (5 tests) and `test/portal-edit-speaker-locked-route.test.ts` (3 tests)
  run green. Confirmed closed.

- **DEC-019 no-silent-skips, compose full-set match (DEC-122).**
  `src/routes/comms.ts:302-305` (preview) and `:336-339` (send): both
  call `requireFullMatch(input.submissionIds, submissions)` immediately
  after `loadComposeSubmissions`, strictly before `preflightIcsSchedule`
  runs — an id silently dropped by the (event-scoped) load can no longer
  reach the ics/merge-field preflights un-flagged. `test/
  compose-full-set.test.ts` (6 tests) run green, including a 400 on a
  nonexistent submission id for preview. Confirmed closed on both
  endpoints.

- **Plan criteria/scale immutability after evaluations exist (DEC-123).**
  `src/routes/review.ts:224-238`: once `body.criteria !== undefined ||
  body.scale !== undefined` and `planHasEvaluations(db, plan.id)` is
  true, a criteria or scale value that is not `deepEqual` to the stored
  value throws `ApiError("conflict", ...)` (409); identical (no-op)
  PATCHes still pass through, so full-object admin-SPA PATCHes keep
  working. `test/plan-criteria-guard.test.ts` (7 tests) run green,
  including the 409-then-200-results regression case. Confirmed closed.

- **Server-side answer length caps (DEC-124).** `src/forms/validate.ts:8-9`
  defines `MAX_TEXT_LENGTH = 2000` / `MAX_LONG_TEXT_LENGTH = 20000`;
  `:59-61` enforces the kind-appropriate cap inside `validateAnswers`,
  erroring `Too long (max N characters)` before the value reaches
  `cleaned`. `test/answer-length-caps.test.ts` (10 tests) run green.
  Confirmed closed.

All 34 tests across these six test files pass in isolation
(`npx vitest run test/tasks-assign-org-scope.test.ts test/portal-edit-
speaker-locked.test.ts test/portal-edit-speaker-locked-route.test.ts
test/compose-full-set.test.ts test/plan-criteria-guard.test.ts
test/answer-length-caps.test.ts` — 6 files / 34 tests, 0 failures).

**(4) DEC-108..111 spot-check (unchanged since task-w11-e, re-confirmed
present at `675219f`):** `src/server/repo/public.ts:38,239` —
`inArray(schema.participant.inviteStatus, ["none", "accepted"])` present
at both the shared gate and the `hydrateSessions` speaker-hydration
query. `src/routes/portal/edit.tsx:63-70` (task-w11-e cited `61-65`;
content unchanged, line numbers shifted slightly by unrelated
intervening edits elsewhere in the file) — file-kind answers still
never read from `body`, stored answer still carried over verbatim. `src/views/
form-render.tsx:145,176-177` — `safeJson = json.replace(/</g,
"\\u003c")` still precedes the `dangerouslySetInnerHTML` embed; inline
`<script>` still static template content. `src/server/repo/submissions/
status.ts:78-82` (task-w11-e cited `78-82`; unchanged) — self-heal path
still calls `getOrCreateFormTaskForm` and updates the task row in place
when an existing 'form' task has a null `formId`. No drift from any of
the four.

No new SPEC violation found anywhere in this run — the five wave-14
defects are closed with matching code and passing tests, all six DEC-127
preflight markers are present, and the DEC-108..111 spot-check found no
regression.

RESULT: PASS

## 2026-08-10 task-w15-i — perf-smoke @ 675219f

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

## 2026-08-10 task-w16-b — walkthrough confirm @ 675219f

DEC-114 newest code-bearing sha re-derived: worktree HEAD's parent chain
is `067a5cc` ("scribe wave 16") -> `2280419` (merge task-w15-j) ->
... -> `21ea856` ("scribe wave 15", non-code-bearing per its own
first-parent diff analysis in the `task-w15-j` section above) ->
`675219f` (merge task-w14-k). No commits code-bearing per DEC-114 exist
between `675219f` and worktree HEAD (`067a5cc`), confirming `675219f`
remains the newest code-bearing sha, matching this task's expectation.

Per DEC-128 confirm-else-run: a walkthrough section at this sha with a
valid `RESULT: PASS` already exists — `task-w15-h — walkthrough @
675219f` (above), which cites sha `675219f`, records the DEC-127
six-marker preflight (all six markers present), covers J1-J12, and ends
`RESULT: PASS`. No newer code-bearing commits exist since, so that
result still applies. Per DEC-128, this is a short confirm; no servers
started, no gate re-run.

RESULT: PASS

## 2026-08-10 task-w16-d — spec-audit confirm @ 675219f

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

An existing spec-audit section at this exact sha with a valid `RESULT:
PASS` already exists: `## 2026-08-10 task-w15-j — spec-audit @
675219f` (above in this file). It cites the sha with a first-parent
diff derivation, runs the six-marker DEC-127 preflight with file:line
for each marker (`src/routes/tasks.ts` DEC-120 block, `src/server/
repo/portal-edit.ts` `LOCKED_SPEAKER_FIELDS`, `src/routes/comms.ts`
`requireFullMatch`, `src/routes/review.ts` DEC-123 conflict guard,
`src/forms/validate.ts` `MAX_TEXT_LENGTH`, `scripts/perf-seed.ts`
`kind: "rating"` — all six present), and records file:line closure
evidence plus test-file names (34 tests, 6 files) for all five
wave-14 defects (DEC-120..124), plus a DEC-108..111 spot-check with no
drift. Per DEC-128, this confirms rather than re-running the full
audit.

RESULT: PASS

## 2026-08-10 task-w16-c — perf-smoke confirm @ 675219f

DEC-128 confirm-else-run: re-derived DEC-114 newest code-bearing sha —
first-parent walk from main tip `067a5cc` ("scribe wave 16"): that
commit and `2280419` (merge task-w15-j) and `21ea856` (scribe wave 15)
are all bookkeeping-only (docs/decisions/field-guide, no `src`/`scripts`
diff); first-parent lands on `675219f` ("merge task-w14-k"), which
touches `src/routes/portal/edit.tsx`, `src/server/repo/portal-edit.ts`,
and test files — code-bearing. Confirms `675219f` as expected.

A valid perf-smoke section at this exact sha already exists: `task-w15-i
— perf-smoke @ 675219f` (line ~2739 of this file), citing the sha,
recording the DEC-127 six-marker preflight (including
`scripts/perf-seed.ts:273` `kind: "rating"`, the DEC-125 fix) as all
present in-tree before running anything, and ending `RESULT: PASS` with
all DEC-088/089/104/105 probes green, explicitly including the
evaluation rating PUT probe (9.1ms, `ok`) confirming DEC-125 closure. No
re-run needed per DEC-128 confirm-else-run; server was not started for
this confirm.

RESULT: PASS

## 2026-08-10 task-w15-k — triage-closure @ 675219f

DEC-069 scope-5 triage-closure gate, chained behind task-w15-i's
perf-smoke PASS per DEC-127(4). Code-frozen (DEC-077): the only file
this task modifies is this log (append-only, DEC-068).

**(1) Sha re-derivation (DEC-114).** Worktree cut from `main` tip
`067a5cc` ("scribe wave 16"). First-parent walk back: `067a5cc`
(`decisions/DEC-128.md`, `docs/verification-log.md`,
`field-guide/index.md`, `src/decisions.ts` pure string-constant
append), `2280419` ("merge task-w15-j", diff = `docs/
verification-log.md` only), `ef788c2` ("merge task-w15-h", diff =
`docs/verification-log.md` only), `472dc3a` ("merge task-w15-g", diff
= `docs/verification-log.md` only), `21ea856` ("scribe wave 15", diff
= `decisions/DEC-127.md`, `field-guide/index.md`,
`src/decisions.ts` string-constant append) — every one of these five
commits' first-parent diff falls entirely inside DEC-114's bookkeeping-
exclusion set. **No code-bearing commit has landed after `675219f`**
("merge task-w14-k"); it remains the newest code-bearing sha, matching
DEC-127's expectation exactly. (`task-w15-i`'s own commit `0fde24c` is
an ancestor of `HEAD` — folded into `2280419`'s merge — and is itself
log-only, `docs/verification-log.md` only, consistent with this
finding.)

**(2) Sibling gate sections at `675219f`.** All four are present on
`main` at this sha and end `RESULT: PASS`: `task-w15-g — build+test @
675219f` (line 2495, 110 files/1064 tests, 0 failures), `task-w15-h —
walkthrough @ 675219f` (line 2547, all six `WALKTHROUGH_AREAS` PASS),
`task-w15-j — spec-audit @ 675219f` (line 2608, five wave-14 defects +
DEC-108..111 spot-check, no drift), `task-w15-i — perf-smoke @
675219f` (line 2739, all 10 timed checks `ok`, p95 well under the
150ms budget). Per DEC-127(3), since all four are merged and green, no
spot-verification substitution is needed; ran `npm test --silent`
directly in this worktree as a cheap independent confirmation of the
build+test scope anyway: **110 test files, 1064 tests, all passed, 0
failed, 0 skipped** — matches `task-w15-g`'s figures exactly, no drift.

**(3) Every prior OPEN-ITEM/FAIL section, closed at `675219f` with
fix + test evidence:**

- **task-w3-c** (walkthrough scale step6, 400 on portal-edit) and
  **task-w4-b** (same defect, independently reproduced) — root cause:
  `scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` omitted
  `trackIds` from the portal-edit FormData. **Fix:**
  `scripts/walkthrough/scale.ts` (DEC-094/095/096, landed `b638f75`).
  **Runtime test evidence:** `task-w15-h — walkthrough @ 675219f`
  (this file, line 2547) scale module step6 runs as part of the
  all-six-areas PASS; DEC-094/095/096 previously confirmed by
  `task-w5-c`'s walkthrough PASS.
- **task-w3-d** (perf-smoke 301-id cap probe unreachable), **task-w4-c**
  (same), **task-w4-e** (OPEN ITEMS: 2 — both of the above) — root
  cause: `src/lib/pagination.ts`'s 200-row clamp vs. a single
  `perPage=301` request. **Fix:** `src/lib/pagination.ts`/
  `scripts/perf-smoke.ts` DEC-094/095 `@200/page` pagination (landed
  `b638f75`). **Test evidence:** `task-w15-i — perf-smoke @ 675219f`
  (line 2739) DEC-089/DEC-080 cap probe row: `ok`; DEC-094/095
  `@200/page` pagination re-confirmed in `task-w11-d`'s section (line
  1605) and unchanged since (`src/lib/pagination.ts` untouched by any
  wave-12..14 commit per `task-w15-j`'s file-touch audit, line 2644).
- **task-w7-c**, **task-w7-e** (OPEN ITEMS: 1), **task-w8-b**,
  **task-w8-d** (OPEN ITEMS: 1) — `GET /api/v1/events/:id/overview`
  500s (`D1_ERROR: too many SQL variables`) from an unbounded
  `inArray(..., placedIds)` participant fan-out at DEC-088 perf scale.
  **Fix:** `src/server/repo/overview.ts:170-177` batches the fan-out
  via `for (const batch of chunkIds(placedIds))` (DEC-104,
  `src/lib/chunk.ts`'s `ID_CHUNK_SIZE=90`), confirmed present at
  `675219f` by this task's own read (`src/server/repo/overview.ts:11`
  imports `chunkIds`; `:170-177` batches). **Test evidence:**
  `test/chunk-sweep-overview.test.ts` (source-scan guard asserting the
  chunked pattern, not a raw `inArray` over the unbounded list) plus
  runtime confirmation in `task-w15-i — perf-smoke @ 675219f` (line
  2739): "event overview" p95 11.5ms, 200 on all 35 requests — the
  D1-too-many-variables failure mode does not reproduce.
- **task-w11-d** (OPEN ITEMS: 1), **task-w12-c**/**task-w12-e**
  (OPEN ITEMS: 1), **task-w13-c**/**task-w13-d** (OPEN ITEMS: 1) — the
  `rating PUT` perf-smoke check 400s ("criterion \"overall\" has no
  options defined") because `scripts/perf-seed.ts`'s seeded
  `criteria_json` omitted the `kind: "rating"` discriminant required
  by `src/domain/evaluation.ts`'s `EvaluationCriterionDef` union.
  **Fix:** DEC-125, `scripts/perf-seed.ts:273` —
  `criteria_json: JSON.stringify([{ id: "overall", label: "Overall",
  kind: "rating", weight: 1 }])`, confirmed present at `675219f` by
  direct read in this worktree. **Test evidence:** the green
  `task-w15-i — perf-smoke @ 675219f` section (line 2739): "rating PUT"
  row `ok` at 9.1ms, and its own D1 spot-check confirming
  `evaluation_plan.criteria_json` for `seed_perf_event` carries
  `"kind":"rating"`. (`test/chunk.test.ts` and sibling `chunk-sweep-*`
  files do not cover this path; the perf-seed fix's evidentiary trail
  is the green perf-smoke *run itself*, per this task's brief.)

**(4) Five wave-14 review-lens defects (DEC-120..124), each closed
with file:line + dedicated test file, all independently re-confirmed
by `task-w15-j — spec-audit @ 675219f` (line 2608) and by this task's
own `npm test --silent` run:**

1. Task-assign cross-org IDOR (DEC-120): `src/routes/tasks.ts:235-247`
   — `test/tasks-assign-org-scope.test.ts` (3 tests).
2. Portal-edit locked speaker fields / read-only email (DEC-121):
   `src/server/repo/portal-edit.ts:123-125,184-192`,
   `src/routes/portal/edit.tsx:74-84,155-167` —
   `test/portal-edit-speaker-locked.test.ts` (5 tests) and
   `test/portal-edit-speaker-locked-route.test.ts` (3 tests).
3. Compose full-set id-drop guard (DEC-122): `src/routes/comms.ts:
   302-305,336-339` (`requireFullMatch`) —
   `test/compose-full-set.test.ts` (6 tests).
4. Plan criteria/scale immutability after evaluations exist (DEC-123):
   `src/routes/review.ts:224-238` —
   `test/plan-criteria-guard.test.ts` (7 tests).
5. Server-side answer length caps (DEC-124): `src/forms/validate.ts:
   8-9,59-61` (`MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH`) —
   `test/answer-length-caps.test.ts` (10 tests).

**(5) PLANNER: / undispositioned-FAIL final sweep.** `git log
--format='%h %B' 675219f..HEAD | grep -n 'PLANNER:'`: zero hits.
`grep -n '^RESULT: FAIL' docs/verification-log.md`: all 13 hits (lines
422, 451, 586, 627, 699, 973, 1050, 1200, 1298, 1696, 1845, 2101, 2418,
2489 — the w3-c/d, w4-b/c/e, w7-c/e, w8-b/d, w11-d, w12-c/e, w13-c/d
clusters) accounted for and closed above; no `RESULT: FAIL` line falls
outside these two named clusters (walkthrough-scale/perf-cap-probe;
overview.ts-scale; perf-seed-rating-discriminant). `docs/
eval-findings.md` re-read in full: still asserts zero live findings,
unchanged since `task-w13-d`'s read.

**(6) Full DEC-069 five-scope predicate state @ `675219f`:**
build+test PASS (`task-w15-g`), walkthrough PASS (`task-w15-h`),
perf-smoke PASS (`task-w15-i`), spec-audit PASS (`task-w15-j`), and
this triage-closure section closes every carried-forward open item
with file:line + test evidence. All five DEC-069 scopes are green at
a single newest code-bearing sha with no undispositioned defect
remaining.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w16-e — triage-closure confirm @ 675219f

DEC-128 confirm-else-run. Sha re-derivation (DEC-114): branched from
`main` tip `40c49f6` ("merge task-w15-k"); its diff against `334dc4e`
("merge task-w16-c") touches only `docs/verification-log.md` (135
insertions, the `task-w15-k` section itself) — bookkeeping-only per
DEC-114's exclusion set. All commits between `334dc4e` and `675219f`
(the six wave-16 gate confirms `task-w16-a`..`task-w16-d` plus their
merges) are likewise log-only, already established by those tasks'
own sections above. `675219f` ("merge task-w14-k") remains the newest
code-bearing sha, matching this task's expectation.

Note: this task branched twice. On the first attempt, `task-w15-k`
(triage-closure @ `675219f`) had not yet merged to `main` — a
merge-ordering race under DEC-127(4), since `task-w15-k` is one of the
named sibling gates (`w15-g..k`). Per DEC-127(4) this task spot-verified
`task-w15-k`'s scope directly rather than treating it as an open item:
independently re-read the file:line evidence for all nine known review
findings it cites (task-assign cross-org IDOR `src/routes/tasks.ts:
235-247`; portal-edit locked fields `src/server/repo/portal-edit.ts:
120-125,184-192`; compose full-set guard `src/routes/comms.ts:302-305,
336-339`; plan criteria/scale immutability `src/routes/review.ts:
224-238`; answer length caps `src/forms/validate.ts:8-9,59-61`; overview
D1-batching `src/server/repo/overview.ts:11,170-177`; perf-seed
`kind:"rating"` `scripts/perf-seed.ts:273`; pagination 200-row clamp
`src/lib/pagination.ts:6`) — all confirmed present and matching the
cited evidence exactly, no drift. Independently re-ran `npm run build`
(clean) and `npm test --silent`: **110 test files, 1064 tests, all
passed, 0 failed** — matches `task-w15-k`'s cited figures exactly.
Re-read `docs/eval-findings.md` in full: still states zero live
findings. Re-counted `grep -n '^RESULT: FAIL' docs/verification-log.md`:
14 hits (lines 422, 451, 586, 627, 699, 973, 1050, 1200, 1298, 1696,
1845, 2101, 2418, 2489), matching `task-w15-k`'s enumeration exactly
(all fall inside its three named closed clusters: walkthrough-scale/
perf-cap-probe, `overview.ts` D1 fan-out, perf-seed rating
discriminant). No undispositioned FAIL or open item found.

By the time this re-derivation completed, `task-w15-k` had merged to
`main` (`40c49f6`), so the spot-verification above is now also a
direct confirmation of an in-tree, on-`main` section: `task-w15-k —
triage-closure @ 675219f` (this file, line 2914), which ends `OPEN
ITEMS: 0` / `RESULT: PASS` and cites the correct sha. Per DEC-128,
this task's independent spot-check corroborates that section rather
than re-running the full DEC-069 five-scope predicate a third time.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w17-a — triage-closure @ 675219f

DEC-128 confirm-else-run, DEC-129-guarded. Sha re-derivation (DEC-114): first-parent walk from `main` tip `36351c9` back through `42db9f9`/`40c49f6`/`334dc4e`/`5916788`/`cfab488`/`3ef7403`/`067a5cc`/`2280419`/`ef788c2`/`472dc3a`/`21ea856` confirmed each commit's first-parent name-only diff (`git diff --name-only <c>^..<c>`) touches only `docs/`, `decisions/`, `field-guide/`, `src/decisions.ts` — bookkeeping per DEC-114's exclusion set; `675219f` ("merge task-w14-k") remains the newest code-bearing sha. Per DEC-129's explicit warning, the `## 2026-08-10 task-w16-e — triage-closure @ 5692a6d` section (this file, earlier) was **not** used as a confirm source — `git merge-base --is-ancestor 675219f 5692a6d` fails, marking it a prior-campaign homonym. Instead, searched for a section citing a sha S with `git merge-base --is-ancestor 675219f S` true and `OPEN ITEMS: 0`: found `task-w15-k — triage-closure @ 675219f` (this file, line 2914) — S equals `675219f` exactly, so the ancestor check passes trivially (`git merge-base --is-ancestor 675219f 675219f` → true), and the section ends `OPEN ITEMS: 0` / `RESULT: PASS`, covering all five DEC-069 scopes (build+test/walkthrough/perf-smoke/spec-audit/triage-closure itself) plus the DEC-120..125 wave-14 defect closures and the perf-seed `kind:"rating"` closure (`scripts/perf-seed.ts:273`), with a PLANNER:-marker sweep (`675219f..HEAD`, zero hits) and full `RESULT: FAIL` accounting (all 13 hits pre-existing and closed). The subsequent `task-w16-e — triage-closure confirm @ 675219f` section (line 3049) independently re-verified the same sha with its own build+test run and eval-findings re-read, also `OPEN ITEMS: 0` / `RESULT: PASS`. No new commits landed between `675219f` and `36351c9` that touch product code (confirmed above), so no re-run of the full gate is warranted per DEC-128; this task's own worktree build (`npm run build`) and targeted `npm test --silent` pass ran clean as a cheap independent spot-check, matching the cited figures. No servers started.
OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w17-b — triage-closure @ 675219f

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

Guard check: `git merge-base --is-ancestor 675219f S` for candidate
prior sections — `task-w15-k — triage-closure @ 675219f` (this file,
line 2914) and `task-w16-e — triage-closure confirm @ 675219f` (line
3049) both pass (`675219f` is its own ancestor) and both end `OPEN
ITEMS: 0` / `RESULT: PASS`. The first-campaign homonym `## task-w16-e
— triage-closure @ 5692a6d` (line 294) was identified and excluded
per DEC-129's warning — its header sha `5692a6d` is a *different*,
unrelated sha from an earlier campaign, not an ancestor-guard pass for
this task's `675219f` expectation.

Per DEC-128, since a valid confirmable section already exists on
`main` (`task-w15-k`, corroborated by `task-w16-e`'s independent
spot-check), this task appends a short confirm rather than re-running
the full DEC-069 five-scope predicate a fourth time. No live-server
spot check was needed for this confirm; had one been required it
would have used port 8872 only, per this task's brief.

Six-marker preflight spot-read (DEC-127), each anchor confirmed
present at the cited location in this worktree: `src/routes/
tasks.ts:235` (task-assign org-scope check), `src/server/repo/
portal-edit.ts:123-125` (locked-field guard), `src/routes/comms.ts:
30/303/337` (`requireFullMatch` full-set guard), `src/routes/
review.ts:224` (plan criteria/scale immutability), `src/forms/
validate.ts:8` (`MAX_TEXT_LENGTH`), `scripts/perf-seed.ts:273`
(`kind: "rating"` discriminant) — all six markers match the evidence
already cited in `task-w15-k`'s section, no drift.

`git log --format='%h %B' 3b7ed3d..HEAD | grep -n 'PLANNER:'`: one
hit, a prose self-reference inside an earlier commit message
("PLANNER: harvest over d12eb25..HEAD: 2 hits, both prose
self-references, no live directives") — not a live PLANNER directive,
consistent with prior sections' findings.

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

STEP 2 (DEC-135 behavioral preflight of DEC-130..133, all four markers
confirmed present in-tree, not just void-import lines):
- DEC-130: `src/domain/schedule.ts:36` defines `findConflicts`, and
  `autoSchedule`'s incremental placement loop (comment at line 121-122)
  builds occupancy indexes instead of re-running `findConflicts` over
  the full trial set per candidate — marker present.
- DEC-131: `src/mail/ics.ts:39-47` `escapeText` normalizes `\r\n`->`\n`
  and lone `\r`->`\n` *before* backslash/`;`/`,`/`\n` escaping — marker
  present.
- DEC-132: `src/routes/public/submit.tsx:474-479` file-upload loop is
  gated `if (cleaned[field.id] !== "pending") continue;`, and
  `cleaned[field.id]` only reaches `"pending"` for fields that pass
  `isVisible` (line 415 skip-if-hidden) during validation — hidden
  fields never get uploaded/persisted — marker present.
- DEC-133: `src/server/repo/submissions/status.ts:207-210` computes
  `missing = requested.filter(id => !foundIdSet.has(id))` and throws
  `ApiError("invalid", ...)` naming the missing ids *before* the bulk
  status mutation — marker present.

All four markers present -> proceeding to full triage (no FAIL-and-stop).

STEP 3 sweep:
(a) `docs/eval-findings.md` re-read: "Round 1 ... fully dispositioned.
Zero open findings remain in this file." No open items.
    `docs/verification-log.md` sections citing a sha S with
    `git merge-base --is-ancestor 675219f S` true: all such sections
    (`task-w15-*`, `task-w16-*`, `task-w17-a`, `task-w17-b`) cite
    `675219f` exactly and end `OPEN ITEMS: 0` / `RESULT: PASS` — but
    per DEC-134 every `@ 675219f` gate section is now VOID (wave-18
    reopened code); they are cited here only as historical confirm
    chain, not as current evidence. DEC-129 homonym guard applied: the
    earlier `## task-w16-e — triage-closure @ 5692a6d` (line 294,
    first-campaign) and `## task-w4-e`/`task-w5-*`/`task-w7-*`/
    `task-w8-*`/`task-w11-*`/`task-w12-*`/`task-w13-*` sections all
    cite pre-`675219f` shas — excluded from consideration, no live
    directives found in any (all their own RESULT lines are PASS,
    already closed at the time).
(b) Commits `675219f..8c7f479` first-parent classified: `472dc3a`,
    `ef788c2`, `2280419` (w15 g/h/j), `067a5cc`, `3ef7403`, `cfab488`,
    `5916788`, `334dc4e`, `40c49f6`, `42db9f9` (w16 scribe+a-e),
    `36351c9`, `4a9a74f`, `cf8154c` (w17 scribe+a/b) — all bookkeeping
    (docs/decisions/field-guide/verification-log only, confirmed by
    prior sections' own stat output and independently spot-checked
    here). `7162750` (scribe wave 18) bookkeeping. `b5532df`
    (merge task-w18-b, ics.ts), `3627020` (merge task-w18-a,
    schedule.ts), `9f51825` (merge task-w18-d, status.ts), `8c7f479`
    (merge task-w18-c, submit.tsx) — all four code-bearing, matching
    DEC-130..133 fixes exactly, no other code-bearing commits found.
(c) Dedicated tests run directly in this worktree:
    `npx vitest run test/schedule.test.ts test/ics-crlf-escaping.test.ts
    test/status-bulk-full-match.test.ts test/submit-hidden-file-field.test.ts`
    (submit-visibility test name confirmed via `git show --stat
    8c7f479`) -> **4 files / 23 tests, ALL PASS**, 0 failures. Full
    build (`npm run build`) and full suite (`npm test --silent`) also
    run clean: **113 files / 1076 tests, ALL PASS**, 0 failures — no
    fixes required, log-only run per DEC-077/135.
(d) Reviewer concern re commit `db8bcdb` (DEC-121 "test patched to
    pass") re-confirmed CLOSED: `test/portal-edit-speaker-locked-route.
    test.ts:122-124` asserts `expect(call[1]).toBe("s1")`,
    `expect(call[2]).toBe("c1")`, and reads `cleaned` from `call[3]` —
    real positional-argument assertions against the 5-arg
    `saveSubmissionEdits` signature, not a stubbed/loosened check.
    Not reopened.
(e) DEC-127 six-marker spot check (spec-audit scope, no sibling
    `task-w19-*` build+test/walkthrough/perf-smoke/spec-audit section
    present yet on `main` at this sha — spot-verified directly, no
    live server needed): `src/routes/tasks.ts:235-236` (DEC-120
    cross-org contactIds guard), `src/server/repo/portal-edit.ts:
    120-125` (DEC-121 locked-field prefill-from-contact), `src/routes/
    comms.ts:30,303,337` (`requireFullMatch` DEC-122 full-set guard),
    `src/routes/review.ts:222-226` (DEC-123 criteria/scale
    immutability once evaluations exist), `src/forms/validate.ts:8`
    (`MAX_TEXT_LENGTH`, DEC-124), `scripts/perf-seed.ts:271-275`
    (`kind: "rating"` discriminant) — all six present, no drift from
    prior sections' evidence. No live-server spot-check was needed
    (build+test alone plus targeted tests fully covered the four
    review-lens defects); port 8883 not used.

No unresolved PRODUCT defects found. No merge-ordering races encountered
(this worktree's `main` tip already includes all four w18 merges).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w19-d — spec-audit @ 8c7f479

DEC-069 scope-4 spec-audit gate at the post-wave-18 sha, DEC-134/135
third-barrier re-verification, log-only lane (this file is the only
modification; no fix applied per DEC-077/135).

**STEP 1 — sha re-derivation (DEC-114).** First-parent walk from `main`
tip `9038b5c` ("scribe wave 19"): its diff (`decisions/DEC-135.md`,
`field-guide/index.md`, `src/decisions.ts` — a single pure
string-constant append for `DEC_135`) is entirely inside the DEC-114
bookkeeping-exclusion set, so `9038b5c` is not code-bearing. Its
first parent `8c7f479` ("merge task-w18-c") diffs
`src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` — outside the exclusion set,
so `8c7f479` is code-bearing and is the newest code-bearing sha.
`git merge-base --is-ancestor 675219f 8c7f479` exits 0 (confirmed via
the ancestor check against the branch tip, which contains `8c7f479`)
— DEC-129 satisfied.

**STEP 2 — DEC-130..133 behavioral preflight (DEC-135), re-executed
against the tree, not copied from any prior section:**
- DEC-130 `src/domain/schedule.ts`: `autoSchedule` (line 108) builds
  `roomIndex`/`speakerIndex` Maps (lines 122-146) from `existing`
  placements and looks candidates up via `roomIndex.get`/
  `speakerIndex.get` inside the placement loop (lines 168-183) — no
  call to `findConflicts` anywhere inside `autoSchedule`; `findConflicts`
  (line 36) is only called from `scheduleSummary` (line 79), a separate
  exported function. Marker present.
- DEC-131 `src/mail/ics.ts`: `escapeText` (lines 39-47) runs
  `.replace(/\r\n/g, "\n")` then `.replace(/\r/g, "\n")` before any
  other escaping — CR is normalized to `\n` pre-escape, matching the
  DEC-131 fix description. Marker present.
- DEC-132 `src/routes/public/submit.tsx`: the validation-time file
  loop (lines 410-425) starts `if (!isVisible(field, answers))
  continue;` before touching `fileAnswers`/`fileErrors`/`answers`; the
  post-submission upload loop (lines 471-479) starts `if
  (cleaned[field.id] !== "pending") continue;`, and a hidden field
  never reaches the `"pending"` assignment in the first loop, so it's
  skipped here too — zero R2 put, zero file row, zero answer-row
  mutation for a hidden field. Marker present.
- DEC-133 `src/server/repo/submissions/status.ts`:
  `updateSubmissionStatuses` (line 190) computes `requested`/
  `foundIdSet`/`missing` (lines 224-227) and throws `ApiError("invalid",
  ...)` (lines 228-231) strictly before the mutation loops (lines
  237-266) — no `db.update`/`db.insert` call precedes the guard.
  Marker present.

All four markers present — proceeding per DEC-135 (none absent, so no
early FAIL/STOP).

**STEP 3 — full static SPEC §8/§9 audit, re-executed at the current
tree (methodology mirrors task-w15-j's structure; every grep/read below
was re-run, none copied):**

*§8 authz + visibility + CSRF + rate limits + secrets:*
- Every route sub-app under `src/routes/*.ts` (`agenda.ts`, `comms.ts`,
  `tasks.ts`, `review.ts`) gates handlers with `requireOrganizer` (and
  `review.ts` additionally uses an inline `requireReviewerOrOrganizer`
  helper for reviewer-or-organizer endpoints); `files.ts` and
  `portal/*` use inline `requireAuth`/scope-check helpers
  (`authzSubmissionWrite` in `files.ts:53-69`, checked against
  `getSubmissionScope`) implementing organizer-org-match OR
  participant-speaker-match — no route left unauthenticated except
  intentionally-public ones under `src/routes/public/` and
  `src/routes/public.tsx`.
- Public/embed visibility filtering: `src/server/repo/public.ts:38,239`
  still gate on `inArray(schema.participant.inviteStatus, ["none",
  "accepted"])` at both the shared query and `hydrateSessions`
  speaker-hydration (unchanged from prior sections, re-confirmed present
  in this tree).
- CSRF: `src/server/middleware.ts:233-237` `csrfJson` requires header
  `x-chq-csrf: 1` UNLESS `c.var.auth?.viaBearer` is true (Bearer `chq_`
  token clients exempted per DEC-027, since they can't be
  cross-site-forged); `csrfForm` (lines 241-254) enforces the
  double-submit `chq_csrf` cookie-vs-hidden-field match for HTML form
  posts. Every mutating route in the four sub-apps above passes
  `csrfJson` after its authz middleware (confirmed via grep — every
  `.post/.put/.patch/.delete` call site includes `csrfJson` or
  `csrfForm` in its handler chain).
- Rate limits: `src/routes/auth.tsx:25-27,113-127,180-189` enforces
  `AUTH_RATE_LIMIT_MAX=20` per `AUTH_RATE_LIMIT_WINDOW_SECONDS=900` on
  both `/login` and `/claim`, returning 429 with a generic message on
  exceedance.
- Secrets-free config: `wrangler.jsonc` declares only local D1
  (`database_id: "local"`), local R2, local KV, and `vars: {DEV_MODE:
  "1"}` — no API key/secret binding anywhere in the file; `grep -rn
  "process.env\|API_KEY\|SECRET" src/ wrangler.jsonc` (excluding tests)
  returns zero hits.

*§9 invariants:*
- Fail loudly: `ApiError` (src/server/http.ts:26-37) is the sole error
  vocabulary; no `catch` blocks swallowing errors were found in the
  four DEC-130..133-touched files or the route files scanned above.
- Status changes never auto-email: `src/server/repo/submissions/
  status.ts` has no mail-related import (grep for `^import` lines
  matching `mail` returns zero hits in this file, matching its own
  file-header comment asserting the same, and matching the
  `test/api-submissions.test.ts` source-scan test referenced in its
  header). Files that DO import `makeMailer`/`mail/render`
  (`tasks.ts`, `review.ts`, `comms.ts`) do so for explicit
  reminder/compose-send actions, not automatic status-change side
  effects.
- Error envelope: `errorEnvelope` (src/server/http.ts:39-41) returns
  exactly `{error: {code, message, fields?}}`.
- List envelope: every list endpoint checked returns `{items, total,
  page, perPage}` — e.g. `src/routes/api/email-log.ts:48`,
  `src/routes/review.ts:380,441,471`, `src/routes/comms.ts:61`,
  `src/routes/api/contacts.ts:129,288` — all match the shape exactly
  (single-page endpoints synthesize `page:1`/`perPage:
  items.length||1`, which is the documented convention, not a
  deviation).
- Append-only migrations: `migrations/*.sql` through `0009_review_
  rounds.sql` — `grep -n "DROP" migrations/*.sql` returns zero hits;
  no migration file removes a column or table.
- Pure-core import discipline (DEC-002): `grep -rln 'from "node:\|
  cloudflare:' src/{auth,domain,forms,mail,lib}` returns zero hits —
  none of the five pure-core directories imports node:/cloudflare
  anything.

No new SPEC §8/§9 drift found anywhere in this run.

**STEP 4 — wave-18-file regression audit (already folded into STEP 2's
per-file evidence above; summarized here per the task's explicit ask):**
`schedule.ts` — greedy first-fit ordering (duration desc, then track)
and all four exported signatures (`findConflicts`, `scheduleSummary`,
`autoSchedule`, `buildIcsEvent` n/a — that's ics.ts) are unchanged from
the DEC-010 doc comment; `ics.ts` — `\r` appears only in `\r\n`
line-join/fold separators (lines 72, 132) and the filename-sanitizer's
strip pattern (line 106), never emitted raw inside a field value;
`submit.tsx` — confirmed zero-trace hidden-field handling (STEP 2);
`status.ts` — guard is atomic (missing-id check precedes both mutation
loops; nothing in the chunk-read/select phase mutates state) and
`{updated: rows.length}` is truthful since `rows` only contains ids
that passed the `missing.length > 0` all-or-nothing guard, so a
successful return always reflects exactly the mutated count.

STEP 5 — no gap found in preflight, static audit, or regression audit.

RESULT: PASS

## 2026-08-10 task-w19-c — perf-smoke @ 8c7f479

STEP 1: DEC-114 newest code-bearing sha on `main`, first-parent walk from
`9038b5c` (branch tip, "scribe wave 19"): `9038b5c` itself touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and a pure single-line
constant append to `src/decisions.ts` (`export const DEC_135 = ...`) —
bookkeeping, excluded per DEC-114. The next first-parent commit,
`8c7f479` ("merge task-w18-c"), touches `src/routes/public/submit.tsx`
and `test/submit-hidden-file-field.test.ts` — code-bearing. Adopted sha:
`8c7f479`.

Ancestor guard: `git merge-base --is-ancestor 675219f 8c7f479` exits 0 —
PASS.

STEP 2 (DEC-135 behavioral preflight, all four DEC-130..133 fix markers
read directly from source at this sha):

- DEC-130 (`src/domain/schedule.ts`): `autoSchedule` uses incremental
  per-room/per-speaker occupancy interval indexes (comment at line 121:
  "Incremental occupancy indexes (DEC-130): avoid re-running
  findConflicts"); grepped the body of `autoSchedule` for `findConflicts`
  and `[...placed, candidate]` — zero matches inside the function.
  `findConflicts` still exists as a separately-exported helper (used
  elsewhere, e.g. line 79) but is never called from `autoSchedule`.
  Marker PRESENT.
- DEC-131 (`src/mail/ics.ts`): `escapeText` (lines 39-47) normalizes
  `\r\n` -> `\n` and lone `\r` -> `\n` as its first two `.replace()`
  calls, before the backslash/semicolon/comma/newline escaping. Marker
  PRESENT.
- DEC-132 (`src/routes/public/submit.tsx`): file-field processing loop
  is gated on `if (!isVisible(field, answers)) continue;` (line 415)
  before ever assigning the `"pending"` placeholder, and the later
  upload-consuming pass at line 479 only proceeds when
  `cleaned[field.id] === "pending"` (skipping hidden fields, which never
  got the placeholder). Marker PRESENT.
- DEC-133 (`src/server/repo/submissions/status.ts`): `updateSubmissionStatuses`
  computes `missing` (requested ids not found for this event) and
  `throw new ApiError("invalid", ...)` at line 209, strictly before the
  mutation loop (`for (const row of rows) { ... }` starts after the
  throw, at line 213). Marker PRESENT.

All four markers present and pre-mutation/pre-loop as required — preflight
PASS, proceeding to the live run.

STEP 3: `lsof -ti:8882 | xargs -r kill -9` (nothing running). `rm -rf
.wrangler/state` — none present (fresh worktree). `npm run db:migrate`:
10 migrations `0000`..`0009` applied clean. `npm run seed`: required
first (per the w16-c/w18 precedent — `perf:seed` alone seeds only
synthetic `seed_perf_`-prefixed rows, not the login-capable
`sbek-organizer@example.com` fixture identity `perf-smoke.ts` logs in
as); ran clean, 6 R2 objects uploaded. `npm run perf:seed`: DEC-088 scale
(2,000 submissions / 300 accepted+placed, 12 reviewers), all SQL batches
`"success": true`. `npx wrangler dev --port 8882` started in background,
`GET /` 200 OK, ready log observed.

`PERF_URL=http://localhost:8882 npm run perf:smoke` — exit 0 ("perf:smoke
OK"). Full p95 table (budget 150ms, all `ok`):

```
submissions list (page 1)            26.0ms  ok
submissions list (q=Kubernetes)      26.2ms  ok
submission detail                    44.1ms  ok
event overview                       27.2ms  ok
organizer agenda (300 accepted)      37.8ms  ok
public sessions page                 19.4ms  ok
public agenda                        21.1ms  ok
schedule.ics 150 ids                 33.8ms  ok
plan progress (12 reviewers)         17.9ms  ok
rating PUT                            9.2ms  ok
```

DEC-080 cap assertion (301-id `schedule.ics` -> exactly 400, run untimed
before the measured loop, `perf-smoke.ts:211-219`): the script throws
synchronously on any non-400 response, so the clean `perf:smoke OK` exit
confirms this assertion passed (301st synthetic nonexistent id rejected
with 400 as required by the DEC-080 cap).

STEP 4: DEC-130 scale spot-check, run AFTER the timed loop per the task
brief. Logged in as the same seeded fixture organizer
(`docs/fixtures/sample-data.json` `identities.organizer`, same
GET-csrf-cookie / POST-form / `chq_session` flow as `perf-smoke.ts`'s
`login()`), then `POST /api/v1/events/seed_perf_event/agenda/auto-schedule`
(route at `src/routes/agenda.ts:101`, `requireOrganizer` + `csrfJson` ->
sent `x-chq-csrf: 1` header per `CSRF_HEADER` in `src/auth/cookies.ts`,
JSON body `{}` so all four `AutoScheduleBody` fields fall back to
`DEFAULT_AUTO_SCHEDULE_PARAMS`) against the perf-seeded event (2,000
submissions / 300 accepted, matching the DEC-088 scale). Result:
`STATUS: 200`, `DURATION_MS: 40` — success, well under any CPU-time/
timeout ceiling, no error.

Server stopped (`lsof -ti:8882 | xargs -r kill -9`) after the run.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w19-b — walkthrough @ 8c7f479

Wave-19 five-gate battery (DEC-135), walkthrough scope, at fresh port
8881.

**STEP 1 — sha derivation (DEC-114/DEC-129).** Worktree cut from `main`
tip `9038b5c` ("scribe wave 19"). First-parent walk: `9038b5c`'s diff
(`git diff --name-only 9038b5c^ 9038b5c`) touches only
`decisions/DEC-135.md`, `field-guide/index.md`, and `src/decisions.ts`
— checked the `src/decisions.ts` hunk directly and it is a single
pure `export const DEC_135 = "...";` string-constant append, no other
change — so `9038b5c` falls inside DEC-114's bookkeeping-exclusion
set and is not code-bearing. Its first parent `8c7f479` ("merge
task-w18-c") touches `src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` — code-bearing. `8c7f479` is
therefore the newest code-bearing main sha.
`git merge-base --is-ancestor 675219f 8c7f479` exits 0 — ancestor
check passes (DEC-129).

**STEP 2 — behavioral preflight of DEC-130..133 (DEC-135, marker
alone insufficient).** All four read directly from the
`8c7f479`-identical worktree tree (the only diff between `9038b5c` and
`8c7f479` is the excluded bookkeeping above, so HEAD's working tree is
behaviorally identical to `8c7f479` for this check):
- DEC-130 (`src/domain/schedule.ts`): `autoSchedule` builds
  `roomIndex`/`speakerIndex` incremental occupancy maps from
  `existing` up front and checks candidate placements against those
  maps via an `overlaps()` helper — no call to `findConflicts` and no
  `[...placed, candidate]` trial-array pattern anywhere in the
  function body. Marker present.
- DEC-131 (`src/mail/ics.ts` `escapeText`, lines 39-47): the
  replace-chain order is `\r\n`→`\n`, then bare `\r`→`\n`, THEN the
  backslash/semicolon/comma/newline escaping passes — CR is fully
  normalized to `\n` before any escaping touches the string. Marker
  present.
- DEC-132 (`src/routes/public/submit.tsx`): the file-validation loop
  (~line 415) has `if (!isVisible(field, answers)) continue;` before
  any upload validation or `answers[field.id] = "pending"` write; the
  post-submission upload loop (~line 479) has
  `if (cleaned[field.id] !== "pending") continue;` gating every R2
  put / file-row insert. Marker present.
- DEC-133 (`src/server/repo/submissions/status.ts`, ~line 207): builds
  `missing = requested.filter(id => !foundIdSet.has(id))` and throws
  `ApiError("invalid", ...)` naming the missing ids BEFORE the
  per-row `changeStatus`/UPDATE loop that follows. Marker present.

All four markers present and behaviorally verified — preflight PASS,
proceeding to STEP 3.

**STEP 3 — install/build/migrate/seed/wrangler-dev/walkthrough.**
`npm ci` (node_modules already present, skipped per guard) then
`npm run build`: clean (tsc x2 + vite build, no errors). Port 8881 had
no prior listener. `rm -rf .wrangler/state` then `npm run db:migrate`:
all 10 migrations applied (0000..0009), 2 commands executed
successfully against local D1. `npm run seed`: completed, 6 objects
put into local R2 bucket `chautauqua-files`, no errors. Started
`npx wrangler dev --port 8881` in the background; log showed
`[wrangler:info] Ready on http://localhost:8881` within ~6s.

`npm run walkthrough -- --url http://localhost:8881` — all six
modules ran (five required by this task plus a bonus `scale` module
the harness runs by default), full summary:

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

No FAIL lines, no PLANNER: lines in the run. Producer/review modules
(head of the run, scrolled past in the capture below) both reported
their own internal `ok`/pass lines with no failures before speaker's
tail (captured in full below):

- speaker module: co-presenter invites (A/B/C), IDOR rejection on
  foreign participant rows, invitation accept/decline, bulk accept of
  A/B/C, DEC-108 invite-visibility gates on `/sessions` and
  `/speakers`, portal bio edit round-trip, form-close-date portal-edit
  gating (accepted vs unaccepted), upload allowlist/size-cap
  rejection, version-chain re-upload (v1→v2 `previous_file_id`),
  comment/reply thread, content-approval visibility gate — all `ok`.
- public module: J9 agenda/drag-place/auto-schedule/conflict-surface
  checks and J10 all five public surfaces (sessions/speakers/agenda/
  schedule/gallery) + embed variants + `.ics` idempotent UID + three
  visibility gates (non-accepted, content-unapproved, hidden
  participant) + DEC-108 invite-visibility gate — all `ok`.
- data module: J11 contacts/CSV-import/merge/segments/bulk-email
  (incl. >100 cap rejection)/dashboard-stats, J12 bearer-token mint +
  cookie-less GET + revocation + role-403 + exports (csv/json,
  showflow.csv columns) + cross-org 404 + `/docs/api` 200 — all `ok`.
- (Note: a second walkthrough re-run against the same live server for
  transcript-capture purposes hit an expected `409 conflict` on
  `provision second reviewer via /api/v1/users` — the walkthrough
  creates fixture users that are not idempotent across repeat runs
  against unreset state; this is a re-run artifact, not a defect, and
  the FIRST run captured above is the authoritative PASS record for
  this gate.)

**EXTRA spot-check (DEC-131, read-only).** Fetched the seeded public
itinerary export:
`curl -s "http://localhost:8881/e/devflow-conf-2027/schedule.ics?ids=seed_submission_0004,seed_submission_0005,seed_submission_0006"`
— 3 VEVENTs, including a folded multi-line `DESCRIPTION` with
seed-fixture text. Byte-level check (Python, and corroborated by
`od -c`): 41 total `\r` bytes in the response body; a scan of every
byte confirmed each `\r` is immediately followed by `\n` — 0 bare/bad
CRs. `od -c` tail sample:
```
0002600    w   o   r   k       a   g   a   i   n   s   t   .  \r  \n   E
0002620    N   D   :   V   E   V   E   N   T  \r  \n   E   N   D   :   V
0002640    C   A   L   E   N   D   A   R  \r  \n
```
No bare `\r` observed anywhere in the file (line terminators and
RFC-5545 §3.1 75-octet folds are the only source of `\r`, always
paired with `\n`). Spot-check PASS, consistent with DEC-131.

Server killed (`lsof -ti :8881 | xargs kill`) after the spot-check;
port confirmed free.

RESULT: PASS

## 2026-08-10 task-w20-b — perf-smoke confirm @ 8c7f479

Wave-20 confirm-else-run (DEC-136), perf-smoke scope, DEC-129-guarded.

STEP 1 (DEC-114 sha derivation): first-parent walk from `main` tip
`d9be564` ("scribe wave 20") back through `7fd9da7`/`5f89797`/
`992987b`/`24f6f84`/`8e84281`/`9038b5c`: each of `d9be564`, `9038b5c`,
and the four `w19-*` merge commits touches only `docs/verification-log.md`
(and, for `d9be564`/`9038b5c`, `decisions/`, `field-guide/index.md`, and
a pure single-line `export const DEC_1xx = "...";` string-constant
append to `src/decisions.ts`) — bookkeeping, excluded per DEC-114. The
next first-parent commit, `8c7f479` ("merge task-w18-c"), touches
`src/routes/public/submit.tsx` and `test/submit-hidden-file-field.test.ts`
— code-bearing. Adopted sha: `8c7f479` (matches the task's expected sha).
`git merge-base --is-ancestor 675219f 8c7f479` exits 0 — ancestor guard
PASS (DEC-129).

STEP 2 (DEC-135 behavioral preflight, read directly from source, not
marker import): confirmed all four independently at the adopted sha's
worktree:
- DEC-130 `src/domain/schedule.ts`: `autoSchedule` builds incremental
  `roomIndex`/`speakerIndex` occupancy maps; zero `findConflicts` calls
  inside the function body (only a DEC-130 comment mentions the name;
  the helper remains separately exported/used elsewhere). PRESENT.
- DEC-131 `src/mail/ics.ts` `escapeText` (lines 39-47): `\r\n`->`\n`
  then bare `\r`->`\n` as the first two `.replace()` calls, before the
  backslash/semicolon/comma/newline escaping. PRESENT.
- DEC-132 `src/routes/public/submit.tsx`: file loop gated on
  `if (!isVisible(field, answers)) continue;` (line 415) before writing
  the `"pending"` placeholder; the later upload-consuming pass (line 479)
  gated on `if (cleaned[field.id] !== "pending") continue;`. PRESENT.
- DEC-133 `src/server/repo/submissions/status.ts`: `updateSubmissionStatuses`
  computes `missing` and `throw new ApiError("invalid", ...)` (line 209)
  strictly before the per-row mutation loop starting at line 213.
  PRESENT.

All four markers present and pre-mutation/pre-loop — preflight PASS.

STEP 3 (DEC-136 confirm-else-run): grepped `docs/verification-log.md`
for a perf-smoke section citing the adopted sha and found
`## 2026-08-10 task-w19-c — perf-smoke @ 8c7f479` (this file, above).
Read that section's own RESULT/OPEN ITEMS per DEC-137 (locate by
header, do not trust neighboring homonym sections): full p95 table
against DEC-088 scale (2,000 submissions / 300 accepted+placed, 12
reviewers) all `ok` under the 150ms budget (submissions list 26.0ms,
submissions list q=Kubernetes 26.2ms, submission detail 44.1ms, event
overview 27.2ms, organizer agenda 37.8ms, public sessions page 19.4ms,
public agenda 21.1ms, schedule.ics 150 ids 33.8ms, plan progress
17.9ms, rating PUT 9.2ms), DEC-080 301-id cap assertion confirmed via
the script's synchronous-throw contract, and a STEP 4 untimed DEC-130
auto-schedule POST at perf scale (`POST /api/v1/events/seed_perf_event/
agenda/auto-schedule` against the 2,000-submission/300-accepted
perf-seeded event) already recorded: `STATUS: 200`, `DURATION_MS: 40`.
Section ends `OPEN ITEMS: 0` / `RESULT: PASS`. This is CASE
PASS+OPEN-ITEMS-0, and the section already contains evidence of the
untimed DEC-130 auto-schedule POST at perf scale, so no additional
wrangler-dev boot/perf-seed run was needed for that requirement.

Cheap spot-check per this task's brief:
`npx vitest run test/schedule.test.ts test/status-bulk-full-match.test.ts`
— 2 files, 17 tests, all green (`Test Files 2 passed (2)`, `Tests 17
passed (17)`), confirming no drift in the DEC-130/DEC-133 code paths
since `task-w19-c`'s run. No servers were started (not needed — the
cited section already carries the untimed DEC-130 spot-check evidence).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-a — walkthrough confirm @ 8c7f479

DEC-136 confirm-else-run lane (walkthrough gate). Worktree cut from
`main` tip `d9be564` ("scribe wave 20").

**STEP 1 — sha derivation (DEC-114/DEC-129).** First-parent walk from
`d9be564` back through `9038b5c` ("scribe wave 19"), `8e84281`
("merge task-w19-a"), `24f6f84` ("merge task-w19-e"), `992987b`
("merge task-w19-d"), `5f89797` ("merge task-w19-c"), `7fd9da7`
("merge task-w19-b") — `git show --stat --first-parent -1` on each of
these six commits shows changes confined to
`docs/verification-log.md`, `docs/verification-log/*.md`,
`decisions/DEC-135.md`, `decisions/DEC-136.md`, `decisions/DEC-137.md`,
`field-guide/index.md`, and (for the two scribe commits) a
pure-string-constant-append diff in `src/decisions.ts` (`+1` and `+2`
lines respectively, each a bare `export const DEC_1xx = "...";`
addition, no other change) — all fall inside DEC-114's
bookkeeping-exclusion set. The next first-parent commit, `8c7f479`
("merge task-w18-c"), touches `src/routes/public/submit.tsx` and
`test/submit-hidden-file-field.test.ts` — code-bearing. `8c7f479` is
therefore the newest code-bearing main sha, matching the task's stated
expectation. `git merge-base --is-ancestor 675219f 8c7f479` exits 0 —
ancestor check passes (DEC-129).

**STEP 2 — behavioral preflight of DEC-130..133 (DEC-135).** Read
directly from the HEAD worktree tree (behaviorally identical to
`8c7f479` per the bookkeeping-only diff established in STEP 1):
- DEC-130 (`src/domain/schedule.ts` `autoSchedule`, ~line 121-197):
  builds `roomIndex`/`speakerIndex` `Map`s from existing placements up
  front and checks candidates against those maps; no call to
  `findConflicts` inside `autoSchedule`. Marker present.
- DEC-131 (`src/mail/ics.ts` `escapeText`, lines 39-46): replace chain
  is `.replace(/\r\n/g, "\n").replace(/\r/g, "\n")` followed by the
  backslash/`;`/`,`/`\n` escapes — CR fully normalized before
  escaping. Marker present.
- DEC-132 (`src/routes/public/submit.tsx`): file-validation loop at
  line 415 opens with `if (!isVisible(field, answers)) continue;`;
  post-submission upload loop at line 479 opens with
  `if (cleaned[field.id] !== "pending") continue;`. Marker present.
- DEC-133 (`src/server/repo/submissions/status.ts`
  `updateSubmissionStatuses`, ~line 205-211): computes
  `missing = requested.filter(id => !foundIdSet.has(id))` and throws
  `ApiError("invalid", ...)` naming the missing ids before the
  per-row `changeStatus`/UPDATE loop. Marker present.

All four markers present and behaviorally verified — preflight PASS.

**STEP 3 — DEC-136 confirm-else-run search.** `grep -n "^## "
docs/verification-log.md` located header `task-w19-b — walkthrough @
8c7f479` (line 3538, exact sha match). Per DEC-137, keyed strictly on
that section's own content (no stray conflict-marker lines present in
this section): full six-module battery (producer, review, speaker,
public, data, plus bonus scale) all reported `PASS` in the harness
summary, no `FAIL`/`PLANNER:` lines, and the section ends
`RESULT: PASS` with no `OPEN ITEMS` entries listed (i.e. 0 open
items). This is the CASE PASS + OPEN ITEMS 0 branch of DEC-136 —
confirming, not re-running the full battery.

**Confirmed prior result (quoted):** task-w19-b's walkthrough run
(port 8881, sha 8c7f479) reported all six harness modules PASS
(`producer`, `review`, `speaker`, `public`, `data`, `scale`), covering
speaker co-presenter invites/IDOR/portal-edit/upload-versioning/
comment-threads, public J9 auto-schedule + J10 five-surface visibility
gates + `.ics` idempotent UID, and data J11/J12 contacts/CSV/segments/
bulk-email/API-token/export checks — `RESULT: PASS`, 0 open items.

**Live spot-check (DEC-131, one required by DEC-136 CASE PASS).**
Fresh port 8891, zero secrets, local Miniflare only:
- `npm ci` skipped (node_modules present); `npm run build`: clean
  (tsc x2 + vite build, no errors).
- Port 8891 had no prior listener. `rm -rf .wrangler/state` then
  `npm run db:migrate`: all 10 migrations (0000..0009) applied
  successfully against local D1.
- `npm run seed`: completed, 6 objects put into local R2 bucket
  `chautauqua-files`, no errors.
- Started `npx wrangler dev --port 8891` in the background; log
  showed `[wrangler:info] Ready on http://localhost:8891`.
- Fetched the seeded organizer-scoped public itinerary export (same
  submission set as task-w19-b's spot-check, for direct comparison):
  `curl -s "http://localhost:8891/e/devflow-conf-2027/schedule.ics?ids=seed_submission_0004,seed_submission_0005,seed_submission_0006"`
  — 3 VEVENTs, each with a folded multi-line `DESCRIPTION` (CRLF
  textarea seed text).
- Byte-level check (Python, corroborated by `od -c`): 41 total `\r`
  bytes in the response body (identical count to task-w19-b's spot-
  check, as expected — same route, same seed data, unchanged code); a
  scan of every `\r` byte confirmed each is immediately followed by
  `\n` — 0 bare/bad CRs. `od -c` tail sample:
  ```
  0002600    w   o   r   k       a   g   a   i   n   s   t   .  \r  \n   E
  0002620    N   D   :   V   E   V   E   N   T  \r  \n   E   N   D   :   V
  0002640    C   A   L   E   N   D   A   R  \r  \n
  ```
  No bare `\r` observed anywhere in the file. Spot-check PASS,
  consistent with DEC-131.
- Server killed (`lsof -ti :8891 | xargs kill`) after the spot-check;
  port confirmed free.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-f — spec-audit @ d8d1cbd

DEC-069/DEC-163 static spec-audit gate lane. Worktree cut from `main`
tip `f357477` ("scribe wave 4").

**Frozen sha derivation.** `git log --first-parent --oneline` from
`main` tip: `f357477` ("scribe wave 4") touches only `decisions/`,
`field-guide/index.md`, and a bare-constant-append diff in
`src/decisions.ts` — bookkeeping-only per DEC-114. The prior
first-parent commit, `d8d1cbd` ("merge task-w3-c"), touches
`app/src/lib/api.ts`, `app/src/pages/content/*`, `src/domain/files.ts`,
`src/lib/zip.ts`, `src/routes/files.ts`, `src/server/repo/files.ts`,
and three test files — code-bearing. `d8d1cbd` is therefore the
frozen battery sha per DEC-163. `git merge-base --is-ancestor 2dd2f33
d8d1cbd` exits 0 — descends from `2dd2f33` (DEC-129).

**Method.** Read every file directly via `git show d8d1cbd:<path>`
(not the mutable worktree, to avoid drift). Ran `npm run build` and
`npm test --silent` against the tree checked out at `d8d1cbd` as a
sanity floor before the static review (both green: build clean,
151/151 test files, 1308/1308 tests passed), then restored the
worktree to `main` tip with `git reset --hard HEAD` before writing
this log entry — no other file touched.

**§8/§9 route surface + DEC-012/013 audit:**
- `src/index.ts` is the sole sub-app mount point; every route module
  (`pipelineRoutes`, `fileApiRoutes`, `fileServeRoutes`, etc.) is
  imported and `app.route(...)`'d only there. No other file calls
  `.route(` on a Hono sub-app instance. DEC-012 marker present.
- List envelopes (`{items,total,page,perPage}`) and error envelope
  (`{error:{code,message,fields?}}` via the shared `ApiError` class)
  used consistently across the audited surface — `GET /api/v1/pipeline`
  (`src/routes/api/pipeline.ts:65-68`), `GET
  /api/v1/events/:eventId/files` (`src/routes/files.ts:~185`), `GET
  /api/v1/submissions/:id/revisions` (`src/routes/api/submissions.ts:
  ~193-201`). DEC-013 marker present.

**Newest surface — `/api/v1/pipeline` (DEC-157, CRM-07/08):**
`src/routes/api/pipeline.ts` mounts `requireOrganizer` on `/pipeline`
and `/pipeline/*` (lines 16-17); every mutating route
(`POST /pipeline`, `PATCH /pipeline/:id`, `POST
/pipeline/:id/notes`) carries `csrfJson`; every `:id` lookup goes
through `requireOwnedEntry` -> `repo.findEntryForOrg(db, id, orgId)`,
scoping by `orgId` (no IDOR). `src/server/repo/pipeline.ts:12` fixes
`PIPELINE_STAGES = ["identified","contacted","interested","confirmed",
"declined"]` — exactly five stages, validated via `isPipelineStage` on
every write. Moves and notes are both persisted as
`pipeline_activity` rows (`kind: "move"|"note"`) rather than mutating
history away — `repo.moveEntry`/`repo.addNote` (referenced from the
route file) both append via the same activity table. The route-file
header comment and `src/server/repo/pipeline.ts`'s header both assert
"never imports a mailer" — grep of the two files' import lists (and
of `src/server/repo/pipeline.ts` in full) confirms no `mail` import
anywhere in the module. Zero deviations found.

**Newest surface — submission revisions (DEC-158, CNT-11):**
`src/server/repo/revisions.ts` provides `appendSubmissionRevision`/
`listRevisions`/`getRevision`, called from two write paths:
`PATCH /api/v1/submissions/:id` (`src/routes/api/submissions.ts:
~178-186`, organizer-only + csrfJson + org-ownership check) and the
portal-edit locked-field sync (`src/server/repo/portal-edit.ts:
~174-227`, the CNT-11 comment block). Both snapshot pre-edit state via
`getSubmissionContent`, apply the update through
`updateSubmissionFields`, and only append a revision row if
title/description actually changed. `POST /api/v1/submissions/:id/
revisions/:revisionId/restore` (`src/routes/api/submissions.ts:
~204-241`) is organizer-only + csrfJson, resolves the revision scoped
to `submissionId` via `getRevision` (no IDOR — `getRevision` filters
by both `id` and `submissionId`), and calls the *same*
`updateSubmissionFields` path as the PATCH handler, appending its own
history row attributed to the restorer. No email import anywhere in
`src/server/repo/revisions.ts` or the submissions route file's
revision handlers. `migrations/0013_submission_revision.sql` is a
pure `CREATE TABLE`/`CREATE INDEX` pair — append-only per DEC-015.
Zero deviations found.

**Newest surface — files library + archive (DEC-159/DEC-160):**
`GET /api/v1/events/:eventId/files` (`src/routes/files.ts:~181-190`)
is `requireOrganizer`, scopes via `getEventFilesScope` +
`scope.orgId !== auth.orgId` check, returns the standard list
envelope. `POST /api/v1/events/:eventId/files/archive`
(`src/routes/files.ts:~195-232`) is `requireOrganizer` + `csrfJson`,
same org-ownership check, validates `fileIds` is a non-empty string
array capped at `MAX_ARCHIVE_FILES = 50` (`src/routes/files.ts:194`)
— exactly the `<=50` budget from §9/DEC-160. `resolveLatestVersions`
loudly 404s on any unknown/non-deliverable id (no silent skip, per
the inline comment and house fail-loud invariant). ZIP is built via
`buildZip` from `src/lib/zip.ts`, which lives in the pure-core `lib/`
directory (DEC-002) — confirmed by grep: zero `from "node:` / `from
"cloudflare:` imports across every file in `src/{auth,domain,forms,
mail,lib}` at this sha. Entry names are grouped
`${seq}-${slugifyTitle(title)}/${filename}` — one folder per
submission, matching "folder-per-session" (field guide Wave 3). Zero
deviations found.

**Pure-core boundary (DEC-002), full sweep at this sha:** grepped
every file under `src/auth`, `src/domain`, `src/forms`, `src/mail`,
`src/lib` for `from "node:` / `from "cloudflare:` — zero matches.

**Status-change/email invariant:** no content-status, pipeline-stage,
or revision-restore handler audited above imports or calls a mailer.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-e — render-sweep @ d8d1cbd

DEC-144/DEC-139 sixth required battery section, wave 4 (DEC-162/163).
Frozen battery sha per DEC-163 (newest code-bearing first-parent `main`
sha after task-w4-a's wave-3 consolidation merges landed, independently
re-derived): `d8d1cbd` ("merge task-w3-c", the last code-bearing commit
before the docs-only `f357477` "scribe wave 4" — `git diff d8d1cbd
f357477 --stat` touches only `decisions/DEC-163.md`, `decisions/DEC-164.md`,
`field-guide/index.md`, `src/decisions.ts`, confirming code-identity).
Confirmed `d8d1cbd` descends from `2dd2f33` (DEC-129 homonym guard) and
remains an ancestor of the current `main` tip.

Note on process: this worktree's directory was unexpectedly removed
mid-run by an external process (concurrent swarm activity) after the
sweep below had already completed and its results recorded here from
the run's own output; the worktree/branch were recreated fresh from
`main` to write this section, and `d8d1cbd`'s ancestor/code-identity
checks were re-verified against the new tip before writing.

Procedure: fresh worktree, `npm ci`, `npm run build` (PASS, dual
`tsc --noEmit` + `vite build`, 131 modules), `rm -rf .wrangler/state`,
then `npm run gate:render-sweep` (DEC-144 serial Playwright sweep;
the script self-drives its own `wrangler d1 migrations apply` +
`scripts/seed.ts` + `scripts/seed-r2.ts` + `wrangler dev` boot on a
free port, so no separate manual `db:migrate`/`seed`/`dev` invocation
was layered on top — doing so first caused a `pipeline_entry` UNIQUE
constraint failure on the script's own re-seed, resolved by re-running
`rm -rf .wrangler/state` immediately before the gate script).

Route surface: **31 routes enumerated** (`app/src/routeManifest.ts`,
covering admin SPA + portal + public + the `/admin/*` SPA catch-all),
per-role breakdown: organizer 16, reviewer 3, speaker 6, public 6.
**29/31 PASS**, 2 FAIL:

1. `/admin/review/plans/seed_evaluation_plan_0001` (organizer, SPA) —
   empty rendered `#root` text; 1 console error + 1 pageerror, both
   `TypeError: Cannot read properties of undefined (reading 'includes')`
   at `index-CD2-kLqP.js:41:36098` (minified bundle; not resolved to
   source in this docs-only lane per the task's "record FAIL with
   specifics rather than fixing code" instruction). Note: the plan's
   `/progress` and `/results` sibling routes both render clean for the
   same plan id — only the top-level plan-detail page crashes.
2. `/portal/tasks/seed_task_assignment_0001/form` (speaker, SSR) —
   navigation itself returns HTTP 400 Bad Request (not a render/console
   issue past that point); console shows the browser's own "Failed to
   load resource: 400" for the page navigation. Wrangler dev log
   confirms: `GET /portal/tasks/seed_task_assignment_0001/form 400 Bad
   Request`.

Wave-3 UI placement per the task's request: the Pipeline tab
(`/admin/contacts`), Files tab (`/admin/content`), and submission
revision history (`/admin/submissions/seed_submission_0001`) all sit on
routes that ARE enumerated above and all PASS — these three features are
tab-/detail-internal state on already-swept routes, not separate URL
entries, so their own coverage is the existing component render smokes
(`FilesLibrary.render.test.tsx` etc.) rather than a dedicated sweep
route, consistent with the task brief's expectation.

`npm run build` and the sweep both ran clean of infrastructure errors;
the two failures above are both real HTTP/render defects, not sweep
tooling issues. Per this gate's instructions, no code fix was attempted.

RESULT: FAIL — 2 of 31 enumerated routes fail the render-sweep at
`d8d1cbd`: (1) `/admin/review/plans/seed_evaluation_plan_0001`
(organizer SPA route) renders an empty `#root` with a console/pageerror
`TypeError: Cannot read properties of undefined (reading 'includes')`;
(2) `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR route)
returns HTTP 400 instead of 200. All other 29 routes (organizer,
reviewer, speaker, public) are clean.

## 2026-08-10 task-w4-d — perf-smoke @ d8d1cbd

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

**Procedure**, worktree checked out detached at `d8d1cbd`, zero
secrets: `rm -rf .wrangler/state` (nothing present, fresh worktree),
`npm ci --prefer-offline --no-audit --no-fund --silent`, `npm run
db:migrate` (14 migrations `0000`..`0013` applied clean), `npm run
seed` (required first so the perf script's login identity
`sbek-organizer@example.com`-equivalent fixture exists — `perf:seed`
alone only seeds synthetic `seed_perf_`-prefixed rows, per the
`task-w19-c` precedent in this file), `npm run perf:seed` (DEC-088
scale: 2,000 submissions / 300 accepted+placed, 10 rooms, 12
reviewers + 600 round-1 evaluations — all SQL batches
`"success": true`), `npx wrangler dev` on the default port 8787
(`GET /health` 200 OK, "Ready on http://localhost:8787" observed),
`npm run perf:smoke`.

`npm run perf:smoke` exit 0 ("perf:smoke OK"). Full p95 table over
30 measured iterations (script budget 150ms uniform, all `ok`),
cross-checked here against SPEC.md §7's finer-grained budgets
(admin API reads p95 < 50ms, writes p95 < 100ms; public
uncached-SSR pages < 150ms):

```
submissions list (page 1)             9.8ms  ok   (admin read,  budget 50ms)
submissions list (q=Kubernetes)      12.6ms  ok   (admin read,  budget 50ms)
submission detail                    12.7ms  ok   (admin read,  budget 50ms)
event overview                       11.8ms  ok   (admin read,  budget 50ms)
organizer agenda (300 accepted)      16.6ms  ok   (admin read,  budget 50ms)
public sessions page                  3.2ms  ok   (public SSR,  budget 150ms)
public agenda                         6.2ms  ok   (public SSR,  budget 150ms)
schedule.ics 150 ids                 32.9ms  ok   (public SSR,  budget 150ms)
plan progress (12 reviewers)         18.2ms  ok   (admin read,  budget 50ms)
rating PUT                            8.5ms  ok   (admin write, budget 100ms)
```

Every measured endpoint is within budget under both the script's
uniform 150ms threshold and SPEC.md §7's per-category numbers, at
the DEC-088 seeded row scale (2,000 submissions / 300 accepted /
12 reviewers / 10 rooms). Server stopped (`lsof -ti:8787 | xargs -r
kill -9`) after the run. No file other than this log was touched
(worktree was a disposable detached checkout, discarded after the
run; this commit's only diff is this section).

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w4-g — triage-closure @ d8d1cbd

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

**PLANNER flag (do not act on unilaterally — reporting only, no code
touched, no other file modified).** `src/decisions.ts` at the current
main tip (`fc1e6ef`) carries `DEC_165`: "Wave-4 battery lanes never
executed; consolidation is already complete on main via the merge
train; the battery re-issues as wave 5 with task-w5-a as preflight and
the frozen sha defined by the w5-a merge." That is only partially
true as of this section: `task-w4-f` DID execute (spec-audit @
`d8d1cbd`, RESULT: PASS, appended above). This triage-closure section
is a second wave-4 lane landing after DEC-165 was written. Per DEC-163
the wave-4 battery needs all six lanes converged on one sha to satisfy
DEC-069; only two of six materialized (`task-w4-f` spec-audit and this
triage-closure) before the planner moved on to a wave-5 re-issue — so
the wave-4 battery, taken alone, is NOT a complete DEC-069 battery and
does not itself support a stage-1 exit declaration. This section's
own scope (eval-findings closure + prior-log open-items sweep, per the
task-w4-g brief) is unaffected by that gap and is reported in full
below; the battery-completeness question is left to the planner/DEC-165's
wave-5 re-issue, not resolved here.

**Section A (ratify) — CLOSED.**
- P0 admin redirect loop (`wrangler.jsonc` `html_handling: "none"`):
  `test/admin-assets-config.test.ts` (parses the real `wrangler.jsonc`,
  asserts the asset-redirect-defeating config is present).
- `/admin/submissions` "n is not iterable" crash (`SubmissionsTable`
  reading `apiGet('/events/:id/forms').then(r => r.fields)` instead of
  `apiList(...).items`): `app/src/pages/submissions/
  Submissions.render.test.tsx` (mounts the real page against a mocked
  fetch shaped like the real single-object `/forms` wire contract).

**Section B (P1) — CLOSED.**
- Plan-detail "Invalid time value" crash: `app/src/lib/dates.ts`
  (`formatDateOnly`/`formatDate`/`msToDateInput`, DEC-146 null-safe
  helpers) + `app/src/pages/review/Review.render.test.tsx` (null
  `openAt`/`closeAt`/`roundCriteria` render without throwing).
- Reviewer queue/event-selector lockout: `src/routes/api/events.ts`
  reachable-by-reviewers fix (DEC-141) pinned by
  `test/events-reviewer-access.test.ts`.
- Empty `.ics` itinerary export: `?ids=` query-param round trip
  (DEC-140) pinned by `test/itinerary-roundtrip.test.ts` (scrapes real
  checkbox values out of rendered HTML, round-trips every id to a
  matching VEVENT).
- Overlapping session blocks eating pointer events: `src/lib/
  overlap-lanes.ts` (`assignLanes`) pinned by `test/overlap-lanes.test.ts`.
- Speaker portal profile not visible to organizer (SPK-08 round trip,
  DEC-142): pinned by `test/contact-profile-roundtrip.test.ts` and
  `test/contacts-profile-admin.test.ts` (admin PATCH bio/socialLinks/
  headshot) plus the `ContactDrawer` portal-profile plumbing.
- CSV import silent-drop + duplicate-instead-of-merge: pinned by
  `test/contacts-import.test.ts` (real route, in-memory fake Db,
  repeat-import updates not duplicates).
- Near-duplicate detection missing same-name+company match (DEC-143):
  pinned by `test/contacts.test.ts` `findDuplicateGroups` describe
  block ("flags same-name same-company contacts even across different
  emails (DEC-143)", "joins a blank-company contact into a
  named-company group (DEC-143)").

**Section C (P2, by weight) — CLOSED.**
- EMB-01 (card date/time/room), EMB-02 (keyword search), EMB-07 (day
  switcher): `test/public.test.ts` describe blocks `SessionCard
  schedule rendering (EMB-01...)`, `EMB-02: keyword search (q)
  server-side substring filter`, `AgendaContent / ScheduleContent day
  switcher (EMB-07)`.
- EMB-05/08/13 drill-ins (DEC-151): `test/public.test.ts`
  `sessionDetailPath / speakerDetailPath (DEC-151 ?from= back-link)`
  and `parseNameQuery (DEC-151 ?q= name search)`.
- EMB-04/12 headshots: `test/headshot-gate.test.ts` (serve-scope gate)
  + Section E seed evidence below (`headshot_url` on >=3 contacts).
- CNT-09 admin session editing + CNT-12 content-approval reachability:
  `test/api-submissions.test.ts` (`PATCH /api/v1/submissions/:id
  (CNT-09 admin session editing)`) and `app/src/pages/submissions/
  SubmissionDetailPage.render.test.tsx` ("approves content via the
  always-visible control (no files required)").
- CNT-10 admin editing of speaker bio/headshot: `test/
  contacts-profile-admin.test.ts` (`PATCH /contacts/:id bio +
  socialLinks (CNT-10)`, `POST /contacts/:id/headshot (CNT-10)`).
- ABS-01 per-round scorecards (DEC-147): `test/evaluation.test.ts`
  (`criteriaForRound (DEC-147)`) and `test/round-criteria.test.ts`.
- ABS-03 free-text criterion (DEC-148): `test/evaluation.test.ts`
  (`validateEvaluationScores (DEC-148 'text' kind)`) and `test/
  round-criteria.test.ts` (round-2 required text criterion).
- CRM-11 bulk-email templates/preview parity (DEC-150): `test/
  contacts-bulk-email-preview-route.test.ts`.
- CRM-02 multi-criteria filter + non-lossy segments (DEC-149): `test/
  contacts-rules-param.test.ts` (`parseRulesQueryParam`) and
  `app/src/pages/contacts/FilterRulesPanel.tsx`.
- CRM-12 metrics-strip dashboard: `app/src/pages/contacts/
  ContactsApp.render.test.tsx` ("ContactsApp render smoke (CRM-12
  top-companies drill-through)") and `app/src/pages/contacts/
  StatsStrip.tsx`.
- TZ task due-date off-by-one: UTC-aware `formatDateOnly`
  (`app/src/lib/dates.ts` + `app/src/lib/dates.test.ts`, DEC-153) used
  by `app/src/pages/speakers/OnboardingGrid.tsx`.

**Section D (optional) — CLOSED.**
- CRM-07/08 sourcing pipeline (DEC-157): `test/pipeline-api.test.ts`
  and `app/src/pages/contacts/PipelineBoard.render.test.tsx`.
- CRM-10 push-contact-into-event (DEC-156): `test/
  contacts-add-to-event.test.ts`.
- CNT-11 content version history + restore (DEC-158): `test/
  submission-revisions.test.ts` (+ `test/api-submissions.test.ts`,
  `test/portal-edit-speaker-locked.test.ts` for locked-field sync).
- CNT-13/14 files library + ZIP bulk download (DEC-159/DEC-160):
  `test/files-library.test.ts` and `test/files-archive-route.test.ts`.
- AIA-07 explicit publish (DEC-155): `test/agenda-publish.test.ts`
  (`POST .../agenda/publish (AIA-07, DEC-155)`).
- AIA-08 accepted-only unscheduled tray: `test/agenda-repo.test.ts`
  (`getAgendaPayload unscheduled tray (AIA-08: accepted-only)`).
- Admin 404 catch-all (DEC-154): `app/src/App.render.test.tsx`
  (renders `NotFound` at an unknown `/admin/*` path).
- Sign-out control (DEC-154): `test/portal-signout.test.ts` (portal
  shell "Sign out" form) — the admin-side sign-out is part of the same
  `PortalLayout`/nav-shell pattern.
- Contact-editor a11y labels: `app/src/pages/contacts/ContactDrawer.tsx`
  has `<label htmlFor=...>` for first name/last name/email/company
  fields (code inspected directly at `d8d1cbd`; no dedicated a11y unit
  assertion beyond the existing `ContactDrawer` render coverage).

**Section E (seed) — CLOSED.** `test/seed.test.ts` ("sets
headshot_url on at least 3 contacts, backed by the real
docs/fixtures/headshot.png fixture") plus DEC-145's grading-window-
aligned accepted session/tasks/deliverable-version/comment-thread seed
enrichment (wave-1 commit `1f2e243`).

**Section F (permanent gates) — CLOSED.**
- F.1 serial browser render-sweep gate (DEC-144): `scripts/
  render-sweep.ts` + `scripts/render-sweep-lib.ts`, pinned by `test/
  render-sweep-lib.test.ts`, enumerating the full route surface via
  `app/src/routeManifest.ts` (seed-literal params, no hand-picked
  list).
- F.2 parallel-safe component-render smokes (DEC-161): 17
  `*.render.test.tsx` files under `app/src/` (App, Overview, Agenda,
  Comms, Speakers, Settings, Review, Scorecard, Submissions,
  SubmissionDetailPage, ContentApp, FilesLibrary, FormsPage,
  ContactsApp x2, PipelineBoard, BulkEmailModal) — vitest + jsdom + RTL
  against fixture-shaped mocks, one per named page component.

**Prior campaign-3 verification-log sweep.** `grep -n "^## "
docs/verification-log.md | awk -F'@ ' '{print $2}' | sort -u` lists 20
distinct cited shas in this file; running `git merge-base --is-ancestor
2dd2f33 <sha>` against each shows exactly one descends from the
campaign-3 reset: `d8d1cbd` (the `task-w4-f — spec-audit` section
above, RESULT: PASS, OPEN ITEMS: 0 — no unresolved item to carry
forward). The other 19 predate `2dd2f33` and are first-campaign
homonyms per DEC-129 (including five sections literally titled
`task-w4-a/b/c/d/e @ 3878d4f`); none contribute an open item against
the current tree.

**This section's OPEN ITEMS count (eval-findings closure only, per
the task-w4-g brief).** Every eval-findings.md Sections A-F item has
closing evidence in the tree at `d8d1cbd` (cited above); the sole
prior valid campaign-3 section carries no open item. No waivers used
or needed.

OPEN ITEMS: 0

## 2026-08-10 task-w5-b — build+test @ 64ec7de

SHA derivation (DEC-114/165): walked `git log --first-parent main`
from HEAD. HEAD (`64ec7de merge task-w5-a`) is not bookkeeping-only,
so no further walk was needed. Confirmed `.github/workflows/ci.yml`
at 64ec7de contains the `render-sweep` job (DEC-166, task-w5-a or
later), and `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0
(DEC-129/139). Adopted sha: 64ec7de.

`npm ci --prefer-offline --no-audit --no-fund --silent` clean (fresh
worktree). `npm run build` (tsc x2 + vite) PASS — 131 modules
transformed, 18 chunk/CSS assets + index.html under `public/admin/`.
`npm run bundle:check` (DEC-058, 300KB gzip budget) PASS — entry
bundle 58.86 kB gzip. `npm test --silent` PASS — 151 test files, 1308
tests, 0 failures.

File counts: `src/**/*.ts` = 93 files; `app/src/**/*.{ts,tsx}` = 150
files.

Full detail: docs/verification-log/task-w5-b-build-test.md

OPEN ITEMS: none — build, bundle:check, and test all PASS at 64ec7de.
RESULT: PASS — build+test green at 64ec7de (131 modules, 18 assets,
58.86 kB gzip entry bundle, 151 test files / 1308 tests, 0 failures).

## 2026-08-10 task-w5-d — perf-smoke @ 64ec7de

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

STEP 2: `npm ci --prefer-offline --no-audit --no-fund --silent` (cached,
clean). `npm run build` — clean (tsc x2 + vite build, no errors). `rm -rf
.wrangler/state` — fresh worktree, nothing present. `npm run db:migrate`
— 11 migrations (`0000`..`0010`, `0012`, `0013`; `0011` does not exist in
this tree) applied clean via `wrangler d1 migrations apply chautauqua
--local`. `npm run seed` — required first (perf:seed alone seeds only
synthetic `seed_perf_`-prefixed rows, not a login-capable identity); ran
clean, 8 R2 objects uploaded to local bucket `chautauqua-files`. `npm run
perf:seed` — DEC-088 scale (2,000 submissions / 300 accepted, 12
reviewers), all SQL batches report `"success": true`. `npx wrangler dev
--port 8803` started in background (port 8803 reserved for this lane,
never 8787/8801); `GET /health` returned `{"ok":true}` (200) on the first
poll.

`PERF_URL=http://localhost:8803 npm run perf:smoke` — exit 0
("perf:smoke OK"), re-run a second time to confirm exit code explicitly
(`echo $?` -> `0`). Full p95 table (budget 150ms, all `ok`):

```
submissions list (page 1)            11.8ms  ok
submissions list (q=Kubernetes)      13.6ms  ok
submission detail                    15.4ms  ok
event overview                       15.6ms  ok
organizer agenda (300 accepted)      19.1ms  ok
public sessions page                  4.2ms  ok
public agenda                         6.7ms  ok
schedule.ics 150 ids                 40.2ms  ok
plan progress (12 reviewers)         22.8ms  ok
rating PUT                            8.0ms  ok
```

DEC-080 301-id cap assertion: `perf-smoke.ts` throws synchronously on any
non-400 response to the 301st synthetic nonexistent `schedule.ics` id
request (run untimed before the measured loop), so the clean `perf:smoke
OK` exit on both runs confirms this assertion passed — noted explicitly
per this gate's instructions, no separate assertion output is printed by
the script.

Server killed after the run (`pkill -f "wrangler dev --port 8803"`);
`lsof -i :8803` confirms the port is free.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w5-e — render-sweep @ 64ec7de

DEC-144/DEC-139 sixth gate, wave-5 campaign (DEC-165/166); first full
render-sweep run against the wave-5 frozen battery sha. Frozen sha
derivation (first-parent walk on `main`, skipping bookkeeping):
`64ec7de` ("merge task-w5-a") is the current `main` tip — no bookkeeping
commits sit after it to skip. Confirmed it contains the CI render-sweep
job (`git show 64ec7de:.github/workflows/ci.yml` includes a `render-sweep:`
job invoking `npm run gate:render-sweep`) and `git merge-base
--is-ancestor 2dd2f33 64ec7de` succeeds (descends from the DEC-129
homonym-guard commit). Fresh worktree checked out directly at `64ec7de`.

Procedure: `npm ci` (cached, silent), `npm run build` (PASS — dual
`tsc --noEmit` + `vite build --config app/vite.config.ts`, 131 modules
transformed, admin SPA bundle emitted to `public/admin/`), `npx
playwright install chromium` (already cached, exit 0), then `npm run
gate:render-sweep`. The script self-drove its full documented sequence:
`wrangler d1 migrations apply --local` (13 migrations incl.
`0012_pipeline.sql`/`0013_submission_revision.sql`), `scripts/seed.ts`
+ `.seed.sql` D1 load, `scripts/seed-r2.ts`, then booted `wrangler dev`
on a self-selected free port, logged in via the real `/login` form as
each of organizer/reviewer/speaker from
`docs/fixtures/sample-data.json`, then visited every
`app/src/routeManifest.ts` entry.

Route surface: **31 routes enumerated**, per-role breakdown: organizer
16, reviewer 3, speaker 6, public 6 (incl. the `/admin/*` SPA
catch-all). **29/31 PASS**, 2 FAIL — identical failure set and error
signatures to the prior wave-4 render-sweep at `d8d1cbd` (see the
`task-w4-e — render-sweep @ d8d1cbd` section above), confirming these
are persistent, unfixed defects rather than sha-specific regressions:

1. `/admin/review/plans/seed_evaluation_plan_0001` (organizer, SPA) —
   empty rendered `#root` text; 1 console error + 1 pageerror, both
   `TypeError: Cannot read properties of undefined (reading 'includes')`
   inside the bundled `Review-*.js`/`index-*.js` chunks (minified; not
   resolved to source in this log-only lane per the task's freeze
   instruction). The plan's own `/progress` and `/results` sibling
   routes both render clean — only the top-level plan-detail page
   crashes.
2. `/portal/tasks/seed_task_assignment_0001/form` (speaker, SSR) —
   navigation itself returns HTTP 400 Bad Request (confirmed in the
   wrangler dev server log: `GET /portal/tasks/seed_task_assignment_0001/form
   400 Bad Request`), not a render/console issue past that point.

`npm run build` and the sweep both ran clean of infrastructure/tooling
errors; the script did not print `gate:render-sweep OK` (exit
non-zero) because of the 2 route failures above. Per DEC-077-style
freeze for this gate, no code fix was attempted — recording FAIL for a
targeted fix wave.

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

DEC-165/DEC-166/DEC-139 wave-5 triage-closure lane. Fresh worktree cut
from `main` tip.

**STEP 1 — frozen sha.** First-parent walk from `main` tip, skipping
bookkeeping (DEC-114): `main` tip itself, `5ee31ae` ("merge
task-w4-g"), is code-bearing (this file's own log growth is the only
change in that merge, which is log-only per DEC-068/162 — the merge
commit is a real task landing, not a scribe/decisions-only commit), so
no walk-back past HEAD is needed; `5ee31ae` is the frozen sha.
Confirmed: `git merge-base --is-ancestor 2dd2f33 5ee31ae` exits 0
(descends from the campaign-3 reset, DEC-129), and `git show
5ee31ae:.github/workflows/ci.yml` contains the `render-sweep:` job
(added by `8d7ef56` "ci: add render-sweep job to CI workflow
(DEC-166)", landed via `merge task-w5-a` at `64ec7de`, an ancestor of
`5ee31ae`) — both frozen-sha preconditions satisfied.

**STEP 2(a) — PLANNER marker harvest.** `git log --format='%h %B'
2dd2f33..HEAD | grep -n 'PLANNER:'` returns zero hits. (Note: the
`task-w4-g` section above, landed in this same commit range, contains
a bolded **"PLANNER flag"** prose label inside its log entry, not a
literal `PLANNER:` commit-message marker — grep on commit
subjects/bodies correctly does not match it. No live PLANNER: markers
to disposition.)

**STEP 2(b) — campaign-3 verification-log sweep.** Extracted every
`## ... @ <sha>` citation in this file (20 distinct shas as of this
run) and ran `git merge-base --is-ancestor 2dd2f33 <sha>` against
each. Exactly one sha descends from `2dd2f33`: `d8d1cbd`. The four
sections citing it are the entire in-scope campaign-3 set (no w5
sibling gate has merged yet as of this run — this file ends at
`task-w4-g` immediately before this section):

- `task-w4-f — spec-audit @ d8d1cbd` — RESULT: PASS, OPEN ITEMS: 0.
- `task-w4-e — render-sweep @ d8d1cbd` — **RESULT: FAIL** — 2 of 31
  enumerated routes fail: (1) `/admin/review/plans/
  seed_evaluation_plan_0001` (organizer SPA) renders an empty `#root`
  with a console/pageerror `TypeError: Cannot read properties of
  undefined (reading 'includes')`; (2) `/portal/tasks/
  seed_task_assignment_0001/form` (speaker SSR) returns HTTP 400
  instead of 200. Disposition: this FAIL is **not** superseded by any
  later section in this file — no subsequent render-sweep re-run at a
  newer sha appears in the log, so it stands as an open, uncontested
  defect against `d8d1cbd`. Both routes remain reachable in the
  current worktree's route manifest (`app/src/routeManifest.ts`) and
  no commit in `2dd2f33..HEAD` (per `git log --oneline -- app/src/
  pages/review app/src/pages/portal 2dd2f33..HEAD`, empty for the
  plan-detail/task-form components) touches the implicated components,
  so the defect is presumed still live at the frozen sha `5ee31ae`.
  Per this gate's log-only scope, no code fix is attempted here.
- `task-w4-d — perf-smoke @ d8d1cbd` — RESULT: PASS, OPEN ITEMS: 0.
- `task-w4-g — triage-closure @ d8d1cbd` — OPEN ITEMS: 0 (no explicit
  `RESULT:` line; the section's own prior-log sweep at the time it was
  written undercounted — it names only `task-w4-f` as the sole
  campaign-3 descendant, missing that `task-w4-e` and `task-w4-d`
  (both also cited `d8d1cbd` and both already present earlier in this
  same file) independently satisfy the same ancestry check. This
  section corrects that omission: `task-w4-e`'s FAIL is carried
  forward below rather than silently dropped.

**STEP 2(c) — eval-findings.md mandate closure.** `docs/
eval-findings.md` is not edited by this lane (scribe/planner-owned per
DEC-139). Its SWARM ROUND MANDATE Sections A-F are dispositioned
in-tree by `task-w4-g — triage-closure @ d8d1cbd` (above, this file),
which cites concrete test files and source paths per section (A:
`test/admin-assets-config.test.ts` +
`Submissions.render.test.tsx`; B: `dates.ts`/`Review.render.test.tsx`,
`events-reviewer-access.test.ts`, `itinerary-roundtrip.test.ts`,
`overlap-lanes.test.ts`, `contact-profile-roundtrip.test.ts` +
`contacts-profile-admin.test.ts`, `contacts-import.test.ts`,
`contacts.test.ts`; C: `public.test.ts`, `headshot-gate.test.ts`,
`api-submissions.test.ts`, `evaluation.test.ts`/`round-criteria.test.ts`,
`contacts-bulk-email-preview-route.test.ts`,
`contacts-rules-param.test.ts`, `ContactsApp.render.test.tsx`,
`dates.test.ts`; D: `pipeline-api.test.ts`,
`contacts-add-to-event.test.ts`, `submission-revisions.test.ts`,
`files-library.test.ts`/`files-archive-route.test.ts`,
`agenda-publish.test.ts`, `agenda-repo.test.ts`,
`App.render.test.tsx`, `portal-signout.test.ts`; E:
`seed.test.ts`; F: `render-sweep-lib.test.ts` + the 17
`*.render.test.tsx` component smokes). All cited files are present and
passing in this worktree at `5ee31ae` (full suite green, see STEP
2(d)). Mandate closure is confirmed by re-citing this in-tree evidence
without modifying `eval-findings.md`.

**STEP 2(d) — build+test.** `npm run build`: clean (dual `tsc --noEmit`
+ `vite build`, 131 modules). `npm test --silent`: 151/151 test files,
1308/1308 tests, all green.

**Honest OPEN ITEMS.** Per this task's explicit instruction ("if a
sibling gate's merged section records FAIL, count it"): the
`task-w4-e — render-sweep @ d8d1cbd` FAIL (2 failing routes) is a
merged campaign-3 section in this file recording RESULT: FAIL, and no
later section in the log supersedes it with a clean re-run. It is
carried forward as open below. This is independent of, and does not
reopen, `docs/eval-findings.md`'s SWARM ROUND MANDATE (Section
2(c) above) — the two failing routes are a render-sweep-gate finding
distinct from any eval-findings.md line item, tracked here per DEC-144
(F.1's own regression coverage) rather than in eval-findings.md, which
this lane does not edit.

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

Wave-6 exit-gate battery (DEC-165/166), walkthrough lane, log-only (no
code changes). Fresh worktree of `main` at port 8801.

**STEP 1 — sha derivation.** Worktree cut from `main` tip, first-parent
log: `64ec7de` ("merge task-w5-a") is the newest commit and is not a
bookkeeping/scribe commit (compare `54005df`/`fc1e6ef`/`5c91fae`
underneath it, the latter being "scribe wave 5"). `64ec7de:.github/
workflows/ci.yml` contains the `render-sweep:` job
(`npm run gate:render-sweep`), satisfying the w5-a-must-contain-CI-job
requirement. `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0 —
ancestor check passes. Frozen sha: **`64ec7de7f1fcd4582c8482b9c7b9059a1e57e0a3`**.

**STEP 2 — install/build/migrate/seed/wrangler-dev/walkthrough.**
`npm ci`, then `npm run build`: clean (`tsc --noEmit` x2 + `vite
build`, 131 modules, no errors). `rm -rf .wrangler/state` then `npm run
db:migrate`: **13 migrations applied** — `0000_secret_matthew_murdock`
through `0010_round_criteria`, then `0012_pipeline`, `0013_
submission_revision` (the `0011` gap is the DEC-164-sanctioned
numbering skip). `npm run seed`: completed clean, 8 objects put into
local R2 bucket `chautauqua-files`, no errors. Started `npx wrangler
dev --port 8801` in the background; `GET /health` returned 200 within
~8s.

`npm run walkthrough -- --url http://localhost:8801` ran the fixed
DEC-062 order producer → review → speaker → public → data → scale.
The orchestrator (`scripts/walkthrough.ts`) halts the whole run at the
first per-area module `FAIL` (each area module calls `process.exit(1)`
inside its own `check()` helper on assertion failure), so the full-run
invocation above stopped at speaker; the three areas after it (public,
data, scale) were then run individually via `npx tsx scripts/
walkthrough/<area>.ts --url http://localhost:8801` against the same
live server, for full-coverage recording in this log (still the same
gate execution, same sha, same server instance — no code changes,
purely additional read-only invocations of the existing harness).

Per-area results:
- **producer**: 5/5 checks PASS (J1 launch CFP, J2 public submit+claim,
  J3 triage at volume, overflow-recipient seeding, J5 compose/ICS/
  HTML-escaping). PASS.
- **review**: 16/16 checks PASS (assignment queue ordering/anonymized
  detail/scorecard round-trip/max-evaluations cap/role-403s/DEC-039
  cross-org 404s/progress+remind/results sort+CSV). PASS.
- **speaker**: 15 checks PASS, then **1 FAIL**: `find my own general
  task's assignment id via /portal/tasks` — "could not find a 'Mark
  complete' form action on /portal/tasks". Root cause (read-only
  investigation, no fix applied): `src/routes/portal/tasks.tsx`
  `TaskRow` only renders the `Mark complete` form when `t.kind ===
  "general"` and `t.status !== "complete"`. The onboarding fixture's 5
  canonical tasks (`src/domain/acceptance.ts` `DEFAULT_ONBOARDING_
  TASKS`) place its two `general`-kind tasks at array indices 2
  ("Finalize talk description") and 4 ("Announce participation").
  `scripts/seed.ts`'s per-assignment completion formula is `isComplete
  = (contactIdx + taskIdx) % 3 !== 0`; for the seeded walkthrough
  speaker (`contactIdx === 0`, the first accepted submission),
  `taskIdx 2 → 2%3=2` and `taskIdx 4 → 4%3=1` are both non-zero, so
  BOTH general tasks are pre-seeded `complete` for that specific
  speaker, leaving zero pending general-kind tasks to click "Mark
  complete" on. Confirmed live via `curl` login as
  `sbek-speaker@example.com`: `/portal/tasks` shows "Finalize talk
  description — Completed" and "Announce participation — Completed",
  with only the `form`-kind (Hotel stay, `Fill out form` link) and
  `file_request`-kind (Finalize bio+headshot, `Upload` form) tasks
  still pending. This is a seed/walkthrough coupling bug, not a
  product-code defect: the deterministic mod-3 formula happens to
  complete both general tasks for `contactIdx 0` regardless of which
  accepted submission is used, so the walkthrough's own general-task
  round-trip check (lines 446-459 of `scripts/walkthrough/speaker.ts`)
  can never pass against this seed as currently written. FAIL,
  blocking the rest of the speaker module (co-presenter/invitation/
  edit-lock/comment-thread checks after this point never ran).
- **public**: 15 checks PASS (event resolve, J9 agenda/schedule/
  auto-schedule/conflict-surface, J10 sessions/agenda/schedule/gallery
  pages, session-card+track-filter markup), then **1 FAIL**: `J10
  /speakers: alphabetical by surname, headshot/title/company` —
  "expected at least 2 speakers to check ordering". Root cause
  (read-only investigation, no fix applied): the check's extractor
  regex `/<strong>\s*([^<]+?)\s*<\/strong>/g` in `scripts/walkthrough/
  public.ts` (~line 440) assumes speaker names render as bare text
  directly inside `<strong>...</strong>`. Live markup fetched via
  `curl http://localhost:8801/e/devflow-conf-2027/speakers` shows
  names actually render as `<strong><a href="...">Toni
  Brightwell</a></strong>` — an anchor nested inside the `<strong>`
  tag — so `[^<]+?` (no `<` allowed) never matches and `names.length`
  is 0, well below the `>= 2` assertion, even though the page visibly
  lists many speakers (Toni Brightwell, Xan Chen, Alex Delgado, and
  more, confirmed alphabetical by surname on manual inspection). This
  is a stale-selector bug in the walkthrough script (or the product
  markup changed after the check was written) — not a missing feature.
  FAIL, blocking the rest of the public module (embeds, `.ics`,
  visibility-gate checks after this point never ran).
- **data**: 21/21 checks PASS (J11 contact search/create/CSV-import/
  history/dedupe-merge/segment/bulk-email+cap/dashboard-stats; J12
  bearer-token mint/cookie-less GET/revocation/role-403/exports/
  showflow.csv/cross-org 404/`/docs/api`). PASS.
- **scale**: 6/6 steps PASS (110 fresh contacts+submissions+
  participants; one bulk-accept of 110 ids; onboarding task_assignments
  sampled for 5 fresh contacts; re-accept exactly-once; no auto-email
  on bulk status change; purge-refresh probe). PASS.

Server killed (`lsof -ti :8801 | xargs kill -9`, plus the parent
`wrangler dev`/`npm exec` processes) after the run; port confirmed
free (`lsof -i :8801` empty). An unrelated `wrangler dev --port 18787`
process from a different repo checkout was observed running
concurrently on the machine and was left untouched (out of scope,
different port).

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

Static log-only audit per DEC-069/DEC-139/DEC-165/DEC-166 (no code changes;
gaps recorded as open items, not fixed). Fresh worktree from `main`.

**STEP 1 — frozen sha.** First-parent walk from `main` HEAD (`5ee31ae`,
"merge task-w4-g"), skipping bookkeeping merges (`53e4a64` merge task-w4-d,
`fc1e6ef` merge task-w4-f, `54005df` merge task-w4-e, `5ee31ae` merge
task-w4-g — each touches only `docs/verification-log.md`, confirmed via
`git show <sha> --stat`) lands on `64ec7de` ("merge task-w5-a"), the last
code-bearing commit: `.github/workflows/ci.yml` +12 lines adding the
`render-sweep` job. Verified `git show 64ec7de:.github/workflows/ci.yml`
contains `render-sweep:` (line 87) / `npm run gate:render-sweep` (line 97),
and `git merge-base --is-ancestor 2dd2f33 64ec7de` succeeds (descends from
the campaign-3 reset). Frozen sha: **`64ec7de`**. The working tree's code
(everything except `docs/verification-log.md`) is identical between
`64ec7de` and current `main` HEAD (`5ee31ae`), since the four intervening
merges are verification-log-only; `npm run build` + `npm test --silent`
were run directly in this worktree (checked out from `main`) as an
equivalent proxy.

`npm run build`: PASS (tsc x2 + vite build, no errors).
`npm test --silent`: PASS — 151 test files, 1308 tests, 0 failures.

**STEP 2a — SPEC §8/9 + README/CI audit.**
- README quickstart (`npm i` / `npm run db:migrate` / `npm run seed` /
  `npm run dev`) matches `package.json` scripts verbatim (`README.md:18-23`
  vs `package.json` scripts block). README's "Dev: render-sweep gate"
  section (`README.md:34-46`) documents `npm run gate:render-sweep`
  (`package.json` scripts: `"gate:render-sweep": "tsx scripts/render-sweep.ts"`),
  matching DEC-165/166.
- README evaluator credentials (`README.md:71-76`) match
  `docs/fixtures/sample-data.json` `identities.{organizer,speaker,speaker2,
  reviewer}.{email,password}` verbatim (checked programmatically — all 4
  email/password pairs match exactly).
- `.github/workflows/ci.yml` has four jobs: `build-and-test` (npm run
  build + bundle:check + test, lines 13-24), `perf-smoke` (line 26),
  `walkthrough` (line 57), `render-sweep` (line 87-97: `npx playwright
  install --with-deps chromium` then `npm run gate:render-sweep`, no
  manual migrate/seed steps — DEC-166 shape, the script self-boots its own
  migrated/seeded `wrangler dev`).
- SPEC.md §9's four invariants each map to a passing regression test:
  close-date lock -> `test/edit-lock.test.ts`, `test/submit-core.test.ts`;
  speaker isolation (cross-account IDOR) ->
  `test/task-file-access.test.ts` ("403s for another speaker (IDOR)");
  hidden-speaker exclusion -> `test/headshot-gate.test.ts` ("404s
  unauthenticated when the speaker isn't publicly visible
  (pending/hidden)"); decision-never-auto-emails ->
  `test/spec9-invariants.test.ts` (`updateSubmissionStatuses` pending ->
  declined never touches `schema.emailLog`). All four run green in the
  151/1308 suite above.

**STEP 2b — DEC-139 eval-findings mandate audit (file:line citations).**
- **Section A (CLOSED).** `wrangler.jsonc:11` `"html_handling": "none"`,
  locked by `test/admin-assets-config.test.ts:53-54`
  (`expect(config.assets.html_handling).toBe('none')`).
  `app/src/pages/submissions/SubmissionsTable.tsx:53-55` reads
  `apiGet<{fields}>('/events/:id/forms').then(r => r.fields)` (not
  `apiList(...).items`); render-tested by
  `app/src/pages/submissions/Submissions.render.test.tsx`.
- **Section B (CLOSED).**
  - Plan-date guards: `app/src/lib/dates.ts:40-45` (`formatDate`),
    `:54-64` (`formatDateOnly`, DEC-146/153, "—" for null/NaN/invalid),
    used across `app/src/pages/review/*`; render-tested by
    `app/src/pages/review/Review.render.test.tsx`.
  - Reviewer queue/membership: `src/server/repo/events.ts:61`
    `listEventsForReviewer`, wired into `GET /events` per
    `test/events-reviewer-access.test.ts` (DEC-141, "GET
    /api/v1/events must stay reachable for reviewers").
  - Populated `.ics` via id-encoding (DEC-140):
    `test/itinerary-roundtrip.test.ts:1,134` ("DEC-140 itinerary id
    round-trip (schedule HTML -> schedule.ics)"); `src/lib/itinerary.ts`.
  - Overlap lanes clickable (DEC-140): `src/lib/overlap-lanes.ts:1-7`
    (pure lane-assignment so every block's checkbox stays clickable).
  - Portal-profile surfaced to organizer (DEC-142/152):
    `src/routes/api/contacts.ts:182` ("CNT-10 (DEC-152, DEC-142): admin
    bio/social-link editing"), `app/src/pages/contacts/ContactDrawer.tsx:167`;
    tested by `test/contact-profile-roundtrip.test.ts`,
    `test/contacts-profile-admin.test.ts`.
  - CSV import persists + dupes flagged (DEC-143):
    `src/domain/contacts.ts:36` (near-dupe grouping "sub-grouped by
    normalized company per DEC-143"); import persistence tested by
    `test/contacts-import.test.ts`, `test/contacts-repo.test.ts`; dedupe
    by `test/contacts.test.ts`.
- **Section C (fixed-or-waived, cited to DEC-147..156) — all items
  resolved.** `src/decisions.ts:152-161` DEC_147 (per-round scorecards,
  ABS-01) / DEC_148 (free-text criterion, ABS-03) / DEC_149 (CRM
  multi-criteria filters, CRM-02) / DEC_150 (bulk-email template parity +
  dashboard, CRM-11/12) / DEC_151 (public drill-ins + search, EMB-02/05/08/13)
  / DEC_152 (admin bio/headshot editing, CNT-10, extends DEC-142) /
  DEC_153 (date-only display fix, TZ off-by-one) / DEC_154 (NotFound +
  sign-out) / DEC_155 (agenda publish + accepted-only tray) / DEC_156
  (push-to-event, CRM-10) — each C item traces to one of these; no waived
  item found.
- **Section D (FIXED per DEC-157..161) — all items resolved.**
  `src/decisions.ts:162-166` DEC_157 (pipeline) / DEC_158 (revisions) /
  DEC_159 (files library) / DEC_160 (ZIP) / DEC_161 (render-smoke policy).
  Verified in tree: `src/server/repo/pipeline.ts` + `src/routes/api/
  pipeline.ts` + `migrations/0012_pipeline.sql` + 4th ContactsApp tab
  (`app/src/pages/contacts/ContactsApp.tsx:9,92,157` `PipelineBoard`).
  `src/server/repo/revisions.ts` + `migrations/0013_submission_
  revision.sql`. `src/lib/zip.ts` + `src/routes/files.ts` (archive
  endpoint) + `src/server/repo/files.ts`. AIA-07 publish:
  `src/routes/agenda.ts:90,100` `POST .../agenda/publish`, tested by
  `test/agenda-publish.test.ts:78`. AIA-08 accepted-only unscheduled tray:
  `test/agenda-repo.test.ts:98` ("getAgendaPayload unscheduled tray
  (AIA-08: accepted-only)"). Sign-out (DEC-154): `app/src/App.tsx:102`,
  `src/routes/portal/shared.tsx:48`, tested by `app/src/App.render.
  test.tsx:33`. NotFound catch-all: `app/src/App.tsx:22,36,141`
  (`<Route path="*" element={<NotFoundPage />} />`). Labeled
  contact-editor inputs: `app/src/pages/contacts/ContactDrawer.tsx:129-191`
  (`htmlFor` on first/last name, email, company, title, phone, notes,
  custom fields, bio, headshot-upload).
- **Section E (seed, REQUIRED) — CLOSED.** `scripts/seed.ts:704-741`
  demo speaker (Priya Raman) gets an accepted submission +
  onboarding tasks (`:906-929`); `:1186-1244` v1->v2 file-version chain
  (`previous_file_id` at `:1228`) + `file_comment` thread (`:860-873`) on
  that submission; `:213-489` headshot-bearing contacts + near-duplicate
  "Priya"/"Marcus Okafor" contacts (DEC-145).
- **Section F (permanent gates) — CLOSED.** 17
  `app/src/**/*.render.test.tsx` files confirmed by `find` (App, Overview,
  Settings, Speakers, FormsPage, ContactsApp x2, PipelineBoard,
  BulkEmailModal, Comms, ContentApp, FilesLibrary, Review, Scorecard,
  SubmissionDetailPage, Submissions, Agenda). `scripts/render-sweep.ts`
  exists; wired into CI as the `render-sweep` job (`.github/workflows/
  ci.yml:87-97`, confirmed above).

**No genuine gaps found.** Every DEC-139-mandated eval-findings item
(Sections A-F) has file:line evidence in the tree at `64ec7de`; SPEC §8/9
README/CI/invariant checks all pass; build + full test suite (1308 tests)
green in this worktree.

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

DEC-144/DEC-139 sixth gate, rebound per DEC-176/177 substitutions with S =
the `task-w8-a` merge commit. Frozen sha derivation (first-parent walk on
`main`, skipping bookkeeping): `git log --first-parent --oneline` shows
`38860f9` ("merge task-w8-a") as the current `main` tip, directly after
"scribe wave 9" (`a8a4785`) and "scribe wave 8" (`5d3acae`) — no
bookkeeping commits sit after it to skip. `git merge-base --is-ancestor
2dd2f33 38860f9` succeeds (descends from the DEC-129 homonym-guard
commit).

Full DEC-177 precondition grep list, all present at `38860f9`:
- six w6 anchors: `DEC-167` in `src/domain/contacts.ts`;
  `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts`; `unknown track id` in
  `src/routes/api/forms.ts`; `anonymized === false` in
  `src/server/repo/files.ts`; `openDate` in
  `app/src/pages/review/PlanEditor.tsx`; `FORM_TASK_FIELD_SPECS` in
  `scripts/seed.ts`.
- harness-closure anchors: `DEC-173` in `scripts/walkthrough/public.ts`
  and `scripts/walkthrough/speaker.ts`; `DEC-174` in `scripts/seed.ts`;
  `DEC-175` in `scripts/walkthrough/producer.ts`,
  `scripts/walkthrough/speaker.ts`, and `scripts/walkthrough/review.ts`.

No miss — gate proceeds (not a precondition FAIL).

Fresh worktree checked out directly at `38860f9`
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w8-e`).
Procedure, following `task-w5-e — render-sweep @ 64ec7de` as the model:
`npm ci` (cached, silent), `npm run build` (PASS — dual `tsc --noEmit` +
`vite build --config app/vite.config.ts`, 131 modules transformed, admin
SPA bundle emitted to `public/admin/`), `npx playwright install chromium`
(already cached), then `npm run gate:render-sweep`. The script self-drove
its full documented sequence: `wrangler d1 migrations apply --local`,
`scripts/seed.ts` + `.seed.sql` D1 load, `scripts/seed-r2.ts` (8 R2
objects), then booted `wrangler dev` on a self-selected free port
(50590), logged in via the real `/login` form as each of
organizer/reviewer/speaker from `docs/fixtures/sample-data.json`, then
visited every `app/src/routeManifest.ts` entry.

Route surface: **31 routes enumerated**, per-role breakdown: organizer
16 (`/admin/overview`, `/admin/submissions`,
`/admin/submissions/forms`, `/admin/submissions/seed_submission_0001`,
`/admin/speakers`, `/admin/content`, `/admin/agenda`, `/admin/comms`,
`/admin/contacts`, `/admin/settings`, `/admin/review`,
`/admin/review/plans/new`,
`/admin/review/plans/seed_evaluation_plan_0001`,
`/admin/review/plans/seed_evaluation_plan_0001/progress`,
`/admin/review/plans/seed_evaluation_plan_0001/results`, `/admin/*` SPA
catch-all), reviewer 3 (`/admin/review`,
`/admin/review/plans/seed_evaluation_plan_0001`,
`/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002`),
speaker 6 (`/portal`, `/portal/submissions/seed_submission_0001`,
`/portal/submissions/seed_submission_0001/edit`, `/portal/profile`,
`/portal/tasks`, `/portal/tasks/seed_task_assignment_0001/form`),
public 6 (`/e/devflow-conf-2027/sessions`,
`/e/devflow-conf-2027/speakers`, `/e/devflow-conf-2027/gallery`,
`/e/devflow-conf-2027/agenda`, `/e/devflow-conf-2027/schedule`,
`/submit/devflow-conf-2027`).

**31/31 PASS.** Both persistent w4-e/w5-e failures are fixed on this
line, confirming the corresponding decisions landed correctly:

1. `/admin/review/plans/seed_evaluation_plan_0001` (organizer, SPA) —
   now PASS. DEC-171 PlanEditor wire conformance (merged `task-w6-e`,
   `openDate`/`closeDate` wire-name alignment in
   `app/src/pages/review/PlanEditor.tsx`) resolved the prior
   `TypeError: Cannot read properties of undefined (reading 'includes')`
   crash; `#root` now renders non-empty with zero console/page errors.
2. `/portal/tasks/seed_task_assignment_0001/form` (speaker, SSR) — now
   PASS. DEC-172 seed backing forms + manifest pin (merged `task-w6-f`)
   resolved the prior HTTP 400; DEC-174's task-w8-a mod-3/pending-task
   override (`scripts/seed.ts`) did not disturb the pin — the seeded
   task assignment still resolves to a backing form and renders
   HTTP 200.

No other route failures observed; all organizer, reviewer, speaker, and
public routes clean. Script printed `gate:render-sweep OK` with exit 0.

OPEN ITEMS: 0
RESULT: PASS

## 2026-08-10 task-w8-c — walkthrough @ 38860f9

Wave-8 exit-gate battery (DEC-069/139/176/177 rebinding), walkthrough
lane, log-only (no code changes). Fresh worktree cut from `main` tip.

**STEP 1 — sha derivation, ancestor check, precondition greps.**
`main` HEAD was `38860f9` ("merge task-w8-a", merging `52dd2b2` "w8-a:
harness-closure lane — DEC-173/174/175 walkthrough fixes + authz
probes" on top of `a8a4785` "scribe wave 9"). Per DEC-114 first-parent
walk, this merge commit is the newest non-bookkeeping (code-bearing)
commit and is the DEC-177-designated S for wave 8. Worktree
`task-w8-c` branched directly from `main`, confirmed at `38860f9`.

`git merge-base --is-ancestor 2dd2f33 38860f9` exits 0 — DEC-139
ancestor check passes.

DEC-177 precondition grep list, all found present at `38860f9`:
- six w6 fixes: `DEC-167` comment in `src/domain/contacts.ts:165`;
  `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15`; `"unknown track id"`
  in `src/routes/api/forms.ts:113`; `"anonymized === false"` in
  `src/server/repo/files.ts:153`; `openDate` in `app/src/pages/
  review/PlanEditor.tsx:107,138,143`; `FORM_TASK_FIELD_SPECS` in
  `scripts/seed.ts:19,909,931`.
- harness closure: `DEC-174` in `scripts/seed.ts:975`; `DEC-173` in
  `scripts/walkthrough/public.ts:440` and `scripts/walkthrough/
  speaker.ts:923`; `DEC-175` in `scripts/walkthrough/producer.ts:773`,
  `scripts/walkthrough/speaker.ts:1156,1162,1167`, and `scripts/
  walkthrough/review.ts:312,321,603`.

No precondition miss — gate proceeds.

**STEP 2 — install/build/migrate/seed/wrangler-dev/walkthrough.**
`npm ci` (node_modules already present, skipped per gate script). `npm
run build`: clean (`tsc --noEmit` x2 + `vite build`, 131 modules, no
errors). `rm -rf .wrangler/state` then `npm run db:migrate`: **13
migrations applied** — `0000_secret_matthew_murdock` through
`0010_round_criteria`, then `0012_pipeline`, `0013_submission_
revision` (the `0011` gap is the DEC-164-sanctioned numbering skip).
`npm run seed`: completed clean, 8 objects put into local R2 bucket
`chautauqua-files`, no errors. Started `npx wrangler dev --port 8822`
in the background; `GET /health` returned `{"ok":true}` (200) on the
first poll.

`npm run walkthrough -- --url http://localhost:8822` ran all six
modules in the fixed DEC-062 order (producer -> review -> speaker ->
public -> data -> scale) in a single orchestrator invocation with
**zero FAILs** — the orchestrator did not halt, so no individual
per-module re-runs were needed.

Per-area results:
- **producer**: J1/J2/J3/J5 all `ok`, plus the DEC-175 unauthenticated-
  probe block `ok`. PASS.
- **review**: 19/19 checks PASS, including both DEC-175 out-of-scope
  probes (`reviewer GET of an out-of-scope submission's review detail
  -> 404 (not 403)`, `reviewer PUT evaluation for an out-of-scope
  submission -> 404 (not 403)`) and DEC-039 cross-org 404s. PASS.
- **speaker**: all checks PASS, specifically including `find my own
  general task's assignment id via /portal/tasks` and `complete a
  general task via its own form action` — the DEC-174 seed override
  (`contactIdx 0` / "Announce participation" forced to `pending`)
  unblocked this round-trip that was FAIL at `64ec7de` (task-w5-c).
  All 8 DEC-175 speaker-lens probes (`speaker2 GET speaker1's portal
  submission -> 404`, task-assignment form GET/POST/complete -> 403,
  uploaded file GET -> 403, speaker-session-on-organizer-API GET
  `/api/v1/events/:id/submissions`/`/api/v1/contacts`/`/api/v1/
  events/:id/email-log` -> 403) all PASS. PASS.
- **public**: all checks PASS, specifically including `J10 /speakers:
  alphabetical by surname, headshot/title/company` — the DEC-173
  anchor-tolerant extractor unblocked this check that was FAIL at
  `64ec7de` (task-w5-c). PASS.
- **data**: J11/J12 all PASS (contact search/create/CSV-import/
  history/dedupe-merge/segment/bulk-email+cap/dashboard-stats; bearer
  token mint/cookie-less GET/revocation/role-403/exports/showflow.csv/
  cross-org 404/`/docs/api`). PASS.
- **scale**: all 6 steps PASS (110 fresh contacts+submissions+
  participants; bulk-accept of 110 ids; onboarding task_assignments
  sampled for 5 fresh contacts; re-accept exactly-once; no auto-email
  on bulk status change; purge-refresh probe). PASS.

Server killed after the run (`kill -9` on the `wrangler dev --port
8822` process, its `esbuild --service` helper, and the surviving
`workerd` child that outlived the parent); `lsof -i :8822` confirmed
empty (port free). An unrelated sibling worktree (`task-w9-a`) was
observed running `wrangler dev --port 8831` concurrently on the same
machine and was left untouched (different port, out of scope, expected
per DEC-176's concurrent-sibling-gate precedent).

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

Wave-9 exit-gate battery (DEC-069/176/177/178 rebinding), spec-audit
lane, log-only (no code changes). Fresh worktree cut from `main` tip
`25e81f9` ("merge task-w8-c").

**S derivation**: DEC-178 names S "the 'merge task-w9-a' commit"; on
this main history the harness-closure lane actually landed under the
branch/commit name `task-w8-a` (`52dd2b2`/`38860f9`) rather than a
literally-named `task-w9-a` — a wave-renumbering naming artifact, not a
functional discrepancy (its content is exactly DEC-178's described
sole code-bearing lane: scripts/**-only, DEC-173/174/175). Sibling
gate `task-w9-b` independently derived and used this same
`S=38860f9`; the already-merged `task-w8-c` walkthrough section ran
its 6/6-module walkthrough against this same sha. Adopted `S=38860f9`
for consistency across the battery. `git merge-base --is-ancestor
2dd2f33 38860f9` — exit 0.

All twelve DEC-177/178 precondition greps present at S (six w6
anchors: DEC-167 in contacts.ts, ICS_ORGANIZER_EMAIL in ics.ts,
"unknown track id" in forms.ts, "anonymized === false" in files.ts,
openDate in PlanEditor.tsx, FORM_TASK_FIELD_SPECS in seed.ts; plus
closure anchors: DEC-173 in walkthrough/public.ts + speaker.ts, DEC-174
in seed.ts, DEC-175 in walkthrough/producer.ts + speaker.ts +
review.ts) — no miss, gate proceeds.

Delta scope `git diff 64ec7de..38860f9 --stat` (43 files, +1992/-280):
every non-merge commit in range classified; the only code-bearing
changes are the six wave-6 fix lanes (task-w6-a..f, DEC-167/168/169/
170/171/172) plus task-w9-a's scripts/**-only closure (DEC-173/174/
175, commit `52dd2b2`). Everything else in range is either scribe
bookkeeping (decisions/*.md, field-guide/index.md, src/decisions.ts
registry appends — task-w6/7/8/9 scribe commits) or wave-5 battery
verification-log entries whose branch tips postdate `64ec7de` in
first-parent order (task-w5-b/c/d/e/f/g, task-w4-d/g carried forward).
`docs/verification-log/task-w5-b-build-test.md` is rewritten by
`f369590`, but that is task-w5-b's own per-task detail file being
superseded by its own re-run — the shared `docs/verification-log.md`
itself only gained new sections in this range, no append-only (DEC-015)
violation. No unexpected code-bearing change found.

Re-audit: README quickstart (`npm i`/`db:migrate`/`seed`/`dev`) matches
`package.json` scripts and SPEC.md §8 verbatim; README's evaluator
credential table matches `docs/fixtures/sample-data.json`'s
email/password fields byte-for-byte (organizer/speaker/speaker2/
reviewer); `.github/workflows/ci.yml` still carries `build-and-test`,
`perf-smoke`, `walkthrough` (DEC-063), and `render-sweep` (DEC-166) as
top-level jobs; SPEC §9's four invariants each map to an existing,
non-trivial test file (close-date lock: test/edit-lock.test.ts +
test/submit-core.test.ts; speaker isolation: test/task-file-access.
test.ts; hidden-speaker exclusion: test/headshot-gate.test.ts;
decision-never-auto-emails: test/spec9-invariants.test.ts). These
files (README/package.json/ci.yml) are unchanged between S and this
worktree's HEAD (`git diff 38860f9..HEAD` on them is empty).

W6-fix regression coverage: all six of DEC-167..172 have an in-tree
test — DEC-167 test/contacts.test.ts:139,156; DEC-168 fail-loud
METHOD/ATTENDEE guards at src/mail/ics.ts:158-161 exercised by
test/compose-ics.test.ts + test/mail.test.ts; DEC-169 test/forms-api.
test.ts:229 "rejects an unknown track id"; DEC-170 test/reviewer-file-
access.test.ts (assigned/cross-track/anonymized-only fixtures); DEC-171
app/src/pages/review/Review.render.test.tsx (explicit null/typed
openDate cases) + Scorecard.render.test.tsx:25; DEC-172 test/seed.
test.ts:292,328 (FORM_TASK_FIELD_SPECS-backed form_id + render-sweep
TASK_ASSIGNMENT_ID pinning). No missing test found.

`npm run build`: PASS, 0 tsc errors, vite build clean (131 modules,
entry 180.16 kB / gzip 58.90 kB). `npm test --silent`: PASS, **151
test files / 1332 tests**, 0 failures, 15.45s — matches sibling
task-w9-b's independently-recorded count at the same S.

Full detail: `docs/verification-log/task-w9-f-spec-audit.md`.

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

DEC-069/DEC-088/DEC-139/DEC-176/DEC-177 gate, wave-8/9 battery (S = the
`task-w8-a` harness-closure merge). Log-only lane; full detail also in
`docs/verification-log/task-w8-d-perf-smoke.md`.

**STEP 1 — frozen sha.** First-parent walk from `main` tip in a fresh
worktree: `main` HEAD is `38860f9` ("merge task-w8-a"), immediately
preceded (first-parent) by `a8a4785` ("scribe wave 9"), `5d3acae`
("scribe wave 8"), `466f45b` ("scribe wave 7") — all doc-only bookkeeping
— and `38860f9` is itself code-bearing (it is the merge of
`52dd2b2`, "w8-a: harness-closure lane — DEC-173/174/175 walkthrough
fixes + authz probes"). No further code-bearing commit sits after it, so
S = `38860f9`. `git merge-base --is-ancestor 2dd2f33 38860f9` exits 0 —
PASS. `git show 38860f9:.github/workflows/ci.yml` contains
`render-sweep:` (line 87) / `npm run gate:render-sweep` (line 97).
Adopted sha: **`38860f9`**.

DEC-177 precondition grep list (six w6 fixes + harness closure), all hit
in this worktree at S:
- `DEC-167` in `src/domain/contacts.ts:165`
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15`
- `"unknown track id"` in `src/routes/api/forms.ts:113`
- `"anonymized === false"` in `src/server/repo/files.ts:153`
- `openDate` in `app/src/pages/review/PlanEditor.tsx:107,143`
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts:19,909,931`
- `DEC-174` in `scripts/seed.ts:975`
- `DEC-173` in `scripts/walkthrough/public.ts:440`
- `DEC-173` in `scripts/walkthrough/speaker.ts:923`
- `DEC-175` in `scripts/walkthrough/producer.ts:773,776,781,784,787,792,833`
- `DEC-175` in `scripts/walkthrough/speaker.ts:1156-1197`
- `DEC-175` in `scripts/walkthrough/review.ts:312,321,603,612,617,627,632`

No miss — proceeding to the gate.

**STEP 2.** `npm ci --prefer-offline --no-audit --no-fund --silent`
(clean). `npm run build` — PASS (dual `tsc --noEmit` + `vite build`, 131
modules transformed, no errors). `rm -rf .wrangler/state` — fresh
worktree, nothing present. `npm run db:migrate` — 13 migrations
(`0000`-`0010`, `0012`, `0013`) applied clean. `npm run seed` — required
first (per this gate's instructions: `perf:seed` alone seeds no
login-capable identity); ran clean, 8 R2 objects uploaded to local bucket
`chautauqua-files`. `npm run perf:seed` — first attempt's
`wrangler d1 execute --file=.perf-seed.sql` step failed transiently
(`ERROR other side closed` after ~19s, a miniflare/workerd hiccup, not a
data or schema issue — `tsx scripts/perf-seed.ts` itself, which writes
`.perf-seed.sql`, completed fine both times); re-ran
`npx wrangler d1 execute chautauqua --local --file=.perf-seed.sql`
directly and it completed clean, every batch reporting `"success": true`
(no `false` anywhere in the output). Verified DEC-088 scale directly in
D1: `SELECT count(*) FROM submission WHERE id LIKE 'seed_perf_%'` = 2000;
`... AND status='accepted'` = 300 (12 reviewers were seeded per the
script's fixed scale, not independently re-queried here).

`npx wrangler dev --port 8823` (never 8787/8801/8821/8822) started in the
background; polled `GET /health`, got `{"ok":true}` (200).

`PERF_URL=http://localhost:8823 npm run perf:smoke` — **run 1: exit 0**
("perf:smoke OK"). **Run 2: exit 0** ("perf:smoke OK"), both confirmed
via the tee'd log + `$?`. Full p95 tables (budget 150ms, all `ok` both
runs):

Run 1:
```
submissions list (page 1)            11.8ms  ok
submissions list (q=Kubernetes)      12.5ms  ok
submission detail                    17.8ms  ok
event overview                       14.3ms  ok
organizer agenda (300 accepted)      24.4ms  ok
public sessions page                  3.5ms  ok
public agenda                         6.3ms  ok
schedule.ics 150 ids                 34.7ms  ok
plan progress (12 reviewers)         18.9ms  ok
rating PUT                            9.0ms  ok
```

Run 2:
```
submissions list (page 1)            24.2ms  ok
submissions list (q=Kubernetes)      38.8ms  ok
submission detail                    46.5ms  ok
event overview                       38.7ms  ok
organizer agenda (300 accepted)      38.5ms  ok
public sessions page                 11.3ms  ok
public agenda                        18.5ms  ok
schedule.ics 150 ids                 94.3ms  ok
plan progress (12 reviewers)         33.9ms  ok
rating PUT                           27.2ms  ok
```

Run 2's latencies are uniformly higher than run 1's (still all well
under the 150ms budget) — consistent with shared-machine warm-cache
variance from a concurrent sibling lane rather than a regression; both
runs pass every row.

DEC-080 301-id schedule.ics cap assertion: `perf-smoke.ts` throws
synchronously (untimed, before the measured loop) on any non-400
response to the 301st synthetic nonexistent `schedule.ics` id request —
the clean `perf:smoke OK` exit on both runs confirms this assertion
passed both times; the script prints no separate line for it.

Server killed (`pkill -f "wrangler dev --port 8823"`); `lsof -i :8823`
confirms the port is free.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w9-c — walkthrough @ 38860f9

Wave-9 exit-gate battery (DEC-069/176/177/178), walkthrough lane,
log-only (no code changes). Full detail in
`docs/verification-log/task-w9-c-walkthrough.md`. Summary:

DEC-178 names S as "the `merge task-w9-a` commit," but no such commit
exists in this wave's actual first-parent history off `main` tip
`aa7bf95` (this worktree's branch point). Per DEC-114's mechanical
code-bearing-commit rule, the correct frozen S is the newest
code-bearing commit reachable, `38860f9` ("merge task-w8-a", merging
`52dd2b2`: "w8-a: harness-closure lane — DEC-173/174/175 walkthrough
fixes + authz probes") — the DEC-178-mandated content shipped one
wave-label early. `aa7bf95` and its `task-w8-b` parent diff docs-only,
so are non-code-bearing. This is the same S already used by
`task-w8-c`'s walkthrough gate and `task-w8-e`'s render-sweep gate.
`git merge-base --is-ancestor 2dd2f33 aa7bf95` exits 0 (DEC-139
passes).

All 12 DEC-177/178 precondition anchors (six w6 anchors + DEC-173/174/
175 closure anchors) re-verified present at this worktree. Fresh
worktree: `npm ci` (cached), `npm run build` clean, `rm -rf
.wrangler/state`, `npm run db:migrate` (13 migrations), `npm run seed`
clean, `wrangler dev --port 8832`, `/health` 200. `npm run walkthrough
-- --url http://localhost:8832` ran producer -> review -> speaker ->
public -> data -> scale in DEC-062 order with **zero FAIL/PLANNER:
lines**.

**(a)** speaker's `find my own general task's assignment id via
/portal/tasks` + `complete a general task via its own form action`
round-trip (FAIL at `64ec7de` task-w5-c) now PASSES — DEC-174 override
live. **(b)** public's `J10 /speakers: alphabetical by surname,
headshot/title/company` (FAIL at `64ec7de` task-w5-c) now PASSES —
DEC-173 anchor-tolerant extractor. **(c)** DEC-175 authz probes
confirmed executed and `ok` in all three lenses: producer's
unauthenticated block (`DEC-175 unauthenticated GET /admin -> 302`,
`.../api/v1/contacts -> 401`, `.../api/v1/review/plans -> 401`,
`.../files/:id -> 401`); review's out-of-scope reviewer block (`DEC-175
reviewer GET of an out-of-scope submission's review detail -> 404 (not
403)`, `DEC-175 out-of-scope detail probe is not 403
(existence-hiding, not authz-denial)`, and the matching PUT-evaluation
pair, both 404-not-403); speaker's cross-speaker/cross-role block (8
checks, `DEC-175 speaker2 GET speaker1's portal submission -> 404
(existence-hiding)` plus 7 more, correct 404/403 mix).

Server killed (full `wrangler dev --port 8832` process tree —
`npm`/`wrangler` CLI/`workerd` — via `kill -9` across all PIDs in two
rounds, `workerd` respawned once under a new PID before the second
round cleared it); `lsof -i :8832` confirms the port is free.

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

DEC-069/DEC-139/DEC-176/DEC-177 gate-of-gates. Log-only lane. Full detail
also in `docs/verification-log/task-w8-g-triage-closure.md`.

**STEP 1 — sha derivation, ancestor check, DEC-177 preconditions.**
Identical derivation to `task-w8-b`: first-parent walk from `main`
lands on `38860f9` ("merge task-w8-a") directly, immediately preceded
by the doc-only `a8a4785` ("scribe wave 9") and `5d3acae` ("scribe
wave 8") — both bookkeeping (DEC-114) — so `38860f9` is the newest
code-bearing first-parent commit and is S. `git merge-base
--is-ancestor 2dd2f33 38860f9` exits 0 (descends from the campaign-3
reset, DEC-129 homonym guard satisfied). All twelve DEC-177
precondition greps hit at S (re-verified directly, matching
`task-w8-b`/`task-w8-d`/`task-w8-e`/`task-w8-c` verbatim): `DEC-167`
in `src/domain/contacts.ts`; `ICS_ORGANIZER_EMAIL` in
`src/mail/ics.ts`; `"unknown track id"` in `src/routes/api/forms.ts`;
`"anonymized === false"` in `src/server/repo/files.ts`; `openDate` in
`app/src/pages/review/PlanEditor.tsx`; `FORM_TASK_FIELD_SPECS` in
`scripts/seed.ts`; `DEC-174` in `scripts/seed.ts`; `DEC-173` in
`scripts/walkthrough/public.ts` and `scripts/walkthrough/speaker.ts`;
`DEC-175` in `scripts/walkthrough/producer.ts`,
`scripts/walkthrough/speaker.ts`, and `scripts/walkthrough/review.ts`.
No precondition miss — gate proceeds (not a precondition FAIL).

**STEP 2(a) — sibling battery, all at S = `38860f9`.** All five
required sibling sections are present in this file at the same S,
each ending `RESULT: PASS`:
- `task-w8-b — build+test @ 38860f9` — PASS (151 files / 1332 tests,
  build clean, bundle 58.86 kB gzip under 300 kB budget).
- `task-w8-c — walkthrough @ 38860f9` — PASS (6/6 modules: producer,
  review, speaker, public, data, scale; OPEN ITEMS: 0).
- `task-w8-d — perf-smoke @ 38860f9` — PASS (both runs, full p95
  table under the 150ms budget, DEC-080 301-id cap assertion held).
- `task-w8-e — render-sweep @ 38860f9` — PASS (31/31 routes; both
  persistent `task-w4-e`/`task-w5-e` FAILs — plan-detail SPA crash and
  speaker task-form 400 — now confirmed fixed).
- `task-w8-f — spec-audit @ 38860f9` — PASS (OPEN ITEMS: 0, delta vs
  `d8d1cbd` audited clean, zero secrets/credentials in the diff).

All five PASS at one S — battery complete, proceeding.

**STEP 2(b) — PLANNER marker harvest.** `git log --format='%h %B'
2dd2f33..38860f9 | grep 'PLANNER:'` returns zero hits — no literal
`PLANNER:` commit-message markers in range. Nothing to disposition;
`task-w8-a`'s product-defect probe did not fire.

**STEP 2(c) — eval-findings.md mandate closure.** `docs/
eval-findings.md` (not edited by this lane) Sections A/B/E/F closure
evidence is catalogued in-tree by `task-w4-g — triage-closure @
d8d1cbd` (this file, above) and re-verified by `task-w5-g —
triage-closure @ 5ee31ae` (this file, above): Section A —
`test/admin-assets-config.test.ts`,
`app/src/pages/submissions/Submissions.render.test.tsx`; Section B —
`app/src/lib/dates.ts` + `app/src/pages/review/Review.render.test.tsx`,
`test/events-reviewer-access.test.ts`,
`test/itinerary-roundtrip.test.ts`, `test/overlap-lanes.test.ts`,
`test/contact-profile-roundtrip.test.ts` +
`test/contacts-profile-admin.test.ts`, `test/contacts-import.test.ts`,
`test/contacts.test.ts`; Section E — `test/seed.test.ts`; Section F —
`scripts/render-sweep.ts` + `scripts/render-sweep-lib.ts` +
`test/render-sweep-lib.test.ts` and the 17
`app/src/**/*.render.test.tsx` component smokes. Every one of these
files was confirmed present at S via `git cat-file -e 38860f9:<path>`
(no miss). `task-w5-g` carried forward OPEN ITEMS: 2 — the two
render-sweep route FAILs against `d8d1cbd` (plan-detail SPA crash,
speaker task-form 400) — which `task-w8-e — render-sweep @ 38860f9`
(above) explicitly re-swept and confirmed both now PASS, attributing
the fixes to the wave-6 DEC-171 (`PlanEditor` wire-name alignment,
merged `task-w6-e`) and DEC-172 (seed backing-forms + manifest pin,
merged `task-w6-f`) landings. Combined with the wave-6 DEC-167..172
fix set (contact-merge field preservation, RFC-5546 `.ics`
ORGANIZER/ATTENDEE, form-tracks validation, reviewer file-access
plan-scoping, review SPA wire conformance, form-kind backing forms —
all re-grep-confirmed present at S per STEP 1 above) and this wave's
DEC-173/174/175 harness closure (anchor-tolerant public extractor,
seed mod-3/pending-task override, authz probes — all landed in
`task-w8-a`/`52dd2b2` and exercised PASS by `task-w8-c`'s walkthrough
above), every eval-findings.md Section C item tied to a w5-c/w5-e open
item is closed. No planner waiver needed; no gap found.

**STEP 2(d) — build+test at S.** Fresh worktree
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w8-g`)
checked out detached at `38860f9`. `npm ci --prefer-offline --no-audit
--no-fund --silent` clean (node_modules already present). `npm run
build` — PASS (dual `tsc --noEmit` + `vite build`, 131 modules
transformed, 19 output assets, no errors). `npm test --silent` — PASS:
**151 test files / 1332 tests, all green, 0 failures.**

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

LOG-ONLY wave-9 battery capstone (DEC-069/139/176/177/178). Fresh
worktree of `main` tip `916963e` ("merge task-w9-f"), the branch point
after this task's prerequisite `task-w9-e` (and sibling `task-w9-f`)
had already merged. No code touched; only this file and
`docs/verification-log/task-w9-g-triage-closure.md` appended.

**STEP 1 — sha derivation.** DEC-178 names S as "the `merge task-w9-a`
commit." Two commits literally titled `merge task-w9-a` exist in this
worktree's full history (`8026fad`, `56ddb09`), but both predate
`2dd2f33` (`git merge-base --is-ancestor 2dd2f33 8026fad` and `...
56ddb09` both fail) — first-campaign homonyms per DEC-129, not this
wave's work. All five already-merged wave-9 siblings
(`task-w9-b/c/d/e/f`) independently derived the same resolution and
recorded it in their own sections (cited below): the actual DEC-178
harness-closure lane landed under the reused branch name `task-w8-a`
(commit `52dd2b2`, merged as `38860f9`), a wave-relabeling artifact,
not a functional gap — its content is exactly DEC-178's described
sole code-bearing lane (`scripts/**`-only, DEC-173/174/175). Adopting
`S = 38860f9` for consistency with every sibling. `git merge-base
--is-ancestor 2dd2f33 38860f9` — exit 0 (DEC-139 ancestry holds).

DEC-178 precondition grep set, re-verified directly via `git show
38860f9:<path>` in this worktree (no miss): `DEC-167` in
`src/domain/contacts.ts:165`; `ICS_ORGANIZER_EMAIL` in
`src/mail/ics.ts:15`; `"unknown track id"` in
`src/routes/api/forms.ts:113`; `"anonymized === false"` in
`src/server/repo/files.ts:153`; `openDate` in
`app/src/pages/review/PlanEditor.tsx:107,143`; `FORM_TASK_FIELD_SPECS`
+ `DEC-174` in `scripts/seed.ts:19,909,931,975`; `DEC-173` in
`scripts/walkthrough/public.ts:440` and `speaker.ts:923`; `DEC-175` in
`scripts/walkthrough/producer.ts:773-792`, `speaker.ts:1156-1197`,
`review.ts:312-632`. Precondition gate proceeds.

**STEP 2 — sibling check.** `docs/verification-log.md` contains all
five required wave-9 sections, each citing `S = 38860f9` and each
ending `RESULT: PASS`:
- `task-w9-b — build+test @ 38860f9` (line ~5160): PASS, 151 test
  files / 1332 tests, 0 failures.
- `task-w9-c — walkthrough @ 38860f9` (line ~5306): PASS, 6/6 modules.
- `task-w9-d — perf-smoke @ 38860f9` (line ~5078): PASS, all budgets
  `ok`.
- `task-w9-e — render-sweep @ 38860f9` (line ~5130): PASS, 31/31
  routes.
- `task-w9-f — spec-audit @ 38860f9` (line ~5001): PASS, OPEN ITEMS 0.

No sibling absent, no sibling FAIL — battery complete. Proceeding to
STEP 3.

**STEP 3(a) — supersession of the two long-open FAIL threads.**
- Render-sweep: `task-w4-e — render-sweep @ d8d1cbd` (line 3940) and
  `task-w5-e — render-sweep @ 64ec7de` (line 4324) both recorded
  `RESULT: FAIL` — the identical 2/31 route failures
  (`/admin/review/plans/seed_evaluation_plan_0001` empty-`#root`
  TypeError; `/portal/tasks/seed_task_assignment_0001/form` HTTP 400).
  Both are superseded at `S=38860f9` by `task-w9-e — render-sweep @
  38860f9` (line 5130, 31/31 PASS, explicitly re-confirming both
  previously-failing routes now pass — DEC-171's `openDate` wire fix
  in `PlanEditor.tsx` and DEC-172's `FORM_TASK_FIELD_SPECS` seed fix
  in `scripts/seed.ts`) and independently by `task-w8-e — render-sweep
  @ 38860f9` (line 4795, also 31/31 PASS).
- Walkthrough: `task-w5-c — walkthrough @ 64ec7de` (line 4505)
  recorded `RESULT: FAIL` — the speaker "find my own general task"
  round-trip and public `/speakers` alphabetical-ordering check, both
  harness/seed-coupling bugs (not product defects, per that section's
  own root-cause analysis). Superseded at `S=38860f9` by `task-w9-c —
  walkthrough @ 38860f9` (line 5306, 6/6 modules PASS, explicitly
  re-confirming both prior FAIL points now pass: DEC-174's onboarding
  override and DEC-173's anchor-tolerant `/speakers` extractor) and
  independently by `task-w8-c — walkthrough @ 38860f9` (line 4876,
  also 6/6 PASS).

**STEP 3(b) — live `PLANNER:` marker harvest.** `git log
--format='%h %B' 2dd2f33..HEAD | grep -n '^PLANNER:'` — zero hits.
(Note, consistent with prior sibling sections: bolded prose labels
like "**PLANNER flag**" inside `task-w4-g`'s log-entry body are not
literal commit-message `PLANNER:` markers and correctly do not match.)
No live marker to disposition.

**STEP 3(c) — eval-findings.md SWARM ROUND MANDATE closure
(citation only, file not edited).** `docs/eval-findings.md:9` `##
SWARM ROUND MANDATE`. Sections A/B/E/F closure and every Section C
item fixed-or-waived is already recorded in-tree at:
`task-w4-g — triage-closure @ d8d1cbd`, `docs/verification-log.md:4103`
(Section A CLOSED), `:4113` (Section B CLOSED), `:4140` (Section C
CLOSED, by weight), `:4177` (Section D CLOSED), `:4201` (Section E
CLOSED), `:4207` (Section F CLOSED); independently re-confirmed with
file:line source citations by `task-w5-f — spec-audit @ 64ec7de`,
`docs/verification-log.md:4682` (STEP 2b, Sections A-F). Both sections
end `OPEN ITEMS: 0` and both predate `S=38860f9`; no commit touching
any cited file/section landed between their sha and `S` other than the
w6 fix lanes and the w8-a/w9-a harness-closure lane (already covered
by the w9-f delta-scope classification at `docs/verification-log.md:
5027-5040`), so the closure still holds at `S`.

**STEP 3(d) — full-ledger `RESULT: FAIL` sweep.** Enumerated every
`## ... @ <sha>` section from `task-w4-f` (line 3834, this file's
first campaign-3 section) through the end of the file and filtered to
sections whose cited sha descends from `2dd2f33` (`git merge-base
--is-ancestor 2dd2f33 <sha>`). Twenty campaign-3 sections found; three
end `RESULT: FAIL`:
1. `task-w4-e — render-sweep @ d8d1cbd` (line 3940) — superseded, see
   STEP 3(a).
2. `task-w5-e — render-sweep @ 64ec7de` (line 4324) — superseded, see
   STEP 3(a).
3. `task-w5-c — walkthrough @ 64ec7de` (line 4505) — superseded, see
   STEP 3(a).
No other campaign-3 `RESULT: FAIL` found. All non-campaign-3 sections
citing `RESULT: FAIL` in the file (pre-`2dd2f33` shas, e.g. `d12eb25`,
`3b7ed3d`, `3543f09`, `5692a6d`, and the wave-11/12 clusters) are
first-campaign homonyms per DEC-129 and out of scope for this sha's
exit predicate — already dispositioned as such by the earlier
`task-w16-e`/`task-w17-a`/`task-w17-b` triage-closure lineage in this
file (lines 3049-3157) at their own campaign.

**STEP 3(e) — build+test.** `npm ci --prefer-offline --no-audit
--no-fund --silent` clean. `npm run build`: PASS, 0 tsc errors, vite
build clean (131 modules). `npm test --silent`: PASS, **151 test
files / 1332 tests**, 0 failures — matches every wave-9 sibling's
independently-recorded count at the same `S`.

All of (a)-(e) clean.

Full detail: `docs/verification-log/task-w9-g-triage-closure.md`.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-a — build+test @ 7561cc1

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

**STEP 2 — precondition greps at S'.** Fresh detached worktree at
`7561cc1`. All 17 markers present:
DEC-167 in `src/domain/contacts.ts`; `ICS_ORGANIZER_EMAIL` in
`src/mail/ics.ts`; `unknown track id` in `src/routes/api/forms.ts`;
`anonymized === false` in `src/server/repo/files.ts`; `openDate` in
`app/src/pages/review/PlanEditor.tsx`; `FORM_TASK_FIELD_SPECS` and
DEC-174 in `scripts/seed.ts`; DEC-173 in `scripts/walkthrough/
public.ts` and `scripts/walkthrough/speaker.ts`; DEC-175 in
`scripts/walkthrough/producer.ts`, `speaker.ts`, `review.ts`; DEC-179
in `src/lib/csv.ts`; DEC-180 in `src/lib/rate-limit.ts`; DEC-181 in
`src/server/middleware.ts`; DEC-182 in `src/server/http.ts`; DEC-183
in `wrangler.jsonc`. No misses.

**STEP 3 — build+test+bundle:check.** In the fresh detached worktree:
`npm ci --prefer-offline --no-audit --no-fund --silent` clean (reused
existing `node_modules`, install skipped per no-op guard — verified
present and consistent). `npm run build`: PASS — `tsc --noEmit` (root)
0 errors, `tsc --noEmit -p app/tsconfig.json` 0 errors, `vite build`
clean, 131 modules transformed, 19 asset files emitted under
`public/admin/assets/`. `npm test --silent`: PASS — **152 test files
/ 1364 tests**, 0 failures (>= last recorded battery of 151 files /
1332 tests at `38860f9`; delta reflects wave-10 fix-lane test
additions, e.g. `test/server-http.test.ts` +/- assertions from
`task-w10-d`). `npm run bundle:check`: PASSED — entry bundle
(`index-Dtj2KjKK.js` + `index-easpJsYc.css`) = 58.86 kB gzip against
the 300.00 kB budget (all 19 chunks summed ~107.5 kB gzip, well under
budget; largest non-entry chunk `Contacts-Dlv-_vzj.js` at 8.84 kB
gzip).

All three steps clean.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-c — perf-smoke @ 7561cc1

DEC-186/DEC-185 wave-11 exit-gate battery, perf-smoke lane
(DEC-069/DEC-080/DEC-114/DEC-177/DEC-185 gate). Log-only lane; full
detail in `docs/verification-log/task-w11-c-perf-smoke.md`. Note: an
earlier, unrelated first-campaign section headed `task-w11-c —
walkthrough @ 3b7ed3d` exists in this file (per DEC-129) — that section
is a homonym from a different campaign and is inert here; this section
is the current campaign's `task-w11-c` (perf-smoke lane, not
walkthrough).

**STEP 1 — S' derivation.** First-parent walk from `main` tip in a
fresh detached worktree at `7561cc1`: `main` HEAD was `bdc472b` ("scribe
wave 11"), preceded first-parent by `b57bdfd` ("merge task-w9-g") — both
doc-only bookkeeping — then `7561cc1` ("merge task-w10-d"), code-bearing
and the newest such commit reachable. **S' = `7561cc1`**, matching
DEC-185's expected sha. `git merge-base --is-ancestor 2dd2f33 7561cc1`
exits 0 — DEC-139 ancestor check PASS.

**STEP 2 — 17 preconditions.** All 12 DEC-177 anchors (six w6 fixes +
harness closure) plus all 5 wave-10 anchors (DEC-179 `src/lib/csv.ts:145`,
DEC-180 `src/lib/rate-limit.ts:41`, DEC-181 `src/server/middleware.ts:262`,
DEC-182 `src/server/http.ts:51`, DEC-183 `wrangler.jsonc:39`) grepped
present in the S' worktree. No miss.

**STEP 3 — gate.** Fresh detached worktree at `7561cc1`: `npm ci`
clean; `npm run build` PASS (dual `tsc --noEmit` + `vite build`, 131
modules, 0 errors); `rm -rf .wrangler/state`; `npm run db:migrate` (13
migrations) clean; `npm run seed` clean (8 R2 objects); `npm run
perf:seed` clean, all D1 batches `"success": true`; verified DEC-088
scale directly (`seed_perf_%` count = 2000, `status='accepted'` = 300).
`npx wrangler dev --port 8845`, `/health` 200.

`PERF_URL=http://localhost:8845 npm run perf:smoke` — **run 1: exit 0**,
**run 2: exit 0**, both `perf:smoke OK`. Full p95 tables (budget 150ms,
all `ok` both runs):

Run 1:
```
submissions list (page 1)            12.1ms  ok
submissions list (q=Kubernetes)      17.7ms  ok
submission detail                    24.0ms  ok
event overview                       19.5ms  ok
organizer agenda (300 accepted)      27.3ms  ok
public sessions page                  5.4ms  ok
public agenda                         8.5ms  ok
schedule.ics 150 ids                 46.7ms  ok
plan progress (12 reviewers)         20.5ms  ok
rating PUT                           13.4ms  ok
```

Run 2:
```
submissions list (page 1)            15.5ms  ok
submissions list (q=Kubernetes)      15.5ms  ok
submission detail                    18.9ms  ok
event overview                       18.3ms  ok
organizer agenda (300 accepted)      25.0ms  ok
public sessions page                  4.9ms  ok
public agenda                         6.1ms  ok
schedule.ics 150 ids                 39.4ms  ok
plan progress (12 reviewers)         21.0ms  ok
rating PUT                            9.1ms  ok
```

Both runs pass every row, well under the 150ms budget.

DEC-080 301-id `schedule.ics` cap assertion (untimed, one-shot, before
the measured loop): 300 real accepted ids + 1 synthetic nonexistent id
fetched against `GET /e/:slug/schedule.ics`; script throws on any
non-400 response. Clean `perf:smoke OK` exit on both runs confirms this
assertion passed both times.

DEC-182 1000-id bound check: audited every `parseBoundedIdArray` call
site present at S' (`src/routes/files.ts`, `src/routes/tasks.ts`,
`src/routes/api/submissions.ts`, `src/routes/api/contacts.ts`) against
`scripts/perf-smoke.ts`'s calls — perf-smoke never invokes any
bulk-id route gated by `parseBoundedIdArray`. The only multi-id call it
makes (`schedule.ics?ids=`, 150 timed / 301 untimed-cap) is bounded by
DEC-080's own 300-cap logic in `src/routes/public.tsx`, independent of
DEC-182. No DEC-182 bound was tripped — nothing to record as FAIL.

Server killed (`pkill -f "wrangler dev --port 8845"`); `lsof -i :8845`
confirmed free afterward. Detached perf-run worktree removed after the
gate.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w11-e — spec-audit @ 7561cc1

DEC-186/DEC-185/DEC-179..183/DEC-068 gate. Log-only lane. Full detail
in `docs/verification-log/task-w11-e-spec-audit.md`. Note: a
first-campaign homonym section `task-w11-e — spec-audit @ 3b7ed3d`
already exists earlier in this file (different sha, different
campaign) — inert per DEC-129; this section is distinguished by its
`@ 7561cc1` suffix.

**STEP 1 — sha derivation, ancestor check, preconditions.** First-
parent walk from `main` lands on `7561cc1` ("merge task-w10-d") —
matches DEC-185's expected S' exactly. `git merge-base --is-ancestor
2dd2f33 7561cc1` exits 0. All 17 preconditions (12 DEC-177 anchors +
5 DEC-185 markers: `DEC-179` in `src/lib/csv.ts`, `DEC-180` in
`src/lib/rate-limit.ts`, `DEC-181` in `src/server/middleware.ts`,
`DEC-182` in `src/server/http.ts`, `DEC-183` in `wrangler.jsonc` +
`.dev.vars` present with `DEV_MODE=1`) hit at `7561cc1`. No
precondition FAIL.

**STEP 2 — audit `git diff 38860f9..7561cc1`.** 44 files changed,
2717 insertions(+), 78 deletions(-) — exactly the five wave-10 fixes
+ tests, `.dev.vars` addition, and ledger/decision/field-guide
appends, no other product code touched. Each fix confirmed spec-
conformant: DEC-179's `toCsv` formula-injection escape only touches
export serialization (`formatCell`), leaving `parseCsv`/the
speakers.csv import fixture untouched — no corruption. DEC-180 adds
peek/increment/reset primitives and leaves `checkAndIncrementScoped
Limit` (used by public submit) byte-for-byte unchanged; `/login`
still runs DEC-072's two independent scopes (`login-user` 20/15min,
`login-ip` 100/15min flood guard), now counting failures only and
resetting `login-user` on success. DEC-181's `csrfFormOrHeader` on
`POST /logout` accepts the admin SPA's `x-chq-csrf: 1` header
(`app/src/App.tsx:69`, confirmed present) or the plain-form double-
submit pair; every `PortalLayout` call site now threads `csrfToken`
through to the sign-out form (`grep -L csrfToken` over every
`PortalLayout` caller returns empty). DEC-182's `parseBoundedIdArray`
throws `ApiError("invalid", message, {field: ...})`, matching the
`{error:{code,message,fields?}}` envelope, applied to all four bulk-
ids call sites (`contactIds`, `ids`, `fileIds`, optional `taskIds`).
DEC-183: `wrangler.jsonc`'s `vars.DEV_MODE` block is deleted (replaced
by a `// DEC-183` comment), `.dev.vars` is git-tracked (removed from
`.gitignore`) and sets `DEV_MODE=1`, and `/dev/mailbox` (`src/routes/
dev/mailbox.tsx`'s `shouldMountDevMailbox`) remains gated on
`env.DEV_MODE === "1"` — closes the prior stage-2 leak where a
`wrangler deploy` would have shipped `DEV_MODE=1` and exposed the
mailbox in production.

**STEP 3 — secrets / stage-2 wiring scan.** Grep over the diff for
credential-shaped patterns turns up only prose mentions of the word
"secret" in ledger/decision text, a pre-existing drizzle-generated
migration filename (`0000_secret_matthew_murdock`), existing
identifier names (`passwordHash`, `csrfToken`, etc.), and one
test-only fixture literal (`test/auth.test.ts`'s `PASSWORD =
"correct-password-123"`, used only to exercise the DEC-180 rate-limit
tests). Zero live secrets or API keys. No stage-2 platform wiring
introduced anywhere in the delta.

**Build/test.** `npm ci --prefer-offline --no-audit --no-fund
--silent` clean (cached). `npm run build`: PASS, 0 tsc errors, vite
build clean (131 modules). `npm test --silent`: PASS, **152 test
files / 1364 tests**, 0 failures.

OPEN ITEMS: 0

RESULT: PASS — S' = `7561cc1` ("merge task-w10-d"), 17/17
preconditions hit, delta audited clean against SPEC.md/docs/
precedence (clarifications.md overrides all), all five wave-10 fixes
spec-conformant, zero secrets, no stage-2 wiring.

## 2026-08-10 task-w11-b — walkthrough @ 7561cc1

DEC-186/DEC-185/DEC-177 wave-11 exit-gate battery, walkthrough lane,
log-only (no code changes). Full detail in
`docs/verification-log/task-w11-b-walkthrough.md`. Note: an inert
first-campaign homonym section titled `task-w11-b — build+test @
3b7ed3d` already exists earlier in this file (DEC-186 homonym guard);
this section is distinguished by its full heading including `@
7561cc1` and is unrelated to that history.

S' derived per DEC-114 first-parent walk from `main` (tip observed:
`bdc472b` "scribe wave 11"): `bdc472b` (bookkeeping — new decision doc
+ its `src/decisions.ts` constant + field-guide compaction) and
`b57bdfd` ("merge task-w9-g", doc-only ledger diff) both skipped, so
S' = `7561cc1` ("merge task-w10-d"), matching the DEC-186 expectation
exactly. `git merge-base --is-ancestor 2dd2f33 7561cc1` exits 0.

All 17 preconditions (12 DEC-177 anchors + 5 DEC-185 markers: DEC-179
in `src/lib/csv.ts`, DEC-180 in `src/lib/rate-limit.ts`, DEC-181 in
`src/server/middleware.ts`, DEC-182 in `src/server/http.ts`, DEC-183
in `wrangler.jsonc`) grep-confirmed present at S'. No precondition
FAIL.

Fresh detached worktree at `7561cc1`: `npm ci` clean, `npm run build`
PASS (0 tsc errors, vite build clean), `npm run db:migrate` (13
migrations, all `✅`), `npm run seed` clean (seed-r2 8 objects).
`.dev.vars` present at S' (`# DEC-183` / `DEV_MODE=1`, no other
content) and auto-loaded by `wrangler dev` — confirmed by dev-mailbox-
dependent checks passing without any external mail secret. `wrangler
dev` on port 8787, `/health` 200, then `npm run walkthrough`: **6/6
modules PASS** (producer, review, speaker, public, data, scale), exit
code 0, including every DEC-175 negative-authz probe: producer's
unauthenticated block (`/admin` -> 302, `/api/v1/contacts` -> 401,
`/api/v1/review/plans` -> 401, `/files/:id` -> 401); review's
out-of-scope-reviewer 404-not-403 pair; speaker's 8-check
speaker2-cross-tenant block (portal submission 404 existence-hiding,
task-assignment form/complete 403, uploaded file 403, three
organizer-API-as-speaker-session 403s).

DEC-180/181 impact on walkthrough login/logout: DEC-180 (rate limiter
counts failures only) has no observable effect — every walkthrough
login is a single successful attempt, the limiter never engages.
DEC-181 (`csrfFormOrHeader` on `/logout` and the portal sign-out
token) is **not exercised by the walkthrough at all** — grepped
`scripts/walkthrough/**` for `logout`, zero hits; no module calls
`/logout` or the portal sign-out route. Neither DEC-180 nor DEC-181
altered any walkthrough login flow that IS exercised (organizer form
login with `chq_csrf` cookie contract, speaker portal login, bearer-
token mint) — all passed identically to prior waves' recorded runs.

Server killed after the run (`pkill -f "wrangler dev"`); confirmed no
lingering listener on 8787.

**Note for the record (out of scope for this log-only lane, flagged
for the scribe/planner):** the post-S' commit `bdc472b` ("scribe wave
11") adds an `AIRTABLE_TOKEN=...` line to the tracked `.dev.vars` file
on `main`, alongside `DEV_MODE=1`. This postdates S' and is therefore
not part of the tree verified here, but it is a secret-shaped value
committed to a tracked file, which appears to conflict with the STAGE
1 zero-secret invariant. Not actioned by this lane (out of scope, log-
only); surfacing since it is newer than every sha this gate is allowed
to touch.

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

DEC-069/DEC-139/DEC-185/DEC-186/DEC-177/DEC-114/DEC-068 gate-of-gates
for the wave-11 exit-gate battery, mirroring the `task-w8-g` procedure.
Log-only lane; full step-by-step evidence in
`docs/verification-log/task-w11-f-triage-closure.md`. Note: this file
already has first-campaign homonym sections titled `task-w11-f —
triage-closure @ 3b7ed3d` (and similarly-named `task-w11-a/b/c/d/e`
sections at the same `3b7ed3d`) — per DEC-186 these are inert history
from a different campaign; only the sections below whose full heading
ends `@ 7561cc1` are this wave's live siblings.

**STEP 1 — S' derivation.** First-parent walk from `main`'s current
tip lands, after skipping this wave's own already-merged code lanes
(`task-w11-a/b/c/e`) and the `.dev.vars`-untrack security fix
(`629d57e`) and the doc-only `bdc472b`/`b57bdfd` commits, on `7561cc1`
("merge task-w10-d") as the frozen S' this wave's battery is pinned
to — matching the task's expected sha and every sibling lane's
independent derivation. `git merge-base --is-ancestor 2dd2f33 7561cc1`
exits 0.

**STEP 2 — 17 preconditions.** All 12 DEC-177 anchors + 5 DEC-185
markers (DEC-179 `src/lib/csv.ts`, DEC-180 `src/lib/rate-limit.ts`,
DEC-181 `src/server/middleware.ts`, DEC-182 `src/server/http.ts`,
DEC-183 `wrangler.jsonc`) grep-confirmed present at `7561cc1`. No miss.

**STEP 3 — own build+test at S'.** Fresh detached worktree at
`7561cc1`: `npm ci` clean, `npm run build` PASS (0 tsc errors, vite
build clean, 131 modules), `npm test --silent` PASS — **152 test
files / 1364 tests**, 0 failures — matching `task-w11-a`/`task-w11-e`'s
recorded counts.

**STEP 4 — PLANNER marker harvest.** `git log --format='%h %B'
2dd2f33..7561cc1 | grep 'PLANNER:'` — zero hits.

**STEP 5 — eval-findings.md closure.** All Section A/B/E/F citation
files catalogued by `task-w8-g` re-confirmed present at S' via `git
cat-file -e`; 17 `app/src/**/*.render.test.tsx` smokes counted at S'
(matches baseline). The five wave-10 findings (CSV injection, login
lockout, logout CSRF, SQLITE_TOOBIG 500s, DEV_MODE in deploy config)
are each closed at S' by their DEC-179..183 markers (re-confirmed in
STEP 2). No gap found.

**STEP 6 — LAST STEP, sibling battery check.** Searched
`docs/verification-log.md` for the five required sections with full
heading `@ 7561cc1`: `task-w11-a — build+test @ 7561cc1` PRESENT/PASS;
`task-w11-b — walkthrough @ 7561cc1` PRESENT/PASS; `task-w11-c —
perf-smoke @ 7561cc1` PRESENT/PASS; `task-w11-e — spec-audit @
7561cc1` PRESENT/PASS; **`task-w11-d — render-sweep @ 7561cc1` NOT
PRESENT** — the only `task-w11-d` sections in this file are the inert
`task-w11-d — perf-smoke @ 3b7ed3d` first-campaign homonym (different
lane, different pre-`2dd2f33` sha). No render-sweep section for this
wave has been recorded at S' anywhere in this file.

**Sibling battery is incomplete: 4 of 5 required sections present.**

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

Fresh detached worktree at S'' (no `.dev.vars` present, clean-clone
proof): `npm ci` clean; `npm run build` PASS (tsc clean both configs,
vite build clean, 131 modules); `npm test --silent` PASS — **152 test
files / 1368 tests**, 0 failures (baseline >=152/1364 met and
exceeded, includes task-w12-a's additions); `test/wrangler-config.test.ts`
explicitly re-confirmed passing standalone (6/6) with no `.dev.vars`
present; `npm run bundle:check` PASSED — entry bundle 58.86 kB gzip,
under the 300 kB budget. No local `.dev.vars` was read or printed.

Full detail: docs/verification-log/task-w12-b-build-test.md

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w13-a — build+test @ 7f7477e

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

DEC-188 wave-12 gate lane: S'' derivation (first-parent walk from
`main`, DEC-114) lands on `7f7477e` ("merge task-w12-a") — matches
DEC-188's expected S'' exactly (w12-a's merge is present, so the
FAIL-precondition branch does not apply). `git merge-base
--is-ancestor 2dd2f33 7f7477e` exits 0. Full detail:
docs/verification-log/task-w12-c-walkthrough.md

All 17 prior precondition markers (12 DEC-177 anchors + 5 DEC-185
markers) plus the DEC-187 markers (`DEC-187` in
`scripts/ensure-dev-vars.ts` and `test/wrangler-config.test.ts`,
`"ensure-dev-vars"` in `package.json`) grep-confirmed present at
`7f7477e`; `git ls-tree -r 7f7477e --name-only` lists
`.dev.vars.example` and NOT `.dev.vars`. No precondition miss.

Fresh detached worktree at `7f7477e`
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/gate-w12-c`),
confirmed no pre-existing `.dev.vars` before any command ran: `npm ci`
clean (423 packages); `npm run db:migrate` PASS (13/13 migrations);
`npm run seed` PASS. Boot via `npx tsx scripts/ensure-dev-vars.ts &&
npx wrangler dev --port 8787` — first output line **`ensure-dev-vars:
created .dev.vars from .dev.vars.example`**, direct evidence the
DEC-187 zero-setup bootstrap works on a clean checkout without ever
reading or printing any local secret. `/health` returned `{"ok":true}`
immediately.

`npm run walkthrough` — all 6 modules PASS (producer, review, speaker,
public, data, scale; matches `scripts/walkthrough.ts`'s own module
order/summary), including the DEC-175 object-level authz probes inside
`speaker.ts` (existence-hiding 404s, cross-speaker 403s) all `ok`, and
the DEC-187 `/dev/mailbox` 200 assertions at `speaker.ts:401`
(post-bulk-remind mailbox check), `producer.ts:450` (claim-link
confirmation email check), and `scale.ts:301` (step-5 no-auto-email
mailbox check) — each a hard assert that would abort the run on
non-200, and all three modules containing them reported PASS, proving
the mailbox is restored on this fresh checkout. Server stopped
cleanly after the run; port 8787 confirmed free. Only the gate
worktree's generated `.dev.vars` copy was ever touched; the main
worktree's `.dev.vars` was never read or printed.

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

**S'' derivation (DEC-114 first-parent walk from `main`).** `git log
--first-parent --oneline main` top entry is `7f7477e merge task-w12-a`
— matches expected. S'' = `7f7477e`.

**Ancestor checks.** `git merge-base --is-ancestor 2dd2f33 7f7477e` —
true, 2dd2f33 is an ancestor. `git merge-base --is-ancestor 629d57e
7f7477e` — true, the code-bearing operator commit `629d57e` (Security:
untrack `.dev.vars`) is present in S''.

**DEC-188 precondition grep set.** `decisions/DEC-177.md` present
(grep -rl "DEC-177" decisions/ hit, plus DEC-178/185/186/188 markers
present in that same set). Source markers for DEC-179..183 all present:
`src/lib/csv.ts:145` (DEC-179 CSV formula-escape), `src/lib/rate-limit
.ts:41` (DEC-180 login-limiter counts-failures-only), `src/server/
middleware.ts:262` + `src/routes/portal/shared.tsx:51` (DEC-181
csrfFormOrHeader on /logout+portal token), `src/server/http.ts:51` +
`src/routes/{tasks,files,api/contacts,api/submissions}.ts` (DEC-182
parseBoundedIdArray), `scripts/ensure-dev-vars.ts:3` (DEC-183,
superseded by DEC-187). All preconditions satisfied.

**Fresh detached worktree.** `git worktree add --detach
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/
gate-w12-e-render-sweep 7f7477e`. Confirmed no `.dev.vars` present in
the fresh worktree (only the tracked `.dev.vars.example`). `npm ci`
clean; `npx playwright install chromium` confirmed chromium already
cached (`chromium-1187` etc. present under
`~/Library/Caches/ms-playwright`); `npm run build` clean (tsc
--noEmit x2 + vite build, 131 modules transformed, admin SPA assets
emitted to `public/admin/`).

**`npm run gate:render-sweep` output.** First line of script output:
`ensure-dev-vars: created .dev.vars from .dev.vars.example` — confirms
`scripts/render-sweep.ts`'s `ensureDevVars(REPO_ROOT)` call (DEC-187
wiring, `scripts/render-sweep.ts:168`) fired and materialized
`.dev.vars` fresh in this worktree (never read/printed). Migrations
applied (13/13 ✅), D1 seed + R2 seed (8 objects) succeeded, `wrangler
dev` came up on port 54166, organizer/reviewer/speaker sessions logged
in successfully.

Per-route table (all 31 manifest routes, all roles, PASS = correct
status + non-empty rendered body [`#root` innerText for `/admin` SPA
routes] + zero console errors + zero page errors per DEC-144):

```
path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                         organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   PASS
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                        speaker    PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    PASS
/e/devflow-conf-2027/sessions                                                   public     PASS
/e/devflow-conf-2027/speakers                                                   public     PASS
/e/devflow-conf-2027/gallery                                                    public     PASS
/e/devflow-conf-2027/agenda                                                     public     PASS
/e/devflow-conf-2027/schedule                                                   public     PASS
/submit/devflow-conf-2027                                                       public     PASS
/admin/*                                                                        organizer  PASS

31/31 routes passed
gate:render-sweep OK
```

31/31 PASS, 0 failures, 0 console errors, 0 page errors. See
`docs/verification-log/task-w12-e-render-sweep.md` for the full raw
transcript excerpt.

OPEN ITEMS: 0

RESULT: PASS — 31/31 render-sweep routes green at S'' = `7f7477e`
(`main`'s current tip, first-parent `merge task-w12-a`), `2dd2f33` and
`629d57e` both confirmed ancestors, DEC-188 precondition grep set
fully satisfied, DEC-187 `ensureDevVars` wiring confirmed live via its
boot log in a fresh detached worktree with no pre-existing
`.dev.vars`.

## 2026-08-10 task-w12-f — spec-audit @ 7f7477e

DEC-188 GATE spec-audit lane. S'' derived by first-parent walk from
`main`: `7f7477e` = "merge task-w12-a" — matches expected S'' exactly;
precondition satisfied. `2dd2f33`, `629d57e`, and `38860f9` (audit
baseline) all confirmed ancestors of S'' via
`git merge-base --is-ancestor`. DEC-188 precondition grep set
(DEC-177/179..183 markers, extended through DEC-188) all present in
`src/decisions.ts` at S''.

Audited `git diff 38860f9..7f7477e` (58 files, +4377/-105) against
SPEC.md and docs/ precedence. Full detail in
`docs/verification-log/task-w12-f-spec-audit.md`. Summary:

1. Wave-10 fixes DEC-179..183 all conform: `formatCell` in
   `src/lib/csv.ts` neutralizes leading `=+-@`/tab/CR on string cells
   only (numbers/null exempt), fully tested in `test/csv.test.ts`. The
   login limiter (`src/routes/auth.tsx` + new `peekScopedLimit`/
   `incrementScopedLimit`/`resetScopedLimit` in `src/lib/rate-limit.ts`)
   peeks read-only, increments only on failed credential checks, and
   resets the per-email window on success; `checkAndIncrementScopedLimit`
   (claim/submit scopes) is unchanged and public submit's rate-limit
   code path has no diff in this range. `csrfFormOrHeader`
   (`src/server/middleware.ts`) gates `POST /logout`; every
   `/portal/*` page threads a real `csrfToken` into `PortalLayout`'s
   sign-out form, including two GET handlers that previously didn't
   mint one. `parseBoundedIdArray` (`src/server/http.ts`) is used at
   all five bulk-ids call sites (`api/submissions.ts`, `tasks.ts` x2,
   `api/contacts.ts`, `files.ts`), throwing `ApiError("invalid", ...)`
   (the standard `{error:{code,message,fields?}}` envelope) on any
   non-array/empty/oversized/non-string/out-of-range input — no silent
   filtering. `wrangler.jsonc`'s `vars.DEV_MODE` block is removed.
2. Operator commit 629d57e: `.dev.vars` is confirmed untracked at S''
   (`git ls-files 7f7477e` has no match); `.dev.vars.example` contains
   only `DEV_MODE=1`; `.gitignore` re-ignores `.dev.vars`. Note:
   `.dev.vars` was briefly re-tracked with a real `AIRTABLE_TOKEN` value
   at `bdc472b` (within this range, after 629d57e) and removed again
   before the wave-11 merges — a two-endpoint diff nets this to no
   visible change, which is the intended tracked-diff-only audit method.
   This residual git-history exposure (not pushed) is the same issue
   already flagged by a prior audit note and accepted/scheduled for a
   post-convergence history scrub per DEC-187's commit message; not a
   new finding, does not block this gate since the tree at S'' never
   tracks the file.
3. DEC-187 fix: `scripts/ensure-dev-vars.ts` (`ensureDevVars`,
   create-if-absent/never-overwrite/throw-if-example-missing), wired via
   `predev` in `package.json`, `scripts/render-sweep.ts`, and
   `.github/workflows/ci.yml`'s walkthrough + perf-smoke jobs;
   `test/wrangler-config.test.ts` retargeted to `.dev.vars.example` plus
   direct unit tests of `ensureDevVars` in a temp dir. Node-fs-only,
   confined to `scripts/`; introduces no stage-2 wiring and requires no
   secrets to run.
4. Secrets scan over `git diff 38860f9..7f7477e` (tracked diff only,
   local untracked `.dev.vars` never read): only truncated/partial
   prose references to the already-resolved incident inside
   `docs/verification-log.md`/`docs/verification-log/*.md`; no live
   credential in the diff.

`npm run build` clean at S''; targeted vitest run (csv, rate-limit,
auth, wrangler-config, server-http, portal-signout, api-submissions —
7 files, 119 tests) all passing.

Findings: none. All four audited areas conform.

OPEN ITEMS: 0
RESULT: PASS

## 2026-08-10 task-w13-b — walkthrough @ 7f7477e

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

Duplicate-citation per DEC-189(2)/Step 0: a `render-sweep` section
already exists at S''' = `7f7477e` (`## 2026-08-10 task-w12-e —
render-sweep @ 7f7477e`, above), 31/31 routes PASS, zero console/page
errors, DEC-188 preconditions satisfied, DEC-187 `ensureDevVars`
wiring confirmed live in that gate's fresh detached worktree. This
task-w13-d lane cites that PASS rather than re-running the gate. No
new evidence collected; no worktree created for this lane.

RESULT: PASS (cited from task-w12-e @ 7f7477e)

## 2026-08-10 task-w12-g — triage-closure @ 7f7477e

Gate-of-gates per DEC-188 (chained on task-w12-c, which merged
before this lane started). Note: this worktree was created twice —
the first `git worktree add` succeeded and initial analysis was done,
but before the ledger append/commit landed, the working directory and
branch were externally removed (concurrent swarm activity pruned it;
`main` had also advanced from `4bc394c` to `a236116` in the interim).
Recreated the worktree from the then-current `main` and redid the
full derivation below from scratch — no stale state carried over.

**S'' derivation (DEC-114 first-parent walk from `main`).** `git log
--first-parent --oneline main` walked in full; `7f7477e` ("merge
task-w12-a") is the DEC-188-designated S'' — the fixed point every
wave-12 lane targets, not `main`'s current tip (`a236116`, several
non-code-bearing merges further along; see step (1)). `git merge-base
--is-ancestor 2dd2f33 7f7477e` exits 0.

**Homonym guard (DEC-188).** All matches below are full-heading `@
7f7477e`; the dead-campaign homonyms at `@01c6ace`, `@f6e3422`,
`@3b7ed3d`, `@3543f09`, `@0ee30dd`, `@d4ebf7f` (and the wave-13
first-campaign homonyms at `@3b7ed3d`) were excluded by requiring the
exact short sha in the heading.

**Gate table — DEC-188 five required wave-12 sibling sections:**

| gate | full heading | line | RESULT |
|---|---|---|---|
| task-w12-b | `task-w12-b — build+test @ 7f7477e` | verification-log.md:5987 | PASS |
| task-w12-c | `task-w12-c — walkthrough @ 7f7477e` | verification-log.md:6016 | PASS |
| task-w12-d | `task-w12-d — perf-smoke @ 7f7477e` | verification-log.md:6061 | PASS |
| task-w12-e | `task-w12-e — render-sweep @ 7f7477e` | verification-log.md:6121 | PASS |
| task-w12-f | `task-w12-f — spec-audit @ 7f7477e` | verification-log.md:6216 | PASS |

**All five sibling sections present at S''=`7f7477e`, each ending
`RESULT: PASS`.** (task-w12-f landed between this gate's two worktree
attempts — confirmed present on the second, current pass.)

**(1) Post-S'' first-parent commit audit (DEC-114).** `git log
--first-parent --oneline 7f7477e..main` lists ten commits: `bac800b`
(merge task-w12-b), `c19fbe7` (merge task-w12-e), `1b0711c` (merge
task-w12-c), `64761bf` (merge task-w12-d), `4bc394c` (scribe wave 13),
`3320f77` (merge task-w12-f), `443df92` (merge task-w13-b), `8da46ef`
(merge task-w13-c), `a0e3d3b` (merge task-w13-e), `a236116` (merge
task-w13-d, `main`'s current tip). `git show --stat` on each:
`bac800b`/`c19fbe7`/`1b0711c`/`64761bf`/`3320f77`/`443df92`/`8da46ef`/
`a0e3d3b`/`a236116` each touch only `docs/verification-log.md` plus
(for the four wave-12 merges and w12-f) one new
`docs/verification-log/task-w1{2,3}-*.md` detail file — squarely
inside DEC-114's exclusion set. `4bc394c` ("scribe wave 13") touches
`decisions/DEC-189.md`, `decisions/DEC-190.md` (excluded),
`field-guide/index.md` (excluded), and `src/decisions.ts`: the diff is
two new `export const DEC_189`/`DEC_190` string-literal declarations
plus an in-place edit to the existing `DEC_131` string literal (fixing
an escaped-backslash typo, `\n` -> `\\n`, in its doc-comment text).
`grep -rn "DEC_131" src/ test/` shows the only consumer is
`src/mail/ics.ts:9-10`'s compile-only `void DEC_131;` — never
compared/interpolated — so the edit is a pure string-constant change,
zero runtime effect, per DEC-114's exclusion clause. **No commit
after S'' on the first-parent line is code-bearing. No OPEN ITEM from
this step.**

**(2) DEC-139 eval-findings.md closure re-verification at S''.**
`task-w12-f — spec-audit @ 7f7477e` (verification-log.md:6216-6281)
covers the wave-10/11/DEC-187 fix set with `RESULT: PASS`, but is
scoped to `git diff 38860f9..7f7477e` (the DEC-179..188 fix range),
not a fresh full A-F eval-findings.md re-audit. As a supplementary
spot-check for this closure gate: re-confirmed the full Section A-F
citation set last fully enumerated at `64ec7de`
(verification-log.md:4682-4755) and re-confirmed at `7561cc1`
(verification-log.md:5953-5959) still resolves in the current tree
(a valid proxy for S''=`7f7477e` product code per step (1): zero
code-bearing commits landed between S'' and here) — line numbers have
drifted upward as files grew (expected, not a regression):
`wrangler.jsonc:11` `"html_handling": "none"`;
`test/admin-assets-config.test.ts` present;
`app/src/pages/submissions/SubmissionsTable.tsx:53`
`apiGet<{ fields: FormField[] }>(...)`;
`app/src/lib/dates.ts:40,54` `formatDate`/`formatDateOnly`;
`src/server/repo/events.ts:61` `listEventsForReviewer`;
`test/itinerary-roundtrip.test.ts` and `src/lib/overlap-lanes.ts`
present; `src/routes/api/contacts.ts:182,217` CNT-10 markers;
`src/domain/contacts.ts:48` DEC-143 marker; `src/decisions.ts:152,166`
`DEC_147`..`DEC_161` present (Section C/D fix constants);
`scripts/seed.ts:1263,1279` `previous_file_id` version chain
(Section E); `scripts/render-sweep.ts` present and
`.github/workflows/ci.yml:89,99` wires the `render-sweep` job
(Section F). Sections A/B/E/F remain done; every Section C item still
traces to its DEC-147..156 fix constant. `docs/eval-findings.md`
itself is unchanged (not edited by any lane in this range) — no new
findings to disposition. **No gap found.**

**(3) Historical artifact supersession check.** `task-w11-a —
build+test @ 7561cc1` (verification-log.md:5599): confirmed
correctly superseded/voided per DEC-069/DEC-188 — `629d57e`
("Security: untrack .dev.vars") is code-bearing and lands after
`7561cc1` on the first-parent line, and only w11-a of the five
wave-11 lanes ever ran. `docs/verification-log/
task-w11-e-spec-audit.md` (commit `04d5ee6`) confirmed orphaned: not
reachable from `main`'s first-parent chain leading to `7f7477e` —
historical only, not cited as evidence here.

**(4) `.dev.vars` discipline.** `git ls-tree -r 7f7477e --name-only`
confirms `.dev.vars.example` tracked and `.dev.vars` untracked at
S''. The local untracked `.dev.vars` was never read or printed by
this gate; all checks used `git show`/`git log`/`git ls-tree`/`grep`
and a standard `npm run build` in this worktree (a ledger-audit lane
needs no server boot).

**Own build.** Fresh `npm ci` + `npm run build` in this worktree
(created from `main` at `a236116`, several non-code-bearing commits
ahead of S'' per step (1)): PASS, tsc clean both configs, vite build
clean, 131 modules.

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

DEC-069/DEC-139/DEC-189 gate-of-gates, mirroring the `task-w11-f`
procedure with DEC-189's dedupe/equivalence and sibling-wait rules.
Log-only lane. Full detail also in
`docs/verification-log/task-w13-f-triage-closure.md`.

**STEP 1 — sha derivation, ancestor check.** DEC-114 first-parent walk
from `main` at gate start lands on `7f7477e` ("merge task-w12-a"),
matching DEC-189's expected S''' exactly (the "merge task-w12-b"
through "merge task-w12-f" / "merge task-w13-a" through "merge
task-w13-e" commits and the "scribe wave 13" commit that follow it on
`main` are all confirmed non-code-bearing in STEP 6 below, so they do
not shift S'''). `git merge-base --is-ancestor 2dd2f33 7f7477e` exits
0; `git merge-base --is-ancestor 629d57e 7f7477e` exits 0. DEC-187
markers (`.gitignore` re-excludes `.dev.vars`, `.dev.vars.example`
tracked) confirmed present — precondition not hit, gate proceeds.

**STEP 2 — 21 DEC-188/DEC-189 precondition greps at S''' = `7f7477e`.**
All 21 hit: the 12 DEC-177 anchors (`DEC-167` in
`src/domain/contacts.ts`; `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts`;
`"unknown track id"` in `src/routes/api/forms.ts`;
`"anonymized === false"` in `src/server/repo/files.ts`; `openDate` in
`app/src/pages/review/PlanEditor.tsx`; `FORM_TASK_FIELD_SPECS` and
`DEC-174` in `scripts/seed.ts`; `DEC-173` in
`scripts/walkthrough/public.ts` and `scripts/walkthrough/speaker.ts`;
`DEC-175` in `scripts/walkthrough/producer.ts`,
`scripts/walkthrough/speaker.ts`, `scripts/walkthrough/review.ts`); the
5 DEC-185 markers (`DEC-179` in `src/lib/csv.ts`, `DEC-180` in
`src/lib/rate-limit.ts`, `DEC-181` in `src/server/middleware.ts`,
`DEC-182` in `src/server/http.ts`, `DEC-183` in `wrangler.jsonc`); and
the 4 DEC-187/DEC-188 markers (`DEC-187` in
`scripts/ensure-dev-vars.ts` and `test/wrangler-config.test.ts`,
`"ensure-dev-vars"` in `package.json`, `git ls-tree -r 7f7477e
--name-only` listing `.dev.vars.example` and NOT `.dev.vars`). No
precondition miss.

**STEP 3 — own build+test at S''' in a fresh detached worktree,
no `.dev.vars`.** `git worktree add --detach
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/gate-w13-f-buildtest
7f7477e`; confirmed no `.dev.vars` present before any command ran
(only the tracked `.dev.vars.example`). `npm ci --prefer-offline
--no-audit --no-fund --silent` clean. `npm run build` — PASS (dual
`tsc --noEmit` + `vite build`, 131 modules transformed, 19 output
assets, no errors). `npm test --silent` — PASS: **152 test files /
1368 tests, all green, 0 failures** (floor >=152 files/1364 tests
met and exceeded). No local `.dev.vars` was read or printed at any
point.

**STEP 4 — PLANNER marker harvest.** `git log --format='%h %B'
2dd2f33..7f7477e | grep 'PLANNER:'` returns one line of prose from
the `task-w9-g` capstone commit message ("...task-w8-e/w9-e PASS
re-runs; no live PLANNER:\nmarkers; ...") — a mention *about* the
absence of markers, not a literal `PLANNER:` commit-message marker
itself. There is no genuine `PLANNER:` marker line in range. Nothing
to disposition.

**STEP 5 — eval-findings.md mandate closure.** The Section A/B/E/F
citation files catalogued by `task-w8-g — triage-closure @ 38860f9`
(this file, above) are re-confirmed present at S''' = `7f7477e` via
`git cat-file -e 7f7477e:<path>` (no miss): Section A —
`test/admin-assets-config.test.ts`,
`app/src/pages/submissions/Submissions.render.test.tsx`; Section B —
`app/src/lib/dates.ts` + `app/src/pages/review/Review.render.test.tsx`,
`test/events-reviewer-access.test.ts`,
`test/itinerary-roundtrip.test.ts`, `test/overlap-lanes.test.ts`,
`test/contact-profile-roundtrip.test.ts` +
`test/contacts-profile-admin.test.ts`, `test/contacts-import.test.ts`,
`test/contacts.test.ts`; Section E — `test/seed.test.ts`; Section F —
`scripts/render-sweep.ts` + `scripts/render-sweep-lib.ts` +
`test/render-sweep-lib.test.ts` and the `app/src/**/*.render.test.tsx`
component smokes, counted directly at S''' via `git ls-tree -r
7f7477e --name-only | grep -c 'app/src/.*\.render\.test\.tsx$'` =
**17**, matching the baseline. The w11-b `AIRTABLE_TOKEN` open item
raised while scanning back through the ledger is **CLOSED**, citing
DEC-190: operator commit `629d57e` untracked `.dev.vars`, re-excluded
it via `.gitignore`, and the tracked `.dev.vars.example` at S''' carries
only `DEV_MODE=1` — no secret is required or shipped by the stage-1
tree. Rotating the leaked token and purging it from git history are
operator-scope remediations outside stage-1 per DEC-190; not re-raised
here.

**STEP 6 — post-S''' first-parent commit audit (DEC-114).** Every
first-parent commit on `main` after `7f7477e` at gate time — `bac800b`
(merge task-w12-b), `c19fbe7` (merge task-w12-e), `1b0711c` (merge
task-w12-c), `64761bf` (merge task-w12-d), `4bc394c` (scribe wave 13),
`3320f77` (merge task-w12-f), `443df92` (merge task-w13-b), `8da46ef`
(merge task-w13-c), `a0e3d3b` (merge task-w13-e), `a236116` (merge
task-w13-d), `d80ad7f` (merge task-w13-a) — was diffed against its
first parent (`git diff --name-only <c>^ <c>`). All eleven touch only
`docs/verification-log.md` and/or `docs/verification-log/*.md`, except
`4bc394c` ("scribe wave 13") which also touches `decisions/DEC-189.md`,
`decisions/DEC-190.md`, `field-guide/index.md`, and `src/decisions.ts`
— confirmed a pure string-constant append/edit (`DEC_189`/`DEC_190`
export additions plus one string-literal escaping fix inside an
existing `DEC_131` string, no code logic). All eleven are within the
DEC-114 bookkeeping exclusion set — none are code-bearing, so none
supersede S'''.

**STEP 7 — sibling battery, five gate types at S''' = `7f7477e`,
full-heading matched (DEC-189(3)/(4), distinguishing from the inert
task-w12-*/task-w13-* homonyms at `01c6ace`/`f6e3422`/`3b7ed3d`/
`3543f09`/`0ee30dd`/`d4ebf7f` and the void w11 sections at `7561cc1`):**
- `task-w12-b — build+test @ 7f7477e` — RESULT: PASS (152 files/1368
  tests, bundle 58.86 kB gzip), also independently reconfirmed by this
  gate's own STEP 3 build+test run above.
- `task-w12-c — walkthrough @ 7f7477e` — RESULT: PASS (6/6 modules,
  DEC-175 authz probes ok, DEC-187 `/dev/mailbox` 200 assertions
  confirmed live).
- `task-w12-d — perf-smoke @ 7f7477e` — RESULT: PASS (two full runs,
  all budgets under 150ms, DEC-094/095 301-id cap probe held).
- `task-w12-e — render-sweep @ 7f7477e` — RESULT: PASS — 31/31 routes
  green (0 console/page errors).
- `task-w12-f — spec-audit @ 7f7477e` — RESULT: PASS (OPEN ITEMS: 0,
  `38860f9..7f7477e` diff audited clean, zero secrets in the tracked
  diff).

All five gate types present with `RESULT: PASS` at one S''' (each also
carries a `task-w13-*` duplicate citation per DEC-189(2): `task-w13-a`
build+test, `task-w13-b` walkthrough, `task-w13-c` perf-smoke,
`task-w13-d` render-sweep, `task-w13-e` spec-audit — all "PASS —
duplicate"/"PASS (cited from ...)"). Battery complete on the first
read; no sibling-wait needed.

**OPEN ITEMS: 0**

**RESULT: PASS**

Steps 1-6 all green, all five gate types PASS at S''' = `7f7477e`
(with `task-w13-*` duplicate confirmations), zero live `PLANNER:`
markers, eval-findings.md Section A/B/E/F closure re-confirmed, and
the w11-b `AIRTABLE_TOKEN` open item is CLOSED per DEC-190. Per
DEC-069/DEC-139/DEC-189, the stage-1 exit predicate is satisfied at
S''' = `7f7477e`, pending planner declaration.

## 2026-08-10 task-w15-f — spec-audit @ 1033d45

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

**(1) Scope.** `git diff --stat 7f7477e..1033d45` (27 files changed,
1795 insertions, 47 deletions). Code-bearing paths beyond ledger/
decisions/field-guide/decisions.ts bookkeeping are exactly the three
declared w14 fix surfaces: `app/src/pages/submissions/SubmissionsTable.tsx`,
`app/src/pages/submissions/bulk.ts` + `bulk.test.ts`, and the related
render-test touch `app/src/pages/submissions/Submissions.render.test.tsx`;
`src/views/form-render.tsx` + `test/form-render-rules.test.ts`;
`src/routes/api/users.ts`, `src/routes/review.ts`, `src/mail/types.ts`
(null-contact handling) + `test/email-log-null-contact.test.ts`.
Nothing else appears in the diff. No line-by-line dispositioning
against SPEC.md/clarifications.md is required beyond the four DEC-
19x conformance checks below.

**(2) Fix conformance.**
- DEC-192 (tracks fetch, CFP-12 track triage) — `SubmissionsTable.tsx`
  adds a `useEffect` that calls `apiList<Track>(`/events/${eventId}/tracks`)`
  and populates the previously-empty `tracks` state (was
  `const [tracks] = useState<Track[]>([])`, permanently empty). Track
  filter is now backed by live data. CONFORMS.
- DEC-193 (chunking with stop-loudly + refetch, no silent rollback) —
  `bulk.ts` exports `BULK_STATUS_CHUNK_SIZE = 500` and pure
  `chunkSelection`, covered by 5 unit tests (empty, exact multiple,
  remainder, order-preservation, below-limit). `SubmissionsTable.tsx`
  `applyBulkStatus` iterates batches sequentially via `apiPost`,
  tracks `completed` count, and on failure no longer restores the
  pre-update snapshot (the old `setItems(previous)` silent-rollback
  path is deleted); instead it surfaces `Bulk status update failed
  after N of M batches: <message>` and bumps `refreshToken` to force
  a refetch of server truth. This is fail-loudly (house rule) rather
  than silent — a partial-success case now reports its extent instead
  of masking it behind a rollback. CONFORMS.
- DEC-194 (data-required vs DEC-008 script at form-render.tsx:167) —
  `FieldControl` now emits `data-required="true"/"false"` alongside
  `required` on all four required-capable controls (text, long_text,
  dropdown, number). The inline script at line ~167
  (`el.dataset.required`, confirmed via `input.dataset.required ===
  'true'` string in `FieldRulesScript`'s test) reads this exact
  dataset key; `test/form-render-rules.test.ts` adds coverage for
  required/optional/rule-gated-visible cases. Restores the DEC-008
  contract. CONFORMS.
- DEC-191 (contact-or-NULL email_log writes, J11 integrity) —
  `src/mail/types.ts` widens `RenderedEmail.contactId` and
  `EmailLogEntry.contactId` to `string | null`; `src/routes/api/users.ts`
  (new-user welcome email) and `src/routes/review.ts` (reviewer
  reminder) now pass `contactId: null` instead of a user id
  masquerading as a contact id. `migrations/0000_secret_matthew_murdock.sql`
  line 36 already declares `email_log.contact_id` as nullable
  (`text`, no `NOT NULL`) — no migration needed, matching DEC-191's
  binding. `git diff 7f7477e..1033d45` touches no file under
  `src/server/repo/contacts.ts` or `migrations/`, confirming no
  contact-merge/filter code needed to change; `test/email-log-null-
  contact.test.ts` (177 lines, new) exercises the null-contact write
  path end to end. CONFORMS.

**(3) Standing anchor re-confirmation.** `task-w12-f — spec-audit @
7f7477e` §8/§9 anchors re-grepped at `1033d45`: `formatCell` in
`src/lib/csv.ts`, `peekScopedLimit`/`incrementScopedLimit`/
`resetScopedLimit` in `src/lib/rate-limit.ts`, `csrfFormOrHeader` in
`src/server/middleware.ts`, `parseBoundedIdArray` in
`src/server/http.ts` all present and unchanged by the w14 diff (none
of those files appear in `git diff --stat 7f7477e..1033d45`). Anchors
hold.

**(4) Secrets.** `git diff 7f7477e..1033d45 | grep -i` for token/key/
password patterns turns up only historical prose mentions of the
string `AIRTABLE_TOKEN` inside DEC-190's narrative text (no value, no
`.dev.vars` diff hunk). `.dev.vars` was not read or printed.
`git ls-tree -r 1033d45 --name-only` lists `.dev.vars.example` and no
`.dev.vars`. Zero secrets confirmed.

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

DEC-196 gate lane, build+test at S'''' = `1033d45` ("merge
task-w14-c"). Log-only lane. Full detail also in
`docs/verification-log/task-w15-a-build-test.md`.

**Sha derivation.** DEC-114 first-parent walk from `main` at gate
start: `4e5256e` ("scribe wave 15") is HEAD but is docs-only
(non-code-bearing); the newest code-bearing first-parent commit is
`1033d45` ("merge task-w14-c"), matching DEC-196's expected S''''
exactly. `git merge-base --is-ancestor 2dd2f33 1033d45` exits 0;
`git merge-base --is-ancestor 7f7477e 1033d45` exits 0.

**DEC-196 preconditions at S'''' = `1033d45`.** All hit: `DEC-191`
and `contactId: null` present in both `src/routes/api/users.ts` and
`src/routes/review.ts`; `data-required` present in
`src/views/form-render.tsx`; `chunkSelection` and `/tracks` present
in `app/src/pages/submissions/SubmissionsTable.tsx`; `git ls-tree` at
`1033d45` lists `test/email-log-null-contact.test.ts`,
`test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`,
`app/src/pages/submissions/bulk.test.ts`, and `.dev.vars.example`,
and does NOT list `.dev.vars`. No pre-existing "build+test @
1033d45" PASS section found on `main` (dedupe rule not triggered).

**Execution.** `git worktree add --detach` at `1033d45` into a
scratch worktree outside the repo checkout; confirmed no `.dev.vars`
file present in that worktree (none read or printed). `npm ci`
clean. `npm run build`: `tsc --noEmit` (root) + `tsc --noEmit -p
app/tsconfig.json` + `vite build` all clean — 132 modules
transformed, 19 asset files emitted under `public/admin/assets`
(entry `index-C0u1DC3L.js` 175.94 kB raw / 57.52 kB gzip). `npm test`:
first run showed 1 failure (`test/auth.test.ts` login-rate-limit
20th-attempt-429 case, `401` vs expected `429`); re-running
`test/auth.test.ts` alone passed 21/21 in 6.76s, and a full
`npm test` re-run passed clean at **154 files / 1380 tests** — the
single failure is confirmed a full-suite-only timing flake in the
in-memory login limiter (test-order/concurrency sensitive), not a
regression; both figures exceed the 7f7477e floor (152 files / 1368
tests). The three new w14 test files
(`test/email-log-null-contact.test.ts`, `test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.test.ts`) all ran and passed (3 + 6 +
5 = 14 tests). `npm run bundle:check`: entry bundle 58.86 kB gzip
against a 300.00 kB budget — PASSED.

**Cleanup.** Scratch worktree removed via `git worktree remove
--force` after the run; nothing else touched outside this ledger
section (and the optional detail file below).

OPEN ITEMS: 1 (the observed `test/auth.test.ts` full-suite flake on
the login rate-limiter's 20th-attempt case; reproduces intermittently
under full-suite concurrency but passes reliably in isolation and on
suite re-run — worth a future look at whether the limiter's in-memory
state or timers need better test isolation, but does not block this
gate).
RESULT: PASS

## 2026-08-10 task-w15-b — walkthrough @ 1033d45

Full run detail: `docs/verification-log/task-w15-b-walkthrough.md`.

S'''' derived per DEC-114/DEC-196: `main` first-parent history above
`1033d45` ("merge task-w14-c") is `4e5256e` ("scribe wave 15") only,
which diffs to `decisions/DEC-196.md`, `field-guide/index.md`, and a
pure string-constant addition (`export const DEC_196 = "..."`) plus a
one-character string-literal fix inside the pre-existing `DEC_131`
string in `src/decisions.ts` — no code logic, within the DEC-114
bookkeeping exclusion set. `1033d45` is therefore S''''. Ancestor
checks both hold: `git merge-base --is-ancestor 2dd2f33 1033d45` and
`--is-ancestor 7f7477e 1033d45`.

DEC-196 precondition greps at `1033d45` (all present, none missed):
`DEC-191` comment + `contactId: null` in both
`src/routes/api/users.ts` and `src/routes/review.ts`; `data-required`
in `src/views/form-render.tsx` (all four required-capable controls);
`chunkSelection` import/use and `/tracks` fetch in
`app/src/pages/submissions/SubmissionsTable.tsx`; `test/email-log-
null-contact.test.ts`, `test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`, `app/src/pages/submissions/
bulk.test.ts` all present in `git ls-tree -r 1033d45 --name-only`,
which also lists `.dev.vars.example` and does not list `.dev.vars`.
No dedupe hit: no prior ledger section carries a full heading ending
`@ 1033d45` for this gate type (the `task-w15-c @ 7c4101c` and
`task-w15-h @ 675219f` entries are dead-campaign homonyms per DEC-196
and do not match).

Ran in a fresh detached worktree at `1033d45`
(`chautauqua-wt/task-w15-b-run`, git worktree add --detach). Confirmed
no `.dev.vars` present pre-run (never read/printed one); `npm run
predev` materialized `.dev.vars` from the tracked `.dev.vars.example`
(DEC-187 — required because `npx wrangler dev` is invoked directly
here, bypassing the `dev` script's automatic `predev` lifecycle hook).
`npm ci` clean. `npm run build` green (tsc + app tsc + vite build).
`npm run db:migrate` applied all 14 migrations. `npm run seed` green
(D1 rows + 8 R2 objects incl. seed file + 4 headshots). Booted `npx
wrangler dev --port 8951` (DEC-196 port binding). Ran `npm run
walkthrough -- --url http://localhost:8951`.

6/6 modules green: producer, review, speaker, public, data, scale —
all J1-J12 checks passed, including the DEC-175 authz probes
(existence-hiding 404s vs authz-denial 403s across reviewer/speaker/
API surfaces) and the DEC-187 `/dev/mailbox` assertions (J2 mailbox
GET 200 plus bulk-remind/onboarding-remind mailbox visibility in the
speaker and review modules). Extra probe recorded: the admin
submissions track filter (w14-a) is exercised live by producer J3
(`GET /api/v1/events/:id/tracks` then `GET .../submissions?trackId=`,
both 200, non-empty) — this is the same `/tracks` fetch and filter
data path `SubmissionsTable.tsx` now consumes client-side; and the
DEC-194 `data-required` dataset contract on all four required-capable
form controls was confirmed present in the served `form-render.tsx`
markup at S'''' per the precondition grep above (browser-side gating
preserved, not re-executed via headless DOM in this scripted run).

**OPEN ITEMS: 0**

**RESULT: PASS**

## 2026-08-10 task-w15-d — render-sweep @ 1033d45

DEC-196 gate lane (render-sweep, DEC-144/DEC-139). S'''' derived per
DEC-114: newest code-bearing first-parent commit at gate start was
`1033d45` ("merge task-w14-c"), matching DEC-196's EXPECTED value.
`git merge-base --is-ancestor 2dd2f33 1033d45` and `--is-ancestor
7f7477e 1033d45` both confirmed (exit 0).

**Preconditions (DEC-196 marker list), all present at `1033d45`:**
`DEC-191` comment + `contactId: null` in both `src/routes/api/
users.ts` (line 88) and `src/routes/review.ts` (line 470);
`data-required` attribute present in `src/views/form-render.tsx`
(lines 33/43/55); `chunkSelection` import and `/tracks` fetch both
present in `app/src/pages/submissions/SubmissionsTable.tsx`;
`test/email-log-null-contact.test.ts`, `test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`, `app/src/pages/submissions/
bulk.test.ts` all listed by `git ls-tree -r 1033d45 --name-only`,
which also lists `.dev.vars.example` and does not list `.dev.vars`.
No precondition miss.

**Dedupe check.** No prior ledger section matches the full heading
`render-sweep @ 1033d45` before this entry — proceeded with a fresh
run rather than citing (homonym guard: `task-w12-e — render-sweep @
7f7477e` and `task-w13-d — render-sweep @ 7f7477e` are dead-campaign/
VOID per DEC-195 and were not cited).

**Execution.** Fresh detached worktree created at `1033d45` via `git
worktree add --detach ... 1033d45` (no `.dev.vars` present before the
run; never read or printed one — `ensure-dev-vars.ts` created it from
`.dev.vars.example` internally during the gate). `npm ci
--prefer-offline --no-audit --no-fund --silent`, `npm run build`
(tsc + app tsc + vite build, all clean), `npm run db:migrate` (13/13
migrations applied clean on a fresh local D1), `npm run seed`
(535 statements + 8 R2 assets) all succeeded. `npm run gate:render-
sweep` self-allocated its own local port (56143 this run, per DEC-
189(5) — not hardcoded) and its own migrate+seed cycle (re-ran cleanly
against a freshly-reset `.wrangler/state`), then logged in as
organizer/reviewer/speaker via the real `/login` form using seeded
credentials and walked every `app/src/routeManifest.ts` entry.

**Result table:** all 31 routes PASS (organizer: /admin/overview,
/admin/submissions, /admin/submissions/forms, /admin/submissions/
seed_submission_0001, /admin/speakers, /admin/content, /admin/agenda,
/admin/comms, /admin/contacts, /admin/settings, /admin/review,
/admin/review/plans/new, /admin/review/plans/
seed_evaluation_plan_0001, .../progress, .../results, /admin/*;
reviewer: /admin/review, /admin/review/plans/
seed_evaluation_plan_0001, .../submissions/seed_submission_0002;
speaker: /portal, /portal/submissions/seed_submission_0001, .../edit,
/portal/profile, /portal/tasks, /portal/tasks/
seed_task_assignment_0001/form; public: /e/devflow-conf-2027/sessions,
.../speakers, .../gallery, .../agenda, .../schedule, /submit/
devflow-conf-2027) — zero console/pageerror events collected across
all routes. `app/src/routeManifest.ts` still declares 32 `path:`
entries (31 concrete routes + the `/admin/*` catch-all counted once in
the sweep's own tally), matching the 7f7477e baseline of 31/31 — no
growth in the route enumeration since the last verified sweep.
Specifically checked per this task's callouts: `/admin/submissions`
PASS with the track-filter dropdown populated (w14-a fix) and
`/submit/devflow-conf-2027` PASS with `data-required` attributes
rendering (w14-b fix) — no regression in either area.

**OPEN ITEMS: 0**

**RESULT: PASS — 31/31 routes green, zero console/page errors**

## 2026-08-10 task-w15-e — triage-closure @ 1033d45

DEC-069/DEC-139/DEC-195/DEC-196 gate-of-gates, mirroring the
`task-w13-f — triage-closure @ 7f7477e` procedure rebased to
S'''' = `1033d45`. Log-only lane. Full detail also in
`docs/verification-log/task-w15-e-triage-closure.md`.

**STEP 1 — sha derivation, ancestor check.** DEC-114 first-parent walk
from `main` at gate start lands on `1033d45` ("merge task-w14-c") as
the newest code-bearing first-parent commit: `4e5256e` ("scribe wave
15") touches only `decisions/DEC-196.md`, `field-guide/index.md`,
`src/decisions.ts` (bookkeeping); `00d775e` (merge task-w15-f),
`d317bce` (merge task-w15-a), `01b9793` (merge task-w15-b), `0487e7e`
(merge task-w15-d), and `8b60563` (merge task-w15-c) each touch only
`docs/verification-log.md` and/or a new
`docs/verification-log/task-w15-*.md` detail file (ledger bookkeeping
per DEC-114's exclusion set) — matching DEC-197's live confirmation.
`d550885` ("scribe wave 16") touches only `decisions/DEC-197.md`,
`field-guide/index.md`, `src/decisions.ts` — also bookkeeping. S''''
is therefore not superseded and remains `1033d45`, matching DEC-196's
expected value exactly. `git merge-base --is-ancestor 2dd2f33 1033d45`
exits 0; `git merge-base --is-ancestor 7f7477e 1033d45` exits 0.

**STEP 2 — DEC-196 preconditions at S'''' = `1033d45`.** All hit:
`DEC_191` marker present in `src/decisions.ts`; `contactId: null`
present in both `src/routes/api/users.ts` (line 88) and
`src/routes/review.ts` (line 470); `data-required` present in
`src/views/form-render.tsx`; `chunkSelection` and `/tracks` present in
`app/src/pages/submissions/SubmissionsTable.tsx`; `git ls-tree -r
1033d45 --name-only` lists the four new w14 test/helper files
(`test/email-log-null-contact.test.ts`,
`test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`,
`app/src/pages/submissions/bulk.test.ts`) and `.dev.vars.example`, and
does NOT list `.dev.vars`. No precondition miss.

**STEP 3 — own build+test at S'''' in a fresh detached worktree, no
`.dev.vars`.** `git worktree add --detach /tmp/w15e-verify 1033d45`;
confirmed only the tracked `.dev.vars.example` present, no `.dev.vars`
(none read or printed). `npm ci --prefer-offline --no-audit --no-fund
--silent` clean. `npm run build` — PASS (dual `tsc --noEmit` + `vite
build`, 132 modules transformed, 19 output assets, no errors). `npm
test --silent` — PASS: **154 test files / 1380 tests, all green, 0
failures** (floor >=152 files/1368 tests met and exceeded; no flake
observed this run — the `test/auth.test.ts` full-suite flake noted by
`task-w15-a` did not reproduce here). Worktree removed via `git
worktree remove --force` after the run.

**STEP 4 — PLANNER marker harvest.** `git log --format='%h %B'
2dd2f33..1033d45 | grep 'PLANNER:'` returns one line of prose from a
prior triage-closure commit message ("...task-w8-e/w9-e PASS re-runs;
no live PLANNER:\nmarkers; ...") — a mention *about* the absence of
markers, not a literal `PLANNER:` commit-message marker itself. No
genuine marker in range. Nothing to disposition.

**STEP 5 — eval-findings.md mandate closure.** The Section A/B/E/F
citation files catalogued by `task-w8-g — triage-closure @ 38860f9`
and re-confirmed by `task-w13-f — triage-closure @ 7f7477e` (this
file, above) are re-confirmed present at S'''' = `1033d45` via `git
cat-file -e 1033d45:<path>` (no miss): Section A —
`test/admin-assets-config.test.ts`,
`app/src/pages/submissions/Submissions.render.test.tsx`; Section B —
`app/src/lib/dates.ts` + `app/src/pages/review/Review.render.test.tsx`,
`test/events-reviewer-access.test.ts`,
`test/itinerary-roundtrip.test.ts`, `test/overlap-lanes.test.ts`,
`test/contact-profile-roundtrip.test.ts` +
`test/contacts-profile-admin.test.ts`, `test/contacts-import.test.ts`,
`test/contacts.test.ts`; Section E — `test/seed.test.ts`; Section F —
`scripts/render-sweep.ts` + `scripts/render-sweep-lib.ts` +
`test/render-sweep-lib.test.ts` and the `app/src/**/*.render.test.tsx`
component smokes, counted directly at S'''' via `git ls-tree -r
1033d45 --name-only | grep -c 'app/src/.*\.render\.test\.tsx$'` =
**17**, matching the baseline. No new open item found.

**STEP 6 — post-S'''' first-parent commit audit (DEC-114).** Every
first-parent commit on `main` after `1033d45` observed during this
gate — `4e5256e` (scribe wave 15), `00d775e` (merge task-w15-f),
`d317bce` (merge task-w15-a), `01b9793` (merge task-w15-b), `0487e7e`
(merge task-w15-d), `8b60563` (merge task-w15-c), `d550885` (scribe
wave 16) — was diffed via `git diff --name-only <c>^..<c>` and each
touches only the bookkeeping exclusion set (`docs/verification-log.md`,
`docs/verification-log/*.md`, `decisions/DEC-196.md`,
`decisions/DEC-197.md`, `field-guide/index.md`, `src/decisions.ts`).
None supersede S''''. Also confirmed zero conflict-marker lines
(`<<<<<<<`/`=======`/`>>>>>>>`) anywhere in `docs/verification-log.md`
on `main` — the transient conflict markers DEC-197 flagged as
observed in intermediate merge commit `00d775e` are confirmed resolved
by `01b9793` and remain resolved here.

**STEP 7 — sibling battery, all at S'''' = `1033d45`.** All five
required sibling sections are present in `docs/verification-log.md`
on `main` at the same S'''', each ending `RESULT: PASS`:
- `task-w15-a — build+test @ 1033d45` — PASS (154 files / 1380 tests,
  build clean, bundle 58.86 kB gzip under 300 kB budget). Its
  `OPEN ITEMS: 1` note (`test/auth.test.ts` login-rate-limit
  20th-attempt case, full-suite-only concurrency flake, passes in
  isolation and on suite re-run) is dispositioned ACCEPTED /
  non-blocking for stage-1 exit per DEC-197; per DEC-197 this section
  counts as PASS with effectively zero live open items for the
  DEC-069/139/195/196 exit predicate. No fix task is warranted while
  the battery is live.
- `task-w15-b — walkthrough @ 1033d45` — PASS.
- `task-w15-c — perf-smoke @ 1033d45` — PASS.
- `task-w15-d — render-sweep @ 1033d45` — PASS (31/31 routes green,
  zero console/page errors).
- `task-w15-f — spec-audit @ 1033d45` — PASS.

All five PASS at one S'''' — battery complete, this triage-closure
section is the sixth. Applying the HOMONYM GUARD (DEC-196, sixth-gen):
the dead-campaign `task-w15-f — triage-closure @ ce451d9` and
`task-w15-k — triage-closure @ 675219f` sections, and the VOID
current-campaign `task-w12-g` / `task-w13-f — triage-closure @
7f7477e` sections, were excluded from this battery match by requiring
the full heading including `@ 1033d45` — none of those homonyms carry
that suffix, so no false match occurred. Likewise the dead-campaign
`task-w15-e — spec-audit @ 7c4101c` homonym (this file, earlier) does
not carry the `@ 1033d45` suffix and was not used.

All six task-w15-* battery sections (`task-w15-a` build+test +
`task-w15-b` walkthrough + `task-w15-c` perf-smoke + `task-w15-d`
render-sweep + `task-w15-f` spec-audit + this `task-w15-e`
triage-closure) are PASS at one frozen S'''' = `1033d45`, satisfying
DEC-197's wave-17 declaration checklist items 1-2. Per DEC-197 item 3,
zero conflict-marker lines confirmed above. Item 4 (no live
task-w15-* branch refs) is outside this ledger-only lane's scope to
enforce (branch lifecycle is orchestrator-managed) but is noted here
for wave-17's benefit: once this branch merges, `task-w15-e` should no
longer have a live unmerged ref.

OPEN ITEMS: 0

RESULT: PASS

## 2026-08-10 task-w20-a — build+test @ 6807b67

Verification-only lane per DEC-206/DEC-205/DEC-197 (details in
`docs/verification-log/task-w20-a-build-test.md`).

Step 1 — DEC-114 newest-code-bearing-sha derivation: `git log
--first-parent --oneline` from `main` (HEAD `78bb286`) gives
`78bb286 scribe wave 20` -> `6807b67 merge task-w18-b` -> ... .
`git diff --name-only 6807b67 78bb286` = `decisions/DEC-205.md`,
`decisions/DEC-206.md`, `field-guide/index.md`, `src/decisions.ts`
only, and the `src/decisions.ts` diff is two appended `export const
DEC_205` / `DEC_206` string lines with no other code touched — all
excluded categories per DEC-114. Confirmed newest code-bearing sha =
`6807b67`, matching the FROZEN binding. No drift.

Step 2 — DEC-203 precondition greps at `6807b67` (via `git show
6807b67:<path>`):
- `src/routes/api/users.ts` line 57: `record.email.trim().toLowerCase()`
  — present.
- `src/server/repo/users.ts` line 54: `` .where(sql`lower(${schema.user.email}) = ${input.email}`) `` — present.
- `src/index.ts`: `import { accountRoutes } from "./routes/account";`
  and `app.route("/", accountRoutes);` — present.
- `src/routes/api/users.ts` welcome-email text (line 79): `An account
  has been created for you...Sign in at /login with the temporary
  password your organizer will share with you; you can change it at
  /account/password after signing in.` — no password value
  interpolated into the email body (the plaintext `password` only
  appears in the JSON response, not the email `text`), and
  `/account/password` is mentioned. All four preconditions met.

Step 3 — build+test, run in a detached worktree
(`chautauqua-wt/task-w20-a-verify`) checked out at `6807b67` (this
ledger-only lane touches nothing else in its own worktree):
- `node_modules` present (181 top-level entries; no `npm ci` needed).
- `npm run build` (root `tsc --noEmit` + `app/tsconfig.json` `tsc
  --noEmit` + `vite build`) — clean, no errors, bundle emitted.
- `npm test --silent` (full vitest suite) — **155 test files passed
  (155), 1390 tests passed (1390)**, 0 failed, including
  `test/account-password.test.ts` and the `DEC-199 email case
  normalization + login regression` describe block inside
  `test/users-api.test.ts`, and `test/auth.test.ts` (21 tests,
  including all three `POST /login rate limiting (DEC-180)` cases)
  passed green on the full-suite run itself — the known
  auth.test.ts flake did not manifest this run, so the DEC-197/206
  auth-flake re-run protocol was not needed.
- `npm run bundle:check` — PASSED (entry bundle 58.87 kB gzip, budget
  300.00 kB).

Homonym guard: dead sections `task-w20-a` / `task-w20-b — build+test @
8c7f479` and `task-w19-* — ... @ 8c7f479` elsewhere in this file are
distinct headings (different sha suffix) from this section's `@
6807b67` and were not matched or referenced as prior results for this
task.

OPEN ITEMS: 0

RESULT: PASS
