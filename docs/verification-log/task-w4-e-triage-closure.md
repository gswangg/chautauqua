# task-w4-e — triage-closure @ 3878d4f

Log-only/bookkeeping lane (DEC-090: commits touching only
`docs/verification-log.md`, `docs/eval-findings.md`,
`field-guide/index.md`, `decisions/*.md`, and string-constant appends to
`src/decisions.ts` are non-code-bearing). This lane touches ONLY
`docs/eval-findings.md`, `docs/verification-log.md`, and this file — no
`src/`, `app/`, `scripts/`, or `migrations/` changes. Worktree
`chautauqua-wt/task-w4-e` branched off `main` at `521e903` ("merge
task-w4-c", the tip at start). Walking back skipping non-code-bearing
commits (task-w4-c/-b/-d/-a gate lanes, all log-only per DEC-090/093;
scribe wave-4 additions of decisions/DEC-090..093 and
field-guide/index.md) lands at `3878d4f` ("merge task-w2-d") — the same
code-bearing sha every sibling wave-4 gate cites, confirmed via
`git diff --stat 3878d4f..HEAD -- . ':(exclude)docs' ':(exclude)decisions' ':(exclude)field-guide'`
showing only `src/decisions.ts` (decision-constant string appends, no
functional change).

## (1) Disposition of docs/eval-findings.md round-1 entries

Source entries (from `2103c69`, "Eval findings round 1"), verified
in-tree at `main` HEAD (functionally == `3878d4f`):

- **Issue 2** (acceptance side effects not exactly-once) — **CLOSED** by
  DEC-079. `src/server/repo/submissions/status.ts:154` now calls
  `runAcceptancePlanning(db, eventId, row.id, now)` BEFORE the
  status/acceptedAt UPDATE is applied at line 159 (`await
  runAcceptancePlanning(...)` precedes the `acceptedAt: result.acceptedAt
  !== null ? new Date(result.acceptedAt) : null` write) — planning runs
  first, so a mid-batch throw never leaves a submission marked accepted
  with onboarding silently skipped. `status.ts:2` and `:18` document the
  DEC-079 ordering explicitly (`void DEC_079;` compile-checked reference
  per house convention). Runtime evidence: task-w4-b's walkthrough
  "scale" section, steps 2-4 — PASS (`docs/verification-log/
  task-w4-b-walkthrough.md:73-100`): one 110-id bulk accept
  (`updated=110`), onboarding `task_assignments` present for sampled
  fresh contacts, and an identical re-POST leaves assignment counts
  unchanged (exactly-once), confirming the DEC-079 ordering holds under
  a real chunked/batched bulk status change, not just unit-level.

- **Issue 3** (public surfaces unchunked `inArray`) — **CLOSED** by
  DEC-080. `src/server/repo/public.ts:13` imports `chunkIds` and uses it
  at four call sites (`:157`, `:178`, `:210`, `:286` — `hydrateSessions`,
  `getPublicAgenda`, sessions show-more, track filter); the one remaining
  unchunked `inArray` (`:397`) is the DEC-078 bounded-list exemption
  (explicitly commented). The user-controlled `?ids=` list on
  `/e/:slug/schedule.ics` is capped: `src/lib/itinerary.ts:11` exports
  `MAX_ITINERARY_IDS = 300`, rejecting requests beyond it with 400
  instead of silently truncating (DEC-080). `loadIcsScheduleData` in
  `src/server/repo/comms.ts:221-249` now batches via `chunkIds` at
  `:232` (same pattern as the already-chunked `loadComposeSubmissions`
  earlier in the file).

- **Issue 4** (review surface full-event scans per reviewer) —
  **CLOSED** by DEC-081. `src/domain/evaluation.ts:289` exports
  `resolveAssignments`, a pure set-based assignment resolver;
  `src/routes/review.ts` imports it (`:20`) and calls it at `:281` and
  `:352` in place of per-reviewer `listPlanFilteredSubmissions` scans.

- **Issue 5** (rounds dead knob) — **CLOSED** by DEC-082/087.
  `migrations/0009_review_rounds.sql` exists; `listEvaluationsForPlan`
  (`src/server/repo/review.ts:528`) is now a 3-arg function
  `(db, planId, round)`, called with `plan.currentRound` at
  `src/routes/review.ts:348,438` (advancing rounds) instead of the
  hardcoded `round = 1`; an advance-round endpoint returns 409 per
  DEC-082 (verified present in `src/routes/review.ts`, round-advance
  handler).

## Decision docs that narrow requirements (round-1 section)

- **DEC-022** — **SUPERSEDED** by DEC-083: `src/server/pubcache.ts`
  implements real version-salted `caches.default` + KV
  (`PUBVER_KEY = 'chq:pubver'`) purge-on-any-mutation, replacing the
  bounded-60s-staleness narrowing. Purge implemented, not just
  reframed.
- **DEC-059** — **SUPERSEDED** by DEC-084: `src/lib/image-dims.ts`
  (`MAX_HEADSHOT_EDGE_PX = 2048`) adds server-side PNG/JPEG header
  sniffing that rejects oversized API-direct headshot uploads,
  closing the gap DEC-059's client-canvas-only downscale left open.
- **DEC-054** and **DEC-061** — **UPHELD as sanctioned deferrals** per
  DEC-085: DEC-085 records both as decided-not-implemented findings
  needing no code (§10's own "only after J1-J12 green" gate covers
  DEC-061; DEC-054's custom-status deferral is recorded with §10 item 4
  explicitly deferred alongside it).
- **Minor notes** (`submittedAt` ≡ `createdAt`; `accentColor`
  interpolation) — **CLOSED** per DEC-085: `submittedAt` being
  `createdAt` is correct under DEC-014 (drafts never create submission
  rows), not a defect; `accentColor` risk was already assessed as low
  (hono/jsx-escaped) with no code action needed.

All five round-1 findings plus all four narrowing-decision items are
dispositioned. `docs/eval-findings.md` is replaced with a short header
pointing to this section — zero open findings remain in that file.

## (2) PLANNER: harvest, 2103c69..HEAD

`git log --format='%h %B' 2103c69..HEAD | grep -n 'PLANNER:'` — **zero
matches** (verified in this worktree). The one prior in-source item
referencing an open concern is not a commit-body `PLANNER:` note but a
source-code comment: `scripts/walkthrough/scale.ts:16`, a `GAP NOTE`
that DEC-089's original text assumed an organizer JSON PATCH-title
endpoint that does not exist in the DEC-005 route map. **Resolved by
DEC-092**: DEC-092 ratifies the actual write path scale.ts uses instead
(public submit -> claim -> bulk accept -> content-status approve ->
speaker portal edit, DEC-041) as the sanctioned DEC-086 publish-affecting
write; the GAP NOTE is recorded here as **CLOSED**, not an open item —
per DEC-092's own instruction to triage-closure.

## (3) Sweep of docs/verification-log.md + w4 detail files for unresolved FAIL/PLANNER: lines

Swept `docs/verification-log.md` and every
`docs/verification-log/task-w4-*.md` file present at this task's start
(`task-w4-a-build-test.md` PASS, `task-w4-b-walkthrough.md` FAIL,
`task-w4-c-perf-smoke.md` FAIL, `task-w4-d-spec-audit.md` PASS). No
`PLANNER:` lines found anywhere in the swept files. Two genuine,
unresolved `RESULT: FAIL` lines found, **neither covered by any existing
decision doc** (distinct from the DEC-092-closed GAP NOTE above):

1. **`docs/verification-log/task-w4-b-walkthrough.md` — scale step 6**
   (`RESULT: FAIL`, line 147). Root cause fully diagnosed in that file
   (lines 102-134): `scripts/walkthrough/scale.ts`'s `purgeRefreshProbe`
   builds a portal-edit FormData that copies `dropdownValues` but never
   sets `trackIds`, so the server correctly 400s under
   `src/routes/portal/edit.tsx:196-199`'s required-track validation
   (DEC-041, product code behaving as designed). This is a **script bug**
   in the walkthrough harness (`scripts/walkthrough/scale.ts`, missing
   `editForm.set("trackIds", trackMatch[1]!)` in the edit-form build),
   not a product defect, and not the same issue as the DEC-092-closed GAP
   NOTE. Fixing it is code-bearing (touches `scripts/`) and out of scope
   for this docs-only lane.
2. **`docs/verification-log/task-w4-c-perf-smoke.md` — 301-id cap probe**
   (`RESULT: FAIL`, line 131). Root cause fully diagnosed in that file
   (lines 54-106): `scripts/perf-smoke.ts:181`'s DEC-089/DEC-080 cap
   probe requires 301 accepted-submission ids, but DEC-088's perf-seed
   status mix (`scripts/perf-seed-lib.ts:20`,
   `PERF_STATUS_COUNTS.accepted = 300`) produces only 300; independently
   `src/lib/pagination.ts`'s `MAX_PER_PAGE = 200` clamp plus
   `fetchAcceptedSubmissionIds`'s non-paginated single request explains
   the observed "got 200". This is a mismatch between two
   DEC-088/DEC-089-authored script artifacts, not a product defect, and
   no decision doc reconciles it. Fixing it is code-bearing
   (`scripts/perf-seed-lib.ts` and/or `scripts/perf-smoke.ts`) and out of
   scope for this docs-only lane.

Both are pre-existing, previously logged, script-only bugs (not product
code bugs) that block a clean walkthrough/perf-smoke PASS at the
code-bearing sha. No decision doc in `decisions/` (through DEC-093)
ratifies or closes either one — DEC-092 closes a different, narrower
concern (the GAP NOTE about the missing endpoint, not the `trackIds`
omission discovered while exercising the DEC-092-sanctioned path).

## Verdict

`docs/eval-findings.md`'s round-1 findings: fully dispositioned, file
pruned to a pointer header — that part of this task's scope is complete
and genuinely zero. However, honesty per this task's own instructions
("otherwise enumerate the open items honestly and close with RESULT:
FAIL") requires reporting the two script-bug FAILs found in (3): they are
real, reproducible, and un-ratified by any decision doc, so the overall
gate-wave exit predicate (five sections PASS + OPEN ITEMS: 0) is **not**
met at this sha. This lane cannot fix them (code-bearing, out of scope);
flagging both for a future code-bearing wave.

OPEN ITEMS: 2

1. `scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` never sets
   `trackIds` on the portal-edit FormData, causing scale step 6 to 400
   against the DEC-041 required-track validation instead of exercising
   the DEC-083 purge probe it is meant to test.
2. `scripts/perf-smoke.ts`'s 301-id cap probe cannot succeed against the
   DEC-088 perf-seed fixture (300 accepted, needs 301) even before
   considering `src/lib/pagination.ts`'s 200-row `MAX_PER_PAGE` clamp.

RESULT: FAIL
