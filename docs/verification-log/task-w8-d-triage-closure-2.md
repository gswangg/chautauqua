# 2026-08-10 task-w8-d — triage-closure @ d12eb25

Full detail for the `## 2026-08-10 task-w8-d — triage-closure @ d12eb25` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

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
