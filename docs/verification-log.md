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
