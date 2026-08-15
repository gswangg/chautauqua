## 2026-08-12 task-w17-f — admin-list pagination audit (DEC-453)

Log-only lane (DEC-452/453): no source file changed, nothing fixed. SPEC.md:193-195/353's "server
pagination... on all admin lists" claim had been graded by every prior ledger from one citation
(`test/pagination.test.ts`, which only unit-tests the pure clamp helpers, not any endpoint's use
of them). This lane instead enumerates every list-envelope-shaped endpoint under
`src/routes/api/**/*.ts`, `src/routes/*.ts`, and the organizer-facing repo functions under
`src/server/repo/`, tracing each handler to its repo function and checking for a real SQL
`LIMIT`/`OFFSET` vs. a bare unbounded `select`. Full per-endpoint table (route, handler file:line,
repo fn file:line, LIMIT/OFFSET present or not, default/max perPage, observed
`perPage=100000`/`perPage=abc` behavior) is in
`docs/verification-log/task-w17-f-pagination-audit-stage1.md`.

Headline finding: six admin-list endpoints carry real DEC-013 pagination with SQL-level bounds
(`/contacts`, `/events/:eventId/submissions`, `/events/:eventId/email-log`,
`/events/:eventId/files`, `/events/:eventId/onboarding`, `/plans/:id/results` — the last via a
DEC-440-blessed JS-side slice, not SQL) — all six correctly clamp `perPage` to 200 and default
invalid input to 50, confirmed **live** against the 2k perf seed (`npm run db:migrate && npm run
seed && npm run perf:seed`, `npm run dev -- --port 8817` per DEC-448, logged in as the seeded
organizer): email-log (5,000 rows), submissions (2,000), onboarding grid (800), contacts (831),
files (600) all returned exactly 200 items for `?perPage=100000` and 50 for `?perPage=abc`, with
`total` always correctly reporting the true seeded count. But the audit also surfaces **13
list endpoints with no SQL bound at all** — `{items, total: items.length, page: 1, perPage:
items.length || 1}` is cosmetic DEC-013 envelope shape-compliance, not real pagination. Two are
org-wide with no natural ceiling and the highest risk of hitting SPEC.md:193-195's "thousands of
rows" case over an org's lifetime: `GET /api/v1/pipeline` (`listPipelineForOrg`,
`src/server/repo/pipeline.ts:136`) and `GET /api/v1/users` (`listOrgUsers`,
`src/server/repo/users.ts:32`) — neither was reproduced as an actual failure at 2k scale (perf-seed
doesn't seed pipeline/extra org users), so this is a static-analysis finding, not a live repro.
Five more are org/event-scoped config lists (segments, events, tracks, rooms, portal resources)
with no enforced ceiling either. The remaining seven are naturally bounded by a narrower parent
resource (one submission's revisions, one user's saved views, one org's API tokens, one event's
templates/plans, one plan's reviewers) and assessed lowest risk. None were fixed — ownership is
open for a future task. Full findings taxonomy and severity reasoning is in the linked log.

This task's worktree was destroyed **twice** mid-audit by an out-of-band process (directory and
branch both vanished while sibling wave-17/18 lanes were active concurrently); no commits existed
at either loss point, so the worktree was recreated fresh off `main` each time and the audit
(including the live perf-seed verification, which was fully completed once before the second
wipe) was preserved from this conversation's own record rather than re-run a second time, given
wave 18 was already merging into `main` by then. Noted as a process observation in the linked log,
not a product finding.

OPEN ITEMS: 7 (2 org-wide-unbounded high-risk, 5 config-scoped-unbounded medium-risk; 7 more
naturally-bounded-but-technically-unbounded endpoints noted as lowest-risk, not counted against
this total; 1 DEC-440-covered non-finding; 1 non-finite-input consistency gap vs. the public
surface, not a defect)

RESULT: PASS — the six real DEC-013-paginated admin-list endpoints all correctly bound `perPage`
and report true `total`, confirmed live at 2k-row scale. The audit found unbounded list endpoints
SPEC.md:193-195/353 does not yet cover in code; none were fixed by this log-only lane per
DEC-452/453.

