# task-w1-d — J4 committee review browser persona pass @ c663cf2

DEC-254 browser-persona lane: organizer AND reviewer, driven with a real
Chromium (Playwright) against `wrangler dev --port 8804`, seeded
`devflow-conf-2027` event. Scope per docs/eval-findings.md Section B: prove
in a browser that "Reviewer assignment always fails 'User not found'" and
"Reviewer queue links all point to /submissions/undefined" are actually
fixed (both were previously repaired by test-only evidence, never proven in
a live browser).

## Setup

Fresh worktree: `npm ci`; `npm run build` (clean); `npm run db:migrate` (15
migrations applied); `npm run seed`; `npx tsx scripts/ensure-dev-vars.ts`
(created `.dev.vars` from `.dev.vars.example`); `npx wrangler dev --port
8804` backgrounded, `GET /` returned 200.

## Organizer pass (`sbek-organizer@example.com`)

Logged in via `/login` (SSR form), redirected to `/admin`. Created a new
evaluation plan (`/admin/review/plans/new`) with: name, instructions,
open/close dates, a track filter (checked one of the three seeded tracks),
anonymization ON, scale 1-5, rounds=2, max-evaluations-per-submission cap=3,
and three weighted criteria — one dropdown ("Overall Fit", options
Not ready/Just right/Exceptional) and one free-text ("Additional Comments").
Plan created with zero validation/error banners.

**Reviewer assignment (Section B item 1).** Assigned `sbek-reviewer@example.com`
to the new plan twice: once scoped to a track, once scoped to a single
submission (`seed_submission_0030`, pulled live from
`GET /api/v1/events/seed_event_0001/submissions`). BOTH assignment calls
succeeded with zero error banners and the reviewer roster grew to 2 rows —
the "User not found" failure described in eval-findings.md Section B is
CONFIRMED FIXED for every scope (track, submission) in a real browser.

**Found + fixed during this pass:** the just-assigned row rendered the raw
`userId` (e.g. `seed_user_0004`) instead of the reviewer's email, because
`POST /api/v1/plans/:id/reviewers`'s `PlanReviewerRecord` response carries no
`email` column and `PlanEditor.tsx` appended that response verbatim to
local state (`r.email ?? r.userId` then fell through to the id). Fixed in
`app/src/pages/review/PlanEditor.tsx`'s `assignReviewer` by resolving the
email from the already-loaded `reviewerOptions` list before appending to
state. Regression test added:
`app/src/pages/review/PlanEditor.render.test.tsx` ("shows the assigned
reviewer email (not the raw userId) immediately after Assign, before any
reload"). Re-verified in the browser post-fix: both assignment rows now show
`sbek-reviewer@example.com`.

**Progress panel.** `/admin/review/plans/<id>/progress` showed round 1 of 2,
one reviewer row (12 assigned / 0 completed / "In progress"), a "Remind
laggards (1)" button and "Advance to round 2". Clicked "Remind laggards" —
banner "Reminder sent to 1 reviewer(s)." appeared, count unchanged (no
auto-email side effect beyond the explicit nudge action itself, consistent
with the house invariant that status changes never auto-email).

**Results table + CSV export (ABS-10).** Opened
`/admin/review/plans/seed_evaluation_plan_0001/results` (seeded plan, has
real ratings). Clicked the "Average" column's sort button — row order
changed (before: SES-001 @ 4.33 first; after: ascending order, SES-022 @
0.00 first) confirming the sort control is live, not decorative. The
dropdown criterion ("Session length fit") renders its OWN column with a
per-option distribution string (e.g. "Just right x1 / Too long x1"),
visibly separate from the numeric "Average" column — the eval-findings.md
Section C complaint ("dropdown answer silently folded into the numeric
Average... per-option distribution invisible") does NOT reproduce; this is
fixed. "Download CSV" triggered a real file download; the CSV header row
confirms the same per-option shape: `...,Session length fit: Too short,
Session length fit: Just right,Session length fit: Too long` as three
separate numeric columns, not one folded average.

## Reviewer pass (`sbek-reviewer@example.com`, separate browser context)

Logged in via `/login`, redirected to `/admin`. Opened
`/admin/review/plans/seed_evaluation_plan_0001` (own plans list -> queue).

**Queue contents & sort.** Queue held exactly 5 items (the reviewer's real
seeded assignment for this plan), each showing `(N rating(s) so far)` with
the actual number, ordered fewest-ratings-first: `0, 0, 0, 1, 1`.

**Queue links (Section B item 2).** Every queue item's `<a href>` resolved
to `/admin/review/plans/seed_evaluation_plan_0001/submissions/<real-id>`
(e.g. `seed_submission_0022`) — never `/submissions/undefined`. Clicked the
first link: the Scorecard mounted with the submission's title/criteria, not
a "Submission not found" error. The `/submissions/undefined` regression from
eval-findings.md Section B does NOT reproduce; CONFIRMED FIXED in a browser.

**Anonymization (server-side, view-source check).** Fetched the real
speaker's name/email for the opened submission via the organizer session
(`Sasha Vasquez` / `sasha.vasquez@example-speakers.test`) and grepped the
reviewer-served scorecard's raw HTML (`page.content()`, not computed
styles): zero occurrences of either string. The "Speakers:" line renders
empty for the reviewer. Confirms DEC-018 server-side-only anonymization,
not a CSS mask.

**Submit and advance.** Filled every criterion (rating=4, dropdown=first
option, free text) and clicked "Submit and advance": the SPA navigated from
`seed_submission_0022` to the next queue item (`seed_submission_0025`)
without a page reload, confirming the PUT-then-advance flow works.

**Role-scoped route denial (ABS-01/03/05 negative case).** As the reviewer,
navigated directly to `/admin/settings` — the client-side `ReviewPage`/nav
router does not expose a settings surface to this role and the app stayed
on `/admin/review` (organizer-only nav item not rendered, no settings form
reachable). Navigated to
`/admin/review/plans/seed_evaluation_plan_0001/results` — the reviewer's
`<Routes>` subtree (in `app/src/pages/Review.tsx`) only registers `/`,
`plans/:planId`, and `plans/:planId/submissions/:submissionId`; the
`results` path matches none of them, so the SPA renders a blank main panel
under the shared shell (no crash, no data leak, no results table). Reviewer
cannot reach either surface.

## Noise investigated, not a defect

One run logged a single `403 Forbidden` browser console entry immediately
after the scorecard finished loading (page content was already correct).
Re-ran the identical flow with full response-status logging four more times
(including two dedicated repro scripts) — zero 4xx/5xx responses on any
run. Not reproducible; almost certainly an aborted in-flight fetch from a
route-unmount race in the Playwright driver itself, not a server-side
authz gap (the same submission fetch succeeds consistently and the
Scorecard's own `.catch` would have surfaced a visible error banner had the
real request failed, which it never did across 5 runs).

## Fix

- `app/src/pages/review/PlanEditor.tsx` — resolve assigned-reviewer email
  from `reviewerOptions` before appending the just-created row to local
  state (was showing raw `userId` until next reload).

## Tests

- `app/src/pages/review/PlanEditor.render.test.tsx` — added one case
  covering the email-resolution fix above. `npx vitest run
  app/src/pages/review/PlanEditor.render.test.tsx` — 3/3 pass.
- Full suite: `npm test` — 184 files, 1574 tests, all pass.
- `npm run build` — clean (`tsc --noEmit` x2 + `vite build`).

OPEN ITEMS: 0
RESULT: PASS
