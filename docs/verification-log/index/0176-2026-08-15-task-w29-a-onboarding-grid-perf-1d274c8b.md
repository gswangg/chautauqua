## task-w29-a: onboarding grid TIER-0 perf (DEC-829/DEC-773)

QUALIFYING
INVALIDATED BY: src/server/repo/tasks/**, migrations/**

Boundary: `1d274c8b` (branch `task-w29-a`, off `main` `0f854f0a`). Sole
owner of `src/server/repo/tasks/grid.ts`.

Rewrote `getOnboardingGrid`'s total COUNT, page SELECT, and
`speakersCountRows` so the driving relation is `participant JOIN
submission` scoped by `rosterParticipantConditions(eventId)`
(`submission.eventId = ? AND submission.status = 'accepted'`), joining
`contact` by id only for name/company/search/ordering — replacing the
prior `FROM contact WHERE <correlated EXISTS over
participant/submission>` shape whose outer relation was the whole org
contact directory. JSON envelope, row ordering, filter semantics, the
DEC-936 non-empty-participations invariant, and the counts' three
populations are unchanged (all pre-existing
`test/onboarding-grid-*.test.ts` / `test/tasks-assign-roster-scope.test.ts`
/ `test/onboarding-late-participant.test.ts` /
`test/onboarding-roster-set.test.ts` / `test/onboarding-task-backfill.test.ts`
/ `test/reaccept-onboarding.test.ts` pass unmodified except for the
fakeDb test harness needing a no-op `.groupBy()` chain stub). Added
`test/onboarding-grid-driving-relation.test.ts`, a repo-level scan
asserting the three statements never open `.from(schema.contact)`. No
migration added — existing indexes
(`submission_event_id_status_idx`/`participant_submission_id_idx`/
`participant_contact_id_idx`) already cover the new join; `npm run
db:migrate` ran clean.

`onboarding grid (800 speakers x 5 tasks)`, default profile,
`PERF_URL=http://localhost:8891 npm run perf:smoke` (`wrangler dev
--port 8891`, killed after use), after `npm run seed` + `npm run
perf:seed`:
- before (boundary `ceda66f2`, docs/verification-log.md:3750-3759): raw
  106.6ms, adjusted p95 **116.1ms** — FAIL (50ms `read` budget).
- after (this boundary): raw 25.5ms, adjusted p95 **23.0ms** — **PASS**.

Full detail, before/after table, and the run's other (pre-existing,
out-of-scope) FAILs:
`docs/verification-log/task-w29-a-onboarding-perf-1d274c8b.md`.

RESULT: onboarding grid PASS (was FAIL); 3 pre-existing unrelated FAILs
in the same default-profile run (`reviewer queue`, `files library (page
1)`, `plan results (page 1)`) — none touch `src/server/repo/tasks/**`,
owned by other lanes per the field guide's DEC-773 entry.
OPEN ITEMS: 0 (for this lane's scope)

