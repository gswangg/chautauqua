# task-w16-d: Cross-account authz / IDOR / visibility probe matrix (LOG-ONLY)

Live HTTP probe of SPEC.md:306-320 (§6) and SPEC.md:381-383 (§9's manual
cross-account checklist), run as a hostile client against `npm run dev` on
`http://localhost:8787` after `npm run db:migrate && npm run seed`. No source
file was changed by this task. Runtime data mutations made purely to
construct a probe scenario (two extra evaluation plans, one temporary
participant-visibility toggle that was reverted) are noted inline; they do
not touch the git tree.

Personas (README "For evaluators", `docs/fixtures/sample-data.json`):

| Persona | Email | Notes |
|---|---|---|
| organizer | sbek-organizer@example.com | seed_org_0001 |
| speaker1 | sbek-speaker@example.com | contact seed_contact_0001 |
| speaker2 | sbek-speaker2@example.com | contact seed_contact_0002 (second speaker session, per DEC-448 instructions) |
| reviewer | sbek-reviewer@example.com | seed_user_0004, plan_reviewer trackIndex 0 = seed_track_0001 on seed_evaluation_plan_0001 |

Result key: **PASS** = observed matches expected, no leak. **FAIL** = leak
observed (would include the exact request). No FAILs were found in this
probe; every case below is PASS.

## 1. Unauthenticated

| Request | Expected | Observed | Result |
|---|---|---|---|
| GET /api/v1/users | 401 | 401 | PASS |
| GET /api/v1/contacts | 401 | 401 | PASS |
| GET /api/v1/submissions/seed_submission_0001 | 401 | 401 | PASS |
| GET /api/v1/events/seed_event_0001/exports/showflow.csv | 401 | 401 | PASS |
| GET /api/v1/review/plans | 401 | 401 | PASS |
| GET /admin | 302 -> /login | 302 -> http://localhost:8787/login | PASS |
| GET /admin/settings | 302 -> /login | 302 -> http://localhost:8787/login | PASS |
| GET /portal | 302 -> /login | 302 -> http://localhost:8787/login | PASS |

## 2. Role crossing

| Request | Expected | Observed | Result |
|---|---|---|---|
| GET /admin as speaker1 | redirect away from admin | 302 -> /portal | PASS |
| GET /api/v1/contacts as speaker1 | 403 | 403 {"error":{"code":"forbidden","message":"Requires role 'organizer'"}} | PASS |
| GET /api/v1/events/seed_event_0001/submissions as speaker1 | 403 | 403 same shape | PASS |
| POST /api/v1/plans/seed_evaluation_plan_0001/results (read via GET) as reviewer — producer-only per SPEC.md:121 | 403 | 403 {"error":{"code":"forbidden","message":"Requires role 'organizer'"}} | PASS |
| GET /api/v1/events/seed_event_0001/branding as reviewer (admin/settings-surface API) | 403 | 403 same shape | PASS |
| GET /admin/settings as reviewer | Admin SPA shell (organizer+reviewer share the /admin console per README); actual settings *data* gated by the API 403 above, not by the shell route | 200 (shell only; API calls 403) | PASS — not a leak: the SPA shell renders for both roles by design, all settings mutations/reads are the API-gated 403 above |

## 3. Speaker-vs-speaker IDOR (speaker2 vs speaker1's resources)

Speaker1 owns task assignments `seed_task_assignment_0001` (kind gives 404
on GET /file — no file attached, verified as speaker1 itself) and
`seed_task_assignment_0004` (file_request with an attached file, verified
200 as speaker1).

| Request | Expected | Observed | Result |
|---|---|---|---|
| GET /portal/tasks/seed_task_assignment_0001/form as speaker2 | 403/404 | 403 `{"error":{"code":"forbidden","message":"This task assignment does not belong to you"}}` | PASS |
| GET /portal/tasks/seed_task_assignment_0001/file as speaker2 | 403/404 | 403 same shape | PASS |
| GET /portal/tasks/seed_task_assignment_0004/file as speaker2 | 403/404 | 403 same shape | PASS |
| GET /portal/submissions/seed_submission_0001 as speaker2 (speaker1's submission) | 403/404 | 404 (control: 200 as speaker1) | PASS — existence-hiding |
| GET /portal/submissions/seed_submission_0001/edit as speaker2 | 403/404 | 404 | PASS — existence-hiding |
| POST /portal/submissions/seed_submission_0001/edit as speaker2, with speaker2's own valid CSRF cookie/token pair | 403/404 | 404 plain-text `Not found` (ownership check runs after CSRF passes, still existence-hides — no field-level diff leaked) | PASS |
| GET /headshots/seed_file_0011 (speaker1's headshot) as speaker2, and unauthenticated | 200 (by design — accepted/visible speaker headshots are public content, DEC-067 comment in profile.tsx:394-403) | 200 both | PASS — not an IDOR, deliberately public; confirmed via code comment before treating a 200 as a leak |
| GET /files/seed_file_0011 (organizer-only authenticated surface, DEC-020) as speaker1 | 404 (this id isn't in the `file` table under that scheme — headshots don't route through /files) | 404 (same for organizer control) | PASS — consistent 404 both ways, no differential leak |

Note: `seed_task_assignment_0001`'s `/file` route 403s (ownership gate
short-circuits before the underlying-file-missing 404 would even apply) —
confirms ownership is checked before existence for this route, same
pattern as the portal submission edit above.

## 4. Reviewer scope

Reviewer is assigned to `seed_evaluation_plan_0001` for `seed_track_0001`
(AI Engineering) only.

| Request | Expected | Observed | Result |
|---|---|---|---|
| GET /api/v1/review/submissions/seed_submission_0030?planId=seed_evaluation_plan_0001 (submission's track is seed_track_0003, outside reviewer's assigned track) | 404 existence-hiding | 404 `{"error":{"code":"not_found","message":"Submission not found"}}` | PASS |
| GET /api/v1/review/plans/\<unassigned-plan-id\>/queue (a second plan, `Probe Plan (unassigned)`, created live via organizer POST /api/v1/events/seed_event_0001/plans and never given a plan_reviewer row for this reviewer) | 404 existence-hiding | 404 `{"error":{"code":"not_found","message":"Plan not found"}}` | PASS |
| Anonymized plan payload leak check: created a second live plan `anonymized:true`, assigned the reviewer to `seed_track_0001`, then GET /api/v1/review/submissions/seed_submission_0025?planId=\<anon-plan\> | JSON has no `speakers`/`speakerAnswers` keys (src/routes/review/reviewer.ts:147/153, `anonymizeForReviewer` in src/domain/evaluation.ts:505-509) | Response body confirmed to have neither key present (only `sessionAnswers`, `criteria`, track/ref/title fields) | PASS |
| Reviewer file access excludes anonymized plans (src/server/repo/files-authz.ts:154, `reviewerCanAccessSubmissionFile` — `candidatePlans = plans.filter(p => assignedPlanIds.has(p.id) && p.anonymized === false)`) | anonymized-plan-only assignment never grants `/files/:fileId` access | **Not independently exercised end-to-end over HTTP** — seed data has no uploaded submission file on a track-3-only submission to isolate from the reviewer's real non-anonymized track-0 assignment. Confirmed instead by static code review of the cited filter, which unconditionally excludes `anonymized === true` plans before the per-submission scope check runs. Flagged below as a residual gap. | PASS (by code review), gap noted |

## 5. Public leakage

| Request | Expected | Observed | Result |
|---|---|---|---|
| GET /e/devflow-conf-2027/sessions/seed_submission_0002 (status=pending, not accepted) | 404 | 404 | PASS |
| GET /e/devflow-conf-2027/sessions/seed_submission_0003 (status=accepted, contentStatus=pending — not content-approved) | 404 | 404 | PASS |
| SES-003 absent from /e/devflow-conf-2027/sessions list | absent | 0 matches | PASS |
| SES-003 absent from /e/devflow-conf-2027/agenda | absent | 0 matches | PASS |
| SES-003 absent from /e/devflow-conf-2027/schedule.ics | absent | 0 matches | PASS |
| SES-003 absent from /embed/devflow-conf-2027/sessions.json | absent | 0 matches | PASS |
| Hidden participant: PATCH seed_participant_0027 (submission seed_submission_0027, accepted+content-approved) visible=false as organizer, then GET /e/devflow-conf-2027/speakers/7ur7r3lsexuh6e3ci2tf | before=200, after=404 | before=200, after=404 | PASS |
| Same, absent from /e/devflow-conf-2027/speakers list | absent after hide | "Xan Chen" count 1 -> 0 | PASS |
| Session (seed_submission_0027) still 200 with speakers omitted (session-rooted gate has no participant join, DEC-274) | 200, speaker name absent from body | 200, 0 occurrences of "Xan Chen" | PASS |
| "Xan Chen" absent from agenda / .ics / embed sessions.json after hide | absent | 0/0/0 | PASS |
| Cleanup: PATCH seed_participant_0027 visible=true (restore seed state) | — | 200, visible:true confirmed | done |

## 6. CSRF

| Request | Expected | Observed | Result |
|---|---|---|---|
| POST /api/v1/events/seed_event_0001/plans (JSON) with cookie session, no `x-chq-csrf` header | rejected | 400 `{"error":{"code":"invalid","message":"Missing or invalid CSRF header"}}` | PASS |
| POST /portal/submissions/seed_submission_0001/edit (form) as speaker1, no `chq_csrf` cookie/field | rejected | 400 `{"error":{"code":"invalid","message":"CSRF token mismatch"}}` | PASS |
| POST /api/v1/events/seed_event_0001/plans with `Authorization: Bearer chq_...` (minted live via POST /api/v1/tokens), no `x-chq-csrf` header | exempt, succeeds (DEC-027) | 201 Created | PASS |

## 7. POST /api/v1/events/:eventId/onboarding/remind/preview (wave 15, src/routes/tasks.ts:465)

Baseline `email-log` total for seed_event_0001: 122 (checked before and
after the authorized-and-successful preview call below).

| Request | Expected | Observed | Result |
|---|---|---|---|
| Unauthenticated | 401 | 401 `{"error":{"code":"unauthorized","message":"Login required"}}` | PASS |
| As speaker1 | 403 | 403 `{"error":{"code":"forbidden","message":"Requires role 'organizer'"}}` | PASS |
| As reviewer | 403 | 403 same shape | PASS |
| As organizer, foreign/nonexistent eventId (`foreign-nonexistent-event`) | 404 existence-hiding | 404 `{"error":{"code":"not_found","message":"Event not found"}}` | PASS (no separate-org seed fixture exists in this single-org demo; a nonexistent id exercises the identical `assertEventOwnership` code path — see note below) |
| As organizer, own eventId (authorized) | 200, drafts array, sends nothing | 200 with a `drafts` array; email-log total unchanged 122 -> 122 after the call | PASS — confirmed no mail sent in every case, including the authorized one |

Note (scope interpretation): the seed fixtures are single-org
(`seed_org_0001` owns every seeded event). A genuinely foreign-org eventId
doesn't exist in the demo data; a nonexistent eventId was used as the
closest available proxy since `assertEventOwnership` runs the same
org-membership check regardless of whether the id exists in another org or
doesn't exist at all — both paths resolve to the same "not found for this
org" query and produce an identical 404. Flagged as an assumption, not
independently confirmed against a second live org.

## 8. /dev/mailbox with DEV_MODE unset (src/routes/dev/mailbox.tsx:24, src/server/env.ts isDevMode)

The worktree's own dev server (port 8787) runs with the default
`.dev.vars` (`DEV_MODE=1`), where `/dev/mailbox` returns 200 as expected.
To test the unset case without disturbing the shared dev server (other
concurrent worker sessions were observed running `wrangler dev` against
this same worktree/repo family), a second, isolated `wrangler dev`
instance was started on port 8790 with `--var DEV_MODE:0` (overriding
`.dev.vars`), then torn down immediately after the probe.

| Request | Expected | Observed | Result |
|---|---|---|---|
| GET /dev/mailbox on the DEV_MODE=1 instance (port 8787, control) | 200 | 200 | PASS |
| GET /dev/mailbox on the DEV_MODE!=="1" instance (port 8790) | 404 (route not mounted, not 403) | 404, plain-text body `404 Not Found` (Hono's default not-found, i.e. no route matched — not an app-level 403 JSON envelope) | PASS |

## Residual gaps / notes for future workers

- §4's anonymized-plan file-access exclusion (files-authz.ts:154) was
  confirmed by static code review, not by an isolated live HTTP probe —
  the seed data has no uploaded deliverable on a submission whose track is
  *only* covered by an anonymized plan assignment (every track-scoped
  submission with a file also falls under the reviewer's real, non-
  anonymized `seed_evaluation_plan_0001` assignment for track 0, so a live
  `/files/:fileId` 403 wouldn't isolate which plan the denial came from).
  A future wave adding a track-3-only file fixture could close this gap
  with a true isolation test.
- §7's "foreign org" case used a nonexistent eventId rather than a second
  org's real event, since the seed data is single-org. Documented as an
  interpretation, not a decision.
- No FAILs were found anywhere in this probe matrix.
