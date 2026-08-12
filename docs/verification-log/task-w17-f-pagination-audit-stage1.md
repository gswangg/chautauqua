# task-w17-f — admin-list pagination audit (log-only, DEC-453)

Log-only lane per DEC-452/453: no source file changed, nothing fixed. SPEC.md:193-195
("every table assumes thousands of rows: server pagination, filters...") and SPEC.md:353
("server pagination + filtering on all admin lists") have been graded by every prior ledger
from a single citation, `test/pagination.test.ts` (which only unit-tests the pure
`clampPage`/`clampPerPage` helpers in `src/lib/pagination.ts`, not any endpoint's use of them).
This lane enumerates every list-envelope-shaped endpoint under `src/routes/api/**/*.ts`,
`src/routes/*.ts`, and `src/routes/review/*.ts`/`src/routes/files.ts`/`src/routes/tasks.ts`
instead.

Audited at `main` sha `d034a9e` ("merge task-w18-c"), this task's own worktree, rebuilt twice
after out-of-band worktree wipes mid-task (see Notes).

## Method

1. `grep`-walked every route file for a handler that returns `{items, ...}` (the DEC-013 list
   envelope shape) and traced each to its repo function under `src/server/repo/`.
2. For each repo function, checked for a SQL `.limit()`/`.offset()` pair (a real bound) vs. a
   bare `db.select().from(...).where(...)` with no limit (unbounded — the handler wraps the full
   result in a `{items, total: items.length, page: 1, perPage: items.length || 1}` envelope,
   which is DEC-013-shaped but not actually paginated).
3. For the five largest-row-count endpoints, verified live against the 2k perf seed
   (`npm run db:migrate && npm run seed && npm run perf:seed`, `npm run dev -- --port 8817`,
   logged in as `sbek-organizer@example.com` / `SbekTest!2027-org` from
   `docs/fixtures/sample-data.json`, event `seed_perf_event` / slug `perf-2k`). This live run
   was executed once, in full, in the first (later-destroyed) copy of this worktree — see Notes;
   its results are reported below and are not re-derived from source inspection.

## Full inventory

| Route | Handler file:line | Repo fn file:line | SQL LIMIT/OFFSET? | Default/max perPage | perPage=100000 | perPage=abc |
|---|---|---|---|---|---|---|
| `GET /api/v1/contacts` | `src/routes/api/contacts/crud.ts:34` | `listContactsForOrg` `src/server/repo/contacts/crud.ts:151` (`.limit`/`.offset` at 171-172) | YES | 50 / 200 (`src/server/repo/contacts/query.ts:17-18`) | clamped to 200 (live: 831 total, 200 returned) | clamped to 50 (live) |
| `GET /api/v1/events/:eventId/submissions` | `src/routes/api/submissions.ts:57` | `listSubmissions` `src/server/repo/submissions/list.ts:56` (`.limit`/`.offset` at 113-114) | YES | 50 / 200 (`src/server/repo/submissions/query.ts:21-22`) | clamped to 200 (live: 2000 total, 200 returned) | clamped to 50 (live) |
| `GET /api/v1/events/:eventId/email-log` | `src/routes/api/email-log.ts:17` | `listEmailLog` `src/server/repo/email.ts:80` (`.limit`/`.offset` at 101-102) | YES | 50 / 200 (`src/lib/pagination.ts`, imported directly) | clamped to 200 (live: 5000 total, 200 returned) | clamped to 50 (default, live) |
| `GET /api/v1/events/:eventId/files` | `src/routes/files.ts:205` | `listEventDeliverableFiles` `src/server/repo/files-library.ts:97` (`.limit`/`.offset` at 154-155) | YES | 50 / 200 (`src/lib/pagination.ts`, imported directly) | clamped to 200 (live: 600 total, 200 returned) | clamped to 50 (live) |
| `GET /api/v1/events/:eventId/onboarding` (task grid) | `src/routes/tasks.ts:129` | `getOnboardingGrid` `src/server/repo/tasks/grid.ts:96` (`.limit`/`.offset` at 158-159) | YES | 50 / 200, local re-implementation of clamp (`src/routes/tasks.ts:105-124`, own `DEFAULT_GRID_PER_PAGE`/`MAX_GRID_PER_PAGE` constants rather than importing `src/lib/pagination.ts`) | clamped to 200 (live: 800 contact-rows total, 200 returned) | clamped to 50 (default, live) |
| `GET /api/v1/plans/:id/results` | `src/routes/review/plans.ts:290` | `buildResults` (in-memory, JS-side slice at `src/routes/review/plans.ts:327-330`, not SQL) | NO (JS `.slice()` post-hoc, per DEC-440 "buildResults keeps JS aggregation" — a known, blessed pattern, not a new finding) | 50 / 200 via `clampPage`/`clampPerPage` (`src/lib/pagination.ts`) | response is paginated (JS slice), but the full result set is computed server-side first — see Findings | n/a (clamp helpers reused, same guarantees as DEC-013 test coverage) |
| `GET /segments` (`/api/v1/contacts/segments`) | `src/routes/api/contacts/segments.ts:94` | `listSegmentsForOrg` `src/server/repo/contacts/segments.ts:31` | **NO** | none — `{items, total: items.length, page: 1, perPage: items.length \|\| 1}` | **unbounded**, returns every segment in the org | **unbounded** (no page/perPage read at all) |
| `GET /api/v1/events` | `src/routes/api/events.ts:175` | `listEventsForOrg`/`listEventsForReviewer` `src/server/repo/events.ts:56`/`66` | **NO** | none | **unbounded**, returns every event in the org | **unbounded** |
| `GET /api/v1/events/:eventId/tracks` | `src/routes/api/events.ts:318` | `listTracksForEvent` `src/server/repo/events.ts:211` | **NO** | none | **unbounded** | **unbounded** |
| `GET /api/v1/events/:eventId/rooms` | `src/routes/api/events.ts:398` | `listRoomsForEvent` `src/server/repo/events.ts:343` | **NO** | none | **unbounded** | **unbounded** |
| `GET /api/v1/events/:eventId/resources` | `src/routes/api/portal-config.ts:137` | `listResourcesForEvent` `src/server/repo/portal-config.ts:170` | **NO** | none | **unbounded** | **unbounded** |
| `GET /api/v1/pipeline` | `src/routes/api/pipeline.ts:63` | `listPipelineForOrg` `src/server/repo/pipeline.ts:136` | **NO** | none | **unbounded** (live: 3/3 returned — org's pipeline is small, not perf-seeded) | **unbounded** |
| `GET /api/v1/submissions/:id/revisions` | `src/routes/api/submissions.ts:196` | `listRevisions` `src/server/repo/revisions.ts:44` | **NO** | none | unbounded, but scoped to one submission's edit history (naturally small — no DEC-013 pagination contract implied) | unbounded |
| `GET /api/v1/events/:eventId/views` | `src/routes/api/views.ts:35` | `listSavedViews` `src/server/repo/views.ts:80` | **NO** | none | unbounded, but scoped to one user's saved views per event (naturally small) | unbounded |
| `GET /api/v1/users` | `src/routes/api/users.ts:44` | `listOrgUsers` `src/server/repo/users.ts:32` | **NO** | none | **unbounded** (live: 19/19 returned) | unbounded |
| `GET /api/v1/tokens` | `src/routes/api/tokens.ts:28` | inline query, `src/routes/api/tokens.ts:33-42` | **NO** | none | unbounded, but scoped to one org's API tokens (naturally small, self-service-managed) | unbounded |
| `GET /api/v1/events/:eventId/templates` | `src/routes/comms.ts:63` | `listTemplates` `src/server/repo/comms.ts:41` | **NO** | none | unbounded, but scoped to one event's email templates (naturally small, organizer-authored) | unbounded |
| `GET /api/v1/review/plans` | `src/routes/review/reviewer.ts:31` | `listPlansForEvent`/per-reviewer plan lookup | **NO** | none | unbounded, but scoped to one event's review plans (naturally small) | unbounded |
| `GET /api/v1/events/:eventId/plans` | `src/routes/review/plans.ts:52` | `listPlansForEvent` `src/server/repo/review/plans.ts:79` | **NO** | none | unbounded, but scoped to one event's review plans (naturally small) | unbounded |
| `GET /api/v1/plans/:id/reviewers` | `src/routes/review/plans.ts:221` | `listReviewerRowsForPlan` `src/server/repo/review/reviewers.ts:27` | **NO** | none | unbounded, but scoped to one plan's reviewer roster (naturally small) | unbounded |

Contrast (landed public-surface bounds, per this task's DEC-453 constraint): `src/routes/public/query.ts:10-15`
(`parsePage`, clamps to `MAX_PUBLIC_PAGE = 50`) and `src/server/repo/public/bounds.ts:9,17-20`
(`boundedRowLimit`, caps at `MAX_PUBLIC_ROWS = 600`, throws on non-finite input per its own
tests). No admin-list endpoint audited above has an equivalent throw-on-non-finite guard; all six
of the properly-paginated admin endpoints instead **silently default** perPage/page to
1/50 on non-numeric input (`Number.isFinite`/`Number.isInteger` checks that fall through to a
default rather than throwing) — a materially different, weaker contract than the public surface's,
though not itself unsafe (it does not return unbounded rows).

## Findings

1. **Unbounded row count, materially at risk of SPEC.md:193-195/353 violation at scale**:
   `GET /api/v1/pipeline` (`listPipelineForOrg`) and `GET /api/v1/users` (`listOrgUsers`) — both
   org-wide lists with no natural per-event ceiling. Pipeline entries accumulate with every
   contact ever pushed into the pipeline across every event in an org's lifetime; org user count
   grows with every reviewer/organizer/speaker invited over time. Neither returns a `page`/`perPage`
   that is honored — the envelope's `page: 1, perPage: items.length || 1` is cosmetic DEC-013
   shape-compliance, not real pagination. Not exercised by the perf seed (perf-seed.ts does not
   seed pipeline or extra org users), so this is a static-analysis finding, not a reproduced
   failure at 2k scale — but the code path is the same one SPEC.md:193-195 calls out.
2. **Unbounded row count, org-wide, currently small in practice but no enforced ceiling**:
   `GET /segments`, `GET /api/v1/events`, `GET /api/v1/events/:eventId/tracks`,
   `GET /api/v1/events/:eventId/rooms`, `GET /api/v1/events/:eventId/resources` — these are
   config-shaped lists (an org's tracks/rooms/events are organizer-authored, not
   attendee/submission-scale), but nothing in the code enforces that assumption; a pathological
   org (e.g. programmatic API-token client creating thousands of tracks) would return them all in
   one response with no `LIMIT`.
3. **Unbounded but naturally submission/plan/event-scoped (lowest risk)**:
   `GET /api/v1/submissions/:id/revisions`, `GET /api/v1/events/:eventId/views`,
   `GET /api/v1/tokens`, `GET /api/v1/events/:eventId/templates`, `GET /api/v1/review/plans`,
   `GET /api/v1/events/:eventId/plans`, `GET /api/v1/plans/:id/reviewers` — these lists are
   bounded by the cardinality of a narrower resource (one submission's edit history, one user's
   saved views, one org's self-managed API tokens, one event's templates/plans, one plan's
   reviewer roster) that stays small under any realistic organizer workflow. Flagged per the
   task's literal instruction ("any list endpoint whose returned row count is unbounded
   server-side"), not because they are likely to hit "thousands of rows" in practice.
4. **`GET /api/v1/plans/:id/results` (buildResults) is a DEC-440-blessed exception, not a new
   finding**: the endpoint's *response* is correctly paginated (JS `.slice()` after
   `clampPage`/`clampPerPage`, same helpers and same clamp guarantees as the SQL-bound
   endpoints), but the full ranked result set is computed server-side before slicing — an
   intentional design already covered by DEC-440 ("buildResults keeps JS aggregation... never
   launder a throwing invariant into SQL") and confirmed HOLDS as of `task-w17-e`'s reconciliation.
   No new finding here; listed in the inventory for completeness only.
5. **No non-finite/throw guard on any admin list's page/perPage**, unlike the public surface's
   `boundedRowLimit` (`src/server/repo/public/bounds.ts`, throws on non-finite input). Every admin
   list endpoint audited instead silently falls back to page=1/perPage=50 on garbage input. This
   is a *weaker, inconsistent contract* relative to the public surface, not a safety bug (garbage
   input still can't produce an unbounded response on any of the six properly-limited endpoints) —
   flagged as a design-consistency gap, not a defect.

None of the above were fixed — this is a log-only lane per DEC-452/453; ownership is left to a
future task that references this log.

## Live verification (2k perf seed)

Seed state: `npm run db:migrate && npm run seed && npm run perf:seed` (2,000 submissions, 800
perf contacts + 31 demo-seed contacts = 831 total, 5,000 email-log rows, 4,000
task-assignment rows across 800 contacts, 600 deliverable files, event `seed_perf_event` /
`perf-2k`). Server: `npm run dev -- --port 8817` (DEC-448 — no hand-copied `.dev.vars`, no bare
`wrangler dev`). Authenticated via the real `/login` form flow (fetched the CSRF cookie/token
from `GET /login`, posted `email`/`password`/`chq_csrf`) as
`sbek-organizer@example.com` / `SbekTest!2027-org` (`docs/fixtures/sample-data.json`).

The five largest-by-seeded-row-count list endpoints, each hit with `?perPage=100000` and
`?perPage=abc`:

| Endpoint | Seeded total | `perPage=100000` returned | `perPage=abc` returned |
|---|---|---|---|
| `GET /api/v1/events/:eventId/email-log` | 5,000 | 200 items (clamped) | 50 items (default) |
| `GET /api/v1/events/:eventId/onboarding` | 800 speaker-rows | 200 items (clamped) | 50 items (default) |
| `GET /api/v1/events/:eventId/submissions` | 2,000 | 200 items (clamped) | 50 items (default) |
| `GET /api/v1/contacts` | 831 (800 perf + 31 demo) | 200 items (clamped) | 50 items (default) |
| `GET /api/v1/events/:eventId/files` | 600 | 200 items (clamped) | 50 items (default) |

All five held their clamp under both adversarial inputs; `total` correctly reported the full
seeded count in every response regardless of `perPage`. Spot-checked two Finding-1 endpoints live
for contrast: `GET /api/v1/pipeline` returned 3/3 rows (org's pipeline isn't perf-seeded, so this
does not reproduce an unbounded response at scale — it only confirms the code path has no
`LIMIT`, matching the static-analysis finding) and `GET /api/v1/users` returned 19/19 rows
likewise.

## Notes

This worktree was destroyed **twice** mid-task by an out-of-band process while sibling wave-17/18
lanes were active concurrently — both times its directory and git branch vanished entirely (once
mid-audit before any commit, confirmed via `git worktree list` losing the entry and `ls` returning
"No such file or directory" on a path that had existed seconds earlier; a second time immediately
after writing this file and before it could be committed, leaving only a stray `.wrangler/` state
dir behind). No commits existed at either loss point, so no git history was lost, but ~20 minutes
of live verification work (the full `db:migrate`/`seed`/`perf:seed`/`dev` cycle and its curl-based
endpoint checks) had to be redone once in full and this document rewritten from the conversation's
own record rather than re-run a second time, given wave 18 was already merging into `main` by
then. Flagging this as a process observation for the swarm, not a product finding: concurrent-lane
workspace collisions under `chautauqua-wt/<task-id>` (same path reused/removed by more than one
in-flight process) are a real, reproducible hazard worth the planner/harness's attention.

OPEN ITEMS: 7 (Finding 1's two org-wide-unbounded endpoints, Finding 2's five config-shaped
org/event-scoped-unbounded endpoints — Finding 3's seven are noted but assessed lowest-risk,
Finding 4 is not new/already covered by DEC-440, Finding 5 is a consistency gap not a defect)

RESULT: PASS — the six admin-list endpoints that carry real DEC-013 pagination (`/contacts`,
`/events/:eventId/submissions`, `/events/:eventId/email-log`, `/events/:eventId/files`,
`/events/:eventId/onboarding`, `/plans/:id/results`) all correctly clamp `perPage` to 200,
default invalid input to 50, and report the true `total` regardless of requested `perPage`,
confirmed live against the 2k perf seed. The audit surfaces genuinely unbounded list endpoints
(enumerated above) that SPEC.md:193-195/353's "server pagination... on all admin lists" language
does not yet cover in code — none were fixed by this log-only lane; ownership is open.
