# task-w13-c — triage closure @ d4ebf7f

Full detail for the `## 2026-08-10 task-w13-c — triage closure @ d4ebf7f`
section of `docs/verification-log.md` (extracted per the
contention-decomposition of that file; see the stub entry there for the
OPEN ITEMS summary).

Read docs/verification-log.md as of this worktree's clone of main
(0ee30dd). A task-w12-c harvest section already exists (see
task-w12-c-triage.md), so per this task's step (2) no additional
commit-body harvest of task-w8-b..g / task-w10-b/c/d was performed —
those were already folded into the w12-c table. No FAIL bullets exist
anywhere in the log (task-w12-a and task-w12-b are both clean all-green
runs); the only open items are the three `open-PLANNER:` lines inside the
task-w12-c section. Each is dispositioned below; two got real inline
fixes with regression tests (touching src/server/repo/submissions.ts,
src/routes/api/submissions.ts, src/routes/docs.tsx,
test/submissions-participants-repo.test.ts), one got a fix scoped to the
test tree only (test/exports-cross-org.test.ts) since the identified gap
(`scripts/seed.ts` seeding one org) is explicitly out-of-scope to touch
under the no-eval-gaming rule (fixture data must stay seed-script-only,
and the PLANNER note itself named a fake-db unit test as the
correct-sized fix).

| source | item | disposition |
| --- | --- | --- |
| task-w12-c row 4 (originally flagged 6b6ef85/w8-e) | No admin/public route created a co-presenter `participant` row with `invite_status='invited'` — J7 invite accept/decline was otherwise untestable end-to-end without a direct D1 write. | fixed: `POST /api/v1/submissions/:id/participants` (src/routes/api/submissions.ts) + `inviteCoPresenter` (src/server/repo/submissions.ts) — org-scoped via `getSubmissionOwnership`, appends a participant row (`role: 'speaker'`, next `order`, `visible: true`, `invite_status: 'invited'`) for a new-or-existing contact. Does **not** send an email (DEC-009 invariant #1: status/invite changes never auto-email; notification stays an explicit separate comms action, matching every other transition in this file). Documented in `/docs/api` (docs.tsx). Regression tests: test/submissions-participants-repo.test.ts (`inviteCoPresenter` describe block, 2 cases: fresh contact + order 0, existing contact + order continues from max). |
| task-w12-c row 5 (originally flagged b310272/w8-f) | No admin API existed to toggle `participant.visible` after submission-create time — public.ts's hidden-participant visibility-gate walkthrough check worked around this with a direct D1 write. | fixed: `PATCH /api/v1/submissions/:id/participants/:participantId` (src/routes/api/submissions.ts) + `setParticipantVisible` / `getParticipantOwnership` (src/server/repo/submissions.ts) — object-level ownership check (submission's org must match caller's org, and the participant must belong to the named submission) before the write. Documented in `/docs/api`. Regression tests: test/submissions-participants-repo.test.ts (`setParticipantVisible`/`getParticipantOwnership` describe block, 4 cases: true/false writes, found/missing ownership lookup). |
| task-w12-c row 6 (originally flagged 9d34b59/w8-g) | scripts/seed.ts seeds exactly one org, so the "another org's eventId -> 404" export walkthrough check falls back to a nonexistent eventId rather than a genuine cross-org id — doesn't assert true cross-tenant isolation on that surface specifically. | fixed, test-tree-only per the PLANNER note's own scoping (seed.ts stays out of this fix — fixture data must remain seed-script-only, no-eval-gaming rule): test/exports-cross-org.test.ts constructs a fake db standing in for two real orgs (mirroring the mock pattern in test/headshot-gate.test.ts) and asserts `requireOwnedEvent` (src/routes/api/exports.ts) genuinely 404s org B's organizer against org A's real eventId, plus a 200 sanity check that org A's own organizer round-trips the same eventId successfully. |

Build (`npm run build`) and full unit suite (`npm test`) both green on
this commit: 84 test files, 869 tests, 0 failures (up from 81/859 at
0ee30dd per the task-w12-a baseline above — the 2 new test files here
account for the delta; no existing test was modified or skipped).

OPEN ITEMS: 0

> Merge note (merge-train, task-w13-c into main): main had concurrently
> split `src/server/repo/submissions.ts` into a barrel over
> `src/server/repo/submissions/{query,list,detail,create,status}.ts`. The
> three repo functions described above (`inviteCoPresenter`,
> `getParticipantOwnership`, `setParticipantVisible`) therefore landed in a
> new sibling module `src/server/repo/submissions/participants.ts`,
> re-exported from the barrel — public import path
> (`src/server/repo/submissions`) and behavior are unchanged, so the route
> and test files above are unaffected.
