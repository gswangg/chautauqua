# task-w29-a: onboarding grid TIER-0 perf (DEC-829/DEC-773)

QUALIFYING
INVALIDATED BY: src/server/repo/tasks/**, migrations/**

Boundary: `1d274c8b` (branch `task-w29-a`, off `main` `0f854f0a`).

## Defect (before)

Measured at boundary `ceda66f2` (docs/verification-log.md:3750-3759,
`docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md`),
`GET /api/v1/events/:eventId/onboarding`:

- default profile (800 contacts): adjusted p95 **116.1ms** vs a 50ms
  `read` budget.
- aie profile (6,000 contacts): adjusted p95 **995.7ms**, also over the
  150ms raw ceiling.

Cause: `getOnboardingGrid`'s total COUNT (grid.ts:240-244 pre-fix), page
SELECT (:248-262), and `speakersCountRows` (:390-393) all ran `FROM
contact WHERE <correlated EXISTS over participant JOIN submission>`
(`rosterParticipantExistsForContact`, src/server/repo/tasks/crud.ts) — the
outer relation was every contact in the org, not the event's roster.

## Fix

All three statements now drive `FROM schema.participant INNER JOIN
schema.submission ... INNER JOIN schema.contact ...`, scoped by
`rosterParticipantConditions(eventId)` (`submission.eventId = ? AND
submission.status = 'accepted'`) in the WHERE clause — `contact` is
joined by id only, for name/company/search/ordering. `count(distinct
contact.id)` / `GROUP BY contact.id` collapse the (rare) case of a
contact holding more than one accepted participation on the event to one
roster row, matching pre-existing semantics.

Unchanged (verified by the pre-existing `test/onboarding-grid-*.test.ts`
suite, all green): the `OnboardingGrid` JSON envelope
(tasks/rows/total/page/perPage/counts/timezone), row ordering
(`lower(last_name) asc, lower(first_name) asc, contact.id asc`), the
`q`/`taskId`/`status`/`overdueOnly`/`inviteStatus` filter semantics, the
DEC-936 non-empty-participations fail-loudly invariant, and the counts'
three distinct populations.

No migration added — existing indexes (`submission_event_id_status_idx`,
`participant_submission_id_idx`, `participant_contact_id_idx`) already
cover the new join/filter shape; `npm run db:migrate` ran clean with no
new migration file.

## Measurement (after)

`npm run seed` (demo-seed organizer identity, required for perf:smoke
login — GAP already flagged by task-w27-d), then `npm run perf:seed`,
then `wrangler dev --port 8891`, then `PERF_URL=http://localhost:8891
npm run perf:smoke` (default profile only, per task scope). Server killed
after the run.

`onboarding grid (800 speakers x 5 tasks)`:

- **before** (boundary `ceda66f2`): raw 106.6ms → adjusted p95 **116.1ms**
  — FAIL (exceeds 50ms `read` budget).
- **after** (boundary `1d274c8b`, this fix): raw 25.5ms → adjusted p95
  **23.0ms** — **PASS**.

Full default-profile run at this boundary: 33 checks, 3 pre-existing FAILs
unrelated to this lane's scope (`reviewer queue` adjusted 56.8ms,
`files library (page 1)` adjusted 514.7ms — also breaches the 150ms raw
ceiling, `plan results (page 1)` adjusted 87.2ms), all outside
`src/server/repo/tasks/grid.ts` and pre-existing per the same
`ceda66f2` baseline (files library's cause is separately diagnosed in
the field guide's DEC-773 entry, owned by a different lane). Overall
script exit code non-zero (pre-existing gate behavior, driven by those
3 unrelated FAILs), same as the `ceda66f2` baseline run.

aie profile (6,000-contact scale) was NOT re-run — task scope is DEFAULT
profile only.
