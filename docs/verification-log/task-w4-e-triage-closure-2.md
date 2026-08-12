# 2026-08-10 task-w4-e — triage-closure @ 3878d4f

Full detail for the `## 2026-08-10 task-w4-e — triage-closure @ 3878d4f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

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
