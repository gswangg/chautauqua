## 2026-08-15 task-w37-a — stage-1 exit ledger @ 494b6c01

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary block. `git rev-parse HEAD` (this lane's start,
before this commit): 494b6c016c726178b53c76a55c33512bd2449422 (short
494b6c01). Newest product-bearing sha on the first-parent line
(`git log --first-parent -1 --format=%H -- src/ app/src/ migrations/
package.json`): 3a041507287b2dca3abeda3e0648a41ddeba9707 (unchanged since
wave 36 — `git log --first-parent --oneline
3a041507..494b6c01 -- src app migrations package.json` is empty).
`git merge-base --is-ancestor 3a041507... 494b6c01...` exits 0: the newest
product sha is an ancestor of this ledger's boundary, so it remains
QUALIFYING. Every live ref matching `task-w3*` in `git for-each-ref
refs/heads`, checked via `git merge-base --is-ancestor <ref> HEAD`:
task-w36-c NOT-ANCESTOR (tip 864b681e — its own committed work never
merged; content is duplicated on main via a separate commit, see full
detail), task-w36-e NOT-ANCESTOR (tip 76431743 — same pattern), task-w36-f
ANCESTOR (tip 3b3b56c7 — this is main's own `merge task-w36-b` commit,
already fully contained in HEAD), task-w37-a/-b/-c ANCESTOR (self/siblings,
identical to HEAD at read time, zero commits of their own yet).

This is DEC-069's REQUIRED FIFTH SECTION (triage closure) plus a grading
pass over the four required gate sections, all read from
`docs/verification-log.md` at this boundary (docs-only lane, DEC-069
wave-37 amendment; no src/, app/src/, migrations/, or package.json file
touched).

## Grading the four required gate sections (all landed at header sha f5783479, all QUALIFYING: 3a041507 is an ancestor of f5783479 and no product commit landed between f5783479 and this ledger's own HEAD)

1. build+test+bundle — `task-w36-a`, header `f5783479`: `RESULT: PASS
   (build clean, 1084/1084 test files and 11898/11898 tests green, bundle
   69.20 kB gzip vs 300 kB budget) at f5783479, with all three live
   w3*-glob sibling refs (task-w35-a, task-w35-e, task-w35-f) confirmed
   ANCESTOR.` / `OPEN ITEMS: 0`. Section present, QUALIFYING.
2. J1-J12 persona walkthrough — `task-w36-b`, header `f5783479`:
   `RESULT: PASS — all six walkthrough areas (producer, review, speaker,
   public, data, scale) PASS at product sha 3a041507 (HEAD f5783479 is
   docs-only on top of it), including the DEC-063-amended break-lifecycle
   (producer/J9), printable programme, and anonymous hub sections, once a
   gitignored local .dev.vars port mismatch — precedented, not a product
   defect — was corrected per task-w26-f's own fix.` / `OPEN ITEMS: 0`.
   Section present, QUALIFYING.
3. perf smoke — `task-w36-c`, header `f5783479`: `RESULT: FAIL (reviewer
   queue, 1 of 3 runs PASS, row remains OPEN at this boundary despite
   carrying every ancestor fix task-w35-a credited) / PASS (plan results
   (page 1), 3 of 3 runs PASS, row CLOSED at this boundary) at
   f5783479c7a1b8c96ef1506c3cfff1661fd6e338. files library (page 1) and
   onboarding grid (800 speakers x 5 tasks) both closed, 3 of 3 PASS each.
   portal home/portal tasks/portal submission detail (task-w35-d, an
   ancestor) all PASS 3 of 3, but only reachable via this lane's
   measurement-only local D1 fixup — unreachable via the documented
   recipe alone until scripts/perf-seed.ts's missing perf-speaker insert
   loop (FINDING above) is landed.` / `OPEN ITEMS: 4`. Section present,
   QUALIFYING, RESULT is FAIL.
4. SPEC §6/§7/§8/§9 static audit — `task-w36-d`, header `f5783479`:
   `RESULT: QUALIFYING.` / `OPEN ITEMS: 1 — the < 300 KB gz figure at this
   exact HEAD (f5783479) is PENDING-OWNED(task-w36-a); the last known
   ancestor reading (c6dbdb7c, 69.19 kB gz) is 126 commits stale and not
   re-inferred as still-PASS. All other §6/§7/§8/§9/rubric items above are
   CONFIRMED with a quoted file:line or grep at this HEAD.` Section
   present, QUALIFYING. NOTE (cross-reference, not a fix): sibling
   `task-w36-a`'s own receipt, landed at the same header sha f5783479,
   independently reports a fresh bundle:check figure of 69.20 kB gzip
   PASS — that PENDING-OWNED dependency is answered by a sibling receipt
   at the identical boundary, carried forward as-is below rather than
   closed by this lane (DEC-453: a lane does not fix what it measures).

Advisory (not one of the four required rows, listed for completeness):
render-sweep — `task-w36-e`, header `f5783479`: `RESULT: PASS` (all seven
passes clean, `.chq-participation-menu-caret` instrument gap closed) /
`OPEN ITEMS: 0`.

Full detail: docs/verification-log/task-w37-a-stage-1-exit-ledger-494b6c01.md.

RESULT: FAIL — stage-1 exit predicate (DEC-069) is NOT satisfied at this
boundary: 3 of 4 required gate sections read RESULT: PASS (build+test+
bundle, walkthrough, SPEC audit-as-QUALIFYING) but perf smoke reads
RESULT: FAIL (reviewer queue unstable, 1 of 3 runs PASS against the 50ms
read budget), and the triage-closure count below is 5, not 0.

## Triage closure (DEC-069's required fifth section; enumerates, does not fix, per DEC-453)

1. `src/routes/review/reviewer.ts`, `GET /api/v1/review/plans/:id/queue`
   handler — reviewer queue perf unstable at f5783479: 1 of 3 runs PASS
   (54.2/36.5/58.5ms raw; 51.5/34.1/55.3ms adjusted vs the 50ms read
   budget), despite carrying its credited task-w32-b fix (proven ancestor).
   Source: `task-w36-c-perf-smoke-f5783479.md`. Owner: wave-38 lane
   (perf-stability, reviewer queue).
2. `src/routes/review/plans-progress.ts` — plan progress (page 1) perf
   unstable at f5783479 (non-mandate finding): 1 of 3 runs PASS
   (60.7/43.0/56.5ms raw; 58.1/40.7/53.2ms adjusted vs the 50ms read
   budget), same instability pattern task-w35-a already logged at
   a0b8501b. Source: `task-w36-c-perf-smoke-f5783479.md`. Owner: wave-38
   lane (perf-stability, plan progress).
3. `scripts/perf-seed.ts` (around the reviewer-minting loop at
   `scripts/perf-seed.ts:440-470`) — has no function that inserts the
   `user`/`contact`/`participant`/`task_assignment` rows
   `scripts/perf-seed-lib.ts`'s `PERF_SPEAKER_USER_ID` /
   `PERF_SPEAKER_CONTACT_ID` / `perfSpeakerParticipantId` /
   `perfSpeakerTaskAssignmentId` are exported for; every documented-recipe
   run of `npm run perf:smoke` throws in `login()` (`expected 302, got
   401`) before any check runs. Source: `task-w36-c-perf-smoke-
   f5783479.md`. Owner: wave-38 lane (perf-seed speaker insert loop).
4. `scripts/perf-seed-lib.ts` (the `perfSpeakerAcceptedIndexes` doc
   comment, plus the matching comment in `scripts/perf-smoke.ts` at its
   `portalSubmissionId` line) — assumes the perf speaker's participant
   rows attach to the first N ids in seed order
   (`seed_perf_submission_1501..1505`), but `GET
   /api/v1/events/:id/submissions?status=accepted` page 1 (what
   `fetchAcceptedSubmissionIds`/`icsIds[0]` actually reads) returns
   descending order (`_1800..1796`); implementing item 3 above per the
   current doc comment reproduces a `portal submission detail failed
   during warmup: 404`. Depends on item 3 landing first. Source:
   `task-w36-c-perf-smoke-f5783479.md`. Owner: wave-38 lane (same lane as
   item 3, sequenced after it).
5. `docs/verification-log/task-w36-d-spec-audit-f5783479.md`'s own
   `< 300 KB gz` row — recorded `PENDING-OWNED(task-w36-a)` at read time
   because task-w36-a's ref was identical-to-HEAD when task-w36-d read it;
   answered by sibling `task-w36-a-build-test-f5783479.md` at the same
   header sha (`69.20 kB gzip (budget 300.00 kB) — bundle:check PASSED`),
   but no lane has re-run the SPEC audit section itself to fold that
   number in and retire the PENDING-OWNED label. Owner: wave-38 lane (next
   SPEC static-audit run cites task-w36-a's 69.20 kB figure and closes
   this row; not itself a re-run of bundle:check).

OPEN ITEMS: 5
