# task-w15-f — triage closure @ ce451d9

Full detail for the `## 2026-08-10 task-w15-f — triage-closure @ ce451d9`
section of `docs/verification-log.md`.

Clean worktree of latest `main` (`git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w15-f`,
created via `git worktree add ... -b task-w15-f main`). Main short-sha at
task start: `ce451d9` ("merge task-w15-c"). This gate is chained after the
walkthrough gate (task-w15-c @ 7c4101c, which itself postdates the w15-a/
w14-g walkthrough-to-endpoint conversion), per DEC-076's single-code-barrier
ordering, so this triage closure can cite that gate's PASS result directly.

## (1) The three w12-c open-PLANNER rows

All three were already dispositioned as "RESOLVED in task-w13-c" per
`docs/verification-log/task-w12-c-triage.md` and
`docs/verification-log/task-w13-c-triage-closure.md`. This task re-verifies
each disposition against the *current* code on `main` (not just trusting the
historical log entry), since file paths/names have moved since w13-c.

| # | item | verification on current main (ce451d9) |
| --- | --- | --- |
| 1 | Co-presenter invite endpoint (`participant.invite_status='invited'`) | Confirmed live: `POST /api/v1/submissions/:id/participants` at `src/routes/api/submissions.ts:137-163` (requireOrganizer + csrfJson, org-scoped via `getSubmissionOwnership`, validates `contactId` against `findContactForOrg`, calls `inviteParticipant` in `src/server/repo/participants.ts`, rejects duplicates). Comment at `src/routes/api/submissions.ts:130-135` explicitly cites DEC-070 and confirms no auto-email (product principle 4 / house invariant). Test coverage lives in `test/api-participants.test.ts` (route-level, fakeDb pattern) rather than the task-hint's `test/submissions-participants-repo.test.ts` — that filename was renamed/consolidated during the w13-c-into-main merge train when `src/server/repo/submissions/participants.ts` was further relocated to `src/server/repo/participants.ts` (per the field guide's wave-15 note); task-w15-e's spec-audit (`docs/verification-log.md:159-163`) already flagged and confirmed this same filename discrepancy. Functionally equivalent, real regression coverage confirmed present (two describe blocks: invite success + duplicate-contact rejection, plus a cross-org-isolation case at line 190). CLOSED. |
| 2 | Visibility PATCH endpoint (`participant.visible` toggle after create) | Confirmed live: `PATCH /api/v1/submissions/:id/participants/:participantId` at `src/routes/api/submissions.ts:170-196` — object-level ownership check on both the submission (`getSubmissionOwnership`) and the participant (`getParticipantOwnership`, asserting `scope.submissionId === id`) before calling `setParticipantVisible`. Test coverage in `test/api-participants.test.ts` (cross-org-isolation case at line 259, plus true/false toggle cases). CLOSED. |
| 3 | Route-level cross-org export test, all `EXPORT_KINDS` + showflow, ownership short-circuit | Confirmed live: `test/exports-cross-org.test.ts` — imports `EXPORT_KINDS`/`isExportKind` from `src/server/repo/exports.ts` (line 24), asserts the enumeration is non-empty and self-consistent (lines 79-82), then loops `for (const kind of EXPORT_KINDS)` asserting a 404 for org B's organizer against org A's real `eventId` **with no data query executed** (lines 84-93) — i.e. the ownership check short-circuits before any export-kind-specific query runs. A separate `describe` block (lines 101-115) covers the DEC-055 `GET /api/v1/events/:eventId/exports/showflow.csv` route with the same cross-org 404 + no-query-executed assertion, plus a nonexistent-event case. A third block (lines 117-121) covers the nonexistent-event path across every kind. This is exactly the DEC-075 disposition for the original w12-c item #3 (seed.ts staying single-org; isolation proven via a fake-db unit test instead of a second seeded org). CLOSED. |

All three items were also independently re-verified for regressions: `npm
test` on this worktree shows 89 test files / 898 tests, all passing,
matching the count task-w15-c's walkthrough gate recorded on the same
commit range.

## (2) PLANNER notes in merge-commit bodies since last triage

Last triage baseline: `0ee30dd` (per the field guide, w13 gates at that sha
were invalidated by two subsequent `main` moves, but the *harvest* baseline
for merge-commit-body PLANNER notes is still valid — no PLANNER-bearing
merges were silently dropped or rebased away).

Ran `git log 0ee30dd..HEAD --merges --format="=== %H %s ===%n%b"` (58 lines,
19 merge commits: task-w15-c/e/b/a, task-w14-g/e/h/f/c/a/b/d,
task-custodian-w13-3, task-w13-c/e/d/b/a, task-custodian-w12-2). `grep -n
"PLANNER" ` over that output returned zero matches — no merge-commit body in
this range contains a `PLANNER:` note.

Per the field guide's explicit instruction ("re-read refs/reflog before
concluding a branch dropped"), cross-checked `git branch -a` and confirmed
every wave-14/15 lane merge listed above corresponds to a branch that
actually landed (each merge commit has two real parents reachable from
`HEAD`; none of the 19 merges is a fast-forward/no-op). No branch was found
missing or silently dropped — this task's own worktree/branch was itself
transiently pruned mid-session (before any commit existed on it) and was
simply recreated from `main` at the same sha, which is not evidence of any
other branch being dropped.

Separately, a broader repo-wide grep (`grep -rn "PLANNER:" docs/ src/
scripts/`) turns up six historical `PLANNER:` notes, all inside
`docs/verification-log.md` / `docs/verification-log/task-w12-c-triage.md` —
all six are the same three original w12-c rows (each appears once as the
"gap" description and once inline in the table), already dispositioned as
"RESOLVED in task-w13-c" per item (1) above. No new, undispositioned
`PLANNER:` note exists anywhere in the tree.

## (3) `RESULT: FAIL` sweep

`grep -n "RESULT: FAIL" docs/verification-log.md` returns zero matches.
Every section in the log (through task-w15-e/task-w15-c above this entry)
ends `RESULT: PASS`.

## Build/test verification

`npm run build`: PASS (tsc --noEmit x2 + vite build, no errors).
`npm test`: 89 test files, 898 tests, 0 failures.

OPEN ITEMS: 0
