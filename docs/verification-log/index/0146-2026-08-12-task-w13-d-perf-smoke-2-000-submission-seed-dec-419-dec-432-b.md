## 2026-08-12 task-w13-d — perf:smoke @ 2,000-submission seed (DEC-419, DEC-432 baseline)

Evidence lane, log-only (DEC-419): no source file changed. Seeded the 2k
perf event (`npm run db:migrate && npm run seed && npm run perf:seed`) and
ran `npm run perf:smoke` four times back-to-back against the same running
`wrangler dev`. Full transcribed table, per-endpoint grading, and the
DEC-432 before/after baseline pair are in
`docs/verification-log/task-w13-d-perf-smoke-stage1.md`.

18 of 21 checks PASS comfortably and consistently (wide margin under their
class budgets on every run). Three checks are borderline — PASS on most
runs but FAIL under host contention (a stray `task-w8-i` worktree's
`wrangler d1 execute` process was alive on the same host throughout this
run, per `ps aux`), meaning no safety margin, which SPEC.md:331-332 treats
as a bug not noise: `schedule.ics` (bare, whole-agenda) —
`src/routes/public/index.tsx:197` — diverges sharply from its `agenda.ics`
sibling on the identical `getPublicAgenda` code path (216ms vs 11ms on run
1), flagged for an isolated A/B; `reviewer queue` —
`src/routes/review/reviewer.ts:50` /
`src/server/repo/review/submissions.ts:110` — recomputes the whole plan's
reviewer-assignment table per request (waterfall/full-scan, not scoped to
the requesting reviewer); `plan results` — `src/routes/review/plans.ts:290`
/ `src/routes/review/shared.ts:251` `buildResults` — loads the full plan's
submissions (up to 2,000) and evaluations (up to 6,000) and aggregates in
JS before paging server-side (oversized payload/full-scan, not scoped to
the requested page).

True edge-cache-hit TTFB and Smart Placement are marked STAGE-2-only per
SPEC.md:59-62 — no Cloudflare edge exists under Miniflare's local
`wrangler dev`, so no number is reported for either row.

DEC-432 sibling-lane baseline pair (code unchanged, per this task's scope):
`GET /api/v1/contacts/stats` (`src/server/repo/contacts/stats.ts`) raw p95
17.5-22.1ms, PASSes 50ms read budget at the seed's 800-contact scale;
`GET /portal` (`src/server/repo/portal.ts` `getMyResources`, an org-wide
unscoped `resource` JOIN `event` filtered to the speaker's events in JS
afterward rather than in SQL) raw p95 22.8-48.8ms, PASSes but noisy — both
are "before" numbers for the next wave's before/after pair, not evidence the
DEC-432 fix is unneeded at larger scale. The speaker session used for the
`GET /portal` measurement was a throwaway `user`+`auth_session` row pair
inserted directly into local D1 (same mechanism `scripts/perf-seed.ts`
itself uses) and deleted after measurement, since the perf seed creates no
speaker login.

`npm run build` PASS. No source file touched, so no new/changed tests; this
is an evidence-only lane per DEC-419.

OPEN ITEMS: 3

RESULT: FAIL — see
`docs/verification-log/task-w13-d-perf-smoke-stage1.md` for full detail and
route file:line citations.

