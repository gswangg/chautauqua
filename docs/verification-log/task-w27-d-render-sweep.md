# task-w27-d render-sweep gate @ f01459a

DEC-232 sha check: FAIL-stop gate. Main HEAD at planning time was
`2b5619d` (scribe wave 27), one commit ahead of the frozen literal
`f01459a1d52b6867586dd0b5b7c81dfe09601cfd`. `git diff f01459a 2b5619d --stat`
touched only `decisions/DEC-232.md`, `decisions/DEC-233.md`,
`decisions/DEC-234.md`, `field-guide/index.md`, and `src/decisions.ts`
(a pure string-constant escaping fix on the existing `DEC_131` literal plus
three new `DEC_232`/`DEC_233`/`DEC_234` constant appends) — entirely within
the DEC-232 allow-list (decisions/**, field-guide/**,
docs/verification-log.md, docs/verification-log/**, docs/eval-findings.md,
pure string-constant appends to src/decisions.ts). No code-bearing drift.
Sha check PASSES; proceeded at the frozen literal.

## Setup

- Detached worktree: `git worktree add --detach
  /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-d-frozen
  f01459a`.
- Cleared stale local state before the run: `rm -rf .wrangler .seed.sql
  .seed-assets` (per the task-w25-d lesson — leftovers previously produced a
  UNIQUE-constraint re-seed error).
- `npm ci --prefer-offline --no-audit --no-fund --silent` — node_modules
  already present from a prior install at this sha, install was a no-op.
- `npx playwright install chromium` — already installed, no-op.
- `npm run build` run FIRST (task-w25-d lesson: without the vite build every
  `/admin/*` route 404s because wrangler serves the SPA bundle from
  `public/admin/**`). Build succeeded: `tsc --noEmit` (root + `app/`) clean,
  `vite build --config app/vite.config.ts` emitted `public/admin/index.html`
  + assets in 1.63s.
- Read `ROUTE_MANIFEST` live via `npx tsx -e "import { ROUTE_MANIFEST } from
  './app/src/routeManifest.ts'; console.log(ROUTE_MANIFEST.length)"` (not
  hardcoded): **34** entries, matching the field-guide's recorded w25-d count.

## Run

`npm run gate:render-sweep` (which invokes `scripts/render-sweep.ts`):

- Self-allocated a free local port: **61740** (confirmed not 8965/8966 —
  those were held by concurrent task-w27-b/task-w27-c lanes' `wrangler dev`
  processes in their own worktrees, observed via `ps aux` and left
  untouched).
- Migrated + seeded D1 and R2 (8 objects uploaded to the local
  `chautauqua-files` bucket) from a clean `.wrangler` state.
- Logged in as organizer (`sbek-organizer@example.com`), reviewer
  (`sbek-reviewer@example.com`), and speaker (`sbek-speaker@example.com`)
  via the real `/login` form using `docs/fixtures/sample-data.json`
  credentials.
- Swept all 34 live manifest entries.

## Per-route result table (34/34, verbatim from the gate's own output)

| path | role | status |
|---|---|---|
| /admin/overview | organizer | PASS |
| /admin/submissions | organizer | PASS |
| /admin/submissions/forms | organizer | PASS |
| /admin/submissions/seed_submission_0001 | organizer | PASS |
| /admin/speakers | organizer | PASS |
| /admin/content | organizer | PASS |
| /admin/agenda | organizer | PASS |
| /admin/comms | organizer | PASS |
| /admin/contacts | organizer | PASS |
| /admin/settings | organizer | PASS |
| /admin/review | organizer | PASS |
| /admin/review/plans/new | organizer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001 | organizer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001/progress | organizer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001/results | organizer | PASS |
| /admin/review | reviewer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001 | reviewer | PASS |
| /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 | reviewer | PASS |
| /portal | speaker | PASS |
| /portal/submissions/seed_submission_0001 | speaker | PASS |
| /portal/submissions/seed_submission_0001/edit | speaker | PASS |
| /portal/profile | speaker | PASS |
| /portal/tasks | speaker | PASS |
| /portal/tasks/seed_task_assignment_0001/form | speaker | PASS |
| /e/devflow-conf-2027/sessions | public | PASS |
| /e/devflow-conf-2027/speakers | public | PASS |
| /e/devflow-conf-2027/gallery | public | PASS |
| /e/devflow-conf-2027/agenda | public | PASS |
| /e/devflow-conf-2027/schedule | public | PASS |
| /submit/devflow-conf-2027 | public | PASS |
| /account/password | organizer | PASS |
| /account/password | reviewer | PASS |
| /account/password | speaker | PASS |
| /admin/* | organizer | PASS |

Totals: **34/34 routes swept, 34/34 PASS** (matches live `ROUTE_MANIFEST.length`
of 34 exactly — every manifest entry was covered, none skipped).
Gate script printed `gate:render-sweep OK` and exited 0.

PASS bar per route: navigation status 200, non-blank rendered text
(`#root` for `/admin/*` SPA routes, `body` for SSR routes), zero
`console-error`/`pageerror` events collected during the visit. All 34
routes met the bar with zero console/page errors observed.

## Teardown

- `npm run gate:render-sweep`'s own process supervision tore down its
  `wrangler dev` child on exit; `ps aux | grep task-w27-d-frozen` after the
  run showed no lingering processes.
- Removed the detached worktree:
  `git worktree remove /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-d-frozen`.

## RESULT

**PASS** — 34/34 routes swept (matching the live `ROUTE_MANIFEST` length of
34), all 200 with non-blank rendered content and zero console-error/
pageerror events. Sha f01459a confirmed via DEC-232 check (allow-listed
non-code-bearing drift only). No open items.
