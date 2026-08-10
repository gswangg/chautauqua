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
